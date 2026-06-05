## PR #2499: lb: improve lbarq matching
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2499

## Summary
- add concrete lbArq state/list types and replace the opaque global padding with the 10-node pool
- keep lbArq_80014ABC out-of-line and improve lbArq_80014BD0 stack/codegen
- name the verified ARQ node states used by lbarq

## Matching
- lbArq_80014ABC: 100%
- lbArq_80014D2C: 100%
- lbArq_80014AC4: 96.9403% (remaining drift is one first-list address calculation order)
- lbArq_80014BD0: 96.55173% (remaining drift is saved-register allocation plus one extra move around the free-list head)

## Verification
- python tools/checkdiff.py lbArq_80014ABC --format json
- python tools/checkdiff.py lbArq_80014AC4 --format json
- python tools/checkdiff.py lbArq_80014BD0 --format json
- python tools/checkdiff.py lbArq_80014D2C --format json
- python configure.py && ninja
