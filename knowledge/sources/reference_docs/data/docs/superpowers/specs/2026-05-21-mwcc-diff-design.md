# mwcc-debug diff — design spec

**Date:** 2026-05-21
**Status:** Approved through brainstorming flow
**Author:** Claude + Mike

## Summary

A new `mwcc-debug diff` subcommand that compares two C source variants by
forward-compiling both through the existing MWCC inspection pipeline,
diffing the IR snapshots pass-by-pass, and reporting the **earliest**
point in the compilation pipeline where they diverge.

This is the MVP of a longer-term direction: **treat the compiler as a
sequence of many-to-one transformations and provide a tool that lets
you reason about source-to-asm mismatches at the level of the
*compiler pass that introduced the difference*, not at the level of the
raw assembly diff.**

The MVP does not perform any backwards inference — both sides are
forward-compiled C variants you supply. Backwards inference (reasoning
from target asm to required IR shape) is deferred to later phases.

## Background and motivation

The current decomp loop is: edit C → compile → look at asm diff → guess
what to change. The last step is unreliable. Most "stuck" functions in
the project — particularly in `mnevent.c`, `mnvibration.c`, and other
late-mile cases — are stuck because the relationship between a C-source
change and the resulting asm change is opaque. Agents (and humans)
mutate C and observe asm; they don't see *where in the compiler* the
mutation took effect.

A complementary observation: **last-mile pain (95-99% match) is often
caused by structural drift earlier in the decomp process**. Forward
decompilation (m2c → manual iteration) accumulates uncertainty; each
choice that gets collapsed forward may have been wrong, and by the
time you're at 95% you don't know which earlier choice to revisit.
A tool that surfaces *which compiler pass* a divergence originates in
provides anchoring information the current asm-diff view does not.

The user already has the major prerequisites built:

- `mwcc-inspect` exposes frontend IR (ENodes, ObjObjects, Statements)
- `mwcc-debug` exposes backend codegen pass snapshots (pre/post register
  coloring, scheduling, etc.)
- A corpus of matched functions and a mismatch-db of known C↔asm
  patterns

This spec ships the **smallest piece** of the longer-term vision:
a forward-compile-both-sides differential. It validates the IR-diff
format and decomp loop before any reverse-inference work begins.

## Goals

- Add `mwcc-debug diff` that compares two C source variants
- Capture IR snapshots at each pass boundary from the existing tooling
- Diff snapshots pass-by-pass; identify the earliest divergence
- For the register allocation pass specifically, classify divergences
  as **intrinsic** (allocator behaved differently on identical input)
  vs **input-derived** (allocator behaved consistently; input changed)
- Produce a text report optimized for both human reading and consumption
  by Claude agents in the decomp loop

## Non-goals

- **No backwards inference.** Both sides are forward-compiled C
  variants. Comparing directly against target asm requires backwards
  inference and is deferred to later phases.
- **No fix suggestions.** The tool identifies divergence; it does not
  propose what C to change.
- **No N-way comparison.** Exactly two sources per invocation.
- **No persistent baseline cache.** Both sides recompile each
  invocation; MWCC is cheap enough that this is fine.
- **No visualization.** Text output only. Graphviz of interference
  graphs etc. is out of scope.
- **No structured diffs for passes other than RA in the MVP.** Other
  passes use line-level text diff initially; upgrade only when real
  cases motivate it.

## Scope and invocation

```
mwcc-debug diff [--fn <name>] <source-a> <source-b>
```

Inputs:

- `<source-a>` and `<source-b>` are C source files (or scratch slugs,
  if integrated with the existing scratch tooling). Either side may be
  a relative path, an absolute path, or a slug.
- `--fn <name>` restricts the diff to a single function within a
  multi-function TU. Mirrors the existing `--force-coalesce-fn` flag.

Output: text report on stdout. Non-zero exit code if either side fails
to compile.

Common use cases:

- "I'm considering changing X to Y. What does that do to the IR?"
- "Permuter gave me a candidate at higher %; which IR change caused
  the improvement?"
- "I was at 95%, now I'm at 90% after this edit. Where did things go
  wrong?"
