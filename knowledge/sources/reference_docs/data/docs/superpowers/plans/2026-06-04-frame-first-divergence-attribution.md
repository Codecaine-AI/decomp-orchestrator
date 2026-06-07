# Frame First-Divergence Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete issue #360 by making the frame first-divergence report source-actionable and validation-aware.

**Architecture:** Keep the implementation in `mwcc_debug.frame_reservations` because the data is already computed there. Keep CLI changes limited to validated verdict attachment in `src.cli.debug`.

**Tech Stack:** Python, pytest, existing mwcc-debug frame parser and Typer CLI tests.

---

### Task 1: Source Object Attribution

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`
- Test: `tools/melee-agent/tests/test_frame_reservations.py`

- [ ] **Step 1: Write attribution tests**

Update the symbolic stack-home divergence test to assert:

```python
assert divergence["source_attribution"]["status"] == "source-object-attributed"
assert divergence["source_attribution"]["identity_kind"] == "symbolic-stack-home"
assert divergence["source_attribution"]["primary_source_object"]["symbol"] == "local_temp"
```

- [ ] **Step 2: Implement source object builder**

Add helpers that combine `source_symbols`, `expected_source_symbols`, and stack-home assignments into `source_objects` with side, offsets, size, kind, first access, opcodes, and access count.

Confidence is `medium` for displaced symbolic homes because the current symbol identity is known and the expected offset is known, but the expected slot is not at the current offset.

- [ ] **Step 3: Preserve unresolved dependency**

For unattributed divergence, emit:

```python
{
    "status": "unattributed",
    "confidence": "low",
    "unresolved_dependency": "mwcc-stack-home-origin-tags",
}
```

### Task 2: Cause And Verdict Refinement

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`
- Test: `tools/melee-agent/tests/test_frame_reservations.py`

- [ ] **Step 1: Write cause tests**

Assert attributed same-shape offset divergence uses `lifetime-or-ordering-shift`, while unattributed frame-size-only keeps `extra-frame-reservation-or-alignment`.

- [ ] **Step 2: Implement source-aware cause selection**

Pass attribution into the cause helper or refine the cause after attribution. Keep previous generic fields such as `frame_delta` and `current_expected_offset_delta`.

Update `_frame_transform_operator_priority` for renamed cause kinds, especially `lifetime-or-ordering-shift` and `type-size-or-alignment`, so directed probe planning does not fall back to generic operators.

- [ ] **Step 3: Implement source-aware base verdict**

When attribution exists, make `verdict.status == "source-reachable-candidate"` with `source_object_symbol`. When no attribution exists, keep the verdict honest about the dependency on #358.

### Task 3: Validated Ceiling Semantics And Text Output

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Write CLI validation tests**

Add tests for `frame_transform_probe_evaluation.verdict == "frame-transform-ceiling-candidate"`:

- unattributed first divergence gets `validated_verdict.status == "internal-tiebreak-ceiling"`;
- attributed first divergence gets `validated_verdict.status == "attributed-frame-unchanged"`.

- [ ] **Step 2: Update `_attach_frame_transform_validated_verdict`**

Check `frame_first_divergence.source_attribution.status`. If a source object exists, do not call unchanged frame-size probes an internal ceiling; emit `attributed-frame-unchanged` unless stack-home/localizer validation also proves source-object slot movement. If no source object exists, emit internal ceiling with the bounded stop condition.

- [ ] **Step 3: Surface attribution in text output**

Update `_print_frame_reservation_report` so non-JSON `debug inspect frame-reservations` output names the primary source object and attribution confidence.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_evaluates_probe_results_json tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_with_source_object_is_frame_unchanged tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_without_source_object_is_internal -q
```

### Task 4: Verify, Commit, Resolve

Run:

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_evaluates_probe_results_json tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_with_source_object_is_frame_unchanged tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_without_source_object_is_internal -q
melee-agent debug inspect frame-reservations --help
```

Refresh editable install with `python -m pip install -e tools/melee-agent`, commit only the #360 spec/plan/test/implementation files, resolve #360, and leave `master` clean.
