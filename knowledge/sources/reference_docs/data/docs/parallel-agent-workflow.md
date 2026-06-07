# Parallel Agent Workflow

How to operate as one of many decomp agents running in parallel, without
stomping on each other or losing work to worktree drift.

Each agent is a self-contained decompiler/matcher: pick functions, match
them, commit to a `wip/<topic>` branch, open a PR when the batch is ready.
There is no central coordinator — coordination is achieved by branch
discipline (one worktree per agent, distinct topics, agents don't touch
each other's branches).

Distilled from observed behavior across long Codex sessions (which mostly
worked) and shorter Claude sessions (which mostly didn't). The differences
were not the model — they were the workflow discipline and the state of the
tooling each session inherited.

## TL;DR

- One worktree per agent. Never run two agents in the same tree.
- Each agent works on its own `wip/<topic>` branch off `master`, created
  via `./tools/workflow/pr-worktree.sh create wip/<topic>`.
- Pick a topic no one else is working (a distinct module or distinct set
  of functions) — check active branches and worktrees before claiming.
- Commit freely in your own worktree on your own `wip/` branch.
- When the batch is ready (matched functions, build green, clean diff),
  package and push your own PR via `./tools/workflow/create-pr.sh <name>`.
- Primary feedback loop: `tools/checkdiff.py <fn>` → edit → `ninja` → repeat.
- Health-check on arrival: `python tools/worktree-doctor.py`. If anything
  is red, fix it before doing any decomp work.
- Saturated functions (no improvement after 3 attempts) get logged and
  skipped, not chased.
- If you stop before the batch is PR-ready, end with a handoff doc and a
  *dirty but coherent* tree. Don't commit work that isn't matched.

## What worked (Codex pattern)

Observed in sessions `019e15fa-b2c5...` (111h, 3204 turns) and
`019e2a2f-3ac1...` (17h, 1098 turns):

1. **Tight checkdiff loop.** 64% of all tool calls were `exec_command`,
   most of them `tools/checkdiff.py` or `ninja`. Almost no skill invocations.
   The repo's own diff tooling was sufficient.
2. **Revert discipline.** Roughly half of attempted edits were reverted
   when the match percentage didn't improve. Saturated functions were
   recorded as blocked and skipped after a small number of attempts,
   not churned on for hours.
3. **Worktree isolation.** Each session operated in its own worktree.
   The secondary worktree stayed detached or on its own `codex/*` branch
   and explicitly avoided touching the shared master checkout. When
   upstream advanced mid-session, the agent fast-forwarded cleanly using
   `git merge --ff-only`.
4. **Dirty-state handoffs.** Sessions ended with the tree dirty, work
   uncommitted, and a written handoff describing what was saturated,
   what was matched, and what the next session should do — letting the
   next session pick up exactly where this one left off without losing
   context. Only matched, build-green work was committed.
5. **Heartbeat-driven module switching.** Periodic check-ins forced
   explicit decisions about whether to keep iterating on the current TU
   or move on. Prevented unbounded churn on a single function.

## What broke (Claude pattern)

Observed in sessions `272a0f35-d052...` (2h 41m, only +1.09% on one
function) and `163c94d6-0661...` (2h 38m, only 2 edits total):

1. **Tooling-less worktrees.** Sessions visited cleanup worktrees like
   `melee-lbmthp-cleanup` and `melee-lbaudio-cleanup` that didn't contain
   `tools/checkdiff.py`, `tools/melee-agent`, or `include/baselib/jobj.h`.
   Every attempt to iterate failed on missing-file errors. Always use
   `pr-worktree.sh` (which sets up tooling correctly) rather than raw
   `git worktree add`.
2. **Stale hook propagation.** Sessions hit "git add is not allowed for
   team agents" 21 times despite master having removed that block hours
   earlier. Per-worktree `.claude-plugin/` and `.git/hooks/` copies do
   not auto-refresh when master's overlay changes. Run
   `./tools/workflow/sync-hooks.sh` to propagate hook updates to active
   worktrees.
3. **Triage paralysis.** Both sessions opened with the same prompt:
   "look at the dirty tree and decide what to commit." One spent 40 min
   on triage before pivoting; the other never broke out — it asked the
   user 8 questions (125 min of wall-clock waiting) instead of acting.
   If you inherit a dirty tree you don't have context for, start a fresh
   `wip/<topic>` worktree instead of trying to disposition the dirty one.
4. **Edit-without-Read errors.** Three Edit calls failed because the
   file hadn't been Read in the session. Always Read before Edit.
5. **Skills loaded but ignored.** Session `163c94d6` invoked
   `/melee-decomp:workflow` once at the start and then proceeded to
   ignore the create-pr / split-and-package workflow it describes.

## Recommended flow

### Setup (every session, first 60 seconds)

```bash
python tools/worktree-doctor.py           # verify tooling
git fetch --all --prune                   # refresh remotes
git rev-parse --abbrev-ref HEAD           # confirm branch
git status --short                        # confirm clean or expected dirty
```

If `worktree-doctor` reports anything red, run `--fix` or investigate.
If the branch is not your `wip/<topic>`, switch before editing.
If the tree is dirty with work you don't recognize, do not try to clean it
up — start a fresh worktree:

```bash
./tools/workflow/pr-worktree.sh create wip/<your-topic>
```

### Per-function iteration

```bash
python tools/checkdiff.py <function>      # see current diff
# edit src/melee/<module>/<file>.c
ninja build/GALE01/src/melee/<module>/<file>.o
python tools/checkdiff.py <function>      # re-check
```

Rules:
- If the match % drops, revert immediately. Do not "fix forward."
- If three attempts haven't improved, the function is saturated for
  this session. Log it in your attempts doc and move on.
- Commit a function only when it hits 100%. Commit to your `wip/<topic>`
  branch only, never to `master` or another agent's branch.

### Opening a PR (when your batch is ready)

When you've matched a coherent batch and the build is clean:

```bash
./tools/workflow/create-pr.sh <name>      # builds pr/<name> from upstream/master
git push origin pr/<name>                 # push for review
```

Keep PR text upstream-visible — describe the matched functions, source
layout, type changes, and verification. Do not mention fork-only tooling
(see `CLAUDE.md` "PR description hygiene").

You decide when the batch is PR-ready. Reasonable defaults: at least one
function fully matched, related changes only (don't bundle unrelated
modules), and `python configure.py && ninja` passes clean.

### Handoff (mid-batch, end of session)

If you stop before the batch is PR-ready, write
`docs/handoffs/<topic>-<YYYY-MM-DD>.md` with:
- Worktree path and `wip/<topic>` branch.
- What's committed vs. dirty.
- Per-function status: matched / saturated-at-X% / not-attempted.
- Specific blockers for saturated functions (register cascade, stack
  gap, missing inline, etc.).
- Whether the next session should keep iterating, abandon the branch,
  or finalize the partial matches into a PR.

The handoff is for a future session on the same `wip/` branch — you to
you, or another agent that adopts the topic.

## Anti-patterns (concrete don'ts)

| Don't | Why | Do instead |
|-------|-----|------------|
| Run two agents in the same worktree | Build lock contention, stale file caches, mutual stomping | One worktree per agent |
| Try to clean up a dirty tree you didn't start | Not your context; you'll destroy in-progress work | Start a fresh `wip/<topic>` worktree |
| Edit without Read | Tool will reject; risks overwriting unintended content | Always Read first in the session |
| Ask the user "should I split these files?" | Burns wall-clock; PR criteria are clear (matched + builds + clean diff) | Just open the PR via `create-pr.sh` |
| Chase a saturated function for an hour | 50% of edits don't help; spinning won't either | 3 attempts, log, move on |
| Commit to master from a decomp session | Master is shared; conflicts propagate | Commit to your `wip/<topic>`, open a PR via `create-pr.sh` |
| Pick a topic another agent is already on | Duplicate work, merge conflicts at PR time | Check active branches/worktrees first; pick a distinct module |
| Create worktrees via raw `git worktree add` | No tooling symlinks, no fork hooks, no `CLAUDE.md` | Use `tools/workflow/pr-worktree.sh` |
| `git push --force` to a shared branch | Destroys upstream state | `--force-with-lease` on your own wip/pr branch only |

## See also

- `docs/agent-tool-manifest.md` — canonical command names for this fork.
- `docs/agent-decomp-improvement-checklist.md` — what each agent should
  do during an iteration.
- `tools/workflow/README.md` — workflow script reference (pr-worktree.sh,
  create-pr.sh, sync-upstream.sh, sync-hooks.sh, cleanup-stale.sh).
- `CLAUDE.md` — top-level project conventions, including PR description
  hygiene.
