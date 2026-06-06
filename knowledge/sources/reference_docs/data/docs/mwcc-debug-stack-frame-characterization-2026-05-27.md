# Stack-frame root-cause characterization, 2026-05-27

## Goal

Prototype a "blocker identifier" for the stack-frame bucket from
`docs/mwcc-debug-stuck-function-inventory-2026-05-27.md`: determine whether
stack-layout mismatches tend to have a single detectable root cause, or whether
they are usually compound mismatches where stack offsets are only one symptom.

This pass is static analysis only. No source edits and no permuter runs were
performed.

## Method

The 54 sampled stack-frame functions came from the inventory run's cached
`/tmp/inventory_checkdiff_results_full.jsonl`, filtered to
`checkdiff.classification.primary == stack-layout`.

For each function I parsed:

- Expected and actual prologue frame size from the first `stwu r1,-N(r1)`.
- Frame delta as `actual_current_frame - expected_target_frame`.
- Whether opcode sequence and line count were identical.
- Whether changed instruction pairs were exclusively normalized `r1` stack
  offset changes.
- Whether the current and expected function had different `R_PPC_REL24` call
  targets.

This is a prototype classifier, not a semantic proof. It can identify "this
looks like a single stack-slot/frame-size issue" and "this is compound"; it
does not yet infer the exact missing local declaration or inline body.

## Frame-size delta distribution

Most functions classified as stack-layout do not actually have a different
frame allocation size.

| Frame delta (`actual - expected`) | Count |
|---:|---:|
| -40 | 1 |
| -16 | 1 |
| -8 | 1 |
| 0 | 42 |
| +8 | 8 |
| +24 | 1 |
| **Total** | **54** |

Only 12 of 54 sampled functions have a nonzero prologue frame-size delta. The
other 42 have equal frame size but differ in stack-slot positions, register /
operand cascades, or broader source shape.

## Root-cause distribution

| Category | Count | Single? | Detectable? | Detection signal |
|---|---:|---|---|---|
| Stack-slot position/order only | 4 | yes | yes | Same opcodes, same frame size, all diffs normalize to `r1` stack offsets |
| Frame-size-only padding/local gap | 2 | yes | yes | Same opcodes, frame delta nonzero, all diffs normalize to prologue/epilogue/save-area `r1` offsets |
| Equal-frame non-stack operand cascade | 4 | yes | no | Same opcodes and frame size, but diffs are not stack-only and no root cause is apparent from checkdiff alone |
| Call-shape difference | 7 | no | yes | Current/expected `R_PPC_REL24` call target sets differ |
| Small frame gap plus register/operand cascade | 2 | no | yes | Small frame delta with identical opcode sequence, but non-stack operand/register diffs also present |
| Frame-size gap plus structural/source-shape diff | 8 | no | yes | Nonzero frame delta plus opcode or line-count drift |
| Equal-frame structural/source-shape diff | 27 | no | yes | Frame size equal, but opcode similarity or line count shows broader shape drift |
| **Total** | **54** |  |  |  |

Detectability here means a tool can reliably identify the failure mode from
the diff. It does not mean the fix is automatically known.

## Headline

Single, detectable root cause: **6 / 54 functions (11.1%)**.

Compound: **44 / 54 functions (81.5%)**.

Single but opaque from checkdiff alone: **4 / 54 functions (7.4%)**.

The stack-frame bucket is therefore not a broad batch-close opportunity in the
same sense as "apply one known transformation and match." A stack-gap
root-cause detector is still worth building as a triage tool, but the sample
suggests it will mostly sort functions into "small stack-only win" versus
"compound source-shape work," not solve the full 49% bucket automatically.

## Detectable single-root candidates

These are the functions that look like plausible quick wins for a stack-gap
detector:

| Function | Baseline match | Frame | Signal | Likely next action |
|---|---:|---|---|---|
| `mpJointListAdd` | 99.98% | 24 -> 32 (+8) | Only prologue/save/epilogue stack offsets differ | Test whether a single local/padding slot accounts for the extra 8 bytes |
| `ftKb_YsSpecialAirN2_1_Anim` | 99.90% | 200 -> 192 (-8) | Only prologue/save/epilogue stack offsets differ | Remove or resize one stack slot / investigate unnecessary local |
| `ftCo_800AB224` | 99.99% | 176 -> 176 (+0) | Only one stack temp moves from offsets 68-76 to 12-20 | Reorder or narrow local lifetime for that temp |
| `grZebes_801DA254` | 99.98% | 120 -> 120 (+0) | One stack argument/temp offset differs by 8 | Local declaration/lifetime ordering candidate |
| `pl_80037C60` | 99.98% | 40 -> 40 (+0) | Same small stack-slot-position pattern | Local declaration/lifetime ordering candidate |
| `mpLib_80059E60` | 99.88% | 320 -> 320 (+0) | All 12 diffs are stack-offset-only | Local stack object ordering candidate |

These six are the batch-tractable subset from the sample. They are suitable
for a focused follow-up where the detector emits a concrete suggested edit
class: add/remove 8-byte stack slot, or move a local's declaration/lifetime.

