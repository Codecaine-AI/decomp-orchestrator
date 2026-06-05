import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { activeWorkerCount, addEvent, getLatestRun, getRun, nextUnhandledEvent, openState, type StateStore } from "../../state/index.js";
import { withBusyRetry } from "../../state/db.js";
import { booleanArg, numberArg, stringArg, workerReportTypeArg, type GlobalArgs } from "../args.js";
import { assertSchedulableRun } from "./shared.js";
import { runDirectorTick, type DirectorTickResult } from "./tick.js";
import type { WorkerCycleResult } from "./worker.js";

interface WorkerError {
  workerId: string;
  error: string;
}

interface QueuePressureSnapshot {
  activeWorkers: number;
  blockedQueuedTargets: number;
  candidateLimit: number;
  maxWorkers: number;
  openSlots: number;
  queuedTargets: number;
  runningWorkers: number;
  schedulableTargets: number;
}

interface ReplanPolicy {
  activeLowWatermark: number;
  blockedQueueReplan: boolean;
  longTailReplanMs: number;
  queueLowWatermark: number;
  replanCooldownMs: number;
  replanIntervalMs: number;
  schedulableLowWatermark: number;
}

interface ReplanState {
  lastPeriodicReplanMs: number;
  lastReplanRequestMs: number;
  longTailSinceMs: number | null;
  nowMs: number;
}

export interface ReplanDecision {
  reason:
    | "active_low_watermark"
    | "blocked_queue_pressure"
    | "long_tail_timeout"
    | "periodic_replan"
    | "queue_low_watermark"
    | "schedulable_low_watermark";
  longTailSinceMs: number | null;
}

export interface TriggerAgentResult {
  runId: string;
  mode: "trigger_agent";
  stoppedReason: string;
  iterations: number;
  idleIterations: number;
  desiredWorkers: number;
  maxWorkers: number;
  directorTicks: number;
  workersStarted: number;
  workerResults: WorkerCycleResult[];
  workerErrors: WorkerError[];
  dryRun: boolean;
  finalStatus: {
    activeWorkers: number;
    blockedQueuedTargets: number;
    queuedTargets: number;
    schedulableTargets: number;
    unhandledEvents: number;
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scalar(store: StateStore, sql: string, runId: string): number {
  const row = withBusyRetry(() => store.db.query(sql).get(runId) as Record<string, unknown>);
  return Number(row.count ?? 0);
}

function queuedTargetCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM queue WHERE run_id = ? AND status = 'queued'", runId);
}

function schedulableTargetCount(store: StateStore, runId: string): number {
  return scalar(
    store,
    `
      SELECT COUNT(DISTINCT targets.source_path) AS count
      FROM queue
      JOIN targets ON targets.id = queue.target_id
      WHERE queue.run_id = ?
        AND queue.status = 'queued'
        AND targets.source_path IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM file_locks
          JOIN leases AS lock_leases ON lock_leases.id = file_locks.lease_id
          WHERE file_locks.path = targets.source_path
            AND lock_leases.status = 'active'
        )
    `,
    runId,
  );
}

function blockedQueuedTargetCount(store: StateStore, runId: string): number {
  return scalar(
    store,
    `
      SELECT COUNT(*) AS count
      FROM queue
      JOIN targets ON targets.id = queue.target_id
      WHERE queue.run_id = ?
        AND queue.status = 'queued'
        AND targets.source_path IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM file_locks
          JOIN leases AS lock_leases ON lock_leases.id = file_locks.lease_id
          WHERE file_locks.path = targets.source_path
            AND lock_leases.status = 'active'
        )
    `,
    runId,
  );
}

function unhandledEventCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM events WHERE run_id = ? AND handled_at IS NULL", runId);
}

function unhandledPoolEventCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM events WHERE run_id = ? AND event_type = 'pool_below_target' AND handled_at IS NULL", runId);
}

