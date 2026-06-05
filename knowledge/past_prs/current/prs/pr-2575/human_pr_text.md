## PR #2575: Match and improve several functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2575

Matches six functions and improves several remaining partial matches across cm, ft, gm, gr, if, mn, and ty.

Matches:
- `Camera_80030E44`
- `ftAction_80073008`
- `fn_8017A9B4`
- `un_80318B1C`
- `ftNn_Init_80123954`
- `gm_801A9DD0`

Additional improvements:
- `mn_8022FB88`
- `grInishie2_801FD9EC`
- `un_803147C4`
- `un_80303FD4`
- `un_802FF570`
- `gmCamera_801A292C`
- `ftKb_SpecialN_800EED50`
- `fn_802FA6C4`
- `ft_800852B0`
- `fn_80175A94`

Verification:
- `python configure.py --require-protos`
- `ninja`
- GALE01 report shows the six listed matches at 100.0%, with the listed partial functions improved from upstream.
