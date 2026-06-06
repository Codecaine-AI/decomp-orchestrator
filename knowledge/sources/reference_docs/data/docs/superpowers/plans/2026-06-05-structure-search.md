# Structure Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `melee-agent debug search structure` for issue #416 so agents can run source-structure searches, including a conservative switch case-order axis, before banking backend ceilings.

**Architecture:** Implement the core logic in `tools/melee-agent/src/search/structure.py` and keep CLI wiring in `tools/melee-agent/src/search/cli.py`, where `debug search` already lives. The module normalizes existing decl-order/control-flow search output, generates and scores case-order source candidates, ranks variants, and renders stable JSON/text payloads.

**Tech Stack:** Python 3.11, Typer, pytest, tree-sitter C helpers, existing `debug mutate decl-orders`, existing `debug mutate control-flow-shape-search`, existing real-tree source scoring helpers via injectable runners.

---

## File Structure

- Create `tools/melee-agent/src/search/structure.py`
  - Dataclasses for axis summaries and variants.
  - Ranking and payload helpers.
  - Decl-order/control-flow payload normalization.
  - Conservative case-order source probe generator.
- Create `tools/melee-agent/tests/search/test_structure.py`
  - Unit tests for ranking, normalization, case-order generation, and safety blockers.
- Modify `tools/melee-agent/src/search/cli.py`
  - Add `@search_app.command("structure")`.
  - Resolve source files and report baseline match percent.
  - Call structure module runners and render JSON/text.
- Modify `tools/melee-agent/tests/search/test_cli_smoke.py`
  - Add help and JSON/text CLI smoke tests using monkeypatched runners.
- Keep `tools/melee-agent/src/cli/debug.py` unchanged unless an unavoidable helper needs to be imported.

## Task 1: Core Normalization And Ranking

**Files:**
- Create: `tools/melee-agent/src/search/structure.py`
- Create/modify: `tools/melee-agent/tests/search/test_structure.py`

- [ ] **Step 1: Write failing ranking and normalization tests**

Create `tools/melee-agent/tests/search/test_structure.py` with:

```python
from __future__ import annotations

import json
from pathlib import Path

from src.search.structure import (
    AxisSummary,
    StructureVariant,
    normalize_control_flow_payload,
    normalize_decl_order_payload,
    rank_structure_variants,
    structure_payload,
)


def test_rank_structure_variants_prefers_exact_then_match_then_delta() -> None:
    variants = [
        StructureVariant(
            axis="decl-order",
            operator="decl-order-swap",
            label="decl-micro",
            status="ok",
            baseline_percent=90.0,
            match_percent=91.0,
            final_match_percent=91.0,
            delta=1.0,
        ),
        StructureVariant(
            axis="case-order",
            operator="case-order-adjacent-swap",
            label="case-win",
            status="ok",
            baseline_percent=90.0,
            match_percent=100.0,
            final_match_percent=100.0,
            delta=10.0,
        ),
        StructureVariant(
            axis="control-flow",
            operator="ternary-to-if-else",
            label="cf-better",
            status="ok",
            baseline_percent=90.0,
            match_percent=99.0,
            final_match_percent=99.0,
            delta=9.0,
        ),
    ]

    ranked = rank_structure_variants(variants)

    assert [row.label for row in ranked] == ["case-win", "cf-better", "decl-micro"]
    assert [row.rank for row in ranked] == [1, 2, 3]


def test_normalize_control_flow_payload_preserves_retained_sources() -> None:
    payload = {
        "function": "fn_80000000",
        "variants": [
            {
                "label": "control-flow-ternary-0",
                "operator": "ternary-to-if-else",
                "status": "ok",
                "path": "/tmp/cf.c",
                "source_retained": "/tmp/cf.c",
                "match_percent": 98.0,
                "final_match_percent": 98.0,
                "match_percent_error": None,
                "probe": {"provenance": {"kind": "control-flow-shape"}},
            }
        ],
    }

    axis, variants = normalize_control_flow_payload(
        payload,
        baseline_percent=95.0,
        command="melee-agent debug mutate control-flow-shape-search -f fn_80000000 --json",
    )

    assert axis.axis == "control-flow"
    assert axis.status == "evaluated"
    assert axis.candidate_count == 1
    assert variants[0].delta == 3.0
    assert variants[0].source_retained == "/tmp/cf.c"
    assert variants[0].metadata["probe"]["provenance"]["kind"] == "control-flow-shape"


def test_normalize_decl_order_payload_emits_rerun_command_without_source() -> None:
    payload = {
        "function": "fn_80000000",
        "baseline_pct": 90.0,
        "best_pct": 91.25,
        "results": [
            {
                "label": "swap a <-> b",
                "strategy": "swap",
                "match_pct": 91.25,
                "delta": 1.25,
                "skipped": False,
            }
        ],
    }

    axis, variants = normalize_decl_order_payload(
        payload,
        baseline_percent=90.0,
        command="melee-agent debug mutate decl-orders fn_80000000 --strategy all --json",
    )

    assert axis.axis == "decl-order"
    assert axis.status == "evaluated"
    assert variants[0].operator == "decl-order-swap"
    assert variants[0].source_retained is None
    assert "--keep-best" not in variants[0].command
    assert "debug mutate decl-orders fn_80000000" in variants[0].command


def test_structure_payload_reports_future_axes_and_stop_condition() -> None:
    axis = AxisSummary(axis="case-order", status="blocked", blocker="no-case-order-probes")
    payload = structure_payload(
        function="fn_80000000",
        source="src/melee/demo.c",
        generated_source_dir="/tmp/structure",
        baseline_percent=80.0,
        axes=[axis],
        variants=[],
    )

    assert payload["stop_condition"]["kind"] == "no-improvement"
    assert payload["axes"][0]["blocker"] == "no-case-order-probes"
    assert {row["axis"] for row in payload["future_axes"]} == {
        "statement-order",
        "inline-boundary",
        "loop-shape-expanded",
    }
    json.dumps(payload)
```

