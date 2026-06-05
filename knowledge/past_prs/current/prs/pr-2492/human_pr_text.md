## PR #2492: ft: improve Crazy Hand init command dispatch
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2492

Improves `ftCh_Init_80156AD8` in Crazy Hand init by fixing the human command dispatcher button mapping, caching the L-button check in the same style as the matched Master Hand dispatcher, and naming the zero/two float constants used by the Vec3 setup and random range math.

Verification:
- `python tools/checkdiff.py ftCh_Init_80156AD8 --no-tty --format json` -> 98.99317%
- `python configure.py && ninja` -> OK

Known remaining drift: `ftCh_Init_80156AD8` is still not a byte match; the remaining diff is isolated to the full pad-word register allocation (`r0` target vs `r5` current) and derived mask temp registers.

## PR #2492: ft: improve Crazy Hand init command dispatch
Author: jellejurre
URL: https://github.com/doldecomp/melee/pull/2492#issuecomment-4526148410

Already done by me
