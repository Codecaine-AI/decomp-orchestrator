# Divide Rematerialization Ceiling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recognize the #367 CSE-vs-rematerialized signed magic divide pattern and surface a current-tooling intrinsic value-numbering ceiling verdict.

**Architecture:** Add a focused detector module under `src.mwcc_debug`, then wire its structured finding into `debug inspect diagnose` and `tools/checkdiff.py`. Keep the detector conservative: it only fires when target evidence shows rematerialization and current evidence shows quotient CSE reuse.

**Tech Stack:** Python, existing mwcc-debug pcdump parser, existing asm parser, Typer CLI, pytest.

---

### Task 1: Core Detector

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/value_numbering.py`
- Create: `tools/melee-agent/tests/test_value_numbering.py`

- [x] **Step 1: Write failing detector tests**

Add fixtures with expected asm containing `mulhw` + condition quotient + later `srawi` from the same multiply result, and current pcdump precolor containing one quotient reused by `xoris` in the then block. Assert `detect_divide_rematerialization_ceiling(...)` returns `status == "intrinsic-value-numbering-ceiling"` and `kind == "signed-magic-divide-rematerialization"`.

Add negative fixtures where current also has the second `srawi`, `xoris` uses a different quotient, a second `srawi` comes from a different `mulhw`, and the target uses unsigned `mulhwu`; assert the detector returns `None`.

- [x] **Step 2: Verify RED**

Run:

```bash
pytest tools/melee-agent/tests/test_value_numbering.py -q
```

Expected: import/function missing failures.

- [x] **Step 3: Implement detector**

Implement:

```python
def detect_divide_rematerialization_ceiling(
    *,
    function: str,
    expected_asm_text: str | None,
    current_pcdump_text: str | None = None,
    current_asm_lines: list[str] | None = None,
) -> dict | None:
    ...
```

The function should parse expected asm with `mwcc_debug.asm_parser.extract_function`, parse pcdump with `mwcc_debug.parser.parse_pcdump`, and include a loose asm-line parser for normalized checkdiff lines (`<fn>:` and `+0d0: opcode operands`) for both expected and current final-asm surfaces.

- [x] **Step 4: Verify GREEN**

Run:

```bash
pytest tools/melee-agent/tests/test_value_numbering.py -q
```

Expected: PASS.

### Task 2: Diagnose Integration

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [x] **Step 1: Write failing CLI tests**

Add a JSON test that monkeypatches `DEFAULT_MELEE_ROOT`, `_find_unit_for_function`, `_get_match_pct`, and `_resolve_pcdump_path`, creates `build/GALE01/asm/melee/gm/gm_1832.s`, and runs:

```bash
melee-agent debug inspect diagnose fn_80188910 --skip-decl-orders --json
```

Assert:

- `payload["verdict"] == "INTRINSIC VALUE-NUMBERING CEILING"`;
- `payload["value_numbering_ceiling"]["kind"] == "signed-magic-divide-rematerialization"`;
- recommendations mention `value-numbering ceiling`.

Add a text-output test for the same fixture asserting the printed output includes `[!] Value-numbering ceiling:` and does not end with `NO FAST TRANSFORM FOUND`.

- [x] **Step 2: Verify RED**

Run the two new tests. Expected: `value_numbering_ceiling` missing and generic verdict.

- [x] **Step 3: Wire detector into diagnose**

Add a helper to read expected asm from `build/GALE01/asm/<unit>.s` when present, falling back to the existing extraction helper if needed. After resolving the pcdump path, call the detector. Print the text block before the final verdict. In JSON, include `value_numbering_ceiling`. Final verdict priority should be:

1. verified cast or decl-order win;
2. frame/local-area residual;
3. value-numbering ceiling;
4. existing generic `NO FAST TRANSFORM FOUND`.

- [x] **Step 4: Verify GREEN**

Run the new diagnose tests.

### Task 3: Checkdiff Integration

**Files:**
- Modify: `tools/checkdiff.py`
- Modify: `tools/melee-agent/tests/test_checkdiff_stack_diagnostics.py`

- [x] **Step 1: Write failing checkdiff classification test**

Add a test with expected final asm containing rematerialized signed divide and current final asm containing the single-compute CSE shape. Use checkdiff-style lines, not `.fn` text, to prove the loose parser path works. Assert:

- `classification["primary"] == "backend-ceiling"`;
- `classification["backend_ceiling"]["subclass"] == "cse-vs-rematerialized-divconst"`;
- `classification["value_numbering_ceiling"]["kind"] == "signed-magic-divide-rematerialization"`;
- one reason contains `value-numbering ceiling`.

- [x] **Step 2: Verify RED**

Run that test. Expected: classification remains generic instruction sequence.

- [x] **Step 3: Wire detector into `classify_asm_diff`**

Import `detect_divide_rematerialization_ceiling` from `src.mwcc_debug.value_numbering`. Call it with `expected_asm_text="\\n".join(ref_lines)` and `current_asm_lines=our_lines`; the detector's loose parser handles checkdiff format directly. When it returns a finding, append a reason, set `primary = "backend-ceiling"`, attach `value_numbering_ceiling`, and set `backend_ceiling.subclass = "cse-vs-rematerialized-divconst"`.

- [x] **Step 4: Verify GREEN**

Run the new checkdiff test.

### Task 4: Verify, Commit, Resolve

**Files:**
- Commit spec, plan, detector, CLI/checkdiff integrations, and tests.

- [x] **Step 1: Run focused tests**

```bash
pytest tools/melee-agent/tests/test_value_numbering.py tools/melee-agent/tests/test_debug_cli_reorg.py tools/melee-agent/tests/test_checkdiff_stack_diagnostics.py -q
```

- [x] **Step 2: Run command smokes**

```bash
git diff --check
melee-agent debug inspect diagnose --help
tools/checkdiff.py fn_80188738 --no-build --format json
tools/checkdiff.py fn_80188910 --no-build --format json
tools/checkdiff.py fn_80188B3C --no-build --format json
```

The checkdiff smokes may exit nonzero because the functions remain unmatched; verify each JSON classification includes `backend_ceiling.subclass == "cse-vs-rematerialized-divconst"`. If local objects are stale or unavailable, report that as a smoke blocker but keep fixture coverage for all three twins.

- [ ] **Step 3: Refresh editable install**

```bash
python -m pip install -e tools/melee-agent
python -m pip show melee-agent | sed -n '1,14p'
```

- [ ] **Step 4: Commit and resolve #367**

```bash
git add docs/superpowers/specs/2026-06-04-divide-rematerialization-ceiling-design.md docs/superpowers/plans/2026-06-04-divide-rematerialization-ceiling.md tools/melee-agent/src/mwcc_debug/value_numbering.py tools/melee-agent/src/cli/debug.py tools/checkdiff.py tools/melee-agent/tests/test_value_numbering.py tools/melee-agent/tests/test_debug_cli_reorg.py tools/melee-agent/tests/test_checkdiff_stack_diagnostics.py
git commit -m "Classify divide rematerialization ceilings"
melee-agent issue resolve 367 --note "fixed in <commit>: diagnose/checkdiff now classify signed magic divide rematerialization CSE as an intrinsic value-numbering ceiling"
```

- [ ] **Step 5: Final status**

```bash
melee-agent issue list --status open
git status --short --branch
```
