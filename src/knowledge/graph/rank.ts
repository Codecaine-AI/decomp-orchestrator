import type { Database } from "bun:sqlite";
import { resourceGraphDbPath } from "../paths.js";
import { fileEntityId } from "./code-graph.js";
import { graphDbExists, openKnowledgeGraph, type KnowledgeGraphStore } from "./db.js";
import type { GraphRankFeature } from "./types.js";
import { objectValue, stringValue } from "./util.js";

export function rankFeatureForSourcePath(store: KnowledgeGraphStore, sourcePath: string, target?: GraphRankFeature["target"]): GraphRankFeature {
  const entityId = fileEntityId(sourcePath);
  const editability = editabilityFor(store.db, entityId);
  const graphDegree = count(
    store.db,
    "SELECT COUNT(*) AS count FROM graph_edges WHERE from_entity_id = ? OR to_entity_id = ?",
    entityId,
    entityId,
  );
  const relevantPrCount = count(store.db, "SELECT COUNT(*) AS count FROM graph_edges WHERE from_entity_id = ? AND edge_type = 'TOUCHED_BY_PR'", entityId);
  const reviewRiskCount = count(store.db, "SELECT COUNT(*) AS count FROM graph_facts WHERE entity_id = ? AND fact_type LIKE '%review%'", entityId);
  const duplicateReferenceCount = count(store.db, "SELECT COUNT(*) AS count FROM graph_edges WHERE from_entity_id = ? AND edge_type = 'ANALOGOUS_TO'", entityId);
  const freshEdgesSinceLastAttempt = count(
    store.db,
    "SELECT COUNT(*) AS count FROM graph_edges WHERE from_entity_id = ? AND status = 'accepted'",
    entityId,
  );
  const linkedUnlockPotential = Math.min(1, relevantPrCount / 10);
  const staleFactCount = count(store.db, "SELECT COUNT(*) AS count FROM graph_facts WHERE entity_id = ? AND status = 'stale'", entityId);
  const priorityBonus =
    Math.min(20, graphDegree * 0.15) +
    Math.min(18, relevantPrCount * 1.5) +
    Math.min(10, freshEdgesSinceLastAttempt * 0.4) +
    duplicateReferenceCount * 3 -
    reviewRiskCount * 0.75 -
    staleFactCount;
  const explanation = [
    `graph_degree=${graphDegree}`,
    `relevant_pr_count=${relevantPrCount}`,
    `fresh_edges=${freshEdgesSinceLastAttempt}`,
    `review_risk_count=${reviewRiskCount}`,
  ];
  if (editability !== "editable") explanation.push(`editability=${editability}`);
  return {
    target,
    source_path: sourcePath,
    editability,
    graph_degree: graphDegree,
    fresh_edges_since_last_attempt: freshEdgesSinceLastAttempt,
    relevant_pr_count: relevantPrCount,
    review_risk_count: reviewRiskCount,
    duplicate_reference_count: duplicateReferenceCount,
    linked_unlock_potential: linkedUnlockPotential,
    stale_fact_count: staleFactCount,
    priority_bonus: Number(priorityBonus.toFixed(4)),
    explanation,
  };
}

export function rankFeatureMapForCandidates(
  candidates: Array<{ sourcePath: string; unit?: string; symbol?: string }>,
  dbPath = resourceGraphDbPath(),
): Map<string, GraphRankFeature> {
  if (!graphDbExists(dbPath)) return new Map();
  const store = openKnowledgeGraph(dbPath);
  try {
    const features = new Map<string, GraphRankFeature>();
    for (const candidate of candidates) {
      if (!candidate.sourcePath) continue;
      const feature = rankFeatureForSourcePath(store, candidate.sourcePath, {
        source_path: candidate.sourcePath,
        unit: candidate.unit,
        symbol: candidate.symbol,
      });
      features.set(`${candidate.sourcePath}:${candidate.unit ?? ""}:${candidate.symbol ?? ""}`, feature);
    }
    return features;
  } finally {
    store.db.close();
  }
}

function editabilityFor(db: Database, entityId: string): GraphRankFeature["editability"] {
  const row = db
    .query("SELECT payload_json FROM graph_facts WHERE entity_id = ? AND fact_type = 'editability' AND status = 'accepted' LIMIT 1")
    .get(entityId) as Record<string, unknown> | null;
  if (!row) return "unknown";
  const payload = objectValue(JSON.parse(stringValue(row.payload_json, "{}")));
  const mode = stringValue(payload.mode, "unknown");
  if (mode === "editable" || mode === "read_only_complete" || mode === "locked" || mode === "blocked") return mode;
  return "unknown";
}

function count(db: Database, sql: string, ...params: Array<string | number>): number {
  const row = db.query(sql).get(...params) as Record<string, unknown>;
  return Number(row.count ?? 0);
}
