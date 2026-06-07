# Frame Local Dematerialize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guarded `frame-local-dematerialize` source probe for frame-transform-search so -8/no-pad frame shrink cases either get a safe semantic candidate or an explicit `no-safe-semantic-lever` result.

**Architecture:** Reuse the existing frame-directed probe pipeline in `pressure_explorer.py`. The new operator scans tree-sitter statement spans, recognizes only adjacent one-use local value homes, rewrites exact source spans, and reports provenance; CLI/evaluator wiring treats absence of any safe semantic probe as a bounded non-ceiling stop condition.

**Tech Stack:** Python, Typer CLI, pytest, tree-sitter C helpers in `tools/melee-agent/src/mwcc_debug/source_spans.py`.

---

## Files

- Modify: `tools/melee-agent/src/mwcc_debug/pressure_explorer.py`
  - Add `frame-local-dematerialize` probe generation.
  - Use `list_statement_spans()` for source spans and convert tree-sitter byte ranges to Python string indices before exact replacements.
- Modify: `tools/melee-agent/src/cli/debug.py`
  - Register the operator in frame-transform-search defaults.
  - Add `semantic_lever_status` to JSON/text output and frame report metadata.
  - Preserve `semantic_lever_status` when `inspect frame-reservations` consumes frame-transform-search JSON via `--probe-results-json`.
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`
  - Register the operator as frame-size-capable.
  - Add `no-safe-semantic-lever` evaluator/stop-condition behavior.
- Modify: `tools/melee-agent/tests/test_pressure_explorer.py`
  - Add RED/GREEN generator tests and rejection matrix.
- Modify: `tools/melee-agent/tests/test_frame_transform_search.py`
  - Add CLI JSON tests for generated/no-safe semantic levers.
- Modify: `tools/melee-agent/tests/test_frame_reservations.py`
  - Add evaluator tests for `semantic_lever_status`.
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`
  - Update stale ceiling expectations if they conflict with existing gated behavior.
  - Add probe-results-json metadata preservation coverage for `no-safe-semantic-lever`.

## Task 1: Generator Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_pressure_explorer.py`

- [ ] **Step 1: Add positive initialized-local test**

Append near the existing frame-directed probe tests:

```python
def test_generate_frame_directed_probes_dematerializes_initialized_one_use_local() -> None:
    source = textwrap.dedent("""\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            sink(tmp);
        }
    """)

    probes = generate_frame_directed_probes(
        source,
        "fn_80000000",
        current_frame={"frame_size": 80},
        target_frame={"frame_size": 72},
        frame_reservation_delta=-8,
        max_probes=10,
    )
    probe = next(probe for probe in probes if probe.operator == "frame-local-dematerialize")

    assert "int tmp = x + 1;" not in probe.source_text
    assert "sink(((int) (x + 1)));" in probe.source_text
    assert probe.provenance == {
        "kind": "frame-local-dematerialize",
        "local": "tmp",
        "action": "inline-initialized-local",
        "expression": "x + 1",
        "cast_type": "int",
        "use_kind": "call-argument",
        "definition_lines": [3, 3],
        "use_lines": [4, 4],
    }
```

- [ ] **Step 2: Add positive declaration-plus-assignment test**

```python
def test_generate_frame_directed_probes_dematerializes_adjacent_assignment_local() -> None:
    source = textwrap.dedent("""\
        void fn_80000000(int x)
        {
            int tmp;
            tmp = x + 1;
            sink(tmp);
        }
    """)

    probes = generate_frame_directed_probes(
        source,
        "fn_80000000",
        current_frame={"frame_size": 80},
        target_frame={"frame_size": 72},
        frame_reservation_delta=-8,
        max_probes=10,
    )
    probe = next(probe for probe in probes if probe.operator == "frame-local-dematerialize")

    assert "int tmp;" not in probe.source_text
    assert "tmp = x + 1;" not in probe.source_text
    assert "sink(((int) (x + 1)));" in probe.source_text
    assert probe.provenance["action"] == "inline-assigned-local"
    assert probe.provenance["definition_lines"] == [3, 4]
    assert probe.provenance["use_lines"] == [5, 5]
```

