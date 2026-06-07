import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openState } from "../state/index.js";
import { knowledgeCuratorEnrichmentPath, pastPrsRoot } from "./paths.js";
import type { TrustTier } from "./graph/types.js";
import { arrayValue, ensureParentDir, numberValue, objectValue, readJsonl, shortHash, stringValue, truncate } from "./graph/util.js";

export const KNOWLEDGE_CURATOR_ENRICHMENT_ID = "curator_enrichment";
export const KNOWLEDGE_CURATOR_SCHEMA_VERSION = "knowledge_curator_enrichment_v1";

export type CuratedKnowledgeKind = "worker_lesson" | "pr_lesson" | "source_update_proposal";

export interface CuratedKnowledgeRecord {
  schema_version: typeof KNOWLEDGE_CURATOR_SCHEMA_VERSION;
  id: string;
  kind: CuratedKnowledgeKind;
  status: "accepted" | "proposal" | "rejected";
  trust_tier: TrustTier;
  confidence: number;
  source_path?: string;
  unit?: string;
  symbol?: string;
  title: string;
  text: string;
  evidence_ref: string;
  created_at?: string;
  payload: Record<string, unknown>;
}

export interface CurateKnowledgeOptions {
  repoRoot: string;
  stateDir: string;
  outputPath?: string;
  runId?: string;
  workerLimit?: number;
  prLimit?: number;
  includeStalled?: boolean;
}

export interface CurateKnowledgeResult {
  output_path: string;
  records_written: number;
  worker_lessons: number;
  pr_lessons: number;
  source_update_proposals: number;
  skipped_worker_reports: number;
}

export function classifySourceUpdateProposal(input: {
  title?: string;
  text?: string;
  evidence_ref?: string;
  evidence_refs?: string[];
  source_path?: string;
}): Record<string, unknown> | null {
  const targetSourceId = targetSourceForText(`${input.title ?? ""}\n${input.text ?? ""}`);
  if (!targetSourceId) return null;
  return {
    target_source_id: targetSourceId,
    update_kind: sourceUpdateKind(targetSourceId),
    mutation_policy: "proposal_only",
    evidence_refs: input.evidence_refs ?? (input.evidence_ref ? [input.evidence_ref] : []),
    source_path: input.source_path ?? null,
    reason: sourceUpdateReason(targetSourceId),
  };
}

type WorkerReportRow = Record<string, unknown>;

export function curateKnowledgeEnrichments(options: CurateKnowledgeOptions): CurateKnowledgeResult {
  const outputPath = resolve(options.outputPath ?? knowledgeCuratorEnrichmentPath());
  const workerRecords = workerLessonRecords(options);
  const prRecords = prLessonRecords(options);
  const sourceUpdateRecords = sourceUpdateProposalRecords([...workerRecords, ...prRecords]);
  const records = dedupeRecords([...workerRecords, ...prRecords, ...sourceUpdateRecords]).sort((left, right) => left.id.localeCompare(right.id));

  ensureParentDir(outputPath);
  writeFileSync(outputPath, records.length ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "", "utf8");

  return {
    output_path: outputPath,
    records_written: records.length,
    worker_lessons: records.filter((record) => record.kind === "worker_lesson").length,
    pr_lessons: records.filter((record) => record.kind === "pr_lesson").length,
    source_update_proposals: records.filter((record) => record.kind === "source_update_proposal").length,
    skipped_worker_reports: Number(workerRecords.skipped ?? 0),
  };
}

function workerLessonRecords(options: CurateKnowledgeOptions): CuratedKnowledgeRecord[] & { skipped?: number } {
  const records = [] as CuratedKnowledgeRecord[] & { skipped?: number };
  let skipped = 0;
  if (!existsSync(options.stateDir)) {
    records.skipped = 0;
    return records;
  }

  const store = openState(options.stateDir);
  try {
    const limit = nonNegativeLimit(options.workerLimit, 250);
    const where = options.runId ? "WHERE queue.run_id = ?" : "";
    const rows = store.db
      .query(
        `
          SELECT
            worker_reports.id AS report_id,
            worker_reports.lease_id,
            worker_reports.report_type,
            worker_reports.summary_path,
            worker_reports.facts_path,
            worker_reports.blocker_path,
            worker_reports.patch_path,
            worker_reports.created_at,
            leases.worker_id,
            queue.run_id,
            targets.unit,
            targets.symbol,
            targets.source_path
          FROM worker_reports
          LEFT JOIN leases ON leases.id = worker_reports.lease_id
          LEFT JOIN queue ON queue.id = leases.queue_id
          LEFT JOIN targets ON targets.id = queue.target_id
          ${where}
          ORDER BY worker_reports.created_at DESC
          LIMIT ?
        `,
      )
      .all(...(options.runId ? [options.runId, limit] : [limit])) as WorkerReportRow[];

    for (const row of rows) {
      const record = workerRecordFromRow(row, options);
      if (record) records.push(record);
      else skipped += 1;
    }
  } finally {
    store.db.close();
  }

  records.skipped = skipped;
  return records;
}

