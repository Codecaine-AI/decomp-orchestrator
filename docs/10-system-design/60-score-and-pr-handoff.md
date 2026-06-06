---
covers: Score integration gate, global regression protection, and PR handoff boundary
concepts: [score-integration, regression-gate, baseline, pr-handoff, pr-split-plan, review]
---

# Score Integration And PR Handoff

The worker loop can create evidence and candidate patches, but the run baseline
changes only through the score integration gate. This keeps verified progress
separate from exploratory attempts.

## Integration Gate

A candidate should pass through these checks before it affects the board
baseline:

- The worker still owns the lease and write set for the candidate.
- The worker report's local-regression block passed the runner acceptance gate:
  target regression is false, neighbor regressions are empty, validation
  artifacts exist on disk, and edited paths stay inside the write set.
- The worker post-return repair gate is clean: no unaccepted write-set diff is
  retained, configured runner-owned post-return checks passed, and any
  `repair_request` loop has resolved rather than exhausted.
- Local validation is preserved and unresolved local regressions are not kept.
- The source remains reviewable and understandable.
- The branch-level build/report refresh confirms the score movement.
- The integration record captures the old and new progress signal.

After integration, the board can publish new facts and metrics. Active workers
do not need to be canceled just because the board changed; future target
packets can use the updated evidence.

## End-Of-Run Output

The run should summarize accepted improvements, facts, rejected hypotheses,
stalls, score movement, validation transcripts, and review risks. That summary
is the bridge from autonomous work to human review.

The configured run goal is the pause threshold for this summary. Reaching a
`matched_code_percent` checkpoint should mark the run handoff-ready only after
score integration and regression checks confirm the movement. It does not mean
the whole decompilation effort is complete; it means this batch has reached the
point where the system should stop, report what happened, and let the next
allocation decision happen outside the worker loop.

## PR Boundary

The orchestrator does not create one PR per file, worker, symbol, or lease, and
it does not publish GitHub PRs automatically. Human-facing PR packaging is a
separate step after the run produces a coherent improvement bundle.

For review-sized handoff, the packaging step can ask the orchestrator for a
directory-scoped split plan. `pr-split-plan` inspects the branch/worktree
against the selected base ref, groups changed files by Melee subsystem
directories such as `melee/it`, `melee/gm`, and `melee/cm`, and emits suggested
slice branches, titles, pathspecs, and patch commands. Shared or support
directories become separate slices so cross-cutting changes can be reviewed or
stacked intentionally.

Directory grouping is a proposal, not proof of independence. Each slice carries
an unverified disposition: `independent`, `shared-prep`, `stacked`, or
`needs-merge`. A slice becomes truly independent only after it is applied to a
fresh worktree based on the current base ref and passes the configured
configure/build/regression check by itself. If a subsystem slice only passes
after a shared slice is present, the PRs should be stacked or merged rather than
presented as independent.

The PR-review agent can help analyze review patterns and PR knowledge, but
final branch creation, presentation, reviewer coordination, and merge readiness
stay operator-owned outside the worker lease loop.
