## PR #2345: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2345

## Progress

**14** matched, **8** failed

### Matched
| File | Function | Status |
|------|----------|--------|
| `groldkongo.c` | `grOldKongo_80210650` | ✓ 100% (recovered) |
| `ittincle.c` | `it_802EB6DC` | ✓ 100% (recovered) |
| `grhomerun.c` | `fn_8021E994` | ✓ 100% |
| `mnmainrule.c` | `mn_80230198` | ✓ 100% |
| `gm_1601.c` | `gm_80164910` | ✓ 100% |
| `itlugia.c` | `it_802D1830` | ✓ 100% |
| `ifstatus.c` | `ifStatus_802F7034` | ✓ 100% |
| `itmatadogas.c` | `itMatadogas_UnkMotion1_Anim` | ✓ 100% |
| `gm_1601.c` | `fn_80162068` | ✓ 100% |
| `itoldottosea.c` | `it_802E2470` | ✓ 100% |
| `itoldottosea.c` | `itOldottosea_UnkMotion7_Phys` | ✓ 100% |
| `mnmainrule.c` | `mn_80230D18` | ✓ 100% |
| `itoldottosea.c` | `it_2725_Logic8_DmgReceived` | ✓ 100% |
| `itzgshell.c` | `itZrshell_UnkMotion10_Anim` | ✓ 100% |

### Failed
- `grPura_80212FC0` — best 10.3%)
10.3%
- `ftKb_SpecialN_800F11F0` — best ?%
- `gm_801B59AC` — best ?%
- `ftCo_800B6208` — best ?%
- `fn_8024FD40` — best 27.9%
- `gmClassic_801B3A34` — best ?%
- `ftKb_SpecialN_800EEC34` — best ?%
- `un_803067BC` — best ?%

## What these functions do
**gm_1601.c** — Character unlock flow — when a player unlocks a new fighter, this records the unlock, flags it for the post-match "new challenger" celebration, and updates the save-file bitmask.

**gm_1601.c** — Post-match bookkeeping on the Results screen — tallies kill counts from this match into each fighter profile, clamped so a character never registers more than 65,535 KOs against another.

**ifstatus.c** — Final match result screen dispatch — routes to the appropriate end-of-match HUD sequence based on match mode, outcome, and current stage.

**itmatadogas.c** — Koffing (Matadogas) Pokemon — animation handler for the gas cloud motion that pauses/resumes effects each tick.

**itoldottosea.c** — Freezie enemy stage hazard — initializes a spawned Freezie, setting its facing direction, physics flags, and randomly deciding whether to enter a special variant state.

**itoldottosea.c** — Old Sea Ottos (Octarock-like enemy) — per-frame physics update that kicks its walking velocity, applies deceleration, and triggers a hit state if it strikes something.

**itoldottosea.c** — Flying Man enemy on Mt. Dedede stage (Old Ottosea) — handles damage taken, transitioning from its walk animation into stagger/knockdown reactions when its HP threshold is exceeded or when it is already in a stunned state.

**mnmainrule.c** — Main menu rules screen — snapshots the current game rules (mode, time/stock limits, handicap, damage ratio, friendly fire) and grabs the menu joints used to render the rules panel.

**itzgshell.c** — Zako Generator (Onett stage enemies) — green shell item's airborne animation frame, stops it when it lands without hitting anything or enters a new motion state in the air.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)

## PR #2345: Match progress
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2345#issuecomment-4226538679

Split this PR into four smaller draft PRs by subsystem for easier review:

- #2402 — `ft/` fighters (6 matches)
- #2404 — `gr/` stages (5 matches)
- #2405 — `gm/` + `mn/` game loop / menu (5 matches)
- #2406 — `it/` items (20 matches)

A few commits from this PR were dropped because upstream already has equivalent (or better) decompilations:
- `lbAudioAx_800243F4` + `fn_800244F4` (already upstream)
- `grOldPupupu_8021119C` (already upstream)
- `fn_8023DAEC` in `mnnamenew.c` (already upstream)

Closing this PR in favor of the split ones.
