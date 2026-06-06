# Control-Flow Shape Suggest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ASM-diff-only `debug suggest control-flow-shape` command that ranks source-level control-flow transform hypotheses for issue #402.

**Architecture:** Keep the heuristic analysis in a new focused module under `src/mwcc_debug/`. Add a thin Typer command in `src/cli/debug.py` that reads checkdiff JSON, validates the payload, calls the analyzer, and renders text or JSON.

**Tech Stack:** Python, Typer, pytest, `tools/checkdiff.py --format json`.

---

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py` for analyzer logic and renderers.
- Create `tools/melee-agent/tests/test_suggest_control_flow_shape.py` for core analyzer tests.
- Modify `tools/melee-agent/src/cli/debug.py` for checkdiff payload reading and the new suggest command.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py` for CLI help, JSON/text output, validation, top clipping, and no-pcdump behavior.
- Commit this spec and plan with the implementation commit.

## Task 1: Core Analyzer Red Tests

**Files:**
- Create: `tools/melee-agent/tests/test_suggest_control_flow_shape.py`

- [ ] **Step 1: Write failing tests for each heuristic bucket**

Add tests named:

```python
def test_analyze_ranks_branch_idiom_and_pointer_walk() -> None: ...
def test_analyze_detects_call_hoist_around_loop_markers() -> None: ...
def test_analyze_detects_missing_extra_call_layer_from_classification() -> None: ...
def test_analyze_detects_loop_peel_unroll_repeated_body() -> None: ...
def test_analyze_non_control_flow_classification_marks_not_applicable() -> None: ...
def test_analyze_top_clips_ranked_suggestions() -> None: ...
```

Each test imports `analyze_control_flow_shape` from
`src.mwcc_debug.suggest_control_flow_shape` and asserts on `kind`,
`recommendation`, structured `evidence`, `classification`, `applicability`,
`rank`, and deterministic clipping.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_suggest_control_flow_shape.py -q --no-cov
```

Expected: import failure because `suggest_control_flow_shape.py` does not exist.

## Task 2: Core Analyzer Implementation

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py`

- [ ] **Step 1: Implement parsing helpers**

Implement helpers that normalize assembly lines into opcode/operand records,
associate relocation symbol lines with preceding `bl`, collect calls, find
`mtctr`/`bdnz` loop markers, detect backward conditional branch loop regions,
normalize hyphenated and underscored classification metadata keys, and count
compact instruction signatures.

- [ ] **Step 2: Implement applicability**

Return:

```python
{
    "primary": primary,
    "is_control_flow_shape": bool(reasons),
    "reasons": reasons,
}
```

where reasons come from the primary class, reason strings, indexed-struct
metadata, or inline-boundary metadata.

- [ ] **Step 3: Implement five suggestion detectors**

Implement deterministic detectors for `call-hoist`, `branch-idiom`,
`pointer-walk-indexed-shape`, `loop-peel-unroll`, and
`missing-extra-call-layer`. Each detector returns a dict with confidence,
recommendation, evidence, and follow-up commands.

- [ ] **Step 4: Rank and clip suggestions**

Sort by explicit priority, then descending confidence, then kind. Assign
1-based `rank` after sorting and clip with `max(0, top)`.

Priority order:

