# AutoHDR Resolution System V3

Resolution v3 is a Pi-agent review system for the 677 prediction residual truth-audit cases.

It does not start a viewer or materialize corrections by itself. It builds auditable per-case objects, prompts a Pi agent, validates the structured output, and writes review JSON that can later be surfaced or materialized.

## Inputs

Default source artifacts:

- `objectives/prediction-residual-truth-audit/artifacts/canonical_dispute_cases.jsonl`
- `objectives/prediction-residual-truth-audit/artifacts/candidate_group_votes.jsonl`
- `objectives/prediction-residual-truth-audit/artifacts/visual_review_synthesis.csv`
- `objectives/prediction-residual-truth-audit/artifacts/review_pack_index.csv`
- `objectives/prediction-residual-truth-audit/artifacts/semantic_tag_evidence.csv`
- `objectives/prediction-residual-truth-audit/artifacts/baseline_residual_summary.json`

The baseline manifest is `final_group_audit_regrouped.pi_v2_auto.csv`, which is a child of the deduplication/resolution pipeline rather than the raw manifest.

## Rule Contract

The v3 decision rules are in [docs/rule_taxonomy.md](docs/rule_taxonomy.md).

V3 Pi runs now default to x-high reasoning. The prompt contract is strict: slight camera offsets, rotations, crop/framing shifts, parallax changes, or visible object/state changes should be split or preserved as separate groups unless the difference is only exposure/color/noise/compression or truly non-material stabilization jitter.

Grid overlays and generated alignment residual sheets are enabled by default. The residual sheet appends a left/right/diff/edge-mismatch contact sheet to the image prompt, using luminance-normalized differences to expose tiny rotations, ablations, crop shifts, parallax changes, and state changes that are easy to miss in the raw frames.

V3 also registers a Pi custom tool named `alignment_probe`. When a close decision hinges on tiny rotation, crop/framing, parallax, ablation, fixed-edge, or state differences, the agent can call the tool with exact filename pairs. The tool renders targeted residual evidence and returns ranked metrics plus the generated sheet before the agent writes final JSON.

Primary decisions:

- `algorithm_issue_no_truth_change`
- `merge_truth_groups_same_capture`
- `merge_truth_groups_duplicate_or_same_view`
- `split_truth_group_viewpoint_change`
- `split_truth_group_state_change`
- `split_truth_group_multi_scene`
- `move_component_to_candidate_group`
- `remove_image_from_dataset`
- `flag_possible_duplicate`
- `needs_human_policy_review`
- `insufficient_evidence`

`remove_image_from_dataset` is intentionally rare. Use it only for severe blur, corrupt/blank images, unrecoverable low-information frames, or similarly unusable images. A normal dark/bright HDR endpoint should stay in the bracket when stable geometry is still visible.

## Build Preflight Objects

Build all 677 case objects:

```sh
cd resolution_system_v3
bun run build-preflight
```

Build one case:

```sh
cd resolution_system_v3
bun run build-preflight -- --case-id case_a6cf82b65549
```

Outputs:

- `outputs/residual_case_preflight/objects/<case_id>/case_object.json`
- `outputs/residual_case_preflight/objects/<case_id>/agent_input/system_prompt.md`
- `outputs/residual_case_preflight/objects/<case_id>/agent_input/user_message.md`
- `outputs/residual_case_preflight/case_inventory.csv`
- `outputs/residual_case_preflight/preflight_summary.json`

## Dry Run Agent Packaging

Dry run one case without calling the model:

```sh
cd resolution_system_v3
bun run run-agent -- --object-id case_a6cf82b65549 --dry-run
```

Dry run all generated cases:

```sh
cd resolution_system_v3
bun run run-batch -- --dry-run-agents
```

## Run Pi Agents

Run one case:

```sh
cd resolution_system_v3
bun run run-agent -- --object-id case_bd36dd2bfefa
```

By default this uses `--thinking-level xhigh`, gray 3x3 grid overlays, and generated alignment residual sheets. Pass `--thinking-level medium` only when intentionally trading review quality for speed/cost. Use `--no-grid-overlay` or `--no-alignment-residuals` only for debugging or packaging-cost checks.

The run also exposes the `alignment_probe` custom tool to Pi. The tool is intended for ambiguous close cases, not for obviously different scenes or obvious exposure-only brackets.

Run the full batch:

```sh
cd resolution_system_v3
bun run run-batch -- --concurrency 1 --retry-count 0
```

Re-review only cases without saved human review:

```sh
cd resolution_system_v3
bun run run-batch -- --human-unreviewed-only --rerun-existing --concurrency 32 --retry-count 0
```

If a rerun stops on auth/rate-limit, resume only incomplete ledger records after re-auth:

```sh
cd resolution_system_v3
bun run run-batch -- --human-unreviewed-only --resume-incomplete --rerun-existing --concurrency 32 --retry-count 0
```

The batch runner writes:

- `outputs/residual_case_preflight/pi_batch_ledger.json`
- `outputs/run_logs/residual_v3_batch_<timestamp>.log`

Each case writes:

- `agent_output/raw_response.txt`
- `agent_output/pi_review.json`
- `agent_output/validation_report.json`
- `agent_output/run_summary.json`
- `agent_output/grid_overlay_manifest.json`
- `agent_output/alignment_residual_manifest.json`
- `agent_output/alignment_residual_images/alignment_residuals.jpg`
- optional `agent_output/alignment_probe_*_manifest.json`
- optional `agent_output/alignment_probe_images/alignment_probe_*.jpg`

## Validation

The runner validates:

- `schema_version` and `object_id`.
- Every case filename appears exactly once in `grouping_plan.groups`.
- No non-case filenames are introduced.
- Removal recommendations only reference case filenames.
- A `remove_image_from_dataset` decision includes `quality_removal_recommendations` and `viewer_update.recommended_removed_filenames`.
