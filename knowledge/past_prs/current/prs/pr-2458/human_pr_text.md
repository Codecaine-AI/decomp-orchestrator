## PR #2458: Improve Pikachu Thunder spawn match
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2458

## Summary

Small matching improvement for `it_802B1DF8` in `itpikachuthunder.c`.

This only adjusts local variable lifetimes/order in the Pikachu Thunder spawn function. No behavior change is intended.

## Matching

`main/melee/it/items/itpikachuthunder`

- `.text`: 99.36059% -> 99.54926%
- `it_802B1DF8`: 97.5% -> 98.27586%
- function size remains 464/464 bytes

## Verification

- `ninja build/GALE01/src/melee/it/items/itpikachuthunder.o`
- `objdiff-cli diff -p . -u main/melee/it/items/itpikachuthunder`
