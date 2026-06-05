## PR #2367: Library, menu, and game system decompilation matches
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2367

## Summary
- 8 matched functions across 7 library/menu/game/trophy files

## What these functions do

**toy.c — `un_80307828`** — Resets the trophy viewer camera to its default position and zoom level when switching trophies.

**lbmthp.c — `fn_8001EB14`** — Opens a THP movie file from disc and reads its header to prepare for video cutscene playback.

**lbaudio_ax.c — `fn_800244F4`** — Resets all audio volume, pitch, and sound effect state to defaults (full volume, normal speed, nothing playing).

**mnnamenew.c — `mnNameNew_8023B224`** — Exits the name entry screen, transitioning back to the appropriate parent menu depending on context.

**mnmainrule.c — `mn_802307F8`** — Updates a Rules menu text element by looking up the string for the current rule mode and value, then styling the display.

**mndatadel.c — `fn_8024FC48`** — Handles the Data Delete menu transition: starts exit animation when leaving, or highlights the selected delete option.

**lbarq.c — `lbArq_80014D2C`** — Initializes the asynchronous read queue (ARQ) system by clearing all lists and linking the node pool.

**gm_1601.c — `gm_80164504`** — Unlocks a hidden stage by setting its bit in the stage unlock mask and sending the unlock notification event.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
