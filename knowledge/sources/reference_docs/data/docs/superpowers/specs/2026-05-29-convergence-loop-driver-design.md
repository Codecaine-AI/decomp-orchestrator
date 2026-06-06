# Convergence Loop Driver — Design Spec (Unit 4, second increment)

**Date:** 2026-05-29
**Status:** design agreed (brainstormed with an independent agent; user AFK). Pending independent spec review → plan → implementation.

## 1. Goal & scope

Orchestrate the directed-convergence loop: each iteration runs the identity-aware
first-divergence analysis, classifies progress vs the previous iteration, and — if
not done — lets an **agent edit the C source and recompile**, then repeats until a
termination condition. This increment builds the **driver/orchestration +
termination + outcome taxonomy + iteration log**, designed so it is
**unit-testable without live compiles**.

**In scope:** `run_convergence_loop`, the `Editor`/`Checker` collaborator
protocols, the data structures (`IterationContext`, `EditProposal`,
`IterationRecord`, `LoopResult`, `Outcome`), a new `analyze_iteration_full`
entry point, and a scripted-editor gate.

**Out of scope (later increments):** the real agent-backed `Editor`; the live
Gate-3 sweep on real functions with a baseline control; the Unit-5 parallel
worktree harness; wall-clock/phase-separated time accounting (a harness concern);
multi-anchor consensus.

## 2. Core principle: the driver owns every verdict

