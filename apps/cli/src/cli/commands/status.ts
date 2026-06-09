import { projectToSummary } from "@decomp-orchestrator/core";
import { openState, statusSnapshot } from "@decomp-orchestrator/core/state";
import type { GlobalArgs } from "../args.js";

export async function status(globals: GlobalArgs): Promise<void> {
  const store = openState(globals.stateDir);
  try {
    const snapshot = statusSnapshot(store);
    const project = globals.project ? projectToSummary(globals.project) : undefined;
    console.log(JSON.stringify(project ? { project, projectWarnings: globals.project?.warnings ?? [], ...snapshot } : snapshot, null, 2));
  } finally {
    store.db.close();
  }
}
