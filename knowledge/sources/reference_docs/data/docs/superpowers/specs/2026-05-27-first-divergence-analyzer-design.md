# First-Divergence Analyzer — Design Spec

Date: 2026-05-27 (revised 2026-05-28 after review)
Status: DRAFT — revised against review findings; still pre-task-planning.

**Review corrections (2026-05-28).** A review of the first draft caught
six issues, all incorporated above: (P1) the grVenom acceptance gate
targeted a force-proof *proxy* coloring the winning source didn't
actually produce — fixed by using the matched-commit pcdump as the full
target; (P1) `workingMask` must be reconstructed by *replaying* prior
decisions because MWCC reuses dispensed callee-saves — fixed in Step 2;
(P1) partial force-phys maps find the first *mapped* not first *causal*
divergence — fixed by preferring a full coloring + the Case A dependency
sub-case; (P2) interference data comes from colorgraph interferer rows,
not `IG CONSTRUCTED` — fixed in Inputs, plus Case D for coalesced-away
nodes; (P2) the symbol bridge is heuristic — fixed to expose
confidence + alternates; (P2) cycling doesn't prove mutual exclusivity —
fixed to require a fixed-IR constraint check (open question #5).

A **second independent review** (also of the first draft) converged on
the same P1/P2 set and added: a fuller case taxonomy (spill, B-inverse,
the C2 sticky-pool dispense-count case, per-class pools, pair-register
flags); the cross-compile identity problem is deeper than alignment —
raw ig_idx *lies* after source edits (gm's r37→r92), so v2 needs a
**role-descriptor** identity layer (open question #1); and an explicit
**v1/v2 scope split** with resequenced validation (v1 = same-source
constraint explainer, gated by Check 1 + Check 2 on gm/lbDvd; v2 =
convergence, gated on the identity layer; matched-source/grVenom move to
v2). All incorporated below.

A **third review** (consistency/completeness pass over the twice-edited
draft) caught: (P1) Case D was unreachable from the Step 1 walk — fixed
with a Step 1a target-identity pre-pass so coalesced/spilled target
nodes are detected before register-choice analysis (gm's failure mode is
Case D, so v1 Check 2 depends on this); (P1) the v1 target input was
inconsistent across sections — pinned to same-source force-proof only,
matched-pcdump explicitly v2; (P1) v1 gates didn't cover the
source-hypothesis output — split the report into a gated allocator-fact
layer and an advisory non-gated source-idea layer, with the gates
covering only the former; (P2) Step 3 only derived targets for A/B/C —
completed for D/E/B-inverse/C2/absent; (P2) the open-questions header
contradicted "v1 is unblocked" — reclassified by what each question
actually gates (v1: none). Plus the advisory: Check 1's fixture must
exercise callee-save dispense+reuse or it won't validate C2. All
incorporated.

A **fourth review** (critical-thinking + consistency pass) caught: (P1)
Check 1 gated replay against `debug inspect simulate`, but the simulator
itself approximates iteration order and has known modeling gaps — it is
not a per-iteration oracle; fixed by gating replay against the actual
recorded `COLORGRAPH DECISIONS` (ground truth from the real compile),
with an exact colorgraph-replay `simulate` mode as a possible second
oracle only if built. (P1) Case D could vanish if the target node set
were read from the forced *pcdump* (coalesced-away nodes are absent there
too) — fixed by defining the target identity set as the force-phys map
*keys*, with the dump as supporting data for surviving nodes only. (P1)
Check 2 asked for gm's full multi-decision manual narrative, which a
one-divergence tool cannot emit in one shot — narrowed Check 2 to the
*first-divergence* allocator fact (gm: Case D 42/38 + prevent-the-
coalesce); the fuller narrative emerges across the iterative loop, and a
multi-target constraint-summary mode is an explicit non-goal for v1. (P2)
workingMask replay under-specified: precolored/fixed physical interferers
must block from iteration 0 (not only once processed), and capped
interferer rows must fail closed (or require uncapped dumps) rather than
silently under-counting blockers. (P2) one v1/v2 scope contradiction
remained ("force-proof or matched pcdump" in the v1 scope) — narrowed to
same-source force-proof / target map only. All incorporated.

The concrete first build of the directed backward-inference approach
(`docs/superpowers/specs/2026-05-27-mwcc-backward-inference-design.md`).
Where that doc framed the meet-in-the-middle architecture, this spec
defines the specific tool that operationalizes it: read the *tell* out
of the allocator IR and emit one directed structural hypothesis per
step, instead of blind mutation or passive whole-constraint explanation.

---

## Why this tool, why now

Every other path is exhausted or ruled out:
- Scoring sophistication (Phases 1-3): 0 new matches.
- Blind permuter search: fails on coupled/simultaneous-blocker functions
  (gm 0-progress, lbDvd 0-output).
- Quick-win harvest: ~3 matches, well dry (pass 2 was 0/6).
- Whole-constraint explanation: located gm's gap but gave no lever.

What has *never* been tried: a **directed** approach that finds the
single earliest allocator decision diverging from target, explains it
mechanically from the known algorithm, and turns it into a targeted
source idea. That's the gap this fills. It is the "poke a tell out of
the compiler to generate structural ideas / permute more efficiently"
capability, made concrete.

This is explicitly **not** a "ceiling detector." There are no functions
we refuse to attempt; there are only tells we haven't read yet. The tool
exists to read them.

---

## What it does (one directed hypothesis per step)

Given a function's baseline compile (wrong coloring) and a target
coloring (the force-phys mapping known to match), the analyzer:

1. Finds the **earliest** allocator decision where baseline diverges
   from target.
2. Explains **why** the allocator chose differently, mechanically, from
   MWCC's verified algorithm.
3. Derives the **local** structural change (interference or
   processing-order) that would flip just that decision.
4. **Maps it to source** via the symbol bridge (ig_idx → virtual →
   variable).
5. Emits a ranked, directed hypothesis: "change X this way."

The agent (or, later, a biased permuter) applies the hypothesis,
recompiles, and re-runs the analyzer for the new first divergence. It is
an iterative, directed climb — not a blind search and not a one-shot
oracle.

---

## The algorithm (precise)

### Inputs
- **Baseline pcdump:** `debug dump local <source> -f FN` → the natural
  `COLORGRAPH DECISIONS` (per class: iter → ig_idx → assigned phys),
  including the per-decision **interferer rows** (the usable adjacency
  data; the `IG CONSTRUCTED` hook only logs construction, so interference
  must be read from the colorgraph interferer rows — note these are
  capped and exclude coalesced-away nodes, see Case D), plus the
  `SIMPLIFY GRAPH` ordering.
- **Target coloring — v1 is SAME-SOURCE force-proof ONLY.** To keep v1
  free of the cross-compile identity layer, the v1 target is the
  function's own force-proof applied to the *same* baseline source.
  Baseline and target then share the interference graph and processing
  order, so virtual identity is exact.
  - **The target identity set is the force-phys map *keys*, not the
    forced pcdump's surviving nodes.** This is load-bearing for Case D: a
    node that coalesces away is absent from the *forced* dump too (forcing
    a physical register doesn't un-coalesce it), so if the target node set
    were read from the forced dump, Step 1a could never notice the node is
    missing. The force-phys map keys name the nodes the explanation is
    *about* (gm's force-proof names ig_idx 42/38), independent of whether
    they survive coalescing. The forced dump is *supporting data* for the
    nodes that did survive (their target physical registers) — not the
    source of the identity set.
  - **Caveat (carried, accepted for v1):** the force-phys map is
    *partial* (only the forced nodes), so Step 1 finds the first
    *mapped* divergence, not necessarily the first *causal* one. For the
    v1 gate functions (gm, lbDvd) the force-proof covers the target
    nodes the explanation is about, so this is acceptable. The tool
    still flags "an earlier unmapped node may dominate."
  - **Matched-commit pcdump as a full natural target is v2.** It would
    resolve the partial-map weakness, but it's a *different compile* —
    aligning its virtuals to baseline needs the role-descriptor identity
    layer (open question #1). grVenom illustrates why this can't sneak
    into v1: its winning `cur_gp` fix matched while producing simplify
    order `[39, 32]`, not the `[42, 32]` force-proof, so matched-source
    validation inherently needs the identity machinery.

### Step 1 — find the first divergence

**Step 1a — target-identity pre-pass (run BEFORE the register-choice
walk).** The register-choice walk can only compare nodes that *exist* in
baseline's colorgraph. So first, for each target node, confirm it
appears as an independent node in baseline. A target node that is
*absent* — coalesced into another root (**Case D**) or spilled (**Case
E**) — will never surface in the walk, yet it is the divergence. This
pre-pass is what makes Case D/E reachable, and it's not optional: gm's
entire failure mode is Case D (ig_idx 42/38 coalesced away), so without
this pre-pass the analyzer cannot reproduce gm's explanation and would
fail its own v1 Check 2. If a target node is absent, report it as the
divergence (Case D/E) and stop — no register-choice analysis applies to
a node that isn't there.

**Step 1b — register-choice walk (only for target nodes that survived
1a).** Walk the baseline's `COLORGRAPH DECISIONS` for the target class in
processing (iter) order; compare `phys_baseline` to `phys_target` per
ig_idx. The **first** ig_idx (lowest iter) where they differ is the
candidate divergence point `X`.

**Partial-target caveat (why a full coloring matters).** If the target
is a *partial* force-phys map, this finds the first *mapped* divergence,
which is NOT necessarily the first *causal* one: an earlier untargeted
node may be the real blocker that must recolor before `X` can change.
With a full natural target coloring (input priority 1) the first
divergence IS the first causal one. With a partial map, the tool must
flag that an earlier unmapped node may dominate, and Case A must allow
"recolor the blocker first" as a dependency (see below).

(Baseline and a *same-source forced* target share interference graph and
processing order — alignment by iter is exact. A *matched-source* target
is a different compile, so its ig_idx numbering differs from baseline;
correspondence needs the symbol bridge — open question #1. The
fixed-source smoke test below deliberately avoids this so it can
validate the replay logic in isolation.)

### Step 2 — explain why, mechanically
At `X`'s iteration, reconstruct the allocator state — **by replaying all
prior decisions in order**, not from a static formula. This is critical:
MWCC adds each dispensed callee-save back into the volatile pool for
later reuse (see `docs/mwcc-allocator-algorithm.md`), so the available
register set *evolves* as allocation proceeds.

- `interferers(X)` from `X`'s colorgraph interferer rows. The dump caps
  rows at a fixed length, which only loses data when a node's true degree
  *exceeds* the cap. **When `X`'s row hit the cap (logged degree ==
  cap, so the real interferer set may be larger), fail closed** — refuse
  to classify `X` rather than compute a `workingMask` from a possibly
  incomplete blocker set, because an under-counted interferer set makes a
  blocked register look free and silently misclassifies Case A as Case
  B/C. (Rows below the cap are complete and safe to use; this is distinct
  from the intended exclusion of coalesced-away nodes, which Step 1a/Case
  D handles.) The cleaner fix is extending the hook to emit uncapped
  rows; until then, detect the cap-hit and abstain for that node.
- **Precolored / fixed physical interferers block from iteration 0.**
  Some interferers are pinned to a physical register independent of
  processing order (ABI-fixed nodes: argument registers r3–r10, return
  r3, sp/r1, and any precolored virtual). These must be subtracted from
  `workingMask(X)` from the start — they are *not* contingent on having
  been "processed yet." Maintain them as a separate fixed-blocker set,
  distinct from the replayed already-processed virtuals.
- Replay decisions iter 0..N-1, maintaining `volatile_pool` =
  {r3..r12} ∪ {callee-saves dispensed so far}.
- `assigned_before(X)` = the physical each already-processed *virtual*
  interferer holds (from the replay), unioned with the fixed-blocker set
  above.
- `workingMask(X)` = `volatile_pool(at X)` minus
  `{assigned_before(X)}`.

**A static caller-save-only mask is wrong for any decision after the
first nonvolatile dispense** — it would misclassify reused-callee-save
cases as Case C and miss the r28/r29-reuse constraints that gm depends
on. The replay is mandatory, and the fixed-source smoke test (below)
exists specifically to validate it against the **actual recorded
`COLORGRAPH DECISIONS`** — the ground truth from the real compile — not
against `debug inspect simulate`, which approximates iteration order and
so can't serve as a per-iteration oracle (see Check 1).

Then classify against MWCC's dispense rule (lowest-set-bit of
workingMask; else `obtain_nonvolatile_register` top-down from r31):

- **Case A — target register is blocked.** `r_target` is held by an
  interferer `Y` of `X` (so it's masked out of `workingMask(X)`).
  Baseline picked the next-available register instead. → The blocker is
  the `X`–`Y` interference. **Dependency sub-case:** if `Y` is itself
  mis-colored (its own assignment diverges from target), the real lever
  is "recolor `Y` first" — `X`'s divergence is downstream of `Y`'s. With
  a full target coloring this is detectable (check whether `Y` is
  on-target); with a partial map it may be invisible, so flag it.
- **Case B — target register is higher than the natural pick.**
  `r_target ∈ workingMask(X)` but `r_baseline < r_target` (lowest-bit
  rule took the lower one). To land on `r_target`, the registers below
  it must be unavailable when `X` is processed. → Need more interference
  with low-register holders, or a later processing position for `X`.
- **Case C — non-volatile dispense order.** `workingMask(X)` is empty;
  `X` got a callee-save via top-down dispense, and the order put
  `r_baseline` before `r_target`. → `X`'s processing/simplify-order
  position is the lever.
- **Case D — target node coalesced away.** `X` doesn't appear as an
  independent node in baseline's colorgraph at all — it was coalesced
  into another root (the gm failure mode). First-class outcome, not an
  error: the lever is "prevent the coalesce that merges `X`" (ties
  directly to the Phase 2 coalesce-preservation work).

The A/B/C/D split is a first pass; a correct analyzer needs a fuller
taxonomy. **Structural preconditions** (check before register-choice
analysis — the node may not be a comparable independent node at all):
- **D (coalesced):** above.
- **E — spilled:** `X` is on the spill list (SPILLED in `SIMPLIFY
  GRAPH`); it didn't get a register at all. Lever: reduce its degree.
- **absent (pair/class):** `X` is half of a register pair, or lives in a
  different register class than assumed — handle per-class, and treat
  pair-register flags as constraints on availability.

**Register-choice divergences** (node is independent; got the wrong
register):
- **A — blocked:** above (`r_target` held by an interferer).
- **B — target higher than the lowest-bit pick:** above.
- **B-inverse — target LOWER than baseline's pick:** baseline assigned a
  *higher* register than target; usually means `X` carried too much
  interference or was processed too late. Lever: reduce interference /
  process earlier.
- **C — nonvolatile dispense order:** above (`workingMask` empty,
  top-down dispense).
- **C2 — sticky-pool dispense-count mismatch:** `r_target` is a
  callee-save that, in the target, had already been dispensed-and-
  returned to the volatile pool by `X`'s iteration, but in baseline
  fewer nonvolatiles were dispensed before `X`, so it isn't in the pool
  yet. This is *only* detectable with the replaying volatile-pool model
  (Step 2) — a static mask misses it entirely. Lever: change how many
  nonvolatiles dispense before `X` (processing order upstream).

**Cross-cutting:** every case is per-register-class (GPR class 0 vs FPR
class 1 have independent pools); pair-register flags modify
availability. The analyzer runs the analysis within the target's class.

### Step 3 — derive the local structural target
Structural-precondition cases (from 1a) take priority — a node must
exist before its register can be discussed:
- **Case D (coalesced)** → "prevent the coalesce that merges `X` into its
  root" (shorten/separate the live ranges that let MWCC merge them; ties
  to Phase 2 coalesce-preservation).
- **Case E (spilled)** → "reduce `X`'s interference degree so it colors
  cleanly" (shrink live range / split the variable).
- **absent (pair/class)** → report the structural mismatch directly
  (wrong class, or pair-register constraint); no single local lever —
  this is a "the PCode shape differs" lead, surfaced as such.

Register-choice cases (from 1b):
- **Case A** → "eliminate the `X`–`Y` interference" (shorten one live
  range so they don't overlap) **or** "process `X` before `Y`." If the
  Case A dependency sub-case fired (`Y` itself mis-colored), the lever is
  "recolor `Y` first" — surface `Y` as the upstream target.
- **Case B** → "introduce interference between `X` and the holders of the
  registers below `r_target`" **or** "move `X` later in simplify order."
- **Case B-inverse** → "reduce `X`'s interference, or process `X`
  earlier" so it isn't pushed to a higher register than target.
- **Case C** → "shift `X`'s simplify-order position so dispense reaches
  `r_target`."
- **Case C2** → "change how many nonvolatiles dispense before `X`"
  (adjust the processing order of the *upstream* virtuals that populate
  the sticky volatile pool), so `r_target` is in the pool by `X`'s turn.

These are narrow, single-decision targets — not "produce the whole
6-node coloring."

### Step 4 — map to source
Use the symbol bridge: `virtual-to-var X` → variable `V`,
`virtual-to-var Y` → variable `W`, `trace-copy` for copy lineage. Turn
the local target into a source-level idea:
- "shorten `W`'s live range so it doesn't span `V`'s definition"
- "move `V`'s definition earlier"
- "introduce a use of `V` after `W` to extend overlap"
- etc.

Both the variable identity AND the edit are heuristic. `virtual-to-var`
is best-guess, especially across nested scopes (see
`docs/superpowers/specs/2026-05-20-nested-block-local-awareness-design.md`).
The report must therefore expose **confidence + ranked alternates** for
each ig_idx → variable mapping, not present a single "reliable"
variable. The agent applies judgment over the alternates; the tool does
not assert certainty it doesn't have.

### Step 5 — emit the hypothesis
A structured report:
```
First divergence: class 0, iter N, ig_idx X (var V)
  baseline: X -> r_baseline
  target:   X -> r_target
  cause: Case A — r_target held by interferer Y (ig_idx Y, var W)
  local target: eliminate X-Y interference, or process X before Y
  source ideas (ranked):
    1. shorten W's live range past V's def  [var W = <source location>]
    2. reorder declarations so V precedes W
    ...
```

**Two output layers with different trust levels.** The report has a
*gated* layer and an *advisory* layer, and they must be visually
distinct:
- **Allocator-fact layer (gated, rigorous):** first divergence, cause
  case, local target, interferer/pool state. These are mechanically
  derived from the pcdump + replay and are what the v1 acceptance gates
  validate.
- **Source-idea layer (advisory, NON-gated):** the `var V`/`var W`
  mappings and ranked source edits. These ride on the heuristic symbol
  bridge, so they are explicitly best-effort — emitted with confidence +
  alternates, never asserted as correct. v1 does **not** gate on them
  (see milestone); they're only rigorously validated downstream when v2's
  convergence loop actually uses a hypothesis to produce a match. An
  implementation must not be considered failing v1 because a source idea
  was wrong, nor passing because one happened to be right.

---

## The iterative loop and the coupling problem

The coupling we saw on gm (fix one decision, break another) is handled
by *always reporting the current first divergence*:

1. Run analyzer → hypothesis for divergence #1.
2. Apply, recompile, re-run analyzer.
3. Either: first divergence moved *later* (progress) → repeat; or a
   *new earlier* divergence appeared (the fix perturbed an upstream
   decision) → analyze that; or match achieved.

If hypotheses *cycle* (fixing A reintroduces B reintroduces A), that is a
signal worth surfacing — but it does **not** by itself prove the
decisions are mutually exclusive. A cycle can equally come from: a
partial target map (chasing the wrong divergence), bad cross-compile
virtual alignment, a wrong symbol-bridge mapping, or an edit that's
non-local in effect. To actually *claim* mutual exclusivity you need a
fixed-IR constraint check — show that no coloring of the (fixed)
interference graph satisfies both target assignments simultaneously —
not just that repeated heuristic edits failed to converge. Until that
check exists, report a cycle as "did not converge; possible causes:
[mutual exclusivity | partial target | alignment | mapping]," not as a
proof. That's still a lead, not a ceiling.

---

## Validation — three checks; v1 needs only the first two

The second review sharpened the sequencing: the matched-source fixture
secretly *requires* the unbuilt cross-compile identity layer (a v2
prerequisite), so it can't be an early v1 gate. The early gates must be
*same-source*, where identity is trivial. Order:

**Check 1 — fixed-source replay smoke test (validates allocator-state
replay).** On a single fixed source, replay the colorgraph decisions
closed-loop (maintaining `volatile_pool`/`workingMask` from the model's
own running state) and confirm that, at every iteration, the register the
dispense rule predicts matches the physical register actually recorded in
that same pcdump's `COLORGRAPH DECISIONS`. The oracle is the **actual
recorded coloring** — ground truth from the real compile — **not** `debug
inspect simulate`: the simulator approximates iteration order and has
known modeling gaps, so gating replay against it would validate one
approximation against another. (An exact colorgraph-replay mode could
later be added to `simulate` as a second oracle, but the recorded
`COLORGRAPH DECISIONS` is primary and needs no new code.) `workingMask`
is validated indirectly but soundly: a pool/mask bug surfaces as a
mispredicted assignment at the first reuse point — which is exactly why
the fixture must exercise callee-save dispense+reuse (below). No
alignment, no target ambiguity. Gate for the P1 workingMask correction.
**Must pass first** — don't trust any classification until replay
reproduces the recorded coloring.

**Fixture constraint (don't pick a trivial one):** the Check 1 function
MUST exercise callee-save **dispense and reuse** — i.e., enough class-0
virtuals that the allocator exhausts the volatile pool, dispenses
nonvolatiles top-down, and later reuses a dispensed callee-save for a
non-interfering virtual. A small function that never dispenses a
nonvolatile would pass replay trivially without validating the C2
sticky-pool behavior, which is the whole point of the replay. gm
qualifies (it has the dispense/reuse pattern); name a specific
dispense-and-reuse fixture in the plan rather than "any fixed source."

**Check 2 — same-source first-divergence reproduction (validates the
tell).** On gm and lbDvd, run the analyzer with the function's own
force-proof as target (baseline vs forced-*same-source* → identity is
trivial, no cross-compile machinery). Does it mechanically reproduce the
**first-divergence allocator fact** for each — the single earliest
diverging decision, its cause case, and its local target?
- **gm:** Case D — target node 42 (and 38) coalesced away; local target
  "prevent the coalesce." This is gm's *first* divergence; the analyzer
  reports it and stops (Step 1a).
- **lbDvd:** its first-divergence register-choice fact (the
  wrong-polarity r4/r5 decision), classified as the appropriate
  register-choice case (B / B-inverse) with its local target.

**What Check 2 does NOT require: the full multi-decision manual
narrative.** The hand analysis in
`docs/mwcc-backward-inference-validation-2026-05-27.md` derived gm's
*complete* story (joint identity + nonvolatile-dispense + r28-reuse) by
walking several decisions. A one-divergence tool cannot emit that in a
single shot, and isn't expected to: the later constraints surface across
the iterative loop (fix the coalesce → re-run → the next divergence
appears). A multi-target constraint-summary mode that emits the whole
story at once is an explicit **non-goal for v1** (a possible v2+
enhancement). Check 2 validates the *first* divergence only — the unit
the tool is designed to emit. This is the v1 acceptance gate, and it
matches the PARTIAL recommendation in the backward-inference validation
doc, reproduced *mechanically*, one divergence at a time.

**Scope of what Checks 1+2 validate:** the *allocator-fact layer* —
replay correctness and mechanical explanation (first divergence, cause
case, local target). They deliberately do **not** gate the *source-idea
layer* (the symbol-bridge var mappings and ranked edits), because that
layer is heuristic and can't be rigorously validated same-source.
Concretely: the analyzer passes v1 if it correctly identifies gm's Case
D (42/38 coalesced) and the local target "prevent the coalesce" — even
if the *source idea* it attaches (which variable to edit, how) is
imperfect. The source layer is emitted as advisory output (confidence +
alternates) and is only truly tested when v2 uses a hypothesis to drive
a match. Don't over- or under-credit v1 based on source-idea quality.

**Check 3 — matched-source fixture (V2, DEFERRED).** Using a solved
function's matched-commit pcdump as the full target coloring requires
corresponding virtuals across two different compiles — the
role-descriptor identity layer (open question #1). Defer until that
layer exists. grVenom belongs here, not in the v1 gates: its winning
source produced `[39, 32]`, not the `[42, 32]` force-proof, so any
matched-source validation needs the identity machinery to align the two.

**Live convergence test (gm), V2:** the iterative "fix → re-run → did it
move later?" loop is also v2 — it needs cross-compile identity to know
whether progress is real (raw ig_idx lies). Until then, non-convergence
is reported with candidate causes, escalated to "mutually exclusive"
only if the fixed-IR constraint check (open question #5) confirms it.

---

## Open questions — classified by what they gate

**None of these block the v1 build.** The earlier "resolve before task
planning" framing was too broad; here's the actual split:

- **v1 blockers: none.** Both v1 gates are same-source (Check 1 replay,
  Check 2 gm/lbDvd explanation), so the hard items below don't apply.
  v1 can be task-planned now.
- **Resolved-inside-v1:** #2 (case completeness) is settled empirically
  by Check 2 — if the analyzer reproduces gm's (Case D) and lbDvd's
  explanations, the taxonomy is sufficient for them; any gap shows up as
  an explanation that won't reproduce.
- **v2 prerequisites:** #1 (cross-compile role identity) gates the
  convergence loop and matched-source validation.
- **Follow-on (not blocking either):** #3 (source-mapping reliability —
  advisory in v1 anyway), #4 (convergence behavior — a v2 question), #5
  (fixed-IR constraint check — only needed to *claim* mutual
  exclusivity).

1. **Cross-compile virtual *identity* (the hard part — and a v2
   prerequisite).** Baseline-vs-forced-same-source aligns trivially
   (identical orders). But after a source edit, **raw ig_idx lies** —
   the gm hand-craft writeup shows a semantic role moving from target
   `r37` to candidate `r92` while raw ig_idx tracking became misleading.
   So "did the first divergence move later?" is only clean for
   same-source baseline-vs-forced. For cross-compile progress, identity
   must be a **role descriptor**, not raw ig_idx: source-binding +
   confidence, first-def opcode/signature, live range, copy lineage, and
   coalesce root. This role-descriptor identity layer is the gating
   prerequisite for v2 (convergence / iterative cross-compile progress)
   — see Scope below. v1 does not need it because it only does
   same-source explanation.

2. **Is the case taxonomy complete?** Are there allocator decision modes
   (additional spill/coalescing interactions, r0 special-casing, pair
   registers) the current cases miss? Validate against the real algorithm
   and the actual recorded `COLORGRAPH DECISIONS` before trusting the
   explanation.

3. **Reliability of the source-mapping step.** The bridge gives the
   variable; turning "shorten W's live range" into a concrete edit is
   heuristic. Does this stay an *idea generator* (agent applies
   judgment) or can specific edit classes be mechanized? Likely the
   former first; the latter is a follow-on.

4. **Convergence vs cycling on real functions.** The whole premise is
   that directed first-divergence climbing converges where blind search
   wanders. The Check-2 validation tests this on a known answer; we
   don't yet know the convergence behavior on harder cases. The honest
   risk: it may cycle on the coupled ones.

5. **The fixed-IR constraint check (for the mutual-exclusivity claim).**
   The coupling section promises that "mutually exclusive" is only
   claimed after proving no coloring of the fixed interference graph
   satisfies both target assignments. That check doesn't exist yet — it
   needs a small constraint-satisfaction model over the (fixed) IG +
   MWCC's dispense rule. Until built, cycling is reported as
   "non-convergence, candidate causes: [...]" not as a proof. Whether
   this check is cheap (the IG is small per function) or needs real CSP
   machinery is open; it's a follow-on to the first milestone, not a
   blocker for it.

---

## Scope — v1 explainer, v2 convergence (staging, not a ceiling)

Two independent reviews converged on the same scoping: high confidence
as a diagnostic/explainer, low/unknown as a convergence engine *without*
a stronger semantic-identity layer. The resolution is staging, not
abandonment — there are no functions we refuse to attempt, only
capability we build in order.

**v1 — constraint explainer (buildable now).**
- **Is:** a same-source allocator-state replayer + first-divergence
  classifier that emits raw allocator facts first, then confidence-ranked
  source hypotheses. Reads the tell, names the blocker, suggests ideas.
- **Isn't:** a convergence engine, a source auto-fixer, a no-candidate /
  futility prover, or a full asm→IR derivation. It consumes a
  **same-source target coloring (the force-proof / force-phys map) only**
  — matched pcdump is v2 — rather than deriving it. It proposes; the
  agent applies judgment.
- Needs no cross-compile identity layer because it explains a single
  same-source baseline against a known target.

**v2 — convergence (gated on the role-descriptor identity layer).** The
iterative "fix first divergence → re-run → did it move later?" loop and
any permuter-biasing require cross-compile *role identity* (open
question #1), because raw ig_idx lies across source edits. Build v1
first; v2 is unlocked only once the identity layer exists. This is the
"shrink the search space" half of the vision — real, but downstream of a
prerequisite v1 proves out.

**Relationship to the permuter:** v1 targets the *agent* loop (emit
hypotheses, agent applies). v2's permuter-biasing (prefer mutations
targeting the first-divergence role) is the search-prior payoff — but it
inherits v2's identity-layer prerequisite.

---

## First milestone (v1)

Two same-source gates, in order:
1. **Replay smoke test** (Check 1): closed-loop replay reproduces the
   actual recorded `COLORGRAPH DECISIONS` coloring at every iteration on a
   fixed source, including callee-save reuse (the C2 case). The oracle is
   the recorded coloring, not `simulate` (which approximates iteration
   order). Gate for the workingMask correctness fix; must pass first.
2. **First-divergence reproduction** (Check 2): on gm and lbDvd, with
   each function's own force-proof as a same-source target, the analyzer
   mechanically reproduces the *first-divergence* allocator fact (gm:
   Case D, 42/38 coalesced, prevent-the-coalesce; lbDvd: its first
   register-choice divergence) — not the full multi-decision manual
   narrative, which emerges across the iterative loop. This is the v1
   acceptance gate.

Both gates are **same-source**, so neither needs the cross-compile
identity layer — meaning v1 is buildable now without resolving open
question #1. gm and lbDvd are the fixtures (their force-proofs and
manual constraint explanations are already on record), so there's no
fixture-availability risk for v1. Matched-source / grVenom / the
convergence loop are all v2, gated on the identity layer.

---

## Next steps

1. **v1 is unblocked.** Both v1 acceptance gates (Check 1 replay, Check 2
   same-source constraint reproduction on gm/lbDvd) are same-source, so
   open question #1 (cross-compile identity) does NOT gate v1 — it gates
   v2. The gm/lbDvd fixtures already exist. There's no remaining
   design-level blocker for the v1 build.
2. Write the v1 implementation plan (task-by-task, subagent-driven):
   the same-source replayer + first-divergence classifier + ranked
   hypothesis emitter, with Check 1 then Check 2 as acceptance gates.
   Open question #2 (case completeness) resolves empirically *inside*
   Check 2 — if the analyzer reproduces gm's and lbDvd's first-divergence
   facts, the taxonomy is sufficient for those; gaps surface as
   first-divergence facts that don't reproduce.
3. v2 (convergence) only after v1 ships and the role-descriptor identity
   layer (open question #1) is designed.
