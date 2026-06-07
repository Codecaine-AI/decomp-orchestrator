# Frame Size Transform Generation Design

## Goal

Implement issue #366 by making `debug mutate frame-transform-search --compile-probes` generate and score real frame-size-changing source probes for attributed frame-size divergences, starting with the common +/-8 byte reservation class.

## Context

`debug mutate frame-transform-search` already builds a frame reservation report, derives operator priorities, materializes source probes, compiles candidates, and feeds measured variants into `evaluate_frame_transform_probe_results`. The command currently advertises frame-size operators but does not supply a frame-reservation byte target to the source generator. `generate_frame_directed_probes` also returns no probes when the current frame is smaller than the expected frame, so too-small +8 cases cannot produce any directed source candidate. As a result, the command can report a bounded frame-transform ceiling after trying only generic lifetime probes that did not have a realistic chance to change the reserved frame size.

## Approaches Considered

1. **Derive a reservation probe target in the CLI and reuse existing `PAD_STACK` generation.** This is the smallest useful fix. It gives every current-vs-expected frame-size delta a concrete frame-reservation candidate, including explicit `--operator frame-reservation-pad-stack`, and keeps compile/scoring behavior unchanged. This is the chosen approach.

2. **Teach the generator to infer ObjObject/local-materialization transforms from frame attribution.** This could eventually generate richer local add/remove variants, but it needs semantic source attribution and would be too broad for the immediate #366 blocker.

3. **Change the evaluator to stop calling ceilings when only generic lifetime probes ran.** This would avoid overclaiming, but it would not generate the source variants that matching agents need. It is still a required guardrail, but not sufficient alone.

## Design

The feature has three small units.

First, `pressure_explorer.generate_frame_directed_probes` will accept an optional `frame_reservation_delta` argument. A positive value means the compiled frame is too small and should test adding that many no-access bytes; a negative value means the compiled frame is too large and should test removing that many no-access bytes from an existing explicit `PAD_STACK`. The PAD_STACK mutator will become delta-aware:

- no existing pad and positive delta: insert `PAD_STACK(delta)`;
- existing pad and positive delta: replace it with `PAD_STACK(previous + delta)`;
- existing pad larger than `abs(delta)` and negative delta: replace it with `PAD_STACK(previous - abs(delta))`;
- existing pad less than or equal to `abs(delta)` and negative delta: remove the `PAD_STACK` line;
- no existing pad and negative delta: emit no PAD_STACK probe because inserting a pad would worsen the frame size.

The generator will no longer return early for too-small frames. Instead, it will use the frame direction to choose which families are relevant: delta-aware PAD_STACK is allowed for both directions when it can produce a non-worsening edit; FP direct-literal, split-lifetime, and scratch-relocation probes remain shrink-oriented and are only generated when the current frame is larger than the target or when frame sizes are unavailable.

Second, `debug mutate frame-transform-search` will derive the signed reservation delta from the frame report. If current and expected frame sizes are available and differ, the signed delta is `expected - current`. For the issue's first target class this is `+8` or `-8`. The command passes this value to `generate_frame_directed_probes`. The existing operator filter continues to decide whether the generated PAD_STACK probe is retained, so `--operator frame-reservation-pad-stack` works as an explicit forced search.

Third, `evaluate_frame_transform_probe_results` will only emit `frame-transform-ceiling-candidate` when at least one successful measured variant came from a frame-size-capable operator and all such measured variants left the absolute delta unchanged. Generic lifetime fallback probes may still be listed and scored, but they no longer prove a frame-size ceiling by themselves.

## Output Contract

Generated PAD_STACK probes keep the existing `LifetimeLayoutProbe` shape:

- `operator`: `frame-reservation-pad-stack`
- `label`: `frame-reservation-pad-stack-<new-bytes>` for insert/replace, or `frame-reservation-pad-stack-remove-<old-bytes>` for removal
- `description`: explains the implicit reservation being tested
- `provenance.kind`: `frame-reservation-pad-stack`
- `provenance.delta`: the signed frame-size delta being tested
- `provenance.action`: `insert`, `increase`, `decrease`, or `remove`
- `provenance.previous_bytes`: present for edits to an existing pad
- `provenance.bytes`: present when the resulting source still has a positive `PAD_STACK(N)`

JSON output continues to include retained generated source paths in `probes[*].source_retained` and source-actionable metadata in both `probes` and measured `variants`.

## Error Handling

If no current or expected frame size is available, no automatic PAD_STACK byte target is derived. The command still supports explicit candidate scoring and any non-size probes generated by existing logic. If source is unavailable and no explicit candidates were supplied, the command preserves the existing `--compile-probes requires --source-file, repo source, or --candidate` error.

Ceiling output becomes conservative. A search with only generic lifetime probes and no frame-size-capable measured candidate reports `frame-transform-results-inconclusive`, not `frame-transform-ceiling-candidate`.

## Testing

Regression coverage will verify:

- `generate_frame_directed_probes` emits a `frame-reservation-pad-stack` source probe for a too-small +8 frame when a signed reservation delta is supplied.
- `generate_frame_directed_probes` decreases `PAD_STACK(16)` to `PAD_STACK(8)` for a too-large -8 frame.
- `generate_frame_directed_probes` removes `PAD_STACK(8)` for a too-large -8 frame.
- `generate_frame_directed_probes` emits no PAD_STACK probe for a too-large -8 frame when no explicit pad exists.
- `debug mutate frame-transform-search --operator frame-reservation-pad-stack --no-compile-probes --json` lists a retained PAD_STACK source probe for a +8 frame delta.
- `debug mutate frame-transform-search --compile-probes --operator frame-reservation-pad-stack` compiles and scores the generated PAD_STACK probe path when compiler/scoring helpers are faked.
- `evaluate_frame_transform_probe_results` does not classify a set of only generic unchanged probes as a bounded frame-size ceiling.

## Scope Boundaries

This implementation closes the #366 actuation gap for generated PAD_STACK frame-size probes in the first +/-8 no-access reservation class and prevents false ceilings when only generic fallback probes ran. It does not implement general semantic materialize/dematerialize source transforms for attributed locals. Those source levers need follow-up work with stronger side-effect and control-flow guards. `PAD_STACK` remains a diagnostic actuator for validating whether a no-access frame-size delta is source-reachable.
