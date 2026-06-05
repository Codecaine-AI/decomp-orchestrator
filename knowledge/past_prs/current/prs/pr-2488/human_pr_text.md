## PR #2488: sysdolphin: split hsd_3B34 JPEG routines
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2488

## Summary
- split the hsd_3B34 range into hsd_3B34 and hsd_3B5C translation units
- add nonmatching C for the JPEG encode/decode routines in both TUs
- keep hsd_803B5C2C matching at 100% and improve the surrounding fuzzy matches

## TU split rationale
The split at hsd_803B5C4C looked like a natural TU boundary rather than just an arbitrary function boundary. The original combined range had clean adjacent extab/extabindex cut points there, and the data sections also separated cleanly: hsd_3B34 owns the first static JPEG table cluster through lbl_80430C40 / .sdata2 804DEB90, while hsd_3B5C begins with a separate large table at lbl_80431090 and its own .sdata2 constants.

hsd_803B5C2C also behaved like a small end-of-first-cluster routine and matched 100% immediately before hsd_803B5C4C starts the decode-side helper cluster. That combination made the split a plausible TU boundary, and the rebuilt sections/link check corroborate it.

## Match status
- hsd_3B34: 84.855255% fuzzy
- hsd_3B5C: 84.95146% fuzzy

## Verification
- pre-commit run --files src/sysdolphin/baselib/hsd_3B34.c src/sysdolphin/baselib/hsd_3B34.h src/sysdolphin/baselib/hsd_3B5C.c
- python configure.py --wrapper build/tools/wibo && ninja
