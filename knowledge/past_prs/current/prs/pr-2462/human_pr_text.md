## PR #2462: Match 22 functions across stage, fighter, menu, match-end, and synth TUs
Author: davidfeira
URL: https://github.com/doldecomp/melee/pull/2462

## Summary
- 22 matched functions across 13 TUs (`gricemt`, `grhomerun`, `granime`, `ftCo_Attack100`, `ftKb_Init`, `ftKb_SpecialN`, `ftKb_SpecialNYs`, `mndatadel`, `mnmainrule`, `gm_1601`, `gm_1BA8`, `vi1101`, `synth`)
- 7 header refinements (`gricemt.h`, `mnmainrule.h`, `vi1101.h`, `ftKb_Init.h`, `gm_1601.h`, `grhomerun.h`, `mndatadel.h`) and one inline struct definition required by the new matches

## What these functions do

### Stage code (`gr/`)

**granime.c — `grAnime_801C8138`** — Per-stage anime applier. Resolves the stage's animation archive via `grDatFiles_801C6330`, walks one level down through the JObj hierarchy to find the animation root, then binds three parallel anim arrays (joint, material, shape) at the requested track index and primes the first frame. Honors a per-track flag table to optionally call `grAnime_801C752C` for AObj flag setup.

**gricemt.c — `grIceMt_801F929C`** — Periodic anime-tracker for an Ice Top decoration. Reads a 7-element `s16` script; while active, advances a frame counter and fires `mpJointListAdd`/`mpLib_80057BC0` calls at scripted markers. Clears the active flag once `grAnime_801C83D0` reports the underlying anim has reached frame 7.

**gricemt.c — `grIceMt_801FA364`** — Two-phase delay-and-lerp state machine for the Ice Top vertical-scroll background. Phase 0 counts a `delay` down to zero, then calls a user callback to pick the next target index and seeds the lerp counter from `grIm_804D69F4`. Phase 1 lerps the running value toward the target by `1/lerp_count` per tick, switching back to phase 0 when the counter hits zero. An optional `burst_count` overrides the output with `grIm_804D69F4->x3C * Ground_801C0498()` for a randomized spike. Returns true once the lerp completes.

**gricemt.c — `grIceMt_801F7A2C`** — Per-frame Ice Top scroll driver. Skips when the frozen flag (`xD8.b0`) is set. Otherwise either (a) calls `grIceMt_801FA364` to compute a base offset, watches a tracked fighter for crossing a height threshold (`xA4` ramps `xE4` up while held, ramps back down after), and adds the result; or (b) slaves the offset to a tracked moving-platform GObj using a quadratic-easing approach to a per-frame target. The result is forwarded through `grIceMt_801F9ACC` and `grIceMt_801F9668`.

**grhomerun.c — `grHomeRun_8021C914`** — Home-Run Contest stage initializer. Drives the idle anime via `grAnime_801C8138`, then scales the stage root JObj uniformly by `grHr_804D6AE4`.

**grhomerun.c — `grHomeRun_8021EC58`** — Home-Run Contest score readout builder. Allocates an `HSD_Text` via `HSD_SisLib_803A6754`, scales every layout dimension by `grHr_804D6AE4 * Ground_801C0498()` (so the readout tracks the camera distance), applies the canned color/font, and prints the score with `%d` formatting.

### Fighter code (`ft/chara/`)

**ftCo_Attack100.c — `fn_800D84D4`** — Throw-release effect dispatcher. When the fighter is mid-throw with a held item, computes the release position via `ftCo_800CDE94`, calls `it_80291FA8` to release the item with the appropriate facing, and spawns the matching SFX/effect: effect `0x430` for cardinal throws (`arg1` 0-9, with audio cues `0xFC`/`0xFF`/`0x100`), or effect `0x405` + SFX `0x101` for the fallback throw type.

**ftKb_Init.c — `ftKb_SpecialN_800F1DAC`** — Kirby Special-N collision impact effect. Detects a fresh contact on each of four sides (left/right/top/bottom) by comparing the current `env_flags` against `prev_env_flags`, and on the rising edge spawns particle effect `0x49E` at the matching ECB corner.

