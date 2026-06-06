import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { graphDbExists, openKnowledgeGraph, rankFeatureForSourcePath, resourceGraphDbPath } from "../knowledge/index.js";
import type { BoardMeasures, BoardSnapshot, TargetCandidate } from "../types/index.js";
import { candidateFromReportFunction, objdiffSourceMap } from "./candidates.js";
import { asArray, asObject, stringValue, type JsonObject } from "./json.js";

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

export function loadBoardSnapshot(repoRoot: string, limit: number): BoardSnapshot {
  const reportPath = resolve(repoRoot, "build/GALE01/report.json");
  const objdiffPath = resolve(repoRoot, "objdiff.json");
  if (!existsSync(reportPath)) throw new Error(`Missing ${reportPath}`);
  if (!existsSync(objdiffPath)) throw new Error(`Missing ${objdiffPath}`);

  const report = readJson(reportPath);
  const objdiff = readJson(objdiffPath);
  const sourceByUnit = objdiffSourceMap(objdiff);
  const candidates: TargetCandidate[] = [];

  for (const unitValue of asArray(report.units)) {
    const unit = asObject(unitValue);
    const unitName = stringValue(unit.name);
    if (!unitName) continue;
    const metadata = asObject(unit.metadata);
    const sourcePath = stringValue(metadata.source_path, sourceByUnit.get(unitName) ?? "");
    for (const fnValue of asArray(unit.functions)) {
      const candidate = candidateFromReportFunction({
        unitName,
        sourcePath,
        fn: asObject(fnValue),
      });
      if (candidate) candidates.push(candidate);
    }
  }

  applyGraphFeatures(candidates);
  candidates.sort((left, right) => right.priority - left.priority);
  const measures = asObject(report.measures) as BoardMeasures;
  return {
    generatedAt: new Date().toISOString(),
    reportPath,
    objdiffPath,
    measures,
    candidates: candidates.slice(0, limit),
  };
}

function applyGraphFeatures(candidates: TargetCandidate[]): void {
  const dbPath = resourceGraphDbPath();
  if (!graphDbExists(dbPath) || candidates.length === 0) return;
  const store = openKnowledgeGraph(dbPath);
  try {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      const feature = rankFeatureForSourcePath(store, candidate.sourcePath, {
        source_path: candidate.sourcePath,
        unit: candidate.unit,
        symbol: candidate.symbol,
      });
      if (feature.editability === "read_only_complete" || feature.editability === "locked" || feature.editability === "blocked") {
        candidates.splice(index, 1);
        continue;
      }
      if (feature.priority_bonus !== 0) {
        candidate.priority += feature.priority_bonus;
        candidate.reason = `${candidate.reason}; graph bonus ${feature.priority_bonus.toFixed(2)} (${feature.explanation.join(", ")})`;
      }
    }
  } finally {
    store.db.close();
  }
}
