# Agent Decompilation Improvement Checklist

This checklist comes from reviewing the long-running Codex sessions
`019e15fa-b2c5-7a12-8452-07170e6f1ff8` and
`019e2a2f-3ac1-72e0-bd0a-17d8e8aa6610`.

The goal is to make agents faster and more reliable without lowering the bar
for clean, PR-ready decompilation diffs.

## Priority 1: Remove False Failures

- [x] Add per-TU/object serialization to `tools/checkdiff.py` so parallel
  checks cannot corrupt or contend on the same generated object.
- [x] Teach `tools/checkdiff.py` to classify common outcomes:
  instruction-identical, relocation-label-only, register-only, stack-layout,
  data/symbol-layout, and compile/build failure.
- [x] Add a worktree doctor/bootstrap command that verifies a Codex worktree
  has the fork tooling overlay, `orig/GALE01/sys/main.dol`, usable workflow
  scripts, current `melee-agent` commands, and optional Ghidra configuration.

## Priority 2: Preserve Productive State

- [x] Add an attempt ledger keyed by function name that records best score,
  retained edits, reverted experiments, suspected blocker, and when to move on.
- [x] Add a move-on recommender that detects repeated no-progress attempts on
  register-only mismatches and suggests a fresh function or TU.
- [x] Add a stale-state guard that warns when `report.json`, object files, or
  worktree tooling are older or inconsistent with the current source state.

## Priority 3: Find Better Source Shapes

- [x] Build a data/symbol layout analyzer that compares `symbols.txt`, object
  layout, and C declarations for likely `static`/global, array/pointer, BSS
  adjacency, tail-string, and `.sdata` placement issues.
- [x] Improve inline-candidate discovery for local functions, JObj/TObj access,
  setter wrappers, varargs helpers, and PAD_STACK-heavy functions.
- [x] Improve pattern tools so command names and examples match the real CLI
  (`patterns anti-pattern`, available `state` subcommands, local tool paths).

## Priority 4: Upgrade Skills And Data

- [x] Update the decomp skill to start with the doctor/bootstrap check, run
  compile-producing checks serially, and record attempts as it works.
- [x] Add a hard stop rule for pure register-allocation loops after a bounded
  number of source-equivalent probes.
- [x] Document the fork workflow clearly: iterate on tooling-enabled worktrees,
  package PR branches from clean upstream, and keep local tooling overlaid
  without leaking into upstream PR diffs.
- [x] Add Discord-search fallback guidance for worktrees that lack
  `docs/discord-knowledge`.
- [x] Curate a MWCC pattern book from session wins: declaration order,
  `int` vs `s32`, void return signatures, pointer-local reuse, direct global
  access, BSS-relative access, varargs stack layout, by-value `Vec3`, and
  relocation-only false mismatches.
- [x] Maintain a "do not retry yet" list for saturated functions and patterns
  unless new source evidence appears.

## Current Implementation Slice

- [x] Implement `checkdiff.py` object serialization.
- [x] Implement first-pass checkdiff classification.
- [x] Add a doctor/bootstrap command after the checkdiff changes are verified.
- [x] Add `melee-agent attempts` for source-level attempt history and move-on
  recommendations.
- [x] Extend `tools/worktree-doctor.py` with stale `report.json` and compile
  output detection.
- [x] Add `tools/symbol-layout-analyzer.py` for first-pass data/symbol layout
  diagnostics.
- [x] Extend `melee-agent patterns inlines` with local helper, JObj/TObj,
  setter, varargs, PAD_STACK, and Vec3 heuristics.
- [x] Add plural aliases for `melee-agent patterns wrappers` and
  `melee-agent patterns anti-patterns`.
- [x] Add canonical `.agents/skills/decomp/SKILL.md` with doctor,
  checkdiff, attempts, source-shape tools, and register-loop stop rules.
- [x] Add `.claude/skills/decomp/SKILL.md` and `.codex/skills`
  compatibility symlinks for agent-specific skill discovery.
- [x] Add PR cleanliness, Discord fallback, MWCC pattern book, and
  do-not-retry-yet docs.
- [x] Add a stable tool manifest with canonical command names, current
  subcommands, setup paths, and stale-path replacements.
- [x] Add Discord query recipes for MWCC regalloc, varargs, by-value `Vec3`,
  PAD_STACK, small-data relocations, and BSS/data-layout issues.
- [x] Add per-module `mn` notes covering `mnsnap`, `mnvibration`,
  `mnnamenew`, known local maxima, and successful source shapes.
- [x] Add the large-function checkpoint for callers/callees, data layout,
  asset loads, varargs lists, and intended behavior before major rewrites.
- [x] Extend the diff classifier with a signature/type mismatch bucket for
  changed call shapes, return types, prototypes, or inline boundaries.
- [x] Extend the data/symbol analyzer with map/object layout evidence from
  build artifacts when symbol placement is visible outside `symbols.txt`.

## New Agent Commands

```bash
# Record an attempt with optional classification/blocker context
melee-agent attempts record Func_80000000 --match 87.5 --outcome improved \
  --classification register-allocation --note "first coherent structure"

# Mark a retained source improvement even if the score did not improve
melee-agent attempts record Func_80000000 --match 84.0 --outcome neutral \
  --retained --note "correct call shape; registers still off"

# Inspect the current ledger state
melee-agent attempts show Func_80000000
melee-agent attempts show Func_80000000 --json
melee-agent attempts list

# Check worktree/bootstrap/build-state health before a long session
python tools/worktree-doctor.py

# Inspect likely data/symbol layout causes for a mismatch
python tools/symbol-layout-analyzer.py lbl_804D1234
python tools/symbol-layout-analyzer.py 0x804D1234 --json

# Scan a source file for inline candidates before chasing stack/register noise
melee-agent patterns inlines src/melee/mn/mndiagram2.c

# Both singular and plural pattern commands are accepted
melee-agent patterns wrapper "gobj->user_data"
melee-agent patterns wrappers "gobj->user_data"
melee-agent patterns anti-pattern list
melee-agent patterns anti-patterns list

# Reference docs for avoiding repeated failed probes
docs/agent-tool-manifest.md
docs/discord-search-recipes.md
docs/large-function-checkpoint.md
docs/mn-module-notes.md
docs/mwcc-pattern-book.md
docs/agent-do-not-retry-yet.md
```
