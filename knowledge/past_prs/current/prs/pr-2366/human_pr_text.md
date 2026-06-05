## PR #2366: Fighter decompilation matches
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2366

## Summary
- 5 matched functions across 2 fighter files

## What these functions do

**ftKb_Init.c — `ftKb_SpecialN_800F19AC`** — Cleans up copy ability projectiles/resources when Kirby loses a stock, dispatching to the appropriate handler for whichever ability Kirby has.

**ftKb_Init.c — `ftKb_SpecialN_800F1A8C`** — Same cleanup as above but triggered when Kirby respawns on a revival platform.

**ftKb_Init.c — `ftKb_SpecialN_800F10D4`** — Loads Yoshi's copy-ability hat onto Kirby when Kirby first copies Yoshi's Neutral Special (Egg Lay).

**ft_0D31.c — `ftCo_DeadUpFall_Phys`** — Applies physics during the falling portion of a star KO, interpolating position during the arc and applying gravity during freefall.

**ft_0D31.c — `ftCo_800D5600`** — Transitions a fighter from the Rebirth invincibility platform to RebirthWait, resetting collision and setting up the respawn platform callback.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
