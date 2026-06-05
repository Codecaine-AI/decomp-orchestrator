## PR #2568: plbonuslib: match fn_8003F654 & link plbonuslib.c
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2568

Matches `fn_8003F654` in `plbonuslib.c` and marks the translation unit as matching.

The helper uses local double constants so the function codegen matches without adding extra `.sdata2` local statics. The unused `MSL/math_ppc.h` include is removed so the generated `.sdata2` layout matches the target object.

Verification:
- `python configure.py --require-protos`
- `ninja`
- `fn_8003F654`: 100.0%
- `plbonuslib.c`: `.text`, `.data`, and `.sdata2` all 100.0%
