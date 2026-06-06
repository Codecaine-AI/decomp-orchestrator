# Directed Frame Transform Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete `debug mutate frame-transform-search` workflow for issue #361.

**Architecture:** The command composes existing frame analysis, frame-directed probe generation, source compilation, real-tree scoring, and frame-transform validation. It keeps compile mechanics in `src.cli.debug` to reuse current CLI helpers, and it keeps reusable frame ranking in `mwcc_debug.frame_reservations`.

**Tech Stack:** Python, Typer CLI, pytest, existing mwcc-debug parser/scoring helpers.

---

### Task 1: Add CLI Surface And Candidate Scoring

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_debug_cli_reorg.py`
- Test: `tools/melee-agent/tests/test_frame_transform_search.py`

- [ ] **Step 1: Write the failing help test**

Add `["debug", "mutate", "frame-transform-search", "--help"]` to `test_representative_grouped_command_help_works`.

- [ ] **Step 2: Write candidate scoring tests**

Create tests that invoke the new command with a baseline pcdump, expected asm, and two `.txt` candidates. One candidate keeps the baseline frame and one matches the expected frame. Assert the JSON payload has `frame_transform_probe_evaluation.verdict == "source-reachable-frame-transform"` and ranks the fixing candidate first.

- [ ] **Step 3: Implement command skeleton**

Add `@mutate_app.command(name="frame-transform-search")` with options:

```text
--function/-f
--pcdump
--expected-asm
--no-expected
--source-file
--output-dir
--candidate
--compile-probes/--no-compile-probes
--score-match-percent/--no-score-match-percent
--max-probes
--operator
--include-lifetime-fallback/--no-include-lifetime-fallback
--timeout
--json
```

- [ ] **Step 4: Implement `.txt` and `.c` candidate scoring**

For `.txt`, read pcdump text and call `analyze_frame_from_asm_text`. For `.c`, prevalidate, call `compile_source_variant`, optionally call `_score_source_candidate_real_tree`, then analyze the compiled pcdump text. Convert each result into the variant shape expected by `evaluate_frame_transform_probe_results`.

Attach generated probe `description`, `provenance`, and nested `probe` metadata to every generated ranked variant so the output is source-actionable.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tools/melee-agent/tests/test_frame_transform_search.py -q
```

### Task 2: Add Directed Probe Planning

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_frame_transform_search.py`

- [ ] **Step 1: Write no-compile generated probe test**

Use a source fixture with one-use `f32` and scratch locals. Invoke:

```bash
debug mutate frame-transform-search -f fn --pcdump baseline --expected-asm expected --source-file source.c --no-compile-probes --json
```

Assert `probes` includes frame-directed operators and the `probe_plan.operator_priority` is present.

- [ ] **Step 2: Implement probe planning**

Derive `operator_filter` as the union of built-in frame-directed operators, `frame_report["frame_first_divergence"]["frame_transform_probe_plan"]["operator_priority"]`, and explicit `--operator` values. Generate `generate_frame_directed_probes`, post-filter them by that union, and optionally add `generate_lifetime_layout_probes` filtered to the same union.

- [ ] **Step 3: Materialize generated probes**

When `--compile-probes` is enabled, write probes to `--output-dir` or a retained temp dir, score each generated `.c`, and report `generated_source_dir`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_transform_search.py -q
```

### Task 3: Render Output, Verify, Resolve Issue

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_frame_transform_search.py`

- [ ] **Step 1: Add text renderer**

For non-JSON output, print the function, baseline/expected frame sizes, operator filter, generated source dir, verdict, stop condition, and ranked variants.

- [ ] **Step 2: Run narrow regression suite**

Run:

```bash
pytest tools/melee-agent/tests/test_frame_transform_search.py tools/melee-agent/tests/test_frame_reservations.py tools/melee-agent/tests/test_pressure_explorer.py::test_generate_frame_directed_probes_materializes_frame_levers tools/melee-agent/tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works -q
```

- [ ] **Step 3: Run command smokes**

Run:

```bash
melee-agent debug mutate frame-transform-search --help
tmpdir="$(mktemp -d)"
cat > "$tmpdir/baseline.txt" <<'EOF'
Starting function fn_80000000
FINAL CODE AFTER INSTRUCTION SCHEDULING
fn_80000000
B0: Succ={} Pred={} Labels={}
    stwu r1,-80(r1)
    addi r1,r1,80
EOF
cat > "$tmpdir/expected.s" <<'EOF'
.fn fn_80000000, global
/* 80000000 */ stwu r1, -0x60(r1)
/* 80000004 */ addi r1, r1, 0x60
.endfn fn_80000000
EOF
cat > "$tmpdir/fixed.txt" <<'EOF'
Starting function fn_80000000
FINAL CODE AFTER INSTRUCTION SCHEDULING
fn_80000000
B0: Succ={} Pred={} Labels={}
    stwu r1,-96(r1)
    addi r1,r1,96
EOF
melee-agent debug mutate frame-transform-search -f fn_80000000 --pcdump "$tmpdir/baseline.txt" --expected-asm "$tmpdir/expected.s" --candidate fixed:manual="$tmpdir/fixed.txt" --json
```

- [ ] **Step 4: Refresh editable install if CLI changed**

Refresh `/opt/homebrew/bin/melee-agent` from `/Users/mike/code/melee` using the repo's editable install or doctor/fix path.

- [ ] **Step 5: Commit and resolve #361**

Commit spec, plan, tests, and implementation. Resolve #361 with the commit hash and verification summary.
