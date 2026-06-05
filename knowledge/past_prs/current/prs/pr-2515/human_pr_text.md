## PR #2515: lb: improve lbcollision capsule-collision matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2515

Match work on `lbcollision.c`. Named some fields I was pretty confident about, but will likely still need some work as the big ones get closer to 100%

## New 100% matches

| Function | Before | After |
|---|---|---|
| `lbColl_8000A244` | 99.9% | 100% |
| `lbColl_8000A78C` | 99.9% | 100% |
| `lbColl_8000A95C` | 99.9% | 100% |
| `lbColl_8000AB2C` | 99.9% | 100% |

## Improved (still <100%)

| Function | Before | After |
|---|---|---|
| `lbColl_80006094` | 78.7% | 91.4% |
| `lbColl_800067F8` | 78.7% | 89.4% |
| `lbColl_80006E58` | 81.0% | 95.4% |
| `lbColl_8000A584` | 99.7% | 99.8% |

## Code changes

> - `lbColl_80006E58`: name parameters by role (`hit_start`/`hit_end`, `hurt_start`/`hurt_end`, `hit_closest`/`hurt_closest`, `hurt_mtx`, `out_contact_pos`, `out_overlap`, `hit_radius`/`hurt_radius`, `broadphase_scale`).
> - Drop `lbColl_JObjGetMtxPtr` and its two `lbColl_804D37*` assert strings; no longer referenced.
> - Collapse `float xx_x/_y/_z` triplets into `Vec3 xx` in `lbColl_80005C44` and the parallel-axes branches of > `lbColl_80006E58`.
> - Fold `hit_param = (hit_param_candidate = ...)` into an assignment expression in the closest-points solve.
> - Cache `1.0` in a callee-save float to avoid reloading it across `*_param = 1.0` branches in `lbColl_80006E58`.
> The three remaining sub-100% functions still have residual float-register-allocation mismatches.

## PR #2515: lb: improve lbcollision capsule-collision matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2515#issuecomment-4491500413

my b - opened this prematurely

## PR #2515: lb: improve lbcollision capsule-collision matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2515#issuecomment-4492065244

will fix the regressions

## PR #2515: lb: improve lbcollision capsule-collision matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2515#issuecomment-4492147028

editor config failed due to network error of some sort trying to download nix packages - I can't re-run them myself it seems
