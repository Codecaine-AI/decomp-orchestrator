---
name: decomp
description: Use when decompiling or matching Super Smash Bros. Melee functions in this repo, especially when iterating on C source against assembly diffs.
---

# Melee Decompilation

## Start Here

Before choosing or editing a function, run:

```bash
python tools/worktree-doctor.py --fix
```

Treat warnings about stale `report.json`, stale objects, missing tooling, or missing DOLs as blockers for interpreting diffs. Fix those first or explicitly note why they do not apply.

## Core Loop

1. Pick or inspect a function with `melee-agent extract list` / `melee-agent extract get`.
2. Read existing source, headers, nearby matched functions, and module-local static headers before writing C.
3. Use `tools/checkdiff.py` or the repo wrapper command for compile-producing checks; do not call lower-level objdiff/wine/wibo tools directly.
4. Record meaningful attempts:

```bash
melee-agent attempts record Func_80000000 --match 87.5 --outcome improved \
  --classification register-allocation --note "first coherent structure"
```

Mark source-level wins with `--retained` even when score drops because correct structure can temporarily lower match percentage.

## Tooling Issue Gate

File bugs and papercuts immediately when tooling blocks real work. For new
tooling features, use the enforced governance fields on `melee-agent issue
report` so the request is reusable and source-actionable:

```bash
melee-agent issue report "short feature summary" \
  --kind feature --tool mwcc-debug --function Func_80000000 \
  --reusable-class "stack/local unused home reservation" \
  --applies-to Func_80000000 \
  --source-actionable-output "ranked source transforms with real-tree validation" \
  --stop-condition "no retained source improvement after a bounded candidate set" \
  --existing-workflow-failed "checkdiff plus existing mwcc-debug diagnose produced no source lever"
```

Use `--governance-waiver "<reason>"` only for a true exploratory exception.

## Before Chasing Registers

Use shape-discovery tools after 2-3 failed source experiments:

```bash
melee-agent patterns inlines src/melee/<module>/<file>.c
python tools/symbol-layout-analyzer.py lbl_804D1234
melee-agent mismatch search "register allocation"
```

Prefer fixing source shape, declaration order, visibility, struct types, helper inlines, or data placement before trying padding or register nudges.

For large state machines or asset-heavy functions, use `docs/large-function-checkpoint.md` before a serious rewrite. For `mn` menu code, check `docs/mn-module-notes.md` for module-specific known local maxima and successful source shapes.

If `docs/discord-knowledge` is missing, use `docs/discord-search-recipes.md` and the installed `discord-search` skill/tooling fallback with focused terms from the mismatch, compiler symptom, function family, or API name. Record useful hits in the attempt note instead of relying on memory.

## Stop Conditions

If `melee-agent attempts show <func>` recommends moving on, preserve notes and switch to a fresh function or translation unit unless new evidence appears. Pure register-allocation loops are not progress.

## PR Bar

Only commit natural, maintainable C:

- Update headers before source bodies when signatures change.
- Keep externs in `.h` or `.static.h`, not `.c`.
- Model hidden strings/data with named declarations or file-local structs.
- Do not leave `PAD_STACK` unless alternatives have been checked and the reason is documented.
- Verify with `python configure.py && ninja` before claiming repo-level success.

When preparing upstream PR text: Do not mention fork-only tooling. Keep the
description upstream-visible: talk about the functions, source/data layout,
type fixes, and verification that reviewers can see in the branch. Do not cite
local attempts DB entries, attempt ledgers, `melee-agent`, `tools/checkdiff.py`,
worktree doctor output, Discord archive searches, or agent process notes. Turn
private workflow notes into reviewable facts, such as "remaining functions are
left unmatched" instead of "remaining functions are documented in the local
attempts DB."
