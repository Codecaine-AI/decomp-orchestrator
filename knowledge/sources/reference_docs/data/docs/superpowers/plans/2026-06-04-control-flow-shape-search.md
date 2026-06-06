# Control-Flow Shape Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and register `control-flow-shape-search` for issue #378 so structural branch-shape queue rows can generate, compile, score, and harvest validated source rewrites.

**Architecture:** Add a focused probe-generation module that wraps existing safe `pressure_explorer` control-flow actuators and adds ternary/boolean spelling probes. Add a `debug mutate control-flow-shape-search` command with the same JSON candidate contract as indexed-struct search. Register the harness in harvest and taxonomy routing with function-body-only apply semantics.

**Tech Stack:** Python 3.11, Typer CLI, pytest, Ruff, existing `LifetimeLayoutProbe`, existing `compile_source_variant` and real-tree scoring helpers.

---

## File Map

- Create `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`: source scanning, probe generation, status/blocker reporting.
- Create `tools/melee-agent/tests/test_control_flow_shape.py`: unit tests for generated source transforms and safety rejections.
- Modify `tools/melee-agent/src/cli/debug.py`: add `debug mutate control-flow-shape-search`.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`: add help/no-source/fake-compile CLI coverage.
- Modify `tools/melee-agent/src/harvest.py`: register/select/build command for `control-flow-shape-search`.
- Modify `tools/melee-agent/tests/test_harvest.py`: harness selection, command, and blocker propagation tests.
- Modify `tools/function_taxonomy_inventory.py`: route branch-shape actionability to the new harness.
- Modify `tools/melee-agent/tests/test_function_taxonomy_inventory.py`: expected headline tool update.
- Commit spec and plan docs with the feature.

## Task 1: Probe Generator

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`
- Create: `tools/melee-agent/tests/test_control_flow_shape.py`

- [ ] **Step 1: Write failing probe tests**

Create `tools/melee-agent/tests/test_control_flow_shape.py` with tests for:

```python
import textwrap

from src.mwcc_debug.control_flow_shape import (
    DEFAULT_CONTROL_FLOW_OPERATORS,
    generate_control_flow_shape_probes,
    scan_control_flow_shape_probes,
)


def _source(body: str) -> str:
    return textwrap.dedent(
        f"""\
        int fn_80000000(int cond, int a, int b)
        {{
        {body}
        }}
        """
    )


def test_ternary_assignment_expands_to_if_else() -> None:
    source = _source("    int x;\\n    x = cond ? a : b;\\n    return x;\\n")

    probes, status = scan_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("ternary-to-if-else",),
    )

    assert status["blocker"] is None
    assert len(probes) == 1
    rewritten = probes[0].source_text
    assert "    if (cond) {\\n        x = a;\\n    } else {\\n        x = b;\\n    }" in rewritten
    assert probes[0].operator == "ternary-to-if-else"
    assert probes[0].provenance["kind"] == "control-flow-shape"


def test_if_else_assignment_collapses_to_ternary() -> None:
    source = _source(
        "    int x;\\n"
        "    if (cond) {\\n"
        "        x = a;\\n"
        "    } else {\\n"
        "        x = b;\\n"
        "    }\\n"
        "    return x;\\n"
    )

    probes = generate_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("if-else-to-ternary",),
    )

    assert len(probes) == 1
    assert "    x = cond ? a : b;\\n" in probes[0].source_text
    assert probes[0].operator == "if-else-to-ternary"


def test_boolean_condition_spelling_generates_safe_alternative() -> None:
    source = _source("    if (!cond) {\\n        return a;\\n    }\\n    return b;\\n")

    probes = generate_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("bool-condition-spelling",),
    )

    assert len(probes) == 1
    assert "if (cond == 0)" in probes[0].source_text
    assert probes[0].operator == "bool-condition-spelling"


def test_boolean_condition_spelling_rejects_side_effectful_call() -> None:
    source = _source("    if (poll()) {\\n        return a;\\n    }\\n    return b;\\n")

    probes, status = scan_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("bool-condition-spelling",),
    )

    assert probes == []
    assert status["blocker"] == "no-control-flow-shape-probes"


def test_delegates_existing_pressure_explorer_operator() -> None:
    source = _source("    if (cond && a) {\\n        return b;\\n    }\\n    return a;\\n")

    probes = generate_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("condition-nesting",),
    )

    assert len(probes) == 1
    assert probes[0].operator == "condition-nesting"
    assert "if (cond) {" in probes[0].source_text
    assert "if (a)" in probes[0].source_text
```

