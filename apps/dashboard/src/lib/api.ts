import type { Dashboard, FormState, JsonObject, RunDetails, UiConfig } from "@decomp-orchestrator/ui-contract";

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as JsonObject;
  if (!response.ok) throw new Error(String(data.error || response.statusText));
  return data as T;
}

export function dashboardParams(form: Pick<FormState, "projectId" | "usePathOverrides" | "repoRoot" | "stateDir" | "graphDbPath">): URLSearchParams {
  const params = new URLSearchParams();
  if (form.projectId) params.set("projectId", form.projectId);
  if (form.usePathOverrides) {
    params.set("usePathOverrides", "true");
    params.set("repoRoot", form.repoRoot);
    params.set("stateDir", form.stateDir);
    params.set("graphDbPath", form.graphDbPath);
  }
  return params;
}

export function formBody(form: FormState, dashboard: Dashboard | null): JsonObject {
  const run = (dashboard?.status?.run || {}) as JsonObject;
  const body: JsonObject = {
    ...form,
    runId: String(run.id || ""),
  };
  if (!form.usePathOverrides) {
    delete body.repoRoot;
    delete body.stateDir;
    delete body.graphDbPath;
  }
  return body;
}

export function loadConfig(): Promise<UiConfig> {
  return fetchJson<UiConfig>("/api/config");
}

export function fetchDashboard(form: Pick<FormState, "projectId" | "usePathOverrides" | "repoRoot" | "stateDir" | "graphDbPath">): Promise<Dashboard> {
  return fetchJson<Dashboard>(`/api/dashboard?${dashboardParams(form)}`);
}

export function fetchRunDetails(form: Pick<FormState, "projectId" | "usePathOverrides" | "repoRoot" | "stateDir" | "graphDbPath">, runId: string): Promise<RunDetails> {
  return fetchJson<RunDetails>(`/api/run/details?${new URLSearchParams({ ...Object.fromEntries(dashboardParams(form)), runId })}`);
}

export function postJson<T>(url: string, body: JsonObject): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
