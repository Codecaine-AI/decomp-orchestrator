# Indexed Struct Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the #376 indexed-struct-pointer source-transform harness and wire it into `melee-agent harvest indexed-struct-pointer`.

**Architecture:** Add a focused conservative probe generator to `src.mwcc_debug.pressure_explorer`, a `debug mutate indexed-struct-search` CLI harness that compiles and real-scores retained source candidates, and harvest registry support for the new harness. The harness exits successfully for stable blocker outcomes and only lets harvest apply retained `.c` candidates with an exact 100% score.

**Tech Stack:** Python 3.11, Typer, pytest, existing `LifetimeLayoutProbe`, `compile_source_variant`, `_score_source_candidate_real_tree`, and `src.harvest` orchestration.

---

## File Structure

- Modify `tools/melee-agent/src/mwcc_debug/pressure_explorer.py`: add `generate_indexed_struct_pointer_probes()` and focused helpers for conservative pointer dematerialization.
- Modify `tools/melee-agent/src/cli/debug.py`: add `debug mutate indexed-struct-search` and local helpers for scoring/ranking/indexed-search JSON.
- Modify `tools/melee-agent/src/harvest.py`: register `indexed-struct-search`, select it for #376 taxonomy rows, build the adapter command, and propagate harness stable blockers.
- Modify `tools/melee-agent/tests/test_pressure_explorer.py`: add probe-generation and safety-regression tests.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`: add CLI JSON and help tests with fake compile/scoring hooks.
- Modify `tools/melee-agent/tests/test_harvest.py`: add harvest selection, command construction, blocker propagation, and apply/rollback tests for the indexed harness.
- Keep `docs/superpowers/specs/2026-06-04-indexed-struct-search-design.md` and this plan in the final feature commit.

## Task 1: Conservative Indexed Pointer Probe Generator

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/pressure_explorer.py`
- Test: `tools/melee-agent/tests/test_pressure_explorer.py`

- [ ] **Step 1: Add failing tests for `&base[index]` dematerialization.**

Append tests near the existing indexed-pointer tests in `test_pressure_explorer.py`.

```python
def test_indexed_struct_pointer_probe_rewrites_arrow_uses_to_direct_index() -> None:
    source = textwrap.dedent("""\
        typedef struct Item {
            int x;
            int y;
            int z;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item* item = &items[i];
            int x = item->x;
            int z = (*item).z;
            item->y = x + z;
            return item->y;
        }
    """)

    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    probes = generate_indexed_struct_pointer_probes(
        source,
        "fn_80000000",
        max_probes=8,
    )

    assert [probe.operator for probe in probes] == ["indexed-struct-pointer"]
    rewritten = probes[0].source_text
    assert "Item* item = &items[i];" not in rewritten
    assert "int x = items[i].x;" in rewritten
    assert "int z = items[i].z;" in rewritten
    assert "items[i].y = x + z;" in rewritten
    assert "return items[i].y;" in rewritten
    provenance = probes[0].provenance
    assert provenance["diagnostic"] == "indexed_struct_pointer_materialization"
    assert provenance["pointer"] == "item"
    assert provenance["base_expression"] == "items"
    assert provenance["index_expression"] == "i"
    assert provenance["direct_expression"] == "items[i]"
    assert provenance["split_first_field"] is False
    assert [use["field"] for use in provenance["field_uses"]] == ["x", "z", "y", "y"]
    assert [use["syntax"] for use in provenance["field_uses"]] == [
        "arrow",
        "deref-dot",
        "arrow",
        "arrow",
    ]
```

- [ ] **Step 2: Add failing tests for `base + index`, arrow/deref-dot matrix, and subindex forms.**

```python
def test_indexed_struct_pointer_probe_rewrites_base_plus_index_deref_dot() -> None:
    source = textwrap.dedent("""\
        typedef struct Item {
            int x;
            int y;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item* item = items + i;
            int x = (*item).x;
            item->y = x + 1;
            return (*item).y + x;
        }
    """)

    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    probes = generate_indexed_struct_pointer_probes(
        source,
        "fn_80000000",
        max_probes=8,
    )

    rewritten = probes[0].source_text
    assert "Item* item = items + i;" not in rewritten
    assert "int x = (items + i)->x;" in rewritten
    assert "(items + i)->y = x + 1;" in rewritten
    assert "return (items + i)->y + x;" in rewritten
    assert probes[0].provenance["direct_expression"] == "items + i"
    assert [use["syntax"] for use in probes[0].provenance["field_uses"]] == [
        "deref-dot",
        "arrow",
        "deref-dot",
    ]


def test_indexed_struct_pointer_probe_rewrites_double_index_address_form() -> None:
    source = textwrap.dedent("""\
        typedef struct Item {
            int x;
        } Item;

        int fn_80000000(Item rows[][4], int row, int col)
        {
            Item* item = &rows[row][col];
            return item->x;
        }
    """)

    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    probes = generate_indexed_struct_pointer_probes(
        source,
        "fn_80000000",
        max_probes=8,
    )

    rewritten = probes[0].source_text
    assert "Item* item = &rows[row][col];" not in rewritten
    assert "return rows[row][col].x;" in rewritten
    assert probes[0].provenance["base_expression"] == "rows"
    assert probes[0].provenance["index_expression"] == "row"
    assert probes[0].provenance["subindex_expression"] == "col"
    assert probes[0].provenance["direct_expression"] == "rows[row][col]"
```

