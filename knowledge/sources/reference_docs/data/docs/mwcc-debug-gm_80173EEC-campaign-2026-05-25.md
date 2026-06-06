# gm_80173EEC Layer A campaign

## Full six-element target rescore (2026-05-26)

Context: the active remote permuter run was seeded with the three-element
custom-scorer target `[34, 37, 32]`. The force proof used during screening was
`--force-phys '34:31,37:30,32:29,42:28,52:28,38:28'`, so this pass re-scored
the fetched candidate snapshot against the full six-element target
`[34, 37, 32, 42, 52, 38]` to check whether the trailing three allocator
decisions naturally fall into place once the first three do.

Command:

```bash
melee-agent debug mutate simplify-order \
  -f gm_80173EEC \
  --want-first 34,37,32,42,52,38 \
  --class 0 \
  --with-permuter \
  --permuter-dir /Users/mike/code/melee/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder3-20260526-004754 \
  --max-candidates 2000
```

Snapshot: 364 fetched candidates from remote job
`gm_80173EEC-coder3-20260526-004754`.

Result:

| Common prefix length vs `[34,37,32,42,52,38]` | Candidates |
|---:|---:|
| 0 | 5 |
| 1 | 344 |
| 2 | 2 |
| 3 | 10 |
| 4 | 0 |
| 5 | 0 |
| 6 | 0 |

Top candidates by six-element target:

| Candidate | Prefix | Observed prefix | Distance | Real-tree match |
|---|---:|---|---:|---|
| `output-139-1` | 3/6 | `34,37,32,101,100,99` | 139 | not in top real-tree results |
| `output-141-1` | 3/6 | `34,37,32,101,100,99` | 141 | not in top real-tree results |
| `output-227-1` | 3/6 | `34,37,32,100,99,98` | 227 | not in top real-tree results |
| `output-231-1` | 3/6 | `34,37,32,99,98,97` | 231 | not in top real-tree results |
| `output-232-1` | 3/6 | `34,37,32,99,98,97` | 232 | not in top real-tree results |

No candidate reached prefix 6/6, so no candidate was applied for `checkdiff`.
The trailing allocator decisions do not appear to be correlated with the first
three under the current mutation pool: candidates can force `[34, 37, 32]` to
the front, but positions 4-6 scatter to unrelated high ig_idx values such as
`101,100,99` or `99,98,97` rather than `[42,52,38]`.

The best real-tree candidates from the same fetched snapshot remained
`output-2000074-1`, `output-2000074-2`, and `output-2000212-1` at 99.33%.
Those are prefix-1 candidates under the six-element target, so real-tree
progress is currently not aligned with full force-proof prefix progress.

## Position diagnostic for trailing force-proof nodes (2026-05-26)

Checked the baseline pcdump and `output-139-1`, the best full-target rescore
candidate from the 364-candidate fetched snapshot. `output-139-1` was compiled
locally through the permuter harness to produce
`/tmp/gm_80173EEC_output_139_1.o.pcdump.txt`.

| Input | ig_idx | SIMPLIFY GRAPH class-0 position | COLORGRAPH class-0 iter | Assigned phys |
|---|---:|---:|---:|---|
| baseline | 42 | 42 | 42 | r29 |
| baseline | 52 | 35 | 35 | r29 |
| baseline | 38 | 46 | 46 | r30 |
| `output-139-1` | 42 | absent | absent | coalesced alias `42 -> 3 [r3]` |
| `output-139-1` | 52 | 43 | 43 | r28 |
| `output-139-1` | 38 | absent | absent | coalesced alias `38 -> 3 [r3]` |

The missing entries are not `-1` spilled placeholders. In the candidate,
`42` and `38` stop being independent class-0 allocator nodes because natural
coalescing aliases both to root `3`, whose root physical is `r3`. Only `52`
remains visible as an independent node, moving later from simplify/color iter
35 to 43 while changing assignment from `r29` to `r28`.

This explains why the three-prefix scorer can produce `[34,37,32]` without
making progress on the full force-proof target: two of the trailing target
nodes are removed from the candidate allocator walk entirely, not merely left
farther back in the order.

## Full 500-candidate real-tree triage (2026-05-26)

