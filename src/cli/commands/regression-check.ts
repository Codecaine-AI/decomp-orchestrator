import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { artifactTimestamp } from "../../agents/runtime/index.js";
import { writePrReport } from "../../objdiff/report.js";
import { runNinja } from "../../shell/index.js";
import { numberArg, stringArg, type GlobalArgs } from "../args.js";

function errorText(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

export async function regressionCheck(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const target = stringArg(args, "--target", "changes_all");
  if (!target || target.startsWith("-") || /\s/.test(target)) {
    throw new Error("--target must be one Ninja target name, for example changes_all");
  }
  const runId = stringArg(args, "--run-id", "manual");
  const reportTitle = stringArg(args, "--report-title", "Expected local report for GALE01");
  const reportMaxRows = numberArg(args, "--report-max-rows", 30);
  if (!Number.isInteger(reportMaxRows) || reportMaxRows < 0) {
    throw new Error("--report-max-rows must be a non-negative integer");
  }
  const outputDir = resolve(globals.stateDir, "regression_checks", runId, artifactTimestamp());
  await mkdir(outputDir, { recursive: true });

  const result = await runNinja(globals.repoRoot, target);
  const stdoutPath = resolve(outputDir, "stdout.txt");
  const stderrPath = resolve(outputDir, "stderr.txt");
  const summaryPath = resolve(outputDir, "summary.json");
  const reportChangesPath = resolve(globals.repoRoot, "build/GALE01/report_changes.json");
  const prReportPath = resolve(outputDir, "pr_report.md");
  const prReportErrorPath = resolve(outputDir, "pr_report_error.txt");
  await writeFile(stdoutPath, result.stdout);
  await writeFile(stderrPath, result.stderr);

  let reportError: string | null = null;
  let regressionCounts: Record<string, number> | null = null;
  try {
    const report = await writePrReport(reportChangesPath, prReportPath, reportTitle, reportMaxRows);
    regressionCounts = {
      metricRegressions: report.regressions.length,
      newMatches: report.newMatches.length,
      brokenMatches: report.brokenMatches.length,
      improvements: report.improvements.length,
      fuzzyRegressions: report.fuzzyRegressions.length,
    };
  } catch (error) {
    reportError = errorText(error);
    await writeFile(prReportErrorPath, reportError);
  }

  const hasReportRegressions =
    regressionCounts !== null &&
    (regressionCounts.metricRegressions > 0 ||
      regressionCounts.brokenMatches > 0 ||
      regressionCounts.fuzzyRegressions > 0);
  const passed = result.exitCode === 0 && reportError === null && !hasReportRegressions;
  const summary = {
    status: passed ? "passed" : "failed",
    exitCode: result.exitCode,
    regressionGateExitCode: passed ? 0 : 1,
    command: ["ninja", target],
    repoRoot: globals.repoRoot,
    runId,
    artifactDir: outputDir,
    stdoutPath,
    stderrPath,
    baselinePath: resolve(globals.repoRoot, "build/GALE01/baseline.json"),
    reportChangesPath,
    prReportPath,
    prReportGenerator: "decomp-orchestrator/src/objdiff/report.ts",
    prReportErrorPath: reportError === null ? null : prReportErrorPath,
    regressionCounts,
    hint:
      passed
        ? "No regressions were reported by the orchestrator gate. Use pr_report.md as the expected/local run section of the PR description."
        : reportError !== null
          ? "Inspect stdout/stderr and pr_report_error.txt. The regression gate could not parse build/GALE01/report_changes.json."
          : hasReportRegressions
            ? "Inspect pr_report.md and build/GALE01/report_changes.json. Broken matches, fuzzy regressions, or metric regressions must be fixed before PR handoff."
            : "Inspect stdout/stderr. If the baseline is missing, run ninja baseline on the upstream base before checking the branch.",
  };
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, summaryPath }, null, 2));
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
  else if (!passed) process.exitCode = 1;
}
