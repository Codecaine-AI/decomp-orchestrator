## PR #2459: Match lbHeap report function
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2459

## Summary

Matches `lbHeap_80015DF8`.

The original code passes `p->size` as an extra argument to the final `OSReport` call. The format string only consumes the divided KB value, but keeping the extra vararg matches the target codegen.

## Matching

`main/melee/lb/lbheap`

- `lbHeap_80015DF8`: 99.87654% -> 100.0%
- Function size remains 324/324 bytes

## Verification

- `ninja build/GALE01/src/melee/lb/lbheap.o`
- `objdiff-cli diff -p . -u main/melee/lb/lbheap`
- `DYLD_LIBRARY_PATH=/Library/Developer/CommandLineTools/usr/lib cargo run -p melee-issues`

`melee-issues` reports 117 existing issues elsewhere; none are from `src/melee/lb/lbheap.c`.
