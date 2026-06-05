import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BoardMeasures, BoardSnapshot, TargetCandidate } from "./types.js";

type JsonObject = Record<string, unknown>;

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finishabilityPriority(size: number, fuzzy: number): number {
  const gap = Math.max(0.001, 100 - fuzzy);
  const completeness = Math.max(0, Math.min(1, fuzzy / 100));
  const nearExactBoost = fuzzy >= 99 ? 50 : fuzzy >= 98 ? 12 : fuzzy >= 95 ? 3 : 1;
  return (size * nearExactBoost * completeness ** 4) / (gap + 0.01);
}

function objdiffSourceMap(objdiff: JsonObject): Map<string, string> {
  const byUnit = new Map<string, string>();
  for (const unitValue of asArray(objdiff.units)) {
    const unit = asObject(unitValue);
    const metadata = asObject(unit.metadata);
    const name = stringValue(unit.name);
    const sourcePath = stringValue(metadata.source_path);
    if (name && sourcePath) byUnit.set(name, sourcePath);
  }
  return byUnit;
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
      const fn = asObject(fnValue);
      const fuzzy = numberValue(fn.fuzzy_match_percent, 100);
      if (fuzzy >= 100) continue;
      const size = numberValue(fn.size);
      const symbol = stringValue(fn.name);
      if (!symbol || size <= 0) continue;
      const priority = finishabilityPriority(size, fuzzy);
      candidates.push({
        unit: unitName,
        sourcePath,
        symbol,
        size,
        fuzzy,
        priority,
        reason: `matched-code finish candidate: ${size} bytes at ${fuzzy.toFixed(5)}% fuzzy, ${Math.max(
          0,
          100 - fuzzy,
        ).toFixed(5)}% gap to exact`,
      });
    }
  }

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
