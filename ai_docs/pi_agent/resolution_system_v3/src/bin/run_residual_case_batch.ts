import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refreshProviderAuth } from "../../../resolution_system/src/pi_runner.js";
import { readJson, writeJson } from "../io/json.js";
import type { ThinkingLevel } from "../../../resolution_system/src/pi_runner.js";

type LedgerStatus = "pending" | "running" | "succeeded" | "failed" | "rate_limited" | "skipped_existing";
type JsonObject = Record<string, unknown>;

interface Args {
  objectsDir: string;
  objectIds: string[];
  limit?: number;
  concurrency: number;
  retryCount: number;
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  ledgerPath: string;
  logPath: string;
  manualReviewPath: string;
  dryRunAgents: boolean;
  gridOverlay: boolean;
  alignmentResiduals: boolean;
  maxAlignmentPairs: number;
  rerunExisting: boolean;
  resumeIncomplete: boolean;
  humanUnreviewedOnly: boolean;
  refreshAuth: boolean;
  stopOnRateLimit: boolean;
}

interface LedgerRecord {
  object_id: string;
  status: LedgerStatus;
  attempts: number;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  elapsed_ms?: number;
  worker_id?: number;
  error?: string;
  output_paths?: Record<string, string>;
}

interface Ledger {
  schema_version: "v3_residual_pi_batch_0.1";
  generated_at: string;
  updated_at: string;
  objects_dir: string;
  provider: string;
  model: string;
  thinking_level: ThinkingLevel;
  concurrency: number;
  retry_count: number;
  dry_run_agents: boolean;
  grid_overlay: boolean;
  alignment_residuals: boolean;
  max_alignment_pairs: number;
  rerun_existing: boolean;
  resume_incomplete: boolean;
  human_unreviewed_only: boolean;
  manual_review_path: string;
  stop_on_rate_limit: boolean;
  log_path: string;
  totals: Record<LedgerStatus | "selected" | "complete" | "incomplete", number>;
  records: Record<string, LedgerRecord>;
  rate_limit?: {
    detected_at: string;
    object_id: string;
    error: string;
  };
  auth_refresh?: JsonObject;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "../../..");
const systemRoot = resolve(repoRoot, "resolution_system_v3");
const defaultMaxAlignmentPairs = 36;

function usage(): string {
  return [
    "Usage:",
    "  bun run run-batch -- [--objects-dir <path>] [--object-id <id>] [--limit n] [--concurrency n] [--retry-count n] [--no-grid-overlay] [--no-alignment-residuals] [--human-unreviewed-only] [--rerun-existing] [--resume-incomplete] [--dry-run-agents]",
    "",
    "Defaults:",
    "  --objects-dir outputs/residual_case_preflight",
    "  --concurrency 1",
    "  --retry-count 0",
    "  --provider codex-lb",
    "  --model gpt-5.5",
    "  --thinking-level xhigh",
    "  gray 3x3 grid overlays enabled",
    "  generated alignment residual sheets enabled",
  ].join("\n");
}

