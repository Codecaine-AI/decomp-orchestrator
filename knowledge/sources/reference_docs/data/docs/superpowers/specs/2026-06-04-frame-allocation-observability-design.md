# Frame Allocation Observability Design

## Goal

Issue #358 asks for the frame analog of register-coloring dumps: a per-function
view of stack-frame allocation decisions that explains every stack object, its
order, final `r1` offset, size, and origin tag. The feature must stop being a
black-box frame-size diff and must validate that the model accounts for the
emitted frame size and all emitted `r1` accesses.

## Constraints

The available MWCC artifact already parsed by `mwcc-debug` is pcdump text plus
optional current/expected asm. The current toolchain does not expose a named
compiler pass or symbol for the internal local-area allocator. The design must
therefore do two things explicitly:

- Build a complete ordered allocation model from the final pcdump, symbolic
  stack homes when present, and emitted asm offsets.
- Report the instrumentation limit when the underlying allocator pass/symbol is
  not located, instead of implying we have patched the compiler internals.

## Approach

Add a `frame_allocation_trace` object to each frame model returned by
`analyze_frame_reservations`, `analyze_frame_from_function`, and
`analyze_frame_from_asm_text`. The trace is derived from existing stack objects,
stack-home assignments, access ranges, frame size, and unused ranges.

The trace records:

- `status`: `computed` when a frame model exists, or an unavailable status when
  the frame cannot be parsed.
- `instrumentation_source`: `pcdump-final-pass-and-emitted-r1-accesses` for
  pcdump-backed current models, and `asm-r1-accesses` for raw asm models.
- `allocator_pass_status`: `not-located` until a real MWCC allocator routine is
  found.
- `objects`: every modeled object in final frame order. Objects include ABI
  header, saved-register blocks, symbolic stack homes, access-only local/temp
  slots, and gap/padding objects. Each object has `layout_order`, `start`,
  `end`, `size`, `kind`, `origin_tag`, `source`, access metadata when available,
  and symbolic source metadata when available.
- `validation`: full `0..frame_size` interval coverage, object non-overlap,
  frame-size reproduction, coverage of all emitted non-prologue `r1` offsets,
  uncovered accesses, and whether symbolic homes were available.
- `limitations`: concrete text explaining whether the trace is pcdump-derived,
  whether symbolic stack homes were present, and that no MWCC allocator
  pass/symbol was located.

## Data Model

`frame_allocation_trace.objects` is ordered by final offset with stable
tie-breaks. The sorted order is named `layout_order` because it is final layout
order, not proven MWCC allocation chronology. For symbolic homes, the trace
preserves the first symbolic stack-home order from pcdump and attaches it as
`symbolic_assignment_order`; that is the only observed ordering signal. The final
object order remains by frame offset so the dump reads like an actual stack
layout.

Origin tags are intentionally conservative:

- `implicit-abi-header`
- `callee-save-gpr`
- `callee-save-fpr`
- `symbolic-stack-home`
- `r1-access-local-or-temporary`
- `frame-gap-or-alignment-pad`

The model does not guess whether an access-only slot is a spill, local,
call-argument temporary, or address-taken home unless the pcdump symbolic home
names or existing kind metadata make that distinction available.

## CLI Output

`melee-agent debug inspect frame-reservations` prints a short trace summary:

- trace status and object count
- allocator pass status
- validation status for frame size and emitted `r1` access coverage
- the first few ordered objects, including symbolic names when available

`--json` exposes the full trace for downstream tooling.

## Testing

Add focused regression tests in `tools/melee-agent/tests/test_frame_reservations.py`:

- A symbolic stack-home pcdump with current asm verifies symbolic object origin,
  order, final offset, validation, and allocator-pass limit reporting.
- A raw expected-asm model verifies best-effort access-only objects and gap
  objects are included in the trace.
- A pcdump-only model verifies text/JSON callers get a trace even without
  symbolic homes.

Add a CLI output regression that invokes the existing command and asserts the
text report includes the frame allocation trace summary.

## Completion Criteria

The feature is complete when:

- Current and asm-derived frame models always include `frame_allocation_trace`.
- The trace accounts for the model frame size and every emitted non-prologue
  `r1` access when enough frame data exists.
- Symbolic stack homes are realized into ordered trace objects with final offsets.
- CLI text and JSON expose the trace.
- The implementation reports that the allocator pass/symbol is not located
  rather than overstating compiler instrumentation.
- Focused tests and command-level smokes pass.
