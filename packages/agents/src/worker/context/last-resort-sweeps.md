# Last-Resort Sweep Guidance

Use broad sweep tooling only after the standard one-symbol worker loop has
produced a concrete, bounded hypothesis family that is too tedious to test by
hand.

This is not the default worker path. Prefer local source reading, historical PR
lookup, file graph context, and narrow objdiff/checkdiff loops first. A sweep is
useful only when it tests a named source-shape axis such as declaration order,
statement order, temporary lifetime, inline boundary, field typing, or
control-flow layout.

## Guardrails

- Keep exploratory candidates out of production `src/` until a finalist is
  selected and cleaned.
- Do not let sweep workers write shared source, shared build outputs, or shared
  CSVs. Use per-candidate directories and merge results after workers finish.
- Score candidates with narrow object/symbol checks before any wider validation.
- Select by reviewability and mismatch signal, not percent alone.
- Promote only source that survives the normal worker regression ledger.
- Stop when the queue becomes random perturbation instead of an evidence-backed
  hypothesis family.

## Minimal Flow

1. Record target source, symbol, unit, baseline score, first mismatch, and risky
   neighbors.
2. Define one or two source-shape axes and why local evidence supports them.
3. Generate isolated candidates under `decomp-runs/`.
4. Score candidates, dedupe equivalent source, and keep the smallest useful
   improvement.
5. Clean the winner into normal project style.
6. Validate the touched symbol, affected neighbors, object/TU, and final worker
   report contract.

Historical detailed sweep docs are archived under
`docs/archive/experimental-sweeps/`. Treat them as implementation notes, not
active worker policy.
