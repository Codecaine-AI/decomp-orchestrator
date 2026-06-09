import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { listProjects, resolveProject, type ResolvedProject } from "@decomp-orchestrator/core";

type JsonObject = Record<string, unknown>;

interface MatrixCase {
  actual?: JsonObject;
  error?: string;
  expected: JsonObject;
  input: JsonObject;
  name: string;
  passed: boolean;
}

const packageRoot = process.cwd();
const tmpRoot = await mkdtemp(join(tmpdir(), "decomp-project-resolution-"));
const workspace = resolve(tmpRoot, "workspace");
const projectDir = resolve(workspace, "projects/fixture");
const externalRepo = resolve(tmpRoot, "external-checkout");
const explicitRepo = resolve(tmpRoot, "explicit-checkout");
const explicitState = resolve(tmpRoot, "explicit-state");
const explicitGraph = resolve(tmpRoot, "explicit-graph/graph.sqlite");

await mkdir(projectDir, { recursive: true });
await mkdir(resolve(projectDir, "graph"), { recursive: true });
await mkdir(externalRepo, { recursive: true });
await mkdir(explicitRepo, { recursive: true });
await mkdir(resolve(tmpRoot, "explicit-graph"), { recursive: true });
await writeFile(resolve(workspace, "projects/config.json"), JSON.stringify({ defaultProject: "fixture" }, null, 2));
await writeFile(
  resolve(projectDir, "project.json"),
  JSON.stringify(
    {
      id: "fixture",
      displayName: "Fixture Project",
      kind: "fixture-decomp",
      repoRoot: "./checkout",
      stateDir: "./state",
      graphDb: "./graph/tracked.sqlite",
      processName: "fixture-live",
      baseRef: "origin/main",
      localEnv: "./local.env",
      validation: { qaTarget: "changes_all" },
      dashboard: { candidateLimit: 9, queueTargetSize: 5 },
      pr: { groupMode: "top-dir", maxFilesPerPr: 4 },
    },
    null,
    2,
  ),
);
await writeFile(
  resolve(projectDir, "local.project.json"),
  JSON.stringify(
    {
      repoRoot: externalRepo,
      graphDb: "./graph/local.sqlite",
      processName: "fixture-local",
    },
    null,
    2,
  ),
);

const missingDir = resolve(workspace, "projects/missing-checkout");
await mkdir(missingDir, { recursive: true });
await writeFile(
  resolve(missingDir, "project.json"),
  JSON.stringify({ id: "missing-checkout", repoRoot: "./missing", stateDir: "./state", graphDb: "./graph/graph.sqlite" }, null, 2),
);

function projectSummary(project: ResolvedProject): JsonObject {
  return {
    project_id: project.projectId,
    display_name: project.displayName,
    kind: project.kind,
    repo_root: project.repoRoot,
    state_dir: project.stateDir,
    graph_db: project.graphDbPath,
    process_name: project.processName,
    base_ref: project.baseRef,
    descriptor_path: project.descriptorPath,
    local_override_path: project.localOverridePath ?? null,
    warnings: project.warnings,
  };
}

function endsWith(value: unknown, suffix: string): boolean {
  return typeof value === "string" && value.endsWith(suffix);
}

function record(name: string, input: JsonObject, expected: JsonObject, fn: () => JsonObject, predicate: (actual: JsonObject) => boolean): MatrixCase {
  try {
    const actual = fn();
    return { name, input, expected, actual, passed: predicate(actual) };
  } catch (error) {
    return { name, input, expected, error: error instanceof Error ? error.message : String(error), passed: false };
  }
}

function recordError(name: string, input: JsonObject, expected: JsonObject, fn: () => unknown, predicate: (message: string) => boolean): MatrixCase {
  try {
    fn();
    return { name, input, expected, actual: { unexpected_success: true }, passed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, input, expected, error: message, passed: predicate(message) };
  }
}

