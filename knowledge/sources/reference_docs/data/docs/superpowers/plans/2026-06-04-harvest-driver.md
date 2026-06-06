# Harvest Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `melee-agent harvest <work_bucket>` with a shared harness contract, JSON ledger, safe optional apply, and adapters for frame and register search harnesses.

**Architecture:** Add a focused `src/harvest.py` orchestration module and a thin `src/cli/harvest.py` Typer wrapper. The orchestrator reads taxonomy TSV queues, resolves adapter facts from a target map, runs registered JSON harness adapters, normalizes candidates/results, writes a versioned ledger, and applies only validated 100% candidates with function-only replacement and rollback.

**Tech Stack:** Python 3.11, Typer, pytest, csv/json/pathlib/subprocess, existing `src.mwcc_debug.source_patch` parsing helpers.

---

## File Structure

- Create `tools/melee-agent/src/harvest.py`: dataclasses, queue parsing, adapter registry, subprocess runner protocol, validation, apply, ledger aggregation.
- Create `tools/melee-agent/src/cli/harvest.py`: root-command callback function for `melee-agent harvest`.
- Modify `tools/melee-agent/src/cli/__init__.py`: register the callback with `app.command("harvest")`.
- Create `tools/melee-agent/tests/test_harvest.py`: unit tests for orchestration, adapters, apply, ledger, and CLI.
- Keep `docs/superpowers/specs/2026-06-04-harvest-driver-design.md` and this plan in the final commit.

## Task 1: Core Orchestrator

**Files:**
- Create: `tools/melee-agent/src/harvest.py`
- Test: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write tests for queue parsing, adapter selection, score extraction, unsupported tools, and missing register targets.**

Use temporary TSV files with headers:

```python
HEADER = [
    "match_percent", "function", "primary", "subcategory", "frame_cause",
    "frame_verdict", "frame_closability_tier", "frame_attribution_status",
    "frame_source_object_symbol", "source_actionability", "headline_tool",
    "actionability_reason", "decl_order_best_delta",
    "decl_order_best_ordering", "decl_order_evaluated_status",
    "decl_order_candidate_count", "file_path", "frame_next_command",
    "next_command",
]
```

Assert:

- Rows below `min_match` are skipped.
- `frame-transform-search` builds `debug mutate frame-transform-search ... --json`.
- A register row with target-map entry `{ "harness": "coalesce-search", "target": "37=40" }` builds `debug coalesce-search ... --json`.
- A register row without `target` returns blocker `missing-register-target`.
- Unknown tools return blocker `unsupported-harness`.
- `extract_candidate_score()` finds top-level `final_match_percent`, top-level `match_percent`, and nested `objective.match_percent`.
- A fake frame harness response with one 100.0 candidate returns status `validated` when `apply=False`.
- A fake frame harness response with one 99.9 candidate returns blocker `no-validated-candidate`.
- Ledger summary aggregation counts `by_status`, `by_harness`, `by_tier`, and `by_blocker`.

- [ ] **Step 2: Run the tests and confirm they fail because `src.harvest` does not exist.**

Run:

```bash
cd tools/melee-agent && pytest tests/test_harvest.py -q
```

Expected: import failure or missing symbol failures.

- [ ] **Step 3: Implement the core dataclasses and pure helpers.**

Define:

```python
@dataclass
class HarvestRequest:
    function: str
    work_bucket: str
    match_percent: float
    file_path: str
    headline_tool: str
    source_file: Path | None
    primary: str = ""
    subcategory: str = ""
    source_actionability: str = ""
    frame_closability_tier: str = ""
    next_command: str = ""
    frame_next_command: str = ""
    facts: dict[str, Any] = field(default_factory=dict)
    apply: bool = False
    timeout: int = 120
    max_probes: int = 8
```

Define `HarvestResult`, `HarnessProcessResult`, `load_queue_rows()`, `load_target_map()`, `resolve_source_file()`, `select_harness()`, `extract_candidate_score()`, `best_validated_candidate()`, `summarize_ledger()`, and `write_ledger()`.

- [ ] **Step 4: Implement registered harness adapters.**

Support:

- `frame-transform-search`: `["debug", "mutate", "frame-transform-search", "-f", fn, "--source-file", source, "--compile-probes", "--json", "--max-probes", str(max_probes), "--timeout", str(timeout)]`
- `coalesce-search`: `["debug", "coalesce-search", "-f", fn, "--target", target, "--source-file", source, "--compile-probes", "--json", "--max-probes", str(max_probes), "--timeout", str(timeout)]`
- `select-order-search`: same as coalesce, plus `["--class", str(class_id)]`

Adapters call a runner protocol that defaults to `subprocess.run([sys.executable, "-m", "src.cli", *args], cwd=repo_root / "tools" / "melee-agent", capture_output=True, text=True, timeout=timeout + 30)`.

- [ ] **Step 5: Implement apply support.**

Use `extract_function()` and `replace_function()` from `src.mwcc_debug.source_patch` to build a patched target text. Write to `target_path.with_suffix(target_path.suffix + ".tmp")`, replace atomically, then run post-apply validation:

```bash
python tools/checkdiff.py <function> --compact
```

