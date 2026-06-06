# Harvest Queue Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class harvest queue filters that run before `--limit` and record active criteria in harvest ledgers.

**Architecture:** Add a small `HarvestFilters` value object in `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`, use it in `load_queue_rows`, and thread it through `run_harvest`, `_build_ledger`, and `write_ledger`. Parse CLI filter strings in `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py` and keep harness selection unchanged.

**Tech Stack:** Python 3.11, Typer, pytest, existing `src.harvest` and `src.cli.harvest` modules.

---

### Task 1: Core Queue Filtering

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing queue filter tests**

Add `HarvestFilters` to the existing `src.harvest` import list in `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`, then add these tests near the existing `load_queue_rows` tests:

```python
def test_load_queue_rows_applies_where_filters_before_limit(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "structural-reconstruction.tsv"
    _write_queue(
        queue,
        [
            _row(
                "noise",
                headline_tool="manual-inspection",
                source_actionability="backend-ceiling",
            ),
            _row(
                "first_match",
                headline_tool="control-flow-shape-search",
                source_actionability="structural-rebuild",
            ),
            _row(
                "second_match",
                headline_tool="control-flow-shape-search",
                source_actionability="structural-rebuild",
            ),
        ],
    )

    rows = load_queue_rows(
        queue,
        work_bucket="structural-reconstruction",
        repo_root=repo_root,
        limit=1,
        filters=HarvestFilters(
            where={"headline_tool": ("control-flow-shape-search",)}
        ),
    )

    assert [row.function for row in rows] == ["first_match"]
```

```python
def test_load_queue_rows_ands_where_fields_and_ors_repeated_values(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "structural-reconstruction.tsv"
    _write_queue(
        queue,
        [
            _row(
                "wrong_tool",
                headline_tool="manual-inspection",
                source_actionability="structural-rebuild",
            ),
            _row(
                "current_tools",
                headline_tool="control-flow-shape-search",
                source_actionability="current-tools",
            ),
            _row(
                "structural",
                headline_tool="control-flow-shape-search",
                source_actionability="structural-rebuild",
            ),
        ],
    )

    rows = load_queue_rows(
        queue,
        work_bucket="structural-reconstruction",
        repo_root=repo_root,
        filters=HarvestFilters(
            where={
                "headline_tool": ("control-flow-shape-search",),
                "source_actionability": ("current-tools", "structural-rebuild"),
            }
        ),
    )

    assert [row.function for row in rows] == ["current_tools", "structural"]
```

```python
def test_load_queue_rows_excludes_source_actionability_before_limit(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "stack-local-layout.tsv"
    _write_queue(
        queue,
        [
            _row("backend", source_actionability="backend-ceiling"),
            _row("generator", source_actionability="generator-gated"),
            _row("usable", source_actionability="current-tools"),
        ],
    )

    rows = load_queue_rows(
        queue,
        work_bucket="stack-local-layout",
        repo_root=repo_root,
        limit=1,
        filters=HarvestFilters(
            exclude_source_actionability=(
                "backend-ceiling",
                "generator-gated",
            )
        ),
    )

    assert [row.function for row in rows] == ["usable"]
```

```python
def test_load_queue_rows_rejects_unknown_filter_field_even_with_zero_limit(
    tmp_path: Path,
) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "stack-local-layout.tsv"
    _write_queue(queue, [_row("demo_fn")])

    with pytest.raises(ValueError, match="unknown harvest filter field"):
        load_queue_rows(
            queue,
            work_bucket="stack-local-layout",
            repo_root=repo_root,
            limit=0,
            filters=HarvestFilters(where={"missing": ("value",)}),
        )
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py::test_load_queue_rows_applies_where_filters_before_limit tests/test_harvest.py::test_load_queue_rows_ands_where_fields_and_ors_repeated_values tests/test_harvest.py::test_load_queue_rows_excludes_source_actionability_before_limit tests/test_harvest.py::test_load_queue_rows_rejects_unknown_filter_field_even_with_zero_limit -q --no-cov
```

Expected: import or keyword-argument failures because `HarvestFilters` and `filters=` do not exist yet.

- [ ] **Step 3: Implement minimal filter object and queue filtering**

In `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`, add:

