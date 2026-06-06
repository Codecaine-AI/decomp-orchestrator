import { existsSync } from "node:fs";
import { Database } from "bun:sqlite";
import { resourceGraphDbPath } from "../paths.js";
import type { GraphEdge, GraphEntity, GraphFact, GraphRecords, SearchChunk, SearchResult, SourceDescriptor, ToolDescriptor } from "./types.js";
import { ensureParentDir, stableJson, truncate } from "./util.js";

export interface KnowledgeGraphStore {
  path: string;
  db: Database;
  hasFts: boolean;
}

export function openKnowledgeGraph(path = resourceGraphDbPath()): KnowledgeGraphStore {
  ensureParentDir(path);
  const db = new Database(path);
  db.run("PRAGMA busy_timeout = 30000");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  const store = { path, db, hasFts: false };
  ensureKnowledgeGraphSchema(store);
  return store;
}

export function graphDbExists(path = resourceGraphDbPath()): boolean {
  return existsSync(path);
}

export function ensureKnowledgeGraphSchema(store: KnowledgeGraphStore): void {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      trust_tier TEXT NOT NULL,
      freshness TEXT NOT NULL,
      descriptor_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_tools (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      trust_tier TEXT NOT NULL,
      descriptor_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resource_versions (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      source_paths_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_entities (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      stable_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_facts (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      fact_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      trust_tier TEXT NOT NULL,
      evidence_ref TEXT NOT NULL,
      resource_version_id TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      from_entity_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      to_entity_id TEXT NOT NULL,
      weight REAL NOT NULL,
      evidence_ref TEXT NOT NULL,
      resource_version_id TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_version_id TEXT NOT NULL,
      entity_id TEXT,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      evidence_ref TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worker_graph_updates (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      lease_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      symbol TEXT,
      update_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      evidence_ref TEXT NOT NULL,
      validation_ref TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merged_pr_updates (
      id TEXT PRIMARY KEY,
      pr INTEGER NOT NULL,
      merged_at TEXT,
      resource_version_id TEXT NOT NULL,
      touched_files_json TEXT NOT NULL,
      graph_delta_json TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS graph_entities_type_idx ON graph_entities(entity_type);
    CREATE INDEX IF NOT EXISTS graph_edges_from_idx ON graph_edges(from_entity_id, edge_type);
    CREATE INDEX IF NOT EXISTS graph_edges_to_idx ON graph_edges(to_entity_id, edge_type);
    CREATE INDEX IF NOT EXISTS graph_facts_entity_idx ON graph_facts(entity_id, fact_type);
    CREATE INDEX IF NOT EXISTS search_chunks_source_idx ON search_chunks(source_id);
  `);

  try {
    store.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_chunks_fts
      USING fts5(id UNINDEXED, source_id UNINDEXED, entity_id UNINDEXED, title, text, evidence_ref UNINDEXED);
    `);
    store.hasFts = true;
  } catch {
    store.hasFts = false;
  }
}

export function resetKnowledgeGraph(store: KnowledgeGraphStore): void {
  store.db.exec(`
    DELETE FROM resource_versions;
    DELETE FROM graph_entities;
    DELETE FROM graph_facts;
    DELETE FROM graph_edges;
    DELETE FROM search_chunks;
  `);
  if (store.hasFts) store.db.exec("DELETE FROM search_chunks_fts");
}

export function upsertSourceDescriptor(store: KnowledgeGraphStore, source: SourceDescriptor): void {
  store.db
    .query(
      `
        INSERT INTO knowledge_sources (id, kind, title, trust_tier, freshness, descriptor_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          title = excluded.title,
          trust_tier = excluded.trust_tier,
          freshness = excluded.freshness,
          descriptor_json = excluded.descriptor_json,
          updated_at = excluded.updated_at
      `,
    )
    .run(source.id, source.kind, source.title, source.trust_tier, source.freshness, stableJson(source), new Date().toISOString());
}

export function upsertToolDescriptor(store: KnowledgeGraphStore, tool: ToolDescriptor): void {
  store.db
    .query(
      `
        INSERT INTO knowledge_tools (id, title, trust_tier, descriptor_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          trust_tier = excluded.trust_tier,
          descriptor_json = excluded.descriptor_json,
          updated_at = excluded.updated_at
      `,
    )
    .run(tool.id, tool.title, tool.trust_tier, stableJson(tool), new Date().toISOString());
}

export function insertGraphRecords(store: KnowledgeGraphStore, records: GraphRecords): void {
  const insertVersion = store.db.query(`
    INSERT OR REPLACE INTO resource_versions (id, source_id, content_hash, indexed_at, source_paths_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertEntityReplace = store.db.query(`
    INSERT INTO graph_entities (id, entity_type, stable_key, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      entity_type = excluded.entity_type,
      stable_key = excluded.stable_key,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);
  const insertEntityIgnore = store.db.query(`
    INSERT OR IGNORE INTO graph_entities (id, entity_type, stable_key, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertFact = store.db.query(`
    INSERT OR REPLACE INTO graph_facts
    (id, entity_id, fact_type, payload_json, confidence, trust_tier, evidence_ref, resource_version_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEdge = store.db.query(`
    INSERT OR REPLACE INTO graph_edges
    (id, from_entity_id, edge_type, to_entity_id, weight, evidence_ref, resource_version_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChunk = store.db.query(`
    INSERT OR REPLACE INTO search_chunks
    (id, source_id, source_version_id, entity_id, title, text, evidence_ref, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = store.hasFts
    ? store.db.query("INSERT INTO search_chunks_fts (id, source_id, entity_id, title, text, evidence_ref) VALUES (?, ?, ?, ?, ?, ?)")
    : null;

  store.db.transaction(() => {
    insertVersion.run(
      records.sourceVersion.id,
      records.sourceVersion.sourceId,
      records.sourceVersion.contentHash,
      new Date().toISOString(),
      stableJson(records.sourceVersion.sourcePaths),
    );
    for (const entity of records.entities) insertEntity(store, entity, insertEntityReplace, insertEntityIgnore);
    for (const fact of records.facts) insertGraphFact(fact, insertFact);
    for (const edge of records.edges) insertGraphEdge(edge, insertEdge);
    for (const chunk of records.chunks) {
      insertSearchChunk(records.sourceVersion.sourceId, chunk, insertChunk);
      insertFts?.run(chunk.id, chunk.sourceId, chunk.entityId ?? null, chunk.title, chunk.text, chunk.evidenceRef);
    }
  })();
}

function insertEntity(
  store: KnowledgeGraphStore,
  entity: GraphEntity,
  replaceQuery: ReturnType<Database["query"]>,
  ignoreQuery: ReturnType<Database["query"]>,
): void {
  const query = entity.replace === false ? ignoreQuery : replaceQuery;
  query.run(entity.id, entity.entityType, entity.stableKey, stableJson(entity.payload), new Date().toISOString());
}

function insertGraphFact(fact: GraphFact, query: ReturnType<Database["query"]>): void {
  query.run(
    fact.id,
    fact.entityId,
    fact.factType,
    stableJson(fact.payload),
    fact.confidence,
    fact.trustTier,
    fact.evidenceRef,
    fact.sourceVersionId,
    fact.status ?? "accepted",
  );
}

function insertGraphEdge(edge: GraphEdge, query: ReturnType<Database["query"]>): void {
  query.run(
    edge.id,
    edge.fromEntityId,
    edge.edgeType,
    edge.toEntityId,
    edge.weight,
    edge.evidenceRef,
    edge.sourceVersionId,
    edge.status ?? "accepted",
  );
}

function insertSearchChunk(sourceId: string, chunk: SearchChunk, query: ReturnType<Database["query"]>): void {
  query.run(chunk.id, sourceId, chunk.sourceVersionId, chunk.entityId ?? null, chunk.title, chunk.text, chunk.evidenceRef, stableJson(chunk.payload));
}

export function searchKnowledgeGraph(store: KnowledgeGraphStore, params: { query: string; sourceId?: string; limit: number }): SearchResult[] {
  const queryText = params.query.trim();
  if (!queryText) return [];
  const sourceFilter = params.sourceId ? "AND search_chunks.source_id = ?" : "";
  const likePattern = `%${queryText}%`;
  const rows = store.db
    .query(
      `
        SELECT
          search_chunks.id,
          search_chunks.source_id,
          search_chunks.entity_id,
          search_chunks.title,
          search_chunks.text,
          search_chunks.evidence_ref,
          knowledge_sources.trust_tier
        FROM search_chunks
        LEFT JOIN knowledge_sources ON knowledge_sources.id = search_chunks.source_id
        WHERE (search_chunks.title LIKE ? OR search_chunks.text LIKE ?)
        ${sourceFilter}
        ORDER BY length(search_chunks.text) ASC
        LIMIT ?
      `,
    )
    .all(...(params.sourceId ? [likePattern, likePattern, params.sourceId, params.limit] : [likePattern, likePattern, params.limit])) as Array<
    Record<string, unknown>
  >;

  return rows.map((row) => ({
    source_id: String(row.source_id ?? ""),
    result_id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    snippet: truncate(String(row.text ?? ""), 360),
    evidence_ref: String(row.evidence_ref ?? ""),
    entity_id: row.entity_id == null ? undefined : String(row.entity_id),
    confidence: 0.5,
    trust_tier: String(row.trust_tier ?? "historical") as SearchResult["trust_tier"],
  }));
}

export function graphStats(store: KnowledgeGraphStore): Record<string, number> {
  const count = (table: string): number => {
    const row = store.db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as Record<string, unknown>;
    return Number(row.count ?? 0);
  };
  return {
    sources: count("knowledge_sources"),
    tools: count("knowledge_tools"),
    versions: count("resource_versions"),
    entities: count("graph_entities"),
    facts: count("graph_facts"),
    edges: count("graph_edges"),
    search_chunks: count("search_chunks"),
  };
}
