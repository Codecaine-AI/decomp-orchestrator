## PR #2578: Match several ft, pl, and if functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2578

Matches four functions across ftCo guard, plattack, and if_2FC93:

- `ftCo_80092158`
- `ftCo_80093790`
- `plAttack_8003759C`
- `un_802FE260`

Also improves `fn_802FDA78` in `if_2FC93` through the same file-local struct typing used for `un_802FE260`.

Verification:

- `python configure.py --require-protos`
- `ninja`
- GALE01 report shows the four listed functions at 100.0%.
