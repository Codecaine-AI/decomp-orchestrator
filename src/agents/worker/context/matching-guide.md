# Worker Matching Guide

Use this opt-in context when the packet needs focused source editing,
duplicate adaptation, an isolated check loop, or type/symbol work tied to
compiler shape.

## Tactic Order

1. Start from natural source and local repo idioms.
2. Match the first concrete mismatch, not the whole function at once.
3. Change one source-shape axis per attempt and verify immediately.
4. Compare target and affected neighbors after every retained edit.
5. Prefer understandable source that can survive review over a fake local match.

## Common Levers

- Control flow: guard shape, single-case switch versus if, loop form, early
  return shape, condition spelling, and branch nesting.
- Locals and registers: declaration order, temporary lifetime, helper
  extraction, inline boundary, pointer/base caching, and variable splitting.
- Stack/frame: missing real locals, address-taken temporaries, lifetime across
  calls, stack arrays, scoped padding only when justified, and neighbor checks.
- Types and fields: replace offsets with known fields/accessors, recover union
  arms, use local naming, and keep `M2C_FIELD` only when the real field is not
  proven.
- Inlines/macros: prefer existing header inlines and canonical assert/report
  macros before manual expansion.
- Data/literals: check section ownership, literal order, static declarations,
  relocation targets, and split boundaries before adding or moving data.
- Duplicate adaptation: use matched siblings or duplicate assembly groups as
  evidence, then adjust names/types to the current subsystem instead of copying
  blindly.

## Tool-Assisted Matching Loop

1. Use `opseq` before duplicate adaptation or broad local rewrites to find
   already-matched instruction-shape analogs and near-neighbor functions.
2. Use `mismatch_db` after the first concrete objdiff/checkdiff mismatch to name
   the symptom and retrieve known source-shape tactics.
3. Use `mwcc_debug` notes when the remaining mismatch appears MWCC-specific:
   register allocation, stack/frame layout, local lifetime, coalescing,
   scheduling, varargs/assert/report layout, or hard-to-explain compiler shape.
4. Use Ghidra as a second opinion for names, calls, strings, types, and control
   context. Do not paste decompiler output or let it outrank source, headers,
   symbols, splits, assembly, or objdiff.
5. Do not chase register allocation first. Fix instruction sequence, call shape,
   source structure, types, and data ownership before treating register diffs as
   the root cause.

## MWCC Pattern Checklist

- Declaration order can affect data/helper placement and source shape.
- `int` versus `s32` can affect loop compare, unroll, and codegen shape because
  `s32` is a typedef to `long`.
- Wrong `void` or return signatures create durable caller mismatch noise. Fix
  headers first, then recompile callers before judging the body mismatch.
- Reusing one natural pointer local can be closer to MWCC output than splitting
  every load.
- `static` versus `extern`, direct global access, and BSS declaration order can
  explain data access and relocation differences.
- Varargs/report/assert forms perturb stack layout. Prefer known project macro
  and inline forms before manual expansions.
- Multiple `Vec3` locals and by-value helper calls can affect stack reservation.
  Test declaration order and missing inlines before padding.
- If the instruction body is identical and only relocations or labels differ,
  treat it as a symbol/data layout problem, not a C rewrite problem.

## Stack-Frame Triage

Most stack-layout bucket mismatches are compound. Treat a stack/frame edit as a
clean local-padding candidate only when opcodes and line count are the same, the
frame-size or stack-slot delta is isolated, and diffs normalize to `r1` stack
offsets. Otherwise classify the gap as source-shape, call-shape,
register/operand cascade, or compound evidence before editing.

## Guardrails

- A high fuzzy score is a clue, not success. For matched-code runs, exact 100%
  symbol closure is the useful target.
- Do not keep a target improvement that regresses a matched neighbor unless the
  packet explicitly allows a broader tradeoff and the report names it.
- Do not introduce fake statics, fake helpers, undefined behavior, or macro
  redefinitions to force a match.
- Forced MWCC/debug outputs are hypothesis tests, not source proof. Keep only
  source shapes that reproduce the improvement through an unforced local
  build/objdiff check.
- Use last-resort sweep/permuter tooling only after a named source-shape axis is
  too tedious to test manually.
