## PR #2405: gm/mn: 5 match progress (100%)
Author: johnwinston
URL: https://github.com/doldecomp/melee/pull/2405

Split from #2345 — game-loop and menu 100% matches only.

## Matches

| File | Function | Status |
|------|----------|--------|
| `mnmainrule.c` | `mn_802308F0` | 100% |
| `gm_1A4C.c` | `fn_801A7FB4` | 100% |
| `gmopening.c` | `fn_801A9FCC` | 100% |
| `gm_1601.c` | `fn_80165E7C` | 100% |
| `gm_16F1.c` | `fn_8016F870` | 100% |

## What Claude thinks these functions do

- **`mn_802308F0`** (mnmainrule) — Rule-description text manager callback. Reads the gobj's user data as a raw byte array, picks the current selection (hovered vs confirmed based on `arg1`), then dispatches on a "mode" byte at offset `0xA`: modes 2/4 destroy the existing `HSD_Text*` at offset `0x130`; modes 1/3 spawn it via `mn_802307F8` if absent; mode 0 spawns it conditionally based on `arg1`/`arg2` and the selection kind.

- **`fn_801A7FB4`** (gm_1A4C) — Fog-anim gate used during the intro/cutscene. Counts how many of 26 "entities" (`gm_801A659C(0..0x1A)`) pass `un_803048C0`. Driven by thresholds: `≤5` entities keep fog animating while its current frame is under 185; `≤13` allow up to frame 200; otherwise fall through to the final phase. Advances `HSD_FogInterpretAnim` each frame gated by those thresholds.

- **`fn_801A9FCC`** (gmopening) — Builds the opening's performance stats overlay. Uses a static `PerfLabelLine[4]` and static color-tagged format strings (`"\cfff00%2d"`, `"\cfff00%3d"`). Renders lines via `sprintf`, pulling frame-rate stats from `lbMthp_8001F5F4/E4/D4` and a CPU-tick-to-ms conversion using the bus clock at `0x800000F8`.

- **`fn_80165E7C`** (gm_1601) — Aggregates per-player scores into team standings after a match. Iterates the 6 player slots; for non-CPU-removed players, in Stamina VS or a special mode: negative scores (losses) take the most-negative, positive scores accumulate into the team total. Handles the "first-to-score" initialization case.

- **`fn_8016F870`** (gm_16F1) — Bonus-lookup: finds the *highest-indexed* bonus (below `arg1`) that both passes a mask check and was achieved by `player_id`. Walks an entry table looking up each bonus kind in the lookup table `lbl_803D5A4C`, sentinel-terminated by kind `0x29A`, branches on kind `< 0xD7` (generic) vs `≥ 0xD7` (special), and returns the first match or `-1` if none.

## Dropped from #2345

- `fn_8023DAEC` in `mnnamenew.c` — already upstream
