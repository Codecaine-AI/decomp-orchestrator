## PR #2505: lb: improve lb_00CE matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2505

## Summary
- match `powi` with a natural exponent loop
- improve `lb_8000D148` from 86.3% to 98.9% fuzzy match while preserving the correct stack frame shape

## Verification
- `python tools/checkdiff.py powi` -> match
- `python tools/checkdiff.py lb_8000D148 --format json` -> 98.85714% fuzzy match
- `python configure.py --wrapper wine && ninja` -> `build/GALE01/main.dol: OK`
