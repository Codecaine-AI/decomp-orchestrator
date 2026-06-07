# Directed (pcdump-guided) Search Layer — Design

**Status:** Frozen for planning (Codex rounds 1–3 incorporated 2026-06-01)
**Builds on:** `docs/superpowers/specs/2026-06-01-fast-directed-search-substrate-design.md`
**Proof target:** `grIceMt_801F9ACC` (the ev/did register select-order wall, 98.84%, blind permuter confirmed insufficient)
**Scope of the FIRST implementation plan:** Phase 1 only (stages P1.A–P1.E below). Phase 2 (LLM Editor) is a separate plan written after the Phase-1 gate passes.

---

## 1. Context & motivation

The recurring terminal wall is an **emergent register select-order / interference-graph (ig) ordering** that local tweaks can't reach and blind permuter can't crack (9ACC's 2-way `ev`/`did` coloring swap floored permuter at 7,400+ and ~72K iters on no-op nudges). It is the class the substrate's deferred **directed** seams were designed for.

Two assets exist:
- **The substrate**: directed seams present but **deferred/unwired** — `score_directed(art, objective)` raises `NotImplementedError`, `should_escalate` returns `False`, `DefaultScheduler.ingest()` calls only `score_byte` and compiles via `backends[0]` with no pcdump flag (pcdump routing is a deferred comment), producers start only pre-loop, `observe` is called once per batch with all siblings, `CandidateArtifact.directed_score` slot exists, dedup keys `(CompileSpec, source_hash)`. `BackendCaps.supports_pcdump` is a capability; **`want_pcdump` is a parameter of `CompileBackend.compile`** (not a `BackendCaps` field). `VariantSource` is **`next_batch(n) -> list[SourceVariant]`** (synchronous, pre-producers); `ArtifactProducer` is async. `search.TargetSpec` = `{function, unit, expected_obj}`.
- **The convergence engine** (`tools/melee-agent/src/mwcc_debug/`): `analyze_iteration_full(target, compile, class_id) -> (IterationState, FirstDivergenceReport, ReanchorResult)`, where `target` is the **mwcc-debug** target (roles+metadata, distinct from `search.TargetSpec`), `compile` is a `role_descriptor.Compile`; `IterationState` = `{fact, identity, role_order_rank, gone_roles}` (`role_order_rank` is a **fixed target rank per original IG, not a candidate distance**); `ReanchorResult.matched` is `{new_ig -> original_ig}`. `classify_progress(prev, curr, edit_was_order_change, history, checkdiff_clean)` needs loop-driver state. `analyze_first_divergence` returns `source=None` on all paths; `SourceIdea` carries var names/alternates/first-def text but **no file/span**. `suggest_coalesce` is a separate pair/discover tool: `Suggestion` has `pattern_name` (`direct-identity`/`chain-init`/`alias-split`/`common-subexpr`) + advisory prose `source_hint`, **no anchor**. `colorgraph_parser`: `ColorgraphDecision` = `{iter_idx, ig_idx, assigned_reg, degree, n_interferers, flags, interferers}` (no `phys_reg`); `SimplifyEntry` = `{iter_idx, ig_idx, degree, array_size, flags, spilled}`. `debug dump local` produces a bound `.o`+pcdump in one invocation (`--keep-obj`, `MWCC_DEBUG_PCDUMP_PATH`).

Per Codex rounds 1–3 (Appendix A), the design is corrected throughout. The load-bearing realities: the directed metric is a **candidate ordering distance** (`role_order_rank` is flat on the swap), and for a **2-role swap it is binary (1→0 at the flip)** — so Phase 1 progress uses a **secondary displacement sub-metric**, while order_distance=0 is the Phase-2 win; directed scoring is **pure vs an explicit parent wrapper** keyed by `(candidate_id, parent_state_id)`; the **`DirectedDiagnosis` + source-anchor resolver + typed mutators are a bounded 9ACC-scoped subproject** that must be built (the analysis yields no spans); the **scheduler tier-2 path is a real refactor**, not a small branch.

## 2. Decisions (locked in brainstorming)

1. **Success = both, sequenced.** Phase 1 (this plan): validated mechanism with a machine-checked gate on 9ACC. Phase 2 (later plan): LLM Editor + the 100% attempt.
2. **Editor = hybrid.** Deterministic **typed-mutator** `DirectedSource` (`VariantSource`) is the Phase-1 spine; an async `LlmEditorProducer` is the Phase-2 reach (interface noted, **not in this plan**).
3. **Scope = general divergence engine** (reuse `analyze_iteration_full` + role-identity + labels + reanchor coverage); harness-validity is a first-class pillar.
4. **Approach = decompose into substrate primitives.** Reuse the analysis as a library; don't run `run_convergence_loop`, but preserve its progress state explicitly as a `DirectedSearchState` wrapper.

## 3. Architecture & data flow

| Convergence piece (reused) | Substrate seam / **(build)** |
|---|---|
| typed mutators selected by `DirectedDiagnosis` **(build, 9ACC-scoped)** | **`DirectedSource`** (`VariantSource`) |
| LLM edit generation **(build, Phase 2 — not this plan)** | **`LlmEditorProducer`** (async `ArtifactProducer`) |
| `analyze_iteration_full` + ordering/displacement metric + `classify_progress` | **tier-2 `score_directed(art, objective, parent_state)`** (pure) |
| byte-score plateau | **`should_escalate`** **(build)** |
| `MWCC_DEBUG_PCDUMP_PATH` + `--keep-obj` | **`PcdumpLocalBackend`** **(build)** |
| (derived — no existing path) | **`DirectedDiagnosis` builder + source-anchor resolver** **(build, 9ACC-scoped)** |
| `role_descriptor.build_target_spec` + `debug dump local` | **`DirectedObjective` builder** **(build)** |

`run_convergence_loop` is **not** used. The substrate `DefaultScheduler` is **refactored** to add directed mode (Codex round-3 P1: not a small branch). One directed iteration:

1. Escalation mode is decided from **prior byte-score history before the batch** (so `want_pcdump` is known at compile). In directed mode all compiles route through `PcdumpLocalBackend`.
2. `DirectedSource.next_batch(n)` → variants (each = a typed mutator applied to the current-best, selected by the current `DirectedDiagnosis`). `[]` on exhaustion.
3. Compile (`PcdumpLocalBackend`) → `.o` + bound pcdump.
4. `score_byte` (tier-1); `byte_score==0`+checkdiff-clean → win short-circuit.
5. `score_directed(art, objective, parent_state)` — **pure**; scores vs the candidate's **parent** (`parent_state_id`); returns `DirectedMeta`; mutates no global state. Telemetry keyed `(candidate_id, parent_state_id)`.
6. The scheduler **selects one new current-best** from the batch (tier-1, then displacement scalar); `observe` advances the global `DirectedSearchState` to that best and updates the stall counter.

## 4. Data contracts (build)

- **`DirectedObjective`** (qualified fields, resolving the `TargetSpec` collision): `{search_target: search.TargetSpec, role_target: mwcc_debug TargetSpec, baseline_compile: role_descriptor.Compile, baseline_pcdump_path: Path, baseline_source_hash: str, class_id: int}`. A **`DirectedObjective` builder** (one validated API) constructs baseline `Compile` (via `debug dump local`), the role `TargetSpec` (via `role_descriptor.build_target_spec`), source hash, and pcdump/object paths. (The live `debug target derive` emits an older `{function, virtuals, spilled}` shape; the builder uses the library path, not that CLI.)
- **`DirectedSearchState`** (the explicit parent wrapper; not a subset of `IterationState`): `{prev_state: IterationState | None, history, last_lever, current_best, state_id}`.
- **`DirectedDiagnosis`** (derived; built — no existing path): `{case, target_igs, source_idea, coalesce_pair | None, mutator_key | None, resolved_anchor | None, analysis_valid: bool, actionable: bool, invalid_reason | None}`.
- **`DirectedMeta`** (on `CandidateArtifact.directed_meta`; fully linkable): `{candidate_id, source_hash, iteration, parent_id, parent_state_id, valid, invalid_reason, case, label, order_distance: int, displacement: float, displacement_delta: float, reanchor_matched, reanchor_total, diagnosis_chars, applied_mutator: str | None, directed_scalar: float}`.
- **`CandidateArtifact`** gains `directed_meta` + status `"invalid"`. **`SearchResult`** gains `directed_telemetry: list[DirectedMeta]`.

## 5. The core units

### 5.1 `DirectedSource` + diagnosis/resolver/mutators (build, 9ACC-scoped)
- **`DirectedDiagnosis` builder:** composes a diagnosis from `(IterationState, FirstDivergenceReport, ReanchorResult)` + `suggest_coalesce` outputs. **`analysis_valid` and `actionable` are separate** — a candidate's progress is not invalidated because the *next* diagnosis isn't actionable.
- **Source-anchor resolver (the bounded subproject — Codex round-3 P1/scope):** maps a diagnosis (`source_idea`/`coalesce_pair`, var names, first-def text) to concrete C source spans. **Scoped to 9ACC only**: simple declaration/use anchors for the ev/did levers; 2–3 mutators. Not generalized in this plan (YAGNI).
- **Typed mutators (2–3, grounded in real `pattern_name`):** `change_return_type_to_int` (the void→int lever), `wrap_field_access_in_accessor` (`direct-identity`→GetUserData), `introduce_indirection_local`/`hoist_temp_before_branch` (`alias-split`/`chain-init`→new_var). Each takes a resolved anchor → exact patched source; un-resolvable anchor → skipped (never emits broken source).
- **`DirectedSource.next_batch(n)`** applies up to `n` untried mutators to the current-best; `[]` on exhaustion. **`observe`** runs after the scheduler selects the new best: advances `DirectedSearchState`, records mutator→Δdisplacement, increments stall counter (K stalls → escalation signal; LLM is Phase 2).

### 5.2 `score_directed(art, objective, parent_state)` (tier-2 `ScorePipeline`, pure)
- Pure function of `(art, objective, parent_state)`; runs the analysis on `art`'s pcdump vs `objective` using `parent_state`'s `prev_state`/`history`/`last_lever`; mutates no global state; returns `DirectedMeta`. (Implementation form: `DirectedScorePipeline(objective)` carrying the objective if the protocol's two-arg shape is kept.)
- **Metric (CORRECTED after the Phase-1 live finding — Codex round 4):** the directed signal measures progress toward the **desired physical-register assignment** (`force_phys` / `TargetRoleSpec.desired_phys`), NOT iter-ordering vs a baseline. The earlier iter-ordering objective was derived from the *baseline* compile (`build_directed_objective` read the baseline's own `iter_idx`), making `displacement=1.0` trivially achievable by a no-op — the hollow pass. Replace the gate signal:
  - **`phys_match_fraction`** (the directed scalar) = (target roles whose candidate `assigned_reg == desired_phys`) / (total roles). Map the candidate's phys via `res.matched` (new_ig→original_ig) + `ColorgraphDecision.assigned_reg`; `desired_phys` from `role_target.roles`. The baseline IS the wall (9ACC scores 0/2), so it is **not trivially satisfiable** — a candidate scores higher only by actually moving a role to its desired phys. The scorer's existing `_force_phys_assignment_fallback` (satisfied/blocked/abstained, `score=|satisfied|/total`) is the basis.
  - **`order_distance`** = count of roles whose `assigned_reg ≠ desired_phys` (`0` = all roles at desired phys = the win).
  - The iter-ordering `order_distance`/`displacement` (the previous metric, Tasks 4–5) are kept ONLY as diagnostic telemetry — **never the gate signal**.
- **Real control baseline (Codex round 4 P0):** `control` = the UNCHANGED source compiled + scored (`phys_match_fraction` of the baseline). The gate compares treatment against this REAL control, not a hardcoded `0.0`.
- **Attribution integrity (Codex round 4 P0):** a candidate is `applied_mutator`-attributed for the gate ONLY if its mutator came from an ACTIONABLE diagnosis (a resolved `var_name`/anchor). The `var_name=None` blind decl-pair enumeration (e.g. for `C2_STICKY_POOL`) must mark candidates NON-attributed, so a no-op can never satisfy the gate's attribution requirement.
- **`should_escalate`:** a directed-only run scores directed from iteration 1 (its purpose is directed scoring) via an explicit config flag — NOT a `_AlwaysEscalate` hack. The byte-plateau `should_escalate` remains for mixed tier-1/tier-2 runs.
- **Validity (`analysis_valid`):** `INVALID` (status `"invalid"`) unless roles non-empty, `case ∉ {NONE, ABSTAINED}`, `report` present, reanchor coverage ≥ floor, identity/rank present where used.

### 5.3 `PcdumpLocalBackend` (build) — as round 1/2: debug compile path (`--keep-obj` + `MWCC_DEBUG_PCDUMP_PATH`), repo build lock, `.o`+pcdump as one content-addressed pair with bound digests, `supports_pcdump=True`.

### 5.4 `LlmEditorProducer` (Phase 2 — interface note only, NOT in this plan) — async `ArtifactProducer` with a directed request context `{current_source, diagnosis, failed_mutators, source_hints, budget}`, dynamically started/stopped mid-loop on escalation. Documented so Phase 1 leaves the seam, but it is **excluded from the first implementation plan** (Codex round-3 YAGNI).

## 6. Scheduler refactor & validity harness (build)

**6.1 Scheduler directed mode (a real refactor, not a branch):** `DefaultScheduler` maintains byte-history + global `DirectedSearchState` + current-best; decides escalation **before** each batch; in directed mode compiles through `PcdumpLocalBackend` (`want_pcdump=True`) and recompiles the triggering candidate once to bind its pcdump; calls `score_directed` **purely** per candidate (keyed `(candidate_id, parent_state_id)`); attaches `directed_meta`; surfaces `INVALID` loudly; appends `directed_telemetry`; **selects exactly one** new best, then calls `observe` on that selection. Existing dedup/promote/win short-circuit preserved (dedup must not collapse distinct parents — key directed scoring by the pair).

**6.2 Validity harness:**
1. **Per-candidate:** the hardened `analysis_valid` gate (§5.2), incl. `ABSTAINED`.
2. **Per-run pre-flight:** validate the `DirectedObjective` (run the analysis once on `baseline_compile`/`baseline_pcdump`; assert roles non-empty, `case ∉ {NONE, ABSTAINED}`, `report` present). Abort loudly otherwise (the gate-3 pilot-#1 failure).
3. **Per-run gate (machine-checked):** Phase 1 passes iff pre-flight green AND treatment candidates are `analysis_valid` AND ≥1 shows **attributable mechanism progress** — a **`displacement` improvement** (the smooth signal) attributed to a specific applied mutator, with non-regressed byte score and stable-or-improved reanchor coverage, better than a control/baseline candidate. **This gate validates the mechanism (non-VOID, diagnosing, attributing, moving a real structural signal); it does NOT require `order_distance=0`** (that flip is the Phase-2 win). For a pure transposition where no displacement gradient exists, the gate may legitimately fail to find smooth progress — that is itself a valid, recorded finding that routes to Phase 2 (LLM) rather than a false green.

## 7. Phase plan — Phase 1 decomposed (this plan), Phase 2 deferred

Phase 1 is decomposed into bounded, independently-testable stages (Codex round-3 scope verdict):
- **P1.A — Compile/objective infra:** `PcdumpLocalBackend` + the `DirectedObjective` builder + per-run pre-flight. Testable: a 9ACC objective is constructed + validated; one compile yields a bound `.o`+pcdump.
- **P1.B — Metric + scorer:** the reanchor mapping, `order_distance` (binary) + `displacement` (smooth), `score_directed(art, objective, parent_state)` (pure), hardened validity. Testable on **fixture pcdumps captured from 9ACC at known states** — no mutators needed yet.
- **P1.C — Scheduler directed-mode refactor:** byte-history, escalation-before-compile, pcdump routing, per-parent pure scoring keyed `(candidate_id, parent_state_id)`, select-one-best, observe-best, `directed_meta`/`"invalid"`/telemetry contracts, `should_escalate`.
- **P1.D — Diagnosis + resolver + mutators (9ACC-scoped):** `DirectedDiagnosis` builder, the bounded source-anchor resolver, 2–3 anchored mutators, `DirectedSource`. The riskiest stage; explicitly 9ACC-only.
- **P1.E — End-to-end + gate:** run on 9ACC; evaluate the §6.2 machine-checked gate.
  **→ GATE.** Green → write the Phase-2 plan (LLM Editor). Red → stop and reassess (record whether the failure is "no displacement gradient exists" vs "mechanism bug").

## 8. Testing

- **Metric:** 9ACC fixtures — `order_distance` is `1` pre-flip and `0` post-flip (asserted binary); `role_order_rank` is shown flat across the same fixtures (justifying its rejection); `displacement` is computed and its monotonicity is **characterized, not asserted** (it is heuristic). The reanchor mapping is unit-tested against `ReanchorResult.matched`.
- **Pure scoring:** two batch-siblings from one parent score identically regardless of order; same candidate with different parents may differ and is keyed `(candidate_id, parent_state_id)`.
- **Diagnosis builder:** fixture `(IterationState, FirstDivergenceReport, ReanchorResult)` → `case`, `mutator_key`, resolved anchor, `analysis_valid`/`actionable` split.
- **Resolver + mutators:** golden tests — resolver derives the right span; each mutator yields exact expected patched source; un-resolvable anchor → skipped.
- **Validity:** `INVALID` on empty-roles, `NONE`, **`ABSTAINED`**, missing-report, low-coverage. **Gate-3 regression:** degenerate roles → pre-flight ABORT.
- **`PcdumpLocalBackend`:** one invocation yields `.o`+pcdump with bound digests.
- **Plateau:** fixed-residual byte-history → escalate after exactly N.
- **Scheduler:** directed mode routes pcdump; INVALID surfaced (not progress); one best selected; telemetry populated; dedup preserves distinct parents.
- **Phase-1 gate:** passes on attributable-displacement telemetry; fails on VOID telemetry and on unattributed/regressing "progress"; a "no-gradient" 9ACC outcome is reported as a distinct, valid result.

## 9. Out of scope (YAGNI)

- Generalizing the source-anchor resolver / mutators beyond 9ACC's levers.
- `LlmEditorProducer` and dynamic producer start/stop (Phase 2 plan).
- Multi-function batch; remote/distributed directed search.

## 10. Success criteria

- **Phase 1 (gate, §6.2):** on 9ACC — pre-flight passes; treatment candidates `analysis_valid` (`case ∉ {NONE,ABSTAINED}`); ≥1 attributable **displacement** improvement (mechanism proven non-VOID, diagnosing, attributing); OR an explicit, recorded "no smooth gradient exists for this transposition" finding that validly routes to Phase 2. `order_distance=0` is **not** required at Phase 1.
- **Phase 2 (later plan):** `grIceMt_801F9ACC` `match=true`/100% (`order_distance=0` + byte 0 + checkdiff clean), or a characterized partial.
- **No silent regressions:** integrates behind the refactored tier-2 scheduler; existing substrate tests stay green; a second tier-2 scorer drops in behind the same directed-mode refactor (extended litmus).

---

### Appendix A — Codex review log
- **Round 1 (gpt-5.5 xhigh):** scheduler tier-2 is a build; diagnosis/validity/telemetry channel + `INVALID`; `source_hint`s advisory → typed mutators; real `analyze_iteration_full` schema, drop `distance_to_flip`; preserve `DirectedSearchState`; `ABSTAINED` invalid; byte-history plateau; `PcdumpLocalBackend`; `DirectedObjective` baseline compile; LLM as async producer; attributable gate; `next_batch(n)`.
- **Round 2 (gpt-5.5 xhigh):** pure-vs-parent scoring (global state advances only on best-selection); **`role_order_rank` flat on the swap → candidate ordering distance**; `DirectedObjective` qualified fields (`TargetSpec` collision); `DirectedDiagnosis` must be built (analysis `source=None`); mutators grounded + anchor resolver, phase-1 shrunk; escalation before compile; `LlmEditorProducer` context + dynamic start/stop; `directed_meta` linkage; split `analysis_valid`/`actionable`.
- **Round 3 (gpt-5.5 xhigh):** **ordering distance is binary {0,1} for a 2-role swap → add a `displacement` sub-metric; Phase-1 gate uses displacement, not `order_distance=0`, and honestly may find no gradient** (P1); reanchor mapping spelled out; `assigned_reg` not `phys_reg`; parent_state is an explicit wrapper, scoring keyed `(candidate_id, parent_state_id)` (dedup interaction); `score_directed(art, objective, parent_state)` (objective param); scheduler tier-2 is a **real refactor**; `DirectedObjective` builder (the `debug target derive` shape gap); **the resolver+mutators are a bounded 9ACC-scoped subproject → Phase 1 decomposed into P1.A–P1.E**; `want_pcdump` is a `compile()` param; `§6.3`→§6.2 layer 3; LLM excluded from the first plan. **Verdict reconciled:** with Phase 1 decomposed (§7) and the resolver scoped to 9ACC (§5.1), the first plan is bounded and implementation-ready.
- **Round 4 (post-implementation, live-integration finding — gpt-5.5 xhigh):** the live Phase-1 gate "passed" but the pass was **hollow**: `build_directed_objective` derived the objective from the *baseline* coloring, so `displacement=1.0` only meant "the mutation changed nothing," and `control_displacement` was hardcoded `0.0`, and a `var_name=None` blind decl-pair fallback produced "attributed" no-op candidates. **Metric replaced (§5.2):** the gate signal is now `phys_match_fraction` (candidate `assigned_reg` vs `desired_phys`), measured against a REAL unchanged-source control; iter-ordering demoted to diagnostic telemetry; attribution requires an actionable (resolved-anchor) diagnosis; directed-from-iter-1 is an explicit config, not a `_AlwaysEscalate` hack. The honest re-run verdict is expected to be `no_smooth_gradient` (the decl-order levers don't achieve the phys swap) — which correctly validates the mechanism and routes to Phase 2. The live integration crucible (Task 12) did its job: it caught a fundamental metric-definition flaw the 3 pre-implementation rounds did not.
