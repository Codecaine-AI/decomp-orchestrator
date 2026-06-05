## PR #2503: lb: improve lbcollision matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2503

## Summary
- Match `lbColl_80005C44` and `lbColl_80009DD4`
- Restore/improve `lbColl_8000A78C` and nearby collision/debug draw helpers
- Fix `lbColl_80006E58` so collision distance is written through the explicit output parameter
- Update stale `lbcollision.h` prototypes for matched helpers

## Verification
- `python configure.py && ninja`
- pre-commit checks during commit

## Remaining work
- `lbColl_80006094`, `lbColl_800067F8`, and `lbColl_80006E58` still have structural stack/FPR drift
- `lbColl_800077A0` is blocked on a small sqrt spill/register difference
- `lbColl_8000A244`, `lbColl_8000A584`, `lbColl_8000A78C`, `lbColl_8000A95C`, and `lbColl_8000AB2C` still share a by-value `Vec3` temporary layout mismatch
