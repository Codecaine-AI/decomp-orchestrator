import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decompResourcesRoot, resourceMap } from "@decomp-orchestrator/knowledge";
import type { BoardSnapshot, PiPromptBundle, RunProjectMetadata, RunRecord } from "@decomp-orchestrator/core/types";
import { agentContextScripts, agentContextSummary } from "../context.js";
import { readTemplate, renderTemplate, stableJson } from "../runtime/index.js";

export interface DirectorPromptOptions {
  run: RunRecord;
  snapshot: BoardSnapshot;
  event: Record<string, unknown>;
  activeWorkers: number;
  repoRoot: string;
  stateDir: string;
  project?: RunProjectMetadata;
  initialBoardPath: string;
  queuePressure?: Record<string, unknown>;
}

function templatePath(name: "system" | "initial_user"): string {
  return fileURLToPath(new URL(`./templates/${name}.md`, import.meta.url));
}

export function directorPrompt(options: DirectorPromptOptions): PiPromptBundle {
  const systemTemplatePath = templatePath("system");
  const userTemplatePath = templatePath("initial_user");
  const filesToRead = [
    {
      path: options.initialBoardPath,
      reason: "initial board snapshot captured at run creation",
    },
    {
      path: options.snapshot.reportPath,
      reason: "current progress report and matched_code_percent telemetry",
    },
    {
      path: options.snapshot.objdiffPath,
      reason: "unit metadata and source path provenance",
    },
    {
      path: resolve(decompResourcesRoot(), "index.md"),
      reason: "resource library entry point for decomp evidence surfaces",
    },
  ];
  const currentState = {
    role: "director",
    project: options.project ?? null,
    run: options.run,
    wake_event: options.event,
    active_workers: options.activeWorkers,
    desired_workers: options.run.desiredWorkers,
    state_dir: options.stateDir,
    board: {
      generated_at: options.snapshot.generatedAt,
      measures: options.snapshot.measures,
      top_candidates: options.snapshot.candidates.slice(0, 12),
    },
    queue_pressure: options.queuePressure ?? null,
    artifact_paths: {
      initial_board: options.initialBoardPath,
      director_cycles_dir: resolve(options.stateDir, "runs", options.run.id, "director_cycles"),
    },
  };
  const values = {
    CURRENT_STATE_JSON: stableJson(currentState),
    FILES_TO_READ_JSON: stableJson(filesToRead),
    RESOURCES_JSON: stableJson(
      resourceMap(options.repoRoot, {
        agentContext: agentContextSummary("director"),
        project: options.project,
        scripts: agentContextScripts(),
      }),
    ),
  };
  return {
    systemPrompt: renderTemplate(readTemplate(systemTemplatePath), values),
    userPrompt: renderTemplate(readTemplate(userTemplatePath), values),
    systemTemplatePath,
    userTemplatePath,
  };
}
