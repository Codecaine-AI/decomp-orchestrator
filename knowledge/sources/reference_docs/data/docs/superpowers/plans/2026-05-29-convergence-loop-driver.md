# Convergence Loop Driver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the convergence loop driver per `docs/superpowers/specs/2026-05-29-convergence-loop-driver-design.md` (rev 2, review-incorporated): `run_convergence_loop(...) -> LoopResult` orchestrating analyze → classify → (agent edits) → repeat, with the full outcome taxonomy, driver-owned verdicts, and a scripted-editor gate. Unit-testable without live compiles.

**Architecture:** The driver is pure given its collaborators. Three seams: `Editor` (returns an `EditProposal` — new compile + predicted lever + rationale; NO verdicts), `Checker` (driver-invoked checkdiff verdict), and an injectable `analyze_fn` (defaults to the real, deterministic `analyze_iteration_full`; tests inject scripted state sequences for precise outcome control). The driver derives `edit_was_order_change` from the prior lever, runs the win-check first each iteration, guards the empty-reanchor/`ABSTAINED` identity-collapse holes, and logs per-iteration reanchor coverage so the cause report is honest.

**Tech Stack:** Python 3.11, pytest (`--no-cov`, every run under `timeout 120`). Reuses `convergence` (`analyze_iteration`), `progress_classifier` (`classify_progress`, `ProgressLabel`, `IterationState`), `role_reanchor` (`reanchor`, `ReanchorResult`), `first_divergence` (`analyze_first_divergence`, `DivergenceCase`, `attach_source_ideas`). New code only.

---

## File Structure

- Modify `tools/melee-agent/src/mwcc_debug/convergence.py` — add `analyze_iteration_full(target, new_compile, class_id) -> (IterationState, FirstDivergenceReport|None, ReanchorResult)`; `analyze_iteration` becomes `analyze_iteration_full(...)[0]`.
- Create `tools/melee-agent/src/mwcc_debug/convergence_loop.py` — `Outcome`, `IterationContext`, `EditProposal`, `IterationRecord`, `LoopResult`, `Editor`/`Checker` protocols, pure helpers (`_stalled`, `_non_comparable_reason`, `_cause_report`), and `run_convergence_loop`.
- Create `tools/melee-agent/tests/test_convergence_loop.py` — pure-helper tests, the scripted test harness, the outcome-reachability gate, determinism + log-faithfulness, and one real-`analyze_fn` integration test.

---

## Task 1: `analyze_iteration_full` (expose report + reanchor result)

**Files:** Modify `convergence.py`; Test `tests/test_convergence_analyze.py`.

- [ ] **Step 1: Write the failing test**

```python
def test_analyze_iteration_full_exposes_report_and_reanchor():
    """analyze_iteration_full returns (state, report, reanchor_result); the existing
    analyze_iteration is exactly its first element."""
    fn = "mnVibration_80248644"
    mp, wp = FIX / "mnVibration_matched_pcdump.txt", FIX / "mnVibration_wip_pcdump.txt"
    if not (mp.exists() and wp.exists()):
        pytest.skip("corpus missing")
    mc = rd.Compile.from_text(mp.read_text(), fn, "")
    wc = rd.Compile.from_text(wp.read_text(), fn, "")
    md = rd.build_descriptors(mc, 0)
    target = rd.build_target_spec(mc, {ig: 13 + i for i, ig in enumerate(list(md)[:6])},
                                  0, "force_proof_proxy", provenance={})
    state, report, res = cv.analyze_iteration_full(target, wc, class_id=0)
    assert state is cv.analyze_iteration(target, wc, class_id=0) or \
        state.fact.case == cv.analyze_iteration(target, wc, class_id=0).fact.case
    assert res is not None and isinstance(res.matched, dict)
    # report is a FirstDivergenceReport when force_phys is non-empty, else None
    assert (report is None) == (len(res.force_phys) == 0)
```

- [ ] **Step 2: Run it (fails: no attribute analyze_iteration_full)**

