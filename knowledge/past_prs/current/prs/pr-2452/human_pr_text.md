## PR #2452: Match Yoshi SpecialHi functions
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2452

## Summary

This matches the two remaining functions in `main/melee/ft/chara/ftYoshi/ftYs_SpecialHi`:

| Function | Previous | New |
| --- | ---: | ---: |
| `ftYs_SpecialS_8012DF8C` | 97.22% | 100.00% |
| `fn_8012E110` | 94.02% | 100.00% |

The full translation unit is now 100% matched: 14/14 functions and 1836/1836 code bytes.

## Notes

`ftYs_SpecialS_8012DF8C` was very close, but the clamp around the stick-derived magnitude had the wrong source shape. The old `MAX(temp, 1.0f)` expression did not match the target control flow. Writing the cap explicitly as `if (mag > 1.0f) { mag = 1.0f; }` gives the target branch shape and preserves the intended cap-at-one behavior.

`fn_8012E110` had two remaining codegen issues. The egg throw frame counter was being converted to float twice for the `it_802B28C8` call, while the target converts it once and reuses that value. Introducing a scoped `x4` temporary matches that behavior. The function also had an extra `PAD_STACK(4)` before the first `Vec3`, which moved that stack slot from the target `r1+0x30` to `r1+0x34`; removing it restored the target stack layout.

## Verification

- `ninja progress`
  - `build/GALE01/main.dol: OK`
  - `ftYs_SpecialHi`: 100.0%, 14/14 functions, 1836/1836 code bytes
- `git diff --check`
- `DYLD_LIBRARY_PATH=/Library/Developer/CommandLineTools/usr/lib cargo run -p melee-issues`
  - reports 117 existing issues outside the touched file
