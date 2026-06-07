# Harvest Pcdump Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frame-transform harvest batches warm missing or stale mwcc_debug pcdumps before scoring rows.

**Architecture:** Add a focused preflight helper in `tools/melee-agent/src/harvest.py` that inspects loaded harvest requests, checks `src.mwcc_debug.cache`, and uses the existing harvest runner to call `debug dump setup` plus `debug dump local` only when frame-transform TUs need cache generation. Include the preflight report in ledgers.

**Tech Stack:** Python, Typer CLI, pytest, existing `HarnessRunner` abstraction, existing `src.mwcc_debug.cache` module.

---

### Task 1: Frame-Transform Pcdump Preflight

**Files:**
- Modify: `tools/melee-agent/src/harvest.py`
- Modify: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing tests**

Add tests near the existing harvest orchestration tests in `tools/melee-agent/tests/test_harvest.py`:

```python
def test_run_harvest_prefetches_missing_frame_transform_pcdumps(monkeypatch, tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path, "melee/demo.c")
    (repo_root / "src" / "melee" / "other.c").parent.mkdir(parents=True, exist_ok=True)
    (repo_root / "src" / "melee" / "other.c").write_text("void other_fn(void) {}\n", encoding="utf-8")
    queue = tmp_path / "queues" / "stack-local-layout.tsv"
    _write_queue(
        queue,
        [
            _row("demo_fn", file_path="melee/demo.c", source_actionability="current-tools"),
            _row("demo_fn_2", file_path="melee/demo.c", source_actionability="current-tools"),
            _row("other_fn", file_path="melee/other.c", source_actionability="current-tools"),
        ],
    )
    lookups: list[str] = []

    def fake_lookup(repo: Path, unit: str):
        lookups.append(unit)
        return None

    monkeypatch.setattr(harvest_module.pcdump_cache, "lookup", fake_lookup)
    calls: list[list[str]] = []

    def runner(args: list[str], *, cwd: Path, timeout: int) -> HarnessProcessResult:
        calls.append(args)
        return HarnessProcessResult(
            command=args,
            returncode=0,
            stdout=json.dumps({"variants": []}) if args[:2] != ["debug", "dump"] else "",
            stderr="",
        )

    ledger = run_harvest(
        "stack-local-layout",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
    )

    assert calls[:3] == [
        ["debug", "dump", "setup"],
        ["debug", "dump", "local", str(repo_root / "src" / "melee" / "demo.c"), "--function", "demo_fn"],
        ["debug", "dump", "local", str(repo_root / "src" / "melee" / "other.c"), "--function", "other_fn"],
    ]
    assert [call[0:3] for call in calls[3:]] == [
        ["debug", "mutate", "frame-transform-search"],
        ["debug", "mutate", "frame-transform-search"],
        ["debug", "mutate", "frame-transform-search"],
    ]
    assert lookups == ["melee/demo", "melee/other"]
    assert ledger["preflight"]["pcdump"]["generated_units"] == ["melee/demo", "melee/other"]
```

Also add tests that fresh entries skip setup/dump, stale entries refresh, and indexed-struct rows do not preflight.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q --no-cov
```

Expected: the new tests fail because `src.harvest` has no `pcdump_cache` import and no `preflight` ledger metadata.

- [ ] **Step 3: Implement minimal helper and ledger field**

In `tools/melee-agent/src/harvest.py`, import `src.mwcc_debug.cache as pcdump_cache`, add a small preflight runner before the per-row harness loop, and pass its report into `_build_ledger`/`write_ledger`. Only preflight rows where `select_harness(request) == HARNESS_FRAME_TRANSFORM`, `request.source_actionability == "current-tools"`, `request.frame_closability_tier == "current-tools-padstack"`, and `request.source_file is not None`.

Key implementation details:

```python
@dataclass
class PcdumpPreflightReport:
    enabled: bool
    required_units: list[str] = field(default_factory=list)
    fresh_units: list[str] = field(default_factory=list)
    generated_units: list[str] = field(default_factory=list)
    setup_command: dict[str, Any] | None = None
    dump_commands: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
```

Pass `str(source_file)` to `debug dump local` because the default harvest runner executes from `tools/melee-agent`. Use `source_file.relative_to(repo_root / "src").with_suffix("")` as the cache unit. Deduplicate by unit and keep the first function for `--function`.

When setup or dump fails, raise `ValueError` with the failed command and shortened stderr/stdout so the existing CLI catch block reports a clean `harvest input error`.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q --no-cov
python -m compileall src/harvest.py src/cli/harvest.py
```

Expected: all tests pass and compileall succeeds.

- [ ] **Step 5: Run command-level smokes**

Run:

```bash
cd /Users/mike/code/melee
python -m src.cli harvest stack-local-layout --help
python -m src.cli harvest stack-local-layout --taxonomy-dir /tmp/nonexistent --json
```

Expected: help prints normally; nonexistent queue exits nonzero with the existing queue-missing message.

- [ ] **Step 6: Commit**

Commit the spec, plan, tests, and implementation:

```bash
cd /Users/mike/code/melee
git add docs/superpowers/specs/2026-06-05-harvest-pcdump-preflight-design.md docs/superpowers/plans/2026-06-05-harvest-pcdump-preflight.md tools/melee-agent/src/harvest.py tools/melee-agent/tests/test_harvest.py
git commit -m "Preflight pcdump caches for frame harvest"
```
