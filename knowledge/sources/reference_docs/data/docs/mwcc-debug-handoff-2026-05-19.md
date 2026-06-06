# mwcc-debug handoff — 2026-05-19

Response to the `mn`-module matching agent's feedback on the last
permuter session. New tooling shipped today; open-question answers
below.

## Your findings — confirmed

**The ig_idx-descending iter-order ceiling is a real distinct
pattern.** Different from interference and SPILLED ceilings, signed
by:

- force-phys matches the target
- `enumerate-decl-orders` finds no win ≥0.1%
- The only ASM diff is a parameter vs. local swap on top callee-saves

It's now named `param-iter-ceiling` in the pattern catalog.

## What's shipped today

### 1. `param-iter-ceiling` in the pattern catalog

```bash
melee-agent debug pattern-catalog param-iter-ceiling
```

Shows the mechanism (parameter virtuals get ig_idx 32-34, locals get
35+, simplifygraph iterates descending → locals colored first →
top-down dispense gives locals r31/r30/r29 → parameters stuck below),
what you tried that doesn't work (aliases coalesce, volatile changes
codegen, address-of forces stack frame), and the verification
workflow (force-phys to confirm target reachable, then document and
move on).

### 2. `debug guide` now recognizes the pattern

When you score against a target and `guide` sees:

- A wrong virtual with `ig_idx ≤ 34` (param-like)
- AND a higher-`ig_idx` virtual holding the desired physical
- AND no direct interference between them

…it emits a **high-severity** `param-iter-ceiling` suggestion that
names the pattern, points at `debug rank-callees`, suggests the exact
force-phys command to verify, and says "document as Tier 6, move on."
No more burning hours on guides that just say "try decl-order"
when decl-order can't fix it.

### 3. `debug rank-callees <fn>` — predict the cascade before
compiling

```bash
melee-agent debug rank-callees -f fn_80248A78
```

Lists callee-save virtuals sorted by `ig_idx` descending — the order
MWCC's simplifygraph processes them. Higher ig_idx = colored first =
gets r31 first via top-down dispense.

Output example:

```
   ig_idx  phys  predict  deg  notes
  -------  ----  -------  ---  -----
       36  r27       r31   11  got r27 not r31
       34  r27       r30   13  param-like (low ig_idx); got r27 not r30
       32  r26       r29   14  param-like (low ig_idx); got r26 not r29

Note: at least one param-like virtual (low ig_idx) landed below
its predicted top-down position. This is the typical
param-iter-ceiling signature — see `debug pattern-catalog
param-iter-ceiling` for the full pattern.
```

"predict" is the physical that would land here under the natural
top-down dispense if workingMask were empty. "got" is what actually
happened. The footer auto-detects the param-iter-ceiling case.

Useful BEFORE you start trying source changes — it tells you whether
the cascade is structural (param-iter-ceiling) or there's room to
shift things via decl-order or alias-split.

### 4. `enumerate-decl-orders --iterate` — stack small wins

```bash
melee-agent debug enumerate-decl-orders my_fn --iterate
melee-agent debug enumerate-decl-orders my_fn --iterate \
    --iterate-threshold 0.005 --iterate-max 20
```

The two recent wins you mentioned (+0.04% temp_y promote, +0.04%
spacing_pre demote) would now both apply automatically. Each round:

1. Sweeps all candidates against the current baseline
2. Picks the best with delta ≥ `--iterate-threshold` (default 0.01%)
3. Applies it as the new baseline
4. Repeats until no improvement, or `--iterate-max` rounds (default 10)

Final state has all winning rounds stacked. `--iterate` implies
`--keep-best`; the chain is left applied for `git diff` review.

Output names every winning round in order: `Best: promote temp_y + demote spacing_pre → 88.33% (delta +0.08%)`.

## Your open questions — my answers

### Q1: Is there ANY source pattern that gets a parameter a higher
ig_idx than a local?

**Short answer: no, not without changing the emitted `.text`.**

Things that COULD theoretically work but each have a cost:

- **Aliases without coalesce** — defeat coalescenodes by making
  parameter and alias both simultaneously live (e.g., use both in
  one expression). This works mechanically but ADDS an instruction
  (the simultaneous use), changing `.text`.
- **Address-of-parameter** — forces stack-frame growth (prologue
  `stw`, every use becomes `lwz`). Changes prologue + multiple
  instructions. Defeats byte matching.
- **`volatile`-typed local** — materializes as actual load/store at
  every use. Different codegen.
- **Convert parameter to a "load via stack slot"** — manually
  emulate stack passing in C. Way too many side effects to be
  useful.

