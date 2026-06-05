## PR #2464: Match 8 functions across stage, fighter, and menu TUs
Author: davidfeira
URL: https://github.com/doldecomp/melee/pull/2464

## Summary
- 8 matched functions across 6 TUs (`ftPp_SpecialS`, `ftdynamics`, `ftchangeparam`, `grzebes`, `grbigblueroute`, `grpura`, `gm_1601`, `ftKb_SpecialNYs`)
- 1 header refinement (`gm_1601.h`) required by the new match

## What these functions do

### Stage code (`gr/`)

**grzebes.c — `grZebes_801D8558`** — Brinstar per-stage gobj setup. Looks up the stage gobj for the given id, clears its two pre-render callbacks, wires it into the GX display chain via `grDisplay_801C5DB0`, and installs the matching `StageCallbacks` row entries (`callback3` as the runtime tick, `callback0` invoked once at init, `callback2` registered as the standard proc handler). Logs and bails when the gobj couldn't be acquired.

**grbigblueroute.c — `grBigBlueRoute_8020B9D4`** — Big Blue route per-stage gobj setup, identical shape to `grZebes_801D8558` but indexing the Big Blue route's own `StageCallbacks` table (`grBb_Route_803E5E78`).

**grpura.c — `grPura_80211FD8`** — Pura (Poké Floats) per-stage cleanup driver. Calls the stage's own teardown chain (`grPura_80212EF4` then `Ground_801C2FE0` then `grPura_80213030`), tears down map collision id 0x18 via `mpLib_80055E24`, then runs the global teardown helper `lb_800115F4`.

### Fighter code (`ft/`)

**ftPp_SpecialS.c — `ftPp_SpecialAirHiStart_0_Anim`** — Popo-side Special-Hi air-startup tick. On a fresh `cmd_vars[2]` request, either kicks the climber into the partner-out-of-range fallback (`ftPp_SpecialHi_801220D4`) or arms the partner-belay flag `x2222_b2`. Otherwise advances the startup state when frames remain, or hands off to `ftPp_SpecialHi_80121DD8` once the startup window closes.

**ftdynamics.c — `ftCo_8009DB50`** — Kirby-as-Jigglypuff hat dynamics installer. Reads the Jigglypuff hat's `dat_dynamics[4]` slot, asserts the per-fighter dynamic-bone count is in range, then for each entry copies the bone's `DynamicsDesc` onto the live `Fighter` via `lb_8000FD48`, marks `parts[bone_id].flags_b0`, sets the slot's bone id to `FtPart_TopN`, and finalizes with `lb_80011710`.

**ftchangeparam.c — `ftCo_800D0EC8`** — Compact knockback-decay hook. Returns the negated `ftCo_CalcYScaledKnockback(p_ftCommonData->x310, fp->x34_scale.y, Fighter_804D6524->x30)`.

**ftKb_SpecialNYs.c — `ftKb_SpecialNPe_8010BF90`** — Kirby-with-Peach-hat Special-N air-end driver. Selects the matching motion-state id from a 2x2 table by `(cmd_vars[0] != 0)` × `(hat.kind == FTKIND_MARS)`, runs `ftCommon_8007D5D4`, and transitions via `Fighter_ChangeMotionState` using `ftKb_Init_804D9574` / `ftKb_Init_804D9570` for the speed and frame fields. Installs `efLib_PauseAll` / `efLib_ResumeAll` as pre/post-hitlag callbacks when `x2219_b0` is set.

### Match-end code (`gm/`)

**gm_1601.c — `gm_8016A9E8`** — Two-array MRU push for the (kind, costume) pair tracker at `lbl_8046B668`. Scans `arr2` for the first `-2` sentinel slot, then shifts every preceding entry down by one position in both `arr1` and `arr2`, and writes `arg1` / `arg0` into slot 0 — i.e. records the most-recent selection at the head of a 27-deep history.

## Header refinements

- `gm_1601.h`: `UNK_RET gm_8016A9E8(UNK_PARAMS)` → `int gm_8016A9E8(u8 arg0, s8 arg1)` — matched body needs the typed signature.

## Verification

- `ninja main.dol` → links cleanly
- Per-function `objdiff-cli diff` reports 100.0% match for each of the 8 functions

## Notes

The earlier revision of this PR (commit `1e672b30a`) bundled three additional matches in `gricemt.c` (`fn_801F9338`, `fn_801F9448`, `fn_801F9558`) along with a const-section reorder. CI surfaced a 4-byte regression in the neighboring `grIceMt_801F7A2C` from the reorder. Dropped the gricemt commit; will resubmit those three with a non-regressing approach in a follow-up PR.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