function activeLocalWorkerCount(store: StateStore, runId: string, workerIds: Set<string>): number {
  if (workerIds.size === 0) return 0;
  const ids = [...workerIds];
  const placeholders = ids.map(() => "?").join(", ");
  const row = withBusyRetry(
    () =>
      store.db
        .query(
          `
            SELECT COUNT(*) AS count
            FROM leases
            JOIN queue ON leases.queue_id = queue.id
            WHERE queue.run_id = ?
              AND leases.status = 'active'
              AND leases.worker_id IN (${placeholders})
          `,
        )
        .get(runId, ...ids) as Record<string, unknown>,
  );
  return Number(row.count ?? 0);
}

export function workerOpenSlots(params: { maxWorkers: number; activeWorkers: number; runningWorkers: number; activeLocalWorkers: number }): number {
  const pendingLocalWorkers = Math.max(0, params.runningWorkers - params.activeLocalWorkers);
  return Math.max(0, params.maxWorkers - params.activeWorkers - pendingLocalWorkers);
}

function longTailActive(snapshot: QueuePressureSnapshot, policy: ReplanPolicy): boolean {
  const hasLiveWork = snapshot.activeWorkers > 0 || snapshot.runningWorkers > 0;
  const underfilled = snapshot.activeWorkers < snapshot.maxWorkers || snapshot.openSlots > 0;
  const queueLow = snapshot.queuedTargets <= policy.queueLowWatermark;
  const schedulableLow = snapshot.schedulableTargets <= policy.schedulableLowWatermark;
  const blockedPressure = policy.blockedQueueReplan && snapshot.blockedQueuedTargets > 0 && snapshot.openSlots > 0 && snapshot.schedulableTargets < snapshot.openSlots;
  return (
    hasLiveWork &&
    snapshot.maxWorkers > 0 &&
    underfilled &&
    snapshot.activeWorkers <= policy.activeLowWatermark &&
    (queueLow || blockedPressure || schedulableLow || snapshot.blockedQueuedTargets > 0)
  );
}

function nextLongTailSinceMs(snapshot: QueuePressureSnapshot, policy: ReplanPolicy, previous: number | null, nowMs: number): number | null {
  return longTailActive(snapshot, policy) ? previous ?? nowMs : null;
}

function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function replanPolicy(args: Map<string, string | true>, params: { candidateLimit: number; maxWorkers: number }): ReplanPolicy {
  return {
    activeLowWatermark: nonNegativeInt(numberArg(args, "--active-low-watermark", Math.ceil(params.maxWorkers * 0.75))),
    blockedQueueReplan: !booleanArg(args, "--no-blocked-queue-replan"),
    longTailReplanMs: nonNegativeInt(numberArg(args, "--long-tail-replan-ms", 5 * 60_000)),
    queueLowWatermark: nonNegativeInt(numberArg(args, "--queue-low-watermark", Math.ceil(params.candidateLimit * 0.25))),
    replanCooldownMs: nonNegativeInt(numberArg(args, "--replan-cooldown-ms", 5 * 60_000)),
    replanIntervalMs: nonNegativeInt(numberArg(args, "--replan-interval-ms", 0)),
    schedulableLowWatermark: nonNegativeInt(numberArg(args, "--schedulable-low-watermark", params.maxWorkers)),
  };
}

