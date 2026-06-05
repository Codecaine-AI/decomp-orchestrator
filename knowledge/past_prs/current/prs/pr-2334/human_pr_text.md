## PR #2334: ft/ftCommon: match fn_800DC070
Author: Pizzahutt
URL: https://github.com/doldecomp/melee/pull/2334

## Summary

- `fn_800DC070` — CaptureJump enter function in `ftCo_Attack100.c`

## What this function does

**CaptureJump enter** — Called when a buried fighter escapes from the burier's grab. The function:
1. Reads the victim (the escaping fighter) from `fp->victim_gobj`
2. Calls `ftCommon_8007D5D4` to reset common state
3. Sets the attacker's horizontal velocity to `-facing_dir * p_ftCommonData->x374` (launches them backward) and vertical velocity to `p_ftCommonData->x378`
4. Resets the `buryjump` counter to `0.0F`
5. Calls `ftCo_800DC920` to release/react the victim
6. Transitions the attacker into the `CaptureJump` motion state (0xE6) with `Fighter_ChangeMotionState`

## Verification

- `fuzzy_match_percent: 100.0`.0`

🤖 Assisted by [GitHub Copilot](https://github.com/features/copilot)
