import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCsvRecords, writeCsv, type CsvRecord } from "../io/csv.js";
import { writeJson } from "../io/json.js";
import { atomicWriteFile } from "../io/atomic.js";
import type {
  CandidateVote,
  CompactCandidateExample,
  CompactCandidateVote,
  ResidualCaseKind,
  ResidualPriority,
  ReviewPackSheet,
  SemanticEvidenceRow,
  V3AttachedImage,
  V3ResidualCaseObject,
  VisualReviewEvidence,
} from "../types.js";

type JsonObject = Record<string, unknown>;

interface Args {
  artifactDir: string;
  outputDir: string;
  imageDir: string;
  caseIds: string[];
  priority?: ResidualPriority | "all";
  limit?: number;
  maxCandidates: number;
  maxCandidateImages: number;
  maxSemanticRows: number;
}

interface RawCanonicalCase {
  candidate_count?: number;
  case_id: string;
  case_kind: ResidualCaseKind;
  failure_counts?: Record<string, number>;
  filenames?: string[];
  occurrence_count?: number;
  prediction_part_count?: number;
  prediction_parts?: string[][];
  priority: ResidualPriority;
  shards?: string[];
  suites?: string[];
  truth_groups?: Array<{
    group_id: string;
    member_count?: number;
    filenames?: string[];
    truncated?: boolean;
  }>;
}

interface BaselineSummary {
  manifest?: {
    path?: string;
    group_count?: number;
    image_count?: number;
  };
  run_count?: number;
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
  object_path: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "../../..");
const systemRoot = resolve(repoRoot, "resolution_system_v3");
const defaultArtifactDir = resolve(repoRoot, "objectives/prediction-residual-truth-audit/artifacts");
const defaultImageDir = resolve(repoRoot, "../data/datasets/full_1024_q90/images");
const defaultOutputDir = resolve(systemRoot, "outputs/residual_case_preflight");

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

const manualQualityHints: Record<string, Array<{ filename: string; hint: string; source: "user_provided" }>> = {
  case_a6cf82b65549: [
    {
      filename: "g54845_DSC02485.jpg",
      hint:
        "User flagged this frame as blurry/worthless. Inspect it directly and recommend remove_image_from_dataset if it is severely blurred, smeared, blown out, or otherwise unusable for training.",
      source: "user_provided",
    },
  ],
};