function timestampForPath(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolveFromSystemRoot(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(systemRoot, pathValue);
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function nonNegativeInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${flag} must be zero or a positive integer`);
  return parsed;
}

function parseArgs(argv: string[]): Args {
  const defaultObjectsDir = resolve(systemRoot, "outputs/residual_case_preflight");
  const args: Args = {
    objectsDir: defaultObjectsDir,
    objectIds: [],
    concurrency: 1,
    retryCount: 0,
    provider: "codex-lb",
    model: "gpt-5.5",
    thinkingLevel: "xhigh",
    ledgerPath: resolve(defaultObjectsDir, "pi_batch_ledger.json"),
    logPath: resolve(systemRoot, "outputs/run_logs", `residual_v3_batch_${timestampForPath()}.log`),
    manualReviewPath: resolve(defaultObjectsDir, "manual_v3_review.decisions.json"),
    dryRunAgents: false,
    gridOverlay: true,
    alignmentResiduals: true,
    maxAlignmentPairs: defaultMaxAlignmentPairs,
    rerunExisting: false,
    resumeIncomplete: false,
    humanUnreviewedOnly: false,
    refreshAuth: true,
    stopOnRateLimit: true,
  };

  let ledgerWasExplicit = false;
  let manualReviewWasExplicit = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    if (arg === "--objects-dir") {
      args.objectsDir = resolveFromSystemRoot(next());
      if (!ledgerWasExplicit) args.ledgerPath = resolve(args.objectsDir, "pi_batch_ledger.json");
      if (!manualReviewWasExplicit) args.manualReviewPath = resolve(args.objectsDir, "manual_v3_review.decisions.json");
    } else if (arg === "--object-id") args.objectIds.push(next());
    else if (arg === "--limit") args.limit = positiveInt(next(), "--limit");
    else if (arg === "--concurrency") args.concurrency = positiveInt(next(), "--concurrency");
    else if (arg === "--retry-count") args.retryCount = nonNegativeInt(next(), "--retry-count");
    else if (arg === "--provider") args.provider = next();
    else if (arg === "--model") args.model = next();
    else if (arg === "--thinking-level") args.thinkingLevel = next() as ThinkingLevel;
    else if (arg === "--ledger") {
      args.ledgerPath = resolveFromSystemRoot(next());
      ledgerWasExplicit = true;
    } else if (arg === "--log") args.logPath = resolveFromSystemRoot(next());
    else if (arg === "--manual-review") {
      args.manualReviewPath = resolveFromSystemRoot(next());
      manualReviewWasExplicit = true;
    } else if (arg === "--dry-run-agents") args.dryRunAgents = true;
    else if (arg === "--grid-overlay") args.gridOverlay = true;
    else if (arg === "--no-grid-overlay") args.gridOverlay = false;
    else if (arg === "--alignment-residuals") args.alignmentResiduals = true;
    else if (arg === "--no-alignment-residuals") args.alignmentResiduals = false;
    else if (arg === "--max-alignment-pairs") args.maxAlignmentPairs = positiveInt(next(), "--max-alignment-pairs");
    else if (arg === "--rerun-existing") args.rerunExisting = true;
    else if (arg === "--resume-incomplete") args.resumeIncomplete = true;
    else if (arg === "--human-unreviewed-only") args.humanUnreviewedOnly = true;
    else if (arg === "--skip-auth-refresh") args.refreshAuth = false;
    else if (arg === "--no-stop-on-rate-limit") args.stopOnRateLimit = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (!isAllowedPiProvider(args.provider)) {
    throw new Error(`Refusing non-OpenAI-compatible Pi provider for this run: ${args.provider}`);
  }
  return args;
}

function isAllowedPiProvider(provider: string): boolean {
  const normalized = provider.toLowerCase();
  return normalized.includes("openai") || normalized === "codex-lb";
}

async function readJsonMaybe<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function listObjectIds(objectsDir: string): Promise<string[]> {
  const root = resolve(objectsDir, "objects");
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "case_object.json")))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function decisionRecord(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : null;
}

async function filterHumanUnreviewedObjectIds(args: Args, objectIds: string[]): Promise<string[]> {
  if (!args.humanUnreviewedOnly) return objectIds;
  const manualReview = await readJsonMaybe<JsonObject>(args.manualReviewPath);
  const decisions = decisionRecord(manualReview?.decisions) ?? {};
  return objectIds.filter((objectId) => {
    const decision = decisionRecord(decisions[objectId]);
    const value = typeof decision?.decision === "string" ? decision.decision : "";
    return !value || value === "unreviewed";
  });
}

function outputPathsFor(args: Args, objectId: string): Record<string, string> {
  const outputDir = resolve(args.objectsDir, "objects", objectId, "agent_output");
  return {
    dry_run: resolve(outputDir, "dry_run.json"),
    raw_response: resolve(outputDir, "raw_response.txt"),
    usage: resolve(outputDir, "usage.json"),
    pi_review: resolve(outputDir, "pi_review.json"),
    validation_report: resolve(outputDir, "validation_report.json"),
    run_summary: resolve(outputDir, "run_summary.json"),
  };
}

async function completedOutputExists(args: Args, objectId: string): Promise<boolean> {
  if (args.rerunExisting) return false;
  const paths = outputPathsFor(args, objectId);
  if (args.dryRunAgents) return existsSync(paths.dry_run);
  const validation = await readJsonMaybe<JsonObject>(paths.validation_report);
  return existsSync(paths.pi_review) && validation?.status === "passed";
}

function newLedger(args: Args): Ledger {
  const now = new Date().toISOString();
  return {
    schema_version: "v3_residual_pi_batch_0.1",
    generated_at: now,
    updated_at: now,
    objects_dir: args.objectsDir,
    provider: args.provider,
    model: args.model,
    thinking_level: args.thinkingLevel,
    concurrency: args.concurrency,
    retry_count: args.retryCount,
    dry_run_agents: args.dryRunAgents,
    grid_overlay: args.gridOverlay,
    alignment_residuals: args.alignmentResiduals,
    max_alignment_pairs: args.maxAlignmentPairs,
    rerun_existing: args.rerunExisting,
    resume_incomplete: args.resumeIncomplete,
    human_unreviewed_only: args.humanUnreviewedOnly,
    manual_review_path: args.manualReviewPath,
    stop_on_rate_limit: args.stopOnRateLimit,
    log_path: args.logPath,
    totals: {
      selected: 0,
      complete: 0,
      incomplete: 0,
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      rate_limited: 0,
      skipped_existing: 0,
    },
    records: {},
  };
}

async function loadLedger(args: Args): Promise<Ledger> {
  const loaded = existsSync(args.ledgerPath) ? await readJsonMaybe<Ledger>(args.ledgerPath) : null;
  const ledger = loaded?.schema_version === "v3_residual_pi_batch_0.1" ? loaded : newLedger(args);
  ledger.objects_dir = args.objectsDir;
  ledger.provider = args.provider;
  ledger.model = args.model;
  ledger.thinking_level = args.thinkingLevel;
  ledger.concurrency = args.concurrency;
  ledger.retry_count = args.retryCount;
  ledger.dry_run_agents = args.dryRunAgents;
  ledger.grid_overlay = args.gridOverlay;
  ledger.alignment_residuals = args.alignmentResiduals;
  ledger.max_alignment_pairs = args.maxAlignmentPairs;
  ledger.rerun_existing = args.rerunExisting;
  ledger.resume_incomplete = args.resumeIncomplete;
  ledger.human_unreviewed_only = args.humanUnreviewedOnly;
  ledger.manual_review_path = args.manualReviewPath;
  ledger.stop_on_rate_limit = args.stopOnRateLimit;
  ledger.log_path = args.logPath;
  return ledger;
}

function recordFor(ledger: Ledger, args: Args, objectId: string): LedgerRecord {
  const existing = ledger.records[objectId];
  if (existing) {
    existing.output_paths = outputPathsFor(args, objectId);
    return existing;
  }
  const record: LedgerRecord = {
    object_id: objectId,
    status: "pending",
    attempts: 0,
    updated_at: new Date().toISOString(),
    output_paths: outputPathsFor(args, objectId),
  };
  ledger.records[objectId] = record;
  return record;
}

function setRecordStatus(record: LedgerRecord, status: LedgerStatus, patch: Partial<LedgerRecord> = {}): void {
  Object.assign(record, patch, { status, updated_at: new Date().toISOString() });
}

function computeTotals(ledger: Ledger, selectedIds: string[]): Ledger["totals"] {
  const totals: Ledger["totals"] = {
    selected: selectedIds.length,
    complete: 0,
    incomplete: 0,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    rate_limited: 0,
    skipped_existing: 0,
  };
  for (const objectId of selectedIds) {
    const status = ledger.records[objectId]?.status ?? "pending";
    totals[status] += 1;
  }
  totals.complete = totals.succeeded + totals.skipped_existing;
  totals.incomplete = totals.selected - totals.complete;
  return totals;
}

function filterResumeIncompleteObjectIds(args: Args, ledger: Ledger, objectIds: string[]): string[] {
  if (!args.resumeIncomplete) return objectIds;
  return objectIds.filter((objectId) => {
    const status = ledger.records[objectId]?.status;
    return status !== "succeeded" && status !== "skipped_existing";
  });
}

function appendBounded(existing: string, chunk: Buffer): string {
  const next = existing + chunk.toString();
  return next.length > 30000 ? next.slice(-30000) : next;
}

async function runAgentProcess(args: Args, objectId: string, log: NodeJS.WritableStream): Promise<{ code: number | null; output: string }> {
  const commandArgs = [
    "run",
    "run-agent",
    "--",
    "--objects-dir",
    args.objectsDir,
    "--object-id",
    objectId,
    "--provider",
    args.provider,
    "--model",
    args.model,
    "--thinking-level",
    args.thinkingLevel,
  ];
  if (args.gridOverlay) commandArgs.push("--grid-overlay");
  else commandArgs.push("--no-grid-overlay");
  if (args.alignmentResiduals) commandArgs.push("--alignment-residuals", "--max-alignment-pairs", String(args.maxAlignmentPairs));
  else commandArgs.push("--no-alignment-residuals");
  if (args.dryRunAgents) commandArgs.push("--dry-run");
  log.write(`\n[${new Date().toISOString()}] [agent ${objectId}] bun ${commandArgs.join(" ")}\n`);

  return new Promise((resolvePromise, rejectPromise) => {
    let output = "";
    const child = spawn("bun", commandArgs, { cwd: systemRoot, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk: Buffer) => {
      output = appendBounded(output, chunk);
      log.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output = appendBounded(output, chunk);
      log.write(chunk);
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise({ code, output }));
  });
}

function isRateLimitOutput(output: string): boolean {
  return /rate.?limit|too many requests|\b429\b|\b403\b|forbidden|quota|temporar(?:y|ily).{0,40}(?:blocked|unavailable)|lockout|try again in|retry-after|oauth token|unauthori[sz]ed|authentication/i.test(
    output,
  );
}

function compactError(output: string, fallback: string): string {
  const trimmed = output.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\r?\n/).slice(-12).join("\n").slice(-4000);
}

async function runOneObject(params: {
  args: Args;
  ledger: Ledger;
  objectId: string;
  workerId: number;
  log: NodeJS.WritableStream;
  saveLedger: () => Promise<void>;
  stop: { rateLimited: boolean };
}): Promise<void> {
  const { args, ledger, objectId, workerId, log, saveLedger, stop } = params;
  const record = recordFor(ledger, args, objectId);
  const startedAt = Date.now();

  if (await completedOutputExists(args, objectId)) {
    setRecordStatus(record, "skipped_existing", {
      completed_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt,
      worker_id: workerId,
      error: undefined,
    });
    await saveLedger();
    return;
  }

  for (let attempt = 0; attempt <= args.retryCount; attempt += 1) {
    setRecordStatus(record, "running", {
      attempts: record.attempts + 1,
      started_at: new Date().toISOString(),
      completed_at: undefined,
      elapsed_ms: undefined,
      worker_id: workerId,
      error: undefined,
    });
    await saveLedger();

    const result = await runAgentProcess(args, objectId, log);
    if (result.code === 0) {
      setRecordStatus(record, "succeeded", {
        completed_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt,
        error: undefined,
      });
      await saveLedger();
      return;
    }

    if (args.stopOnRateLimit && isRateLimitOutput(result.output)) {
      stop.rateLimited = true;
      setRecordStatus(record, "rate_limited", {
        completed_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt,
        error: compactError(result.output, `agent process exited ${result.code}`),
      });
      ledger.rate_limit = {
        detected_at: new Date().toISOString(),
        object_id: objectId,
        error: record.error ?? "",
      };
      await saveLedger();
      return;
    }

    if (attempt === args.retryCount) {
      setRecordStatus(record, "failed", {
        completed_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt,
        error: compactError(result.output, `agent process exited ${result.code}`),
      });
      await saveLedger();
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const allObjectIds = await listObjectIds(args.objectsDir);
  let selectedIds = args.objectIds.length > 0 ? args.objectIds : allObjectIds;

  const available = new Set(allObjectIds);
  const missing = selectedIds.filter((id) => !available.has(id));
  if (missing.length > 0) throw new Error(`Object ids not found: ${missing.join(", ")}`);

  selectedIds = await filterHumanUnreviewedObjectIds(args, selectedIds);
  const ledger = await loadLedger(args);
  selectedIds = filterResumeIncompleteObjectIds(args, ledger, selectedIds);
  if (args.limit) selectedIds = selectedIds.slice(0, args.limit);

  await mkdir(dirname(args.logPath), { recursive: true });
  const log = createWriteStream(args.logPath, { flags: "a" });
  for (const objectId of selectedIds) recordFor(ledger, args, objectId);

  const saveLedger = async () => {
    ledger.updated_at = new Date().toISOString();
    ledger.totals = computeTotals(ledger, selectedIds);
    await writeJson(args.ledgerPath, ledger);
  };

  if (!args.dryRunAgents && args.refreshAuth) {
    ledger.auth_refresh = await refreshProviderAuth(args.provider);
    await saveLedger();
  }

  const queue = [...selectedIds];
  const stop = { rateLimited: false };
  let workerIndex = 0;

  async function worker(): Promise<void> {
    const workerId = ++workerIndex;
    while (queue.length > 0 && !stop.rateLimited) {
      const objectId = queue.shift();
      if (!objectId) return;
      await runOneObject({ args, ledger, objectId, workerId, log, saveLedger, stop });
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));
  await saveLedger();
  await new Promise<void>((resolvePromise) => log.end(resolvePromise));

  console.log(`Batch processed ${selectedIds.length} v3 residual cases`);
  console.log(`Ledger: ${args.ledgerPath}`);
  console.log(`Log: ${args.logPath}`);
  if (ledger.rate_limit) console.log(`Stopped on rate limit at ${ledger.rate_limit.object_id}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