export function evaluateReplanDecision(snapshot: QueuePressureSnapshot, policy: ReplanPolicy, state: ReplanState): ReplanDecision | null {
  const hasLiveWork = snapshot.activeWorkers > 0 || snapshot.runningWorkers > 0;
  const hasCapacityPressure = hasLiveWork && snapshot.maxWorkers > 0;
  const underfilled = snapshot.activeWorkers < snapshot.maxWorkers || snapshot.openSlots > 0;
  const schedulableLow = snapshot.schedulableTargets <= policy.schedulableLowWatermark;
  const queueLow = snapshot.queuedTargets <= policy.queueLowWatermark;
  const blockedPressure = policy.blockedQueueReplan && snapshot.blockedQueuedTargets > 0 && snapshot.openSlots > 0 && snapshot.schedulableTargets < snapshot.openSlots;
  const longTailSinceMs = nextLongTailSinceMs(snapshot, policy, state.longTailSinceMs, state.nowMs);
  const cooldownActive = policy.replanCooldownMs > 0 && state.nowMs - state.lastReplanRequestMs < policy.replanCooldownMs;

  if (!hasCapacityPressure) return null;
  if (cooldownActive) return null;

  if (policy.replanIntervalMs > 0 && state.nowMs - state.lastPeriodicReplanMs >= policy.replanIntervalMs) {
    return { reason: "periodic_replan", longTailSinceMs };
  }
  if (blockedPressure) return { reason: "blocked_queue_pressure", longTailSinceMs };
  if (queueLow) return { reason: "queue_low_watermark", longTailSinceMs };
  if (underfilled && schedulableLow) return { reason: "schedulable_low_watermark", longTailSinceMs };
  if (longTailSinceMs != null && policy.longTailReplanMs > 0 && state.nowMs - longTailSinceMs >= policy.longTailReplanMs) {
    return { reason: "long_tail_timeout", longTailSinceMs };
  }
  if (underfilled && snapshot.activeWorkers > 0 && snapshot.activeWorkers <= policy.activeLowWatermark && (queueLow || snapshot.blockedQueuedTargets > 0)) {
    return { reason: "active_low_watermark", longTailSinceMs };
  }

  return null;
}

function writeReplanEvent(store: StateStore, runId: string, decision: ReplanDecision, snapshot: QueuePressureSnapshot, policy: ReplanPolicy): string {
  return addEvent(store, runId, "pool_below_target", "trigger-agent", {
    reason: decision.reason,
    snapshot,
    policy,
    created_by: "trigger-agent",
  });
}

function cloneArgs(args: Map<string, string | true>, entries: [string, string | true][]): Map<string, string | true> {
  const next = new Map(args);
  for (const [key, value] of entries) next.set(key, value);
  return next;
}

async function waitForRestingTrigger(runningWorkers: Set<Promise<void>>, idleSleepMs: number): Promise<void> {
  if (runningWorkers.size === 0) {
    await sleep(idleSleepMs);
    return;
  }
  await Promise.race([sleep(idleSleepMs), ...runningWorkers]);
}

function workerCommand(
  globals: GlobalArgs,
  params: { runId: string; workerId: string; reportType: string; baseRev: string; ttlSeconds: number; thinkingLevel: string },
): string[] {
  const packageRoot = resolve(import.meta.dir, "../../..");
  const bin = resolve(packageRoot, "src/bin/decomp-orchestrator.ts");
  const command = [
    "bun",
    bin,
    "--repo-root",
    globals.repoRoot,
    "--state-dir",
    globals.stateDir,
    "--provider",
    globals.provider,
    "--model",
    globals.model,
    "--thinking-level",
    params.thinkingLevel,
  ];
  if (globals.dryRunAgents) command.push("--dry-run-agents");
  if (globals.agentTimeoutSeconds != null) command.push("--agent-timeout-seconds", String(globals.agentTimeoutSeconds));
  command.push(
    "worker",
    "--run-id",
    params.runId,
    "--worker-id",
    params.workerId,
    "--report-type",
    params.reportType,
    "--base-rev",
    params.baseRev,
    "--ttl-seconds",
    String(params.ttlSeconds),
  );
  return command;
}

