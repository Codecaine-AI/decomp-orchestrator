export type RunStatus = "active" | "complete" | "paused" | "failed";
export type EventType =
  | "run_started"
  | "worker_finished"
  | "worker_stalled"
  | "needs_fact"
  | "score_candidate"
  | "pool_below_target";
export type PiRole = "director" | "worker";
export type PiSessionStatus = "dry_run" | "running" | "succeeded" | "failed";
export type WorkerReportType = "stalled_no_useful_guess" | "progress" | "needs_fact" | "score_candidate";

export interface RunRecord {
  id: string;
  goalKind: string;
  goalValue: number;
  desiredWorkers: number;
  status: RunStatus;
  createdAt: string;
}

export interface BoardMeasures {
  fuzzy_match_percent?: number;
  matched_code_percent?: number;
  complete_code_percent?: number;
  matched_functions_percent?: number;
  total_units?: number;
  complete_units?: number;
}

export interface TargetCandidate {
  unit: string;
  sourcePath: string;
  symbol: string;
  size: number;
  fuzzy: number;
  priority: number;
  reason: string;
}

export interface BoardSnapshot {
  generatedAt: string;
  reportPath: string;
  objdiffPath: string;
  measures: BoardMeasures;
  candidates: TargetCandidate[];
}

export interface PiPromptBundle {
  systemPrompt: string;
  userPrompt: string;
  systemTemplatePath: string;
  userTemplatePath: string;
}

export interface PiRunResult {
  sessionId: string;
  sessionFile?: string;
  outputPath: string;
  systemPromptPath: string;
  userPromptPath: string;
  rawText: string;
  dryRun: boolean;
  failed?: boolean;
  error?: string;
}
