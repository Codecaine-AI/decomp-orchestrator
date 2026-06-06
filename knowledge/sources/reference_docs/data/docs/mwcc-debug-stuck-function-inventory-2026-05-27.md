# Stuck-function inventory, 2026-05-27

## Method

This inventory is a screening pass, not a permuter campaign. No new permuter
runs were launched.

The first pass enumerated unmatched functions with an explicit high limit:

```bash
melee-agent extract list --max-match 1.0 --limit 5000 --json \
  > /tmp/unmatched_max100.json
```

The command returned 1,365 function rows. Its metadata reported 1,402 total
unmatched functions, so the 1,365 rows below should be read as the analyzable
population returned by `extract list`, not as a guarantee that every unmatched
entry is represented. A prior `--max-match 0.99` run returned 1,152 rows; the
extra 213 rows in the `--max-match 1.0` run are the near-perfect 99-100% tier.
The earlier apparent count of 20 was just the CLI default page size.

Population by match tier in the 1,365 returned rows:

| Match tier | Functions |
|---|---:|
| >=99% | 215 |
| 97-99% | 187 |
| 95-97% | 177 |
| 90-95% | 245 |
| <90% | 541 |
| **Total** | **1,365** |

For diff-shape classification, I used a deterministic 110-function stratified
sample from those 1,365 rows:

| Match tier | Sampled functions |
|---|---:|
| >=99% | 35 |
| 97-99% | 25 |
| 95-97% | 15 |
| 90-95% | 15 |
| <90% | 20 |
| **Total** | **110** |

Each sampled function was checked with:

```bash
python tools/checkdiff.py <function> --format json --no-tty --no-build \
  --no-fingerprint
```

The categories below are an automated classification over `checkdiff`'s
primary classification plus light relocation-name pattern checks. In
particular, "known mismatch pattern" means small operand/type-style mismatch
shape in this pass; it was not individually confirmed against the mismatch DB
for every sampled function.

## Phase A: diff-shape distribution

| Category | Sample count | Sample % | Rough extrapolation over 1,365 | Likely fix path |
|---|---:|---:|---:|---|
| Stack frame mismatch | 54 | 49.1% | ~670 | Stack/local layout tooling or targeted manual source-shape work |
| Anonymous string/data refs | 17 | 15.5% | ~211 | Name-magic / data-symbol modeling |
| Structural | 14 | 12.7% | ~174 | Deep source reconstruction; likely outside allocator tooling |
| Known mismatch pattern | 12 | 10.9% | ~149 | Batch mismatch-db/opseq/source idiom fixes |
| Relocation/data-symbol differences | 7 | 6.4% | ~87 | Data declaration / relocation modeling |
| Other | 4 | 3.6% | ~50 | Needs manual inspection |
| Register-cascade | 2 | 1.8% | ~25 | Phase 1-3 allocator tooling, or #16 for hard cases |

Tier breakdown:

| Match tier | Stack | Anonymous refs | Structural | Known pattern | Reloc/data | Register-cascade | Other |
|---|---:|---:|---:|---:|---:|---:|---:|
| >=99% (n=35) | 10 | 13 | 1 | 3 | 7 | 1 | 0 |
| 97-99% (n=25) | 12 | 4 | 7 | 1 | 0 | 1 | 0 |
| 95-97% (n=15) | 9 | 0 | 4 | 2 | 0 | 0 | 0 |
| 90-95% (n=15) | 13 | 0 | 0 | 2 | 0 | 0 | 0 |
| <90% (n=20) | 10 | 0 | 2 | 4 | 0 | 0 | 4 |

Representative sampled functions by category:

| Category | Examples |
|---|---|
| Stack frame mismatch | `ftCo_800AB224`, `mpJointListAdd`, `grZebes_801DA254`, `pl_80037C60`, `mpLib_80059E60`, `ftAction_8007121C` |
| Anonymous string/data refs | `mn_8022DDA8_OnEnter`, `grGreatBay_801F499C`, `it_8027BBF4`, `it_8027C0F0`, `fn_80186080`, `it_80274740` |
| Structural | `fn_802A33A0`, `un_8030813C`, `mnInfo_802522B8`, `ftCo_800A9904`, `mnItemSw_802351A0`, `fn_800256BC` |
| Known mismatch pattern | `__THPHuffDecodeDCTCompY`, `__THPRestartDefinition`, `lbColl_80009DD4`, `Ground_801C466C`, `grCorneria_801E25C4`, `fn_8001F2A4` |
| Relocation/data-symbol differences | `fn_801981A0`, `grZebesRoute_8020B260`, `grCorneria_801DD534`, `mnNameNew_EnterFromMnCharSel`, `mnCharSel_80266D70_OnLeave`, `lbDvd_CachePreloadedFile` |
| Register-cascade | `fn_80169900`, `ftColl_8007BAC0` |
| Other | `ftCo_800A6A98`, `fn_80169C54`, `grPushOn_80218888`, `fn_802461BC` |