- [ ] **Step 3: Add failing tests for unsafe uses.**

```python
def test_indexed_struct_pointer_probe_rejects_escaped_or_mutated_pointer() -> None:
    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    cases = [
        "sink(item);",
        "item = &items[i + 1];",
        "if (item == 0) { return 0; }",
        "item++;",
        "return item[0].x;",
        "return (int) item;",
        "return item;",
        "return &item != 0;",
        "return (int) (item + 1);",
        "return &item->x != 0;",
    ]

    for extra in cases:
        source = textwrap.dedent(f"""\
            typedef struct Item {{
                int x;
            }} Item;

            int fn_80000000(Item* items, int i)
            {{
                Item* item = &items[i];
                {extra}
                return item->x;
            }}
        """)

        assert generate_indexed_struct_pointer_probes(
            source,
            "fn_80000000",
            max_probes=8,
        ) == []


def test_indexed_struct_pointer_probe_rejects_side_effectful_base_index_and_subindex() -> None:
    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    initializers = [
        "Item* item = &items[i++];",
        "Item* item = &items[i = 1];",
        "Item* item = &items[i, j];",
        "Item* item = &get_items()[i];",
        "Item* item = &rows[i][j++];",
        "Item* item = get_items() + i;",
    ]

    for initializer in initializers:
        source = textwrap.dedent(f"""\
            typedef struct Item {{
                int x;
            }} Item;

            int fn_80000000(Item* items, Item rows[][4], int i, int j)
            {{
                {initializer}
                return item->x;
            }}
        """)

        assert generate_indexed_struct_pointer_probes(
            source,
            "fn_80000000",
            max_probes=8,
        ) == []


def test_indexed_struct_pointer_probe_rejects_preprocessor_regions_and_other_functions() -> None:
    from src.mwcc_debug.pressure_explorer import (
        generate_indexed_struct_pointer_probes,
    )

    source = textwrap.dedent("""\
        typedef struct Item {
            int x;
        } Item;

        int fn_80000000(Item* items, int i)
        {
        #if ENABLED
            Item* item = &items[i];
            return item->x;
        #endif
        }

        int sibling(Item* items, int i)
        {
            Item* item = &items[i];
            return item->x;
        }
    """)

    assert generate_indexed_struct_pointer_probes(
        source,
        "fn_80000000",
        max_probes=8,
    ) == []
    assert generate_indexed_struct_pointer_probes(
        source,
        "missing_function",
        max_probes=8,
    ) == []
```

- [ ] **Step 4: Run tests and confirm they fail because the generator is missing.**

Run:

```bash
cd tools/melee-agent
pytest tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_arrow_uses_to_direct_index tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_base_plus_index_deref_dot tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_double_index_address_form tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_escaped_or_mutated_pointer tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_side_effectful_base_index_and_subindex tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_preprocessor_regions_and_other_functions -q
```

Expected: import failure for `generate_indexed_struct_pointer_probes`.

- [ ] **Step 5: Implement `generate_indexed_struct_pointer_probes()`.**

Add a focused implementation in `pressure_explorer.py` after the existing indexed pointer loop helpers. Use the existing `_find_function_body_span()`, `_find_matching_bracket()`, `_replace_body_slice()`, `_replace_absolute_slices()`, and `LifetimeLayoutProbe`.

Implementation requirements:

- Add `scan_indexed_struct_pointer_probes(source_text, function, max_probes=12)` returning `(probes, status)` where `probes` is a list of `LifetimeLayoutProbe` and `status` is a dict with `blocker`, `reason`, `supported_candidate_count`, and `rejected_candidate_count`.
- Keep `generate_indexed_struct_pointer_probes(source_text, function, max_probes=12)` as a wrapper returning only `probes`.
- Find the function body span and scan line-by-line inside the body.
- Match declarations whose initializer is exactly one of:
  - `Type* ptr = &base[index];`
  - `Type* ptr = &base[index][subindex];`
  - `Type* ptr = base + index;`
