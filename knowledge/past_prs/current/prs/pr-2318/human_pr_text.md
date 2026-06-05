## PR #2318: Match 11 stage functions
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2318

## Summary
- `grOldPupupu_80210C7C` in groldpupupu.c
- `grGreatBay_801F660C` in grgreatbay.c
- `grOldKongo_8021005C` in groldkongo.c
- `grHomeRun_8021DF50`, `grHomeRun_8021E0D4`, `grHomeRun_8021E258`, `grHomeRun_8021E3DC`, `fn_8021E994` in grhomerun.c
- `fn_801FBF6C` in grinishie1.c
- `grCorneria_801E0D30`, `grCorneria_801E0F6C`, `grCorneria_801E2D90` in grcorneria.c

## What these functions do

**Dream Land 64 (Past Stages)** — Whispy Woods randomly picks how long to wait before blowing wind at fighters.

**Great Bay** — Keeps the collision mesh on Tingle's balloon and the lab platform aligned with the animated stage geometry so fighters don't fall through moving parts.

**Jungle Japes** — Initializes a hidden barrel/hazard element by picking a random spawn value from a configured range.

**Home Run Contest** — Four functions that position the distance marker text labels along the field during the Home Run Contest minigame.

**Mushroom Kingdom (Dream Land 64)** — When an item from a ? Block is collected or destroyed, this callback finds the matching block and respawns it so new items can appear.

**Corneria** — Adjusts the stage position based on the Great Fox's movement, sequences Arwing flyby attack patterns, and determines which surfaces on the Great Fox can be stood on.

## Verification
- `fuzzy_match_percent: 100.0` for all functions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
