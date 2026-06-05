#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadBoardSnapshot } from "../board.js";
import { directorPrompt, workerPrompt } from "../prompts.js";
import { runPiAgent } from "../pi_sdk.js";
import {
  activeWorkerCount,
  activeLeasesForRun,
  addDirectorCycle,
  addBoardTargets,
  addPiSession,
  createRun,
  getLatestRun,
  getRun,
  leaseNextQueuedTarget,
  markEventHandled,
  nextUnhandledEvent,
  openState,
  prioritizeQueuedTargets,
  recordWorkerReport,
  statusSnapshot,
} from "../state.js";
import type { BoardSnapshot, TargetCandidate, WorkerReportType } from "../types.js";

interface GlobalArgs {
  repoRoot: string;
  stateDir: string;
  dryRunAgents: boolean;
  provider: string;
  model: string;
  thinkingLevel: string;
  agentTimeoutSeconds?: number;
}

const DEFAULT_STATE_DIR_NAME = ".decomp-orchestrator-state";
const DEFAULT_PI_PROVIDER = "codex-lb";
const DEFAULT_PI_MODEL = "gpt-5.5";
const DEFAULT_PI_THINKING_LEVEL = "xhigh";

function usage(): string {
  return [
    "Usage:",
    "  decomp-orchestrator [global flags] init-run [--goal-kind kind] [--goal-value n] [--desired-workers n] [--candidate-limit n]",
    "  decomp-orchestrator [global flags] tick [--run-id id] [--candidate-limit n]",
    "  decomp-orchestrator [global flags] worker [--run-id id] [--worker-id id] [--report-type type] [--base-rev rev] [--ttl-seconds n]",
    "  decomp-orchestrator [global flags] recover-leases [--run-id id] [--force] [--lease-id id] [--reason text]",
    "  decomp-orchestrator [global flags] status",
    "",
    "Global flags:",
    "  --repo-root <path>          default: current working directory",
    `  --state-dir <path>         default: <repo-root>/${DEFAULT_STATE_DIR_NAME}`,
    "  --dry-run-agents           do not call Pi SDK; write prompts as outputs",
    `  --provider <name>          default: ${DEFAULT_PI_PROVIDER}`,
    `  --model <name>             default: ${DEFAULT_PI_MODEL}`,
    `  --thinking-level <level>   default: ${DEFAULT_PI_THINKING_LEVEL}`,
    "  --agent-timeout-seconds n  bound each live Pi session; default: no timeout",
  ].join("\n");
}

function readFlag(argv: string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argv[index]}`);
  return value;
}

function parse(argv: string[]): { command: string; globals: GlobalArgs; args: Map<string, string | true> } {
  const globals: GlobalArgs = {
    repoRoot: process.cwd(),
    stateDir: "",
    dryRunAgents: false,
    provider: DEFAULT_PI_PROVIDER,
    model: DEFAULT_PI_MODEL,
    thinkingLevel: DEFAULT_PI_THINKING_LEVEL,
  };
  const args = new Map<string, string | true>();
  let command = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (!command && !arg.startsWith("--")) {
      command = arg;
      continue;
    }

    if (arg === "--repo-root") {
      globals.repoRoot = resolve(readFlag(argv, i));
      i += 1;
    } else if (arg === "--state-dir") {
      globals.stateDir = resolve(readFlag(argv, i));
      i += 1;
    } else if (arg === "--dry-run-agents") {
      globals.dryRunAgents = true;
    } else if (arg === "--provider") {
      globals.provider = readFlag(argv, i);
      i += 1;
    } else if (arg === "--model") {
      globals.model = readFlag(argv, i);
      i += 1;
    } else if (arg === "--thinking-level") {
      globals.thinkingLevel = readFlag(argv, i);
      i += 1;
    } else if (arg === "--agent-timeout-seconds") {
      globals.agentTimeoutSeconds = Number(readFlag(argv, i));
      if (!Number.isFinite(globals.agentTimeoutSeconds) || globals.agentTimeoutSeconds < 0) {
        throw new Error(`Invalid --agent-timeout-seconds: ${String(argv[i + 1])}`);
      }
      i += 1;
    } else if (arg.startsWith("--")) {
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args.set(arg, value);
        i += 1;
      } else {
        args.set(arg, true);
      }
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!command) command = "status";
  if (!globals.stateDir) globals.stateDir = resolve(globals.repoRoot, DEFAULT_STATE_DIR_NAME);
  return { command, globals, args };
}

function stringArg(args: Map<string, string | true>, name: string, fallback: string): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

function numberArg(args: Map<string, string | true>, name: string, fallback: number): number {
  const raw = args.get(name);
  if (typeof raw !== "string") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric`);
  return value;
}