- [ ] **Step 3: Add rejection matrix**

Before the rejection matrix, add a non-ASCII prefix regression:

```python
def test_generate_frame_directed_probes_dematerializes_after_non_ascii_prefix() -> None:
    source = "/* unicode prefix: π */\n" + textwrap.dedent("""\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            sink(tmp);
        }
    """)

    probes = generate_frame_directed_probes(
        source,
        "fn_80000000",
        current_frame={"frame_size": 80},
        target_frame={"frame_size": 72},
        frame_reservation_delta=-8,
        max_probes=10,
    )
    probe = next(probe for probe in probes if probe.operator == "frame-local-dematerialize")

    assert probe.source_text.startswith("/* unicode prefix: π */")
    assert "int tmp = x + 1;" not in probe.source_text
    assert "sink(((int) (x + 1)));" in probe.source_text
```

Then add the rejection matrix:

```python
@pytest.mark.parametrize(
    "source",
    [
        # Side-effectful initializer.
        """\
        void fn_80000000(int x)
        {
            int tmp = helper(x);
            sink(tmp);
        }
        """,
        # Increment expression.
        """\
        void fn_80000000(int x)
        {
            int tmp = x++;
            sink(tmp);
        }
        """,
        # Lvalue use.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            tmp = 3;
        }
        """,
        # Address-taking use.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            sink(&tmp);
        }
        """,
        # Multiple reads.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            sink(tmp);
            sink(tmp);
        }
        """,
        # Control-flow use.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            if (tmp) {
                sink(x);
            }
        }
        """,
        # Return use.
        """\
        int fn_80000000(int x)
        {
            int tmp = x + 1;
            return tmp;
        }
        """,
        # Side-effectful sibling call argument.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            sink(tmp, x++);
        }
        """,
        # Intervening executable statement.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            mutate(x);
            sink(tmp);
        }
        """,
        # Intervening side-effectful declaration.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            int other = helper(x);
            sink(tmp);
        }
        """,
        # Intervening dependency mutation.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            x = 3;
            sink(tmp);
        }
        """,
        # Preprocessor directive between definition and use.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
        #if 1
            sink(tmp);
        #endif
        }
        """,
        # Shadowing.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1;
            {
                int tmp = x + 2;
                sink(tmp);
            }
            sink(tmp);
        }
        """,
        # Multi-declarator.
        """\
        void fn_80000000(int x)
        {
            int tmp = x + 1, other = x + 2;
            sink(tmp);
        }
        """,
        # Storage-class local.
        """\
        void fn_80000000(int x)
        {
            static int tmp = 1;
            sink(tmp);
        }
        """,
        # Volatile local.
        """\
        void fn_80000000(int x)
        {
            volatile int tmp = x + 1;
            sink(tmp);
        }
        """,
        # Array local.
        """\
        void fn_80000000(int x)
        {
            int tmp[1] = { x };
            sink(tmp[0]);
        }
        """,
        # Aggregate typedef local.
        """\
        void fn_80000000(Vec v)
        {
            Vec tmp = v;
            sink(tmp);
        }
        """,
    ],
)
def test_generate_frame_directed_probes_rejects_unsafe_dematerialize_cases(source: str) -> None:
    probes = generate_frame_directed_probes(
        textwrap.dedent(source),
        "fn_80000000",
        current_frame={"frame_size": 80},
        target_frame={"frame_size": 72},
        frame_reservation_delta=-8,
        max_probes=20,
    )

    assert "frame-local-dematerialize" not in {probe.operator for probe in probes}
```

- [ ] **Step 4: Run RED tests**

Run:

```bash
pytest tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_dematerializes_initialized_one_use_local tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_dematerializes_adjacent_assignment_local tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_rejects_unsafe_dematerialize_cases -q
```