## Missing-inline signal

The prototype detected 7 functions with call-shape differences:

`it_8026F3D4`, `un_8031830C`, `un_80318714`, `un_80319994`,
`ftCo_8008EC90`, `ftCo_8009C744`, and `THPVideoDecode`.

These are not clean "missing inline X accounts for the frame delta" cases.
They are compound: calls differ, but frame size is equal in all 7, and the
instruction diffs are broad. A future detector can still flag them as
"inline/call-shape candidate," but this sample did not produce a single
programmatically provable missing-inline root cause.

## Detector design sketch

A useful stack-gap detector should be staged:

1. Parse expected/current frame sizes from prologue `stwu r1,-N(r1)` and
   epilogue `addi r1,r1,N`.
2. Normalize all `offset(r1)` operands to `X(r1)` and identify whether the diff
   becomes identical. If yes, report a stack-only candidate.
3. Split stack-only candidates into:
   - frame-size-only gap: frame differs and all diffs are save/restore or
     stack-offset shifts;
   - stack-slot-position gap: frame size is equal, but one or more local slots
     are placed at different offsets.
4. Compare expected/current `R_PPC_REL24` call targets. If they differ, report
   call-shape or missing-inline candidate, but do not treat it as a clean stack
   root cause unless a callee-inline database can account for the frame delta.
5. For everything else, report compound and include the first divergence
   signature: nonzero frame delta, opcode similarity, line delta, number of
   stack-only pairs, and call-set differences.

This tool would be valuable because it can cheaply keep agents from chasing
`PAD_STACK` on compound functions. The first version should prioritize
precision over recall: identify the six clean stack-only candidates and label
the rest as compound until deeper source/IR analysis exists.

## Per-function appendix

`Stack pairs` is the number of changed instruction pairs that became identical
after normalizing `r1` stack offsets.

