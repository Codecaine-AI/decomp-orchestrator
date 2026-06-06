# Frame Match Relevance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or execute these steps with equivalent test/review checkpoints.

**Goal:** Surface a conservative match-relevance verdict for frame residuals so agents can avoid chasing offset-only frame noise.

**Architecture:** Extend the existing pure frame taxonomy mapper with two fields, then pass those fields through existing stuck and inventory output paths.

## Task 1: Taxonomy Tests

Files:
- Modify `tools/melee-agent/tests/test_frame_taxonomy.py`

Steps:
1. Add assertions to same-frame stack-slot/checkdiff tests that relevance is `match-neutral` only with explicit same-frame/localizer evidence.
2. Add assertions to pure-reservation tests that relevance is `match-gating-candidate`.
3. Extend the existing size/alignment regression so relevance is `unknown`.
4. Add a negative test where a size/alignment frame report has
   `source-reachable-validated`; relevance must remain `unknown`.

Verification:
```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/test_frame_taxonomy.py -q
```

## Task 2: CLI And Inventory Tests

Files:
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`
- Modify `tools/melee-agent/tests/test_function_taxonomy_inventory.py`

Steps:
1. Assert `debug inspect stuck --no-pcdump --json` exposes
   `frame_residual.match_relevance == "match-neutral"` for stack-slot rows.
2. Assert the stuck message includes `match-neutral`.
3. Assert taxonomy JSONL records include `frame_match_relevance`.
4. Assert taxonomy CSV headers include `frame_match_relevance`.
5. Assert stack-local queue TSV headers include `frame_match_relevance`.

Verification:
```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/test_debug_cli_reorg.py -k frame_residual -q
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/test_function_taxonomy_inventory.py -k frame -q
```

## Task 3: Implement Mapper And Surface Fields

Files:
- Modify `tools/melee-agent/src/mwcc_debug/frame_taxonomy.py`
- Modify `tools/melee-agent/src/cli/debug.py`
- Modify `tools/function_taxonomy_inventory.py`

Steps:
1. Add `_frame_match_relevance(...)` returning
   `(match_relevance, match_relevance_reason)`.
   - `stack-object-offset-shift` is `match-neutral` only when
     `classification.primary == "stack-slot-layout"` with localizer/equal-frame
     evidence, or a frame report has `frame_delta == 0`.
   - `pure-reservation` is `match-gating-candidate`.
   - validated frame movement on size/alignment/lifetime cases stays `unknown`.
2. Add both fields to `_build_result(...)`.
3. Include the fields in `_attach_frame_taxonomy_hint_fields(...)`.
4. Add the fields to inventory record attachment and CSV/queue field lists.
5. Add concise match-neutral wording to same-frame stuck messages.

Verification:
```bash
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/test_frame_taxonomy.py tools/melee-agent/tests/test_debug_cli_reorg.py -k 'frame_residual or frame_taxonomy' -q
PYTEST_ADDOPTS= pytest --no-cov tools/melee-agent/tests/test_function_taxonomy_inventory.py -k frame -q
python -m compileall tools/melee-agent/src/mwcc_debug/frame_taxonomy.py tools/melee-agent/src/cli/debug.py tools/function_taxonomy_inventory.py
```

## Task 4: Smoke And Resolve

Steps:
1. Run a CLI smoke for `debug inspect stuck --help`.
2. Resolve #413 only after tests and smoke pass.
3. Refresh editable install with `python -m pip install -e tools/melee-agent`.
4. Verify `/opt/homebrew/bin/melee-agent` imports from `/Users/mike/code/melee`.