function usage(): string {
  return [
    "Usage:",
    "  bun run build-preflight -- [--artifact-dir <path>] [--output-dir <path>] [--image-dir <path>] [--case-id <id>] [--limit n]",
    "",
    "Defaults:",
    "  --artifact-dir ../objectives/prediction-residual-truth-audit/artifacts",
    "  --output-dir outputs/residual_case_preflight",
    "  --image-dir ../../data/datasets/full_1024_q90/images",
    "  --priority all",
    "  --max-candidates 8",
    "  --max-candidate-images 24",
    "  --max-semantic-rows 40",
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
    artifactDir: defaultArtifactDir,
    outputDir: defaultOutputDir,
    imageDir: defaultImageDir,
    caseIds: [],
    priority: "all",
    maxCandidates: 8,
    maxCandidateImages: 24,
    maxSemanticRows: 40,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    if (arg === "--artifact-dir") args.artifactDir = resolveFromSystemRoot(next());
    else if (arg === "--output-dir") args.outputDir = resolveFromSystemRoot(next());
    else if (arg === "--image-dir") args.imageDir = resolveFromSystemRoot(next());
    else if (arg === "--case-id") args.caseIds.push(next());
    else if (arg === "--priority") args.priority = next() as ResidualPriority | "all";
    else if (arg === "--limit") args.limit = positiveInt(next(), "--limit");
    else if (arg === "--max-candidates") args.maxCandidates = positiveInt(next(), "--max-candidates");
    else if (arg === "--max-candidate-images") args.maxCandidateImages = positiveInt(next(), "--max-candidate-images");
    else if (arg === "--max-semantic-rows") args.maxSemanticRows = positiveInt(next(), "--max-semantic-rows");
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

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compactExamples(value: unknown, limit: number): CompactCandidateExample[] {
  if (!isRecord(value) || !Array.isArray(value.examples)) return [];
  return value.examples
    .filter(isRecord)
    .slice(0, limit)
    .map((example) => ({
      source_filename: typeof example.source_filename === "string" ? example.source_filename : undefined,
      neighbor_filename: typeof example.neighbor_filename === "string" ? example.neighbor_filename : undefined,
      neighbor_group_id: typeof example.neighbor_group_id === "string" ? example.neighbor_group_id : undefined,
      cheap: numberValue(example.cheap),
      knn_cos: numberValue(example.knn_cos),
      edge_iou: numberValue(example.edge_iou),
      hist_cdf: numberValue(example.hist_cdf),
      mtb: numberValue(example.mtb),
      suite: typeof example.suite === "string" ? example.suite : undefined,
      shard: typeof example.shard === "string" ? example.shard : undefined,
    }));
}

function compactVote(vote: CandidateVote): CompactCandidateVote {
  const phase02 = isRecord(vote.phase02_graph_evidence) ? vote.phase02_graph_evidence : {};
  const phase03 = isRecord(vote.phase03_pair_evidence) ? vote.phase03_pair_evidence : {};
  return {
    candidate_id: vote.candidate_id,
    candidate_action: vote.candidate_action,
    candidate_group_ids: vote.candidate_group_ids ?? [],
    candidate_filenames: vote.candidate_filenames ?? [],
    confidence_tier: vote.confidence_tier ?? "",
    support_families: vote.support_families ?? [],
    contradiction_families: vote.contradiction_families ?? [],
    visual_review_status: vote.visual_review_status,
    rejection_reason: vote.rejection_reason,
    metrics: {
      phase02_best_cheap: numberValue(phase02.best_cheap),
      phase02_best_knn_cos: numberValue(phase02.best_knn_cos),
      phase03_best_cheap: numberValue(phase03.best_cheap),
      phase03_best_knn_cos: numberValue(phase03.best_knn_cos),
      phase02_evidence_count: numberValue(phase02.evidence_count),
      phase03_evidence_count: numberValue(phase03.evidence_count),
    },
    examples: [...compactExamples(vote.phase02_graph_evidence, 3), ...compactExamples(vote.phase03_pair_evidence, 3)].slice(0, 6),
  };
}

function candidateSortKey(vote: CandidateVote): [number, number, string] {
  if (vote.candidate_action === "algorithm_issue_no_correction") return [0, 0, vote.candidate_id];
  const tier = vote.confidence_tier ?? "";
  const tierScore = tier.startsWith("high") ? 1 : tier.startsWith("medium") ? 2 : tier.includes("low_plus") ? 3 : 4;
  const contradictionPenalty = (vote.contradiction_families ?? []).length;
  return [tierScore, contradictionPenalty, vote.candidate_id];
}

function groupByCase<T extends { case_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const values = grouped.get(row.case_id) ?? [];
    values.push(row);
    grouped.set(row.case_id, values);
  }
  return grouped;
}

function visualReviewFromCsv(row: CsvRecord | undefined): VisualReviewEvidence | null {
  if (!row) return null;
  return {
    verdict: row.visual_verdict,
    strict_or_context: row.strict_or_context,
    visual_pattern: row.visual_pattern,
    candidate_rationale: row.candidate_rationale,
    risk_reason: row.risk_reason,
    recommended_action: row.recommended_action,
    reviewer: row.reviewer,
    notes_path: row.notes_path,
  };
}

function semanticRow(row: CsvRecord): SemanticEvidenceRow {
  return {
    group_id: row.group_id,
    filename: row.filename,
    tag_source: row.tag_source,
    status: row.status,
    capture_type: row.capture_type,
    scene_summary: row.scene_summary,
    group_tags: row.group_tags,
    confidence: row.confidence,
    evidence_role: row.evidence_role,
  };
}

function reviewPackSheet(row: CsvRecord): ReviewPackSheet {
  return {
    sheet_kind: row.sheet_kind,
    sheet_path: row.sheet_path,
    render_status: row.render_status,
    missing_images: row.missing_images ? row.missing_images.split(";").filter(Boolean) : [],
    candidate_id: row.candidate_id || undefined,
  };
}

function whyListed(caseRecord: RawCanonicalCase): string {
  if (caseRecord.case_kind === "merge_dispute") {
    return "Prediction evidence repeatedly joined images from multiple current truth groups. Decide whether those truth groups should merge, be flagged as duplicate/same-view repeats, or stay separate as an algorithm over-merge.";
  }
  if (caseRecord.case_kind === "split_dispute") {
    return "Prediction evidence repeatedly split one current truth group into multiple prediction parts. Decide whether the truth group is coherent, should split by viewpoint/state/scene, or needs a move to a candidate group.";
  }
  return "Prediction evidence has both split and merge residuals. Decide the smallest truth correction that explains both directions.";
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

function systemPrompt(): string {
  return [
    "<role>",
    "You are the Resolution System V3 residual-case reviewer for AutoHDR truth grouping.",
    "</role>",
    "",
    "<purpose>",
    "Review one prediction residual case with x-high reasoning. Decide whether the current truth data needs no change, a merge, a split, a move to a candidate group, a duplicate flag, or human policy review.",
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
    "When attached, alignment residual sheets show luminance-normalized difference and edge-mismatch panels for selected same-case or candidate pairs. Use them as warnings for tiny viewpoint, rotation, crop/framing, parallax, or state differences, then verify against the original frames.",
    "</generated_visual_aids>",
    "",
    "<decision_rules>",
    "Choose algorithm_issue_no_truth_change when the current truth group is coherent and the prediction is the problem.",
    "Choose merge_truth_groups_same_capture only when all merged files share the same camera position, angle, zoom, framing, and stable landmark layout with no visible offset or state change.",
    "Choose merge_truth_groups_duplicate_or_same_view when the issue is duplicate-like or same-view repeated capture rather than a normal HDR bracket.",
    "Choose split_truth_group_viewpoint_change when camera position, yaw, height, distance, drone angle, perspective, crop/framing, or fixed-landmark alignment changes, even subtly, so the images should be capture negatives.",
    "Choose split_truth_group_state_change for visible material state changes such as door open/closed, blind/window/cover state, towel/object/furniture/vehicle moved, appliance state, light on/off, or water/fire feature state.",
    "Choose split_truth_group_multi_scene when a truth group mixes different rooms, areas, or scenes.",
    "Choose move_component_to_candidate_group only when a candidate group is a stronger same-view home for some or all current files, not merely a semantic room-type match.",
    "Choose remove_image_from_dataset sparingly, only when a specific image is unusable for training: severe blur, corrupt/blank placeholder, unrecoverable overexposure/underexposure, or very low-information content. Do not remove normal HDR exposure endpoints that still carry stable geometry.",
    "Choose needs_human_policy_review when evidence is too close to tell whether a tiny offset/rotation/state change is real. Do not use ambiguity as permission to merge visible alignment or state differences.",
    "Choose insufficient_evidence when images or evidence are too incomplete to make a defensible call.",
    "</decision_rules>",
    "",
    "<example_calibration>",
    "case_bd36dd2bfefa: coherent bedroom exposure bracket split by prediction, so algorithm_issue_no_truth_change.",
    "case_57a79dae0723: drone/aerial frames from different angles should split by viewpoint if visual evidence confirms angle change.",
    "case_09e6be1c60f3: duplicate-looking bathroom brackets should be checked for hard duplicate, same_view_repeat, or repeated_capture before merging.",
    "case_d6745ea98397: similar bedroom brackets require a strict rotation/parallax check. If fixed landmarks shift from slight offset or rotation, keep separate; merge only if differences are exposure or non-material jitter.",
    "case_a6cf82b65549: if g54845_DSC02485.jpg is confirmed severely blurry and worthless, recommend remove_image_from_dataset for that filename while keeping/remapping the usable frames.",
    "</example_calibration>",
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
      candidate_evidence: "candidate fit/rejection",
      notes: "concise final rationale",
    },
    viewer_update: {
      decision:
        "algorithm_issue | merge_truth_groups | split_truth_group | move_to_candidate_group | remove_image_from_dataset | needs_more_review | insufficient_evidence",
      selected_candidate_id: "candidate id or null",
      duplicate_flag: "boolean",
      duplicate_type: "potential_duplicate | same_view_repeat | repeated_capture | hard_duplicate | none",
      recommended_removed_filenames: ["exact filenames recommended for removal"],
      notes: "text suitable for the viewer notes box",
    },
  };
}

function userMessage(object: V3ResidualCaseObject): string {
  return [
    `<run>`,
    `  <review_stage>resolution_v3_residual_case_pi</review_stage>`,
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
    `<attached_image_order>`,
    ...object.attached_images.map(
      (image, index) =>
        `  <image index="${index + 1}" role="${image.role}" sheet_kind="${htmlEscape(image.sheet_kind ?? "")}" filename="${htmlEscape(
          image.filename ?? "",
        )}" candidate_id="${htmlEscape(image.candidate_id ?? "")}" exists="${image.exists}">${htmlEscape(image.source_path)}</image>`,
    ),
    `</attached_image_order>`,
    "",
    `<current_truth_groups_json>`,
    JSON.stringify(object.truth_groups, null, 2),
    `</current_truth_groups_json>`,
    "",
    `<prediction_parts_json>`,
    JSON.stringify(object.prediction_parts, null, 2),
    `</prediction_parts_json>`,
    "",
    `<all_case_filenames_json>`,
    JSON.stringify(object.all_case_filenames, null, 2),
    `</all_case_filenames_json>`,
    "",
    `<prior_visual_review_json>`,
    JSON.stringify(object.visual_review, null, 2),
    `</prior_visual_review_json>`,
    "",
    `<candidate_votes_json>`,
    JSON.stringify(object.candidate_votes, null, 2),
    `</candidate_votes_json>`,
    "",
    `<semantic_evidence_json>`,
    JSON.stringify(object.semantic_evidence, null, 2),
    `</semantic_evidence_json>`,
    "",
    `<quality_review_hints_json>`,
    JSON.stringify(object.quality_review_hints, null, 2),
    `</quality_review_hints_json>`,
    "",
    `<policy_focus>`,
    "First decide whether the current truth data is already correct. If yes, mark algorithm_issue_no_truth_change.",
    "Before any merge, compare fixed landmarks and scene state at high precision. Slight offset, rotation, crop/framing change, parallax shift, or moved/open/closed object means split or preserve separation.",
    "For merge-looking cases, explicitly distinguish same strict capture, duplicate/same-view repeat, and merely same-room/context similarity.",
    "For split-looking cases, explicitly check whether the prediction split is just exposure severity or a real viewpoint/state/scene split.",
    "If a single image is severely blurred, corrupt, blank, or unrecoverably low-information, consider remove_image_from_dataset. Use it very sparingly and explain why regrouping is not the right fix.",
    "For drone/aerial cases, different angles or flight positions are different strict groups even if the site is the same.",
    "For door-open/door-closed, towel/object movement, light/appliance changes, or other material state differences, split or preserve separation.",
    "</policy_focus>",
    "",
    `<output_schema>`,
    JSON.stringify(outputSchema(), null, 2),
    `</output_schema>`,
    "",
    "Return exactly one JSON object.",
  ].join("\n");
}

function firstUniqueImages(votes: CompactCandidateVote[], maxImages: number): Array<{ filename: string; candidate: CompactCandidateVote }> {
  const seen = new Set<string>();
  const images: Array<{ filename: string; candidate: CompactCandidateVote }> = [];
  for (const vote of votes) {
    for (const filename of vote.candidate_filenames) {
      if (seen.has(filename)) continue;
      seen.add(filename);
      images.push({ filename, candidate: vote });
      if (images.length >= maxImages) return images;
    }
  }
  return images;
}

function selectVotes(votes: CandidateVote[], maxCandidates: number): CompactCandidateVote[] {
  return [...votes]
    .sort((a, b) => {
      const left = candidateSortKey(a);
      const right = candidateSortKey(b);
      return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2], undefined, { numeric: true });
    })
    .slice(0, maxCandidates)
    .map(compactVote);
}

