# mwcc-debug handoff — 2026-05-21

Follow-up to `mwcc-debug-handoff-2026-05-20.md`. The full `FORCE_COALESCE`
hook is now shipped — earlier estimate ("buildable in ~half-day") landed,
and the RE work along the way corrected an address misidentification in
the prior handoff. The new hook is complementary to `--force-iter-first`,
not a replacement.

## What's shipped: real `--force-coalesce`

```bash
melee-agent debug pcdump-local src/melee/mn/mnvibration.c \
    --force-coalesce "42=38" \
    --force-coalesce-fn "mnVibration_802474C4" \
    --output /tmp/forced.txt
```

Format: `virt=root[,virt=root]*`. Examples:

| Spec | Effect |
|------|--------|
| `42=38` | Force virtual 42 to coalesce into virtual 38 (same root group) |
| `42=38,50=38` | Three-way merge: 42, 50, 38 all share the same root |
| `42=42` | Un-coalesce 42 back to its own root (overrides natural coalesce) |
| `100=42` for a class with n_virtuals ≤ 100 | Silently skipped (out of bounds for that class) |

**Function-scoping (`--force-coalesce-fn`)**: by default the override
applies in EVERY function in the TU. For multi-function files where
the spec only makes sense in one function, scope with
`--force-coalesce-fn FUNCTION_NAME`. Non-matching functions emit a
`[FORCE_COALESCE] scope skip (fn=X, scope=Y)` line and compile
naturally. The scope check uses pclistblocks' function-name argument,
which fires before each function's coalesce phase.

Implemented as a hook on the *real* coalescer at **0x530E00** — see RE
correction below. Hook runs the original Chaitin-Briggs union-find
conservative coalescer, then patches the resulting `COALESCE_ALIAS`
array (the union-find parent pointers at `DAT_0058308C`) before the
next phase (`FUN_00530C00`) materializes `INTERFERENCEGRAPH` from it.

## What you now see in `pcdump`

Two new sections, both per (function, register class):

### `[COALESCE] natural mappings (virt -> root)`

Emitted from the new hook *before* applying any overrides:

```
[COALESCE] enter class=0 n_virtuals=326
[COALESCE] natural mappings (virt -> root):
  32 -> 3
  34 -> 3
  61 -> 3
  73 -> 51
  82 -> 50
  92 -> 49
  100 -> 3
  121 -> 62
[COALESCE] exit class=0 n_virtuals=326 distinct_roots=319 forced=0
```

This is the *natural* conservative coalesce result. In the example, FP
virtuals 32, 34, 61, 100 all merge into root 3 (post-coloring, that
group lives in r3 — the return register). Virtuals 73, 82, 92 are
FP-class moves merged with their respective destinations.

### `COALESCED ALIASES` (in `COLORGRAPH DECISIONS`)

After coloring, the colorgraph dump tags coalesce roots with `[ROOT]`
and lists alias→root→physical mappings:

```
COLORGRAPH DECISIONS (class=0, result=1, n_nodes=329)
...
263   62      r26        12      15      0x0a  [ROOT]
      interferers: 0=r0 1=r1 3=r3 ...
...

COALESCED ALIASES (alias_idx -> root_idx [root_phys]):
  32 -> 3 [r3]
  34 -> 3 [r3]
  61 -> 3 [r3]
  73 -> 51 [r0]
  ...
```

The `[ROOT]` marker decodes IGNode flag bit `0x08`. The `COALESCED
ALIASES` section decodes flag bit `0x04` (coalesced-away nodes), which
are not in the simplification linked list (so colorgraph never visits
them) but still exist in `INTERFERENCEGRAPH[]` with their root index
preserved in the `assignedReg` field.

## RE correction: where coalesce actually lives

The 2026-05-20 handoff said:

> While doing the RE I found `coalescenodes` at **0x530A80**

That was wrong. Per Ghidra decompilation of the `buildinterferencegraph`
pipeline (`FUN_00530A00`), **0x530A80 is a liveness use-def pass, not
the coalescer**. The buildIG pipeline is:

| # | VA | Role |
|---|---|---|
| 1 | 0x5301B0 | Allocates per-block DEF/USE/IN/OUT bitsets |
| 2 | 0x530A80 | Liveness use-def marker (the old "coalesce hook") |
| 3 | 0x531290 | Builds interference matrix (`DAT_00583088`) |
| 4 | **0x530E00** | **Real conservative coalescer (union-find over `DAT_0058308C`)** |
| 5 | 0x530C00 | Materializes `INTERFERENCEGRAPH` from union-find + matrix |

The old hook at 0x530A80 was effectively a no-op for coalesce
observability — it just logged entry/exit and tried to read
`INTERFERENCEGRAPH` (which holds stale pointers from the previous
function at that point in the pipeline, causing wibo hangs on
dereference). It's been renamed to `hook_dataflow_marker` and kept as
a lightweight observability point; its log lines are now prefixed
`[DATAFLOW]` so they're easy to distinguish.

The real hook at 0x530E00 has full access to `COALESCE_ALIAS`, which
is the only data structure you actually need for both observability
and override.

