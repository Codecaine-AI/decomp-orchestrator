# Name-magic batch validation, 2026-05-27

## Goal

Test whether the anonymous string/data reference bucket from
`docs/mwcc-debug-stuck-function-inventory-2026-05-27.md` is cheaply
batch-fixable with existing name-magic verification tooling.

This pass is verification-only. It does not edit source, `symbols.txt`, or data
declarations.

## Method

The 17 sampled anonymous-ref functions from the inventory run were recovered
from `/tmp/inventory_checkdiff_results_full.jsonl`. For each function, I ran:

```bash
melee-agent debug util verify-name-magic -f <function>
melee-agent debug util verify-name-magic -f <function> --map '<suggested-map>'
melee-agent debug util verify-name-magic -f <function> --apply-auto
```

`verify-name-magic` returns exit code 1 for normal checkdiff mismatches and
prints the standard copyable issue-report wrapper. For this validation, the
classification is based on the forwarded checkdiff result and the
`--map`/`--apply-auto` output, not on exit code alone.

Logs were captured under `/tmp/name_magic_batch_validation/`.

## Per-function results

| Function | Baseline match | Classification | Notes |
|---|---:|---|---|
| `mn_8022DDA8_OnEnter` | 99.99866% | No derivable complete map | Suggested 2 mappings; auto renamed 2; remaining `@N` relocs; section-placeholder relocs; ~1 instruction/data-layout diff |
| `grGreatBay_801F499C` | 99.99709% | No derivable complete map | Suggested 1 mapping; auto renamed 1; remaining `@N` relocs; section-placeholder relocs; ~2 instruction/data-layout diffs |
| `it_8027BBF4` | 99.99004% | No derivable complete map | Suggested 8 mappings; auto renamed 8; remaining `@N` relocs; section-placeholder relocs; ~3 instruction/data-layout diffs |
| `it_8027C0F0` | 99.98955% | No derivable complete map | Suggested 8 mappings; auto renamed 8; remaining `@N` relocs; section-placeholder relocs; ~3 instruction/data-layout diffs |
| `fn_80186080` | 99.98718% | No derivable complete map | Suggested 5 mappings; auto renamed 5; remaining `@N` relocs; ~1 instruction/data-layout diff |
| `grCorneria_801E1BF0` | 99.98171% | No derivable complete map | Suggested 4 mappings; auto renamed 4; remaining `@N` relocs; section-placeholder relocs; ~6 instruction/data-layout diffs |
| `it_80274740` | 99.97973% | No derivable complete map | Suggested 8 mappings; auto renamed 8; remaining `@N` relocs; section-placeholder relocs; ~3 instruction/data-layout diffs |
| `fn_80185E34` | 99.93243% | No derivable complete map | Suggested 5 mappings; auto renamed 5; remaining `@N` relocs; ~5 instruction/data-layout diffs |
| `fn_80181708` | 99.91464% | No derivable complete map | Suggested 3 mappings; auto renamed 3; remaining `@N` relocs; section-placeholder relocs; ~14 instruction/data-layout diffs |
| `fn_80188644` | 99.81967% | No derivable complete map | Suggested 5 mappings; auto renamed 5; remaining `@N` relocs; section-placeholder relocs; ~11 instruction/data-layout diffs |
| `itNessyoyo_UnkMotion3_Anim` | 99.57547% | No derivable complete map | Suggested 3 mappings; auto renamed 3; remaining `@N` relocs; ~7 instruction/data-layout diffs |
| `it_80271B60` | 99.20000% | No derivable complete map | Suggested 3 mappings; auto renamed 3; remaining `@N` relocs; ~14 instruction/data-layout diffs |
| `tyFigupon_80314C5C` | 99.03186% | No derivable complete map | Suggested 1 mapping; auto renamed 1; remaining `@N` relocs; ~79 instruction/data-layout diffs |
| `gm_8019ECAC_OnEnter` | 98.98113% | No derivable complete map | Suggested 2 mappings; auto renamed 2; remaining `@N` relocs; section-placeholder relocs; ~20 instruction/data-layout diffs |
| `fn_802B8D38` | 98.94886% | No derivable complete map | Suggested 7 mappings; auto renamed 7; remaining `@N` relocs; ~37 instruction/data-layout diffs |
| `fn_8018E46C` | 98.91589% | No derivable complete map | Suggested 2 mappings; auto renamed 2; remaining `@N` relocs; ~16 instruction/data-layout diffs |
| `grGreens_80214FA8` | 98.90140% | No derivable complete map | Suggested 1 mapping; auto renamed 1; remaining `@N` relocs; section-placeholder relocs; ~15 instruction/data-layout diffs |

## Tally

| Result | Count |
|---|---:|
| Clean would-match | 0 |
| Partial | 0 |
| No derivable complete map | 17 |
| Tool error / needs investigation | 0 |

All 17 functions had at least one suggested or auto-derived mapping, so the
tooling is able to identify some anonymous magic constants. However, none of
the suggested maps resolved the function-level diff. After applying the map,
every sampled function still had unresolved `@N` relocations in the active
checkdiff output, and every sampled function also had non-relocation
instruction or data-layout differences.

## Yield estimate

Observed clean yield in the sample: 0 / 17.

Using the inventory's rough anonymous-ref population estimate of ~211 functions
(15.5% of 1,365), the point estimate for "name-magic verification alone closes
the function" is therefore 0 functions. With this sample size, the simple
rule-of-three upper bound is still about 18% of the bucket, or roughly 37
functions, but the observed data does not support scaling direct apply-work as
the next batch.

## Recommendation

Do not launch a broad name-magic apply batch yet. The bucket is real, but the
sample shows it is not mostly "rename one anonymous magic constant and match."
The current verification tool is useful as a filter, not as a bulk closer.

The likely next useful work is narrower:

1. Improve name/data inference for repeated anonymous constants that lack a
   value-matched named counterpart in the production object.
2. Split the anonymous-ref bucket into subtypes: simple magic constants,
   anonymous data-section placeholders, anonymous bss/data blobs, and mixed
   real-code diffs.
3. Only then run apply-work on a small clean sub-bucket.

## Apply-work cost

For this sample, apply-work is not trivially scriptable. Each function would
need manual judgment because the post-map diffs still include unresolved
anonymous relocations and real instruction/data-layout differences. The
automated mappings are useful supporting data, but they are not sufficient
patches.

The most scriptable-looking cases are the very high-match functions with few
remaining instruction diffs, such as `mn_8022DDA8_OnEnter`,
`grGreatBay_801F499C`, `it_8027BBF4`, `it_8027C0F0`, `fn_80186080`, and
`it_80274740`. Even those still need data-symbol research before source or
symbol declarations can be applied safely.
