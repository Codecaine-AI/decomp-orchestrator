## PR #2507: lb: improve fn_80027488 matching, tidy a few header signatures
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2507

## Summary

- `fn_80027488` in `lbaudio_ax.c`: replaces `lbl_80433710.x194` / `.x274` struct-field accesses with direct references to the standalone extern arrays `lbl_804338A4` and `lbl_80433984` (which live at exactly those addresses per `symbols.txt`), and declares `b` before `a` so MWCC materializes the addresses in the order the original expects.
- Also tidies a few unrelated lb headers, replacing `UNK_RET` / `UNK_PARAMS` placeholders with the actual `void` signatures the `.c` files already use. Compile-time no-op (those macros already expand to `void`), but makes the headers honest about the ABI.

## Functions matched

No 100% matches. `fn_80027488` improves **89.55% → 94.86%** fuzzy. The remaining mismatch is one extra prologue instruction from MWCC's register cascade choice — `lis r3/lis r3` for the two HA halves vs `lis r4/lis r3` in the original.

## Files

- `src/melee/lb/lbaudio_ax.c`
- `src/melee/lb/lb_00F9.h`
- `src/melee/lb/lb_0192.h`
- `src/melee/lb/lbcardgame.h`

## Verification

- `python configure.py && ninja` → green (`build/GALE01/main.dol: OK`)
- No other functions in `lbaudio_ax.c` regressed.
