export type V3CaseSchemaVersion = "v3_residual_case_0.1";
export type V3ReviewSchemaVersion = "v3_residual_case_review_0.1";
export type V3ObjectSource = "prediction_residual_truth_audit" | "dataset_stability_risk_graph_campaign";
export type ResidualCaseKind = "merge_dispute" | "split_dispute" | "mixed_dispute";
export type ResidualPriority = "high" | "medium" | "low";

export type V3ReviewDecision =
  | "algorithm_issue_no_truth_change"
  | "merge_truth_groups_same_capture"
  | "merge_truth_groups_duplicate_or_same_view"
  | "split_truth_group_viewpoint_change"
  | "split_truth_group_state_change"
  | "split_truth_group_multi_scene"
  | "move_component_to_candidate_group"
  | "remove_image_from_dataset"
  | "flag_possible_duplicate"
  | "needs_human_policy_review"
  | "insufficient_evidence";

export type V3TruthAction =
  | "no_change"
  | "merge_truth_groups"
  | "split_truth_group"
  | "move_to_candidate"
  | "remove_image"
  | "flag_duplicate_only"
  | "policy_review";

export type V3DuplicateType = "none" | "hard_duplicate" | "same_view_repeat" | "repeated_capture" | "possible_duplicate";

export type V3ViewpointAssessment =
  | "same_camera_position"
  | "minor_rotation_same_position"
  | "different_camera_position"
  | "aerial_different_angle"
  | "same_room_context_only"
  | "unclear";

export type V3StateChangeAssessment =
  | "none"
  | "door_open_closed"
  | "window_blind_or_cover_change"
  | "furniture_or_object_moved"
  | "lighting_only"
  | "exposure_only"
  | "unclear";

export type V3ImageQualityAssessment =
  | "usable"
  | "severe_blur"
  | "corrupt_or_blank"
  | "low_information"
  | "overexposed_unusable"
  | "underexposed_unusable"
  | "unclear";

export type V3Confidence = "high" | "medium" | "low";

export interface CanonicalTruthGroup {
  group_id: string;
  member_count: number;
  filenames: string[];
  truncated?: boolean;
}

export interface CandidateVote {
  candidate_id: string;
  case_id: string;
  candidate_action: string;
  candidate_group_ids: string[];
  candidate_filenames: string[];
  confidence_tier: string;
  support_families: string[];
  contradiction_families: string[];
  visual_review_status?: string;
  rejection_reason?: string;
  phase02_graph_evidence?: unknown;
  phase03_pair_evidence?: unknown;
  semantic_tag_evidence?: unknown;
  correction_history_evidence?: unknown;
  prefix_evidence?: unknown;
  prediction_evidence?: unknown;
}

export interface CompactCandidateVote {
  candidate_id: string;
  candidate_action: string;
  candidate_group_ids: string[];
  candidate_filenames: string[];
  confidence_tier: string;
  support_families: string[];
  contradiction_families: string[];
  visual_review_status?: string;
  rejection_reason?: string;
  metrics: {
    phase02_best_cheap?: number;
    phase02_best_knn_cos?: number;
    phase03_best_cheap?: number;
    phase03_best_knn_cos?: number;
    phase02_evidence_count?: number;
    phase03_evidence_count?: number;
  };
  examples: CompactCandidateExample[];
}

export interface CompactCandidateExample {
  source_filename?: string;
  neighbor_filename?: string;
  neighbor_group_id?: string;
  cheap?: number;
  knn_cos?: number;
  edge_iou?: number;
  hist_cdf?: number;
  mtb?: number;
  suite?: string;
  shard?: string;
}

export interface ReviewPackSheet {
  sheet_kind: string;
  sheet_path: string;
  render_status: string;
  missing_images: string[];
  candidate_id?: string;
}

export interface VisualReviewEvidence {
  verdict?: string;
  strict_or_context?: string;
  visual_pattern?: string;
  candidate_rationale?: string;
  risk_reason?: string;
  recommended_action?: string;
  reviewer?: string;
  notes_path?: string;
}

export interface SemanticEvidenceRow {
  group_id: string;
  filename: string;
  tag_source: string;
  status: string;
  capture_type: string;
  scene_summary: string;
  group_tags: string;
  confidence: string;
  evidence_role: string;
}

export interface V3AttachedImage {
  role: "review_sheet" | "truth_frame" | "candidate_frame";
  source_path: string;
  filename?: string;
  case_id: string;
  candidate_id?: string;
  group_ids?: string[];
  sheet_kind?: string;
  exists: boolean;
}