function workerRecordFromRow(row: WorkerReportRow, options: CurateKnowledgeOptions): CuratedKnowledgeRecord | null {
  const reportType = stringValue(row.report_type);
  if (!options.includeStalled && reportType !== "progress" && reportType !== "score_candidate") return null;

  const summaryPath = stringValue(row.summary_path);
  const summary = readJsonObject(summaryPath);
  const target = objectValue(summary.target);
  const sourcePath = stringValue(target.source_path, stringValue(row.source_path));
  const unit = stringValue(target.unit, stringValue(row.unit));
  const symbol = stringValue(target.symbol, stringValue(row.symbol));
  if (!sourcePath && !symbol) return null;

  const facts = readJsonArray(stringValue(row.facts_path));
  const blockers = readJsonArray(stringValue(row.blocker_path));
  const acceptanceGate = objectValue(summary.acceptance_gate);
  const runnerValidation = objectValue(summary.runner_validation);
  const repairAttempts = objectValue(summary.repair_attempts);
  const cleanReturn =
    acceptanceGate.accepted !== false &&
    stringValue(runnerValidation.status, "skipped") !== "failed" &&
    repairAttempts.exhausted !== true &&
    (reportType === "progress" || reportType === "score_candidate");
  const status = cleanReturn ? "accepted" : "proposal";
  const confidence = cleanReturn ? 0.8 : reportType === "needs_fact" ? 0.45 : 0.3;
  const summaryText = stringValue(summary.summary, "Worker report was persisted for curator review.");
  const text = [
    sourcePath,
    unit,
    symbol,
    reportType,
    summaryText,
    facts.map((fact) => compactJson(fact)).join("\n"),
    blockers.map((blocker) => compactJson(blocker)).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const reportId = stringValue(row.report_id, shortHash(`${summaryPath}:${text}`));
  return {
    schema_version: KNOWLEDGE_CURATOR_SCHEMA_VERSION,
    id: `worker_lesson:${reportId}`,
    kind: "worker_lesson",
    status,
    trust_tier: "local",
    confidence,
    source_path: sourcePath || undefined,
    unit: unit || undefined,
    symbol: symbol || undefined,
    title: `Worker ${reportType} for ${symbol || sourcePath}`,
    text: truncate(text, 4000),
    evidence_ref: summaryPath || `worker_report:${reportId}`,
    created_at: stringValue(row.created_at) || undefined,
    payload: {
      report_id: reportId,
      run_id: stringValue(row.run_id, stringValue(summary.run_id)),
      lease_id: stringValue(row.lease_id, stringValue(summary.lease_id)),
      worker_id: stringValue(row.worker_id, stringValue(summary.worker_id)),
      report_type: reportType,
      summary: summaryText,
      facts,
      blockers,
      acceptance_gate: acceptanceGate,
      runner_validation: runnerValidation,
      repair_attempts: repairAttempts,
      patch_path: stringValue(row.patch_path) || null,
    },
  };
}

function prLessonRecords(options: CurateKnowledgeOptions): CuratedKnowledgeRecord[] {
  const root = pastPrsRoot();
  const indexPath = resolve(root, "prs/index.jsonl");
  const records: CuratedKnowledgeRecord[] = [];
  for (const row of readJsonl(indexPath, nonNegativeLimit(options.prLimit, 500))) {
    const postmortemRel = stringValue(row.postmortem_json);
    if (!postmortemRel) continue;
    const postmortemPath = resolve(root, "prs", postmortemRel);
    const postmortem = readJsonObject(postmortemPath);
    if (!Object.keys(postmortem).length) continue;
    const pr = objectValue(postmortem.pr);
    const prNumber = numberValue(pr.number, numberValue(row.pr));
    const title = stringValue(pr.title, stringValue(row.title, `PR ${prNumber}`));
    const keyFiles = arrayValue(postmortem.key_files).map(objectValue);
    const fileTargets = keyFiles.length > 0 ? keyFiles : [{ path: "" }];
    for (const keyFile of fileTargets) {
      const sourcePath = stringValue(keyFile.path);
      const lessonText = prLessonText(postmortem, sourcePath);
      if (!lessonText.trim()) continue;
      const agentStatus = stringValue(postmortem.agent_status);
      const accepted = agentStatus === "agent_completed";
      records.push({
        schema_version: KNOWLEDGE_CURATOR_SCHEMA_VERSION,
        id: `pr_lesson:${prNumber}:${shortHash(`${sourcePath}:${lessonText}`)}`,
        kind: "pr_lesson",
        status: accepted ? "accepted" : "proposal",
        trust_tier: "historical",
        confidence: accepted ? clampConfidence(numberValue(postmortem.confidence, 0.65)) : 0.35,
        source_path: sourcePath || undefined,
        title: `Curated PR ${prNumber} lesson${sourcePath ? ` for ${sourcePath}` : ""}`,
        text: truncate(`${title}\n${lessonText}`, 4000),
        evidence_ref: postmortemPath,
        created_at: stringValue(pr.merged_at, stringValue(pr.created_at)) || undefined,
        payload: {
          pr: prNumber,
          title,
          url: stringValue(pr.url),
          agent_status: agentStatus,
          source_path: sourcePath || null,
          key_file_role: stringValue(keyFile.role) || null,
          summary: stringValue(postmortem.summary),
          decomp_lessons: arrayValue(postmortem.decomp_lessons),
          assembly_or_matching_tactics: arrayValue(postmortem.assembly_or_matching_tactics),
          naming_conventions: arrayValue(postmortem.naming_conventions),
          review_feedback: arrayValue(postmortem.review_feedback),
          searchable_terms: arrayValue(postmortem.searchable_terms),
        },
      });
    }
  }
  return records;
}

function sourceUpdateProposalRecords(records: CuratedKnowledgeRecord[]): CuratedKnowledgeRecord[] {
  const proposals: CuratedKnowledgeRecord[] = [];
  for (const record of records) {
    const targetSourceId = targetSourceForRecord(record);
    if (!targetSourceId) continue;
    proposals.push({
      schema_version: KNOWLEDGE_CURATOR_SCHEMA_VERSION,
      id: `source_update_proposal:${targetSourceId}:${shortHash(`${record.id}:${record.text}`)}`,
      kind: "source_update_proposal",
      status: "proposal",
      trust_tier: record.trust_tier,
      confidence: Math.min(record.confidence, 0.45),
      source_path: record.source_path,
      unit: record.unit,
      symbol: record.symbol,
      title: `Review ${targetSourceId} update from ${record.kind}`,
      text: truncate(record.text, 2000),
      evidence_ref: record.evidence_ref,
      created_at: record.created_at,
      payload: {
        target_source_id: targetSourceId,
        update_kind: sourceUpdateKind(targetSourceId),
        parent_record_id: record.id,
        mutation_policy: "proposal_only",
        evidence_refs: [record.evidence_ref],
        source_path: record.source_path ?? null,
        reason: sourceUpdateReason(targetSourceId),
      },
    });
  }
  return proposals;
}

function targetSourceForRecord(record: CuratedKnowledgeRecord): string | null {
  return targetSourceForText(`${record.title}\n${record.text}`);
}

function targetSourceForText(value: string): string | null {
  const text = value.toLowerCase();
  if (/\b(global standard|decomp standard|qa standard|review standard|standards source|global rule)\b/i.test(text)) {
    return "decomp_standards";
  }
  if (/\b(path fact|path-scoped|scoped known win|directory fact|scope_globs|subsystem hint)\b/i.test(text)) {
    return "path_facts";
  }
  if (/\b0x[0-9a-f]{6,8}\b/i.test(value) || /\b(offset|address|data sheet|action state|hitbox|hurtbox|id list)\b/i.test(text)) {
    return "ssbm_data_sheet";
  }
  if (/\b(ghidra|opseq|mismatch|mwcc|compiler dump)\b/i.test(text)) return "tool_outputs";
  return null;
}

function sourceUpdateKind(targetSourceId: string): string {
  if (targetSourceId === "decomp_standards") return "global_standard";
  if (targetSourceId === "path_facts") return "path_fact";
  return "source_update";
}

function sourceUpdateReason(targetSourceId: string): string {
  if (targetSourceId === "decomp_standards") return "Evidence proposes a broad decomp/review standard; standards source owner should review before changing global injected rules.";
  if (targetSourceId === "path_facts") return "Evidence proposes a scoped known win for a directory or path; path facts source owner should validate scope, stale checks, and provenance before applying.";
  if (targetSourceId === "ssbm_data_sheet") return "Evidence references address, offset, ID, or data-sheet-like terms; source owner should review before mutating CSV data.";
  return "Evidence references tool-output-like terms; tool output indexes may need a refresh or note.";
}

function prLessonText(postmortem: Record<string, unknown>, sourcePath: string): string {
  const parts = [
    stringValue(postmortem.summary),
    sourcePath,
    labeledArray("Decomp lessons", postmortem.decomp_lessons),
    labeledArray("Matching tactics", postmortem.assembly_or_matching_tactics),
    labeledArray("Naming", postmortem.naming_conventions),
    labeledArray("Review", postmortem.review_feedback),
    labeledArray("Terms", postmortem.searchable_terms),
  ];
  return parts.filter(Boolean).join("\n");
}

function labeledArray(label: string, value: unknown): string {
  const items = arrayValue(value)
    .map((item) => String(item).trim())
    .filter(Boolean);
  return items.length ? `${label}: ${items.join("; ")}` : "";
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!path || !existsSync(path)) return {};
  try {
    return objectValue(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch {
    return {};
  }
}

function readJsonArray(path: string): unknown[] {
  if (!path || !existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return arrayValue(parsed);
  } catch {
    return [];
  }
}

function compactJson(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return JSON.stringify(value);
}

function nonNegativeLimit(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function dedupeRecords(records: CuratedKnowledgeRecord[]): CuratedKnowledgeRecord[] {
  const byId = new Map<string, CuratedKnowledgeRecord>();
  for (const record of records) byId.set(record.id, record);
  return [...byId.values()];
}
