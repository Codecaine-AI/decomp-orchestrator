import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { checkoutRoot, knowledgeSourcesRoot } from "../paths.js";
import type { GraphEdge, GraphEntity, GraphFact, GraphRecords, SearchChunk } from "./types.js";
import { arrayValue, filesFingerprint, numberValue, objectValue, readJson, shortHash, stableJson, stringValue } from "./util.js";

interface FunctionRecord {
  unit: string;
  sourcePath: string;
  symbol: string;
  size: number;
  fuzzy: number;
  address: string;
}

interface FileRecord {
  sourcePath: string;
  units: Set<string>;
  functions: FunctionRecord[];
}

export function buildCodeGraphRecords(repoRoot: string): GraphRecords {
  const reportPath = resolve(repoRoot, "build/GALE01/report.json");
  const objdiffPath = resolve(repoRoot, "objdiff.json");
  if (!existsSync(reportPath)) throw new Error(`Missing ${reportPath}`);
  if (!existsSync(objdiffPath)) throw new Error(`Missing ${objdiffPath}`);

  const sourceByUnit = objdiffSourceMap(readJson(objdiffPath));
  const report = readJson(reportPath);
  const sourceVersionId = `source-version:code_graph:${shortHash(filesFingerprint([reportPath, objdiffPath]))}`;
  const entities: GraphEntity[] = [];
  const facts: GraphFact[] = [];
  const edges: GraphEdge[] = [];
  const chunks: SearchChunk[] = [];
  const files = new Map<string, FileRecord>();

  for (const unitValue of arrayValue(report.units)) {
    const unit = objectValue(unitValue);
    const unitName = stringValue(unit.name);
    if (!unitName) continue;
    const metadata = objectValue(unit.metadata);
    const sourcePath = stringValue(metadata.source_path, sourceByUnit.get(unitName) ?? "");
    const unitEntity = unitEntityId(unitName);
    entities.push({
      id: unitEntity,
      entityType: "object_unit",
      stableKey: unitName,
      payload: { unit: unitName, source_path: sourcePath },
    });
    if (sourcePath) {
      const file = getFile(files, sourcePath);
      file.units.add(unitName);
      edges.push(edge(fileEntityId(sourcePath), "COMPILES_TO", unitEntity, sourceVersionId, `objdiff:${unitName}`, 1));
    }

    for (const fnValue of arrayValue(unit.functions)) {
      const fn = objectValue(fnValue);
      const symbol = stringValue(fn.name);
      if (!symbol) continue;
      const size = numberValue(fn.size);
      const fuzzy = numberValue(fn.fuzzy_match_percent, 100);
      const fnMetadata = objectValue(fn.metadata);
      const address = formatAddress(fnMetadata.virtual_address);
      const functionRecord: FunctionRecord = { unit: unitName, sourcePath, symbol, size, fuzzy, address };
      const functionEntity = functionEntityId(unitName, symbol);
      entities.push({
        id: functionEntity,
        entityType: "function",
        stableKey: `${unitName}:${symbol}`,
        payload: { ...functionRecord },
      });
      facts.push({
        id: `fact:function_status:${shortHash(`${unitName}:${symbol}`)}`,
        entityId: functionEntity,
        factType: "function_status",
        payload: { ...functionRecord },
        confidence: 1,
        trustTier: "canonical",
        evidenceRef: `${reportPath}#${unitName}:${symbol}`,
        sourceVersionId,
      });
      edges.push(edge(unitEntity, "CONTAINS", functionEntity, sourceVersionId, `report:${unitName}:${symbol}`, 1));
      if (sourcePath) getFile(files, sourcePath).functions.push(functionRecord);
    }
  }

  for (const file of files.values()) {
    const unmatched = file.functions.filter((fn) => fn.fuzzy < 100);
    const matched = file.functions.filter((fn) => fn.fuzzy >= 100);
    const editability =
      file.functions.length === 0
        ? { mode: "unknown", reason: "No functions were found for this source file in the report." }
        : unmatched.length === 0
          ? { mode: "read_only_complete", reason: "Every known function in this file is exact 100%; use as reference evidence only." }
          : { mode: "editable", reason: `${unmatched.length} unmatched function(s) remain in this source file.` };
    const payload = {
      source_path: file.sourcePath,
      units: [...file.units].sort(),
      function_count: file.functions.length,
      unmatched_function_count: unmatched.length,
      matched_function_count: matched.length,
      editability,
    };
    entities.push({
      id: fileEntityId(file.sourcePath),
      entityType: "source_file",
      stableKey: file.sourcePath,
      payload,
    });
    facts.push({
      id: `fact:file_status:${shortHash(file.sourcePath)}`,
      entityId: fileEntityId(file.sourcePath),
      factType: "file_match_status",
      payload: {
        ...payload,
        unmatched_functions: unmatched.map((fn) => ({ symbol: fn.symbol, fuzzy: fn.fuzzy, size: fn.size, unit: fn.unit, address: fn.address })),
        functions: file.functions.map((fn) => ({ symbol: fn.symbol, fuzzy: fn.fuzzy, size: fn.size, unit: fn.unit, address: fn.address })),
      },
      confidence: 1,
      trustTier: "canonical",
      evidenceRef: reportPath,
      sourceVersionId,
    });
    facts.push({
      id: `fact:editability:${shortHash(file.sourcePath)}`,
      entityId: fileEntityId(file.sourcePath),
      factType: "editability",
      payload: editability,
      confidence: 1,
      trustTier: "canonical",
      evidenceRef: reportPath,
      sourceVersionId,
    });
    chunks.push({
      id: `chunk:code_graph:file:${shortHash(file.sourcePath)}`,
      sourceId: "code_graph",
      sourceVersionId,
      entityId: fileEntityId(file.sourcePath),
      title: `Code graph: ${file.sourcePath}`,
      text: `${file.sourcePath} ${[...file.units].join(" ")} ${file.functions.map((fn) => fn.symbol).join(" ")}`,
      evidenceRef: reportPath,
      payload,
    });
  }

  if (resolve(repoRoot) === checkoutRoot()) {
    writeJsonl(
      resolve(knowledgeSourcesRoot(), "code_graph/indexes/files.jsonl"),
      [...files.values()].map((file) => ({
        source_path: file.sourcePath,
        units: [...file.units].sort(),
        function_count: file.functions.length,
        matched_function_count: file.functions.filter((fn) => fn.fuzzy >= 100).length,
        unmatched_function_count: file.functions.filter((fn) => fn.fuzzy < 100).length,
      })),
    );
    writeJsonl(
      resolve(knowledgeSourcesRoot(), "code_graph/indexes/functions.jsonl"),
      [...files.values()].flatMap((file) => file.functions.map((fn) => ({ ...fn }))),
    );
  }

  return {
    sourceVersion: {
      id: sourceVersionId,
      sourceId: "code_graph",
      contentHash: shortHash(stableJson({ report: filesFingerprint([reportPath]), objdiff: filesFingerprint([objdiffPath]) })),
      sourcePaths: [reportPath, objdiffPath],
    },
    entities,
    facts,
    edges,
    chunks,
  };
}

