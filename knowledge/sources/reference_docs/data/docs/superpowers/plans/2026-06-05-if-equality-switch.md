# If Equality Switch Control-Flow Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative `if-equality-to-single-case-switch` operator to `control-flow-shape-search`.

**Architecture:** Keep the feature local to `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`. Reuse the existing tree-sitter scan, source-slice replacement, probe metadata, preprocessor rejection, and expression-safety helpers. Generate probes for safe equality `if` statements anywhere in the target function; the motivating #388 case is leading, but compile/score decides whether any generated probe is useful. The CLI scoring path remains unchanged because it already compiles and ranks generated probes from this module.

**Tech Stack:** Python 3.11, tree-sitter C bindings via `src.common.tree_sitter_c`, pytest.

---

### Task 1: Add If-Equality Single-Case Switch Operator

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`
- Modify: `tools/melee-agent/tests/test_control_flow_shape.py`

- [ ] **Step 1: Write failing registry and success tests**

Add tests to `tools/melee-agent/tests/test_control_flow_shape.py`:

```python
def test_default_control_flow_operators_include_if_equality_switch() -> None:
    assert "if-equality-to-single-case-switch" in DEFAULT_CONTROL_FLOW_OPERATORS


def test_if_equality_to_single_case_switch_rewrites_constant_rhs() -> None:
    source = _source(
        "    if (state->mode == 0x13) {\n"
        "        call_state(state);\n"
        "    }\n"
        "    return b;\n"
    ).replace(
        "int fn_80000000(int cond, int a, int b)",
        "int fn_80000000(struct State *state, int a, int b)",
    )

    probes, status = scan_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("if-equality-to-single-case-switch",),
    )

    assert status["blocker"] is None
    assert len(probes) == 1
    rewritten = probes[0].source_text
    assert "switch (state->mode)" in rewritten
    assert "case 0x13: {" in rewritten
    assert "call_state(state);" in rewritten
    assert "break;" in rewritten
    assert probes[0].operator == "if-equality-to-single-case-switch"
```

- [ ] **Step 2: Verify the tests fail before implementation**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_control_flow_shape.py::test_default_control_flow_operators_include_if_equality_switch tools/melee-agent/tests/test_control_flow_shape.py::test_if_equality_to_single_case_switch_rewrites_constant_rhs -q --no-cov
```

Expected: both tests fail because the operator is not registered and no rewrite exists.

- [ ] **Step 3: Implement registry and minimal rewrite**

In `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`:

- Add `"if-equality-to-single-case-switch"` to `DEFAULT_CONTROL_FLOW_OPERATORS`.
- Add the operator to the local operator exclusion set so `_DELEGATED_OPERATORS` does not route it into `pressure_explorer`.
- Dispatch it from `_local_control_flow_probes`.
- Implement `_if_equality_to_single_case_switch_probes(...)`.
- Implement helpers for comparison extraction, constant-like case expressions, integral-looking switch expressions, body rejection, and switch rendering.

The render must use:

```c
switch (expr) {
case C: {
    original_body;
    break;
}
}
```

- [ ] **Step 4: Verify the success tests pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_control_flow_shape.py::test_default_control_flow_operators_include_if_equality_switch tools/melee-agent/tests/test_control_flow_shape.py::test_if_equality_to_single_case_switch_rewrites_constant_rhs -q --no-cov
```

Expected: both tests pass.

- [ ] **Step 5: Add safety rejection tests**

Add tests for:

- Constant on the left side rewrites to the same switch expression.
- Declarations inside the moved body stay under `case C: {`.
- `else` clauses produce no probes.
- `if (ptr == NULL)`, `if (f == 0.0f)`, and `if (x == y)` produce no probes.
- Preprocessor-touched regions produce no probes for this operator.
- Moved bodies containing labels, `case`, `default`, `break`, `continue`, or `goto` produce no probes.

- [ ] **Step 6: Verify safety tests fail if guards are incomplete**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_control_flow_shape.py -q --no-cov
```

Expected before final guard implementation: any missing safety guard test fails.

- [ ] **Step 7: Complete guards and rerun focused tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_control_flow_shape.py -q --no-cov
python -m pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_control_flow_shape_search_help_works -q --no-cov
python -m compileall tools/melee-agent/src/mwcc_debug/control_flow_shape.py
```

Expected: all commands exit 0.

- [ ] **Step 8: Run command-level smoke checks**

Run:

```bash
melee-agent debug mutate control-flow-shape-search -f fn_8019A71C --operator if-equality-to-single-case-switch --json --max-probes 3 --timeout 120
```

Expected: JSON includes `"operator": "if-equality-to-single-case-switch"` in at least one probe. If the local source state still matches the issue report, the command should validate a 100% candidate; otherwise record the observed blocker and do not resolve #388 unless the operator behavior itself is verified.

- [ ] **Step 9: Run the #388 incidence sweep**

Run a bounded harvest dry-run or equivalent queue sweep for control-flow-shape rows using only the new operator. Prefer the existing harvest command if it exposes the same row set; otherwise run the narrow CLI command over the available control-flow-shape harvest rows and record the result count in the issue resolution note.

Minimum required output to record:

- Whether `fn_8019A71C` produced and validated an `if-equality-to-single-case-switch` candidate.
- Number of additional control-flow-shape rows tested.
- Number of additional rows closed by the new operator, even if zero.

- [ ] **Step 10: Commit**

Stage only the spec, plan, implementation, and tests:

```bash
git add docs/superpowers/specs/2026-06-05-if-equality-switch-design.md docs/superpowers/plans/2026-06-05-if-equality-switch.md tools/melee-agent/src/mwcc_debug/control_flow_shape.py tools/melee-agent/tests/test_control_flow_shape.py
git commit -m "Add if equality switch control-flow probe"
```