- Require `base`, `index`, and `subindex` expressions to pass a helper like:

```python
def _indexed_struct_expression_is_side_effect_free(expr: str) -> bool:
    if not expr.strip():
        return False
    if re.search(r"\\b[A-Za-z_]\\w*\\s*\\(", expr):
        return False
    if re.search(r"\\+\\+|--|(?<![=!<>])=(?!=)|,", expr):
        return False
    return True
```

- Build direct expressions:
  - `&base[index]` -> `base[index]` with access mode `struct-value`
  - `&base[index][subindex]` -> `base[index][subindex]` with access mode `struct-value`
  - `base + index` -> `base + index` with access mode `pointer-expression`
- Scan from declaration end to the end of the function body.
- Collect only `ptr->field` and `(*ptr).field` uses.
- Reject the candidate if any other token use of `ptr` appears after removing those field-use spans.
- Reject if the declaration line or affected region contains a preprocessor directive.
- Remove the pointer declaration line.
- For `struct-value` candidates, replace both `ptr->field` and `(*ptr).field` with `<direct>.field`.
- For `pointer-expression` candidates, replace both `ptr->field` and `(*ptr).field` with `(<direct>)->field`.
- Emit labels `indexed-struct-pointer-0`, `indexed-struct-pointer-1`, and so on.
- Emit provenance matching the spec fields.
- If no supported initializer shape is found, return status blocker `indexed-struct-hint-unavailable` with reason `checkdiff hint could not be associated with a supported source pointer initializer`.
- If supported initializer shapes are found but all are rejected by safety rules, return status blocker `no-safe-materialized-pointer` with reason `source scan found materialized pointers, but all violated safety rules`.

- [ ] **Step 6: Run the focused tests until they pass.**

Run the same focused `pytest` command from Step 4. Expected: all selected tests pass.

## Task 2: `debug mutate indexed-struct-search` CLI Harness

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Add failing help and JSON blocker tests.**

Append CLI tests near the frame-transform-search tests in `test_debug_cli_reorg.py`.

```python
def test_indexed_struct_search_help_works() -> None:
    result = runner.invoke(debug_cli.debug_app, ["mutate", "indexed-struct-search", "--help"])

    assert result.exit_code == 0, result.output
    assert "--score-match-percent" in result.output
    assert "--compile-probes" in result.output


def test_indexed_struct_search_json_reports_no_source(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", tmp_path)
    monkeypatch.setattr(debug_cli, "_find_unit_for_function", lambda function, root: None)

    result = runner.invoke(
        debug_cli.debug_app,
        ["mutate", "indexed-struct-search", "-f", "fn_80000000", "--json"],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "source-unavailable"
    assert payload["function"] == "fn_80000000"
    assert payload["source"] is None
    assert payload["generated_source_dir"] is None
    assert payload["probe_count"] == 0
    assert payload["probes"] == []
    assert payload["stop_condition"] == {
        "kind": "blocked",
        "blocker": "source-unavailable",
        "reason": "source file could not be resolved",
    }
    assert payload["variants"] == []
```

- [ ] **Step 2: Add failing generated-probe JSON and fake scoring tests.**

```python
def test_indexed_struct_search_json_scores_generated_candidate(monkeypatch, tmp_path: Path) -> None:
    melee_root = tmp_path / "repo"
    source = melee_root / "src" / "melee" / "demo.c"
    source.parent.mkdir(parents=True)
    source.write_text(textwrap.dedent("""\
        typedef struct Item {
            int x;
            int y;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item* item = &items[i];
            int x = item->x;
            return item->y + x;
        }
    """))
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", melee_root)
    monkeypatch.setattr(
        debug_cli,
        "_find_unit_for_function",
        lambda function, root: "melee/demo",
    )
    monkeypatch.setattr(
        debug_cli,
        "_indexed_struct_checkdiff_hint",
        lambda function, *, melee_root, timeout: {
            "expected_indexed_ops": [{"opcode": "lwzx"}],
            "current_materialized_pointers": [{"pointer_register": "r4"}],
        },
    )

    def fake_compile(diff_input, *, function, melee_root, timeout):
        return "pcdump text"

    monkeypatch.setattr(debug_cli, "_indexed_struct_compile_source_variant", fake_compile)
    monkeypatch.setattr(
        debug_cli,
        "_score_source_candidate_real_tree",
        lambda path, *, function, melee_root, timeout=None, status=None, include_stack_slot=False:
            debug_cli._SourceCandidateRealScore(100.0, None),
    )

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--json",
            "--max-probes",
            "4",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] is None
    assert payload["function"] == "fn_80000000"
    assert payload["source"].endswith("src/melee/demo.c")
    assert Path(payload["generated_source_dir"]).exists()
    assert payload["stop_condition"]["kind"] == "validated"
    assert payload["stop_condition"]["blocker"] is None
    assert payload["probe_count"] == 1
    assert payload["probes"][0]["operator"] == "indexed-struct-pointer"
    variant = payload["variants"][0]
    assert variant["status"] == "ok"
    assert variant["operator"] == "indexed-struct-pointer"
    assert Path(variant["path"]).exists()
    assert variant["match_percent"] == 100.0
    assert variant["final_match_percent"] == 100.0
    assert variant["error"] is None
    assert Path(variant["source_retained"]).exists()
    assert variant["probe"]["provenance"]["pointer"] == "item"
```

