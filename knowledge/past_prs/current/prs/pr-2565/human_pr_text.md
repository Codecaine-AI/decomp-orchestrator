## PR #2565: plbonuslib: match fn_8003F294
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2565

Matches `fn_8003F294` in `plbonuslib.c`

Verification:
- `python configure.py --require-protos`
- `ninja build/GALE01/src/melee/pl/plbonuslib.o`
- `ninja`
- `fn_8003F294`: 680 bytes, 100.0% in the local objdiff report