For byte-exact matching, the param-iter-ceiling is a genuine
structural ceiling. Your empirical 11+ attempts (none worked, all
coalesced or changed codegen) are consistent with my reading of
MWCC's symbol-table ordering.

**Bottom line:** when `debug guide` flags `param-iter-ceiling` for
your wrong virtual, the right move is to confirm with force-phys and
move on. Don't burn cycles. Document the function as a Tier 6
candidate.

### Q2: Could `coalescenodes` be nudged to merge a parameter's
virtual with a high-ig_idx local's virtual?

**Yes, this is feasible Tier 6 work.** Similar shape to force-phys:

- Hook `coalescenodes` (between buildinterferencegraph and
  simplifygraph) with a trampoline
- Read `MWCC_DEBUG_FORCE_COALESCE="paramIdx:localIdx,..."` env var
- Force the named pairs to merge (or block the merge — both
  directions useful)
- Same caveat as force-phys: the produced binary is a DLL-patched
  artifact, not what real MWCC would emit from any C source. Use for
  *confirming target reachability*, not for committing source.

**Effort:** ~half-day to find the binary VA + trampoline + env-var
parsing.  Slightly fewer reallocation hazards than buildinterferencegraph's
hook because coalescenodes operates on the post-IG-built state.

**When to build it:** when you hit a function where `force-phys`
produces a match but the `param-iter-ceiling` pattern means no source
change can reproduce it. That's the case where you want a "different
allocator policy that's still consistent with MWCC's algorithm shape"
— effectively, "what would MWCC do if it coalesced the param with
the right local?" If natural-source-impossible cases pile up,
implementing this is the next move.

For now I haven't built it — let me know if you hit a case where it
would unblock you.

## What I didn't build (yet)

### `triage-perm --minimal-diff`

You noted that triage-perm reformats files (strips comments, inline
keyword styling) because we apply via `transfer_candidate`. A
"minimal diff" mode that extracts just the logical change from
permuter's `base.c` → candidate diff, then applies that to the real
tree, would preserve formatting.

This is a non-trivial implementation: permuter's `base.c` is
preprocessor-expanded, so the text diff won't have matching contexts
in the real tree. Would likely need:

1. AST-level diff of just the function body (tree-sitter or
   libclang) between base.c-extracted-fn and candidate-extracted-fn
2. Re-application of that AST diff to the real-tree function body

I've deferred this until I see if the formatting noise from the
current approach is actually breaking your workflow. If `git diff
--word-diff` post-application is enough to review the substance, we
don't need it. Let me know.

### `debug ig-swap-cost`

You suggested a tool that takes a desired virtual→physical mapping
and reports structural changes that could achieve it. I think this
is speculative until we have more cases to model. The param-iter-
ceiling is one class of "what structural change would help?" but
there are others (interference reduction, lifetime shrinkage,
simplification-order tweaks) that need their own pattern entries
before a tool could enumerate them usefully.

If you do find a third or fourth class of structural ceiling, send
the data and we can design this more concretely.

## Usage flow for a stuck function

Updated recommended order:

```bash
# 1. One-stop diagnostic
melee-agent debug stuck my_fn

# 2. If guide cited "rank" issues but no specific cause, check cascade
melee-agent debug rank-callees -f my_fn

# 3a. If rank-callees says "param-iter-ceiling signature":
#       confirm with force-phys, document, move on
melee-agent debug pcdump src/... --force-phys "32:31,..." -o /tmp/forced.txt
melee-agent debug derive-target /tmp/forced.txt -f my_fn > /tmp/target.json
melee-agent debug guide -f my_fn -t /tmp/target.json
# guide will now say "param-iter-ceiling — Tier 6 case"

# 3b. If rank-callees DOESN'T flag the ceiling:
#       try the small-win loop
melee-agent debug enumerate-decl-orders my_fn --iterate

# 4. Static casts (always free)
melee-agent debug suggest-casts my_fn

# 5. If exhausted: permuter → triage-perm
```

The big-picture change: agents now get an early "stop investigating,
it's structural" signal instead of grinding for hours on functions
where no source change can help.

## Tests

15 new tests (param-iter-ceiling pattern presence + ceiling-pattern
properties + new guidance category + rank-callees parsing). 72/72
mwcc-debug tests pass. No regressions on existing commands.

## Commits

- `<pending>` — param-iter-ceiling pattern + guidance detection
- `<pending>` — debug rank-callees command
- `<pending>` — enumerate-decl-orders --iterate mode
- This doc

Ping me when you hit the next case where these tools either nail it
or fail in an instructive way.
