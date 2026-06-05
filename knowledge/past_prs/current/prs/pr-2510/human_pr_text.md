## PR #2510: Match `mnEvent_8024CE74`
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2510

## Summary

Restore the `mnEvent_CountUnlocked()` static inline wrapper that was removed in #2447, recovering the 100% match for `mnEvent_8024CE74`.

## Why

`mnEvent_8024CE74` initializes `count = 0` and `i = 0` and then runs a count loop. With the loop inline in the function body, MWCC lowers the two initializations as two independent `li` instructions:

```asm
li   r31, 0   ; i = 0
li   r30, 0   ; count = 0
```

The expected build uses `addi r30, r31, 0` for the second — a data-dependent register copy — which only happens when both locals are defined together inside a static inline wrapper that MWCC inlines back into the caller. The wrapper looks like:

```c
static inline s32 mnEvent_CountUnlocked(void)
{
    s32 i;
    s32 count = 0;

    for (i = 0; i < 0x33; i++) {
        if (gmMainLib_8015CEFC(i) != 0) {
            count += 1;
        }
    }
    return count;
}
```

`mnEvent_8024CE74` then just calls `count = mnEvent_CountUnlocked();`. Same pattern as `mnInfo_CountUnlocked` / `mnCount_CountUnlockedChars` elsewhere in `mn/`.

## Files

- `src/melee/mn/mnevent.c` — add `mnEvent_CountUnlocked()` static inline, call it from `mnEvent_8024CE74`.

## Verification

- `python configure.py && ninja` → green
- `mnEvent_8024CE74`: **99.4% → 100%**
- No other functions affected.