Expected: the two positive tests fail because `frame-local-dematerialize` is not generated.

## Task 2: Semantic Probe Implementation

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/pressure_explorer.py`

- [ ] **Step 1: Add source-span import**

Add near the other imports:

```python
from .source_spans import StatementSpan, list_statement_spans
```

- [ ] **Step 2: Add replacement and identifier helpers**

Add helper functions near the other frame/lifetime helpers:

```python
_SIMPLE_LOCAL_DECL_RE = re.compile(
    r"^(?P<indent>\\s*)"
    r"(?P<type>(?:const\\s+)?[A-Za-z_]\\w*(?:\\s*\\*)*)\\s+"
    r"(?P<name>[A-Za-z_]\\w*)\\s*=\\s*(?P<expr>.+);\\s*$",
    re.DOTALL,
)
_SIMPLE_LOCAL_BARE_DECL_RE = re.compile(
    r"^(?P<indent>\\s*)"
    r"(?P<type>(?:const\\s+)?[A-Za-z_]\\w*(?:\\s*\\*)*)\\s+"
    r"(?P<name>[A-Za-z_]\\w*)\\s*;\\s*$",
    re.DOTALL,
)
_SIMPLE_ASSIGN_RE = re.compile(
    r"^\\s*(?P<name>[A-Za-z_]\\w*)\\s*=\\s*(?P<expr>.+);\\s*$",
    re.DOTALL,
)
```

Implement:

```python
def _replace_absolute_slices(
    source_text: str,
    replacements: list[tuple[int, int, str]],
) -> str:
    updated = source_text
    for start, end, replacement in sorted(replacements, reverse=True):
        updated = updated[:start] + replacement + updated[end:]
    return updated


def _expand_statement_removal_range(source_text: str, start: int, end: int) -> tuple[int, int]:
    line_end = end
    if line_end < len(source_text) and source_text[line_end] == "\n":
        line_end += 1
    return start, line_end


def _identifier_count(text: str, name: str) -> int:
    return len(re.findall(r"\\b" + re.escape(name) + r"\\b", text))
```

- [ ] **Step 3: Add safety predicates**

Implement:

```python
def _is_simple_dematerialize_type(type_text: str) -> bool:
    compact = " ".join(type_text.replace("*", " * ").split())
    if any(token in compact.split() for token in {"volatile", "static", "register", "extern", "auto"}):
        return False
    if compact.startswith(("struct ", "union ", "enum ")):
        return False
    return bool(re.fullmatch(r"(?:const\\s+)?[A-Za-z_]\\w*(?:\\s*\\*)*", type_text.strip()))


def _safe_dematerialize_expr(expr: str) -> bool:
    if not _balanced_expression_delimiters(expr):
        return False
    if any(token in expr for token in ("++", "--", "?", ",")):
        return False
    if re.search(r"(?<![=!<>])=(?!=)", expr):
        return False
    if re.search(r"\\b[A-Za-z_]\\w*\\s*\\(", expr):
        return False
    if "&" in expr or "->" in expr:
        return False
    return True
```

The first implementation may reject more cases than the spec could theoretically allow. It must not accept side effects, calls, address-taking, assignments, or control-flow contexts.

- [ ] **Step 4: Add statement-use rewrite helpers**

Implement helper functions that only accept these use forms:

```c
sink(tmp);
sink(arg0, tmp, arg2);
dst = tmp;
```

Use `_split_top_level_args()` for call arguments and replace only the argument span equal to the local name. Reject any sibling call argument for which `_safe_dematerialize_expr()` returns false.

- [ ] **Step 5: Add `_probe_frame_local_dematerializations()`**

Implement a generator that:

1. Calls `list_statement_spans(source_text, function)`.
2. Considers only same-`scope_path` sibling spans.
3. Accepts `type name = expr;` and `type name; name = expr;`.
4. Allows only declarations, blank text, and comments between value establishment and the single use.
5. Rejects preprocessor directives in the source text between definition and use.
6. Rejects any other read/write of the local in the function.
7. Rejects shadowing declarations of the same local.
8. Emits one `LifetimeLayoutProbe` per safe candidate with:

```python
operator="frame-local-dematerialize"
label=f"frame-local-dematerialize-{name}"
description=f"inline one-use local {name} into its use"
provenance={
    "kind": "frame-local-dematerialize",
    "local": name,
    "action": action,
    "expression": expr,
    "cast_type": type_text,
    "use_kind": use_kind,
    "definition_lines": [def_start_line, def_end_line],
    "use_lines": [use_start_line, use_end_line],
}
```

- [ ] **Step 6: Wire into `generate_frame_directed_probes()`**

Call the new helper after the existing frame-specific probes and before returning:

```python
for probe in _probe_frame_local_dematerializations(source_text, function):
    _append_probe(probes, probe)
    if len(probes) >= max_probes:
        return probes
