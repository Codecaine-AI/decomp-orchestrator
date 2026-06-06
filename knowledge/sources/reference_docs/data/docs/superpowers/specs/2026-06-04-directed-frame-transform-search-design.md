# Directed Frame Transform Search Design

## Goal

Implement issue #361 by adding a reusable mwcc-debug command that turns the frame divergence report into a bounded source-transform search, compiles candidates, scores them against the expected frame size and final checkdiff match, and reports a source-reachable or ceiling verdict.

## Context

`debug inspect frame-reservations` already builds the current-vs-expected frame report and can validate probe results with `evaluate_frame_transform_probe_results`. `debug mutate lifetime-layout` already materializes source probes, compiles source candidates through the debug compiler path, scores final match percent, and retains generated source files. `generate_frame_directed_probes` already emits frame-specific source transforms for concrete frame levers, but only Tier 3 seed planning currently uses it.

## Approaches Considered

1. Extend `debug mutate lifetime-layout` with frame-specific flags.
   This reuses the most code, but keeps the frame workflow hidden inside a broad pressure explorer and does not make the divergence-keyed stop condition obvious.

2. Add a new `debug mutate frame-transform-search` command that wraps the existing frame report, directed probe generation, compile path, and frame validation.
   This gives matching agents a single command for the #361 workflow while avoiding a second compiler implementation. It is the chosen approach.

3. Add a full permuter-backed search engine immediately.
   This would support deeper composition, but it is too broad for #361's first deliverable. The new command should emit retained sources and structured scores so Tier 3/permuter follow-up can consume the same candidate set later.

## Design

The command will live under `debug mutate` as `frame-transform-search`. It uses `--pcdump` for the baseline dump, matching the existing `lifetime-layout` command. Its default path will:

1. Resolve the baseline pcdump for the target function.
2. Resolve expected target assembly unless `--no-expected` is supplied.
3. Build the frame reservation report with `analyze_frame_reservations`.
4. Derive a directed operator set from `frame_first_divergence.frame_transform_probe_plan.operator_priority`.
5. Generate frame-directed probes with `generate_frame_directed_probes`, and optionally add existing lifetime-layout probes filtered to the plan's operators.
6. Materialize generated sources into `--output-dir` or a retained temp directory when JSON output is requested.
7. Compile `.c` candidates with the existing `compile_source_variant` path and score real-tree match percent with `_score_source_candidate_real_tree`.
8. Convert candidate pcdumps into frame models with `analyze_frame_from_asm_text`.
9. Rank variants with `evaluate_frame_transform_probe_results`.
10. Print or emit JSON containing the frame report, probe plan, generated probes, ranked variants, validation verdict, and stop condition.

The command will also support repeatable `--candidate LABEL:OPERATOR=path` inputs, accepting either `.txt` pcdumps or `.c` source candidates. This keeps tests deterministic and lets agents score hand-written or permuter-generated probes without rerunning the generator.

## Output Contract

JSON output contains:

- `function`
- `ranking`
- `frame_report`
- `probe_plan`
- `operator_filter`
- `generated_source_dir`
- `probes`
- `variants`
- `frame_transform_probe_evaluation`
- `stop_condition`

Each successful variant includes:

- `label`
- `operator`
- `status`
- `path`
- `frame`
- `current_frame_size`
- `expected_frame_size`
- `remaining_frame_delta`
- `frame_delta_improvement`
- `match_percent` when available
- `source_retained` for source candidates
- `description` and `provenance` for generated probes
- nested `probe` metadata, including the transform class and source-actionable explanation

Failed candidates retain their source path, transform metadata, and error. Generated source files are retained whenever JSON output is requested, an explicit `--output-dir` is supplied, or any generated candidate fails. This gives agents a concrete source file to inspect or hand to a later permuter run.

The top-level `stop_condition` is copied from `frame_transform_probe_evaluation.stop_condition` for convenience; it is not independently computed.

## Bounded Search Semantics

The bounded search set is the union of:

- explicit `--candidate` inputs;
- frame-directed probes from `generate_frame_directed_probes`;
- optional lifetime-layout fallback probes whose operator is selected by the frame-divergence plan.

The operator set is also a union: built-in frame-directed operators, `frame_first_divergence.frame_transform_probe_plan.operator_priority`, and explicit `--operator` values. Generated probes are post-filtered by this union. `--max-probes` caps the generated probe count after filtering; explicit candidates are always scored.

The ceiling verdict is only valid when at least one measured candidate compiles and every measured candidate leaves the absolute frame-size delta unchanged. Build failures are preserved as evidence, but they do not by themselves prove a ceiling. If no candidates are supplied or generated, the command reports `no-probes`.

## Error Handling

If no expected frame is available, the command may still score explicit candidates or list generated probes, but validation reports a `no-target` verdict and preserves measured candidate evidence in the top-level `variants` list. If source is unavailable while generated probes are requested, it exits with a message telling the agent to pass `--source-file` or `--candidate`. Build failures are recorded per variant rather than aborting the whole search.

## Testing

Regression tests will cover:

- help surface includes `debug mutate frame-transform-search`;
- `.txt` candidate scoring ranks a frame-fixing candidate above unchanged output;
- generated probe planning uses frame-directed operators and returns retained source metadata without compiling when `--no-compile-probes`;
- source candidate compile path records match percent, retained source, compile failure variants, and `--no-score-match-percent`;
- no-probe/no-target behavior is explicit and preserves evidence.

## Scope Boundaries

This implementation completes the #361 direct search and validation workflow. It does not implement a new compiler allocator pass, full ObjObject source attribution, or multi-round permuter composition. Those remain covered by #358 and #360.
