import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeCsv } from "../io/csv.js";
import { writeJson } from "../io/json.js";
import { atomicWriteFile } from "../io/atomic.js";
import type {
  ResidualCaseKind,
  ResidualPriority,
  V3AttachedImage,
  V3PriorHumanReview,
  V3ResidualCaseObject,
} from "../types.js";

interface PackedIssueGroup {
  group_id?: string;
  prediction_group_id?: string;
  member_count?: number;
  filenames?: string[];
  truth_group_ids?: string[];
}

interface PackedIssueRow {
  all_filenames?: string[];
  evidence?: Array<Record<string, unknown>>;
  filename_count?: number;
  has_merge?: boolean;
  has_split?: boolean;
  issue_id: string;
  issue_key?: string;
  issue_type?: string;
  occurrence_count?: number;
  prediction_group_ids?: string[];
  prediction_part_count?: number;
  prediction_parts?: PackedIssueGroup[];
  queue?: Record<string, unknown>;
  rank?: number;
  risk_provenance?: Record<string, unknown>;
  run_ids?: string[];
  schema_version?: string;
  shards?: string[];
  suites?: string[];
  truth_group_count?: number;
  truth_group_ids?: string[];
  truth_groups?: PackedIssueGroup[];
}

interface Args {
  issuesJsonl: string;
  summaryJson: string;
  outputDir: string;
  imageDir: string;
  limit?: number;
  priorManualReview?: string;
  priorManualReviews?: string[];
  priorIssuesJsonl?: string;
  priorIssuesJsonls?: string[];
}

interface BuildSummaryRow {
  case_id: string;
  priority: string;
  case_kind: string;
  filename_count: number;
  truth_group_count: number;
  prediction_part_count: number;
  candidate_vote_count: number;
  attached_image_count: number;
  missing_attached_image_count: number;
  has_review_pack: boolean;
  reviewed_before: boolean;
  prior_review_match_type: string;
  prior_issue_id: string;
  prior_decision: string;
  object_path: string;
}

interface PriorReviewDecision {
  issue_id?: string;
  decision?: string;
  pi_review_decision?: string;
  pi_confidence?: string;
  issue_type?: string;
  notes?: string;
  proposed_grouping_text?: string;
  updated_at?: string;
}

interface PriorReviewIndex {
  sourceManualReviewPaths: string[];
  decisionsByIssueId: Map<string, PriorReviewDecision>;
  sourceByIssueId: Map<string, string>;
  issueIdByFilenameKey: Map<string, string>;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "../../..");
const systemRoot = resolve(repoRoot, "resolution_system_v3");
const defaultIssuesJsonl = resolve(repoRoot, "../data/v7_issue_review/v7_v3_human_auto_issuepacked80_20260602/issues.jsonl");
const defaultSummaryJson = resolve(repoRoot, "../data/v7_issue_review/v7_v3_human_auto_issuepacked80_20260602/summary.json");
const defaultOutputDir = resolve(systemRoot, "outputs/v7_packed_issue_preflight");
const defaultImageDir = resolve(repoRoot, "../data/datasets/full_1024_q90/images");

const allowedReviewDecisions = [
  "algorithm_issue_no_truth_change",
  "merge_truth_groups_same_capture",
  "merge_truth_groups_duplicate_or_same_view",
  "split_truth_group_viewpoint_change",
  "split_truth_group_state_change",
  "split_truth_group_multi_scene",
  "move_component_to_candidate_group",
  "remove_image_from_dataset",
  "flag_possible_duplicate",
  "needs_human_policy_review",
  "insufficient_evidence",
] as const;

const allowedTruthActions = [
  "no_change",
  "merge_truth_groups",
  "split_truth_group",
  "move_to_candidate",
  "remove_image",
  "flag_duplicate_only",
  "policy_review",
] as const;

const allowedDuplicateTypes = ["none", "hard_duplicate", "same_view_repeat", "repeated_capture", "possible_duplicate"] as const;

