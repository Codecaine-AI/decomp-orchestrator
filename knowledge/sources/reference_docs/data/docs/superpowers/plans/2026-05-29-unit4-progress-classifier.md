# Unit 4 (first increment) — Progress Classifier + Analyze Step

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify iteration-to-iteration convergence progress — `classify_progress(prev, curr, ...) -> ProgressLabel` — and wire a single `analyze_iteration(target, new_compile, ...)` step (reanchor → first-divergence → build an `IterationState`) so a loop driver can call it. This is the gateable core of Unit 4; the multi-iteration live loop, termination state machine, and parallel harness (Unit 5) are deferred.

**Architecture:** `classify_progress` is a **pure function** over two consecutive `IterationState`s plus the edit's lever type, the per-iteration history, and a checkdiff flag — so it is unit-gateable (Gate 2) without running a live loop. An `IterationState` captures one iteration's first-divergence `AllocatorFact`, the diverging node's *target-role identity* (mapped back via reanchor) and its `role_order_rank`, and which target roles went gone/unstable. `analyze_iteration` is the thin orchestration that produces an `IterationState` from a `TargetSpec` + a fresh compile by reusing `reanchor` and `fd.analyze_first_divergence`. `MOVED_LATER`/`NEW_EARLIER` compare the diverging role's **`role_order_rank`** (stable, from the original target — review #5), never the new compile's `iter_idx`.

**Tech Stack:** Python 3.11, pytest (`--no-cov`, every run under `timeout 120`). Reuses `first_divergence` (`AllocatorFact`, `DivergenceCase`, `FirstDivergenceReport`, `analyze_first_divergence`, `TargetColoring`), `role_reanchor` (`reanchor`, `ReanchorResult`), `role_descriptor` (`Compile`, `TargetSpec`). New code + one additive field on `ReanchorResult`.

---

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/progress_classifier.py` — `ProgressLabel`, `IterationState`, `classify_progress()` (pure). One responsibility: label progress.
- Modify `tools/melee-agent/src/mwcc_debug/role_reanchor.py` — add `matched: dict` (new_ig → original_ig) to `ReanchorResult`, populated in `_confirm_round_trip`. Additive; existing callers/tests keep working.
- Create `tools/melee-agent/src/mwcc_debug/convergence.py` — `analyze_iteration()` (orchestration: reanchor → `analyze_first_divergence` → `IterationState`).
- Create `tools/melee-agent/tests/test_progress_classifier.py` — one test per label + the Gate-2 order-change case.
- Create `tools/melee-agent/tests/test_convergence_analyze.py` — `analyze_iteration` on a corpus pair (real data).

---

## Task 1: ProgressLabel + IterationState + classify_progress (pure cascade)

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/progress_classifier.py`
- Test: `tools/melee-agent/tests/test_progress_classifier.py`

- [ ] **Step 1: Write the failing tests (one per label)**

```python
# tools/melee-agent/tests/test_progress_classifier.py
from src.mwcc_debug import progress_classifier as pc
from src.mwcc_debug.first_divergence import DivergenceCase as DC


def _state(case=DC.B_TARGET_HIGHER, identity=10, rank=5, gone=()):
    """Minimal IterationState; `fact` only needs a `.case` for the classifier."""
    return pc.IterationState(fact=pc.FactView(case=case, ig_idx=99),
                             identity=identity, role_order_rank=rank,
                             gone_roles=frozenset(gone))


def _classify(prev, curr, order_change=False, history=None, checkdiff_clean=False):
    return pc.classify_progress(prev, curr, edit_was_order_change=order_change,
                                history=history or [], checkdiff_clean=checkdiff_clean)


def test_asm_matched_wins():
    assert _classify(_state(), _state(), checkdiff_clean=True) == pc.ProgressLabel.ASM_MATCHED

def test_target_satisfied_on_no_divergence():
    assert _classify(_state(), _state(case=DC.NONE)) == pc.ProgressLabel.TARGET_SATISFIED

def test_role_gone_when_tracked_role_vanishes():
    prev = _state(identity=10)
    curr = _state(identity=11, gone=(10,))            # role 10 (prev's) now gone
    assert _classify(prev, curr) == pc.ProgressLabel.ROLE_GONE

def test_cycle_when_state_revisited_before_prev():
    prev = _state(identity=11, case=DC.A_BLOCKED)
    curr = _state(identity=10, case=DC.B_TARGET_HIGHER)
    history = [(10, DC.B_TARGET_HIGHER), (11, DC.A_BLOCKED)]   # curr's key appeared 2 ago
    assert _classify(prev, curr, history=history) == pc.ProgressLabel.CYCLE

def test_non_comparable_on_order_change_edit():
    assert _classify(_state(rank=3), _state(rank=7),
                     order_change=True) == pc.ProgressLabel.NON_COMPARABLE

def test_non_comparable_without_confident_identity_or_rank():
    assert _classify(_state(), _state(identity=None)) == pc.ProgressLabel.NON_COMPARABLE
    assert _classify(_state(), _state(rank=None)) == pc.ProgressLabel.NON_COMPARABLE

def test_same_when_role_and_case_unchanged():
    assert _classify(_state(identity=10, case=DC.A_BLOCKED, rank=5),
                     _state(identity=10, case=DC.A_BLOCKED, rank=5)) == pc.ProgressLabel.SAME

def test_moved_later_when_diverging_rank_increases():
    assert _classify(_state(rank=3, identity=10), _state(rank=8, identity=20)) == pc.ProgressLabel.MOVED_LATER

def test_new_earlier_when_diverging_rank_decreases():
    assert _classify(_state(rank=8, identity=20), _state(rank=3, identity=10)) == pc.ProgressLabel.NEW_EARLIER
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd tools/melee-agent && python -m pytest tests/test_progress_classifier.py -q --no-cov`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.mwcc_debug.progress_classifier'`.

- [ ] **Step 3: Implement the module + the full cascade**

```python
# tools/melee-agent/src/mwcc_debug/progress_classifier.py
from __future__ import annotations
import enum
from dataclasses import dataclass, field
from typing import Optional
from .first_divergence import DivergenceCase


class ProgressLabel(enum.Enum):
    ASM_MATCHED = "asm_matched"
    TARGET_SATISFIED = "target_satisfied"
    MOVED_LATER = "moved_later"
    NEW_EARLIER = "new_earlier"
    NON_COMPARABLE = "non_comparable"
    SAME = "same"
    ROLE_GONE = "role_gone"
    CYCLE = "cycle"


@dataclass(frozen=True)
class FactView:
    """The slice of an AllocatorFact the classifier needs. analyze_iteration fills
    this from a real fact; tests construct it directly."""
    case: DivergenceCase
    ig_idx: int


@dataclass(frozen=True)
class IterationState:
    fact: FactView
    identity: Optional[int]            # diverging node's target-role id (original_ig), or None
    role_order_rank: Optional[int]     # that role's rank in the original target, or None
    gone_roles: frozenset = field(default_factory=frozenset)  # target roles now gone/unstable


def classify_progress(prev: Optional[IterationState], curr: IterationState, *,
                      edit_was_order_change: bool, history: list, checkdiff_clean: bool
                      ) -> ProgressLabel:
    """Label progress from `prev` to `curr`. `history` is the list of
    (identity, case) keys for every prior iteration INCLUDING prev (so history[-1]
    is prev's key). Priority order is deliberate — see inline rationale."""
    if checkdiff_clean:
        return ProgressLabel.ASM_MATCHED                 # the real win; check first
    if curr.fact.case == DivergenceCase.NONE:
        return ProgressLabel.TARGET_SATISFIED            # proxy caveat noted by caller (review #2)
    if prev is not None and prev.identity is not None and prev.identity in curr.gone_roles:
        return ProgressLabel.ROLE_GONE                   # a tracked target role vanished/destabilized
    key = (curr.identity, curr.fact.case)
    if key in history[:-1]:                              # revisited a state older than prev
        return ProgressLabel.CYCLE
    if edit_was_order_change:
        return ProgressLabel.NON_COMPARABLE              # rank is the edited dimension (Case C/C2)
    if prev is None:
        return ProgressLabel.SAME                        # baseline iteration; no movement yet
    if (curr.identity is None or curr.role_order_rank is None
            or prev.role_order_rank is None):
        return ProgressLabel.NON_COMPARABLE              # no confident identity/comparable rank (review #5)
    if curr.identity == prev.identity and curr.fact.case == prev.fact.case:
        return ProgressLabel.SAME
    if curr.role_order_rank > prev.role_order_rank:
        return ProgressLabel.MOVED_LATER                 # divergence moved to a later-ranked role
    if curr.role_order_rank < prev.role_order_rank:
        return ProgressLabel.NEW_EARLIER
    return ProgressLabel.NON_COMPARABLE                  # same rank, different case: undetermined
```

- [ ] **Step 4: Run; all 9 pass.**

Run: `cd tools/melee-agent && python -m pytest tests/test_progress_classifier.py -q --no-cov`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/progress_classifier.py tools/melee-agent/tests/test_progress_classifier.py
git commit -m "feat(unit4): progress classifier (pure cascade over iteration states)"
```

---

## Task 2: Expose matched pairs on ReanchorResult (additive)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_reanchor.py`
- Test: `tools/melee-agent/tests/test_role_reanchor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reanchor_exposes_matched_new_to_original():
    """ReanchorResult.matched maps new_ig -> original_ig for round-trip-confirmed
    roles, so a loop can identify a diverging node as a specific target role."""
    c = _compile("mnVibration_matched", "mnVibration_80248644")
    descs = rd.build_descriptors(c, 0)
    distinguishable = [ig for ig, d in descs.items() if d.first_def_sig]
    fp = {ig: 13 + (ig % 5) for ig in distinguishable[:6]}
    target = rd.build_target_spec(c, fp, 0, "force_proof_proxy", provenance={"src": "t"})
    res = rr.reanchor(target, c, class_id=0)
    # no-op: each matched new_ig maps back to itself (self-match identity)
    for new_ig in res.force_phys:
        assert res.matched[new_ig] == new_ig
```

(`_compile` already exists in `test_role_reanchor.py` from Unit 3.)

- [ ] **Step 2: Run it (fails: ReanchorResult has no field 'matched')**

Run: `cd tools/melee-agent && python -m pytest tests/test_role_reanchor.py::test_reanchor_exposes_matched_new_to_original -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement (additive)**

In `role_reanchor.py`, add `matched: dict` to `ReanchorResult` and populate it in `_confirm_round_trip`:

```python
@dataclass(frozen=True)
class ReanchorResult:
    class_id: int
    force_phys: dict          # new_ig -> desired_phys (matched + round-trip-confirmed only)
    diagnostics: dict         # original_ig -> status string (everything excluded from the map)
    matched: dict = field(default_factory=dict)   # new_ig -> original_ig (round-trip-confirmed)
```

Re-add the `field` import: `from dataclasses import dataclass, field`. In `_confirm_round_trip`, build and return `matched` alongside force_phys/diagnostics:

```python
def _confirm_round_trip(forward, inverse, desired):
    force_phys, diagnostics, matched = {}, {}, {}
    for orig_ig, m in forward.items():
        if m.status != rm.MatchStatus.MATCHED:
            diagnostics[orig_ig] = m.status.value
            continue
        if orig_ig not in desired:
            diagnostics[orig_ig] = "no_desired_phys"
            continue
        inv = inverse.get(m.new_ig)
        if inv is not None and inv.status == rm.MatchStatus.MATCHED and inv.new_ig == orig_ig:
            force_phys[m.new_ig] = desired[orig_ig]
            matched[m.new_ig] = orig_ig
        else:
            diagnostics[orig_ig] = "unstable_identity"
    return force_phys, diagnostics, matched
```

And update `reanchor_descs` to unpack three values and pass `matched`:

```python
def reanchor_descs(ref, cand, desired, class_id=0, pre_diag=None) -> ReanchorResult:
    forward = rm.match_roles(ref, cand) if ref else {}
    inverse = rm.match_roles(cand, ref) if (cand and ref) else {}
    force_phys, diagnostics, matched = _confirm_round_trip(forward, inverse, desired)
    if pre_diag:
        diagnostics = {**pre_diag, **diagnostics}
    return ReanchorResult(class_id=class_id, force_phys=force_phys,
                          diagnostics=diagnostics, matched=matched)
```

- [ ] **Step 4: Run the full reanchor suite (additive change must not regress)**

Run: `cd tools/melee-agent && timeout 120 python -m pytest tests/test_role_reanchor.py -q --no-cov`
Expected: all pass (the prior tests don't reference `matched`; the new one passes).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_reanchor.py tools/melee-agent/tests/test_role_reanchor.py
git commit -m "feat(reanchor): expose matched new_ig->original_ig pairs for the loop"
```

---

## Task 3: analyze_iteration (reanchor → first-divergence → IterationState)

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/convergence.py`
- Test: `tools/melee-agent/tests/test_convergence_analyze.py`

- [ ] **Step 1: Write the failing test (real corpus pair)**

```python
# tools/melee-agent/tests/test_convergence_analyze.py
import pathlib, pytest
from src.mwcc_debug import role_descriptor as rd
from src.mwcc_debug import convergence as cv
from src.mwcc_debug.progress_classifier import IterationState

FIX = pathlib.Path(__file__).parent / "fixtures" / "role_identity"


def test_analyze_iteration_builds_state_from_corpus_pair():
    """analyze_iteration: build a target from the matched rev, then analyze the
    drifted (wip) compile against it — producing an IterationState whose diverging
    node (if any) is identified as a target role with a role_order_rank."""
    fn = "mnVibration_80248644"
    mp, wp = FIX / "mnVibration_matched_pcdump.txt", FIX / "mnVibration_wip_pcdump.txt"
    if not (mp.exists() and wp.exists()):
        pytest.skip("corpus missing")
    mc = rd.Compile.from_text(mp.read_text(), fn, "")
    wc = rd.Compile.from_text(wp.read_text(), fn, "")
    md = rd.build_descriptors(mc, 0)
    desired = {ig: 13 + i for i, ig in enumerate(list(md)[:6])}
    target = rd.build_target_spec(mc, desired, 0, "force_proof_proxy", provenance={})
    state = cv.analyze_iteration(target, wc, class_id=0)
    assert isinstance(state, IterationState)
    # the diverging node, when present, is mapped to a target role identity (or None
    # when first-divergence reports NONE / a non-target node)
    assert state.fact is not None
    if state.identity is not None:
        assert isinstance(state.role_order_rank, int)
```

- [ ] **Step 2: Run it (fails: no module convergence)**

Run: `cd tools/melee-agent && python -m pytest tests/test_convergence_analyze.py -q --no-cov`
Expected: FAIL.

- [ ] **Step 3: Implement analyze_iteration**

```python
# tools/melee-agent/src/mwcc_debug/convergence.py
from __future__ import annotations
from . import role_reanchor as rr
from . import first_divergence as fd
from .progress_classifier import IterationState, FactView

_GONE_STATUSES = {"gone", "merged", "split", "non_comparable",
                  "unstable_identity", "no_descriptor"}


def analyze_iteration(target, new_compile, class_id: int = 0) -> IterationState:
    """Re-anchor `target` into `new_compile`, run first-divergence on the resulting
    force-phys map, and package the result as an IterationState. The diverging node
    (fact.ig_idx, in the new compile's numbering) is mapped back to its target-role
    identity via the reanchor matched pairs, and that role's role_order_rank is
    looked up from the target spec."""
    res = rr.reanchor(target, new_compile, class_id=class_id)
    gone = frozenset(ig for ig, status in res.diagnostics.items()
                     if status in _GONE_STATUSES)
    rank_by_orig = {r.original_ig: r.role_order_rank for r in target.roles}

    if not res.force_phys:
        # nothing to force -> no meaningful divergence target this iteration
        return IterationState(fact=FactView(case=fd.DivergenceCase.NONE, ig_idx=-1),
                              identity=None, role_order_rank=None, gone_roles=gone)

    coloring = fd.TargetColoring(class_id=class_id, force_phys=res.force_phys)
    report = fd.analyze_first_divergence(new_compile.fev, coloring)
    fact = report.fact
    identity = res.matched.get(fact.ig_idx)            # new_ig -> original target role
    rank = rank_by_orig.get(identity) if identity is not None else None
    return IterationState(fact=FactView(case=fact.case, ig_idx=fact.ig_idx),
                          identity=identity, role_order_rank=rank, gone_roles=gone)
```

- [ ] **Step 4: Run; PASS. Commit.**

```bash
git add tools/melee-agent/src/mwcc_debug/convergence.py tools/melee-agent/tests/test_convergence_analyze.py
git commit -m "feat(unit4): analyze_iteration (reanchor -> first-divergence -> IterationState)"
```

---

## Task 4: Gate 2 — order-change → NON_COMPARABLE + label coverage

**Files:**
- Test: `tools/melee-agent/tests/test_progress_classifier.py`

- [ ] **Step 1: Write the Gate-2 tests**

```python
def test_gate2_order_change_edit_is_non_comparable_even_if_rank_moved():
    """Spec Gate 2 + review #5: when the edit's lever was an order change (Case
    C/C2), rank is the edited dimension, so a rank move is NOT progress — it must
    be NON_COMPARABLE regardless of how rank shifted."""
    moved_later = _classify(_state(rank=2, identity=10), _state(rank=9, identity=20),
                            order_change=True)
    moved_earlier = _classify(_state(rank=9, identity=20), _state(rank=2, identity=10),
                              order_change=True)
    assert moved_later == pc.ProgressLabel.NON_COMPARABLE
    assert moved_earlier == pc.ProgressLabel.NON_COMPARABLE


def test_gate2_every_label_reachable():
    """Coverage: each ProgressLabel is produced by some classifier input, so the
    cascade has no dead branch."""
    seen = set()
    seen.add(_classify(_state(), _state(), checkdiff_clean=True))
    seen.add(_classify(_state(), _state(case=DC.NONE)))
    seen.add(_classify(_state(identity=10), _state(identity=11, gone=(10,))))
    seen.add(_classify(_state(identity=11, case=DC.A_BLOCKED),
                       _state(identity=10, case=DC.B_TARGET_HIGHER),
                       history=[(10, DC.B_TARGET_HIGHER), (11, DC.A_BLOCKED)]))
    seen.add(_classify(_state(), _state(), order_change=True))
    seen.add(_classify(_state(identity=10, case=DC.A_BLOCKED),
                       _state(identity=10, case=DC.A_BLOCKED)))
    seen.add(_classify(_state(rank=3, identity=10), _state(rank=8, identity=20)))
    seen.add(_classify(_state(rank=8, identity=20), _state(rank=3, identity=10)))
    assert seen == set(pc.ProgressLabel)
```

- [ ] **Step 2: Run; both pass (the cascade already implements this).**

Run: `cd tools/melee-agent && python -m pytest tests/test_progress_classifier.py -q --no-cov`
Expected: all pass; `test_gate2_every_label_reachable` confirms all 8 labels are reachable.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_progress_classifier.py
git commit -m "test(unit4): Gate 2 (order-change -> NON_COMPARABLE) + label coverage"
```

---

## Final verification

- [ ] Focused suite: `cd tools/melee-agent && timeout 150 python -m pytest tests/test_progress_classifier.py tests/test_convergence_analyze.py tests/test_role_reanchor.py tests/test_role_identity_gate1.py -q --no-cov` → all pass.
- [ ] Full package suite (regression): `cd tools/melee-agent && python -m pytest -q --no-cov` → no NEW failures vs master. **Note:** master currently has one pre-existing failure unrelated to this work (`test_reference_texts_do_not_emit_removed_debug_commands`, a `debug ceiling` docs-consistency check owned by the concurrent agent) — confirm the count matches master + this unit's added tests, and do not attempt to fix that test here. **Do not delete the worktree while the suite runs.**
- [ ] Use superpowers:finishing-a-development-branch.

---

## Notes / deferred (do NOT build here)

- **The live multi-iteration loop**: termination state machine (ASM_MATCHED / CYCLE / budget), the agent-in-loop edit step, `--source` predicted-lever logging. The classifier + analyze step are the inputs it will drive.
- **Multi-anchor consensus** + `drifted_identity`/`provisional_chained` (Unit 3 deferred these too).
- **Unit 5** parallel-worktree harness + **Gate 3** live convergence sweep with a baseline-workflow control.
- **TARGET_SATISFIED proxy caveat**: the loop driver (not the classifier) must downgrade `TARGET_SATISFIED` to a lead unless `target_kind == matched_natural` or `causal_closure` holds (review #2).
- **`edit_was_order_change` source**: in the live loop this comes from the agent's logged predicted lever; the classifier just consumes the bool.
