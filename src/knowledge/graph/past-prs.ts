import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { knowledgeSourcesRoot, pastPrsRoot } from "../paths.js";
import { fileEntityId } from "./code-graph.js";
import type { GraphEdge, GraphEntity, GraphFact, GraphRecords, SearchChunk } from "./types.js";
import { arrayValue, filesFingerprint, numberValue, objectValue, readJsonlLazy, shortHash, stringValue, truncate } from "./util.js";

interface FileRollup {
  sourcePath: string;
  prs: Map<number, { pr: number; title: string; added: number; deleted: number; hunks: number }>;
  reviewRisks: string[];
  tactics: string[];
}

export function buildPastPrsGraphRecords(): GraphRecords {
  const root = pastPrsRoot();
  const changedFilesPath = resolve(root, "current/analysis/changed_files.jsonl");
  const textCorpusPath = resolve(root, "current/analysis/text_corpus.jsonl");
  const prIndexPath = resolve(root, "prs/index.jsonl");
  const knownFixesPath = resolve(root, "prs/known_fixes.md");
  const sourcePaths = [changedFilesPath, textCorpusPath, prIndexPath, knownFixesPath].filter(existsSync);
  const sourceVersionId = `source-version:past_prs:${shortHash(filesFingerprint(sourcePaths))}`;
  const entities: GraphEntity[] = [];
  const facts: GraphFact[] = [];
  const edges: GraphEdge[] = [];
  const chunks: SearchChunk[] = [];
  const fileRollups = new Map<string, FileRollup>();
  const knownPrs = new Map<number, Record<string, unknown>>();

  readJsonlLazy(prIndexPath, (row) => {
    const pr = Number(row.pr);
    if (!Number.isFinite(pr)) return;
    knownPrs.set(pr, row);
    entities.push(prEntity(row, sourceVersionId));
    chunks.push({
      id: `chunk:past_prs:pr:${pr}`,
      sourceId: "past_prs",
      sourceVersionId,
      entityId: prEntityId(pr),
      title: `PR ${pr}: ${stringValue(row.title)}`,
      text: [row.title, row.summary, row.categories, row.systems, row.searchable_terms].map((value) => String(value ?? "")).join("\n"),
      evidenceRef: stringValue(row.postmortem_json, `prs/index.jsonl:${pr}`),
      payload: row,
    });
    const postmortemRel = stringValue(row.postmortem_json);
    if (postmortemRel) addPostmortemChunks(resolve(root, "prs", postmortemRel), pr, sourceVersionId, chunks, facts);
  });

  readJsonlLazy(changedFilesPath, (row) => {
    const pr = Number(row.pr);
    const sourcePath = stringValue(row.file);
    if (!Number.isFinite(pr) || !sourcePath) return;
    const title = stringValue(row.title);
    entities.push({
      id: fileEntityId(sourcePath),
      entityType: "source_file",
      stableKey: sourcePath,
      payload: { source_path: sourcePath },
      replace: false,
    });
    if (!knownPrs.has(pr)) {
      const prPayload = { pr, title };
      knownPrs.set(pr, prPayload);
      entities.push(prEntity(prPayload, sourceVersionId));
    }
    edges.push({
      id: `edge:TOUCHED_BY_PR:${shortHash(`${sourcePath}:${pr}`)}`,
      fromEntityId: fileEntityId(sourcePath),
      edgeType: "TOUCHED_BY_PR",
      toEntityId: prEntityId(pr),
      weight: 1,
      evidenceRef: `${changedFilesPath}:${pr}:${sourcePath}`,
      sourceVersionId,
    });
    const rollup = getRollup(fileRollups, sourcePath);
    rollup.prs.set(pr, {
      pr,
      title,
      added: numberValue(row.added),
      deleted: numberValue(row.deleted),
      hunks: numberValue(row.hunks),
    });
  });

  readJsonlLazy(textCorpusPath, (row) => {
    const pr = Number(row.pr);
    if (!Number.isFinite(pr)) return;
    const body = stringValue(row.body);
    if (!body) return;
    const path = row.path == null ? "" : stringValue(row.path);
    chunks.push({
      id: `chunk:past_prs:text:${shortHash(`${pr}:${stringValue(row.kind)}:${stringValue(row.created_at)}:${body.slice(0, 80)}`)}`,
      sourceId: "past_prs",
      sourceVersionId,
      entityId: prEntityId(pr),
      title: `PR ${pr} ${stringValue(row.kind, "text")}${path ? `: ${path}` : ""}`,
      text: body,
      evidenceRef: stringValue(row.comment_url, `${textCorpusPath}:${pr}`),
      payload: row,
    });
  }, 5000);

  for (const rollup of fileRollups.values()) {
    const prRows = [...rollup.prs.values()].sort((left, right) => right.pr - left.pr);
    const payload = {
      source_path: rollup.sourcePath,
      touching_pr_count: prRows.length,
      touching_prs: prRows.slice(0, 32),
      review_risks: rollup.reviewRisks,
      tactics: rollup.tactics,
    };
    facts.push({
      id: `fact:past_prs:file_rollup:${shortHash(rollup.sourcePath)}`,
      entityId: fileEntityId(rollup.sourcePath),
      factType: "past_pr_file_rollup",
      payload,
      confidence: 0.75,
      trustTier: "historical",
      evidenceRef: changedFilesPath,
      sourceVersionId,
    });
    chunks.push({
      id: `chunk:past_prs:file:${shortHash(rollup.sourcePath)}`,
      sourceId: "past_prs",
      sourceVersionId,
      entityId: fileEntityId(rollup.sourcePath),
      title: `Past PRs for ${rollup.sourcePath}`,
      text: `${rollup.sourcePath}\n${prRows.map((pr) => `PR ${pr.pr} ${pr.title}`).join("\n")}`,
      evidenceRef: changedFilesPath,
      payload,
    });
  }

  writeJsonl(resolve(knowledgeSourcesRoot(), "past_prs/indexes/prs.jsonl"), [...knownPrs.values()].sort((left, right) => Number(right.pr) - Number(left.pr)));
  writeJsonl(
    resolve(knowledgeSourcesRoot(), "past_prs/indexes/pr_file_edges.jsonl"),
    [...fileRollups.values()].flatMap((rollup) =>
      [...rollup.prs.values()].map((pr) => ({
        source_path: rollup.sourcePath,
        pr: pr.pr,
        title: pr.title,
        added: pr.added,
        deleted: pr.deleted,
        hunks: pr.hunks,
      })),
    ),
  );
  writeJsonl(
    resolve(knowledgeSourcesRoot(), "past_prs/indexes/file_rollups.jsonl"),
    [...fileRollups.values()].map((rollup) => {
      const prRows = [...rollup.prs.values()].sort((left, right) => right.pr - left.pr);
      return {
        source_path: rollup.sourcePath,
        touching_pr_count: prRows.length,
        touching_prs: prRows.slice(0, 32),
        review_risks: rollup.reviewRisks,
        tactics: rollup.tactics,
      };
    }),
  );

  if (existsSync(knownFixesPath)) {
    chunks.push({
      id: "chunk:past_prs:known_fixes",
      sourceId: "past_prs",
      sourceVersionId,
      title: "Past PR known fixes",
      text: readFileSync(knownFixesPath, "utf8"),
      evidenceRef: knownFixesPath,
      payload: { path: knownFixesPath },
    });
  }

  return {
    sourceVersion: {
      id: sourceVersionId,
      sourceId: "past_prs",
      contentHash: shortHash(filesFingerprint(sourcePaths)),
      sourcePaths,
    },
    entities,
    facts,
    edges,
    chunks,
  };
}

