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

## Guardrails

- A high fuzzy score is a clue, not success. For matched-code runs, exact 100%
  symbol closure is the useful target.
- Do not keep a target improvement that regresses a matched neighbor unless the
  packet explicitly allows a broader tradeoff and the report names it.
- Do not introduce fake statics, fake helpers, undefined behavior, or macro
  redefinitions to force a match.
- Use last-resort sweep/permuter tooling only after a named source-shape axis is
  too tedious to test manually.
