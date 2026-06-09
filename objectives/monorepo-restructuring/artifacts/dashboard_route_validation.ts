import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fetchDashboardServer } from "../../../apps/dashboard-server/src/server.ts";

type JsonObject = Record<string, unknown>;

interface RouteResult {
  json: JsonObject | null;
  method: string;
  name: string;
  ok: boolean;
  path: string;
  status: number;
  text?: string;
}

const packageRoot = process.cwd();
const tmpRoot = await mkdtemp(join(tmpdir(), "decomp-dashboard-routes-"));
const repoRoot = join(tmpRoot, "smoke_repo");
const stateDir = join(tmpRoot, "state");
await cp(resolve(packageRoot, "testdata/smoke_repo"), repoRoot, { recursive: true });

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
    json,
    method,
    name,
    ok: response.ok,
    path,
    status: response.status,
    text: json ? undefined : text.slice(0, 500),
  };
}

function qs(path: string): string {
  const params = new URLSearchParams({ repoRoot, stateDir });
  return `${path}?${params.toString()}`;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function jsonString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function jsonNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

const results: RouteResult[] = [];
results.push(await call("static_root", "GET", "/"));
results.push(await call("config", "GET", "/api/config"));
results.push(await call("dashboard_empty", "GET", qs("/api/dashboard")));
results.push(await call("process_empty", "GET", qs("/api/process")));
results.push(await call("run_details_empty", "GET", qs("/api/run/details")));

const initBody = {
  candidateLimit: 1,
  desiredWorkers: 1,
  dryRunAgents: true,
  goalKind: "matched_code_percent",
  goalValue: 100,
  repoRoot,
  stateDir,
};
const init = await call("run_init", "POST", "/api/run/init", initBody);
results.push(init);
if (!init.ok) throw new Error(`run_init failed: ${init.status} ${JSON.stringify(init.json)}`);
const initStdout = JSON.parse(jsonString(init.json?.stdout));
const runId = jsonString(asObject(initStdout.run).id);
if (!runId) throw new Error("run_init did not return a run id");

results.push(await call("dashboard_with_run", "GET", qs("/api/dashboard")));
results.push(await call("run_details", "GET", `${qs("/api/run/details")}&runId=${encodeURIComponent(runId)}`));
results.push(await call("process_drain_not_running", "POST", "/api/process/drain", { processName: "route-smoke", repoRoot, runId, stateDir }));
results.push(await call("process_stop_not_running", "POST", "/api/process/stop", { processName: "route-smoke", recoverLeases: false, repoRoot, runId, stateDir }));
results.push(await call("run_checkpoint", "POST", "/api/run/checkpoint", { repoRoot, runId, stateDir }));
results.push(await call("pr_pause", "POST", "/api/pr/pause", { processName: "route-smoke", repoRoot, runId, stateDir }));
results.push(await call("pr_resume", "POST", "/api/pr/resume", { repoRoot, runId, stateDir }));
results.push(await call("pr_split_plan_expected_failure", "POST", "/api/pr/split-plan", { prBaseRef: "HEAD", prIncludeUntracked: false, repoRoot, runId, stateDir }));
results.push(await call("pr_qa_expected_failure", "POST", "/api/pr/qa", { qaTarget: "changes_all", repoRoot, runId, stateDir }));
results.push(await call("report_run_expected_failure", "POST", "/api/report/run", { repoRoot, resetBaseline: false, stateDir }));

const checks: Array<[string, (result: RouteResult) => boolean]> = [
  ["static_root", (result) => result.status === 200 && (result.text ?? "").includes("/assets/")],
  ["config", (result) => result.status === 200 && result.json?.packageRoot === packageRoot],
  ["dashboard_empty", (result) => result.status === 200 && result.json?.repoRoot === repoRoot && result.json?.stateDir === stateDir],
  ["process_empty", (result) => result.status === 200 && result.json?.state === "idle"],
  ["run_details_empty", (result) => result.status === 200 && result.json !== null],
  ["run_init", (result) => result.status === 200 && result.json?.exitCode === 0],
  ["dashboard_with_run", (result) => result.status === 200 && asObject(asObject(result.json?.status).run).id === runId],
  [
    "run_details",
    (result) =>
      result.status === 200 &&
      (result.json?.runId === runId || asObject(asObject(result.json?.status).run).id === runId),
  ],
  ["process_drain_not_running", (result) => result.status === 200 && result.json?.reason === "not_running"],
  ["process_stop_not_running", (result) => result.status === 200 && result.json?.reason === "not_running"],
  ["run_checkpoint", (result) => result.status === 200 && asObject(result.json?.checkpoint).runId === runId],
  ["pr_pause", (result) => result.status === 200 && result.json?.paused === true && asObject(result.json?.run).status === "paused"],
  ["pr_resume", (result) => result.status === 200 && result.json?.resumed === true && asObject(result.json?.run).status === "active"],
  ["pr_split_plan_expected_failure", (result) => result.status === 200 && result.json?.status === "failed" && Array.isArray(result.json?.command)],
  ["pr_qa_expected_failure", (result) => result.status === 200 && result.json?.status === "failed" && Array.isArray(result.json?.uiCommand)],
  [
    "report_run_expected_failure",
    (result) => result.status === 500 && jsonString(result.json?.error).includes("generate report failed"),
  ],
];

function scrubPath(path: string): string {
  return path.replaceAll(repoRoot, "<temp_repo>").replaceAll(stateDir, "<temp_state>");
}

function summarize(result: RouteResult): JsonObject | string {
  const json = result.json;
  if (!json) return result.text ?? "";
  if (result.name === "run_init") return { exitCode: json.exitCode, runId };
  if (result.name === "dashboard_with_run") return { processState: asObject(json.process).state, runId: asObject(asObject(json.status).run).id };
  if (result.name === "dashboard_empty") return { processState: asObject(json.process).state, runs: asObject(json.status).runs };
  if (result.name === "run_details") return { runId: json.runId, statusRunId: asObject(asObject(json.status).run).id };
  if (result.name === "run_checkpoint") return { checkpointRunId: asObject(json.checkpoint).runId, counts: json.counts };
  if (result.name === "pr_pause" || result.name === "pr_resume") return { runStatus: asObject(json.run).status };
  if (result.name.includes("expected_failure")) {
    return {
      command: json.command ?? json.uiCommand,
      error: json.error,
      exitCode: jsonNumber(json.exitCode) ?? jsonNumber(json.cliExitCode),
      status: json.status,
    };
  }
  if (result.name === "report_run_expected_failure") return { error: json.error };
  return json;
}

const failures = checks
  .map(([name, predicate]) => {
    const result = results.find((item) => item.name === name);
    return result && predicate(result) ? null : { name, result };
  })
  .filter((item): item is { name: string; result?: RouteResult } => item !== null);

const artifact = {
  schema_version: 1,
  created_at: new Date().toISOString(),
  failures,
  notes: [
    "Validation uses fetchDashboardServer directly and does not start a UI server.",
    "report_run_expected_failure uses a temporary fixture copy because the route removes report outputs before invoking ninja.",
    "pr_qa_expected_failure and pr_split_plan_expected_failure are expected fixture failures that prove route dispatch and structured failure behavior.",
  ],
  repoRoot,
  results: results.map((result) => ({
    method: result.method,
    name: result.name,
    ok: result.ok,
    path: scrubPath(result.path),
    status: result.status,
    summary: summarize(result),
  })),
  runId,
  stateDir,
  tmpRoot,
};

const artifactPath = resolve(packageRoot, "objectives/monorepo-restructuring/artifacts/dashboard_route_validation.json");
await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ artifact: "objectives/monorepo-restructuring/artifacts/dashboard_route_validation.json", failures: failures.length, runId }, null, 2));
if (failures.length > 0) process.exit(1);
