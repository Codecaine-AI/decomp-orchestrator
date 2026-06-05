## PR #2341: gr: decompile 7 stage functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2341

## Summary
- `grAnime_801C83D0` in granime.c
- `grRCruise_80200074` in grrcruise.c
- `grOldPupupu_80210A24` in groldpupupu.c
- `fn_801D7700`, `grKongo_801D7F78` in grkongo.c
- `grHomeRun_8021EDD4` in grhomerun.c
- `grCorneria_801DDDA8` in grcorneria.c

## What these functions do

**Stage animation checker** — `grAnime_801C83D0` checks whether a stage object's animation sequence has finished playing, used across stages to trigger state transitions like platform disappearance or hazard timing.

**Kongo Jungle barrel cannon** — `fn_801D7700` handles collision detection when fighters interact with Kongo Jungle's barrel cannon, while `grKongo_801D7F78` queries barrel cannon animation state to determine when it's ready to fire.

**Dream Land wind** — `grOldPupupu_80210A24` is a periodic update callback for one of Dream Land's interactive stage elements (Whispy Woods area).

**Rainbow Cruise platforms** — `grRCruise_80200074` initializes one of Rainbow Cruise's dynamic moving platforms or cloud objects at match start.

**Home-Run Contest setup** — `grHomeRun_8021EDD4` initializes stage object positions for the Home-Run Contest platform.

**Corneria Great Fox** — `grCorneria_801DDDA8` handles cleanup/exit logic for Corneria's Great Fox stage elements (Arwings, laser turrets).

## Verification
- All 7 functions 100% match (verified by overnight script)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