async function runWorkerProcess(
  globals: GlobalArgs,
  params: { runId: string; workerId: string; reportType: string; baseRev: string; ttlSeconds: number; thinkingLevel: string },
): Promise<WorkerCycleResult> {
  const packageRoot = resolve(import.meta.dir, "../../..");
  const command = workerCommand(globals, params);
  const proc = Bun.spawn(command, {
    cwd: packageRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdoutPromise = new Response(proc.stdout).text();
  const stderrPromise = new Response(proc.stderr).text();
  const [stdout, stderr, exitCode] = await Promise.all([stdoutPromise, stderrPromise, proc.exited]);
  if (exitCode !== 0) {
    throw new Error(`Worker process failed (${exitCode}): ${command.join(" ")}\n${stderr || stdout}`);
  }
  try {
    return JSON.parse(stdout) as WorkerCycleResult;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Worker process returned non-JSON output: ${detail}\n${stdout}\n${stderr}`);
  }
}

export async function runTriggerAgent(globals: GlobalArgs, args: Map<string, string | true>): Promise<TriggerAgentResult> {
  const store = openState(globals.stateDir);
  const workerResults: WorkerCycleResult[] = [];
  const workerErrors: WorkerError[] = [];
  const directorResults: DirectorTickResult[] = [];
  const runningWorkers = new Set<Promise<void>>();
  const runningWorkerIds = new Set<string>();
  let stoppedReason = "running";
  let stopRequested = false;
  let iterations = 0;
  let idleIterations = 0;
  let workersStarted = 0;
  let workerOrdinal = 0;
  const stop = () => {
    stopRequested = true;
    stoppedReason = "signal";
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    const runId = stringArg(args, "--run-id", getLatestRun(store)?.id ?? "");
    if (!runId) throw new Error("No run found. Run init-run first.");
    const run = getRun(store, runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    assertSchedulableRun(run, "trigger-agent");

    const candidateLimit = numberArg(args, "--candidate-limit", 50);
    const maxIterations = booleanArg(args, "--once") ? 1 : numberArg(args, "--max-iterations", 0);
    const maxIdleIterations = numberArg(args, "--max-idle-iterations", 0);
    const idleSleepMs = numberArg(args, "--idle-sleep-ms", 5_000);
    const maxWorkers = Math.max(0, Math.min(run.desiredWorkers, numberArg(args, "--max-workers", run.desiredWorkers)));
    const reportType = workerReportTypeArg(args, "--report-type", "stalled_no_useful_guess");
    const baseRev = stringArg(args, "--base-rev", "unknown");
    const ttlSeconds = numberArg(args, "--ttl-seconds", 60 * 60);
    const exitOnWorkerError = booleanArg(args, "--exit-on-worker-error");
    const workerThinkingLevel = stringArg(args, "--worker-thinking-level", globals.thinkingLevel);
    const policy = replanPolicy(args, { candidateLimit, maxWorkers });
    let lastReplanRequestMs = 0;
    let lastPeriodicReplanMs = Date.now();
    let longTailSinceMs: number | null = null;

    while (!stopRequested) {
      let didWork = false;

      const activeWorkersBeforeDirector = activeWorkerCount(store, runId);
      const activeLocalWorkersBeforeDirector = activeLocalWorkerCount(store, runId, runningWorkerIds);
      const queuedTargetsBeforeDirector = queuedTargetCount(store, runId);
      const schedulableTargetsBeforeDirector = schedulableTargetCount(store, runId);
      const openSlotsBeforeDirector = workerOpenSlots({
        maxWorkers,
        activeWorkers: activeWorkersBeforeDirector,
        runningWorkers: runningWorkers.size,
        activeLocalWorkers: activeLocalWorkersBeforeDirector,
      });
      const replanSnapshot: QueuePressureSnapshot = {
        activeWorkers: activeWorkersBeforeDirector,
        blockedQueuedTargets: blockedQueuedTargetCount(store, runId),
        candidateLimit,
        maxWorkers,
        openSlots: openSlotsBeforeDirector,
        queuedTargets: queuedTargetsBeforeDirector,
        runningWorkers: runningWorkers.size,
        schedulableTargets: schedulableTargetsBeforeDirector,
      };
      const replanDecision = evaluateReplanDecision(replanSnapshot, policy, {
        lastPeriodicReplanMs,
        lastReplanRequestMs,
        longTailSinceMs,
        nowMs: Date.now(),
      });
      longTailSinceMs = nextLongTailSinceMs(replanSnapshot, policy, longTailSinceMs, Date.now());
      if (replanDecision && unhandledPoolEventCount(store, runId) === 0) {
        writeReplanEvent(store, runId, replanDecision, replanSnapshot, policy);
        lastReplanRequestMs = Date.now();
        if (replanDecision.reason === "periodic_replan") lastPeriodicReplanMs = lastReplanRequestMs;
        didWork = true;
      }

      if (nextUnhandledEvent(store, runId)) {
        const result = await runDirectorTick(
          globals,
          cloneArgs(args, [
            ["--run-id", runId],
            ["--candidate-limit", String(candidateLimit)],
          ]),
        );
        directorResults.push(result);
        didWork = result.status !== "no_unhandled_events";
      }

      const activeWorkers = activeWorkerCount(store, runId);
      const activeLocalWorkers = activeLocalWorkerCount(store, runId, runningWorkerIds);
      const queuedTargets = schedulableTargetCount(store, runId);
      const openSlots = workerOpenSlots({
        maxWorkers,
        activeWorkers,
        runningWorkers: runningWorkers.size,
        activeLocalWorkers,
      });
      const workersToStart = Math.min(openSlots, queuedTargets);
      for (let index = 0; index < workersToStart; index += 1) {
        workerOrdinal += 1;
        workersStarted += 1;
        didWork = true;
        const workerId = `trigger-${process.pid}-${workerOrdinal}-${randomUUID().slice(0, 8)}`;
        let task: Promise<void>;
        task = runWorkerProcess(
          globals,
          {
            runId,
            workerId,
            reportType,
            baseRev,
            ttlSeconds,
            thinkingLevel: workerThinkingLevel,
          },
        )
          .then((result) => {
            workerResults.push(result);
          })
          .catch((error) => {
            workerErrors.push({
              workerId,
              error: error instanceof Error ? error.message : String(error),
            });
            if (exitOnWorkerError) {
              stopRequested = true;
              stoppedReason = "worker_error";
            }
          })
          .finally(() => {
            runningWorkers.delete(task);
            runningWorkerIds.delete(workerId);
          });
        runningWorkers.add(task);
        runningWorkerIds.add(workerId);
      }

      if (didWork || runningWorkers.size === 0) iterations += 1;
      if (didWork || runningWorkers.size > 0) idleIterations = 0;
      else idleIterations += 1;

      if (maxIterations > 0 && iterations >= maxIterations && runningWorkers.size === 0) {
        stoppedReason = "max_iterations";
        break;
      }
      if (maxIdleIterations > 0 && idleIterations >= maxIdleIterations) {
        stoppedReason = "idle";
        break;
      }

      await waitForRestingTrigger(runningWorkers, idleSleepMs);
    }

    if (runningWorkers.size > 0) await Promise.allSettled([...runningWorkers]);
    if (stoppedReason === "running") stoppedReason = "complete";

    return {
      runId,
      mode: "trigger_agent",
      stoppedReason,
      iterations,
      idleIterations,
      desiredWorkers: run.desiredWorkers,
      maxWorkers,
      directorTicks: directorResults.filter((result) => result.status !== "no_unhandled_events").length,
      workersStarted,
      workerResults,
      workerErrors,
      dryRun: globals.dryRunAgents,
      finalStatus: {
        activeWorkers: activeWorkerCount(store, runId),
        blockedQueuedTargets: blockedQueuedTargetCount(store, runId),
        queuedTargets: queuedTargetCount(store, runId),
        schedulableTargets: schedulableTargetCount(store, runId),
        unhandledEvents: unhandledEventCount(store, runId),
      },
    };
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    store.db.close();
  }
}

export async function triggerAgent(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  console.log(JSON.stringify(await runTriggerAgent(globals, args), null, 2));
}
