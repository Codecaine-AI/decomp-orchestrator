# Tier 4 — Permuter integration design

The mwcc-debug tooling answers "which register did MWCC pick" and "what
constraints did the allocator see." The matching agent's natural next
step from there is: "how do I nudge the C source so the constraints
shift in my favor?" The permuter does randomized mutation; we can make
it smarter by feeding it diagnostic data.

This doc captures the integration design.

## What the upstream permuter does

[decomp-permuter](https://github.com/simonlindholm/decomp-permuter) does
randomized C-source mutation + recompile + score loop:

1. Take a C source + target asm (objdiff-style)
2. Apply a small random mutation (variable type swap, statement reorder,
   loop rewrite, declaration shuffle, etc.)
3. Recompile, score against target
4. Keep best-scoring candidates, mutate them
5. Repeat 1000s to 50000s of iterations

It's effective but stochastic — for a function stuck at 99.8%, the
mutation that matters might be one specific declaration order change in
a sea of 50k unrelated mutations.

## What our diagnostic data adds

After each candidate compiles, we can dump pcdump.txt and extract:

- **Per-virtual physical mapping**: `analyze_function` returns
  `VirtualRegInfo` with `physical`, live range, interferences,
  candidates.
- **Simplification order + spill markers**: `SIMPLIFY GRAPH` rows show
  which virtuals were structurally hard to color (`SPILLED` flag).
- **Per-decision interferer arrays**: `COLORGRAPH DECISIONS` shows the
  exact set of competing virtuals at the time each was colored.

If we compare a candidate's data against a *target* coloring (derived
from the matched sibling or from a Tier 5 force-phys experiment), we
can build a richer score than just "% bytes match" — one that
identifies which virtuals moved in the right direction.

## Integration paths

### Path A — Custom scorer plugin

decomp-permuter has a `--scorer` flag (or similar — exact mechanism
varies per version). A custom scorer is a script that takes a compiled
`.o` and emits a numeric score. We'd write a scorer that:

1. Locates the candidate's pcdump for its `.o`
2. Runs `melee-agent debug analyze` on it
3. Compares against a precomputed target mapping
4. Returns a weighted score combining (a) byte match + (b) virtual
   mapping distance + (c) spill marker penalties

Pros: drops into existing permuter workflow. No new search machinery to
build.
Cons: per-iteration cost is high (every candidate triggers an SSH
roundtrip for pcdump generation). Permuter does 1000+ iters/sec on
fast hardware; we'd be limited to maybe 10–100/sec by the pcdump
latency.

### Path B — Standalone guided-search tool

Write our own mutation loop that:

1. Holds the current C source in memory
2. Applies a mutation (drawing from permuter's mutation library if we
   can vendor it)
3. Runs pcdump locally (just normal mwcceppc, no SSH if we can build
   wibo)
4. Scores via our analyze data
5. Accept/reject based on simulated annealing or similar

Pros: tighter integration, no SSH overhead for pure-syntactic mutations
that don't need verbose-debug output. We could also implement *targeted*
mutations: e.g., "I see r36's interferers include r45 — try variable
declaration order swaps that move r45's lifetime."
Cons: re-implements mutation engine. Worktree management for parallel
candidates is non-trivial.

### Recommendation: hybrid

Build the **scorer** (Path A) first. It's the smaller piece, plugs into
existing permuter, and immediately makes permuter smarter on stuck
functions. Even at 10–100 iters/sec instead of 1000s, the better
signal-to-noise can win in absolute time-to-converge.

Add targeted-mutation logic (Path B-lite) as a follow-up: a `debug
guide` command that takes a pcdump and emits a list of suggested
mutation directions, which a human (or an agent) can apply manually or
feed to permuter as initial-population seeds.

## MVP scope

### What's in scope for Tier 4 v1

1. `melee-agent debug score <pcdump> --function NAME --target <yaml>`
   — emits a single floating-point score on stdout. Lower = better
   (compatible with permuter's convention).

2. `melee-agent debug guide <pcdump> --function NAME [--target <yaml>]`
   — emits human-readable diagnostic with:
   - Which virtuals don't match target (if target provided)
   - For each, which interferers are blocking the desired physical
   - Which virtuals carry SPILLED markers
   - Suggested C-source nudges (declaration reorder, lifetime
     shrinkage, etc.) — heuristic, not guaranteed

3. Target spec format: YAML.
   ```yaml
   function: mnVibration_80248644
   virtuals:
     32: 26    # r32 -> r26 (callee-save)
     35: 29
     36: 31    # critical mapping for matching
     # ...
   ```
   A helper command `debug derive-target <pcdump> --function NAME`
   emits the current mapping as YAML — useful for capturing
   experimental (force-phys-aided) targets.

### What's deferred

- Permuter mutation engine integration (Path B)
- Local pcdump generation (currently requires SSH to nzxt-local)
- Targeted mutation suggestions beyond simple heuristics
- Parallel/distributed candidate evaluation

## Score function design

```
score = α * byte_distance         # primary: % bytes mismatching target
      + β * virtual_distance      # how many virtuals are at wrong physical
      + γ * spill_penalty         # SPILLED markers on virtuals that
                                  #   shouldn't be spilled
      + δ * interferer_distance   # virtuals with diff interferer counts
                                  #   from target
```

Initial weights (subject to tuning on real cases):
- α = 100.0   (byte distance is the headline metric)
- β = 10.0    (each wrong virtual is worth ~0.1 of a percent match)
- γ = 5.0     (per spill marker)
- δ = 1.0     (per unit interferer-count difference)

Permuter compares scores; lower wins. A perfect match has score 0.

`virtual_distance` definition: count of virtuals where `actual_phys !=
target_phys`. Could later weight by ABI class (a callee-save mismatch
is worse than a scratch-reg mismatch since the former affects the
prolog/epilog stmw range).

## Implementation outline

```
src/mwcc_debug/
  parser.py          (existing — provides VirtualRegInfo)
  colorgraph_parser.py (existing — provides SimplifySection)
  scoring.py         (new — score function, target-mapping diff)
  guidance.py        (new — heuristic suggestions from diagnostics)

src/cli/debug.py
  + score subcommand
  + guide subcommand
  + derive-target subcommand
```

The scoring module is pure-Python data-in-data-out; trivial to
unit-test.

The guidance module is rules-based heuristics:
- "Virtual X interferes with [list]; if any [list] entry's lifetime
  could be shrunk, X might get its target physical"
- "Virtual X has SPILLED flag; reducing its degree (count_of_interferers)
  below n_colors=N would prevent the spill"
- etc.

These are nudges for a human reviewer; not authoritative.

## Effort

- v1 (scoring + guidance + derive-target): ~half-day
- v2 (permuter wrapping + targeted mutations): ~week
- v3 (local pcdump generation, parallel eval): ~week

This doc covers the v1 MVP. v2/v3 are explicit future tiers.
