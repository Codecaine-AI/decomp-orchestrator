# Known PR Fixes And Changes

## PR #2579: permuter-driven fixes

Status: agent_failed_scaffold_written
Type: decomp-matching
Systems: item

permuter-driven fixes is a open PR touching 3 changed file(s), primarily in item. Draft classification: decomp-matching, fix.

Postmortem JSON: `pr-2579/postmortem.json`

## PR #2578: Match several ft, pl, and if functions

Status: agent_completed
Type: decomp-matching
Systems: fighter-common-guard;player-attack-stats;interface-ui

Open decomp-matching PR that matched four functions across fighter common guard, player attack stats, and interface/UI code: ftCo_80092158, ftCo_80093790, plAttack_8003759C, and un_802FE260. It also improved fn_802FDA78 in if_2FC93 using better local struct access, signed byte sentinel typing, fieldwise color stores, const data, and stack/local-layout tuning. The decomp-dev GALE01 report shows matched code +2016 bytes and the four listed functions at 100.00%.

Postmortem JSON: `pr-2578/postmortem.json`

## PR #2577: Attempt to resolve the mystery of HSD_JObjSetMtxDirty

Status: agent_completed
Type: decomp-matching header cleanup
Systems: sysdolphin/baselib/jobj;fighter;ftKirby;game-mode;ground/stage;items;menus;vi;config

Renamed ftCo_800C6AFC to the real HSD_JObjSetMtxDirty symbol at 0x800C6AFC and centralized many matching-only JObj matrix-dirty setter variants in jobj.h, replacing per-TU fake helpers across fighter, game-mode, item, stage, menu, and VI code. The PR intentionally kept some weird parenthesized calls and WithMtxDirty variants because full unification with the normal HSD_JObjSet* helpers was not proven to match.

Postmortem JSON: `pr-2577/postmortem.json`

## PR #2576: Match several particle functions

Status: agent_completed
Type: decomp-matching
Systems: src;sysdolphin;baselib;particle

Open PR matching four functions in `src/sysdolphin/baselib/particle.c`: `hsd_80393D2C`, `hsd_803966A0`, `hsd_80396C78`, and `fn_80397374`. The fix is mostly codegen shaping: local state pointers for global particle structs, a localized `dont_inline` pragma for call shape, and a shared `ps_remove_node` inline scheduling fold. The decomp.dev GALE01 report shows +1456 matched bytes, +0.04% matched code, four new 100.00% matches, and four nearby unmatched-function improvements.

Postmortem JSON: `pr-2576/postmortem.json`

## PR #2575: Match and improve several functions

Status: agent_completed
Type: decomp-matching
Systems: camera;fighter;game-mode;game-mode-opening;game-mode-results;stage;interface;menu;toy-trophy

Batch decomp PR that matched six functions and improved twelve more partial/unmatched items across camera, fighter, game-mode/results/opening, stage, interface text/HUD, menu, and toy/trophy code. The decomp.dev GALE01 report recorded matched code at 69.96%, up +0.06% and +2216 bytes, with new 100% matches for Camera_80030E44, ftAction_80073008, fn_8017A9B4, un_80318B1C, ftNn_Init_80123954, and gm_801A9DD0. The diff is mostly matching-focused codegen tuning: exact narrow types and casts, local lifetime/register-shape changes, loop-shape changes, helper/inlining control, direct global access, and small header/prototype corrections.

Postmortem JSON: `pr-2575/postmortem.json`

## PR #2574: More dups and a ft link

Status: agent_completed
Type: decomp-matching
Systems: config;build;fighter;kirby;stage;item

Continuation of #2572 that linked two Kirby capture fighter units and modeled more duplicate/adjacent stage data strings. The PR marked ftCo_CaptureKirby.c and ftCo_CaptureWaitKirby.c as Matching, split their .sdata ownership in GALE01 splits, converted many anonymous/global data symbols to local @ symbols, and added StageData wrapper structs plus explicit OSReport filename/format strings across several gr stage files. decomp-dev reported 18 new matches, +4304 matched code bytes, +2116 linked code bytes, and small matched/linked data gains.

Postmortem JSON: `pr-2574/postmortem.json`

## PR #2573: improve grinishie1 data matching

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grinishie1

Small data/string matching PR for `src/melee/gr/grinishie1.c`. It populated the `grI1_803E4950` stage-data callback table with real callback symbols instead of `NULL`, adjusted exact diagnostic/assert strings, removed use of a standalone `grinishie1.c` global string in favor of a literal, and changed one assert label from `new_gobj` to `map_gobj`. The automated decomp.dev report showed `main/melee/gr/grinishie1` `.data` improving from 55.52% to 89.65% (+139 bytes), plus a tiny `grInishie1_801FB3F0` improvement from 80.43% to 80.44%.

Postmortem JSON: `pr-2573/postmortem.json`

## PR #2572: Match some duplicates

Status: agent_completed
Type: decomp-matching
Systems: fighter;Kirby;game-mode;item;item-collision;Link-items;stage;ground-animation

Small duplicate-driven matching pass prompted by re-running `table-typer dups`. The automated report showed +2020 matched bytes, +0.05% overall matched code, 5 new 100% matches, and 3 partial improvements across fighter, game-mode, item, and stage code. The main reusable theme is using duplicate structure to replace hand-expanded logic with known helpers, split collision code into static inlines, and tune stack/register layout with `PAD_STACK` and `UNUSED` locals.

Postmortem JSON: `pr-2572/postmortem.json`

## PR #2571: Matched HSD_SynthSFXGroupDataReaddress by rewriting the loop and pulling allocations out of the loop

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin;baselib;synth;audio

Matched HSD_SynthSFXGroupDataReaddress in src/sysdolphin/baselib/synth.c by reshaping the inner readdress loop and moving loop temporaries to outer scope. The patch replaced a count-decrementing do/while guarded by count > 0 with a for loop using a separate j index, kept count alive after the loop for p advancement, and changed one pointer increment into uintptr_t-based integer address arithmetic.

Postmortem JSON: `pr-2571/postmortem.json`

## PR #2570: Matched if_2F72 (if_802F7E7C) by converting the while to a for loop

Status: agent_completed
Type: decomp-matching
Systems: melee-core;if

Matched if_802F7E7C in src/melee/if/if_2F72.c by rewriting a do/while loop with a moving HSD_GObj** pointer into an indexed for loop over the fixed base pointer lbl_804A1340. The behavior remains the same: for six iterations, conditionally unlink two object slots per pair with HSD_GObjPLink_80390228, then memzero the base array.

Postmortem JSON: `pr-2570/postmortem.json`

## PR #2569: Match synth and Ice Mountain functions

Status: agent_completed
Type: decomp-matching
Systems: stage/Ice Mountain;sysdolphin/baselib/synth

Matched one sysdolphin synth function and three Ice Mountain stage functions. The PR removed the stale residual-match note for HSD_Synth_80388DC8, tightened the HSD_Synth_8038B120 header prototype to void(void), and reshaped grIceMt_801F96E0, grIceMt_801F993C, and grIceMt_801FA0BC to reach 100.0% in the GALE01 report.

Postmortem JSON: `pr-2569/postmortem.json`

## PR #2568: plbonuslib: match fn_8003F654 & link plbonuslib.c

Status: agent_completed
Type: decomp-matching
Systems: melee/pl/plbonuslib;player-bonus-statistics;repo-build-configuration

Matched `fn_8003F654` in `src/melee/pl/plbonuslib.c` and changed `plbonuslib.c` from `NonMatching` to `Matching` in `configure.py`. The key matching fix was an inline `my_sqrtf` using `__frsqrte` with local double constants, plus removal of unused `MSL/math_ppc.h`, to keep `.sdata2` layout aligned with the target object. The PR body reports `fn_8003F654` at 100.0% and `plbonuslib.c` `.text`, `.data`, and `.sdata2` all at 100.0%.

Postmortem JSON: `pr-2568/postmortem.json`

## PR #2567: Split it_266F

Status: agent_completed
Type: translation_unit_split
Systems: item;config/GALE01;build;itspawn;itgroundcoll;itdraw;itdrop;itcoll;itmaplib;it_279C;itzako;itdosei

Split the monolithic item TU `it_266F` into semantic item modules `itspawn`, `itgroundcoll`, `itdraw`, and `itdrop`, with matching build config, split ranges, symbol ownership, and headers. The PR body reports remaining item work at 75 functions and 21 TUs; the automated decomp.dev report showed net progress of +2700 matched code bytes and +5556 linked code bytes, with old `it_266F` broken matches largely mirrored as new matches in the split TUs.

Postmortem JSON: `pr-2567/postmortem.json`

## PR #2566: Match grInishie1_801FA9B4 to 100% by copying the same structure for StageData found in grHeal

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grInishie1

Single-file stage decomp matching PR for Inishie1. It matched `grInishie1_801FA9B4` to 100% by modeling the surrounding `.data` layout: a preceding s16/S16Vec3 table, StageCallbacks adjacency, a StageData wrapper with an embedded get-gobj report format string, and separate global strings for `/GrI1.dat` and `grinishie1.c`.

Postmortem JSON: `pr-2566/postmortem.json`

## PR #2565: plbonuslib: match fn_8003F294

Status: agent_completed
Type: decompilation-match
Systems: melee-core;plbonuslib;player action stats;stale move table

Implemented the previously unmatched `fn_8003F294` in `src/melee/pl/plbonuslib.c`, producing a 680-byte 100% match. The function reads player action stats and stale-move-table state, runs a sequence of bonus/stat threshold checks through `pl_8003906C` and `pl_80039238`, and updates `table->xDD1.bit5`/`table->xD5C` state after a final condition.

Postmortem JSON: `pr-2565/postmortem.json`

## PR #2564: Match mn menu record functions

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn menu;record/stat menus;controller vibration menu;rules plus menu;name entry menu;snapshot menu;sound test;data deletion menu;special info menu

Matched a broad set of mn/menu record-related functions across count rows, VS stat diagrams, name entry, vibration, rule-plus, data delete, special info, snapshots, and sound test. The decomp-dev report recorded 21 new matches, +7344 matched code bytes, and +624 matched data bytes; the PR body lists verification with `python configure.py --require-protos && ninja`.

Postmortem JSON: `pr-2564/postmortem.json`

## PR #2563: Match pl bonus functions

Status: agent_completed
Type: decomp-matching
Systems: melee-core;player bonus library;plbonuslib;player stale move table;item logging

Matched three player bonus-library functions in `src/melee/pl/plbonuslib`: a full implementation of `pl_8003E4A4` plus small dataflow/type fixes that brought `pl_80040688` and `pl_800407C8` to 100%. The PR also corrected the `pl_8003E4A4` header prototype from `u8 slot` to `int slot`. decomp.dev reported 3 new matches and +1104 matched code bytes for GALE01.

Postmortem JSON: `pr-2563/postmortem.json`

## PR #2562: Match two stage functions

Status: agent_completed
Type: decomp-matching
Systems: stage;grgreatbay;grinishie1

Matched two stage functions: `grGreatBay_801F60C4` and `grInishie1_801FC4A0`. Great Bay was brought from a near match to 100% via codegen-sensitive variable/scoping/clamp rewrites; Inishie1 gained a new C implementation plus added stage-data struct fields needed for the function. Automated decomp.dev reporting showed 2 new matches and +1016 matched bytes.

Postmortem JSON: `pr-2562/postmortem.json`

## PR #2561: Jj/remaining unstubbed

Status: agent_completed
Type: decomp-matching
Systems: external-sdk-thp;fighter;game-mode;stage;audio;soundtest-ui;player-stats;baselib-synth;library

Large unstubbing/decompilation batch across THP, fighters, game modes, stages, soundtest, player bonus logic, lbaudio, and baselib synth. The slice has no PR body or human review comments, but the diff replaces many `/// #` placeholders or disabled/nonmatching code with C, adds supporting prototypes and struct field typing, and the decomp.dev bot reported +3428 matched code bytes, +48 matched data bytes, 10 new matches, and 39 partial-match improvements.

Postmortem JSON: `pr-2561/postmortem.json`

## PR #2560: Implement scratches

Status: agent_completed
Type: decomp-matching-source-implementation
Systems: game-mode-camera;stage-flatzone;interface-devtext;sysdolphin-baselib-particle

Implemented five scratch items resolved by PR body links #2550 through #2554 across camera, Flatzone, DevText, and particle code. The diff is mostly source-shaping for decomp matching: local aliases, scoped dont_inline pragmas, stack padding, byte masking, and equivalent control-flow rewrites. The decomp.dev bot reported GALE01 "No changes", supporting that these were matching/source reconstruction changes rather than intentional game behavior changes.

Postmortem JSON: `pr-2560/postmortem.json`

## PR #2559: CaptureWaitKirby and grGreens_80214B58

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;Kirby capture;stage;Green Greens

Matched two remaining decomp targets across fighter and stage code: ftCo_CaptureWaitKirby_IASA in ftCommon/Kirby capture logic and grGreens_80214B58 in Green Greens stage logic. The decomp.dev report recorded 2 new matches, +1644 matched bytes, with ftCo_CaptureWaitKirby_IASA moving from 63.61% to 100.00% and grGreens_80214B58 from 99.26% to 100.00%. Discussion noted that CaptureWaitKirby shares strings with thrownkirby, and reviewer guidance was that shared strings require the units to be merged.

Postmortem JSON: `pr-2559/postmortem.json`

## PR #2558: Match/grinishie1 801FA9B4

Status: agent_completed
Type: decomp_matching_attempt_closed_unmerged
Systems: stage/grInishie1;stage/grYorster;library/lbSnap

Closed-unmerged attempt to match grInishie1_801FA9B4 at 801FA9B4. The main grinishie1.c diff added inferred .data symbols, a StageData wrapper, data-backed strings, and rewrote callback/report-string access to use adjacent-data pointer arithmetic. The PR also contained gryorster.c and lbsnap.c matching-style edits. The author immediately closed it with the comment "Still haven't hard reverted. My mistake again", so this should be treated as an aborted or contaminated branch rather than accepted project guidance.

Postmortem JSON: `pr-2558/postmortem.json`

## PR #2557: Match grInishie1_801FA9B4

Status: agent_completed
Type: decomp-matching
Systems: stage/grInishie1;stage/grYorster;library/lbSnap;ground

Closed, unmerged PR intended to match grInishie1_801FA9B4 to 100% by copying the _StageData structure pattern from grHeal. The main Inishie1 change modeled stage data as a wrapper struct containing StageData plus an OSReport format string, added adjacent globals for /GrI1.dat and grinishie1.c, and changed grInishie1_801FA9B4 to reference that data layout. The branch also contained grYorster and lbSnap matching rewrites from earlier commits; the author closed the PR to resubmit only the stage data fix.

Postmortem JSON: `pr-2557/postmortem.json`

## PR #2556: Match grInishie1_801FBC4C

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grInishie1

Matched stage function grInishie1_801FBC4C by introducing a local HSD_JObj* variable for gp->gv.inishie1.blocks[index].jobj2 before passing it to DOBJ_CLEAR_LOOP. The PR body says this fixed register allocation and brought the function to 100% match; no behavioral change is evident from the diff.

Postmortem JSON: `pr-2556/postmortem.json`

## PR #2555: Remove `un` module from readme

Status: agent_completed
Type: documentation_cleanup
Systems: docs;module_abbreviations

Docs-only cleanup removing the `un` / Unknown entry from the `.github/README.md` module abbreviation table. The removed row explicitly said `un` was not an actual folder in the original code, so the PR makes the README's module list better reflect real source/module structure.

Postmortem JSON: `pr-2555/postmortem.json`

## PR #2549: refine splits and match and link itmaplib.c

Status: agent_completed
Type: decomp-matching
Systems: item;config;build;fighter;stage;db

Refined item TU boundaries by splitting common-item data out of it_2725 into new it_3F14.c/.h, moving it_802759DC from ithitbox into itmaplib, and retuning itmaplib.c until it was marked Matching. The PR updated splits, symbols, build config, and broad include coverage; the bot reported +3072 matched code bytes and +8512 linked code bytes, with the PR body noting 19 remaining item TUs and 79 remaining item functions.

Postmortem JSON: `pr-2549/postmortem.json`

## PR #2548: Remove target funcs

Status: agent_completed
Type: tracking-file cleanup
Systems: repo-root;gr/granime

Deleted the repo-root target_funcs.txt tracking file after all listed src/melee/gr/granime.c grAnime targets were marked complete; the decomp.dev GALE01 report showed no output changes.

Postmortem JSON: `pr-2548/postmortem.json`

## PR #2547: Merge multiple PRs

Status: agent_completed
Type: asm_to_c_decompilation_and_cleanup
Systems: item;items/itnessyoyo;stage;stage/grcastle

Bulk merge with no PR body or review discussion captured. The diff decompiled Ness yoyo item logic by replacing a MWERKS_GEKKO inline-asm-only implementation plus NOT_IMPLEMENTED fallback for it_2725_Logic59_EvtUnk with C, and cleaned up grCastle_801CDFD8 by removing redundant locals while preserving the same random range and castle9 field initialization behavior.

Postmortem JSON: `pr-2547/postmortem.json`

## PR #2546: resplit it_2725.c

Status: agent_completed
Type: translation-unit-resplit
Systems: item;fighter;ground;stage;baselib;config

Large item-system resplit of the monolithic src/melee/it/it_2725.c into smaller translation units: it_2725, ithitbox, itmaplib, itmaterial, iteffect, itanimlist, it_279C, and itzako. The PR body says the split was driven by repeated floats/strings plus filename evidence such as __assert("itmaplib.c", ...), __assert("itanimlist.c", ...), struct it_MObjInfo it_803F1F90, and the "can t init zako pos\n" string. All new units were matching and linked except itmaplib, which was intentionally left NonMatching in configure.py. This improved item decomp organization and decomp.dev reported +4396 matched code bytes, +34912 linked code bytes, +17004 matched data bytes, and +17212 linked data bytes.

Postmortem JSON: `pr-2546/postmortem.json`

## PR #2545: Decompile it_2725_Logic59_EvtUnk

Status: agent_completed
Type: decompilation
Systems: item;nessyoyo

Decompiled the Ness Yo-Yo item callback it_2725_Logic59_EvtUnk in src/melee/it/items/itnessyoyo.c, replacing the MWERKS_GEKKO inline assembly and NOT_IMPLEMENTED fallback with matching C. The important matching detail was preserving an otherwise unused comparison after it_8026B894 by reading xDD4_itemVar.nessyoyo.x10 through a volatile pointer and comparing it to ref_gobj. decomp.dev reported GALE01 had no changes.

Postmortem JSON: `pr-2545/postmortem.json`

## PR #2544: Make grCastle_801CDFD8 match

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;castle

Matched the stage function grCastle_801CDFD8 by simplifying its C in src/melee/gr/grcastle.c. The PR body says this was a minor cleanup that moved the function from a 99.84% match to 100%. The diff removed redundant temporaries for params, constants, base value, and final_value, replacing them with direct grCs_804D6970 field reads and literal assignments.

Postmortem JSON: `pr-2544/postmortem.json`

## PR #2543: Decompile grCastle_801CE19C

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grCastle

Decompiled the Castle stage function grCastle_801CE19C and removed related inline assembly for manipulating the flag byte at gp+DE by converting grCastle_GroundVars9.xDE into a named bitfield xDE_b0. The PR also updated nearby Castle code paths to set and clear this flag through the struct field, preserving the match with small stack-padding adjustments.

Postmortem JSON: `pr-2543/postmortem.json`

## PR #2542: Add MetroTRK exception vector assembly

Status: agent_completed
Type: assembly_split_decomp_matching
Systems: MetroTRK;MetroTRK exception vectors;.init;GALE01 splits;Nix build;decomp-toolkit/binutils

Added a dedicated assembly split for the MetroTRK exception vector table in `.init`, covering `0x80003298` through `0x800051CC`. The PR represented the region as `src/MetroTRK/__exception.s` rather than C because it is layout-sensitive and mixes embedded bytes, labels, instructions, and fixed-size gaps. It also updated GALE01 splits and fixed the Nix build by passing a packaged binutils path to `configure.py`, avoiding dtk's network-time assembler download in the sandboxed Nix build. decomp.dev reported one new 100% match worth 7988 bytes.

Postmortem JSON: `pr-2542/postmortem.json`

## PR #2541: Match hsd_803A949C (92%)

Status: agent_completed
Type: decomp-matching
Systems: src;sysdolphin;baselib;CARD

Matched more of the sysdolphin baselib memory-card async callback hsd_803A949C. The diff re-modeled command-buffer access through CMD_* offset macros over hsd_804D1138, reused the shared CardState layout with file_info and digest fields, marked the command index hsd_804D7980 volatile, and updated the callback prototype to take chan plus arg1. decomp.dev reported hsd_803A949C improving from 58.78% to 93.40% (+1679 bytes), though the PR title says 92%.

Postmortem JSON: `pr-2541/postmortem.json`

## PR #2540: Jj/sislib

Status: agent_completed
Type: decomp-matching
Systems: src;sysdolphin;baselib;sislib

Advanced matching for sysdolphin/baselib sislib by implementing and cleaning several SIS text encoding, append/replace, state-stack, line-measure, and renderer opcode paths. The PR changed src/sysdolphin/baselib/sislib.c and the HSD_SisLib_803A7684 prototype in sislib.h; decomp-dev reported seven unmatched-item improvements, including HSD_SisLib_803A7684 0.00%->55.05%, HSD_SisLib_803A70A0 0.00%->78.79%, HSD_SisLib_803A6B98 51.49%->87.35%, HSD_SisLib_803A7F0C 67.41%->97.87%, and HSD_SisLib_803A84BC 66.31%->89.15%.

Postmortem JSON: `pr-2540/postmortem.json`

## PR #2539: Jj/vi0501 and psdisp

Status: agent_completed
Type: decomp-matching
Systems: src/melee/vi/vi0501;src/sysdolphin/baselib/psdisp;repo-root/target_funcs

Merged decomp-matching work for melee/vi0501 and sysdolphin/baselib/psdisp. The PR implemented most of un_8031D9F8, fully matched particleSort, and substantially improved psDispParticles by restoring particle batching, cache/register behavior, and more exact GX rendering branches. decomp-dev reported matched code +1048 bytes, particleSort 92.88% -> 100.00%, un_8031D9F8 0.00% -> 98.83%, and psDispParticles 39.03% -> 58.06%. It also deleted a stale target_funcs.txt file containing mncharsel targets.

Postmortem JSON: `pr-2539/postmortem.json`

## PR #2538: Jj/ifprize

Status: agent_completed
Type: decomp-matching
Systems: src/melee/if/ifprize.c;interface prize screen;HSD GObj/JObj/Text;gm main/lib;lb audio/lang

Reconstructed major parts of src/melee/if/ifprize.c, replacing placeholder calls with real prize-interface state-machine, setup, text, audio, and cleanup logic. The decomp.dev report recorded +1116 matched bytes: fn_802FE470 and un_802FE6A8 became 100% matches, while un_802FE918 and un_802FEBE0_OnEnter improved to near-match status; the only noted downside was a .data regression.

Postmortem JSON: `pr-2538/postmortem.json`

## PR #2537: Jj/ifstatus

Status: agent_completed
Type: decomp-matching
Systems: src/melee/if/ifstatus;damage percent HUD;player damage and stamina display;stock HUD integration;if status elements

Implemented and improved several src/melee/if/ifstatus damage/status HUD routines. The PR replaced multiple NOT_IMPLEMENTED stubs or placeholders, updated real function prototypes, and corrected IfDamageState damage fields to signed s16 for -1 sentinels. decomp.dev reported GALE01 matched code +0.04% / +1664 bytes with four new ifstatus matches; there was no PR body or human review text in the slice, so intent is inferred from the diff and automated match report.

Postmortem JSON: `pr-2537/postmortem.json`

## PR #2536: Jj/mncharsel3

Status: agent_completed
Type: menu-character-select-decomp-matching
Systems: src/melee/mn/mncharsel;character-select-screen;CSS menu state;HSD baselib scene setup;HSD SisLib text

Large mncharsel character-select decomp/matching PR centered on adding a typed C implementation of mnCharSel_802640A0, tightening several nearby CSS functions, and introducing header/type fixes for CSS scene assets and SisLib text state. The bot report shows main/melee/mn/mncharsel mnCharSel_802640A0 improved from 0.00% to 86.22%, with smaller mncharsel gains in fn_802633B0, mnCharSel_8025FDEC, mnCharSel_8025FB50, fn_8025F0E0, fn_80262648, mnCharSel_8025D1C4, mnCharSel_CursorThink, and mnCharSel_8025DB34.

Postmortem JSON: `pr-2536/postmortem.json`

## PR #2535: Jj/mndiagram

Status: agent_completed
Type: decomp-matching
Systems: melee/mn/mndiagram;melee/mn/mndiagram2;melee/mn/mndiagram3;menu statistics diagram

Matching-oriented pass over the mnDiagram menu/stat screens. The PR reworked main diagram input/navigation, popup animation/text placement, stat-detail screens, and static data headers using typed overlays instead of raw address arithmetic. decomp.dev reported +184 matched bytes, one new full match for `mnDiagram_PopupAnimProc`, and major unmatched-item improvements, especially `fn_802461BC` and `mnDiagram_InputProc`; it also reported one broken match in `mnDiagram3_80247008`.

Postmortem JSON: `pr-2535/postmortem.json`

## PR #2534: Jj/rest of gr

Status: agent_completed
Type: decomp-matching
Systems: ground;stage;grgreens;grpura;grpushon;camera;lighting

Matched and improved several remaining ground/stage routines across Greens, Pura, and Push On. The PR added real C for Pura background/camera-subject logic, Push On light-selection and region-check logic, and several Greens block/bomb matching rewrites, plus header/type cleanup and a data-symbol split. decomp.dev reported +1960 matched code bytes, +32 matched data bytes, 8 new matches, 17 unmatched-item improvements, and 2 small Greens regressions.

Postmortem JSON: `pr-2534/postmortem.json`

## PR #2533: Continued item progress

Status: agent_completed
Type: decomp-matching
Systems: item;item-collision;character-items;config;symbols

Broad item decomp/matching pass across 25 files. The PR body only states progress counters, but the bot report gives strong evidence of impact: +14,840 matched-code bytes, +15,092 linked-code bytes, 32 new matches, and 34 improvements in unmatched items. The biggest milestone was promoting `src/melee/it/items/itbombhei.c` from NonMatching to Matching in `configure.py`; many other item, item collision, data-symbol, and header layout tweaks improved remaining item work.

Postmortem JSON: `pr-2533/postmortem.json`

## PR #2532: Jj/grbigblueroute 2

Status: agent_completed
Type: stage decompilation/matching
Systems: stage;ground;Big Blue;Big Blue Route;F-Zero car route

Big Blue Route stage work that replaced several raw Ground offset accesses with typed route/car struct views, implemented the previously stubbed grBigBlueRoute_8020CD20 route-entry update state machine, and improved multiple matching targets. The decomp.dev bot reported four new 100% function matches in grbigblueroute, CD20 rising from 0.00% to 89.73%, and C85C improving slightly, with a remaining .sdata regression.

Postmortem JSON: `pr-2532/postmortem.json`

## PR #2531: Jj/gricemt

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Ice Mountain;gricemt;GALE01 symbols

Advanced matching for the Ice Mountain stage file `gricemt`, with struct/layout corrections, real implementations for several callbacks and helpers, and a symbol-boundary fix around `fn_801F9150`/`fn_801F91A4`. The decomp.dev report shows +3844 matched bytes, +0.10% matched code, 13 new matches, and 11 additional improvements in `main/melee/gr/gricemt`.

Postmortem JSON: `pr-2531/postmortem.json`

## PR #2530: Jj/granime 2

Status: agent_completed
Type: decomp-matching
Systems: stage;ground/granime;baselib-animation;repo-root target tracking

Advanced the stage granime decomp in src/melee/gr/granime.c, adding concrete C for grAnime_801C752C, grAnime_801C7C1C, and grAnime_801C8578 while improving nearby matching for grAnime_801C6A54, grAnime_801C7228, and grAnime_801C86D4. The PR also replaced a dont_inline pragma with _inner/_noinline inline-wrapper matching helpers, typed stage archive animation-array fields in UnkStageDat_x8_t, and tightened granime.h prototypes. The PR body and human review comments were empty; decomp.dev reported 3 new 100% matches and 3 unmatched-item improvements.

Postmortem JSON: `pr-2530/postmortem.json`

## PR #2529: gm_1601

Status: agent_completed
Type: decomp-matching
Systems: game-mode;match-end;vs-mode;persistent-name-tags;player-setup

Large gm_1601 decomp/matching PR split out from jj/the-big-gm-pr. It replaces many gm_1601.c stubs with C implementations, tightens gm_1601.h prototypes, and exposes a few previously padded struct fields in gm/types.h. The work covers match-end standings/stat accumulation, persistent nametag stats, VS match counters, winner/loser ranking, player/team result merging, special spawn/player setup paths, character/costume selection helpers, and language-dependent name text helpers. The decomp.dev bot reported +1624 matched bytes, 2 new exact matches, and 18 improved unmatched items, with no human review comments in this slice.

Postmortem JSON: `pr-2529/postmortem.json`

## PR #2528: Jj/the big gm pr

Status: agent_completed
Type: decomp-matching game-mode function implementation
Systems: game-mode;event-match;gm_1BA8;gm_18A5;all-star;camera;opening;results;background-flash;sysdolphin-sislib

Large game-mode decomp/matching PR centered on gm_1BA8 event/game-mode logic, with additional matching work in gm_18A5, All-Star, camera, opening, results, background flash, and sislib. The PR body and human review text were empty, but the diff shows several previously stubbed functions implemented and headers/library prototypes adjusted. decomp.dev reported +572 matched code bytes, +24 data bytes, 3 new matches, 17 unmatched-item improvements, and one small gmopening .sdata2 regression.

Postmortem JSON: `pr-2528/postmortem.json`

## PR #2527: Jj/ft 0 c31

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;item;config

Merged fighter decomp PR that split the later half of `src/melee/ft/ft_0C31.c` into ten address-named `ftCo_800C....c` units, promoted `ft_0C31.c` and the new units to Matching in `configure.py`, and filled in capture/downreflect/fighter-state code that had previously been left in the monolithic file. The diff also narrowed `ft_0C31.h`, added per-slice headers, fixed motion-var fields and item signatures needed by the new code, and updated GALE01 splits/symbols. The PR body is empty, but the decomp.dev bot reports 55 new matches and net +2192 matched-code bytes.

Postmortem JSON: `pr-2527/postmortem.json`

## PR #2526: Jj/ftcpuattack

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftcpuattack;CPU attack selection;fighter common;item hit/collision avoidance

Large ftcpuattack decomp slice for fighter CPU attack selection. It replaced four nonmatching stubs with C for ftCo_800B4AB0, ftCo_800B52AC, ftCo_800B5AB0, and ftCo_800B77E8, reconstructed local attack/object structs, and adjusted the ftCo_800B5AB0 call signature plus Fighter_x1A88_t::x50 typing. decomp.dev reported seven improvements in main/melee/ft/ftcpuattack, with the new functions reaching roughly 88-94% rather than full match; there was no human PR body or review feedback in the slice.