export interface V3QualityReviewHint {
  filename: string;
  hint: string;
  source: "user_provided" | "preflight_rule" | "prior_review";
}

export interface V3PriorHumanReview {
  reviewed_before: boolean;
  match_type: "issue_id" | "filename_set" | "none";
  prior_issue_id?: string;
  prior_decision?: string;
  prior_pi_review_decision?: string;
  prior_pi_confidence?: string;
  prior_issue_type?: string;
  prior_notes?: string;
  prior_proposed_grouping_text?: string;
  prior_reviewed_at?: string;
  source_manual_review_path?: string;
}

export interface V3ResidualCaseObject {
  schema_version: V3CaseSchemaVersion;
  object_id: string;
  source: V3ObjectSource;
  generated_at: string;
  lineage: {
    residual_artifact_dir: string;
    baseline_manifest_path?: string;
    source_resolution_manifest_path?: string;
    image_count?: number;
    group_count?: number;
    run_count?: number;
    note: string;
  };
  stability_provenance?: {
    suites: string[];
    shards: string[];
    run_ids: string[];
    risk_provenance: Record<string, unknown>;
    evidence: Record<string, unknown>[];
    queue: Record<string, unknown>;
  };
  case_summary: {
    case_id: string;
    case_kind: ResidualCaseKind;
    priority: ResidualPriority;
    occurrence_count: number;
    candidate_count: number;
    filename_count: number;
    prediction_part_count: number;
    failure_counts: Record<string, number>;
    suites: string[];
    shards: string[];
    why_listed: string;
  };
  truth_groups: CanonicalTruthGroup[];
  prediction_parts: string[][];
  all_case_filenames: string[];
  visual_review: VisualReviewEvidence | null;
  candidate_votes: CompactCandidateVote[];
  semantic_evidence: SemanticEvidenceRow[];
  quality_review_hints: V3QualityReviewHint[];
  prior_human_review?: V3PriorHumanReview;
  review_packs: ReviewPackSheet[];
  attached_images: V3AttachedImage[];
  output_contract: {
    review_schema_version: V3ReviewSchemaVersion;
    allowed_review_decisions: V3ReviewDecision[];
    allowed_truth_actions: V3TruthAction[];
    allowed_duplicate_types: V3DuplicateType[];
    every_case_filename_once: boolean;
  };
  paths: {
    case_object_path: string;
    system_prompt_path: string;
    user_message_path: string;
  };
}

export interface V3ResolvedGroup {
  proposed_group_id: string;
  action:
    | "unchanged_truth_group"
    | "merged_truth_group"
    | "split_from_truth_group"
    | "moved_to_candidate_group"
    | "removed_from_dataset"
    | "review_only";
  member_filenames: string[];
  source_truth_group_ids: string[];
  target_candidate_id?: string;
  reason: string;
}

export interface V3QualityRemovalRecommendation {
  filename: string;
  reason: string;
  severity: "severe" | "moderate" | "low";
  confidence: V3Confidence;
}

export interface V3ResidualCaseReview {
  schema_version: V3ReviewSchemaVersion;
  object_id: string;
  decision: {
    review_decision: V3ReviewDecision;
    truth_action: V3TruthAction;
    confidence: V3Confidence;
    requires_human_review: boolean;
    selected_candidate_id?: string | null;
    duplicate_flag: boolean;
    duplicate_type: V3DuplicateType;
  };
  assessments: {
    duplicate_assessment: V3DuplicateType;
    viewpoint_assessment: V3ViewpointAssessment;
    state_change_assessment: V3StateChangeAssessment;
    image_quality_assessment: V3ImageQualityAssessment;
    algorithm_issue: boolean;
  };
  grouping_plan: {
    groups: V3ResolvedGroup[];
  };
  quality_removal_recommendations: V3QualityRemovalRecommendation[];
  visual_reasoning: {
    same_view_evidence: string;
    separation_evidence: string;
    state_change_evidence: string;
    image_quality_evidence: string;
    candidate_evidence: string;
    notes: string;
  };
  viewer_update: {
    decision:
      | "algorithm_issue"
      | "merge_truth_groups"
      | "split_truth_group"
      | "move_to_candidate_group"
      | "remove_image_from_dataset"
      | "needs_more_review"
      | "insufficient_evidence";
    selected_candidate_id?: string | null;
    duplicate_flag: boolean;
    duplicate_type: "potential_duplicate" | "same_view_repeat" | "repeated_capture" | "hard_duplicate" | "none";
    recommended_removed_filenames: string[];
    notes: string;
  };
}