- [ ] **Step 3: Add failing blocker-split, no-100, and candidate path tests.**

```python
def test_indexed_struct_search_json_reports_missing_checkdiff_hint(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.c"
    source.write_text(textwrap.dedent("""\
        typedef struct Item {
            int x;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item* item = &items[i];
            return item->x;
        }
    """))
    monkeypatch.setattr(
        debug_cli,
        "_indexed_struct_checkdiff_hint",
        lambda function, *, melee_root, timeout: None,
    )

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "indexed-struct-hint-unavailable"
    assert payload["blocker"] == payload["stop_condition"]["blocker"]
    assert payload["function"] == "fn_80000000"
    assert payload["source"] == str(source)
    assert payload["probe_count"] == 0
    assert payload["probes"] == []
    assert payload["stop_condition"]["kind"] == "blocked"
    assert payload["variants"] == []


def test_indexed_struct_search_json_reports_unmapped_hint_when_no_supported_initializer(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.c"
    source.write_text(textwrap.dedent("""\
        typedef struct Item {
            int x;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item item = items[i];
            return item.x;
        }
    """))
    monkeypatch.setattr(
        debug_cli,
        "_indexed_struct_checkdiff_hint",
        lambda function, *, melee_root, timeout: {
            "expected_indexed_ops": [{"opcode": "lwzx"}],
        },
    )

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "indexed-struct-hint-unavailable"
    assert payload["blocker"] == payload["stop_condition"]["blocker"]
    assert payload["stop_condition"]["kind"] == "blocked"
    assert payload["probe_count"] == 0
    assert payload["probes"] == []
    assert payload["variants"] == []


def test_indexed_struct_search_json_reports_no_safe_materialized_pointer(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "demo.c"
    source.write_text(textwrap.dedent("""\
        typedef struct Item {
            int x;
        } Item;

        int fn_80000000(Item* items, int i)
        {
            Item* item = &items[i];
            sink(item);
            return item->x;
        }
    """))
    monkeypatch.setattr(
        debug_cli,
        "_indexed_struct_checkdiff_hint",
        lambda function, *, melee_root, timeout: {
            "expected_indexed_ops": [{"opcode": "lwzx"}],
        },
    )

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "no-safe-materialized-pointer"
    assert payload["blocker"] == payload["stop_condition"]["blocker"]
    assert payload["stop_condition"]["kind"] == "blocked"
    assert payload["probe_count"] == 0
    assert payload["probes"] == []
    assert payload["variants"] == []


def test_indexed_struct_search_json_reports_unvalidated_candidate(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "candidate.c"
    source.write_text("int fn_80000000(void) { return 1; }\n")
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", tmp_path)

    def fake_compile(diff_input, *, function, melee_root, timeout):
        return "pcdump text"

    monkeypatch.setattr(debug_cli, "_indexed_struct_compile_source_variant", fake_compile)
    monkeypatch.setattr(
        debug_cli,
        "_score_source_candidate_real_tree",
        lambda path, *, function, melee_root, timeout=None, status=None, include_stack_slot=False:
            debug_cli._SourceCandidateRealScore(99.5, None),
    )

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--candidate",
            f"manual:indexed-struct-pointer={source}",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "no-indexed-struct-candidate"
    assert payload["blocker"] == payload["stop_condition"]["blocker"]
    assert payload["stop_condition"]["kind"] == "unvalidated"
    assert payload["variants"][0]["operator"] == "indexed-struct-pointer"
    assert payload["variants"][0]["path"] == str(source)
    assert payload["variants"][0]["error"] is None
    assert payload["variants"][0]["match_percent"] == 99.5


def test_indexed_struct_search_json_reports_build_failed_candidate(monkeypatch, tmp_path: Path) -> None:
    from src.mwcc_debug.diff_capture import CompileFailure

    source = tmp_path / "candidate.c"
    source.write_text("int fn_80000000(void) { return 1; }\n")
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", tmp_path)

    def fake_compile(diff_input, *, function, melee_root, timeout):
        raise CompileFailure(
            "candidate",
            ["compile"],
            "",
            "compiler diagnostic",
            1,
        )

    monkeypatch.setattr(debug_cli, "_indexed_struct_compile_source_variant", fake_compile)

    result = runner.invoke(
        debug_cli.debug_app,
        [
            "mutate",
            "indexed-struct-search",
            "-f",
            "fn_80000000",
            "--candidate",
            f"manual:indexed-struct-pointer={source}",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "no-indexed-struct-candidate"
    assert payload["blocker"] == payload["stop_condition"]["blocker"]
    variant = payload["variants"][0]
    assert variant["status"] == "build-failed"
    assert variant["operator"] == "indexed-struct-pointer"
    assert variant["path"] == str(source)
    assert "compiler diagnostic" in variant["error"]
```

