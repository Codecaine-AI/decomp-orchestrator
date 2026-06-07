import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KNOWLEDGE_CURATOR_ENRICHMENT_ID, type CuratedKnowledgeRecord } from "../curator.js";
import { knowledgeCuratorEnrichmentPath } from "../paths.js";
import { fileEntityId } from "./code-graph.js";
import type { GraphEdge, GraphEntity, GraphFact, GraphRecords, TrustTier } from "./types.js";
import { filesFingerprint, objectValue, readJsonlLazy, shortHash, stringValue } from "./util.js";

export function buildKnowledgeCuratorGraphRecords(path = knowledgeCuratorEnrichmentPath()): GraphRecords | null {
  const enrichmentPath = resolve(path);
  if (!existsSync(enrichmentPath)) return null;

  const sourceVersionId = `source-version:${KNOWLEDGE_CURATOR_ENRICHMENT_ID}:${shortHash(filesFingerprint([enrichmentPath]))}`;
  const entities: GraphEntity[] = [];
  const facts: GraphFact[] = [];
  const edges: GraphEdge[] = [];

  readJsonlLazy(enrichmentPath, (row) => {
    addCuratedRecord(row as unknown as CuratedKnowledgeRecord, sourceVersionId, entities, facts, edges);
  });

  return {
    sourceVersion: {
      id: sourceVersionId,
      sourceId: KNOWLEDGE_CURATOR_ENRICHMENT_ID,
      contentHash: shortHash(readFileSync(enrichmentPath, "utf8")),
      sourcePaths: [enrichmentPath],
    },
    entities,
    facts,
    edges,
    chunks: [],
  };
}

function addCuratedRecord(
  record: CuratedKnowledgeRecord,
  sourceVersionId: string,
  entities: GraphEntity[],
  facts: GraphFact[],
  edges: GraphEdge[],
): void {
  const recordId = stringValue(record.id);
  if (!recordId) return;
  const sourcePath = stringValue(record.source_path);
  const recordEntityId = `curated_knowledge:${recordId}`;
  const payload = objectValue(record);
  const status = graphStatus(record.status);
  const trustTier = trustTierValue(record.trust_tier);
  const confidence = confidenceValue(record.confidence);

  entities.push({
    id: recordEntityId,
    entityType: `curated_${stringValue(record.kind, "knowledge")}`,
    stableKey: recordId,
    payload,
  });
  if (sourcePath) {
    entities.push({
      id: fileEntityId(sourcePath),
      entityType: "source_file",
      stableKey: sourcePath,
      payload: { source_path: sourcePath },
      replace: false,
    });
  }

  const targetEntityId = sourcePath ? fileEntityId(sourcePath) : recordEntityId;
  facts.push({
    id: `fact:${KNOWLEDGE_CURATOR_ENRICHMENT_ID}:${shortHash(recordId)}`,
    entityId: targetEntityId,
    factType: `curated_${stringValue(record.kind, "knowledge")}`,
    payload,
    confidence,
    trustTier,
    evidenceRef: stringValue(record.evidence_ref, recordId),
    sourceVersionId,
    status,
  });
  if (sourcePath) {
    edges.push({
      id: `edge:${edgeType(record)}:${shortHash(`${sourcePath}:${recordId}`)}`,
      fromEntityId: fileEntityId(sourcePath),
      edgeType: edgeType(record),
      toEntityId: recordEntityId,
      weight: confidence,
      evidenceRef: stringValue(record.evidence_ref, recordId),
      sourceVersionId,
      status,
    });
  }
}

function edgeType(record: CuratedKnowledgeRecord): string {
  if (record.kind === "worker_lesson") return "HAS_CURATED_WORKER_LESSON";
  if (record.kind === "pr_lesson") return "HAS_CURATED_PR_LESSON";
  if (record.kind === "source_update_proposal") return "HAS_SOURCE_UPDATE_PROPOSAL";
  return "HAS_CURATED_KNOWLEDGE";
}

function graphStatus(status: unknown): string {
  const value = stringValue(status, "proposal");
  if (value === "accepted" || value === "rejected" || value === "stale") return value;
  return "proposal";
}

function trustTierValue(value: unknown): TrustTier {
  const tier = stringValue(value, "historical");
  if (
    tier === "canonical" ||
    tier === "local" ||
    tier === "reference" ||
    tier === "historical" ||
    tier === "external_hint" ||
    tier === "tool_evidence"
  ) {
    return tier;
  }
  return "historical";
}

function confidenceValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  return 0.4;
}