```python
@dataclass(frozen=True)
class HarvestFilters:
    where: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    exclude_source_actionability: tuple[str, ...] = ()

    def is_active(self) -> bool:
        return bool(self.where or self.exclude_source_actionability)

    def to_dict(self) -> dict[str, Any] | None:
        if not self.is_active():
            return None
        data: dict[str, Any] = {}
        if self.where:
            data["where"] = {
                key: list(values)
                for key, values in sorted(self.where.items())
            }
        if self.exclude_source_actionability:
            data["exclude_source_actionability"] = sorted(
                self.exclude_source_actionability
            )
        return data
```

Add helper functions:

```python
def _validate_filter_fields(
    filters: HarvestFilters | None,
    fieldnames: list[str] | None,
) -> None:
    if filters is None or not filters.is_active():
        return
    available = set(fieldnames or [])
    for field_name in filters.where:
        if field_name not in available:
            raise ValueError(f"unknown harvest filter field: {field_name}")
    if "source_actionability" not in available and filters.exclude_source_actionability:
        raise ValueError("unknown harvest filter field: source_actionability")


def _row_matches_filters(
    raw: Mapping[str, str],
    filters: HarvestFilters | None,
) -> bool:
    if filters is None or not filters.is_active():
        return True
    for field_name, allowed_values in filters.where.items():
        if (raw.get(field_name) or "").strip() not in set(allowed_values):
            return False
    if (
        (raw.get("source_actionability") or "").strip()
        in set(filters.exclude_source_actionability)
    ):
        return False
    return True
```

Update `load_queue_rows` to accept `filters: HarvestFilters | None = None`, validate `reader.fieldnames` immediately after `csv.DictReader(...)`, apply `_row_matches_filters(raw, filters)` before appending rows, and keep the existing `limit` check based on `len(rows)`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same focused pytest command from Step 2.

Expected: all four tests pass.

### Task 2: CLI Parsing and Ledger Metadata

**Files:**
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`
- Modify: `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py`
- Test: `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing CLI and ledger tests**

Add tests to `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`:

```python
def test_cli_parses_harvest_filters_and_forwards_to_run_harvest(
    monkeypatch,
    tmp_path: Path,
) -> None:
    from src.cli import app
    from src.cli import harvest as harvest_cli

    repo_root = _repo_with_source(tmp_path)
    taxonomy_dir = tmp_path / "queues"
    _write_queue(taxonomy_dir / "structural-reconstruction.tsv", [_row("demo_fn")])
    monkeypatch.setattr(harvest_cli, "DEFAULT_MELEE_ROOT", repo_root)
    calls: list[dict[str, object]] = []

    def fake_run_harvest(*args, **kwargs):
        calls.append(dict(kwargs))
        ledger = {
            "schema_version": 1,
            "work_bucket": args[0],
            "summary": {"by_status": {}},
            "results": [],
            "filters": kwargs["filters"].to_dict(),
        }
        Path(kwargs["ledger_path"]).write_text(json.dumps(ledger), encoding="utf-8")
        return ledger

    monkeypatch.setattr(harvest_cli, "run_harvest", fake_run_harvest)

    result = cli_runner.invoke(
        app,
        [
            "harvest",
            "structural-reconstruction",
            "--taxonomy-dir",
            str(taxonomy_dir),
            "--where",
            "headline_tool=control-flow-shape-search",
            "--where",
            "source_actionability=structural-rebuild",
            "--exclude-source-actionability",
            "backend-ceiling,generator-gated",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    filters = calls[0]["filters"]
    assert filters.to_dict() == {
        "exclude_source_actionability": [
            "backend-ceiling",
            "generator-gated",
        ],
        "where": {
            "headline_tool": ["control-flow-shape-search"],
            "source_actionability": ["structural-rebuild"],
        },
    }
```

```python
def test_cli_rejects_malformed_where_filter(monkeypatch, tmp_path: Path) -> None:
    from src.cli import app
    from src.cli import harvest as harvest_cli

    repo_root = _repo_with_source(tmp_path)
    taxonomy_dir = tmp_path / "queues"
    _write_queue(taxonomy_dir / "stack-local-layout.tsv", [_row("demo_fn")])
    monkeypatch.setattr(harvest_cli, "DEFAULT_MELEE_ROOT", repo_root)

    result = cli_runner.invoke(
        app,
        [
            "harvest",
            "stack-local-layout",
            "--taxonomy-dir",
            str(taxonomy_dir),
            "--where",
            "source_actionability",
        ],
    )

    assert result.exit_code == 2
    assert "harvest input error:" in result.output
    assert "FIELD=VALUE" in result.output
```

