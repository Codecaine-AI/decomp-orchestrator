# Recover Matches Verify/Apply Design

## Problem

The existing `melee-agent audit recover-matches` command surfaces still-unmatched
functions with local `match:` commits, but issue #390 requires the next step:
apply candidate work, re-verify it against the current checkout, deduplicate
competing commits, and make verified recoveries available to merge. A prior
100% commit cannot be trusted directly because the current source may have
drifted, the function may already be matched elsewhere, and multiple candidate
commits can exist for the same function.

## Goals

- Extend `audit recover-matches` with `--verify` to trial-apply each candidate
  commit and run `tools/checkdiff.py <function> --format json`.
- Add `--apply` to leave the first verified candidate per function applied to
  the current checkout after re-verification.
- Deduplicate by function: stop at the first candidate that verifies as a true
  match; report later commits as skipped for that function.
- Preserve the current checkout during verification by snapshotting the
  candidate function's current source file and restoring it after each trial.
- Avoid destructive cleanup commands such as `git reset --hard` or checkout
  restore. Recovery must restore only the paths it touched.
- Apply only the named function's source body from the candidate commit; never
  apply sibling edits from the same source file.
- Run checkdiff with `--no-fingerprint` so bulk trial verification does not
  record misleading attempts or fingerprints.
- Emit machine-readable status for each candidate: verified, applied,
  apply_failed, checkdiff_failed, not_match, skipped_after_verified.

## Non-Goals

- Do not automatically create a git commit from recovered source changes.
- Do not solve sibling dependency graphs across multiple commits in this first
  apply mode. If a commit's change to the candidate's current source file does
  not re-verify by itself against the current checkout, report it as not
  verified.
- Do not apply unrelated paths or unrelated same-file function edits from a
  candidate commit, even if that commit changed headers or sibling functions.
- Do not fetch remotes or mutate worktree refs.
- Do not run full `ninja`; use the existing checkdiff path as the verifier.

## Interface

Existing read-only behavior remains the default:

```bash
melee-agent audit recover-matches --json
```

New modes:

```bash
melee-agent audit recover-matches --verify --json [--limit N] [--checkdiff-timeout 120]
melee-agent audit recover-matches --apply --json [--limit N] [--checkdiff-timeout 120]
```

`--apply` implies `--verify`. Both modes still enumerate only functions that
are currently unmatched in the live checkout.

JSON output adds `verification` rows:

```json
{
  "function": "ftCo_80093790",
  "commit": "abc123",
  "status": "verified",
  "match": true,
  "match_percent": 100.0,
  "source_path": "src/melee/ft/chara/ftCommon/ftCo_Guard.c"
}
```

When `--apply` succeeds, `status` is `applied` and the recovered source remains
in the worktree for the caller to review and commit.

## Design

Candidate enumeration reuses the existing read-only command pipeline:

1. `git log --all --grep=match: --not <upstream>`.
2. Parse `match:` subjects.
3. Filter to the current unmatched inventory.
4. Group commits by function.

Verification helpers are added beside the audit command:

- `_candidate_source_path(candidate)` returns the candidate function's current
  source file from the unmatched inventory.
- `_candidate_source_at_commit(repo, commit, path)` reads
  `git show <commit>:<path>`.
- `_extract_candidate_function(text, function)` uses
  `src.mwcc_debug.source_patch.extract_function` to extract only the named
  function definition from the candidate commit's source file.
- `_replace_current_function(text, function, replacement)` uses
  `src.mwcc_debug.source_patch.replace_function` when the current file already
  has a function definition. If the current file only has an `INCLUDE_ASM`
  marker for the function, it replaces that one macro statement with the
  candidate function body.
- `_snapshot_path(repo, path)` records the current bytes or absence for the
  source file.
- `_restore_snapshots(repo, snapshots)` writes bytes back or removes files that
  did not exist before.
- `_apply_candidate_function(repo, commit, path, function)` writes only the
  replacement function body into the current source file. It does not invoke
  `git apply`, so it cannot stage changes or leave unmerged index entries.
- `_run_recovery_checkdiff(repo, function, timeout)` runs checkdiff JSON and
  parses `match` plus `fuzzy_match_percent`. It passes `--no-fingerprint`.
  If checkdiff exits nonzero but stdout is valid JSON with `match=false`, the
  status is `not_match`, not `checkdiff_failed`.

`--verify` wraps every trial in snapshot/restore and compares the pre-trial and
post-trial tracked status so unrelated dirty work remains exactly as it was.
`--apply` first performs the same trial verification with restore, then reapplies
the selected verified function body permanently and runs checkdiff once more. If
the second checkdiff fails, the command restores the source file and reports
`apply_failed`, `not_match`, or `checkdiff_failed`; it does not leave a failed
recovery in the checkout.

Before `--apply`, the command checks `git status --porcelain --untracked-files=no`.
If tracked files are dirty, it exits with a clean error. This prevents a recovery
from overwriting unrelated local work.

## Testing

- Keep the existing read-only tests unchanged.
- Add fixture commits that actually replace `INCLUDE_ASM` stubs with C bodies.
- Create a fixture `tools/checkdiff.py` that reports `match=true` when the
  recovered source body is present, and `match=false` otherwise while exiting 1
  for non-matches.
- Test `--verify --json` verifies the best commit, restores the source file, and
  marks competing commits skipped.
- Test `--apply --json` leaves the verified source body in the fixture checkout.
- Test a candidate commit that also edits a sibling function in the same file
  leaves only the target function body applied.
- Test a commit with no change to the candidate source file reports
  `apply_failed`/`no_candidate_function` rather than claiming verification.
- Test dirty tracked worktree rejection for `--apply`.
- Test `--verify` and failed trials leave tracked status identical to the
  pre-trial baseline.
- Test checkdiff JSON with `match=false` and exit code 1 is reported as
  `not_match`.
