## PR #2569: Match synth and Ice Mountain functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2569

Matches `HSD_Synth_80388DC8` and three Ice Mountain functions in `gricemt.c`.

Details:
- Removes the obsolete residual-match note on `HSD_Synth_80388DC8` and tightens `HSD_Synth_8038B120` to its existing `void (void)` definition.
- Brings `grIceMt_801F96E0`, `grIceMt_801F993C`, and `grIceMt_801FA0BC` to 100% using small source-shape helpers around the existing Ice Mountain code.

Verification:
- `python configure.py --require-protos`
- `ninja`
- GALE01 report: `HSD_Synth_80388DC8`, `grIceMt_801F96E0`, `grIceMt_801F993C`, and `grIceMt_801FA0BC` at 100.0%
