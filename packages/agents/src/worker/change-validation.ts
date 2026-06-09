import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runCommand, type CommandResult } from "@decomp-orchestrator/core/shell";
import type { WorkerRunnerValidation } from "./output.js";

const SCORE_EPSILON = 0.000001;
const EXACT_SCORE = 99.99999;

export interface WorkerUnitScore {
  name: string;
  score: number;
  size?: number;
}

export interface WorkerUnitScoreSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  unit: string;
  symbol: string;
  sourcePath: string;
  objectTarget: string | null;
  metrics: WorkerUnitScore[];
  functions: WorkerUnitScore[];
  sections: WorkerUnitScore[];
  targetScore: number | null;
}

export interface WorkerValidationCommandResult extends CommandResult {
  command: string[];
  stdoutPath: string;
  stderrPath: string;
}

export interface WorkerChangeBaseline {
  status: "available" | "build_failed" | "snapshot_unavailable";
  reasons: string[];
  snapshot: WorkerUnitScoreSnapshot | null;
  snapshotPath?: string;
  diffPath?: string;
  objectTarget?: string | null;
  objectBuild?: WorkerValidationCommandResult;
  unitDiff?: WorkerValidationCommandResult;
}

interface ObjdiffSideRows {
  functions: WorkerUnitScore[];
  sections: WorkerUnitScore[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = NaN): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function scoreFromRow(row: Record<string, unknown>): number {
  return numberValue(row.match_percent, numberValue(row.fuzzy_match_percent, NaN));
}

function objectTargetFromSourcePath(sourcePath: string): string | null {
  if (!sourcePath) return null;
  const withoutExtension = sourcePath.replace(/\.[^./\\]+$/, "");
  if (withoutExtension === sourcePath) return null;
  return `build/GALE01/${withoutExtension}.o`;
}

function scoredSideRows(side: unknown): ObjdiffSideRows {
  const record = isRecord(side) ? side : {};
  const sections: WorkerUnitScore[] = [];
  const functions: WorkerUnitScore[] = [];

  for (const sectionValue of arrayValue(record.sections)) {
    const section = isRecord(sectionValue) ? sectionValue : {};
    const name = stringValue(section.name);
    const score = scoreFromRow(section);
    if (!name || !Number.isFinite(score)) continue;
    sections.push({
      name,
      score,
      size: finiteOptionalNumber(section.size),
    });
  }

  for (const symbolValue of arrayValue(record.symbols)) {
    const symbol = isRecord(symbolValue) ? symbolValue : {};
    const name = stringValue(symbol.name);
    const score = scoreFromRow(symbol);
    if (!name || !Number.isFinite(score) || !Array.isArray(symbol.instructions)) continue;
    functions.push({
      name,
      score,
      size: finiteOptionalNumber(symbol.size),
    });
  }

  return { functions, sections };
}

function finiteOptionalNumber(value: unknown): number | undefined {
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scoreCount(rows: ObjdiffSideRows): number {
  return rows.functions.length + rows.sections.length;
}

function chooseObjdiffRows(report: Record<string, unknown>): ObjdiffSideRows {
  const left = scoredSideRows(report.left);
  const right = scoredSideRows(report.right);
  return scoreCount(right) > scoreCount(left) ? right : left;
}

function weightedPercent(rows: WorkerUnitScore[], exactOnly = false): number | null {
  let totalSize = 0;
  let matchedSize = 0;
  for (const row of rows) {
    const size = row.size ?? 0;
    if (size <= 0) continue;
    totalSize += size;
    matchedSize += exactOnly ? (row.score >= EXACT_SCORE ? size : 0) : (size * row.score) / 100;
  }
  if (totalSize <= 0) return null;
  return Number(((matchedSize / totalSize) * 100).toFixed(6));
}

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Number(((part / whole) * 100).toFixed(6));
}

function unitMetrics(rows: ObjdiffSideRows): WorkerUnitScore[] {
  const metrics: WorkerUnitScore[] = [];
  const textSection = rows.sections.find((section) => section.name === ".text");
  const fuzzy = textSection?.score ?? weightedPercent(rows.functions);
  if (fuzzy !== null && fuzzy !== undefined && Number.isFinite(fuzzy)) {
    metrics.push({ name: "fuzzy_match_percent", score: fuzzy, size: textSection?.size });
  }

  const functionBytes = rows.functions.reduce((sum, row) => sum + (row.size ?? 0), 0);
  const matchedFunctionBytes = rows.functions.reduce((sum, row) => sum + (row.score >= EXACT_SCORE ? row.size ?? 0 : 0), 0);
  const matchedCodePercent = percent(matchedFunctionBytes, functionBytes);
  if (matchedCodePercent !== null) {
    metrics.push({ name: "matched_code_percent", score: matchedCodePercent, size: functionBytes });
  }

  const dataSections = rows.sections.filter((section) => section.name !== ".text");
  const dataBytes = dataSections.reduce((sum, row) => sum + (row.size ?? 0), 0);
  const matchedDataPercent = weightedPercent(dataSections, true);
  if (matchedDataPercent !== null) {
    metrics.push({ name: "matched_data_percent", score: matchedDataPercent, size: dataBytes });
  }

  if (rows.functions.length > 0) {
    const matchedFunctions = rows.functions.filter((row) => row.score >= EXACT_SCORE).length;
    metrics.push({ name: "matched_functions_percent", score: Number(((matchedFunctions / rows.functions.length) * 100).toFixed(6)), size: rows.functions.length });
  }

  return metrics;
}

function snapshotFromObjdiffReport(params: {
  report: Record<string, unknown>;
  unit: string;
  symbol: string;
  sourcePath: string;
  objectTarget: string | null;
}): WorkerUnitScoreSnapshot | null {
  const rows = chooseObjdiffRows(params.report);
  if (rows.functions.length === 0 && rows.sections.length === 0) return null;
  const target = rows.functions.find((row) => row.name === params.symbol);
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    unit: params.unit,
    symbol: params.symbol,
    sourcePath: params.sourcePath,
    objectTarget: params.objectTarget,
    metrics: unitMetrics(rows),
    functions: rows.functions,
    sections: rows.sections,
    targetScore: target?.score ?? null,
  };
}