function booleanArg(args: Map<string, string | true>, name: string): boolean {
  return args.get(name) === true;
}

function workerReportTypeArg(args: Map<string, string | true>, name: string, fallback: WorkerReportType): WorkerReportType {
  const value = stringArg(args, name, fallback);
  if (value === "stalled_no_useful_guess" || value === "progress" || value === "needs_fact" || value === "score_candidate") {
    return value;
  }
  throw new Error(`${name} must be one of: stalled_no_useful_guess, progress, needs_fact, score_candidate`);
}

function isWorkerReportType(value: unknown): value is WorkerReportType {
  return value === "stalled_no_useful_guess" || value === "progress" || value === "needs_fact" || value === "score_candidate";
}

function stripPiFailureTrailer(rawText: string): string {
  const marker = "\n\n[Pi session failed]\n";
  const markerAt = rawText.indexOf(marker);
  return (markerAt >= 0 ? rawText.slice(0, markerAt) : rawText).trim();
}

function parseJsonObject(rawText: string): { object: Record<string, unknown> | null; error?: string } {
  const trimmed = stripPiFailureTrailer(rawText);
  if (!trimmed) return { object: null, error: "empty agent output" };

  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { object: parsed as Record<string, unknown> };
    } catch {
      // Try the next extraction strategy.
    }
  }
  return { object: null, error: "agent output did not contain a parseable JSON object" };
}

function findArrayStart(rawText: string, propertyName: string): number {
  const propertyAt = rawText.indexOf(`"${propertyName}"`);
  if (propertyAt < 0) return -1;
  const arrayAt = rawText.indexOf("[", propertyAt);
  return arrayAt;
}

function extractCompleteObjectsFromArray(rawText: string, propertyName: string): Record<string, unknown>[] {
  const text = stripPiFailureTrailer(rawText);
  const arrayAt = findArrayStart(text, propertyName);
  if (arrayAt < 0) return [];

  const objects: Record<string, unknown>[] = [];
  let objectStart = -1;
  let braceDepth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayAt + 1; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (braceDepth === 0) objectStart = index;
      braceDepth += 1;
      continue;
    }
    if (char === "}") {
      if (braceDepth === 0) continue;
      braceDepth -= 1;
      if (braceDepth === 0 && objectStart >= 0) {
        try {
          const parsed = JSON.parse(text.slice(objectStart, index + 1)) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            objects.push(parsed as Record<string, unknown>);
          }
        } catch {
          // Ignore this object and keep scanning for later complete objects.
        }
        objectStart = -1;
      }
      continue;
    }
    if (char === "]" && braceDepth === 0) break;
  }

  return objects;
}

function parseWorkerAgentReport(rawText: string): { report: Record<string, unknown> | null; error?: string } {
  const parsed = parseJsonObject(rawText);
  return { report: parsed.object, error: parsed.error };
}

function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function directorQueuedTargets(rawText: string, snapshot: BoardSnapshot): { candidates: TargetCandidate[]; skipped: number; error?: string } {
  const parsed = parseJsonObject(rawText);
  const packets = parsed.object
    ? Array.isArray(parsed.object.target_packets)
      ? parsed.object.target_packets
      : []
    : extractCompleteObjectsFromArray(rawText, "target_packets");
  if (!parsed.object && packets.length === 0) return { candidates: [], skipped: 0, error: parsed.error };
  const baselineByKey = new Map(snapshot.candidates.map((candidate) => [`${candidate.unit}::${candidate.symbol}`, candidate]));
  const candidates: TargetCandidate[] = [];
  let skipped = 0;

  for (const [index, value] of packets.entries()) {
    const packet = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const unit = typeof packet.unit === "string" ? packet.unit : "";
    const symbol = typeof packet.symbol === "string" ? packet.symbol : "";
    const baseline = baselineByKey.get(`${unit}::${symbol}`);
    const sourcePath = typeof packet.source_path === "string" && packet.source_path ? packet.source_path : baseline?.sourcePath;
    const size = numberField(packet.size) ?? baseline?.size;
    const fuzzy = numberField(packet.fuzzy_match_percent) ?? baseline?.fuzzy;
    if (!unit || !symbol || !sourcePath || size == null || fuzzy == null) {
      skipped += 1;
      continue;
    }

    const whyNow = typeof packet.why_now === "string" && packet.why_now ? packet.why_now : "director-selected target";
    candidates.push({
      unit,
      symbol,
      sourcePath,
      size,
      fuzzy,
      priority: 1_000_000_000 - index,
      reason: `director: ${whyNow}`,
    });
  }

  return {
    candidates,
    skipped,
    error: parsed.object ? undefined : `partial director output salvaged ${candidates.length} target packet(s): ${parsed.error}`,
  };
}