Also add tests that comments/strings/preprocessor lines are ignored and that an unknown operator returns `unsupported-control-flow-shape`.
Add explicit safety tests:

```python
def test_local_rewrites_reject_unsafe_expressions() -> None:
    unsafe_bodies = [
        "    out[i++] = cond ? a : b;\\n    return a;\\n",
        "    set_out() = cond ? a : b;\\n    return a;\\n",
        "    x = (cond = a) ? a : b;\\n    return x;\\n",
        "    x = cond ? a++, b : b;\\n    return x;\\n",
    ]

    for body in unsafe_bodies:
        probes, status = scan_control_flow_shape_probes(
            _source("    int x;\\n" + body),
            "fn_80000000",
            operator_filter=("ternary-to-if-else",),
        )
        assert probes == []
        assert status["blocker"] == "no-control-flow-shape-probes"


def test_if_else_to_ternary_rejects_nested_control_flow_and_labels() -> None:
    source = _source(
        "    int x;\\n"
        "label:\\n"
        "    if (cond) {\\n"
        "        if (a) { x = a; }\\n"
        "    } else {\\n"
        "        x = b;\\n"
        "    }\\n"
        "    return x;\\n"
    )

    probes, status = scan_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("if-else-to-ternary",),
    )

    assert probes == []
    assert status["blocker"] == "no-control-flow-shape-probes"


def test_local_rewrites_ignore_preprocessor_regions() -> None:
    source = _source(
        "    int x;\\n"
        "#if 1\\n"
        "    x = cond ? a : b;\\n"
        "#endif\\n"
        "    return x;\\n"
    )

    probes, status = scan_control_flow_shape_probes(
        source,
        "fn_80000000",
        operator_filter=("ternary-to-if-else",),
    )

    assert probes == []
    assert status["blocker"] == "no-control-flow-shape-probes"
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_control_flow_shape.py -q
```

Expected: import failure for `src.mwcc_debug.control_flow_shape`.

- [ ] **Step 3: Implement minimal generator**

Create `tools/melee-agent/src/mwcc_debug/control_flow_shape.py` with:

```python
from __future__ import annotations

import re
from collections.abc import Iterable

from .pressure_explorer import (
    LifetimeLayoutProbe,
    generate_lifetime_layout_probes,
)
from src.common import tree_sitter_c
from src.common.tree_sitter_c import find_function_definition, node_text

from .source_spans import StatementSpan, list_statement_spans

DEFAULT_CONTROL_FLOW_OPERATORS = (
    "early-guard-return",
    "condition-nesting",
    "loop-init",
    "loop-counter-type",
    "guard-shape",
    "call-return-compare-chain",
    "pointer-walk-loop",
    "pointer-base-call-loop",
    "ternary-to-if-else",
    "if-else-to-ternary",
    "bool-condition-spelling",
)

_DELEGATED_OPERATORS = frozenset(DEFAULT_CONTROL_FLOW_OPERATORS) - {
    "ternary-to-if-else",
    "if-else-to-ternary",
    "bool-condition-spelling",
}
_LOCAL_OPERATORS = frozenset(DEFAULT_CONTROL_FLOW_OPERATORS) - _DELEGATED_OPERATORS


def generate_control_flow_shape_probes(
    source: str,
    function: str,
    *,
    operator_filter: Iterable[str] | None = None,
    max_probes: int = 12,
) -> list[LifetimeLayoutProbe]:
    probes, _status = scan_control_flow_shape_probes(
        source,
        function,
        operator_filter=operator_filter,
        max_probes=max_probes,
    )
    return probes


def scan_control_flow_shape_probes(
    source: str,
    function: str,
    *,
    operator_filter: Iterable[str] | None = None,
    max_probes: int = 12,
) -> tuple[list[LifetimeLayoutProbe], dict[str, object]]:
    selected = tuple(dict.fromkeys(operator_filter or DEFAULT_CONTROL_FLOW_OPERATORS))
    unsupported = [op for op in selected if op not in DEFAULT_CONTROL_FLOW_OPERATORS]
    if unsupported:
        return [], {
            "blocker": "unsupported-control-flow-shape",
            "reason": f"unsupported control-flow operators: {', '.join(unsupported)}",
            "supported_candidate_count": 0,
            "rejected_candidate_count": len(unsupported),
        }
    parsed = _parse_function(source, function)
    if parsed is None:
        return [], {
            "blocker": "ambiguous-control-flow-source-region",
            "reason": "function definition could not be located",
            "supported_candidate_count": 0,
            "rejected_candidate_count": 0,
        }

    source_bytes, function_node = parsed
    try:
        statement_spans = list_statement_spans(source, function)
    except Exception:
        statement_spans = []

    probes: list[LifetimeLayoutProbe] = []
    delegated = tuple(op for op in selected if op in _DELEGATED_OPERATORS)
    if delegated:
        probes.extend(
            _retag_control_flow_probe(probe)
            for probe in generate_lifetime_layout_probes(
                source,
                function,
                operator_filter=delegated,
                max_probes=max_probes,
            )
        )
    if len(probes) < max_probes:
        probes.extend(
            _local_control_flow_probes(
                source,
                function,
                source_bytes,
                function_node,
                statement_spans,
                tuple(op for op in selected if op in _LOCAL_OPERATORS),
                max_probes=max_probes - len(probes),
            )
        )

    probes = probes[:max_probes]
    if not probes:
        return [], {
            "blocker": "no-control-flow-shape-probes",
            "reason": "no safe control-flow source transform matched",
            "supported_candidate_count": 0,
            "rejected_candidate_count": 0,
        }
    return probes, {
        "blocker": None,
        "reason": "source scan generated safe control-flow shape probes",
        "supported_candidate_count": len(probes),
        "rejected_candidate_count": 0,
    }
```

