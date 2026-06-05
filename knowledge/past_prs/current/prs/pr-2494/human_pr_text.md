## PR #2494: gr: improve grzebesroute lighting
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2494

Improves `grzebesroute` by naming the route light data, direct string/data references, and translating the stage light setup routine.

Verification:
- `python configure.py && ninja`
- `python tools/checkdiff.py grZebesRoute_8020B548 --no-tty --format json` -> 99.96923%

Known remaining drift: `grZebesRoute_8020B548` still differs in the three `GXColor` by-value stack temp offsets (`8/12/16` vs target `20/24/28`). The surrounding control flow and `Vec3` stack slots are aligned.