function addPostmortemChunks(path: string, pr: number, sourceVersionId: string, chunks: SearchChunk[], facts: GraphFact[]): void {
  if (!existsSync(path)) return;
  const postmortem = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const sections = [
    ["summary", postmortem.summary],
    ["decomp_lessons", arrayValue(postmortem.decomp_lessons).join("\n")],
    ["smart_moves", arrayValue(postmortem.smart_moves).join("\n")],
    ["assembly_or_matching_tactics", arrayValue(postmortem.assembly_or_matching_tactics).join("\n")],
    ["review_feedback", arrayValue(postmortem.review_feedback).join("\n")],
  ];
  const text = sections.map(([title, body]) => `${title}\n${String(body ?? "")}`).join("\n\n");
  chunks.push({
    id: `chunk:past_prs:postmortem:${pr}`,
    sourceId: "past_prs",
    sourceVersionId,
    entityId: prEntityId(pr),
    title: `PR ${pr} postmortem`,
    text,
    evidenceRef: path,
    payload: { pr, path },
  });
  const keyFiles = arrayValue(postmortem.key_files);
  for (const value of keyFiles) {
    const keyFile = objectValue(value);
    const sourcePath = stringValue(keyFile.path);
    if (!sourcePath) continue;
    facts.push({
      id: `fact:past_prs:key_file:${shortHash(`${pr}:${sourcePath}`)}`,
      entityId: fileEntityId(sourcePath),
      factType: "past_pr_key_file",
      payload: { pr, role: truncate(stringValue(keyFile.role), 240), source_path: sourcePath },
      confidence: 0.7,
      trustTier: "historical",
      evidenceRef: path,
      sourceVersionId,
    });
  }
}

function prEntity(payload: Record<string, unknown>, sourceVersionId: string): GraphEntity {
  const pr = Number(payload.pr);
  return {
    id: prEntityId(pr),
    entityType: "pull_request",
    stableKey: `pr-${pr}`,
    payload: {
      pr,
      title: stringValue(payload.title),
      state: stringValue(payload.state),
      author: stringValue(payload.author),
      created_at: stringValue(payload.created_at),
      merged_at: stringValue(payload.merged_at),
      url: stringValue(payload.url),
      source_version_id: sourceVersionId,
    },
  };
}

function prEntityId(pr: number): string {
  return `pr:${pr}`;
}

function getRollup(rollups: Map<string, FileRollup>, sourcePath: string): FileRollup {
  const existing = rollups.get(sourcePath);
  if (existing) return existing;
  const created: FileRollup = { sourcePath, prs: new Map(), reviewRisks: [], tactics: [] };
  rollups.set(sourcePath, created);
  return created;
}

function writeJsonl(path: string, rows: Array<Record<string, unknown>>): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, body ? `${body}\n` : "", "utf8");
}