Postmortem JSON: `pr-2526/postmortem.json`

## PR #2525: Jj/plbonus

Status: agent_completed
Type: decomp-matching
Systems: melee/pl/plbonus;player stats;stale move table;melee-core

Decompiled most of src/melee/pl/plbonus.c's fn_80039618, a large player bonus/stat flagging routine, while refining pl_804D6470_t threshold fields needed by the implementation. The PR also forced fn_80038700 not to inline and changed fn_8003CC84 digit extraction arithmetic, which the bot report says made fn_8003CC84 fully match. decomp.dev reported GALE01 matched code +2980 bytes and matched data +456 bytes, with plbonus .data and .sdata2 reaching 100% and fn_80039618 improving from 0.00% to 99.67%. There was no substantive PR body or human review feedback in the slice.

Postmortem JSON: `pr-2525/postmortem.json`

## PR #2524: Jj/ft co 0 a01

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;cpu-ai;stage;collision;items;camera

Large ftCommon CPU/AI decompilation pass for src/melee/ft/chara/ftCommon/ftCo_0A01. The PR replaced many /// # stubs with C, added stage/camera/vector includes, tightened header prototypes, and advanced common fighter AI logic around recovery destinations, stage/blast-zone checks, item/target selection, and CpuCmd command dispatch. decomp.dev reported +7324 matched bytes, 11 new 100% matches, 25 partial improvements, and one ftCo_800A2718 regression.

Postmortem JSON: `pr-2524/postmortem.json`

## PR #2523: Jj/plbonus

Status: agent_completed
Type: decomp-matching
Systems: melee/pl;plbonus;player bonus;player stats;melee-core

Draft PR against plbonus that was closed without merge. It replaced the `/// #fn_80039618` placeholder with a large C implementation for player bonus/stat flag calculation, typed more of `pl_804D6470_t`, added a `dont_inline` guard around `fn_80038700`, and adjusted `fn_8003CC84` digit arithmetic. The decomp-dev bot reported +1640 matched code bytes, +456 matched data bytes, full matches for plbonus `.data`, `.sdata2`, and `fn_8003CC84`, plus `fn_80039618` reaching 99.67%, but there was no human review feedback in the slice.

Postmortem JSON: `pr-2523/postmortem.json`

## PR #2522: Link Crazy Hand

Status: agent_completed
Type: linking_object_split
Systems: fighter;ftCrazyHand;ftMasterHand;ftCommon;config/GALE01

Split the monolithic Crazy Hand translation unit into many per-motion ftCh_* units, converted Crazy Hand from one NonMatching object to address-ordered Matching objects in configure.py, and updated GALE01 splits/header includes accordingly. The automated decomp.dev report showed a large linking gain for GALE01: linked code +24,328 bytes, linked data +2,432 bytes, matched data +2,416 bytes, and 293 new matches; the many reported broken matches were mostly the old ftCh_Init unit losing symbols that reappeared under the new ftCrazyHand units.

Postmortem JSON: `pr-2522/postmortem.json`

## PR #2521: Link CrazyHand

Status: agent_completed
Type: closed_unmerged_empty_pr
Systems: CrazyHand title-only;ftCh branch-name-only

Closed, unmerged PR titled "Link CrazyHand" with no body, comments, reviews, changed files, or diff content in the available slice. The only technical hints are the title and head branch name `link_ftch_init`; no actual Crazy Hand linking change is evidenced.

Postmortem JSON: `pr-2521/postmortem.json`

## PR #2520: Link itmasterhandlaser

Status: agent_completed
Type: decomp-matching
Systems: item;Master Hand laser item;build configuration

Linked the Master Hand laser item unit by adding the missing `ItemStateTable it_803F9378` data object in `itmasterhandlaser.c` and flipping that file from `NonMatching` to `Matching` in `configure.py`. The decomp.dev report showed one new `.data` match for `main/melee/it/items/itmasterhandlaser`, moving that unit's `.data` from 0.00% to 100.00%.

Postmortem JSON: `pr-2520/postmortem.json`

## PR #2519: Link lbarchive

Status: agent_completed
Type: decomp-matching
Systems: lbarchive;melee/lb;GALE01 config;build configuration

Linked `melee/lb/lbarchive.c` by making two nearly-matching archive loader call sites fully matching. The PR changed `lbArchive_80017040` and `lbArchive_800171CC` to inline the `lbArchive_LoadArchive` sequence, updated GALE01 symbol scopes/labels for nearby lbarchive data strings, and changed `configure.py` so `lbarchive.c` is built as `Matching` instead of `Equivalent`. The decomp.dev report recorded 2 new matches and improvements of +768 matched code bytes, +2664 linked code bytes, and +192 linked data bytes.

Postmortem JSON: `pr-2519/postmortem.json`

## PR #2518: Link grzebesroute

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Zebes route;lighting;HSD baselib;GALE01 symbols;configure.py

Linked the Zebes route stage object by changing `melee/gr/grzebesroute.c` from NonMatching to Matching and finishing `grZebesRoute_8020B548`. The fix used inline helper wrappers, `HSD_ASSERT`, `__FILE__`, direct float/GXColor literals, and symbol-map demotions to local compiler labels. decomp.dev reported one new match: `main/melee/gr/grzebesroute` / `grZebesRoute_8020B548` improved from 99.97% to 100.00%, with linked code/data increases.

Postmortem JSON: `pr-2518/postmortem.json`

## PR #2517: Scene nomenclature cleanup

Status: agent_completed
Type: nomenclature_cleanup
Systems: game-mode;game-scene;scene-routing;gm;menus;interface;library;tooling;config/GALE01

Behavior-neutral repo-wide scene nomenclature cleanup. The PR replaced ambiguous Major/Minor scene terminology with GameMode/GameScene naming across gm headers, structs, enum constants, scene routing state, data table symbols, call sites, and table-typer tooling. The stated goal was to clean up ambiguous definitions of "Minor" and "Major"; decomp.dev reported GALE01 "No changes," supporting that this was a matching-preserving rename/refactor.

Postmortem JSON: `pr-2517/postmortem.json`

## PR #2516: Incremental item progress

Status: agent_completed
Type: decomp-matching
Systems: item;stage-items;ground;library;config

Large incremental item decompilation pass focused on matching item translation units. The PR marked itsscope.c and it_2E5A.c as Matching, advanced many near-matching item functions/data sections, updated item and command-script types, and corrected several data/sdata/sdata2 symbol scopes. The author explicitly framed the code as rough but useful progress toward matching all item TUs, with 21 item TUs and 112 item functions still remaining. decomp.dev reported +0.40% matched code, +15,688 matched bytes, 31 new matches, and 59 improvements, while also flagging one broken itmewtwoshadowball .sdata2 match.

Postmortem JSON: `pr-2516/postmortem.json`

## PR #2515: lb: improve lbcollision capsule-collision matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;collision

One-file lbcollision matching pass focused on capsule/capsule collision math. The PR renamed and documented the 3D capsule solver lbColl_80006E58 by hit/hurt roles, rewrote closest-point and broadphase locals to improve MWCC register/stack behavior, removed the local lbColl_JObjGetMtxPtr wrapper in favor of HSD_JObjGetMtxPtr, factored repeated debug drawing into lbColl_DrawHitResult, and improved multiple match percentages. Four draw-related functions reached 100%; lbColl_80006094, lbColl_800067F8, and lbColl_80006E58 remained below 100% due to residual float-register-allocation mismatches.

Postmortem JSON: `pr-2515/postmortem.json`

## PR #2514: Remove PR template

Status: agent_completed
Type: repository_workflow_cleanup
Systems: GitHub pull request workflow;repository documentation

Removed the repository's GitHub pull request template. The deleted file only contained a one-line reminder to read CONTRIBUTING.md before submitting a PR, so this was a repository workflow/documentation cleanup rather than a decompilation or source-code change.

Postmortem JSON: `pr-2514/postmortem.json`

## PR #2513: Add `pull_request_template` and AI guidelines

Status: agent_completed
Type: documentation-process-guidelines
Systems: docs;github;contributing

Process/documentation PR that added a GitHub pull request template pointing contributors to the contributing guidelines, and expanded `.github/CONTRIBUTING.md` with explicit AI assistance rules for decomp work. The new guidance allows AI for function/code matching but sets boundaries around naming, data-section matching, PR/comment content, and automated reviews.

Postmortem JSON: `pr-2513/postmortem.json`

## PR #2512: jj/hsd_3AA7 2

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin/baselib;melee/lb;dolphin/CARD

Large decomp/matching pass for sysdolphin/baselib hsd_3AA7, centered on GameCube memory-card command queue, CARD I/O, block maps, headers/icons, and digest/status handling. The PR expanded CardState and related local structs, replaced multiple hsd_3AA7 placeholder stubs with C, updated callers from the old hsd_803AC3E0_arg0_t mini-struct to CardState, and produced an automated decomp.dev gain of +1340 matched bytes with 3 new full matches.

Postmortem JSON: `pr-2512/postmortem.json`

## PR #2511: jj/tylist2

Status: agent_completed
Type: decomp-matching
Systems: melee/ty;trophy-list;toy;HSD JObj/Text

Trophy-list decomp/matching PR centered on src/melee/ty/tylist.c. It converted several raw trophy-list fields into typed arrays/struct fields, consolidated ToyGlobalsS_ into a shared header, matched five tylist functions, and replaced the un_80313774 placeholder with a partial C implementation. The decomp.dev bot reported +2552 matched bytes and new 100% matches for un_803124BC, un_8031263C, un_8031305C, un_80313508, and fn_8031438C; un_80313774 improved from 0% to 62.48%. There was no PR body or human review text in the slice.

Postmortem JSON: `pr-2511/postmortem.json`

## PR #2510: Match `mnEvent_8024CE74`

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn;menu-event

Matched `mnEvent_8024CE74` by restoring a `static inline` `mnEvent_CountUnlocked()` wrapper around the unlocked-event count loop. The semantic code stayed nearly identical, but MWCC codegen changed the zero-initialization pattern from two independent `li` instructions to the expected data-dependent register copy, taking the function from 99.42%/99.4% to 100% with no other functions affected.

Postmortem JSON: `pr-2510/postmortem.json`

## PR #2509: lb: match fn_80026650 (100%), improve fn_800268B4 and lb_8000FD48

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbaudio_ax;lb_00F9;audio;dynamics-data

Matched `fn_80026650` in `lbaudio_ax.c` by using direct named extern arrays instead of fields off the `lbl_80433710` struct anchor, modestly improved `fn_800268B4` with the same extern swap plus a pointer-increment loop form, and improved `lb_8000FD48` by extracting repeated `DynamicsData` free-list pop logic into `popDynamicsData`. The PR was verified with `python configure.py && ninja` and per-function `tools/checkdiff.py`; the slice contains no human review comments.

Postmortem JSON: `pr-2509/postmortem.json`

## PR #2508: lb: implement lb_80019628; improve four lbbgflash functions

Status: agent_completed
Type: decomp-matching
Systems: lb;lb_0192;lbbgflash;pad sampling;OS alarm;HSD JObj rotation

Implemented a first C body for `lb_80019628`, moving it from asm-only to 82.58% fuzzy, and made MWCC-oriented matching tweaks in `lbbgflash.c`. The main reusable value is compiler-control tactics: scoped exact-type locals, source-order arithmetic changes, and a narrow `volatile` pointer to preserve inline assert code; no function reached 100% match in this PR.

Postmortem JSON: `pr-2508/postmortem.json`

## PR #2507: lb: improve fn_80027488 matching, tidy a few header signatures

Status: agent_completed
Type: decomp-matching
Systems: lb;lb-audio;lb-cardgame;library

Improved the fuzzy match for lb audio function fn_80027488 by referencing standalone extern arrays at known symbol addresses instead of struct-field aliases, and cleaned several lb headers by replacing UNK_RET/UNK_PARAMS placeholders with explicit void signatures already used by the C files. No function reached 100%, but decomp.dev reported fn_80027488 improving from 89.55% to 94.86%, with build verification green.

Postmortem JSON: `pr-2507/postmortem.json`

## PR #2506: lb: name THP header fields and float constants in lbmthp

Status: agent_completed
Type: naming/readability follow-up
Systems: library;lb;lbmthp;THP movie playback

Readability/naming follow-up for `lbmthp`: `THPDecComp` THP header unknowns were renamed to semantic fields, repeated float literals were represented as named `.sdata2` constants, and `fn_8001EBF0` gained a small fuzzy-match improvement from 98.77% to 99.23% by folding `ALIGN_32` into a single assignment. No new 100% function matches were claimed. Reviewer approved but cautioned that data-section matching is generally not worth prioritizing before the whole translation unit's code is matched.

Postmortem JSON: `pr-2506/postmortem.json`

## PR #2505: lb: improve lb_00CE matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb

Improved matching in `src/melee/lb/lb_00CE.c`: `powi` was changed to a natural exponent loop and became a full match, while `lb_8000D148` had its float geometry arithmetic reordered/split to improve fuzzy match from about 86.3% to about 98.9% while preserving the intended stack frame shape. Verification included targeted `checkdiff` runs and a full GALE01 build.

Postmortem JSON: `pr-2505/postmortem.json`

## PR #2504: lb: improve lbmthp matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbmthp;THP movie playback

Improved lbmthp matching by typing static data, THP decode state, and Movieplayer file/buffer fields, then restructuring several lbmthp helpers around those types and names. The PR also fixed the THPVideoDecode fourth parameter from an integer-style argument to a void pointer and updated the lb call site.

Postmortem JSON: `pr-2504/postmortem.json`

## PR #2503: lb: improve lbcollision matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbcollision

Improved matching in src/melee/lb/lbcollision by bringing lbColl_80005C44 and lbColl_80009DD4 to 100%, restoring/improving lbColl_8000A78C and nearby collision/debug draw helpers, and fixing lbColl_80006E58 so collision distance is written through the explicit float output parameter. The decomp.dev bot reported +1016 matched bytes overall, with 2 new matches and 7 unmatched-item improvements.

Postmortem JSON: `pr-2503/postmortem.json`

## PR #2502: gr: fix Zebes Route param store

Status: agent_completed
Type: stage data-layout matching fix
Systems: stage;ground;Zebes Route

Fixed the Zebes Route stage parameter global by modeling `grZe_Route_804D6A60` as an 8-byte parameter store containing a params pointer plus padding, instead of as the params pointer itself. The PR also named the currently understood route params, `camera_timer` and `zako_spawn_chance`, and brought `grzebesroute` data sections including `.sbss` to 100% while leaving known function/TU fuzzy percentages unchanged.

Postmortem JSON: `pr-2502/postmortem.json`

## PR #2501: lb: improve lbshadow matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbshadow;shadow;spline

Improved matching in src/melee/lb/lbshadow.c for lbShadow_8000E9F0 and lbShadow_8000F38C. The PR adjusted spline parameter handling and tangent math, replaced a sqrtf call with a file-local __frsqrte-based helper, and made several variable lifetime/order changes to improve shadow update codegen. Automated decomp.dev reported lbShadow_8000E9F0 improving from 93.27% to 95.81% and lbShadow_8000F38C from 99.15% to 99.70%.

Postmortem JSON: `pr-2501/postmortem.json`

## PR #2500: Merge #2491, #2494-#2499

Status: agent_completed
Type: bulk_decomp_matching_merge
Systems: configure;stage/grheal;stage/grzebesroute;lb/lbarq;lb/lbcardnew;lb/lbheap;lb/lbmemory;lb/lbsnap

Bulk merge of #2491 and #2494-#2499, mainly decomp/matching work across stage files and lb library modules. The visible build change moved src/melee/gr/grheal.c from NonMatching to Matching. decomp.dev reported 22 new matches, including grHeal_8021F180, lbMemory_8001564C, grHeal_8021F70C, several lbsnap routines, grzebesroute data/rodata/sdata/sdata2, and +5172 matched-code bytes; grZebesRoute_8020B548 was implemented to 99.97% but still listed as an unmatched improvement.

Postmortem JSON: `pr-2500/postmortem.json`

## PR #2499: lb: improve lbarq matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbarq;ARQ

Closed, unmerged PR that improved lbarq decompilation by giving the ARQ node pool and state machine concrete types, replacing magic state/list indices with named enum values, and applying targeted matching controls such as scoped dont_inline and PAD_STACK. The PR body reported 100% matches for lbArq_80014ABC and lbArq_80014D2C, with lbArq_80014AC4 and lbArq_80014BD0 still partially drifting; the automated decomp.dev report confirmed lbArq_80014BD0 improved from 93.97% to 96.55%.

Postmortem JSON: `pr-2499/postmortem.json`

## PR #2498: lb: improve lbmemory matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbmemory;ARAM;baselib-devcom;OSAlarm

Closed-unmerged lbmemory matching PR that introduced typed allocator/layout fields, explicit data and sdata string symbols, and decompiled relocation/init paths. The bot reported +924 matched code bytes and +216 matched data bytes, with new matches for lbMemory_8001564C, fn_80015184, .data, and .sdata, plus lbMemory_80015320 improved to 96.11%. The PR body says the TU reached 10/12 matched functions, with lbMemory_80014FC8 and lbMemory_80015320 still differing in saved-register allocation and instruction scheduling.

Postmortem JSON: `pr-2498/postmortem.json`

## PR #2497: lb: improve lbheap matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbheap;lbmemory;heap-memory

Closed, unmerged PR that retuned src/melee/lb/lbheap.c for lbheap matching. It rewrote lbHeap_80015900 around heap create/destroy helpers, corrected the heap bounds scan to cover heaps 2-5, and changed lbHeap_80015F3C setup to preserve/achieve full matching. The author reported lbHeap_80015900 improving from 94.3% to 96.5% while keeping lbHeap_80015F3C at 100%; the decomp.dev bot reported +544 matched bytes overall, lbHeap_80015F3C becoming a 100% match, and lbHeap_80015900 improving to 96.48%.

Postmortem JSON: `pr-2497/postmortem.json`

## PR #2496: lb: improve lbcardnew snapshot listing

Status: agent_completed
Type: decomp-matching code-shape tweak
Systems: library;lb;lbcardnew

Closed, unmerged PR that proposed a code-shape improvement for `lb_8001B14C` in `lbcardnew.c`: remove a cached `lbCardNew_SnapshotEntry* snapshot_entries` local and write directly through `lb_80432A68.snapshot_entries`. The stated goal was closer target matching; decomp.dev reported `main/melee/lb/lbcardnew` `lb_8001B14C` improving from 63.23% to 98.77%, with the remaining diff described as an `r5`/`r6` allocation swap in a compiler-unrolled linked-list copy loop.

Postmortem JSON: `pr-2496/postmortem.json`

## PR #2495: lb: improve lbsnap matching

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbsnap;memory-card-snapshots;snapshot-icon-data

Closed, unmerged PR that improved `src/melee/lb/lbsnap.c` matching by replacing placeholder-style code and signatures with typed helpers, clearer control flow, and register-allocation-oriented locals. The PR body reports `main/melee/lb/lbsnap` at 20/22 functions 100%, with remaining blockers `lbSnap_8001DA5C` at 55.87963% and `lbSnap_8001DF20` at 98.15790%. The decomp.dev bot reported five new matches and one additional improvement in `lbSnap_8001DA5C`.

Postmortem JSON: `pr-2495/postmortem.json`

## PR #2494: gr: improve grzebesroute lighting

Status: agent_completed
Type: decomp-matching
Systems: stage;gr;grzebesroute;baselib-lobj

Closed, unmerged stage decomp PR that improved `src/melee/gr/grzebesroute.c` by naming Zebes Route light data, adding direct string/data references, and translating `grZebesRoute_8020B548` to 99.96923% per the author's checkdiff. The bot reported new full matches for grzebesroute `.data`, `.rodata`, `.sdata2`, `.sdata`, and `grZebesRoute_8020B260`, plus `grZebesRoute_8020B548` improving from 0.00% to 99.97%. Known remaining drift was limited to three `GXColor` by-value stack temp offsets.

Postmortem JSON: `pr-2494/postmortem.json`

## PR #2493: Match hsd_80394314

Status: agent_completed
Type: closed-unmerged automation/symbol-mismatch
Systems: sysdolphin;baselib;particle

Closed unmerged. The PR was opened as an exact-match attempt for `hsd_80394314`, but the only diff changed the linkage of the particle BSS symbol `hsd_804CF810` in `src/sysdolphin/baselib/particle.static.h`. The author closed it as a bad HERMES/local-runner draft after confirming the title/body target symbol did not match the actual changed symbol and that the decomp-dev bot's "No changes" verdict for `hsd_80394314` was correct.

Postmortem JSON: `pr-2493/postmortem.json`

## PR #2492: ft: improve Crazy Hand init command dispatch

Status: agent_completed
Type: decomp-matching cleanup/fix
Systems: fighter;Crazy Hand;ftCrazyHand

Draft PR improving the unmatched Crazy Hand init dispatcher `ftCh_Init_80156AD8`. It corrected the human command button mapping, especially the A/Z dispatch swap, changed pad-button checks to a style closer to the matched Master Hand dispatcher, and replaced raw `0`/`2` float literals with named data symbols. It improved the decomp.dev/checkdiff score from about 98.86% to 98.99% but remained non-matching due to pad-word register allocation drift. The PR was closed unmerged after a collaborator commented that the work was already done.

Postmortem JSON: `pr-2492/postmortem.json`

## PR #2491: gr: match grheal

Status: agent_completed
Type: decomp-matching
Systems: grheal;stage;ground;repo-root/configure.py;items;mpLib

Closed, unmerged PR that attempted to make `src/melee/gr/grheal.c` fully matching. It implemented the remaining `grheal` stage functions/data, moved required shared data typing into `grheal.h`, and flipped `configure.py` from `Object(NonMatching, "melee/gr/grheal.c")` to `Object(Matching, "melee/gr/grheal.c")`. The PR body reports `python configure.py && ninja`, `main.dol: OK`, and `main/melee/gr/grheal: 100.0% fuzzy, 34/34 matched`; the decomp.dev bot reported seven new matches including `grHeal_8021F180`, `grHeal_8021F70C`, `.data`, `.rodata`, `.sbss`, `.sdata`, and a final byte for `grHeal_8021EFEC`. The dump does not explain why it was closed without merge.

Postmortem JSON: `pr-2491/postmortem.json`

## PR #2490: lbmemory and lb_80019628

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbmemory;lb_0192

Draft PR closed without merge that added missing library decomp work for `lb_80019628`, `lbMemory_80015320`, and `lbMemory_8001564C`, plus a small `fn_80015184` matching improvement. The bot reported `fn_80015184` reaching 100%, large partial improvements for the new functions, but also broken matches/regressions in nearby `lbmemory` items, so this is useful as a reference attempt rather than an accepted final solution.

Postmortem JSON: `pr-2490/postmortem.json`

## PR #2489: Match progress

Status: agent_completed
Type: decomp-matching
Systems: game-mode;results-screen;debug-menu;audio

Draft PR matching one game-mode/debug-results function: gm_801B0DD0 in src/melee/gm/gm_1B03.c. The implementation loads cached debug/sound-test match parameters from un_803FA258 into DebugResultsData, rebuilds MatchEnd standings with gm_80166A98, derives a character victory-fanfare bitmask from non-CPU/valid non-big-loser standings, plays result audio setup calls, then advances results initialization. The accompanying static header replaces a raw 0x2284-byte pad for DebugResultsData with the fields needed by the matched function plus a MatchEnd member. decomp.dev reported 1 new match, +332 bytes, and overall matched code 66.99% (+0.01%).

Postmortem JSON: `pr-2489/postmortem.json`

## PR #2488: sysdolphin: split hsd_3B34 JPEG routines

Status: agent_completed
Type: translation-unit-split-nonmatching-decomp
Systems: sysdolphin/baselib;JPEG routines;GALE01 splits;configure.py

Split the sysdolphin/baselib hsd_3B34 JPEG range into hsd_3B34 and new hsd_3B5C translation units at hsd_803B5C4C, added large nonmatching C bodies and raw JPEG table data for both TUs, registered the new object in the build, and kept hsd_803B5C2C matching while improving surrounding fuzzy/data matches.

Postmortem JSON: `pr-2488/postmortem.json`

## PR #2487: ty/toy.c matches

Status: agent_completed
Type: decomp-matching
Systems: ty/toy;trophy gallery/toy collection;light object loading;SIS text display;GALE01 symbols

Large ty/toy.c matching pass. The PR body says it brought toy.c to 52/70 matched functions, typed and renamed the light-object loader as Toy_LoadLObjList, and verified with ninja progress and diff_changes.py. decomp.dev reported GALE01 matched code at 66.98% (+0.23%, +8928 bytes), with 13 new toy.c matches and 18 further improvements. The slice contains no human review comments.

Postmortem JSON: `pr-2487/postmortem.json`

## PR #2486: hsd3B34 and lbmemory

Status: agent_completed
Type: decomp-matching
Systems: melee/lb;sysdolphin/baselib;Dolphin OSAlarm

First-time contributor PR that ultimately landed a partial lbmemory decomp: fn_80015184 was added as an OSAlarm callback-style function that copies memory in capped chunks from a manager at &g_alloc + 0x6A0, asserts on zero size, invokes a completion callback, or reschedules an alarm. The PR also exported the prototype and added address comments to hsd_3B34.h. Reviewer feedback says the hsd_3B34 function work was superseded by higher-scoring work in #2488, but lbmemory could still merge.

Postmortem JSON: `pr-2486/postmortem.json`

## PR #2485: sobjlib: decompile SObj setup and render paths

Status: agent_completed
Type: decomp-matching
Systems: src/sysdolphin/baselib/sobjlib;src/sysdolphin/baselib/tobj;extern/dolphin/gx;SObj;GX/TEV rendering

Merged SObjLib decompilation PR implementing the SObj setup path and most of the SObj render path. The PR body reports HSD_SObjLib_803A477C and HSD_SObjLib_803A55DC at 100%, HSD_SObjLib_803A4A68 as a 99.88707% near-match, and .data/.sdata2 at 100%. It also added SObj descriptor/color typing and corrected Dolphin GX texture format typing so CI texture setup can use GXTexFmt directly.

Postmortem JSON: `pr-2485/postmortem.json`

## PR #2484: Match HSD_ByteCodeEval

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin/baselib/bytecode;sysdolphin/baselib/robj

Matched HSD_ByteCodeEval in sysdolphin/baselib/bytecode.c through small codegen-sensitive rewrites, local type/signature cleanup, and synchronized prototypes in bytecode.h and robj.c. The decomp.dev report confirmed HSD_ByteCodeEval moved from 99.92% to 100.00% and the overall GALE01 matched-code metric increased by 5640 bytes.

Postmortem JSON: `pr-2484/postmortem.json`

## PR #2483: Decompile more lbcardnew functions

Status: agent_completed
Type: decomp-matching
Systems: melee/lb/lbcardnew;melee/lb/lbsnap;melee/lb/types;sysdolphin/baselib/card;compile-flags

PR 2483 decompiled and typed more of the lbcardnew memory-card snapshot path. It replaced the previous stub for lb_8001B14C with a partial snapshot scanner, introduced a shared lbCardNew_SnapshotEntry type, propagated meaningful snapshot/free-space names into lbsnap, refactored card-entry descriptor setup, and completed four near-matching lbcardnew functions per the decomp.dev report. The PR had no body or human review comments, so intent beyond the diff and bot match report is weak.

Postmortem JSON: `pr-2483/postmortem.json`

## PR #2482: mnsoundtest data cleanup

Status: agent_completed
Type: data-symbol-cleanup-for-matching
Systems: mn menu;mnSoundTest;mnDataDel;GALE01 symbols

Cleaned up mnSoundTest and mnDataDel menu data by splitting large anonymous .data blobs into typed objects, arrays, vectors, text IDs, and string labels, then updating C/header code to use those explicit symbols. The PR had no body and no human review comments, so intent is inferred from the diff and decomp.dev output. Automated results reported +280 matched code bytes, +1808 matched data bytes, 3 new matches, and 100% .data for both main/melee/mn/mndatadel and main/melee/mn/mnsoundtest.

Postmortem JSON: `pr-2482/postmortem.json`

## PR #2481: fixup misc lb data

Status: agent_completed
Type: decomp-matching split and data-layout fix
Systems: lb;lbmthp;lb_01F8;lb_00F9;lbshadow;lbsnap;lbrefract;config

Split the tail of lbmthp into a new matching lb_01F8 translation unit, moved the THP texture/SObj helper functions and their bss/sdata2 into that split, and fixed several lb data/string/layout details. The bot report showed +1232 matched code bytes, +480 matched data bytes, and 13 new matches, with apparent lbmthp regressions corresponding to functions moved into lb_01F8.

Postmortem JSON: `pr-2481/postmortem.json`

## PR #2480: link gamewatchparachute

Status: agent_completed
Type: decomp-matching
Systems: item;Mr. Game & Watch;GameWatch parachute;configure.py

Linked the Mr. Game & Watch parachute item unit by adding the missing ItemStateTable data definition, preserving/reordering callback bodies for object layout, and switching itgamewatchparachute.c from NonMatching to Matching in configure.py. The automated GALE01 report confirmed one new match for main/melee/it/items/itgamewatchparachute .data, +32 bytes from 0.00% to 100.00%, with linked code/data gains.

Postmortem JSON: `pr-2480/postmortem.json`

## PR #2479: Jj/hsd 3 b34

Status: agent_completed
Type: unmerged decomp-refactor attempt
Systems: src/sysdolphin/baselib;HSD JPEG;hsd_3B34;hsd_3B5C

Draft PR, closed unmerged, that attempted a large HSD JPEG decomp/refactor across sysdolphin/baselib hsd_3B34 and hsd_3B5C. It replaced much raw M2C/jmp-buffer-offset style code with an HSDJpegWork work-buffer struct, clearer DCT/IDCT-style transform loops, split lookup tables, revised prototypes, and a local JPEG bit-emission macro. The direction was useful for readability and semantic discovery, but decomp.dev reported broken matches and sizable regressions, especially hsd_3B34 .data and hsd_803B5C2C, so this PR is best treated as a cautionary/idea source rather than a landed matching fix.

Postmortem JSON: `pr-2479/postmortem.json`

## PR #2478: Jj/hsd 3 aa7

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin/baselib/hsd_3AA7;dolphin CARD memory-card I/O;sysdolphin/baselib/psdisp;melee/gm;melee/gr

Unmerged/superseded HSD 3AA7 decomp PR centered on sysdolphin baselib memory-card/CARD file-block handling. The diff rewrote fn_803AC3F8 to reach a bot-reported 100% match, added large partial C implementations for fn_803ADF90, fn_803AE7F8, and fn_803B0E9C, refined hsd_3AA7 header prototypes and CardState-like layouts, and made mostly style/formatting edits in psdisp, gm, and gr files. decomp.dev reported +352 matched bytes but also a fn_803B21E8 regression; the PR was closed without merge after a comment saying it was superseded by PR #2512.

