# Frame Match Relevance Design

## Problem

Issue #413 reports that frame tooling can identify a frame or stack-local
residual, but cannot say whether closing that residual is likely to affect the
match. In the CardState builder case, the residual was a distinct-home
40-byte-versus-36-byte command-buffer stride artifact. It moved frame metrics,
but real-tree match percentage stayed flat. Agents need an explicit relevance
signal so they do not spend rounds chasing offset-only frame noise.

## Goals

- Add a normalized match-relevance verdict to frame taxonomy output.
- Surface that verdict in `debug inspect stuck`, inventory JSONL/CSV/TSV rows,
  and existing frame residual hints.
- Label proven same-frame stack-slot placement residuals as match-neutral,
  because checkdiff localized them to paired stack-slot offsets with matching
  opcodes and equal frame size.
- Label pure frame reservation shortfalls as match-gating candidates, because
  they change emitted frame size and current tooling can probe them.
- Keep size/alignment and ceiling cases unknown unless probe evidence proves
  relevance.

## Non-Goals

- No backend force-frame or anti-coalescing operator.
- No claim that all frame-size deltas or frame-transform probe improvements are
  match-gating. A probe that moves the frame but leaves match percent flat is
  still relevance-unknown.
- No real-tree scoring inside `debug inspect stuck`; this is a conservative
  classification based on existing checkdiff and frame-report evidence.
- No change to checkdiff's byte-match definition.

## Data Contract

`classify_frame_taxonomy(...)` adds:

- `match_relevance`: `match-neutral`, `match-gating-candidate`, or `unknown`.
- `match_relevance_reason`: a short human-readable reason.

Initial mapping:

- `stack-object-offset-shift` -> `match-neutral` only when same-frame evidence
  is explicit (`classification.primary == "stack-slot-layout"` with
  stack-slot localizer/equal frame data, or frame report `frame_delta == 0`).
- `pure-reservation` -> `match-gating-candidate`.
- validated frame-transform verdicts stay `unknown` unless they are also a
  pure-reservation case with match-improving evidence added in a future change.
- `frame-too-large`, `stack-object-size-or-alignment`,
  `type-size-or-alignment`, `reserved-unused-low-spill-region`, ceilings,
  unresolved attribution, and same-shape offset shifts without explicit
  same-frame proof -> `unknown`.

## Integration

`debug inspect stuck` attaches the new fields through the existing frame
taxonomy hint path. Same-frame stack-slot messages explicitly mention a
match-neutral frame residual, while avoiding any claim that the whole byte
mismatch is irrelevant.

`tools/function_taxonomy_inventory.py` writes `frame_match_relevance` and
`frame_match_relevance_reason` to JSONL records, CSV, and stack-local queue TSVs.
Rows can then be filtered externally without changing harvest selection.

## Tests

- Unit tests for taxonomy relevance mapping:
  - same-frame stack-slot rows with explicit equal-frame/localizer evidence are
    `match-neutral`;
  - pure reservation rows are `match-gating-candidate`;
  - size/alignment rows remain `unknown`;
  - source-reachable frame movement on size/alignment remains `unknown`.
- CLI stuck JSON regression for same-frame stack-slot rows includes the
  `match-neutral` verdict and message text.
- Inventory regression proves JSONL, CSV, and TSV include
  `frame_match_relevance`.
