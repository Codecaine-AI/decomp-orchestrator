import { loadBoardSnapshot } from "@decomp-orchestrator/core/board";
import type { BoardSnapshot } from "@decomp-orchestrator/core/types";
import { codeGraphFunctionsIndexPath, resourceGraphDbPath } from "./paths.js";
import { withRankFeatureProvider } from "./graph/rank.js";

export interface LoadKnowledgeBoardSnapshotOptions {
  graphDbPath?: string;
}

export function loadKnowledgeBoardSnapshot(repoRoot: string, limit: number, options: LoadKnowledgeBoardSnapshotOptions = {}): BoardSnapshot {
  const graphDbPath = options.graphDbPath ?? resourceGraphDbPath();
  return withRankFeatureProvider(graphDbPath, (rankFeatureProvider) =>
    loadBoardSnapshot(repoRoot, limit, {
      codeGraphFunctionsIndexPath: codeGraphFunctionsIndexPath(),
      rankFeatureProvider,
    }),
  );
}
