import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}

export function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function shortHash(value: string): string {
  return sha1(value).slice(0, 16);
}

export function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function readJsonl(path: string, maxRows = Number.POSITIVE_INFINITY): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  const rows: Record<string, unknown>[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as Record<string, unknown>);
    if (rows.length >= maxRows) break;
  }
  return rows;
}

export function readJsonlLazy(path: string, onRow: (row: Record<string, unknown>) => void, maxRows = Number.POSITIVE_INFINITY): number {
  if (!existsSync(path)) return 0;
  let count = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    onRow(JSON.parse(line) as Record<string, unknown>);
    count += 1;
    if (count >= maxRows) break;
  }
  return count;
}

export function fileFingerprint(path: string): string {
  if (!existsSync(path)) return `${path}:missing`;
  const stat = statSync(path);
  return `${path}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
}

export function filesFingerprint(paths: string[]): string {
  return sha1(paths.map(fileFingerprint).join("\n"));
}

export function resolveExisting(base: string, path: string): string {
  return path.startsWith("/") ? path : resolve(base, path);
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