After the remote instance idled/rebooted, the saved outputs were still present
under remote job `gm_80173EEC-coder3-20260526-004754`. The final fetched local
pool contained 500 candidates from a run that reached roughly 740k iterations.

The integrated Layer A command completed the simplify-order scan but its
embedded triage subprocess initially failed with
`function not found in report.json`. A direct `checkdiff` lookup for
`gm_80173EEC` refreshed/validated the local report state, after which direct
`debug permute triage` on the same pool succeeded. This is a Layer A UX issue:
the integrated command should either refresh the report before spawning triage
or surface the same recovery step.

Commands:

```bash
melee-agent debug mutate simplify-order \
  -f gm_80173EEC \
  --want-first 34,37,32 \
  --class 0 \
  --with-permuter \
  --permuter-dir /Users/mike/code/melee/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder3-20260526-004754 \
  --triage \
  --max-candidates 2000

python tools/checkdiff.py gm_80173EEC

melee-agent debug permute triage \
  /Users/mike/code/melee/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder3-20260526-004754 \
  --function gm_80173EEC \
  --top 20
```

Simplify-order scan result for the three-element target `[34,37,32]`:

| Metric | Count |
|---|---:|
| Compiled for simplify-order scoring | 500 |
| Compile failures during simplify-order scoring | 0 |
| Gate rejected | 497 |
| Progress hits | 0 |
| Prefix 0 | 6 |
| Prefix 1 | 453 |
| Prefix 2 | 5 |
| Prefix 3/3 | 33 |

Best simplify-order candidates reached prefix 3/3, but all were rejected by
the precolor preservation gate because their interference graph changed.

Real-tree triage result:

| Metric | Count |
|---|---:|
| Candidates triaged | 500 |
| Build failures | 98 |
| Missing function failures | 0 |
| Winners over 99.06% baseline | 3 |
| 100% candidates | 0 |

Top real-tree candidates:

| Candidate | Match | Delta | Source shape |
|---|---:|---:|---|
| `output-2000074-1` | 99.33% | +0.27% | Adds an `i++; i--;` no-op inside the first `CKIND_SEAK` branch |
| `output-2000074-2` | 99.33% | +0.27% | Wraps the loop index in repeated `& 0xFFFFFFFF` masks for `x18[i]` |
| `output-2000212-1` | 99.33% | +0.27% | Uses `x18[i & 0xFFFFFFFFFFFFFFFF]` and rewrites one comparison as `0 != ...` |
| `output-2000077-1` | 98.67% | -0.39% | Below baseline |
| `output-2000209-1` | 97.76% | -1.30% | Below baseline |

Outcome: partial. The full remote pool did not contain a clean success, but
real-tree triage did surface three candidates that beat baseline by 0.27%.
Those winners are not prefix-3 simplify-order winners and do not express the
full force-proof target. They also look like synthetic mutation artifacts
rather than directly acceptable source. Layer A still found actionable signal
that simplify-order ranking alone would not have prioritized, but this campaign
does not validate the "FIX FOUND" path.

## Final six-element target rescore on 500-candidate pool (2026-05-26)

Re-ran the auxiliary six-element target experiment on the final fetched
500-candidate pool to check whether the later remote outputs moved the trailing
force-proof nodes into place.

Command:

```bash
melee-agent debug mutate simplify-order \
  -f gm_80173EEC \
  --want-first 34,37,32,42,52,38 \
  --class 0 \
  --with-permuter \
  --permuter-dir /Users/mike/code/melee/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder3-20260526-004754 \
  --max-candidates 2000
```

Result:

| Common prefix length vs `[34,37,32,42,52,38]` | Candidates |
|---:|---:|
| 0 | 6 |
| 1 | 453 |
| 2 | 5 |
| 3 | 33 |
| 4 | 0 |
| 5 | 0 |
| 6 | 0 |

Top candidates by six-element target:

| Candidate | Prefix | Observed prefix | Distance |
|---|---:|---|---:|
| `output-137-1` | 3/6 | `34,37,32,101,100,99` | 137 |
| `output-139-1` | 3/6 | `34,37,32,101,100,99` | 139 |
| `output-141-1` | 3/6 | `34,37,32,101,100,99` | 141 |
| `output-173-1` | 3/6 | `34,37,32,103,102,101` | 173 |
| `output-176-1` | 3/6 | `34,37,32,100,99,98` | 176 |

