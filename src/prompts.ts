import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { BoardSnapshot, PiPromptBundle, RunRecord } from "./types.js";

interface DirectorPromptOptions {
  run: RunRecord;
  snapshot: BoardSnapshot;
  event: Record<string, unknown>;
  activeWorkers: number;
  repoRoot: string;
  stateDir: string;
  initialBoardPath: string;
}

interface WorkerPromptOptions {
  packet: Record<string, unknown>;
  repoRoot: string;
  stateDir: string;
  initialBoardPath: string;
  workerLogDir: string;
}

interface TemplateValues {
  CURRENT_STATE_JSON: string;
  FILES_TO_READ_JSON: string;
  RESOURCES_JSON: string;
  PRIMARY_SOURCE_PATH?: string;
}

interface KnowledgePackDefinition {
  path: string;
  role: string;
  purpose: string;
}

interface KnowledgeScriptDefinition {
  path: string;
  purpose: string;
}

interface KnowledgeManifest {
  role_defaults: Record<string, string[]>;
  capability_routes: Record<string, string[]>;
  packs: Record<string, KnowledgePackDefinition>;
  scripts: Record<string, KnowledgeScriptDefinition>;
}

interface KnowledgePackResource extends KnowledgePackDefinition {
  id: string;
  path: string;
}

function promptPath(role: "director" | "worker", name: "system" | "initial_user"): string {
  return fileURLToPath(new URL(`../prompts/${role}/${name}.md`, import.meta.url));
}

function packageRoot(): string {
  return fileURLToPath(new URL("..", import.meta.url));
}

function checkoutRoot(): string {
  return resolve(packageRoot(), "..");
}

function knowledgeRoot(): string {
  return resolve(packageRoot(), "knowledge");
}

function knowledgeManifestPath(): string {
  return resolve(knowledgeRoot(), "manifest.json");
}

function pastPrsRoot(): string {
  return resolve(knowledgeRoot(), "past_prs");
}

function decompResourcesRoot(): string {
  return resolve(knowledgeRoot(), "decomp_resources");
}

function readTemplate(path: string): string {
  return readFileSync(path, "utf8").trimEnd();
}

function readKnowledgeManifest(): KnowledgeManifest {
  return JSON.parse(readFileSync(knowledgeManifestPath(), "utf8")) as KnowledgeManifest;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function render(template: string, values: TemplateValues): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: keyof TemplateValues) => {
    const value = values[key];
    return typeof value === "string" ? value : match;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function enabledCapabilities(packet: Record<string, unknown>): string[] {
  const raw = packet.enabled_capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value));
}

function knowledgePackResources(role: "director" | "worker", capabilities: string[] = []): KnowledgePackResource[] {
  const manifest = readKnowledgeManifest();
  const packIds = [...(manifest.role_defaults[role] ?? [])];
  for (const capability of capabilities) {
    packIds.push(...(manifest.capability_routes[capability] ?? []));
  }
  return uniqueStrings(packIds)
    .map((id) => {
      const pack = manifest.packs[id];
      if (!pack) return null;
      return {
        id,
        role: pack.role,
        purpose: pack.purpose,
        path: resolve(knowledgeRoot(), pack.path),
      };
    })
    .filter((pack): pack is KnowledgePackResource => pack !== null);
}

function knowledgeScripts(): Record<string, KnowledgeScriptDefinition> {
  const manifest = readKnowledgeManifest();
  return Object.fromEntries(
    Object.entries(manifest.scripts).map(([id, script]) => [
      id,
      {
        ...script,
        path: resolve(knowledgeRoot(), script.path),
      },
    ]),
  );
}

function knowledgeSummary(role: "director" | "worker", capabilities: string[] = []): Record<string, unknown> {
  const manifest = readKnowledgeManifest();
  return {
    root: knowledgeRoot(),
    manifest: knowledgeManifestPath(),
    selected_packs: knowledgePackResources(role, capabilities),
    capability_routes: manifest.capability_routes,
    available_packs: Object.fromEntries(
      Object.entries(manifest.packs).map(([id, pack]) => [
        id,
        {
          ...pack,
          path: resolve(knowledgeRoot(), pack.path),
        },
      ]),
    ),
    scripts: knowledgeScripts(),
  };
}