Run: `cd tools/melee-agent && python -m pytest tests/test_convergence_analyze.py::test_analyze_iteration_full_exposes_report_and_reanchor -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement (refactor convergence.py)**

```python
def analyze_iteration_full(target, new_compile, class_id: int = 0):
    """(state, report, reanchor_result). report is None when reanchor yields an
    empty force-phys map (nothing to analyze — caller distinguishes identity
    collapse from genuine satisfaction via reanchor_result.matched)."""
    res = rr.reanchor(target, new_compile, class_id=class_id)
    gone = frozenset(ig for ig, status in res.diagnostics.items() if status in _GONE_STATUSES)
    rank_by_orig = {r.original_ig: r.role_order_rank for r in target.roles}
    if not res.force_phys:
        return (IterationState(fact=FactView(case=fd.DivergenceCase.NONE, ig_idx=-1),
                               identity=None, role_order_rank=None, gone_roles=gone),
                None, res)
    coloring = fd.TargetColoring(class_id=class_id, force_phys=res.force_phys)
    report = fd.analyze_first_divergence(new_compile.fev, coloring)
    fact = report.fact
    identity = res.matched.get(fact.ig_idx)
    rank = rank_by_orig.get(identity) if identity is not None else None
    return (IterationState(fact=FactView(case=fact.case, ig_idx=fact.ig_idx),
                           identity=identity, role_order_rank=rank, gone_roles=gone),
            report, res)


def analyze_iteration(target, new_compile, class_id: int = 0) -> IterationState:
    return analyze_iteration_full(target, new_compile, class_id)[0]
```

- [ ] **Step 4: Run both convergence-analyze tests; PASS. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/convergence.py tools/melee-agent/tests/test_convergence_analyze.py
git commit -m "feat(loop): analyze_iteration_full exposes report + reanchor result"
```

---

## Task 2: Data structures, protocols, and pure helpers

**Files:** Create `convergence_loop.py`; Create `tests/test_convergence_loop.py`.

- [ ] **Step 1: Write the failing helper tests**

```python
# tools/melee-agent/tests/test_convergence_loop.py
from src.mwcc_debug import convergence_loop as cl
from src.mwcc_debug.progress_classifier import ProgressLabel as L
from src.mwcc_debug.first_divergence import DivergenceCase as DC


def _rec(label, **kw):
    base = dict(iteration=0, label=label, case=DC.B_TARGET_HIGHER, identity=10,
                role_order_rank=5, diverging_identity_confident=True,
                non_comparable_reason=None, predicted_lever=None,
                edit_was_order_change=False, checkdiff_clean=False,
                reanchor_matched=6, reanchor_total=6, gone_roles=(), rationale="")
    base.update(kw)
    return cl.IterationRecord(**base)


def test_stalled_fires_on_k_nonprogress_without_rank_improvement():
    recs = [_rec(L.SAME), _rec(L.NON_COMPARABLE), _rec(L.ROLE_GONE)]
    assert cl._stalled(recs, k=3)

def test_stalled_resets_on_moved_later_in_window():
    recs = [_rec(L.SAME), _rec(L.MOVED_LATER), _rec(L.NON_COMPARABLE)]
    assert not cl._stalled(recs, k=3)          # rank improved inside the window

def test_stalled_needs_full_window():
    assert not cl._stalled([_rec(L.SAME), _rec(L.SAME)], k=3)

def test_non_comparable_reason_order_change_beats_identity():
    assert cl._non_comparable_reason(edit_was_order_change=True, identity=None,
                                     curr_rank=None, prev_rank=None) == "order_change"

def test_non_comparable_reason_no_identity_or_rank():
    assert cl._non_comparable_reason(False, identity=None, curr_rank=5, prev_rank=5) == "no_identity_or_rank"
    assert cl._non_comparable_reason(False, identity=10, curr_rank=None, prev_rank=5) == "no_identity_or_rank"

def test_non_comparable_reason_same_rank():
    assert cl._non_comparable_reason(False, identity=10, curr_rank=5, prev_rank=5) == "same_rank_diff_case"
```

