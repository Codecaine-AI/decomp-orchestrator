# Gate 1b Expansion — Cross-Compile Matcher Generalization

**Date:** 2026-05-28
**Verdict:** **GO for Phase 3 (Unit 3 re-anchoring).** The role-identity matcher
generalizes across functions *and files*, both identity features are validated as
load-bearing, the matcher abstains rather than false-positives on vanished roles,
and both Unit-3 carry-forwards are resolved.

## Why this was done

The shipped matcher (Units 1+2 + Gate 1) validated cross-compile **precision on
n=1** — one function (`mnVibration_80248644`), 6 hand-adjudicated roles. Phase 3's
re-anchoring loop consumes the matcher's output as ground truth and amplifies its
errors, so before building on it we expanded the corpus, added a curated
use-site-stress set and an abstention gate, and fixed the two carry-forwards that
go live in Phase 3. (Scope set with a second-opinion review that flagged cross-file
validation and a use-site-stress corpus as the things to add before leaning harder.)

## Method

- **Real git-history drift pairs**, generated locally via a disposable worktree +
  `debug dump local --no-cache-sync`, sliced per-function (LF-normalized) by
  `scripts/slice_pcdump_function.py`. Functions span two files: `mnvibration.c`
  (4 fns) and `mndiagram2.c` (4 fns, reference rev `d1a10c029` vs `388f5b89c`).
- **Unique-first-def labels** (`scripts/adjudicate_gate1b_labels.py`): a role is
  auto-labeled only when its normalized first-def signature is unique in *both*
  compiles — a struct offset / named symbol / immediate that pins it independent of
  ig number and of the matcher's use-site feature (non-circular).
- **Use-site-stress labels** (composite def-lineage): GENERIC first-def roles
  (`mr`/`add`/`lbz`/...) that drifted, adjudicated by the chain of *defining* ops
  (producers) to a unique anchor. Producers are independent of the matcher's
  use_site (consumers) feature, so non-circular. The method reproduces
  mnVibration's hand-labels `41→44` and `42→45`, cross-validating it.

## Results — Gate 1b (cross-compile recovery)

A role "drifted" when its ig number changed across the edit (raw ig_idx wrong).

| function | file | class-0 | labels | drifted | raw-ig | recovered | precision |
|---|---|---:|---:|---:|---:|---:|---:|
| fn_80247510 | mnvibration | 292 | 13 | 13 | 0 | 13 | 1.00 |
| fn_802487A8 | mnvibration | 71 | 19 | 18 | 1 | 19 | 1.00 |
| fn_80248A78 | mnvibration | 68 | 17 | 15 | 2 | 17 | 1.00 |
| mnVibration_80248644 | mnvibration | 21 | 6 | 5 | 1 | 6 | 1.00 |
| mnDiagram2_CreateStatRow | mndiagram2 | 83 | 15 | 14 | 1 | 15 | 1.00 |
| mnDiagram2_GetRankedFighter | mndiagram2 | 54 | 12 | 11 | 1 | 12 | 1.00 |
| mnDiagram2_GetRankedName | mndiagram2 | 36 | 11 | 11 | 0 | 11 | 1.00 |
| mnDiagram2_Create | mndiagram2 | 31 | 11 | 10 | 1 | 11 | 1.00 |
| **total** | **2 files** | | **104** | **97** | **7** | **104** | **1.00** |

The matcher recovered **104/104** source-grounded roles with **zero confident-wrong
matches**, vs a raw-ig baseline of **7/104**. Functions span 21–292 class-0 nodes
and varied edit types (inline extraction, alias, sub-expression extraction,
cleanup-loop restructure, stat-row population).

## Results — Gate 1e (use-site stress)

19 GENERIC-first-def, drifted roles across **5 functions / 2 files**, lineage-
adjudicated. Each is recovered by the matcher **with** use_site and **fails when
use_site is ablated** — proving use_site is load-bearing for roles first-def alone
cannot distinguish, generalizing mnVibration's original finding.

| function | use-site-stress labels | recovered | recovered w/ use_site ablated |
|---|---:|---:|---:|
| fn_80247510 | 5 | 5 | < 5 |
| fn_802487A8 | 6 | 6 | < 6 |
| mnDiagram2_GetRankedFighter | 2 | 2 | < 2 |
| mnDiagram2_GetRankedName | 3 | 3 | < 3 |
| mnVibration_80248644 | 3 | 3 | < 3 |

## Results — Gate 1c (feature ablation)

Per-function, the load-bearing feature tracks the label mix: **first-def** on the
unique-first-def sets (ablating it loses 3–13 recoveries; use_site still recovers
the remainder independently), **use-site** on the generic-first-def roles. Both
identity-core features are load-bearing across multiple functions and files.

## Results — Gate 1d (abstention / no false positives)

For reference roles whose unique first-def is *entirely absent* from the drifted
rev (no clean counterpart), the matcher returned **GONE for 6/6** such roles
(in `mnDiagram2_CreateStatRow` and `mnDiagram2_Create`) with **zero** confident-wrong
matches. Phase 3's re-anchoring relies on these non-1:1 signals; this confirms the
matcher abstains instead of chasing a phantom.

## Carry-forwards addressed

- **CF1 — exact assignment.** `min_cost_assignment` previously degraded to a silent
  greedy solution above 16 rows. It is now **exact min-cost max-flow** over the
  sparse TOP_K-pruned graph — polynomial at any N, no blowup, no silent fallback;
  the 19- and 17-role functions exercise the former greedy path at precision 1.00.
  A self-column tie-break keeps self-match identity-stable.
- **CF2 — class guard.** `build_descriptors` refuses any class other than 0 (GPR)
  with `NotImplementedError` instead of silently polluting its GPR-keyed lookups.

## Residual gaps (carry into Phase 3 planning)

- **Cross-module (non-`mn`) breadth.** The corpus now spans two files but both are
  menu (`mn`) code. Two cross-module attempts failed the non-circular bar
  (`mnEvent_8024CE74` — a counting loop, almost all roles generic; `fn_8024E1B4` —
  a 50→100% restructure that changed the struct skeleton). A library/stage/fighter
  function would broaden the structural idioms tested.
- **Non-GPR classes are guarded, not generalized.** Matching FPR/CR roles needs
  class-aware `reg_info`/`bindings` first.
- **Genuinely symmetric siblings** (e.g. stat-row inits) are not adjudicable
  non-circularly and the matcher correctly reports them AMBIGUOUS — Phase 3 must
  treat AMBIGUOUS/SPLIT as first-class, not force a match.

## Bottom line

The core hypothesis — role identity is stable across source edits where raw ig_idx
is not — holds across a structurally diverse, cross-file set of real functions, for
both the first-def and the use-site regimes, and the matcher abstains safely where
no clean counterpart exists. Safe to build the re-anchoring loop on, carrying the
residuals above into the Unit 3 plan.