- "Here are two candidates from m2c-then-permuter. Which is
  structurally closer to a known-good neighboring function?"

## Architecture and data flow

The flow:

1. **Compile both sources.** Invoke the existing mwcc-debug /
   mwcc-inspect plumbing twice — once per source — capturing
   pass-level snapshots. Each side produces a list of
   `(pass_name, snapshot)` pairs in pipeline order.

2. **Compare snapshots pass-by-pass.** Walk the pass list in order.
   For each pass, run a pass-appropriate diff. The first pass whose
   snapshots differ is the **earliest divergence**.

3. **Render report.** Emit a structured text report keyed on passes,
   with the earliest divergence highlighted prominently and subsequent
   divergences marked as cascades.

### Passes captured (MVP)

| Stage | Pass | Source | Diff strategy |
|---|---|---|---|
| Frontend | ENode tree, Statement list | mwcc-inspect | Statement-indexed tree diff |
| Mid-end | Optimized IR | mwcc-inspect | Same, flagged separately |
| Selection | Pre-RA instructions | mwcc-debug | Instruction-sequence diff per basic block |
| Allocation | Interference graph, coalesce decisions, final coloring | mwcc-debug | **Structured RA diff** (see below) |
| Scheduling | Final scheduled instructions | mwcc-debug | Instruction-sequence diff |

For the MVP, "structured" diffs at non-RA passes start as line-level
text diffs of existing pass dumps. Upgrade to per-pass structured
logic only when real cases prove text diff is too noisy.

### Earliest-divergence detection

Linear scan over the pass list. First pass with a non-empty diff wins.
Within that pass, the first difference by natural ordering (statement
index, instruction position) is called out as the proximate cause.

### Cascade labeling

The MVP uses a simple heuristic: any diverging pass after the earliest
is labeled `cascade from pass N`. This is an approximation — in
principle two independent divergences could appear at different passes
— but in practice it correctly captures the common case where
downstream divergence is a consequence of upstream change. The one
exception is the RA pass, where the intrinsic / input-derived
classifier provides actual causality information rather than
positional approximation.

### Reuse vs new code

- **Reuse:** mwcc-debug's invocation harness (wibo + Zig-built DLL),
  pass-output capture, scratch lookup, `--fn` scoping
- **New:** orchestration layer (compile both → collect → diff →
  report), per-pass diff strategies, the report renderer, the
  structured RA diff classifier

### Failure modes the tool handles gracefully

- One side fails to compile → report which side, surface the compiler
  error, exit non-zero, do not crash
- Identical pipeline output → report cleanly ("no divergence")
- Different pass lists (one side hit a path that triggered an extra
  pass) → signal as meta-divergence

## Output format

Text-first output, optimized for human and Claude agent consumption.
JSON output may be added later behind an opt-in flag; not in MVP.

### Sample report

```
$ mwcc-debug diff --fn mnEvent_8024D5B0 current.c candidate.c

EARLIEST DIVERGENCE: Instruction Selection (pass 3 of 5)

Pass 1: Frontend (ENode/Statements)
  ✓ Identical

Pass 2: Mid-end Optimization
  ✓ Identical

Pass 3: Instruction Selection  ⚠ DIVERGENCE (earliest)
  Statement #14 (`frames / 60`):
    current.c:    divw    r3, r4, r5         (signed divide)
    candidate.c:  mulhwu  r3, r4, r6         (unsigned magic multiply)
  Heuristic cause: `frames` typed `s32` in current, `u32` in candidate.

Pass 4: Register Allocation  ⚠ DIVERGENCE (cascade from pass 3)
  ...structured RA diff body, abbreviated for cascade case...

Pass 5: Scheduling  ⚠ DIVERGENCE (cascade from pass 4)
  ...
```

### Conventions

- Each pass tagged `✓ Identical` / `⚠ DIVERGENCE (earliest)` /
  `⚠ DIVERGENCE (intrinsic)` / `⚠ DIVERGENCE (cascade from pass N)`
- Earliest divergence stated up top in a single line
- Cascades get a terse summary; intrinsic divergences get full detail
- "Heuristic cause" lines added where pattern matches are available
  (eventually backed by mismatch-db; in MVP, a small built-in set)