- [ ] **Step 2: Run them (fails: no module convergence_loop)**

Run: `cd tools/melee-agent && python -m pytest tests/test_convergence_loop.py -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement the structures + helpers**

```python
# tools/melee-agent/src/mwcc_debug/convergence_loop.py
from __future__ import annotations
import enum
from dataclasses import dataclass, field
from typing import Optional, Protocol
from .first_divergence import DivergenceCase
from .progress_classifier import ProgressLabel, IterationState

_NONPROGRESS = {ProgressLabel.SAME, ProgressLabel.NON_COMPARABLE, ProgressLabel.ROLE_GONE}
_RANK_PROGRESS = {ProgressLabel.MOVED_LATER, ProgressLabel.NEW_EARLIER}
_ORDER_CASES = {DivergenceCase.C_DISPENSE_ORDER, DivergenceCase.C2_STICKY_POOL}


class Outcome(enum.Enum):
    CONVERGED = "converged"
    TARGET_SATISFIED = "target_satisfied"
    PROXY_SATISFIED = "proxy_satisfied"
    CYCLE = "cycle"
    STALLED = "stalled"
    BUDGET = "budget"
    UNANALYZABLE = "unanalyzable"
    NO_EDIT = "no_edit"


@dataclass(frozen=True)
class IterationContext:
    function: str
    target: object                      # TargetSpec
    compile: object                     # Compile
    report: object                      # FirstDivergenceReport | None
    state: IterationState
    history: tuple
    iteration: int


@dataclass(frozen=True)
class EditProposal:
    new_compile: object                 # Compile
    predicted_lever: DivergenceCase
    rationale: str = ""


@dataclass(frozen=True)
class IterationRecord:
    iteration: int
    label: ProgressLabel
    case: DivergenceCase
    identity: Optional[int]
    role_order_rank: Optional[int]
    diverging_identity_confident: bool
    non_comparable_reason: Optional[str]
    predicted_lever: Optional[DivergenceCase]
    edit_was_order_change: bool
    checkdiff_clean: bool
    reanchor_matched: int
    reanchor_total: int
    gone_roles: tuple
    rationale: str
    editor_meta: dict = field(default_factory=dict)


@dataclass(frozen=True)
class LoopResult:
    outcome: Outcome
    iterations: tuple
    cause_report: tuple


class Editor(Protocol):
    def edit(self, ctx: IterationContext) -> Optional[EditProposal]: ...

class Checker(Protocol):
    def is_clean(self, compile) -> bool: ...


def _stalled(records, k: int) -> bool:
    if len(records) < k:
        return False
    window = records[-k:]
    if any(r.label in _RANK_PROGRESS for r in window):
        return False
    return all(r.label in _NONPROGRESS for r in window)


def _non_comparable_reason(edit_was_order_change, identity, curr_rank, prev_rank) -> str:
    if edit_was_order_change:
        return "order_change"
    if identity is None or curr_rank is None or prev_rank is None:
        return "no_identity_or_rank"
    return "same_rank_diff_case"


def _cause_report(outcome: Outcome, records, target) -> tuple:
    causes = []
    if not records:
        return ()
    matched = [r.reanchor_matched for r in records]
    total = records[-1].reanchor_total or 1
    if any(r.label == ProgressLabel.ROLE_GONE for r in records) or \
       min(matched) < 0.5 * total or \
       any(r.non_comparable_reason == "no_identity_or_rank" for r in records):
        causes.append("identity instability: low/unstable reanchor coverage or unidentified divergence")
    if all(r.diverging_identity_confident for r in records) and \
       not any(r.label == ProgressLabel.MOVED_LATER for r in records):
        causes.append("edit quality: identity stable but no MOVED_LATER progress")
    if outcome in (Outcome.PROXY_SATISFIED, Outcome.TARGET_SATISFIED):
        causes.append(f"partial/proxy target (coverage={getattr(target, 'target_coverage', '?')})")
    if outcome == Outcome.CYCLE and records[-1].diverging_identity_confident and \
       not any(r.non_comparable_reason == "no_identity_or_rank" for r in records):
        causes.append("possible mutual-exclusivity: stable identity re-diverges regardless of edits")
    return tuple(sorted(set(causes)))