async function runValidationCommand(repoRoot: string, command: string[], stdoutPath: string, stderrPath: string): Promise<WorkerValidationCommandResult> {
  let result: CommandResult;
  try {
    result = await runCommand(repoRoot, command);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    result = { exitCode: 127, stdout: "", stderr: message };
  }
  await writeFile(stdoutPath, result.stdout);
  await writeFile(stderrPath, result.stderr);
  return { ...result, command, stdoutPath, stderrPath };
}

export async function captureWorkerChangeBaseline(params: {
  repoRoot: string;
  outputDir: string;
  target: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<WorkerChangeBaseline> {
  await mkdir(params.outputDir, { recursive: true });
  const unit = stringValue(params.target.unit);
  const symbol = stringValue(params.target.symbol);
  const sourcePath = stringValue(params.target.source_path);
  const objectTarget = objectTargetFromSourcePath(sourcePath);
  const reasons: string[] = [];

  if (params.dryRun) {
    return {
      status: "snapshot_unavailable",
      reasons: ["dry-run agents do not execute pre-worker same-unit baseline validation"],
      snapshot: null,
      objectTarget,
    };
  }

  if (!unit) reasons.push("target unit is missing");
  if (!symbol) reasons.push("target symbol is missing");
  if (!sourcePath) reasons.push("target source_path is missing");
  if (!objectTarget) reasons.push("could not derive object target from target source_path");
  if (reasons.length > 0 || !objectTarget) {
    return { status: "snapshot_unavailable", reasons, snapshot: null, objectTarget };
  }

  const objectBuild = await runValidationCommand(
    params.repoRoot,
    ["ninja", objectTarget],
    resolve(params.outputDir, "pre_worker_object_build.stdout.txt"),
    resolve(params.outputDir, "pre_worker_object_build.stderr.txt"),
  );
  if (objectBuild.exitCode !== 0) {
    return {
      status: "build_failed",
      reasons: [`pre-worker object build exited ${objectBuild.exitCode}`],
      snapshot: null,
      objectTarget,
      objectBuild,
    };
  }

  const diffPath = resolve(params.outputDir, "pre_worker_unit_diff.json");
  const unitDiff = await runValidationCommand(
    params.repoRoot,
    ["build/tools/objdiff-cli", "diff", "-p", ".", "-u", unit, "--format", "json-pretty", "-o", diffPath],
    resolve(params.outputDir, "pre_worker_unit_diff.stdout.txt"),
    resolve(params.outputDir, "pre_worker_unit_diff.stderr.txt"),
  );
  if (unitDiff.exitCode !== 0 || !existsSync(diffPath)) {
    return {
      status: "snapshot_unavailable",
      reasons: [`pre-worker unit diff exited ${unitDiff.exitCode}`],
      snapshot: null,
      diffPath,
      objectTarget,
      objectBuild,
      unitDiff,
    };
  }

  let snapshot: WorkerUnitScoreSnapshot | null = null;
  try {
    const report = JSON.parse(await readFile(diffPath, "utf8")) as unknown;
    snapshot = isRecord(report) ? snapshotFromObjdiffReport({ report, unit, symbol, sourcePath, objectTarget }) : null;
  } catch (error) {
    reasons.push(`could not parse pre-worker unit diff: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!snapshot) {
    return {
      status: "snapshot_unavailable",
      reasons: reasons.length > 0 ? reasons : ["pre-worker unit diff did not contain usable same-unit scores"],
      snapshot: null,
      diffPath,
      objectTarget,
      objectBuild,
      unitDiff,
    };
  }

  const snapshotPath = resolve(params.outputDir, "pre_worker_unit_snapshot.json");
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  return {
    status: "available",
    reasons: [],
    snapshot,
    snapshotPath,
    diffPath,
    objectTarget,
    objectBuild,
    unitDiff,
  };
}

function scoreMap(rows: WorkerUnitScore[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.name, row.score);
  return map;
}

function compareRows(params: {
  kind: "unit" | "function" | "section";
  unit: string;
  beforeRows: WorkerUnitScore[];
  afterRows: WorkerUnitScore[];
  regressions: NonNullable<WorkerRunnerValidation["regressions"]>;
  improvements: NonNullable<WorkerRunnerValidation["improvements"]>;
  reasons: string[];
}): void {
  const before = scoreMap(params.beforeRows);
  const after = scoreMap(params.afterRows);
  for (const [item, beforeScore] of before) {
    const afterScore = after.get(item) ?? 0;
    if (afterScore + SCORE_EPSILON < beforeScore) {
      params.regressions.push({ kind: params.kind, unit: params.unit, item, before: beforeScore, after: afterScore });
      if (beforeScore >= EXACT_SCORE && afterScore < EXACT_SCORE) {
        params.reasons.push(`already-exact ${params.kind} regressed: ${item} ${beforeScore} -> ${afterScore}`);
      }
    } else if (afterScore > beforeScore + SCORE_EPSILON) {
      params.improvements.push({ kind: params.kind, unit: params.unit, item, before: beforeScore, after: afterScore });
    }
  }
}

export function compareWorkerUnitSnapshots(params: {
  before: WorkerUnitScoreSnapshot;
  after: WorkerUnitScoreSnapshot;
  claimedExact: boolean;
  summaryPath?: string;
  reportPath?: string;
  baselinePath?: string;
}): WorkerRunnerValidation {
  const regressions: NonNullable<WorkerRunnerValidation["regressions"]> = [];
  const improvements: NonNullable<WorkerRunnerValidation["improvements"]> = [];
  const reasons: string[] = [];
  const beforeTarget = params.before.targetScore;
  const afterTarget = params.after.targetScore;
  const targetHasScores = beforeTarget !== null && afterTarget !== null;
  const targetImproved = targetHasScores && afterTarget > beforeTarget + SCORE_EPSILON;
  const targetReachedExact = targetHasScores && params.claimedExact && beforeTarget < EXACT_SCORE && afterTarget >= EXACT_SCORE;
  const targetRegressed = targetHasScores && afterTarget + SCORE_EPSILON < beforeTarget;
  const targetAccepted = params.claimedExact ? targetReachedExact : targetImproved;

  compareRows({ kind: "unit", unit: params.before.unit, beforeRows: params.before.metrics, afterRows: params.after.metrics, regressions, improvements, reasons });
  compareRows({ kind: "function", unit: params.before.unit, beforeRows: params.before.functions, afterRows: params.after.functions, regressions, improvements, reasons });
  compareRows({ kind: "section", unit: params.before.unit, beforeRows: params.before.sections, afterRows: params.after.sections, regressions, improvements, reasons });

  let status: WorkerRunnerValidation["status"] = "passed";
  if (!targetHasScores) {
    status = "no_official_score_change";
    reasons.push(`target symbol score unavailable in ${beforeTarget === null ? "baseline" : "current"} same-unit snapshot`);
  } else if (targetRegressed) {
    status = "target_regressed";
    reasons.push(`target ${params.before.symbol} regressed from ${beforeTarget} to ${afterTarget}`);
  } else if (regressions.length > 0) {
    status = "same_unit_regression";
    reasons.push(`${regressions.length} same-unit score regression(s) detected`);
  } else if (!targetAccepted) {
    status = "no_official_score_change";
    reasons.push(
      params.claimedExact
        ? `target ${params.before.symbol} did not reach exact in runner-owned same-unit validation`
        : `target ${params.before.symbol} did not improve in runner-owned same-unit validation`,
    );
  }

  return {
    status,
    reasons,
    target: {
      unit: params.before.unit,
      symbol: params.before.symbol,
      before: beforeTarget,
      after: afterTarget,
      improved: Boolean(targetImproved),
      exact: Boolean(targetHasScores && afterTarget >= EXACT_SCORE),
    },
    regressions,
    improvements,
    summaryPath: params.summaryPath,
    reportPath: params.reportPath,
    baselinePath: params.baselinePath,
  };
}

export async function validateWorkerChange(params: {
  repoRoot: string;
  outputDir: string;
  attemptIndex: number;
  baseline: WorkerChangeBaseline;
  target: Record<string, unknown>;
  dryRun: boolean;
  shouldRun: boolean;
  claimedExact: boolean;
}): Promise<WorkerRunnerValidation> {
  await mkdir(params.outputDir, { recursive: true });
  const summaryPath = resolve(params.outputDir, `attempt-${params.attemptIndex}.runner_validation.summary.json`);
  const skipped = (reason: string): WorkerRunnerValidation => ({ status: "skipped", reasons: [reason], summaryPath });

  if (params.dryRun) return skipped("dry-run agents do not execute runner-owned worker-change validation");
  if (!params.shouldRun) return skipped("structured acceptance gate did not pass for progress/score_candidate");
  if (!params.baseline.snapshot) {
    return {
      status: "snapshot_unavailable",
      reasons: params.baseline.reasons.length > 0 ? params.baseline.reasons : ["pre-worker same-unit baseline snapshot is unavailable"],
      summaryPath,
      baselinePath: params.baseline.snapshotPath,
      reportPath: params.baseline.diffPath,
    };
  }

  const unit = stringValue(params.target.unit);
  const symbol = stringValue(params.target.symbol);
  const sourcePath = stringValue(params.target.source_path);
  const objectTarget = params.baseline.objectTarget ?? objectTargetFromSourcePath(sourcePath);
  if (!unit || !symbol || !sourcePath || !objectTarget) {
    return {
      status: "snapshot_unavailable",
      reasons: ["target metadata is incomplete for runner-owned worker-change validation"],
      summaryPath,
      baselinePath: params.baseline.snapshotPath,
    };
  }

  const objectBuild = await runValidationCommand(
    params.repoRoot,
    ["ninja", objectTarget],
    resolve(params.outputDir, `attempt-${params.attemptIndex}.object_build.stdout.txt`),
    resolve(params.outputDir, `attempt-${params.attemptIndex}.object_build.stderr.txt`),
  );
  if (objectBuild.exitCode !== 0) {
    const validation: WorkerRunnerValidation = {
      status: "build_failed",
      reasons: [`post-worker object build exited ${objectBuild.exitCode}`],
      summaryPath,
      baselinePath: params.baseline.snapshotPath,
      command: objectBuild.command.join(" "),
      exitCode: objectBuild.exitCode,
      stdoutPath: objectBuild.stdoutPath,
      stderrPath: objectBuild.stderrPath,
    };
    await writeFile(summaryPath, JSON.stringify(validation, null, 2));
    return validation;
  }

  const diffPath = resolve(params.outputDir, `attempt-${params.attemptIndex}.unit_diff.json`);
  const unitDiff = await runValidationCommand(
    params.repoRoot,
    ["build/tools/objdiff-cli", "diff", "-p", ".", "-u", unit, "--format", "json-pretty", "-o", diffPath],
    resolve(params.outputDir, `attempt-${params.attemptIndex}.unit_diff.stdout.txt`),
    resolve(params.outputDir, `attempt-${params.attemptIndex}.unit_diff.stderr.txt`),
  );
  if (unitDiff.exitCode !== 0 || !existsSync(diffPath)) {
    const validation: WorkerRunnerValidation = {
      status: "snapshot_unavailable",
      reasons: [`post-worker unit diff exited ${unitDiff.exitCode}`],
      summaryPath,
      baselinePath: params.baseline.snapshotPath,
      reportPath: diffPath,
      command: unitDiff.command.join(" "),
      exitCode: unitDiff.exitCode,
      stdoutPath: unitDiff.stdoutPath,
      stderrPath: unitDiff.stderrPath,
    };
    await writeFile(summaryPath, JSON.stringify(validation, null, 2));
    return validation;
  }

  let after: WorkerUnitScoreSnapshot | null = null;
  try {
    const report = JSON.parse(await readFile(diffPath, "utf8")) as unknown;
    after = isRecord(report) ? snapshotFromObjdiffReport({ report, unit, symbol, sourcePath, objectTarget }) : null;
  } catch {
    after = null;
  }
  if (!after) {
    const validation: WorkerRunnerValidation = {
      status: "snapshot_unavailable",
      reasons: ["post-worker unit diff did not contain usable same-unit scores"],
      summaryPath,
      baselinePath: params.baseline.snapshotPath,
      reportPath: diffPath,
    };
    await writeFile(summaryPath, JSON.stringify(validation, null, 2));
    return validation;
  }

  const snapshotPath = resolve(params.outputDir, `attempt-${params.attemptIndex}.unit_snapshot.json`);
  await writeFile(snapshotPath, JSON.stringify(after, null, 2));
  const validation = compareWorkerUnitSnapshots({
    before: params.baseline.snapshot,
    after,
    claimedExact: params.claimedExact,
    summaryPath,
    reportPath: snapshotPath,
    baselinePath: params.baseline.snapshotPath,
  });
  validation.command = `${objectBuild.command.join(" ")} && ${unitDiff.command.join(" ")}`;
  validation.exitCode = 0;
  validation.stdoutPath = objectBuild.stdoutPath;
  validation.stderrPath = unitDiff.stderrPath;
  validation.diffPath = diffPath;
  validation.objectTarget = objectTarget;
  await writeFile(summaryPath, JSON.stringify(validation, null, 2));
  return validation;
}
