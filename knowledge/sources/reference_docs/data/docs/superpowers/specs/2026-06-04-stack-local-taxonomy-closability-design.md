# Stack Local Taxonomy Closability Design

## Goal

Implement issue #368 by making stack-local-layout taxonomy rows carry frame divergence cause, attribution, verdict, closability tier, and tier-specific next commands in the inventory, stuck digest, and dashboard.

## Context

`debug inspect frame-reservations` now emits first-divergence cause and verdict data, while `tools/function_taxonomy_inventory.py` still classifies stack-local-layout rows by broad checkdiff direction only. The dashboard and `debug inspect stuck` then route every frame-size row to the same frame tools and every same-frame slot row to lifetime-layout, so agents cannot distinguish rows closable with current PAD_STACK probes from rows gated on generator work or backend ceilings.

The inventory currently runs read-only `tools/checkdiff.py --format json --no-build --no-name-magic` for each non-100 function. That payload is always available, while pcdump-backed frame reports are optional. The feature should therefore prefer explicit frame-first-divergence payloads when present, but it must also produce useful pcdump-free approximations from checkdiff's stack diagnostics.

## Design

Add a small pure mapper in `tools/melee-agent/src/mwcc_debug/frame_taxonomy.py`. Its input is a checkdiff classification and an optional frame report. Its output is a normalized frame taxonomy object with:

- `cause`: `pure-reservation`, `lifetime-or-ordering-shift`, `frame-too-large`, `stack-object-offset-shift`, `stack-object-size-or-alignment`, `type-size-or-alignment`, `reserved-unused-low-spill-region`, or `unresolved-attribution`;
- `raw_cause`: the original `frame_first_divergence.cause_hypothesis.kind` or checkdiff marker;
- `source_object`: the full attributed source object for JSONL auditability;
- `source_object_symbol`: the scalar symbol/name used by TSV and dashboard displays;
- `attribution_status`: the frame report attribution status, or `checkdiff-only`;
- `raw_verdict`: the original base or validated verdict status when present;
- `verdict`: `source-reachable-candidate`, `source-reachable-validated`, `partial-source-reachable-validated`, `unresolved-source-attribution`, `attributed-frame-unchanged`, `internal-tiebreak-ceiling`, or `ceiling`;
- `closability_tier`: `current-tools-padstack`, `gen-gated-366`, `reorder-gated-362`, or `ceiling`;
- `next_command`: the command that should be run first for that tier.

The pcdump-backed path reads `frame_first_divergence.cause_hypothesis`, `source_attribution`, `verdict`, and `validated_verdict`. Raw cause kinds are preserved and normalized with this table:

- `extra-frame-reservation-or-alignment` -> `pure-reservation` when frame delta/current frame is too small, `frame-too-large` when the current frame over-reserves, otherwise `lifetime-or-ordering-shift`;
- `lifetime-or-ordering-shift` -> `lifetime-or-ordering-shift`;
- `stack-object-offset-shift` -> `stack-object-offset-shift`;
- `stack-object-size-or-alignment` and `type-size-or-alignment` are preserved as size/alignment causes and remain `gen-gated-366`;
- `extra-source-local-home`, `missing-source-local-home`, `extra-current-stack-object`, and `missing-current-stack-object` -> `lifetime-or-ordering-shift`;
- `stack-object-kind-change` and unknown kinds -> `unresolved-attribution`.

Validated verdicts override base verdict tiering: full/partial source-reachable validation keeps the row source-reachable, `attributed-frame-unchanged` stays generator-gated, and `internal-tiebreak-ceiling` becomes `ceiling`.

The pcdump-free path derives:

- `pure-reservation/current-tools-padstack` when `classification.primary == "stack-layout"` and `stack_frame_delta.missing_stack_bytes > 0`, because current frame is too small and current tools can probe with PAD_STACK;
- `frame-too-large/gen-gated-366` when `missing_stack_bytes < 0`, because the current source over-reserves and needs a remove-slot or FP-hoist generator;
- `lifetime-or-ordering-shift/gen-gated-366` for stack-layout rows whose frame delta is not pure smaller/larger or whose reasons indicate local/lifetime movement;
- `stack-object-offset-shift/reorder-gated-362` for plain same-frame `stack-slot-layout`;
- `reserved-unused-low-spill-region/ceiling` when `classification.stack_slot_localizer.reserved_low_spill_region` or `classification.stack_slot_layout_cause.kind == "reserved-unused-low-spill-region"` is present;
- `unresolved-attribution/ceiling` when no frame evidence is strong enough.

## Integration

`tools/function_taxonomy_inventory.py` will call the mapper for stack-local-layout rows. Because the inventory script sits outside the package, it will add `tools/melee-agent` to `sys.path` when needed and import `src.mwcc_debug.frame_taxonomy`. It will try a best-effort `debug inspect frame-reservations -f <function> --json` enrichment for stack rows so #360 source attribution can populate taxonomy records, falling back to checkdiff-only classification when the pcdump report is unavailable. `--skip-frame-report-attribution` keeps large inventory runs on the older checkdiff-only path when needed. Records and queue TSVs will gain `frame_cause`, `frame_raw_cause`, `frame_verdict`, `frame_raw_verdict`, `frame_closability_tier`, `frame_attribution_status`, `frame_source_object_symbol`, `frame_source_object`, and `frame_next_command`. For stack rows, `next_command` will be replaced by the mapper's tier-specific command. `describe_actionability` will use the tier to distinguish current-tool rows from generator-gated and ceiling rows.

`debug inspect stuck` will use the same mapper inside both `_frame_residual_hint_from_checkdiff_classification` and `_frame_residual_hint_from_report`, so static checkdiff-only digests and cached-pcdump frame reports both report the tier. Tier commands are executable tool commands, not instructions to commit diagnostic padding. For current-tools PADSTACK rows, the command starts with `melee-agent debug mutate frame-transform-search ... --operator frame-reservation-pad-stack --compile-probes --json`.

`tools/function_taxonomy_dashboard_template.html` will add a closability filter, include tier text in search/table/detail, and add a metric for current-tools stack rows. Existing data loading stays unchanged because the new fields live in `taxonomy.records.jsonl`.

## Testing

Regression tests will cover:

- inventory rows for pure reservation, frame-too-large, same-frame slot placement, and reserved low spill ceiling;
- queue TSVs include the new frame taxonomy columns;
- stuck static digest and pcdump-backed frame report hints return the same tier-specific next command for frame-size and same-frame cases;
- dashboard template has a closability filter and renders the tier in table/detail paths;
- dashboard data generation remains unchanged for JSONL embedding.

## Scope Boundaries

Inventory generation only runs `debug inspect frame-reservations` for stack-local-layout rows and treats failures as checkdiff-only rows. Full source-transform generation for `gen-gated-366` tiers remains out of scope; those rows point at the gated generator/search command rather than claiming a current-source fix.