1. `branch-idiom`
2. `call-hoist`
3. `pointer-walk-indexed-shape`
4. `loop-peel-unroll`
5. `missing-extra-call-layer`

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_suggest_control_flow_shape.py -q --no-cov
```

Expected: all core analyzer tests pass.

## Task 3: CLI Red Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Add help coverage**

Add `["debug", "suggest", "control-flow-shape", "--help"]` to
`test_representative_grouped_command_help_works`.

- [ ] **Step 2: Add command behavior tests**

Add tests named:

```python
def test_debug_suggest_control_flow_shape_json_uses_checkdiff_without_pcdump(...): ...
def test_debug_suggest_control_flow_shape_text_renders_ranked_hypotheses(...): ...
def test_debug_suggest_control_flow_shape_rejects_wrong_function_payload(...): ...
def test_debug_suggest_control_flow_shape_rejects_missing_asm_payload(...): ...
def test_debug_suggest_control_flow_shape_top_clips_ranked_suggestions(...): ...
def test_debug_suggest_control_flow_shape_rejects_malformed_checkdiff_json(...): ...
def test_debug_suggest_control_flow_shape_reports_checkdiff_timeout(...): ...
def test_debug_suggest_control_flow_shape_reports_checkdiff_failure(...): ...
```

Monkeypatch the checkdiff reader to return synthetic JSON and monkeypatch
`_resolve_pcdump_path` to raise if the command tries to use pcdumps.

- [ ] **Step 3: Verify RED**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_json_uses_checkdiff_without_pcdump -q --no-cov
```

Expected: failures because the command and helper do not exist.

## Task 4: CLI Implementation

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`

- [ ] **Step 1: Add checkdiff reader**

Add `_read_control_flow_shape_checkdiff_payload(...)` near the existing
checkdiff helper. It reads `--checkdiff-json` or runs:

```bash
python tools/checkdiff.py <function> --format json --no-fingerprint
```

Append `--no-build` when the CLI option is set.

Construct the command from `DEFAULT_MELEE_ROOT` and run it with
`cwd=DEFAULT_MELEE_ROOT`, not from the caller's current directory.

- [ ] **Step 2: Add Typer command**

Add `@suggest_app.command(name="control-flow-shape")` with options
`--function/-f`, `--checkdiff-json`, `--checkdiff-timeout`, `--no-build`,
`--top`, and `--json`.

- [ ] **Step 3: Validate payload**

Reject a mismatched `payload["function"]`, malformed JSON, and missing
`target_asm`/`current_asm` with exit code 2.

- [ ] **Step 4: Render output**

Call `analyze_control_flow_shape(...)`, add `checkdiff_source`, and print
`render_json(report)` or `render_text(report)`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_json_uses_checkdiff_without_pcdump tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_text_renders_ranked_hypotheses tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_rejects_wrong_function_payload tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_rejects_missing_asm_payload tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_top_clips_ranked_suggestions -q --no-cov
```

Expected: all selected CLI tests pass.

## Task 5: Verification and Issue Closure

**Files:**
- All files changed above.

- [ ] **Step 1: Run focused tests**

```bash
cd tools/melee-agent
python -m pytest tests/test_suggest_control_flow_shape.py tests/test_debug_cli_reorg.py -q --no-cov
```

- [ ] **Step 2: Run compile and diff checks**

```bash
python -m compileall tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py tools/melee-agent/src/cli/debug.py
git diff --check
```

- [ ] **Step 3: Run command smoke checks**

```bash
melee-agent debug suggest control-flow-shape -f fn_803ADF90 --json --no-build --top 5
melee-agent debug suggest control-flow-shape -f fn_803ADF90 --no-build --top 3
```

- [ ] **Step 4: Independent review**

Ask an independent Codex subagent to review the implementation against the spec
and plan. Fix any critical or important findings, then rerun the focused tests.

- [ ] **Step 5: Resolve and commit**

```bash
melee-agent issue resolve 402 --note "fixed by <commit>"
git add docs/superpowers/specs/2026-06-05-control-flow-shape-suggest-design.md docs/superpowers/plans/2026-06-05-control-flow-shape-suggest.md tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_suggest_control_flow_shape.py tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add control-flow shape suggestions"
python -m pip install -e tools/melee-agent
```

- [ ] **Step 6: Final checks**

```bash
melee-agent issue list --status open
/opt/homebrew/bin/melee-agent --help
python - <<'PY'
import src.cli, inspect
print(inspect.getfile(src.cli))
PY
git status --short --branch
```
