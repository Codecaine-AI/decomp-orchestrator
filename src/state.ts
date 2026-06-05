import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import type { BoardSnapshot, EventType, PiRole, PiSessionStatus, RunRecord, TargetCandidate, WorkerReportType } from "./types.js";

export interface StateStore {
  db: Database;
  stateDir: string;
}

export interface LeasedTarget {
  leaseId: string;
  queueId: string;
  workerId: string;
  targetId: string;
  target: Record<string, unknown>;
  writeSet: string[];
  ttl: string;
}

export interface ActiveLeaseRecord {
  leaseId: string;
  queueId: string;
  workerId: string;
  baseRev: string;
  ttl: string;
  heartbeatAt: string;
  targetId: string;
  target: Record<string, unknown>;
  writeSet: string[];
}

const SQLITE_BUSY_RETRY_ATTEMPTS = 8;
const SQLITE_BUSY_RETRY_BASE_MS = 25;
const SQLITE_BUSY_TIMEOUT_MS = 30_000;

function now(): string {
  return new Date().toISOString();
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("database is locked") || message.includes("SQLITE_BUSY") || message.includes("SQLITE_LOCKED");
}

function withBusyRetry<T>(operation: () => T): T {
  let attempt = 0;
  for (;;) {
    try {
      return operation();
    } catch (error) {
      if (!isBusyError(error) || attempt >= SQLITE_BUSY_RETRY_ATTEMPTS) throw error;
      const backoff = SQLITE_BUSY_RETRY_BASE_MS * 2 ** attempt;
      const jitter = Math.floor(Math.random() * SQLITE_BUSY_RETRY_BASE_MS);
      sleepSync(backoff + jitter);
      attempt += 1;
    }
  }
}

function immediateTransaction<T>(db: Database, operation: () => T): T {
  return withBusyRetry(() => {
    let began = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      began = true;
      const result = operation();
      db.exec("COMMIT");
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // Preserve the original SQLite error; rollback failures are secondary.
        }
      }
      throw error;
    }
  });
}

function runFromRow(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    goalKind: String(row.goal_kind),
    goalValue: Number(row.goal_value),
    desiredWorkers: Number(row.desired_workers),
    status: row.status as RunRecord["status"],
    createdAt: String(row.created_at),
  };
}

function writeSetHash(writeSet: string[]): string {
  return createHash("sha256").update(JSON.stringify(writeSet)).digest("hex");
}

function workerWakeEvent(reportType: WorkerReportType): EventType {
  if (reportType === "needs_fact") return "needs_fact";
  if (reportType === "score_candidate") return "score_candidate";
  if (reportType === "progress") return "worker_finished";
  return "worker_stalled";
}

function releasedLeaseStatus(reportType: WorkerReportType): string {
  if (reportType === "progress" || reportType === "score_candidate") return "released_complete";
  if (reportType === "needs_fact") return "released_needs_fact";
  return "released_stalled";
}