The final pool still contains no prefix-4/6, prefix-5/6, or prefix-6/6
candidates. The additional late-run candidates did not change the conclusion:
custom scoring against the three-element prefix can move `[34,37,32]` to the
front, but positions 4-6 continue to scatter to unrelated high ig_idx values
rather than `[42,52,38]`.

## Coalesce-preservation experiment (2026-05-26)

Static analysis on the existing 500-candidate `gm_80173EEC` pool to determine
whether non-coalescing candidates exist in the mutation neighborhood. Method:
for each candidate, compile through the permuter `compile.sh` wrapper, parse
class-0 natural coalesce mappings from the generated pcdump, and record how
many of the 6 force-phys target ig_idx values `{34, 37, 32, 42, 52, 38}`
remain independent.

Sanity check: `output-139-1` matched the prior manual diagnostic:
`preserved=4/6`, `aliased=[38,42]`.

Script: `nonmatchings/gm_80173EEC/coalesce_experiment.py` (ad-hoc; not
committed to the main repo). Full report captured at
`/tmp/coalesce_experiment_report.txt`.

Histogram of preserved count:

| Preserved target ig_idx count | Candidates |
|---:|---:|
| 6 | 322 |
| 5 | 129 |
| 4 | 28 |
| 3 | 20 |
| 2 | 1 |
| 1 | 0 |
| 0 | 0 |

Top candidates by preserved count, tie-broken by real-tree match:

| Candidate | Preserved | Match | Aliased target ig_idx |
|---|---:|---:|---|
| `output-2000074-1` | 6/6 | 99.33% | none |
| `output-2000074-2` | 6/6 | 99.33% | none |
| `output-2000212-1` | 6/6 | 99.33% | none |
| `output-2000077-1` | 6/6 | 98.67% | none |
| `output-2000209-1` | 6/6 | 97.76% | none |
| `output-2000101-1` | 6/6 | 97.62% | none |
| `output-2000219-1` | 6/6 | 96.88% | none |
| `output-2000175-1` | 6/6 | 96.24% | none |
| `output-2000177-2` | 6/6 | 96.24% | none |
| `output-2000216-1` | 6/6 | 95.37% | none |

Preserved=6/6 match summary:

| Metric | Value |
|---|---:|
| Count | 322 |
| Max | 99.33% |
| Mean | 82.80% |
| Count >= 99.5% | 0 |
| Count == 100.0% | 0 |

**Outcome: B.** Non-coalescing candidates are common in the existing pool, so
the coalesce-preservation constraint would have a real search neighborhood to
shape. However, no preserved=6/6 candidate in this pool reaches 99.5% or 100%.

**Recommendation:** proceed to Stage 2. The constraint is not a dead-end
filter for gm-style targets; it should be built and validated with a fresh
permuter run so search is guided toward candidates that preserve all force-phys
target nodes instead of spending budget on coalesced-away prefix hits.

**Implications for deferred-debt #19:** the empirical Stage 1 gate supports
building the coalesce-preservation constraint as a useful refinement. The
existing pool proves the mutation neighborhood contains many candidates with
all six target ig_idx still independent, even though the current scoring did
not find a near-100% match among them.

## Phase 2 validation campaign (2026-05-27)

After Phase 2 of deferred-debt #19 landed, re-ran the `gm_80173EEC`
campaign intending to enable the coalesce-preservation constraint during
remote permuter search.

Setup:

```bash
melee-agent debug dump local src/melee/gm/gm_16F1.c \
  --function gm_80173EEC \
  --output build/mwcc_debug_cache/melee/gm/gm_16F1.txt

melee-agent debug permute setup-simplify-order-scorer \
  -f gm_80173EEC \
  --want-first 34,37,32 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/gm/gm_16F1.txt \
  --force-phys '34:31,37:30,32:29,42:28,52:28,38:28' \
  --force \
  --perm-root /Users/mike/code/melee/nonmatchings_phase2_root
```

Local Step 0 sanity check passed before remote submission:

```text
Function:          gm_80173EEC
Score:             3000000
Target prefix:     [34, 37, 32]
Observed prefix:   [37, 34, 91]
Common prefix:     0 / 3
Precolor distance: 0
  IG       +0 -0
  Coalesce +0 -0
  Spill    +0 -0

Coalesce preservation:    ALL TARGETS INDEPENDENT
Polarity check:           SAFE
```

