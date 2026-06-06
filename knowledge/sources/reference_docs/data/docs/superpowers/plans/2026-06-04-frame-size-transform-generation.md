# Frame Size Transform Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `debug mutate frame-transform-search` generate and score frame-size-changing source probes for +/-8 frame-size divergences.

**Architecture:** Make the existing PAD_STACK source mutator delta-aware in `pressure_explorer.py`, derive the signed reservation delta from the frame report in `debug.py`, and make the frame-transform evaluator conservative about ceiling verdicts unless a frame-size-capable probe was actually measured.

**Tech Stack:** Python, Typer CLI, pytest, existing mwcc-debug frame reservation and source probe helpers.

---

### Task 1: Add Failing Generator And CLI Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_pressure_explorer.py`
- Modify: `tools/melee-agent/tests/test_frame_transform_search.py`

- [x] **Step 1: Add a directed generator test for a too-small frame**

Add a test that calls `generate_frame_directed_probes` with `current_frame={"frame_size": 80}`, `target_frame={"frame_size": 88}`, and `frame_reservation_delta=8`. Assert that one returned probe has `operator == "frame-reservation-pad-stack"` and source text containing `PAD_STACK(8);`.

- [x] **Step 2: Add directed generator tests for too-large frame shrink**

Add tests for three negative-delta cases:

- source with `PAD_STACK(16);` and `frame_reservation_delta=-8` should produce a source probe containing `PAD_STACK(8);`;
- source with `PAD_STACK(8);` and `frame_reservation_delta=-8` should produce a remove probe whose source no longer contains `PAD_STACK(`;
- source with no existing pad and `frame_reservation_delta=-8` should not produce a `frame-reservation-pad-stack` probe.

- [x] **Step 3: Add a no-compile CLI test for forced PAD_STACK generation**

Use the existing frame-transform-search fixtures. Create expected asm with an 88-byte frame, run `debug mutate frame-transform-search --operator frame-reservation-pad-stack --source-file source.c --no-compile-probes --json`, and assert the payload lists a retained `frame-reservation-pad-stack` probe with provenance bytes `8`.

- [x] **Step 4: Add a compile-probes CLI test with fake compiler output**

Patch `src.mwcc_debug.diff_capture.compile_source_variant` to return a pcdump whose frame size is 88, patch `_score_source_candidate_real_tree` to return an empty real-score result, run the same command with `--compile-probes --no-score-match-percent --json`, and assert the measured variant uses operator `frame-reservation-pad-stack` and reports `candidate_frame_size == 88`.

- [x] **Step 5: Add an evaluator guardrail test**

In `test_frame_reservations.py`, call `evaluate_frame_transform_probe_results` with a current frame of 80, expected frame of 88, and a single successful unchanged `block-scope` variant. Assert the verdict is `frame-transform-results-inconclusive`, not `frame-transform-ceiling-candidate`.

- [x] **Step 6: Run the new tests and verify RED**

Run:

```bash
pytest tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_emits_pad_stack_for_too_small_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_decreases_existing_pad_stack_for_too_large_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_removes_exact_pad_stack_for_too_large_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_does_not_insert_pad_stack_for_too_large_frame tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_lists_forced_pad_stack_probe_for_frame_delta tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_compiles_forced_pad_stack_probe tools/melee-agent/tests/test_frame_reservations.py::test_frame_transform_ceiling_requires_frame_size_capable_probe -q
```

Expected: failures because the generator does not accept/pass `frame_reservation_delta` yet and the evaluator still treats unchanged generic probes as a ceiling.

### Task 2: Wire Frame-Reservation Probe Generation

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/pressure_explorer.py`
- Modify: `tools/melee-agent/src/cli/debug.py`

- [x] **Step 1: Extend `generate_frame_directed_probes`**

Add a keyword-only `frame_reservation_delta: int | None = None` parameter. After finding the function body, append a delta-aware PAD_STACK probe when the value can produce a non-worsening edit. Keep FP-local shrink probes gated to cases where `current_frame > target_frame` or either size is unknown.

- [x] **Step 2: Add a delta-aware PAD_STACK probe helper**

Change the helper to accept a signed delta. Positive delta inserts or increases a pad. Negative delta decreases or removes an existing pad, and returns `None` when there is no explicit pad to shrink.

- [x] **Step 3: Derive frame-reservation delta in `mutate_frame_transform_search_cmd`**

After `current_frame_size` and `expected_frame_size` are available from the frame report, compute `frame_reservation_delta = expected_frame_size - current_frame_size` when both are integers and differ. Pass that value into `generate_frame_directed_probes`.

- [x] **Step 4: Preserve existing operator filtering**

Do not special-case `--operator`. The generated PAD_STACK probe should flow through the existing `allowed = frozenset(operator_filter)` filter, so forced PAD_STACK generation is retained and unrelated forced searches still stay focused.

- [x] **Step 5: Run generator and CLI tests**

Run:

```bash
pytest tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_emits_pad_stack_for_too_small_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_decreases_existing_pad_stack_for_too_large_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_removes_exact_pad_stack_for_too_large_frame tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_does_not_insert_pad_stack_for_too_large_frame tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_lists_forced_pad_stack_probe_for_frame_delta tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_compiles_forced_pad_stack_probe -q
```

Expected: PASS for the generation path.

### Task 3: Tighten Ceiling Verdicts

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`
- Modify: `tools/melee-agent/tests/test_frame_reservations.py`

- [x] **Step 1: Define frame-size-capable operators**

Add a small helper or constant that treats `frame-reservation-pad-stack`, `frame-direct-literal-at-final-fp-call`, `frame-split-fp-const-lifetime`, and `frame-magic-scratch-relocation` as frame-size-capable operators.

- [x] **Step 2: Update `_all_ok_frame_transform_probes_measured`**

Require at least one successful measured variant from a frame-size-capable operator before returning true. Keep the existing requirement that all variants are successful and all measured frame deltas are unchanged.

- [x] **Step 3: Run the evaluator test**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py::test_frame_transform_ceiling_requires_frame_size_capable_probe -q
```

Expected: PASS.

### Task 4: Verify, Refresh, Commit, Resolve

**Files:**
- Commit: spec, plan, tests, implementation

- [x] **Step 1: Run focused regression tests**

Run:

```bash
pytest tools/melee-agent/tests/test_pressure_explorer.py tools/melee-agent/tests/test_frame_transform_search.py tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works -q
```

- [x] **Step 2: Run CLI smoke checks**

Run:

```bash
melee-agent debug mutate frame-transform-search --help
melee-agent issue show 366
git diff --check
```

- [x] **Step 3: Refresh editable install**

Run the repo's editable install refresh from `/Users/mike/code/melee` so `/opt/homebrew/bin/melee-agent` imports this checkout's `tools/melee-agent` code.

- [ ] **Step 4: Commit and resolve issue #366**

Commit all changed files, then run:

```bash
melee-agent issue resolve 366 --note "fixed in <commit>: frame-transform-search now generates/scopes frame-size PAD_STACK probes and only ceilings after frame-size-capable probes are measured"
```

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short --branch
python -m pip show melee-agent | sed -n '1,12p'
melee-agent issue list --status open
```
