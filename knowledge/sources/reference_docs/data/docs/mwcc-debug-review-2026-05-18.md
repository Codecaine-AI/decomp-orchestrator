# mwcc-debug toolkit review — 2026-05-18

After shipping Tier 2 through Tier 7e (13 commands across pcdump
parsing, analysis, hypothesis testing, and matching workflow), a
holistic review pass identifying optimizations, ergonomic
improvements, and gaps.

Scope: only the commands under `melee-agent debug`. The DLL hooks
themselves are stable and out of scope for this pass.

## Method

Reviewed each command from three angles:
- **Agent journey**: what does an agent ACTUALLY type to complete a
  workflow? Where do they have to glue commands together manually?
- **Performance**: is anything noticeably slow that could be faster?
- **Surface consistency**: do similar commands have similar shapes?

Findings categorized by ROI (effort vs payoff).

## High-ROI improvements

### H1. Unified `debug stuck <fn>` digest command

**Problem.** An agent staring at a stuck function currently runs:

```bash
melee-agent debug pcdump src/melee/mn/mnvibration.c --output /tmp/x.txt
melee-agent debug analyze /tmp/x.txt -f my_fn
melee-agent debug guide /tmp/x.txt -f my_fn
melee-agent debug suggest-casts my_fn
melee-agent debug enumerate-decl-orders my_fn --strategy promote
```

Five commands, with manual path threading and ~minute+ between each.
Common enough that the friction adds up.

**Proposal.** One command that does it all and produces a digest:

```
melee-agent debug stuck my_fn

Function: my_fn (88.25% match)
TU: src/melee/mn/mnvibration.c

== analyze (cached pcdump from 12 min ago) ==
17 virtuals; 1 unmapped; 1 spilled
Wrong vs current target: none (no target set — run with --target X)

== suggest-casts ==
1 HIGH: (f32) rumble_setting → lb_80011E24 (declared u8 → spurious)

== guide ==
(no target set, listing inferred problem virtuals)
- r51 has SPILLED marker; consider widen-u8-to-u32 on var_r23

== quick-fixes to try ==
1. enumerate-decl-orders --strategy promote (would take ~70s)
2. Drop (f32) cast on rumble_setting (~5s static fix)
3. Pattern catalog: alias-split, widen-u8-to-u32
```

**Effort.** ~half-day. Mostly composition of existing commands +
output formatting. No new analysis logic.

**Value.** Reduces "explore stuck function" from 5 commands +
path-tracking to 1. Especially valuable for new agents who don't yet
know the toolkit.

### H2. pcdump auto-discovery + caching

**Problem.** Every analyze/score/guide/diff command takes a pcdump
path. The pcdump is expensive to generate (~30sec SSH roundtrip), so
agents save it to /tmp and re-pass the path. Many sessions show
agents losing track of the path or regenerating unnecessarily.

**Proposal.** Two changes:

1. **A project-cache pcdump store.** Default output for `pcdump` goes
   to `build/mwcc_debug_cache/<unit>.txt` indexed by TU. Cache is
   invalidated by `mtime(unit.c)` — if the source hasn't changed since
   the cache was written, the cached dump is used.

2. **Auto-discovery in consumers.** Every command that takes a pcdump
   path makes it optional. If omitted, look in `build/mwcc_debug_cache/`
   for the function's TU. If a fresh cache exists, use it. If stale,
   prompt or auto-regenerate.

```bash
# Today
melee-agent debug pcdump src/melee/mn/mnvibration.c -o /tmp/x.txt
melee-agent debug analyze /tmp/x.txt -f my_fn
melee-agent debug guide /tmp/x.txt -f my_fn

# After
melee-agent debug pcdump src/melee/mn/mnvibration.c  # caches automatically
melee-agent debug analyze -f my_fn                    # finds cached
melee-agent debug guide -f my_fn                      # finds cached
```

**Effort.** ~half-day. Cache layer + plumb-through optional positional
arg.

**Value.** Eliminates path-tracking entirely. The 30sec pcdump is
amortized across all follow-up commands without manual coordination.

### H3. Parallel `triage-perm --jobs N`

**Problem.** triage-perm rebuilds each candidate sequentially. For a
100-candidate permuter session, that's 8-16 minutes serial. ninja
itself is single-threaded for one .o, but separate candidate
evaluations don't share state — they could run in parallel.

**Proposal.** Add `--jobs N` (default = number of CPUs / 2). Use a
worktree-per-job pattern: each worker has its own git worktree on
master, applies its candidate there, runs ninja in that worktree,
reads report.json from that worktree's build dir. Parent collates
results.

**Effort.** ~day. Worktree management is non-trivial but the project
already has `tools/workflow/pr-worktree.sh` we can reuse.

**Value.** 4-8x speedup on triage. For 100-candidate sessions, drops
to 1-2 minutes.

## Medium-ROI improvements

### M1. Surface consistency pass

**Problem.** Commands disagree on function-vs-flag and pcdump-vs-flag:

| Command | Function | pcdump |
|---------|----------|--------|
| analyze | --function | positional |
| guide | --function | positional |
| score | --function | positional |
| derive-target | --function | positional |
| diff | --function | TWO positional |
| simulate | --function | positional |
| verify-perm | --function | positional candidate |
| enumerate-decl-orders | **positional** | (none) |
| suggest-casts | **positional** | (none) |
| pattern-catalog | positional name | (none) |
| triage-perm | --function | positional perm-dir |

