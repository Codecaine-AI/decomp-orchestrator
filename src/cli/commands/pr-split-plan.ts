import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runCommand } from "../../shell/index.js";
import { booleanArg, numberArg, stringArg, type GlobalArgs } from "../args.js";

type ChangeSource = "branch" | "worktree";
type GroupMode = "melee-subsystem" | "top-dir";
type IndependenceKind = "independent" | "shared-prep" | "stacked" | "needs-merge";

export interface PrChangedFile {
  path: string;
  oldPath?: string;
  statuses: string[];
  sources: ChangeSource[];
}

interface RawChangedFile {
  path: string;
  oldPath?: string;
  status: string;
  source: ChangeSource;
}

interface ChangeGroup {
  id: string;
  displayName: string;
  scope: string;
  category: "shared" | "subsystem" | "support";
  files: PrChangedFile[];
}

interface PrSliceIndependence {
  kind: IndependenceKind;
  verified: boolean;
  confidence: "medium" | "low";
  reasons: string[];
  requiredChecks: string[];
  possibleDependencies: string[];
}

export interface PrSplitSlice {
  id: string;
  displayName: string;
  title: string;
  branchName: string;
  scope: string;
  directories: string[];
  fileCount: number;
  files: PrChangedFile[];
  pathspecs: string[];
  statusCounts: Record<string, number>;
  sources: ChangeSource[];
  independence: PrSliceIndependence;
  commands: string[];
  isolationCommands: string[];
  warnings: string[];
}

export interface PrSplitPlan {
  repoRoot: string;
  baseRef: string;
  headRef: string;
  currentBranch: string;
  groupMode: GroupMode;
  maxFilesPerPr: number;
  totalFiles: number;
  slices: PrSplitSlice[];
  warnings: string[];
}

interface BuildPlanOptions {
  repoRoot: string;
  baseRef: string;
  headRef: string;
  currentBranch: string;
  groupMode: GroupMode;
  maxFilesPerPr: number;
  branchPrefix: string;
  titlePrefix: string;
  sliceCheckCommand: string;
  warnings?: string[];
}

function splitZ(output: string): string[] {
  const parts = output.split("\0");
  if (parts.at(-1) === "") parts.pop();
  return parts;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=,@%+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .replaceAll("\\", "/")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "")
    .replace(/\/+/g, "-")
    .replace(/-+/g, "-");
}

function displayNameFor(id: string): string {
  if (/^[a-z]{2}$/.test(id)) return id.toUpperCase();
  if (id === "sysdolphin") return "SysDolphin";
  if (id === "runtime") return "Runtime";
  if (id === "msl") return "MSL";
  if (id === "metrotrk") return "MetroTRK";
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => (/^[a-z]{2}$/.test(part) ? part.toUpperCase() : part.slice(0, 1).toUpperCase() + part.slice(1)))
    .join(" ");
}

function titleFor(prefix: string, displayName: string): string {
  return prefix ? `${prefix}: ${displayName}` : displayName;
}

function directoryForPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

function extensionForPath(path: string): string {
  const basename = path.split("/").at(-1) ?? "";
  const dot = basename.lastIndexOf(".");
  return dot === -1 ? "" : basename.slice(dot + 1).toLowerCase();
}

function isBuildOrGeneratedPath(path: string): boolean {
  const normalized = normalizePath(path);
  const basename = normalized.split("/").at(-1) ?? "";
  return (
    normalized.startsWith("build/") ||
    normalized.startsWith(".github/") ||
    normalized.startsWith("config/") ||
    normalized.startsWith("tools/") ||
    basename === "objdiff.json" ||
    basename === "report.json" ||
    basename === "report_changes.json" ||
    basename === "configure.py" ||
    basename === "Makefile" ||
    basename.endsWith(".ld") ||
    basename.endsWith(".lcf") ||
    basename.endsWith(".lds") ||
    basename.includes("symbols") ||
    basename.includes("splits")
  );
}

function isScopedToMeleeSubsystem(path: string, sliceId: string): boolean {
  const parts = normalizePath(path).split("/").filter(Boolean);
  const meleeIndex = parts.indexOf("melee");
  return meleeIndex >= 0 && sanitizeId(parts[meleeIndex + 1] ?? "") === sliceId;
}

