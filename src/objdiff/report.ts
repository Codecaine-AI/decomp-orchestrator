import { readFile, writeFile } from "node:fs/promises";

const UNIT_KEYS_TO_DIFF = [
  "fuzzy_match_percent",
  "matched_code_percent",
  "matched_data_percent",
  "complete_code_percent",
  "complete_data_percent",
] as const;

const FUNCTION_KEYS_TO_DIFF = ["fuzzy_match_percent"] as const;
const SECTION_KEYS_TO_DIFF = ["fuzzy_match_percent"] as const;

type MetricKey =
  | (typeof UNIT_KEYS_TO_DIFF)[number]
  | (typeof FUNCTION_KEYS_TO_DIFF)[number]
  | (typeof SECTION_KEYS_TO_DIFF)[number];

interface MetricValues {
  fuzzy_match_percent?: unknown;
  matched_code_percent?: unknown;
  matched_data_percent?: unknown;
  complete_code_percent?: unknown;
  complete_data_percent?: unknown;
  matched_code?: unknown;
  matched_data?: unknown;
  size?: unknown;
}

interface ReportRow {
  name: string;
  from?: MetricValues;
  to?: MetricValues;
}

interface ReportUnit extends ReportRow {
  sections?: ReportRow[];
  functions?: ReportRow[];
}

interface ObjdiffReportChanges {
  from?: MetricValues;
  to?: MetricValues;
  units?: ReportUnit[];
}

export interface MetricChange {
  name: string | null;
  key: string;
  from: number;
  to: number;
}

interface ReportEntry {
  unitName: string;
  itemName: string;
  size: number;
  fromPercent: number;
  toPercent: number;
  bytesDelta: number;
}

