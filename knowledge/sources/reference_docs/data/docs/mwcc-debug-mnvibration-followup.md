# `mnVibration_80248644` — followup after the agent's experimental round

This responds to [`docs/mwcc-debug-mnvibration-handoff-back.md`](mwcc-debug-mnvibration-handoff-back.md), where the matching agent reported five attempted source changes (none shifted r36 → r31) and raised three open questions.

## TL;DR

The agent's experimental rigor was solid. Looking at the attempts carefully, I think there's one specific variation they haven't tried: **use `scroll_offset` itself** (not a separate `zero` variable) as the NULL store source. The mechanism difference is subtle but consequential — keep reading.

## What I think you missed

Attempt 1 was:

```c
s32 zero = 0;
...
data->texts[i] = (HSD_Text*) zero;   // <- uses a SEPARATE variable named `zero`
```

That gave `zero` → r31 in the cleanup loop (as you observed). But `zero` and `scroll_offset` are **two distinct IGNodes** to MWCC. Once `zero` dies at the end of the cleanup loop, r31 returns to the pool. When `scroll_offset` is colored later, it doesn't interfere with `zero` (lifetimes don't overlap), so r31 stays in its workingMask but so do r27, r28, r30. Lowest-bit picks r27.

The variation I want you to try:

```c
u8 scroll_offset = 0;          // <- DECLARE + INIT at top
...
ptr2 = data = arg0->user_data;
for (i = 0; i < 8; i++) {
    if (data->texts[i] != NULL) {
        HSD_SisLib_803A5CC4(ptr2->texts[i]);
        data->texts[i] = (HSD_Text*)(s32) scroll_offset;   // <- USE scroll_offset, not a new var
    }
}
...
for (j = 0; j < 8; j++) {
    scroll_offset = data->scroll_offset;   // <- REASSIGN inside the j-loop (same variable)
    count = GetNameCount();
    ...
}
```

Key difference vs. Attempt 1: **one variable, two phases**. `scroll_offset` is the same C variable / same IGNode whose live range spans BOTH loops. The cleanup-loop body has a real read of `scroll_offset` (used as the NULL store source — value is 0, identical bytes to a NULL literal store), then the j-loop reassigns it.

## Why this should produce r36 → r31

If `scroll_offset` is alive during the cleanup loop, it MUST interfere with whoever's alive at the same time — the cleanup-loop callee-save virtuals:
- `i` (cleanup counter) — currently r27
- `data` — currently r28
- `ptr2` (walker) — currently r30

When `scroll_offset` is colored, its interferers now include these. Combined with the existing interferences (`arg0` → r26, `j` → r29, `data` → r28), the workingMask for `scroll_offset` becomes:

```
{r3..r12, r27, r28, r29, r30, r31} (volatile pool by then)
 − {r3..r12}                       (caller-save, killed by calls scroll_offset crosses)
 − {r26}                            (interferer arg0)
 − {r27}                            (interferer i — NEW interference added by this change)
 − {r28}                            (interferer data — already present)
 − {r29}                            (interferer j)
 − {r30}                            (interferer ptr2 — NEW interference)
 = {r31}
```

Lowest-bit rule picks r31. Done.

## What you'll see in the binary hook to verify

Run pcdump after the change, look at the `COLORGRAPH DECISIONS` section for the iter where `scroll_offset` is colored. Its interferer list should now include the cleanup-loop IGNodes (whatever their indices are — likely 38, 39, 45 or similar):

```
NN    36      r31        ?    ?    ...
      interferers: ... 38=r27 39=r28 45=r30 32=r26 35=r29 ...
```

The `38=r27` (or whatever the cleanup `i` virtual is) showing up in the interferer list of virtual 36 is the success signal — that's the interference edge MWCC computed that forces r36 to r31.

If you DON'T see this, the next-most-likely failure mode is that MWCC's liveness analysis still considers the cleanup uses of `scroll_offset` (where its value is 0) as a SEPARATE live range from the j-loop uses (where it gets reassigned from `data->scroll_offset`). Live-range splitting would defeat this approach.

If THAT happens, fallback: use `scroll_offset` in the j-loop WITHOUT reassigning it first, just using its 0 initial value to seed the computation. But that would require the source's logic to actually want `0 + j` rather than `data->scroll_offset + j` — only viable if `data->scroll_offset` happens to always be 0 at this call site. (Unlikely.)

## Address your specific questions

### Q1: "implicit use" that survives DCE