function resourceMap(repoRoot: string, role: "director" | "worker", capabilities: string[] = []): Record<string, unknown> {
  const checkout = checkoutRoot();
  const pastPrs = pastPrsRoot();
  const decompResources = decompResourcesRoot();
  const dataSheetCsvDir = resolve(decompResources, "data_sheets/ssbm_data_sheet_1_02/csv");
  const scripts = knowledgeScripts();
  return {
    roots: {
      board_repo_root: repoRoot,
      checkout_root: checkout,
      orchestrator_package: packageRoot(),
    },
    knowledge: knowledgeSummary(role, capabilities),
    objective: {
      primary_metric: "matched_code_percent",
      telemetry_metric: "fuzzy_match_percent",
      quality_bar: "reviewable Melee decomp source backed by local evidence and verifier output",
    },
    progress_inputs: [
      {
        path: resolve(repoRoot, "build/GALE01/report.json"),
        purpose: "current match metrics, function/unit status, and progress telemetry",
      },
      {
        path: resolve(repoRoot, "objdiff.json"),
        purpose: "unit metadata, source paths, compiler flags, and write-set derivation",
      },
    ],
    target_metadata: [
      {
        path: resolve(repoRoot, "config/GALE01/symbols.txt"),
        purpose: "symbol names and addresses",
      },
      {
        path: resolve(repoRoot, "config/GALE01/splits.txt"),
        purpose: "translation-unit and object ownership boundaries",
      },
      {
        path: resolve(repoRoot, "docs/glossary.md"),
        purpose: "canonical local shorthand and naming conventions",
      },
    ],
    local_context: [
      {
        path: resolve(repoRoot, "src"),
        purpose: "target source, sibling functions, headers, and local naming/style analogs",
      },
      {
        path: resolve(repoRoot, "include"),
        purpose: "project headers and struct/type definitions when present",
      },
    ],
    past_prs: {
      structured_index: {
        path: resolve(pastPrs, "prs/index.jsonl"),
        fields: ["pr", "title", "summary", "searchable_terms", "postmortem_json"],
        purpose: "distilled searchable PR lessons and pointers to per-PR postmortems",
      },
      known_fixes: resolve(pastPrs, "prs/known_fixes.md"),
      raw_analysis: [
        {
          path: resolve(pastPrs, "current/analysis/changed_files.jsonl"),
          purpose: "find PRs that touched a concrete source/config path",
        },
        {
          path: resolve(pastPrs, "current/analysis/text_corpus.jsonl"),
          purpose: "PR bodies, bot reports, comments, and reviews keyed by PR number",
        },
        {
          path: resolve(pastPrs, "current/analysis/human_pr_text.md"),
          purpose: "human-authored PR bodies and issue comments",
        },
        {
          path: resolve(pastPrs, "current/analysis/review_comments.md"),
          purpose: "review feedback, naming corrections, and review warnings",
        },
        {
          path: resolve(pastPrs, "current/analysis/diff_lines.jsonl"),
          purpose: "line-level historical diffs for relevant PRs",
        },
        {
          path: resolve(pastPrs, "current/analysis/decomp_tips_library.md"),
          purpose: "cross-PR matching and review lessons",
        },
      ],
      per_pr_detail_pattern: resolve(pastPrs, "prs/pr-<number>/postmortem.json"),
      search_examples: [
        `rg -n "<symbol>|<source_path>|<subsystem>|<mismatch_term>" "${resolve(pastPrs, "prs/index.jsonl")}" "${resolve(pastPrs, "prs/known_fixes.md")}"`,
        `jq 'select(.file=="<source_path>")' "${resolve(pastPrs, "current/analysis/changed_files.jsonl")}"`,
        `jq 'select(.pr == <number>)' "${resolve(pastPrs, "current/analysis/text_corpus.jsonl")}"`,
        `jq 'select(.pr == <number>)' "${resolve(pastPrs, "current/analysis/diff_lines.jsonl")}"`,
      ],
    },
    decomp_resources: {
      index: resolve(decompResources, "index.md"),
      notes: resolve(decompResources, "guides/resource_notes.md"),
      data_sheet_csv_dir: dataSheetCsvDir,
      data_sheet_csvs: [
        resolve(dataSheetCsvDir, "cells.csv"),
        resolve(dataSheetCsvDir, "sheet_index.csv"),
        resolve(dataSheetCsvDir, "function_addresses.csv"),
        resolve(dataSheetCsvDir, "global_addresses.csv"),
        resolve(dataSheetCsvDir, "char_data_offsets.csv"),
        resolve(dataSheetCsvDir, "character_attributes.csv"),
        resolve(dataSheetCsvDir, "action_state_reference.csv"),
        resolve(dataSheetCsvDir, "hitbox_offsets.csv"),
        resolve(dataSheetCsvDir, "hurtbox_offsets.csv"),
        resolve(dataSheetCsvDir, "stage_data_offsets.csv"),
        resolve(dataSheetCsvDir, "entity_data_offsets.csv"),
        resolve(dataSheetCsvDir, "id_lists.csv"),
        resolve(dataSheetCsvDir, "subaction_events.csv"),
        resolve(dataSheetCsvDir, "bones.csv"),
        resolve(dataSheetCsvDir, "debug_menu_map.csv"),
      ],
      powerpc_index: resolve(decompResources, "documents/powerpc/indexes/powerpc_pdf_pages.csv"),
      external_hint_indexes: [
        resolve(decompResources, "external/training_mode/indexes/gtme01_map_symbols.csv"),
        resolve(decompResources, "external/m_ex/indexes/header_symbols.csv"),
        resolve(decompResources, "external/tockdom/compiler.txt"),
      ],
      trust_rule: "local source, headers, symbols, splits, assembly, and objdiff outrank PR notes and mirrored external resources",
    },
    helper_scripts: [
      {
        path: scripts.decomp_context_lookup.path,
        purpose: "first-pass target packet across local source, report metadata, PR corpus, and decomp resources",
      },
      {
        path: scripts.rank_decomp_candidates.path,
        purpose: "director target ranking from build/GALE01/report.json",
      },
      {
        path: scripts.scaffold_decomp_run.path,
        purpose: "create a reproducible decomp-runs/<slug> sweep bundle",
      },
      {
        path: scripts.analyze_sweep_results.path,
        purpose: "analyze sweep results and write next-sweep plans",
      },
      {
        path: scripts.render_progress_charts.path,
        purpose: "render sweep progress charts",
      },
      {
        path: scripts.fetch_recent_pr_dump.path,
        purpose: "refresh the orchestrator-owned raw PR dump and searchable PR library",
      },
      {
        path: scripts.build_pr_postmortems.path,
        purpose: "build or rerun PR postmortem knowledge records",
      },
      {
        path: scripts.sync_repo_and_pr_library.path,
        purpose: "sync the repo branch and PR knowledge library in one operator workflow",
      },
    ],
    commands: [
      {
        command: "rg <pattern> <paths>",
        purpose: "fast repo search",
      },
      {
        command: `python3 "${scripts.rank_decomp_candidates.path}" --limit 30`,
        cwd: repoRoot,
        purpose: "rank candidate functions and linked blocker units for director scheduling",
      },
      {
        command: `python3 "${scripts.decomp_context_lookup.path}" --target <source_path> --symbol <symbol>`,
        purpose: "assemble first-pass local, PR, and resource evidence",
      },
      {
        command: `python3 "${scripts.scaffold_decomp_run.path}" --name <run-slug> --source <source_path> --symbol <symbol>`,
        cwd: repoRoot,
        purpose: "scaffold a decomp-runs bundle for sweep_batches work",
      },
      {
        command: `rg -i "<offset>|<address>|<field>|<action_state>|<hitbox>|<sfx>" "${dataSheetCsvDir}"`,
        purpose: "search data-sheet offsets, IDs, states, attributes, and lookup terms",
      },
      {
        command: `rg -n "<symbol>|<file>|<mismatch_term>" "${resolve(pastPrs, "prs/index.jsonl")}" "${resolve(pastPrs, "current/analysis")}"`,
        purpose: "search past PR summaries, comments, reviews, and diffs",
      },
      {
        command: "bun run pr:refresh:dry",
        cwd: packageRoot(),
        purpose: "preview the PR knowledge refresh scope without writing",
      },
      {
        command: "bun run pr:refresh -- --postmortem-mode scaffold",
        cwd: packageRoot(),
        purpose: "refresh missing recent PRs and rebuild deterministic PR knowledge records",
      },
      {
        command: "bun run pr:postmortems -- --dump-root knowledge/past_prs/current --run-agent --rerun-existing --jobs 16",
        cwd: packageRoot(),
        purpose: "rerun Pi-reviewed PR postmortems for the orchestrator-owned PR dump",
      },
      {
        command: "python configure.py --require-protos",
        purpose: "regenerate build metadata with prototype checks when needed",
      },
      {
        command: "ninja build/GALE01/<object>.o",
        purpose: "narrow object rebuild for the leased source file",
      },
      {
        command: "build/tools/objdiff-cli diff -p . -u <unit> <symbol>",
        purpose: "narrow symbol/unit diff validation",
      },
      {
        command: "go run . dups",
        cwd: resolve(repoRoot, "tools/table-typer"),
        purpose: "duplicate assembly-shape evidence for adaptation targets",
      },
    ],
  };
}

