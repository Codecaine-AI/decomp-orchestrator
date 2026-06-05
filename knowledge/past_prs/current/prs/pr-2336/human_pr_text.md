## PR #2336: match fn_800D7C60, fn_800D81D0
Author: Pizzahutt
URL: https://github.com/doldecomp/melee/pull/2336

Matches two air scope item enter functions in `ftCo_Attack100.c`:

- `fn_800D7C60` (140 bytes): air scope rapid enter — air version of `fn_800D7BDC`
- `fn_800D81D0` (152 bytes): air scope fire enter — air version of `fn_800D8140`

Both functions follow the same pattern as their ground counterparts and call `ftCommon_ClampAirDrift` after `Fighter_ChangeMotionState`.
