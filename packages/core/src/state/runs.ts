import { randomUUID } from "node:crypto";
import type { RunProjectMetadata, RunRecord, RunStatus } from "../types/index.js";
import { immediateTransaction, now, withBusyRetry, type StateStore } from "./db.js";
import { insertEvent } from "./events.js";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function projectFromRow(row: Record<string, unknown>): RunProjectMetadata | undefined {
  const project: RunProjectMetadata = {
    projectId: optionalString(row.project_id),
    projectKind: optionalString(row.project_kind),
    repoRoot: optionalString(row.project_repo_root),
    stateDir: optionalString(row.project_state_dir),
    graphDbPath: optionalString(row.project_graph_db),
    descriptorPath: optionalString(row.project_descriptor_path),
    localOverridePath: optionalString(row.project_local_override_path),
  };
  return Object.values(project).some(Boolean) ? project : undefined;
}

function runFromRow(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    goalKind: String(row.goal_kind),
    goalValue: Number(row.goal_value),
    desiredWorkers: Number(row.desired_workers),
    status: row.status as RunRecord["status"],
    createdAt: String(row.created_at),
    project: projectFromRow(row),
  };
}

export function createRun(
  store: StateStore,
  goalKind: string,
  goalValue: number,
  desiredWorkers: number,
  project?: RunProjectMetadata,
): RunRecord {
  const run: RunRecord = {
    id: randomUUID(),
    goalKind,
    goalValue,
    desiredWorkers,
    status: "active",
    createdAt: now(),
    project: Object.values(project ?? {}).some(Boolean) ? project : undefined,
  };
  immediateTransaction(store.db, () => {
    store.db
      .query(
        `
          INSERT INTO runs (
            id,
            goal_kind,
            goal_value,
            desired_workers,
            status,
            created_at,
            project_id,
            project_kind,
            project_repo_root,
            project_state_dir,
            project_graph_db,
            project_descriptor_path,
            project_local_override_path
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        run.id,
        run.goalKind,
        run.goalValue,
        run.desiredWorkers,
        run.status,
        run.createdAt,
        run.project?.projectId ?? null,
        run.project?.projectKind ?? null,
        run.project?.repoRoot ?? null,
        run.project?.stateDir ?? null,
        run.project?.graphDbPath ?? null,
        run.project?.descriptorPath ?? null,
        run.project?.localOverridePath ?? null,
      );
    insertEvent(store, run.id, "run_started", "runner", {
      desired_workers: desiredWorkers,
      goal_kind: goalKind,
      goal_value: goalValue,
      project: run.project ?? null,
    });
  });
  return run;
}

const runSelectColumns = `
  id,
  goal_kind,
  goal_value,
  desired_workers,
  status,
  created_at,
  project_id,
  project_kind,
  project_repo_root,
  project_state_dir,
  project_graph_db,
  project_descriptor_path,
  project_local_override_path
`;

export function getLatestRun(store: StateStore): RunRecord | null {
  const row = withBusyRetry(
    () =>
      store.db
        .query(`SELECT ${runSelectColumns} FROM runs ORDER BY created_at DESC LIMIT 1`)
        .get() as Record<string, unknown> | undefined,
  );
  if (!row) return null;
  return runFromRow(row);
}

export function getRun(store: StateStore, runId: string): RunRecord | null {
  const row = withBusyRetry(
    () =>
      store.db
        .query(`SELECT ${runSelectColumns} FROM runs WHERE id = ?`)
        .get(runId) as Record<string, unknown> | undefined,
  );
  return row ? runFromRow(row) : null;
}

export function updateRunStatus(store: StateStore, runId: string, status: RunStatus, producer = "operator"): RunRecord {
  const run = getRun(store, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  if (run.status === status) return run;
  immediateTransaction(store.db, () => {
    const changedAt = now();
    store.db.query("UPDATE runs SET status = ? WHERE id = ?").run(status, runId);
    store.db
      .query("INSERT INTO events (id, run_id, event_type, producer, payload_json, handled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        randomUUID(),
        runId,
        "run_status_changed",
        producer,
        JSON.stringify({
          previous_status: run.status,
          status,
        }),
        changedAt,
        changedAt,
      );
  });
  return { ...run, status };
}
