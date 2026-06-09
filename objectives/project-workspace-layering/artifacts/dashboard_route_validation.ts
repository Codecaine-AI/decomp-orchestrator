import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fetchDashboardServer } from "../../../apps/dashboard-server/src/server.ts";

type JsonObject = Record<string, unknown>;

interface RouteResult {
  body?: JsonObject;
  error?: string;
  method: string;
  name: string;
  ok: boolean;
  path: string;
  request?: JsonObject;
  selectedProjectId?: string | null;
  status: number;
  summary: JsonObject | string;
}

const packageRoot = process.cwd();
const tmpRoot = await mkdtemp(join(tmpdir(), "decomp-project-dashboard-"));
const repoRoot = join(tmpRoot, "smoke_repo");
const stateDir = join(tmpRoot, "state");
const graphDbPath = join(tmpRoot, "graph/route-graph.sqlite");
await cp(resolve(packageRoot, "testdata/smoke_repo"), repoRoot, { recursive: true });
await mkdir(resolve(tmpRoot, "graph"), { recursive: true });

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function selectedProjectId(json: JsonObject | null): string | null {
  const direct = asObject(json?.project).id;
  if (typeof direct === "string") return direct;
  const processProject = asObject(asObject(json?.process).project).id;
  if (typeof processProject === "string") return processProject;
  const selected = asObject(json?.selectedProject).id;
  if (typeof selected === "string") return selected;
  return null;
}

function projectQuery(path: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    projectId: "melee",
    usePathOverrides: "true",
    repoRoot,
    stateDir,
    graphDbPath,
    ...extra,
  });
  return `${path}?${params.toString()}`;
}

function projectBody(extra: JsonObject = {}): JsonObject {
  return {
    projectId: "melee",
    usePathOverrides: true,
    repoRoot,
    stateDir,
    graphDbPath,
    processName: "route-project",
    dryRunAgents: true,
    candidateLimit: 1,
    desiredWorkers: 1,
    goalKind: "matched_code_percent",
    goalValue: 100,
    maxWorkers: 1,
    idleSleepMs: 250,
    queueTargetSize: 1,
    queueLowWatermark: 1,
    candidateWindow: 1,
    ...extra,
  };
}

async function call(name: string, method: string, path: string, body?: JsonObject): Promise<RouteResult> {
  const init: RequestInit =
    body === undefined
      ? { method }
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method,
        };
  const response = await fetchDashboardServer(new Request(`http://localhost${path}`, init));
  const text = await response.text();
  let json: JsonObject | null = null;
  try {
    json = JSON.parse(text) as JsonObject;
  } catch {
    json = null;
  }
  return {
    body: json ?? undefined,
    error: json ? stringValue(json.error) || undefined : undefined,
    method,
    name,
    ok: response.ok,
    path,
    request: body,
    selectedProjectId: selectedProjectId(json),
    status: response.status,
    summary: summarize(name, json, text),
  };
}

function parseRunId(init: JsonObject | undefined): string {
  const parsed = asObject(init?.parsed);
  const parsedRun = asObject(parsed.run);
  if (typeof parsedRun.id === "string") return parsedRun.id;
  const stdout = stringValue(init?.stdout);
  if (!stdout) return "";
  try {
    return stringValue(asObject(JSON.parse(stdout).run).id);
  } catch {
    return "";
  }
}

function summarize(name: string, json: JsonObject | null, text: string): JsonObject | string {
  if (!json) return text.slice(0, 500);
  if (name === "config") {
    return {
      defaultProjectId: json.defaultProjectId,
      selectedProject: asObject(json.selectedProject).id,
      availableProjects: asArray(json.availableProjects).map((project) => asObject(project).id),
      defaultRepoRoot: json.defaultRepoRoot,
      defaultStateDir: json.defaultStateDir,
      defaultGraphDbPath: json.defaultGraphDbPath,
    };
  }
  if (name.startsWith("dashboard")) {
    return {
      project: asObject(json.project).id,
      repoRoot: json.repoRoot,
      stateDir: json.stateDir,
      graphDbPath: json.graphDbPath,
      usePathOverrides: json.usePathOverrides,
      runId: asObject(asObject(json.status).run).id ?? null,
      processState: asObject(json.process).state,
    };
  }
  if (name.startsWith("process")) {
    return {
      project: asObject(json.project).id ?? asObject(asObject(json.process).project).id ?? null,
      state: json.state ?? asObject(json.process).state,
      running: json.running ?? asObject(json.process).running,
      reason: json.reason,
      command: json.command ?? asObject(json.process).command,
      graphDbPath: json.graphDbPath ?? asObject(json.process).graphDbPath,
    };
  }
  if (name === "run_init") {
    return {
      project: asObject(json.project).id,
      command: json.command,
      exitCode: json.exitCode,
      runId: parseRunId(json),
      parsedProject: asObject(asObject(json.parsed).project).projectId,
    };
  }
  if (name === "run_details") return { project: asObject(json.project).id, runId: json.runId, stateDir: json.stateDir };
  if (name === "run_checkpoint") return { project: asObject(json.project).id, checkpointRunId: asObject(json.checkpoint).runId, counts: json.counts };
  if (name === "pr_pause" || name === "pr_resume") return { project: asObject(json.project).id, runStatus: asObject(json.run).status };
  if (name.includes("expected_failure")) {
    return {
      project: asObject(json.project).id,
      status: json.status,
      command: json.command ?? json.uiCommand,
      exitCode: numberValue(json.exitCode) ?? numberValue(json.cliExitCode),
      error: json.error,
    };
  }
  return json;
}