```python
def test_write_ledger_records_harvest_filters(tmp_path: Path) -> None:
    ledger_path = tmp_path / "ledger.json"
    ledger = write_ledger(
        ledger_path,
        work_bucket="bucket",
        started_at="2026-06-04T00:00:00Z",
        finished_at="2026-06-04T00:00:01Z",
        apply=False,
        min_match=90.0,
        limit=5,
        taxonomy_queue=tmp_path / "queue.tsv",
        target_map_path=None,
        filters=HarvestFilters(
            where={"headline_tool": ("control-flow-shape-search",)},
            exclude_source_actionability=("backend-ceiling",),
        ),
        results=[],
    )

    assert ledger["filters"] == {
        "exclude_source_actionability": ["backend-ceiling"],
        "where": {"headline_tool": ["control-flow-shape-search"]},
    }
    assert json.loads(ledger_path.read_text(encoding="utf-8"))["filters"] == (
        ledger["filters"]
    )
```

```python
def test_summarize_harvest_ledgers_reports_filter_usage(tmp_path: Path) -> None:
    filtered = tmp_path / "filtered.json"
    raw = tmp_path / "raw.json"
    filtered.write_text(
        json.dumps(
            {
                "work_bucket": "structural-reconstruction",
                "filters": {
                    "where": {"headline_tool": ["control-flow-shape-search"]},
                    "exclude_source_actionability": ["backend-ceiling"],
                },
                "results": [],
            }
        ),
        encoding="utf-8",
    )
    raw.write_text(
        json.dumps(
            {
                "work_bucket": "stack-local-layout",
                "filters": None,
                "results": [],
            }
        ),
        encoding="utf-8",
    )

    summary = summarize_harvest_ledgers([filtered, raw])

    assert summary["filtered_ledger_count"] == 1
    assert summary["raw_ledger_count"] == 1
    assert summary["filters"] == [
        {
            "count": 1,
            "filters": {
                "exclude_source_actionability": ["backend-ceiling"],
                "where": {"headline_tool": ["control-flow-shape-search"]},
            },
            "work_buckets": ["structural-reconstruction"],
        }
    ]
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py::test_cli_parses_harvest_filters_and_forwards_to_run_harvest tests/test_harvest.py::test_cli_rejects_malformed_where_filter tests/test_harvest.py::test_write_ledger_records_harvest_filters tests/test_harvest.py::test_summarize_harvest_ledgers_reports_filter_usage -q --no-cov
```

Expected: option and keyword-argument failures because CLI parsing and ledger threading do not exist yet.

- [ ] **Step 3: Implement CLI parser and ledger threading**

In `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py`, import `HarvestFilters` and add helpers:

```python
def _split_csv_values(values: list[str]) -> tuple[str, ...]:
    parsed = []
    for raw in values:
        parsed.extend(part.strip() for part in raw.split(",") if part.strip())
    return tuple(dict.fromkeys(parsed))


def _parse_harvest_filters(
    where: list[str],
    exclude_source_actionability: list[str],
) -> HarvestFilters | None:
    where_map: dict[str, list[str]] = {}
    for raw in where:
        if "=" not in raw:
            raise ValueError("--where must use FIELD=VALUE")
        field_name, value = raw.split("=", 1)
        field_name = field_name.strip()
        value = value.strip()
        if not field_name or not value:
            raise ValueError("--where must use FIELD=VALUE")
        where_map.setdefault(field_name, []).append(value)
    filters = HarvestFilters(
        where={
            field_name: tuple(dict.fromkeys(values))
            for field_name, values in where_map.items()
        },
        exclude_source_actionability=_split_csv_values(
            exclude_source_actionability
        ),
    )
    return filters if filters.is_active() else None
```

Add Typer options to `harvest_cmd`:

```python
where: list[str] = typer.Option([], "--where"),
exclude_source_actionability: list[str] = typer.Option(
    [],
    "--exclude-source-actionability",
),
```

