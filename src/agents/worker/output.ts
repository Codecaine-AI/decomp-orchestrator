import type { WorkerReportType } from "../../types/index.js";
import { parseJsonObject } from "../runtime/index.js";

export interface WorkerReportAcceptanceGate {
  intendedReportType: WorkerReportType;
  effectiveReportType: WorkerReportType;
  accepted: boolean;
  reasons: string[];
}

export interface WorkerRunnerValidation {
  status: "passed" | "failed" | "skipped";
  reasons: string[];
  command?: string;
  exitCode?: number;
  summaryPath?: string;
  stdoutPath?: string;
  stderrPath?: string;
}

export function parseWorkerAgentReport(rawText: string): { report: Record<string, unknown> | null; error?: string } {
  const parsed = parseJsonObject(rawText);
  return { report: parsed.object, error: parsed.error };
}

export function isWorkerReportType(value: unknown): value is WorkerReportType {
  return value === "stalled_no_useful_guess" || value === "progress" || value === "needs_fact" || value === "score_candidate";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProgressReportType(reportType: WorkerReportType): boolean {
  return reportType === "progress" || reportType === "score_candidate";
}

export function evaluateWorkerReportAcceptance(params: {
  agentReport: Record<string, unknown> | null;
  reportType: WorkerReportType;
  writeSet: string[];
  parseError?: string;
  artifactExists?: (path: string) => boolean;
}): WorkerReportAcceptanceGate {
  if (!isProgressReportType(params.reportType)) {
    return {
      intendedReportType: params.reportType,
      effectiveReportType: params.reportType,
      accepted: true,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  const report = params.agentReport;
  if (params.parseError) reasons.push(`agent report parse error: ${params.parseError}`);
  if (!report) {
    reasons.push("missing structured agent report");
  } else {
    const localRegressionCheck = report.local_regression_check;
    if (!isRecord(localRegressionCheck)) {
      reasons.push("missing local_regression_check object");
    } else {
      const baselineArtifact = localRegressionCheck.baseline_artifact;
      const finalArtifact = localRegressionCheck.final_artifact;
      if (localRegressionCheck.status !== "passed") {
        reasons.push(`local_regression_check.status must be passed, got ${String(localRegressionCheck.status ?? "missing")}`);
      }
      if (localRegressionCheck.target_regression !== false) {
        reasons.push("local_regression_check.target_regression must be false");
      }
      if (!Array.isArray(localRegressionCheck.neighbor_regressions)) {
        reasons.push("local_regression_check.neighbor_regressions must be an array");
      } else if (localRegressionCheck.neighbor_regressions.length > 0) {
        reasons.push("local_regression_check.neighbor_regressions must be empty");
      }
      if (!nonEmptyString(baselineArtifact)) {
        reasons.push("local_regression_check.baseline_artifact must reference a baseline artifact");
      } else if (params.artifactExists && !params.artifactExists(baselineArtifact)) {
        reasons.push(`local_regression_check.baseline_artifact does not exist: ${baselineArtifact}`);
      }
      if (!nonEmptyString(finalArtifact)) {
        reasons.push("local_regression_check.final_artifact must reference a final validation artifact");
      } else if (params.artifactExists && !params.artifactExists(finalArtifact)) {
        reasons.push(`local_regression_check.final_artifact does not exist: ${finalArtifact}`);
      }
    }

    const lease = report.lease;
    if (!isRecord(lease)) {
      reasons.push("missing lease object in worker report");
    } else {
      if (lease.write_set_checked !== true) {
        reasons.push("lease.write_set_checked must be true");
      }
      if (!Array.isArray(lease.edited_paths)) {
        reasons.push("lease.edited_paths must be an array");
      } else {
        const writeSet = new Set(params.writeSet);
        const outsideWriteSet = lease.edited_paths.filter((path) => typeof path !== "string" || !writeSet.has(path));
        if (outsideWriteSet.length > 0) {
          reasons.push(`lease.edited_paths contains paths outside write_set: ${outsideWriteSet.map(String).join(", ")}`);
        }
      }
    }
  }

  return {
    intendedReportType: params.reportType,
    effectiveReportType: reasons.length === 0 ? params.reportType : "stalled_no_useful_guess",
    accepted: reasons.length === 0,
    reasons,
  };
}

export function workerReturnRepairReasons(params: {
  acceptanceGate: WorkerReportAcceptanceGate;
  writeSetDiffChanged: boolean;
  runnerValidation?: WorkerRunnerValidation;
}): string[] {
  const reasons: string[] = [];
  if (!params.acceptanceGate.accepted) {
    reasons.push(...params.acceptanceGate.reasons.map((reason) => `acceptance gate: ${reason}`));
  }
  if (params.runnerValidation?.status === "failed") {
    reasons.push(...params.runnerValidation.reasons.map((reason) => `runner validation: ${reason}`));
  }
  const acceptedProgress = params.acceptanceGate.accepted && isProgressReportType(params.acceptanceGate.effectiveReportType);
  if (params.writeSetDiffChanged && !acceptedProgress) {
    reasons.push("write_set diff changed but the worker did not return accepted progress/score_candidate validation");
  }
  return reasons;
}