The high-match tier is not dominated by allocator cascades. In the sampled
`>=99%` group, anonymous/data-symbol issues plus relocation/data-symbol
differences make up 20 of 35 samples, and stack frame mismatches add another
10. The allocator-specific bucket was only 1 of 35 in that tier.

## Phase B: existing force-proof / target-shape inventory

I found existing simplify-order target files and campaign writeups for four
functions:

| Shape class | Count | Functions | Step 0 / campaign signal |
|---|---:|---|---|
| grVenom-class | 1 | `grVenom_80204284` | Clean prefix target was expressible, but real-tree triage found the actual fix outside the top simplify-order candidates. Final match came from a second `Ground*` alias; simplify-order proxy alone was insufficient. |
| gm-class | 1 | `gm_80173EEC` | Prefix target passes Step 0 and coalesce-preservation is expressible. Coalesce-preserving rerun reached 273,283 iterations, 283 saved outputs, and tied the prior 99.33% ceiling with no 100% candidate. |
| lbDvd-class | 1 | `lbDvd_80018A2C` | Original front target had wrong polarity; late target `--want-late 46,44` passes Step 0 with all targets independent and polarity safe. A 275,101-iteration run saved no suffix-improving candidates. |
| ftColl-class | 1 | `ftColl_8007BAC0` | Force proof exists through phys-iter, but filtered simplify-order prefix is empty; this is out of Layer A prefix/suffix scope as currently encoded. |

This is too small for statistical inference, but it is useful as a toolchain
sanity check: every worked allocator campaign so far either solved through
real-tree triage (`grVenom`) or hit a mutation-library/scope limit (`gm`,
`lbDvd`, `ftColl`). The Phase 1-3 scoring extensions are valuable diagnostics,
but the existing evidence does not show a large untouched pool of easy Layer A
matches.

## Headline finding

The sampled unmatched space is dominated by stack/local-layout shape, not pure
register cascades. Register-cascade cases were 2 of 110 sampled functions
(1.8%), while stack frame mismatches were 54 of 110 (49.1%). Near-perfect
functions are especially rich in anonymous string/data references and
relocation/data-symbol mismatches.

That means the current allocator campaign tooling is aimed at a real but small
slice of the remaining problem. The biggest batch-processable opportunities
appear to be:

1. Stack/local-layout classification and source-shape fixes.
2. Anonymous string/data reference naming and data-symbol modeling.
3. Small known mismatch-pattern fixes surfaced by checkdiff and mismatch-db.

## Recommendation

Do not use the allocator-campaign results alone as evidence that the whole
unmatched space requires #16. For allocator-specific last-mile functions,
`gm_80173EEC` and `lbDvd_80018A2C` are strong evidence that richer source
search, source-corpus mining, or backwards inference is the next leverage. But
for the broader unmatched inventory, a stack/data/name batch pass is likely to
pay off sooner.

Recommended next batch:

1. Build a stack-frame mismatch queue from the high-match and 97-99% tiers.
   Start with small functions where opcode similarity is 1.0 and line deltas
   are low, then classify whether the gap is signature type, local lifetime,
   missing inline, or true stack padding.
2. Run a focused anonymous-ref/data-symbol pass on the `>=99%` tier. The sample
   suggests this is the densest near-match bucket.
3. Keep allocator campaigns selective. `fn_80169900` is the most interesting
   sampled high-match register-cascade candidate not already covered by the
   recent ftColl/gm/lbDvd/grVenom campaigns.

If those batch passes stall, #16 becomes more compelling as a general
investment. Right now, the inventory says "broaden the batch tooling first,
then reserve #16 for the allocator/structural ceiling cases."
