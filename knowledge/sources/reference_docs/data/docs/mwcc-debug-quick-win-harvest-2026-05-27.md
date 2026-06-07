# Quick-win harvest, 2026-05-27

## Goal

Convert the single-cause buckets from the stuck-function inventory into real
byte-exact matches, without chasing compound functions. Each candidate was
screened with `tools/checkdiff.py`; source edits were only kept when checkdiff
reported 100%.

## Results

| Function | Tier | Result | Commit | Notes |
|---|---|---|---|---|
| `__THPHuffDecodeDCTCompY` | Known mismatch pattern | Matched | `7b4443a22` | Fixed `THPFileInfo` / `THPComponent` layout: `predDC` sits at component offset +6, and restart fields live after the component array. |
| `__THPRestartDefinition` | Known mismatch pattern | Matched | `7b4443a22` | Same THP layout fix; restart fields now land at the expected offsets. |
| `fn_800D7938` | Known mismatch pattern | Matched | `99d1391ac` | Removed a function-pointer cast so `it_80291F14` emits a direct `bl` instead of `mtlr` / `blrl`. |
| `mpJointListAdd` | Stack-frame singleton | Looked single but opaque | - | Frame-size-only +8 current gap; no clean local/padding edit was apparent because current source has no removable padding. |
| `ftKb_YsSpecialAirN2_1_Anim` | Stack-frame singleton | Looked single but compound | - | Increasing the padding matched the frame size but moved the active `it_27CF_DatAttrs` stack object by 8 bytes, so it did not match. |
| `ftCo_800AB224` | Stack-frame singleton | Screened, not attempted | - | Equal-frame stack-slot movement plus anonymous relocations; not a clean stack-only quick win. |
| `grZebes_801DA254` | Stack-frame singleton | Screened, not attempted | - | Equal-frame slot movement plus anonymous relocations; likely needs source/data naming work before stack order. |
| `pl_80037C60` | Stack-frame singleton | Looked single but compound | - | Removing the volatile stack hack made the function worse; the two-slot movement is load-bearing rather than a trivial cleanup. |
| `mpLib_80059E60` | Stack-frame singleton | Screened, not attempted | - | Stack object ordering mismatch across multiple palette locals; not a bounded one-edit fix. |
| `lbColl_80009DD4` | Known mismatch pattern | Looked single but compound | - | Direct `GXPosition3f32` expression spelling fixed FPR intent but changed frame layout; reverted. |
| `Ground_801C466C` | Known mismatch pattern | Screened, not attempted | - | Register cascade plus data symbol naming and broader source-shape drift. |
| `grCorneria_801E25C4` | Known mismatch pattern | Screened, not attempted | - | Register/order cascade and anonymous constants; no isolated documented edit. |
| `fn_8001F2A4` | Known mismatch pattern | Screened, not attempted | - | Repeated register/allocation cascade around the same rate-table loop; not a quick documented transform. |
| `it_8027978C` | Known mismatch pattern | Screened, not attempted | - | Switch/control-flow shape differs; likely source structure, not a singleton operand fix. |
| `un_802FEBE0_OnEnter` | Known mismatch pattern | Screened, not attempted | - | Extra callee-saved lifetime in target plus anonymous data symbols; no bounded one-edit fix. |
| `itDosei_UnkMotion4_Anim` | Known mismatch pattern | Screened, not attempted | - | Large register cascade with repeated assert/data symbol differences. |

## Tally

| Bucket | Screened | Source edits attempted | Matched |
|---|---:|---:|---:|
| Tier 1 stack-frame singletons | 6 | 2 | 0 |
| Tier 2 known-pattern sample | 10 | 4 | 3 |
| **Total** | **16** | **6** | **3** |

The strongest yield came from true known-pattern singletons: one type-layout
fix matched two THP functions, and one direct-call cleanup matched one fighter
function. The stack-frame "single detectable" labels were useful for triage,
but did not translate into automatic fixes in this pass.

## Yield estimate

For the known-pattern bucket, this pass matched 3 of 10 screened functions
and 3 of 4 functions where a bounded source edit was plausible. That suggests
the full known-pattern population is worth a focused follow-up, but only after
separating "documented source transform" from broad register/source-shape
cascades.

The stack-frame singleton sample matched 0 of 6. The characterization heuristic
correctly found small stack-only-looking diffs, but it overestimated fixability:
several required stack-slot placement without an obvious developer-plausible
source edit. A future stack detector should report "stack-only symptom" and
"concrete edit class known" as separate fields.