```

- [ ] **Step 4: Run; PASS. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/convergence_loop.py tools/melee-agent/tests/test_convergence_loop.py
git commit -m "feat(loop): driver data structures + pure helpers (stalled/reason/cause)"
```

---

## Task 3: `run_convergence_loop` orchestration + test harness

**Files:** Modify `convergence_loop.py`; Modify `tests/test_convergence_loop.py`.

- [ ] **Step 1: Write the failing tests (harness + happy paths)**

```python
from src.mwcc_debug import convergence as cv
from src.mwcc_debug.progress_classifier import IterationState, FactView


def _state(case=DC.B_TARGET_HIGHER, identity=10, rank=5, gone=()):
    return IterationState(fact=FactView(case=case, ig_idx=99), identity=identity,
                          role_order_rank=rank, gone_roles=frozenset(gone))


class _FakeRes:                       # stand-in for ReanchorResult
    def __init__(self, matched): self.matched = matched; self.force_phys = matched


def _analyzer(seq):
    """seq: list of (state, matched_count). Returns analyze_fn yielding them in order."""
    it = iter(seq)
    def fn(target, compile, class_id=0):
        state, n = next(it)
        res = _FakeRes({i: i for i in range(n)})
        report = None if n == 0 else object()
        return state, report, res
    return fn


class _ScriptEditor:
    def __init__(self, levers): self._it = iter(levers)
    def edit(self, ctx):
        lever = next(self._it, StopIteration)
        if lever is StopIteration:
            return None
        return cl.EditProposal(new_compile=object(), predicted_lever=lever, rationale="x")


class _Checker:
    def __init__(self, clean_at=None): self.clean_at, self.n = clean_at, -1
    def is_clean(self, compile):
        self.n += 1
        return self.clean_at is not None and self.n >= self.clean_at


class _Target:                        # minimal stand-in for TargetSpec
    def __init__(self, kind="force_proof_proxy", closure=False, coverage=1.0, n_roles=6):
        self.target_kind, self.causal_closure = kind, closure
        self.target_coverage, self.function = coverage, "fn"
        self.roles = [type("R", (), {"original_ig": i, "role_order_rank": i})() for i in range(n_roles)]


def _run(target, analyzer, editor, checker, cap=10, stall_k=3):
    return cl.run_convergence_loop("fn", target, editor, checker,
                                   iteration_cap=cap, analyze_fn=analyzer, stall_k=stall_k)


def test_converged_when_checker_clean_at_iter0():
    res = _run(_Target(), _analyzer([(_state(), 6)]), _ScriptEditor([]), _Checker(clean_at=0))
    assert res.outcome == cl.Outcome.CONVERGED and len(res.iterations) == 1

def test_budget_when_cap_reached_without_progress():
    seq = [(_state(case=DC.B_TARGET_HIGHER, identity=i, rank=i), 6) for i in range(20)]
    res = _run(_Target(), _analyzer(seq), _ScriptEditor([DC.B_TARGET_HIGHER]*20),
               _Checker(clean_at=None), cap=5, stall_k=99)
    assert res.outcome == cl.Outcome.BUDGET and len(res.iterations) == 5

def test_no_edit_when_editor_declines():
    res = _run(_Target(), _analyzer([(_state(), 6), (_state(identity=11, rank=6), 6)]),
               _ScriptEditor([]), _Checker(clean_at=None))   # editor immediately returns None
    assert res.outcome == cl.Outcome.NO_EDIT
```

- [ ] **Step 2: Run them (fails: no run_convergence_loop)**

Run: `cd tools/melee-agent && python -m pytest tests/test_convergence_loop.py -q --no-cov`
Expected: FAIL on the run-loop tests.

- [ ] **Step 3: Implement `run_convergence_loop`**