function usage(): string {
  return [
    "Usage:",
    "  bun src/bin/build_packed_issue_preflight.ts [--issues-jsonl <path>] [--summary-json <path>] [--output-dir <path>] [--image-dir <path>] [--prior-manual-review <path>] [--prior-issues-jsonl <path>] [--limit n]",
    "",
    "Prior review flags are repeatable; later decisions win when an issue id appears in multiple prior reviews.",
    "",
    "Defaults:",
    "  --issues-jsonl ../../data/v7_issue_review/v7_v3_human_auto_issuepacked80_20260602/issues.jsonl",
    "  --output-dir outputs/v7_packed_issue_preflight",
    "  --image-dir ../../data/datasets/full_1024_q90/images",
  ].join("\n");
}

function resolveFromSystemRoot(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(systemRoot, pathValue);
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    issuesJsonl: defaultIssuesJsonl,
    summaryJson: defaultSummaryJson,
    outputDir: defaultOutputDir,
    imageDir: defaultImageDir,
    priorManualReviews: [],
    priorIssuesJsonls: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    if (arg === "--issues-jsonl") args.issuesJsonl = resolveFromSystemRoot(next());
    else if (arg === "--summary-json") args.summaryJson = resolveFromSystemRoot(next());
    else if (arg === "--output-dir") args.outputDir = resolveFromSystemRoot(next());
    else if (arg === "--image-dir") args.imageDir = resolveFromSystemRoot(next());
    else if (arg === "--prior-manual-review") {
      const value = resolveFromSystemRoot(next());
      args.priorManualReview = args.priorManualReview ?? value;
      args.priorManualReviews?.push(value);
    } else if (arg === "--prior-issues-jsonl") {
      const value = resolveFromSystemRoot(next());
      args.priorIssuesJsonl = args.priorIssuesJsonl ?? value;
      args.priorIssuesJsonls?.push(value);
    }
    else if (arg === "--limit") args.limit = positiveInt(next(), "--limit");
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }
  return args;
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

