# Audit Recover Matches Design

## Problem

Issue #390 reports that verified `match:` commits are stranded in unmerged agent worktrees. Agents can find these only by manually scanning all refs, parsing commit subjects, and comparing them against the current unmatched function inventory. That loses completed work and leads to duplicate matching effort.

The full recovery workflow eventually needs apply and re-verify support, but the immediate gap is visibility: agents need a safe, deduplicated list of functions that are still unmatched on the current checkout and have candidate match commits somewhere in local git history.

## Goals

- Add a read-only command that surfaces stranded match candidates.
- Enumerate commits with `git log --all --grep=match: --not <upstream>`.
- Parse lowercase `match:` commit subjects conservatively.
- Deduplicate by function while preserving all candidate commits per function.
- Filter to functions still unmatched in the live checkout.
- Emit JSON for automation and a compact table for humans.
- Avoid checkout, cherry-pick, apply, or source modification.

## Non-Goals

- Do not auto-apply stranded commits.
- Do not run `tools/checkdiff.py` for every candidate in this MVP.
- Do not determine the best commit among competing candidates beyond sorting by commit order and showing all candidates.
- Do not fetch remotes or mutate git state.
- Do not replace the existing `audit duplicates` command.

## Interface

Add:

```bash
melee-agent audit recover-matches [--upstream upstream/master] [--limit 100] [--json]
```

The command returns candidate rows shaped like:

```json
{
  "summary": {
    "candidate_functions": 2,
    "candidate_commits": 3,
    "unmatched_functions": 1200
  },
  "candidates": [
    {
      "function": "ftCo_80093790",
      "file_path": "src/melee/ft/chara/ftCommon/ftCo_Attack.c",
      "current_match_percent": 74.2,
      "commits": [
        {
          "commit": "abc123...",
          "refs": "claude/example",
          "subject": "match: ftCo_80093790 100%"
        }
      ]
    }
  ]
}
```

## Design

The command belongs in `tools/melee-agent/src/cli/audit.py` because that module already owns cross-branch match audits, duplicate match detection, git wrappers, and function-name validation.

Add a focused parser for lowercase `match:` subjects. It should scan each `match:` segment and accept the first valid function token immediately following the marker, ignoring trailing percentages, filenames, punctuation, and later `improve ...` clauses. It must handle subjects such as:

- `match: ftCo_8009C744 100%`
- `match: fn_803ACF30 100%; improve fn_803B26CC`
- `match: grIceMt_801F993C (gricemt.c) - 100%`

The command runs:

```bash
git log --all --grep=match: --not <upstream> --format=%H%x09%D%x09%s
```

It then builds the current unmatched inventory with `extract_unmatched_functions(melee_root, include_asm=False)`. Only parsed functions that appear in that inventory are emitted. This filters out commits that are already matched in current master or already landed upstream through a different commit.

The command is explicitly read-only. Its output should tell agents what to inspect next; it does not apply source changes or claim that candidates still re-verify.

## Test Strategy

- Parser unit tests cover lowercase `match:` subjects, semicolon-separated trailing clauses, parenthesized filenames, invalid common words, and deduplication.
- CLI fixture tests create a tiny git repo with a baseline, an `upstream-master` branch, a feature branch containing `match:` commits, and a minimal report/source setup for unmatched inventory extraction.
- JSON output tests prove already matched functions are filtered out and candidate commits are grouped under still-unmatched functions.
- Help smoke proves the command is registered under `melee-agent audit recover-matches`.
