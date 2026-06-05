## PR #2343: ft/ftKirby: decompile 7 Kirby special N functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2343

## Summary
- `ftKb_SpecialNDrink0_Anim`, `ftKb_SpecialNDrink1_Anim`, `ftKb_SpecialAirNDrink_Anim` in ftKb_SpecialN.c
- `ftKb_SpecialNMt_80107568`, `ftKb_SkSpecialNLoop_IASA`, `ftKb_SkSpecialAirNLoop_IASA` in ftKb_SpecialNZd.c
- `ftKb_SpecialN_800EF35C` in ftKb_Init.c
- `ftKb_PrSpecialAirNStart_Anim` in ftKb_SpecialNNs.c

## What these functions do

**Inhale swallowing animation** — `ftKb_SpecialNDrink0_Anim`, `Drink1_Anim`, and `SpecialAirNDrink_Anim` animate Kirby swallowing a captured opponent on the ground and in the air. On completion they transition to the "eat wait" (ground) or "eat fall" (air) states where Kirby holds the opponent in his stomach.

**Copied Sheik neutral B input** — `ftKb_SkSpecialNLoop_IASA` and `ftKb_SkSpecialAirNLoop_IASA` handle input checks during Kirby's copied Sheik Needle Storm loop. If B is released, Kirby fires the needles and transitions to the end state; if a shoulder button is pressed, the move is cancelled.

**Copied Mewtwo neutral B** — `ftKb_SpecialNMt_80107568` enters Kirby's copied Mewtwo Shadow Ball charge, initializing the motion state and charge variables.

**Hat model loading** — `ftKb_SpecialN_800EF35C` is part of the pipeline that loads the 3D hat model onto Kirby's head after copying a character's ability.

**Copied Jigglypuff neutral B** — `ftKb_PrSpecialAirNStart_Anim` handles the aerial startup animation for Kirby's copied Jigglypuff Rollout.

## Verification
- All 7 functions 100% match (verified by overnight script)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