Remote run:

| Field | Value |
|---|---:|
| Job | `gm_80173EEC-coder1-20260526-171813` |
| Target | `coder1` |
| Threads | 16 |
| Iterations | 212,709 |
| Saved outputs | 319 |
| Best remote score | 135 |

The fetched pool was then scored through Layer A:

```bash
melee-agent debug mutate simplify-order \
  -f gm_80173EEC \
  --want-first 34,37,32 \
  --class 0 \
  --with-permuter \
  --triage \
  --max-candidates 2000 \
  --permuter-dir /Users/mike/code/melee/nonmatchings_phase2_root/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder1-20260526-171813
```

Post-hoc local scoring found that the pool was not actually generated with
the Phase 2 constraint active:

| Metric | Value |
|---|---:|
| Compiled variants in Layer A scan | 327 |
| Gate rejected by local preserve/precolor gates | 324 |
| Progress hits | 0 |
| Permuter candidates triaged | 319 |
| Best real-tree match | 99.33% |
| Prior ceiling | 99.33% |

Top real-tree matches:

| Rank | Candidate | Match | Delta vs 99.06% baseline | Simplify-order rank |
|---:|---|---:|---:|---:|
| 1 | `output-2000074-1` | 99.33% | +0.27% | 49 |
| 2 | `output-2000076-1` | 99.33% | +0.27% | 51 |
| 3 | `output-2000212-1` | 99.33% | +0.27% | 187 |
| 4 | `output-2000264-1` | 96.39% | -2.67% | 239 |
| 5 | `output-2000166-1` | 95.98% | -3.08% | 141 |

The stale-scorer evidence is concrete: `output-135-1` was saved remotely with
score `135`, but the current local Phase 2 scorer rejects the same source with
score `1000000000` because it coalesces target ig_idx values `38` and `42`
into root `3`. The remote `melee-agent debug target score-simplify-order
--help` output also lacked the new Phase 2 `--strict-polarity` behavior,
confirming that `/home/discord/.local/bin/melee-agent` on `coder1` was older
than the local Phase 2 build.

Allocator diagnostic:

| Variant | ig_idx | Simplify position | Colorgraph iter | Assigned phys | Coalesce event |
|---|---:|---:|---:|---:|---|
| baseline | 34 | 1 | 1 | r30 | none |
| baseline | 37 | 0 | 0 | r31 | none |
| baseline | 32 | 50 | 50 | r28 | none |
| baseline | 42 | 42 | 42 | r29 | none |
| baseline | 52 | 35 | 35 | r29 | none |
| baseline | 38 | 46 | 46 | r30 | none |
| `output-135-1` top simplify-order | 34 | 0 | 0 | r31 | none |
| `output-135-1` top simplify-order | 37 | 1 | 1 | r30 | none |
| `output-135-1` top simplify-order | 32 | 2 | 2 | r29 | none |
| `output-135-1` top simplify-order | 42 | n/a | n/a | n/a | `42 -> 3` |
| `output-135-1` top simplify-order | 52 | 43 | 43 | r28 | none |
| `output-135-1` top simplify-order | 38 | n/a | n/a | n/a | `38 -> 3` |
| `output-2000074-1` top triage | 34 | 0 | 0 | r31 | none |
| `output-2000074-1` top triage | 37 | 47 | 47 | r30 | none |
| `output-2000074-1` top triage | 32 | 51 | 51 | r28 | none |
| `output-2000074-1` top triage | 42 | 42 | 42 | r29 | none |
| `output-2000074-1` top triage | 52 | 35 | 35 | r29 | none |
| `output-2000074-1` top triage | 38 | 46 | 46 | r29 | none |

**Outcome: invalid validation run.** This run does not validate or invalidate
the Phase 2 coalesce-preservation constraint because the remote scorer used by
permuter was stale. The fetched pool still ties the previous 99.33% ceiling and
does not contain a 100% match, but that result is only another unconstrained
search data point.

**Implications:** before re-running the Phase 2 campaign, the remote doctor
needs to verify that the remote scorer exposes the current Phase 2 behavior, or
the remote editable install must be refreshed from the same `master` revision
used locally. A valid Phase 2 run should not save candidates like
`output-135-1`; those should be rejected during search rather than filtered
post-hoc.