Postmortem JSON: `pr-2478/postmortem.json`

## PR #2477: fixup sobjlib data

Status: agent_completed
Type: decomp-matching data-layout fix
Systems: sysdolphin;baselib;sobjlib;GALE01 config

Fixed SObjLib data layout and related prototypes by replacing a fake aggregate SObjLibData view with discrete globals/static data that better match the binary: GObjFunc/GObjFuncs tables, filename/string data, padding for the jumptable area, two HSD_Chan initializers, direct OSReport strings, and u16 width/height parameters for HSD_SObjLib_803A55DC. The automated decomp.dev report showed sobjlib .rodata reaching 100%, HSD_SObjLib_803A55DC reaching 100%, and improvements to .data and .sbss.

Postmortem JSON: `pr-2477/postmortem.json`

## PR #2476: link misc completed objects

Status: agent_completed
Type: decomp-matching/object-linking
Systems: GALE01 config;MSL;sysdolphin/baselib;sysdolphin/baselib/psappsrt;sysdolphin/baselib/bytecode;melee/mn

Linked several already-complete objects by updating build object status, compiler flags, GALE01 symbols/splits, and two small C source details. The automated decomp.dev report showed +2428 linked code bytes, +336 matched data bytes, +1288 linked data bytes, and 5 new matches, mostly for sysdolphin/baselib/psappsrt extab/extabindex/bss/sbss plus bytecode .data.

Postmortem JSON: `pr-2476/postmortem.json`

## PR #2475: split & link ft_081B, ft_084E

Status: agent_completed
Type: decomp_matching_module_split
Systems: fighter;config/GALE01;configure.py

PR 2475 split the tail range 0x80084E1C-0x8008521C out of `ft_081B` into a new fighter unit, `ft_084E`, and linked both objects as matching. The change moved 14 existing fighter movement/velocity helper functions into `src/melee/ft/ft_084E.c`, added `ft_084E.h`, adjusted GALE01 text and `.sdata2` split ranges/symbols, and changed `configure.py` so `ft_081B.c` and `ft_084E.c` are both `Object(Matching, ...)`; the decomp.dev bot reported +14052 linked-code bytes and 16 new matches.

Postmortem JSON: `pr-2475/postmortem.json`

## PR #2474: fix: the custom strcpy(char *dst, char *src) and str... in...

Status: agent_completed
Type: unmerged_header_api_change
Systems: external-sdk;dolphin;charPipeline;dolphinString

Unmerged automated security-fix PR that changed only the extern Dolphin charPipeline dolphinString header prototypes for Strcat and Strcpy by adding a u32 dst_size parameter. The PR body framed this as a critical bounds-checking fix, but the diff shows only declaration changes and no implementation or callsite updates, so evidence for an actual safe/matching fix is weak.

Postmortem JSON: `pr-2474/postmortem.json`

## PR #2473: misc gm matches

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm_1601;gm_16AE;gm_16F1;gmmain_lib;match-spawn-setup

Small game-mode decomp matching PR touching gm_1601, gm_16AE, gm_16F1, and gmmain_lib. It tightened function prototypes, changed a few expression shapes, introduced a static inline spawn-point helper, removed likely artificial small-data labels, and synchronized headers. The decomp.dev bot reported matched code rising to 66.46% (+0.02%, +668 bytes), with new 100% matches for gm_16AE fn_8016DEEC and gm_1601 fn_8016989C; it also reported one regression in fn_801695BC.

Postmortem JSON: `pr-2473/postmortem.json`

## PR #2472: hsd_803A949C

Status: agent_completed
Type: decomp-matching
Systems: src/sysdolphin/baselib;HSD baselib;Dolphin CARD;memory-card

Decompiled the previously empty sysdolphin/baselib implementation for hsd_803A949C and exposed its prototype in hsd_3A94.h. The function is a large CARD-related command completion dispatcher using local reconstructed card state/command/block structs, close/retry handling, checksum/validation helpers, and per-command memcpy/memcmp paths; decomp.dev reported hsd_803A949C improved by +2852 bytes from 0.00% to 58.78%.

Postmortem JSON: `pr-2472/postmortem.json`

## PR #2471: Jj/sobjlib

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin/baselib/sobjlib;sysdolphin/baselib;GX/TEV rendering;melee/gm/gmregtyfall

Draft, unmerged SObjLib decomp PR. It matched `HSD_SObjLib_803A477C`, added a large mostly-matching implementation of `HSD_SObjLib_803A4A68`, and corrected `HSD_SObj` color fields from individual bytes to `GXColor`. The decomp.dev bot reported one new full match and a major partial improvement, but also a small `HSD_SObjLib_803A54EC` regression plus data-section regressions. The PR was closed after being superseded by PR #2485.

Postmortem JSON: `pr-2471/postmortem.json`

## PR #2470: Jj/psdisp

Status: agent_completed
Type: decomp-matching
Systems: src/sysdolphin/baselib;psdisp;particle display;GX rendering

Large sysdolphin/baselib particle-display decomp PR. It added C implementations for `particleSort` and the very large `psDispParticles`, tightened several psdisp globals/prototypes from `UNK_T` or scalar types to `HSD_Particle*`, `HSD_Fog*`, and `GXColor`, and expanded `HSD_psAppSRT` padding into float fields needed by the renderer. The PR body had no explanation and there were no human review comments, but the decomp.dev bot reported measurable progress: `particleSort` to 92.88%, `psDispParticles` to 39.03%, psdisp `extab` to 100%, and related `.sdata`, `.sdata2`, and `extabindex` improvements.

Postmortem JSON: `pr-2470/postmortem.json`

## PR #2469: Match/improve 52 functions across 16 TUs (1 at 100%, 35 at >=90%)

Status: agent_completed
Type: decomp-matching_batch
Systems: fighter;kirby-copy-abilities;cpu-attack-ai;game-mode;camera;stage;ground;trophy-ui;library;baselib;audio

Broad decomp-matching batch for many previously placeholder functions across fighter/Kirby, CPU attack AI, game camera/unlock code, stage/ground code, trophy-list UI, lbarq, hsd_3AA7 card-state code, and synth SFX readdressing. The PR body reports 52 functions across 16 TUs with 1 exact match and 35 at >=90%, and the bot report showed matched-code/data gains. A late review fix reverted toy.c back to upstream after a layout-only data-section shift broke un_80309338; the final slice still contains toy.h changes but no toy.c diff, so the advertised toy.c/function-count details appear partly stale.

Postmortem JSON: `pr-2469/postmortem.json`

## PR #2468: Jj/texpdag

Status: agent_completed
Type: decomp-matching
Systems: src;sysdolphin;baselib;texpdag;HSD_TExp;GX/TEV

Large one-file texpdag decomp PR. It replaced placeholder markers for HSD_TExpMakeDag, SimplifySrc, SimplifyThis, and SimplifyByMerge with substantial C implementations, added required debug/assert support and static .sdata, and made small matching-oriented edits in order_dag and make_full_dependancy_mtx. decomp.dev reported make_full_dependancy_mtx became a 100% match and several previously-unmatched functions improved, but HSD_TExpSchedule regressed by 1 byte and overall matched code dipped slightly.

Postmortem JSON: `pr-2468/postmortem.json`

## PR #2467: Fix various literals and frame sizes

Status: agent_completed
Type: decomp-matching sweep
Systems: camera;fighter;game-mode;stage/ground;menus/interface;items;collision/map;audio/library;trophy;video/vi;sysdolphin/baselib

Automation-assisted matching sweep over nonmatching functions. The PR changed many source files by correcting literal candidates and adding, removing, resizing, or repositioning stack padding. The author said two scripts were used: one for incorrect literals and one for frame sizes, with only results that improved total match score retained. The decomp.dev report showed a small overall gain: matched code 66.30% (+0.01%, +212 bytes), matched data 38.71% (+16 bytes), 2 new matches, 192 unmatched-item improvements, and one gmresult .sdata2 regression.

Postmortem JSON: `pr-2467/postmortem.json`

## PR #2466: resplit, match, and link ftPp_SpecialS.c

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftPopo;ftNana;ftCommon;ice-climbers;config

Resplit Popo/Ice Climbers special-move code so the old broad ftPp_SpecialS.c unit became separate matching/linkable SpecialS, SpecialHi, and SpecialLw objects. The PR added new ftPp_SpecialHi.c and ftPp_SpecialLw.c files, moved declarations into move-specific headers, updated build/split/symbol config, and decomp.dev reported +14,416 linked-code bytes with 80 new matches.

Postmortem JSON: `pr-2466/postmortem.json`

## PR #2465: Fix local `melee-issues`

Status: agent_completed
Type: code-quality/lint-fix
Systems: tooling/melee-issues;fighter;game-mode;stage;item;menu

Code-quality sweep to satisfy local `melee-issues` diagnostics without changing GALE01 output. The diff mainly converts old/no-argument C definitions to strict prototypes, cleans a Zebes `StageCallbacks` initializer, removes or reorders small header/style issues, and normalizes formatting across fighter, game-mode, stage, item, and menu code. The PR body was empty, so intent is inferred from the title, code-quality label, diff, and bot report.

Postmortem JSON: `pr-2465/postmortem.json`

## PR #2464: Match 8 functions across stage, fighter, and menu TUs

Status: agent_completed
Type: decomp-matching
Systems: stage;fighter;game-mode/menu

Merged decomp-matching batch across stage, fighter, and gm/menu code. The author summary describes 8 fully matched functions plus a gm_1601.h signature refinement; the decomp.dev bot reported +2604 matched code bytes, +48 matched data, 12 new matched items, and 9 improved unmatched items. The most reusable work was exact stage callback/data layout, typed gm history-tracker arguments, and fighter codegen tactics such as PAD_STACK, explicit user_data reloads, exact callback assignment, and replacing literals with matching data symbols where needed.

Postmortem JSON: `pr-2464/postmortem.json`

## PR #2463: Add `pre-commit` to `reqs/dev.in` and update documentation, then format code

Status: agent_completed
Type: code_style_tooling
Systems: docs;repo-root;reqs;src;menu;effect;fighter;game-mode;stage;item;library;player;ty;sysdolphin

Code-style/tooling PR that added pre-commit to the dev requirements, scoped the existing clang-format pre-commit hook to C/C++ source under src, updated CONTRIBUTING with pre-commit-based formatting instructions, regenerated reqs/dev.txt, and applied clang-format across 92 source/header files. The decomp.dev bot reported GALE01 had "No changes", supporting that the large source churn was formatting-only for matching output purposes.

Postmortem JSON: `pr-2463/postmortem.json`

## PR #2462: Match 22 functions across stage, fighter, menu, match-end, and synth TUs

Status: agent_completed
Type: decomp-matching
Systems: stage/gr;fighter/ft;menu/mn;vi/un scene;game-mode/gm;match-end;sysdolphin/baselib/synth

Large multi-TU decomp matching PR: the body enumerated 22 matched functions across stage, fighter, menu/scene, match-end/game-mode, and SysDolphin synth code, with typed header refinements and minimal local struct layouts needed for codegen. decomp.dev reported +9608 matched code bytes (+0.25%) and +8 matched data bytes; its 25 new-match count also included extra counted items such as fn_801F77B0, ftKb_SpecialN_800F1D24, and data. The reusable pattern is careful ABI/type cleanup plus local layout declarations, objdiff validation, and explicit avoidance of adjacent fuzzy regressions.

Postmortem JSON: `pr-2462/postmortem.json`

## PR #2461: Match 11 functions across stage and fighter TUs

Status: agent_completed
Type: decomp-matching
Systems: fighter;stage;interface-status;ground-collision;camera-background;items

Matched and improved functions across fighter, stage, and interface TUs, replacing placeholders with evidence-backed C for CPU attack selection, match status dispatch, capture cleanup, and Ice Mountain/Pokemon Stadium/Fourside stage helpers. The PR also refined headers for newly understood signatures in `ftcpuattack.h` and `gricemt.h`; the automated decomp.dev report recorded +2388 matched-code bytes, +24 matched-data bytes, 11 new matches, and 6 additional unmatched-item improvements.

Postmortem JSON: `pr-2461/postmortem.json`

## PR #2460: various item work

Status: agent_completed
Type: decomp-matching
Systems: item;stage;ground

Broad item-system matching and cleanup pass across 38 files. The PR improved several hard item TUs by replacing anonymous allocation/table structs with item-specific types, correcting item/stage data layouts, and applying small codegen-oriented rewrites in Link/Samus/Sheik chain items and shared item logic. decomp.dev reported +2920 matched bytes, 8 new item-function matches, and 45 unmatched-item improvements; the author noted remaining item TUs were down to 24 and remaining item functions to 142.

Postmortem JSON: `pr-2460/postmortem.json`

## PR #2459: Match lbHeap report function

Status: agent_completed
Type: decomp-matching
Systems: library;lbHeap;OSReport

Matched `lbHeap_80015DF8` by adding the original extra `p->size` vararg to a final `OSReport` call in `src/melee/lb/lbheap.c`. The format string only consumes `p->size / 1024`, but retaining the unused-looking extra argument reproduced target codegen and moved the function from 99.87654% to 100.0% with size still 324/324 bytes.

Postmortem JSON: `pr-2459/postmortem.json`

## PR #2458: Improve Pikachu Thunder spawn match

Status: agent_completed
Type: decomp-matching
Systems: item;Pikachu Thunder;src/melee/it/items

Small decompilation matching improvement for Pikachu Thunder item spawning in `it_802B1DF8`. The PR only changed local variable declaration order and lifetimes in `src/melee/it/items/itpikachuthunder.c`, with no intended behavior change. Matching for `main/melee/it/items/itpikachuthunder` improved from 99.36059% to 99.54926%, and `it_802B1DF8` improved from 97.5% to 98.27586% while remaining 464/464 bytes.

Postmortem JSON: `pr-2458/postmortem.json`

## PR #2457: Link ftYs_SpecialHi.c

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftYoshi;Yoshi special moves;config;repo-root

Marked Yoshi's ftYs_SpecialHi.c as Matching in the build configuration and cleaned up nearby Yoshi static-header/data ownership. ftYs_SpecialHi.c stopped including the old static header and directly included ftYs_SpecialHi.h; the static header was renamed to ftYs_SpecialS.static.h and included by ftYs_SpecialS.c, removing an extern for ftYs_Unk3_803CED48. GALE01 sdata2 constants at 0x804D9A40-0x804D9A50 were changed from ftYs_Init_* globals to local @ labels. The decomp.dev bot reported +1836 linked-code bytes, +116 matched-data bytes, +24 linked-data bytes, and one new .data match for main/melee/ft/chara/ftYoshi/ftYs_SpecialS.

Postmortem JSON: `pr-2457/postmortem.json`

## PR #2456: vi1201v2

Status: agent_completed
Type: decomp-matching
Systems: vi;melee-core;baselib/HSD;effects;audio;player;toy/ty

Near-complete decompilation of the vi1201v2 scene enter routine. The PR added a C body for un_80320A40_OnEnter, expanded contiguous data/string layout around un_80400304, typed the fog erase color as GXColor, and updated the header signature from UNK_T to void*. decomp-dev reported un_80320A40_OnEnter improving from 0.00% to 97.14%, with .sdata reaching 100%.

Postmortem JSON: `pr-2456/postmortem.json`

## PR #2455: Jj/vi1101

Status: agent_completed
Type: decomp-matching
Systems: melee/vi;melee/if;melee/mn;melee/gr;melee/lb;sysdolphin/baselib;config

Matched and linked src/melee/vi/vi1101.c by implementing un_8031F714_OnEnter, refining un_8031F294 player/setup code, correcting vi1101 data/symbol layout, and marking vi1101.c Matching in configure.py. Ancillary changes adjusted math_ppc/sqrtf include placement and moved HSD_MtxColMagFloat inline definitions into the C files that need them; ifmagnify/mndatadel/mninfo changes are mostly formatting. decomp-dev bot reported +588 matched code bytes, +1772 linked code bytes, and vi1101 OnEnter/data/sdata/sdata2/sbss reaching 100%.

Postmortem JSON: `pr-2455/postmortem.json`

## PR #2454: Jj/tylist

Status: agent_completed
Type: decomp-matching-wip
Systems: ty/trophy-list;ui;baselib-jobj;sis-text;game-mode;stage

Draft, closed-unmerged WIP on the trophy-list UI decomp. The main work rewrote large parts of src/melee/ty/tylist.c with typed TyListArg/TyListState access, added a C body for un_80313774, tightened tylist prototypes/structs, and made small formatting-only cast-spacing edits in gm/gr files. decomp.dev reported a net +792 matched bytes, including new 100% matches for un_8031263C and un_803124BC, but also several tylist regressions, which is important context because there was no PR body or human review feedback.

Postmortem JSON: `pr-2454/postmortem.json`

## PR #2453: Jj/toy

Status: agent_completed
Type: decomp-matching
Systems: toy/trophy;game-mode;melee-core;HSD/baselib

Advanced matching in the toy/trophy module, mainly src/melee/ty/toy.c, with small type-width fixes in gm_1601.c and a toy.h prototype cleanup. The decomp.dev GALE01 report recorded +528 matched bytes and four new 100% toy matches: un_80308354, un_803102D0, un_8030813C, and un_80309338. The same bot report also flagged remaining costs: un_80308250 broke from 100% to 98.57%, un_803075E8 regressed, and .sdata/.sdata2 percentages fell.

Postmortem JSON: `pr-2453/postmortem.json`

## PR #2452: Match Yoshi SpecialHi functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;Yoshi;SpecialHi;item

Matched the last two remaining functions in Yoshi's SpecialHi translation unit, bringing src/melee/ft/chara/ftYoshi/ftYs_SpecialHi.c to 100%: 14/14 functions and 1836/1836 code bytes. The fixes were source-shape/codegen adjustments: an explicit upper clamp for stick-derived magnitude in ftYs_SpecialS_8012DF8C, removal of an incorrect PAD_STACK(4), and reuse of a scoped float temporary in fn_8012E110.

Postmortem JSON: `pr-2452/postmortem.json`

## PR #2451: Add ninja format targets

Status: agent_completed
Type: tooling
Systems: ninja;tools/project.py;clang-format;contributing-docs

Closed-unmerged tooling PR that tried to add generated Ninja targets for formatting changed C/C++ lines. It added `tools/format.py` as a Python wrapper around `git clang-format`, emitted `format` and `format-check` targets from `tools/project.py`, and updated contributing docs to recommend `ninja format` / `ninja format-check`. The main review objection was that this did not satisfy the likely intent of issue #1543: Ninja should format individual files so it can track dirty inputs efficiently; wrapping the whole `git-clang-format` operation in one target provides little utility compared with the existing pre-commit hook setup.

Postmortem JSON: `pr-2451/postmortem.json`

## PR #2450: Jj/ifmagnify

Status: agent_completed
Type: decomp-matching
Systems: melee-core;melee/if;ifMagnify;HUD;offscreen-player magnifier;camera-and-fighter-rendering

Decompiled major pieces of the interface magnifier/offscreen-player indicator module. The PR replaced several ifMagnify stubs and UNK prototypes with typed implementations, updated the ifMagnify/ifMagnifyPlayer layout, added lookup/static data, and achieved a full match for ifMagnify_802FC870 plus large match improvements for ifMagnify_802FB73C, ifMagnify_802FB8C0, ifMagnify_802FBBDC, and ifMagnify_802FC3C0.

Postmortem JSON: `pr-2450/postmortem.json`

## PR #2449: jj/mninfo

Status: agent_completed
Type: menu decompilation / matching progress
Systems: mn menu;mninfo;melee-core;HSD GObj/SisLib text

Filled in a substantial `src/melee/mn/mninfo` decomp slice, replacing several placeholder functions with C for the Data/Special info menu flow, text creation, scrolling input, model/proc setup, and cleanup. The header moved those routines from `UNK_RET/UNK_PARAMS` to concrete prototypes. decomp.dev reported `.bss` for `main/melee/mn/mninfo` newly matched at 100% and large partial match improvements for six functions, but the bot report shows most new functions were still not perfect matches.

Postmortem JSON: `pr-2449/postmortem.json`

## PR #2448: Jj/mndatadel

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn menu;main/melee/mn/mndatadel;data-delete menu

Decompiled a large slice of the Data Delete menu module, with decomp.dev reporting a new 100% match for `mnDataDel_8024E940` and `.bss`, plus sizable partial improvements across the menu input/proc, setup, data, and animation paths. The PR also tightened `mndatadel.static.h` layout by turning adjacent scalar fields into `x3C[6]` and adding an explicit `MnDataDelGObjUserData` layout. `mnevent.c` and `mnsoundtest.c` changes appear to be formatting/include-order touchups only.

Postmortem JSON: `pr-2448/postmortem.json`

## PR #2447: Jj/mnevent

Status: agent_completed
Type: decomp-matching
Systems: mn/mnevent;event match menu;HSD GObj/JObj/SisLib;gm event library;vi/vi1201v2

Merged a large decomp-matching update for the event match menu in src/melee/mn/mnevent.c, adding data constants and implementations for event row rendering, selected-event result text, menu object setup, cleanup, and controller navigation. decomp.dev reported +796 matched bytes: mnEvent_8024D5B0 and fn_8024E1B4 became 100% matches, with partial improvements for fn_8024D864, mnEvent_8024D15C, and mnEvent_8024E524. The slice contains no human review discussion.

Postmortem JSON: `pr-2447/postmortem.json`

## PR #2446: Jj/mnsoundtest

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn-menu;sound-test;audio;HSD;SISLib

Advanced the Sound Test menu decomp in src/melee/mn/mnsoundtest.c by adding/typing several functions, data definitions, archive asset descriptors, and concrete header prototypes. The decomp.dev bot reported +1604 matched code bytes and +96 matched data bytes, with new matches for fn_8024B8B4, fn_8024BAF0, fn_8024B7E4, .sdata2, .bss, and mnSoundTest_8024AA70. Neighboring mnmainrule and mnstagesw edits in the visible diff are mostly include-order and formatting cleanup.

Postmortem JSON: `pr-2446/postmortem.json`

## PR #2445: Jj/mnstagesw

Status: agent_completed
Type: decomp-matching
Systems: src/melee/mn;stage-switch-menu;HSD-JObj;HSD-SisLib;game-stage-state

Decompiled a large slice of the Stage Switch menu implementation in src/melee/mn/mnstagesw.c. The PR added typed per-GObj user data, menu text/cursor setup, two-column stage navigation, input handling, JObj animation/state updates, and GObj creation/teardown logic. decomp.dev reported +440 matched code bytes and +48 matched data bytes, with mnStageSw_80235DC8 becoming a 100% match and several other mnstagesw functions moving from 0% to substantial partial matches. There was no PR body or human review in the slice, so rationale is inferred from the diff and bot report.

Postmortem JSON: `pr-2445/postmortem.json`

## PR #2444: Jj/mnmainrule

Status: agent_completed
Type: decomp-matching
Systems: mn/main-rule-menu;gm/game-rules;baselib-gobj-jobj-sislib;gr/homerun-formatting-only

Large mnmainrule decompilation pass for the main rules menu. The PR replaced several `/// #...` stubs with C, expanded the shared menu-rule user_data layout, typed function prototypes, and improved matching in `main/melee/mn/mnmainrule`; decomp.dev reported two new 100% matches and ten other improvements. The only grhomerun changes in the slice are formatting reflows, not evidence of logic changes.

Postmortem JSON: `pr-2444/postmortem.json`

## PR #2443: Jj/grhomerun

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grhomerun;home-run-contest;camera;collision-mplib;sislib-text;fighter;game-mode;library

PR 2443 primarily decompiled and matched more of the Home-Run Contest ground/stage unit `main/melee/gr/grhomerun`. The PR body was empty and there were no human review comments, but the diff shows new C implementations for major stage setup/update/object-factory/collision-callback functions plus header/type fixes. The decomp-dev bot reported GALE01 matched code rising to 66.32% (+0.02%, +748 bytes), with 4 new full matches and large partial improvements for `grHomeRun_8021CB20`, `grHomeRun_8021D680`, and `grHomeRun_8021E500`.

Postmortem JSON: `pr-2443/postmortem.json`

## PR #2442: Link various item TUs

Status: agent_completed
Type: decomp-matching
Systems: item;config;symbols;build-config;fighter-special-items

Linked several remaining item translation units by converting six item TUs to Matching in configure.py, tightening item data/header layouts, correcting symbol visibility for local constants/callbacks, and applying targeted MWCC codegen fixes across item modules. The PR body recorded the post-merge frontier as 24 remaining item TUs and 157 remaining item functions; the decomp.dev report credited +21216 linked-code bytes, +5984 matched-code bytes, 19 new matches, and 5 further unmatched-item improvements.

Postmortem JSON: `pr-2442/postmortem.json`

## PR #2441: Jj/grfigureget

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;figureget;items;fighters;config;repo-root

Matched the Figure Get stage unit by decompiling grFigureGet_802196F0 and grFigureGet_80219898, tightening grFigureGet_80219B10 to 100%, typing Figure Get ground/config data, and correcting symbols/splits so grfigureget.c could move from NonMatching to Matching.

Postmortem JSON: `pr-2441/postmortem.json`

## PR #2440: Permuter matches

Status: agent_completed
Type: decomp-matching
Systems: camera;fighter;game-mode;stage/ground;items;lb memory-card/snap/text;menu;vi;sysdolphin baselib

Merged a broad permuter-driven matching batch across 31 files. The PR body says it was from running permuter on functions and committing outputs that reached 100%; the decomp.dev bot reported GALE01 matched code rising to 65.73% (+0.32%, +12608 bytes), with 45 new matches, 5 unmatched-item improvements, and 1 unmatched-item regression. Most changes are compiler-shape tactics rather than semantic rewrites: temporary variables, accessor/macro swaps, inline/noinline wrappers, declaration-order changes, stack padding, casts, and small no-op expressions.

Postmortem JSON: `pr-2440/postmortem.json`

## PR #2439: Jj/grgreens

Status: agent_completed
Type: decomp-matching
Systems: stage/grgreens;ground;items;audio;material;config/symbols

Green Greens stage decompilation pass centered on Whispy/wind and block-grid behavior. The PR expanded grGreens.c with implementations for the Whispy state machine, block initialization/spawn/fall/collision cleanup helpers, and supporting data tables; updated Ground vars, function prototypes, grmaterial declarations, and GALE01 data symbols. decomp.dev reported two new 100% function matches, grGreens_802139C4 and grGreens_80214674, plus large partial improvements across remaining grgreens functions, with known .sdata/.data regressions.

Postmortem JSON: `pr-2439/postmortem.json`

## PR #2438: All item TUs >95%

Status: agent_completed
Type: decomp-matching
Systems: item;config;build;repo-root

Raised item translation-unit match coverage toward the PR goal "All item TUs >95%" by matching or improving many item files, updating headers/struct types, localizing symbol-map entries, and switching several item TUs from NonMatching to Matching. The decomp.dev GALE01 report recorded +7,840 matched-code bytes, +9,756 linked-code bytes, 26 new matches, and 22 improvements in still-unmatched items.

Postmortem JSON: `pr-2438/postmortem.json`

## PR #2437: Jj/groldpupupu

Status: agent_completed
Type: stage decomp/matching
Systems: stage;Old Pupupu;ground;camera;audio;fighter interaction

Decompiled and data-reconstructed significant portions of the Old Pupupu stage file. The PR added Old Pupupu StageData/static tables, migrated stage state out of gv.unk into typed GroundVars, implemented the previously stubbed grOldPupupu_80210D10 and grOldPupupu_802113E0, and brought fn_802112F4 to 100% according to the decomp.dev report. Evidence is mostly diff and bot metrics; the PR body was empty and there were no human review comments.

Postmortem JSON: `pr-2437/postmortem.json`

## PR #2436: Jj/groldkongo

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Old Kongo;fighter;camera;effects;item;library;sysdolphin-baselib

Old Kongo stage decomp PR centered on src/melee/gr/groldkongo.c. It typed the Old Kongo parameter data blob, added missing imports, implemented grOldKongo_80210454 and grOldKongo_80210650, improved large stage state-machine functions grOldKongo_8020F888 and grOldKongo_802100FC, and updated groldkongo.h prototypes. The decomp-dev bot reported +800 matched code bytes and +112 matched data bytes, with new 100% matches for grOldKongo_80210454, grOldKongo_80210650, .sdata2, .sdata, and grOldKongo_8021005C. Most other touched files were formatting-only cleanup.

Postmortem JSON: `pr-2436/postmortem.json`

## PR #2435: Jj/grkinokoroute

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grkinokoroute;camera;collision-mp;items;zako-generator

Decompiled and typed a substantial slice of the Kinoko Route ground module, replacing several grKinokoRoute target stubs with C, adding stage data/static data, and introducing stage-specific Ground gv structs. The decomp.dev bot reported +760 matched code bytes and +16 matched data bytes, including new 100% matches for grKinokoRoute_8020836C, .sdata, grKinokoRoute_8020754C, and grKinokoRoute_80208564, while larger route/camera callbacks improved but remained partial.

Postmortem JSON: `pr-2435/postmortem.json`

## PR #2434: Jj/grvenom

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Venom

Venom stage decomp pass touching grvenom.c, grvenom.h, and gr/types.h. The main value was replacing fake/alias-based Venom ground variable handling with Venom-specific struct overlays, producing a new 100% match for grVenom_80204428 and a large partial implementation improvement for grVenom_80206874, while the bot also reported a regression in grVenom_802053B0.

Postmortem JSON: `pr-2434/postmortem.json`

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn/mnsnap;Snap menu;memory-card snapshot/photo UI;HSD JObj/SisLib UI

Decompiled/high-matched the Snap menu per-frame update `fn_802545C4`, a large `mnSnap_804A0A10.state` switch covering slot selection, photo browsing, dialogs, and copy/move/delete/printer/view operations. The PR body reports 99.373% match, while the decomp-dev bot slice reports GALE01 `main/melee/mn/mnsnap` `fn_802545C4` improving from 80.82% to 98.94%. It also corrected the `mnSnap_8025409C` API from a fake `HSD_JObj*` flag to `s32 dlg_type`. Review pushed back on assert/string SDATA hacks; the author reverted them as unnecessary.

Postmortem JSON: `pr-2433/postmortem.json`

## PR #2432: All item TUs >90% matching

Status: agent_completed
Type: decomp-matching
Systems: item;fighter;config;repo-root

Large item decomp matching pass that pushed item translation units over the PR's >90% target, promoted six item files from NonMatching to Matching, and replaced many placeholder/UNK layouts with typed item, collision, hurtbone, and state-table structures. The decomp-dev report recorded +12020 matched code bytes, +20644 linked code bytes, +1232 matched data bytes, 43 new matches, and 30 improvements, with only a small it_2725 .data regression noted.

Postmortem JSON: `pr-2432/postmortem.json`

## PR #2431: Jj/gryorster

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;gryorster;material;collision;animation

Merged decomp PR for the grYorster stage module. It replaced stubs/unknown signatures with C for several Yorster callbacks, fully matched grYorster_802024F0, improved grYorster_802022A4 and grYorster_8020266C to high partial matches, and expanded the stage-specific parameter and track-element layouts needed by those functions.

