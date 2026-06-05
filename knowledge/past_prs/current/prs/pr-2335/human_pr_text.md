## PR #2335: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2335

## Progress

**32** matched, **11** failed, **1** in progress

### In progress
| File | Function | Status |
|------|----------|--------|
| `grshrineroute.c` | `grShrineRoute_8020AC44` | ⏳ pending |

### Matched
| File | Function | Status |
|------|----------|--------|
| `ftKb_SpecialN.c` | `ftKb_SpecialNDrink0_Anim` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialNDrink1_Anim` | ✓ 100% |
| `toy.c` | `un_80307828` | ✓ 100% |
| `ftKb_SpecialN.c` | `ftKb_SpecialAirNDrink_Anim` | ✓ 100% |
| `ftcolanim.c` | `ftCo_800C0134` | ✓ 100% |
| `lbmthp.c` | `fn_8001F06C` | ✓ 100% |
| `itoldkuri.c` | `itOldkuri_UnkMotion2_Phys` | ✓ 100% |
| `ftKb_SpecialNZd.c` | `ftKb_SpecialNMt_80107568` | ✓ 100% |
| `ftCh_Init.c` | `ftCh_Damage2_Anim` | ✓ 100% |
| `granime.c` | `grAnime_801C83D0` | ✓ 100% |
| `ftPp_SpecialS.c` | `ftPp_SpecialAirHiThrow_0_Anim` | ✓ 100% |
| `pltrick.c` | `pl_80037DF4` | ✓ 100% |
| `grrcruise.c` | `grRCruise_80200074` | ✓ 100% |
| `itkamex.c` | `itKamex_UnkMotion1_Anim` | ✓ 100% |
| `itpikachuthunder.c` | `itPikachuthunder_UnkMotion1_Coll` | ✓ 100% |
| `itlugia.c` | `it_802D1E8C` | ✓ 100% |
| `itkirbycutterbeam.c` | `it_8029BAB8` | ✓ 100% |
| `ftKb_Init.c` | `ftKb_SpecialN_800F10D4` | ✓ 100% |
| `ftCo_Attack100.c` | `fn_800DA1D8` | ✓ 100% |
| `groldpupupu.c` | `grOldPupupu_80210A24` | ✓ 100% |
| `mnname.c` | `mnName_80238A04` | ✓ 100% |
| `lbmthp.c` | `fn_8001EB14` | ✓ 100% |
| `gmregclear.c` | `fn_8017F1B8` | ✓ 100% |
| `ftKb_Init.c` | `ftKb_SpecialN_800EF35C` | ✓ 100% |
| `ftKb_SpecialNZd.c` | `ftKb_SkSpecialNLoop_IASA` | ✓ 100% |
| `ftKb_SpecialNZd.c` | `ftKb_SkSpecialAirNLoop_IASA` | ✓ 100% |
| `ftKb_SpecialNNs.c` | `ftKb_PrSpecialAirNStart_Anim` | ✓ 100% |
| `grkongo.c` | `fn_801D7700` | ✓ 100% |
| `grkongo.c` | `grKongo_801D7F78` | ✓ 100% |
| `grhomerun.c` | `grHomeRun_8021EDD4` | ✓ 100% |
| `grrcruise.c` | `fn_80200460` | ✓ 100% |
| `grcorneria.c` | `grCorneria_801DDDA8` | ✓ 100% |

### Failed
- `grPura_80212FC0` — failed 3x
- `grOnett_801E5194` — best 78.1%
- `pl_80038628` — best 55.6%
- `fn_8021E994` — best 97.4%
- `grCastle_801CE19C` — best 91.8%
- `InitNameEntryUIState` — best 37.3%
- `grOnett_801E40E4` — best 96.1%
- `grAnime_801C84A4` — best %
- `gm_801BAC9C` — best %
- `ftKb_SpecialN_800F11F0` — best ?%
- `mn_80230198` — best 28.1%

## What these functions do
**toy.c** — Trophy viewer — resets the camera interest point and zoom distance when switching between gallery views or initializing the trophy display mode.

**ftcolanim.c** — Fighter color overlay system — resets the secondary color overlay (x488) and reapplies the hammer glow effect if the fighter is holding a hammer item.

**lbmthp.c** — THP video playback — advances the frame read pointer during movie decoding, handling looping and buffer wrapping for FMV cutscenes.

**lbmthp.c** — THP movie player — initializes a THP video file for playback by reading its header, extracting width/height/format info, and checking for unsupported features like frame offsets or too many video components.

**itoldkuri.c** — Goomba (Oldkuri) enemy on Mushroom Kingdom — handles physics while walking left, checking for wall collisions to reverse direction and applying ground slope alignment.

**ftKb_SpecialNZd.c** — ftKb_SpecialNMt_80107568 is Kirby's copied Mewtwo neutral special (Shadow Ball) ground start transition. It calls Fighter_ChangeMotionState, clears cmd_vars, calls ftCommon_8007D7FC, sets velocity, sets death/damage callbacks via GET_FIGHTER reload, stores motion variables, conditionally loads a timer from dat_attrs, and calls ftAnim_8006EBA4.

**ftKb_SpecialNZd.c** — Kirby's copied Sheik needle storm — handles the looping charge state where releasing B fires needles and pressing L/R cancels the charge.

**ftKb_SpecialNZd.c** — Kirby's copied Sheik Needle Storm (neutral special) — handles input during the aerial needle charging loop, releasing B ends the charge and fires needles, pressing a trigger cancels.

**ftCh_Init.c** — Crazy Hand's second damage reaction — when the animation finishes, Crazy Hand either transitions to its sweep attack if it has drifted past the stage edge, or resets back to its first damage state to continue recoiling.

**granime.c** — Stage animation system — checks whether a stage element's animation has a specific flag set (e.g., whether a looping animation has completed a cycle).

**ftPp_SpecialS.c** — Ice Climbers' aerial up-special throw (Belay) — handles the animation callback when Popo is airborne during the throw, transitioning to fall special when the animation ends and coordinating with Nana.

**pltrick.c** — Player attack statistics tracking — records hit counts by attack type (aerials, specials, thrown items) for post-match results screen tallying.

**grrcruise.c** — Rainbow Cruise stage — initializes three scrolling platform segments by setting up their animations, joint callbacks, and JObj references when the stage loads.

**grrcruise.c** — ** `fn_80200460` is a collision callback for Rainbow Cruise stage (`grrcruise.c`). It checks the ECB `b1234` flag, iterates over 3 `grRCruise_SubEntry` entries matching by collision ID, and when found in state 1/3/4: clears x04, triggers `grRCruise_80201B60` on the child JObj, starts an animation via `grAnime_801C7A94`, and sets state to 2.

**itkamex.c** — Blastoise (Kamex) Poke Ball Pokemon — handles the animation timer countdown during its attack motion, transitioning to the next state when the timer expires.

**itpikachuthunder.c** — Pikachu's Thunder special move — handles collision detection for the thunder bolt projectile, checking if it hit ground to transition to the impact state, or if it reached its target position when already activated.

**itlugia.c** — Lugia Poke Ball summon — spawns Lugia's projectile sub-items (Aeroblast beams) at the correct position with computed velocity.

**itkirbycutterbeam.c** — Kirby's Final Cutter — spawns the shockwave beam projectile that travels along the ground after Kirby lands from the downward slash.

**ftCo_Attack100.c** — Grab hold state — when a fighter has grabbed an opponent and transitions from the pull animation into the hold/pummel stance, spawning the grab visual effect and syncing with the victim.

**groldpupupu.c** — Dream Land (Past) stage — selects the next wind animation variant based on the current wind phase and direction when the wind effect triggers.

**mnname.c** — Name Entry menu — updates selection highlight animations when the player navigates between name slots, changing the visual indicator for which name is selected vs deselected.

**gmregclear.c** — Post-match bonus/award clearing — iterates through all 256 bonus types to clear completed awards based on whether they are flag-type or point-type decisions.

**ftKb_Init.c** — Kirby's copy ability hat system — applies material animations (textures/colors) to Kirby's copied hat model based on the victim's costume, syncing visual effects across hat mesh parts.

**ftKb_SpecialNNs.c** — Kirby's copied Jigglypuff neutral special (Rollout) — handles the animation transition from the air startup charge to the full charge state, setting up collision callbacks and initial rolling momentum.

**grkongo.c** — Kongo Jungle stage — tilts individual bridge planks when fighters stand on them, dividing the bridge into 15 segments and rotating each plank based on collision position.

**grkongo.c** — Kongo Jungle stage — checks whether another barrel cannon is positioned directly below the current one, used to determine if a player should be transferred between barrels.

**grhomerun.c** — Home Run Contest stage — initializes the distance meter scaling based on language (Japanese uses meters, English uses feet), computing tick marks for the distance display.

**grcorneria.c** — Corneria stage — computes the world-space position of a point on the Great Fox ship, clamping the Y coordinate to a minimum of 100 to keep it above the battlefield. Used to position stage elements or camera targets relative to the ship's joints.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2335: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2335#issuecomment-4103520219

Split into themed PRs: #2341 (stages), #2342 (items), #2343 (Kirby), #2344 (misc). Excluded fn_80200460 (98.2% match).