You found that an early `scroll_offset = data->scroll_offset;` gets DCE'd. That's because the write was followed by another write (in the j-loop) with no read in between. The fix above doesn't have this problem: the cleanup loop body has a REAL read of `scroll_offset` (used as the store source). DCE can't remove the initial `= 0` because the cleanup loop reads it.

If for some reason MWCC still DCEs the initial value (e.g., if it determines `scroll_offset` is always 0 here and inlines the constant), the alternative is to read the value through a route MWCC can't see through:

```c
u8 scroll_offset = (u8) 0;  // explicit cast keeps the variable
volatile u8 _seed = 0;
scroll_offset = _seed;       // read from volatile — can't be folded
```

But try the simpler form first.

### Q2: extending r38 (i) or r45 (ptr2) forward into the j-loop

This would work too, but breaks the cleanup-loop byte-perfect match because the cleanup-loop variables would need stack save slots they currently don't have. The "use scroll_offset across both loops" approach above achieves the same interference graph without needing to extend cleanup variables.

### Q3: steering cleanup-loop variables to skip r27, r28, r30

Hard. MWCC's allocator dispenses from the top down (r31, r30, r29, ...). The first virtual to need a nonvolatile gets r31. You'd need that first virtual to either NOT need r31 (use caller-save) or to be the scroll_offset itself. The latter is what my proposal does.

## On the hook output anomaly you noticed

> The hook's `39=r-1` is confusing — by iter 16, virtual 39 had already been assigned r28 at iter 13.

You're right, this is a hook quirk worth documenting. `39=r-1` means `interferencegraph[39]->assignedReg == -1` at hook-emission time. The node at index 39 in `interferencegraph[]` is not the same node that got r28 at iter 13 — that one shows as `ig_idx=-1` in our output (linear scan didn't find it in the post-coalesce array). Two distinct nodes:

- `interferencegraph[39]` — a pre-coalesce / simplified-out leaf that never got colored. Its index appears in `r36->array` because the interference edge was added before simplification.
- The actual r28-holder at iter 13 — a coalesced/representative node not at index 39.

Treatment: when you see `idx=r-1` in an interferer list, interpret it as "this is a stale index from pre-coalesce; the actual physical that interferes IS in the workingMask analysis but we can't see which one from this output alone." The colorgraph picked a physical for SOMETHING at iter 13 that interferes with r36 transitively.

We could fix this in the hook by maintaining a forward map from "pre-coalesce index" to "post-coalesce representative". Tracking that requires hooking `coalescenodes` (at 0x530E00 per the RE) — possible future work, not critical for the current investigation.

## Why the simulator predicts r36 → r31

You observed:

> `melee-agent debug simulate` ... for our function it predicts r36 → r31 (matches what we *want*), which is precisely the "model wrong vs. reality" gap the binary hook resolves

The simulator's interference model is `analyze_function`'s derived interferences from positional alignment, which misses the actual MWCC IR-level edges (especially the call-site interferences with caller-save physicals). It happens to predict r31 because in the SIMPLIFIED model it sees, r31 is the lowest available. The binary hook is authoritative.

This is a real limitation of the simulator. It's useful for "given this idealized interference graph, what would the algorithm pick" but not for "what does MWCC actually do."

## One safety check

Before trying the variation, look at the current cleanup loop's exact ASM bytes. The change must produce IDENTICAL bytes for the cleanup-loop body (a `stw r31, X(rN)` store, where r31 holds 0 from `li r31, 0`). If `scroll_offset` ends up in r31 during cleanup (which is what we want), the cleanup loop should be byte-perfect. If it ends up somewhere else, the cleanup loop will regress.

Predicted ASM for the cleanup loop body (if this works):

```
li   r31, 0                  ; r31 = scroll_offset = 0
                             ; (or `li r28,0` then `mr r31,r28` if MWCC routes differently)
...                          ; cleanup loop walks
stw  r31, 0x70(r30)          ; *ptr2 = (HSD_Text*)scroll_offset
                             ; ^ same bytes as `stw r0, 0x70(r30)` would be, just different reg
```

If `scroll_offset` ends up in r27 or r28 instead of r31, the store reg would differ → regression. Watch for that in the diff.

## Tooling improvements relevant to this case

A diff-mode command (`melee-agent debug diff dump1.txt dump2.txt --function X`) would speed up your iteration — show me which virtuals' interferences changed between attempts. That's on my small-wins list to build next.
