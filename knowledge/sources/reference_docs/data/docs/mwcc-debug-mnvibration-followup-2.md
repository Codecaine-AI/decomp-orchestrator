# `mnVibration_80248644` — second followup (after live-range split confirmed)

Responding to [`docs/mwcc-debug-mnvibration-handoff-back-2.md`](mwcc-debug-mnvibration-handoff-back-2.md). The agent's experimental result definitively settles the mechanism: **MWCC's IR optimizer splits scroll_offset's live range** between the cleanup-loop "use as 0" and the j-loop "use as data->scroll_offset". The followup's predicted failure mode was the actual failure mode.

## What's proven now

The agent's binary hook data is the smoking gun:

```
16    36      r27        11      14      0x02
      interferers: 0=r0 3=r3 4=r4 5=r5 6=r6 7=r7 8=r8 9=r9 10=r10 11=r11 12=r12 32=r26 35=r29 39=r-1
```

**Byte-identical between baseline and the experimental source.** Adding the cleanup-loop use of `scroll_offset` produced ZERO new interferences for r36. The cleanup-loop use of `scroll_offset` became a *different IGNode* than the j-loop use.

So the failure mode is clear: MWCC sees:

- "scroll_offset" v1: lifetime = declaration → end of cleanup loop (value: 0)
- "scroll_offset" v2: lifetime = j-loop reassignment → end of function (value: data->scroll_offset)

These have disjoint live ranges. MWCC's IR optimizer doesn't preserve the C variable identity across the gap because there's a clean "kill" point (the j-loop reassignment) followed by use of the new value.

## One more idea worth a shot before declaring the ceiling

The agent tried decl reorder (Attempt 5, regressed to 99.3%) and same-variable reassignment (Attempt 6, no change). Neither alone worked. Combining them with a type change is the variation I'd try next:

```c
void mnVibration_80248644(HSD_GObj* arg0)
{
    s32 scroll_offset = 0;        // <-- s32 (not u8), declared FIRST, init 0
    MnVibrationData* ptr2;
    MnVibrationData* data;
    s32 i;
    HSD_JObj* jobj17;
    HSD_JObj* child;
    s32 j;
    s32 name_idx;
    s32 count;

    ptr2 = data = arg0->user_data;
    for (i = 0; i < 8; i++) {
        if (data->texts[i] != NULL) {
            HSD_SisLib_803A5CC4(ptr2->texts[i]);
            data->texts[i] = (HSD_Text*) scroll_offset;   // no extra cast — s32 → ptr
        }
    }
    ...
    for (j = 0; j < 8; j++) {
        scroll_offset = data->scroll_offset;       // narrowing u8→s32 (zero-ext via lbz)
        ...
        name_idx = scroll_offset + j;
        ...
    }
}
```

Three combined changes vs. the agent's Attempt 6:

1. **Declared first** — lowest IGNode index → different position in Chaitin's simplification stack → different coloring iteration order. The decl-reorder attempt regressed because j shifted; declaring scroll_offset first specifically might shift it WITHOUT moving j.
2. **`s32` not `u8`** — eliminates the u8→s32 widening cast (`(HSD_Text*)(s32) scroll_offset` becomes `(HSD_Text*) scroll_offset`). May reduce a PCode-level cast operation that's interpreted as a separate temporary.
3. **No `(s32)` cast in the store** — keeps the IR cleaner.

The mechanism I'm hoping for: with a lower IGNode index, scroll_offset might get pushed LATER in simplification → colored EARLIER (LIFO from stack). If it's colored at iter 3 (the first nonvolatile dispense), it gets r31 directly — no workingMask manipulation needed.

This is speculative — I'm guessing at MWCC's simplification heuristics. But it's a one-line edit to test.

**If it doesn't work**, the agent's conclusion stands: pure C source can't force this allocation through MWCC's live-range splitting.

## What I'd accept as the structural ceiling

The agent asked:

> Is there a C-source pattern that produces a SINGLE IGNode for a variable with disjoint uses and intervening reassignment, without using volatile or pointer-of?

My honest answer: **probably no, in general.** MWCC's live-range splitting is fundamental to its IR construction. The only known ways to defeat it are:

- `volatile` (forces memory) — disruptive, breaks too much
- `&variable` (forces stack allocation for aliasing) — disruptive
- Function call return — adds a call
- Compiler-specific pragma (unknown for MWCC 1.2.5n)

If none of these work without other disruptions, we've hit the ceiling for THIS function's structure.

## How to confirm/refute the ceiling

If the combined-variation above doesn't work, run this verification:

```bash
melee-agent debug pcdump src/melee/mn/mnvibration.c --output /tmp/cur.txt --no-pull
# Look at iter 3 in COLORGRAPH DECISIONS — what virtual got r31?
# Confirm it's the cleanup-loop NULL-constant temp, not scroll_offset.
```

If iter 3 is consistently the cleanup-loop temp (not scroll_offset), the only paths forward to break the cascade are:

1. **Restructure the function more fundamentally** — e.g., merge cleanup and j-loop into one loop where scroll_offset is alive throughout. The cleanup-loop ASM would have to change.
2. **Tier 4 (permuter) or Tier 5 (DLL biasing)** — heavier tooling investments to systematically search or directly perturb the allocator.
3. **Accept 99.8% on this function and move to others** — the cascade is real and the 2-line diff is documented. Document the structural ceiling in MEMORY.md so we don't re-investigate.

## A possible Tier-3-extension that would diagnose more cases

The agent suggested:

> Maybe the right answer is Tier 3 work (inspect MWCC's IR optimizer to see what makes it split scroll_offset's live range, then craft a source that doesn't trigger that pass).

This is a real research project but not impossibly large. Hooking the IR-optimizer pass that does live-range splitting (it's somewhere between buildinterferencegraph and simplifygraph, or possibly earlier in copy-propagation) would let us see:

- Which copy/use sites get split
- What MWCC's heuristic is for splitting
- Whether there's a source structure that doesn't trigger the heuristic

Effort estimate: 1-2 days of RE on mwcceppc.exe. Would need to find the split function (similar to how we found makeinterfere/colorgraph) and hook it.

If you want me to pursue this, it'd be a "Tier 3.5" — extending the IG construction hook to also capture the splitter's decisions. Not on the current small-wins roadmap but well-scoped if you want to add it.

## On the matching agent's process

For what it's worth: the agent's experimental methodology has been exemplary. Trying five variations, capturing exact match percentages, identifying the specific failure mode per attempt, and using the binary hook to verify rather than just observing match % — that's the right loop for this kind of investigation. The structural ceiling, if it is one, isn't due to insufficient effort.

## Suggested next steps

1. Try the combined-variation above (s32 type + first decl + no cast in store). 5-minute test.
2. If no change → declare 99.8% the structural ceiling for this function and move on. Add a MEMORY.md entry: "99% ceiling: scroll_offset live-range split (mnVibration_80248644)" for pattern recognition on similar cases.
3. If you want me to pursue Tier 3.5 (live-range-splitter hook) as a follow-up tool investment, say so — it's the only direct path to ANSWERING "what's MWCC doing here" rather than guessing.