function isReviewableSourceLikePath(path: string): boolean {
  const extension = extensionForPath(path);
  return extension === "c" || extension === "h" || extension === "s" || extension === "inc";
}

function groupForPath(path: string, groupMode: GroupMode): Omit<ChangeGroup, "files"> {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (groupMode === "top-dir") {
    const id = sanitizeId(parts[0] ?? "root") || "root";
    return {
      id,
      displayName: displayNameFor(id),
      scope: parts[0] ?? ".",
      category: id === "root" ? "shared" : "support",
    };
  }

  const meleeIndex = parts.indexOf("melee");
  if (meleeIndex >= 0 && parts[meleeIndex + 1]) {
    const subsystem = parts[meleeIndex + 1];
    const id = sanitizeId(subsystem);
    return {
      id,
      displayName: displayNameFor(id),
      scope: `melee/${subsystem}`,
      category: "subsystem",
    };
  }

  const supportRoots = ["sysdolphin", "Runtime", "MSL", "MetroTRK"];
  for (const root of supportRoots) {
    const index = parts.findIndex((part) => part.toLowerCase() === root.toLowerCase());
    if (index >= 0) {
      const id = sanitizeId(root);
      return {
        id,
        displayName: displayNameFor(id),
        scope: parts.slice(0, index + 1).join("/"),
        category: "support",
      };
    }
  }

  const id = sanitizeId(parts[0] ?? "shared") || "shared";
  return {
    id,
    displayName: displayNameFor(id),
    scope: parts[0] ?? ".",
    category: "shared",
  };
}

function refinementId(path: string, group: ChangeGroup): string {
  const parts = normalizePath(path).split("/").filter(Boolean);
  const scopeParts = group.scope.split("/").filter(Boolean);
  const anchor = scopeParts.length >= 2 ? parts.findIndex((part, index) => part === scopeParts[0] && parts[index + 1] === scopeParts[1]) : -1;
  const afterScope = anchor >= 0 ? parts.slice(anchor + scopeParts.length) : parts.slice(1);
  const directories = afterScope.filter((part) => !part.includes("."));
  if (directories.length === 0) return `${group.id}-root`;
  if (directories[0] === "chara" && directories[1]) return `${group.id}-chara-${sanitizeId(directories[1])}`;
  return `${group.id}-${sanitizeId(directories[0])}`;
}

function mergeChanges(changes: RawChangedFile[]): PrChangedFile[] {
  const byPath = new Map<string, PrChangedFile>();
  for (const change of changes) {
    const path = normalizePath(change.path);
    if (!path || path.startsWith(".git/")) continue;
    const existing = byPath.get(path);
    if (existing) {
      if (!existing.statuses.includes(change.status)) existing.statuses.push(change.status);
      if (!existing.sources.includes(change.source)) existing.sources.push(change.source);
      if (!existing.oldPath && change.oldPath) existing.oldPath = normalizePath(change.oldPath);
    } else {
      byPath.set(path, {
        path,
        oldPath: change.oldPath ? normalizePath(change.oldPath) : undefined,
        statuses: [change.status],
        sources: [change.source],
      });
    }
  }
  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function statusCounts(files: PrChangedFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    for (const status of file.statuses) counts[status] = (counts[status] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sliceSources(files: PrChangedFile[]): ChangeSource[] {
  const sources = new Set<ChangeSource>();
  for (const file of files) for (const source of file.sources) sources.add(source);
  return Array.from(sources).sort();
}

function sortGroups(left: ChangeGroup, right: ChangeGroup): number {
  const categoryOrder = { shared: 0, subsystem: 1, support: 2 };
  return categoryOrder[left.category] - categoryOrder[right.category] || left.id.localeCompare(right.id);
}

function maybeSplitLargeGroup(group: ChangeGroup, maxFilesPerPr: number): ChangeGroup[] {
  if (group.files.length <= maxFilesPerPr) return [group];
  const buckets = new Map<string, PrChangedFile[]>();
  for (const file of group.files) {
    const id = refinementId(file.path, group);
    const bucket = buckets.get(id) ?? [];
    bucket.push(file);
    buckets.set(id, bucket);
  }
  if (buckets.size <= 1) return [group];
  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, files]) => ({
      ...group,
      id,
      displayName: displayNameFor(id),
      scope: `${group.scope}/${id.replace(`${group.id}-`, "")}`,
      files,
    }));
}