export function directorPrompt(options: DirectorPromptOptions): PiPromptBundle {
  const systemTemplatePath = promptPath("director", "system");
  const userTemplatePath = promptPath("director", "initial_user");
  const selectedKnowledgePacks = knowledgePackResources("director");
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
    {
      path: knowledgeManifestPath(),
      reason: "orchestrator-owned agent knowledge manifest and capability routing",
    },
    ...selectedKnowledgePacks.map((pack) => ({
      path: pack.path,
      reason: `director knowledge pack: ${pack.purpose}`,
    })),
  ];
  const currentState = {
    role: "director",
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
    artifact_paths: {
      initial_board: options.initialBoardPath,
      director_cycles_dir: resolve(options.stateDir, "runs", options.run.id, "director_cycles"),
    },
    selected_knowledge_packs: selectedKnowledgePacks,
  };
  const values = {
    CURRENT_STATE_JSON: stableJson(currentState),
    FILES_TO_READ_JSON: stableJson(filesToRead),
    RESOURCES_JSON: stableJson(resourceMap(options.repoRoot, "director")),
  };
  return {
    systemPrompt: render(readTemplate(systemTemplatePath), values),
    userPrompt: render(readTemplate(userTemplatePath), values),
    systemTemplatePath,
    userTemplatePath,
  };
}

