# MWCC Backward Inference — Design Doc (first draft)

Date: 2026-05-27
Status: DRAFT — architecture settled, hard parts open. Iterate before planning tasks.

This is the design for the "reverse compiler" direction (deferred-debt
item #16), scoped to the tractable meet-in-the-middle shape rather than
a full preimage computation. It is the successor investment after the
target-shape extensions (Phases 1-3) and the inventory/categorization
work showed that forward search alone hits a wall on the stubborn tier.

---

## Motivation (the empirical case)

Three validation campaigns with correctly-encoded targets, three NO
PROGRESS outcomes:

- **grVenom_80204284** — matched (forward search found it; the answer
  was in permuter's mutation neighborhood).
- **gm_80173EEC** — NO PROGRESS. 322/500 candidates had the right
  allocator-graph shape; none closed. Mutation neighborhood reaches the
  shape but not the match.
- **lbDvd_80018A2C** — NO PROGRESS. Zero candidates even *shaped* toward
  the target (`--want-late` correctly encoded, 275K iterations, 0
  outputs). Mutation neighborhood can't reach the shape at all.

And the inventory showed the allocator slice these campaigns targeted is
only **1.8%** of the unmatched space.

Two structural findings drive this design:

1. **Forward search is gradient-following.** It dies on functions with
   *simultaneous* blockers — where no single mutation produces match%
   reward, so there's no gradient to climb. lbDvd's 0-output run is the
   signature of this.
2. **The bottleneck is the mutation library, not the scorer.** We can
   encode any target precisely now (Phases 1-3); the search still can't
   produce candidates for it. When a run fails we don't even know
   *why* — "ran 275K iterations, found nothing" is a mystery, not a
   diagnosis.

Backward inference addresses both: it derives the *joint* constraint set
(handling simultaneous blockers) and converts every failed search into a
*diagnosis* ("the target requires source shape X, which permuter can't
produce — add primitive Y").

---

## The architecture: meet in the middle at the IR waist

MWCC's pipeline is an hourglass for inversion purposes:

```
   C source  ──forward──►  IR  ──forward──►  asm
   (infinite preimage)    (waist)    (small preimage)
        ▲                    ▲                 │
        │                    │                 │
   permuter             IR TARGET        backward inference
   (forward,            (the bridge)     (asm → IR, tractable)
   IR-targeted)
```

- **Backward, asm → IR:** invert only the *deterministic back-end
  passes* — instruction scheduling and register allocation. These have
  *small* preimages (near-invertible given MWCC's fixed algorithm +
  latency model). Output: the IR shape the asm requires (interference
  graph constraints, simplify-order constraints, coalesce structure).
- **Forward, C → IR:** the permuter keeps doing what it does, but now
  it targets the *derived IR shape* instead of the raw asm. The infinite
  C→IR collapse (optimizer, front-end) is never inverted — we cordon it
  off behind the waist.
- **The IR target is the bridge** and the source of the *guarantee*: if
  the permuter produces the IR shape, the deterministic forward passes
  provably reproduce the asm. If it can't, that's a precise signal a
  mutation primitive is missing.

### Why this is tractable (the invertibility asymmetry)

The full preimage `compile⁻¹(asm)` is infinite — dead-code elimination
and algebraic simplification mean unboundedly many C sources produce any
given asm, and almost all are implausible. But invertibility is *not
uniform* across passes:

- **Front-end + optimizer** (type erasure, DCE, folding, inlining):
  infinite preimage. Hopeless to invert. → kept forward.
- **Register allocation + scheduling**: small, often finite preimage.
  Given MWCC's exact deterministic algorithm and the final output, the
  input is heavily constrained. → invert these.

We never compute the infinite part. We invert the narrow neck and let
the forward search handle the wide top with a precise target.

---

## What we already have to build on

This is not greenfield. The forward-side and IR-visibility infrastructure
exists:

- **`debug inspect simulate`** — replays MWCC's *actual* allocator
  algorithm forward (extracted from the 7.0 source, Tier-2
  binary-hook-confirmed). This is the **oracle**: any inverse we compute
  is validated by running `simulate` forward and confirming it
  reproduces the asm.
- **pcdump IR visibility** — simplify order, interference graph events,
  coalesce mappings, colorgraph decisions are all parseable
  (`colorgraph_parser`, etc.).
- **Custom scorer targets IR already** — Phases 1-3 built
  `compute_lex_score` to score against IR-level targets (simplify order,
  coalesce preservation). The forward search is *already IR-targeted*;
  today the target comes from a manual `--force-phys` hack. Backward
  inference *replaces the hack* with principled derivation.
- **The verified allocator algorithm** — documented in
  `docs/mwcc-allocator-algorithm.md` and the mwcc-debug SKILL. We know
  the exact dispense order, working-mask logic, and
  obtain_nonvolatile_register behavior. Inverting a known algorithm is
  far more tractable than inverting a black box.

The key reframe: **Phases 1-3 built the forward-IR-targeting half of
this design. Backward inference builds the other half — deriving the IR
target automatically from the asm instead of from a force-proof.**

---

## Phase ladder

| Phase | Scope | Why this order |
|---|---|---|
| **A — Invert register allocation** | Given target asm's final coloring + MWCC's allocator algorithm, derive the IR-level constraints (interference / simplify-order / coalesce) that must hold. | We already have the forward simulator as oracle AND the forward scorer that consumes IR targets. Highest leverage, lowest new surface. |
| **B — Invert scheduling** | Given scheduled asm + latency model, derive the set of unscheduled IR orders that produce it. | Scheduling is the most invertible pass (topological orders consistent with the dependence graph). Smaller/independent from A. |
| **C — Compose A + B** | Full asm → IR backward derivation: scheduled asm → unscheduled → allocator input. | Combines the two narrow-neck inversions into one asm→IR step. |
| **D — Bound/bias the permuter with the derived IR target** | Feed the derived IR target into the existing forward scorer; use the constraint set to bias mutation selection and to *prove* when no candidate can reach it. | The payoff: bounded, diagnosable search with the guarantee property. |

Phase A is the first real build. B and C extend coverage. D is where the
agent-facing value lands.

---

## First concrete milestone

**Auto-derive grVenom's IR target from its asm, and confirm it matches
the manual force-proof.**

grVenom is solved (commit `42f121862`); we know the answer. The manual
force-proof produced the IR target `--want-first 42,32` (class 0). The
milestone:

1. Take grVenom's target asm (the matched output).
2. Run backward inference through register allocation to derive the IR
   constraints automatically.
3. Confirm the derived target matches the manual force-proof target
   (`42, 32` at the front of class-0 simplify order, plus the coalesce
   structure).
4. Validate by running `debug inspect simulate` forward on the derived
   IR target and confirming it reproduces the coloring.

If the auto-derived target matches the manual one on a known-answer
function, the backward-allocation step (Phase A) is validated. This is
the smallest end-to-end proof that the whole direction works, and it
directly replaces the `--force-phys` hack that every campaign has relied
on.

---

## Open questions (the hard parts — work through before planning tasks)

These are genuine unknowns. The architecture is sound but these
determine feasibility and shape:

1. **Register allocation isn't perfectly invertible.** Multiple
   interference graphs can produce the same final coloring. How much
   residual ambiguity is there in practice, and how do we represent it?
   (Likely: derive a *constraint set* — "these pairs must interfere,
   these must not, this node must precede that in simplify order" —
   rather than a single concrete IR. The forward scorer already accepts
   partial targets, so a constraint set may be the natural output.)

2. **How big is the scheduler's preimage in practice?** Topological
   orders consistent with the dependence graph could be few or many
   depending on instruction-level parallelism. Need to measure on real
   Melee functions before committing to Phase B's approach.

3. **What's the IR-target representation?** The existing scorer takes
   `simplify_order_target` / `simplify_order_target_late` + `force_phys`
   + coalesce flags. Is that expressive enough to hold a derived
   constraint set, or does the target format need to grow? (This
   determines how much of Phases 1-3 we reuse vs extend.)

4. **Where does the guarantee actually hold vs degrade?** The guarantee
   is clean for the deterministic passes. But if the derived IR target
   has residual ambiguity (question 1), the "if permuter produces it,
   asm is reproduced" claim weakens to "if permuter produces *a* member
   of the constraint set." Need to characterize when that's still
   useful.

5. **Does this actually help the simultaneous-blocker case?** The whole
   premise is that backward inference handles joint constraints forward
   search can't. We should sanity-check this on gm or lbDvd: derive
   their IR targets, and see whether the derived constraint set *explains
   why* the forward search failed (e.g., "the IR target requires an
   interference edge that no permuter mutation can introduce"). If
   backward inference can *diagnose* the gm/lbDvd failures, that alone
   is a big win even before it helps match anything new.

Question 5 is arguably the best early experiment: it's cheap (we have
gm/lbDvd data), it validates the diagnostic value independent of the
matching value, and it tells us whether the whole direction is worth the
multi-week build.

---

## Relationship to the diagnostic-suite vision

This design serves the broader vision (tooling that guides agents'
creativity, per the 2026-05-27 discussion):

- **Backward inference is the principled blocker-identifier** for the
  stubborn tier. Where the stack-frame detector (in progress) identifies
  "missing inline" blockers, backward inference identifies "your IR
  diverges from the required IR here" blockers.
- **The derived IR target is the principled idea-generator.** Instead of
  blind mutation, the agent gets "the target requires this allocator-
  graph property; here are source patterns that produce it."
- **The guarantee / no-candidate proof** is what converts a failed
  campaign from a mystery into an actionable next step (add primitive X).

It does NOT replace the forward permuter — it aims it.

---

## Next steps

1. Resolve the open questions, especially #5 (does backward inference
   diagnose the gm/lbDvd failures?) as the cheapest early validation.
2. Once the open questions are settled enough, write the Phase A
   implementation plan (task-by-task, subagent-driven like Phases 1-3).
3. First milestone (grVenom auto-derivation) is the acceptance gate for
   Phase A.
