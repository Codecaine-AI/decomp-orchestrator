import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(): string {
  return fileURLToPath(new URL("../..", import.meta.url));
}

export function checkoutRoot(): string {
  return resolve(packageRoot(), "..");
}

export function knowledgeRoot(): string {
  return resolve(packageRoot(), "knowledge");
}

export function pastPrsRoot(): string {
  return resolve(knowledgeSourcesRoot(), "past_prs", "data");
}

export function decompResourcesRoot(): string {
  return resolve(knowledgeSourcesRoot(), "resource_guides", "data");
}

export function sourceDataRoot(sourceId: string): string {
  return resolve(knowledgeSourcesRoot(), sourceId, "data");
}

export function knowledgeSourcesRoot(): string {
  return resolve(knowledgeRoot(), "sources");
}

export function knowledgeSourceRegistryPath(): string {
  return resolve(knowledgeSourcesRoot(), "registry.json");
}

export function knowledgeToolsRoot(): string {
  return resolve(knowledgeRoot(), "tools");
}

export function knowledgeToolRegistryPath(): string {
  return resolve(knowledgeToolsRoot(), "registry.json");
}

export function resourceGraphRoot(): string {
  return resolve(knowledgeRoot(), "resource_graph");
}

export function resourceGraphEnrichmentsRoot(): string {
  return resolve(resourceGraphRoot(), "enrichments");
}

export function agentSharedStateEnrichmentPath(): string {
  return resolve(resourceGraphEnrichmentsRoot(), "agent_shared_state_lessons.jsonl");
}

export function knowledgeCuratorEnrichmentPath(): string {
  return resolve(resourceGraphEnrichmentsRoot(), "knowledge_curator_updates.jsonl");
}

export function resourceGraphDbPath(): string {
  return resolve(resourceGraphRoot(), "graph.sqlite");
}