In code, call a validator runner that defaults to `subprocess.run([sys.executable, "tools/checkdiff.py", function, "--compact"], cwd=repo_root, capture_output=True, text=True, timeout=timeout)`. Treat return code `0` as validated; otherwise restore the original target text and return blocker `apply-validation-failed`.

- [ ] **Step 6: Add apply tests before considering Task 1 complete.**

Add tests that:

- Create a target source file with two functions and a candidate source file with a changed target function.
- Fake a 100.0 harness candidate and a passing validator, run with `apply=True`, and assert only the target function body changed while the sibling function stayed identical.
- Fake a 100.0 harness candidate and a failing validator, run with `apply=True`, and assert the target file is rolled back and blocker `apply-validation-failed` is recorded.
- Fake a candidate source missing the requested function and assert blocker `apply-transfer-failed`.

- [ ] **Step 7: Run Task 1 tests.**

Run:

```bash
cd tools/melee-agent && pytest tests/test_harvest.py -q
```

Expected: all core tests pass.

## Task 2: CLI Wiring

**Files:**
- Create: `tools/melee-agent/src/cli/harvest.py`
- Modify: `tools/melee-agent/src/cli/__init__.py`
- Test: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Add CLI tests.**

Use `typer.testing.CliRunner` against `src.cli.app`. Tests should assert:

- `melee-agent harvest missing-bucket --taxonomy-dir <tmp>` exits nonzero and says the queue is missing.
- `melee-agent harvest stack-local-layout --taxonomy-dir <tmp> --ledger <tmp>/ledger.json --limit 1` writes a ledger and prints status counts.
- `--json` prints parseable ledger JSON with `schema_version == 1`.
- Omitting `--ledger` writes a file under `<repo>/build/harvest/stack-local-layout-*.json` and prints that path in text mode.

Monkeypatch `src.cli.harvest.DEFAULT_MELEE_ROOT` and the orchestrator runner so no live harness runs.

- [ ] **Step 2: Implement the root-command callback.**

In `tools/melee-agent/src/cli/harvest.py`, define a function that can be registered directly as `melee-agent harvest <work_bucket>`:

```python
def harvest_cmd(
    work_bucket: str,
    apply: bool = typer.Option(False, "--apply"),
    min_match: float = typer.Option(0.0, "--min-match"),
    limit: int | None = typer.Option(None, "--limit"),
    taxonomy_dir: Path | None = typer.Option(None, "--taxonomy-dir"),
    ledger: Path | None = typer.Option(None, "--ledger"),
    target_map: Path | None = typer.Option(None, "--target-map"),
    max_probes: int = typer.Option(8, "--max-probes"),
    timeout: int = typer.Option(120, "--timeout"),
    json_out: bool = typer.Option(False, "--json"),
) -> None:
```

Call `run_harvest()` and render either JSON or a compact text summary.

- [ ] **Step 3: Register the CLI.**

In `src/cli/__init__.py`, import `harvest_cmd` and add:

```python
from .harvest import harvest_cmd

app.command("harvest")(harvest_cmd)
```

- [ ] **Step 4: Run CLI tests.**

Run:

```bash
cd tools/melee-agent && pytest tests/test_harvest.py -q
```

Expected: all tests pass.

## Task 3: Verification And Commit

**Files:**
- All files from Tasks 1 and 2
- `docs/superpowers/specs/2026-06-04-harvest-driver-design.md`
- `docs/superpowers/plans/2026-06-04-harvest-driver.md`

- [ ] **Step 1: Run focused tests.**

```bash
cd tools/melee-agent && pytest tests/test_harvest.py tests/test_cli.py::test_opseq_alias_forwards_to_table_typer -q
```

- [ ] **Step 2: Run CLI smoke checks from repo root.**

```bash
melee-agent harvest --help
melee-agent harvest stack-local-layout --limit 0 --min-match 99 --ledger /tmp/melee-harvest-smoke.json
python -m json.tool /tmp/melee-harvest-smoke.json >/dev/null
melee-agent harvest stack-local-layout --limit 0 --min-match 99 --json >/tmp/melee-harvest-smoke-stdout.json
python -m json.tool /tmp/melee-harvest-smoke-stdout.json >/dev/null
```

- [ ] **Step 3: Inspect the diff.**

```bash
git diff -- tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py tools/melee-agent/src/cli/__init__.py tools/melee-agent/tests/test_harvest.py docs/superpowers/specs/2026-06-04-harvest-driver-design.md docs/superpowers/plans/2026-06-04-harvest-driver.md
```

- [ ] **Step 4: Commit.**

```bash
git add tools/melee-agent/src/harvest.py tools/melee-agent/src/cli/harvest.py tools/melee-agent/src/cli/__init__.py tools/melee-agent/tests/test_harvest.py docs/superpowers/specs/2026-06-04-harvest-driver-design.md docs/superpowers/plans/2026-06-04-harvest-driver.md
git commit -m "feat: add taxonomy harvest driver"
```

## Self-Review

Spec coverage: the plan implements the top-level command, common request/result contract, frame and register adapters, target-map facts, stable blockers, safe apply, versioned yield ledger, and tests.

Placeholder scan: no placeholders are intentionally left in the implementation steps.

Type consistency: the plan consistently names `HarvestRequest`, `HarvestResult`, `HarnessProcessResult`, `run_harvest()`, `harvest_cmd`, `schema_version`, and blocker codes.
