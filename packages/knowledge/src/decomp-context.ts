import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { packageRoot, sourceDataRoot } from "./paths.js";
import { readJsonl } from "./graph/util.js";

type JsonRecord = Record<string, unknown>;

const STRENGTH_SCORE: Record<string, number> = {
  strong_hint: 30,
  medium_hint: 20,
  weak_hint: 10,
};

const FINAL_AUTHORITY =
  "Current source, headers, symbols, splits, assembly, objdiff, and regression output outrank global standards and path facts.";

export interface PathFactResolution {
  source: "path_facts";
  path: string;
  limit: number;
  matched_fact_ids: string[];
  excluded_fact_ids: string[];
  facts: JsonRecord[];
  trust_rule: string;
  resolve_command: string;
}

export function globalStandardsContext(): Record<string, unknown> {
  const records = loadGlobalStandards();
  return {
    source: "decomp_standards",
    status: records.length ? "ready" : "missing_records",
    standard_count: records.length,
    accepted_standard_count: records.filter((record) => record.status === "accepted").length,
    trust_rule: FINAL_AUTHORITY,
    mutation_policy: "proposal_only_until_validated",
    search_command: "python3 knowledge/sources/decomp_standards/api/search.py --query <query> --limit 10 --json",
    standards: records.map((record) => ({
      id: record.id,
      title: record.title,
      summary: record.summary,
      do: stringArray(record.do),
      do_not: stringArray(record.do_not),
      evidence_refs: stringArray(record.evidence_refs),
    })),
  };
}

export function resolvePathFactsContext(sourcePath: string, limit = 5): PathFactResolution {
  const normalizedPath = normalizeMeleePath(sourcePath);
  const scored: Array<{ score: number; fact: JsonRecord }> = [];
  for (const fact of loadPathFacts()) {
    if (fact.status !== "accepted") continue;
    const score = matchScore(normalizedPath, fact);
    if (score > 0) scored.push({ score, fact });
  }
  scored.sort((left, right) => right.score - left.score || String(left.fact.id).localeCompare(String(right.fact.id)));
  const matches = scored.slice(0, Math.max(0, limit)).map(({ fact, score }) => formatPathFact(fact, score));
  const excluded = scored.slice(Math.max(0, limit)).map(({ fact }) => String(fact.id ?? ""));
  return {
    source: "path_facts",
    path: normalizedPath,
    limit,
    matched_fact_ids: matches.map((fact) => String(fact.id ?? "")),
    excluded_fact_ids: excluded,
    facts: matches,
    trust_rule: FINAL_AUTHORITY,
    resolve_command: `python3 knowledge/sources/path_facts/api/resolve_for_path.py --path ${shellQuote(normalizedPath)} --limit ${limit} --json`,
  };
}

function loadGlobalStandards(): JsonRecord[] {
  return readJsonl(resolve(sourceDataRoot("decomp_standards"), "standards.jsonl"));
}

function loadPathFacts(): JsonRecord[] {
  const root = resolve(sourceDataRoot("path_facts"), "path_facts");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((file) => file.endsWith(".jsonl"))
    .sort()
    .flatMap((file) => readJsonl(resolve(root, file)).map((row) => ({ ...row, source_file: `knowledge/sources/path_facts/data/path_facts/${file}` })));
}

function formatPathFact(fact: JsonRecord, score: number): JsonRecord {
  return {
    id: fact.id,
    title: fact.title,
    directory: fact.directory,
    score,
    strength: fact.strength,
    scope_globs: stringArray(fact.scope_globs),
    summary: fact.summary,
    do: stringArray(fact.do),
    do_not: stringArray(fact.do_not),
    evidence_refs: stringArray(fact.evidence_refs),
    watched_paths: stringArray(fact.watched_paths),
    slice_ref: fact.slice_ref,
  };
}

function matchScore(path: string, fact: JsonRecord): number {
  let best = 0;
  for (const rawGlob of stringArray(fact.scope_globs)) {
    const glob = normalizeMeleePath(rawGlob);
    if (!globMatches(glob, path)) continue;
    const components = glob.split("/").filter((part) => part && part !== "**" && !part.includes("*"));
    let score = 100 + components.length * 5;
    if (glob === path) score += 100;
    if (glob.endsWith("/**") && path.startsWith(glob.slice(0, -3))) score += 15;
    best = Math.max(best, score);
  }
  if (best === 0) return 0;
  return best + (STRENGTH_SCORE[String(fact.strength ?? "")] ?? 0);
}

function globMatches(glob: string, path: string): boolean {
  if (!glob.includes("*")) return glob === path;
  if (glob.endsWith("/**") && path.startsWith(glob.slice(0, -3))) return true;
  const pattern = glob
    .split("")
    .map((char, index, chars) => {
      if (char !== "*") return escapeRegExp(char);
      if (chars[index + 1] === "*") return "";
      if (chars[index - 1] === "*") return ".*";
      return "[^/]*";
    })
    .join("");
  return new RegExp(`^${pattern}$`).test(path);
}

function normalizeMeleePath(path: string): string {
  let value = path.trim().replace(/\\/g, "/");
  const sourceMarker = "/src/melee/";
  const includeMarker = "/include/";
  if (value.includes(sourceMarker)) value = `src/melee/${value.split(sourceMarker, 2)[1]}`;
  if (value.includes(includeMarker)) value = `include/${value.split(includeMarker, 2)[1]}`;
  value = value.replace(/^\.\//, "").replace(/^\.\.\//, "");
  if (value.startsWith(`${basename(packageRoot())}/`)) value = value.slice(basename(packageRoot()).length + 1);
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
