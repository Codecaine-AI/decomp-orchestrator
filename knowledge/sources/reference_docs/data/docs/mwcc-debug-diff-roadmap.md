# mwcc-debug diff roadmap — 2026-05-21

Companion doc to `docs/superpowers/specs/2026-05-21-mwcc-diff-design.md`.
Captures the longer-term direction the MVP is a foundation for, the
near-term follow-ups predicted from the design, the deferred technical
debt from the final review pass, and the signals worth watching when
agents actually start using the tool.

The spec describes *what* shipped; this doc describes *why* the shape is
what it is and *where it goes next*.

---

## The longer-term direction: preimage computation

The shipped MVP is a forward-compile-both-sides differential. The
longer-term direction is something more ambitious: **treat each MWCC
pass as a many-to-one function, and provide tooling that reasons
backwards through those passes from a target asm to the constraints on
the C source that could have produced it.**

Formally: given a target asm `Y`, we want to characterize the equivalence
class `compile⁻¹(Y) = { source : compile(source) = Y }` — the *set* of
C sources that produce a given asm, not just one representative. Today's
decompilers (m2c, Ghidra, Hex-Rays) collapse this set to a single
"plausible" source. Decomp-permuter searches the set blindly via
random C mutation. Neither approach surfaces the structure of the set
itself.

**Why this framing matters for matching**: most "stuck at 99%" cases in
the project are stuck because the agent (or human) has drifted forward
from m2c's output through a series of mutations, each of which collapsed
uncertainty in some direction. By the time you're at 99%, you don't
know which earlier choice was wrong. A backwards-anchored tool has
fundamentally different mechanics — every constraint it propagates is
provably true (MWCC is deterministic, and you're working from the actual
output). Each backward step *adds* certainty instead of consuming it.

**Why MWCC specifically is unusually tractable for this**:

1. Deterministic compiler binary + known flags
2. Pre-existing pass-level inspection (`mwcc-inspect`, `mwcc-debug`)
3. Cheap forward oracle (compile-and-check at ~1s/run)
4. We don't need *all* matching sources — one will do
5. The matched-function corpus and mismatch-db are training data for
   learning C↔IR mappings

These conditions are why this problem looks more tractable for Melee
than for general decompilation.

---

## Candidate plausibility framework

When evaluating whether a candidate source change is "acceptable" for a
matching campaign, the binary "developer-plausible vs synthetic" framing
is too coarse. A 4-category spectrum captures the actual decision space
better, and it matches how the community evaluates submissions:

**Category 1 — Clean source.** Reads like normal code. Naming,
indentation, expression structure, and idioms match the project's
conventions and the era's conventions (2001-era game C looks different
from modern code). No special justification required.

Examples from grVenom: `xC8 = 1; xC8 += timer;` (verbose multi-statement
assignment, but a developer could easily have written this if the field
was an iteratively-built counter).

**Category 2 — Unusual but with a constructable narrative.** Has
features that aren't strictly necessary semantically, but a plausible
historical or contextual story explains why they might have existed:
debug code that was disabled, leftover assertions, hand-optimization
remnants, macro expansion artifacts, defensive `volatile` for
memory-mapped I/O or ordering hints. The community generally accepts
category-2 source when the narrative is constructable.

Examples: `volatile` qualifiers (common throughout Melee — defensive
ordering, debug build remnants); empty `if` bodies including the
nested-empty-if trick (debug/assertion code disabled before shipping
— from a Discord example: `if (cond) { if (other) {} }` lets MWCC
emit a test without a body because the inner is eliminated as dead
code); `do { ... } while(0)` wrappers that read as macro expansion;
declared-but-unread temps as former debug instrumentation.

**Category 3 — Synthetic, no constructable narrative.** Has features
no human would plausibly write under any narrative: comma expressions
inside cast expressions, `if (x && x)`-style redundant conditions,
arbitrary `do/while(0)` around a single non-macro statement, fabricated
control flow that doesn't map to any source intent. Project-dependent
whether accepted; some decomp projects accept as fakematch milestones,
others reject.

**Category 4 — Changes observable semantics.** Removes function calls,
alters control flow in ways the original wouldn't, changes data
values. Universal red line — even projects that accept fakematch
reject these.

### Implications for the tooling

The tool's job is to *surface* candidates with their plausibility
classification and constructable narratives, not to *gate* on category.
The developer (or campaign agent) decides what category-2 patterns to
accept based on the project's standards. Category 3 should be visibly
flagged so the decision is conscious, not accidental. Category 4 is
worth a hard gate at most layers.

### Implications for the roadmap

Several entries below use phrases like "developer-plausible" or
"synthetic" loosely. Future tooling work should classify candidates per
the framework above (see "Plausibility-aware candidate classifier" in
the deferred technical debt section). Existing campaign writeups
(`docs/mwcc-debug-grvenom-campaign-2026-05-22.md` especially) used
this framing implicitly — recognize that "Tier-6" conclusions in those
writeups often conflated "current tooling can't find a clean source"
with "no clean source exists." The latter is a logically stronger claim
than the evidence supports.

---

## Workflow integration

The grVenom_80204284 campaign closed successfully at 100% match
(commit `42f121862`) on 2026-05-24, but came within a hair of being
incorrectly written off as Tier-6 because we ranked candidates by the
wrong metric for human inspection. The fix existed at
`permuter output-180-1` the whole time; it surfaced only when
`debug permute triage` was run on the full pool.

The structural lesson: **stuck-function matching is a two-stage
search/validate process, not a single-metric optimization.** Each
stage uses a different metric for a different reason:

| Stage | Metric | Reason | Cost |
|---|---|---|---|
| 1. Search (in permuter loop) | Custom scorer (simplify-order + precolor) | Decides what permuter saves. Must be cheap (~ms/candidate). | ~$0 |
| 2. Validate (after harvest) | `debug permute triage` real-tree match% | Decides which saved candidates are actually fixes. Must be accurate. | ~5-10s/candidate |

Stage 1's metric is a *search-side proxy*. It tells permuter what to
look for. Stage 2's metric is the *ground truth*. It tells the human
whether anything actually worked. The two don't fully correlate, and
ranking candidates for inspection by the stage-1 metric (as the
grVenom survey did) can hide the answer in plain sight.

### Layer A: `--triage` flag on `debug mutate simplify-order`

The smallest change that prevents the grVenom near-miss from
recurring. After the existing search completes and ranks by
simplify-order, optionally invoke `debug permute triage` on the
permuter output dir and surface a second ranked list by real-tree
match%. If triage finds a 100% match, surface it prominently as the
headline of the report so the campaign agent can't miss it.

**Status:** in flight on `claude/triage-flag` (2026-05-24). Expected
to land in 1-2 days. Single CLI change, no architectural impact, but
closes the workflow gap that almost cost grVenom.