```

- [ ] **Step 7: Run GREEN generator tests**

Run the same command from Task 1 Step 4.

Expected: all pass.

## Task 3: CLI and Evaluator Wiring

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/src/mwcc_debug/frame_reservations.py`
- Modify: `tools/melee-agent/tests/test_frame_reservations.py`

- [ ] **Step 1: Add evaluator RED test**

Append near the existing frame transform evaluator tests:

```python
def test_frame_transform_evaluation_reports_no_safe_semantic_lever() -> None:
    report = {
        "current": {"frame_size": 80},
        "expected": {"frame_size": 72},
        "frame_delta": -8,
        "semantic_lever_status": {
            "status": "no-safe-semantic-lever",
            "operator": "frame-local-dematerialize",
            "reason": "source scan found no safe semantic local dematerialization",
        },
    }

    evaluation = evaluate_frame_transform_probe_results(report, [])

    assert evaluation["verdict"] == "no-safe-semantic-lever"
    assert evaluation["stop_condition"] == {
        "status": "not-satisfied",
        "kind": "no-safe-semantic-lever",
        "reason": "source scan found no safe semantic local dematerialization",
        "baseline_remaining_frame_delta": -8,
    }
```

- [ ] **Step 2: Register operator constants**

In `debug.py`, add `"frame-local-dematerialize"` to `_FRAME_DIRECTED_DEFAULT_OPERATORS`.

In `frame_reservations.py`, add `"frame-local-dematerialize"` to `_FRAME_SIZE_TRANSFORM_OPERATORS` and to `_frame_transform_operator_priority()` lists for frame shrink/local-home causes. Update `_frame_transform_probe_plan()` so suggested commands use `debug mutate frame-transform-search` and `<frame-transform-search.json>`, because `lifetime-layout` cannot materialize frame-directed-only operators.

- [ ] **Step 3: Add evaluator behavior**

In `evaluate_frame_transform_probe_results()`, before `best is None` verdict selection, read:

```python
semantic_status = frame_report.get("semantic_lever_status")
```

If `semantic_status["status"] == "no-safe-semantic-lever"` and there are no variants, set verdict to `"no-safe-semantic-lever"`.

In `_frame_transform_probe_stop_condition()`, add:

```python
if verdict == "no-safe-semantic-lever":
    semantic_status = ...  # pass reason in or use a helper
```

Use a helper to avoid changing unrelated call sites:

```python
def _semantic_lever_reason(frame_report: dict) -> str:
    status = frame_report.get("semantic_lever_status")
    if isinstance(status, dict) and isinstance(status.get("reason"), str):
        return status["reason"]
    return "source scan found no safe semantic local dematerialization"
```

If adding a parameter to `_frame_transform_probe_stop_condition()` is cleaner, pass `semantic_lever_status=semantic_status`.

Add a second evaluator regression where `semantic_lever_status.status == "no-safe-semantic-lever"` but an unchanged frame-size-capable `frame-reservation-pad-stack` variant exists. The verdict must remain `frame-transform-ceiling-candidate`; no-safe only applies when no variants were evaluated.

