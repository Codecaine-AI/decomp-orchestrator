# Role-Descriptor Identity Layer + Convergence Loop — Design Spec

Date: 2026-05-28
Status: DRAFT (rev 2) — design approved in brainstorming; pre-plan.
Companion: `docs/superpowers/specs/2026-05-28-first-divergence-validation-results.md`
(the validation that motivates this), and the first-divergence design/brief.

**rev 2 — incorporated an external review (codex gpt-5.5, xhigh reasoning),
10 findings:** richer match outcomes beyond 1:1 (split/merge/rematerialize);
identity-core vs mutable allocator-state feature split (first-def demoted to one
of a bundle); a round-trip + multi-anchor identity cross-check; a proxy-vs-
matched-natural target distinction with causal-closure tracking; a
`NON_COMPARABLE` progress outcome (rank is unreliable when the edit *is* an
order change); a labeled Gate-1 corpus with precision/confusion/split-merge
metrics; a baseline-controlled, lever-logged Gate-3 sweep; and harness cache-
isolation + phase-separated time accounting.

## 1. Motivation

The first-divergence v1 validation concluded that **raw `ig_idx` is the wrong
identity across source edits** (Campaign B: ~89% drift over a real solve path)
and the **symbol bridge is only a weak feature, not an identity system** (8.7%
of nodes get any var name, 0 verified). v2 — a directed convergence loop that
chases the first divergence to a match — is therefore gated on a cross-compile
**role-descriptor identity layer**. This spec defines that layer and the
agent-in-loop convergence loop that consumes it.

## 2. Scope

**In:** (1) a role descriptor, (2) a cross-compile matcher, (3) target
re-anchoring, (4) an agent-in-loop convergence loop + progress classifier, (5) a
parallel-worktree experiment harness. Units 1–3 are gated identity
infrastructure built and validated **first**; units 4–5 consume them.

**Out (non-goals):** automated source-edit generation (the agent owns edits — see
§3); a mutual-exclusivity *proof* (non-convergence is reported with candidate
causes, never asserted as proof); general/cross-function role identity beyond the
convergence use case.

## 3. The agent's role (edit step stays human/agent)

The loop is **agent-in-loop**. Choosing a C-source rewrite that preserves
semantics, project style, C89 constraints, and compiler shape is the hard part —
not mechanically applying a lever. So the *tool* produces, each iteration:
1. the current first-divergence gated fact (cause case + local lever),
2. source-advisory evidence (the `--source` layer: ig→var + confidence),
3. the **reanchored target** in the current compile's numbering (+ per-role
   identity status, see §6/§7),
4. the **progress classification** vs the previous iteration.

The **agent** owns the edit, and must **log its predicted lever before editing**
(needed for Gate 3 attribution, §10). Automated edits / permuter-biasing are a
later payoff, explicitly out of scope here.

## 4. Architecture (five independently-testable units)

1. **Role descriptor** — per-node feature bundle, split into a stable *identity
   core* and mutable *allocator-state* features.
2. **Matcher** — global assignment of reference roles → new-compile nodes, with
   first-class non-1:1 outcomes.
3. **Target re-anchoring** — express a force-phys target in a new compile's
   numbering, with a round-trip / multi-anchor cross-check.
4. **Convergence loop + progress classifier.**
5. **Parallel-worktree experiment harness.**

## 5. Unit 1 — Role descriptor