Postmortem JSON: `pr-2431/postmortem.json`

## PR #2430: All item TUs > 80% fuzzy match

Status: agent_completed
Type: decomp-matching
Systems: item;common-items;character-items;config;samus-grapple

Raised item translation-unit matching coverage, with five item source files flipped from NonMatching to Matching in configure.py: itrshell, itkabigon, itmatadogas, itpatapata, and ittools. The decomp.dev report recorded +5460 matched code bytes, +17576 linked code bytes, +744 matched data bytes, 23 new matches, and six fuzzy improvements in the still-unmatched itsamusgrapple TU. The PR also corrected item attribute layouts, added concrete ItemStateTable data initializers, localized several symbols in GALE01 symbols.txt, and implemented multiple previously stubbed item motion/physics/collision routines.

Postmortem JSON: `pr-2430/postmortem.json`

## PR #2429: Jj/grrcruise

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Rainbow Cruise;RCRUISE;gr;animation;collision

Decompiled and improved a large slice of Rainbow Cruise ground/stage code in `src/melee/gr/grrcruise.c`, with supporting type/header work. The PR replaced many `/// #grRCruise_*` targets with C, added Rainbow Cruise stage data and map/joint tables, recovered Ground union overlays for scroll/map/vanish state, and exposed `grAnime_801C7BA0` for cross-file use. The decomp.dev bot reported +2004 matched bytes, 6 new 100% matches, and 11 additional grrcruise improvements. There was no PR body and no human review discussion in the slice, so intent is inferred from diff and bot/merge metadata.

Postmortem JSON: `pr-2429/postmortem.json`

## PR #2428: Jj/grbigblue

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Big Blue

Large Big Blue stage decompilation PR with no PR body; intent is inferred from the diff, review comments, and decomp.dev report. It implemented or substantially improved several `grbigblue` routines, added typed Big Blue ground/parameter/data-table structures, corrected function return types, and applied reviewer style fixes around `F32_MAX` and decimal `gobj_id` literals.

Postmortem JSON: `pr-2428/postmortem.json`

## PR #2427: Jj/gmallstar

Status: agent_completed
Type: decomp-matching
Systems: gm;gmallstar;All-Star mode;config/GALE01;lbDvd preload cache;lbAudioAx audio preload;gmregcommon enemy colors

Merged a rough but useful partial decompilation base for All-Star mode in src/melee/gm/gmallstar.c. The PR replaced four previously stubbed functions with C bodies, added the All-Star opponent and round data tables, corrected the GALE01 data symbol split for gm_803DEBE8/gm_803DEC4C, and cleaned the static header to expose only the needed typedefs. decomp.dev reported substantial unmatched-item improvements for the new gmallstar functions and .data/.bss, with one regression in gm_801B60A4_OnLoad.

Postmortem JSON: `pr-2427/postmortem.json`

## PR #2426: Jj/gmclassic

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gmclassic;classic-mode;gmregclear;gmmain_lib;lbDvd;lbAudioAx;ground/stage

Implemented a major Classic mode decomp slice in `gmclassic.c` with supporting type/header cleanup. New C covers matchup order/random selection, Classic OnLoad setup, intro/preload setup, match launch, and match exit/record update logic. decomp.dev reported 3 new 100% matches (`gmClassic_801B3B40`, `gmClassic_801B3A34`, `gmclassic` `.sdata`) and 4 partial improvements (`gmClassic_801B3500` 92.27%, `gmClassic_OnLoad` 84.00%, `gmClassic_801B2D54` 99.96%, `gmClassic_801B2BA4` 93.87%), for +784 matched code bytes and +24 matched data bytes.

Postmortem JSON: `pr-2426/postmortem.json`

## PR #2425: Jj/gmstaffroll

Status: agent_completed
Type: decomp-matching
Systems: gmstaffroll;game-mode;sysdolphin-baselib-gobj;sislib-text;stage;config/GALE01

Large gmstaffroll decomp/matching PR. It implemented fn_801AAB74 and fn_801AB200, improved gm_801AC6D8_OnEnter, added stronger Staff Roll data/text typing, and propagated the semantic baselib GX-link head name HSD_GObjGXLinkHead. The decomp.dev bot reported gmstaffroll improvements from 0.00% to about 93% for fn_801AB200, 0.00% to about 92% for fn_801AAB74, .sdata2 from 4.08% to 94.00%, and gm_801AC6D8_OnEnter from 96.48% to 99.35%. No human review comments were captured in the slice.

Postmortem JSON: `pr-2425/postmortem.json`

## PR #2424: Jj/gm 1 a4 c

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm_1A4C;gmregtyfall;tyfall-display;HSD-GObj;HSD-JObj;HSD-camera-light-fog

Merged decomp progress for the gm_1A4C game-mode slice, centered on Tyfall/registry-style display setup. The PR replaced several stubs with C implementations, exposed shared gmregtyfall scene globals through headers, and improved matching enough for the bot to report +1112 matched bytes, including new 100% matches for gm_801A8D54 and fn_801A7FB4.

Postmortem JSON: `pr-2424/postmortem.json`

## PR #2423: Jj/gmtou

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm;tournament;menu-ui;baselib;audio

Substantially decompiled `src/melee/gm/gmtou.c`, the guessed Tournament game-mode file. The PR replaced several placeholders with C for Tournament UI/setup, per-frame input, bracket/result handling, audio preload, and scene-entry logic, while correcting `TmAnimTimers` and `TmBoxArrays` declarations in the static header. The automated decomp.dev report recorded +2608 matched code bytes and +64 matched data bytes, with 100% matches for `fn_8019BA08`, `fn_8019C744`, `fn_8019DD60`, and `.bss`, plus high-percentage improvements for `fn_8019D1BC`, `gm_8019DF8C_OnFrame`, `gm_8019E634`, `fn_8019C048`, and `gm_8019ECAC_OnEnter`.

Postmortem JSON: `pr-2423/postmortem.json`

## PR #2422: Jj/gmregclear

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gmregclear;1P modes;regular-clear;clear-results-ui;record-tables

Large gmregclear decompilation PR. It replaced many gmregclear placeholders with C, expanded local state/layout knowledge, and promoted several header/type signatures. decomp.dev reported +3292 matched bytes, six new full matches, and many near-match improvements; the remaining regressions were explicitly attributed by the author to data locality pending linking.

Postmortem JSON: `pr-2422/postmortem.json`

## PR #2421: More item progress

Status: agent_completed
Type: decomp-matching
Systems: item;map-collision;fighter-item-interaction;config;GALE01-symbols;melee-core

Large item decompilation progress PR. It promoted several item translation units from NonMatching to Matching, filled many item callbacks/state tables, refined item attribute and item-var structs, updated GALE01 symbols, and simplified one map-collision prototype. decomp.dev reported +17,508 matched code bytes, +26,716 linked code bytes, 69 new matches, and 11 improvements in still-unmatched items. The author explicitly noted that itlugia and itclimbersice were matching, but their sdata2 ordering could not be forced into the desired order.

Postmortem JSON: `pr-2421/postmortem.json`

## PR #2420: All item TUs >60% fuzzy match

Status: agent_completed
Type: item_decomp_matching
Systems: item;config/GALE01;configure.py;it/common-items;it/char-items;Ness yoyo;Pikachu and Pichu item articles;Pokemon/common item articles

Broad item decompilation pass aimed at getting item translation units over 60% fuzzy match, with the PR body noting "some new linkages". The diff implements many previously stubbed item functions, adds item state tables and concrete item-var/attribute structs, fixes symbol scope/local labels, and flips itfreeze.c, itpikachutjoltground.c, ithinoarashi.c, and ittincle.c from NonMatching to Matching in configure.py. The automated decomp.dev report credited the PR with 48 new matches, +10876 matched-code bytes, +15096 linked-code bytes, +1008 matched-data bytes, and +712 linked-data bytes.

Postmortem JSON: `pr-2420/postmortem.json`

## PR #2419: Add transmuter

Status: agent_completed
Type: tooling-prototype
Systems: tooling;build;GALE01;melee-if;iftime

Closed unmerged draft/prototype for adding Transmuter workflow support. It added two shell scripts to prepare a Melee single-TU .ctx.c input and compile Transmuter candidates with the Melee mwcc_sjis-style environment, then intentionally broke ifTime_GetCountdownSeconds as a demo target. decomp.dev reported two broken matches and a collaborator asked for resubmission when the tooling was more complete and better explained.

Postmortem JSON: `pr-2419/postmortem.json`

## PR #2418: Move mac to wine

Status: agent_completed
Type: tooling_platform_wrapper_behavior
Systems: tools/project.py;ProjectConfig.compiler_wrapper;ProjectConfig.use_wibo;wibo;wine;macOS;Linux

One-line tooling change in tools/project.py: ProjectConfig.use_wibo now returns true only on Linux, removing Darwin/macOS from automatic wibo use. With compiler_wrapper falling back to Path("wine") when no wrapper is set on non-Windows systems, the change effectively moves macOS builds away from auto-downloaded wibo and toward wine. The PR had no C/ASM changes; decomp.dev reported GALE01 "No changes" and two reviewers approved without written feedback.

Postmortem JSON: `pr-2418/postmortem.json`

## PR #2417: Fix build from macOS

Status: agent_completed
Type: tooling_platform_fix
Systems: tooling;build-system

Small build-tooling PR that prevented macOS builds from selecting the Linux-oriented wibo wrapper. The PR body shows macOS was attempting to run build/tools/wibo and failing with "cannot execute binary file"; the diff changes tools/project.py so use_wibo() only returns true on Linux, not Darwin. The PR was closed without a recorded merge and has no review discussion in the provided slice.

Postmortem JSON: `pr-2417/postmortem.json`

## PR #2416: decomp: fn_801D8134 (grkongo), fn_802159B4 (grgreens)

Status: agent_completed
Type: decomp-matching
Systems: stage;grkongo;grgreens;Kongo Jungle;Green Greens

Decompiled the Kongo Jungle gorilla activation callback fn_801D8134 in grkongo.c as a 100% match and moved the no-op Green Greens fn_802159B4 stub to its correct source-order/address-offset position. The Kongo logic checks whether a fighter is within range of the gorilla spawn point, then activates the gorilla with randomized timing, material/effect updates, and a fighter-side callback/status call.

Postmortem JSON: `pr-2416/postmortem.json`

## PR #2415: ftdrawcommon work

Status: agent_completed
Type: decompilation_matching
Systems: fighter;ftdrawcommon;fighter-draw-rendering;matrix-camera;config-GALE01

Made `src/melee/ft/ftdrawcommon.c` a matching object: `configure.py` flips it from `NonMatching` to `Matching`, while the C diff reshapes fighter draw code around an inline copy of `ftDrawCommon_8008051C` and stack-local adjustments in `ftDrawCommon_800805C8` and `ftDrawCommon_80080C28`. The symbol map was also corrected for local constants and one `ftDrawCommon_804D8370` size. The PR body says `ftDrawCommon_800805C8` was a huge function that was close to a register-swap issue and hard for the permuter; there were no review comments in the slice.

Postmortem JSON: `pr-2415/postmortem.json`

## PR #2414: Link itpikachutjoltair, itlipstickspore, and itlikelike

Status: agent_completed
Type: decomp-matching-linking
Systems: item;fighter;config;symbols

Linked several item units by flipping item objects to Matching, adding exact item state tables/data symbols, and tightening signatures/codegen in Lipstick Spore, Pikachu Thunder Jolt Air, Likelike, and partially Hitodeman. The PR title names itpikachutjoltair, itlipstickspore, and itlikelike; the diff also changes ithitodeman and configure.py marks it Matching, but the author noted Hitodeman was still difficult and might need resplitting. decomp.dev reported +2360 matched code bytes, +15984 linked code bytes, +160 matched data bytes, +688 linked data bytes, and 9 new matches.

Postmortem JSON: `pr-2414/postmortem.json`

## PR #2413: Fix various function signatures

Status: agent_completed
Type: function-signature-fix
Systems: camera;fighter;game-mode;stage;item;library;baselib

Broad signature-correction pass across 63 files, driven by an asm type-inference script described by the author as noisy but useful. The PR removed false parameters, corrected return types, tightened callback and pointer types, synchronized headers with implementations, and adjusted call sites. The decomp.dev report showed +292 matched bytes, 2 new full matches in gm_1601, and 11 other matching improvements.

Postmortem JSON: `pr-2413/postmortem.json`

## PR #2412: Link kirbycutterbeam

Status: agent_completed
Type: decomp-matching-and-linking
Systems: item;fighter-related-items;Kirby cutter beam;Ness yoyo;Ice Climbers string;build configuration

Linked `itkirbycutterbeam.c` by adding its item state table and switching the object from NonMatching to Matching in `configure.py`. The PR also filled in previously missed item work for Ness yoyo and Ice Climbers string articles, replacing several `/// #...` stubs and `UNK` prototypes with typed implementations. decomp.dev reported +1908 matched code bytes, +2588 linked code bytes, +56 matched data bytes, 8 new matches, and 10 near-match improvements.

Postmortem JSON: `pr-2412/postmortem.json`

## PR #2411: Jj/gm 16 f1

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm_16F1 decision-results;gmregclear;player-statistics;HSD text/SIS

Large gm_16F1 decompilation PR for post-match decision/bonus logic. It replaced several gm_16F1 stubs with C implementations, added typed prototypes and struct fields needed by the code, corrected a gm_16AE callsite for fn_80171DC4, and tuned gmregclear fn_8017F1B8 to match. decomp-dev reported +2080 matched bytes, five new 100% matches, and major partial matches for remaining large gm_16F1 functions; there was no PR body or human review text captured.

Postmortem JSON: `pr-2411/postmortem.json`

## PR #2410: Jj/gmmain lib

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gmmain_lib;vs-mode;nametag;persistent-name-data;save-stats

Implemented and matched more of src/melee/gm/gmmain_lib around VS mode, nametag, persistent name data, fighter/name statistics reset, and a final gmMainLib_8015FA34 match tweak. The decomp-dev bot reported +1284 matched code bytes and +8 matched data bytes, with new full matches for gmMainLib_8015F260, InitializePersistentNameData, .sdata2, and gmMainLib_8015FA34, plus partial improvements for gmMainLib_8015DBF4, gmMainLib_8015F600, gmMainLib_8015EA80, and gmMainLib_8015F150.

Postmortem JSON: `pr-2410/postmortem.json`

## PR #2409: >50% fuzzy match on all remaining item TUs

Status: agent_completed
Type: decomp-matching
Systems: item;fighter;HSD/baselib

Large item decompilation sweep aimed at bringing the remaining low-fuzzy-match item translation units above roughly 50%. The author explicitly described the work as Claude-assisted but heavily human-cleaned. It filled many item functions and callbacks, refined item variable/attribute structs, and adjusted a few fighter/item call sites. decomp.dev reported matched code rising to 63.04% (+0.35%, +13,772 bytes), matched data to 38.13% (+328 bytes), with 54 new matches and 47 unmatched-item improvements.

Postmortem JSON: `pr-2409/postmortem.json`

## PR #2408: Jj/ft 0 d31

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;effect;player;config;melee-core

Matched the ft_0D31 death/rebirth area by completing multiple death-state functions, splitting the 0x800D4DD4+ rebirth tail into a new matching ft_0D4D.c unit, and updating build splits, symbols, headers, includes, and shared motion-var typing. The decomp.dev bot reported +6896 matched code bytes, +10644 linked code bytes, and 34 new matches; the apparent broken ft_0D31 matches were primarily functions moved into the new ft_0D4D unit.

Postmortem JSON: `pr-2408/postmortem.json`

## PR #2407: Jj/ftafterimage

Status: agent_completed
Type: decomp-matching
Systems: fighter;item;GX;sword-afterimage

Implemented the main sword-afterimage rendering routine in src/melee/ft/ftafterimage.c, taking ftCo_800C2600 from a NOT_IMPLEMENTED stub to an 88.71% unmatched-item improvement and finishing ftCo_800C2FD8 from 98.99% to 100.00% per the decomp-dev bot. The PR also exposed the early sword-afterimage parameter fields in itSword_UnkBytes and Marth/Roy SwordAttrs as f32 scale values plus color/alpha bytes, and replaced an OSReport/__assert pattern with HSD_ASSERTREPORT for matching.

Postmortem JSON: `pr-2407/postmortem.json`

## PR #2406: it: 10 match progress (items, 100%)

Status: agent_completed
Type: decomp-matching
Systems: item;Pokemon items;character items;shell items;Ness yoyo;Kirby cutter beam

Split from #2345 to land item-only 100% matches. The PR replaced 10 item-function stubs with matching C implementations across Pokemon/item projectiles, shell behavior, Ness yoyo, Kirby cutter beam, and related item helpers, while also tightening item var/attribute structs and several placeholder prototypes. decomp.dev reported +2976 matched code bytes, +40 matched data bytes, and 13 total new matches including .sdata/.sdata2 items.

Postmortem JSON: `pr-2406/postmortem.json`

## PR #2405: gm/mn: 5 match progress (100%)

Status: agent_completed
Type: decomp-matching
Systems: game-mode;menus;match-end;opening;bonus-scoring;melee-core

Split from #2345 to land five gm/mn decompilation implementations in game-loop and menu code: menu rule text handling, opening fog animation gating, opening performance-label construction, match-end team-score aggregation, and bonus lookup. The diff replaced stubs with C, updated headers from UNK prototypes to typed signatures, and refined mnmainrule's struct layout. PR text claims all five functions were 100%, while the decomp.dev bot report listed three new 100% matches and two near-100 improvements, so exact final match status for fn_80165E7C and fn_801A7FB4 should be verified before reusing as a certainty.

Postmortem JSON: `pr-2405/postmortem.json`

## PR #2404: gr: 5 match progress (100%)

Status: agent_completed
Type: stage decomp matching
Systems: stage/gr;game-mode/gm;fighter/ft;sysdolphin/baselib;trophy/ty

Merged stage-focused decomp PR split from #2345. The PR body/title list five `gr` functions as 100% matches: `grKinokoRoute_8020836C`, `fn_801F9038`, `grHomeRun_8021EC58`, `grPushOn_802190D0`, and `grOldKongo_80210650`. The work paired stage behavior matches with callback typedef/prototype cleanup and some broader formatting/include churn. Review concentrated on avoiding an ugly `__FILE__` override in `groldkongo.c` and clarifying why the LObj type check in `grpushon.c` was inlined instead of redefining/calling the existing baselib helper.

Postmortem JSON: `pr-2404/postmortem.json`

## PR #2403: Jj/ftmaterial

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftmaterial;HSD material rendering;HSD TEV/TExp;ftCommon color overlay

Matched more of fighter material rendering by replacing NOT_IMPLEMENTED stubs in src/melee/ft/ftmaterial.c, fully matching ftMaterial_800BF534, raising ftMaterial_800BF6BC to 99.47%, and making a small ftMaterial_800BF2B8 bitfield/local-layout correction.

Postmortem JSON: `pr-2403/postmortem.json`

## PR #2402: ft: 6 match progress (100%)

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;ftKirby;catch-pull-hookshot-grapple;rebirth-respawn;dead-up-star-ice;HSD-JObj;Kirby-copy-hats

Merged a fighter-only split from #2345 that replaced six `/// #` placeholders across `ft_0D31.c`, `ftCo_Attack100.c`, and `ftKb_Init.c` with matching C for respawn/dead-up state logic, catch-pull item transition logic, and Kirby copied-hat matrix/Pichu-hat initialization. decomp.dev reported +1404 matched bytes; its early bot report listed five new 100% matches and `ftCo_800D41C4` as 98.33%, while the PR body/title claimed six 100% matches.

Postmortem JSON: `pr-2402/postmortem.json`

## PR #2401: Jj/ft 0892

Status: agent_completed
Type: decomp-matching
Systems: fighter;fighter-damage-state;inverse-kinematics;stage-collision;items

Decompiled a chunk of src/melee/ft/ft_0892.c, adding full matches for ft_800892D4, ft_80089460, and fn_8008998C, plus near-complete implementations for ft_800895E0 and ft_80089B08. The PR also typed supporting fighter data by adding IKState, a forward declaration, a typed fn_8008998C prototype, and missing x2085 fighter bitfields. decomp.dev reported +1160 matched code bytes, +16 matched data bytes, and improved ft_80089B08 to 97.81% and ft_800895E0 to 98.86%. No PR body or human review feedback was present in the slice.

Postmortem JSON: `pr-2401/postmortem.json`

## PR #2400: Fix renaming of HSD_AudioGetAuxHeapSize

Status: agent_completed
Type: symbol_rename_fix
Systems: GALE01;HSD audio;AXDriver

Minimal symbol-map fix for GALE01: the function at .text:0x8038E034 was renamed from the placeholder AXDriver_8038E034 to the identified HSD_AudioGetAuxHeapSize, preserving its function metadata size 0x2D8 and global scope.

Postmortem JSON: `pr-2400/postmortem.json`

## PR #2399: some grgreatbay data matching + attribute labelling

Status: agent_completed
Type: decomp-matching
Systems: stage;Great Bay;ground;item-spawn

Great Bay stage cleanup focused on data matching and semantic attribute labels in src/melee/gr/grgreatbay.c. The PR renamed grGb_StageAttr fields from raw x-offset names into moon, floating-floor, kame/turtle, direction-probability, item-probability, and item-weight fields; added StageCallbacks role comments; defined previously extern Vec3/SpawnItem data; and made small stack/padding adjustments. decomp-dev reported the grgreatbay unit's .data, .rodata, and .sdata reaching 100% matched, plus small improvements in grGreatBay_801F499C, grGreatBay_801F63F4, and grGreatBay_801F60C4.

Postmortem JSON: `pr-2399/postmortem.json`

## PR #2398: Jj/ftcoll

Status: agent_completed
Type: decomp-matching
Systems: fighter;item;collision;damage;effects;player-stale-move-tracking

Large fighter-collision decomp PR focused on src/melee/ft/ftcoll.c. It replaced many NOT_IMPLEMENTED stubs with typed fighter/item collision, damage-log, knockback, hurtbox-init, shield/absorb/reflect, stale-move, and effect-spawn logic, then updated ftcoll.h and ft/types.h to support the new code. decomp.dev reported +1688 matched-code bytes with 8 new full matches and 13 improved unmatched ftcoll items, but also reported a small .sdata match regression.

Postmortem JSON: `pr-2398/postmortem.json`

## PR #2397: Fixed matching for ftCo_80097D40

Status: agent_completed
Type: decomp-matching-fix
Systems: fighter;ftCommon;DownBound

Small ftCommon DownBound matching fix that made ftCo_80097D40 fully match. The function stopped carrying its own duplicated x2228_b2 branch logic and dummy stack array, reused the shared static inlineA1 helper, then reset fp->mv.co.downspot.x4. The decomp.dev bot reported ftCo_80097D40 improved from 0.00% to 100.00% for +72 matched bytes, with a small .sdata2 improvement.

Postmortem JSON: `pr-2397/postmortem.json`

## PR #2396: Jj/lbaudio_ax

Status: agent_completed
Type: decomp-matching
Systems: melee/lb/lbaudio_ax;sysdolphin/baselib/axdriver;melee/ft/ftcoll

Large lbaudio_ax decomp/matching PR focused on Melee's AX audio library: filled many lbAudioAx stubs, recovered more audio object/userdata and pool state, fixed public prototypes, and renamed an AX aux-heap helper. decomp.dev reported +1780 matched code bytes, +40 matched data bytes, and 6 new matches, but also noted regressions in .bss, fn_80023254, .sdata, fn_800268B4, and the renamed AXDriver_8038E034 item.

Postmortem JSON: `pr-2396/postmortem.json`

## PR #2395: Jj/lbrefract

Status: agent_completed
Type: decomp-matching
Systems: library;lb/lbrefract;lb/lbmthp;GX;HSD/baselib;THP video

Decompiled/refactored much of lbRefract by replacing opaque state and M2C-style accesses with typed HSD/GX code, adding refraction texture generation/init, DObj/PObj class hooks, GX indirect-texture render setup, and callback-based texture read/write helpers. It also fixed THPDec_80331340's prototype/call sites to pass width. The bot reported +1848 matched code bytes and 9 new matches, with a lbrefract .sdata regression.

Postmortem JSON: `pr-2395/postmortem.json`

## PR #2394: Jj/lbmthp

Status: agent_completed
Type: decomp-matching
Systems: library;lbmthp;THP movie playback;GX texture rendering;DevCom/DVD streaming

Large lbmthp decompilation pass for the movie/THP playback library. The PR replaced many address-stub placeholders in src/melee/lb/lbmthp.c with C implementations for streaming callbacks, buffer setup, THP decode, frame advancement, playback startup, GX texture upload/draw, cleanup support, and one-shot THP decode. It also refined lbmthp.h and lbmthp.static.h struct layouts/prototypes, including renaming the static player singleton to Movieplayer. The decomp.dev bot reported 11 matching improvements, with several formerly 0% functions reaching high partial or near-complete match percentages.

Postmortem JSON: `pr-2394/postmortem.json`

## PR #2393: Jj/lb 00 f9

Status: agent_completed
Type: decomp-matching
Systems: lb_00F9 library;fighter dynamics;ground Castle stage;camera blur;color overlay;lbvector

Large decompilation and typing pass for src/melee/lb/lb_00F9, covering library dynamics, JObj traversal helpers, GX image/camera-blur rendering, and color overlay command handling. The PR replaced several stubs or weak prototypes with C implementations and refined shared DynamicsData layout; decomp.dev reported +3012 matched bytes, 7 new matches, and 11 unmatched-item improvements. Human review evidence is weak in this slice: the PR body only says "Tracking PR as usual" and there are no human review comments.

Postmortem JSON: `pr-2393/postmortem.json`

## PR #2392: Jj/lbshadow

Status: agent_completed
Type: function_decompilation
Systems: library;lbshadow;baselib-shadow;baselib-light;fighter;camera;ground

Implemented remaining lbshadow.c work in one library file: lbShadow_8000E9F0 replaces a stub with HSD_Spline Vec3 derivative/tangent-style calculations for spline->type cases 0-3, and lbShadow_8000F38C replaces a large stub with the fighter shadow update/render pass that selects an HSD_LObj light, computes light/up vectors, manages LbShadow flags and active state, attaches fighter/accessory objects to HSD_Shadow, sets shadow camera/viewing rect/intensity, renders offscreen, and restores draw state. The PR body and review history provide little rationale beyond tracking; conclusions are primarily diff-based.

Postmortem JSON: `pr-2392/postmortem.json`

## PR #2391: onett + mute city work

Status: agent_completed
Type: stage_decompilation
Systems: gr;stage;Mute City;Onett;ground collision;camera bounds;materials;generators;items;audio;lights

Large stage decompilation PR for Onett and Mute City. It replaced many `/// #` placeholders with typed C for Mute City car/spline/collision/light command logic and Onett building, traffic, awning, and generator behavior. It also corrected ground-variable layouts, function prototypes, and helper return types. There was no PR body or review discussion in the dump, so rationale is inferred from the diff only.

Postmortem JSON: `pr-2391/postmortem.json`

## PR #2390: Jj/gm 19 ef

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm_19EF;game-over-or-go-scene;HSD-JObj;SIS-text;audio

Decompilation pass for src/melee/gm/gm_19EF, replacing major stubs around the gm_19EF game-mode scene setup and OnEnter path with C implementations and typed globals. The diff implements helpers for animation/state updates, loads GmGover/GmGoCoin/GmGoAnim/GmRgStnd assets, initializes HSD camera/light/JObj/SIS text objects, and updates headers for concrete prototypes. decomp.dev reported 5 new matches and large improvements to the remaining gm_19EF functions, though there were no human review comments in the slice.

Postmortem JSON: `pr-2390/postmortem.json`

## PR #2389: Jj/mnitemsw

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn menu;item switch menu;rules item settings

Decompiled a large slice of the Item Switch menu unit, adding static data tables, typed implementations, and header prototypes for mnitemsw UI/input/GObj code. The PR mattered because decomp.dev reported +1272 bytes of newly matched code, including exact matches for mnItemSw_80233B68, mnItemSw_80235020, and mnItemSw_80233A98, plus several 93-99% near-matches in the same unit. The PR body and human review context were minimal, so intent beyond tracking/matching is inferred from the diff and bot report.

Postmortem JSON: `pr-2389/postmortem.json`

## PR #2388: great bay work

Status: agent_completed
Type: stage decomp matching
Systems: stage/ground;Great Bay;item/Tincle;mpLib/collision;animation;effects/sfx

Large Great Bay stage decomp pass centered on `src/melee/gr/grgreatbay.c`: replaced several `/// #` stubs with C, reconstructed a typed Great Bay stage-attribute table, expanded Great Bay ground-variable layouts, typed a few item/stage prototypes, and centralized a duplicated stage random-range helper. decomp.dev reported +2816 matched code bytes and 4 new full matches, while `.sdata` regressed slightly.

Postmortem JSON: `pr-2388/postmortem.json`

## PR #2387: cm matches

Status: agent_completed
Type: decomp-matching
Systems: melee/cm/camera;camera;pause-camera;free-camera;fixed-camera;HSD CObj/GObj rendering

Large cm/camera decomp-matching pass. It replaces several camera placeholder stubs with C, tightens camera struct/prototype typing, and adds the include coverage needed for HSD camera rendering, refract/shadow, and mpLib draw paths. decomp.dev reported +4140 matched bytes, 8 new matches, 20 improved unmatched items, and one .data regression.

Postmortem JSON: `pr-2387/postmortem.json`

## PR #2386: Match and link gmregcommon

Status: agent_completed
Type: decomp-matching
Systems: game-mode;melee/gm;gmregcommon;GALE01 config;repo build configuration

Made melee/gm/gmregcommon.c a matching linked object by adding the missing lbl_803D79F0 byte table, declaring it in the header, correcting several GALE01 data symbols to local @ labels, and switching gmregcommon from NonMatching to Matching in configure.py. The automated report credited one new match and showed main/melee/gm/gmregcommon .data reaching 100.00%.

Postmortem JSON: `pr-2386/postmortem.json`

## PR #2385: pltrick work

Status: agent_completed
Type: decomp-matching
Systems: pltrick;plbonuslib;fighter;player-stats;melee-core

Implemented several previously stubbed pltrick routines and adjusted fighter/player struct layouts plus helper prototypes needed for those implementations. The decomp.dev bot reported +756 matched code bytes and +8 matched data bytes, with new 100% matches for fn_80037F00, pl_80038628, and pltrick .sdata2, plus near-matches for pl_80037C60, pl_80038144, and pl_800384DC.

Postmortem JSON: `pr-2385/postmortem.json`

## PR #2384: Jj/grshrineroute

Status: agent_completed
Type: decomp-matching
Systems: stage/gr;grshrineroute;Ground/GroundVars;HSD_JObj/HSD_LObj;mpLib collision joints;grAnime/grMaterial;camera;fighter/player interaction;grZakoGenerator