async function initRun(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const store = openState(globals.stateDir);
  const goalKind = stringArg(args, "--goal-kind", "matched_code_percent");
  const goalValue = numberArg(args, "--goal-value", 70);
  const desiredWorkers = numberArg(args, "--desired-workers", 16);
  const candidateLimit = numberArg(args, "--candidate-limit", 50);
  const run = createRun(store, goalKind, goalValue, desiredWorkers);
  const snapshot = loadBoardSnapshot(globals.repoRoot, candidateLimit);
  const targetCount = addBoardTargets(store, run.id, snapshot);
  await mkdir(resolve(globals.stateDir, "runs", run.id, "snapshots"), { recursive: true });
  await writeFile(resolve(globals.stateDir, "runs", run.id, "snapshots", "initial_board.json"), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ run, targetCount, stateDir: globals.stateDir, measures: snapshot.measures }, null, 2));
}

async function tick(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const store = openState(globals.stateDir);
  const runId = stringArg(args, "--run-id", getLatestRun(store)?.id ?? "");
  if (!runId) throw new Error("No run found. Run init-run first.");
  const event = nextUnhandledEvent(store, runId);
  if (!event) {
    console.log(JSON.stringify({ runId, status: "no_unhandled_events" }, null, 2));
    return;
  }
  const candidateLimit = numberArg(args, "--candidate-limit", 50);
  const run = getRun(store, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const snapshot = loadBoardSnapshot(globals.repoRoot, candidateLimit);
  const outputDir = resolve(globals.stateDir, "runs", runId, "director_cycles");
  const activeWorkers = activeWorkerCount(store, runId);
  const initialBoardPath = resolve(globals.stateDir, "runs", runId, "snapshots", "initial_board.json");
  const result = await runPiAgent({
    role: "director",
    cwd: globals.repoRoot,
    prompt: directorPrompt({
      run,
      snapshot,
      event,
      activeWorkers,
      repoRoot: globals.repoRoot,
      stateDir: globals.stateDir,
      initialBoardPath,
    }),
    outputDir,
    dryRun: globals.dryRunAgents,
    provider: globals.provider,
    model: globals.model,
    thinkingLevel: globals.thinkingLevel,
    timeoutMs: globals.agentTimeoutSeconds ? globals.agentTimeoutSeconds * 1000 : undefined,
  });
  addPiSession({
    store,
    runId,
    role: "director",
    sessionId: result.sessionId,
    sessionFile: result.sessionFile,
    provider: globals.provider,
    model: globals.model,
    thinkingLevel: globals.thinkingLevel,
    status: result.failed ? "failed" : result.dryRun ? "dry_run" : "succeeded",
    outputPath: result.outputPath,
  });
  const directorCycleId = addDirectorCycle({
    store,
    runId,
    triggerEvent: String(event.id),
    activeWorkers,
    summaryPath: result.outputPath,
    decisionPath: result.outputPath,
  });
  const directorTargets = directorQueuedTargets(result.rawText, snapshot);
  const prioritizedTargets = directorTargets.candidates.length
    ? prioritizeQueuedTargets(store, runId, directorTargets.candidates)
    : 0;
  const handled = directorTargets.candidates.length > 0 || (!result.failed && !directorTargets.error);
  if (handled) markEventHandled(store, String(event.id));
  console.log(
    JSON.stringify(
      {
        runId,
        handledEvent: handled ? event.id : null,
        unhandledEvent: handled ? null : event.id,
        directorCycleId,
        directorOutput: result.outputPath,
        directorSystemPrompt: result.systemPromptPath,
        directorUserPrompt: result.userPromptPath,
        directorTargetUpdates: prioritizedTargets,
        directorTargetPackets: directorTargets.candidates.length,
        directorTargetPacketsSkipped: directorTargets.skipped,
        directorTargetParseError: directorTargets.error ?? null,
        directorPiError: result.error ?? null,
        partialDirectorOutputUsed: Boolean(result.failed && directorTargets.candidates.length > 0),
        dryRun: result.dryRun,
        failed: result.failed ?? false,
      },
      null,
      2,
    ),
  );
}

function targetPacketTarget(target: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(target.target_id),
    unit: String(target.unit),
    symbol: String(target.symbol),
    source_path: String(target.source_path),
    size: Number(target.size),
    fuzzy_match_percent: Number(target.fuzzy),
    priority: Number(target.priority),
    reason: String(target.reason ?? ""),
  };
}

