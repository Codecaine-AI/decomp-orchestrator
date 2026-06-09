import { buildAgentSharedStateGraphRecords } from "./agent-shared-state.js";
import { buildCodeGraphRecords } from "./code-graph.js";
import { insertGraphRecords, openKnowledgeGraph, resetKnowledgeGraph, upsertSourceDescriptor, upsertToolDescriptor, graphStats } from "./db.js";
import { buildKnowledgeCuratorGraphRecords } from "./knowledge-curator.js";
import { buildPastPrsGraphRecords } from "./past-prs.js";
import {
  buildDiscordKnowledgeGraphRecords,
  buildDecompStandardsGraphRecords,
  buildExternalMirrorsGraphRecords,
  buildPathFactsGraphRecords,
  buildPowerpcDocsGraphRecords,
  buildReferenceDocsGraphRecords,
  buildResourceGuidesGraphRecords,
  buildSsbmDataSheetGraphRecords,
  buildToolOutputsGraphRecords,
} from "./source-slices.js";
import { readSourceRegistry, readToolRegistry } from "./sources.js";

export interface RebuildKnowledgeGraphOptions {
  repoRoot: string;
  dbPath?: string;
  sources?: string[];
  agentStateEnrichmentPath?: string;
  knowledgeCuratorEnrichmentPath?: string;
}

export function rebuildKnowledgeGraph(options: RebuildKnowledgeGraphOptions): Record<string, unknown> {
  const selected = new Set(options.sources && options.sources.length > 0 ? options.sources : defaultGraphSources());
  const store = openKnowledgeGraph(options.dbPath);
  const indexedSources: string[] = [];
  const skippedSources: string[] = [];
  try {
    resetKnowledgeGraph(store);
    for (const source of readSourceRegistry()) upsertSourceDescriptor(store, source);
    for (const tool of readToolRegistry()) upsertToolDescriptor(store, tool);

    if (selected.has("code_graph")) {
      insertGraphRecords(store, buildCodeGraphRecords(options.repoRoot));
      indexedSources.push("code_graph");
    }
    if (selected.has("past_prs")) {
      insertGraphRecords(store, buildPastPrsGraphRecords());
      indexedSources.push("past_prs");
    }
    const optionalSources = [
      ["discord_knowledge", buildDiscordKnowledgeGraphRecords],
      ["ssbm_data_sheet", buildSsbmDataSheetGraphRecords],
      ["powerpc_docs", buildPowerpcDocsGraphRecords],
      ["external_mirrors", buildExternalMirrorsGraphRecords],
      ["resource_guides", buildResourceGuidesGraphRecords],
      ["reference_docs", buildReferenceDocsGraphRecords],
      ["tool_outputs", buildToolOutputsGraphRecords],
      ["decomp_standards", buildDecompStandardsGraphRecords],
      ["path_facts", buildPathFactsGraphRecords],
    ] as const;
    for (const [sourceId, builder] of optionalSources) {
      if (!selected.has(sourceId)) continue;
      const records = builder();
      if (records) {
        insertGraphRecords(store, records);
        indexedSources.push(sourceId);
      } else {
        skippedSources.push(sourceId);
      }
    }
    if (selected.has("agent_shared_state")) {
      const records = buildAgentSharedStateGraphRecords(options.repoRoot, options.agentStateEnrichmentPath);
      if (records) {
        insertGraphRecords(store, records);
        indexedSources.push("agent_shared_state");
      } else {
        skippedSources.push("agent_shared_state");
      }
    }
    if (selected.has("curator_enrichment")) {
      const records = buildKnowledgeCuratorGraphRecords(options.knowledgeCuratorEnrichmentPath);
      if (records) {
        insertGraphRecords(store, records);
        indexedSources.push("curator_enrichment");
      } else {
        skippedSources.push("curator_enrichment");
      }
    }

    return {
      graph_db: store.path,
      indexed_sources: indexedSources,
      skipped_sources: skippedSources,
      stats: graphStats(store),
    };
  } finally {
    store.db.close();
  }
}

export function defaultGraphSources(): string[] {
  return [
    "code_graph",
    "past_prs",
    "discord_knowledge",
    "ssbm_data_sheet",
    "powerpc_docs",
    "external_mirrors",
    "resource_guides",
    "reference_docs",
    "tool_outputs",
    "decomp_standards",
    "path_facts",
    "agent_shared_state",
    "curator_enrichment",
  ];
}