Large Shrine Route stage/ground decomp PR. It replaced several grshrineroute placeholders with C, added typed prototypes, and reworked the stage GroundVars layouts needed for symbol effects, platform/camera tracking, route state transitions, dynamic lighting, and callbacks. decomp.dev reported GALE01 matched code at 62.06% with +1980 bytes, 6 new 100% matches, and 7 additional improvements.

Postmortem JSON: `pr-2384/postmortem.json`

## PR #2383: Jj/grcorneria nr 2

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grcorneria;items;player

Merged continuation of Corneria stage decomp work from #2381. The PR focused on grcorneria Arwing spawning/attachment/projectile behavior, added typed Ground/Arwing overlays, and improved matching across many Corneria functions. decomp.dev reported +4492 matched bytes, 8 new 100% matches, and major partial progress on grCorneria_801DED50 and grCorneria_801DCE1C.

Postmortem JSON: `pr-2383/postmortem.json`

## PR #2382: Jj/grcorneria

Status: agent_completed
Type: stage-decomp-progress
Systems: stage;ground;corneria;arwing;repo-root

Unmerged Corneria stage decomp progress branch. The author explicitly opened it as a handoff/progress record because it would be superseded by another PR by nemo. It added substantial C work in src/melee/gr/grcorneria.c, tightened a few grcorneria.h prototypes, expanded grArwing_GroundVars with flag unions, and added a target_funcs.txt checklist. decomp.dev reported one new full match, grCorneria_801E2110, plus many near-matches in grcorneria, but also a small .sdata regression.

Postmortem JSON: `pr-2382/postmortem.json`

## PR #2381: grcorneria work

Status: agent_completed
Type: decomp-matching
Systems: grcorneria;ground;stage;smashtaunt;grmaterial;grvenom;item;itgreatfoxlaser

Large Corneria stage decompilation PR focused on replacing many `/// #grCorneria_*` placeholders with C, refining Corneria/stage-related structs and prototypes, and wiring shared smash-taunt/material/item interfaces. decomp.dev reported +3544 matched bytes, +0.09% overall matched code, 7 new exact matches, and 18 additional grcorneria improvements. Review feedback centered on project style and cleanup: prefer `HSD_ASSERT`, reduce raw pointer math, use ABS/MIN/MAX/CLAMP helpers when possible, and scrutinize apparent s32 writes into f32-looking fields.

Postmortem JSON: `pr-2381/postmortem.json`

## PR #2380: Link mngallery

Status: agent_completed
Type: decomp-matching
Systems: menu-gallery;mn;mngallery;mnsnap;gm_1B03;config/GALE01

Linked `melee/mn/mngallery.c` by switching it to a matching object, tightening its local structs/data ownership, and updating GALE01 splits/symbols. The PR also corrected the `0x804A0B90` BSS allocation to belong to `mnsnap`, not `mngallery`, while preserving several matching-sensitive userdata/access patterns.

Postmortem JSON: `pr-2380/postmortem.json`

## PR #2379: Link Ifnametag

Status: agent_completed
Type: module-linking-via-decomp-match
Systems: melee/if/ifnametag;interface-ui;NameTag;GALE01 symbols;configure.py object list

Linked the NameTag interface unit by matching `un_802FD4C8`, flipping `src/melee/if/ifnametag.c` from NonMatching to Matching, and cleaning GALE01 symbol names/scopes for local NameTag data and constants. The source match used small codegen-oriented rewrites around GObj creation, camera object setup, and memzero sizing. The decomp-dev report confirmed one new match in `main/melee/if/ifnametag`, with `un_802FD4C8` going from 90.18% to 100.00%.

Postmortem JSON: `pr-2379/postmortem.json`

## PR #2378: Link Ftpickupitem

Status: agent_completed
Type: decomp-matching/linking
Systems: fighter;ftCommon;item pickup;GALE01 config;repo-root

Linked the common fighter item-pickup translation unit by making src/melee/ft/chara/ftCommon/ftpickupitem.c build as Matching. The source change was small but targeted: ftpickupitem_800942A0 now gets fp->x294_itPickup through a new inline helper, which made that function report 100.00% matched. The PR also adjusted GALE01 symbol ownership for local strings, local float constants, and a local data label used by the linked object.

Postmortem JSON: `pr-2378/postmortem.json`

## PR #2377: Link Ftcoloanim

Status: agent_completed
Type: object-linking-match
Systems: fighter;ftcolanim;GALE01-symbols;build-config

Linked the fighter ftcolanim object by making a small codegen-oriented source tweak in ftCo_800BFFD0, updating GALE01 symbol scopes/local labels, and flipping melee/ft/ftcolanim.c from NonMatching to Matching in configure.py. The automated report confirmed 1 new match: main/melee/ft/ftcolanim ftCo_800BFFD0 improved from 97.41% to 100.00%, with linked code +2028 bytes and linked data +80 bytes.

Postmortem JSON: `pr-2377/postmortem.json`

## PR #2376: it/items/itarwinglaser

Status: agent_completed
Type: decomp-matching
Systems: item;itarwinglaser;collision;ground;stage-corneria;fighter-reflect

Decompiled a large slice of the Arwing Laser item implementation, adding its state table, physics/collision callbacks, spawn helpers, reflect/mirror handlers, and a more complete xDD4 item-var layout. The bot reported +2992 matched code bytes, +224 matched data bytes, 10 new 100% matches, and three newly near-matching functions.

Postmortem JSON: `pr-2376/postmortem.json`

## PR #2375: Jj/mnruleplus

Status: agent_completed
Type: decomp-matching
Systems: melee-core;mn menu;rules-plus menu

Decompiled and improved matching for the Rules Plus menu implementation in src/melee/mn/mnruleplus.c and refined its header data layout. The PR replaced several placeholder/commented functions with C implementations for input handling, animation updates, description text, rule persistence, menu construction, and time-limit rendering. decomp.dev reported 3 new full matches, 7 improved unmatched items, +2132 matched bytes, and overall matched code movement from 61.45% to 61.50%. Evidence for author intent is weak because the PR body only says "Tracking PR as usual" and there were no human review comments.

Postmortem JSON: `pr-2375/postmortem.json`

## PR #2374: grzakogenerator work

Status: agent_completed
Type: decomp-matching
Systems: gr;grzakogenerator;stage;item;animation;collision

Sprawling stage/item decomp PR centered on grZakoGenerator. It converted the zako generator from raw pointer/UNK prototypes into typed config, spawn, data, and item-var structures; implemented several core generator functions; propagated the new optional spawn-desc pointer API across many stage OnStart callsites; and added or improved several stage helper/collision functions. The bot reported +4212 matched code bytes, +56 matched data bytes, 14 new matches, and one small broken match in grCorneria_801E2738.

Postmortem JSON: `pr-2374/postmortem.json`

## PR #2373: AI-assisted decompilation: 8 new 100% matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;stage;ground;item

Closed unmerged PR from an AI-assisted decompilation pipeline. The final revision was narrowed to 8 objdiff-verified 100% matches across Crazy Hand, Ice Mountain, Pura, and Old Kuri after reviewers objected to a broader raw-pointer-heavy AI batch. Main durable value is the review guidance: keep AI submissions tightly scoped to byte-perfect matches, avoid automated Copilot review noise, prefer M2C_FIELD/proper structs/inlines over raw pointer math, and use m2c flags/union-field hints to improve decomp quality. The PR was later closed because most changes were covered by other PRs.

Postmortem JSON: `pr-2373/postmortem.json`

## PR #2372: Jj/gmresultplayer

Status: agent_completed
Type: decomp-matching
Systems: game-mode;results-screen;gmresultplayer;gmresult;config/GALE01

Large gmresultplayer decompilation/matching pass for the results screen. The PR replaced many placeholders in src/melee/gm/gmresultplayer.c with typed C, added/updated prototypes and result data bitfields, and adjusted GALE01 symbols for newly understood data/table boundaries. decomp.dev reported +1772 matched bytes, 5 new full matches, and 14 improved unmatched items; one fn_8017A9B4 regression was explicitly accepted because the rewrite cleaned up pointer math and left mostly regswaps.

Postmortem JSON: `pr-2372/postmortem.json`

## PR #2371: Merge dtk-template updates

Status: agent_completed
Type: tooling_template_sync
Systems: tools/project.py;dtk-template;project progress metrics

Merged a small dtk-template tooling update into melee. The only final file change was in tools/project.py, where print_category now reads fuzzy_match_percent from the measures dictionary and includes a fuzzy-match percentage in the progress output alongside matched and linked percentages. The PR body also notes a README.md merge conflict was resolved by keeping melee's upstream/deleted README state because the generic template README did not apply.

Postmortem JSON: `pr-2371/postmortem.json`

## PR #2370: Jj/mncharsel

Status: agent_completed
Type: decomp-matching
Systems: melee/mn;mncharsel;character-select-screen;HSD-JObj-animation;game-state-gm

Large character-select-screen decompilation slice for src/melee/mn/mncharsel. The PR replaced multiple `/// #` placeholders with C for CSS door updates, cursor think logic, random/loaded character selection, character-model motion, start/readiness checks, and nametag-list scrolling, plus header/static/type updates needed to support those functions. decomp.dev reported GALE01 matched code at 61.40% (+0.07%, +2904 bytes), with new 100% matches for `fn_80262F44`, `mnCharSel_8025EE8C`, and `mnCharSel_8025D5AC`, and large partial-match gains for `mnCharSel_CursorThink`, `mnCharSel_8025DB34`, `fn_802633B0`, `fn_8025F0E0`, and `fn_80262648`. Human PR text and review comments were minimal, so intent beyond the diff and bot report is not evidenced.

Postmortem JSON: `pr-2370/postmortem.json`

## PR #2369: Merge #2366, #2367, #2368

Status: agent_completed
Type: decompilation_batch_matching
Systems: fighter;fighter-kirby;fighter-common;game-mode;stage-unlock;lb-audio;lb-arq;lbmthp-thp-video;menus;toy;sysdolphin-baselib-spline;config

Multi-PR squash merge with no body or review text. The diff replaces several `/// #` stubs with C across Kirby copy ability setup/dispatch, common fighter dead/rebirth logic, game/menu/library/toy helpers, and finishes `sysdolphin/baselib/spline.c` as matching. It also updates exact struct layouts, prototypes, includes, symbol metadata, and build config needed for matching.

Postmortem JSON: `pr-2369/postmortem.json`

## PR #2368: Match spline

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin/baselib/spline;GALE01 symbols;configure.py matching configuration

Closed, unmerged PR that attempted to match `src/sysdolphin/baselib/spline.c`. The diff changed storage-class/inline qualifiers for spline helper functions, extracted a tiny `spl_GetArcLengthDx` helper in `splArcLengthGetParameter`, removed the now-static B-spline helper from the public header, renamed spline `.sdata2` symbols back to compiler-style `@N` labels, and flipped `spline.c` from `NonMatching` to `Matching` in `configure.py`. The automated decomp.dev report showed `splArcLengthGetParameter` and `.sdata2` reaching 100%, with +912 matched code bytes and +56 matched data bytes.

Postmortem JSON: `pr-2368/postmortem.json`

## PR #2367: Library, menu, and game system decompilation matches

Status: agent_completed
Type: decomp-matching
Systems: library;menu;game-mode;trophy;audio;THP-video;ARQ;stage-unlock;rules-menu;data-delete;name-entry

Closed, unmerged PR that replaced placeholders with library/menu/game/trophy decomp implementations and typed prototypes. The PR body claimed 8 matched functions, but the decomp.dev bot corroborated 5 new 100% function matches and several partial/data improvements: matched code rose to 61.13% (+0.03%, +1120 bytes). No human review comments or closing rationale are present in the slice.

Postmortem JSON: `pr-2367/postmortem.json`

## PR #2366: Fighter decompilation matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;ftCommon;death-star-ko;rebirth-respawn

Closed, unmerged fighter decomp PR for Kirby copy-ability logic and common fighter death/rebirth behavior. The diff replaced several placeholder comments with C implementations, added an `unk_deadup` motion-var layout refinement, and added one callback prototype. decomp.dev reported +684 matched bytes and 3 new full matches, while two claimed functions were only partial improvements.

Postmortem JSON: `pr-2366/postmortem.json`

## PR #2365: Item and Pokemon decompilation matches

Status: agent_completed
Type: decomp-matching
Systems: item;pokemon item logic;character items;fighter/Kirby

Merged item/Pokemon decompilation PR replacing placeholders with C implementations across item files, plus header/struct typing needed for those matches. The PR text says 17 matched functions across 11 item/Pokemon files; the decomp.dev bot reported +1852 matched code bytes, +64 matched data bytes, 12 new full matches, and 15 additional near/full improvements.

Postmortem JSON: `pr-2365/postmortem.json`

## PR #2364: Stage decompilation matches

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;baselib;materials;lighting;collision;controller;camera

Merged stage decompilation work implementing 13 previously stubbed or partially unknown functions across 9 stage files, plus matching-driven prototype and GroundVars layout fixes. The decomp.dev bot reported matched code at 61.17% (+0.03%, +1220 bytes), with 5 newly 100% matched functions and multiple near-match improvements in stage units.

Postmortem JSON: `pr-2364/postmortem.json`

## PR #2363: Jj/mnnamenew

Status: agent_completed
Type: decomp-matching
Systems: mn/name-entry;mn/main-menu;mn/name-list;sysdolphin/baselib/sislib;config/GALE01 symbols;gm/result;stage/ground;fighter;item;lb

Large decomp-focused PR for the name-entry menu module, replacing many mnnamenew stubs with typed C implementations for key setup, input, glyph variants, auto-name selection, validation, saving, and menu entry paths. It also propagated stronger types through menu structs and SisLib color handling, and split the mnnamenew data string blob into named symbols. decomp.dev reported +1712 matched bytes, 5 new matches, and 20 mnnamenew improvements.

Postmortem JSON: `pr-2363/postmortem.json`

## PR #2362: Link itsonans

Status: agent_completed
Type: decomp-matching
Systems: item;config;build

Linked the item module `melee/it/items/itsonans.c` by changing it from NonMatching to Matching after small source, symbol, and header cleanups. The PR finished two previously near-matching functions, `it_802CD4FC` and `it_802CD7D4`, corrected/localized several data symbols, removed header-defined numeric constants, and updated the item state table symbol to `it_803F7CA0`. The decomp.dev bot reported 5 new matches for GALE01, including `.sdata2`, `.sdata`, `.data`, `it_802CD4FC`, and `it_802CD7D4`, with +972 matched code bytes and +1940 linked code bytes.

Postmortem JSON: `pr-2362/postmortem.json`

## PR #2361: Link ftwaitanim

Status: agent_completed
Type: decomp-matching
Systems: fighter;fighter-wait-animation;ftwaitanim;ftdata;config/GALE01

Linked `src/melee/ft/ftwaitanim.c` by switching it from NonMatching to Matching and making `ftCo_8008A7A8` reach 100%. The match was achieved with control-flow/codegen shaping in `ftwaitanim.c`, a manual inline of `ftCo_8008A6D8`, cleanup of wait-animation data typing, and symbol-table updates for newly linked data. decomp.dev reported `main/melee/ft/ftwaitanim` / `ftCo_8008A7A8` improved from 99.86% to 100%, with +592 matched code bytes, +864 linked code bytes, and +72 linked data bytes.

Postmortem JSON: `pr-2361/postmortem.json`

## PR #2360: match most of mncount

Status: agent_completed
Type: decomp-matching
Systems: mn/menu-records;gm/persistent-record-stats;if/textlib;ty/trophy;lb/cardgame;config/GALE01

Large mncount decompilation pass for the Data / Records / Misc Records menu. The PR replaced much of the remaining placeholder/unmatched mncount code with typed C, semantic row/stat names, menu text creation, scrolling input handling, arrow indicator updates, and setup/init/free logic. It also renamed related gmMainLib/gm/textlib symbols and updated call sites. decomp.dev reported +1724 matched code bytes, +16 matched data bytes, 4 new matches, and many mncount functions improved into the 91-99% range.

Postmortem JSON: `pr-2360/postmortem.json`

## PR #2359: Various fighter work

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCrazyHand;ftKirby;ftPopo;ftNana;Ice Climbers;item;effects

Multi-character fighter decomp/matching PR covering Crazy Hand, Kirby, and Ice Climbers/Popo/Nana code. It replaced many `/// #...` stubs with matching C, corrected fighter/item headers and attribute structs, and added item/effect declarations needed by the new implementations. decomp-dev reported matched code rising to 60.76% (+0.18%, +7136 bytes), with 20 new 100% matches and 8 partial improvements; PR body and human review comments were absent.

Postmortem JSON: `pr-2359/postmortem.json`

## PR #2358: Link grfzerocar

Status: agent_completed
Type: decomp-linking
Systems: melee/gr/grfzerocar;stage;ground;GALE01 symbols;configure.py

Linked `src/melee/gr/grfzerocar.c` by moving it from NonMatching to Matching, updating GALE01 symbols, and applying small codegen/data-ordering fixes around F-Zero car stage data, `grFZeroCar_801CAFBC`, `.data`, `.sdata`, and `.sdata2`. The PR used an explicit `"archive"` assert string, a dummy `fakeFunc(Vec3)` workaround for `.sdata2` constant ordering, local layout/codegen adjustments, and an expanded scale-multiply block. decomp.dev reported 4 new matches, including 100% for `main/melee/gr/grfzerocar` `.sdata`, `.sdata2`, `.data`, and `grFZeroCar_801CAFBC`.

Postmortem JSON: `pr-2358/postmortem.json`

## PR #2357: Jj/grcastle

Status: agent_completed
Type: stage decompilation and matching
Systems: stage;ground;grcastle;baselib/HSD;camera;items/materials;lb/vector

Large Castle stage decompilation PR centered on src/melee/gr/grcastle.c. It replaced many placeholder functions with C, expanded Castle-specific Ground gv overlays and parameter/table structs, tightened grcastle.h prototypes, and adjusted lb_800103B8 to return float for new wind/vector code. decomp.dev reported +6764 matched bytes, +0.17% overall matched code, 16 new matches, and 9 improved unmatched items. Human discussion only called out an inline rlwimi/rwlimi asm block, which maintainers accepted because it was guarded by MWERKS_GEKKO.

Postmortem JSON: `pr-2357/postmortem.json`

## PR #2356: Fixed matching for ftCo_80097D88

Status: agent_completed
Type: decomp-matching fix
Systems: fighter;ftCommon;DownBound

Small fighter common matching fix for `ftCo_80097D88` in `ftCo_DownBound.c`. The previous function body was factored into a local `static void inlineA1(Fighter_GObj* gobj)` helper, the fighter pointer load was changed from direct `gobj->user_data` to `GET_FIGHTER(gobj)`, and `ftCo_80097D88` became a thin wrapper calling `inlineA1(gobj)`. decomp.dev reported this produced one new GALE01 match: `ftCo_80097D88` improved from 0.00% to 100.00%, +56 bytes.

Postmortem JSON: `pr-2356/postmortem.json`

## PR #2355: ftKb_SpecialN.c work

Status: agent_completed
Type: decomp-matching
Systems: fighter;Kirby;item;effects;ftCommon

Matched a substantial batch of Kirby special-move code in ftKb_SpecialN.c, centered on neutral-special inhale/capture/spit/drink animations, airborne stone IASA, and one copied-special IASA path. decomp.dev reported +3608 matched bytes, 16 new 100% matches, and fn_800F53AC improved from 0% to 98.51%. The PR also cleaned up the Kirby item distance helper it_802F23AC by giving it real Item_GObj/Vec3 types instead of raw int*/float* pointer math.

Postmortem JSON: `pr-2355/postmortem.json`

## PR #2354: gr match, get fzerocar closer

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Pokemon Stadium;F-Zero car;GALE01 symbols

Small ground/stage decomp-matching PR that fully matched Pokemon Stadium function grStadium_801D2FD0, improved grStadium_801D4548, and brought F-Zero car setup grFZeroCar_801CAFBC closer. The patch mostly reshaped C without changing apparent behavior: renamed two Stadium callbacks from fn_* to grStadium_* in symbols/header/call sites, used typed DynamicModelDesc access in grfzerocar, replaced pointer-walk temporaries with indexed table/data access, factored scale multiplication into a helper, and used a compiler dont_inline pragma instead of a separate inline wrapper.

Postmortem JSON: `pr-2354/postmortem.json`

## PR #2353: ftKb_SpecialNNs.c matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;Kirby copied neutral specials;items/effects

Large decompilation/matching PR for Kirby copied neutral-special code in src/melee/ft/chara/ftKirby/ftKb_SpecialNNs.c. It replaced many placeholder asm stubs with C implementations, especially the ftKb_PrSpecialN* animation/IASA/physics/collision path, plus smaller Ns and Dk special-N matches. The decomp.dev bot reported 42 new matches and +19284 matched bytes, bringing matched code to 60.38% (+0.50%). Header and struct changes supported the matches, notably converting three scalar Kirby fighter-vars fields x8C/x90/x94 into a Vec3 x8C used as stored JObj scale.

Postmortem JSON: `pr-2353/postmortem.json`

## PR #2352: Jj/mnname

Status: agent_completed
Type: decomp-matching
Systems: src/melee/mn/mnname;src/melee/mn/mnnamenew;src/melee/gm/gmmain_lib;config/GALE01/symbols;HSD_GObj;HSD_JObj;HSD_SisLib;lbarchive;lbaudio_ax;lblanguage

Large mnName name-menu decompilation slice. The PR implemented many previously stubbed functions for name-list display, sorting, deletion, scrolling, input handling, confirmation UI, archive loading, and text rendering, while tightening headers and GALE01 data symbols. The decomp-dev bot reported GALE01 matched code at 60.49% (+0.10%, +3956 bytes), with 11 new matches in main/melee/mn/mnname and several larger remaining partials improved substantially.

Postmortem JSON: `pr-2352/postmortem.json`

## PR #2351: Match lbcardgame

Status: agent_completed
Type: decomp-matching
Systems: melee/lb;lbcardgame;GALE01 symbols;configure.py

Matched the lbcardgame object by completing its data representation, making small codegen-sensitive C changes, correcting a struct offset comment, updating GALE01 symbols, and flipping src/melee/lb/lbcardgame.c from NonMatching to Matching in configure.py. The decomp.dev bot reported 4 new matches: lbcardgame .data, lb_8001CC84, lb_8001C658, and lb_8001C8BC all reaching 100%.

Postmortem JSON: `pr-2351/postmortem.json`

## PR #2350: ftKb_SpecialNZd.c matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;items;effects;audio

Matched a large slice of Kirby copied neutral-special logic in src/melee/ft/chara/ftKirby/ftKb_SpecialNZd.c. The PR replaced multiple placeholder functions with matching C for Sheik-needle-style spawning, Mewtwo-copy charge/fire/start/loop/IASA behavior, and fn_801090D4, with small cleanup changes that finished several near-matches. decomp.dev reported 18 new matches and +6208 matched bytes, raising matched code by +0.16%.

Postmortem JSON: `pr-2350/postmortem.json`

## PR #2349: ftkirbyspecialfox.c matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;Kirby;Fox/Falco copied SpecialN;items/projectiles

Matched Kirby's copied Fox/Falco blaster special code in ftkirbyspecialfox.c. The PR implemented ftKb_SpecialNFx_800FDF30, completed ftKb_SpecialNFx_800FE100 and ftKb_SpecialNFx_800FE240, and centralized several ftKb_Init data declarations. decomp.dev reported +1040 matched bytes, +0.03% overall matched code, 3 new function matches, and an .sdata2 improvement. Review focused on avoiding an obviously artificial goto-based match and preserving proper OSReport/HSD_ASSERT usage.

Postmortem JSON: `pr-2349/postmortem.json`

## PR #2348: mnname

Status: agent_completed
Type: decomp-matching
Systems: mn;mnname;name-entry-menu

Draft tracking PR for the mnname menu unit. The local dump has no changed files or diff because the PR was closed unmerged with zero current commits, but the decomp.dev report records measurable matching progress in main/melee/mn/mnname: +3184 matched bytes overall, 10 newly matched items, and 13 improved unmatched items.

Postmortem JSON: `pr-2348/postmortem.json`

## PR #2347: ftPr_SpecialN.c matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftPurin;SpecialN;collision;efsync;HSD_JObj

Matched the Purin/Jigglypuff SpecialN implementation in src/melee/ft/chara/ftPurin/ftPr_SpecialN.c, adding full C for key charge-release animation and collision routines and tightening several near-matches in release/turn physics and animation. The decomp.dev report credited 9 new matches and +7480 matched bytes, with one small .sdata2 regression noted.

Postmortem JSON: `pr-2347/postmortem.json`

## PR #2346: Match grdisplay

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grdisplay;camera;HSD_JObj;HSD_GObj;fog;config

Matched the ground display translation unit by closing the last small mismatches in `grDisplay_801C5B90` and `grDisplay_801C5DB0`, then flipping `melee/gr/grdisplay.c` from NonMatching to Matching in `configure.py`. The decomp.dev GALE01 report recorded 2 new matches, with `grDisplay_801C5DB0` and `grDisplay_801C5B90` both reaching 100%, plus matched code +976 bytes and linked code +1072 bytes.

Postmortem JSON: `pr-2346/postmortem.json`

## PR #2345: Match progress

Status: agent_completed
Type: decomp-matching-progress
Systems: game-mode;menu;stage;item

Batch match-progress PR that reported 14 matched functions and 8 failed attempts across stages, items, game/menu code, and status/HUD code. The final merged diff was small and focused: it rewrote mn_80230198 in mnmainrule.c into a switch-based mode dispatch, expanded grHomeRun_GroundVars layout with padding and bitfields, adjusted a gm_1601.h prototype from s32 to int, and added an explicit default break in itlugia.c. The author later noted the work was split into subsystem draft PRs for easier review and that several commits were dropped because equivalent or better decompilations were already upstream.

Postmortem JSON: `pr-2345/postmortem.json`

## PR #2344: Decompile 9 fighter, library, game, and menu functions

Status: agent_completed
Type: decomp-matching
Systems: fighter/common;fighter/collision-animation;fighter/crazy-hand;fighter/ice-climbers;game-mode/events;library/THP;menu/name-entry;player/stats

Merged multi-system decomp PR. The supplied diff replaces stubs with C for eight visible functions: `ftCo_800C0134`, `fn_800DA1D8`, `ftCh_Damage2_Anim`, `ftPp_SpecialAirHiThrow_0_Anim`, `pl_80037DF4`, `fn_8017F1B8`, `mnName_80238A04`, and `fn_8001F06C`, plus related header, prototype, include, and `THPDecComp` layout fixes. The PR body says nine functions and lists `un_80307828` in `toy.c`, but `toy.c` is absent from the provided changed-files/diff slice, so that item is only body-evidenced here. Review feedback caught an unscoped `#pragma dont_inline on` in `mnname.c`; the final diff wraps it with `#pragma push`/`#pragma pop`.

Postmortem JSON: `pr-2344/postmortem.json`

## PR #2343: ft/ftKirby: decompile 7 Kirby special N functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;Kirby SpecialN;Kirby copy abilities;ftCommon;items/throws;HSD animation

Merged a Kirby special-N decompilation slice replacing stubs in ftKb_Init, ftKb_SpecialN, ftKb_SpecialNNs, and ftKb_SpecialNZd. The diff implements inhale drink/swallow animation callbacks, copied Sheik/Mewtwo/Jigglypuff neutral-B behavior, and Kirby hat material-animation loading. The title/body say "7 functions", but the diff names eight public stub replacements, so the exact count is slightly inconsistent in the available evidence.

Postmortem JSON: `pr-2343/postmortem.json`

## PR #2342: it: decompile 5 item/Pokemon functions

Status: agent_completed
Type: item decompilation
Systems: item;Pokemon items;Kamex/Blastoise;Pikachu Thunder;Lugia;Oldkuri/Goomba;Kirby Cutter Beam;fighter-special interaction

Decompiled five item-related functions across Pokemon items, Oldkuri/Goomba, Lugia, and Kirby Cutter Beam, replacing placeholder comments with concrete C implementations and tightening related header prototypes. The diff adds item animation, physics, collision, and SpawnItem construction patterns. Evidence on matching is mixed: the PR body says all five functions 100% matched via an overnight script, while the decomp.dev bot report in the slice records 3 new 100% matches and 2 near-100% improvements.

Postmortem JSON: `pr-2342/postmortem.json`

## PR #2341: gr: decompile 7 stage functions

Status: agent_completed
Type: stage_function_decompilation
Systems: gr;stage;granime;corneria;kongo;homerun;oldpupupu;rcruise

Decompiled seven stage-layer functions across granime, Corneria, Kongo Jungle, Home-Run Contest, Dream Land/Old Pupupu, and Rainbow Cruise, replacing placeholder asm markers with C and tightening several prototypes/struct layouts. The PR body claims all seven matched by an overnight script; the decomp.dev bot slice only shows one new 100% match and several near-100% improvements, so exact match status is partially conflicting in the available evidence.

Postmortem JSON: `pr-2341/postmortem.json`

## PR #2340: Fixed ftKb_SkSpecialAirNEnd_Coll

Status: agent_completed
Type: decompilation-match-fix
Systems: fighter;Kirby;special-move;landing

One-line Kirby fighter decomp fix: in src/melee/ft/chara/ftKirby/ftKb_SpecialNZd.c, ftKb_SkSpecialAirNEnd_Coll now calls the common landing transition ftCo_Landing_Enter_Basic(gobj) after ft_80081D0C detects ground contact, instead of calling ftKb_SpecialNSk_80105E8C(gobj). The decomp.dev report shows the target item main/melee/ft/chara/ftKirby/ftKb_SpecialNZd ftKb_SkSpecialAirNEnd_Coll improved from 0.00% to 100.00% (+84 bytes).

Postmortem JSON: `pr-2340/postmortem.json`

## PR #2339: ef work

Status: agent_completed
Type: decomp-matching
Systems: effect;fighter;item;game-mode;VI;grlib;baselib-particle;MSL;config

Large visual-effects decomp pass focused on matching and naming: renamed the efSpecial unit to efAlt, moved shared ef static/small data into new efdata.c/h, renamed many efLib/efAsync/efSync APIs and structs, matched efAlt_Spawn plus several ef data sections, got efAsync_Spawn and efsync/efasync .sdata to 100%, and modestly improved efSync_Spawn and efAsync_Dispatch. The PR also updated callers across fighter/item/game-mode/VI/lbdvd/grlib/particle code and added typed math constants for matching.

Postmortem JSON: `pr-2339/postmortem.json`

## PR #2338: ef work

Status: agent_completed
Type: decomp-matching-refactor
Systems: effect;eflib;efasync;efsync;efalt;baselib-particle;fighter;item;game-mode;visual-modes;MSL;config

Closed-unmerged PR proposing a broad visual-effects decomp cleanup: renamed many efLib/efAsync symbols from address-based names to descriptive APIs, replaced efspecial with efalt, added efdata for shared EF allocation/sbss data, documented EF structs/enums/flags, and improved efSync_Spawn/efAsync_Dispatch matching. The bot reported +656 matched-code bytes and new matched efalt/efdata units, but also broken old unit matches from file renames and an efasync .data regression; there was no human review in the dump.