A role descriptor has two parts; the split is load-bearing (review #9): the
features the *edits deliberately change* must not be the identity keys, or the
matcher will fail to recognize a role precisely when the edit succeeded.

**Identity-core features (decide identity; chosen to be stable across the edits
the loop induces):**
- **def-use neighborhood** — the role's defining op *in relation to* its
  neighbors (what defines its inputs, what consumes it), as a small local graph
  signature rather than a single instruction.
- **use-site multiset** — the multiset of use contexts (opcode + operand role),
  order-independent.
- **first-def signature** — opcode + normalized operand shape (load/store offset,
  immediate, base-operand role). **One feature among the bundle, not the dominant
  key** (review #3): the actively-edited role's first-def can change (opcode,
  block, base, copy shape), and identical field loads collide. Source-line
  annotation is **weak** evidence only.
- **source binding / scope path** when present (symbol bridge) — strong when
  `verified`/`best-guess`, light when `low-confidence`, absent for most nodes.
- **param / is_phys flags.**

**Allocator-state features (diagnostics + confidence *explanation* only, NOT
decisive identity keys — review #9):** live range, coalesce-root membership,
copy lineage, assigned physical, colorgraph/simplify position. These are exactly
what edits mutate, so weighting them as identity would penalize correct progress
and anchor to the old allocator state. They are recorded and shown, and may
*corroborate* a match, but cannot by themselves carry it.

Built by composing existing extractors: `coalesce_ir_facts.collect`
(first_def, use_sites, is_param), `parser`/`analyze_function` (live range,
physical), `copy_trace` (lineage, virtual↔ig), `symbol_bridge`
(`list_bindings`), and the colorgraph/coalesce/simplify sections. The descriptor
extractor runs on *any* compile (reference or candidate). Gate 1 ablates the
feature set to find what is actually stable (§10).

### TargetRoleSpec (persisted artifact)

Derived once from the original baseline compile + the target, persisted
(yaml/json). Per target role:
- `original_ig`, `desired_phys`, `class`,
- the full role **descriptor** (§5, both parts),
- **provenance**: source commit, dump path + sha256,
- `role_order_rank` — the role's rank in the original compile's first-divergence
  walk order (its colorgraph iter position). Structural roles (coalesced/spilled,
  Case D/E) have no iter position and are handled by case, not rank.

Spec-level field, **`target_kind` ∈ {force_proof_proxy, matched_natural}**
(review #2): a force-proof is typically a *partial proxy* (only the forced
nodes), so satisfying it is not the same as allocator convergence. Record
`target_coverage` (fraction of the class's nodes the target pins) and a
`causal_closure` flag (whether known upstream-blocker roles are included). The
spec is the fixed reference; iterations never mutate it.

## 6. Unit 2 — Matcher (Approach B + non-1:1 outcomes)

`match_roles(target_role_specs, new_compile) -> {original_ig: RoleMatch}` where
`RoleMatch = (new_ig | tuple | None, confidence, status, evidence)` and
`status ∈ {matched, ambiguous, gone, split, merged, rematerialized,
non_comparable, unstable_identity, drifted_identity, provisional_chained}`.

- **Global one-to-one assignment** (hand-rolled min-cost / Hungarian, no scipy
  dep; N small) over the *surviving independent* candidate nodes, using the
  **identity-core** cost (§5) with a per-role "unmatched" dummy at a calibrated
  threshold. Consistency (no double-mapping) is what defeats renumbering drift.
- **Non-1:1 outcomes are first-class (review #1):** the true correspondence is
  not always 1:1 — a role can split (one original → two current), merge/coalesce
  (two originals → one root), rematerialize, or become non-comparable. Detect and
  label these; **if a role cannot be expressed as a single current `ig→phys`
  force target, abstain from re-anchoring it** rather than forcing a wrong single
  match.
- **Candidate universe (review #8):** not just colorgraph decisions. Include
  pre-coloring virtuals, simplify rows, colorgraph decisions, final
  coalesce-roots/aliases, and spill markers — so a role that is coalesced/spilled
  in the new compile is *identifiable as such* (→ `gone`/`merged`, a Case D/E
  finding) rather than silently lost before re-anchoring.

Status semantics: `matched` (confident single survivor), `ambiguous` (top
candidates within a small cost margin), `gone` (no candidate under threshold),
`split`/`merged`/`rematerialized` (non-1:1), `non_comparable` (no
forceable single-node expression), `unstable_identity`/`drifted_identity` (§7).

## 7. Unit 3 — Target re-anchoring

`reanchor(target_role_specs, new_compile) -> ForcePhysMap + diagnostics`. Uses
the matcher to express the fixed target in the new compile's ig-numbering; only
`matched` (confident single) roles become force-phys entries.

- **Default: anchor-to-original** — keeps the target definition stable, avoids
  rev-to-rev drift laundering a bad match into "truth."
- **Robust cross-check (review #4)** — anchor-to-original can be *confidently
  wrong* against a stale lookalike, and direct/chained agreement can share that
  bias. So:
  - **inverse / round-trip:** the new node must map back to the original role.
  - **multi-anchor consensus:** compare `original`, `previous-rev`, and
    `last-stable` anchors; require agreement for `matched`.
  - **descriptor-drift reporting:** if the original descriptor has drifted far
    from the best candidate (even at high direct confidence), emit
    `drifted_identity` (or `provisional_chained` when only the chained anchor
    agrees) — never silently prefer direct on stale evidence.
- A role that comes back `gone`/`merged` (coalesced/spilled in the new compile)
  is surfaced directly — a Case D/E first-divergence finding, not an error.
  `split`/`non_comparable`/`drifted_identity` roles are reported and **excluded
  from the force-phys map** (the loop treats them as diagnostics, §8).

Output feeds `first-divergence` as the `--force-phys` target for the new compile,
plus the per-role status diagnostics.

## 8. Unit 4 — Convergence loop + progress classifier

Each iteration (agent-in-loop): run `first-divergence` with the reanchored
target → fact + lever + `--source` evidence; **agent logs predicted lever**, then
applies a source edit; recompile the one TU (`--no-cache-sync`); re-anchor (§7);
re-run `first-divergence`; classify progress.

**Progress labels:**
- `ASM_MATCHED` — full function diff clean per **`checkdiff`** (the real win).
- `TARGET_SATISFIED` — the reanchored target has no divergence. **This means the
  *proxy* target is satisfied, NOT allocator convergence** (review #2), unless
  `target_kind == matched_natural` or `causal_closure` holds; otherwise treat it
  as a lead, and report residual ASM diff.
- `MOVED_LATER` / `NEW_EARLIER` — **only emitted when the diverging role has a
  confident single identity AND a stable, comparable rank** (review #5). Report
  *both* original-`role_order_rank` movement and current-compile allocator-order
  movement.
- `NON_COMPARABLE` — the diverging role lacks a confident identity or a stable
  rank, has split/merged, **or the edit's lever was an order change (Case C/C2)**
  so rank is the edited dimension. Progress is undetermined, not assumed.
- `SAME` — same role + case as before (stalled).
- `ROLE_GONE` — a target role became `gone`/`unstable_identity`/`drifted_identity`.
- `CYCLE` — the (role, case) first-divergence sequence repeats.

**Termination:** `ASM_MATCHED`, or `CYCLE`, or budget (iteration cap / wall-clock
< 1 hour, convergence time only — see §9). Non-convergence is reported with
candidate causes (mutual-exclusivity | partial/proxy target | identity
instability | edit quality) — **not** a proof of mutual exclusivity.

## 9. Unit 5 — Parallel-worktree experiment harness

Run the loop across a function **sample** concurrently — one agent per function,
each in its **own git worktree with isolated build cache** (using-git-worktrees;
`--no-cache-sync`, per-worktree cache dir — review #10), reporting an outcome.

**Operational guardrails (review #10):** (a) **target preflight** — determine
`NO_TARGET` *before* the convergence budget starts; (b) **phase-separated time
accounting** — target-derivation time is reported *separately* from convergence
time, and the <1hr budget covers convergence only; (c) cache/dump-generation
isolation so parallel runs don't contend (a lesson from validation).

**Sample (verify-then-use — confirm current match status first):**
- **Retrospective gate input:** `mnVibration_80248644` solve-path revs (Gate 1).
- **Known force-proof / live-loop canaries:** `gm_80173EEC`, `lbDvd_80018A2C`,
  `ftColl_8007BAC0`, `grVenom_80204284` (its `[39,32]` vs `[42,32]` simplify-order
  story is a good identity stress case).
- **Stuck candidates — ONLY with a preflighted target:** `mnEvent_8024D5B0`,
  `fn_8024D864`, `mnEvent_8024D15C`, `mnEvent_8024E524`, `fn_80169900`. No
  target → classified `NO_TARGET` (separated from loop outcomes; not a failure).

## 10. Validation gates

- **Gate 1 — matcher (retrospective, decisive) — needs a LABELED corpus
  (review #6).** "Known edit history" is not automatically per-role ground
  truth; inferring correspondence from the same features the matcher uses is
  circular. Build a small **labeled** corpus:
  - **same-source / no-op-edit controls** (identity must be a perfect 1:1 — the
    cleanest ground truth),
  - **controlled edits with known role continuity** (a deliberate split/merge/
    move, so the non-1:1 outcomes are checkable),
  - **manually adjudicated `mnVibration` solve-path roles.**
  Metrics: **precision at the confidence threshold, abstain rate, confusion by
  status, inverse-consistency (round-trip) failures, and split/merge detection
  accuracy** — not just matched-rate. Run **feature ablation** to confirm which
  identity-core features actually carry the signal (review #3). The matcher must
  beat the raw-`ig_idx` baseline (~11% matched) *and* prefer honest
  `ambiguous`/`gone` over confident-wrong.
- **Gate 2 — loop classification.** Across two real compiles of a known edit (incl.
  an order-change edit that should yield `NON_COMPARABLE`), the classifier returns
  the correct label.
- **Gate 3 — live convergence (headline value) — controlled (review #7).**
  Preflight targets (separate `NO_TARGET`); require the **logged predicted lever**
  each iteration; and run a **baseline-workflow control** on the same canaries
  (agent without the identity-loop guidance) so a convergence can be *attributed*
  to the identity layer rather than agent skill or luck. `MOVED_LATER` counts as
  evidence only when identity and rank are comparable. Report the outcome
  distribution; a null/`CYCLE` result is informative, reported with candidate
  causes.

## 11. Reused vs new

**Reused:** `coalesce_ir_facts.collect`, `parser`/`analyze_function`,
`copy_trace`, `symbol_bridge`, `first_divergence`, `target derive
--force-phys-safe`, `checkdiff`. **New:** the descriptor (identity-core/state
split) + TargetRoleSpec, the matcher (hand-rolled assignment + non-1:1
outcomes), the re-anchor wrapper (round-trip/multi-anchor cross-check), the
progress classifier, the parallel harness.

## 12. Build order

1. Unit 1 (descriptor + TargetRoleSpec) and Unit 2 (matcher) — gate on **Gate 1**
   (labeled corpus + ablation).
2. Unit 3 (re-anchoring + cross-check) — gate on the same-source/no-op controls
   (perfect 1:1) + the `mnVibration` revs.
3. Unit 4 (loop + classifier) — gate on **Gate 2** (incl. the `NON_COMPARABLE`
   order-change case).
4. Unit 5 (harness) + the controlled sweep — **Gate 3**.

Do not build the loop until the identity infrastructure passes Gate 1; an
unproven matcher under the loop is uninterpretable (the v1 lesson).

## 13. Open questions / risks

- **Identity-core feature selection:** which features are *actually* stable
  across the loop's edits is empirical — Gate 1 ablation decides; start by
  trusting def-use neighborhood + use-site multiset over first-def.
- **Cost calibration:** per-feature weights + the unmatched/ambiguous/drift
  thresholds are tuned against Gate 1's labeled ground truth; start conservative
  (favor `gone`/`ambiguous`/`non_comparable` over confident-wrong).
- **Proxy-target ceiling:** a partial force-proof can drive the loop toward the
  wrong constraint (review #2); prefer fuller/causally-closed targets, and never
  read `TARGET_SATISFIED` on a proxy as convergence.
- **Edit-quality confound:** a `CYCLE`/non-convergence may be the agent's edits,
  not mutual exclusivity. Gate 1/2 + the Gate-3 baseline control isolate the
  identity+classifier so a live failure is attributable.
