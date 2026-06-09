export type RunStatus = "active" | "complete" | "paused" | "failed";

export interface RunProjectMetadata {
  projectId?: string;
  projectKind?: string;
  repoRoot?: string;
  stateDir?: string;
  graphDbPath?: string;
  descriptorPath?: string;
  localOverridePath?: string;
}

export interface RunRecord {
  id: string;
  goalKind: string;
  goalValue: number;
  desiredWorkers: number;
  status: RunStatus;
  createdAt: string;
  project?: RunProjectMetadata;
}