Postmortem JSON: `pr-2338/postmortem.json`

## PR #2337: Permuter fixes and itlinkarrow work

Status: agent_completed
Type: decomp-matching
Systems: items/itlinkarrow;fighter/Yoshi SpecialS;fighter/Yoshi SpecialHi

Permuter-driven matching pass focused on Link's arrow item code/data and Yoshi special move edge cases. The PR had no body or human review comments, but the decomp.dev bot reported +5220 matched code bytes and +256 matched data bytes, including `itlinkarrow` `.data` reaching 100%, several `itlinkarrow` functions reaching 100%, and three Yoshi SpecialS collision functions reaching 100%. The diff is mostly codegen-shaping refactors: static inline helpers, stack/local-variable reshaping, bool/cast cleanup, data-symbol placement, and a few explicit fake/permuter helper artifacts.

Postmortem JSON: `pr-2337/postmortem.json`

## PR #2336: match fn_800D7C60, fn_800D81D0

Status: agent_completed
Type: decompilation_match
Systems: fighter;ftCommon;Attack100

Matched two ftCommon Attack100 air item-scope enter functions, `fn_800D7C60` and `fn_800D81D0`, by adding C implementations in `ftCo_Attack100.c`. The PR body identifies them as the air scope rapid and air scope fire enter variants, modeled after ground counterparts and calling `ftCommon_ClampAirDrift` after `Fighter_ChangeMotionState`.

Postmortem JSON: `pr-2336/postmortem.json`

## PR #2335: Match progress

Status: agent_completed
Type: decomp-matching
Systems: fighter;kirby;crazy-hand;popo-ice-climbers;stage;item;library-thp;game-mode-awards;menu-name-entry;player-stats;trophy-viewer;melee-core

Draft aggregate match-progress PR that replaced many `/// #` stubs with C implementations across fighter, stage, item, library, game-mode, menu, player-stat, and trophy-viewer code. The PR body reported 32 matched functions, 11 failed, and 1 in progress, but it was closed unmerged after the author split it into themed PRs #2341 stages, #2342 items, #2343 Kirby, and #2344 misc; the closing note also says `fn_80200460` was excluded as only a 98.2% match.

Postmortem JSON: `pr-2335/postmortem.json`

## PR #2334: ft/ftCommon: match fn_800DC070

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;CaptureJump;Attack100

Implemented `fn_800DC070` in `src/melee/ft/chara/ftCommon/ftCo_Attack100.c` as the CaptureJump enter routine. The PR body identifies it as handling the transition when a buried fighter escapes from the burier's grab, with a reported `fuzzy_match_percent: 100.0`. The PR was closed without merge and had no review comments in the provided slice.

Postmortem JSON: `pr-2334/postmortem.json`

## PR #2333: Match progress

Status: agent_completed
Type: decomp-matching-progress-report
Systems: ftKb Kirby SpecialN;toy;stage grPura;stage grOnett;stage grCastle;player pl;name-entry-ui;unknown fn/un symbols

Closed, unmerged no-diff PR used as a match-progress report. It recorded 5 fully matched Kirby ftKb_SpecialN animation functions, 1 pending toy.c function, and 7 failed or partial match attempts across stage, player, UI, and unknown/generated-symbol areas. Because there were no changed files or diff bytes, this should be treated as tracking evidence rather than landed code.

Postmortem JSON: `pr-2333/postmortem.json`

## PR #2332: Link grkraid

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;kraid;config;symbols

Linked the Kraid ground/stage object by making src/melee/gr/grkraid.c matching and flipping it from NonMatching to Matching in configure.py. The work combined small MWCC-oriented C rewrites with symbols.txt fixes for rodata/data/sdata/sdata2 scopes, sizes, and alignments, resolving reported string-offset and padding issues around grKr data.

Postmortem JSON: `pr-2332/postmortem.json`

## PR #2331: Match ftCo_FlyReflect

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;collision;knockback;build-config;symbols

Matched the ftCommon FlyReflect object by reshaping ftCo_FlyReflect.c codegen, matching its .sdata2 constants, and switching the file from NonMatching to Matching. The work used stack-padding locals/PAD_STACK, forced no-inline plus a separate inline clone for ftCo_800C1718, a PPC-style fake_sqrtf using __frsqrte, and explicit branch temporaries in collision paths. Automated decomp.dev output reported 4 new GALE01 matches in this unit, including .sdata2, ftCo_800C17CC, ftCo_800C18A8, and ftCo_FlyReflect_Coll.

Postmortem JSON: `pr-2331/postmortem.json`

## PR #2330: Finish last function of ftkb_specialnpk

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;ftKb_SpecialNPk

Matched the remaining function in ftKb_SpecialNPk by making small, non-semantic C-shaping changes inside ftKb_SsSpecialNHold_Anim. The patch introduced extra Fighter pointer aliases, adjusted PAD_STACK sizing, and used the alias for later charge-state accesses to reach a 100% match for the function while deferring broader linking because the file is split from ftKb_Init.

Postmortem JSON: `pr-2330/postmortem.json`

## PR #2329: gm_1832

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gm_1832;classic-mode;one-player-intro;vs-mode-intro;training-mode;camera;HUD;SisLib;audio;HSD-GObj-JObj

Large gm_1832 decompilation expansion covering Classic/1P intro splash behavior, VS intro camera/model scene setup, and Training Mode HUD/menu state. The PR replaced many stubs in src/melee/gm/gm_1832.c with C, added typed game-mode structures and prototypes, and improved decomp.dev matched code by +1932 bytes (+0.05%) with 5 new 100% matches and 30 fuzzy improvements. Evidence also notes one slight broken match, fn_801884F8, attributed by the author to data/offset issues expected to resolve when linking.

Postmortem JSON: `pr-2329/postmortem.json`

## PR #2328: itsamusgrapple work

Status: agent_completed
Type: decomp-matching
Systems: item;fighter;Samus;Samus grapple;HSD/JObj;collision

Large Samus grapple item decomp slice. The PR filled in many src/melee/it/items/itsamusgrapple.c functions, added typed Samus grapple item attributes and prototypes, corrected ItemLink-based item vars, and adjusted ftSamus data/motion var typing needed by the grapple logic. decomp.dev reported +3336 matched-code bytes, +16 matched-data bytes, 9 new matches, and 13 near-match improvements; the author explicitly noted many remaining near-matches and duplicated code.

Postmortem JSON: `pr-2328/postmortem.json`

## PR #2327: mpIsland

Status: agent_completed
Type: decomp-matching
Systems: melee/mp;mpIsland;map-collision;stage-collision

Decomp/matching PR for the mpIsland map-collision module. The single changed file, src/melee/mp/mpisland.c, replaces raw decompiler temporaries in mpIsland_8005A728 with typed map/collision traversal, implements the formerly stubbed mpIsland_8005B004, and makes small matching/data-order cleanups. The PR body only says "tracking PR", so intent is inferred from the diff and decomp.dev report.

Postmortem JSON: `pr-2327/postmortem.json`

## PR #2326: Match 13 misc functions (gr, it, ft, gm, if)

Status: agent_completed
Type: decomp-matching
Systems: fighter;game-mode;item;stage;interface;sound-test;home-run-contest

Merged PR replacing 13 `/// #` stubs across stage, item, fighter, game-mode, and interface code with C implementations plus concrete prototypes/struct fields. Covered Rainbow Cruise platform initialization, Tingle/Kyasarin/Crazy Hand/Ice Climbers item behavior, Sound Test array fill, Ice Climbers and Kirby special callbacks, Home-Run Contest distance calculation, Yoshi's Island cloud response, CSS data copy, and regular-clear grade display. The PR body says all functions were 100% verified via objdiff and specifically notes a `#pragma dont_inline` for `un_802FFCD0`; the decomp-dev bot reported +384 bytes matched code with 2 new full matches and many high-percent improvements.

Postmortem JSON: `pr-2326/postmortem.json`

## PR #2325: gr: decompile grIceMt_801F91EC, grKongo_801D8078

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Ice Mountain;Kongo Jungle;items;mpLib

Stage decomp PR for Ice Mountain and Kongo Jungle. It renamed/exposed the Ice Mountain helper as `grIceMt_801F91EC`, fixed its header prototype, used zero animation offsets in its `grAnime_801C7A04` calls, and implemented `grKongo_801D8078` as an item proximity scan over `HSD_GObj_Entities->items`. The automated match report recorded `grIceMt_801F91EC` as a new 100% match and `grKongo_801D8078` as improved to 98.43%, with `gricemt` `.sdata2` also improved.

Postmortem JSON: `pr-2325/postmortem.json`

## PR #2324: gm: decompile fn_80170110, gm_801BEDA8, fn_8017F09C

Status: agent_completed
Type: decomp-matching
Systems: game-mode;character-select-screen;unlock-checks;regular-clear

Merged game-mode decompilation PR replacing three placeholder comments with matching C for fn_80170110, gm_801BEDA8, and fn_8017F09C. The functions cover unlock availability checks, CSS match-type cycling, and regular-clear time bonus calculation. Headers were updated to replace UNK prototypes with concrete void*, int, u8, and s32 signatures. The PR body and automated report both indicate 100% matches for the target gm functions.

Postmortem JSON: `pr-2324/postmortem.json`

## PR #2323: mn/ty: decompile IsNameUnique, un_80305D00

Status: agent_completed
Type: decomp-matching
Systems: mn/name-entry;ty/toy;HSD pad input;melee-core

Merged a small matching decompilation PR for `IsNameUnique` in `mnname` and `un_80305D00` in `toy`, plus the `IsNameUnique` header prototype. The match bot reported both new functions at 100% and +316 bytes overall. The PR body appears stale or copied from another PR because it describes unrelated stage functions, so this record relies on the title, diff, and match report.

Postmortem JSON: `pr-2323/postmortem.json`

## PR #2322: ft/ftKirby: decompile Kirby special N and Hi moves

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;ftCommon;item;effects

Decompiled several Kirby special-move functions in ftKb_SpecialN.c and ftKb_SpecialNNs.c: Final Cutter ground/air enter routines, Inhale swallowed-item/fighter proximity checks, and Kirby-with-Pikachu-copy Skull Bash collision/wall-bounce handling. The diff also added MWCC dont_inline pragmas for matching control and an extern collision box declaration. Automated reporting recorded two new exact matches and several near-complete improvements.

Postmortem JSON: `pr-2322/postmortem.json`

## PR #2321: Match progress

Status: agent_completed
Type: decomp-matching
Systems: fighter-kirby;game-mode;regular-clear;menu-name-entry;stage;toy-trophy

Unmerged WIP matching batch reporting 34 matched functions and 7 failed attempts, later closed as replaced by PRs #2322, #2323, #2324, and #2325. The provided diff slice replaces multiple `/// #...` stubs with C implementations across Kirby special-move code, game-mode/results/CSS logic, Icicle Mountain and Kongo Jungle stage helpers, name-entry logic, and toy/trophy input code. Reusable value is mostly in matching tactics: tightening header prototypes, adding precise includes, preserving MWCC-sensitive control flow and register allocation patterns, reloading `GET_FIGHTER` after state changes, and using exact f32/f64 distance behavior.

Postmortem JSON: `pr-2321/postmortem.json`

## PR #2320: Match 2 misc functions (lb, mn)

Status: agent_completed
Type: decomp-matching
Systems: lb/lbaudio_ax;mn/mnname;baselib/HSD_ObjAlloc;lb/lblanguage;name-entry-menu;audio-pool

Implemented two previously placeholder functions: `lbAudioAx_80024DC4` in the audio library code and `mnName_8023749C` in name-entry menu code. The audio match depended on recognizing `lbl_80433710` as an extended pool object with an embedded `HSD_ObjAllocData` plus sound-channel arrays. The menu function became a typed, language-specific name-table lookup; the PR body describes terminator appending, but the diff evidence shows lookup-and-NULL-on-terminator behavior. Automated feedback confirmed `lbAudioAx_80024DC4` as a new 100% match, while the same bot report listed `mnName_8023749C` as 97.84%, conflicting with the PR body's 100% fuzzy-match claim.

Postmortem JSON: `pr-2320/postmortem.json`

## PR #2319: Match 4 fighter functions

Status: agent_completed
Type: fighter decompilation matching
Systems: fighter;ftCommon Attack100/CaptureJump;ftCrazyHand;ftKirby;ftcolanim

Implemented four fighter-related C functions and one Crazy Hand attribute type correction. The decomp.dev bot reported +464 matched bytes and 3 new 100% matches: `fn_800DC070`, `ft_800C0098`, and `ftCh_Init_80157170`; it also reported `ftKb_SpecialN_800F1420` improved from 0.00% to 95.54%, despite the PR body claiming 100.0 fuzzy match for all functions.

Postmortem JSON: `pr-2319/postmortem.json`

## PR #2318: Match 11 stage functions

Status: agent_completed
Type: decomp-matching
Systems: stage;gr;Corneria;Great Bay;Home Run Contest;Inishie1;Old Kongo;Old Pupupu

Merged stage decomp PR replacing placeholder stubs with C implementations across Corneria, Great Bay, Home Run Contest, Inishie1, Old Kongo, and Old Pupupu. The diff added stage behavior for moving collision vertices, Arwing sequencing, Great Fox surface checks, Home Run marker text placement, item/block respawn callbacks, and random timer/spawn initialization. decomp.dev reported +1440 matched bytes, 8 new 100% matches, and 3 additional near-match/improvement rows for implemented functions in the captured bot report.

Postmortem JSON: `pr-2318/postmortem.json`

## PR #2317: Misc item work

Status: agent_completed
Type: decomp-matching
Systems: item;it/items;itCharItems;itCommonItems;collision;effects;fighter-item callbacks

Broad item decompilation sweep replacing many item placeholder stubs with matching C, tightening item headers and item-var/attribute layouts, and typing several formerly unknown prototypes. The decomp.dev bot reported +8716 matched code bytes, +48 matched data bytes, and 51 new matches; the PR body was empty and no human review comments were captured.

Postmortem JSON: `pr-2317/postmortem.json`

## PR #2316: grfzerocar work

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grfzerocar;granime;HSD_JObj

Large stage decomp PR for grfzerocar: filled previously empty src/melee/gr/grfzerocar.c with F-Zero car data tables, default scale/translate/rotate data, a setup_car_child helper, and grFZeroCar_801CAFBC. It also made grAnime_801C6C0C non-static and exported it in granime.h so grfzerocar could reuse the animation-binding path. decomp.dev reported one new .rodata match and grFZeroCar_801CAFBC improving from 0.00% to 98.74%. Human review evidence is minimal; the only human note says this was a very large function attempted with Claude.

Postmortem JSON: `pr-2316/postmortem.json`

## PR #2315: Work in progress — pending matches

Status: agent_completed
Type: closed_unmerged_decomp_matching_wip
Systems: fighter;stage;ground;item;audio-library;menu-name;baselib-hsd

Closed, unmerged WIP branch for pending decomp matches across fighter, ground/stage, item, audio, and menu code. The PR body reported 0 matched and 5 failed target attempts, but the decomp-dev bot comment for GALE01 reported +0.06% matched code (+2200 bytes), 13 new 100% matches, and 18 additional unmatched-item improvements. Treat this as a useful prototype/matching evidence slice rather than landed project history.

Postmortem JSON: `pr-2315/postmortem.json`

## PR #2314: Overnight decomp run — 2026-03-17

Status: agent_completed
Type: no-op automated decomp run
Systems: gr/grpura target only

Automated overnight decomp-run PR that closed unmerged with no code changes. The PR body reported 0 matched, 0 failed, and 1 in-progress target: `grpura.c` / `grPura_80212FC0` pending. A decomp.dev bot comment for GALE01 also said "No changes", so this is best treated as a no-op queue/progress marker rather than a landed decomp postmortem.

Postmortem JSON: `pr-2314/postmortem.json`

## PR #2313: lb/lbbgflash

Status: agent_completed
Type: decomp-matching
Systems: library;lb;lbbgflash;background-flash;GX;baselib

Decompiled and typed a large slice of src/melee/lb/lbbgflash, replacing placeholders with GXColor-based background flash state, GObj/CObj setup, overlay update, JObj matrix/quaternion helpers, and an IK-style joint adjustment routine. The automated report recorded 5 new full matches and 8 partial-match improvements, raising matched code by +1448 bytes (+0.04%). Human review evidence is weak: the PR body only says it was a tracking PR and there were no review comments.

Postmortem JSON: `pr-2313/postmortem.json`

## PR #2312: mn work

Status: agent_completed
Type: decomp-matching
Systems: melee/mn menu subsystem;event match menu;item switch menu;count menu;main rules menu

Brought a batch of previously 0%-match menu (`mn`) code into C, centered on event match, item switch, count, and main-rule menu helpers. The PR also retyped `mn_8022EC18` from a raw `float*` triple to `AnimLoopSettings*` and propagated that through several menu animation callers. decomp.dev reported +2768 matched bytes, +0.07% matched code, 15 new 100% matches, and several partial `mnevent` improvements. The only human review explicitly agreed that `AnimLoopSettings` was the right direction.

Postmortem JSON: `pr-2312/postmortem.json`

## PR #2311: Run `clang-format`

Status: agent_completed
Type: formatting_cleanup
Systems: effect;stage;ground;menu

Mechanical clang-format cleanup merged across 36 files, mainly ground/stage sources plus small effect and menu touches. The diff reorders includes, wraps or unwraps long lines, reformats repeated initializer entries, and adjusts comments/prototypes without evidence of semantic logic changes. No PR body, review comments, or issue comments were present in the slice.

Postmortem JSON: `pr-2311/postmortem.json`

## PR #2310: gr work

Status: agent_completed
Type: decomp-matching
Systems: melee/gr;Ground;StageCallbacks;PushOn stage;Corneria stage;HomeRun stage;OldKongo stage;OldPupupu stage;IceMt stage;Pura stage;sysdolphin/baselib/lobj;lb;mn stage select

Broad GR/stage decomp PR that factored a repeated stage-GObj callback setup pattern into the inline helper Ground_SetupStageCallbacks, swept many stage loaders to use it, and added matching work for Push On plus callback/data tables and setup functions in Corneria, Home Run, Old Kongo, and Old Pupupu. decomp.dev reported GALE01 matched code at 58.52% (+0.04%, +1740 bytes), with 8 new grpushon matches and 14 additional improvements.

Postmortem JSON: `pr-2310/postmortem.json`

## PR #2309: Overnight decomp run — 2026-03-16

Status: agent_completed
Type: decomp-progress-report
Systems: audio;lbAudioAx

Closed, unmerged overnight decomp status PR with no diff or changed files. The PR body reported one in-progress decomp target: `lbAudioAx_80024DC4` in `lbaudio_ax.c`, described as registering a sound effect into one of 16 audio playback slots by reusing an existing matching slot or claiming a free slot.

Postmortem JSON: `pr-2309/postmortem.json`

## PR #2308: Overnight decomp run — 2026-03-16

Status: agent_completed
Type: status-only decomp run
Systems: grpura.c

Automated overnight decomp PR opened by johnwinston to track a pending attempt on `grPura_80212FC0` in `grpura.c`. The captured PR body reports 0 matched, 0 failed, and 1 in progress; the slice has no changed files, no diff, no comments, and no reviews. The PR was closed unmerged shortly after creation, so it appears to be a status-only or abandoned automated run rather than a landed decomp change.

Postmortem JSON: `pr-2308/postmortem.json`

## PR #2307: ftYs_Special work

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftYoshi;ftYs_SpecialS;ftYs_SpecialHi;itYoshiEggThrow;collision;effects;camera

Large Yoshi special-move decomp PR focused on ftYs_SpecialS, with a smaller ftYs_SpecialHi egg-throw callback improvement. It replaced many `/// #` stubs with C, expanded Yoshi attribute and motion-var layouts, typed item prototypes, and produced 9 new full matches plus 11 near/full improvements according to decomp.dev.

Postmortem JSON: `pr-2307/postmortem.json`

## PR #2306: Rename `efspecial` and `efSpecial_SpawnSpecial`

Status: agent_completed
Type: effect_symbol_and_translation_unit_rename
Systems: effect;config;build;fighter;item

Renamed the matching effect translation unit from `ef_061D` to `efspecial` and the global function at 0x80061D70 from `ef_80061D70` to `efSpecial_SpawnSpecial`. The PR kept build and matching metadata in sync by updating `splits.txt`, `symbols.txt`, `configure.py`, the renamed source/header include, and the `efSync_Spawn` extern/call site. It also contains small mechanical formatting/include-order cleanups in Kirby and item files. The decomp.dev bot report showed the expected rename accounting: `main/melee/ef/efspecial` became 100% matched while the old `main/melee/ef/ef_061D` unit became 0%.

Postmortem JSON: `pr-2306/postmortem.json`

## PR #2305: ftPr_SpecialN.c work

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftPurin;Purin SpecialN;Purin Rollout;ftCommon;collision;baselib JObj

Large Purin/Jigglypuff SpecialN Rollout decompilation pass. The PR filled many ftPr_SpecialN.c TODO stubs across Enter, Anim, IASA, Phys, Coll, and callback helpers, expanded Purin motion/attribute structs, and retyped init data used for rollout scaling and collision. decomp.dev reported +9540 matched bytes and 27 new 100% matches, with several additional near-matches; it also flagged 3 broken ftKirby matches, so cross-unit match fallout remained a risk.

Postmortem JSON: `pr-2305/postmortem.json`

## PR #2304: Small fixes to THPDec

Status: agent_completed
Type: decomp-matching fix
Systems: Dolphin THP decoder;external/dolphin;video THP

Closed, unmerged THP decoder cleanup/matching PR touching only THPDec.c and thp.h. It refined THP struct layouts, named a Huffman-table count field, passed THPFileInfo explicitly through the 512x448 iMCU row path, and restored more low-level THPInit behavior. decomp.dev reported a small net matched-code gain (+0.03%, +984 bytes) and one new match, but also one broken 100% match, so this should be treated as a useful evidence slice rather than a landed change.

Postmortem JSON: `pr-2304/postmortem.json`

## PR #2303: gm/mn: match 4 functions

Status: agent_completed
Type: decompilation_match
Systems: game-mode;menu;name-entry;rules-menu

Implemented and typed several gm/mn utility functions in game-mode, Rules menu, and Name Entry code. The diff replaces stubs for fn_8018846C, mn_80232458, mnName_GetPageCount, mnName_GetColumnCount, and mnName_802388D4, updates headers, and adds supporting Rules-menu data arrays. decomp-dev reported 4 new full matches totaling +620 matched bytes; mnName_GetColumnCount was listed as a 98.72% improvement despite the PR body claiming all functions were verified 100% via objdiff.

Postmortem JSON: `pr-2303/postmortem.json`

## PR #2302: grkinokoroute: match 2 functions

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Mushroom Kingdom;effects;camera;fighter-lib

Matched two `grKinokoRoute` Mushroom Kingdom stage callback functions, `grKinokoRoute_802084B4` and `grKinokoRoute_80208660`, and replaced their header `UNK_RET`/`UNK_PARAMS` declarations with typed prototypes. The implementations wire stage route logic into existing JObj, ground, effect, camera, material, and fighter-lib helpers. PR evidence says objdiff reached 100% for both functions and `ninja` built cleanly.

Postmortem JSON: `pr-2302/postmortem.json`

## PR #2301: ftKb_SpecialN: match 3 functions

Status: agent_completed
Type: decompilation_match
Systems: fighter;ftKirby;ftKb_SpecialN;Kirby specials

Matched three previously stubbed Kirby special-move callbacks in src/melee/ft/chara/ftKirby/ftKb_SpecialN.c: ftKb_SpecialHi1_Anim, ftKb_SpecialAirS_Enter, and ftKb_EatJump1_Anim. The PR body says all three were verified as 100% objdiff matches and ninja built cleanly; decomp.dev reported 3 new matches totaling +416 matched bytes.

Postmortem JSON: `pr-2301/postmortem.json`

## PR #2300: it: match 14 item functions

Status: agent_completed
Type: decomp-matching
Systems: item;character-items;common-items;pokeball-pokemon;stage;effects

Replaced item placeholder stubs with C implementations across Ice Climbers ice, Mr. Game & Watch chef, Pikachu Thunder, Lugia, Ho-Oh, and Old Kuri/Goomba callbacks, while tightening item attribute/item-var structs and prototypes needed for matching. The PR body claimed 14 matched functions with objdiff and clean ninja verification; the decomp.dev bot reported +2328 matched bytes, 15 new 100% matches, and two additional near-matches.

Postmortem JSON: `pr-2300/postmortem.json`

## PR #2299: Finish data match and linking of multiple Ness items

Status: agent_completed
Type: decomp-matching
Systems: item;fighter;config;build

Finished matching/linking work for several Ness item units by adding missing item data tables, correcting the old PK Flash naming from `pkflush`/`pkflushexplode` to `pkflash`/`pkflashexplode`, updating includes and item logic callbacks, and flipping the affected objects to `Matching` in `configure.py`. The decomp.dev bot reported +12020 linked-code bytes, +336 matched-data bytes, +552 linked-data bytes, and 41 new matches; the 35 broken matches shown are largely the old `itnesspkflush` unit names being replaced by `itnesspkflash` names.

Postmortem JSON: `pr-2299/postmortem.json`

## PR #2298: grRCruise matches

Status: agent_completed
Type: decomp-matching
Systems: stage/grRCruise;ground;mpLib/collision;GALE01 symbols

Advanced grRCruise stage decompilation by replacing several asm-placeholder routines with typed C, adding the stage callback table and initialization flow, refining grRCruise Ground vars, and widening mpLib collision callback storage so GObj/Ground payload ambiguity is represented more accurately.

Postmortem JSON: `pr-2298/postmortem.json`

## PR #2297: tydisplay

Status: agent_completed
Type: decomp-matching
Systems: tydisplay;toy;item;ground/stage;HSD/baselib archive and JObj

Large tydisplay/ToyDsp decomp PR that replaced many placeholder stubs in src/melee/ty/tydisplay.c with typed C, recovered display/archive/JObj helper structs, and tightened related headers/callsites. decomp.dev reported +5476 matched bytes (+0.14% total matched code), with 8 new full matches and 15 additional tydisplay improvements. The PR body only said it was a tracking PR, so intent beyond matching progress is inferred from the diff and bot report.

Postmortem JSON: `pr-2297/postmortem.json`

## PR #2296: gr Shrineroute and Kinokoroute matches, function renaming

Status: agent_completed
Type: stage-route decomp matching
Systems: stage-ground;grshrineroute;grkinokoroute;sysdolphin-baselib-gobjproc;config-GALE01-symbols;camera;effect;fighter;game-mode;item;menu;interface;victory-mode

Stage-focused matching PR that implemented two Shrine Route functions, partially advanced Kinoko Route, and performed broad semantic renames of common GObj helpers. decomp.dev reported matched code rising to 57.96% (+0.01%, +316 bytes), with `grShrineRoute_8020AD58` and `grShrineRoute_8020B020` newly 100% matched; `grKinokoRoute_8020754C` improved to 99.97% and Kinoko route `.data` to 33.47%. The diff also renamed `Ground_801C14D0` to `Ground_GetStageGObj` and `HSD_GObjProc_8038FD54` to `HSD_GObj_SetupProc` across symbols, headers, implementations, and many call sites.

Postmortem JSON: `pr-2296/postmortem.json`

## PR #2295: Almost 100% match ftKb_SpecialNPk.c

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;motion-states;items;collision;animation;IASA

Large Kirby copied-neutral-special decomp pass centered on src/melee/ft/chara/ftKirby/ftKb_SpecialNPk.c. It replaced many asm/stub markers with C for Pikachu/Pichu, Koopa/Giga Bowser, Link/Young Link, and Samus-copy neutral-B behavior, plus small header/type fixes. The decomp.dev bot reported +10,360 matched code bytes and 44 new matches; the author explicitly noted one remaining regswap issue in ftKb_SsSpecialNHold_Anim, which the bot showed at 97.36% rather than 100%.

Postmortem JSON: `pr-2295/postmortem.json`

## PR #2294: Fix a bunch of near-matches

Status: agent_completed
Type: decomp-matching near-match data-value fix
Systems: fighter;fighter-kirby;ftcoll;game-mode;results;stage;big-blue;big-blue-route;venom;item;toy;sysdolphin-baselib;particle

Broad decomp-matching cleanup for functions that were nearly 100% but had wrong data values: incorrect `bl` call targets, wrong float/data relocations, incorrect constants, and a few bad prototypes/storage declarations. The author explicitly linked the problem to agents not starting from `m2c` and/or not diffing with `functionRelocDiffs=data_value`. The diff fixed many small semantic/matching errors across Kirby specials, ft collision, game-mode/results, Big Blue/Big Blue Route/Venom stages, items, toy, and baselib; decomp.dev reported only 6 new matches and 2 improvements, while the author noted many data-value fixes were not reflected by match reporting.

Postmortem JSON: `pr-2294/postmortem.json`

## PR #2293: Tyfigupon

Status: agent_completed
Type: decomp-matching
Systems: src/melee/ty;tyfigupon;toy;tylist;if/types;config/GALE01

Large decompilation pass for src/melee/ty/tyfigupon.c, covering Toy Figure Pon menu setup, cameras, panel/coin/lever assets, bet/count displays, trophy unlock flow, cleanup, and several GObj process callbacks. The PR also tightened related headers and structs, especially ToyAnimState and un_804D6EF4_t, and adjusted local data symbol scope. decomp.dev reported +1804 matched bytes, 10 new matches overall, and many tyfigupon functions improving from 0% to high partial or 100% match.

Postmortem JSON: `pr-2293/postmortem.json`

## PR #2292: gr/gm: decompile stage and game functions

Status: agent_completed
Type: decomp-matching
Systems: game-mode;adventure-mode;stage;Hyrule Castle;Onett

Decompiled seven previously placeholder functions across adventure-mode game logic and stage code for Hyrule Castle and Onett. The PR also tightened several headers from UNK_RET/UNK_PARAMS to concrete signatures and refined local unknown struct fields needed by the matches. Verification evidence is strong: the PR body says all functions matched 100% via objdiff and main.dol SHA1 was OK, and the decomp-dev bot reported +1072 matched bytes.

Postmortem JSON: `pr-2292/postmortem.json`

## PR #2291: it: decompile Super Scope functions

Status: agent_completed
Type: decomp-matching
Systems: item;Super Scope;itsscope

Decompiled two Super Scope item functions, it_80291F14 and it_80291FA8, and tightened related prototypes/attribute layout so charge-level ammo costs can be read from itSScopeAttributes::xC. The PR reports 100% objdiff matches and main.dol SHA1 OK.

Postmortem JSON: `pr-2291/postmortem.json`

## PR #2290: it: decompile item functions

Status: agent_completed
Type: item decompilation
Systems: item;Unown/Unknown;Butterfree/Patapata;Tingle/Tincle;Goldeen/Oldottosea

