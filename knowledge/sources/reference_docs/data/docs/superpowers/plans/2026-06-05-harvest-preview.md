# Harvest Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a no-probe harvest preview mode and a zero-match guard for filtered harvest batches.

**Architecture:** Add a preview pass in `/Users/mike/code/melee/tools/melee-agent/src/harvest.py` that shares filter validation and row matching with the existing queue loader but counts before `--limit`. Add a core `run_harvest` guard that rejects active filters with zero matching rows before pcdump preflight or ledger creation. Add CLI options in `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py` that print preview output without ledger allocation.

**Tech Stack:** Python 3.11, Typer, pytest, existing `src.harvest` and `src.cli.harvest` modules.

---

### Task 1: Core Preview Data Model

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing core preview tests**

Add `preview_harvest_queue` to the import list in `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`, then add this helper and these tests near the existing `load_queue_rows` tests:

```python
def _structural_row(
    function: str,
    *,
    match_percent: str = "99.0",
    headline_tool: str = "extract-opseq-xrefs",
    source_actionability: str = "structural-rebuild",
    next_command: str = "",
) -> dict[str, str]:
    row = _row(
        function,
        match_percent=match_percent,
        headline_tool=headline_tool,
        source_actionability=source_actionability,
        frame_closability_tier="",
        next_command=next_command,
    )
    row["primary"] = "control-flow-source-shape"
    row["subcategory"] = "branch-or-control-flow-shape"
    return row
```

```python
def test_preview_harvest_queue_counts_facets_and_sample_before_limit(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "structural-reconstruction.tsv"
    _write_queue(
        queue,
        [
            _structural_row(
                "below_threshold",
                match_percent="80.0",
                headline_tool="manual-inspection",
                source_actionability="structural-rebuild",
            ),
            _structural_row(
                "first_match",
                match_percent="97.0",
                headline_tool="extract-opseq-xrefs",
                source_actionability="structural-rebuild",
                next_command="melee-agent extract get first_match",
            ),
            _structural_row(
                "second_match",
                match_percent="98.0",
                headline_tool="extract-opseq-xrefs",
                source_actionability="structural-rebuild",
                next_command="melee-agent extract get second_match",
            ),
            _structural_row(
                "wrong_actionability",
                match_percent="99.0",
                headline_tool="manual-inspection",
                source_actionability="backend-ceiling",
            ),
        ],
    )

    preview = preview_harvest_queue(
        queue,
        work_bucket="structural-reconstruction",
        repo_root=repo_root,
        min_match=90.0,
        limit=1,
        filters=HarvestFilters(
            where={"source_actionability": ("structural-rebuild",)}
        ),
        sample_limit=2,
    )

    assert preview["counts"] == {
        "queue_rows": 4,
        "eligible_rows": 3,
        "matching_rows": 2,
        "would_process_rows": 1,
    }
    assert preview["facets"]["headline_tool"] == [
        {"value": "extract-opseq-xrefs", "count": 2}
    ]
    assert [row["function"] for row in preview["sample"]] == [
        "first_match",
        "second_match",
    ]
    assert preview["sample"][0]["harness"] == "control-flow-shape-search"
    assert preview["sample"][0]["next_command"] == "melee-agent extract get first_match"
```