Parse filters before calling `run_harvest` and pass `filters=filters`.

In `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`, update `_build_ledger`, `write_ledger`, and `run_harvest` signatures to accept `filters: HarvestFilters | None = None`. Store `"filters": filters.to_dict() if filters is not None else None` in the ledger. Pass `filters=filters` to `load_queue_rows`.

In `summarize_harvest_ledgers`, count ledgers with non-null filters and add:

```python
"filtered_ledger_count": filtered_ledger_count,
"raw_ledger_count": raw_ledger_count,
"filters": filter_summaries,
```

Use canonical JSON with `sort_keys=True` to group identical filter objects.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the focused CLI/ledger pytest command from Step 2.

Expected: all four tests pass.

### Task 3: Verification and Commit

**Files:**
- Verify: `/Users/mike/code/melee/tools/melee-agent/src/harvest.py`
- Verify: `/Users/mike/code/melee/tools/melee-agent/src/cli/harvest.py`
- Verify: `/Users/mike/code/melee/tools/melee-agent/tests/test_harvest.py`
- Commit: `/Users/mike/code/melee/docs/superpowers/specs/2026-06-05-harvest-queue-filters-design.md`
- Commit: `/Users/mike/code/melee/docs/superpowers/plans/2026-06-05-harvest-queue-filters.md`

- [ ] **Step 1: Run the narrow harvest test module**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q --no-cov
```

Expected: all harvest tests pass.

- [ ] **Step 2: Run CLI smoke checks**

Run help smoke:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m src.cli harvest --help | rg -- '--where|--exclude-source-actionability'
```

Expected: both new options are printed.

Run a filtered metadata smoke with no harness execution:

```bash
cd /Users/mike/code/melee/tools/melee-agent
tmp_ledger="$(mktemp /tmp/harvest-filter-ledger.XXXXXX.json)"
python -m src.cli harvest structural-reconstruction \
  --where headline_tool=control-flow-shape-search \
  --exclude-source-actionability backend-ceiling,generator-gated,diagnostic-only \
  --limit 0 \
  --ledger "$tmp_ledger" \
  --json | python -m json.tool >/dev/null
python - "$tmp_ledger" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
assert data["summary"]["total_rows"] == 0
assert data["filters"]["where"]["headline_tool"] == ["control-flow-shape-search"]
assert "backend-ceiling" in data["filters"]["exclude_source_actionability"]
print("ok")
PY
```

Expected: prints `ok`.

Run a real filtered queue check that excludes unsupported raw rows:

```bash
cd /Users/mike/code/melee/tools/melee-agent
tmp_ledger="$(mktemp /tmp/harvest-filtered-real.XXXXXX.json)"
python -m src.cli harvest structural-reconstruction \
  --where headline_tool=control-flow-shape-search \
  --exclude-source-actionability backend-ceiling,generator-gated,diagnostic-only \
  --limit 1 \
  --max-probes 0 \
  --timeout 10 \
  --ledger "$tmp_ledger" \
  --json >/dev/null
python - "$tmp_ledger" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
for row in data["results"]:
    assert row["headline_tool"] == "control-flow-shape-search"
    assert row["source_actionability"] not in {
        "backend-ceiling",
        "generator-gated",
        "diagnostic-only",
    }
    assert row.get("blocker") != "unsupported-harness"
print("ok")
PY
```

Expected: prints `ok`. If the local queue is absent, regenerate taxonomy queues first or record that the real-queue smoke could not be run.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
cd /Users/mike/code/melee
git diff -- tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py tools/melee-agent/tests/test_harvest.py docs/superpowers/specs/2026-06-05-harvest-queue-filters-design.md docs/superpowers/plans/2026-06-05-harvest-queue-filters.md
```

Expected: only scoped filter, ledger, test, spec, and plan changes.

- [ ] **Step 4: Commit**

Run:

```bash
cd /Users/mike/code/melee
git add tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py tools/melee-agent/tests/test_harvest.py docs/superpowers/specs/2026-06-05-harvest-queue-filters-design.md docs/superpowers/plans/2026-06-05-harvest-queue-filters.md
git commit -m "Add harvest queue filters"
```

Expected: commit succeeds.
