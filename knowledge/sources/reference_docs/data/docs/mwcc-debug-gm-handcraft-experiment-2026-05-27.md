# gm_80173EEC hand-craft experiment

## Goal

This experiment tested whether the full allocator constraint diagnosis for
`gm_80173EEC`, plus pcdump-level IR visibility, is enough for an agent to
hand-craft a match that the permuter campaigns could not find.

The starting point was the known force-proof:

```bash
melee-agent debug dump local src/melee/gm/gm_16F1.c \
  --function gm_80173EEC \
  --force-phys '34:31,37:30,32:29,42:28,52:28,38:28' \
  --force-phys-fn gm_80173EEC \
  --output /tmp/gm-target.txt
```

The best available candidate used for comparison was
`output-2000074-1`, from the Phase 2 coalesce-preservation pool. It preserves
all six target ig_idx values as independent allocator nodes and reaches the
known 99.33% ceiling, but does not match.

## Residual constraint

The forced target and the current source have identical PCode through
`AFTER PEEPHOLE FORWARD`; `debug inspect diff /tmp/gm-target.txt
/tmp/gm-baseline.txt -f gm_80173EEC` first diverges after register coloring.
That means the current source already expresses the right instruction shape
before coloring. The remaining mismatch is allocator order and physical
assignment only.

The force-proof target assigns the relevant virtuals as follows:

| Virtual | Semantic role | Target phys | Baseline phys | Best candidate phys |
|---|---|---:|---:|---:|
| r34 | outer loop counter `i` | r31 | r30 | r31 |
| r37 | byte-offset IV for `x18[i]` | r30 | r31 | replaced by r92 -> r30 |
| r32 | computed `&x18[i]` pointer | r29 | r28 | r28 |
| r42 | Classic `ckind` temp | r28 | r29 | r29 |
| r52 | Adventure `ckind` temp | r28 | r29 | r29 |
| r38 | inline unlock loop index | r28 | r30 | different virtual, r37 -> r30 |

The best candidate gets the first two roles close by introducing a new
compiler byte-offset IV (`r92`) and moving the source loop counter to r31.
It still leaves the pointer IV in r28, the `ckind` temps in r29, and the
inline loop with different virtual identities. So the residual from 99.33% to
100% is not just "preserve coalescing"; it is:

1. Keep the baseline PCode shape.
2. Make the outer loop counter and byte-offset IV dispense r31/r30.
3. Make the computed `x18` pointer dispense r29.
4. Make the award-kind temps reuse r28.
5. Keep the inline all-unlocked loop aligned with target virtuals and colors.

Those requirements are tightly coupled. Source edits that improve one of them
usually perturb virtual numbering or live ranges enough to lose another.

## Source hypotheses tried

All source edits were applied directly to `src/melee/gm/gm_16F1.c`, compiled
with targeted `ninja build/GALE01/src/melee/gm/gm_16F1.o`, and checked with
`python tools/checkdiff.py gm_80173EEC`.

| # | Hypothesis | Effect | Result |
|---:|---|---|---|
| 1 | Exact best-candidate no-op: `i++; i--;` in the first `CKIND_ZELDA` branch | Introduced new offset IV `r92`; moved loop counter to r31 and offset IV to r30 | 99.33%; still wrong pointer IV, `ckind` temps, and inline loop |
| 2 | Reorder locals to `u16* temp_r29; int i; u8 ckind;` | Changed allocator pressure but did not preserve the target assignment sequence | Mismatch; no improvement over the known ceiling |
| 3 | Add `i++; i--;` in both first `CKIND_ZELDA` and `CKIND_SEAK` branches | Same family as #1; did not address residual pointer and `ckind` colors | Mismatch |
| 4 | Use `i += 0;` instead of increment/decrement | Same allocator nudge as the no-op family | Mismatch |
| 5 | Rewrite loop as pointer-increment over `x18` | Changed call and loop structure too much | Worse structural mismatch |
| 6 | Introduce explicit byte offset local | Made the source resemble the allocator IV, but changed PCode and live ranges | Worse structural mismatch |
| 7 | Change `ckind` from `u8` to `int` | Widened `ckind` lifetime/type and disturbed later inline allocation | Worse mismatch |
| 8 | Add explicit `(u8)` casts to `gm_8016400C(i)` assignments | No meaningful codegen change | Baseline-style 99.06% mismatch |
| 9 | Move `temp_r29` declaration inside the loop | No meaningful codegen change | Baseline-style 99.06% mismatch |
| 10 | Reorder locals to `u8 ckind; int i; u16* temp_r29;` | No meaningful codegen change | Baseline-style 99.06% mismatch |
| 11 | Use `temp_r29[0]` instead of `*temp_r29` | No meaningful codegen change | Baseline-style 99.06% mismatch |
| 12 | Cache `*temp_r29` in a local `u16 count` | Removed the repeated loads and shifted code addresses | Worse structural mismatch |
| 13 | Use `(u32) i` in the `x18` array index | Natural source nudge that puts the outer loop counter/offset closer to target | About 99.1%; still wrong pointer IV, `ckind` temps, and inline loop |
| 14 | Combine `(u32) i` with the first-branch `i++; i--;` nudge | Did not improve beyond the `(u32) i` shape | About 99.1%; still mismatched |

No attempted developer-plausible source reached 100%, and none surpassed the
previous 99.33% real-tree ceiling.

## What the IR tooling clarified

The tooling was useful for diagnosis. It showed that:

- The current source is not missing a front-end structural construct before
  coloring. Forced target and baseline are identical until register coloring.
- The 99.33% candidate's improvement is real but partial. It creates a new
  first-loop byte-offset IV (`r92`) that takes r30 while the loop counter takes
  r31.
- That candidate also demonstrates the main trap for raw ig_idx constraints:
  source edits can change virtual identity. The semantic "byte-offset IV" moved
  from target `r37` to candidate `r92`, while candidate `r37` became the later
  inline loop index.

This is the central residual: an allocator diagnosis that names only raw
ig_idx values is precise for a fixed IR, but source edits can move the same
semantic role to a new virtual. A hand-craft workflow needs a semantic bridge
from source roles to virtuals, not just a force-phys list.

## Verdict

**No match in the bounded hand-craft pass.** The experiment characterized the
residual constraint, but the diagnosis did not translate into a clean source
change that closes the final 0.67%.

The meta-finding is mixed:

- Diagnosis tooling is valuable. It turned an opaque 99.33% ceiling into a
  concrete allocator residual: r32 must move to r29, r42/r52/r38 must reuse r28,
  and the candidate's partial fix achieves r31/r30 only by changing virtual
  identity.
- Diagnosis alone was not sufficient. The missing capability is constraint to
  source-shape mapping: "what C rewrite preserves the baseline PCode while
  changing only this allocator order?"
- Backward inference still looks useful as an explainer, but this result argues
  against assuming that explanation by itself will produce matches. The next
  useful layer would need to propose source transformations that preserve
  semantic roles across virtual renumbering, or mine matched source for patterns
  that perturb allocator order without changing PCode shape.
