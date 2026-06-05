## PR #2326: Match 13 misc functions (gr, it, ft, gm, if)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2326

## Summary
- `grRCruise_80200B48` in grrcruise.c
- `it_802EB5C8` in ittincle.c
- `it_802F0F6C` in itcrazyhandbomb.c
- `itKyasarin_UnkMotion2_Coll` in itkyasarin.c
- `un_802FFCD0` in soundtest.c
- `fn_80122B54` in ftPp_SpecialS.c
- `grHomeRun_8021EA30` in grhomerun.c
- `grYorster_80202428` in gryorster.c
- `itClimbersice_UnkMotion2_Phys`, `itClimbersice_UnkMotion2_Coll` in itclimbersice.c
- `fn_80168A6C` in gm_1601.c
- `fn_8017FE54` in gmregclear.c
- `fn_800F98F4` in ftKb_SpecialN.c

Also adds a `dont_inline` pragma to `un_802FFCD0` to prevent MWCC from inlining it into its callers.

## What these functions do

**Rainbow Cruise** — Initializes all 17 moving platform sections at stage load: looks up each platform's collision ID, grabs its joint transform, and records its starting Y position so the stage can track and animate them later.

**Tingle** — Resets Tingle's state at the start of a motion and calculates how high his balloon is floating above him by measuring the distance from his balloon bone to his feet, used to keep the balloon tethered correctly.

**Crazy Hand bombs** — Spawns a bomb projectile at a given world position, assigns it to the owning fighter, and links it so the game knows who to credit for a hit.

**Chansey (Poké Ball)** — During Chansey's rolling patrol, checks whether she's reached the edge of her territory. If so, switches her into her turn-around animation and resets her movement timer.

**Sound test screen** — Fills a section of an array with a repeated value, used to reset or initialize the sound entry list when navigating the Sound Test menu.

**Ice Climbers — Blizzard landing** — When Ice Climbers touches down while using Blizzard (down-B), transitions to the grounded version of the move and tilts the character's feet to match the slope of the floor.

**Home-Run Contest** — Calculates how far the Sandbag traveled from its launch position. Converts the game-unit distance to meters (or feet for US), and stores the final distance for the results screen.

**Yoshi's Island clouds** — When a fighter stands on one of Yoshi's Island's cloud platforms, applies their weight to the cloud's sag amount and transfers the fighter's floating state to the cloud.

**Ice Climbers' ice block** — Physics handler updates the block's hitbox damage based on its current speed (faster block = more damage). Collision handler deflects the block when it hits a surface, reversing its velocity if needed.

**CSS data copy** — Copies a slot's data record into a flat output buffer, used when reading character select screen state for display or saving.

**Game clear grade display** — On the post-clear results screen, kicks off the grade reveal animation and computes the visual fill amount (0–1) for the grade bar based on the player's clear time and a stored multiplier.

**Kirby with Luigi copy — fireball** — Each frame during Kirby's Luigi-copy neutral special, checks whether it's time to fire. If so, spawns a Luigi Fireball item at Kirby's left hand and plays the fire muzzle effect.

## Verification
- All functions 100% match via objdiff