- [ ] **Step 4: Run the new CLI tests and confirm they fail.**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_indexed_struct_search_help_works tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_no_source tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_scores_generated_candidate tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_missing_checkdiff_hint tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_unmapped_hint_when_no_supported_initializer tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_no_safe_materialized_pointer tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_unvalidated_candidate tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_build_failed_candidate -q
```

Expected: Typer reports no such command or missing implementation.

- [ ] **Step 5: Implement the CLI command.**

In `debug.py`, import `scan_indexed_struct_pointer_probes` and
`generate_indexed_struct_pointer_probes` from `pressure_explorer`. Add wrapper
helpers so tests can monkeypatch expensive operations:

```python
def _indexed_struct_compile_source_variant(diff_input, *, function, melee_root, timeout):
    from ..mwcc_debug.diff_capture import compile_source_variant

    return compile_source_variant(
        diff_input,
        function=function,
        melee_root=melee_root,
        timeout=timeout,
    )


def _indexed_struct_checkdiff_hint(
    function: str,
    *,
    melee_root: Path,
    timeout: int,
) -> dict[str, Any] | None:
    command = [
        sys.executable,
        "tools/checkdiff.py",
        function,
        "--format",
        "json",
        "--no-build",
        "--no-fingerprint",
    ]
    completed = subprocess.run(
        command,
        cwd=melee_root,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return None
    classification = payload.get("classification")
    if not isinstance(classification, dict):
        return None
    diagnostic = classification.get("indexed_struct_pointer_materialization")
    return diagnostic if isinstance(diagnostic, dict) else None
```

Add `@mutate_app.command(name="indexed-struct-search")` near `frame-transform-search`.

Implementation requirements:

- Options: `-f/--function`, `--source-file`, `--candidate`, `--compile-probes/--no-compile-probes`, `--score-match-percent/--no-score-match-percent` defaulting to true, `--max-probes`, `--timeout`, `--json`.
- Resolve source from `--source-file`, otherwise `_find_unit_for_function(function, DEFAULT_MELEE_ROOT)` and `DEFAULT_MELEE_ROOT / "src" / f"{unit}.c"`.
- If source cannot be resolved and no candidates were supplied, emit JSON blocker `source-unavailable` and exit 0.
- When source probes are requested, call `_indexed_struct_checkdiff_hint()` before generating candidates. If it returns `None`, emit blocker `indexed-struct-hint-unavailable` and exit 0. Candidate-only runs do not require the checkdiff hint because the candidate was explicitly supplied by the caller.
- Generate probes with `scan_indexed_struct_pointer_probes()` so the CLI can
  distinguish "no supported initializer shape" from "supported shape rejected
  by safety rules". Keep the wrapper available for direct tests and follow-up
  callers.
- If no probes and no candidates after a present checkdiff hint, emit the scan
  status blocker: `indexed-struct-hint-unavailable` when no supported
  initializer shape was found, or `no-safe-materialized-pointer` when supported
  shapes existed but all were rejected.
- Materialize generated `.c` probe files in a temp dir when JSON is requested or probes are compiled.
- Score `.c` candidates by calling `_indexed_struct_compile_source_variant()` first, then `_score_source_candidate_real_tree()` when `score_match_percent` is true.
- Produce variant dictionaries with `status`, `path`, `source_retained`, `match_percent`, `final_match_percent`, `match_percent_error`, and `probe` when available.
- Set `stop_condition`:
  - `validated` with `blocker=None` if any ok variant scores exactly `100.0`.
  - `unvalidated` with `blocker=no-indexed-struct-candidate` if variants exist but no exact 100.
  - `blocked` with `blocker=no-safe-materialized-pointer` if no safe probes/candidates exist.
- Text mode prints command name, source, generated source dir, stop condition, and ranked variants.

- [ ] **Step 6: Run CLI tests until they pass.**

Run the Step 4 `pytest` command. Expected: all selected tests pass.

## Task 3: Harvest Registration And Blocker Propagation

**Files:**
- Modify: `tools/melee-agent/src/harvest.py`
- Test: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Add failing harvest tests for indexed selection and command construction.**

Add a helper row variant in `test_harvest.py` by extending `_row()` or passing fields directly.

```python
def test_indexed_struct_primary_selects_indexed_search(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])

    rows = load_queue_rows(
        queue,
        work_bucket="indexed-struct-pointer",
        repo_root=repo_root,
    )

    assert select_harness(rows[0]) == "indexed-struct-search"


