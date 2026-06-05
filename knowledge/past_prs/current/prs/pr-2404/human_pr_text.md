## PR #2404: gr: 5 match progress (100%)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2404

Split from #2345 — stage-related 100% matches only.

## Matches

| File | Function | Status |
|------|----------|--------|
| `grkinokoroute.c` | `grKinokoRoute_8020836C` | 100% |
| `gricemt.c` | `fn_801F9038` | 100% |
| `grhomerun.c` | `grHomeRun_8021EC58` | 100% |
| `grpushon.c` | `grPushOn_802190D0` | 100% |
| `groldkongo.c` | `grOldKongo_80210650` | 100% |

## What Claude thinks these functions do

- **`grKinokoRoute_8020836C`** (Mushroom Kingdom route) — Toggles special collision state on a stage joint. Fetches the joint, and when enabling: clears its flag bits, adds a pinned list of joint IDs (`0x3C`, `0x33`, `0x0C`–`0x0F`) to the collision system, and walks all live item GObjs applying `grMaterial_801C8E08` to every item of kind `0xA0`.

- **`fn_801F9038`** (Ice Mountain) — Picks a random "next" ice segment id for the scrolling stage. Loops calling `HSD_Randi(6)` until it finds a slot with a zero cooldown whose id doesn't collide with the two most recently used segments (`xC4`/`xC6`), decrements all other cooldowns, stamps the chosen slot with the current cooldown value from `grIm_804D69F4`, and returns the picked segment id.

- **`grHomeRun_8021EC58`** (Home-Run Contest) — Creates the stage's score HSD_Text overlay. Allocates a text object, sizes the bounding box and font scale using the stage scale factor (`grHr_804D6AE4 * Ground_801C0498()`), white text color, left-aligned, and renders the current distance value formatted as `"%d"` at position `(0, -29)`.

- **`grPushOn_802190D0`** (Mute City) — Builds the stage's nine point-light descriptors and wires them up. Declares two `HSD_LightDesc` statics, a 9-entry light-config table (color, position, ref-brightness, ref-distance, distance-func), and populates the stage's lighting system from the table.

- **`grOldKongo_80210650`** (DK Rumble Falls old version) — Weighted-random direction picker returning one of 8 angles (multiples of π/4 from `-π` to `+3π/4`) plus `0`. Sums 8 counter fields (`x2C`…`x3A`), calls `HSD_Randi(total)`, then subtracts each counter from the random value and returns the matching angle as soon as the running sum goes negative. Uses named sdata2 constants (`grOk_804DBA04`…) and the `#define __FILE__` trick for `HSD_ASSERT`.

## Dropped from #2345

- `lbAudioAx_800243F4` + `fn_800244F4` — already upstream
- `grOldPupupu_8021119C` — already upstream
- `grKinokoRoute_80207B5C` — only 99.64% (real struct-field offset diffs), reverted to stub
