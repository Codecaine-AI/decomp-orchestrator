## PR #2321: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2321

## Progress

**34** matched, **7** failed

### Matched
| File | Function | Status |
|------|----------|--------|
| `mnname.c` | `IsNameUnique` | ✓ 100% |
| `gm_16F1.c` | `fn_80170110` | ✓ 100% |
| `gricemt.c` | `grIceMt_801F91EC` | ✓ 100% |
| `toy.c` | `un_80305D00` | ✓ 100% |
| `toy.c` | `un_80307828` | ✓ 100% |
| `gm_1BA8.c` | `gm_801BEDA8` | ✓ 100% |
| `gmregclear.c` | `fn_8017F09C` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialNSpit_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialAirNSpit_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialNDrink0_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialNDrink1_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialHi_Enter` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialAirHi_Enter` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialN_800F5DE8` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialN_800F5EA8` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialNDrink_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialAirNDrink_Anim` | ✓ 100% |
| `ftKb_SpecialNNs.c` | `ftKb_PrSpecialAirNStart_Coll` | ✓ 100% |
| `ftKb_SpecialNNs.c` | `fn_80105978` | ✓ 100% |
| `ftKb_SpecialNNs.c` | `ftKb_PrSpecialN_Coll` | ✓ 100% |
| `grkongo.c` | `grKongo_801D8078` | ✓ 100% |
| `grrcruise.c` | `grRCruise_80200B48` | ✓ 100% |
| `ittincle.c` | `it_802EB5C8` | ✓ 100% |
| `itcrazyhandbomb.c` | `it_802F0F6C` | ✓ 100% |
| `itkyasarin.c` | `itKyasarin_UnkMotion2_Coll` | ✓ 100% |
| `soundtest.c` | `un_802FFCD0` | ✓ 100% |
| `ftPp_SpecialS.c` | `fn_80122B54` | ✓ 100% |
| `grhomerun.c` | `grHomeRun_8021EA30` | ✓ 100% |
| `gryorster.c` | `grYorster_80202428` | ✓ 100% |
| `itclimbersice.c` | `itClimbersice_UnkMotion2_Phys` | ✓ 100% |
| `itclimbersice.c` | `itClimbersice_UnkMotion2_Coll` | ✓ 100% |
| `gm_1601.c` | `fn_80168A6C` | ✓ 100% |
| `gmregclear.c` | `fn_8017FE54` | ✓ 100% |
| `ftKb_SpecialN.c` | `fn_800F98F4` | ✓ 100% |

### Failed
- `grPura_80212FC0` — best 96.4%
- `grOnett_801E5194` — best 78.1%
- `pl_80038628` — best 55.6%
- `fn_8021E994` — best 97.4%
- `grCastle_801CE19C` — best 91.8%
- `InitNameEntryUIState` — best 37.3%
- `grOnett_801E40E4` — best 96.1%

## What these functions do
**mnname.c** — Name tag management menu — checks whether a name tag already exists in the save data by comparing against all valid name entries, used to prevent duplicate name tags.

**gm_16F1.c** — Post-match player bonus decision system — looks up a bonus type in the decision table and awards it to the appropriate player, routing between player-specific and game-wide bonus handlers based on the bonus category.

**gricemt.c** — Icicle Mountain stage — initializes joint animation and collision callbacks when setting up stage platform segments, storing their joint indices for tracking.

**toy.c** — ** Decompiled functions in `src/melee/ty/toy.c` — trophy module controller input reader and camera reset.

**gm_1BA8.c** — VS Mode character select screen — cycles the match type (Melee, Tournament, Special Melee variants, etc.) forward or backward when navigating the CSS mode selector, then updates the global match configuration.

**gmregclear.c** — Regular match clear mode — calculates a time-based bonus score, gated by match rules (timer direction, match type flags) and score multiplier settings.

**gmregclear.c** — Regular Clear mode (single-player results screen) — updates the screen capture texture and fades in an overlay opacity based on elapsed time.

**ftKb_SpecialN.c** — Kirby's Neutral-B (Inhale) — handles the spit animation (spitting out a swallowed fighter), the drink animation (swallowing an item), and the Up-B (Final Cutter) initial rising slash startup.

**ftKb_SpecialN.c** — ftKb_SpecialAirHi_Enter is identical to ftKb_SpecialHi_Enter (the ground version stub above it at line 169) but uses ftKb_MS_SpecialAirHi1 (389) and GA_Air. ftKb_SpecialN_800F5DE8 pulls an item toward Kirby's inhale position and swallows it when close enough (uses it_802F23AC for item distance, f64 return). ftKb_SpecialN_800F5EA8 is the same pattern but for inhaling a fighter victim (uses ftCo_800BD19C, f32 return). ftKb_SpecialNDrink_Anim and ftKb_SpecialAirNDrink_Anim have a MWCC register allocation issue — the compiler generates extra `mr` instructions when loading both `fp` and `fp->victim_gobj` into callee-saved registers via GET_FIGHTER; getFighter() fixes fp's allocation but not victim_gobj's. Both need 4 callee-saved regs (r28-r31).

**ftKb_SpecialN.c** — Kirby's copied Luigi neutral special — spawns the Luigi fireball projectile and its visual effect from Kirby's left hand when the animation triggers during the attack.

**ftKb_SpecialNNs.c** — Kirby's copied Jigglypuff Rollout — handles air-to-ground and ground collision transitions during the rolling attack, plus a turnaround helper that flips velocity and rotation when Kirby reverses direction mid-roll.

**grkongo.c** — Kongo Jungle stage — searches for a nearby barrel cannon item within a configurable radius of the stage's blast zone position.

**grrcruise.c** — Rainbow Cruise stage — initializes the 17 collision tracking entries for the scrolling platforms, storing each platform's joint ID and initial Y position.

**ittincle.c** — Tingle assist trophy in Melee — initializes the balloon state when Tingle begins floating, computing the height offset from his bone position and saving the current collision box for later reference.

**itcrazyhandbomb.c** — Crazy Hand's bomb projectile — spawns the bomb item when Crazy Hand performs its bomb-throwing attack in single-player modes.

**itkyasarin.c** — Chansey (Kyasarin) Poke Ball Pokemon — checks if Chansey has reached its left/right boundary while walking in reverse, transitioning to a waiting state before turning around.

**soundtest.c** — Sound test menu — fills an array of entries with a default value, used when initializing or resetting the sound test selection list.

**ftPp_SpecialS.c** — Ice Climbers' Blizzard (down-B) — handles the landing transition when the air version of the move contacts the ground, switching to the grounded animation state and adjusting the character's rotation to match the floor angle.

**grhomerun.c** — Home Run Contest — calculates the sandbag's travel distance and converts it between feet and meters depending on the game's language setting before displaying the result on the scoreboard.

**gryorster.c** — Yoshi's Story stage — when a Shy Guy carrying food is touched by a fighter, accumulates the food value on the corresponding track element and applies a damage/heal effect based on stage parameters.

**itclimbersice.c** — Ice Climbers' ice block projectile (Blizzard side-B) — applies scaled hitbox damage based on the projectile's horizontal velocity during its active collision phase.

**itclimbersice.c** — Ice Climbers' ice projectile (Blizzard special move) — handles ground collision during the sliding phase, checking if the ice chunk has slowed enough to stick or should be destroyed.

**gm_1601.c** — Game match configuration — copies model/animation descriptor data from a source table entry into a zeroed output buffer, used when setting up character display models in menus or results screens.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2321: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2321#issuecomment-4090536392

Replaced by #2322, #2323, #2324, #2325