The agent that edits source is intelligent but **untrusted for measurement**. The
whole point of the layer is *attributable* convergence (Gate 3 must separate "the
identity loop helped" from "the agent got lucky"). Therefore:

- The **`Editor`** returns *only* what only it can produce — a new compile and its
  reasoning. It does **not** report success, and it does **not** report whether its
  edit was an order change.
- The driver runs the win check (**`Checker`**, i.e. checkdiff) itself, derives
  `edit_was_order_change` from the agent's *predicted lever*, and owns all
  termination decisions and the iteration log.

```python
class Editor(Protocol):
    def edit(self, ctx: "IterationContext") -> Optional["EditProposal"]: ...

class Checker(Protocol):
    def is_clean(self, compile: "Compile") -> bool: ...   # runs checkdiff; the ASM_MATCHED verdict
```

## 3. Data structures

```python
class Outcome(enum.Enum):
    CONVERGED         # checkdiff clean (ASM_MATCHED) — the only true win
    TARGET_SATISFIED  # real target (matched_natural/causal_closure) fully on-target,
                      #   but checkdiff NOT clean -> residual diff OUTSIDE the target set
    PROXY_SATISFIED   # proxy target satisfied, checkdiff NOT clean -> a LEAD, not a win
    CYCLE             # classifier returned CYCLE (a (identity,case) state revisited)
    STALLED           # k consecutive non-progress labels (no exact repeat)
    BUDGET            # iteration cap (or wall-clock hook) reached
    UNANALYZABLE      # analyze raised / no colorgraph section / identity collapse
    NO_EDIT           # editor returned None (agent declined to edit)

@dataclass(frozen=True)
class IterationContext:        # handed to the editor
    function: str
    target: TargetSpec
    compile: Compile
    report: FirstDivergenceReport       # fact + lever + (optional) source ideas
    state: IterationState
    history: tuple                      # ((identity, case), ...) keys, prev is last
    iteration: int

@dataclass(frozen=True)
class EditProposal:            # what the editor returns — NO verdict fields
    new_compile: Compile
    predicted_lever: DivergenceCase     # agent's hypothesis; drives edit_was_order_change
    rationale: str

@dataclass(frozen=True)
class IterationRecord:         # the per-iteration log line
    iteration: int
    label: ProgressLabel
    case: DivergenceCase
    identity: Optional[int]
    role_order_rank: Optional[int]
    diverging_identity_confident: bool  # state.identity is not None
    non_comparable_reason: Optional[str]  # when label==NON_COMPARABLE (driver-derived):
                                          #   "order_change" | "no_identity_or_rank" | "same_rank_diff_case"
    predicted_lever: Optional[DivergenceCase]
    edit_was_order_change: bool         # derived: predicted_lever in {C, C2}
    checkdiff_clean: bool               # driver-owned
    reanchor_matched: int               # round-trip-confirmed roles this iteration
    reanchor_total: int                 # len(target.roles)
    gone_roles: tuple                   # sorted, for determinism
    rationale: str
    editor_meta: dict = field(default_factory=dict)  # model/seed/prompt-sha — Gate-3 reproducibility

@dataclass(frozen=True)
class LoopResult:
    outcome: Outcome
    iterations: tuple                   # (IterationRecord, ...)
    cause_report: tuple                 # candidate causes (strings) — NOT a proof (spec §8)
```

`EditProposal` deliberately omits `checkdiff_clean` and `edit_was_order_change`:
both are verdicts and must be driver-owned.

## 4. New entry point: `analyze_iteration_full`

The existing pure `analyze_iteration` discards the `FirstDivergenceReport` (the
editor needs it) and the `ReanchorResult` (the driver needs coverage for the cause
report). Add a sibling — do **not** widen the existing function (other callers/tests
depend on its `IterationState` return):

```python
def analyze_iteration_full(target, new_compile, class_id=0
        ) -> tuple[IterationState, FirstDivergenceReport | None, ReanchorResult]:
    ...
# analyze_iteration(...) becomes: return analyze_iteration_full(...)[0]
```

When `reanchor` yields an empty force-phys map, there is no `FirstDivergenceReport`
(nothing to analyze) — return `(state(case=NONE), None, res)`; the driver uses
`res` (coverage) to tell identity-collapse from genuine satisfaction.

## 5. Driver control flow

```
run_convergence_loop(function, target, editor, checker, *,
                     iteration_cap, class_id=0, stall_k=3, wall_clock=None):
  compile = target.baseline compile (passed in by caller)
  history, records, prev_state, last_lever = [], [], None, None
  for it in range(iteration_cap):
      if wall_clock and wall_clock.expired(): return finish(BUDGET, ...)

      # (a) WIN CHECK FIRST — never edit past a win; iteration 0 included.
      if checker.is_clean(compile):
          records.append(record(label=ASM_MATCHED, checkdiff_clean=True, ...))
          return finish(CONVERGED, [])

      # (b) ANALYZE (identity-aware first divergence)
      try:
          state, report, res = analyze_iteration_full(target, compile, class_id)
      except ValueError:
          return finish(UNANALYZABLE, ["recompile produced no colorgraph section"])
      matched, total = len(res.matched), len(target.roles)

      # (c) CLASSIFY vs previous; edit_was_order_change DERIVED from prior lever
      label = classify_progress(prev_state, state,
                edit_was_order_change=(last_lever in (C_DISPENSE_ORDER, C2_STICKY_POOL)),
                history=history, checkdiff_clean=False)
      records.append(IterationRecord(... matched, total, sorted(gone_roles) ...))

      # (d) TERMINAL CLASSIFIER LABELS + GUARDS
      if state.fact.case == ABSTAINED:                  # cap-hit / r0 / untrusted replay — not actionable
          return finish(UNANALYZABLE, ["first-divergence abstained (cap-hit / r0 / untrusted replay)"])
      if state.fact.case == NONE and matched == 0:       # NONE + empty reanchor == identity collapse
          return finish(UNANALYZABLE, ["identity collapse: no roles round-trip-confirmed"])
      if label == TARGET_SATISFIED:
          if target.target_kind == "matched_natural" or target.causal_closure:
              return finish(TARGET_SATISFIED, ["target on-target; residual diff outside target set"])
          return finish(PROXY_SATISFIED, ["proxy target satisfied; not a confirmed match"])
      if label == CYCLE:        return finish(CYCLE, causes(records))
      if stalled(records, k=stall_k):  return finish(STALLED, causes(records))

      # (e) EDIT (the agent step) — attach advisory --source ideas first (Gate-3 fidelity;
      # best-effort, degrades to structural when source/pre-pass unavailable, e.g. scripted tests)
      report = attach_source_ideas_if_available(report, target.function, compile)
      proposal = editor.edit(IterationContext(function, target, compile, report, state,
                                              tuple(history), it))
      if proposal is None:      return finish(NO_EDIT, ["agent declined to edit"])
      history.append((state.identity, state.fact.case))
      prev_state, compile, last_lever = state, proposal.new_compile, proposal.predicted_lever
  return finish(BUDGET, causes(records))
```

Key invariants:
- **Win check before analysis/edit, every iteration (incl. 0):** an already-clean
  target terminates in zero edits; the loop never edits past a win.
- **`edit_was_order_change` is derived** from the previous iteration's
  `predicted_lever`, never trusted from the editor.
- **Empty-reanchor guard:** `case == NONE && reanchor_matched == 0` is identity
  collapse → `UNANALYZABLE`, never `*_SATISFIED` (closes the false-win hole).
- **Proxy gate:** `TARGET_SATISFIED` is a *real* lead only on a
  `matched_natural`/`causal_closure` target; on a proxy it is `PROXY_SATISFIED`.
- **`stalled(records, k)` is defined precisely** (review): the last `k` records all
  have `label ∈ {SAME, NON_COMPARABLE, ROLE_GONE}` AND none is `MOVED_LATER`/
  `NEW_EARLIER` (no rank improvement in the window). This avoids terminating a
  genuinely-advancing order-change run (where rank is the edited dimension, so the
  classifier emits `NON_COMPARABLE` even on real progress) while still catching a
  thrashing loop that never exactly repeats (so `CYCLE` wouldn't fire).
- **`CYCLE` is checked before `STALLED`** (intentional): a tight oscillation is the
  more specific finding and pre-empts the generic STALLED.
- **`non_comparable_reason` is driver-derived** when `label == NON_COMPARABLE`:
  `"order_change"` if `edit_was_order_change`; else `"no_identity_or_rank"` if
  any of `curr.identity` / `curr.role_order_rank` / `prev.role_order_rank` is None;
  else `"same_rank_diff_case"`. The classifier returns only the label; the driver
  knows these inputs, so it logs the reason without changing the gated classifier.
- **Two equivalence invariants the false-win / baseline defenses rely on:**
  `len(reanchor.matched) == 0 ⟺ force_phys == {}` (enforced in `_confirm_round_trip`),
  and `prev_state is None ⟺ last_lever is None` (assert at the top of the loop body).

## 6. Cause report (non-convergence)

On any non-`CONVERGED` terminal, emit candidate causes (strings) — explicitly **not
a proof** (spec §8). Derived from the logged `IterationRecord` fields, which now
make the edit-quality vs identity-instability split mechanical (review B-P1-2):
- **identity instability** — `reanchor_matched/total` trended low or swung across
  iterations; many `gone_roles`; or `non_comparable_reason == "no_identity_or_rank"`
  recurred (the divergence couldn't be identified, so the loop steered on noise —
  NOT evidence about the source).
- **edit quality** — identity was confident throughout (`diverging_identity_confident`
  held) yet labels never improved (`SAME`/`NEW_EARLIER` dominated, no `MOVED_LATER`).
- **partial/proxy target** — `PROXY_SATISFIED`, or `TARGET_SATISFIED` with residual
  diff outside the target set; include `target.target_coverage` in the cause string
  so a reviewer can judge lead quality.
- **mutual exclusivity** — `CYCLE` with confident, stable identity + a consistent
  case (the allocator keeps re-diverging at the same role regardless of edits); only
  credible when `non_comparable_reason` was never `"no_identity_or_rank"`.

## 7. Determinism

The driver is pure given the `Editor`/`Checker` outputs. All serialized sets
(`gone_roles`, cause lists) are sorted; `Editor`/`Checker` are the only impure
seams. Same scripted inputs ⇒ identical `LoopResult`.

## 8. Testing strategy (the gate) + its blind spots

Unit-test the driver by replaying recorded `Compile`s (the committed corpus
pcdumps, `tests/fixtures/role_identity/mnVibration_*`, etc.) through a **scripted
`Editor`** and a **stubbed `Checker`**. This drives the *real*
`analyze_iteration_full` + `classify_progress`, so it genuinely exercises reanchor
drift, real `DivergenceCase`s, and real `gone` statuses.

The gate asserts:
1. **Each terminal outcome is reachable and correct:** a script that ends clean →
   `CONVERGED`; a *non-repeating* order-change-lever sequence → the moving iterations
   are labeled `NON_COMPARABLE`; a sequence that revisits a `(identity, case)` →
   `CYCLE` (and assert explicitly that a *repeating* order-change sequence is `CYCLE`,
   NOT `NON_COMPARABLE`, since CYCLE is checked before the order-change gate —
   review B-P1-3); a `NONE` + empty-reanchor → `UNANALYZABLE` (**not** `*_SATISFIED`);
   an `ABSTAINED` fact → `UNANALYZABLE`; a proxy target with no divergence →
   `PROXY_SATISFIED`; a real (`matched_natural`/`causal_closure`) target with no
   divergence but not clean → `TARGET_SATISFIED`; `stall_k` consecutive non-progress
   **including a `ROLE_GONE` storm** → `STALLED`; cap reached → `BUDGET`; editor
   returns `None` → `NO_EDIT`; analyze raising → `UNANALYZABLE`.
2. **The log is faithful:** `IterationRecord` records the lever, the *derived*
   `edit_was_order_change`, reanchor coverage, and `gone_roles`.
3. **Determinism:** identical scripted inputs ⇒ identical `LoopResult`.

**Documented blind spots** (this gate does NOT cover): (a) checkdiff *verdict
realism* — injected via the `Checker` stub, not a real diff; (b) real-agent edit
and lever-prediction *quality* — that is Gate 3; (c) the scripted editor cannot
*react* to the `report`/lever it receives (the compiles are pre-recorded), so the
gate proves the driver *routes* data correctly, not that the `IterationContext` is
*sufficient* to act on; (d) `--source` ideas are attached best-effort and are
empty in scripted runs (no source/pre-pass), so the source-evidence path is
exercised for plumbing only. A green loop test is evidence the **orchestration** is
correct, not that convergence happens on real functions.

## 9. Deferred

Real agent-backed `Editor`; the Gate-3 live sweep + baseline-workflow control;
Unit-5 parallel harness; wall-clock/phase-separated accounting (harness passes the
clock; driver only exposes the hook); multi-anchor consensus.
