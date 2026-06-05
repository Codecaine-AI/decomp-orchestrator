## PR #2508: lb: implement lb_80019628; improve four lbbgflash functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2508

## Summary

- **`lb_0192.c`** (`lb_80019628`): adds a C body for the pad-sampling-rate maintenance function called from `lb_80019894`. Snapshots `lb_804329F0.x38`, picks the minimum of `x0[0].x0` / `x0[1].x0` / `OS_TIMER_CLOCK` / `OS_TIMER_CLOCK * 1/60` as the new period, divides by `OS_TIMER_CLOCK/1000` for the ms cap (≤ 11), then updates `PADSetSamplingRate` and reschedules the periodic alarm with `fn_800195FC`.
- **`lbbgflash.c`** (`fn_8001FC08`): restructures each per-channel saturation block to use branch-local `u8 target` / `f32* cur` locals so MWCC keeps the byte target and the `x10[i]` pointer in r5/r4 across the rising/falling logic.
- **`lbbgflash.c`** (`lbBgFlash_80020E38`): reorders the squared-component locals (dx2/dy2/dz2 instead of dz2/dx2/dy2) and the sum to match how the original schedules the lfs/fmuls/fadds pipeline.
- **`lbbgflash.c`** (`fn_8002113C`): routes `&rot` through a `Quaternion* volatile` local so MWCC keeps the inline-substituted asserts at `jobj.h:699/700` in the `Fake_HSD_JObjGetRotation` expansion (previously the compiler proved `&rot` non-null and elided the assert call entirely).
- **`lbbgflash.c`** (`fn_80020AEC`): expands `parent = jobj ? jobj->parent : NULL;` to an explicit `if/else` so MWCC schedules the non-null case first, matching the bne / b / li sequence the original emits for `parent`.

## Functions matched

No 100% matches. Five improvements toward the original:

- `lb_80019628`: 0% (no source body — was relying on the asm-only fallback) → **82.58%** fuzzy
- `fn_8001FC08`: 89.55% → **91.77%** fuzzy
- `fn_8002113C`: 93.17% → **94.72%** fuzzy
- `fn_80020AEC`: 88.27% → **88.77%** fuzzy
- `lbBgFlash_80020E38`: 98.46% → **98.52%** fuzzy

## Files

- `src/melee/lb/lb_0192.c`
- `src/melee/lb/lbbgflash.c`

## Verification

- `python configure.py && ninja` → green (`build/GALE01/main.dol: OK`)
- All sibling functions in both TUs unchanged.
