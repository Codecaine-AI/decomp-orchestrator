## PR #2344: Decompile 9 fighter, library, game, and menu functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2344

## Summary
- `ftCo_800C0134` in ftcolanim.c
- `fn_800DA1D8` in ftCo_Attack100.c
- `ftCh_Damage2_Anim` in ftCh_Init.c
- `ftPp_SpecialAirHiThrow_0_Anim` in ftPp_SpecialS.c
- `pl_80037DF4` in pltrick.c
- `fn_8017F1B8` in gmregclear.c
- `mnName_80238A04` in mnname.c
- `fn_8001F06C` in lbmthp.c
- `un_80307828` in toy.c

## What these functions do

**Fighter animation reset** — `ftCo_800C0134` resets collision animation state and fires character-specific motion state callbacks when animation frames finish.

**Grab setup** — `fn_800DA1D8` initializes the CatchWait state when a fighter successfully grabs an opponent, setting damage callbacks and spawning the grab effect.

**Crazy Hand damage recovery** — `ftCh_Damage2_Anim` handles Crazy Hand's second damage animation: if knocked offscreen right, transitions to knockback recovery; otherwise repositions and plays a damage sound.

**Ice Climbers aerial throw** — `ftPp_SpecialAirHiThrow_0_Anim` handles Popo's aerial up-special throw animation, applying knockback on completion and checking if Nana is available for a partner follow-up.

**Attack stat tracking** — `pl_80037DF4` increments player performance counters: total attacks, attacks by type, thrown items, aerial attacks, and special moves.

**Game event dispatch** — `fn_8017F1B8` processes registered game events across all 256 event slots, checking input masks and triggering event handlers when conditions are met.

**Name entry menu animation** — `mnName_80238A04` updates highlight/confirm animations for character name slots in the name entry screen.

**THP video decoder** — `fn_8001F06C` is an interrupt handler that advances THP video playback frame counters and updates decompression state for FMV sequences.

**Trophy viewer reset** — `un_80307828` resets camera position and lighting arrays in the trophy viewer, with full or partial reset depending on context.

## Verification
- All 9 functions 100% match (verified by overnight script)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
