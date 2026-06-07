# Composite Harvest Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `melee-agent harvest --compose` mode that applies registered harness layers in sequence and can preserve verified sub-100% layer improvements.

**Architecture:** Keep the existing single-harness path as the default. Add a composed request runner in `src.harvest` that normalizes ordered layer facts, runs strict JSON checkdiff between layers, uses existing harness command builders, and records one top-level composed ledger result with per-layer details.

**Tech Stack:** Python dataclasses, Typer CLI, pytest, fake harness runners, fake checkdiff runners.

---

## File Structure

- Modify `tools/melee-agent/src/harvest.py`: add name-magic registration, layer-sequence normalization, strict match payload helpers, partial-layer apply, and composed request execution.
- Modify `tools/melee-agent/src/cli/harvest.py`: add `--compose` and pass it through to `run_harvest`.
- Modify `tools/melee-agent/tests/test_harvest.py`: add regression tests for compose mode, name-magic selection, dry-run stop behavior, partial improvement apply, rollback, and CLI pass-through.
- Add `docs/superpowers/specs/2026-06-04-composite-harvest-driver-design.md`: committed design spec for issue #382.
- Add `docs/superpowers/plans/2026-06-04-composite-harvest-driver.md`: this implementation plan.

### Task 1: Composition Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Add failing tests for layer sequence, dry-run, apply, and rollback**

Add tests that call `run_harvest(..., compose=True)` with fake runners. Use JSON match checker payloads:

```python
def _match_process(function: str, match: bool, percent: float, primary: str) -> HarnessProcessResult:
    return HarnessProcessResult(
        ["checkdiff", function],
        0 if match else 1,
        json.dumps({
            "function": function,
            "match": match,
            "fuzzy_match_percent": percent,
            "classification": {"primary": primary},
        }),
        "",
    )
```

The tests must verify:

- target-map `harnesses` runs `indexed-struct-search` then `frame-transform-search`
- dry-run stops after the first candidate and records later layers as `not_observed`
- apply mode keeps a sub-100 candidate when strict checkdiff improves from 90.0 to 95.0
- apply mode rolls back a sub-100 candidate when strict checkdiff does not improve
- a requested future harness such as `control-flow-search` returns `unsupported-harness` at the layer and top-level result
- missing register `target` blocks at the register layer and bubbles to the top-level result

- [ ] **Step 2: Add failing tests for name-magic selection and CLI flag**

Add one unit test that a data-symbol row selects `name-magic-source-declarations`, and one CLI test that `melee-agent harvest ... --compose --json` passes `compose=True` into the fake runner and returns a parseable ledger.

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q
```

Expected: new tests fail because `compose`, `--compose`, and `name-magic-source-declarations` are not implemented in harvest.

### Task 2: Harvest Core Implementation

**Files:**
- Modify: `tools/melee-agent/src/harvest.py`

- [ ] **Step 1: Register the name-magic harness**

Add:

```python
HARNESS_NAME_MAGIC = "name-magic-source-declarations"
```

Include it in `REGISTERED_HARNESSES`, select it for data-symbol rows, and build this adapter command:

```python
[
    "debug", "mutate", HARNESS_NAME_MAGIC,
    "-f", request.function,
    "--source-file", str(request.source_file),
    "--compile-probes",
    "--score-match-percent",
    "--json",
    "--max-probes", str(request.max_probes),
    "--timeout", str(request.timeout),
]
```

- [ ] **Step 2: Add strict match payload helpers**

Implement helpers for parsing JSON match checker output, extracting match percent, checking `match=true`, extracting classification primary, and identifying whether a harness layer signal remains in a classification payload.

- [ ] **Step 3: Add layer sequence normalization**

Implement a function that reads `request.facts["harnesses"]`, accepting strings and dicts, and returns ordered fact dictionaries. If absent, infer a deduplicated sequence from data-symbol, indexed-struct, and `select_harness(request)`.

- [ ] **Step 4: Add composed request runner**

Implement `run_composed_harvest_request()` that:

- runs strict match check before every layer
- runs the forced harness adapter
- accepts 100% candidates as full matches
- sorts retained `.c` sub-100 candidates by harness-reported score descending
- tries sub-100 candidates one at a time with temporary transfer and rollback
- accepts the first sub-100 candidate that strict JSON checkdiff verifies as an improvement
- records per-layer result dictionaries
- stops with stable top-level status and `harness="composed"`

- [ ] **Step 5: Add partial-layer apply**

Implement a partial apply path that snapshots the target source, writes a candidate function, runs strict JSON checkdiff, runs the existing same-file matched-function regression guard, keeps the edit only when match percent improves, the layer signal is gone, or match is true, and otherwise rolls back with `apply-validation-failed`.

- [ ] **Step 6: Thread compose through `run_harvest`**

Add `compose: bool = False` to `run_harvest`. When true, map rows through `run_composed_harvest_request`; otherwise preserve the existing `run_harvest_request` path.

- [ ] **Step 7: Run tests**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py -q
```

Expected: all `test_harvest.py` tests pass.

### Task 3: CLI Wiring

**Files:**
- Modify: `tools/melee-agent/src/cli/harvest.py`

- [ ] **Step 1: Add the Typer option**

Add:

```python
compose: bool = typer.Option(False, "--compose"),
```

Pass `compose=compose` into `run_harvest`.

- [ ] **Step 2: Run CLI smoke tests**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py::test_cli_compose_passes_flag_and_outputs_json -q
```

Expected: the CLI compose smoke test passes.

### Task 4: Verification And Issue Resolution

**Files:**
- Modify: issue queue state through `melee-agent issue resolve 382`
- Commit: spec, plan, harvest core, harvest CLI, harvest tests

- [ ] **Step 1: Run narrow verification**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m pytest tests/test_harvest.py tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_without_source -q
```

Expected: tests pass.

- [ ] **Step 2: Run CLI smoke commands**

Run:

```bash
cd /Users/mike/code/melee/tools/melee-agent
python -m src.cli harvest missing-bucket --taxonomy-dir /tmp/missing
```

Expected: command exits nonzero and prints a missing queue error.

- [ ] **Step 3: Refresh editable install**

Run the repo doctor or editable install refresh path from `/Users/mike/code/melee` so `/opt/homebrew/bin/melee-agent` imports the current master checkout.

- [ ] **Step 4: Resolve issue #382**

Run:

```bash
melee-agent issue resolve 382 --note "fixed on master by the composite harvest driver commit: harvest --compose now runs ordered registered harness layers, preserves verified sub-100 layer improvements, records strict checkdiff layer details, and supports name-magic harvest selection"
```

- [ ] **Step 5: Commit**

Commit only the files touched for #382:

```bash
git add docs/superpowers/specs/2026-06-04-composite-harvest-driver-design.md \
  docs/superpowers/plans/2026-06-04-composite-harvest-driver.md \
  tools/melee-agent/src/harvest.py \
  tools/melee-agent/src/cli/harvest.py \
  tools/melee-agent/tests/test_harvest.py
git commit -m "feat: compose harvest harness layers"
```

Do not stage unrelated pre-existing changes in `tools/melee-agent/src/cli/debug.py` or `tools/melee-agent/tests/test_debug_cli_reorg.py`.
