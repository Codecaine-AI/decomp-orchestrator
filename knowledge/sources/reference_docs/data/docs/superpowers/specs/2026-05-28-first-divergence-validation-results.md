# First-Divergence Analyzer v1 — Validation Results & Go/No-Go

Date: 2026-05-28
Companion to the campaign brief
`docs/superpowers/specs/2026-05-28-first-divergence-validation-campaigns.md`.
Campaigns A/B/C were run read-only on an external agent and validated here
against the committed fixtures + the agents' raw artifacts.

## Verdict (summary)

v1's **gated analyzer is correct** and now has a faithful target-capture path,
but its **practical usefulness is bounded** by target availability and by r0/temp
dominance + a weak symbol bridge. **v2 convergence is blocked** on a
role-descriptor identity layer (raw `ig_idx` drifts ~89% across real edits), and
the **symbol bridge alone cannot be that layer** (8.7% of nodes get any var
binding, none verified).

**Recommended next phase: design the role-descriptor identity layer.** It is the
common prerequisite for v2 convergence *and* the fix for the drift +
source-mapping weaknesses. Defer wiring the current `--source` layer (low payoff
until the identity layer provides richer features); v1 stays a useful same-source
explainer in the meantime.

## What the validation produced (tooling landed)

The campaigns drove three real improvements to `master`:
- `8b33bb7c8` — fix: Case D false positive (coalesced-into-on-target-root nodes).
- `4238992ac` — feat: `target derive --force-phys-safe` (faithful, decisions-based
  targets that round-trip cleanly; the default `analyze_function`-based derive
  disagrees with the analyzer for coalesced/spilled/r0 nodes).
- Brief revs 2–5 — runnable Campaign B (disposable worktrees + bootstrap), real
  cache isolation (`--no-cache-sync`), operational drift metric, provenance
  fields, and the `--force-phys-safe` workflow.

## Campaign A — correctness & usefulness

- **Correct:** positives reproduce the on-record answers (gm Case D 43/46→root3;
  lbDvd Case B ig46 r10→r12); negative controls report NONE once targets are
  faithful. Two real bugs were found and fixed (above).
- **Usefulness bottleneck — target availability:** of 4 stuck seeds, 1 was
  already effectively matched (stale seed) and 3 had **no available same-source
  target**. So **0 usable targets** for the tool's purpose on genuinely-stuck
  functions. The headline abstain/r0 usefulness metric could not be measured on
  stuck functions *because the tool can't run without a target* — which is itself
  the finding: **v1 needs a force-proof/target you don't have on the functions
  you're stuck on.**

## Campaign B — convergence premise & drift (DECISIVE)

On `mnVibration_80248644`, walking the real solve path (4 revs) with the matched
coloring as target:
- Every pre-final rev was **below the 0.8 identity-validity threshold**: only
  **1 of 9** target identities matched; **~89% drift**. Robust even charitably —
  counting all "ambiguous" as "matched" still yields ≤0.78; the "missing" bucket
  (2–3/9) is hard, bridge-independent drift.
- **Conclusion:** raw `ig_idx` is not viable for a v2 convergence loop across
  source edits. v2 needs a **role-descriptor identity layer first**. This
  empirically confirms the design spec's open question #1, with a number.

## Campaign C — source layer & symbol-bridge baseline

- **`--source` was mis-wired; now fixed (`cb82413b8`):** it passed a
  `FunctionEvents` where `list_bindings` wants a function-name string, plus an
  empty source string, so it never yielded a binding. Now wired (resolves the
  unit `.c` + pre-coloring pass like `virtual-to-var`); verified end-to-end
  (`ig 38 -> var i`). Payoff is still bounded by the weak bridge below.
- **Bridge quality baseline (all 92 class-0 decision nodes; recomputed from raw
  per-node output):**

  | bucket | all 92 | r0 (50) | non-r0 (42) |
  |---|---:|---:|---:|
  | verified | 0 (0.0%) | 0 | 0 |
  | best-guess | 1 (1.1%) | 0 | 1 |
  | low-confidence | 7 (7.6%) | 0 | 7 |
  | first-def-only | 47 (51.1%) | 13 | 34 |
  | unmapped | 37 (40.2%) | 37 | 0 |

  Only **8/92 (8.7%)** nodes get any variable name, **none verified**. **r0
  dominates** (50/92 = 54%; gm alone 43/51 = 84%) and r0 nodes are **74%
  unmapped**. The divergence nodes themselves (gm 43/46, lbDvd 46) are
  coalesced/temps with no var binding.
- **Identity-layer read:** the bridge is one useful feature source but
  insufficient alone. A viable identity layer must combine source binding (when
  available) + first-def opcode/operands/block + live range/use count + copy
  lineage + coalesce root/aliasing + colorgraph/simplify position + load/store
  field-offset signatures.

## Go/no-go answers (the brief's four questions)

1. **Is v1 sound?** Yes. Gated facts are correct (validated on positives,
   negatives, and the replay gate); the taxonomy was sufficient on the corpus.
   Validation found and fixed two real correctness bugs.
2. **Is v1 useful?** Limited, as-is. A correct same-source *explainer* when you
   already have a faithful target — but target availability is the bottleneck
   (0/4 stuck), r0/temp dominance narrows its view (gm: 8 of 51 nodes are
   non-r0), and the advisory source layer is non-functional with a weak bridge.
   Not yet a practical driver on the functions one is actually stuck on.
3. **Is v2 convergence viable, and in what order?** Not yet — gated on a
   role-descriptor identity layer (raw `ig_idx` ~89% drift). Build the identity
   layer before any convergence loop.
4. **What does the source layer need?** The wiring fix is done (`cb82413b8`) — it
   now emits real bindings. The remaining limitation is bridge *quality* (8.7%
   var coverage, 0 verified); richer, higher-confidence mapping needs the
   identity layer.

## Remaining tooling gaps (ranked)

1. **[needs-design] Role-descriptor identity layer** — the blocker for v2; the
   symbol bridge is insufficient alone. *Recommended next phase.*
2. **[needs-design] Target availability for stuck functions** — v1 needs a
   target; genuinely-stuck functions don't have one. (How to derive/approximate
   a target without a pre-existing force-proof.)
3. **[done] `--source` wiring fix** (`cb82413b8`) — the layer now emits bindings;
   quality is bounded by the bridge (→ #1).
4. **[medium] Disposable-worktree bootstrap helper** (`--from-worktree`) for
   cross-rev dumps — remove the main.dol/config.json/compiler/report.json manual
   steps Campaign B needed.
5. **[small] r0 visibility** — the analyzer correctly abstains on r0, but r0
   dominance (54–84%) means its effective scope is narrow; worth surfacing in the
   output so users know how much of the function is invisible to it.

## Recommendation

Proceed to **design the role-descriptor identity layer** (spec open question #1):
the prerequisite for v2 convergence and the lever that also fixes the drift and
source-mapping weaknesses. Treat the symbol bridge as one input feature, not the
identity system. (The `--source` wiring is now done — `cb82413b8`; further v1
polish can wait for the identity layer.)
