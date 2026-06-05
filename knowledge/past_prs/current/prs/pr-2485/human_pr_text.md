## PR #2485: sobjlib: decompile SObj setup and render paths
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2485

## Summary
- Decompile HSD_SObjLib_803A477C at 100%
- Decompile HSD_SObjLib_803A55DC at 100%
- Add a near-match for HSD_SObjLib_803A4A68 at 99.88707%
- Add SObj descriptor/color typing used by the new implementations

## Verification
- pre-commit run --files src/sysdolphin/baselib/sobjlib.c src/sysdolphin/baselib/sobjlib.h
- python configure.py && ninja (passed in the dev worktree using wibo)
- ninja build/GALE01/src/sysdolphin/baselib/sobjlib.o
- objdiff: 803A477C 100%, 803A4A68 99.88707%, 803A55DC 100%; .data/.sdata2 100%

Note: a clean upstream-branch full rebuild locally hit the known Wine server crash path after rebuilding hundreds of objects; the changed object and the full dev-worktree build both pass.