- [ ] **Step 4: Add CLI semantic status helper**

In `debug.py`, add a local helper near `_frame_transform_probe_plan()`:

```python
def _frame_transform_semantic_lever_status(
    *,
    source_text: str | None,
    operator_filter: tuple[str, ...],
    frame_reservation_delta: int | None,
    probes: list[Any],
) -> dict:
    operator = "frame-local-dematerialize"
    if frame_reservation_delta is None or frame_reservation_delta >= 0:
        return {"status": "not-needed", "operator": operator}
    if source_text is None:
        return {"status": "unavailable-no-source", "operator": operator}
    if operator not in operator_filter:
        return {"status": "excluded-by-operator-filter", "operator": operator}
    if any(getattr(probe, "operator", None) == operator for probe in probes):
        return {"status": "semantic-lever-generated", "operator": operator}
    return {
        "status": "no-safe-semantic-lever",
        "operator": operator,
        "reason": "source scan found no safe semantic local dematerialization",
    }
```

Call this after `probes` are generated, store it in `frame_report["semantic_lever_status"]`, and include it in the JSON payload as `"semantic_lever_status"`. The helper must consume explicit scan metadata from `scan_frame_local_dematerialization_probes()` so parser/tool failures report `scan-error` or `scan-unavailable` instead of being mislabeled as `no-safe-semantic-lever`.

When `inspect frame-reservations` reads `--probe-results-json`, preserve top-level or `frame_report`-nested `semantic_lever_status` from frame-transform-search JSON before calling `evaluate_frame_transform_probe_results()`.

- [ ] **Step 5: Run evaluator RED/GREEN test**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_reservations.py::test_frame_transform_evaluation_reports_no_safe_semantic_lever -q
```

Expected after implementation: PASS.

## Task 4: CLI JSON Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_frame_transform_search.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py` only if existing assertions are stale.

- [ ] **Step 1: Add semantic probe listing test**

Add fixture:

```python
SOURCE_WITH_SEMANTIC_FRAME_LEVER = textwrap.dedent("""\
    void fn_80000000(int x)
    {
        int tmp = x + 1;
        sink(tmp);
    }
""")
```

Add test:

```python
def test_frame_transform_search_lists_semantic_dematerialize_probe_without_compile(
    tmp_path: Path,
) -> None:
    baseline = tmp_path / "baseline.txt"
    expected = tmp_path / "expected.s"
    source = tmp_path / "source.c"
    baseline.write_text(BASELINE_PCDUMP)
    expected.write_text(EXPECTED_88_ASM)
    source.write_text(SOURCE_WITH_SEMANTIC_FRAME_LEVER)

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "frame-transform-search",
            "-f",
            "fn_80000000",
            "--pcdump",
            str(baseline),
            "--expected-asm",
            str(expected),
            "--source-file",
            str(source),
            "--no-compile-probes",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.stdout + result.stderr
    payload = json.loads(result.stdout)
    probe = next(probe for probe in payload["probes"] if probe["operator"] == "frame-local-dematerialize")
    assert payload["semantic_lever_status"]["status"] == "semantic-lever-generated"
    assert probe["provenance"]["local"] == "tmp"
    assert "sink(((int) (x + 1)));" in Path(probe["source_retained"]).read_text()
```

- [ ] **Step 2: Add no-safe semantic status test**

```python
def test_frame_transform_search_reports_no_safe_semantic_lever_without_ceiling(
    tmp_path: Path,
) -> None:
    baseline = tmp_path / "baseline.txt"
    expected = tmp_path / "expected.s"
    source = tmp_path / "source.c"
    baseline.write_text(BASELINE_PCDUMP)
    expected.write_text(EXPECTED_88_ASM)
    source.write_text(textwrap.dedent("""\
        void fn_80000000(int x)
        {
            int tmp = helper(x);
            sink(tmp);
        }
    """))

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "frame-transform-search",
            "-f",
            "fn_80000000",
            "--pcdump",
            str(baseline),
            "--expected-asm",
            str(expected),
            "--source-file",
            str(source),
            "--no-compile-probes",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.stdout + result.stderr
    payload = json.loads(result.stdout)
    assert payload["semantic_lever_status"]["status"] == "no-safe-semantic-lever"
    assert payload["frame_transform_probe_evaluation"]["verdict"] == "no-safe-semantic-lever"
    assert payload["stop_condition"]["kind"] == "no-safe-semantic-lever"
```

