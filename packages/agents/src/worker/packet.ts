import type { RunRecord } from "@decomp-orchestrator/core/types";
import type { LeasedTarget } from "@decomp-orchestrator/core/state";

export function enabledCapabilities(packet: Record<string, unknown>): string[] {
  const raw = packet.enabled_capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value));
}

export function targetPacketTarget(target: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(target.target_id),
    unit: String(target.unit),
    symbol: String(target.symbol),
    source_path: String(target.source_path),
    size: Number(target.size),
    fuzzy_match_percent: Number(target.fuzzy),
    priority: Number(target.priority),
    reason: String(target.reason ?? ""),
  };
}

export function workerPacket(params: {
  run: RunRecord;
  leased: LeasedTarget;
  target: Record<string, unknown>;
  baselineMeasures: unknown;
  knowledgeContext?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    run: params.run,
    lease: {
      id: params.leased.leaseId,
      queue_id: params.leased.queueId,
      worker_id: params.leased.workerId,
      ttl: params.leased.ttl,
      write_set: params.leased.writeSet,
    },
    target: params.target,
    baseline: {
      measures: params.baselineMeasures,
      fuzzy_match_percent: params.target.fuzzy_match_percent,
    },
    knowledge_context: params.knowledgeContext ?? {
      status: "not_precomputed",
      reason: "No graph context was provided by the runner.",
    },
    enabled_capabilities: ["context_packaging", "focused_source_editing", "duplicate_adaptation", "fact_research"],
    stop_rule:
      "Understand the file, make scoped evidence-backed edits inside the write_set, evaluate concrete attempts with narrow validation/review feedback, retain only edits with no unresolved local regression, continue after verified progress while local hypotheses remain, and return exact/improved/no_progress plus target_complete/stalled/needs_fact; use tool_error only for tool/API/build/validation infrastructure failures.",
    report_contract: {
      report_types: ["progress", "stalled_no_useful_guess", "needs_fact", "score_candidate", "tool_error"],
      durable_paths: ["summary_path", "facts_path", "blocker_path", "patch_path"],
      wake_event: "worker_finished, worker_stalled, worker_error, needs_fact, or score_candidate",
    },
  };
}