```python
def test_preview_harvest_queue_zero_match_reports_near_miss_facets(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "structural-reconstruction.tsv"
    _write_queue(
        queue,
        [
            _structural_row(
                "current_structural",
                headline_tool="extract-opseq-xrefs",
                source_actionability="structural-rebuild",
            ),
            _structural_row(
                "backend_control_flow",
                headline_tool="control-flow-shape-search",
                source_actionability="backend-ceiling",
            ),
            _structural_row(
                "generator",
                headline_tool="manual-inspection",
                source_actionability="generator-gated",
            ),
        ],
    )

    preview = preview_harvest_queue(
        queue,
        work_bucket="structural-reconstruction",
        repo_root=repo_root,
        filters=HarvestFilters(
            where={
                "source_actionability": ("structural-rebuild",),
                "headline_tool": ("control-flow-shape-search",),
            }
        ),
    )

    assert preview["counts"]["matching_rows"] == 0
    assert preview["sample"] == []
    assert preview["facet_source"] == "eligible_rows"
    assert preview["facets"]["source_actionability"] == [
        {"value": "backend-ceiling", "count": 1},
        {"value": "generator-gated", "count": 1},
        {"value": "structural-rebuild", "count": 1},
    ]
    assert preview["near_miss_facets"]["headline_tool"] == [
        {"value": "extract-opseq-xrefs", "count": 1}
    ]
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py::test_preview_harvest_queue_counts_facets_and_sample_before_limit tests/test_harvest.py::test_preview_harvest_queue_zero_match_reports_near_miss_facets -q --no-cov
```

Expected: import failure because `preview_harvest_queue` does not exist.

- [ ] **Step 3: Implement preview_harvest_queue**

In `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`, add:

```python
PREVIEW_FACET_FIELDS = (
    "primary",
    "subcategory",
    "source_actionability",
    "headline_tool",
    "frame_closability_tier",
)
```

Then add helpers that build a `HarvestRequest` from a raw TSV row, format top
facet counts as `{"value": value, "count": count}`, and expose:

```python
def preview_harvest_queue(
    queue_path: Path,
    *,
    work_bucket: str,
    repo_root: Path,
    min_match: float = 0.0,
    limit: int | None = None,
    target_map: dict[str, dict[str, Any]] | None = None,
    target_map_path: Path | None = None,
    filters: HarvestFilters | None = None,
    sample_limit: int = 10,
    facet_limit: int = 8,
) -> dict[str, Any]:
```

The function must:

- load `target_map_path` when `target_map` is `None`;
- validate filter fields with `_validate_filter_fields`;
- count non-empty functions as `queue_rows`;
- apply `--min-match` before filters;
- count eligible and matching rows before applying `--limit`;
- compute `would_process_rows` as `min(matching_rows, limit)` when a limit is supplied;
- compute facets from matching rows, or from eligible rows when active filters match zero rows;
- compute `near_miss_facets` for each active `where` field by relaxing that field while keeping all other filters active;
- return up to `sample_limit` matching rows with `function`, `match_percent`, `file_path`, `primary`, `subcategory`, `source_actionability`, `headline_tool`, `frame_closability_tier`, `next_command`, `frame_next_command`, and inferred `harness`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same focused pytest command from Step 2.

Expected: both preview core tests pass.

