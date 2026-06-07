# Concurrent Buffer Lifetime Suggest Design

## Problem

Issue #406 originally described the CARD builder residual as a
frame-overlay/coalescing problem: target ASM reserves distinct 40-byte,
8-aligned command buffers, while current source was believed to overlap or
coalesce `cmd[9]` buffers into 36-byte homes.

Issue #412 corrects that premise. In the CardState round-6 evidence, both REF
and MINE pass distinct, non-overlapping command-buffer homes to `fn_803AC168`.
The residual is a 40-byte target stride versus a tight 36-byte current stride,
not an overlap/coalesce difference. Forcing `cmd[10]` can reproduce the 40-byte
stride, but match percentage stays flat, so the stride residual is a real frame
metric artifact and not a match lever.

Issue #407 remains valid only for the narrower evidence class where current
ASM actually reuses the same stack home for multiple consumer calls. The
existing `debug suggest control-flow-shape` command is the right place to
surface that source hypothesis because it already compares target/current ASM
without a pcdump cache.

## Goals

- Extend `melee-agent debug suggest control-flow-shape` with an ASM-only
  detector for stack-address consumer homes.
- Detect a frame-overlay subclass where target passes many distinct stack homes
  to the same consumer call, while current reuses at least one stack home for
  that same consumer.
- Suppress stride/alignment-only cases where all current homes are distinct,
  including the CardState 40-vs-36 command-buffer residual from #412.
- Emit a ranked source-shape suggestion named `concurrent-buffer-lifetime`.
- Recommend a control-flow/lifetime source re-attack before any backend
  force-frame operator.
- Preserve the command's existing no-pcdump contract and CLI shape.

## Non-Goals

- No backend force-frame or anti-coalescing knob as the match mechanism.
- No claim that CardState's 40-vs-36 distinct-home stride residual is a
  coalescing or concurrent-lifetime source issue.
- No automatic rewrite of CARD builder source.
- No full C CFG/liveness analysis.
- No frame-reservations dependency for this detector. Frame tooling remains the
  validation/scoring follow-up, not the detector's required input.

## Approaches Considered

Recommended: add an ASM-only stack-address-home detector inside
`suggest_control_flow_shape.py`. It scans each call site, looks backward through
a small instruction window for stack address materialization such as
`addi r3,r1,0x120`, follows simple `mr` aliases into argument registers, and
groups unique stack offsets by consumer call symbol. This directly observes the
command-buffer pattern without requiring pcdumps.

Alternative: feed `debug inspect frame-reservations --json` into
`debug suggest control-flow-shape`. This was rejected for the initial feature
because current frame-reservation objects are based on load/store access widths
and can undercount address-materialized buffers passed by pointer.

Alternative: build a `frame-overlay-search` mutation operator now. This skips
the #407 source-hypothesis gate and risks becoming another force-frame path
before concurrent-lifetime source shapes are tested.

## Command Contract

No new CLI options are required. Existing command forms continue to work:

```bash
melee-agent debug suggest control-flow-shape -f fn_803B1338
melee-agent debug suggest control-flow-shape -f fn_803B1338 --json
melee-agent debug suggest control-flow-shape -f fn_803B1338 --checkdiff-json /tmp/checkdiff.json
```

The detector uses the same checkdiff JSON fields already required by the
command:

- `target_asm`: required `list[str]`
- `current_asm`: required `list[str]`
- `classification`: optional `dict`

Malformed checkdiff handling remains unchanged.

## Analyzer Contract

`analyze_control_flow_shape(...)` gains a possible suggestion:

- `kind`: `concurrent-buffer-lifetime`
- `confidence`: high when target and current share a consumer symbol, target
  and current have the same number of static call sites for that consumer,
  target has at least three distinct stack homes, and current has extractable
  `r1` stack homes for the same calls with at least one repeated current home.
  Medium when repeated current-home evidence is present but stack-home
  extraction is partial. A unique-home contraction without repeated offsets is
  not enough.
- `recommendation`: restructure source so multiple command buffers are live
  concurrently before consumption/push, instead of declaring and consuming them
  in mutually exclusive branches that MWCC can coalesce.
- `evidence`: consumer symbol, target/current call counts, target/current
  unique home counts, repeated offsets, target alignment, target stride
  candidates, and representative target/current home lines.