## When to use which Tier-6 hook

You now have three hooks aimed at the param-iter-ceiling family of
mismatches. They are NOT redundant — they manipulate different stages:

| Hook | Stage | What it changes |
|------|-------|------|
| `--force-iter-first` | Post-simplify, pre-color | Pops named virtuals first during coloring |
| `--force-coalesce` | Pre-simplify, post-coalesce | Adds or removes union-find merges |
| `--force-phys` | Post-color | Hard-overrides assigned physical reg (risky) |

Decision tree:

```
Param virtual fails to get top callee-save?
├── Try --force-iter-first first (safest — no IG mutation)
│   ├── Works → confirmed Tier 6 ceiling. Document & move on.
│   └── Doesn't help (param still loses to a higher-priority local)
│       │
│       └── Try --force-coalesce <param>=<local-with-matching-phys>
│           │   (merge the param into a virtual that DOES win the phys)
│           ├── Works → confirmed Tier 7 (need natural-source coalesce)
│           │   → search for C-source patterns that make MWCC naturally
│           │     coalesce them (move instructions, common subexpressions)
│           └── Doesn't help → likely Tier 8 (structurally unreachable)
└── Resort: --force-phys (last resort, risks data corruption)
```

`--force-coalesce` is the new useful middle ground. Forcing a parameter
to share a root with a local that has the desired callee-save means the
parameter's color = the local's color. This is what `coalescenodes`
would naturally do in MWCC if the parameter and the local were both
operands of a move instruction (and they didn't interfere).

So the workflow becomes: hypothesis-test with `--force-coalesce`, and
if it produces the target ASM, search the C source for ways to
introduce a *natural* move instruction between those two virtuals
(e.g., an alias variable, a temp assignment, a reorganized expression).

## How to use it for a real stuck function

Worked example for hypothesis testing on a param-iter case:

```bash
# 1. Run pcdump first to see the natural coalesce
melee-agent debug pcdump-local src/melee/mn/mnvibration.c \
    --output /tmp/baseline.txt

# 2. Find the param virtual and the local it should merge with.
#    `rank-callees` or `analyze` can identify candidates.
grep -A 2 "^[0-9]" /tmp/baseline.txt | head -30
#    (look at COLORGRAPH DECISIONS — note ig_idx + assignedReg)

# 3. Look at COALESCED ALIASES — see which virtuals naturally merged
grep -A 20 "COALESCED ALIASES" /tmp/baseline.txt | head -30
#    Note the (root_idx → root_phys) mappings.

# 4. Hypothesis: param ig_idx 32 should coalesce into local ig_idx 87
#    (which got r31 naturally). Re-run with force:
melee-agent debug pcdump-local src/melee/mn/mnvibration.c \
    --force-coalesce "32=87" \
    --output /tmp/forced.txt

# 5. Check if param now lives in r31
melee-agent debug rank-callees -f my_function /tmp/forced.txt

# 6. If yes — diff the .text against the target to confirm match
melee-agent debug score-source -f my_function ...
```

## Implementation notes

- The override is applied per coalesce invocation. A spec like `42=38`
  applies wherever virtuals 42 and 38 both exist (typically one class
  per function); pairs out of bounds for the current class are silently
  skipped.
- Forcing two *interfering* virtuals to coalesce produces incorrect
  code (data corruption — like `--force-phys` with the same constraint).
  Use only for matching investigation, never as a "fix".
- The compiled binary is a DLL-patched artifact, NOT what real MWCC
  would emit from any C source. A `--force-coalesce` match tells you
  the target allocation is reachable; it does NOT tell you what C
  source reaches it. That's a follow-up search.

## Useful when

- Param-iter-ceiling cases where `--force-iter-first` doesn't produce
  the target ASM (e.g. the param still ends up losing the dispense
  race even when popped first, because some other local got the desired
  phys at a different point in the simplification stack).
- "Why didn't MWCC coalesce these two?" investigations — the
  `[COALESCE] natural mappings` section now shows you exactly what
  coalesced and what didn't.
- Hypothesis testing for `--name-magic` rewrites that would change
  whether two virtuals end up move-related.

## Tests

600/600 melee-agent tests pass. The hook is exercised in pcdump tests
against the live binary (no unit tests for DLL hooks themselves).

## Commits

- `855d5e729` — mwcc_debug: real coalescenodes hook + FORCE_COALESCE override
- `<pending>` — colorgraph annotations ([ROOT] + COALESCED ALIASES)

## Files

- `tools/mwcc_debug/mwcc_debug.c` — `hook_real_coalesce` at 0x530E00,
  `COALESCE_ALIAS` macro, parse + apply override, colorgraph annotations
- `tools/melee-agent/src/cli/debug.py` — `--force-coalesce` plumbed
  through both `pcdump-local` and `pcdump` (remote)
- `tools/mwcc_debug/scripts/setup_ghidra.sh` — reproducible Ghidra
  project for future MWCC RE work
- `tools/mwcc_debug/scripts/ghidra_query_coalesce_pipeline.py` — the
  decompile-and-xref script that found the real coalescer