- [ ] **Step 2: Verify RED**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_structure.py -k 'rank_structure or normalize or structure_payload' -q
```

Expected: import failure for `src.search.structure`.

- [ ] **Step 3: Implement minimal dataclasses and normalizers**

Create `tools/melee-agent/src/search/structure.py` with:

```python
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AxisSummary:
    axis: str
    status: str
    candidate_count: int = 0
    blocker: str | None = None
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v not in (None, "")}


@dataclass
class StructureVariant:
    axis: str
    operator: str
    label: str
    status: str
    baseline_percent: float | None = None
    match_percent: float | None = None
    final_match_percent: float | None = None
    delta: float | None = None
    path: str | None = None
    source_retained: str | None = None
    command: str = ""
    apply_hint: str = "review candidate source, then transfer verified function body"
    metadata: dict[str, Any] = field(default_factory=dict)
    rank: int | None = None

    def score_percent(self) -> float:
        value = self.final_match_percent
        if value is None:
            value = self.match_percent
        return -1.0 if value is None else float(value)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None and v != ""}
```

Then implement:

```python
def _float_or_none(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _delta(value: float | None, baseline: float | None) -> float | None:
    if value is None or baseline is None:
        return None
    return round(value - baseline, 6)


def rank_structure_variants(variants: list[StructureVariant]) -> list[StructureVariant]:
    ranked = sorted(
        variants,
        key=lambda variant: (
            0 if variant.score_percent() >= 100.0 and variant.status == "ok" else 1,
            -variant.score_percent(),
            -(variant.delta if variant.delta is not None else -9999.0),
            0 if variant.status == "ok" else 1,
            variant.axis,
            variant.operator,
            variant.label,
        ),
    )
    for index, variant in enumerate(ranked, 1):
        variant.rank = index
    return ranked
```

For control-flow normalization, read `payload["variants"]`, set axis
`evaluated` when variants exist, `blocked` when payload has a blocker, and
preserve `probe` inside `metadata`.

For decl-order normalization, accept both `payload["results"]` and nested
`payload["rounds"][*]["results"]`. Ignore skipped rows. Use `match_pct` first,
then `best_pct` as fallback. Use `delta` when present, otherwise compute from
baseline.

For `structure_payload`, sort variants with `rank_structure_variants`, emit
future axes exactly as the spec states, and set stop condition:

- `exact-match` when any score is 100;
- `improved` when any delta is positive;
- `no-improvement` otherwise.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_structure.py -k 'rank_structure or normalize or structure_payload' -q
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/search/structure.py
git add -u tools/melee-agent/tests/search/test_structure.py
git commit -m "Add structure search result model"
```

## Task 2: Conservative Case-Order Probe Generator

**Files:**
- Modify: `tools/melee-agent/src/search/structure.py`
- Modify: `tools/melee-agent/tests/search/test_structure.py`

- [ ] **Step 1: Write failing case-order tests**

Append:

```python
from src.search.structure import generate_case_order_variants


def _switch_source(body: str) -> str:
    return (
        "int fn_80000000(int mode)\\n"
        "{\\n"
        f"{body}"
        "}\\n"
    )


def test_case_order_generates_adjacent_promote_demote_candidates(tmp_path: Path) -> None:
    source = _switch_source(
        "    switch (mode) {\\n"
        "    case 0:\\n"
        "        return 1;\\n"
        "    case 1:\\n"
        "        return 2;\\n"
        "    case 2:\\n"
        "        return 3;\\n"
        "    }\\n"
        "    return 0;\\n"
    )

    axis, variants = generate_case_order_variants(
        source,
        "fn_80000000",
        output_dir=tmp_path,
        baseline_percent=25.0,
        max_candidates=8,
    )

    assert axis.status == "evaluated"
    assert axis.candidate_count >= 4
    assert {variant.operator for variant in variants} >= {
        "case-order-adjacent-swap",
        "case-order-promote",
        "case-order-demote",
    }
    retained = Path(variants[0].source_retained)
    assert retained.exists()
    text = retained.read_text()
    assert "case 1:" in text
    assert "case 0:" in text
    assert variants[0].metadata["original_labels"] == ["0", "1", "2"]


def test_case_order_treats_grouped_labels_as_one_arm(tmp_path: Path) -> None:
    source = _switch_source(
        "    switch (mode) {\\n"
        "    case 0:\\n"
        "    case 1:\\n"
        "        return 2;\\n"
        "    case 2:\\n"
        "        return 3;\\n"
        "    }\\n"
        "    return 0;\\n"
    )

    _axis, variants = generate_case_order_variants(
        source,
        "fn_80000000",
        output_dir=tmp_path,
        baseline_percent=25.0,
        max_candidates=4,
    )

    assert variants
    text = Path(variants[0].source_retained).read_text()
    assert text.index("case 0:") < text.index("case 1:")


def test_case_order_rejects_fallthrough_preprocessor_and_nested_switch(tmp_path: Path) -> None:
    unsafe_sources = [
        _switch_source(
            "    switch (mode) {\\n"
            "    case 0:\\n"
            "        mode++; /* fallthrough */\\n"
            "    case 1:\\n"
            "        return 2;\\n"
            "    }\\n"
        ),
        _switch_source(
            "    switch (mode) {\\n"
            "#if 1\\n"
            "    case 0:\\n"
            "        return 1;\\n"
            "#endif\\n"
            "    case 1:\\n"
            "        return 2;\\n"
            "    }\\n"
        ),
        _switch_source(
            "    switch (mode) {\\n"
            "    case 0:\\n"
            "        switch (mode + 1) { case 9: return 9; }\\n"
            "    case 1:\\n"
            "        return 2;\\n"
            "    }\\n"
        ),
    ]
    for source in unsafe_sources:
        axis, variants = generate_case_order_variants(
            source,
            "fn_80000000",
            output_dir=tmp_path,
            baseline_percent=25.0,
        )
        assert variants == []
        assert axis.status == "blocked"
        assert axis.blocker in {
            "unsafe-switch-fallthrough",
            "unsafe-switch-preprocessor",
            "unsafe-switch-nested-ambiguous",
        }


def test_case_order_rejects_missing_function(tmp_path: Path) -> None:
    axis, variants = generate_case_order_variants(
        "int other(void) { return 0; }\\n",
        "fn_80000000",
        output_dir=tmp_path,
        baseline_percent=25.0,
    )

    assert variants == []
    assert axis.blocker == "source-unavailable"
```

- [ ] **Step 2: Verify RED**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_structure.py -k case_order -q
```

Expected: import or assertion failures because case-order generation does not exist.

- [ ] **Step 3: Implement case-order generator**

In `tools/melee-agent/src/search/structure.py`, import:

```python
import re
from src.common import tree_sitter_c
from src.common.tree_sitter_c import find_function_definition, node_text
```

Implement `generate_case_order_variants(source, function, output_dir, baseline_percent, max_candidates=12)`.

Implementation requirements:

- parse the function with tree-sitter;
- locate the first top-level `switch_statement` under the function body;
- reject when the switch text contains preprocessor directives using `re.search(r"(?m)^\\s*#", switch_text)`;
- reject when the switch text contains more than one `switch` token;
- split case arms by scanning direct children of the switch body and grouping contiguous `case_statement` / `default_statement` labels with their following statements;
- reject an arm when its text contains `fallthrough` case-insensitively;
- reject an arm when it has no terminal `break;`, `return`, `goto`, or `continue;` before the next arm;
- write candidates for adjacent swaps, promotions, and demotions until `max_candidates`;
- preserve the original prefix/suffix around the switch body;
- return `AxisSummary(axis="case-order", status="evaluated", candidate_count=len(variants))` or a blocked summary.

Each variant must use:

```python
StructureVariant(
    axis="case-order",
    operator="case-order-adjacent-swap" | "case-order-promote" | "case-order-demote",
    label=f"case-order-{strategy}-{index}",
    status="candidate",
    baseline_percent=baseline_percent,
    path=str(path),
    source_retained=str(path),
    command=f"melee-agent debug search structure -f {function} --axis case-order --max-candidates {max_candidates}",
    metadata={
        "strategy": strategy,
        "switch_line": line_number,
        "original_labels": original_labels,
        "case_order": new_labels,
    },
)
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_structure.py -k case_order -q
```

Expected: case-order tests pass.

- [ ] **Step 5: Commit**

```bash
git add -u tools/melee-agent/src/search/structure.py tools/melee-agent/tests/search/test_structure.py
git commit -m "Add case-order structure probes"
```

## Task 3: Structure CLI Orchestration

**Files:**
- Modify: `tools/melee-agent/src/search/structure.py`
- Modify: `tools/melee-agent/src/search/cli.py`
- Modify: `tools/melee-agent/tests/search/test_cli_smoke.py`

- [ ] **Step 1: Write failing CLI tests**

Append to `tools/melee-agent/tests/search/test_cli_smoke.py`:

```python
def test_search_structure_help() -> None:
    runner = CliRunner()
    result = runner.invoke(search_app, ["structure", "--help"], env={"COLUMNS": "180"})

    assert result.exit_code == 0, result.output
    assert "--axis" in result.stdout
    assert "--max-candidates" in result.stdout
    assert "--json" in result.stdout


def test_search_structure_json_uses_injected_runner(monkeypatch, tmp_path: Path) -> None:
    from src.search import cli as search_cli
    from src.search.structure import AxisSummary, StructureVariant

    source = tmp_path / "demo.c"
    source.write_text("int fn_80000000(void) { return 0; }\\n")

    def fake_run_structure_search(**kwargs):
        return {
            "function": kwargs["function"],
            "source": str(source),
            "generated_source_dir": str(tmp_path),
            "baseline_percent": 10.0,
            "axes": [AxisSummary("case-order", "evaluated", 1).to_dict()],
            "variants": [
                StructureVariant(
                    axis="case-order",
                    operator="case-order-adjacent-swap",
                    label="case-order-adjacent-swap-0",
                    status="ok",
                    baseline_percent=10.0,
                    match_percent=20.0,
                    final_match_percent=20.0,
                    delta=10.0,
                    source_retained=str(source),
                ).to_dict()
            ],
            "future_axes": [],
            "stop_condition": {"kind": "improved", "blocker": None, "reason": "test"},
        }

    monkeypatch.setattr(search_cli, "run_structure_search", fake_run_structure_search)

    result = CliRunner().invoke(
        search_app,
        [
            "structure",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    assert payload["function"] == "fn_80000000"
    assert payload["variants"][0]["axis"] == "case-order"
    assert payload["stop_condition"]["kind"] == "improved"


def test_search_structure_text_renders_top_variant(monkeypatch, tmp_path: Path) -> None:
    from src.search import cli as search_cli

    source = tmp_path / "demo.c"
    source.write_text("int fn_80000000(void) { return 0; }\\n")

    def fake_run_structure_search(**kwargs):
        return {
            "function": "fn_80000000",
            "source": str(source),
            "generated_source_dir": str(tmp_path),
            "baseline_percent": 10.0,
            "axes": [{"axis": "case-order", "status": "evaluated", "candidate_count": 1}],
            "variants": [
                {
                    "rank": 1,
                    "axis": "case-order",
                    "operator": "case-order-adjacent-swap",
                    "label": "case-order-adjacent-swap-0",
                    "status": "ok",
                    "final_match_percent": 20.0,
                    "delta": 10.0,
                    "source_retained": str(source),
                    "command": "melee-agent debug search structure -f fn_80000000 --axis case-order",
                }
            ],
            "future_axes": [],
            "stop_condition": {"kind": "improved", "blocker": None, "reason": "test"},
        }

    monkeypatch.setattr(search_cli, "run_structure_search", fake_run_structure_search)

    result = CliRunner().invoke(
        search_app,
        ["structure", "-f", "fn_80000000", "--source-file", str(source)],
    )

    assert result.exit_code == 0, result.output
    assert "structure search - fn_80000000" in result.stdout
    assert "case-order / case-order-adjacent-swap" in result.stdout
    assert "delta: +10.00000" in result.stdout
```

- [ ] **Step 2: Verify RED**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_cli_smoke.py -k 'search_structure' -q
```

Expected: command is missing.

- [ ] **Step 3: Implement `run_structure_search`**

In `tools/melee-agent/src/search/structure.py`, add:

```python
DEFAULT_STRUCTURE_AXES = ("decl-order", "control-flow", "case-order")


def run_structure_search(
    *,
    function: str,
    source_path: Path | None,
    output_dir: Path,
    axes: tuple[str] | tuple[str, str] | tuple[str, str, str] = DEFAULT_STRUCTURE_AXES,
    baseline_percent: float | None = None,
    max_candidates: int = 24,
    timeout: int = 120,
    decl_order_runner=None,
    control_flow_runner=None,
) -> dict[str, Any]:
    return structure_payload(
        function=function,
        source=str(source_path) if source_path is not None else None,
        generated_source_dir=str(output_dir),
        baseline_percent=baseline_percent,
        axes=[],
        variants=[],
    )
```

Behavior:

- create `output_dir`;
- read `source_path` when provided;
- for `case-order`, call `generate_case_order_variants`;
- for `decl-order`, call `decl_order_runner(function=function, timeout=timeout)` when provided, otherwise run `melee-agent debug mutate decl-orders <function> --strategy all --json`;
- for `control-flow`, call `control_flow_runner(function=function, timeout=timeout)` when provided, otherwise run `melee-agent debug mutate control-flow-shape-search -f <function> --json --output-dir <output_dir>/control-flow`;
- catch subprocess timeout/failure/JSON errors as axis blockers;
- limit ranked variants to `max_candidates`;
- return the final `structure_payload` value with all collected axis summaries
  and ranked variants.

- [ ] **Step 4: Implement CLI command**

In `tools/melee-agent/src/search/cli.py`, import:

```python
from src.search.structure import (
    DEFAULT_STRUCTURE_AXES,
    render_structure_text,
    run_structure_search,
)
```

Add:

```python
@search_app.command("structure")
def structure_cmd(
    function: Annotated[str, typer.Option("--function", "-f", help="Function to search.")],
    source_file: Annotated[Optional[Path], typer.Option("--source-file", "--source")] = None,
    axes: Annotated[Optional[list[str]], typer.Option("--axis", help="Axis to run; repeatable.")] = None,
    output_dir: Annotated[Optional[Path], typer.Option("--output-dir")] = None,
    max_candidates: Annotated[int, typer.Option("--max-candidates")] = 24,
    timeout: Annotated[int, typer.Option("--timeout")] = 120,
    json_out: Annotated[bool, typer.Option("--json")] = False,
) -> None:
    melee_root = _compute_melee_root()
    resolved_source = _resolve_source_file(source_file, melee_root=melee_root)
    if output_dir is None:
        output_dir = melee_root / "build" / "structure-search" / function
    payload = run_structure_search(
        function=function,
        source_path=resolved_source,
        output_dir=output_dir,
        axes=tuple(axes or DEFAULT_STRUCTURE_AXES),
        max_candidates=max_candidates,
        timeout=timeout,
    )
    if json_out:
        typer.echo(json.dumps(payload, indent=2))
    else:
        typer.echo(render_structure_text(payload))
```

If no `--source-file` is supplied, resolve from report.json by reading
`build/GALE01/report.json` inside `_compute_melee_root()` and matching
`function` to `unit["name"]`, then `src/<unit>.c`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_cli_smoke.py -k 'search_structure' -q
```

Expected: structure CLI tests pass.

- [ ] **Step 6: Commit**

```bash
git add -u tools/melee-agent/src/search/cli.py tools/melee-agent/src/search/structure.py tools/melee-agent/tests/search/test_cli_smoke.py
git commit -m "Add structure search CLI"
```

## Task 4: Integration Verification And Issue Closure

**Files:**
- Modify if needed: `tools/melee-agent/tests/search/test_structure.py`
- Modify if needed: `tools/melee-agent/tests/search/test_cli_smoke.py`

- [ ] **Step 1: Run focused tests**

Run:

```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/search/test_structure.py tools/melee-agent/tests/search/test_cli_smoke.py -k 'structure' -q
```

Expected: all structure tests pass.

- [ ] **Step 2: Run command smokes**

Run:

```bash
/opt/homebrew/bin/melee-agent debug search structure --help
tmpdir=$(mktemp -d /tmp/structure-search-smoke.XXXXXX)
/opt/homebrew/bin/melee-agent debug search structure -f hsd_803AAA48 --axis case-order --max-candidates 1 --output-dir "$tmpdir" --json
rm -rf "$tmpdir"
```

Expected: help succeeds; JSON smoke either emits one or more variants, or emits a stable source/safety blocker without mutating the working tree.

- [ ] **Step 3: Run hygiene checks**

Run:

```bash
python -m compileall tools/melee-agent/src/search/structure.py tools/melee-agent/src/search/cli.py
git diff --check
git status --short
```

Expected: compileall and diff check pass; only intended files are dirty before final commit.

- [ ] **Step 4: Resolve issue and refresh install**

After final implementation commit:

```bash
/opt/homebrew/bin/melee-agent issue resolve 416 --note "fixed in <commit>: added debug search structure with decl-order/control-flow orchestration and conservative case-order source probes"
python -m pip install -e tools/melee-agent
/opt/homebrew/bin/python3.11 - <<'PY'
import inspect
import src.cli
print(inspect.getfile(src.cli))
PY
```

Expected: issue resolves; import path points at `/Users/mike/code/melee/tools/melee-agent/src/cli/__init__.py`.

## Self-Review

- Spec coverage: the plan covers the required `debug search structure` CLI, existing decl-order/control-flow orchestration, minimal case-order axis, ranking, stable JSON/text output, future axes, blockers, read-only behavior, and tests.
- Scope check: statement-order, inline-boundary, and expanded loop-shape are explicitly future axes and are not implemented in this plan.
- Type consistency: `AxisSummary`, `StructureVariant`, `rank_structure_variants`, `normalize_control_flow_payload`, `normalize_decl_order_payload`, `generate_case_order_variants`, `run_structure_search`, and `render_structure_text` are defined before later tasks use them.