**Conviction:** very high. We have concrete evidence that the
methodology failure cost real time on the grVenom campaign. The fix
is a small composition of two existing tools that should have been
running together from day one. Cost is days; payoff is "the campaign
methodology can no longer fail this way."

#### Target shape: simplify-order vs phys-iter

Layer A's custom scorer operates on the **simplify-order target shape**
— "ig_idx N should appear at simplify-order position P." Not every
stuck function presents this shape. The `ftColl_8007BAC0`
re-validation campaign on 2026-05-25 surfaced the second shape:
**phys-iter targets**, where the meaningful allocator decisions live
in `COLORGRAPH DECISIONS` iteration positions rather than simplify
order. Fix A landed correctly but the sanity check showed ftColl's
`SIMPLIFY GRAPH` is all `-1` for the relevant nodes — even after Fix
A's filtering, the meaningful stream is empty. Phys-iter targets need
a different scorer entirely (deferred — see Deferred technical debt
#18).

Distinguishable from the pcdump:

- **Simplify-order shape.** `SIMPLIFY GRAPH (class=N)` lists concrete
  `ig_idx` values for the meaningful decisions. Force proof states
  the ordering at the start of the graph. Scorer expresses the target
  via `--want-first N,M`. `grVenom_80204284` is canonical.
- **Phys-iter shape.** `SIMPLIFY GRAPH (class=N)` is dominated by `-1`
  placeholders for the relevant decisions; the meaningful `ig_idx`
  only resolves in `COLORGRAPH DECISIONS`. Force proof uses
  `--force-phys-iter class:iter:phys`. Layer A scorer cannot express
  this target. `ftColl_8007BAC0` is canonical
  ([campaign](mwcc-debug-ftColl_8007BAC0-campaign-2026-05-24.md)).

**Pre-flight check (REQUIRED).** Before queueing a 2–3 hour permuter
run, score baseline against the proposed target:

```bash
melee-agent debug target score-simplify-order \
  -f <function> --target <target.yaml> <baseline.o> --breakdown
```

If `Observed prefix:` is empty after Fix A's `-1` filtering, the
target shape is phys-iter — Layer A cannot help; abort. SKILL.md
documents this as Step 0 of the Stuck-function workflow.

**Within simplify-order shape, watch for coalescing-dependent
targets.** Some force proofs (like `gm_80173EEC`'s `--force-phys
34:31,37:30,32:29,42:28,52:28,38:28`) state per-virtual physical
assignments for multiple `ig_idx` values that presuppose those
virtuals remain *independent* in the allocator graph. Mutations that
satisfy the simplify-order prefix can coalesce some target virtuals
into other roots as a side effect, removing them from the allocator
walk entirely. **Pre-flight does NOT catch this;** it only emerges
from the campaign diagnostic. `gm_80173EEC`'s final 500-candidate
pool achieved prefix-3/3 for the leading `[34, 37, 32]` portion of
the force proof but zero prefix-6/6 against the full 6-element
target, because permuter mutations that satisfied the prefix
coalesced `ig_idx 42` and `38` into root virtual `3` (r3). Only
`ig_idx 52` survived as independent and landed on r28 correctly but
alone ([campaign](mwcc-debug-gm_80173EEC-campaign-2026-05-25.md)).
The natural Layer A extension is a coalesce-preservation constraint
in the custom scorer — see Deferred technical debt #19.

**Within simplify-order shape, watch for dispense-direction
polarity.** `--want-first N,M` encodes "target `ig_idx` values appear
FIRST in simplify order," which produces target physicals via MWCC's
dispense algorithm. For non-volatile target physicals (r25–r31),
top-down dispense from `obtain_nonvolatile_register()` assigns r31,
r30, ... to early positions — so `--want-first` captures the target.
For high-volatile target physicals (r10–r12), lowest-first dispense
from `workingMask` assigns r3, r4, ... to early positions — so
target virtuals need to be at LATER positions, not earlier.
`--want-first` has the wrong polarity for high-volatile targets. The
screening's `--want-first` derivation from a force-phys mapping is
only valid when target physicals are non-volatile; for volatile
targets a different target syntax is required.

`lbDvd_80018A2C`'s campaign demonstrated this: the screening derived
`--want-first 46,44` from force-phys `44:10, 46:12`. The custom
scorer correctly biased search toward candidates with `46, 44` at
the first two class-0 simplify positions, and 66 such candidates
were produced. But all got `46 -> r4, 44 -> r5` instead of `r10,
r12`, because position 0/1 in volatile dispense gives the LOWEST
available registers, not the target ones
([campaign](mwcc-debug-lbDvd_80018A2C-campaign-2026-05-25.md)). The
campaign closed NO PROGRESS not because permuter failed to find the
encoded target, but because the encoded target was the wrong
polarity. See Deferred technical debt #20.

Hone Layer A on simplify-order shape before broadening. Phys-iter
support is explicitly out of scope until a separate scorer mode
lands (#18). Within simplify-order shape, coalescing-dependent
targets (gm-style) require an additional scorer extension (#19), and
high-volatile-target functions (lbDvd-style) require late-target
syntax (#20). All three gotchas can pass Step 0 pre-flight; each
requires its own scorer work to close the gap.

### Layer B: `debug campaign` orchestrator (after Layer A validates)

A meta-command that runs the full two-stage sequence as one
operation:

```bash
melee-agent debug campaign run \
  --function fnX \
  --want-first 42,32 \
  --class 0 \
  --permuter-iterations 500000 \
  --auto-triage
```

Steps it executes internally:
1. Generate baseline dump (calls existing `dump local`)
2. Set up custom scorer (calls existing `setup-simplify-order-scorer`)
3. Launch permuter in background tmux session
4. Periodically (every N iterations or M minutes) checkpoint: run
   triage on current saved candidates, log the best real-tree match%
5. On termination: final triage, full ranked output, candidate
   inspection for top-3
6. If 100% match found mid-run: stop permuter early, surface winner

**Status:** planned. Build after Layer A validates on a new
function — the validation campaign may surface details that change
Layer B's design.

**Conviction:** medium-high pending validation. The grVenom campaign
was a multi-day human-coordinated process; reducing it to a single
launch command would unlock running campaigns at higher cadence on
stuck functions across the project. But we have one campaign of
experience; a second campaign before this builds is wise.

### Layer C: persistent campaign state tracker (deferred)

A stateful model that records what's been tried on a function across
sessions, surfaces what to do next, and prevents redundant work.
Worth building only if multi-campaign cadence becomes routine. Skip
until justified by usage.

**Status:** deferred. **Conviction:** low until usage signals demand
it.

---

## What shipped (MVP)

Phase 1 — the forward-compile-both-sides differential — shipped on
2026-05-21 as commits `b250a5568..9d977116f` on master, plus the
`61b3c3f40` follow-up that fixed the `pcdump-local` → `dump local`
CLI rename. Spec at
`docs/superpowers/specs/2026-05-21-mwcc-diff-design.md`. Plan at
`docs/superpowers/plans/2026-05-21-mwcc-diff.md`.

Key capabilities:

- `melee-agent debug inspect diff` accepts two `.c` source variants or
  two `.txt` pcdump files
- Pass-by-pass comparison with **earliest-divergence detection** and
  cascade labeling
- Optional `mwcc-inspect` frontend/mid-end snapshots when both inputs
  are committed in-repo source files
- **RA classifier**: divergences at register allocation are tagged as
  *intrinsic* (allocator behaved differently on identical input — fix
  lies in `--force-coalesce` / `--force-phys`, not C source changes) or
  *input-derived* (allocator behaved consistently, upstream IR changed
  — look at instruction selection or earlier)
- Heuristic-cause hints for three patterns (`divw`/`mulhwu` → s32/u32;
  `srawi`/`srwi` → signedness; `volatile`)

MVP scope is forward-only. Backwards inference is deferred.

---

## The phase ladder

Each phase delivers standalone value; later phases let the tool compare
against *target asm* directly rather than requiring two forward-compiled
C sources.

| Phase | Scope | Builds on |
|---|---|---|
| 1 — MVP (shipped) | Forward-compile both sides, IR-diff, RA classifier | Existing pcdump + inspect tooling |
| 2 | Backwards inference for the last pass (scheduled asm → unscheduled IR) | Scheduler is nearly a pure function of latency tables — tightest invertible pass |
| 3 | Backwards inference for register allocation | RA's IGNode + colorgraph semantics; force-coalesce/force-phys are forward equivalents |
| 4 | Backwards inference for instruction selection | BURS-style tree-pattern inversion |
| 5 | Backwards inference for mid-end + AST | Use matched-function corpus + mismatch-db as learned C↔IR map |

Reaching Phase 2 alone unlocks "compare current C against target asm"
— the headline capability that the MVP can only approximate via
forward-compile-both-sides. Phase 3 unlocks intrinsic-vs-input-derived
classification against target. Phase 5 closes the loop end-to-end but
relies on learned (not derived) mapping, so it's the loosest.

The phase ladder is the right shape, but its value timing depends
entirely on what the MVP reveals about how agents actually use IR-diff
output. See "Signals to watch for" below.

---

## Predicted near-term follow-ups (ranked)

Ordered by predicted leverage *assuming the MVP's framing turns out to
be useful in practice*. If the MVP doesn't see traction (see signals
below), this whole list re-prioritizes.

### ~~1. Break down "allocator input differs" into sub-signatures~~ — SHIPPED 2026-05-21

Landed in `3fc15bc1f` (feat) + `41431990c` (renderer cap follow-up). The
single "allocator input differs" line is now decomposed into four
per-component diff lines, one each for interference graph edges,
coalesce mappings, simplify ordering (first-divergence position), and
spill set. Each component emits a line only when it differs. Side
effect: the deferred tech-debt item #2 (`flags & 0x01` spilled-bit
conflation between input/output) was fixed as part of the refactor.

Format examples:

```
input: class 1: interference graph differs (added: (32, 41); removed: none)
input: class 1: coalesce mappings differ (added: (35, 32); removed: (37, 32))
input: class 1: simplify order differs (first changed position: 3; was ig_idx 34, now ig_idx 37)
input: class 1: spill set differs (added: ig_idx 40; removed: none)
```

**Campaign validation (2026-05-22, grVenom_80204284).** First real campaign
using the decomposed breakdown converted "allocator input differs" into
"the only diverging component is class 0 simplify order, first position
needs ig_idx 42 before ig_idx 32." That's the kind of localized signal
the original "input differs" line couldn't surface. Writeup at
`docs/mwcc-debug-grvenom-campaign-2026-05-22.md`. The campaign also
surfaced the next concrete tool need — see follow-up #1.5 below.

### ~~1.5. Targeted source search for a specific RA-input component~~ — SHIPPED 2026-05-22

Landed in `0717ba33e` (feat) + `89f93b73b` (cross-source dedup + class
validation fix-up). New command `melee-agent debug mutate simplify-order`
that searches for source variants producing a desired simplify-order
prefix while preserving the rest of the pre-coloring shape (interference
graph, coalesce mappings, spill set unchanged from baseline).

Built on a **variant-stream architecture** — `VariantSource = Callable[[FunctionContext], Iterable[SourceVariant]]`
— with three existing-primitive adapters in the MVP (`decl_orders_source`,
`insert_alias_source`, `type_change_source`). The architecture explicitly
slots in a future `permuter_source` adapter as a 4th file with no driver
changes (see follow-up #3).

Usage:

```
melee-agent debug mutate simplify-order \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --class 0
```

Output ranks surviving candidates by simplify-order common-prefix length
against the target, with provenance per candidate.

### ~~1.6. Score gate-rejected candidates (diagnostic)~~ — SHIPPED 2026-05-23

Landed in `925af6ba5`. The search driver now computes `score_simplify_order`
for every compiled candidate, not just those that pass the preserve-precolor
gate. Gate-rejected candidates are retained on `SearchResult.rejected_scored`
with their score + rejection reason, and the CLI report renders a histogram
of common-prefix-length bins (with the target-length row highlighted) plus
the top-N closest gate-rejected candidates by prefix length.

This was the pivotal experiment for whether the harvest-mode workflow could
ever reach the desired allocator order — and the result was *yes*. Campaign
3 on `grVenom_80204284` (2026-05-23) showed:

```
Gate-rejected diagnostic (n=525):
  prefix=0: 468 candidates
  prefix=1:  51 candidates
  prefix=2:  19 candidates  ← target length
```

Permuter does produce candidates that move class 0 simplify order to
`42,32`. They were invisible before this diagnostic because the binary
preserve-precolor gate dropped them. So:

- The **custom permuter scorer** (from #3's "still ahead") is not the
  bottleneck — exploration already reaches the target.
- The **binary gate** is the wrong abstraction for this signal — the
  19 winning candidates all also disturbed IG / coalesce / spills.
- Follow-up #1.7 below is the next concrete tool.

### ~~1.7. Combined precolor-distance + simplify-order scoring~~ — SHIPPED 2026-05-23 (superseded by #1.8 as default)

Campaign 3 demonstrated that permuter reliably produces candidates with
target simplify order, but **all of them also disturb the upstream
allocator-input shape** (IG, coalesce, spills). The binary preserve-precolor
gate rejects every one. The combined-score search driver rewards
simplify-order proximity AND penalizes precolor distance, so candidates
with high simplify-order progress and low precolor disturbance rank
above either extreme.

**What landed:**

1. **`precolor_distance` for every compiled candidate** — a single
   integer = `|IG_added| + |IG_removed| + |coalesce_added| + |coalesce_removed| + |spill_added| + |spill_removed|`. Each is already
   computed implicitly by the gate today; retained as a numeric distance
   instead of collapsing to a bool.

2. **`CombinedScore` dataclass** carrying `simplify_score`,
   `precolor_distance`, and the derived
   `combined: float = simplify_progress_ratio - alpha * precolor_distance`.
   Higher combined score = better.

3. **`--rank-combined` flag** (now a deprecated alias for `--rank-mode combined` — see #1.8) on `debug mutate simplify-order`: ranks ALL
   compiled candidates (passing AND rejected) by combined score. The
   "Best by combined score" section becomes the headline output.
   `--preserve-precolor` stays orthogonal — it still controls the binary
   gate; the rank-mode flag only changes the *ranking metric*.

4. **`--combined-alpha` flag** to tune the weight on precolor distance.
   Calibrated default landed at `0.001` after the 5K-candidate grVenom
   batch on 2026-05-23 revealed that the originally-shipped `0.05`
   buried target-hitting candidates under low-distance noise (permuter
   distances ranged 100-300+ — much larger than the 1..30 estimate the
   original alpha was tuned against).

5. **Diagnostic enhancement**: gate-rejected candidate detail lines now
   show `precolor_distance` inline. Free improvement to the existing
   diagnostic; pairs with the rank section.

**Why this was the first iteration of the metric:** the 19 winning
candidates already existed as concrete files from campaign 3. Combined
scoring against the existing harvest pool was the lowest-cost way to
validate that "high prefix + low disturbance" is the right *metric*
before committing to a custom permuter scorer that actively converges
toward it. The follow-up campaign on 2026-05-23 confirmed the metric
works (target-hitting candidates surface in the headline section) but
also showed that the calibration coupling between α and the campaign's
typical distance scale is fragile — see #1.8 for the calibration-free
successor.

### ~~1.8. Lexicographic rank mode~~ — SHIPPED 2026-05-23

Companion to the α retune in `0acb68880`: the same campaign-3 finding
("combined-score buried prefix=2 candidates under low-distance noise
because α was calibrated for the wrong distance range") attacked from
a different angle.

**What landed:**

1. **`--rank-mode {lex,combined}` flag** on `debug mutate simplify-order`
   with default `lex`. Lex sorts by `(common_prefix_length DESC, total
   precolor distance ASC, provenance ASC)` — no calibration knob to
   tune across functions, target lengths, or mutation libraries. Robust
   across distance distributions in a way the α-weighted combined score
   isn't.

2. **`--rank-combined` deprecated alias** mapping to `--rank-mode combined` for backward compatibility with existing campaign scripts.

3. **`_render_lex_ranking`** added alongside the existing
   `_render_combined_score_ranking`; both pull from a shared
   `_unified_candidates` helper so the buckets they draw from (gate-
   passing + gate-rejected) can never drift between modes. Lex section
   header is "Best by simplify-order then distance"; combined header
   is unchanged ("Best by combined score (alpha=..., top N)").

4. **Default behavior change**: previously, no flag meant "don't render
   any unified ranking section" — the user had to opt into
   `--rank-combined` to see it. Now no flag means "render the lex
   section" (strictly more informative; the lex contract is calibration-
   free so the default is safe across campaigns).

**Why lex first instead of replacing combined entirely:** combined still
expresses a meaningful continuous trade-off ("how much disturbance is N
extra prefix slots worth?") that some users may want to tune per
campaign. Keeping both lets users opt into the continuous score when
they've calibrated α and want fine-grained ordering within a prefix
level, while making the safe-by-default lex contract the default.

**Decision criterion for revisiting:** if a future campaign shows that
the lex-sorted top-N still hides usable candidates (e.g., a prefix=1
candidate with distance=0 would be more actionable than a prefix=2
candidate with distance=500), revisit lex's sort key — possibly add a
tertiary "distance threshold inside same prefix level" stage. So far,
prefix is the dominant signal: anything that hits the target prefix is
worth inspecting first, regardless of disturbance magnitude.

### 2. Wire mismatch-db into heuristic-cause output

The MVP knows three heuristic patterns (`divw`/`mulhwu`, `srawi`/`srwi`,
`volatile`). The hand-curated mismatch-db has dozens. Cross-reference
the asm diff against mismatch-db entries and surface matches inline in
the report. Pairs well with #1 — when input-derived divergence is
broken down per sub-signature, mismatch-db patterns can be matched
against IR-shape changes (not just asm text). Estimated effort: half a
day for first pass; ongoing growth as mismatch-db grows.

### ~~3. Permuter integration (harvest mode)~~ — SHIPPED 2026-05-22

Landed in `88d642cf1` (feat) + `16f954d8e` (warning text fix-up).
`grVenom_80204284` campaign iteration 2 confirmed the signal — 28
existing-primitive variants compiled, 0 progress hits, gate on/off
identical — so the architectural slot was filled directly.

The variant-stream architecture from follow-up #1.5 made this exactly
what was promised: **one new file** (`simplify_variants_permuter.py`)
+ a `--with-permuter` flag, zero changes to `simplify_search.py`. The
"adding permuter = adding a new variant source" guarantee held.

Usage (harvest mode):

```bash
# 1. Run decomp-permuter however you normally would
./permuter.py nonmatchings/grVenom_80204284

# 2. Score its output against the simplify-order target
melee-agent debug mutate simplify-order \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --with-permuter
```

The adapter walks `<perm_root>/nonmatchings/<fn>/output-NNNN-N/source.c`,
yields each as a `SourceVariant`, and feeds them through the existing
gate + scorer pipeline alongside the three primitive adapters. Permuter
candidates byte-identical to primitive-adapter outputs are deduped by
the search driver's cross-source `seen_variant_texts` set.

### ~~3.5. Custom permuter scorer for simplify-order~~ — SHIPPED 2026-05-24

Campaigns 3 (5K candidates default) and 4 (87 candidates soft mutations)
converged on the same finding: combined-score *ranking* surfaces
target-hits, but every target hit disturbs precolor by 77+ edges and
even the cleanest top candidates aren't developer-plausible source
(`if (dst_jobj && dst_jobj)` and similar artifacts). Campaign 4 also
revealed a structural bias: **permuter only saves candidates that
improve its built-in match% scorer**, so candidates that would improve
*our* simplify-order metric without improving match% get filtered out
entirely before we can score them. The harvest pool is systematically
biased against the candidates we want.

The custom scorer eliminates that filter.

**What landed:**

1. **decomp-permuter patch** (local branch `custom-scorer-interface` on
   `/Users/mike/code/decomp-permuter`, commits `81378ff` + `30fec62`):
   adds a `[scorer]` section to settings.toml. When `[scorer].command`
   is set, permuter invokes the command per candidate (passing the
   `.o` path) and reads an integer score from stdout — lower=better,
   `PENALTY_INF` (10⁹) on timeout/failure. When unset, the built-in
   Scorer runs as before (backwards-compatible).

2. **melee-agent `debug target score-simplify-order`** (commit
   `877c8db25` + `c108ed7d3`): the permuter-callable scorer. Takes
   `--function`, `--target` (YAML spec with `function`,
   `simplify_order_target`, `class_id`, `baseline_dump`), positional
   `.o` path. Computes lex score
   `(target_len - common_prefix_length) * 1_000_000 + precolor_distance.total`.
   Outputs integer to stdout.

3. **melee-agent `debug permute setup-simplify-order-scorer`** (commit
   `1de0db610` + `2012fd50c`): user-facing workflow. Resolves the perm
   dir, writes the target.yaml spec, updates settings.toml with the
   `[scorer]` section, **and writes a wrapper compile.sh that sets
   `MWCC_DEBUG_PCDUMP_PATH=<output.o>.pcdump.txt`** so the patched
   mwcc DLL deposits a pcdump sidecar at compile time. The scorer
   reads the sidecar (fast path; no per-iteration recompile).
   Idempotent via a `--force` re-wrap marker.

Usage:

```bash
# 1. One-time per function: wire up the custom scorer
melee-agent debug permute setup-simplify-order-scorer \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/gr/grvenom.txt

# 2. Run permuter as normal — it now saves candidates that improve our score
cd /path/to/decomp-permuter
./permuter.py /path/to/melee/nonmatchings/grVenom_80204284

# 3. (Optional) re-score the output dir with the existing search tool
melee-agent debug mutate simplify-order \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --with-permuter
```

**Why lex encoding (not the α-weighted combined score):** the custom
scorer's job is to *gate which candidates permuter saves*, not to rank
already-saved ones. Lex makes any target-hit always save regardless of
disturbance — gives the campaign a much bigger inspection pool to
range over. The existing `--rank-combined` / `--rank-mode {lex,combined}`
flags on the search tool still apply when post-processing the harvest.

**Important: the patched decomp-permuter is not yet upstream.** The
two commits live on the `custom-scorer-interface` branch in the user's
local clone. Anyone else trying to run `setup-simplify-order-scorer`
needs to either merge that branch into their permuter checkout or
apply the patch manually. See "Deferred technical debt" below for the
upstream-PR items.

**Campaign result (2026-05-24): SOLVED at 100% match.** Custom-scorer
run produced 172 candidates; the winning fix was at
`permuter output-180-1/source.c`, isolated to adding a second `Ground*`
alias for the early xC4 JObj load — category-1 / clean source, exactly
the kind of pattern a developer would write for readability. Committed
in `42f121862 Match grVenom_80204284`.

**How the campaign actually closed (and why it almost didn't):**

The manual translation survey ranked candidates by simplify-order
distance and inspected the top 5 (distances 76, 79, 82, 83, 84). The
winning candidate at output-180 had a higher distance than that top-5
cutoff, so it was never inspected. The survey concluded "Tier-6 /
structurally unsolvable" based on the top-5 sample alone.

`debug permute triage` on the full 172-candidate pool — using
real-tree match% as the metric instead of simplify-order distance —
found the fix in ~20 minutes. The candidate was in the pool the whole
time; we just weren't using the right metric to surface it.

**The methodology lesson (load-bearing for future campaigns):**

The custom scorer's simplify-order ranking is a **search-side proxy
metric** — it determines what permuter saves, but it doesn't reliably
predict real-tree match%. Real-tree match% is the **ground-truth
metric** for "is this candidate the answer?" and there's a separate
tool (`debug permute triage`) that measures it. **Confusing the two
costs campaigns.**

Always run triage after a custom-scorer harvest. See the "Workflow
integration" section above for the canonical two-stage workflow and
the Layer A `--triage` flag that codifies it into the tool.

**What this means for the deferred tooling investments:**

The arguments for source-corpus pattern mining, backwards inference,
and new mutation primitives all rested on the premise that "current
tooling can't find the answer for this class of problem." That premise
was wrong for grVenom — current tooling could find it, we just weren't
using it properly. Those investments are still good ideas but their
*urgency* has dropped significantly. The new bar for justifying any of
them is: "we ran the full two-stage workflow (custom scorer + triage)
on a campaign and triage found no candidate above baseline match%."
Most campaigns won't hit that bar.

The investments below stay on the deferred list but with lower
priority than they had pre-grVenom-closure:

- **Source-corpus pattern mining.** For each stuck function, surface
  patterns from structurally-similar matched functions in the same
  module. ~3-5 days. *Useful when triage finds nothing and we need
  source-shape ideas from the project's idiom library.*

- **New mutation primitives outside permuter's library.** Permuter's
  32 primitives miss bitfield-access patterns, struct-field
  reordering, do/while-vs-while inversions, switch-vs-if-cascade,
  inline/extracted helper boundaries. Each is a focused
  `VariantSource` adapter. ~1 week per family. *Useful when triage
  finds nothing AND source-corpus mining surfaces no nearby pattern.*

- **Backwards inference (Phase 2 from the original mwcc-debug-diff
  spec).** Given target asm + a desired IR property, enumerate source
  structures that would produce both. Multi-week project. *Useful
  when the harder problems exhaust both triage and corpus mining.*

- **Deeper MWCC introspection at the AST→IR pass.** ~1-2 weeks.
  *Diagnostic tool; useful for understanding WHY a candidate works,
  not for finding candidates.*

- **Plausibility-aware candidate classifier.** Per the "Candidate
  plausibility framework" section near the top. ~2-3 days. *Still
  worth doing — improves UX of inspecting candidates regardless of
  whether triage finds them — but no longer load-bearing.*

### 4. Surface RA classification in EARLIEST DIVERGENCE header

Cosmetic but free leverage. Today:

```
EARLIEST DIVERGENCE: AFTER REGISTER COLORING (pass 5 of 5)
```

Should be:

```
EARLIEST DIVERGENCE: AFTER REGISTER COLORING (intrinsic, pass 5 of 5)
```

Ten minutes. Agents skimming output shouldn't have to scroll to learn
whether the RA divergence is intrinsic or input-derived — it changes
the next action.

---

## Deferred technical debt

From the final whole-implementation review on 2026-05-21. None block
the MVP; each is a follow-up candidate.

1. **`coalesced_alias_sections` parsed but never consumed.** Task 1
   added `CoalescedAliasSection` parsing; `diff_report.py` only uses
   the natural `coalesce_sections`. The aliases capture
   post-allocation alias resolution, useful as additional input
   signal but currently unused.
2. ~~**`spilled` bit conflated between input and output signatures.**~~ —
   FIXED 2026-05-21 as part of follow-up #1 (commit `3fc15bc1f`). The
   `flags & 0x01` bit is no longer included in any RA input signature;
   the upstream spilled signal is now read from `SimplifyEntry.spilled`
   via the new `_spill_set` helper.
3. **In-place source staging is concurrent-unsafe.**
   `_source_path_for_compile` writes to `melee_root/src/{unit}.c` for
   outside-repo source variants. Two concurrent `inspect diff` runs
   against the same TU race on the restoration step. Mitigations
   exist (stage into a temp copy of the repo; hold a lockfile under
   `build/`). Spec-acknowledged as MVP-acceptable.
4. **mwcc-inspect reflects committed state, not local edits.**
   `tools/workflow/mwcc-inspect.sh` SSHes to a Windows host that
   `git pull`s from origin. If a user passes a repo file with
   uncommitted edits as input_a, the inspect snapshot describes the
   committed version while the pcdump describes the local edits. The
   "[mwcc-debug] mwcc-inspect snapshot unavailable for one side"
   warning only fires on asymmetry — not on uncommitted-state drift.
5. **Register format in output uses raw tuples.** Per-ig_idx detail
   currently renders as `(31, 0) -> (29, 0)`. Reader has to know
   "first is register, second is flags". Format like `r31 -> r29` or
   `r31 (flags=0x00) -> r29 (flags=0x00)` matches the rest of the
   diff vocabulary. Pure UX.
6. **`label.endswith("coloring output")` is string-coupling.** The
   per-ig_idx expansion path in `_summarize_tuple_diff` dispatches on
   the label suffix. If labels are ever renamed, the expansion
   silently degrades. A kind-enum or dedicated function per RA
   signature component would be more robust. Pairs with follow-up #1.

### From custom-scorer review (2026-05-24)

The 4 melee-agent commits + 2 decomp-permuter commits landed clean but
both code-quality reviews flagged Important items worth fixing in
follow-ups. All are robustness/polish for edge cases; none block the
grVenom_80204284 campaign.

**Decomp-permuter side (blocking an upstream PR, not local use):**

7. **`[scorer]` interface lacks user-facing docs.** README.md and
   `example_settings.toml` aren't updated. An upstream PR reviewer
   will require both, since `[scorer]`, `command`, `timeout_seconds`,
   and the `PERMUTER_*` env vars are now public API.
8. **mypy assignment error on `src/main.py:383`.** The branching `if
   scorer_command:` / `else:` block needs a `scorer: Union[Scorer, CustomCommandScorer]` annotation or upstream CI will fail.
   One-line fix.
9. **`extra_env` constructor parameter is unwired.** `CustomCommandScorer.__init__` accepts it and tests cover it, but
   `main.py` never threads a TOML setting through, so end users can't
   use it. Either wire it via a `[scorer.env]` table or drop the
   parameter. Half-wired public API is the worst of both worlds.

**Melee-agent side (deferrable; local use unaffected):**

10. **`build_spec(merge=True)` silently drops non-`[weight_overrides]`
    settings.toml keys.** If a user has customized `objdump_command`
    or anything else, setup-simplify-order-scorer overwrites it
    silently. Should either preserve those keys or warn loudly.
11. **Non-atomic multi-file write in `setup-simplify-order-scorer`.**
    Writes spec.yaml → settings.toml → compile.sh sequentially with no
    rollback. A partial failure leaves the perm dir in mismatched
    state. `--force` re-run recovers, but consider write-to-temp +
    atomic-rename for safety.
12. **Dead code: `_resolve_candidate_c_source` at `debug.py:6802-6829`.**
    Defined but never called; documented as a future hook for the
    recompile-fallback path that wasn't built. Either wire it up or
    delete.

**Other polish items** from both reviews (lex/PENALTY_INF collision
edge at target_len≥1000, cflags regex misparses if `-o` appears before
`-c`, substring match on baseline-text containing function name, etc.)
are documented in the review transcripts and tracked as minor.

### From grVenom campaign closure (2026-05-24)

The five-iteration grVenom_80204284 campaign exercised every layer of
the toolchain and surfaced two deferred items worth tracking:

13. **TU-context divergence between permuter's flattened base.c and
    the real translation unit.** The campaign survey found that
    outputs 76, 83, 84 reproduced simplify-order improvements in
    permuter's compile environment but NOT when patched into the real
    `grvenom.c`. The flattened base.c that import.py generates has
    different surrounding context (include depth, struct definitions,
    file-local declarations) than the real TU, and that context
    affects allocator decisions. The custom scorer's verdict on a
    candidate isn't reliably predictive of its effect in the real
    integration target. **Mitigation:** the workflow could include a
    real-TU validation step after harvesting permuter candidates, so
    pcdump-level scores are always cross-checked against
    `ninja + checkdiff` on the real source. ~1 day of tooling work.

14. **Plausibility-aware candidate classifier.** Per the "Candidate
    plausibility framework" section near the top of this doc — the
    existing search tool surfaces candidates without distinguishing
    category 1 (clean) from category 2 (unusual-but-narratable) from
    category 3 (clearly synthetic) from category 4 (semantics-changing).
    A future addition would surface a category label and any
    detectable narrative justification per candidate, letting agents
    and developers evaluate against project standards rather than
    auto-rejecting category-2 patterns. Pairs with the broader campaign
    finding that the grVenom survey's initial "Tier-6" classification
    incorrectly dismissed category-2 patterns. ~2-3 days.

15. **Source-corpus pattern mining.** Mentioned in section 3.5 above
    as a future tooling direction; tracking here for visibility. The
    intuition: for any stuck function, the matched functions in the
    same module are training data for "what kind of source does the
    project's idiom space produce this kind of asm with?" Surface
    those patterns when an agent gets stuck. ~3-5 days.

16. **Backwards inference (Phase 2 of original spec).** The original
    spec's deferred Phase 2-5 work. The grVenom campaign is the
    strongest empirical justification we have so far for investing in
    this direction — forward-mutate-and-search definitively hits a
    wall when the answer lives outside the mutation library, and
    backwards reasoning from "we need IR property X" tells you what
    source space to explore. Multi-week project. The cost is high; the
    payoff is solving the entire class of problems grVenom
    represents, not just grVenom itself.

### From ftColl_8007BAC0 validation campaign (2026-05-24/25)

Initial campaign on 2026-05-24 surfaced a target-language gap in the
custom scorer. Fix A (filter `-1` entries from the simplify order
before prefix match) shipped as `5b4bd782f`. Re-validation on
2026-05-25 confirmed Fix A is picked up correctly but also surfaced a
deeper finding: ftColl_8007BAC0 isn't a simplify-order target at all
— it's a **phys-iter target shape**, where the meaningful allocator
decisions only resolve in `COLORGRAPH DECISIONS` (see "Target shape"
under Layer A above). No amount of `-1` filtering can rescue the
simplify-prefix metric for that shape. Fix B remains valid for the
class of cases it was designed for (simplify-order shape, pairwise
constraints); #18 below is the separate scorer mode needed for
phys-iter shape.

17. **Fix B: pairwise/relative-ordering target syntax for the custom
    scorer (`--want-before` or `--want-order`).** Fix A handles the
    common case where the target nodes should sit at the start of the
    meaningful simplify order after filtering placeholders. Fix B
    handles cases where the abstract target is "node X must appear
    before node Y" but with other meaningful nodes potentially
    between them (so neither prefix matching, nor filtered prefix
    matching, captures the intent).

    Concrete shapes considered:
    - `--want-before 37,41`: "ig_idx 37 must appear before ig_idx 41
      somewhere in the (filtered) simplify order"
    - `--want-order 37,41,32`: "37 before 41 before 32" — generalizes
      to chains of pairwise constraints

    Scoring becomes "for each ordered pair (X, Y) in the target,
    measure whether X actually appears before Y; aggregate across
    pairs." More expressive than prefix matching but also more
    complex to score (needs a distance metric that's monotonic in
    "how out of order").

    **When to build:** if a future campaign surfaces a function whose
    abstract target genuinely needs pairwise constraints between
    non-adjacent nodes that Fix A's filtered-prefix can't express.
    grVenom fits filtered-prefix; ftColl turned out not to be a
    simplify-order target at all (see #18) so it doesn't bear on
    whether Fix B is needed. ~2-3 days when triggered.

    **Why captured here:** the design conversation happened during the
    ftColl campaign; durably recording it here so a future agent can
    pick up the design intent without re-deriving it. Compaction-proof
    by virtue of living in this doc rather than session transcripts.

18. **Phys-iter scorer mode for the custom scorer.** The ftColl
    re-validation surfaced a target shape Layer A's current scorer
    can't express at all: cases whose force proof is
    `--force-phys-iter class:iter:phys` and whose meaningful `ig_idx`
    only resolves in `COLORGRAPH DECISIONS`. For these, the
    `SIMPLIFY GRAPH` stream is dominated by `-1` for the relevant
    decisions; Fix A's filtering empties the stream entirely. Fix B's
    pairwise simplify-order syntax doesn't help either — both Fix A
    and Fix B are variants on the same simplify-order metric.

    Sketch: a parallel scorer mode that reads `COLORGRAPH DECISIONS`
    instead of `SIMPLIFY GRAPH`. Target syntax probably mirrors the
    force flag: `--want-phys-iter 0:13:31,0:9:30` ("class 0 iter 13
    should bind r31; iter 9 should bind r30"). Distance metric would
    be sum-of-Hamming over the (iter → assigned phys) mapping
    against target.

    **When to build:** when a second phys-iter-shape function appears
    that we genuinely need to match. ftColl is canonical but
    currently the only example, and the force proof there already
    matches at 100% — the question is whether a real C-source change
    can reach that allocation, which is a separate (untested) layer
    of difficulty. Don't build #18 speculatively from one example.
    ~1 week when triggered.

    **Why captured here:** the distinction between Fix A/B (variants
    on simplify-order shape) and #18 (different target shape
    entirely) was learned the hard way; recording it durably so a
    future agent doesn't conflate the two and try to "extend Fix B"
    for a phys-iter case.

### From gm_80173EEC validation campaign (2026-05-26/27)

Second Layer A validation campaign on `gm_80173EEC` closed as outcome
category 2 (PARTIAL) on 2026-05-26 and was re-validated on 2026-05-27
after Phase 2 of the target-shape extensions landed. Phase 2 shipped
the coalesce-preservation constraint (#19 below); the re-validation
campaign confirmed the constraint works correctly but `gm_80173EEC`
remains unreachable from decomp-permuter's current mutation
neighborhood.

**Initial campaign (2026-05-26):** Layer A's workflow successfully
biased search toward the target simplify-order prefix `[34, 37, 32]`
(33 / 500 candidates hit prefix-3/3) but did not produce a 100%
match. The closing diagnostic on `output-139-1` revealed why:
mutations that satisfy the prefix simultaneously trigger MWCC's
natural coalescer to fold `ig_idx 42` and `38` into root virtual `3`,
removing them from the allocator graph. The full 6-element force
proof presupposes those 6 `ig_idx` values remain independent, which
the prefix-hit candidates structurally cannot satisfy.

**Empirical sub-experiment (2026-05-26, commit `93e64a3de`):** the
existing 500-candidate pool was statically analyzed for coalesce
preservation. Result: 322 / 500 candidates preserve all 6 force-phys
ig_idx as independent nodes; the prefix-3/3 hits were all in the
non-preserved 178. Top match% candidates (99.33%) are all in the
preserved-6/6 set. This justified building the constraint (Outcome B
in the sub-experiment's decision tree).

**Phase 2 re-validation campaign (2026-05-27, commit `264244d41`):**
re-ran the gm permuter for 273,283 iterations with the
coalesce-preservation constraint enabled. The constraint correctly
rejected the prefix-3/3 path entirely (those were the coalescing
candidates); best simplify prefix dropped to 1/3. Real-tree match%
ceiling stayed at 99.33% — same as the prior pool. Outcome: NO
PROGRESS, but with a sharper interpretation: `gm_80173EEC`'s match
neighborhood is genuinely exhausted by decomp-permuter's current
mutation library, both with and without coalescing-via-r3. The
function is a known unreachable ceiling for current permuter
mutations.

The workflow itself was validated three times — search finds
direction, triage exposes ground truth, the constraint correctly
redirects search away from structurally-infeasible candidates. The
underlying matching difficulty is a property of the mutation library,
not the scoring.

### ~~19. Coalesce-preservation constraint in the custom scorer~~ — SHIPPED 2026-05-26/27

Phase 2 of the target-shape extensions. The constraint adds a hard
reject to the simplify-order scorer for candidates where any
`force_phys`-key `ig_idx` has been coalesced into another root
virtual in the candidate's class-N natural coalesce mappings. When
triggered, the scorer returns `STRUCTURAL_REJECTION_SCORE = LEX_BIG *
1000` which dominates any normal score and drives permuter to
discard the candidate.

Surface area:

- Optional `coalesce_preservation: bool = True` field on
  `SimplifyOrderTargetSpec` (default-on when `force_phys` is
  non-empty)
- `--no-coalesce-preservation` opt-out flag on
  `setup-simplify-order-scorer`
- `Coalesce preservation:` line in `score-simplify-order --breakdown`
  showing one of `ALL TARGETS INDEPENDENT` / `REJECTED [ig_idx, ...]`
  / `DISABLED`

Validated end-to-end on `gm_80173EEC` (outcome NO PROGRESS — see
campaign details above — the constraint correctly redirects search
away from coalescing candidates, but the productive neighborhood
remains unable to close the gap). Implementation across commits
`d8cc8d442..0f31f51bf` plus the Task 3 fix-up at `30b07a66a` that
wired the constraint through to the production CLI. Plan:
`docs/superpowers/plans/2026-05-26-mwcc-debug-coalesce-preservation-build.md`.

**Empirical takeaway for future stuck-function work:** gm-style
coalescing-dependent functions where the force-phys mapping
presupposes 6+ independent virtuals may be intrinsically out of
reach for decomp-permuter, not because of scorer expressivity but
because mutations that produce the target simplify-order shape ALSO
destroy the allocator-graph structure the target presupposes. The
constraint correctly identifies this; matching such functions likely
requires a different approach (deeper-than-mutation-library tooling
per item #16's backwards inference, or new mutation primitives
beyond permuter's library).

### From lbDvd_80018A2C validation campaign (2026-05-26/27)

Third Layer A validation campaign on `lbDvd_80018A2C` ran twice:
- **2026-05-26:** with the original `--want-first 46,44` (wrong polarity
  for the high-volatile r10/r12 targets), closed as NO PROGRESS — see
  Phase 1's polarity check (#20 partial), which now warns the screening
  agent when this misconfiguration is set.
- **2026-05-27:** with the correct `--want-late 46,44` after Phase 3
  shipped the full late-target syntax, also closed as NO PROGRESS — but
  with a starker finding than gm.

**Phase 3 re-validation campaign (2026-05-27, commit `9c15dfa75`):**
re-ran lbDvd with `--want-late 46,44` for 275,101 iterations. Polarity
check stayed SAFE under `--strict-polarity` (Phase 3's classifier
extension working correctly). Result: **zero saved outputs.** Not a
single candidate moved ig_idx 46 or 44 toward the END of simplify
order — not even suffix-1/2 progress. The late-target scorer is
functioning (Step 0 pre-flight confirmed it CAN be expressed), but
permuter's mutation library cannot produce candidates that shape the
allocator's late-position decisions for these specific virtuals.

This is a stronger negative result than gm's. gm's mutations could
produce target-shaped candidates (322/500 preserve-6/6), they just
didn't close to 100%. lbDvd's mutations can't even produce the target
shape — the search neighborhood structurally doesn't include
late-positioning of 46/44 under any of permuter's source
transformations.

### ~~20. Late-target syntax for the custom scorer (`--want-late`)~~ — SHIPPED 2026-05-27 (partial) / NO PROGRESS on lbDvd

Phase 1 shipped the pre-flight polarity check (the screening warning
piece). Phase 3 shipped the full late-target syntax:

- New `simplify_order_target_late: tuple[int, ...]` field on
  `SimplifyOrderTargetSpec`, mutually exclusive with the front-target
- `common_suffix_length` helper + late-mode branch in
  `compute_lex_score` (suffix-matching parallel to the existing
  prefix-matching)
- `classify_polarity` extended with `target_position: Literal["first",
  "late"]` — high-volatile (r10-r12) is SAFE for late mode; top
  non-volatile (r28-r31) or r3 is WRONG_POLARITY
- `--want-late N,M` on `setup-simplify-order-scorer` (mutually
  exclusive with `--want-first`)
- `--want-late` on `debug mutate simplify-order` (commit `4dcead76d`,
  closes issue #87)
- `--breakdown` renders `Target suffix:` / `Observed suffix:` /
  `Common suffix:` in late mode; polarity hints recommend the correct
  alternative flag instead of "future work"

Implementation across commits `9dd5b595d..4dcead76d`. Plan:
`docs/superpowers/plans/2026-05-27-mwcc-debug-late-target-scorer.md`.

The `--want-after PRECEDING,TARGETS` syntax (more general
relative-ordering) was sketched in Phase 3's plan but **not built** —
the simpler `--want-late N,M` was sufficient for the lbDvd validation
and the more complex syntax can be added later if a real function
needs it.

**Empirical takeaway for future stuck-function work:** lbDvd's
Phase 3 result, taken together with gm's Phase 2 result, suggests
that for the class of functions currently stuck at 99.x%, scoring
sophistication alone does not unlock matches. The bottleneck is
permuter's mutation library, not the scorer's expressivity. Both gm
and lbDvd had correctly-encoded targets that the search could not
produce candidates for. Future leverage likely comes from item #16
(backwards inference or new mutation primitives), not from more
scoring refinements.

---

## Signals to watch for in agent usage

The phase ladder above is the right shape *if* the MVP's framing turns
out to be useful in practice. Some questions can only be answered by
putting the tool in front of real matching work:

- **Do agents reach for `inspect diff` at all?** If they keep going to
  asm-diff first by habit, the entry-point UX or the SKILL.md framing
  needs work. If they reach for it but only on specific kinds of stuck
  functions, that tells us the actual use case.
- ~~**Is "allocator input differs" too coarse?** Top prediction for the
  first painful gap. Strong signal in favor of follow-up #1.~~ — CONFIRMED
  by the grVenom campaign on 2026-05-22. Follow-up #1 shipped; #1.5
  (simplify-order search) shipped as the next layer of leverage.
- **Are the heuristic causes firing on real cases?** If three patterns
  never match anything in practice, the heuristic-cause feature is
  inert and either needs expansion (follow-up #2) or removal.
- **What's the cycle time?** Pcdump comparisons should be <2s. Cycle
  times >10s suggest either mwcc-inspect (the SSH path) is in use,
  which means the use case is in-repo-source vs in-repo-source — a
  category that may or may not be common.
- **Does the intrinsic/input-derived split actually change agent
  behavior?** If agents see "intrinsic" and still spend cycles on C
  source changes, the report needs to be louder about the implication.
- **Does the agent ever attempt to use the tool against a target asm
  (which the MVP can't do)?** If so, that's the strongest signal that
  Phase 2 (backwards inference for at least one pass) is the right
  investment.

The right next move depends on which of these signals show up. Investing
in Phase 2 without first confirming the MVP framing works for agents
risks building on a workflow that doesn't deliver value.

---

## When this doc gets revisited

Update when any of the following happens:

- A follow-up from the ranked list lands → strike it through, link to
  commit / spec
- An agent-usage signal above resolves (positive or negative) → annotate
  the signal with what was observed
- A phase from the ladder ships → move to "Recently shipped baseline"
  in a successor doc
- The spec gets new revisions → reconcile, especially Future Phases
  section

The intent is for this doc to be a living memo, not a one-shot artifact.