async function worker(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const store = openState(globals.stateDir);
  const runId = stringArg(args, "--run-id", getLatestRun(store)?.id ?? "");
  if (!runId) throw new Error("No run found. Run init-run first.");
  const run = getRun(store, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const workerId = stringArg(args, "--worker-id", `worker-${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`);
  const fallbackReportType = workerReportTypeArg(args, "--report-type", "stalled_no_useful_guess");
  const baseRev = stringArg(args, "--base-rev", "unknown");
  const ttlSeconds = numberArg(args, "--ttl-seconds", 60 * 60);
  const leased = leaseNextQueuedTarget({ store, runId, workerId, baseRev, ttlSeconds });
  if (!leased) throw new Error(`No queued, unlocked targets available for run ${runId}`);

  const snapshot = loadBoardSnapshot(globals.repoRoot, 12);
  const target = targetPacketTarget(leased.target);
  const packet = {
    run,
    lease: {
      id: leased.leaseId,
      queue_id: leased.queueId,
      worker_id: leased.workerId,
      ttl: leased.ttl,
      write_set: leased.writeSet,
    },
    target,
    baseline: {
      measures: snapshot.measures,
      fuzzy_match_percent: target.fuzzy_match_percent,
    },
    enabled_capabilities: ["context_packaging", "focused_source_editing", "duplicate_adaptation", "fact_research"],
    budget: {
      max_attempts: globals.dryRunAgents ? 1 : 12,
      wall_clock_minutes: globals.dryRunAgents ? 5 : 45,
      file_understanding_minutes: globals.dryRunAgents ? 0 : 10,
      extension_minutes_if_progress: globals.dryRunAgents ? 0 : 15,
      continue_after_positive_delta: !globals.dryRunAgents,
    },
    stop_rule: globals.dryRunAgents
      ? "For this vertical-slice smoke path, stop after producing one evidence-backed worker report."
      : "Spend enough time to understand the leased file and target context before editing. Make evidence-backed scoped edits only inside the write_set, verify each attempt with narrow object builds and narrow objdiff only, never run global report refresh commands such as ninja build/GALE01/report.json, retain improvements, undo only the worker's own regression/no-op hunks, preserve pre-existing dirty work, never use whole-file destructive git checkout/restore/reset/clean commands, and continue after a positive score delta until the budget expires or remaining ideas become speculative.",
    report_contract: {
      report_types: ["progress", "stalled_no_useful_guess", "needs_fact", "score_candidate"],
      durable_paths: ["summary_path", "facts_path", "blocker_path", "patch_path"],
      wake_event: "worker_finished, worker_stalled, needs_fact, or score_candidate",
    },
  };
  const outputDir = resolve(globals.stateDir, "runs", runId, "worker_logs", leased.leaseId);
  const initialBoardPath = resolve(globals.stateDir, "runs", runId, "snapshots", "initial_board.json");
  let result: Awaited<ReturnType<typeof runPiAgent>>;
  try {
    result = await runPiAgent({
      role: "worker",
      cwd: globals.repoRoot,
      prompt: workerPrompt({
        packet,
        repoRoot: globals.repoRoot,
        stateDir: globals.stateDir,
        initialBoardPath,
        workerLogDir: outputDir,
      }),
      outputDir,
      dryRun: globals.dryRunAgents,
      provider: globals.provider,
      model: globals.model,
      thinkingLevel: globals.thinkingLevel,
      timeoutMs: globals.agentTimeoutSeconds ? globals.agentTimeoutSeconds * 1000 : undefined,
    });
  } catch (error) {
    const reportDir = resolve(outputDir, "report");
    await mkdir(reportDir, { recursive: true });
    const summaryPath = resolve(reportDir, "worker_report.json");
    const factsPath = resolve(reportDir, "facts.json");
    const blockerPath = resolve(reportDir, "blocker.json");
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      summaryPath,
      JSON.stringify(
        {
          run_id: runId,
          lease_id: leased.leaseId,
          worker_id: leased.workerId,
          target,
          write_set: leased.writeSet,
          report_type: "stalled_no_useful_guess",
          summary: `Worker Pi session failed before producing a report: ${message}`,
          created_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    await writeFile(factsPath, JSON.stringify([], null, 2));
    await writeFile(
      blockerPath,
      JSON.stringify(
        {
          reason: "worker_pi_session_failed",
          note: message,
        },
        null,
        2,
      ),
    );
    const report = recordWorkerReport({
      store,
      runId,
      leaseId: leased.leaseId,
      reportType: "stalled_no_useful_guess",
      summaryPath,
      factsPath,
      blockerPath,
      payload: {
        lease_id: leased.leaseId,
        worker_id: leased.workerId,
        target,
        report_type: "stalled_no_useful_guess",
        summary_path: summaryPath,
        error: message,
      },
    });
    console.log(
      JSON.stringify(
        {
          runId,
          leaseId: leased.leaseId,
          target: leased.targetId,
          writeSet: leased.writeSet,
          workerReport: summaryPath,
          reportId: report.reportId,
          wakeEvent: report.eventId,
          dryRun: globals.dryRunAgents,
          error: message,
        },
        null,
        2,
      ),
    );
    return;
  }
  addPiSession({
    store,
    runId,
    leaseId: leased.leaseId,
    role: "worker",
    sessionId: result.sessionId,
    sessionFile: result.sessionFile,
    provider: globals.provider,
    model: globals.model,
    thinkingLevel: globals.thinkingLevel,
    status: result.failed ? "failed" : result.dryRun ? "dry_run" : "succeeded",
    outputPath: result.outputPath,
  });

  const reportDir = resolve(outputDir, "report");
  await mkdir(reportDir, { recursive: true });
  const summaryPath = resolve(reportDir, "worker_report.json");
  const factsPath = resolve(reportDir, "facts.json");
  const parsedAgentReport =
    result.dryRun || result.failed
      ? { report: null as Record<string, unknown> | null, error: result.error }
      : parseWorkerAgentReport(result.rawText);
  const agentReport = parsedAgentReport.report;
  const agentReportType = agentReport ? agentReport.report_type : null;
  const reportType = result.failed ? "stalled_no_useful_guess" : isWorkerReportType(agentReportType) ? agentReportType : fallbackReportType;
  const agentFacts = Array.isArray(agentReport?.facts) ? agentReport.facts : [];
  const agentBlockers = Array.isArray(agentReport?.blockers) ? agentReport.blockers : [];
  const blockerPath =
    reportType === "stalled_no_useful_guess" || reportType === "needs_fact" || parsedAgentReport.error || agentBlockers.length > 0
      ? resolve(reportDir, "blocker.json")
      : undefined;
  const patchPath = typeof agentReport?.patch_path === "string" ? agentReport.patch_path : undefined;
  const reportSummaryText =
    typeof agentReport?.summary === "string"
      ? agentReport.summary
      : result.dryRun && reportType === "stalled_no_useful_guess"
        ? "Dry-run worker preserved the target packet and stopped before unsupported edits."
        : result.dryRun
          ? "Dry-run worker completed the configured report path."
          : result.failed
            ? `Worker Pi session failed before producing a complete report: ${result.error ?? "unknown error"}`
            : "Live worker output was persisted for reducer review.";
  const reportSummary = {
    run_id: runId,
    lease_id: leased.leaseId,
    worker_id: leased.workerId,
    target,
    write_set: leased.writeSet,
    report_type: reportType,
    agent_output_path: result.outputPath,
    summary: reportSummaryText,
    agent_report: agentReport,
    agent_report_parse_error: parsedAgentReport.error ?? null,
    created_at: new Date().toISOString(),
  };
  await writeFile(summaryPath, JSON.stringify(reportSummary, null, 2));
  await writeFile(factsPath, JSON.stringify(agentFacts, null, 2));
  if (blockerPath) {
    await writeFile(
      blockerPath,
      JSON.stringify(
        {
          reason: reportType,
          note: parsedAgentReport.error ?? (result.dryRun ? "Synthetic smoke report." : "Live worker reported blockers."),
          blockers: agentBlockers,
        },
        null,
        2,
      ),
    );
  }

  const report = recordWorkerReport({
    store,
    runId,
    leaseId: leased.leaseId,
    reportType,
    summaryPath,
    factsPath,
    blockerPath,
    patchPath,
    payload: {
      lease_id: leased.leaseId,
      worker_id: leased.workerId,
      target,
      report_type: reportType,
      summary_path: summaryPath,
    },
  });
  console.log(
    JSON.stringify(
      {
        runId,
        leaseId: leased.leaseId,
        target: leased.targetId,
        writeSet: leased.writeSet,
        workerOutput: result.outputPath,
        workerSystemPrompt: result.systemPromptPath,
        workerUserPrompt: result.userPromptPath,
        workerReport: summaryPath,
        reportId: report.reportId,
        wakeEvent: report.eventId,
        dryRun: result.dryRun,
        failed: result.failed ?? false,
      },
      null,
      2,
    ),
  );
}

function leaseExpired(ttl: string): boolean {
  const ttlMs = Date.parse(ttl);
  return Number.isFinite(ttlMs) && ttlMs <= Date.now();
}

async function recoverLeases(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const store = openState(globals.stateDir);
  const runId = stringArg(args, "--run-id", getLatestRun(store)?.id ?? "");
  if (!runId) throw new Error("No run found. Run init-run first.");
  const run = getRun(store, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  const force = booleanArg(args, "--force");
  const leaseIdFilter = stringArg(args, "--lease-id", "");
  const reason = stringArg(args, "--reason", force ? "forced lease recovery after interrupted worker process" : "expired lease recovery");
  const activeLeases = activeLeasesForRun(store, runId);
  const selectedLeases = activeLeases.filter((lease) => {
    if (leaseIdFilter && lease.leaseId !== leaseIdFilter) return false;
    return force || leaseExpired(lease.ttl);
  });
  const skippedLeases = activeLeases.filter((lease) => !selectedLeases.some((selected) => selected.leaseId === lease.leaseId));
  const recovered: Record<string, unknown>[] = [];

  for (const lease of selectedLeases) {
    const target = targetPacketTarget(lease.target);
    const reportDir = resolve(globals.stateDir, "runs", runId, "worker_logs", lease.leaseId, "report");
    await mkdir(reportDir, { recursive: true });
    const summaryPath = resolve(reportDir, "worker_report.json");
    const factsPath = resolve(reportDir, "facts.json");
    const blockerPath = resolve(reportDir, "blocker.json");
    const summary = {
      run_id: runId,
      lease_id: lease.leaseId,
      worker_id: lease.workerId,
      target,
      write_set: lease.writeSet,
      report_type: "stalled_no_useful_guess",
      summary: `Recovered interrupted active lease: ${reason}`,
      recovered_by: "recover-leases",
      recovered_at: new Date().toISOString(),
    };
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    await writeFile(factsPath, JSON.stringify([], null, 2));
    await writeFile(
      blockerPath,
      JSON.stringify(
        {
          reason: "lease_recovered",
          note: reason,
          ttl: lease.ttl,
          heartbeat_at: lease.heartbeatAt,
        },
        null,
        2,
      ),
    );

    const report = recordWorkerReport({
      store,
      runId,
      leaseId: lease.leaseId,
      reportType: "stalled_no_useful_guess",
      summaryPath,
      factsPath,
      blockerPath,
      payload: {
        lease_id: lease.leaseId,
        worker_id: lease.workerId,
        target,
        report_type: "stalled_no_useful_guess",
        summary_path: summaryPath,
        recovered_by: "recover-leases",
        reason,
      },
    });
    recovered.push({
      leaseId: lease.leaseId,
      workerId: lease.workerId,
      target,
      writeSet: lease.writeSet,
      reportId: report.reportId,
      wakeEvent: report.eventId,
      workerReport: summaryPath,
    });
  }

  console.log(
    JSON.stringify(
      {
        runId,
        force,
        scannedActiveLeases: activeLeases.length,
        recoveredLeases: recovered.length,
        recovered,
        skippedActiveLeases: skippedLeases.map((lease) => ({
          leaseId: lease.leaseId,
          workerId: lease.workerId,
          ttl: lease.ttl,
          target: targetPacketTarget(lease.target),
          reason: force ? "lease_id_filter" : "not_expired_without_force",
        })),
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const { command, globals, args } = parse(process.argv.slice(2));
  if (command === "init-run") await initRun(globals, args);
  else if (command === "tick") await tick(globals, args);
  else if (command === "worker") await worker(globals, args);
  else if (command === "recover-leases") await recoverLeases(globals, args);
  else if (command === "status") console.log(JSON.stringify(statusSnapshot(openState(globals.stateDir)), null, 2));
  else throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
