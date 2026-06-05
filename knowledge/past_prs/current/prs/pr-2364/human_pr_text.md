## PR #2364: Stage decompilation matches
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2364

## Summary
- 13 matched functions across 9 stage files

## What these functions do

**grshrineroute.c — `grShrineRoute_8020AC44`** — Adds a dynamic light source to Fountain of Dreams' lighting list for the reflective water surface.

**grshrineroute.c — `grShrineRoute_80209AF0`** — Initializes a Fountain of Dreams reflection platform, setting up its material and randomizing its initial oscillation rotation speeds.

**groldpupupu.c — `grOldPupupu_802108B4`** — Initializes a Dream Land (N64) stage component by looking up its game object and attaching animation, rendering, and update callbacks.

**groldpupupu.c — `fn_802112F4`** — Checks if a fighter is within Dream Land (N64)'s wind zone and applies a horizontal wind push velocity.

**grcorneria.c — `grCorneria_801E0E40`** — Debug function that lets a developer cycle through Star Fox character conversations on Corneria using L/R triggers while paused.

**grcorneria.c — `grCorneria_801E1878`** — Synchronizes the Great Fox's collision boundaries to its current visual position by copying the ship model's translation.

**grinishie1.c — `grInishie1_801FC018`** — Initializes the Mushroom Kingdom stage's tilting scale platforms, caching joint references and registering weight-tracking collision callbacks.

**grinishie1.c — `fn_801FC9AC`** — Collision callback for the Mushroom Kingdom scale platforms that accumulates weight based on which side was stepped on.

**grgreatbay.c — `grGreatBay_801F62F8`** — Randomly selects Tingle's next balloon color on Great Bay using weighted probabilities, re-rolling if it matches the current color.

**grmutecity.c — `grMuteCity_801F2C10`** — Checks whether a shadow should render on the Mute City F-Zero racer platform by testing bounds and slope.

**grkinokoroute.c — `grKinokoRoute_80208564`** — Sets up all 51 destructible brick blocks on Mushroom Kingdom II, attaching each to its joint with a damage callback.

**grpura.c — `grPura_80213128`** — Recursively recompiles TEV material settings for all display objects in Pokemon Stadium's model hierarchy.

**grkongo.c — `grKongo_801D7E78`** — Retrieves the 3D world position of a barrel cannon or stage element by reading its joint translation.

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