def test_indexed_struct_source_actionability_selects_indexed_search(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "other-primary"
    _write_queue(queue, [row])

    rows = load_queue_rows(
        queue,
        work_bucket="indexed-struct-pointer",
        repo_root=repo_root,
    )

    assert select_harness(rows[0]) == "indexed-struct-search"


def test_indexed_struct_target_map_harness_selects_indexed_search(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="",
        frame_closability_tier="",
    )
    row["primary"] = "other-primary"
    _write_queue(queue, [row])

    rows = load_queue_rows(
        queue,
        work_bucket="indexed-struct-pointer",
        repo_root=repo_root,
        target_map={"demo_fn": {"harness": "indexed-struct-search"}},
    )

    assert select_harness(rows[0]) == "indexed-struct-search"


def test_indexed_struct_command_text_selects_indexed_search(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="",
        frame_closability_tier="",
        next_command="melee-agent debug mutate indexed-struct-search -f demo_fn",
    )
    row["primary"] = "other-primary"
    _write_queue(queue, [row])

    rows = load_queue_rows(
        queue,
        work_bucket="indexed-struct-pointer",
        repo_root=repo_root,
    )

    assert select_harness(rows[0]) == "indexed-struct-search"


def test_indexed_struct_harvest_builds_indexed_search_command(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])
    calls, runner = _json_runner({
        "variants": [
            {
                "status": "ok",
                "source_retained": str(tmp_path / "candidate.c"),
                "final_match_percent": 100.0,
            }
        ]
    })

    ledger = run_harvest(
        "indexed-struct-pointer",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
    )

    assert calls[0][:5] == [
        "debug",
        "mutate",
        "indexed-struct-search",
        "-f",
        "demo_fn",
    ]
    assert "--score-match-percent" in calls[0]
    assert ledger["results"][0]["harness"] == "indexed-struct-search"
    assert ledger["results"][0]["status"] == "validated"
```

- [ ] **Step 2: Add failing harvest tests for stable blocker propagation.**

```python
def test_harvest_propagates_indexed_search_stable_blocker(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])
    _, runner = _json_runner({
        "blocker": "no-safe-materialized-pointer",
        "stop_condition": {
            "kind": "blocked",
            "blocker": "no-safe-materialized-pointer",
            "reason": "source scan found no safe materialized pointer",
        },
        "variants": [],
    })

    ledger = run_harvest(
        "indexed-struct-pointer",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
    )

    result = ledger["results"][0]
    assert result["status"] == "blocked"
    assert result["blocker"] == "no-safe-materialized-pointer"
    assert result["reason"] == "source scan found no safe materialized pointer"
```

- [ ] **Step 3: Add failing harvest apply/rollback tests for indexed harness.**

Reuse the existing apply tests but set the row to indexed and assert the command/harness.

```python
def test_indexed_struct_apply_uses_existing_function_only_replacement(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = textwrap.dedent("""\
        static int file_local = 3;

        int demo_fn(void) {
            return 1;
        }

        int sibling(void) {
            return file_local + 7;
        }
    """)
    target.write_text(original)
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int demo_fn(void) {\\n    return 2;\\n}\\n")
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])
    _, runner = _json_runner({
        "variants": [
            {
                "status": "ok",
                "source_retained": str(candidate),
                "final_match_percent": 100.0,
            }
        ]
    })

    ledger = run_harvest(
        "indexed-struct-pointer",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        validator=lambda function, *, cwd, timeout: HarnessProcessResult(
            ["checkdiff", function], 0, "", ""
        ),
        apply=True,
    )

    assert ledger["results"][0]["status"] == "applied"
    assert ledger["results"][0]["harness"] == "indexed-struct-search"
    assert target.read_text() == textwrap.dedent("""\
        static int file_local = 3;

        int demo_fn(void) {
            return 2;
        }

        int sibling(void) {
            return file_local + 7;
        }
    """)


