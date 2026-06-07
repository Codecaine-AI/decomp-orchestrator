# Frame Allocation Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete ordered frame allocation trace to `frame-reservations` so issue #358 has source-actionable stack object visibility.

**Architecture:** Extend the existing `frame_reservations.py` model builder with a derived `frame_allocation_trace` object. Keep parsing and CLI responsibilities unchanged; the CLI only summarizes the new trace while JSON exposes the full model.

**Tech Stack:** Python, existing `mwcc_debug` pcdump parser, pytest, Typer CLI.

---

### Task 1: Regression Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_frame_reservations.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [x] **Step 1: Add symbolic trace test**

Add a test that builds a pcdump with a symbolic stack home and matching current asm. Assert:

```python
trace = report["current"]["frame_allocation_trace"]
assert trace["status"] == "computed"
assert trace["allocator_pass_status"] == "not-located"
assert trace["validation"]["frame_size_matches"] is True
assert trace["validation"]["uncovered_access_count"] == 0
assert any(
    obj["origin_tag"] == "symbolic-stack-home"
    and obj["symbol"] == "local_temp"
    and obj["start"] == 0x18
    and obj["symbolic_assignment_order"] == 0
    and obj["layout_order"] >= 0
    for obj in trace["objects"]
)
```

- [x] **Step 2: Add raw asm trace test**

Add a test using `analyze_frame_from_asm_text` and assert the trace includes:

```python
assert trace["instrumentation_source"] == "asm-r1-accesses"
assert trace["validation"]["frame_size_matches"] is True
assert {"implicit-abi-header", "r1-access-local-or-temporary", "callee-save-gpr", "frame-gap-or-alignment-pad"} <= {
    obj["origin_tag"] for obj in trace["objects"]
}
```

- [x] **Step 3: Add CLI text test**

Invoke:

```bash
melee-agent debug inspect frame-reservations -f fn_80000000 <pcdump> --no-expected
```

Assert output contains:

```text
frame allocation trace: computed
allocator pass: not-located
frame allocation validation: frame-size ok, r1-access coverage ok
```

- [x] **Step 4: Verify tests fail before implementation**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py::test_frame_allocation_trace_realizes_symbolic_stack_homes tools/melee-agent/tests/test_frame_reservations.py::test_frame_allocation_trace_covers_raw_asm_objects_and_gaps tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_text_reports_allocation_trace -q
```

Expected: new tests fail because `frame_allocation_trace` and text summary are missing.

### Task 2: Trace Model

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`

- [x] **Step 1: Add trace helper functions**

Add private helpers near the existing stack-object helpers:

```python
def _frame_allocation_trace(frame: dict, *, instrumentation_source: str) -> dict:
    ...

def _allocation_origin_tag(obj: dict) -> str:
    ...

def _allocation_validation(frame: dict, objects: list[dict]) -> dict:
    ...
```

- [x] **Step 2: Build ordered objects**

The trace helper should transform `frame["stack_objects"]` into sorted trace objects with:

```python
{
    "layout_order": index,
    "start": obj["start"],
    "end": obj["end"],
    "size": obj["size"],
    "kind": obj["kind"],
    "origin_tag": _allocation_origin_tag(obj),
    "source": obj.get("source"),
}
```

Preserve optional metadata keys when present: `symbol`, `identity_kind`, `expected_source_offsets`, `access_count`, `opcodes`, `first_access`, `symbolic_assignment_order`.

- [x] **Step 3: Attach symbolic assignment order**

Use `frame["stack_home_assignments"]` to map each symbolic `symbol` to its first `assignment_order`. Add `symbolic_assignment_order` to matching trace objects.

- [x] **Step 4: Validate frame reproduction**

Validation should return:

```python
{
    "frame_size": frame.get("frame_size"),
    "covered_end": full_coverage_end,
    "frame_size_matches": full_coverage_end == frame.get("frame_size"),
    "full_interval_coverage_matches": no_gaps_from_0_to_frame_size,
    "object_overlap_count": len(overlaps),
    "object_non_overlap_matches": not overlaps,
    "emitted_access_count": len(frame.get("access_ranges") or []),
    "uncovered_accesses": [...],
    "uncovered_access_count": len(uncovered_accesses),
    "r1_access_coverage_matches": not uncovered_accesses,
    "symbolic_stack_homes_present": bool(frame.get("stack_home_assignments")),
}
```

Exclude stack-pointer prologue/epilogue frame-size instructions from emitted access coverage by using existing `access_ranges`, not raw instructions. Validate coverage over the complete synthesized layout, including explicit gap objects, so the check is not tautological.

- [x] **Step 5: Attach trace to frame models**

In `_analyze_instructions`, attach:

```python
frame["frame_allocation_trace"] = _frame_allocation_trace(
    frame,
    instrumentation_source=instrumentation_source,
)
```

Default source is `pcdump-final-pass-and-emitted-r1-accesses`; pass `asm-r1-accesses` from `analyze_frame_from_asm_text` and expected-asm analysis.

### Task 3: CLI Summary

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`

- [x] **Step 1: Add printer helper**

Add `_print_frame_allocation_trace_summary(trace: Mapping) -> None` near `_print_frame_reservation_report`.

- [x] **Step 2: Print validation line**

For computed traces, print:

```text
frame allocation trace: computed (<object_count> object(s))
allocator pass: not-located
frame allocation validation: frame-size ok, r1-access coverage ok
```

If validation fails, use `mismatch` for the failing component.

- [x] **Step 3: Print first objects**

Print up to six objects with:

```text
  #<layout_order> <origin_tag> <range> <symbol-or-kind>
```

Keep output short to preserve the current report shape.

- [x] **Step 4: Wire helper into report**

Call the helper after the pass frame timeline and before unused ranges.

### Task 4: Verification and Issue Closure

**Files:**
- Modify: issue queue only after verification.

- [x] **Step 1: Run focused tests**

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_debug_cli_reorg.py -q
```

Expected: all selected tests pass.

- [x] **Step 2: Run CLI smoke**

```bash
melee-agent debug inspect frame-reservations --help
```

Expected: command exits 0 and help renders.

- [ ] **Step 3: Refresh editable install**

```bash
python -m pip install -e tools/melee-agent
```

Expected: editable install points at `/Users/mike/code/melee/tools/melee-agent`.

- [ ] **Step 4: Commit and resolve**

```bash
git add docs/superpowers/specs/2026-06-04-frame-allocation-observability-design.md docs/superpowers/plans/2026-06-04-frame-allocation-observability.md tools/melee-agent/src/mwcc_debug/frame_reservations.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add frame allocation observability trace"
melee-agent issue resolve 358 --note "fixed in <commit>: added frame_allocation_trace with ordered stack objects, validation, symbolic homes, and CLI summary"
```

- [ ] **Step 5: Final checks**

```bash
git status --short --branch
melee-agent issue list --status open
python -m pip show melee-agent
```

Expected: master is clean apart from being ahead of origin, issue #358 is no longer open, editable location is current master.
