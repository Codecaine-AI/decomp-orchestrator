import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  knowledgeSourceRegistryPath,
  knowledgeSourcesRoot,
  knowledgeToolRegistryPath,
  knowledgeToolsRoot,
  packageRoot,
} from "../paths.js";
import type { SourceDescriptor, ToolDescriptor } from "./types.js";

interface RegistryFile {
  sources?: string[];
  tools?: string[];
}

export function readSourceRegistry(): SourceDescriptor[] {
  const registryPath = knowledgeSourceRegistryPath();
  if (!existsSync(registryPath)) return [];
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryFile;
  return (registry.sources ?? []).map((id) => readSourceDescriptor(id));
}

export function readToolRegistry(): ToolDescriptor[] {
  const registryPath = knowledgeToolRegistryPath();
  if (!existsSync(registryPath)) return [];
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryFile;
  return (registry.tools ?? []).map((id) => readToolDescriptor(id));
}

export function readSourceDescriptor(id: string): SourceDescriptor {
  const path = resolve(knowledgeSourcesRoot(), id, "source.json");
  return JSON.parse(readFileSync(path, "utf8")) as SourceDescriptor;
}

export function readToolDescriptor(id: string): ToolDescriptor {
  const path = resolve(knowledgeToolsRoot(), id, "tool.json");
  return JSON.parse(readFileSync(path, "utf8")) as ToolDescriptor;
}

export function resolvePackagePath(path: string): string {
  return path.startsWith("/") ? path : resolve(packageRoot(), path);
}
