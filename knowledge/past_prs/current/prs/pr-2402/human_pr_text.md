## PR #2402: ft: 6 match progress (100%)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2402

Split from #2345 — fighter-related 100% matches only.

## Matches

| File | Function | Status |
|------|----------|--------|
| `ft_0D31.c` | `fn_800D54A4` | 100% |
| `ft_0D31.c` | `ftCo_Rebirth_Phys` | 100% |
| `ft_0D31.c` | `ftCo_800D41C4` | 100% |
| `ftCo_Attack100.c` | `ftCo_CatchPull_Anim` | 100% |
| `ftKb_Init.c` | `ftKb_UnkMtxFunc0` | 100% |
| `ftKb_Init.c` | `ftKb_SpecialN_800F14B4` | 100% |

## What Claude thinks these functions do

- **`fn_800D54A4`** — Positions a fighter's accessory joint (e.g., Link's hookshot chain) during two-character interactions. Looks up the partnered entity, syncs the Y-axis position upward if the partner is higher, then sets the accessory's translation from the fighter's current position offset by facing direction.

- **`ftCo_Rebirth_Phys`** — Per-frame physics for a fighter on the respawn platform. If the fighter isn't in the "already-respawned" state and has a valid stage spawn index, computes the world position (stage anchor + player offset + facing-dir-based inset) and updates `mv.co.common`.

- **`ftCo_800D41C4`** — Initiates the "star KO" sequence (`ftCo_MS_DeadUpStarIce`): sets the dead-up flag bit, updates the unknown counter pair, changes motion state, plays the death SFX, and notifies the player state system.

- **`ftCo_CatchPull_Anim`** — Animation callback for the Link / Young Link hookshot pull state. Checks the hookshot item pointer and its internal flag to decide whether to transition out of the pull (item gone or retract-complete flag set).

- **`ftKb_UnkMtxFunc0`** — Matrix-update callback for Kirby's copied-fighter hat. If Kirby has a hat with a valid jobj, copies the head-bone matrix onto the hat's jobj, marks it as independent-parent/SRT, flags it dirty, and dispatches a display call.

- **`ftKb_SpecialN_800F14B4`** — Initializes Kirby's Pichu hat when Inhaling Pichu (Pichu's Neutral-B copy). Allocates the hat's two HSD objects, runs the hat-init sequence (`800EF040` / `800EF0E4` / `800EF35C` / `800EF438`), links the Pichu parts descriptor and visibility lookup, sets up the animation table, and copies the color-RGBA overlay. Wrapped in `#pragma dont_inline` to preserve the asm layout.
