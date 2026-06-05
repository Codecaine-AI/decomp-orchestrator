## PR #2509: lb: match fn_80026650 (100%), improve fn_800268B4 and lb_8000FD48
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2509

## Summary

- Match `fn_80026650` to 100% (lbaudio_ax.c) by using named externs `lbl_804338A4` / `lbl_80433984` directly instead of the `lbl_80433710` struct anchor.
- Improve `fn_800268B4` (lbaudio_ax.c): same named-extern swap plus pointer-increment loop form — 88.5% → 88.7% with the prologue now using `bdnz`/`mtctr` CTR-loop matching the expected layout.
- Refactor `lb_8000FD48` (lb_00F9.c) free-list pop into a `popDynamicsData` static inline mirroring the existing `inlineA0` pattern — 93.7% → 94.2%.

## Functions matched

- `fn_80026650`: 100% (78.6% baseline → match)
- `fn_800268B4`: 88.7% (was 88.5%)
- `lb_8000FD48`: 94.2% (was 93.7%)

## Files

- `src/melee/lb/lbaudio_ax.c`
- `src/melee/lb/lb_00F9.c`

## Verification

- `python configure.py && ninja` → green
- Each touched function rechecked individually with `tools/checkdiff.py` to confirm the recorded match%