export function openState(stateDir: string): StateStore {
  mkdirSync(stateDir, { recursive: true });
  const dbPath = resolve(stateDir, "orchestrator.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  configureConnection(db);
  withBusyRetry(() => ensureSchema(db));
  return { db, stateDir };
}

function configureConnection(db: Database): void {
  withBusyRetry(() => {
    db.run(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    db.run("PRAGMA foreign_keys = ON");
    db.run("PRAGMA temp_store = MEMORY");
    db.run("PRAGMA wal_autocheckpoint = 1000");
  });
}

function ensureSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      goal_kind TEXT NOT NULL,
      goal_value REAL NOT NULL,
      baseline_report_sha TEXT,
      current_report_sha TEXT,
      desired_workers INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS director_cycles (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      trigger_event TEXT NOT NULL,
      active_workers INTEGER NOT NULL DEFAULT 0,
      summary_path TEXT,
      decision_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pi_sessions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      lease_id TEXT,
      role TEXT NOT NULL,
      session_id TEXT NOT NULL,
      session_file TEXT,
      provider TEXT,
      model TEXT,
      thinking_level TEXT,
      status TEXT NOT NULL,
      output_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      unit TEXT NOT NULL,
      symbol TEXT NOT NULL,
      source_path TEXT,
      size INTEGER NOT NULL,
      fuzzy REAL NOT NULL,
      matched REAL,
      complete REAL,
      risk TEXT,
      status TEXT NOT NULL,
      priority REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      priority REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      leased_at TEXT
    );

    CREATE TABLE IF NOT EXISTS leases (
      id TEXT PRIMARY KEY,
      queue_id TEXT,
      worker_id TEXT,
      base_rev TEXT,
      write_set_hash TEXT,
      worktree_path TEXT,
      ttl TEXT,
      heartbeat_at TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_locks (
      path TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL,
      lock_mode TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS worker_reports (
      id TEXT PRIMARY KEY,
      lease_id TEXT,
      report_type TEXT NOT NULL,
      summary_path TEXT,
      facts_path TEXT,
      blocker_path TEXT,
      patch_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      lease_id TEXT,
      target_id TEXT,
      artifact_path TEXT,
      compiled INTEGER NOT NULL DEFAULT 0,
      old_score REAL,
      new_score REAL,
      delta REAL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      fact_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      evidence_path TEXT,
      confidence REAL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      producer TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      handled_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      attempt_id TEXT,
      base_rev TEXT,
      patch_path TEXT,
      validation_path TEXT,
      old_matched_code_percent REAL,
      new_matched_code_percent REAL,
      status TEXT NOT NULL,
      integrated_rev TEXT
    );
  `);
}

export function createRun(store: StateStore, goalKind: string, goalValue: number, desiredWorkers: number): RunRecord {
  const run: RunRecord = {
    id: randomUUID(),
    goalKind,
    goalValue,
    desiredWorkers,
    status: "active",
    createdAt: now(),
  };
  immediateTransaction(store.db, () => {
    store.db
      .query("INSERT INTO runs (id, goal_kind, goal_value, desired_workers, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(run.id, run.goalKind, run.goalValue, run.desiredWorkers, run.status, run.createdAt);
    insertEvent(store, run.id, "run_started", "runner", {
      desired_workers: desiredWorkers,
      goal_kind: goalKind,
      goal_value: goalValue,
    });
  });
  return run;
}

export function getLatestRun(store: StateStore): RunRecord | null {
  const row = withBusyRetry(
    () =>
      store.db
        .query("SELECT id, goal_kind, goal_value, desired_workers, status, created_at FROM runs ORDER BY created_at DESC LIMIT 1")
        .get() as Record<string, unknown> | undefined,
  );
  if (!row) return null;
  return runFromRow(row);
}

export function getRun(store: StateStore, runId: string): RunRecord | null {
  const row = withBusyRetry(
    () =>
      store.db
        .query("SELECT id, goal_kind, goal_value, desired_workers, status, created_at FROM runs WHERE id = ?")
        .get(runId) as Record<string, unknown> | undefined,
  );
  return row ? runFromRow(row) : null;
}

export function addBoardTargets(store: StateStore, runId: string, snapshot: BoardSnapshot): number {
  const insertTarget = store.db.query(
    "INSERT INTO targets (id, run_id, unit, symbol, source_path, size, fuzzy, status, priority, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertQueue = store.db.query(
    "INSERT INTO queue (id, run_id, target_id, priority, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const createdAt = now();
  return immediateTransaction(store.db, () => {
    let count = 0;
    for (const candidate of snapshot.candidates) {
      const targetId = randomUUID();
      insertTarget.run(
        targetId,
        runId,
        candidate.unit,
        candidate.symbol,
        candidate.sourcePath,
        candidate.size,
        candidate.fuzzy,
        "queued",
        candidate.priority,
        candidate.reason,
        createdAt,
      );
      insertQueue.run(randomUUID(), runId, targetId, candidate.priority, candidate.reason, "queued", createdAt);
      count += 1;
    }
    return count;
  });
}

export function prioritizeQueuedTargets(store: StateStore, runId: string, candidates: TargetCandidate[]): number {
  const selectTarget = store.db.query(
    "SELECT id, status FROM targets WHERE run_id = ? AND unit = ? AND symbol = ? ORDER BY created_at ASC LIMIT 1",
  );
  const selectQueue = store.db.query("SELECT id, status, priority FROM queue WHERE run_id = ? AND target_id = ? ORDER BY created_at ASC LIMIT 1");
  const insertTarget = store.db.query(
    "INSERT INTO targets (id, run_id, unit, symbol, source_path, size, fuzzy, status, priority, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertQueue = store.db.query(
    "INSERT INTO queue (id, run_id, target_id, priority, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const updateTarget = store.db.query(
    "UPDATE targets SET source_path = ?, size = ?, fuzzy = ?, priority = ?, reason = ? WHERE id = ?",
  );
  const updateQueue = store.db.query("UPDATE queue SET priority = ?, reason = ? WHERE id = ? AND status = 'queued'");
  const createdAt = now();

  return immediateTransaction(store.db, () => {
    let count = 0;
    for (const candidate of candidates) {
      const existingTarget = selectTarget.get(runId, candidate.unit, candidate.symbol) as Record<string, unknown> | undefined;
      if (existingTarget) {
        const targetId = String(existingTarget.id);
        const existingQueue = selectQueue.get(runId, targetId) as Record<string, unknown> | undefined;
        const existingPriority = Number(existingQueue?.priority ?? Number.NEGATIVE_INFINITY);
        if (candidate.priority <= existingPriority) continue;

        updateTarget.run(candidate.sourcePath, candidate.size, candidate.fuzzy, candidate.priority, candidate.reason, targetId);
        if (existingQueue?.status === "queued") {
          updateQueue.run(candidate.priority, candidate.reason, String(existingQueue.id));
          count += 1;
        }
        continue;
      }

      const targetId = randomUUID();
      insertTarget.run(
        targetId,
        runId,
        candidate.unit,
        candidate.symbol,
        candidate.sourcePath,
        candidate.size,
        candidate.fuzzy,
        "queued",
        candidate.priority,
        candidate.reason,
        createdAt,
      );
      insertQueue.run(randomUUID(), runId, targetId, candidate.priority, candidate.reason, "queued", createdAt);
      count += 1;
    }
    return count;
  });
}

function insertEvent(store: StateStore, runId: string, eventType: EventType, producer: string, payload: unknown): string {
  const id = randomUUID();
  store.db
    .query("INSERT INTO events (id, run_id, event_type, producer, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, runId, eventType, producer, JSON.stringify(payload), now());
  return id;
}

export function addEvent(store: StateStore, runId: string, eventType: EventType, producer: string, payload: unknown): string {
  return immediateTransaction(store.db, () => insertEvent(store, runId, eventType, producer, payload));
}

export function nextUnhandledEvent(store: StateStore, runId: string): Record<string, unknown> | null {
  return (
    withBusyRetry(
      () =>
        store.db
          .query("SELECT * FROM events WHERE run_id = ? AND handled_at IS NULL ORDER BY created_at ASC LIMIT 1")
          .get(runId) as Record<string, unknown> | undefined,
    ) ?? null
  );
}

export function markEventHandled(store: StateStore, eventId: string): void {
  immediateTransaction(store.db, () => {
    store.db.query("UPDATE events SET handled_at = ? WHERE id = ?").run(now(), eventId);
  });
}

export function activeWorkerCount(store: StateStore, runId: string): number {
  const row = withBusyRetry(
    () =>
      store.db
        .query(
          "SELECT COUNT(*) AS count FROM leases JOIN queue ON leases.queue_id = queue.id WHERE queue.run_id = ? AND leases.status = 'active'",
        )
        .get(runId) as Record<string, unknown>,
  );
  return Number(row.count ?? 0);
}

export function activeLeasesForRun(store: StateStore, runId: string): ActiveLeaseRecord[] {
  const rows = withBusyRetry(
    () =>
      store.db
        .query(
          `
            SELECT
              leases.id AS lease_id,
              leases.queue_id,
              leases.worker_id,
              leases.base_rev,
              leases.ttl,
              leases.heartbeat_at,
              targets.id AS target_id,
              targets.unit,
              targets.symbol,
              targets.source_path,
              targets.size,
              targets.fuzzy,
              targets.matched,
              targets.complete,
              targets.risk,
              targets.status AS target_status,
              targets.priority,
              targets.reason
            FROM leases
            JOIN queue ON queue.id = leases.queue_id
            JOIN targets ON targets.id = queue.target_id
            WHERE queue.run_id = ?
              AND leases.status = 'active'
            ORDER BY leases.heartbeat_at ASC
          `,
        )
        .all(runId) as Record<string, unknown>[],
  );

  return rows.map((row) => ({
    leaseId: String(row.lease_id),
    queueId: String(row.queue_id),
    workerId: String(row.worker_id),
    baseRev: String(row.base_rev ?? "unknown"),
    ttl: String(row.ttl),
    heartbeatAt: String(row.heartbeat_at),
    targetId: String(row.target_id),
    target: {
      target_id: String(row.target_id),
      unit: String(row.unit),
      symbol: String(row.symbol),
      source_path: String(row.source_path),
      size: Number(row.size),
      fuzzy: Number(row.fuzzy),
      matched: row.matched == null ? null : Number(row.matched),
      complete: row.complete == null ? null : Number(row.complete),
      risk: row.risk == null ? null : String(row.risk),
      target_status: String(row.target_status),
      priority: Number(row.priority),
      reason: String(row.reason ?? ""),
    },
    writeSet: [String(row.source_path)],
  }));
}

export function addDirectorCycle(params: {
  store: StateStore;
  runId: string;
  triggerEvent: string;
  activeWorkers: number;
  summaryPath?: string;
  decisionPath?: string;
}): string {
  const id = randomUUID();
  immediateTransaction(params.store.db, () => {
    params.store.db
      .query(
        "INSERT INTO director_cycles (id, run_id, trigger_event, active_workers, summary_path, decision_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        params.runId,
        params.triggerEvent,
        params.activeWorkers,
        params.summaryPath ?? null,
        params.decisionPath ?? null,
        now(),
      );
  });
  return id;
}

export function addPiSession(params: {
  store: StateStore;
  runId: string;
  leaseId?: string;
  role: PiRole;
  sessionId: string;
  sessionFile?: string;
  provider?: string;
  model?: string;
  thinkingLevel?: string;
  status: PiSessionStatus;
  outputPath: string;
}): string {
  const id = randomUUID();
  immediateTransaction(params.store.db, () => {
    params.store.db
      .query(
        "INSERT INTO pi_sessions (id, run_id, lease_id, role, session_id, session_file, provider, model, thinking_level, status, output_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        params.runId,
        params.leaseId ?? null,
        params.role,
        params.sessionId,
        params.sessionFile ?? null,
        params.provider ?? null,
        params.model ?? null,
        params.thinkingLevel ?? null,
        params.status,
        params.outputPath,
        now(),
      );
  });
  return id;
}

export function leaseNextQueuedTarget(params: {
  store: StateStore;
  runId: string;
  workerId: string;
  baseRev?: string;
  ttlSeconds?: number;
}): LeasedTarget | null {
  return immediateTransaction(params.store.db, () => {
    const target = params.store.db
      .query(
        `
          SELECT
            queue.id AS queue_id,
            targets.id AS target_id,
            targets.unit,
            targets.symbol,
            targets.source_path,
            targets.size,
            targets.fuzzy,
            targets.matched,
            targets.complete,
            targets.risk,
            targets.status AS target_status,
            targets.priority,
            targets.reason
          FROM queue
          JOIN targets ON targets.id = queue.target_id
          WHERE queue.run_id = ?
            AND queue.status = 'queued'
            AND NOT EXISTS (
              SELECT 1
              FROM file_locks
              JOIN leases AS lock_leases ON lock_leases.id = file_locks.lease_id
              WHERE file_locks.path = targets.source_path
                AND lock_leases.status = 'active'
            )
          ORDER BY queue.priority DESC, queue.created_at ASC
          LIMIT 1
        `,
      )
      .get(params.runId) as Record<string, unknown> | undefined;
    if (!target) return null;

    const sourcePath = String(target.source_path ?? "").trim();
    if (!sourcePath) throw new Error(`Cannot lease target ${String(target.target_id)} without a source_path`);

    const writeSet = [sourcePath];
    const queueId = String(target.queue_id);
    const targetId = String(target.target_id);
    const leaseId = randomUUID();
    const ttl = new Date(Date.now() + (params.ttlSeconds ?? 60 * 60) * 1000).toISOString();
    const createdAt = now();

    params.store.db
      .query(
        "INSERT INTO leases (id, queue_id, worker_id, base_rev, write_set_hash, worktree_path, ttl, heartbeat_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        leaseId,
        queueId,
        params.workerId,
        params.baseRev ?? "unknown",
        writeSetHash(writeSet),
        null,
        ttl,
        createdAt,
        "active",
      );

    const insertLock = params.store.db.query("INSERT OR REPLACE INTO file_locks (path, lease_id, lock_mode, expires_at) VALUES (?, ?, ?, ?)");
    for (const path of writeSet) insertLock.run(path, leaseId, "write", ttl);

    params.store.db.query("UPDATE queue SET status = 'leased', leased_at = ? WHERE id = ?").run(createdAt, queueId);
    params.store.db.query("UPDATE targets SET status = 'leased' WHERE id = ?").run(targetId);

    return {
      leaseId,
      queueId,
      workerId: params.workerId,
      targetId,
      target,
      writeSet,
      ttl,
    };
  });
}

export function recordWorkerReport(params: {
  store: StateStore;
  runId: string;
  leaseId: string;
  reportType: WorkerReportType;
  summaryPath: string;
  factsPath?: string;
  blockerPath?: string;
  patchPath?: string;
  payload: Record<string, unknown>;
}): { reportId: string; eventId: string } {
  const reportId = randomUUID();
  const eventId = randomUUID();
  const reportCreatedAt = now();
  const leaseStatus = releasedLeaseStatus(params.reportType);
  const eventType = workerWakeEvent(params.reportType);
  immediateTransaction(params.store.db, () => {
    params.store.db
      .query(
        "INSERT INTO worker_reports (id, lease_id, report_type, summary_path, facts_path, blocker_path, patch_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        reportId,
        params.leaseId,
        params.reportType,
        params.summaryPath,
        params.factsPath ?? null,
        params.blockerPath ?? null,
        params.patchPath ?? null,
        reportCreatedAt,
      );

    params.store.db.query("UPDATE leases SET status = ? WHERE id = ?").run(leaseStatus, params.leaseId);
    params.store.db.query("DELETE FROM file_locks WHERE lease_id = ?").run(params.leaseId);
    params.store.db
      .query(
        `
          UPDATE queue
          SET status = ?
          WHERE id = (SELECT queue_id FROM leases WHERE id = ?)
        `,
      )
      .run(params.reportType === "stalled_no_useful_guess" ? "stalled" : "reported", params.leaseId);
    params.store.db
      .query(
        `
          UPDATE targets
          SET status = ?
          WHERE id = (
            SELECT queue.target_id
            FROM queue
            JOIN leases ON leases.queue_id = queue.id
            WHERE leases.id = ?
          )
        `,
      )
      .run(params.reportType === "stalled_no_useful_guess" ? "stalled" : "reported", params.leaseId);

    params.store.db
      .query("INSERT INTO events (id, run_id, event_type, producer, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(eventId, params.runId, eventType, "worker", JSON.stringify(params.payload), now());
  });
  return { reportId, eventId };
}

export function statusSnapshot(store: StateStore): Record<string, unknown> {
  const run = getLatestRun(store);
  if (!run) return { runs: 0 };
  const scalar = (sql: string, runId: string) => {
    const row = withBusyRetry(() => store.db.query(sql).get(runId) as Record<string, unknown>);
    return Number(row.count ?? 0);
  };
  return {
    run,
    targets: scalar("SELECT COUNT(*) AS count FROM targets WHERE run_id = ?", run.id),
    queued: scalar("SELECT COUNT(*) AS count FROM queue WHERE run_id = ? AND status = 'queued'", run.id),
    unhandledEvents: scalar("SELECT COUNT(*) AS count FROM events WHERE run_id = ? AND handled_at IS NULL", run.id),
    piSessions: scalar("SELECT COUNT(*) AS count FROM pi_sessions WHERE run_id = ?", run.id),
    directorCycles: scalar("SELECT COUNT(*) AS count FROM director_cycles WHERE run_id = ?", run.id),
    leases: scalar(
      "SELECT COUNT(*) AS count FROM leases JOIN queue ON leases.queue_id = queue.id WHERE queue.run_id = ?",
      run.id,
    ),
    activeLeases: activeWorkerCount(store, run.id),
    fileLocks: scalar(
      "SELECT COUNT(*) AS count FROM file_locks JOIN leases ON file_locks.lease_id = leases.id JOIN queue ON leases.queue_id = queue.id WHERE queue.run_id = ?",
      run.id,
    ),
    workerReports: scalar(
      "SELECT COUNT(*) AS count FROM worker_reports JOIN leases ON worker_reports.lease_id = leases.id JOIN queue ON leases.queue_id = queue.id WHERE queue.run_id = ?",
      run.id,
    ),
  };
}