def test_indexed_struct_apply_rolls_back_when_validation_fails(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = "int demo_fn(void) {\\n    return 1;\\n}\\n"
    target.write_text(original)
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int demo_fn(void) {\\n    return 2;\\n}\\n")
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])
    _, runner = _json_runner({
        "variants": [
            {
                "status": "ok",
                "source_retained": str(candidate),
                "final_match_percent": 100.0,
            }
        ]
    })

    ledger = run_harvest(
        "indexed-struct-pointer",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        validator=lambda function, *, cwd, timeout: HarnessProcessResult(
            ["checkdiff", function], 1, "", "mismatch"
        ),
        apply=True,
    )

    assert ledger["results"][0]["status"] == "blocked"
    assert ledger["results"][0]["blocker"] == "apply-validation-failed"
    assert target.read_text() == original


def test_indexed_struct_apply_rolls_back_when_validation_is_interrupted(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = "int demo_fn(void) {\\n    return 1;\\n}\\n"
    target.write_text(original)
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int demo_fn(void) {\\n    return 2;\\n}\\n")
    queue = tmp_path / "queues" / "indexed-struct-pointer.tsv"
    row = _row(
        "demo_fn",
        headline_tool="source-shape",
        source_actionability="current-tools-indexed-pointer",
        frame_closability_tier="",
    )
    row["primary"] = "indexed-struct-pointer-materialization"
    _write_queue(queue, [row])
    _, runner = _json_runner({
        "variants": [
            {
                "status": "ok",
                "source_retained": str(candidate),
                "final_match_percent": 100.0,
            }
        ]
    })

    def interrupted_validator(function: str, *, cwd: Path, timeout: int):
        raise KeyboardInterrupt("stop")

    ledger = run_harvest(
        "indexed-struct-pointer",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        validator=interrupted_validator,
        apply=True,
    )

    assert ledger["results"][0]["status"] == "blocked"
    assert ledger["results"][0]["blocker"] == "apply-validation-failed"
    assert target.read_text() == original
```

- [ ] **Step 4: Run the harvest tests and confirm they fail.**

Run:

```bash
cd tools/melee-agent
pytest tests/test_harvest.py::test_indexed_struct_primary_selects_indexed_search tests/test_harvest.py::test_indexed_struct_source_actionability_selects_indexed_search tests/test_harvest.py::test_indexed_struct_target_map_harness_selects_indexed_search tests/test_harvest.py::test_indexed_struct_command_text_selects_indexed_search tests/test_harvest.py::test_indexed_struct_harvest_builds_indexed_search_command tests/test_harvest.py::test_harvest_propagates_indexed_search_stable_blocker tests/test_harvest.py::test_indexed_struct_apply_uses_existing_function_only_replacement tests/test_harvest.py::test_indexed_struct_apply_rolls_back_when_validation_fails tests/test_harvest.py::test_indexed_struct_apply_rolls_back_when_validation_is_interrupted -q
```

Expected: selection and command tests fail because `indexed-struct-search` is not registered; blocker propagation fails because harvest currently reports `no-validated-candidate`.

- [ ] **Step 5: Implement harvest support.**

In `src/harvest.py`:

- Add `HARNESS_INDEXED_STRUCT = "indexed-struct-search"` to constants and `REGISTERED_HARNESSES`.
- Update `select_harness()` to return indexed search when:
  - `request.primary == "indexed-struct-pointer-materialization"`
  - `request.source_actionability == "current-tools-indexed-pointer"`
  - explicit `facts.harness` or command text names `indexed-struct-search`
- Add `_indexed_struct_command()` returning:

```python
[
    "debug",
    "mutate",
    HARNESS_INDEXED_STRUCT,
    "-f",
    request.function,
    "--source-file",
    str(request.source_file),
    "--compile-probes",
    "--score-match-percent",
    "--json",
    "--max-probes",
    str(request.max_probes),
    "--timeout",
    str(request.timeout),
]
```

- Add the adapter to `_adapter_command()`.
- Before returning `no-validated-candidate`, inspect harness JSON for stable blocker data:

```python
def _harness_blocker_result(payload: Any) -> tuple[str, str] | None:
    if not isinstance(payload, dict):
        return None
    blocker = payload.get("blocker")
    stop = payload.get("stop_condition")
    reason = None
    if isinstance(stop, dict):
        blocker = blocker or stop.get("blocker")
        reason = stop.get("reason")
    if isinstance(blocker, str) and blocker:
        return blocker, str(reason or blocker)
    return None
```

Return status `blocked` for `stop_condition.kind == "blocked"` and `no_match`
for `unvalidated`, preserving the blocker and reason.

- [ ] **Step 6: Run harvest tests until they pass.**

Run the Step 4 `pytest` command. Expected: all selected tests pass.

## Task 4: Integration Verification And Issue Closure

**Files:**
- Test/verify only, then commit all touched files.

- [ ] **Step 1: Run focused unit and CLI suites.**

Run:

```bash
cd tools/melee-agent
pytest tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_arrow_uses_to_direct_index tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_base_plus_index_deref_dot tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rewrites_double_index_address_form tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_escaped_or_mutated_pointer tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_side_effectful_base_index_and_subindex tests/test_pressure_explorer.py::test_indexed_struct_pointer_probe_rejects_preprocessor_regions_and_other_functions tests/test_debug_cli_reorg.py::test_indexed_struct_search_help_works tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_no_source tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_scores_generated_candidate tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_missing_checkdiff_hint tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_unmapped_hint_when_no_supported_initializer tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_no_safe_materialized_pointer tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_unvalidated_candidate tests/test_debug_cli_reorg.py::test_indexed_struct_search_json_reports_build_failed_candidate tests/test_harvest.py::test_indexed_struct_primary_selects_indexed_search tests/test_harvest.py::test_indexed_struct_source_actionability_selects_indexed_search tests/test_harvest.py::test_indexed_struct_target_map_harness_selects_indexed_search tests/test_harvest.py::test_indexed_struct_command_text_selects_indexed_search tests/test_harvest.py::test_indexed_struct_harvest_builds_indexed_search_command tests/test_harvest.py::test_harvest_propagates_indexed_search_stable_blocker tests/test_harvest.py::test_indexed_struct_apply_uses_existing_function_only_replacement tests/test_harvest.py::test_indexed_struct_apply_rolls_back_when_validation_fails tests/test_harvest.py::test_indexed_struct_apply_rolls_back_when_validation_is_interrupted -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run affected broader test files.**

Run:

```bash
cd tools/melee-agent
pytest tests/test_pressure_explorer.py tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_harvest.py -q
```

Expected: all selected tests pass.

- [ ] **Step 3: Run syntax and whitespace checks.**

Run:

```bash
cd /Users/mike/code/melee
python -m compileall -q tools/melee-agent/src/mwcc_debug/pressure_explorer.py tools/melee-agent/src/cli/debug.py tools/melee-agent/src/harvest.py
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 4: Run source CLI smokes before install refresh.**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m src.cli debug mutate indexed-struct-search --help
cd /Users/mike/code/melee
PYTHONPATH=tools/melee-agent python -m src.cli harvest indexed-struct-pointer --limit 0 --json > /tmp/melee-indexed-harvest-source.json
python -m json.tool /tmp/melee-indexed-harvest-source.json >/dev/null
```

Expected: help exits 0 and the zero-row harvest JSON parses.

- [ ] **Step 5: Commit the implementation and docs.**

Run:

```bash
cd /Users/mike/code/melee
git add docs/superpowers/specs/2026-06-04-indexed-struct-search-design.md \
  docs/superpowers/plans/2026-06-04-indexed-struct-search.md \
  tools/melee-agent/src/mwcc_debug/pressure_explorer.py \
  tools/melee-agent/src/cli/debug.py \
  tools/melee-agent/src/harvest.py \
  tools/melee-agent/tests/test_pressure_explorer.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py \
  tools/melee-agent/tests/test_harvest.py
git commit -m "feat: add indexed struct search harness"
```

- [ ] **Step 6: Refresh editable install and run installed smokes.**

Run:

```bash
cd /Users/mike/code/melee
/opt/homebrew/opt/python@3.11/bin/python3.11 -m pip install -e /Users/mike/code/melee/tools/melee-agent
/opt/homebrew/opt/python@3.11/bin/python3.11 - <<'PY'
import inspect
import src.cli
import src.cli.debug
import src.harvest
print(inspect.getfile(src.cli))
print(inspect.getfile(src.cli.debug))
print(inspect.getfile(src.harvest))
PY
melee-agent debug mutate indexed-struct-search --help
melee-agent harvest indexed-struct-pointer --limit 0 --json > /tmp/melee-indexed-harvest-installed.json
python -m json.tool /tmp/melee-indexed-harvest-installed.json >/dev/null
```

Expected: imports point at `/Users/mike/code/melee/tools/melee-agent`, help exits 0, and installed harvest JSON parses.

- [ ] **Step 7: Resolve issue #376 and re-list the queue.**

Run:

```bash
COMMIT=$(git rev-parse HEAD)
melee-agent issue resolve 376 --note "fixed in ${COMMIT}: added indexed-struct-search harness, conservative pointer dematerialization probes, harvest integration, stable blockers, and tests"
melee-agent issue list --status open
```

Expected: #376 is resolved. Remaining open issues should be #375 and #378 unless new issues were reported during this run.

- [ ] **Step 8: Update automation memory and final status.**

Append a concise entry to the active issue-resolver automation memory for this
run. Do not delete, disable, or otherwise modify automation settings. Run:

```bash
git status --short --branch
```

Expected: `master` has no working-tree changes and is ahead of `origin/master` by the new commit count.
