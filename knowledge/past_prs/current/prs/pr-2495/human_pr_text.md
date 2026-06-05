## PR #2495: lb: improve lbsnap matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2495

Improves `src/melee/lb/lbsnap.c` by replacing several placeholder signatures and lowering the remaining unmatched surface in `lbsnap` to two functions.

Verification:
- `python configure.py && ninja`
- `main/melee/lb/lbsnap`: 20/22 functions at 100%

Remaining blockers:
- `lbSnap_8001DA5C`: 55.87963%
- `lbSnap_8001DF20`: 98.15790% (register allocation only)
