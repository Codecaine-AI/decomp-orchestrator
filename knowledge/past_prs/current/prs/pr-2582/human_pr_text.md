## PR #2582: Match and improve several source functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2582

## Summary

This batches a few independent source matching improvements:

- improve `grIceMt_801F9ACC` by tightening the Ice Mountain data/ID handling
- match `hsd_80398C04` in `particle.c`
- match `__THPRestartDefinition` in `THPDec.c`
- improve `ft_800895E0` by reusing the item GObj load shape
- improve `mnCount_8025092C` by reshaping the row comparison

## Verification

- `python configure.py --require-protos`
- `ninja build/GALE01/report.json`
- `ninja`