## Follow-up

- Add a mismatch-db entry for the THP component layout: `predDC` at component
  offset +6 with post-component padding before restart fields.
- Add a direct-call cleanup pattern for casted function calls that accidentally
  force `mtlr` / `blrl`.
- Refine the stack-frame classifier so equal-frame stack-slot movement with
  anonymous relocations is marked compound, not quick-win.

## Refined pattern-driven pass

This pass seeded the mismatch database with the two concrete patterns harvested
above, then screened the high-match unmatched population for localized
documented transforms before attempting source edits. The screen used the top
300 functions from `extract list --max-match 0.999 --min-match 0.95`, with
`tools/checkdiff.py --no-build --no-fingerprint` as the first-pass classifier.

### Flywheel entries added

| Pattern | Mismatch-db id | Source evidence |
|---|---|---|
| THP component layout / restart padding | `thp-component-layout-pred-dc-padding` | `__THPHuffDecodeDCTCompY`, `__THPRestartDefinition` |
| Function-pointer cast forcing indirect call | `function-pointer-cast-forces-indirect-call` | `fn_800D7938` |

### Candidate outcomes

| Function | Screen result | Attempt result | Notes |
|---|---|---|---|
| `gmMainLib_8015D984` | Accepted: localized address-add shape | Not matched | `base + arg0` spelling did not change the remaining register-allocation mismatch. |
| `it_80274DAC` | Accepted: localized float/add ordering plus anonymous float | Not matched | Operand-order and local-temp spellings either preserved the mismatch or made instruction shape worse. |
| `gm_801736E8` / `gm_80173754` | Accepted as possible data-symbol naming singleton | Not matched | Removing `static` from `lbl_8046DBD8` did not resolve the anonymous `.bss` relocation shape. |
| `un_8030813C` | Accepted: unwanted `extsh` plus compare operand order | Partial only | Widening the argument to `s32` removed the `extsh`, but the `cmpw` operand order remained wrong. Reverted. |
| `ftCo_800C4724` | Accepted: localized FPR argument/load order | Not matched | Swapped call arguments and local temporaries improved one part of the order but moved the object load. |
| `fn_80173098` | Accepted: known `li` versus `addi rx,ry,0` loop-init pattern | Not matched | Inline-wrapper attempt changed stack layout; direct source spellings still folded to two `li` instructions. |
| `lb_800115F4`, `lbMemory_80014FC8`, `lbSnap_8001DF20` | Rejected at screen | Not attempted | Anonymous relocations plus register cascades; not clean documented transforms. |
| `gm_801B0474`, `ftColl_80077970`, `fn_801A94BC` | Rejected at screen | Not attempted | Signedness/copy-looking symptoms were mixed with branch movement, anonymous data, or broad register drift. |
| Casted-call scan hits (`lbRefract_80021CE8`, `gm_8017DB88`, `hsd_8039D0A0`) | Rejected at screen | Not attempted | `mtlr` / `blrl` appeared inside broader structural diffs, not the isolated cleanup matched by `fn_800D7938`. |

### Pass-2 tally

| Stage | Count |
|---|---:|
| High-match functions screened | 300 |
| New mismatch-db entries added | 2 |
| Candidates accepted for bounded source edit | 6 |
| Source edits that reached 100% | 0 |
| Partial source signals found | 1 |

The sharper screen did reduce time spent on obvious allocator cascades, but the
accepted set was still thinner than expected: most candidate diffs that looked
like documented patterns were actually compound once source was touched. The
only partial signal was `un_8030813C`, where widening a signed parameter removed
one unwanted instruction but did not close the compare-order mismatch.

### Updated yield estimate

Harvest 1 still provides the positive singleton yield signal: 3 matches from 4
bounded known-pattern attempts. Pass 2 suggests that the hard part is not the
edit once a truly isolated pattern is found; it is proving isolation before
editing. On this 300-function high-match screen, only 6 candidates survived the
ACCEPT filter and none matched, so the full-population quick-win estimate should
be revised downward from "dozens from loose known-pattern buckets" to a smaller
set of highly pattern-specific wins.

The next useful automation is not broad auto-apply. It is a pattern verifier
that can reject compound cases before source edits: for example, a direct-vs-
indirect-call verifier should require a one-call delta with no surrounding
frame, relocation, or allocator drift; a loop-copy verifier should require the
only diff to be `li` versus `addi rx,ry,0`.
