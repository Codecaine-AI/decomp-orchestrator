## PR #2497: lb: improve lbheap matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2497

## Summary
- improves lbHeap_80015900 from 94.3% to 96.5%
- keeps the rest of lbheap matched, including lbHeap_80015F3C at 100%
- fixes the heap bounds scan to cover heaps 2-5 and factors repeated heap create/destroy setup through local helpers

## Verification
- ninja
- python tools/checkdiff.py lbHeap_80015900
- python tools/checkdiff.py lbHeap_80015F3C