## The structured RA diff (the investment)

The register allocation pass captures and compares four things:

1. **Coloring** — virtual variable → physical register map
2. **Interference graph** — edges between virtual variables
3. **Coalescing decisions** — which copies were coalesced vs kept as
   moves
4. **Spills** — which variables were spilled to stack

For each RA divergence, the tool classifies the cause as one of:

- **Intrinsic** — same input (identical interference graph + coalesce
  edges + spill set), different coloring. The allocator's internal
  decision diverged. Tells you upstream C changes will not help; the
  fix lies in `--force-coalesce` / `--force-phys` territory, or
  acceptance that the C source is structurally correct but the
  allocator chose a different order.
- **Input-derived** — different inputs to the allocator. The allocator
  behaved consistently; the upstream IR differs. The fix lies at the
  selection pass or earlier.

This split is the highest-leverage part of the tool. It answers the
recurring question "should I be changing C, or is this an MWCC
iter-order problem?" — a question that today is only answered after
hours of trying C variants and observing they have no effect.

### Implementation outline for the RA classifier

1. Capture the allocator's input (interference graph + coalesce
   edges + spill set) for both sides.
2. Capture the allocator's output (coloring) for both sides.
3. If allocator inputs match and outputs differ → **intrinsic**.
4. If allocator inputs differ → **input-derived**.

The MVP does not attempt to detect mixed cases (inputs differ *and*
the allocator would also have made different decisions on matched
inputs), since that requires re-running the allocator with substituted
inputs. Treat input-derived as the dominant cause when inputs differ;
intrinsic-on-top-of-input-derived is a refinement for a later phase.

## Testing

### Sanity tests

- **Self-identity**: any source vs itself → "no divergence." Trivial,
  automated, runs on every change.
- **Cosmetic invariance**: whitespace / comment-only differences →
  "no divergence."

### Constructed pairs (snapshot tests)

Pairs with a known expected divergence pass:

- `s32 x` → `u32 x` on a divided variable → divergence at selection
- Add `volatile` to a local → divergence at optimization
- Add `static inline` wrapper around a counting loop → divergence at
  frontend
- Reorder unrelated declarations → likely no divergence, or
  intrinsic at RA

The snapshot set grows organically from real cases encountered while
using the tool.

### RA classifier validation

The intrinsic / input-derived classification is the novel piece and
needs extra confidence:

- **Constructed intrinsic**: use existing `--force-iter-first` /
  `--force-phys` overrides to produce two RA outputs from identical
  IR input → must classify as intrinsic.
- **Constructed input-derived**: change a type that only affects
  selection (e.g., `s32` → `u32`) → must classify as input-derived.
- **Corpus check**: run against the `mwcc_ignode_ordering_ceiling`
  family of stuck functions → should all classify as intrinsic,
  confirming empirical knowledge.

### Operational checks

- Multi-function TUs scoped via `--fn` (mirrors `--force-coalesce-fn`)
- Compile failure on one side: surface the error, exit non-zero, do
  not crash
- Both sides assumed deterministic. Non-deterministic MWCC output
  would be a tool bug worth flagging loudly.

### Non-goals for testing

- Property-based testing / fuzzing — too expensive for the value
- Full IR semantic equivalence checking — separate research project

## Future phases (out of scope for MVP)

The MVP is the foundation for a multi-phase build:

1. **MVP (this spec)** — forward-compile both sides, IR-diff, RA
   classifier
2. **Phase 2** — backwards inference for the last pass (scheduled
   instructions → unscheduled IR)
3. **Phase 3** — backwards inference for register allocation
4. **Phase 4** — backwards inference for instruction selection
5. **Phase 5** — backwards inference for mid-end + AST; use the
   matched-function corpus as a learned C↔IR map

Each phase delivers standalone value; later phases let the tool
compare against *target asm* directly rather than requiring two
forward-compiled C sources.

The MVP's output format and diff vocabulary should be designed with
phases 2-5 in mind: a backwards-inferred IR will plug into the same
report shape, just sourced differently.