function objdiffSourceMap(objdiff: Record<string, unknown>): Map<string, string> {
  const byUnit = new Map<string, string>();
  for (const unitValue of arrayValue(objdiff.units)) {
    const unit = objectValue(unitValue);
    const metadata = objectValue(unit.metadata);
    const name = stringValue(unit.name);
    const sourcePath = stringValue(metadata.source_path);
    if (name && sourcePath) byUnit.set(name, sourcePath);
  }
  return byUnit;
}

function getFile(files: Map<string, FileRecord>, sourcePath: string): FileRecord {
  const existing = files.get(sourcePath);
  if (existing) return existing;
  const created: FileRecord = { sourcePath, units: new Set<string>(), functions: [] };
  files.set(sourcePath, created);
  return created;
}

function formatAddress(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
  if (typeof value === "string" && /^\d+$/.test(value)) return `0x${Number(value).toString(16).toUpperCase().padStart(8, "0")}`;
  return typeof value === "string" ? value : "";
}

export function fileEntityId(sourcePath: string): string {
  return `file:${sourcePath}`;
}

export function unitEntityId(unit: string): string {
  return `unit:${unit}`;
}

export function functionEntityId(unit: string, symbol: string): string {
  return `function:${unit}:${symbol}`;
}

function edge(from: string, type: string, to: string, sourceVersionId: string, evidenceRef: string, weight: number): GraphEdge {
  return {
    id: `edge:${type}:${shortHash(`${from}:${to}:${evidenceRef}`)}`,
    fromEntityId: from,
    edgeType: type,
    toEntityId: to,
    weight,
    evidenceRef,
    sourceVersionId,
  };
}

function writeJsonl(path: string, rows: Array<Record<string, unknown>>): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, body ? `${body}\n` : "", "utf8");
}