## Phase 2 validation campaign rerun (2026-05-27)

Re-ran the Phase 2 campaign after explicitly checking the stale-remote-scorer
failure from the first attempt.

Preflight:

- Synced local `tools/melee-agent` to
  `/home/discord/permuter-work/melee/tools/melee-agent` on `coder1`.
- Verified remote `score-simplify-order --help` exposed `--strict-polarity`.
- Re-scored known-bad `output-135-1` on the remote scorer and confirmed it was
  rejected by coalesce preservation:

```text
Score:             1000000000
Coalesce preservation:    REJECTED
  Target ig_idx [38,42] coalesced as alias(es) into another root.
Polarity check:    SAFE
```

That preflight closes the stale-scorer hole for this run. `remote doctor`
also passed against the fresh rerun root.

Remote run:

| Field | Value |
|---|---:|
| Job | `gm_80173EEC-coder1-20260526-215803` |
| Target | `coder1` |
| Threads | 16 |
| Iterations | 273,283 |
| Saved outputs | 283 |
| Best remote score | 2,000,042 |
| Effective stop | Remote instance shut down; tmux later restarted at an idle shell |

The constrained scorer changed the search shape materially. Unlike the stale
first attempt, no low-score prefix-3 candidates were saved. Best candidates
remained at prefix 1/3:

| Common prefix length | Candidates |
|---:|---:|
| 0 | 5 |
| 1 | 283 |
| 3 | 0 |

Top simplify-order candidates:

| Candidate | Prefix | Observed prefix | Distance | Local gate result |
|---|---:|---|---:|---|
| `output-2000042-1` | 1/3 | `34,91,90` | 42 | IG differs |
| `output-2000043-1` | 1/3 | `34,91,90` | 43 | IG differs |
| `output-2000044-1` | 1/3 | `34,91,90` | 44 | IG differs |
| `output-2000045-1` | 1/3 | `34,91,90` | 45 | IG differs |
| `output-2000046-1` | 1/3 | `34,92,91` | 46 | IG differs |

Layer A triage on the fetched pool:

```bash
melee-agent debug mutate simplify-order \
  -f gm_80173EEC \
  --want-first 34,37,32 \
  --class 0 \
  --with-permuter \
  --triage \
  --max-candidates 2000 \
  --permuter-dir /Users/mike/code/melee/nonmatchings_phase2_rerun_root/nonmatchings/gm_80173EEC/remote-runs/gm_80173EEC-coder1-20260526-215803
```

Triage result:

| Metric | Value |
|---|---:|
| Compiled variants in Layer A scan | 291 |
| Compile fails | 0 |
| Gate rejected by local preserve/precolor gates | 288 |
| Progress hits | 0 |
| Permuter candidates triaged | 283 |
| Best real-tree match | 99.33% |
| Prior ceiling | 99.33% |

Top real-tree matches:

| Rank | Candidate | Match | Delta vs 99.06% baseline | Simplify-order rank |
|---:|---|---:|---:|---:|
| 1 | `output-2000074-1` | 99.33% | +0.27% | 33 |
| 2 | `output-2000212-1` | 99.33% | +0.27% | 171 |
| 3 | `output-2000094-1` | 99.27% | +0.21% | 53 |
| 4 | `output-2000120-1` | 98.36% | -0.70% | 79 |
| 5 | `output-2000182-1` | 95.10% | -3.96% | 141 |

**Outcome: C / no progress beyond the prior ceiling.** The coalesce-preserving
run is now valid: the remote scorer rejected the known coalesced-away failure
mode before launch, and the saved pool contains no prefix-3 candidates. The
best real-tree result still ties the previous 99.33% ceiling and does not find
a 100% match.

**Implications:** coalesce preservation works as a constraint and reshapes the
search away from invalid prefix-3 hits, but for `gm_80173EEC` it did not expose
a productive neighborhood within 273K iterations. This strengthens the
function-specific ceiling finding: current decomp-permuter mutations can either
move the target prefix by coalescing away required nodes, or preserve the target
nodes but only reach prefix 1/3 and the same 99.33% real-tree ceiling. Future
investment should likely move to richer target syntax/new mutation primitives
or backwards/source-corpus inference rather than another same-shape run.