- [ ] **Step 3: Run CLI RED/GREEN tests**

Also add a fake-compile test for `frame-local-dematerialize` that monkeypatches `compile_source_variant()`, asserts the generated source removed `int tmp = x + 1;`, returns a fixed pcdump, and expects `source-reachable-frame-transform`.

Run:

```bash
pytest tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_lists_semantic_dematerialize_probe_without_compile tools/melee-agent/tests/test_frame_transform_search.py::test_frame_transform_search_reports_no_safe_semantic_lever_without_ceiling -q
```

Expected after implementation: PASS.

## Task 5: Verification, Install Refresh, and Issue Resolution

**Files:**
- Modify as needed: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Run focused test set**

Run:

```bash
pytest \
  tools/melee-agent/tests/test_pressure_explorer.py \
  tools/melee-agent/tests/test_frame_transform_search.py \
  tools/melee-agent/tests/test_frame_reservations.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_with_source_object_is_frame_unchanged \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_frame_reservations_cli_ceiling_without_source_object_is_internal \
  -q
```

Expected: PASS. If the two debug CLI reorg tests expect stale ceiling verdicts for unchanged non-semantic candidates, update them to the current gated `frame-transform-results-inconclusive` behavior and rerun.

- [ ] **Step 2: Run CLI smoke checks**

Run:

```bash
melee-agent debug mutate frame-transform-search --help >/tmp/frame-transform-help.txt
rg "frame-transform-search" /tmp/frame-transform-help.txt
```

Expected: help renders and contains `frame-transform-search`.

- [ ] **Step 3: Run diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Commit feature**

Run:

```bash
git status --short
git add docs/superpowers/plans/2026-06-04-frame-local-dematerialize.md \
  tools/melee-agent/src/mwcc_debug/pressure_explorer.py \
  tools/melee-agent/src/mwcc_debug/frame_reservations.py \
  tools/melee-agent/src/cli/debug.py \
  tools/melee-agent/tests/test_pressure_explorer.py \
  tools/melee-agent/tests/test_frame_transform_search.py \
  tools/melee-agent/tests/test_frame_reservations.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add semantic frame local dematerialize probes"
```

- [ ] **Step 5: Refresh editable install**

Run from `/Users/mike/code/melee`:

```bash
python -m pip install -e tools/melee-agent
python - <<'PY'
import importlib.util
spec = importlib.util.find_spec("src.cli")
print(spec.origin)
PY
```

Expected: printed path is under `/Users/mike/code/melee/tools/melee-agent/src/cli`.

- [ ] **Step 6: Resolve issue #369**

Run:

```bash
melee-agent issue resolve 369 --note "fixed in <commit>: frame-transform-search now emits guarded frame-local-dematerialize probes for safe one-use locals and reports no-safe-semantic-lever when shrink cases have no safe semantic candidate"
```

- [ ] **Step 7: Final status**

Run:

```bash
melee-agent issue list --status open
git status --short --branch
```

Expected: #369 resolved, #368 remains open, `master` clean and ahead of origin by the committed local work.

## Self-Review Notes

- Spec coverage: generator safety, exact span rewrites, operator wiring, no-safe stop condition, regression tests, install refresh, and issue resolution are each covered by a task.
- Placeholder scan: no task asks for unspecified tests or unspecified behavior; rejection cases and commands are listed explicitly.
- Type consistency: the operator name is consistently `frame-local-dematerialize`; semantic status is consistently `semantic_lever_status`.