function commandsForSlice(slice: Omit<PrSplitSlice, "commands" | "isolationCommands">, baseRef: string, headRef: string): string[] {
  const pathspecs = slice.pathspecs.map(shellQuote).join(" ");
  return [
    `git switch -c ${shellQuote(slice.branchName)} ${shellQuote(baseRef)}`,
    `git diff --binary ${shellQuote(`${baseRef}...${headRef}`)} -- ${pathspecs} | git apply --index`,
    `git commit -m ${shellQuote(slice.title)}`,
  ];
}

function checkCommandForSlice(slice: Omit<PrSplitSlice, "commands" | "isolationCommands">, repoRoot: string, sliceCheckCommand: string): string {
  return sliceCheckCommand
    .replaceAll("{slice_dir}", "$SLICE_DIR")
    .replaceAll("{slice_id}", slice.id)
    .replaceAll("{repo_root}", shellQuote(repoRoot));
}

function isolationCommandsForSlice(
  slice: Omit<PrSplitSlice, "commands" | "isolationCommands">,
  options: Pick<BuildPlanOptions, "baseRef" | "headRef" | "repoRoot" | "sliceCheckCommand">,
): string[] {
  const pathspecs = slice.pathspecs.map(shellQuote).join(" ");
  const tempPrefix = `melee-pr-${sanitizeId(slice.id) || "slice"}-XXXXXX`;
  return [
    `SLICE_DIR="$(mktemp -d "\${TMPDIR:-/tmp}/${tempPrefix}")"`,
    `git worktree add --detach "$SLICE_DIR" ${shellQuote(options.baseRef)}`,
    `git diff --binary ${shellQuote(`${options.baseRef}...${options.headRef}`)} -- ${pathspecs} | git -C "$SLICE_DIR" apply --index`,
    `(cd "$SLICE_DIR" && ${checkCommandForSlice(slice, options.repoRoot, options.sliceCheckCommand)})`,
    `git worktree remove "$SLICE_DIR"`,
  ];
}

