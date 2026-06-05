## PR #2498: lb: improve lbmemory matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2498

## Summary
- Adds structured lbmemory allocator fields and string references used by matched code.
- Decompiles the lbmemory relocation and init routines, bringing the TU to 10/12 matched functions.
- Cleans speculative comments in the TU while keeping only verified Handle field behavior.

## Verification
- python configure.py && ninja
- Pre-commit checks, including match regression checks

## Remaining
- lbMemory_80014FC8: 99.324326%
- lbMemory_80015320: 96.106800%

Both remaining functions have matching control-flow/size shape but still differ in saved-register allocation and instruction scheduling.