Then add private helpers with these concrete responsibilities:

- `_parse_function(source, function)` uses `tree_sitter_c.get_parser()`,
  `find_function_definition()`, and UTF-8 bytes. It returns `None` on parser
  unavailability, parse failure, or missing function.
- `_local_control_flow_probes(source, function, source_bytes, function_node, statement_spans, operators, max_probes)` dispatches only local operators and never scans outside `function_node`.
- `_ternary_to_if_else_probes()` iterates `StatementSpan` objects whose
  `kind == "expression_statement"`, parses one assignment plus one top-level
  `?:`, rejects unsafe expressions, and replaces exactly the statement span.
- `_if_else_to_ternary_probes()` walks parsed `if_statement` nodes under
  `function_node`, requires braced consequence and alternative, each with one
  expression statement assigning the same LHS, and replaces exactly the
  `if_statement` node.
- `_bool_condition_spelling_probes()` walks parsed `if_statement` and
  `while_statement` nodes, reads the `condition` field, verifies a simple
  side-effect-free condition, and replaces exactly the condition node text.
- `_safe_expr(expr, allow_lhs=False)` rejects calls, comma expressions,
  assignments, `++`, `--`, braces, labels, `return`, `goto`, `break`,
  `continue`, and unbalanced delimiters. For `allow_lhs=True`, allow simple
  identifiers, member access, pointer member access, and array access without
  calls or mutation operators.
- `_span_touches_preprocessor(source, start, end)` rejects any replacement span
  whose covered lines include a line beginning with optional whitespace plus
  `#`.
- `_line_range(source, start, end)` and `_replace_slice(source, start, end,
  replacement)` keep provenance and replacement offsets deterministic.

Keep deterministic labels prefixed with `control-flow-`.

- [ ] **Step 4: Run generator tests and verify GREEN**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_control_flow_shape.py -q
```

Expected: all tests in `test_control_flow_shape.py` pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add tools/melee-agent/src/mwcc_debug/control_flow_shape.py tools/melee-agent/tests/test_control_flow_shape.py
git commit -m "Add control-flow shape probe generator"
```

## Task 2: Debug CLI Harness

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Write failing CLI tests**

Add tests that invoke the Typer app runner for:

- `debug mutate control-flow-shape-search --help` renders.
- JSON with an impossible source/function emits `blocker == "ambiguous-control-flow-source-region"` or `source-unavailable`.
- A monkeypatched compile/score path returns an `ok` variant with retained `.c` source and `final_match_percent == 100.0`.

