import { readFile } from "node:fs/promises";
import { atomicWriteFile } from "./atomic.js";

export type CsvRecord = Record<string, string>;

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

export function csvEscape(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
}

export function rowsToCsv<T extends object>(headers: string[], rows: T[]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    lines.push(headers.map((header) => csvEscape(record[header] as string | number | boolean | null | undefined)).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function writeCsv<T extends object>(path: string, headers: string[], rows: T[]): Promise<void> {
  await atomicWriteFile(path, rowsToCsv(headers, rows));
}

export function readCsvRecordsFromText(text: string): CsvRecord[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift();
  if (!header) return [];
  const headers = parseCsvLine(header);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    const record: CsvRecord = {};
    for (let i = 0; i < headers.length; i += 1) record[headers[i]] = cells[i] ?? "";
    return record;
  });
}

export async function readCsvRecords(path: string): Promise<CsvRecord[]> {
  return readCsvRecordsFromText(await readFile(path, "utf8"));
}