Decompiled several item callbacks across Unown/Unknown, Butterfree/Patapata, Tingle/Tincle, and Goldeen/Oldottosea, with supporting item-var and attribute struct field exposure in itCommonItems.h. The PR body reports 100% objdiff matches and main.dol SHA1 OK; the decomp.dev bot confirmed +1216 matched bytes and 8 new 100% matches, while listing itOldottosea_UnkMotion2_Coll as a 96.47% improvement in that report.

Postmortem JSON: `pr-2290/postmortem.json`

## PR #2289: ft: decompile Kirby & Ice Climbers special moves

Status: agent_completed
Type: decomp-matching
Systems: fighter;Kirby;Popo;Nana;Ice Climbers

Decompiled 17 fighter special-move functions for Kirby copy abilities and Ice Climbers specials, replacing /// # stubs with 100% objdiff-matching C. The PR covered Kirby Ness, Sheik, Pikachu/Pichu, Bowser/Giga Bowser, and Link/Young Link neutral-B helpers plus Popo/Ice Climbers up-B and down-B helpers. It also added required callback/header prototypes and refined Popo special attributes. Verification reported main.dol OK and decomp.dev showed +2676 matched bytes, +0.07%, with 17 new 100% matches.

Postmortem JSON: `pr-2289/postmortem.json`

## PR #2288: Match grShrineRoute_8020A104, cleanup callback function names

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;ShrineRoute;GALE01 config;baselib GObj/LObj

Matched the Shrine Route stage function grShrineRoute_8020A104 and cleaned up several Shrine Route callback/function names across source, header, and GALE01 symbols. The new match models a stage-specific Ground gv layout for storing a classifier-0xC HSD_GObj, iterating its HSD_LObj chain, preserving LObj flags, caching helper-returned LObj pointers, and then calling grShrineRoute_8020A21C. The automated decomp.dev report credited one new match worth +272 bytes and a small .sdata improvement.

Postmortem JSON: `pr-2288/postmortem.json`

## PR #2287: Remove fake function in texpdag

Status: agent_completed
Type: decomp-matching
Systems: sysdolphin;baselib;texpdag;config/GALE01

Removed an empty fake function, fn_80386230, from sysdolphin baselib texpdag and folded its 4-byte symbol range into the preceding real function make_full_dependancy_mtx. The source stub was deleted and config/GALE01/symbols.txt now records make_full_dependancy_mtx as size 0x134 instead of 0x130, with HSD_TExpSchedule still starting at 0x80386234.

Postmortem JSON: `pr-2287/postmortem.json`

## PR #2286: Match grZebesRoute_8020B260

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grzebesroute;baselib-gobj

Implemented the Zebes Route stage object setup function grZebesRoute_8020B260, added its StageCallbacks data table, and corrected the public prototype to return HSD_GObj*, improving that function from 0.00% to 99.97% in the decomp.dev report.

Postmortem JSON: `pr-2286/postmortem.json`

## PR #2285: ifcoget + random permuters

Status: agent_completed
Type: decomp-matching
Systems: interface/ifcoget;fighter/Kirby;stage/ground;game-mode/save-records;menus;baselib/SisLib;baselib/particle;library/lbsnap

Merged matching pass focused on ifcoget plus scattered permuter-driven fixes across Kirby, stage, menu, game-mode, and baselib code. The automated decomp.dev report recorded +5580 matched bytes, 22 new 100% matches, and 5 remaining ifcoget improvements; the slice contains no human review comments.

Postmortem JSON: `pr-2285/postmortem.json`

## PR #2284: Match remaining Ness items except yoyo

Status: agent_completed
Type: decomp-matching
Systems: item;fighter;Ness;Kirby copied Ness special;PK Thunder;PK Flash/PK Flush;PK Fire;Ness bat

Matched a large batch of Ness item code, explicitly excluding yoyo, across Ness bat, PK Fire, PK Flash/PK Flush, PK Flush explode, PK Thunder ball, and PK Thunder trail. The PR replaced many placeholder decomp stubs with C, tightened item variable structs and prototypes, and produced an automated decomp.dev report of 37 new matches, +9524 matched code bytes, and +200 matched data bytes.

Postmortem JSON: `pr-2284/postmortem.json`

## PR #2283: Decompile 18 functions (pointer math)

Status: agent_completed
Type: decompilation_batch_with_pointer_math_debt
Systems: game-mode/results;game-mode/regclear;ground/castle;ground/material;ground/rcruise;item/kamex;item/zgshell

Merged batch decompilation of pointer-math-heavy functions across game-mode results/regclear, ground stage/material code, and item Kamex/ZGShell code. The diff replaced many `/// #` stubs with C, added typed prototypes, and introduced partial layout knowledge such as `Ground.xC0`, `grCastle_GroundVars3`, `itGShell_HurtInit`, and `itKamexAttributes`. The important review lesson was negative: maintainer ribbanya merged but explicitly warned that pervasive raw pointer arithmetic from the Claude workflow creates technical debt, and said `M2C_FIELD` would be preferred over raw `u8*` math when proper struct fields are not available. Evidence on exact match status is mixed: the PR body claimed 18 functions and 100% objdiff, while the decomp.dev bot comment reported 14 new matches plus 5 partial improvements, including several functions below 100%.

Postmortem JSON: `pr-2283/postmortem.json`

## PR #2282: gm/gr/ty: decompile 5 misc functions

Status: agent_completed
Type: decomp-matching
Systems: gmregclear;game-mode;grcastle;groldpupupu;stage;tydisplay;toy-display

Decompiled five previously stubbed misc functions across gmregclear, grcastle, groldpupupu, and tydisplay. The PR replaced UNK_RET/UNK_PARAMS prototypes with typed signatures, exposed just enough unknown struct/global layout to support matching code, and the decomp.dev bot reported 5 new 100% matches totaling +564 matched bytes with no diff regressions.

Postmortem JSON: `pr-2282/postmortem.json`

## PR #2281: it: decompile 24 item functions

Status: agent_completed
Type: decomp-matching
Systems: item

Batch item decompilation PR across many item files. The PR body describes 24 item functions and a clean `ninja`, `ninja diff`, and objdiff test plan; the final diff slice visibly replaces 18 `/// #` placeholders with C and the decomp.dev report records +1996 matched bytes, +0.05%, 14 new 100% matches plus several improved items. The main reusable outcome is the review-driven move from overloading generic Pokemon item vars to adding a dedicated `itKabigon_ItemVars` struct and `kabigon` union member.

Postmortem JSON: `pr-2281/postmortem.json`

## PR #2280: ft: decompile 9 fighter functions

Status: agent_completed
Type: decompilation
Systems: fighter;ftCrazyHand;ftPopo;ftCommon;camera

Decompiled nine fighter functions across Crazy Hand, Popo/Ice Climbers, and common fighter camera code. The PR replaced asm placeholders for three ftCh_Init callbacks, five ftPp_SpecialS callbacks, and ftCo_Rebirth_Cam, with supporting header/type additions. The automated decomp.dev report recorded 9 new 100% matches, +1188 matched bytes, and overall matched code moving to 56.88% (+0.03%).

Postmortem JSON: `pr-2280/postmortem.json`

## PR #2279: Decompile 18 functions (pointer math)

Status: agent_completed
Type: unmerged_decompilation_proposal
Systems: game-mode/results;game-mode/register-clear;stage/ground;stage/material;stage/rcruise;item/kamex;item/zgshell;scripts;repo-docs

Closed-unmerged, Claude-generated PR proposing a batch of pointer-math-heavy decompilations across gm, gr, and it code. The PR body says the functions used M2C_FIELD, raw pointer arithmetic, and u8* casts and were grouped separately because match quality versus code style might need discussion. It also bundled large new local automation/docs files. The slice has no reviewer comments and no explicit closure reason, so treat the implementations as experimental/unaccepted evidence rather than merged project practice.

Postmortem JSON: `pr-2279/postmortem.json`

## PR #2278: gm/gr/ty: decompile 5 misc functions

Status: agent_completed
Type: decomp-matching
Systems: game-mode;stage;trophy;scripts;docs;repo-root

Closed, unmerged PR that decompiled five small stubs across gmregclear, grcastle, groldpupupu, and tydisplay while also adding substantial Claude/overnight automation docs and scripts. The C/header changes removed stub markers, added typed prototypes, exposed one gmregclear struct field, and the PR body claims `ninja`, `ninja diff`, and 100% objdiff matches. The only recorded feedback is a decomp.dev GALE01 bot report saying "No changes"; no human review explains why the PR was closed without merge.

Postmortem JSON: `pr-2278/postmortem.json`

## PR #2277: it: decompile 24 item functions

Status: agent_completed
Type: decomp-matching
Systems: item;scripts;docs;repo-root

Closed without merge. The PR body claimed 24 item functions decompiled across multiple item files, with `ninja`, `ninja diff`, and objdiff 100% checks passing. The visible diff replaces 20 `/// #` item stubs, updates item struct/header typing in `itCommonItems.h`, and adds substantial Claude Code automation/tooling docs and scripts. No review comments or closure rationale are present in the slice.

Postmortem JSON: `pr-2277/postmortem.json`

## PR #2276: ft: decompile 9 fighter functions

Status: agent_completed
Type: fighter-decomp-matching
Systems: fighter;ftCrazyHand;ftPopo;ftCommon;camera;scripts;docs;repo-root

Closed, unmerged PR that claimed 100% objdiff matches for nine fighter functions: three Crazy Hand functions in ftCh_Init, ftCo_Rebirth_Cam in ft_0D31, and five Popo/Ice Climbers special-move functions in ftPp_SpecialS. The diff also bundled a large Claude Code workflow document and autonomous decompilation scripts, making it a mixed decomp/tooling/docs PR. There were no review comments or reviews in the slice, and no recorded reason for the rapid close.

Postmortem JSON: `pr-2276/postmortem.json`

## PR #2275: grkraid matches

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grKraid;Kraid

Matched more of the Kraid stage ground object code in src/melee/gr/grkraid.c. The decomp.dev report recorded +2300 matched bytes, 3 new full matches in grKraid_801FE440, grKraid_801FEA00, and grKraid_801FEE54, plus improvements to grKraid_801FE6D8 and grKraid_801FE818. The useful work was mostly source-expression reshaping, local-vs-global data placement, and signedness/type fixes in gr/types.h.

Postmortem JSON: `pr-2275/postmortem.json`

## PR #2274: eflib, ef_061D, eflib_alloc

Status: agent_completed
Type: decomp-matching
Systems: effect;sysdolphin-baselib-particle;dballoc;config/GALE01;build-config

Merged effect-system matching PR that made `eflib`, new `eflib_alloc`, and `ef_061D` matching, while correcting effect allocator ownership, varargs prototypes, symbol/split boundaries, and related baselib particle/AppSRT declarations.

Postmortem JSON: `pr-2274/postmortem.json`

## PR #2273: grkraid.c 97%

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;gr;Kraid

Decompiled a large slice of the Kraid stage file, replacing several grkraid.c placeholder functions with C implementations and recovering related config/ground-var layouts. The automated decomp.dev report showed grkraid .data becoming a new 100% match and major per-function improvements, with the PR title indicating grkraid.c reached 97%. There was no PR body and no human review feedback in the slice.

Postmortem JSON: `pr-2273/postmortem.json`

## PR #2272: gr cleanup, internal ID fixes/additions, part 1

Status: agent_completed
Type: stage_internal_id_and_callback_cleanup
Systems: stage;ground;mp/mplib;camera;fighter-common-bury;config/GALE01

Broad stage/ground cleanup: renamed many gr callback-table functions to role-based names, corrected and filled out InternalStageId values, changed StageData's first field from a misleading flags field to internal_stage_id, and updated stage data initializers plus mpLib/camera/fighter call sites to use the real internal stage IDs. It also folded grheal.static.h into grheal.c, synchronized GALE01 symbols/scratches, and produced one new match in gricemt.

Postmortem JSON: `pr-2272/postmortem.json`

## PR #2271: items: match 11 functions

Status: agent_completed
Type: decomp-matching
Systems: item;itCommonItems;Lugia;Oldkuri;Whitebea;Nessbat;Ness PK Thunder Ball;Matadogas;Hitodeman;Great Fox Laser;Kirby_2F23

Matched 11 previously stubbed item functions across Lugia, Oldkuri, Whitebea, Nessbat, Ness PK Thunder Ball, Matadogas, Hitodeman, Great Fox Laser, and Kirby_2F23 item code. The PR also refined item attribute and item-var layouts in itCommonItems.h and tightened two item header prototypes. decomp.dev reported 11 new 100% matches, +1336 matched bytes, and matched code rising to 56.03% (+0.03%).

Postmortem JSON: `pr-2271/postmortem.json`

## PR #2270: stages: match 2 functions

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;Old Pupupu;Rainbow Cruise;HSD JObj/DObj;stage materials

Matched two stage functions: grOldPupupu_80211110 in groldpupupu.c and grRCruise_80201B60 in grrcruise.c. The PR body states both were 100% matched. The changes replace nonmatching stubs with C implementations, add needed material/DObj includes, and tighten the grRCruise_80201B60 header prototype from UNK_RET/UNK_PARAMS to void(HSD_JObj*, s32).

Postmortem JSON: `pr-2270/postmortem.json`

## PR #2269: fighters: match 4 functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;Kirby;Yoshi;special-move-state

Matched four previously placeholder fighter functions in Kirby and Yoshi special-move code. The PR replaced `/// #...` markers with C implementations for `ftKb_SpecialAirHi2_Anim`, `ftKb_SpecialNLg_800F951C`, `ftYs_SpecialHi_Enter`, and `ftYs_SpecialAirHi_Enter`; the decomp-dev bot reported all four as 100% matched, adding +484 matched bytes and +0.01% matched code for GALE01.

Postmortem JSON: `pr-2269/postmortem.json`

## PR #2268: Almost finish mngallery.c + misc matches

Status: agent_completed
Type: decomp-matching
Systems: mn/mngallery;gm/gm_1601;gr/grcorneria;lb/lbaudio_ax;HSD/baselib;MTHP playback;stage unlocks

Large decomp/matching PR centered on almost completing src/melee/mn/mngallery.c, with smaller exact-match cleanups in gm_1601, grcorneria, and lbaudio_ax. The decomp.dev report credited 19 new matches, +6052 matched code bytes, and +24 matched data bytes; fn_802590C4 remained an unmatched-but-improved mngallery item at 99.19%. The PR also tightened headers by replacing several UNK_RET/UNK_PARAMS prototypes with typed HSD_GObj, Vec3, u8 pointer, bool, and void signatures.

Postmortem JSON: `pr-2268/postmortem.json`

## PR #2267: groldyoshi.c 95%

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;animation;collision-map-joints

Advanced the Old Yoshi stage decomp in `src/melee/gr/groldyoshi.c`, with the PR title claiming 95%. The patch defined stage callback/data tables, added typed Old Yoshi cloud and guest ground-variable layouts, implemented the cloud init/update/collision path and guest behavior functions, and tightened header prototypes. The decomp-dev bot reported new full matches for `grOldYoshi_8020EAFC`, `.data`, `.sdata`, and `grOldYoshi_8020E854`, plus large partial improvements for `grOldYoshi_8020EC10`, `grOldYoshi_8020EFCC`, `grOldYoshi_8020F088`, and `grOldYoshi_8020F31C`.

Postmortem JSON: `pr-2267/postmortem.json`

## PR #2266: Bring back lbArchive_LoadSections

Status: agent_completed
Type: code-restoration
Systems: library;lbarchive;HSD_Archive;DAT/archive symbol loading

Reintroduced lbArchive_LoadSections in src/melee/lb/lbarchive.c. The restored helper takes an HSD_Archive plus varargs pairs of destination symbol pointers and public symbol names, looks each name up with HSD_ArchiveGetPublicAddress, stores the result through the caller-provided void**, and reports missing symbols with OSReport. The PR had no body or review discussion, so the exact regression or caller need is not documented beyond the title.

Postmortem JSON: `pr-2266/postmortem.json`

## PR #2265: lbarchive bug fix and cleanup

Status: agent_completed
Type: bugfix_cleanup
Systems: library/lbarchive;fighter/ftdata;config/GALE01-symbols

Small lbarchive cleanup/bugfix PR. It corrected variadic argument initialization in two lbArchive loaders, renamed the archive relocation routine from the address-style lbArchive_80017340 to lbArchiveRelocate across symbols/header/call sites, removed the standalone lbArchive_LoadSections implementation, and made a minor symbol_name shadowing cleanup. PR body and human review text were absent; intent is inferred from the title and diff. decomp.dev reported a GALE01 match regression because lbArchive_LoadSections disappeared from the lbarchive unit.

Postmortem JSON: `pr-2265/postmortem.json`

## PR #2264: gmregclear: match 2 functions

Status: agent_completed
Type: decomp-matching
Systems: game-mode;gmregclear

Closed, unmerged gmregclear decomp PR that matched two functions, fn_8017DE54 and fn_8017F14C, updated their header prototypes, and exposed a s16 field at lbl_80472D28_t offset 0x10A. The PR body claimed clean ninja and 100.0 fuzzy match for all functions. A later comment says the work was consolidated into other PRs, so this slice is useful mainly as evidence for matching tactics and type/layout decisions rather than as a merged change.

Postmortem JSON: `pr-2264/postmortem.json`

## PR #2263: stages: match 6 functions

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grcastle;grcorneria;grrcruise;grzebesroute;groldyoshi;grpushon;collision;display

Matched six previously undecompiled stage functions across grcastle, grcorneria, grrcruise, grzebesroute, groldyoshi, and grpushon. The PR replaced UNK prototypes with typed signatures, refined several stage data/ground-variable layouts, and decomp.dev reported all six functions at 100.00% with +680 matched bytes and +0.02% overall matched code.

Postmortem JSON: `pr-2263/postmortem.json`

## PR #2262: fighters: match 6 functions

Status: agent_completed
Type: decompilation-match
Systems: fighter;ftKirby;ftCrazyHand;ftPopo

Replaced six fighter assembly placeholder stubs with matching C across Kirby copy-special code, Crazy Hand slap animation code, and Popo special cleanup code. The PR body reported clean `ninja` verification and `fuzzy_match_percent: 100.0` for all six functions; the decomp.dev bot confirmed 6 new 100% matches worth +652 bytes.

Postmortem JSON: `pr-2262/postmortem.json`

## PR #2261: items: match 20 more item functions

Status: agent_completed
Type: decomp-matching
Systems: item;pokemon-items;effects;collision;map;animation

Matched a batch of item/Pokemon-related functions across 12 item C files, replacing /// # stubs with 100% matching C and tightening several item attribute/prototype declarations. The PR body says 20 item functions were decompiled and verified with a clean ninja build plus fuzzy_match_percent 100.0; the decomp.dev bot reported +2276 matched code bytes, +16 matched data bytes, and 21 new matches including one .sdata2 match.

Postmortem JSON: `pr-2261/postmortem.json`

## PR #2260: Match and link ftlinkspecialn via hacky solution, cleanup inline names

Status: agent_completed
Type: decomp-matching
Systems: fighter/ftLink;ftLk_SpecialN;build configuration;GALE01 symbols;sysdolphin/baselib/devcom data

Made Link's neutral special source, ftLk_SpecialN.c, build as a Matching object and therefore link into GALE01. The source-side fix was explicitly described as hacky: it cleaned up placeholder inline helper names while also using codegen-sensitive tactics such as duplicate zero Vec3 constants, stack padding macros, helper splitting, and literal/ordering changes. The symbols file was also adjusted heavily for local/global scope and BSS layout, including baselib/devcom data. decomp.dev reported +1616 matched code bytes, +6500 linked code bytes, and +33024 matched data bytes, with new matches for ftLk_SpecialNStart_Anim, ftLk_SpecialAirNStart_Anim, and devcom BSS/SBSS.

Postmortem JSON: `pr-2260/postmortem.json`

## PR #2259: grdisplay cleanup and near match of grDisplay_801C5DB0

Status: agent_completed
Type: decomp-matching
Systems: melee/gr/grdisplay;melee/gr/ground;sysdolphin/baselib/jobj;camera;fog;fighter-shadows;HSD_JObj;HSD_CObj

Cleaned up grdisplay and added a near-match implementation of grDisplay_801C5DB0. The PR retyped and clarified grDisplay_801C5B90, added proper grdisplay/inlines/fog/state includes, modeled stage display gating around camera, fog, fighter shadows, and JObj callbacks, typed Ground_801C1E84 as returning HSD_GObj*, and replaced a local CObj view-matrix inline in jobj.c with HSD_CObjGetViewingMtxPtrDirect. decomp.dev reported grDisplay_801C5DB0 improved to 99.58% and grDisplay_801C5B90 to 99.85%; there was no human review text in the slice.

Postmortem JSON: `pr-2259/postmortem.json`

## PR #2258: items: match 19 functions across item files

Status: agent_completed
Type: decomp-matching
Systems: item;pokemon-items;fighter-item-interactions;effects

Merged item decomp PR that replaced 19 previously stubbed item functions with matching C implementations across many item files. The changes were mostly small item state, animation, physics, destruction, effect, and fighter-interaction callbacks, supported by item variable struct/layout fixes and typed header prototypes. The PR body and decomp-dev bot report both state all 19 functions reached 100% match; the bot reported +1740 matched bytes and matched code rising to 55.82%.

Postmortem JSON: `pr-2258/postmortem.json`

## PR #2257: tydisplay: match 3 functions

Status: agent_completed
Type: decomp-matching
Systems: melee/ty;tydisplay;toy-display-assets

Matched three previously stubbed `tydisplay` functions: two resource-name lookup-table functions and one ID-filtering routine. The PR updated concrete header prototypes for two functions, reported `ninja` clean and 100% fuzzy matches, and the decomp.dev bot recorded 3 new matches totaling +448 matched bytes in `main/melee/ty/tydisplay`.

Postmortem JSON: `pr-2257/postmortem.json`

## PR #2256: mnname: match 2 functions

Status: agent_completed
Type: decomp-matching
Systems: melee-core;menu-name-entry;mnname;mnnamenew;baselib-gobj-jobj-sislib

Matched two mnname functions, `fn_80238540` and `mnName_80239FFC`, with clean build verification and 100.0 fuzzy match for all changed functions. The work replaced placeholders with typed menu input/cleanup logic, added a local `MnName_GObj` overlay, and updated related headers so HSD_GObj/HSD_JObj/HSD_Text usage is explicit.

Postmortem JSON: `pr-2256/postmortem.json`

## PR #2255: ftCommon: match ftCo_Rebirth_Anim

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;rebirth

Matched the ftCommon rebirth animation callback ftCo_Rebirth_Anim. The implementation loads Fighter from Fighter_GObj user_data, calls ftCo_8008A7A8 with fp->ft_data->x24, decrements fp->mv.co.common.x0, and transitions through ftCo_800D5600 when the counter reaches zero. The PR also tightened ftCo_800D5600's header prototype from unknown return/params to void ftCo_800D5600(Fighter_GObj* gobj). Reported verification was a clean ninja build and 100.0 fuzzy match.

Postmortem JSON: `pr-2255/postmortem.json`

## PR #2254: ftPopo: match 2 SpecialS physics functions

Status: agent_completed
Type: decompilation-match
Systems: fighter;ftPopo;Ice Climbers;ftPp_SpecialS

Matched two ftPopo physics callbacks in ftPp_SpecialS.c, `ftPp_SpecialAirHiStart_1_Phys` and `ftPp_SpecialAirHiThrow_1_Phys`, by implementing their shared airborne fall behavior and exposing two previously padded Ice Climber attribute floats at offsets xA8 and xAC. Verification reported clean `ninja`, 100% fuzzy match, and decomp.dev confirmed 2 new matches totaling +168 bytes.

Postmortem JSON: `pr-2254/postmortem.json`

## PR #2253: ftKirby: match 5 functions

Status: agent_completed
Type: function_decompilation_match
Systems: fighter;ftKirby;Kirby SpecialN;ftCommon interop

Decompiled five ftKirby SpecialN/copy-ability functions across four files. The PR body and decomp.dev bot both reported 100% matches; the bot credited +776 bytes of matched code and +0.02% GALE01 matched code.

Postmortem JSON: `pr-2253/postmortem.json`

## PR #2252: grhomerun: match grHomeRun_8021ED74

Status: agent_completed
Type: decompilation_match
Systems: grhomerun;stage;item;bobomb_rain

Matched the Home-Run Contest stage function grHomeRun_8021ED74 by replacing its undecompiled placeholder with a small Bob-Omb rain setup routine. The function now initializes a BobOmbRain struct, obtains a stage JObj with Ground_801C2CF4(0x7F), reads its position into the struct via lb_8000B1CC, and spawns/starts the item effect with it_8026BE84. The header prototype was tightened from unknown return/params to void grHomeRun_8021ED74(void). PR body reports a clean ninja build and fuzzy_match_percent 100.0.

Postmortem JSON: `pr-2252/postmortem.json`

## PR #2251: grpushon: match 2 functions

Status: agent_completed
Type: decompilation_match
Systems: grpushon;ground;stage;mplib

Matched two Push On stage/ground functions: grPushOn_802182C8 and fn_80218678. The PR replaced placeholder decomp markers with C implementations, added the needed mp/mplib.h include for mpLib_80057BC0, and tightened fn_80218678's header prototype from unknown return/params to bool fn_80218678(void). The PR body reports a clean ninja build and 100.0 fuzzy match percent for all functions.

Postmortem JSON: `pr-2251/postmortem.json`

## PR #2250: grmutecity: match 2 functions

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grmutecity;mpLib;collision

Decompiled and matched two Mute City stage functions, `fn_801F2B58` and `grMuteCity_801F2BBC`, updating the local static data layout and header prototypes needed for typed collision/dynamics logic. The PR report states `ninja` built clean and `fuzzy_match_percent: 100.0`; the decomp.dev bot reported +184 matched code bytes and a `.sbss` match improvement.

Postmortem JSON: `pr-2250/postmortem.json`

## PR #2249: grmaterial: match 3 functions

Status: agent_completed
Type: decomp-matching
Systems: stage;ground;grmaterial;color-overlay

Closed, unmerged PR that attempted to decompile and 100% match three stage material functions: grMaterial_801C9490, grMaterial_801C9604, and grMaterial_801C9698. The patch corrected grMaterial_801C9470/801C9490 to use Item_GObj and CommandInfo, implemented ColorOverlay handling via Ground-relative pointer arithmetic, and added the needed lb forward include. A later comment explained the pointer arithmetic was not easily replaceable with struct fields because the material system overlays ColorOverlay data at Ground+0x40 and uses padding around Ground+0xC0. The PR was later closed with the note that it was consolidated into other PRs.

Postmortem JSON: `pr-2249/postmortem.json`

## PR #2248: grcastle: match 3 functions

Status: agent_completed
Type: decomp-matching
Systems: grcastle;ground;stage;item;fighter-lib

Closed/unmerged PR that decompiled three Castle stage functions in src/melee/gr/grcastle.c: grCastle_801CD960, grCastle_801CF750, and fn_801CFAFC. The PR body claimed ninja built cleanly and fuzzy_match_percent was 100.0 for all three. The main technical issue was intentionally retained pointer arithmetic around Ground/GroundVars layout because the available structs did not expose accurate named fields for the touched offsets; the author later noted the work was consolidated into other PRs.

Postmortem JSON: `pr-2248/postmortem.json`

## PR #2247: Match `devcom` and `iftime`

Status: agent_completed
Type: decomp-matching
Systems: melee/if;sysdolphin/baselib;config/GALE01;build-configuration

Matched two near-complete units: `main/melee/if/iftime` via `ifTime_CreateTimers` and `main/sysdolphin/baselib/devcom` via `HSD_DevComARAMWakeUp`. The PR changed local temporaries and pointer usage to reach matching codegen, flipped both source files from `NonMatching` to `Matching` in `configure.py`, and corrected anonymous symbol metadata in `config/GALE01/symbols.txt`. Review clarified that a build size mismatch for `@260` at `0x804D5790` should be fixed in `symbols.txt`, not by adding an artificial C object.

Postmortem JSON: `pr-2247/postmortem.json`

## PR #2246: Rename grstadium to grpstadium for asserts and clean them up, permuter match a function

Status: agent_completed
Type: stage-module-rename-assert-cleanup-and-decomp-match
Systems: stage;ground;Pokemon Stadium;build configuration;fighter include users;game-mode include users

Renamed the Pokemon Stadium ground module from grstadium to grpstadium so file/assert paths line up with the embedded grpstadium.c strings, updated build/split/include references, and cleaned repeated manual asserts into HSD_ASSERT calls. The PR also named TextWrapper HSD_Text pointers as win_static_p/win_dynamic_p and permuter-matched grStadium_801D3138, with decomp.dev reporting a net +408 matched bytes.

Postmortem JSON: `pr-2246/postmortem.json`

## PR #2245: Match more functions and data in `ftCo_Damage`

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;damage;GALE01 config;symbols

Matched additional code and data in `src/melee/ft/chara/ftCommon/ftCo_Damage.c`. The PR body named `ftCo_DamageFly_Anim`, `ftCo_DamageFlyRoll_Anim`, `ftCo_DamageFly_Phys`, `ftCo_8008E5A4`, and `ftCo_8008E9D0`; the decomp.dev bot reported 6 new matches, including `.sdata2`, for +1892 matched code bytes and +64 matched data bytes. The diff is mainly codegen-oriented restructuring: local ordering, stack padding, `GET_FIGHTER` use, helper extraction, `dont_inline`, and `.sdata2` symbol renames.

Postmortem JSON: `pr-2245/postmortem.json`

## PR #2244: grcastle matches

Status: agent_completed
Type: decomp-matching
Systems: stage/grcastle;ground;library/lb_00F9;baselib gobj;baselib spline;mpLib

Matched more of the grcastle stage by adding its StageData/StageCallbacks data, implementing several formerly placeholder functions, tightening castle-specific ground/parameter structs, and fixing lb_80011A50 to return the lb_800100B0 result. The decomp.dev bot reported +572 matched code bytes and +8 data bytes, with new 100% matches for grCastle_801CD37C, grCastle_801CF7B0, grCastle_801D0D24, and grcastle .sbss; grCastle_801CD4D0 and grCastle_801CD8A8 also improved but were not fully matched.

Postmortem JSON: `pr-2244/postmortem.json`

## PR #2243: Match `ftCo_Damage_OnExitHitlag`, `ftCo_Damage_Coll`, `ftCo_Damage_Anim`

Status: agent_completed
Type: decompilation_match
Systems: fighter;ftCommon;damage;GALE01 config

Small codegen-focused edits in ftCommon damage code matched `ftCo_Damage_OnExitHitlag` and `ftCo_Damage_Coll` for GALE01, with symbol-map relabeling of nearby `.sdata2` constants. The title also names `ftCo_Damage_Anim`, but the available diff and decomp.dev report only directly confirm new matches for `OnExitHitlag` and `Coll`.

Postmortem JSON: `pr-2243/postmortem.json`

## PR #2242: mninfobonus match & link

Status: agent_completed
Type: decomp-matching
Systems: melee-core;menu;mninfobonus;config/GALE01;build-configuration

