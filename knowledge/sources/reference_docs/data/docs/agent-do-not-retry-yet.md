# Do Not Retry Yet

Use this list for functions or mismatch shapes that have saturated without new
evidence. The goal is to stop agents from repeating source-equivalent probes
that already failed.

## How To Add An Entry

Add an entry when `melee-agent attempts show <func>` recommends moving on or
when a reviewer identifies a blocked pattern.

Record:

- Function or symbol
- Current best match
- Suspected blocker
- Experiments already tried
- Evidence needed before retrying

Also record the blocker in the ledger:

```bash
melee-agent attempts record <func> --match <pct> --outcome blocked \
  --classification register-allocation --blocker "<short reason>"
```

## Current Entries

No function-specific entries have been promoted yet. Use the pattern-level list
below until the attempt ledger accumulates durable blockers.

## Pattern-Level Holds

### Pure Register-Allocation Loops

Do not keep retrying source-equivalent forms after the move-on threshold fires.
Return only with new evidence: a caller signature change, discovered inline,
type correction, or symbol/data placement change.

### PAD_STACK Escalation

Do not add larger padding after a previous padding attempt regressed or only
moved registers. First check inline candidates, local variables, by-value
arguments, and stale object/report state.

### Relocation-Only Mismatches

Do not rewrite C when `tools/checkdiff.py` classifies the diff as
relocation-label-only or instruction-identical. Investigate symbol names,
scope, section placement, and adjacent data instead.
