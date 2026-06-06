import { withBusyRetry, type StateStore } from "./db.js";
import { activeWorkerCount } from "./leases.js";

function scalar(store: StateStore, sql: string, runId: string): number {
  const row = withBusyRetry(() => store.db.query(sql).get(runId) as Record<string, unknown>);
  return Number(row.count ?? 0);
}

export function queuedTargetCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM queue WHERE run_id = ? AND status = 'queued'", runId);
}

export function schedulableTargetCount(store: StateStore, runId: string): number {
  return scalar(
    store,
    `
      SELECT COUNT(DISTINCT targets.source_path) AS count
      FROM queue
      JOIN targets ON targets.id = queue.target_id
      WHERE queue.run_id = ?
        AND queue.status = 'queued'
        AND targets.source_path IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM file_locks
          JOIN leases AS lock_leases ON lock_leases.id = file_locks.lease_id
          WHERE file_locks.path = targets.source_path
            AND lock_leases.status = 'active'
        )
    `,
    runId,
  );
}

export function blockedQueuedTargetCount(store: StateStore, runId: string): number {
  return scalar(
    store,
    `
      SELECT COUNT(*) AS count
      FROM queue
      JOIN targets ON targets.id = queue.target_id
      WHERE queue.run_id = ?
        AND queue.status = 'queued'
        AND targets.source_path IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM file_locks
          JOIN leases AS lock_leases ON lock_leases.id = file_locks.lease_id
          WHERE file_locks.path = targets.source_path
            AND lock_leases.status = 'active'
        )
    `,
    runId,
  );
}

export function unhandledEventCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM events WHERE run_id = ? AND handled_at IS NULL", runId);
}

export function unhandledPoolEventCount(store: StateStore, runId: string): number {
  return scalar(store, "SELECT COUNT(*) AS count FROM events WHERE run_id = ? AND event_type = 'pool_below_target' AND handled_at IS NULL", runId);
}

export function queueStatsSnapshot(store: StateStore, runId: string): {
  activeWorkers: number;
  blockedQueuedTargets: number;
  queuedTargets: number;
  schedulableTargets: number;
  unhandledEvents: number;
} {
  return {
    activeWorkers: activeWorkerCount(store, runId),
    blockedQueuedTargets: blockedQueuedTargetCount(store, runId),
    queuedTargets: queuedTargetCount(store, runId),
    schedulableTargets: schedulableTargetCount(store, runId),
    unhandledEvents: unhandledEventCount(store, runId),
  };
}
