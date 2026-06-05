## PR #2461: Match 11 functions across stage and fighter TUs
Author: davidfeira
URL: https://github.com/doldecomp/melee/pull/2461

## Summary
- 11 matched functions across 5 TUs (`gricemt`, `grpura`, `grfourside`, `ftcpuattack`, `ftCo_Attack100`, `ifstatus`)
- 2 header refinements (`ftcpuattack.h`, `gricemt.h`) required by the new matches

## What these functions do

**ifstatus.c — `ifStatus_802F7034`** — Reads the `gm_8016AE38()` status block, decrements three of its index-style fields (with `-1` sentinel for zero), and dispatches to `ifStatus_802F6EA4` based on a leading flag byte that selects which sub-handler runs.

**ftcpuattack.c — `ftCo_800B6208`** — Weighted random selection from a null-terminated array of `ftCo_AttackEntry`. Sums all entry weights, samples `HSD_Randf()`, and returns the `cmd` of the chosen entry. Returns `0` if the list is empty or the weights are degenerate (sum near zero).

**ftCo_Attack100.c — `fn_800DB6C8`** — Cleanup hook for the captured-pulled-hi state. Branches to `fn_800DB790` or `fn_800DBAE4` based on the captor's `motion_id`, then deactivates any kind-specific item still attached to the victim (Yoshi's egg, Link/CLink hookshot, Samus grapple beam) before calling `ftCommon_8007EBAC`.

**gricemt.c — `grIceMt_801F72D4`** — Ice Top stage initializer. Drives the idle anime via `grAnime_801C8138`, then seeds four joint translations (joint IDs `0x12`-`0x15`) from a per-stage `Vec3` lookup table (`grIm_803B8220`).

**gricemt.c — `grIceMt_801F7728`** — Periodic update for Ice Top's wave/cloud effect. When the stage's `xD8` flag is clear, computes a vertical offset via `grIceMt_801FA364` and forwards it through `grIceMt_801F9ACC` and `grIceMt_801F9668`.

**gricemt.c — `grIceMt_801F81B4` and `grIceMt_801F7F1C`** — Identical material-refresh helpers. Iterate the two cached materials in `gp->gv.icemt.xF8[]` and reload each via `grMaterial_801C8CDC`.

**gricemt.c — `grIceMt_801F98A8`** — Joint-rebind callback. When the dirty bit (`b1` in `xC4`) is set, rebinds four joints through `Ground_801C2D0C` and clears the bit.

**grpura.c — `grPura_80212024`** — Pokemon Stadium stage initializer. Starts the idle animation, picks two distinct random transformation indices (current/next), and applies the chosen one to the camera/background colors via `Camera_SetBackgroundColor`.

**grpura.c — `grPura_80212290`** — Pokemon Stadium model setup. Assigns the stage's per-frame render callback, applies the toon texture, raises the shadow-receiver flag (`lb_80011C18(jobj, 0x1000)`), and starts the idle animation.

**grfourside.c — `grFourside_801F2F34`** — Fourside stage initializer. Caches building/platform joints (joints 2-9 via `Ground_801C3FA4`), sets the per-frame render callback to `fn_801F3F74`, conditionally caches a 4th-ground GObj's `hsd_obj`, and registers a moving-platform collision callback for joint 0 (`mpJointSetCb1`).

## Header refinements

- `ftcpuattack.h`: `int ftCo_800B6208(UNK_T)` -> `int ftCo_800B6208(struct ftCo_AttackEntry*)` — required for the typed signature in the matched body.
- `gricemt.h`:
  - `bool grIceMt_801F98A8(HSD_GObj*)` -> `void grIceMt_801F98A8(HSD_GObj*)` — return type was speculative; matched body returns `void`.
  - `void grIceMt_801F9ACC(HSD_GObj*, float)` -> `void grIceMt_801F9ACC(HSD_GObj*, float, HSD_GObjEvent, Ground_GObj*)` — required so `grIceMt_801F7728`'s call site type-checks against the actual signature.

## Verification

- `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/david/projects/melee && ninja"` -> `build-linux/GALE01/main.dol: OK` (SHA1 match)
- Per-function `objdiff-cli diff` reports 100.0% match for each of the 11 functions
- No fuzzy regressions in adjacent TUs

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