function classifyIndependence(group: ChangeGroup, files: PrChangedFile[], maxFilesPerPr: number): PrSliceIndependence {
  const reasons: string[] = [];
  const requiredChecks = [
    "apply this slice to a fresh branch or worktree based on the selected base ref",
    "run configure/build for that isolated slice",
    "run the saved-baseline regression gate or equivalent local PR check",
    "promote to a true independent PR only if the isolated slice passes",
  ];
  const hasGeneratedOrBuildPath = files.some((file) => isBuildOrGeneratedPath(file.path));
  const hasUntracked = files.some((file) => file.statuses.some((status) => status.startsWith("??")));
  const hasWorktree = files.some((file) => file.sources.includes("worktree"));
  const hasDeletionOrRename = files.some((file) => file.statuses.some((status) => status.includes("D") || status.includes("R")));
  const allScopedSourceLike =
    group.category === "subsystem" &&
    files.every((file) => isScopedToMeleeSubsystem(file.path, group.id) && isReviewableSourceLikePath(file.path));
  const hasCrossCuttingHeader = files.some((file) => extensionForPath(file.path) === "h" && !isScopedToMeleeSubsystem(file.path, group.id));

  if (files.length > maxFilesPerPr) {
    reasons.push(`slice has ${files.length} files, above --max-files-per-pr=${maxFilesPerPr}`);
    return { kind: "needs-merge", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (hasGeneratedOrBuildPath) {
    reasons.push("contains build, generated, config, symbol, split, or CI-adjacent files");
    return { kind: "shared-prep", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (group.category === "shared") {
    reasons.push("changes are outside a Melee subsystem directory");
    return { kind: "shared-prep", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (group.category === "support") {
    reasons.push("support-library changes may affect multiple Melee subsystem slices");
    return { kind: "shared-prep", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (hasCrossCuttingHeader) {
    reasons.push("contains headers or declarations outside this slice's Melee subsystem");
    return { kind: "stacked", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (hasDeletionOrRename) {
    reasons.push("contains deletes or renames that may affect references outside the directory slice");
    return { kind: "stacked", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
  }

  if (allScopedSourceLike) {
    reasons.push(`all files are source/header-like paths scoped to ${group.scope}`);
    if (hasWorktree) reasons.push("worktree changes still need to be committed or stashed before final isolation validation");
    if (hasUntracked) reasons.push("untracked files must be intentionally added before final isolation validation");
    return { kind: "independent", verified: false, confidence: "medium", reasons, requiredChecks, possibleDependencies: [] };
  }

  reasons.push("slice is subsystem-scoped but includes files outside the normal source/header isolation pattern");
  return { kind: "stacked", verified: false, confidence: "low", reasons, requiredChecks, possibleDependencies: [] };
}

export function buildPrSplitPlanFromChanges(changes: RawChangedFile[], options: BuildPlanOptions): PrSplitPlan {
  const files = mergeChanges(changes);
  const groups = new Map<string, ChangeGroup>();
  for (const file of files) {
    const groupKey = groupForPath(file.path, options.groupMode);
    const existing = groups.get(groupKey.id);
    if (existing) {
      existing.files.push(file);
    } else {
      groups.set(groupKey.id, { ...groupKey, files: [file] });
    }
  }

  const warnings = [...(options.warnings ?? [])];
  const slicesWithoutCommands: Array<Omit<PrSplitSlice, "commands" | "isolationCommands">> = Array.from(groups.values())
    .sort(sortGroups)
    .flatMap((group) => maybeSplitLargeGroup(group, options.maxFilesPerPr))
    .map((group) => {
      const groupWarnings: string[] = [];
      if (group.files.length > options.maxFilesPerPr) {
        groupWarnings.push(`This slice has ${group.files.length} files, above --max-files-per-pr=${options.maxFilesPerPr}; split it manually if review still feels heavy.`);
      }
      if (group.files.some((file) => file.sources.includes("worktree"))) {
        groupWarnings.push("This slice includes worktree changes; commit or stash them before using the patch workflow from HEAD.");
      }
      if (group.files.some((file) => file.statuses.some((status) => status.startsWith("??")))) {
        groupWarnings.push("This slice includes untracked files; add them intentionally before opening a PR.");
      }
      const directories = Array.from(new Set(group.files.map((file) => directoryForPath(file.path)))).sort();
      const pathspecs = group.files.map((file) => file.path).sort();
      const branchPart = sanitizeId(group.id) || "shared";
      const independence = classifyIndependence(group, group.files, options.maxFilesPerPr);
      return {
        id: group.id,
        displayName: group.displayName,
        title: titleFor(options.titlePrefix, group.displayName),
        branchName: `${options.branchPrefix.replace(/\/+$/g, "")}/${branchPart}`,
        scope: group.scope,
        directories,
        fileCount: group.files.length,
        files: group.files,
        pathspecs,
        statusCounts: statusCounts(group.files),
        sources: sliceSources(group.files),
        independence,
        warnings: groupWarnings,
      };
    });

  const slices = slicesWithoutCommands.map((slice) => ({
    ...slice,
    commands: commandsForSlice(slice, options.baseRef, options.headRef),
    isolationCommands: isolationCommandsForSlice(slice, options),
  }));

  if (files.some((file) => file.sources.includes("worktree"))) {
    warnings.push("Worktree changes are included in the plan, but generated patch commands only replay committed branch changes from HEAD.");
  }
  const sharedPrepIds = slices.filter((slice) => slice.independence.kind === "shared-prep").map((slice) => slice.id);
  for (const slice of slices) {
    if (slice.independence.kind === "stacked" && sharedPrepIds.length > 0) {
      slice.independence.possibleDependencies = sharedPrepIds;
    }
  }
  if (sharedPrepIds.length > 0) {
    warnings.push(`Shared-prep slices detected (${sharedPrepIds.join(", ")}); validate subsystem slices standalone first, then stack them only if they require shared-prep changes.`);
  }

  return {
    repoRoot: options.repoRoot,
    baseRef: options.baseRef,
    headRef: options.headRef,
    currentBranch: options.currentBranch,
    groupMode: options.groupMode,
    maxFilesPerPr: options.maxFilesPerPr,
    totalFiles: files.length,
    slices,
    warnings,
  };
}

function parseNameStatus(output: string): RawChangedFile[] {
  const fields = splitZ(output);
  const changes: RawChangedFile[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++] ?? "";
    if (!status) continue;
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = fields[index++] ?? "";
      const path = fields[index++] ?? "";
      changes.push({ path, oldPath, status, source: "branch" });
    } else {
      const path = fields[index++] ?? "";
      changes.push({ path, status, source: "branch" });
    }
  }
  return changes;
}

function parsePorcelainStatus(output: string, includeUntracked: boolean): RawChangedFile[] {
  const fields = splitZ(output);
  const changes: RawChangedFile[] = [];
  for (let index = 0; index < fields.length; ) {
    const entry = fields[index++] ?? "";
    if (entry.length < 4) continue;
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    if (status === "??" && !includeUntracked) continue;
    if (status.includes("R") || status.includes("C")) {
      const oldPath = fields[index++] ?? "";
      changes.push({ path, oldPath, status, source: "worktree" });
    } else {
      changes.push({ path, status, source: "worktree" });
    }
  }
  return changes;
}

async function git(repoRoot: string, args: string[], failureHint: string): Promise<string> {
  const result = await runCommand(repoRoot, ["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(`${failureHint}\nCommand: git ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function collectChanges(options: {
  repoRoot: string;
  baseRef: string;
  includeBranchDiff: boolean;
  includeWorktree: boolean;
  includeUntracked: boolean;
}): Promise<{ changes: RawChangedFile[]; currentBranch: string; headRef: string; warnings: string[] }> {
  const currentBranch = (await git(options.repoRoot, ["branch", "--show-current"], "Unable to read the current branch.")).trim() || "(detached)";
  const headRef = (await git(options.repoRoot, ["rev-parse", "--verify", "HEAD"], "Unable to read HEAD.")).trim();
  const changes: RawChangedFile[] = [];
  const warnings: string[] = [];

  if (options.includeBranchDiff) {
    const diff = await git(
      options.repoRoot,
      ["diff", "--name-status", "-z", "--find-renames", `${options.baseRef}...HEAD`],
      `Unable to diff against ${options.baseRef}. Fetch or pass --base-ref <ref>.`,
    );
    changes.push(...parseNameStatus(diff));
  }

  if (options.includeWorktree) {
    const status = await git(
      options.repoRoot,
      ["status", "--porcelain=v1", "-z", options.includeUntracked ? "--untracked-files=all" : "--untracked-files=no"],
      "Unable to inspect worktree status.",
    );
    changes.push(...parsePorcelainStatus(status, options.includeUntracked));
  }

  if (!options.includeBranchDiff) warnings.push("Branch diff was skipped; the plan only reflects worktree status.");
  if (!options.includeWorktree) warnings.push("Worktree status was skipped; the plan only reflects committed branch changes.");
  return { changes, currentBranch, headRef, warnings };
}

function renderFileLine(file: PrChangedFile): string {
  const status = file.statuses.join("+");
  const rename = file.oldPath ? ` (from ${file.oldPath})` : "";
  const sources = file.sources.length > 1 ? ` [${file.sources.join(", ")}]` : "";
  return `- ${status} ${file.path}${rename}${sources}`;
}

export function renderPrSplitPlan(plan: PrSplitPlan): string {
  const lines: string[] = [
    "# PR Split Plan",
    "",
    `Repo: ${plan.repoRoot}`,
    `Base: ${plan.baseRef}`,
    `Source: ${plan.currentBranch} @ ${plan.headRef}`,
    `Grouping: ${plan.groupMode}`,
    `Files: ${plan.totalFiles}`,
    `Slices: ${plan.slices.length}`,
    `Max files per PR: ${plan.maxFilesPerPr}`,
  ];

  if (plan.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
  }

  if (plan.slices.length === 0) {
    lines.push("", "No changed files were found for the selected branch/worktree scope.");
    return lines.join("\n");
  }

  lines.push(
    "",
    "Patch workflow assumes the full source branch is committed at the Source SHA above. Run each slice from a fresh branch based on Base.",
  );

  plan.slices.forEach((slice, index) => {
    lines.push(
      "",
      `## ${index + 1}. ${slice.displayName} (${slice.fileCount} ${slice.fileCount === 1 ? "file" : "files"})`,
      "",
      `Scope: ${slice.scope}`,
      `Branch: ${slice.branchName}`,
      `Title: ${slice.title}`,
      `Directories: ${slice.directories.join(", ")}`,
      `Sources: ${slice.sources.join(", ")}`,
      `Statuses: ${Object.entries(slice.statusCounts)
        .map(([status, count]) => `${status}:${count}`)
        .join(", ")}`,
      `Independence: ${slice.independence.kind} (${slice.independence.verified ? "verified" : "unverified"}, confidence: ${slice.independence.confidence})`,
    );
    lines.push("Independence reasons:");
    for (const reason of slice.independence.reasons) lines.push(`- ${reason}`);
    if (slice.independence.possibleDependencies.length > 0) {
      lines.push(`Possible dependencies: ${slice.independence.possibleDependencies.join(", ")}`);
    }
    lines.push("Required checks:");
    for (const check of slice.independence.requiredChecks) lines.push(`- ${check}`);
    if (slice.warnings.length > 0) {
      lines.push("Warnings:");
      for (const warning of slice.warnings) lines.push(`- ${warning}`);
    }
    lines.push("Files:");
    for (const file of slice.files) lines.push(renderFileLine(file));
    lines.push("Commands:");
    for (const command of slice.commands) lines.push(`  ${command}`);
    lines.push("Isolation check:");
    for (const command of slice.isolationCommands) lines.push(`  ${command}`);
  });

  return lines.join("\n");
}

export async function prSplitPlan(globals: GlobalArgs, args: Map<string, string | true>): Promise<void> {
  const baseRef = stringArg(args, "--base-ref", "origin/master");
  const maxFilesPerPr = numberArg(args, "--max-files-per-pr", 30);
  if (!Number.isInteger(maxFilesPerPr) || maxFilesPerPr < 1) {
    throw new Error("--max-files-per-pr must be a positive integer");
  }
  const groupMode = stringArg(args, "--group-mode", "melee-subsystem");
  if (groupMode !== "melee-subsystem" && groupMode !== "top-dir") {
    throw new Error("--group-mode must be melee-subsystem or top-dir");
  }

  const branchPrefix = stringArg(args, "--branch-prefix", "pr-split");
  const titlePrefix = stringArg(args, "--title-prefix", "Melee decomp");
  const sliceCheckCommand = stringArg(args, "--slice-check-command", "python configure.py --require-protos && ninja changes_all");
  const includeBranchDiff = !booleanArg(args, "--worktree-only");
  const includeWorktree = !booleanArg(args, "--committed-only");
  const includeUntracked = !booleanArg(args, "--no-untracked");

  const collected = await collectChanges({
    repoRoot: globals.repoRoot,
    baseRef,
    includeBranchDiff,
    includeWorktree,
    includeUntracked,
  });
  const plan = buildPrSplitPlanFromChanges(collected.changes, {
    repoRoot: globals.repoRoot,
    baseRef,
    headRef: collected.headRef,
    currentBranch: collected.currentBranch,
    groupMode,
    maxFilesPerPr,
    branchPrefix,
    titlePrefix,
    sliceCheckCommand,
    warnings: collected.warnings,
  });
  const rendered = booleanArg(args, "--json") ? JSON.stringify(plan, null, 2) : renderPrSplitPlan(plan);
  const outputPath = args.get("--output");
  if (typeof outputPath === "string") {
    await writeFile(resolve(globals.repoRoot, outputPath), `${rendered}\n`);
  }
  console.log(rendered);
}