export interface RegressionReport {
  regressions: MetricChange[];
  progressions: MetricChange[];
  newMatches: ReportEntry[];
  brokenMatches: ReportEntry[];
  improvements: ReportEntry[];
  fuzzyRegressions: ReportEntry[];
  markdown: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function metricValue(row: ReportRow | ObjdiffReportChanges, side: "from" | "to", key: MetricKey): number {
  return toNumber(row[side]?.[key]);
}

function sizeOf(row: ReportRow): number {
  return toNumber(row.to?.size ?? row.from?.size);
}

function bytesDelta(size: number, fromPercent: number, toPercent: number): number {
  const delta = (size * (toPercent - fromPercent)) / 100.0;
  return delta < 0 ? Math.trunc(delta - 0.5) : Math.trunc(delta + 0.5);
}

function formatFloat(value: number): string {
  const clamped = value < 100.0 && value > 99.99 ? 99.99 : value;
  return clamped.toFixed(2).padStart(6, " ");
}

function formatPercent(value: number): string {
  return `${formatFloat(value).trim()}%`;
}

function formatDeltaPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDeltaBytes(value: number): string {
  return `${value >= 0 ? "+" : ""}${value} bytes`;
}

function diffKey(
  regressions: MetricChange[],
  progressions: MetricChange[],
  name: string | null,
  row: ReportRow | ObjdiffReportChanges,
  key: MetricKey,
): void {
  const from = metricValue(row, "from", key);
  const to = metricValue(row, "to", key);
  const change: MetricChange = {
    name,
    key: key.endsWith("_percent") ? key.slice(0, -"_percent".length) : key,
    from,
    to,
  };
  if (from > to) regressions.push(change);
  else if (to > from) progressions.push(change);
}

function metricChanges(report: ObjdiffReportChanges): Pick<RegressionReport, "regressions" | "progressions"> {
  const regressions: MetricChange[] = [];
  const progressions: MetricChange[] = [];

  for (const key of UNIT_KEYS_TO_DIFF) {
    diffKey(regressions, progressions, null, report, key);
  }

  for (const unit of asArray<ReportUnit>(report.units)) {
    for (const key of UNIT_KEYS_TO_DIFF) {
      diffKey(regressions, progressions, unit.name, unit, key);
    }
    for (const section of asArray<ReportRow>(unit.sections)) {
      for (const key of SECTION_KEYS_TO_DIFF) {
        diffKey(regressions, progressions, `${unit.name}::${section.name}`, section, key);
      }
    }
    for (const func of asArray<ReportRow>(unit.functions)) {
      for (const key of FUNCTION_KEYS_TO_DIFF) {
        diffKey(regressions, progressions, func.name, func, key);
      }
    }
  }

  return { regressions, progressions };
}

function sortedEntries(report: ObjdiffReportChanges): Omit<
  RegressionReport,
  "regressions" | "progressions" | "markdown"
> {
  const newMatches: ReportEntry[] = [];
  const brokenMatches: ReportEntry[] = [];
  const improvements: ReportEntry[] = [];
  const fuzzyRegressions: ReportEntry[] = [];

  for (const unit of asArray<ReportUnit>(report.units)) {
    const rows = [
      ...asArray<ReportRow>(unit.sections).filter((row) => row.name !== ".text"),
      ...asArray<ReportRow>(unit.functions),
    ];
    for (const row of rows) {
      const fromPercent = toNumber(row.from?.fuzzy_match_percent);
      const toPercent = toNumber(row.to?.fuzzy_match_percent);
      if (fromPercent === toPercent) continue;
      const size = sizeOf(row);
      const entry: ReportEntry = {
        unitName: unit.name,
        itemName: row.name,
        size,
        fromPercent,
        toPercent,
        bytesDelta: bytesDelta(size, fromPercent, toPercent),
      };
      if (fromPercent >= 100.0 && toPercent < 100.0) brokenMatches.push(entry);
      else if (fromPercent < 100.0 && toPercent >= 100.0) newMatches.push(entry);
      else if (toPercent > fromPercent) improvements.push(entry);
      else fuzzyRegressions.push(entry);
    }
  }

  newMatches.sort((a, b) => b.bytesDelta - a.bytesDelta);
  brokenMatches.sort((a, b) => a.bytesDelta - b.bytesDelta);
  improvements.sort((a, b) => b.bytesDelta - a.bytesDelta);
  fuzzyRegressions.sort((a, b) => a.bytesDelta - b.bytesDelta);
  return { newMatches, brokenMatches, improvements, fuzzyRegressions };
}

function reportTable(entries: ReportEntry[], maxRows: number): string[] {
  const shown = maxRows <= 0 ? entries : entries.slice(0, maxRows);
  if (shown.length === 0) return ["No entries."];

  const lines = ["| Unit | Item | Bytes | Before | After |", "| - | - | - | - | - |"];
  for (const entry of shown) {
    lines.push(
      `| \`${entry.unitName}\` | \`${entry.itemName}\` | ${entry.bytesDelta >= 0 ? "+" : ""}${entry.bytesDelta} | ${formatPercent(entry.fromPercent)} | ${formatPercent(entry.toPercent)} |`,
    );
  }
  if (maxRows > 0 && entries.length > maxRows) {
    lines.push("", `...and ${entries.length - maxRows} more`);
  }
  return lines;
}

function reportSection(title: string, entries: ReportEntry[], maxRows: number, open = false): string[] {
  return [
    `<details${open ? " open" : ""}>`,
    `<summary>${entries.length} ${title}</summary>`,
    "",
    ...reportTable(entries, maxRows),
    "</details>",
  ];
}

function generateMarkdown(report: ObjdiffReportChanges, title: string, maxRows: number): string {
  const entries = sortedEntries(report);
  const from = report.from ?? {};
  const to = report.to ?? {};
  const codeDelta = toNumber(to.matched_code) - toNumber(from.matched_code);
  const dataDelta = toNumber(to.matched_data) - toNumber(from.matched_data);
  const codePercentDelta = toNumber(to.matched_code_percent) - toNumber(from.matched_code_percent);
  const dataPercentDelta = toNumber(to.matched_data_percent) - toNumber(from.matched_data_percent);
  const lines = [
    `### ${title}`,
    "",
    `**Matched code**: ${formatPercent(toNumber(to.matched_code_percent))} (${formatDeltaPercent(codePercentDelta)}, ${formatDeltaBytes(codeDelta)})`,
    `**Matched data**: ${formatPercent(toNumber(to.matched_data_percent))} (${formatDeltaPercent(dataPercentDelta)}, ${formatDeltaBytes(dataDelta)})`,
    "",
    ...reportSection("new matches", entries.newMatches, maxRows),
    "",
    ...reportSection("broken matches", entries.brokenMatches, maxRows, entries.brokenMatches.length > 0),
    "",
    ...reportSection("improvements in unmatched items", entries.improvements, maxRows),
    "",
    ...reportSection("regressions in unmatched items", entries.fuzzyRegressions, maxRows, entries.fuzzyRegressions.length > 0),
    "",
  ];
  return lines.join("\n");
}

export async function readRegressionReport(
  reportChangesPath: string,
  title: string,
  maxRows: number,
): Promise<RegressionReport> {
  const raw = JSON.parse(await readFile(reportChangesPath, "utf8")) as unknown;
  const report = asRecord(raw) as ObjdiffReportChanges;
  const changes = metricChanges(report);
  const entries = sortedEntries(report);
  return {
    ...changes,
    ...entries,
    markdown: generateMarkdown(report, title, maxRows),
  };
}

export async function writePrReport(
  reportChangesPath: string,
  outputPath: string,
  title: string,
  maxRows: number,
): Promise<RegressionReport> {
  const report = await readRegressionReport(reportChangesPath, title, maxRows);
  await writeFile(outputPath, report.markdown);
  return report;
}