```python
from .convergence import analyze_iteration_full
from .progress_classifier import classify_progress
from .first_divergence import DivergenceCase

def run_convergence_loop(function, target, editor: Editor, checker: Checker, *,
                         iteration_cap: int, class_id: int = 0, stall_k: int = 3,
                         analyze_fn=analyze_iteration_full, wall_clock=None,
                         baseline_compile=None) -> LoopResult:
    compile = baseline_compile if baseline_compile is not None else getattr(target, "baseline_compile", None)
    history, records = [], []
    prev_state, last_lever = None, None

    def finish(outcome):
        return LoopResult(outcome=outcome, iterations=tuple(records),
                          cause_report=_cause_report(outcome, records, target))

    for it in range(iteration_cap):
        assert (prev_state is None) == (last_lever is None)          # invariant
        if wall_clock is not None and wall_clock.expired():
            return finish(Outcome.BUDGET)
        # (a) win check first — never edit past a win
        if checker.is_clean(compile):
            records.append(_record(it, ProgressLabel.ASM_MATCHED, prev_state,
                                   _state_clean(), 0, 0, last_lever, checkdiff_clean=True))
            return finish(Outcome.CONVERGED)
        # (b) analyze
        try:
            state, report, res = analyze_fn(target, compile, class_id)
        except ValueError:
            return finish(Outcome.UNANALYZABLE)
        matched, total = len(res.matched), len(target.roles)
        order_change = last_lever in _ORDER_CASES
        # (c) classify
        label = classify_progress(prev_state, state, edit_was_order_change=order_change,
                                  history=history, checkdiff_clean=False)
        ncr = (_non_comparable_reason(order_change, state.identity, state.role_order_rank,
                                      prev_state.role_order_rank if prev_state else None)
               if label == ProgressLabel.NON_COMPARABLE else None)
        records.append(IterationRecord(
            iteration=it, label=label, case=state.fact.case, identity=state.identity,
            role_order_rank=state.role_order_rank,
            diverging_identity_confident=state.identity is not None,
            non_comparable_reason=ncr, predicted_lever=last_lever,
            edit_was_order_change=order_change, checkdiff_clean=False,
            reanchor_matched=matched, reanchor_total=total,
            gone_roles=tuple(sorted(state.gone_roles)), rationale=""))
        # (d) terminal labels + guards
        if state.fact.case == DivergenceCase.ABSTAINED:
            return finish(Outcome.UNANALYZABLE)
        if state.fact.case == DivergenceCase.NONE and matched == 0:
            return finish(Outcome.UNANALYZABLE)
        if label == ProgressLabel.TARGET_SATISFIED:
            real = target.target_kind == "matched_natural" or target.causal_closure
            return finish(Outcome.TARGET_SATISFIED if real else Outcome.PROXY_SATISFIED)
        if label == ProgressLabel.CYCLE:
            return finish(Outcome.CYCLE)
        if _stalled(records, stall_k):
            return finish(Outcome.STALLED)
        # (e) edit
        proposal = editor.edit(IterationContext(function, target, compile, report, state,
                                                tuple(history), it))
        if proposal is None:
            return finish(Outcome.NO_EDIT)
        history.append((state.identity, state.fact.case))
        prev_state, compile, last_lever = state, proposal.new_compile, proposal.predicted_lever
    return finish(Outcome.BUDGET)
```

Add small private helpers `_record(...)` (builds the ASM_MATCHED record) and `_state_clean()` (a placeholder IterationState for the converged log line), or inline them — keep the converged record honest (case from the last analyze if available, else NONE). Implementer's choice; the test only checks `outcome` and `len(iterations)>=1`.

- [ ] **Step 4: Run; happy-path tests PASS. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/convergence_loop.py tools/melee-agent/tests/test_convergence_loop.py
git commit -m "feat(loop): run_convergence_loop orchestration + scripted test harness"
```

---

## Task 4: Outcome-reachability gate + determinism + integration

**Files:** Modify `tests/test_convergence_loop.py`.

- [ ] **Step 1: Write the gate tests**

```python
def test_cycle_when_state_revisited():
    # A -> B -> A : the third compile revisits (id, case) of the first
    seq = [(_state(identity=1, case=DC.A_BLOCKED), 6),
           (_state(identity=1, case=DC.B_TARGET_HIGHER), 6),
           (_state(identity=1, case=DC.A_BLOCKED), 6)]
    res = _run(_Target(), _analyzer(seq), _ScriptEditor([DC.A_BLOCKED, DC.B_TARGET_HIGHER]),
               _Checker(clean_at=None))
    assert res.outcome == cl.Outcome.CYCLE