function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replaceAll(repoRoot, "<temp_repo>")
      .replaceAll(stateDir, "<temp_state>")
      .replaceAll(graphDbPath, "<temp_graph_db>")
      .replaceAll(tmpRoot, "<temp_root>");
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonObject).map(([key, item]) => [key, scrub(item)]));
  }
  return value;
}

const results: RouteResult[] = [];
let runId = "";

results.push(await call("config", "GET", "/api/config"));
results.push(await call("dashboard_empty", "GET", projectQuery("/api/dashboard")));
results.push(await call("process_empty", "GET", projectQuery("/api/process")));
results.push(await call("run_details_empty", "GET", projectQuery("/api/run/details")));

const init = await call("run_init", "POST", "/api/run/init", projectBody());
results.push(init);
runId = parseRunId(init.body);
if (!runId) throw new Error(`run_init did not return a run id: ${JSON.stringify(init.body)}`);

results.push(await call("dashboard_with_run", "GET", projectQuery("/api/dashboard")));
results.push(await call("run_details", "GET", projectQuery("/api/run/details", { runId })));

const start = await call("process_start", "POST", "/api/process/start", projectBody({ runId }));
results.push(start);
results.push(await call("process_stop_after_start", "POST", "/api/process/stop", projectBody({ recoverLeases: false, runId })));
results.push(await call("process_drain_not_running", "POST", "/api/process/drain", projectBody({ runId })));

results.push(await call("run_checkpoint", "POST", "/api/run/checkpoint", projectBody({ runId })));
results.push(await call("pr_pause", "POST", "/api/pr/pause", projectBody({ runId })));
results.push(await call("pr_resume", "POST", "/api/pr/resume", projectBody({ runId })));
results.push(await call("pr_split_plan_expected_failure", "POST", "/api/pr/split-plan", projectBody({ prBaseRef: "HEAD", prIncludeUntracked: false, runId })));
results.push(await call("pr_qa_expected_failure", "POST", "/api/pr/qa", projectBody({ qaTarget: "changes_all", runId })));
results.push(await call("report_run_expected_failure", "POST", "/api/report/run", projectBody({ resetBaseline: false, runId })));

const checks: Array<[string, (result: RouteResult) => boolean]> = [
  ["config", (result) => result.status === 200 && asObject(result.body?.selectedProject).id === "melee"],
  ["dashboard_empty", (result) => result.status === 200 && result.selectedProjectId === "melee" && asObject(result.body).repoRoot === repoRoot],
  ["process_empty", (result) => result.status === 200 && result.selectedProjectId === "melee"],
  ["run_details_empty", (result) => result.status === 200 && result.selectedProjectId === "melee"],
  ["run_init", (result) => result.status === 200 && asObject(result.body?.project).id === "melee" && asArray(result.body?.command).includes("--project")],
  ["dashboard_with_run", (result) => result.status === 200 && result.selectedProjectId === "melee"],
  ["run_details", (result) => result.status === 200 && result.selectedProjectId === "melee" && result.body?.runId === runId],
  ["process_start", (result) => result.status === 200 && result.selectedProjectId === "melee" && asArray(result.body?.command).includes("--project")],
  ["process_stop_after_start", (result) => result.status === 200 && (result.body?.stopped === true || result.body?.reason === "not_running")],
  ["process_drain_not_running", (result) => result.status === 200 && result.body?.reason === "not_running"],
  ["run_checkpoint", (result) => result.status === 200 && result.selectedProjectId === "melee"],
  ["pr_pause", (result) => result.status === 200 && result.selectedProjectId === "melee" && asObject(result.body?.run).status === "paused"],
  ["pr_resume", (result) => result.status === 200 && result.selectedProjectId === "melee" && asObject(result.body?.run).status === "active"],
  ["pr_split_plan_expected_failure", (result) => result.status === 200 && asArray(result.body?.command).includes("--project")],
  ["pr_qa_expected_failure", (result) => result.status === 200 && asArray(result.body?.uiCommand).includes("--project")],
  ["report_run_expected_failure", (result) => result.status === 500 && stringValue(result.body?.error).includes("generate report failed")],
];

const failures = checks
  .map(([name, predicate]) => {
    const result = results.find((item) => item.name === name);
    return result && predicate(result) ? null : { name, result };
  })
  .filter((item): item is { name: string; result?: RouteResult } => item !== null);

const artifact = {
  schema_version: 1,
  created_at: new Date().toISOString(),
  failures: scrub(failures),
  notes: [
    "Validation uses fetchDashboardServer directly and does not start a listening UI server.",
    "The route body selects projectId=melee and enables explicit temp path overrides so project identity and override precedence are both exercised.",
    "process_start is immediately followed by process_stop_after_start to avoid leaving a managed babysit process running.",
    "pr_qa_expected_failure, pr_split_plan_expected_failure, and report_run_expected_failure use fixture limitations to validate structured route dispatch/failure behavior.",
  ],
  package_root: packageRoot,
  repoRoot,
  stateDir,
  graphDbPath,
  runId,
  results: results.map((result) =>
    scrub({
      method: result.method,
      name: result.name,
      ok: result.ok,
      path: result.path,
      request: result.request,
      selectedProjectId: result.selectedProjectId,
      status: result.status,
      summary: result.summary,
    }),
  ),
  tmpRoot,
};

const artifactPath = resolve(packageRoot, "objectives/project-workspace-layering/artifacts/dashboard_route_validation.json");
await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ artifact: "objectives/project-workspace-layering/artifacts/dashboard_route_validation.json", failures: failures.length, runId }, null, 2));
if (failures.length > 0) process.exit(1);
