# Tooling Governance Issue Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add central `melee-agent issue report` governance enforcement for feature requests.

**Architecture:** Implement small validation/normalization helpers in `tools/melee-agent/src/cli/issue.py`, covered by CLI tests in `tools/melee-agent/tests/test_issues.py`. Store governance metadata in existing body/resolution fields to avoid a DB migration.

**Tech Stack:** Python, Typer CLI, pytest, existing `StateDB` issue queue.

---

### Task 1: Feature Issue Governance Gate

**Files:**
- Modify: `tools/melee-agent/tests/test_issues.py`
- Modify: `tools/melee-agent/src/cli/issue.py`

- [ ] **Step 1: Write failing tests**

Add tests that prove feature issues fail without governance, pass with flags, pass with structured body labels, and accept waiver text.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_issues.py -v`

Expected: new tests fail because CLI options and validation do not exist.

- [ ] **Step 3: Implement validation and body normalization**

Add dedicated governance flags to `issue report`, require metadata for `--kind feature`, append a normalized `Governance:` section to the stored body, and keep bugs/papercuts unchanged.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_issues.py -v`

Expected: all issue tests pass.

### Task 2: Blocker Warning And Resolve Impact

**Files:**
- Modify: `tools/melee-agent/tests/test_issues.py`
- Modify: `tools/melee-agent/src/cli/issue.py`

- [ ] **Step 1: Write failing tests**

Add a blocker test showing feature-like blocker summaries warn but still report, and a resolve test showing `--impact` appends `impact=<value>`.

- [ ] **Step 2: Run tests to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_issues.py -v`

Expected: new tests fail because warning and impact support do not exist.

- [ ] **Step 3: Implement warning and impact support**

Add non-blocking feature-like blocker detection and `issue resolve --impact` validation/appending.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_issues.py -v`

Expected: all issue tests pass.

### Task 3: Documentation

**Files:**
- Modify: `.claude/skills/decomp/SKILL.md`
- Modify: `.claude/skills/mwcc-debug/SKILL.md`
- Modify: `docs/mwcc-debug.md`

- [ ] **Step 1: Update docs**

Document that bugs/papercuts should be filed immediately, while feature requests require reusable class, affected functions, source-actionable output, stop condition, and failed existing workflow.

- [ ] **Step 2: Run focused verification**

Run: `cd tools/melee-agent && uv run pytest tests/test_issues.py -v`

Expected: tests still pass.