def test_repeating_order_change_is_cycle_not_non_comparable():
    # even under an order-change lever, an exact (id,case) revisit -> CYCLE (checked first)
    seq = [(_state(identity=1, case=DC.A_BLOCKED, rank=3), 6),
           (_state(identity=1, case=DC.B_TARGET_HIGHER, rank=7), 6),
           (_state(identity=1, case=DC.A_BLOCKED, rank=3), 6)]
    res = _run(_Target(), _analyzer(seq),
               _ScriptEditor([DC.C_DISPENSE_ORDER, DC.C_DISPENSE_ORDER]), _Checker(None))
    assert res.outcome == cl.Outcome.CYCLE

def test_unanalyzable_on_empty_reanchor_none():
    res = _run(_Target(), _analyzer([(_state(case=DC.NONE), 0)]), _ScriptEditor([]), _Checker(None))
    assert res.outcome == cl.Outcome.UNANALYZABLE          # NOT *_SATISFIED

def test_unanalyzable_on_abstained():
    res = _run(_Target(), _analyzer([(_state(case=DC.ABSTAINED), 6)]), _ScriptEditor([]), _Checker(None))
    assert res.outcome == cl.Outcome.UNANALYZABLE

def test_unanalyzable_on_analyze_raises():
    def boom(*a, **k): raise ValueError("no section")
    res = _run(_Target(), boom, _ScriptEditor([]), _Checker(None))
    assert res.outcome == cl.Outcome.UNANALYZABLE

def test_proxy_satisfied_vs_target_satisfied():
    proxy = _run(_Target(kind="force_proof_proxy"),
                 _analyzer([(_state(case=DC.NONE), 6)]), _ScriptEditor([]), _Checker(None))
    real = _run(_Target(kind="matched_natural"),
                _analyzer([(_state(case=DC.NONE), 6)]), _ScriptEditor([]), _Checker(None))
    assert proxy.outcome == cl.Outcome.PROXY_SATISFIED
    assert real.outcome == cl.Outcome.TARGET_SATISFIED

def test_stalled_on_role_gone_storm():
    # distinct identity each step (no exact (id,case) repeat -> not CYCLE); each step's
    # prev identity is in curr.gone_roles -> classifier emits ROLE_GONE; ROLE_GONE is a
    # non-progress label (not terminal) so the window fills -> STALLED.
    seq = [(_state(identity=i, case=DC.B_TARGET_HIGHER, gone=(i-1,)), 6) for i in range(1, 8)]
    res = _run(_Target(), _analyzer(seq), _ScriptEditor([DC.B_TARGET_HIGHER]*7),
               _Checker(None), cap=10, stall_k=3)
    assert res.outcome == cl.Outcome.STALLED

def test_determinism_same_inputs_same_result():
    def mk(): return (_Target(), _analyzer([(_state(identity=1, case=DC.A_BLOCKED), 6),
                                            (_state(identity=1, case=DC.A_BLOCKED), 6),
                                            (_state(identity=1, case=DC.A_BLOCKED), 6)]),
                      _ScriptEditor([DC.A_BLOCKED, DC.A_BLOCKED]), _Checker(None))
    r1 = _run(*mk()); r2 = _run(*mk())
    assert r1.outcome == r2.outcome and len(r1.iterations) == len(r2.iterations)
    assert [x.label for x in r1.iterations] == [x.label for x in r2.iterations]

