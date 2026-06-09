import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadKnowledgeBoardSnapshot, resourceGraphDbPath } from "@decomp-orchestrator/knowledge";
import { addBoardTargets, createRun, openState } from "@decomp-orchestrator/core/state";
import { numberArg, projectMetadata, stringArg, type GlobalArgs } from "../args.js";

export async function initRun(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const store = openState(globals.stateDir);
  const goalKind = stringArg(args, "--goal-kind", "matched_code_percent");
  const goalValue = numberArg(args, "--goal-value", globals.project?.dashboard.goalValue ?? 70);
  const desiredWorkers = numberArg(args, "--desired-workers", 16);
  const candidateLimit = numberArg(args, "--candidate-limit", globals.project?.dashboard.candidateLimit ?? Math.max(32, desiredWorkers * 2));
  const graphDbPath = stringArg(args, "--graph-db", globals.graphDbPath ?? resourceGraphDbPath());
  const project = projectMetadata(globals, { graphDbPath });
  const run = createRun(store, goalKind, goalValue, desiredWorkers, project);
  const snapshot = loadKnowledgeBoardSnapshot(globals.repoRoot, candidateLimit, { graphDbPath });
  const targetCount = addBoardTargets(store, run.id, snapshot);
  await mkdir(resolve(globals.stateDir, "runs", run.id, "snapshots"), { recursive: true });
  await writeFile(resolve(globals.stateDir, "runs", run.id, "snapshots", "initial_board.json"), JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify({ run, project: project ?? null, targetCount, stateDir: globals.stateDir, graphDbPath, measures: snapshot.measures }, null, 2));
}
