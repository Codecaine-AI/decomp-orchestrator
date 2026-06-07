# `mnVibration_80248644` register cascade — actual findings

This document corrects an earlier conclusion that the function's 99.8% match was a "structural ceiling" and lays out what the binary hook (Tier 2 of mwcc_debug) actually reveals. It's intended as a handoff for the matching agent currently on `wip/mn-heartbeat` (`/Users/mike/.codex/worktrees/626f/melee-2`).

## TL;DR

- The earlier claim "r36 (scroll_offset) interferes with r50 (NULL constant) in our IR, so r36 can't pick r31, so 99.8% is structurally unfixable" is **wrong**.
- Binary-hook ground truth: r36 does **not** interfere with r50 in our build.
- r36 → r27 happens because at r36's coloring iteration, the lowest-bit rule picks r27 from a workingMask of {r27, r28, r30, r31}. It's an iteration-order/pool-state outcome, not a constraint problem.
- The target ASM definitively reaches r36 → r31, so a source change can match.
- Concrete starting point: introduce a *used* `s32 zero = 0;` as the NULL store source so MWCC keeps a callee-save 0-valued virtual alive across the cleanup loop.

## Background

Earlier analysis concluded that r36's allocation to r27 was "forced by interferences MWCC computes that our simpler model misses" — specifically that r36 interferes with r50 (the cleanup-loop NULL constant in r31), so r36 cannot have r31 and falls to r27. That framing led to the "structural ceiling at 99.8%" conclusion.

The Tier 2 binary hook of `colorgraph` was extended (commit `c232825c2`) to dump each virtual's full interferer list with assigned physicals, so we can verify or refute specific interference hypotheses against the actual interference graph MWCC builds.

## What the binary hook shows

Running `melee-agent debug pcdump src/melee/mn/mnvibration.c --output dump.txt --no-pull` against the `wip/mn-heartbeat` worktree's `mnvibration.c`, the `COLORGRAPH DECISIONS` section for `mnVibration_80248644` includes:

```
iter  ig_idx  assignedReg degree  nIntfr  flags
...
16    36      r27        11      14      0x02
      interferers: 0=r0 3=r3 4=r4 5=r5 6=r6 7=r7 8=r8 9=r9 10=r10 11=r11 12=r12 32=r26 35=r29 39=r-1
17    35      r29        13      18      0x02
      interferers: 0=r0 3=r3 ... 12=r12 32=r26 36=r27 39=r-1 41=r-1 42=r-1 53=r-1 54=r-1
20    32      r26        14      27      0x02
      interferers: 0=r0 3=r3 ... 12=r12 35=r29 36=r27 38=r-1 39=r-1 41=r-1 42=r-1 43=r-1 44=r-1 45=r-1 46=r-1 47=r-1 48=r-1 49=r-1 50=r-1 53=r-1 54=r-1
```

Key reads:

- **iter 16 is r36** (ig_idx 36). Its full interferer list is: {0, 3..12 (pre-assigned physicals), 32 (→r26), 35 (→r29), 39 (→unassigned)}. **r50 is not in the list.**
- iter 17 is r35 (scroll_offset's neighbor in the j-loop), assigned r29.
- iter 20 is r32 (the long-lived virtual that interferes with everything), assigned r26.

## The actual mechanism

At iter 16 (r36's turn):

1. The volatile pool already contains r27, r28, r29, r30, r31 — all dispensed via `obtain_nonvolatile_register` in earlier iterations (3, 7, 8, 13, 14).
2. workingMask = volatile pool minus interferers' regs = {r3..r12, r27..r31} minus {r3..r12 (caller-save killed by calls r36 crosses), r26 (held by r32), r29 (held by r35)} = **{r27, r28, r30, r31}**.
3. workingMask is non-empty, so the algorithm picks the lowest set bit → **r27**.

If we want r36 → r31, we need workingMask at r36's iteration to be `{r31}` only. That requires r36 to also interfere with whoever holds r27, r28, and r30. None of those interferences exist in the current source.

## How the target achieves r36 → r31

(From an ASM trace of the expected `mnVibration_80248644`.)

The target uses r31 for two non-overlapping logical variables:

```
80248660: li   r31, 0x0          ; prologue: r31 = 0
80248684: stw  r31, 0x70(r30)    ; cleanup loop: r31 used as NULL store source
                                   (r31 untouched between cleanup and j-loop)
802486D8: lbz  r31, 0xa(r28)     ; j-loop: r31 reloaded with scroll_offset
802486F8: add  r0, r31, r29      ; r31 consumed as scroll_offset value
```

MWCC fused two C variables into r31 because their live ranges don't overlap:

- A 0-valued constant alive across the cleanup loop (used as the NULL pointer store source).
- `scroll_offset` (u8), used in the j-loop only.

In the worktree's current source, the cleanup loop stores `data->texts[i] = NULL` (literal). This compiles to a caller-save scratch `li` + `stw` — no callee-save 0-valued virtual gets created, so the dispense pattern is different and scroll_offset ends up sharing the pool with already-dispensed nonvolatiles.

`master` actually has `s32 zero;` declared and assigned `zero = 0;`, but `zero` is never read (the store uses the `NULL` literal). MWCC's dead-code elimination drops `zero` entirely. The agent's `wip/mn-heartbeat` removed the dead declaration; doesn't matter — the effect on coloring is the same either way.

## Concrete starting point for matching

Add a *used* `s32 zero = 0;` and make it the actual NULL store source:

```c
void mnVibration_80248644(HSD_GObj* arg0)
{
    MnVibrationData* ptr2;
    MnVibrationData* data;
    s32 i;
    HSD_JObj* jobj17;
    HSD_JObj* child;
    s32 zero = 0;             // <-- add
    u8 scroll_offset;
    s32 j;
    s32 name_idx;
    s32 count;

    ptr2 = data = arg0->user_data;
    for (i = 0; i < 8; i++) {
        if (data->texts[i] != NULL) {
            HSD_SisLib_803A5CC4(ptr2->texts[i]);
            data->texts[i] = (HSD_Text*) zero;   // <-- use it
        }
    }
    // ... rest unchanged
}
```

What this *should* do (verify via the binary hook output after each iteration):

1. `zero` becomes a virtual with high use count + lives across all 8 cleanup-loop iterations.
2. Because `zero`'s value flows into a pointer store that's live across function calls (`HSD_SisLib_803A5CC4`), MWCC marks it as needing callee-save.
3. `obtain_nonvolatile_register` dispenses it r31 (top of pool).
4. After the cleanup loop, `zero` dies.
5. When scroll_offset is colored, r31 is in its workingMask but so is r27 (still in pool from a previous dispense).

The fix may not work in one shot — step 5 may still cause scroll_offset → r27 unless scroll_offset interferes with r27's holder. If the first try doesn't shift the assignment, the iteration loop is:

1. Make a candidate source change.
2. `scp src/melee/mn/mnvibration.c nzxt-local:; mv on remote into place` (or push to a branch and pull on remote).
3. `melee-agent debug pcdump src/melee/mn/mnvibration.c --output dump.txt --no-pull`.
4. In `dump.txt`, find `COLORGRAPH DECISIONS` for `mnVibration_80248644` and read r36's row + interferer list.
5. Observe: did r36's interferer set change? Did its workingMask become {r31}? Did the assignment change?

## What we don't know

- **The exact target source.** ASM-to-source isn't injective; multiple C structures can compile to the same bytes. The `zero` variable is a hypothesis derived from the ASM pattern, not a proven reproduction.
- **Whether the fix alone is sufficient.** Step 5 above might still go to r27 unless additional interferences exist. The iteration loop will surface this.
- **What `iter 14`'s ig_idx=-1 corresponds to.** Several worklist entries don't appear in `interferencegraph[]` via our linear-scan lookup. The binary hook could be extended (Tier 3) to dump the worklist with stable identifiers.

## Tooling recap

The matching agent has three commands available:

- `melee-agent debug pcdump <c-file> --output <file>` — full pcdump, includes `COLORGRAPH DECISIONS` sections from the binary hook with per-virtual interferer lists.
- `melee-agent debug analyze <dump>` — derived live ranges + interferences (approximate; the binary hook output is authoritative for ground truth).
- `melee-agent debug simulate <dump> --function <name>` — replay the algorithm with reasoning trace (predicted vs. actual).

Reference: [`docs/mwcc-allocator-algorithm.md`](mwcc-allocator-algorithm.md) for the algorithm details (top-down nonvolatile dispense, lowest-bit rule, etc.).

## Where to go for genuinely-stuck cases

If after several source iterations the binary hook shows r36's interferer set can't be moved to include all of r27/r28/r30, that *would* indicate the function's IR shape is genuinely constrained for this C source family. At that point the question becomes whether the target was compiled from a fundamentally different source structure (different variable decomposition, different loop shape) — answerable only with deeper investigation (Tier 3: hook interference-graph construction directly, or instrument MWCC further).

But: the binary hook proved the "structural ceiling" claim was premature. The current concrete fix space has not been exhausted.