- `follow_up_commands`: `tools/checkdiff.py <function> --format json` after a
  manual concurrent-lifetime source probe, plus `debug inspect
  frame-reservations` only after such a source probe has been tested. The
  suggestion must not point directly at frame-transform/PAD_STACK operators.

Ranking inserts `concurrent-buffer-lifetime` after concrete call-hoist and
pointer-walk evidence, but before generic loop peel/unroll. Missing/extra call
layer stays higher priority when the current side lacks the target consumer
call. If the consumer exists on both sides but static call counts differ, the
lifetime detector suppresses itself because that is a call-shape/unroll problem,
not proven coalescing.

## Stack-Address Home Heuristic

The detector parses existing `_Instruction` records and uses relocation symbols
from call instructions.

For each call with a symbol:

1. Scan up to eight preceding instructions.
2. Track simple aliases from `mr rA,rB`.
3. Record stack homes when an argument register or its alias is assigned by
   `addi rX,r1,<offset>` or `add rX,r1,rY` where `rY` is produced in the same
   window by `li rY,<offset>`, `addi rY,r0,<offset>`, or
   `addi rY,0,<offset>`. Dynamic `rY` producers are ignored.
4. Normalize decimal and hex offsets as integers.
5. Group homes by consumer symbol and side.

A positive candidate exists when:

- Target has at least three unique homes for a consumer symbol.
- Current has the same consumer symbol.
- Target and current have the same number of static calls to that consumer.
- Current has extractable `r1` homes for that consumer, preferably for all
  static calls and at minimum for multiple calls.
- Current repeats a home offset for multiple calls where target does not.

Suppression rules:

- If the target consumer is absent from current and
  `inline_boundary_artifact.missing_ref_calls` is populated, rely on
  `missing-extra-call-layer` instead.
- If the target and current consumer call counts differ, suppress the lifetime
  suggestion. That difference may be missing helper boundaries, unrolled source,
  or another call-shape issue.
- If current has no extractable `r1` stack homes for the consumer, suppress the
  lifetime suggestion. That is parser failure, non-stack/global/heap arguments,
  or a different source-shape issue, not evidence of coalescing.
- If target and current have the same number of unique homes but target is only
  more aligned or has a different stride, do not call it lifetime coalescing.
  That remains size/alignment/frame tooling evidence.
- Ignore saved-register, ABI, and generic frame-size evidence because this
  detector only sees address homes passed to calls.

The repeated size is not hard-coded to 40 bytes. Stride evidence is reported
when sorted target offsets have a consistent delta; for the CARD builder family
that should surface 40-byte stride and 8-byte alignment.

## Error Handling

- The detector never fails the command. If parsing cannot extract stack homes,
  it emits no suggestion.
- Existing malformed checkdiff, wrong-function, and missing-ASM errors are
  unchanged.
- `--top` clipping applies after the new suggestion is ranked with existing
  suggestions.

## Tests

Unit tests:

- Positive: target has many `fn_803AC168` calls with distinct 40-byte,
  8-aligned stack homes; current has the same consumer calls and repeats at
  least one current home offset. Analyzer emits `concurrent-buffer-lifetime`.
- Negative: target has `fn_803AC168` homes but current only has wrapper calls
  and classification reports an inline-boundary missing call layer. Analyzer
  emits `missing-extra-call-layer` and suppresses lifetime coalescing.
- Negative: target and current both call `fn_803AC168`, but current has fewer
  static call sites. Analyzer suppresses lifetime coalescing.
- Negative: target/current have the same number of homes but different
  alignment or stride. Analyzer does not emit lifetime coalescing.
- Parser coverage for relocation lines, decimal and hex offsets, `mr` aliases,
  exact constant-derived `add rX,r1,rY` producers, dynamic `add rX,r1,rY`
  suppression, intervening stores, multiple consumer symbols, non-stack
  addresses, calls without extractable `r1` homes, and repeated static offsets.

CLI tests:

- JSON output includes the new suggestion from a checkdiff fixture.
- Text output renders the recommendation and evidence.
- Existing no-pcdump behavior remains unchanged.
- `--top` clipping remains deterministic with the new ranking.

## Review Notes

This feature intentionally produces a hypothesis, not a proof. It should say
"test concurrent lifetime/control-flow restructuring" rather than claim that
the source change is known. If a later source re-attack proves the hypothesis
cannot move the layout, then a force-frame reachability tool can be reported as
a separate, explicitly bounded backend-ceiling investigation.
