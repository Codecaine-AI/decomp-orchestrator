## PR #2580: Match and improve hsd_3AA7, quatlib, and ftCo functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2580

Matches and improves a batch of functions across `hsd_3AA7`, `quatlib`, and `ftCo_Shouldered`.

New 100% matches include:

- `ftCo_8009C744`
- `fn_803ACF30`
- `fn_803ADE4C`
- `fn_803B21E8`
- `fn_803B1F78`
- `hsd_803B2374`
- `fn_803AC168`

Also improves `MatToQuat` and several remaining `hsd_3AA7` functions by reshaping loop bounds, dispatcher/control-flow structure, builder write paths, and local value lifetimes.

Verification:

- `python configure.py --require-protos`
- `ninja`
- GALE01 report shows the listed functions at 100.0%.
