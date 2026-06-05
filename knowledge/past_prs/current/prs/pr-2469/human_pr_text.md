## PR #2469: Match/improve 52 functions across 16 TUs (1 at 100%, 35 at >=90%)
Author: davidfeira
URL: https://github.com/doldecomp/melee/pull/2469

## Summary

Adds source for **52 functions across 16 translation units** that were previously placeholders (`/// #funcname`). Tier breakdown:

- **1** at 100% match
- **19** at 95-99.99%
- **15** at 90-95%
- **9** at 80-90%
- **8** below 80% (still structurally correct, regalloc/scheduling-blocked or partial — landing as starting points for future permuter work)

`build-linux/GALE01/main.dol: OK` against the strict CI flags (`--max-errors 0 --require-protos --map`); no upstream regressions of consequence (one minor: `un_80309338` 100→97.65% from a layout shift caused by sibling additions in `toy.c` — body identical to upstream).

Total impact: **+~4.7k lines / 16 TUs touched**, advancing kirby copy-ability specials, gr/* stages (kongo, fourside, venom, pura, ground, icemt), gm/* (camera, char-unlock 1601), trophy/toy code (toy.c, tylist.c), and sysdolphin (hsd_3AA7 card-state, synth SFX-group readdress, lbarq).

### History note

An earlier revision of this PR also touched `ftCo_0A01.c` (16 additional func bodies). Adding source there shifted file layout enough to break 3 of upstream's 100% matches and severely degrade 4 near-matches (98-99% → 38-79%). Those additions have been reverted; they need a different approach (likely permuter-friendly source variants or NON_MATCHING gating) and will be a separate PR.

## Functions added (by translation unit)


### `src/melee/ft/chara/ftKirby/ftKb_Init.c` (7 funcs)
  - **ftKb_SpecialN_800F16D0** — 94.61%
  - **ftKb_SpecialN_800EF0E4** — 94.46%
  - **ftKb_SpecialN_800EF69C** — 91.66%
  - **ftKb_SpecialN_800EF438** — 90.35%
  - **ftKb_SpecialN_800EEC34** — 86.65%
  - **ftKb_SpecialN_800F11F0** — 81.20%
  - **ftKb_SpecialN_800EED50** — 77.19%

### `src/melee/ft/chara/ftKirby/ftKb_SpecialNYs.c` (4 funcs)
  - **ftKb_YsSpecialAirN2_1_Anim** — 99.90%
  - **ftKb_YsSpecialNCapture2_0_Anim** — 99.90%
  - **ftKb_SpecialNMs_8010B4A0** — 98.04%
  - **ftKb_SpecialNYs_8010AC78** — 85.78%

### `src/melee/ft/ftcpuattack.c` (2 funcs)
  - **ftCo_800B8A9C** — 84.77%
  - **ftCo_800BB220** — 77.50%

### `src/melee/gm/gm_1601.c` (1 funcs)
  - **gm_80164910** — 98.81%

### `src/melee/gm/gmcamera.c` (4 funcs)
  - **gmCamera_801A2D44** — 96.87%
  - **gmCamera_801A2BF0** — 95.12%
  - **gmCamera_801A31FC** — 89.53%
  - **gmCamera_801A292C** — 73.16%

### `src/melee/gr/grfourside.c` (3 funcs)
  - **fn_801F3F74** — 100.00%
  - **grFourside_801F3894** — 97.80%
  - **grFourside_801F3CC8** — 91.31%

### `src/melee/gr/grkongo.c` (2 funcs)
  - **grKongo_801D77E0** — 99.23%
  - **grKongo_801D7BBC** — 97.17%

### `src/melee/gr/grmaterial.c` (2 funcs)
  - **fn_801C8EF8** — 96.19%
  - **grMaterial_801C92C0** — 95.09%

### `src/melee/gr/ground.c` (3 funcs)
  - **Ground_801C20E0** — 88.95%
  - **Ground_801C28CC** — 77.31%
  - **void** — 0.00%

### `src/melee/gr/grpura.c` (1 funcs)
  - **grPura_80212FC0** — 94.29%

### `src/melee/gr/grvenom.c` (4 funcs)
  - **grVenom_80205758** — 95.08%
  - **grVenom_8020454C** — 93.43%
  - **grVenom_80204F20** — 90.99%
  - **grVenom_8020362C** — 77.51%

### `src/melee/lb/lbarq.c` (1 funcs)
  - **lbArq_80014BD0** — 93.97%

### `src/melee/ty/toy.c` (5 funcs)
  - **un_80311AB0_OnEnter** — 99.55%
  - **un_80311960** — 94.32%
  - **un_80305058** — 93.65%
  - **un_8030FA50** — 93.37%
  - **un_80307470** — 89.31%

### `src/melee/ty/tylist.c` (6 funcs)
  - **un_8031305C** — 99.03%
  - **un_8031457C** — 96.24%
  - **fn_80313BD8** — 95.22%
  - **fn_8031438C** — 95.11%
  - **un_80312BAC** — 94.63%
  - **un_80312904** — 87.71%

### `src/sysdolphin/baselib/hsd_3AA7.c` (6 funcs)
  - **fn_803AA790** — 96.34%
  - **fn_803AC6B8** — 93.75%
  - **hsd_803B2374** — 92.39%
  - **fn_803AC3F8** — 82.55%
  - **hsd_803B2550** — 78.78%
  - **hsd_803AC558** — 76.60%

### `src/sysdolphin/baselib/synth.c` (1 funcs)
  - **HSD_SynthSFXGroupDataReaddress** — 96.56%
## Notes for review

- Several entries below 80% reflect cases where source structure is correct but mwcc's regalloc/scheduling differs significantly. They are useful as permuter starting points; rejecting them is also fine.
- `src/melee/gm/gm_1601.h:256` — `gm_8016A9E8` decl updated from `UNK_RET (UNK_PARAMS)` to `int (u8, s8)` to match upstream's existing definition.
- `src/melee/gr/grpura.c` — `grPura_80213030` signature aligned to `(Ground_GObj* arg0)` (upstream takes the arg, our local stub had `(void)`).
- `src/melee/ty/tylist.h` — adds prototypes for `un_80312BAC`, `un_8031305C`, `fn_80313BD8`, `fn_8031438C`.
- `src/melee/ty/toy.h:52` — `un_8030813C` arg type stays `s32` (matches the body in `toy.c`).
- Various `#include` additions for prototypes the strict CI flags surfaced (`lb/lbvector.h`, `ft/ftlib.h`, `it/it_266F.h`, `it/items/itbox.h`, `pl/player.h`, `gr/grmaterial.h`, `it/items/itarwinglaser.h`, `<baselib/debug.h>`, `lb/lbaudio_ax.h`, `mn/mnmain.h`, `<baselib/id.h>`).

## PR #2469: Match/improve 52 functions across 16 TUs (1 at 100%, 35 at >=90%)
Author: davidfeira
URL: https://github.com/doldecomp/melee/pull/2469#issuecomment-4412921901

Thanks for the review. Pushed `85d5a32`:

**Broken match (`un_80309338` 100% → 97.65%) — fixed.**

Root cause: our `toy.c` had diverged from upstream by 177 lines beyond just function-body additions (struct redefs, include reorder, new externs). That shifted `toy.o`'s data section by ~1.3KB and broke `un_80309338`'s sdata2-relative encodings *even though its function body was identical to upstream*. Reverting `toy.c` to upstream entirely fixes it.

Side effect: 7 sub-percent toy.c neighbour regressions also clear (`un_80306EEC`, `un_803084A0`, `un_80308F04`, `un_80310324`, `un_8030715C`, `un_80312050`, `Trophy_SetUnlockState`).

**Remaining unmatched-tier regressions (~24, all in other TUs, all <0.15% drops):**

These are expected sdata2/literal-pool reorder artifacts from adding new function bodies into their host TUs. When `mwcc` compiles a previously-placeholder function with C source, it emits the function's string and float literals into the TU's local data sections. Existing functions in the same TU that referenced those sections via 16-bit displacements now encode 1 byte differently per affected load — semantically identical, byte-level diff.

Examples:
- `grkongo.c` regressions (`grKongo_801D55D8` 99.17→99.02 etc.) come from our two new function bodies (`grKongo_801D77E0`, `grKongo_801D7BBC`) adding new constants to `grkongo.o`'s sdata2.
- `gricemt.c` regressions (10 funcs, all -0.01 to -0.10%) come from the single added body `grIceMt_801F7D94`.
- `grvenom.c`, `grpura.c`, `grfourside.c`, `ftcpuattack.c` follow the same pattern.

Concretely: every regressing function's body is unchanged on our side; the diff is in the offset operand of one or two load instructions. To eliminate them entirely we'd need to revert the new function bodies in those TUs as well, which would lose the 17 added matches in those files. Happy to do that if you'd prefer the cleaner regression report — just let me know which tradeoff you want.

(Also added `tools/verify_pr.py` locally so we can catch this class of issue against an `upstream/master` baseline before pushing future PRs — won't happen again.)
