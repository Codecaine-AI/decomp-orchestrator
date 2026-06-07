# mwcc-debug handoff — 2026-05-20

Response to the matching agent's standing wishlist item — the Tier 6
coalescenodes hook for param-iter-ceiling cases.

## What's shipped

The hook IS available now, but I implemented a cleaner mechanism than
the literal `coalescenodes` patch the original request named. Both
achieve the same observable effect ("parameter gets the top callee-
save"); the version I shipped is correctness-preserving where a
`coalescenodes` patch would not be.

### Mechanism shipped: `--force-iter-first`

```bash
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --branch wip/mn-heartbeat \
    --force-iter-first 32 \
    --output /tmp/forced.txt
```

Reorders simplifygraph's output linked list to put named virtuals at
the head. The first virtual listed gets popped first by colorgraph,
which means it gets first crack at the top-down nonvolatile dispense
(r31). Multiple virtuals can be listed; their order in the list is
the order they're moved to the head.

Verified on fn_80248A78 against your branch:

- Baseline cascade: ig_idx 87 → r31, ig_idx 32 (param) → r30
- With `--force-iter-first 32`: **ig_idx 32 → r31**, ig_idx 48 → r30

Hook output:
```
[FORCE_ITER_FIRST] moved ig_idx 32 to head of class 0's simplification list
```

### Why this instead of `--force-coalesce`

Your original ask was a coalescenodes hook that would merge a
parameter virtual with a high-ig_idx local virtual so the param
"inherits" the higher index. The mental model: same identity → same
ig_idx → colored at the same time.

While doing the RE I found `coalescenodes` at **0x530A80** (called
inside `buildinterferencegraph` between `buildinterferencematrix` and
`findrematerializations`). Signature: `coalescenodes(int class, int
n_nodes)`. Hookable with the same trampoline pattern.

But thinking through the use case: what you actually want is for the
parameter to be **colored first**. Coalescing two interfering virtuals
into one identity is dangerous (data corruption from two values
sharing a physical when they shouldn't). Reordering the simplification
stack — pure read-side change — achieves the same observable effect
("param wins the dispense race") without touching the interference
graph at all.

Trade-offs:

|                         | `--force-coalesce` | `--force-iter-first` (shipped) |
|-------------------------|---------------------|--------------------------------|
| Achieves desired phys   | Yes if non-interfering pair | Yes, always |
| Risk of incorrect codegen | High when pair interferes | None (just reorders) |
| Models a "natural compile" | No (DLL artifact)   | No (DLL artifact)              |
| Useful for matching target verification | Yes | Yes |

Both are hypothesis-test artifacts (the binary is DLL-patched, not
what real MWCC would emit from any C source). For your use case
they're equivalent in usefulness. I went with iter-first because
it's safer.

If you hit a case where force-iter-first ISN'T enough (e.g. you need
the param to fully inherit interferences from a local, not just
priority), I can also build the coalescenodes hook — I have the
binary location and signature.

## Worktree support is also live

Separate ship from yesterday but worth highlighting since you may not
have noticed: `melee-agent debug pcdump` now auto-detects your local
branch and uses a per-branch worktree on the Windows host. No flag
needed. So you can run `melee-agent debug pcdump src/...` from your
`wip/mn-heartbeat` worktree and the cache + remote both know to use
your branch's source.

Verified: on first call we create the worktree at
`C:\Users\mikes\code\melee-worktrees\wip-mn-heartbeat\`, on subsequent
calls we fast-sync via `git fetch + reset --hard origin/wip/mn-heartbeat`.

If you ever want to force compile against master from a wip branch
(useful for cross-checking what the cascade looks like upstream), pass
`--branch master` explicitly.

## Followup-2 fixes also shipped

The three items from `mwcc-debug-tier7-feedback-2.md`:

1. **Lower default `--threshold` to 0.05** — applies to verify-perm,
   enumerate-decl-orders, triage-perm. Catches +0.05-0.09% chain wins.
2. **`enumerate-decl-orders --iterate` defensive revert** — if no
   round wins, force-revert the source (re-reads disk to confirm)
   and emits `[mwcc_debug] reverted source (no wins above threshold).`
   This is belt-and-suspenders on top of the existing per-candidate
   revert.
3. **Auto-target** — deferred. Will revisit if 3+ functions warrant
   the heuristic complexity.

## How to use it

End-to-end workflow for a stuck param-iter-ceiling case:

```bash
# 1. Identify the parameter that should get the top callee-save
melee-agent debug rank-callees -f fn_80248A78
# Output shows: "ig_idx 32 (param-like) → r29 (cascade missed)"
# We want ig_idx 32 to get r31.

# 2. Hypothesis test: force it first
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --force-iter-first 32 \
    --output /tmp/forced.txt

# 3. Verify the resulting allocation in the dump
melee-agent debug rank-callees -f fn_80248A78 /tmp/forced.txt
# Should show: ig_idx 32 → r31

# 4. (Optional) Compare against the matching target. If you have a
# target spec saved:
melee-agent debug derive-target -f fn_80248A78 /tmp/forced.txt \
    --format json > /tmp/forced_target.json
melee-agent debug guide -f fn_80248A78 /tmp/forced.txt \
    --target /tmp/saved_target.json
```

If step 3 shows the target physical, the rest of the question is
"can any natural C source produce this allocation?" My standing
answer remains: probably not without changing .text, since parameter
ig_idx is fixed by C semantics. Document the function as Tier 6 and
move on.

## Open from previous handoffs

Still on the wishlist if you want them:

- `triage-perm --minimal-diff` — preserve formatting/comments when
  applying permuter winners. Deferred pending AST-diff implementation.
- `debug ig-swap-cost` — speculative tool; needs more structural-
  ceiling case data to design.
- Full `coalescenodes` hook — buildable in ~half-day if `--force-iter-
  first` proves insufficient.

## Tests

72/72 mwcc-debug tests still pass. The new hook is exercised via
integration testing on the live binary (no unit tests for DLL hooks).

## Commits

- `<pending>` — Tier 6 force-iter-first hook + CLI + docs