function buildAttachedImages(params: {
  caseId: string;
  imageDir: string;
  reviewPacks: ReviewPackSheet[];
  filenames: string[];
  candidates: CompactCandidateVote[];
  maxCandidateImages: number;
}): V3AttachedImage[] {
  const attached: V3AttachedImage[] = [];
  for (const sheet of params.reviewPacks) {
    attached.push({
      role: "review_sheet",
      source_path: sheet.sheet_path,
      case_id: params.caseId,
      candidate_id: sheet.candidate_id,
      sheet_kind: sheet.sheet_kind,
      exists: existsSync(sheet.sheet_path),
    });
  }
  for (const filename of params.filenames) {
    const sourcePath = resolve(params.imageDir, filename);
    attached.push({
      role: "truth_frame",
      source_path: sourcePath,
      filename,
      case_id: params.caseId,
      exists: existsSync(sourcePath),
    });
  }
  for (const { filename, candidate } of firstUniqueImages(params.candidates, params.maxCandidateImages)) {
    const sourcePath = resolve(params.imageDir, filename);
    attached.push({
      role: "candidate_frame",
      source_path: sourcePath,
      filename,
      case_id: params.caseId,
      candidate_id: candidate.candidate_id,
      group_ids: candidate.candidate_group_ids,
      exists: existsSync(sourcePath),
    });
  }
  return attached;
}

