# MWCC PCode IR — what makes scroll_offset "split"

Investigation findings from Tier 3.5 work on `mnVibration_80248644`. Answers the matching agent's open question: *"Is there a C-source pattern that produces a SINGLE IGNode for a variable with disjoint uses and intervening reassignment, without using volatile or pointer-of?"*

## The mechanism

Looking at the experimental source's `BEFORE GLOBAL OPTIMIZATION` pass (the EARLIEST pcdump pass, emitted before any optimization runs), scroll_offset already appears as **two distinct virtual registers**:

- **`r50`** — cleanup-loop use, emitted as `li r50, 0; stw r50, 112(r45)`
- **`r36`** — j-loop use, emitted as `lbz r36, 10(r39)` (load from data->scroll_offset)

`r50` does not appear ANYWHERE else in the function's IR. `r36` is only loaded in the j-loop.

This means the split is **NOT** a later optimization pass (it's there from the start). The mechanism is:

### Empirical confirmation: baseline vs experimental IR are byte-identical

The most striking evidence: compile the baseline source (`data->texts[i] = NULL;`) and the experimental source (`data->texts[i] = (HSD_Text*)(s32) scroll_offset;`) and compare the BEFORE GLOBAL OPTIMIZATION pass. The cleanup-loop NULL store is:

**Baseline:**
```
li   r50, 0
stw  r50, 112(r45)
```

**Experimental (with `u8 scroll_offset = 0;` used as the source):**
```
li   r50, 0
stw  r50, 112(r45)
```

**Byte-identical.** MWCC's PCode generation produces the same IR regardless of whether the C source writes `NULL` literal or references a variable holding the constant 0. The variable identity is **completely erased** at PCode construction — MWCC tracks the VALUE (which is 0), not the variable name.

This means the matching agent's "use scroll_offset as the cleanup-loop NULL source" approach is provably equivalent to the baseline at the IR level. There was no way it could have worked.

### Empirical confirmation #2: r50 is unchanged across ALL optimization passes

Tracking r50 (the cleanup-loop scroll_offset virtual) across every pass marker in the pcdump:

| Pass | r50 in cleanup-loop body |
|------|---|
| BEFORE GLOBAL OPTIMIZATION | `li r50, 0; stw r50, 112(r45)` |
| AFTER VALUE NUMBERING | `li r50, 0; stw r50, 112(r45)` |
| AFTER COPY PROPAGATION | `li r50, 0; stw r50, 112(r45)` |
| AFTER CODE MOTION | `li r50, 0; stw r50, 112(r45)` |
| AFTER LOOP TRANSFORMATIONS | `li r50, 0; stw r50, 112(r45)` |
| AFTER CONSTANT PROPAGATION | `li r50, 0; stw r50, 112(r45)` |
| AFTER INSTRUCTION SCHEDULING | `li r50, 0; stw r50, 112(r45)` |
| AFTER PEEPHOLE FORWARD | `li r50, 0; stw r50, 112(r45)` |

**Byte-identical at every checkpoint.** None of the optimization passes touched r50. The Tier 3.5 propagateconstants hook (commit below) confirms CP DID fire for this function (changed_flag flipped) but didn't modify scroll_offset's cleanup-loop encoding — because there was nothing left to propagate after PCode generation already inlined the constant.

This is as definitive as observational evidence gets. The mechanism is PCode generation, full stop.

**MWCC's PCode generation inlines compile-time-known constants at the use site, creating a fresh temporary register rather than referencing the source variable.**

When MWCC's front-end IR-builder sees:

```c
u8 scroll_offset = 0;       // KNOWN constant value
...
data->texts[i] = (HSD_Text*)(s32) scroll_offset;   // use of scroll_offset
```

It produces (in PCode):
- Define the literal 0 at the use site directly: `li r50, 0`
- Store r50: `stw r50, 112(r45)`

There's no `mr r50, r_scroll_offset` (which would create a coalescing opportunity). The constant is inlined as a SEPARATE pseudo-virtual.

The j-loop's `scroll_offset = data->scroll_offset;` then defines a NEW virtual (r36) via a memory load (`lbz r36, 10(r39)`). Since the cleanup-loop "use" was inlined to a different virtual, r36 has no IR-level connection to the cleanup-loop region.

## Why coalescing can't merge them

MWCC's `coalescenodes` (at VA 0x530E00 per our earlier RE) merges virtuals connected by COPY (`mr`) instructions if they don't interfere. But:

- r50 was created by `li r50, 0` (constant load)
- r36 was created by `lbz r36, 10(r39)` (memory load)

Neither is a copy. No coalescing opportunity exists.

To create a coalescing opportunity, the IR would need a `mr` between two scroll_offset-like virtuals. From C source, that requires copy assignments like `varA = varB;`. But:

- `scroll_offset = 0;` doesn't yield a copy — it yields a constant inline (`li`)
- `scroll_offset = data->scroll_offset;` yields a load (`lbz`), not a copy

So the C-source assignments in this function never produce copies that could merge cleanup and j-loop scroll_offset into one IGNode.

## What would defeat the constant inlining

For `r50` to be a `mr r50, r_scroll_offset` (copy from the C variable) instead of `li r50, 0` (inlined constant), MWCC must NOT know scroll_offset's value at the use site. That requires:

1. **Non-constant initial value** — `u8 scroll_offset = data->scroll_offset;` (initialize from memory, MWCC can't statically prove value)
   - But then the cleanup store stores `data->scroll_offset` (the runtime value), not 0. This changes the function's semantics unless we KNOW `data->scroll_offset` is always 0 when this function is called.

2. **Volatile** — `volatile u8 scroll_offset = 0;` forces stack storage. Already tested by the matching agent: drops to 87.6% match.

3. **Address taken** — `&scroll_offset` used somewhere. Forces stack storage. Same problem as volatile.

4. **External non-foldable expression** — `u8 scroll_offset = some_external_function();`. Adds a function call.

5. **Pointer aliasing** — write through a pointer that could alias scroll_offset, forcing MWCC to assume it's been modified. But aliasing analysis is complex; this might not actually defeat constant prop.

None of these maintain byte-identical cleanup-loop ASM AND prevent constant inlining.

## The structural conclusion

For `mnVibration_80248644` and similar functions where:

- A C variable is assigned a literal constant value at declaration
- The variable is used as the source of a store/operation in an early region
- The variable is later reassigned to a non-constant runtime value
- The same physical register would naturally hold both (because their live ranges don't overlap)

MWCC's PCode IR generation will inline the constant at the use site, creating disjoint virtuals that cannot be unified through any subsequent optimization pass. The two halves of the variable get colored independently and naturally land in different physical registers.

**The matching strategy for these cases would require either:**

A. **Different C source structure** that creates IR-level `mr` instructions between the constant-load and runtime-load values (e.g., a path where the j-loop computes scroll_offset from cleanup's prior value, forcing a copy). Usually requires changing the algorithm's structure significantly.

B. **Forcing the value to be non-constant** at the cleanup use site — but every known approach (volatile, function call, address-of) disrupts other ASM.

C. **Compiler-side intervention** (Tier 5 territory — patching the PCode generator or biasing the coloring directly).

## Practical implications for matching investigations

When you see this pattern in pcdump for a stuck-at-99% function:

```
BEFORE GLOBAL OPTIMIZATION pass:
  Some block: li rA, 0; stw rA, X(rN)    ← "constant-inlined" use
  Different block, later: lbz rB, X(rN)  ← "runtime-load" use
```

These two virtuals (rA and rB) CANNOT be unified through pure C-source changes if both are derived from the same C-level variable name. The constant-inlining happens at IR construction time, before any pass we can influence via source.

This is a definitive answer to "can I write C that defeats MWCC's live-range splitting for this pattern?" — **no, when the splitting is constant-inlining at PCode generation, the C source can't reach inside to merge them.**

## What we'd need for Tier 5

If we wanted to actually achieve r36 → r31 for this function, the approach would be:

- Hook the patched DLL to *bias the allocator* during colorgraph
- Specifically: when r36's workingMask is `{r27, r30, r31}`, force the pick to be r31 instead of lowest-bit r27

That requires the DLL to inject code into colorgraph's decision branch (much more invasive than current observe-only hooks). It also raises questions about whether such a bias would reveal a real preference or just produce different ASM that happens to match. Out of scope for current Tier 3.5.

## Status of mnVibration_80248644

The matching agent's 99.8% match is the structural ceiling for this function's current C structure. The 2-line diff is documented and explained.

To get to 100%, one of:
1. The C structure changes in a way that affects more than just scroll_offset's allocation
2. Tier 5 work to bias the allocator from the DLL
3. Accept the diff and move on to other functions

This investigation has been thorough enough that revisiting this function should be considered low-priority unless tooling-side changes (Tier 5) become available.