`enumerate-decl-orders` and `suggest-casts` are the odd ones —
positional `function` instead of `--function`. Either's fine in
isolation but the inconsistency is real friction.

**Proposal.** Make `function` always the first positional arg
(rationale: it's the most-typed thing across commands; positional is
shorter than `-f X`). For pcdump-consuming commands, accept the
pcdump path as a `--pcdump` flag that defaults to the auto-discovered
cache (per H2).

**Effort.** Half-day if we don't break backward compat (accept both).
A day if we deprecate the old form with warnings.

**Value.** Lower cognitive load. Saves a few keystrokes per command.

### M2. Better error messages

**Problem.** Errors are terse and miss the "why":

- `transfer_candidate` returns None and verify-perm reports "failed
  to locate function" — but doesn't say if it's missing in candidate
  or missing in target.
- ninja failures dump stdout + stderr unfiltered. The first 50 lines
  are typically `[ninja ...]` progress; the actual error is buried.
- `score` with a malformed target spec just raises a generic
  ValidationError.

**Proposal.** Replace each typer.Exit with rich error messages:

```
Error: function 'my_fn' not found in candidate source.

  Candidate: output-0042-1/source.c
  Target:    src/melee/mn/mnvibration.c

  Tried to extract 'my_fn' from the candidate but couldn't find a
  definition. Maybe:
    - The permuter mutated a different function in the same .c file
    - The function name in candidate differs (renamed/static prefix)

  Run `melee-agent debug pcdump output-0042-1/source.c | grep 'my_fn'`
  to see what functions ARE in the candidate.
```

**Effort.** Half-day, mostly thinking through what's actually helpful
to say for each failure mode.

**Value.** Less time spent in "why didn't this work" follow-up
investigation.

### M3. JSON output for all commands

**Problem.** Some commands (analyze, score, guide, derive-target,
enumerate-decl-orders, triage-perm, suggest-casts, pattern-catalog)
have `--json`. Others (pcdump, simulate, diff, verify-perm) don't.

**Proposal.** Add `--json` consistently. Useful for piping into other
tools or for agent scripting.

**Effort.** Trivial (~hour) — each command's main output goes through
one formatter; add a JSON branch.

**Value.** Makes the toolkit composable. A future v2 of `debug stuck`
(H1) would call each subcommand with `--json` and aggregate.

### M4. `debug ceiling <fn>` — quick structural-ceiling check

**Problem.** When the agent reaches a stuck function, the question
"is this a structural ceiling or can I keep iterating?" takes
manually running force-phys + enumerate-decl-orders to answer.

**Proposal.** A digest command that answers it directly:

```
melee-agent debug ceiling my_fn

Checking structural ceiling for my_fn (88.25% baseline):

[1/3] force-phys with derived ideal target… 92.4% (REACHABLE)
[2/3] enumerate-decl-orders --strategy all… best 89.1% (smaller gain)
[3/3] suggest-casts… 1 HIGH (drop-variadic-cast on rumble_setting)

VERDICT: target is reachable (force-phys hits 92.4%) but C-source
search is finding 89.1%, gap of 3.3%. Recommend:
  - Try the suggest-casts HIGH first (1.7% expected from this pattern)
  - If that doesn't close the gap, run permuter on this function
```

**Effort.** ~half-day. Mostly composition.

**Value.** Triage decision in ~minutes vs an hour of manual
exploration.

## Low-ROI / nice-to-have

### L1. Pattern catalog `--compact` mode

**Problem.** Default catalog output is verbose. When piped into guide
output it dominates the screen.

**Proposal.** `--compact` shows just `<name>: <title>` per line.

**Effort.** Trivial.

### L2. `debug analyze --watch` mode

Re-runs analyze when the pcdump file changes. Niche — most agents
iterate by changing source, not by re-pcdumping the same TU.

### L3. `debug whatif <fn> --pattern <name>`

Auto-apply each pattern from the catalog and report match% delta.
E.g., `--pattern alias-split` would scan the function for variables
that could be aliased and try each. Ambitious — needs a mutation
engine.

## Test coverage gaps

- The DLL hooks are tested only via integration (pcdump → analyze).
  No unit tests for the trampoline math.
- No regression test corpus — `tests/data/pcdumps/*.txt` would catch
  parser regressions automatically.
- The pattern catalog has zero tests beyond "can I get_pattern by
  name." We never test that the example snippets parse as valid C, or
  that addresses tuples match guidance.py's category strings.

## Priority recommendation

If we're picking ONE thing to do next: **H1 (`debug stuck`)**. It
turns the common "stuck function" workflow into a single command,
unlocks future agents who don't know the toolkit, and is mostly
composition of what's already there.

If we're picking three: **H1 + H2 + M2** — covers the agent journey
end-to-end. After those, the toolkit is "ready" in the sense that an
agent's daily friction is dominated by their own thinking, not by the
tools.

If we're picking five: add **H3 + M1** for the performance + surface
polish.

The Low-ROI items can wait for a real user request.