| Function | Match | Frame delta | Category | Stack pairs |
|---|---:|---|---|---:|
| `ftCo_800AB224` | 99.99% | 176 -> 176 (+0) | single detectable: stack-slot position/order | 4 / 4 |
| `mpJointListAdd` | 99.98% | 24 -> 32 (+8) | single detectable: frame-size-only padding/local gap | 5 / 5 |
| `grZebes_801DA254` | 99.98% | 120 -> 120 (+0) | single detectable: stack-slot position/order | 2 / 2 |
| `pl_80037C60` | 99.98% | 40 -> 40 (+0) | single detectable: stack-slot position/order | 2 / 2 |
| `ftKb_YsSpecialAirN2_1_Anim` | 99.90% | 200 -> 192 (-8) | single detectable: frame-size-only padding/local gap | 9 / 9 |
| `mpLib_80059E60` | 99.88% | 320 -> 320 (+0) | single detectable: stack-slot position/order | 12 / 12 |
| `ftAction_8007121C` | 99.51% | 80 -> 80 (+0) | compound: equal-frame structural/source-shape diff | 0 / 220 |
| `mnCount_8025092C` | 99.38% | 280 -> 280 (+0) | single but opaque: equal frame, non-stack operand cascade | 11 / 29 |
| `gm_801AC6D8_OnEnter` | 99.35% | 64 -> 64 (+0) | single but opaque: equal frame, non-stack operand cascade | 0 / 51 |
| `grMuteCity_801F290C` | 99.30% | 80 -> 80 (+0) | single but opaque: equal frame, non-stack operand cascade | 4 / 16 |
| `fn_8016D634` | 98.91% | 24 -> 24 (+0) | compound: equal-frame structural/source-shape diff | 0 / 66 |
| `fn_80197AF0` | 98.89% | 40 -> 40 (+0) | compound: equal-frame structural/source-shape diff | 0 / 30 |
| `gm_8016247C` | 98.69% | 40 -> 48 (+8) | compound: small frame gap plus register/operand cascade | 11 / 22 |
| `grInishie1_801FAC58` | 98.57% | 40 -> 48 (+8) | compound: small frame gap plus register/operand cascade | 11 / 30 |
| `mnDataDel_8024EA6C` | 98.45% | 72 -> 72 (+0) | compound: equal-frame structural/source-shape diff | 0 / 52 |
| `fn_8019A71C` | 98.36% | 32 -> 32 (+0) | compound: equal-frame structural/source-shape diff | 0 / 56 |
| `ftKb_SpecialNMs_8010B4A0` | 98.04% | 72 -> 72 (+0) | compound: equal-frame structural/source-shape diff | 2 / 66 |
| `ftColl_80076ED8` | 97.73% | 152 -> 152 (+0) | compound: equal-frame structural/source-shape diff | 4 / 137 |
| `fn_801985D4` | 97.66% | 24 -> 32 (+8) | compound: frame-size gap plus structural/source-shape diff | 3 / 143 |
| `un_80316420` | 97.55% | 80 -> 80 (+0) | single but opaque: equal frame, non-stack operand cascade | 0 / 70 |
| `itSeakneedlethrown_UnkMotion2_Coll` | 97.39% | 64 -> 64 (+0) | compound: equal-frame structural/source-shape diff | 0 / 97 |
| `mnName_8023A290` | 97.24% | 80 -> 80 (+0) | compound: equal-frame structural/source-shape diff | 8 / 17 |
| `ftKb_MsSpecialAirNEnd_Anim` | 96.97% | 88 -> 88 (+0) | compound: equal-frame structural/source-shape diff | 0 / 38 |
| `fn_800204C8` | 96.96% | 56 -> 56 (+0) | compound: equal-frame structural/source-shape diff | 0 / 61 |
| `itLinkbomb_UnkMotion0_Anim` | 96.95% | 80 -> 80 (+0) | compound: equal-frame structural/source-shape diff | 0 / 39 |
| `it_802E72E0` | 96.95% | 184 -> 192 (+8) | compound: frame-size gap plus structural/source-shape diff | 18 / 183 |
| `fn_80184138` | 96.79% | 128 -> 128 (+0) | compound: equal-frame structural/source-shape diff | 6 / 495 |
| `fn_8016719C` | 96.33% | 64 -> 72 (+8) | compound: frame-size gap plus structural/source-shape diff | 17 / 61 |
| `grCastle_801CDC44` | 95.92% | 80 -> 80 (+0) | compound: equal-frame structural/source-shape diff | 0 / 185 |
| `grInishie1_801FB0AC` | 95.51% | 80 -> 104 (+24) | compound: frame-size gap plus structural/source-shape diff | 26 / 128 |
| `fn_80313BD8` | 95.22% | 72 -> 72 (+0) | compound: equal-frame structural/source-shape diff | 0 / 477 |
| `hsd_80394434` | 94.99% | 56 -> 56 (+0) | compound: equal-frame structural/source-shape diff | 0 / 65 |
| `grIceMt_801F686C` | 94.98% | 72 -> 56 (-16) | compound: frame-size gap plus structural/source-shape diff | 0 / 489 |
| `fn_80188910` | 94.89% | 48 -> 48 (+0) | compound: equal-frame structural/source-shape diff | 0 / 81 |
| `grMuteCity_801EFD0C` | 94.88% | 32 -> 32 (+0) | compound: equal-frame structural/source-shape diff | 0 / 47 |
| `grOldKongo_8020F52C` | 94.88% | 32 -> 32 (+0) | compound: equal-frame structural/source-shape diff | 0 / 47 |
| `it_8026CB9C` | 94.57% | 120 -> 120 (+0) | compound: equal-frame structural/source-shape diff | 0 / 67 |
| `grInishie1_801FA9B4` | 94.03% | 32 -> 32 (+0) | compound: equal-frame structural/source-shape diff | 0 / 47 |
| `grPura_80212024` | 93.58% | 40 -> 40 (+0) | compound: equal-frame structural/source-shape diff | 0 / 27 |
| `it_8026F3D4` | 93.04% | 264 -> 264 (+0) | compound: call-shape difference | 9 / 44 |
| `un_8031830C` | 92.47% | 128 -> 128 (+0) | compound: call-shape difference | 16 / 174 |
| `fn_80187AB4` | 91.84% | 56 -> 56 (+0) | compound: equal-frame structural/source-shape diff | 0 / 104 |
| `mnStageSw_80236548` | 91.36% | 128 -> 136 (+8) | compound: frame-size gap plus structural/source-shape diff | 6 / 252 |
| `grHomeRun_8021D680` | 90.03% | 176 -> 184 (+8) | compound: frame-size gap plus structural/source-shape diff | 7 / 361 |
| `hsd_8039254C` | 89.92% | 208 -> 208 (+0) | compound: equal-frame structural/source-shape diff | 2 / 187 |
| `un_80318714` | 89.85% | 128 -> 128 (+0) | compound: call-shape difference | 16 / 178 |
| `grPura_8021231C` | 89.84% | 80 -> 40 (-40) | compound: frame-size gap plus structural/source-shape diff | 4 / 157 |
| `WriteCharactersForNameAtIndex` | 89.83% | 24 -> 24 (+0) | compound: equal-frame structural/source-shape diff | 0 / 81 |
| `un_80319994` | 88.12% | 160 -> 160 (+0) | compound: call-shape difference | 17 / 260 |
| `grYorster_8020266C` | 86.77% | 152 -> 152 (+0) | compound: equal-frame structural/source-shape diff | 0 / 301 |
| `ftCo_8008EC90` | 84.30% | 176 -> 176 (+0) | compound: call-shape difference | 0 / 654 |
| `gm_801B60A4_OnLoad` | 80.20% | 48 -> 48 (+0) | compound: equal-frame structural/source-shape diff | 0 / 85 |
| `ftCo_8009C744` | 75.36% | 56 -> 56 (+0) | compound: call-shape difference | 2 / 49 |
| `THPVideoDecode` | 50.86% | 56 -> 56 (+0) | compound: call-shape difference | 0 / 121 |