def test_log_faithfully_records_lever_and_coverage():
    seq = [(_state(identity=1, case=DC.B_TARGET_HIGHER), 4),
           (_state(identity=2, case=DC.B_TARGET_HIGHER, rank=8), 5)]
    res = _run(_Target(n_roles=6), _analyzer(seq),
               _ScriptEditor([DC.C_DISPENSE_ORDER]), _Checker(None), cap=2, stall_k=99)
    # iteration 1's record sees the prior order-change lever -> edit_was_order_change True
    assert res.iterations[1].edit_was_order_change is True
    assert res.iterations[1].predicted_lever == DC.C_DISPENSE_ORDER
    assert res.iterations[0].reanchor_matched == 4 and res.iterations[0].reanchor_total == 6


def test_integration_real_analyze_fn_on_corpus_pair():
    """One end-to-end run using the REAL analyze_iteration_full over a corpus pair,
    with a scripted editor that returns the same wip compile (no real edit). Proves
    the driver drives the real analyze path without error and produces a LoopResult."""
    import pathlib
    FIXC = pathlib.Path(__file__).parent / "fixtures" / "role_identity"
    mp, wp = FIXC / "mnVibration_matched_pcdump.txt", FIXC / "mnVibration_wip_pcdump.txt"
    if not (mp.exists() and wp.exists()):
        pytest.skip("corpus missing")
    fn = "mnVibration_80248644"
    mc = rd.Compile.from_text(mp.read_text(), fn, "")
    wc = rd.Compile.from_text(wp.read_text(), fn, "")
    md = rd.build_descriptors(mc, 0)
    target = rd.build_target_spec(mc, {ig: 13 + i for i, ig in enumerate(list(md)[:6])},
                                  0, "force_proof_proxy", provenance={})
    class _StaticEditor:
        def edit(self, ctx): return cl.EditProposal(new_compile=wc, predicted_lever=ctx.state.fact.case)
    res = cl.run_convergence_loop(fn, target, _StaticEditor(), _Checker(None),
                                  iteration_cap=4, baseline_compile=wc, stall_k=2)
    assert isinstance(res, cl.LoopResult) and res.outcome in set(cl.Outcome)
```

(`rd`/`pytest` already imported at the top of the test file; add if missing.)

- [ ] **Step 2: Run the full loop suite**

Run: `cd tools/melee-agent && timeout 120 python -m pytest tests/test_convergence_loop.py -q --no-cov`
Expected: all pass. If `test_stalled_on_role_gone_storm` mis-fires as CYCLE (a `(id,case)` repeat), adjust the scripted identities so no exact repeat occurs (distinct `identity=i` per step already ensures this) — the intent is STALLED via the non-progress window.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_convergence_loop.py
git commit -m "test(loop): outcome-reachability gate + determinism + log faithfulness + integration"
```

---

## Final verification

- [ ] Focused: `cd tools/melee-agent && timeout 150 python -m pytest tests/test_convergence_loop.py tests/test_convergence_analyze.py tests/test_progress_classifier.py tests/test_role_reanchor.py -q --no-cov` → all pass.
- [ ] Full package suite (regression): `cd tools/melee-agent && python -m pytest -q --no-cov` → no NEW failures vs master. **Note:** master has ONE pre-existing failure unrelated to this work (`test_reference_texts_do_not_emit_removed_debug_commands`, a `debug ceiling` docs-consistency check owned by the concurrent agent). Confirm the count = master baseline + this unit's added tests; do NOT fix that test here. **Do not delete the worktree while the suite runs.**
- [ ] Use superpowers:finishing-a-development-branch.

---

## Notes / deferred (do NOT build here)

- The **real agent-backed `Editor`** (an LLM that reads the fact/lever/source-ideas and edits C source + recompiles) and the **Gate-3 live sweep** + baseline-workflow control.
- **Unit 5** parallel-worktree harness; wall-clock/phase-separated accounting (the `wall_clock` hook exists; the harness supplies the clock).
- **Multi-anchor consensus.**
- `attach_source_ideas_if_available` may be a thin best-effort wrapper (returns the report unchanged when source/pre-pass is unavailable, as in scripted tests); full source wiring is a Gate-3 fidelity concern.