const cases: MatrixCase[] = [
  record(
    "local_override_precedence",
    { orchestratorRoot: workspace, projectId: "fixture" },
    { project_id: "fixture", repo_root: externalRepo, graph_db: resolve(projectDir, "graph/local.sqlite"), process_name: "fixture-local" },
    () => projectSummary(resolveProject({ orchestratorRoot: workspace, projectId: "fixture" })),
    (actual) => actual.project_id === "fixture" && actual.repo_root === externalRepo && actual.graph_db === resolve(projectDir, "graph/local.sqlite") && actual.process_name === "fixture-local",
  ),
  record(
    "explicit_override_precedence",
    {
      orchestratorRoot: workspace,
      projectId: "fixture",
      explicitOverrides: { repoRoot: explicitRepo, stateDir: explicitState, graphDb: explicitGraph },
    },
    { repo_root: explicitRepo, state_dir: explicitState, graph_db: explicitGraph },
    () =>
      projectSummary(
        resolveProject({
          orchestratorRoot: workspace,
          projectId: "fixture",
          explicitOverrides: { repoRoot: explicitRepo, stateDir: explicitState, graphDb: explicitGraph },
        }),
      ),
    (actual) => actual.repo_root === explicitRepo && actual.state_dir === explicitState && actual.graph_db === explicitGraph,
  ),
  record(
    "relative_explicit_paths_resolve_from_base_dir",
    {
      orchestratorRoot: workspace,
      projectId: "fixture",
      explicitOverrideBaseDir: tmpRoot,
      explicitOverrides: { repoRoot: "relative-repo", stateDir: "relative-state", graphDb: "relative-graph/db.sqlite" },
    },
    {
      repo_root: resolve(tmpRoot, "relative-repo"),
      state_dir: resolve(tmpRoot, "relative-state"),
      graph_db: resolve(tmpRoot, "relative-graph/db.sqlite"),
    },
    () =>
      projectSummary(
        resolveProject({
          orchestratorRoot: workspace,
          projectId: "fixture",
          explicitOverrideBaseDir: tmpRoot,
          explicitOverrides: { repoRoot: "relative-repo", stateDir: "relative-state", graphDb: "relative-graph/db.sqlite" },
        }),
      ),
    (actual) =>
      actual.repo_root === resolve(tmpRoot, "relative-repo") &&
      actual.state_dir === resolve(tmpRoot, "relative-state") &&
      actual.graph_db === resolve(tmpRoot, "relative-graph/db.sqlite"),
  ),
  record(
    "default_project_from_config",
    { orchestratorRoot: workspace, useDefaultProject: true, projectsConfig: { defaultProject: "fixture" } },
    { project_id: "fixture" },
    () => projectSummary(resolveProject({ orchestratorRoot: workspace, useDefaultProject: true })),
    (actual) => actual.project_id === "fixture",
  ),
  record(
    "missing_checkout_warning",
    { orchestratorRoot: workspace, projectId: "missing-checkout" },
    { warning_contains: "Project checkout does not exist" },
    () => projectSummary(resolveProject({ orchestratorRoot: workspace, projectId: "missing-checkout" })),
    (actual) => Array.isArray(actual.warnings) && actual.warnings.some((warning) => String(warning).includes("Project checkout does not exist")),
  ),
  recordError(
    "invalid_project_id_rejected",
    { orchestratorRoot: workspace, projectId: "../bad" },
    { error_contains: "Invalid project id" },
    () => resolveProject({ orchestratorRoot: workspace, projectId: "../bad" }),
    (message) => message.includes("Invalid project id"),
  ),
  record(
    "actual_melee_project_local_override",
    { orchestratorRoot: packageRoot, projectId: "melee" },
    {
      project_id: "melee",
      repo_root_suffix: "testdata/smoke_repo",
      state_dir_suffix: "projects/melee/state",
      graph_db_suffix: "projects/melee/graph/fixture-graph.sqlite",
      local_override_suffix: "projects/melee/local.project.json",
    },
    () => projectSummary(resolveProject({ orchestratorRoot: packageRoot, projectId: "melee" })),
    (actual) =>
      actual.project_id === "melee" &&
      endsWith(actual.repo_root, "testdata/smoke_repo") &&
      endsWith(actual.state_dir, "projects/melee/state") &&
      endsWith(actual.graph_db, "projects/melee/graph/fixture-graph.sqlite") &&
      endsWith(actual.local_override_path, "projects/melee/local.project.json"),
  ),
  record(
    "actual_project_listing",
    { orchestratorRoot: packageRoot, listProjects: true },
    { includes_project_id: "melee" },
    () => ({ projects: listProjects({ orchestratorRoot: packageRoot }).map((project) => project.id) }),
    (actual) => Array.isArray(actual.projects) && actual.projects.includes("melee"),
  ),
];

const artifact = {
  schema_version: 1,
  created_at: new Date().toISOString(),
  package_root: packageRoot,
  temp_root: tmpRoot,
  cases,
  passed: cases.every((item) => item.passed),
};

const artifactPath = resolve(packageRoot, "objectives/project-workspace-layering/artifacts/project_resolution_matrix.json");
await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ artifact: "objectives/project-workspace-layering/artifacts/project_resolution_matrix.json", cases: cases.length, passed: artifact.passed }, null, 2));
if (!artifact.passed) process.exit(1);