Follow nearby `indexed-struct-search` or `frame-transform-search` test style in `test_debug_cli_reorg.py`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_debug_cli_reorg.py -k control_flow_shape -q
```

Expected: command does not exist.

- [ ] **Step 3: Implement CLI command**

In `tools/melee-agent/src/cli/debug.py`, add helper functions near indexed-struct helpers:

```python
def _control_flow_stop_condition(kind: str, *, blocker: str | None, reason: str) -> dict[str, str | None]:
    return {"kind": kind, "blocker": blocker, "reason": reason}


def _control_flow_empty_payload(*, function: str, source: Path | None, blocker: str, reason: str) -> dict[str, Any]:
    return {
        "function": function,
        "source": str(source) if source is not None else None,
        "generated_source_dir": None,
        "probe_count": 0,
        "blocker": blocker,
        "stop_condition": _control_flow_stop_condition("blocked", blocker=blocker, reason=reason),
        "probes": [],
        "variants": [],
    }
```

Add `@mutate_app.command(name="control-flow-shape-search")` with the CLI shape from the spec. The command should:

1. Resolve source file like `indexed-struct-search`.
2. Parse `--operator` into an operator tuple.
3. Call `scan_control_flow_shape_probes`.
4. Materialize generated `.c` files when JSON or compile mode is active.
5. Score candidates using `compile_source_variant` and `_score_source_candidate_real_tree`.
6. Sort validated 100% candidates first.
7. Emit the same JSON keys as the spec.

- [ ] **Step 4: Run CLI tests and verify GREEN**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_debug_cli_reorg.py -k control_flow_shape -q
```