async function readJsonMaybe<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function outputRelative(base: string, path: string): string {
  return relative(base, path).replaceAll("\\", "/");
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function filenameSetKeyFromFilenames(filenames: string[]): string {
  return uniqueInOrder(filenames).slice().sort().join("\n");
}

function filenameSetKeyFromIssue(issue: PackedIssueRow): string {
  const truthGroups = issue.truth_groups ?? [];
  const filenames = uniqueInOrder(issue.all_filenames ?? truthGroups.flatMap((group) => group.filenames ?? []));
  return filenameSetKeyFromFilenames(filenames);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function priorDecisionRecord(value: unknown): PriorReviewDecision | null {
  const record = recordValue(value);
  if (!record) return null;
  return {
    issue_id: typeof record.issue_id === "string" ? record.issue_id : undefined,
    decision: typeof record.decision === "string" ? record.decision : undefined,
    pi_review_decision: typeof record.pi_review_decision === "string" ? record.pi_review_decision : undefined,
    pi_confidence: typeof record.pi_confidence === "string" ? record.pi_confidence : undefined,
    issue_type: typeof record.issue_type === "string" ? record.issue_type : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    proposed_grouping_text: typeof record.proposed_grouping_text === "string" ? record.proposed_grouping_text : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}

async function buildPriorReviewIndex(args: Args): Promise<PriorReviewIndex | null> {
  const manualReviewPaths = args.priorManualReviews?.length
    ? args.priorManualReviews
    : args.priorManualReview
      ? [args.priorManualReview]
      : [];
  if (!manualReviewPaths.length) return null;

  const decisionsByIssueId = new Map<string, PriorReviewDecision>();
  const sourceByIssueId = new Map<string, string>();
  for (const manualReviewPath of manualReviewPaths) {
    const manualReview = await readJsonMaybe<Record<string, unknown>>(manualReviewPath);
    const decisions = recordValue(manualReview?.decisions) ?? {};
    for (const [issueId, value] of Object.entries(decisions)) {
      const decision = priorDecisionRecord(value);
      if (!decision) continue;
      decisionsByIssueId.set(issueId, { ...decision, issue_id: decision.issue_id ?? issueId });
      sourceByIssueId.set(issueId, manualReviewPath);
    }
  }

  const issueIdByFilenameKey = new Map<string, string>();
  const priorIssuesJsonls = args.priorIssuesJsonls?.length
    ? args.priorIssuesJsonls
    : args.priorIssuesJsonl
      ? [args.priorIssuesJsonl]
      : [];
  for (const priorIssuesJsonl of priorIssuesJsonls) {
    const priorRows = await readJsonl<PackedIssueRow>(priorIssuesJsonl);
    for (const row of priorRows) {
      if (!row.issue_id || !decisionsByIssueId.has(row.issue_id)) continue;
      const key = filenameSetKeyFromIssue(row);
      if (key) issueIdByFilenameKey.set(key, row.issue_id);
    }
  }

  return {
    sourceManualReviewPaths: manualReviewPaths,
    decisionsByIssueId,
    sourceByIssueId,
    issueIdByFilenameKey,
  };
}

function priorHumanReviewFor(row: PackedIssueRow, filenames: string[], priorIndex: PriorReviewIndex | null): V3PriorHumanReview {
  const none: V3PriorHumanReview = { reviewed_before: false, match_type: "none" };
  if (!priorIndex) return none;
  const directDecision = priorIndex.decisionsByIssueId.get(row.issue_id);
  const filenameKey = filenameSetKeyFromFilenames(filenames);
  const filenameIssueId = filenameKey ? priorIndex.issueIdByFilenameKey.get(filenameKey) : undefined;
  const matchedIssueId = directDecision ? row.issue_id : filenameIssueId;
  const decision = matchedIssueId ? priorIndex.decisionsByIssueId.get(matchedIssueId) : null;
  if (!decision || !matchedIssueId) return none;
  return {
    reviewed_before: true,
    match_type: directDecision ? "issue_id" : "filename_set",
    prior_issue_id: matchedIssueId,
    prior_decision: decision.decision,
    prior_pi_review_decision: decision.pi_review_decision,
    prior_pi_confidence: decision.pi_confidence,
    prior_issue_type: decision.issue_type,
    prior_notes: decision.notes,
    prior_proposed_grouping_text: decision.proposed_grouping_text,
    prior_reviewed_at: decision.updated_at,
    source_manual_review_path: priorIndex.sourceByIssueId.get(matchedIssueId),
  };
}

function caseKind(issue: PackedIssueRow): ResidualCaseKind {
  if (issue.issue_type === "mixed" || (issue.has_merge && issue.has_split)) return "mixed_dispute";
  if (issue.issue_type === "false_merge" || issue.has_merge) return "merge_dispute";
  return "split_dispute";
}

function priority(issue: PackedIssueRow): ResidualPriority {
  if (issue.issue_type === "mixed") return "high";
  if ((issue.truth_group_count ?? 0) > 1 || (issue.filename_count ?? 0) >= 8) return "high";
  return "medium";
}

function whyListed(issue: PackedIssueRow): string {
  if (issue.issue_type === "false_merge") {
    return "The packed 80k prediction merged multiple reviewed-auto truth groups. Decide whether the truth groups should merge, be flagged as duplicates/same-view repeats, or stay separate as an algorithm false merge.";
  }
  if (issue.issue_type === "false_split") {
    return "The packed 80k prediction split a reviewed-auto truth group. Decide whether the truth group is already stable, or whether it should split by viewpoint, state change, scene, or image quality.";
  }
  return "The packed 80k prediction has connected split and merge residuals. Decide the smallest truth-data correction that explains the issue, or mark this as an algorithm issue.";
}

function issueFailureCounts(issue: PackedIssueRow): Record<string, number> {
  if (issue.issue_type === "mixed") return { false_merge: 1, false_split: 1, mixed: 1 };
  if (issue.issue_type === "false_merge") return { false_merge: 1 };
  if (issue.issue_type === "false_split") return { false_split: 1 };
  return {};
}

function isDatasetStabilityIssue(issue: PackedIssueRow): boolean {
  return typeof issue.schema_version === "string" && issue.schema_version.startsWith("dataset_stability_");
}

function issueSuites(issue: PackedIssueRow): string[] {
  const fromRow = uniqueInOrder(issue.suites ?? []);
  if (fromRow.length) return fromRow;
  return uniqueInOrder(
    (issue.evidence ?? [])
      .map((item) => (typeof item.suite === "string" ? item.suite : ""))
      .filter((item) => item.length > 0),
  );
}

function issueShards(issue: PackedIssueRow): string[] {
  const fromRow = uniqueInOrder(issue.shards ?? []);
  if (fromRow.length) return fromRow;
  return uniqueInOrder(
    (issue.evidence ?? [])
      .map((item) => {
        const suite = typeof item.suite === "string" ? item.suite : "";
        const shard = typeof item.shard === "string" ? item.shard : "";
        if (suite && shard) return `${suite}:${shard}`;
        return shard;
      })
      .filter((item) => item.length > 0),
  );
}

function lineageNote(issue: PackedIssueRow): string {
  if (isDatasetStabilityIssue(issue)) {
    return [
      "Dataset stability queue cases are selected from canonical risk-graph issue artifacts over the active Stability Preflight manifest.",
      "Each case carries suite/run evidence and risk-edge provenance from the stability campaign; exact prior-reviewed filename-set matches are excluded unless explicitly selected as changed context.",
    ].join(" ");
  }
  return "Packed issue cases are derived from the single v7 reviewed-auto issuepacked80 shard, so this queue is one deduplicated source of current v7 prediction residual issues.";
}

function visualRiskReason(issue: PackedIssueRow): string {
  if (isDatasetStabilityIssue(issue)) {
    const risk = recordValue(issue.risk_provenance);
    const tier = typeof risk?.max_risk_tier === "string" ? risk.max_risk_tier : "unknown";
    const score = typeof risk?.max_risk_score === "number" ? risk.max_risk_score : undefined;
    const edgeCount = typeof risk?.matched_edge_count === "number" ? risk.matched_edge_count : undefined;
    return [
      "Dataset stability risk graph surfaced this residual for final V3/Pi review.",
      `Max risk tier: ${tier}${score === undefined ? "" : ` (${score})`}.`,
      edgeCount === undefined ? "" : `Matched risk edges: ${edgeCount}.`,
    ]
      .filter((part) => part.length > 0)
      .join(" ");
  }
  return "Packed issue source concentrates known v7 residuals; decide data stability before algorithm changes.";
}

function systemPrompt(): string {
  return [
    "<role>",
    "You are the Resolution System V3 residual-case reviewer for AutoHDR truth grouping.",
    "</role>",
    "",
    "<purpose>",
    "Review one packed 80k issue case with x-high reasoning. Decide whether the current reviewed-auto truth data needs no change, a merge, a split, a duplicate flag, a rare image removal, or human policy review.",
    "</purpose>",
    "",
    "<strict_capture_contract>",
    "A strict capture group is only for images that should train as the same camera capture/view.",
    "Same strict capture allows exposure changes, white-balance changes, compression/noise, and only truly non-material stabilization jitter where fixed landmarks do not shift meaningfully.",
    "Same strict capture does not allow visible camera offset/translation, material yaw/rotation, changed crop/framing, zoom/focal-length change, changed parallax, same property from another angle, drone frames from different flight positions, or material scene-state changes.",
    "Before merging, inspect tiny differences carefully: slight offset, slight rotation, shifted wall/door/window/cabinet lines, changed foreground/background parallax, or any changed object/state means separate groups or human review, not a same-capture merge.",
    "</strict_capture_contract>",
    "",
    "<generated_visual_aids>",
    "When attached, gray 3x3 grid overlays help compare alignment, parallax, camera position, yaw/rotation, and framing. Ignore the grid as scene content.",
    "When attached, alignment residual sheets show luminance-normalized difference and edge-mismatch panels for selected same-case pairs. Use them as warnings for tiny viewpoint, rotation, crop/framing, parallax, or state differences, then verify against the original frames.",
    "</generated_visual_aids>",
    "",
    "<decision_rules>",
    "Choose algorithm_issue_no_truth_change when the current truth group is coherent and the prediction is the problem.",
    "Choose merge_truth_groups_same_capture only when all merged files share the same camera position, angle, zoom, framing, and stable landmark layout with no visible offset or state change.",
    "Choose merge_truth_groups_duplicate_or_same_view when the issue is duplicate-like or same-view repeated capture rather than a normal HDR bracket.",
    "Choose split_truth_group_viewpoint_change when camera position, yaw, height, distance, drone angle, perspective, crop/framing, or fixed-landmark alignment changes, even subtly, so the images should be capture negatives.",
    "Choose split_truth_group_state_change for visible material state changes such as door open/closed, blind/window/cover state, towel/object/furniture/vehicle moved, appliance state, light on/off, or water/fire feature state.",
    "Choose split_truth_group_multi_scene when a truth group mixes different rooms, areas, or scenes.",
    "Choose move_component_to_candidate_group only when a prediction part is a stronger same-view home for some or all current files, not merely a semantic room-type match.",
    "Choose remove_image_from_dataset sparingly, only when a specific image is unusable for training: severe blur, corrupt/blank placeholder, unrecoverable overexposure/underexposure, or very low-information content. Do not remove normal HDR exposure endpoints that still carry stable geometry.",
    "Choose needs_human_policy_review when evidence is too close to tell whether a tiny offset/rotation/state change is real. Do not use ambiguity as permission to merge visible alignment or state differences.",
    "Choose insufficient_evidence when images or evidence are too incomplete to make a defensible call.",
    "</decision_rules>",
    "",
    "<grid_note>",
    "When image attachments include a gray 3x3 grid, use it only to compare alignment, parallax, camera position, yaw/rotation, and framing. Ignore the grid as scene content.",
    "</grid_note>",
    "",
    "<output_rules>",
    "Return one valid JSON object only.",
    "Do not use markdown fences.",
    "Use schema_version v3_residual_case_review_0.1.",
    "Include every all_case_filenames value exactly once across grouping_plan.groups[].member_filenames.",
    "Do not include filenames absent from all_case_filenames.",
    "For viewer_update.duplicate_type, use none when duplicate_flag is false.",
    "For remove_image_from_dataset, put the unusable filename in a grouping_plan group with action removed_from_dataset and in quality_removal_recommendations.",
    "Name concrete visual landmarks in visual_reasoning. Do not rely only on filenames, group ids, prediction consensus, or semantic room labels.",
    "</output_rules>",
  ].join("\n");
}

function outputSchema(): unknown {
  return {
    schema_version: "v3_residual_case_review_0.1",
    object_id: "case id",
    decision: {
      review_decision: allowedReviewDecisions,
      truth_action: allowedTruthActions,
      confidence: "high | medium | low",
      requires_human_review: "boolean",
      selected_candidate_id: "candidate id or null",
      duplicate_flag: "boolean",
      duplicate_type: allowedDuplicateTypes,
    },
    assessments: {
      duplicate_assessment: allowedDuplicateTypes,
      viewpoint_assessment:
        "same_camera_position | minor_rotation_same_position | different_camera_position | aerial_different_angle | same_room_context_only | unclear",
      state_change_assessment:
        "none | door_open_closed | window_blind_or_cover_change | furniture_or_object_moved | lighting_only | exposure_only | unclear",
      image_quality_assessment:
        "usable | severe_blur | corrupt_or_blank | low_information | overexposed_unusable | underexposed_unusable | unclear",
      algorithm_issue: "boolean",
    },
    grouping_plan: {
      groups: [
        {
          proposed_group_id: "stable id",
          action:
            "unchanged_truth_group | merged_truth_group | split_from_truth_group | moved_to_candidate_group | removed_from_dataset | review_only",
          member_filenames: ["exact filenames from all_case_filenames"],
          source_truth_group_ids: ["truth group ids"],
          target_candidate_id: "optional candidate id",
          reason: "short visual reason",
        },
      ],
    },
    quality_removal_recommendations: [
      {
        filename: "exact filename from all_case_filenames",
        reason: "why this image is unusable rather than just difficult",
        severity: "severe | moderate | low",
        confidence: "high | medium | low",
      },
    ],
    visual_reasoning: {
      same_view_evidence: "stable landmarks that match, or why they do not",
      separation_evidence: "rotation/parallax/position/multi-scene evidence",
      state_change_evidence: "door/object/light/state differences or none",
      image_quality_evidence: "blur/corruption/low-info assessment; say none when all frames are usable",
      candidate_evidence: "prediction part fit/rejection",
      notes: "concise final rationale",
    },
    viewer_update: {
      decision:
        "algorithm_issue | merge_truth_groups | split_truth_group | move_to_candidate_group | remove_image_from_dataset | needs_more_review | insufficient_evidence",
      selected_candidate_id: "prediction group id or null",
      duplicate_flag: "boolean",
      duplicate_type: "potential_duplicate | same_view_repeat | repeated_capture | hard_duplicate | none",
      recommended_removed_filenames: ["exact filenames recommended for removal"],
      notes: "text suitable for the viewer notes box",
    },
  };
}

function userMessage(object: V3ResidualCaseObject, rawIssue: PackedIssueRow): string {
  return [
    `<run>`,
    `  <review_stage>resolution_v3_packed_issue_pi</review_stage>`,
    `  <object_id>${htmlEscape(object.object_id)}</object_id>`,
    `  <case_kind>${object.case_summary.case_kind}</case_kind>`,
    `  <priority>${object.case_summary.priority}</priority>`,
    `  <occurrence_count>${object.case_summary.occurrence_count}</occurrence_count>`,
    `</run>`,
    "",
    `<why_this_case_is_listed>${htmlEscape(object.case_summary.why_listed)}</why_this_case_is_listed>`,
    "",
    `<lineage>`,
    `  <manifest>${htmlEscape(object.lineage.baseline_manifest_path ?? "")}</manifest>`,
    `  <note>${htmlEscape(object.lineage.note)}</note>`,
    `</lineage>`,
    "",
    `<prior_human_review_json>`,
    JSON.stringify(object.prior_human_review ?? { reviewed_before: false, match_type: "none" }, null, 2),
    `</prior_human_review_json>`,
    "",
    `<attached_image_order>`,
    ...object.attached_images.map(
      (image, index) =>
        `  <image index="${index + 1}" role="${image.role}" filename="${htmlEscape(image.filename ?? "")}" exists="${image.exists}">${htmlEscape(image.source_path)}</image>`,
    ),
    `</attached_image_order>`,
    "",
    `<current_truth_groups_json>`,
    JSON.stringify(object.truth_groups, null, 2),
    `</current_truth_groups_json>`,
    "",
    `<prediction_parts_json>`,
    JSON.stringify(rawIssue.prediction_parts ?? [], null, 2),
    `</prediction_parts_json>`,
    "",
    `<all_case_filenames_json>`,
    JSON.stringify(object.all_case_filenames, null, 2),
    `</all_case_filenames_json>`,
    "",
    `<packed_issue_evidence_json>`,
    JSON.stringify(rawIssue.evidence ?? [], null, 2),
    `</packed_issue_evidence_json>`,
    "",
    `<risk_provenance_json>`,
    JSON.stringify(rawIssue.risk_provenance ?? {}, null, 2),
    `</risk_provenance_json>`,
    "",
    `<policy_focus>`,
    "First decide whether the current truth data is already correct. If yes, mark algorithm_issue_no_truth_change.",
    "Before any merge, compare fixed landmarks and scene state at high precision. Slight offset, rotation, crop/framing change, parallax shift, or moved/open/closed object means split or preserve separation.",
    "For merge-looking cases, explicitly distinguish same strict capture, duplicate/same-view repeat, and merely same-room/context similarity.",
    "For split-looking cases, explicitly check whether the prediction split is just exposure severity or a real viewpoint/state/scene split.",
    "If a single image is severely blurred, corrupt, blank, or unrecoverably low-information, consider remove_image_from_dataset. Use it very sparingly and explain why regrouping is not the right fix.",
    "For drone/aerial cases, different angles or flight positions are different strict groups even if the site is the same.",
    "For door-open/door-closed, towel/object movement, light/appliance changes, or other material state differences, split or preserve separation.",
    "If prior_human_review_json.reviewed_before is true, treat that prior human decision as important context from an earlier packed-issue pass. Do not blindly copy it: re-audit the current image evidence and current prediction/truth parts, then explain if you agree or disagree with the earlier human decision.",
    "</policy_focus>",
    "",
    `<output_schema>`,
    JSON.stringify(outputSchema(), null, 2),
    `</output_schema>`,
    "",
    "Return exactly one JSON object.",
  ].join("\n");
}

function buildAttachedImages(caseId: string, filenames: string[], imageDir: string): V3AttachedImage[] {
  return filenames.map((filename) => {
    const sourcePath = resolve(imageDir, filename);
    return {
      role: "truth_frame",
      source_path: sourcePath,
      filename,
      case_id: caseId,
      exists: existsSync(sourcePath),
    };
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const packedSummary = await readJsonMaybe<Record<string, unknown>>(args.summaryJson);
  const rows = (await readJsonl<PackedIssueRow>(args.issuesJsonl)).slice(0, args.limit ?? undefined);
  const priorReviewIndex = await buildPriorReviewIndex(args);
  await rm(resolve(args.outputDir, "objects"), { recursive: true, force: true });
  await mkdir(resolve(args.outputDir, "objects"), { recursive: true });

  const summaryRows: BuildSummaryRow[] = [];
  for (const row of rows) {
    const caseId = row.issue_id;
    const objectDir = resolve(args.outputDir, "objects", caseId);
    const agentInputDir = resolve(objectDir, "agent_input");
    await mkdir(agentInputDir, { recursive: true });

    const truthGroups = (row.truth_groups ?? []).map((group) => ({
      group_id: String(group.group_id ?? ""),
      member_count: Number(group.member_count ?? group.filenames?.length ?? 0),
      filenames: group.filenames ?? [],
      truncated: false,
    }));
    const predictionParts = (row.prediction_parts ?? []).map((part) => part.filenames ?? []).filter((part) => part.length > 0);
    const filenames = uniqueInOrder(row.all_filenames ?? truthGroups.flatMap((group) => group.filenames));
    const priorHumanReview = priorHumanReviewFor(row, filenames, priorReviewIndex);
    const attachedImages = buildAttachedImages(caseId, filenames, args.imageDir);
    const caseObjectPath = resolve(objectDir, "case_object.json");
    const systemPromptPath = resolve(agentInputDir, "system_prompt.md");
    const userMessagePath = resolve(agentInputDir, "user_message.md");

    const suites = issueSuites(row);
    const shards = issueShards(row);
    const runIds = uniqueInOrder((row.run_ids ?? []).filter((item) => typeof item === "string" && item.length > 0));
    const object: V3ResidualCaseObject = {
      schema_version: "v3_residual_case_0.1",
      object_id: caseId,
      source: isDatasetStabilityIssue(row) ? "dataset_stability_risk_graph_campaign" : "prediction_residual_truth_audit",
      generated_at: new Date().toISOString(),
      lineage: {
        residual_artifact_dir: dirname(args.issuesJsonl),
        baseline_manifest_path: typeof packedSummary?.source_manifest === "string" ? packedSummary.source_manifest : undefined,
        source_resolution_manifest_path: "solutions/v7/data/manifests/full_public_manifest_1024_q90_cleaned_pi_v2_auto_v3_reviewed.csv",
        image_count: typeof packedSummary?.filename_count === "number" ? packedSummary.filename_count : undefined,
        group_count: typeof packedSummary?.truth_group_count === "number" ? packedSummary.truth_group_count : undefined,
        run_count: typeof packedSummary?.run_count === "number" ? packedSummary.run_count : undefined,
        note: lineageNote(row),
      },
      ...(isDatasetStabilityIssue(row)
        ? {
            stability_provenance: {
              suites,
              shards,
              run_ids: runIds,
              risk_provenance: row.risk_provenance ?? {},
              evidence: row.evidence ?? [],
              queue: row.queue ?? {},
            },
          }
        : {}),
      case_summary: {
        case_id: caseId,
        case_kind: caseKind(row),
        priority: priority(row),
        occurrence_count: Number(row.occurrence_count ?? 1),
        candidate_count: 0,
        filename_count: filenames.length,
        prediction_part_count: predictionParts.length,
        failure_counts: issueFailureCounts(row),
        suites: suites.length ? suites : ["issuepacked80"],
        shards: shards.length ? shards : ["issuepacked80:shard_00"],
        why_listed: whyListed(row),
      },
      truth_groups: truthGroups,
      prediction_parts: predictionParts,
      all_case_filenames: filenames,
      visual_review: {
        verdict: "not_visual_reviewed",
        strict_or_context: "",
        visual_pattern: "",
        candidate_rationale: priorHumanReview.reviewed_before
          ? `This case was previously human reviewed (${priorHumanReview.prior_decision ?? "unknown decision"}); compare that prior conclusion against the current truth groups and prediction parts.`
          : "No external candidate votes are attached for packed issue review; compare current truth groups to prediction parts.",
        risk_reason: visualRiskReason(row),
        recommended_action: "review_truth_group_stability",
        reviewer: isDatasetStabilityIssue(row) ? "dataset_stability_v3_queue_preflight" : "v7_packed_issue_preflight",
      },
      candidate_votes: [],
      semantic_evidence: [],
      quality_review_hints: [],
      prior_human_review: priorHumanReview,
      review_packs: [],
      attached_images: attachedImages,
      output_contract: {
        review_schema_version: "v3_residual_case_review_0.1",
        allowed_review_decisions: [...allowedReviewDecisions],
        allowed_truth_actions: [...allowedTruthActions],
        allowed_duplicate_types: [...allowedDuplicateTypes],
        every_case_filename_once: true,
      },
      paths: {
        case_object_path: outputRelative(systemRoot, caseObjectPath),
        system_prompt_path: outputRelative(systemRoot, systemPromptPath),
        user_message_path: outputRelative(systemRoot, userMessagePath),
      },
    };

    await writeJson(caseObjectPath, object);
    await atomicWriteFile(systemPromptPath, `${systemPrompt()}\n`);
    await atomicWriteFile(userMessagePath, `${userMessage(object, row)}\n`);

    summaryRows.push({
      case_id: caseId,
      priority: object.case_summary.priority,
      case_kind: object.case_summary.case_kind,
      filename_count: filenames.length,
      truth_group_count: object.truth_groups.length,
      prediction_part_count: object.prediction_parts.length,
      candidate_vote_count: 0,
      attached_image_count: attachedImages.length,
      missing_attached_image_count: attachedImages.filter((image) => !image.exists).length,
      has_review_pack: false,
      reviewed_before: priorHumanReview.reviewed_before,
      prior_review_match_type: priorHumanReview.match_type,
      prior_issue_id: priorHumanReview.prior_issue_id ?? "",
      prior_decision: priorHumanReview.prior_decision ?? "",
      object_path: outputRelative(systemRoot, caseObjectPath),
    });
  }

  await writeCsv(resolve(args.outputDir, "case_inventory.csv"), Object.keys(summaryRows[0] ?? { case_id: "" }), summaryRows);
  await writeJson(resolve(args.outputDir, "preflight_summary.json"), {
    schema_version: "v3_packed_issue_preflight_summary_0.1",
    generated_at: new Date().toISOString(),
    source_issues_jsonl: args.issuesJsonl,
    source_summary_json: args.summaryJson,
    output_dir: args.outputDir,
    selected_case_count: rows.length,
    source_issue_count: packedSummary?.issue_count ?? rows.length,
    priorities: summaryRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.priority] = (acc[row.priority] ?? 0) + 1;
      return acc;
    }, {}),
    case_kinds: summaryRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.case_kind] = (acc[row.case_kind] ?? 0) + 1;
      return acc;
    }, {}),
    attached_image_count: summaryRows.reduce((sum, row) => sum + row.attached_image_count, 0),
    missing_attached_image_count: summaryRows.reduce((sum, row) => sum + row.missing_attached_image_count, 0),
    prior_human_review_count: summaryRows.filter((row) => row.reviewed_before).length,
    prior_human_review_decision_counts: summaryRows.reduce<Record<string, number>>((acc, row) => {
      if (!row.reviewed_before) return acc;
      const key = row.prior_decision || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    lineage: {
      source_summary: packedSummary,
      prior_manual_review: args.priorManualReviews?.length ? args.priorManualReviews : (args.priorManualReview ?? null),
        prior_issues_jsonl: args.priorIssuesJsonls?.length ? args.priorIssuesJsonls : (args.priorIssuesJsonl ?? null),
      note:
        "This v3 preflight is built from a deduplicated issue source so Pi review is tied to one consistent issue queue.",
    },
  });

  console.log(`Built ${rows.length} v3 packed issue objects in ${args.outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