function semanticGroupIds(caseRecord: RawCanonicalCase, candidates: CompactCandidateVote[]): Set<string> {
  return new Set([
    ...(caseRecord.truth_groups ?? []).map((group) => group.group_id),
    ...candidates.flatMap((candidate) => candidate.candidate_group_ids),
  ]);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const canonicalCasesPath = resolve(args.artifactDir, "canonical_dispute_cases.jsonl");
  const candidateVotesPath = resolve(args.artifactDir, "candidate_group_votes.jsonl");
  const visualSynthesisPath = resolve(args.artifactDir, "visual_review_synthesis.csv");
  const reviewPackIndexPath = resolve(args.artifactDir, "review_pack_index.csv");
  const semanticEvidencePath = resolve(args.artifactDir, "semantic_tag_evidence.csv");
  const baselineSummaryPath = resolve(args.artifactDir, "baseline_residual_summary.json");

  const cases = await readJsonl<RawCanonicalCase>(canonicalCasesPath);
  const votesByCase = groupByCase(await readJsonl<CandidateVote>(candidateVotesPath));
  const visualByCase = new Map((await readCsvRecords(visualSynthesisPath)).map((row) => [row.case_id, row]));
  const reviewPacksByCase = groupByCase((await readCsvRecords(reviewPackIndexPath)).map((row) => ({ case_id: row.case_id, ...reviewPackSheet(row) })));
  const semanticRows = await readCsvRecords(semanticEvidencePath);
  const baseline = await readJsonMaybe<BaselineSummary>(baselineSummaryPath);

  const selected = cases
    .filter((caseRecord) => (args.caseIds.length > 0 ? args.caseIds.includes(caseRecord.case_id) : true))
    .filter((caseRecord) => (args.priority && args.priority !== "all" ? caseRecord.priority === args.priority : true))
    .slice(0, args.limit ?? cases.length);

  if (args.caseIds.length > 0) {
    const found = new Set(selected.map((caseRecord) => caseRecord.case_id));
    const missing = args.caseIds.filter((caseId) => !found.has(caseId));
    if (missing.length > 0) throw new Error(`Requested case ids not found: ${missing.join(", ")}`);
  }

  await mkdir(resolve(args.outputDir, "objects"), { recursive: true });
  const summaryRows: BuildSummaryRow[] = [];

  for (const caseRecord of selected) {
    const objectDir = resolve(args.outputDir, "objects", caseRecord.case_id);
    const agentInputDir = resolve(objectDir, "agent_input");
    await mkdir(agentInputDir, { recursive: true });

    const votes = selectVotes(votesByCase.get(caseRecord.case_id) ?? [], args.maxCandidates);
    const semanticIds = semanticGroupIds(caseRecord, votes);
    const caseFilenames = caseRecord.filenames ?? caseRecord.truth_groups?.flatMap((group) => group.filenames ?? []) ?? [];
    const semanticEvidence = semanticRows
      .filter((row) => row.case_id === caseRecord.case_id && (semanticIds.has(row.group_id) || caseFilenames.includes(row.filename)))
      .slice(0, args.maxSemanticRows)
      .map(semanticRow);
    const reviewPacks = (reviewPacksByCase.get(caseRecord.case_id) ?? []).map((sheet) => ({
      sheet_kind: sheet.sheet_kind,
      sheet_path: sheet.sheet_path,
      render_status: sheet.render_status,
      missing_images: sheet.missing_images,
      candidate_id: sheet.candidate_id,
    }));
    const attachedImages = buildAttachedImages({
      caseId: caseRecord.case_id,
      imageDir: args.imageDir,
      reviewPacks,
      filenames: caseFilenames,
      candidates: votes,
      maxCandidateImages: args.maxCandidateImages,
    });

    const caseObjectPath = resolve(objectDir, "case_object.json");
    const systemPromptPath = resolve(agentInputDir, "system_prompt.md");
    const userMessagePath = resolve(agentInputDir, "user_message.md");

    const object: V3ResidualCaseObject = {
      schema_version: "v3_residual_case_0.1",
      object_id: caseRecord.case_id,
      source: "prediction_residual_truth_audit",
      generated_at: new Date().toISOString(),
      lineage: {
        residual_artifact_dir: args.artifactDir,
        baseline_manifest_path: baseline?.manifest?.path,
        source_resolution_manifest_path: "resolution_system/outputs/full_resolution_objects/materialization/cleaned_manifest.pi_v2_auto.csv",
        image_count: baseline?.manifest?.image_count,
        group_count: baseline?.manifest?.group_count,
        run_count: baseline?.run_count,
        note:
          "Residual cases are from final_group_audit_regrouped.pi_v2_auto.csv, a child of the prior deduplication/resolution materialization rather than the raw manifest.",
      },
      case_summary: {
        case_id: caseRecord.case_id,
        case_kind: caseRecord.case_kind,
        priority: caseRecord.priority,
        occurrence_count: caseRecord.occurrence_count ?? 0,
        candidate_count: caseRecord.candidate_count ?? 0,
        filename_count: caseFilenames.length,
        prediction_part_count: caseRecord.prediction_part_count ?? caseRecord.prediction_parts?.length ?? 0,
        failure_counts: caseRecord.failure_counts ?? {},
        suites: caseRecord.suites ?? [],
        shards: caseRecord.shards ?? [],
        why_listed: whyListed(caseRecord),
      },
      truth_groups: (caseRecord.truth_groups ?? []).map((group) => ({
        group_id: group.group_id,
        member_count: group.member_count ?? group.filenames?.length ?? 0,
        filenames: group.filenames ?? [],
        truncated: group.truncated,
      })),
      prediction_parts: caseRecord.prediction_parts ?? [],
      all_case_filenames: caseFilenames,
      visual_review: visualReviewFromCsv(visualByCase.get(caseRecord.case_id)),
      candidate_votes: votes,
      semantic_evidence: semanticEvidence,
      quality_review_hints: manualQualityHints[caseRecord.case_id] ?? [],
      review_packs: reviewPacks,
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
    await atomicWriteFile(userMessagePath, `${userMessage(object)}\n`);

    summaryRows.push({
      case_id: caseRecord.case_id,
      priority: caseRecord.priority,
      case_kind: caseRecord.case_kind,
      filename_count: caseFilenames.length,
      truth_group_count: object.truth_groups.length,
      prediction_part_count: object.prediction_parts.length,
      candidate_vote_count: votes.length,
      attached_image_count: attachedImages.length,
      missing_attached_image_count: attachedImages.filter((image) => !image.exists).length,
      has_review_pack: reviewPacks.length > 0,
      object_path: outputRelative(systemRoot, caseObjectPath),
    });
  }

  await writeCsv(resolve(args.outputDir, "case_inventory.csv"), Object.keys(summaryRows[0] ?? { case_id: "" }), summaryRows);
  await writeJson(resolve(args.outputDir, "preflight_summary.json"), {
    schema_version: "v3_residual_case_preflight_summary_0.1",
    generated_at: new Date().toISOString(),
    artifact_dir: args.artifactDir,
    output_dir: args.outputDir,
    selected_case_count: selected.length,
    canonical_case_count: cases.length,
    priorities: selected.reduce<Record<string, number>>((acc, row) => {
      acc[row.priority] = (acc[row.priority] ?? 0) + 1;
      return acc;
    }, {}),
    case_kinds: selected.reduce<Record<string, number>>((acc, row) => {
      acc[row.case_kind] = (acc[row.case_kind] ?? 0) + 1;
      return acc;
    }, {}),
    attached_image_count: summaryRows.reduce((sum, row) => sum + row.attached_image_count, 0),
    missing_attached_image_count: summaryRows.reduce((sum, row) => sum + row.missing_attached_image_count, 0),
    cases_with_review_pack: summaryRows.filter((row) => row.has_review_pack).length,
    lineage: {
      baseline_manifest_path: baseline?.manifest?.path,
      source_resolution_manifest_path: "resolution_system/outputs/full_resolution_objects/materialization/cleaned_manifest.pi_v2_auto.csv",
      image_count: baseline?.manifest?.image_count,
      group_count: baseline?.manifest?.group_count,
      run_count: baseline?.run_count,
      note:
        "This v3 preflight is built from the prediction residual truth audit, whose baseline manifest is a child of deduplication/resolution materialization.",
    },
  });

  console.log(`Built ${selected.length} v3 residual case objects in ${args.outputDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