export function workerPrompt(options: WorkerPromptOptions): PiPromptBundle {
  const systemTemplatePath = promptPath("worker", "system");
  const userTemplatePath = promptPath("worker", "initial_user");
  const target = (options.packet.target ?? {}) as Record<string, unknown>;
  const primarySourcePath = String(target.source_path ?? "");
  const primarySourceAbs = primarySourcePath ? resolve(options.repoRoot, primarySourcePath) : "";
  const capabilities = enabledCapabilities(options.packet);
  const selectedKnowledgePacks = knowledgePackResources("worker", capabilities);
  const filesToRead = [
    {
      path: primarySourceAbs,
      reason: "primary leased source file",
    },
    {
      path: resolve(options.repoRoot, "objdiff.json"),
      reason: "unit metadata, compiler flags, source path, and scratch provenance",
    },
    {
      path: resolve(options.repoRoot, "build/GALE01/report.json"),
      reason: "baseline function/unit metrics",
    },
    {
      path: options.initialBoardPath,
      reason: "run board snapshot used to queue this target",
    },
    {
      path: resolve(decompResourcesRoot(), "index.md"),
      reason: "resource library entry point and trust rules",
    },
    {
      path: resolve(pastPrsRoot(), "prs/index.jsonl"),
      reason: "structured searchable past-PR index",
    },
    {
      path: knowledgeManifestPath(),
      reason: "orchestrator-owned agent knowledge manifest and capability routing",
    },
    ...selectedKnowledgePacks.map((pack) => ({
      path: pack.path,
      reason: `worker knowledge pack: ${pack.purpose}`,
    })),
  ];
  const currentState = {
    role: "worker",
    state_dir: options.stateDir,
    worker_log_dir: options.workerLogDir,
    selected_knowledge_packs: selectedKnowledgePacks,
    ...options.packet,
  };
  const values = {
    CURRENT_STATE_JSON: stableJson(currentState),
    PRIMARY_SOURCE_PATH: primarySourcePath,
    FILES_TO_READ_JSON: stableJson(filesToRead),
    RESOURCES_JSON: stableJson(resourceMap(options.repoRoot, "worker", capabilities)),
  };
  return {
    systemPrompt: render(readTemplate(systemTemplatePath), values),
    userPrompt: render(readTemplate(userTemplatePath), values),
    systemTemplatePath,
    userTemplatePath,
  };
}
