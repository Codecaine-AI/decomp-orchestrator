## PR #2496: lb: improve lbcardnew snapshot listing
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2496

Improves `lb_8001B14C` by keeping snapshot-entry writes as direct `lb_80432A68.snapshot_entries` accesses, matching the target code shape much more closely.

Verification:
- `python configure.py && ninja`
- `main/melee/lb/lbcardnew`: 40/41 functions at 100%

Remaining blocker:
- `lb_8001B14C`: 98.77124% (remaining diff is a `r5`/`r6` allocation swap in the compiler-unrolled linked-list copy loop)