**ftKb_SpecialN.c — `ftKb_SpecialLw_Coll`** — Kirby Special-Lw ground-coll handler. On ground contact, copies a constant `Vec3` (read out of `ftKb_Init_803CB490` at offset 0x74) into all five rock-fragment position slots in the kb.speciallw movement struct, zeroes the eight-element velocity scratch array, kills the fighter's horizontal velocity, transitions to `ftKb_MS_SpecialAirLw` while preserving `x221C_b4`, and installs the `Init_800EE7B8`/`Init_800EE74C` damage/death callbacks. Falls through to `ftKb_SpecialHi_800F3570`/`F37EC` when not on the ground.

**ftKb_SpecialN.c — `ftKb_SpecialLwEnd_Coll`** — Kirby Special-Lw release handler. Runs `ft_80081D0C` to disengage, then resets the same five rock-fragment Vec3 slots and the velocity scratch array (mirroring `ftKb_SpecialLw_Coll`'s init pattern) and clears `ftPartSetRotX`.

**ftKb_SpecialNYs.c — `fn_8010AA64`** — Yoshi-egg shrink animation tick (Kirby-on-Yoshi-egg accessory state). Counts `x14` down each frame; while still positive, computes a 0..1 progress fraction, blends it against the egg's stored scale, and applies the result to both the inner egg JObj and the outer accessory JObj. On reaching zero, restores the fighter's normal model scale and clears the accessory callback.

### Menu / scene code (`mn/`, `vi/`)

**mndatadel.c — `mnDataDel_8024EBC8`** — Two-line warning-dialog text setter. Locates the panel-bottom and background joints via `lb_80011E24`, drives each through `HSD_JObjReqAnimAll` to either the start or end frame (selected by the two boolean args, indexing into `mnDataDel_803EF870`'s `x18`/`x24` ranges), and applies the standard alpha mask via `mn_8022F3D8`.

**mndatadel.c — `fn_8024F1D4`** — Warning-dialog input handler. Translates B/Start (mask `0x10`/`0x20`) into a "yes"/"cancel" decision (calling `mnDataDel_8024EA6C` only when the cursor is on the YES option), or treats left/right (`0x4`/`0x8`) as cursor toggles. Plays the standard menu SFX, sets the 5-frame cooldown, hides the panel, and hands off to `fn_8024F840`.

**mnmainrule.c — `mn_80230D18`** — Match-rule snapshot collector. Reads the current `gmMainLib_8015CC34()` ruleset (mode, handicap, damage ratio, stock count, time limit) into the caller's struct, with a special case to force the time limit to 99 in the All-Star tour (mode `0x1B`) and a global override that nukes a handicap of 1 unless `mn_804D6BD4` is set. Then resolves the ten menu-slot JObjs by joint id and stashes their pointers.

**vi1101.c — `un_8031F294`** — Mushroom-Kingdom-Route demo-character setup. Loads the 0x40-flag stage prep, initializes Mario in slot 1 (and Luigi in slot 2 if the second-player flag is set) at fixed offsets, primes the picked character's animation 432 frames in (held idle pose), then snaps both backing players' anims back to frame 0. Finishes by raising the stage-music mask via `lbAudioAx_80026E84`.

### Match-end / game-mode code (`gm/`)

**gm_1601.c — `fn_80161004`** — Match-end "biggest loser" reducer. Returns the maximum `is_big_loser` value among the active standings — iterates the 5-team table for team matches, the 4-player table otherwise, and skips inactive entries.

**gm_1601.c — `fn_80162068`** — Persistent KO-counter accumulator. For each non-CPU player, looks up the persistent fighter-data row by character kind, then adds that player's per-opponent kill count to the saved `fighter_kos[opponent_kind]` cell with saturation at `0xFFFF`. Finishes by piping the player's stage-self-destruct count into `fn_80161C90`.

**gm_1601.c — `fn_801661E0`** — Team-tiebreaker `is_small_loser` filler. For every active team, copies `is_big_loser` into `is_small_loser`, then bumps it once for each other active team that ties on `is_big_loser` but has a strictly higher `subscore` — so the result orders ties by subscore.

**gm_1BA8.c — `gm_801BAB40`** — Tournament-event slot initializer. Calls `gm_8016795C` to clear the `PlayerInitData`, then projects an event entry's compact 8-byte header into the runtime `PlayerInitData`: copies `c_kind`/`slot_type`/`stocks`/`color`/`team`/`cpu_level`/`hp`/etc., sets the default handicap to 9 and timer to 120, and unpacks five flag bits from the entry's `flags` byte into individual bitfields.

**gm_1BA8.c — `gm_801BD46C`** — Tournament-event end-of-round arbiter. Counts how many of P2/P3 are alive (via `ftLib_8008731C`); if both are alive, advances to the next event (`gm_801BC4F4`). If any of P1-P3 has lost their stocks, or the result-condition check (`gm_8016AE38`'s `x0_6` flag plus `gm_8016AEEC()`/`gm_8016AEFC()` returning the 0/0x3B win pair) fires, runs the standard end-of-event sequence: clear `xB_1`, stop audio, restore `1.0` game speed, fire the bookkeeping triple `8016B33C/364/378`, and detach the gobj.

### Synth code (`sysdolphin/`)

**synth.c — `HSD_Synth_8038B120`** — SFX-bank stream-prefetch finalizer. Computes the AX volume envelope from the active node's stacked volume terms, configures each voice's address triple (current/end/loop) into the freshly-loaded SFX bank slot at `HSD_Synth_804D7780`, kicks the voice into state 1, and queues the node onto the volume-update list. Bails out cleanly (clearing the global pending flag) when the node has been freed.

**synth.c — `HSD_SynthPStreamHeaderCallback`** — Prefetched-stream header handler. Pulls the voice count from the loaded header, lazily acquires a second AX voice if the bank is stereo, computes the resampler ratio from the header's stored sample-rate scalar (`0.00003125f` per byte), pushes addr+ADPCM blocks into both voices, advances the round-robin slot index modulo 3, and fires the next `HSD_DevComRequest` for the SFX-bank header.

## Header refinements

- `gricemt.h`: `void grIceMt_801FA364(UNK_T, float*, HSD_GObjEvent, Ground_GObj*)` -> `bool grIceMt_801FA364(void* state, float* out, HSD_GObjEvent cb, Ground_GObj* gobj)` — return type was speculative; matched body returns `bool`.
- `mnmainrule.h`: `UNK_RET mn_80230D18(UNK_PARAMS)` -> `s32 mn_80230D18(struct mn_80230D18_t*, HSD_JObj*, s8)` — required by typed arg use in match.
- `vi1101.h`: `UNK_RET un_8031F294(UNK_PARAMS)` -> `void un_8031F294(int char_index, int costume_index)` — match takes typed args.
- `ftKb_Init.h`: typed prototype for `ftKb_SpecialN_800F1DAC` (`HSD_GObj*`).
- `gm_1601.h`: typed prototypes for `fn_80161004`, `fn_80162068`, `fn_80161C90` — match bodies use the new signatures.
- `grhomerun.h`: typed prototype for `grHomeRun_8021EC58` (`HSD_Text*` return, `u32` arg).
- `mndatadel.h`: typed prototype for `mnDataDel_8024EBC8` (`HSD_JObj*, u8, u8, u8`).
- `ftKb_SpecialN.c` (file-local): inline definition of `struct ftKb_Init_803CB490_layout { char pad[0x74]; Vec3 vec; }` — both `ftKb_SpecialLw_Coll` and `ftKb_SpecialLwEnd_Coll` dereference `ftKb_Init_803CB490` through this layout.

## Verification

- `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/david/projects/melee && ninja"` -> `build-linux/GALE01/main.dol: OK` (SHA1 match)
- Per-function `objdiff-cli diff` reports 100.0% match for each of the 22 functions
- No fuzzy regressions in adjacent TUs (initial CI flagged `fn_800DAD18` 100% → 90.31%; root cause was a `dont_inline` pragma cherry-picked alongside a partial match for `ftCo_CaptureWaitLw_Phys` — pragma removed, `fn_800DAD18` restored to 100%, and `ftCo_CaptureWaitLw_Phys` reverts to upstream's 49.25% partial. Net match count stays positive without breaking adjacent code.)

---
🤖 Generated with [Claude Code](https://claude.ai/claude-code)