Matched and linked the menu bonus info translation unit `src/melee/mn/mninfobonus.c`. The C diff is small but targeted: it introduced `textSize` and `textSetup` helpers around `HSD_SisLib` text creation, adjusted some literal/flag spellings in the model/GObj setup path, switched `mninfobonus.c` from `NonMatching` to `Matching` in `configure.py`, and updated GALE01 symbols to reflect local compiler-style data/sdata2 labels. The decomp.dev bot reported +2188 linked code bytes, +1240 matched data bytes, +1344 linked data bytes, and two new full matches for `main/melee/mn/mninfobonus` `.sdata2` and `.data`.

Postmortem JSON: `pr-2242/postmortem.json`

## PR #2241: Match ef_061D 100% and rename to efspecial (special effects)

Status: agent_completed
Type: closed-unmerged decomp-matching and naming attempt
Systems: effect;efsync;efasync;baselib-jobj;config

Unmerged PR attempting to finish-match the special-effects dispatcher at 0x80061D70 and rename ef_80061D70/ef_061D toward efSync_SpawnSpecial/efspecial. The diff rewrote the large gfx_id switch around direct va_arg use, named several local data/sdata2 constants, updated symbols and callsites, and used assert/include macro tricks around jobj.h to match. Reviewers flagged the macro/inline approach and merge-conflict/rename handling, then closed the PR because the function had already been matched upstream and this version did not improve code quality; rename-only work was suggested as a separate PR.

Postmortem JSON: `pr-2241/postmortem.json`

## PR #2240: Match ft_80083E64

Status: agent_completed
Type: decomp-matching
Systems: fighter;collision

Matched fighter function ft_80083E64 in src/melee/ft/ft_081B.c. The PR replaced a simple ft_800824A0 call plus PAD_STACK(8) with a static inline helper that uses an anonymous stack struct containing an 8-byte pad before a ftCollisionBox, manually updates CollData positions, calls ft_80082838 and mpColl_8004730C, then preserves the callback wrapper behavior. The decomp.dev bot reported ft_80083E64 moving from 99.90% to 100.00%.

Postmortem JSON: `pr-2240/postmortem.json`

## PR #2239: gm_18a5

Status: agent_completed
Type: decomp-matching
Systems: game-mode;tournament-mode;gm_18A5;gmtou

Large gm_18A5 tournament-mode decomp slice. The PR replaced many `/// #` stubs or partials in `src/melee/gm/gm_18A5.c`, added typed bracket/static-data layouts, corrected `TmData` tournament menu records, and updated headers/prototypes. decomp.dev reported 57.13% matched code overall, +0.20% and +7748 bytes, with 18 new matches and 46 unmatched-item improvements. The human PR body only says `Tracking PR as usual`, so technical intent is inferred from the diff and bot report rather than review discussion.

Postmortem JSON: `pr-2239/postmortem.json`

## PR #2238: zako matches

Status: agent_completed
Type: decomp-matching
Systems: camera;fighter;game-mode;item;library;menu;melee-core;stage

Draft/open matching branch for many Zako-related and adjacent functions. The central work implements grZakoGenerator spawning/cleanup/config logic, with additional camera, fighter, item, stage/material, and header typing matches across 71 files. It is useful as a source of matching tactics and struct-layout clues, but the PR is dirty/not merge-ready: a collaborator noted the branch touches too many files for an ours-merge strategy and needs manual conflict resolution, and the decomp.dev status comment reported many new matches alongside much larger regressions.

Postmortem JSON: `pr-2238/postmortem.json`

## PR #2237: itarwinglaser: fix raw pointer arithmetic, add itArwingLaser_ItemVars struct

Status: agent_completed
Type: item struct typing and pointer-arithmetic convention fix
Systems: item;it;itarwinglaser

Cleaned up Arwing laser item code by replacing raw gobj/item pointer arithmetic in it_802E7A4C with GET_ITEM() and typed item-var access, then added the missing itArwingLaser_ItemVars layout and xDD4_itemVar union member needed for item->xDD4_itemVar.arwinglaser.xE38 to address the correct item offset.

Postmortem JSON: `pr-2237/postmortem.json`

## PR #2236: Match ifStatus_802F6194

Status: agent_completed
Type: decompilation match
Systems: melee-core;ifstatus;src/melee/if

Matched ifStatus_802F6194 in src/melee/if/ifstatus.c by replacing a 99.81% near-match helper-based HSD_GObj traversal with direct control flow using explicit temporaries and goto labels. The PR states the result was checked locally in objdiff and in decomp.me.

Postmortem JSON: `pr-2236/postmortem.json`

## PR #2235: Match ifStatus_802F6194

Status: agent_completed
Type: decompilation_matching_control_flow_rewrite
Systems: melee-core;ifstatus;interface-status

PR #2235 attempted to fully match ifStatus_802F6194 in src/melee/if/ifstatus.c by replacing a near-matching helper-based linked-list traversal with explicit control flow using locals, labels, and gotos. The PR body says the change was checked locally in objdiff and in decomp.me, but the PR was closed unmerged and had no review discussion in the provided slice.

Postmortem JSON: `pr-2235/postmortem.json`

## PR #2234: ftCo_Attack100: fixes

Status: agent_completed
Type: decomp-matching fix
Systems: fighter;ftCommon;ftCo_Attack100;CaptureDamageLw

Small ftCommon Attack100 codegen fix that refactored CaptureDamageLw physics helpers into static inline bodies plus public wrappers. The change removed a local dont_inline pragma block, added PAD_STACK(4) for fn_800DC624, adjusted Fighter pointer reloads/local variable usage, and produced decomp.dev-reported 100% matches for fn_800DC624, ftCo_CaptureDamageLw_Phys, and ftCo_CaptureDamageLw_Coll.

Postmortem JSON: `pr-2234/postmortem.json`

## PR #2233: ftCo_Attack100 fixes

Status: agent_completed
Type: closed-unmerged-no-diff
Systems: fighter;ftCommon;ftCo_Attack100

Closed, unmerged PR titled `ftCo_Attack100 fixes` with no PR body, no comments/reviews, no diff, and zero changed files/additions/deletions in the available slice. The only substantive evidence is the title and head branch `fix/pr14-capturedamage-matches`; no actual ftCo_Attack100 code change or matching tactic can be verified from this PR dump.

Postmortem JSON: `pr-2233/postmortem.json`

## PR #2232: grzebes

Status: agent_completed
Type: decomp-matching
Systems: stage/grzebes;ground;grmaterial;grzakogenerator;config/GALE01

Large grzebes stage decomp/matching PR, initially disclosed as mostly AI-generated. It replaced many stubs in src/melee/gr/grzebes.c with typed C for Zebes stage object setup/update, acid/bubble/yakumono behavior, material callbacks, and zako-generator hooks, plus supporting Ground gv layouts, prototypes, and symbol fixes. decomp.dev reported +5868 matched code bytes and +800 matched data bytes, with 15 new full matches and 17 improved unmatched items.

Postmortem JSON: `pr-2232/postmortem.json`

## PR #2231: ftCo_Attack100 matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;item scope;catch/capture;items;Link/CLINK hookshot;Samus grapple;Yoshi capture interaction

Merged a large ftCommon matching pass in src/melee/ft/chara/ftCommon/ftCo_Attack100.c. Despite the file/title, the touched code mostly covers item-scope states and common catch/capture/tether behavior, plus header prototype cleanup. decomp.dev reported 33 new matches and +5844 matched bytes (+0.15%), while also flagging 3 broken matches in the same unit. Review centered on removing empty or unbalanced #pragma ranges and avoiding inline assembly outside SDK code.

Postmortem JSON: `pr-2231/postmortem.json`

## PR #2230: itfoods match & link

Status: agent_completed
Type: decomp-matching
Systems: item;itfoods;it_2725;GALE01-symbols;build-config

Matched and linked the common item food object by fixing itFoods_Logic18_Spawned and updating related symbols/prototypes. The PR moved melee/it/items/itfoods.c from NonMatching to Matching, corrected the foods state table symbol, adjusted item-var signedness and it_80273318's signature, and updated GALE01 symbol visibility/local labels. decomp.dev reported one new match, itFoods_Logic18_Spawned reaching 100%, with +120 matched code bytes, +1208 linked code bytes, and +104 linked data bytes.

Postmortem JSON: `pr-2230/postmortem.json`

## PR #2229: Match & link itevyoshiegg

Status: agent_completed
Type: decomp-matching
Systems: item;event Yoshi Egg;config/GALE01;configure.py;baselib JObj/GObj;effects;gm_1BA8

Matched and linked the event Yoshi Egg item object by implementing key code/data in `src/melee/it/items/itevyoshiegg.c`, adding EvYoshiEgg-specific item vars/dat attrs, renaming identified symbols, and switching the object from `NonMatching` to `Matching`. The decomp-dev bot reported 5 new matches: `itEvYoshiEgg_Logic42_DmgReceived`, `itEvYoshiEgg_Spawn`, `.data`, `itEvyoshiegg_UnkMotion5_Anim`, and `.sdata2`.

Postmortem JSON: `pr-2229/postmortem.json`

## PR #2228: Match ithammerhead & link, match some itscopebeam functions

Status: agent_completed
Type: decomp-matching
Systems: item;ithammerhead;itsscopebeam;itfoods;GALE01 symbols;configure.py

Implemented and linked/matched Hammer Head item code, plus matched selected Super Scope beam functions and data typing. `ithammerhead.c` was promoted from `NonMatching` to `Matching`; the decomp.dev report credited 9 new matches, including `it_80298ED0`, `it_80299C48`, Hammer Head anim/throw helpers, Hammer Head `.data`/`.sdata2`, and Super Scope beam `.sdata`. Evidence is from the diff and bot report; there was no PR body or human review feedback in this slice.

Postmortem JSON: `pr-2228/postmortem.json`

## PR #2227: Rename ftKb_SpecialNFx to ftkirbyspecialfox, match most functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;Kirby copied special N;Fox/Falco blaster;GALE01 config

Renamed Kirby's copied Fox/Falco neutral-special source unit from ftKb_SpecialNFx.c to ftkirbyspecialfox.c, updated GALE01 splits/configure/symbols, gave two anonymous fn_ symbols purpose names, typed the Kirby fighter-var blaster pointer, and added C implementations for most of the copied blaster start/loop/end logic. decomp.dev reported matched code at 55.24% (+0.04%, +1592 bytes), with 36 new matches under the new unit and two remaining near-matches for ftKb_SpecialNFx_800FE100/800FE240.

Postmortem JSON: `pr-2227/postmortem.json`

## PR #2226: ftKb matches

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftKirby;Kirby copied specials;item interaction

Matched several Kirby copied neutral-special routines in ftKb_SpecialNYs.c. The PR implemented three former decomp stubs, completed ftKb_MsSpecialNLoop_Anim, and decomp.dev reported 4 new GALE01 matches totaling +460 bytes.

Postmortem JSON: `pr-2226/postmortem.json`

## PR #2225: Finish some functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;fighter-kirby;game-mode;item;library;melee-core;stage;interface-soundtest

Small multi-system decomp matching PR that finished 9 functions and improved 11 more, according to the decomp.dev report: matched code rose to 55.19% (+0.05%, +2064 bytes). The changes are mostly source-shaping edits: stack padding, declaration order, direct field access, prototype width fixes, branch/cast tweaks, and removal of extra stores. The PR body was empty; intent is inferred from the title, diff, and match report.

Postmortem JSON: `pr-2225/postmortem.json`

## PR #2224: Match gmadventure, link, and ninja apply

Status: agent_completed
Type: decompilation_match
Systems: gm;gmadventure;adventure-mode;GALE01-symbols;configure.py

Matched the Adventure mode game-mode object by refactoring a repeated gm_8016A22C setup sequence in gmadventure.c into a shared static helper, then flipping melee/gm/gmadventure.c from NonMatching to Matching in configure.py. The PR also updated GALE01 local .sdata2 symbol labels from address-style gm_804DACxx names to compiler-style @NN labels. decomp.dev reported one new match: main/melee/gm/gmadventure gm_801B4974 reached 100.00%.

Postmortem JSON: `pr-2224/postmortem.json`

## PR #2223: Fix gmtitle to match, mark as matching, ninja apply

Status: agent_completed
Type: decomp-matching
Systems: game-mode:gmtitle;title-screen;config/GALE01/symbols;build-config:configure.py

Made the gmtitle object fully matching and promoted it in configure.py from Equivalent to Matching. The source fix was a small behavior-preserving refactor in src/melee/gm/gmtitle.c: extract the title/opening-VS state test into static inline bool isActiveTitle(), change fn_801A1498_inline from static inline to static, and call the helper in the animation start-frame branch. The ninja/symbol portion localized many gmtitle literals/constants, added local section labels, and split gmtitle BSS symbols. decomp.dev reported two new data matches for main/melee/gm/gmtitle: .bss and .sdata2.

Postmortem JSON: `pr-2223/postmortem.json`

## PR #2222: Rename gm_17C0 to gmregclear based on assert

Status: agent_completed
Type: module_rename
Systems: game-mode;config;melee-core;stage;library;video

Renamed the game-mode module and header from the address-derived provisional name gm_17C0 to gmregclear. The diff is almost entirely a coordinated file/include/config rename: split metadata, configure.py object registration, exported gm headers, direct consumers, and one documentation comment were updated while the object remained NonMatching. The title says the new name is based on an assert, but the slice does not include the assert text or location.

Postmortem JSON: `pr-2222/postmortem.json`

## PR #2221: Mark ft_0CD1 as matching, run ninja apply, fix splits.txt

Status: agent_completed
Type: decomp-matching-status-update
Systems: fighter;ftdevice;build-config;GALE01-symbols;GALE01-splits;items

Marked melee/ft/ft_0CD1.c as matching in configure.py, corrected two ftdevice.c OSReport string literals, and synchronized generated GALE01 config outputs for symbols and splits. The split fixes rename stale item object paths from it_2F2B/it_27CF to descriptive Yoshi item files, while the symbol update changes an sdata2 float label from ftCo_804D8EF8 to @183.

Postmortem JSON: `pr-2221/postmortem.json`

## PR #2220: Match itoctarockstone and cleanup it_27CF to match it, rename to ityoshiegglay, rename it_2F2B to ityoshitongue

Status: agent_completed
Type: item decomp-matching
Systems: item;fighter;config;build

Matched `itoctarockstone` by implementing `it_802E89D0` and marking the object Matching, then replaced provisional item filenames/headers with `ityoshiegglay` and `ityoshitongue`. The PR also dismantled the broad `it_27CF` umbrella header by moving prototypes into item-specific headers and updating fighter includes. There was no human review text in the slice; the decomp.dev bot reported the new Octarock stone match and old-unit broken-match entries for the renamed files.

Postmortem JSON: `pr-2220/postmortem.json`

## PR #2219: Scooping up some functions

Status: agent_completed
Type: decomp-matching
Systems: fighter;fighter-Kirby;game-mode;stage;item;trophy-toy;sysdolphin-baselib

Merged decomp-matching sweep across 24 files, dominated by Kirby copied-special codegen fixes plus smaller game-mode, stage, item, trophy, and baselib cleanups. The decomp.dev bot reported 55.12% matched code overall, +0.32% and +12392 bytes, with 52 new matches and one additional grFourside improvement.

Postmortem JSON: `pr-2219/postmortem.json`

## PR #2218: Match and link itgshell

Status: agent_completed
Type: decompilation matching and linking
Systems: item;itgshell;melee/it/items;GALE01 symbols;configure.py MatchingFor

Matched and linked the green-shell item object `src/melee/it/items/itgshell.c`. The PR made small codegen-oriented edits, factored shared shell-hit behavior into a `static inline` helper, corrected local constant symbol labels, and flipped `itgshell.c` from `NonMatching` to `Matching` in `configure.py`. The decomp.dev bot reported 4 new 100% function matches and GALE01 gains of +1320 matched-code bytes, +5896 linked-code bytes, and +197 linked-data bytes.

Postmortem JSON: `pr-2218/postmortem.json`

## PR #2217: Match ~100 functions

Status: agent_completed
Type: decomp-matching
Systems: effect;fighter;Kirby;CrazyHand;Popo-IceClimbers;game-mode;stage;item;library;menu-interface;video;sysdolphin-baselib

Merged a large AI-assisted matching batch: decomp.dev reported 103 new matches, +8856 matched code bytes, and +0.23% code match rate. The PR implemented many former `/// #...` placeholders and `NOT_IMPLEMENTED` stubs across fighter, item, stage, game-mode, library, menu/effect/video, and sysdolphin code, plus typed headers and struct fixes. Review accepted the batch but treated it as a cautionary example: future AI-assisted decomp work should force m2c first, reject raw offset field access, missing prototypes, C99-style declarations, wrong data-section annotations, and unimplemented stub bodies.

Postmortem JSON: `pr-2217/postmortem.json`

## PR #2216: Match ittarucann and link

Status: agent_completed
Type: decomp-matching
Systems: item;ittarucann;config/GALE01;build

Matched and linked the ittarucann item translation unit by defining its data/table objects in C, cleaning up local symbol names, and resolving the last small codegen mismatches in two functions. configure.py changed ittarucann.c from NonMatching to Matching. decomp.dev reported 5 new GALE01 matches: ittarucann .data, .rodata, .sdata2, it_3F14_Logic5_Spawned, and it_802962E0.

Postmortem JSON: `pr-2216/postmortem.json`

## PR #2215: Match and Link itseakneedleheld

Status: agent_completed
Type: decomp-matching
Systems: item;character-items;Sheik;Kirby;GALE01-config;build-config

Matched and linked all functions and data for `src/melee/it/items/itseakneedleheld.c`, turning the Sheik/Kirby held-needle item object from NonMatching to Matching. The PR replaced stubbed functions with typed implementations, added the held-needle item state table and item-var owner storage, updated headers/types, and corrected GALE01 split/symbol metadata. decomp.dev reported 6 new matches: `it_802B18B0`, `it_802B19AC`, `itSeakneedleheld_UnkMotion0_Anim`, plus `.data`, `.sdata`, and `.sdata2`.

Postmortem JSON: `pr-2215/postmortem.json`

## PR #2214: Match itsamusbomb and link

Status: agent_completed
Type: decomp-matching
Systems: item;Samus bomb;Samus fighter article interactions;config;GALE01 symbols;repo-root

Matched and enabled linking for `src/melee/it/items/itsamusbomb.c`. The PR marked the file as `Object(Matching, ...)`, emitted the Samus bomb item state table in C, adjusted local variable/layout details for exact codegen, changed one Samus bomb owner callsite, and converted several item constants/strings in `symbols.txt` from global address symbols to local `@NNN` labels. Evidence for intent is mostly the title, diff, and decomp-dev bot report; there was no PR body or human review discussion.

Postmortem JSON: `pr-2214/postmortem.json`

## PR #2213: Restore matches removed by PR#2203

Status: agent_completed
Type: decomp-matching-regression-fix
Systems: configure.py;item objects;melee/it/items;Pokemon items

Restored matching status in configure.py for several item object files that had been marked NonMatching by PR#2203. The change is metadata/build-list only: it flips specific melee/it/items Object entries back to Matching and removes the separate itchicoritaleaf.c Object line. decomp.dev reported GALE01 linked code/data increases after merge, but there was no PR body or human review discussion explaining the regression.

Postmortem JSON: `pr-2213/postmortem.json`

## PR #2212: itlikelike cleanup with inlines, add itemstatetable

Status: agent_completed
Type: item cleanup and data matching
Systems: item;itlikelike;itCommonItems

Cleaned up the Like Like item implementation by adding its typed ItemStateTable data, introducing local inline helpers, replacing repeated transition sequences with existing helpers, and correcting the Like Like attribute header to model offset 0 as either Vec3* or S32Vec3*. The decomp.dev report showed meaningful progress: matched code +360 bytes, matched data +440 bytes, `.data` for `main/melee/it/items/itlikelike` went from 0% to 100%, and several near-matches became full matches, though two previously full functions regressed by 1 byte each.

Postmortem JSON: `pr-2212/postmortem.json`

## PR #2211: itfushigibana match & link

Status: agent_completed
Type: decomp-matching
Systems: item;itfushigibana;Pokemon item;GALE01 symbols;configure.py matching list

Matched and linked the item compilation unit for itfushigibana. The PR changed one ItemStateTable value, moved two identical static helper definitions earlier in itfushigibana.c, corrected two .sdata2 symbols from global it_804DD580/it_804DD584 names to local @154/@155 labels, and promoted the object from NonMatching to Matching. The decomp.dev report confirmed +1024 linked code bytes and new 100% matches for the unit's .sdata2 and .data sections.

Postmortem JSON: `pr-2211/postmortem.json`

## PR #2210: Fix itthunder by removing unnecessary constants, mark as matching

Status: agent_completed
Type: decomp-matching
Systems: item;itthunder;config;build-configuration

Removed unnecessary global float constants from itthunder, converted the relevant assignment to a literal 0.0f, changed two sdata2 entries from global symbols to local compiler-style labels, and marked src/melee/it/items/itthunder.c as Matching in configure.py.

Postmortem JSON: `pr-2210/postmortem.json`

## PR #2209: itchicorita match, remove itchicoritaleaf

Status: agent_completed
Type: decomp-matching
Systems: item;pokemon-items;config;build

Matched the Chikorita Pokémon item unit by folding the former itchicoritaleaf source/header into itchicorita, marking itchicorita.c Matching, and updating GALE01 splits/symbols. The PR also refactored duplicated Chikorita physics callbacks through a static inline helper. decomp-dev reported net progress of +368 matched code bytes, +1976 linked code bytes, and +72 linked data bytes; the old itchicoritaleaf unit shows broken matches only because it was removed as a separate object.

Postmortem JSON: `pr-2209/postmortem.json`

## PR #2208: Easy funcs

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;Attack100;audio;lbAudioAx;config/GALE01

Small matching PR that replaced the ftCo_Attack100 stub fn_800DC044 with a simple tap-jump threshold predicate and renamed GALE01 symbol 0x800263B4 from fn_800263B4 to lbAudioAx_ObjFree. The decomp.dev report credited 2 new matches totaling +96 bytes: lbAudioAx_ObjFree (+52) and fn_800DC044 (+44).

Postmortem JSON: `pr-2208/postmortem.json`

## PR #2207: Match itmariocape

Status: agent_completed
Type: decomp-matching
Systems: item;mario-cape;GALE01-symbols;configure

Matched the Mario Cape item unit by adding the missing two-entry ItemStateTable, correcting one GALE01 sdata2 symbol from a global address-style name to a local @ label, moving an unchanged destroyed callback earlier in the C file for ordering, and flipping itmariocape.c from NonMatching to Matching. The decomp-dev bot reported +816 linked code bytes, +32 matched data bytes, +40 linked data bytes, and one new match for main/melee/it/items/itmariocape .data from 0.00% to 100.00%.

Postmortem JSON: `pr-2207/postmortem.json`

## PR #2206: Match itlipstick

Status: agent_completed
Type: decomp-matching
Systems: item;itlipstick;config;repo-root

Matched the lipstick item source by adding its ItemStateTable definition in src/melee/it/items/itlipstick.c, adding the forward typedef include needed for ItemStateTable, correcting one GALE01 sdata2 symbol from a global it_804DCB68 name to the local @158 label, and flipping itlipstick.c from NonMatching to Matching in configure.py.

Postmortem JSON: `pr-2206/postmortem.json`

## PR #2205: itharisen finalize, mark as matching

Status: agent_completed
Type: decomp-matching-finalization
Systems: item;harisen;configure;GALE01 symbols;sdata;sdata2

Finalized the Harisen item decomp by adding its item state table, changing one dropped-state helper call, cleaning up related GALE01 symbol scopes, and flipping src/melee/it/items/itharisen.c from NonMatching to Matching in configure.py. The PR has no body or review discussion, so the rationale is inferred from the title and diff.

Postmortem JSON: `pr-2205/postmortem.json`

## PR #2204: Fix itbox issues, mark as matching

Status: agent_completed
Type: decomp-matching-fix
Systems: item/itbox;build configuration;gr/kongo helper

Fixed remaining itbox matching issues and promoted src/melee/it/items/itbox.c from NonMatching to Matching. The patch added/placed ItemStateTable it_803F5850, moved itBox_Logic1_Spawned/Destroyed below it_80286088, corrected spawned_gobj cleanup from efLib_DestroyAll to grKongo_801D8058, and adjusted MAX_ROT_VEL to the exact matching literal. decomp.dev reported a new 100% .data match for main/melee/it/items/itbox and a small .sdata2 improvement.

Postmortem JSON: `pr-2204/postmortem.json`

## PR #2203: Update `dtk-template`

Status: agent_completed
Type: tooling-template-update
Systems: dtk-template;configure.py;.nix;tools/project.py;tools/decompctx.py;tools/m2ctx;tools/decomp.py;tools/asm-differ;docs;.vscode;.editorconfig

Updated the project’s dtk-template-derived tooling: tool pins, Nix derivations, build-generation support for precompiled headers and context options, docs for splits/symbols formats, and matching-status metadata affected by the toolchain update.

Postmortem JSON: `pr-2203/postmortem.json`

## PR #2202: Fix incorrect static in ittomato and mark as matching

Status: agent_completed
Type: decomp_matching_linkage_fix
Systems: item;items/ittomato;configure.py

Corrected two Maxim Tomato helper declarations so they are no longer treated as local static symbols, exposed them through ittomato.h, and promoted ittomato.c from NonMatching to Matching in configure.py. The PR had no explanatory body or human review comments; the rationale is inferred from the title and diff.

Postmortem JSON: `pr-2202/postmortem.json`

## PR #2201: Mark itheart as matching

Status: agent_completed
Type: decomp-matching
Systems: items;config;repo-root;GALE01

Marked the Heart Container item object as matching by flipping melee/it/items/itheart.c from NonMatching to Matching in configure.py and correcting seven GALE01 symbol-table entries to local @ labels. The PR contained no C source edits; the matching enablement depended on build configuration plus symbol locality/naming fixes. decomp.dev reported GALE01 linked code 30.67% (+0.04%, +1744 bytes) and linked data 28.80% (+0.01%, +144 bytes).

Postmortem JSON: `pr-2201/postmortem.json`

## PR #2200: Automatic permuter fixes

Status: agent_completed
Type: decomp-matching-permuter-fixes
Systems: effect;fighter;kirby;item;interface;game-mode;stage;library;menu;toy

Broad mechanical decomp-matching PR generated by running the permuter briefly on high-percentage functions. It touched 35 files across fighter, item, interface, game-mode, effect, stage, library, menu, and toy code. The bot report credited 50 new matches, +6896 matched code bytes, and +20 matched data bytes. Most changes were compiler-shape nudges: explicit temporary variables, assignment expressions, comma operators, HSD_GObjGetUserData reloads instead of macros, inline helper wrappers, reordered stores/loads, no-op statements, and small header/formatting cleanups. The largest textual change was an approximately 8k-line removal from ftKb_Init.c of trailing Kirby function implementations; the PR body does not explain that deletion, so its rationale should be treated as inferred from the split Kirby SpecialN files and match report rather than explicit reviewer intent.

Postmortem JSON: `pr-2200/postmortem.json`

## PR #2198: match ftCo_Damage_OnEveryHitlag

Status: agent_completed
Type: decomp-matching
Systems: fighter;ftCommon;damage;guard;hitlag;SDI

Matched ftCo_Damage_OnEveryHitlag by cleaning up the SDI-in-hitlag logic and propagating semantic SDI names through fighter/common-data structs and related guard/collision call sites. decomp.dev reported one new match: ftCo_Damage_OnEveryHitlag in main/melee/ft/chara/ftCommon/ftCo_Damage from 86.07% to 100.00%.

Postmortem JSON: `pr-2198/postmortem.json`

## PR #2197: Match and Link itkyasarinegg

Status: agent_completed
Type: decomp-matching
Systems: item;it;itkyasarinegg;kyasarin;collision;effects;repo-root

Matched and linked the Kyasarin egg item unit by converting `src/melee/it/items/itkyasarinegg.c` from NonMatching to Matching, implementing its state table, spawn/init helpers, motion/collision callbacks, damage/contact handlers, and the supporting item-vars/attribute structs. decomp.dev reported 11 new matches for `main/melee/it/items/itkyasarinegg`, including +1756 bytes matched code, +2300 bytes linked code, and +88 bytes matched/linked data. The PR had no body and no line comments; it was approved with "Very nice!"

Postmortem JSON: `pr-2197/postmortem.json`

## PR #2196: Multiple item cleanup

Status: agent_completed
Type: decomp-matching cleanup
Systems: item;item-collision;item-random-selection;fox-blaster;game-mode

Aggregate decomp-matching cleanup across item code, item collision, fox blaster, and a few gm_1601 routines. The author framed it as high-fuzzy-match low-hanging fruit; the decomp.dev bot reported +0.08% matched code (+3040 bytes), 16 new 100% matches, and 7 additional improvements. Most edits tune types, locals, stack padding, branch shape, wrapper helpers, and temporary variables rather than adding new gameplay behavior.

Postmortem JSON: `pr-2196/postmortem.json`

## PR #2195: itbombhei

Status: agent_completed
Type: item decompilation/matching
Systems: item: itbombhei;item: common item data;item: itlikelike;item: itfreeze;item: itgshell;item: itmatadogas;fighter capture-likelike formatting;stage grinishie2 formatting

Decompiled a substantial slice of src/melee/it/items/itbombhei.c, replacing multiple placeholder functions with C for BombHei dropped/thrown/air-entry and motion-state behavior. decomp.dev reported +6020 matched code bytes, +48 matched data bytes, 11 new matches, and 7 improved still-unmatched BombHei functions; the author separately noted several remaining hard functions at roughly 90-96% match. The PR also tightened BombHei item/attribute structs, renamed ItemCommonData::x30 to x30_lifetime across common item users, and made mostly formatting/include cleanup in adjacent item/fighter/stage files.

Postmortem JSON: `pr-2195/postmortem.json`

## PR #2194: Small pass over itgamewatchjudge

Status: agent_completed
Type: decomp-matching
Systems: item;Game & Watch Judge;ftGameWatch SpecialS

Decompiled and exposed more of the Game & Watch Judge item article, adding spawn/orientation/animation-removal logic and reordering functions to match binary layout. The decomp-dev bot reported five unmatched-item improvements, including itGamewatchjudge_UnkMotion0_Anim to 95.73%, it_802C78B8 to 97.82%, and it_802C7774 to 90.86%. No human review comments were present in the slice.

Postmortem JSON: `pr-2194/postmortem.json`

## PR #2193: it_27cf cleanup

Status: agent_completed
Type: cleanup_and_decomp_matching
Systems: item

Cleaned up src/melee/it/items/it_27CF.c and matched the two remaining functions in the unit: it_27CF_UnkMotion1_Anim and it_27CF_UnkMotion0_Anim. The PR removed dead #if 0 alternate code and stale prototype/comment clutter, reduced noisy casts, preferred GET_ITEM/GET_JOBJ where possible, and kept carefully permuted source in the two anim callbacks to satisfy matching.

Postmortem JSON: `pr-2193/postmortem.json`