Expected: selected CLI tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add control-flow shape debug harness"
```

## Task 3: Harvest And Taxonomy Registration

**Files:**
- Modify: `tools/melee-agent/src/harvest.py`
- Modify: `tools/melee-agent/tests/test_harvest.py`
- Modify: `tools/function_taxonomy_inventory.py`
- Modify: `tools/melee-agent/tests/test_function_taxonomy_inventory.py`

- [ ] **Step 1: Write failing harvest/taxonomy tests**

Add harvest tests for:

```python
def test_control_flow_subcategory_selects_control_flow_shape_search(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "structural-reconstruction.tsv"
    row = _row(
        "demo_fn",
        headline_tool="extract-opseq-xrefs",
        source_actionability="structural-rebuild",
        frame_closability_tier="",
    )
    row["primary"] = "structural-reconstruction"
    row["subcategory"] = "branch-or-control-flow-shape"
    _write_queue(queue, [row])

    rows = load_queue_rows(queue, work_bucket="structural-reconstruction", repo_root=repo_root)

    assert select_harness(rows[0]) == "control-flow-shape-search"
```

Also add a negative selection test proving `source_actionability="structural-rebuild"` alone does not select the harness for a non-structural row:

```python
def test_control_flow_structural_rebuild_is_scoped_to_structural_rows(tmp_path: Path) -> None:
    request = HarvestRequest(
        function="fn",
        work_bucket="inline-boundary",
        match_percent=99.0,
        file_path="melee/demo.c",
        headline_tool="patterns-inlines",
        source_file=Path("demo.c"),
        primary="inline-boundary",
        subcategory="missing-reference-call-current-inlined",
        source_actionability="structural-rebuild",
    )

    assert select_harness(request) is None
```

Also test command construction includes `debug mutate control-flow-shape-search`, `--score-match-percent`, and stable blocker propagation for `no-control-flow-shape-probes`.

Update `test_describe_actionability_splits_non_frame_work_buckets` to expect `headline_tool == "control-flow-shape-search"` for `branch-or-control-flow-shape`. Add a `next_command` assertion:

```python
def test_structural_branch_shape_next_command_uses_control_flow_harness() -> None:
    from tools.function_taxonomy_inventory import FunctionCandidate, next_command

    candidate = FunctionCandidate(
        function="demo_fn",
        unit="main/melee/demo",
        file_path="melee/demo.c",
        size_bytes=128,
        match_percent=97.0,
        address="0x80000000",
        object_status="NonMatching",
    )

    command = next_command(
        "structural-reconstruction",
        "branch-or-control-flow-shape",
        candidate,
    )

    assert "debug mutate control-flow-shape-search -f demo_fn" in command
    assert "--source-file src/melee/demo.c" in command
    assert "--compile-probes" in command
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_harvest.py -k control_flow -q
python -m pytest tests/test_function_taxonomy_inventory.py::test_describe_actionability_splits_non_frame_work_buckets -q
```

Expected: harness unsupported / old headline mismatch.

- [ ] **Step 3: Implement registration**

In `tools/melee-agent/src/harvest.py`:

- add `HARNESS_CONTROL_FLOW_SHAPE = "control-flow-shape-search"`;
- include it in `REGISTERED_HARNESSES`;
- select it only for explicit harness references, `primary == "control-flow-source-shape"`, or rows scoped to structural reconstruction with `subcategory == "branch-or-control-flow-shape"`; `source_actionability == "structural-rebuild"` must not select the harness unless the row is also structurally scoped;
- add `_control_flow_shape_command()`;
- route `_adapter_command()` to the new command.

In `tools/function_taxonomy_inventory.py`, change the `branch-or-control-flow-shape` `headline_tool` to `control-flow-shape-search`, and update `next_command()` for that bucket/subcategory to:

```python
if bucket == "structural-reconstruction":
    if subcategory == "branch-or-control-flow-shape":
        return (
            f"melee-agent debug mutate control-flow-shape-search -f {function} "
            f"--source-file {source_path} --compile-probes --json"
        )
    return (
        f"melee-agent extract get {function} && "
        f"python tools/checkdiff.py {function} --compact"
    )
```

- [ ] **Step 4: Run harvest/taxonomy tests and verify GREEN**

Run:

```bash
cd tools/melee-agent
python -m pytest tests/test_harvest.py -k control_flow -q
python -m pytest tests/test_function_taxonomy_inventory.py::test_describe_actionability_splits_non_frame_work_buckets -q
```

Expected: selected tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add tools/melee-agent/src/harvest.py tools/melee-agent/tests/test_harvest.py tools/function_taxonomy_inventory.py tools/melee-agent/tests/test_function_taxonomy_inventory.py
git commit -m "Register control-flow shape harvest harness"
```

## Task 4: Final Verification And Issue Resolution

**Files:**
- Include: `docs/superpowers/specs/2026-06-04-control-flow-shape-search-design.md`
- Include: `docs/superpowers/plans/2026-06-04-control-flow-shape-search.md`

- [ ] **Step 1: Run full focused verification**

```bash
cd /Users/mike/code/melee/.claude/worktrees/codex-issue-378-control-flow/tools/melee-agent
python -m pytest tests/test_control_flow_shape.py tests/test_harvest.py -q
python -m pytest tests/test_debug_cli_reorg.py -k "control_flow_shape or representative_grouped_command_help_works" -q
python -m pytest tests/test_function_taxonomy_inventory.py -q
python -m ruff check src/mwcc_debug/control_flow_shape.py src/harvest.py src/cli/debug.py tests/test_control_flow_shape.py tests/test_harvest.py tests/test_debug_cli_reorg.py tests/test_function_taxonomy_inventory.py
cd /Users/mike/code/melee/.claude/worktrees/codex-issue-378-control-flow
python -m compileall -q tools/melee-agent/src tools/function_taxonomy_inventory.py
git diff --check
PYTHONPATH=tools/melee-agent python -m src.cli debug mutate control-flow-shape-search --help >/tmp/control-flow-shape-help.txt
rg "control-flow-shape-search" /tmp/control-flow-shape-help.txt
PYTHONPATH=tools/melee-agent python -m src.cli harvest structural-reconstruction --limit 0 --json >/tmp/control-flow-harvest-zero.json
python -m json.tool /tmp/control-flow-harvest-zero.json >/dev/null
```

- [ ] **Step 2: Commit docs if not already committed**

```bash
git add docs/superpowers/specs/2026-06-04-control-flow-shape-search-design.md docs/superpowers/plans/2026-06-04-control-flow-shape-search.md
git commit -m "Document control-flow shape harness design"
```

If the docs are already included in an earlier commit, this step should be a no-op.

- [ ] **Step 3: Resolve #378 only after verification passes**

```bash
melee-agent issue resolve 378 --note "Fixed in <commit>: added control-flow-shape-search debug/harvest harness with conservative branch-shape probes, CLI scoring, taxonomy routing, and harvest integration."
```

- [ ] **Step 4: Leave the worktree ready for merge**

Do not refresh the global editable install from this branch unless the branch has been merged to `/Users/mike/code/melee` `master`. Report the branch path, commit hashes, tests run, and the expected merge point with #375.