### Task 2: CLI Preview and Core Zero-Match Guard

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py`
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing CLI tests**

Add tests to `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`:

```python
def test_run_harvest_filtered_limit_zero_keeps_filter_smoke_behavior(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "stack-local-layout.tsv"
    _write_queue(
        queue,
        [_row("demo_fn", source_actionability="current-tools")],
    )

    def fail_runner(args: list[str], *, cwd: Path, timeout: int) -> HarnessProcessResult:
        raise AssertionError(f"limit-zero harvest must not run {args}")

    ledger = run_harvest(
        "stack-local-layout",
        repo_root=repo_root,
        queue_path=queue,
        limit=0,
        runner=fail_runner,
        filters=HarvestFilters(
            where={"source_actionability": ("current-tools",)}
        ),
    )

    assert ledger["summary"]["total_rows"] == 0
    assert ledger["filters"] == {
        "where": {"source_actionability": ["current-tools"]}
    }
```

```python
def test_run_harvest_filtered_zero_rows_raises_before_pcdump_and_ledger(
    monkeypatch,
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "stack-local-layout.tsv"
    ledger_path = tmp_path / "empty.json"
    _write_queue(
        queue,
        [_row("demo_fn", source_actionability="current-tools")],
    )

    def fail_lookup(_repo: Path, _unit: str):
        raise AssertionError("zero-match filtered harvest must not inspect pcdumps")

    def fail_runner(args: list[str], *, cwd: Path, timeout: int) -> HarnessProcessResult:
        raise AssertionError(f"zero-match filtered harvest must not run {args}")

    monkeypatch.setattr(harvest_module.pcdump_cache, "lookup", fail_lookup)

    with pytest.raises(ValueError, match="filters matched zero rows"):
        run_harvest(
            "stack-local-layout",
            repo_root=repo_root,
            queue_path=queue,
            ledger_path=ledger_path,
            runner=fail_runner,
            filters=HarvestFilters(
                where={"source_actionability": ("source-probe",)}
            ),
        )

    assert not ledger_path.exists()
```

```python
def test_cli_harvest_preview_json_does_not_run_or_write_ledger(
    monkeypatch,
    tmp_path: Path,
) -> None:
    from src.cli import app
    from src.cli import harvest as harvest_cli

    repo_root = _repo_with_source(tmp_path)
    taxonomy_dir = tmp_path / "queues"
    _write_queue(
        taxonomy_dir / "structural-reconstruction.tsv",
        [
            _structural_row(
                "demo_fn",
                headline_tool="extract-opseq-xrefs",
                source_actionability="structural-rebuild",
            )
        ],
    )
    monkeypatch.setattr(harvest_cli, "DEFAULT_MELEE_ROOT", repo_root)
    monkeypatch.setattr(
        harvest_cli,
        "_default_ledger_path",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("preview must not allocate a ledger path")
        ),
    )

    def fail_run_harvest(*args, **kwargs):
        raise AssertionError("preview must not run harvest")

    monkeypatch.setattr(harvest_cli, "run_harvest", fail_run_harvest)

    result = cli_runner.invoke(
        app,
        [
            "harvest",
            "structural-reconstruction",
            "--taxonomy-dir",
            str(taxonomy_dir),
            "--where",
            "source_actionability=structural-rebuild",
            "--preview",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["counts"]["matching_rows"] == 1
    assert payload["sample"][0]["function"] == "demo_fn"
    assert list((repo_root / "build" / "harvest").glob("*.json")) == []
```

```python
def test_cli_harvest_preview_text_shows_facets_and_sample(
    monkeypatch,
    tmp_path: Path,
) -> None:
    from src.cli import app
    from src.cli import harvest as harvest_cli

    repo_root = _repo_with_source(tmp_path)
    taxonomy_dir = tmp_path / "queues"
    _write_queue(
        taxonomy_dir / "stack-local-layout.tsv",
        [
            _row(
                "demo_fn",
                headline_tool="frame-transform-search",
                source_actionability="current-tools",
                next_command="melee-agent debug mutate frame-transform-search -f demo_fn",
            )
        ],
    )
    monkeypatch.setattr(harvest_cli, "DEFAULT_MELEE_ROOT", repo_root)

    result = cli_runner.invoke(
        app,
        [
            "harvest",
            "stack-local-layout",
            "--taxonomy-dir",
            str(taxonomy_dir),
            "--preview",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "preview: stack-local-layout" in result.output
    assert "matching=1" in result.output
    assert "headline_tool: frame-transform-search=1" in result.output
    assert "demo_fn" in result.output
    assert "harness=frame-transform-search" in result.output
    assert "next_command=melee-agent debug mutate frame-transform-search -f demo_fn" in result.output
```

```python
def test_cli_filtered_harvest_zero_rows_fails_before_ledger(
    monkeypatch,
    tmp_path: Path,
) -> None:
    from src.cli import app
    from src.cli import harvest as harvest_cli

    repo_root = _repo_with_source(tmp_path)
    taxonomy_dir = tmp_path / "queues"
    ledger_path = tmp_path / "empty.json"
    _write_queue(
        taxonomy_dir / "stack-local-layout.tsv",
        [_row("demo_fn", source_actionability="current-tools")],
    )
    monkeypatch.setattr(harvest_cli, "DEFAULT_MELEE_ROOT", repo_root)

    result = cli_runner.invoke(
        app,
        [
            "harvest",
            "stack-local-layout",
            "--taxonomy-dir",
            str(taxonomy_dir),
            "--ledger",
            str(ledger_path),
            "--where",
            "source_actionability=source-probe",
        ],
    )

    assert result.exit_code == 2
    assert "harvest input error:" in result.output
    assert "filters matched zero rows" in result.output
    assert not ledger_path.exists()
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py::test_run_harvest_filtered_limit_zero_keeps_filter_smoke_behavior tests/test_harvest.py::test_run_harvest_filtered_zero_rows_raises_before_pcdump_and_ledger tests/test_harvest.py::test_cli_harvest_preview_json_does_not_run_or_write_ledger tests/test_harvest.py::test_cli_harvest_preview_text_shows_facets_and_sample tests/test_harvest.py::test_cli_filtered_harvest_zero_rows_fails_before_ledger -q --no-cov
```

Expected: Typer rejects `--preview`, `preview_harvest_queue` is missing, and the core zero-match guard does not exist.

- [ ] **Step 3: Implement CLI preview**

In `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py`:

- import `preview_harvest_queue`;
- add `preview: bool = typer.Option(False, "--preview")`;
- add `preview_sample: int = typer.Option(10, "--preview-sample")`;
- parse filters before ledger path allocation;
- if `preview` is true, call `preview_harvest_queue`, print JSON when `--json` is set, otherwise print compact text;
- update `run_harvest` to call `preview_harvest_queue` before pcdump preflight when filters are active and raise `ValueError("filters matched zero rows; run with --preview to inspect current queue facets")` when `matching_rows` is zero.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same focused pytest command from Step 2.

Expected: all five Task 2 tests pass.

### Task 3: Verification, Smoke Checks, and Issue Resolution

**Files:**
- Modify: `/Users/mike/code/melee/docs/superpowers/specs/2026-06-05-harvest-preview-design.md`
- Modify: `/Users/mike/code/melee/docs/superpowers/plans/2026-06-05-harvest-preview.md`

- [ ] **Step 1: Run full focused test suite**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q --no-cov
```

Expected: all harvest tests pass.

- [ ] **Step 2: Run compile and whitespace checks**

Run:

```bash
cd /Users/mike/code/melee
python -m compileall tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py
git diff --check
```

Expected: compileall succeeds and `git diff --check` prints nothing.

- [ ] **Step 3: Run command-level preview smokes**

Run:

```bash
cd /Users/mike/code/melee
/opt/homebrew/bin/melee-agent harvest structural-reconstruction --where source_actionability=structural-rebuild --preview --json
/opt/homebrew/bin/melee-agent harvest stack-local-layout --where source_actionability=source-probe --preview
```

Expected: commands exit 0; JSON includes `counts.matching_rows`; text preview includes facets and a zero matching count for stale filters if current data still has no `source-probe` rows.

- [ ] **Step 4: Run zero-row fail-fast smoke with a temporary queue**

Run a CLI command against a temporary taxonomy directory containing one non-matching row and an explicit ledger path.

Expected: command exits 2, prints `filters matched zero rows`, and does not write the ledger.

- [ ] **Step 5: Commit, resolve issue, and refresh install**

Run:

```bash
cd /Users/mike/code/melee
git add docs/superpowers/specs/2026-06-05-harvest-preview-design.md docs/superpowers/plans/2026-06-05-harvest-preview.md tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py tools/melee-agent/tests/test_harvest.py
git commit -m "Add harvest queue preview"
/opt/homebrew/bin/melee-agent issue resolve 399 --note "fixed in $(git rev-parse HEAD): harvest --preview now reports counts/facets/samples without harness execution, and filtered zero-row harvests fail before ledger writes"
python -m pip install -e tools/melee-agent
```

Expected: commit succeeds, issue #399 is resolved, and editable install still imports from `/Users/mike/code/melee/tools/melee-agent/src`.
