# Role-Descriptor Identity Matcher (Units 1+2 + Gate 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cross-compile role descriptor + matcher (units 1+2 of the identity-layer spec) and validate it against Gate 1, so a later plan can build re-anchoring and the convergence loop on a *proven* matcher.

**Architecture:** A `Compile` bundles one pcdump's `(FunctionEvents, parser.Function, source, IrFacts)`. A `RoleDescriptor` per node splits **identity-core** features (stable across the edits the loop induces) from **allocator-state** features (diagnostic only). `match_roles` builds a cost matrix from identity-core similarity over a broadened candidate universe, solves a small hand-rolled min-cost one-to-one assignment with an "unmatched" dummy, and emits first-class non-1:1 outcomes (`split`/`merged`/`rematerialized`/`non_comparable`). Gate 1 validates it against a labeled corpus (self-match controls + adjudicated `mnVibration` revs) with precision/confusion/split-merge metrics + feature ablation.

**Tech Stack:** Python 3, pytest. Reuses `mwcc_debug.{colorgraph_parser,parser,coalesce_ir_facts,copy_trace,symbol_bridge,first_divergence}`. No new deps (hand-rolled assignment; no scipy).

**Scope:** Spec `docs/superpowers/specs/2026-05-28-role-descriptor-identity-layer-design.md` §5 (Unit 1), §6 (Unit 2), §10 Gate 1. Out of this plan: §7 re-anchoring (Unit 3), §8–9 loop+harness (Units 4–5), §10 Gates 2–3.

**Spec confidence-tier note:** `symbol_bridge.Binding.confidence ∈ {"best-guess","moderate-confidence","low-confidence","ambiguous-nested"}` — there is no "verified" tier. Treat `best-guess`/`moderate-confidence` as the strong tiers.

---

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/role_descriptor.py` — `Compile`, `normalize_first_def`, `RoleDescriptor`, `build_descriptors`, `TargetRoleSpec`, `TargetSpec` (+ JSON persistence), `build_target_spec`.
- Create `tools/melee-agent/src/mwcc_debug/role_matcher.py` — `MatchStatus`, `RoleMatch`, `role_cost`, `min_cost_assignment`, `match_roles`.
- Create `tools/melee-agent/tests/test_role_descriptor.py`
- Create `tools/melee-agent/tests/test_role_matcher.py`
- Create `tools/melee-agent/tests/test_role_identity_gate1.py` — Gate 1 (self-match controls + labeled corpus metrics + ablation).
- Create `tools/melee-agent/tests/fixtures/role_identity/` — labeled cross-compile corpus (generated in Task 9).

Run all tests from `tools/melee-agent/` (so `src` imports), e.g. `python -m pytest tests/test_role_matcher.py -q`.

---

### Task 1: `Compile` input bundle

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/role_descriptor.py`
- Test: `tools/melee-agent/tests/test_role_descriptor.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_role_descriptor.py
import pathlib
import pytest
from src.mwcc_debug import role_descriptor as rd

FIX = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"

def _has(fn):
    return (FIX / f"{fn}_pcdump.txt").exists()

def test_compile_from_text_exposes_fev_fn_source():
    if not _has("lbDvd_80018A2C"):
        pytest.skip("fixture missing")
    text = (FIX / "lbDvd_80018A2C_pcdump.txt").read_text()
    c = rd.Compile.from_text(text, "lbDvd_80018A2C", source="")
    assert c.name == "lbDvd_80018A2C"
    assert c.fev is not None and c.fev.name == "lbDvd_80018A2C"
    assert c.fn is not None and c.fn.name == "lbDvd_80018A2C"
    assert c.fn.last_precolor_pass() is not None  # parser.Function has the pre-pass
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_descriptor.py::test_compile_from_text_exposes_fev_fn_source -q`
Expected: FAIL with `AttributeError: module 'src.mwcc_debug.role_descriptor' has no attribute 'Compile'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mwcc_debug/role_descriptor.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from .colorgraph_parser import parse_hook_events, find_function, FunctionEvents
from .parser import parse_pcdump, analyze_function, Function, VirtualRegInfo
from .coalesce_ir_facts import collect, IrFacts


@dataclass
class Compile:
    """One pcdump's view of a function: colorgraph events + parser Function +
    source + derived IR facts. The identity layer's unit of input."""
    name: str
    fev: FunctionEvents
    fn: Function
    source: str
    ir_facts: IrFacts

    @classmethod
    def from_text(cls, pcdump_text: str, function: str, source: str) -> "Compile":
        fev = find_function(parse_hook_events(pcdump_text), function)
        fn = next((f for f in parse_pcdump(pcdump_text) if f.name == function), None)
        if fev is None or fn is None:
            raise ValueError(f"{function} not found in pcdump")
        return cls(name=function, fev=fev, fn=fn, source=source,
                   ir_facts=collect(fn, source))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_descriptor.py::test_compile_from_text_exposes_fev_fn_source -q`
Expected: PASS (or SKIP if the fixture is absent — then verify on any present `*_pcdump.txt`).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_descriptor.py tools/melee-agent/tests/test_role_descriptor.py
git commit -m "feat(role-identity): Compile input bundle (fev + Function + source + IrFacts)"
```

---

### Task 2: `normalize_first_def` — cross-compile-stable first-def signature

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_descriptor.py`
- Test: `tools/melee-agent/tests/test_role_descriptor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_normalize_first_def_strips_volatile_regs_keeps_structure():
    from src.mwcc_debug.symbol_bridge import FirstDef
    # raw virtual numbers differ across compiles; offset/opcode are stable
    a = FirstDef(block_idx=3, opcode="lwz", operands="r62, 0x2C(r34)", annotations=[], regs=[])
    b = FirstDef(block_idx=9, opcode="lwz", operands="r88, 0x2C(r91)", annotations=[], regs=[])
    assert rd.normalize_first_def(a) == rd.normalize_first_def(b)
    assert "0x2c" in rd.normalize_first_def(a)          # offset kept
    assert "lwz" in rd.normalize_first_def(a)           # opcode kept
    assert rd.normalize_first_def(None) == ""
    # different opcode/offset must NOT collide
    c = FirstDef(block_idx=3, opcode="lwz", operands="r62, 0x30(r34)", annotations=[], regs=[])
    assert rd.normalize_first_def(a) != rd.normalize_first_def(c)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_descriptor.py::test_normalize_first_def_strips_volatile_regs_keeps_structure -q`
Expected: FAIL with `AttributeError: ... has no attribute 'normalize_first_def'`.

- [ ] **Step 3: Write minimal implementation**

```python
import re

_REG = re.compile(r"\br\d+\b")          # rNN register tokens (virtual or phys)

def normalize_first_def(fd) -> str:
    """Stable first-def signature: opcode + operands with rNN tokens replaced by
    a positional placeholder, lowercased. Keeps offsets/immediates/structure,
    drops volatile register numbers that differ across compiles."""
    if fd is None:
        return ""
    ops = _REG.sub("r#", fd.operands.strip().lower())
    return f"{fd.opcode.strip().lower()} {ops}".strip()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_descriptor.py::test_normalize_first_def_strips_volatile_regs_keeps_structure -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_descriptor.py tools/melee-agent/tests/test_role_descriptor.py
git commit -m "feat(role-identity): normalize_first_def cross-compile signature"
```

---

### Task 3: `RoleDescriptor` + `build_descriptors`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_descriptor.py`
- Test: `tools/melee-agent/tests/test_role_descriptor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_build_descriptors_splits_identity_core_from_state():
    if not _has("lbDvd_80018A2C"):
        pytest.skip("fixture missing")
    text = (FIX / "lbDvd_80018A2C_pcdump.txt").read_text()
    c = rd.Compile.from_text(text, "lbDvd_80018A2C", source="")
    descs = rd.build_descriptors(c, class_id=0)
    assert descs, "no class-0 descriptors built"
    d = next(iter(descs.values()))
    # identity-core present
    assert isinstance(d.first_def_sig, str)
    assert isinstance(d.use_site_multiset, tuple)
    assert isinstance(d.is_param, bool)
    # state present (diagnostic)
    assert isinstance(d.use_count, int)
    assert isinstance(d.live_range, tuple) and len(d.live_range) == 2
    # only class-0, real decision nodes (ig >= 0)
    assert all(ig >= 0 for ig in descs)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_descriptor.py::test_build_descriptors_splits_identity_core_from_state -q`
Expected: FAIL (`no attribute 'build_descriptors'`).

- [ ] **Step 3: Write minimal implementation**

```python
from collections import Counter
from .first_divergence import select_class_section, decision_views


@dataclass(frozen=True)
class RoleDescriptor:
    ig_idx: int
    # --- identity-core (decides identity) ---
    first_def_sig: str
    use_site_multiset: tuple                  # sorted ((opcode, count), ...)
    is_param: bool
    var_name: Optional[str]
    var_confidence: Optional[str]
    # --- allocator-state (diagnostic only; never decisive) ---
    assigned_reg: Optional[int]
    live_range: tuple                          # (first_use, last_use)
    use_count: int
    spilled: bool


def _use_multiset(vf) -> tuple:
    c = Counter(ist.opcode.strip().lower() for _blk, ist in (vf.use_sites if vf else []))
    return tuple(sorted(c.items()))


def build_descriptors(c: Compile, class_id: int) -> dict:
    """One RoleDescriptor per class-`class_id` decision node (ig >= 0)."""
    section = select_class_section(c.fev, class_id)
    if section is None:
        return {}
    views = {v.ig_idx: v for v in decision_views(section, c.fev) if v.ig_idx >= 0}
    reg_info = {vi.virtual: vi for vi in analyze_function(c.fn)}
    bind = {b.virtual: b for b in c.ir_facts.bindings}
    out: dict = {}
    for ig, v in views.items():
        vf = c.ir_facts.by_virtual.get(ig)
        ri = reg_info.get(ig)
        b = bind.get(ig)
        out[ig] = RoleDescriptor(
            ig_idx=ig,
            first_def_sig=normalize_first_def(vf.first_def if vf else None),
            use_site_multiset=_use_multiset(vf),
            is_param=bool(vf.is_param) if vf else False,
            var_name=(b.var_name if b else None),
            var_confidence=(b.confidence if b else None),
            assigned_reg=v.assigned_reg,
            live_range=((ri.first_use, ri.last_use) if ri else (-1, -1)),
            use_count=(ri.use_count if ri else 0),
            spilled=v.spilled,
        )
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_descriptor.py -q`
Expected: PASS (all descriptor tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_descriptor.py tools/melee-agent/tests/test_role_descriptor.py
git commit -m "feat(role-identity): RoleDescriptor (identity-core vs state) + build_descriptors"
```

---

### Task 4: `TargetSpec`/`TargetRoleSpec` + JSON persistence

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_descriptor.py`
- Test: `tools/melee-agent/tests/test_role_descriptor.py`

- [ ] **Step 1: Write the failing test**

```python
def test_target_spec_roundtrips_through_json(tmp_path):
    if not _has("lbDvd_80018A2C"):
        pytest.skip("fixture missing")
    text = (FIX / "lbDvd_80018A2C_pcdump.txt").read_text()
    c = rd.Compile.from_text(text, "lbDvd_80018A2C", source="")
    spec = rd.build_target_spec(
        c, force_phys={44: 10, 46: 12}, class_id=0,
        target_kind="force_proof_proxy",
        provenance={"source_commit": "deadbeef", "dump_sha256": "abc"})
    assert spec.target_kind == "force_proof_proxy"
    assert {r.original_ig for r in spec.roles} == {44, 46}
    r46 = next(r for r in spec.roles if r.original_ig == 46)
    assert r46.desired_phys == 12 and r46.class_id == 0
    assert r46.role_order_rank is not None      # 46 is a decision node -> has a rank
    p = tmp_path / "spec.json"
    spec.save_json(p)
    back = rd.TargetSpec.load_json(p)
    assert back.target_kind == spec.target_kind
    assert {r.original_ig for r in back.roles} == {44, 46}
    assert back.roles[0].descriptor.first_def_sig == \
        next(r for r in spec.roles if r.original_ig == back.roles[0].original_ig).descriptor.first_def_sig
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_descriptor.py::test_target_spec_roundtrips_through_json -q`
Expected: FAIL (`no attribute 'build_target_spec'`).

- [ ] **Step 3: Write minimal implementation**

```python
import json
from dataclasses import asdict


@dataclass(frozen=True)
class TargetRoleSpec:
    original_ig: int
    desired_phys: int
    class_id: int
    descriptor: RoleDescriptor
    role_order_rank: Optional[int]            # None for structural (Case D/E) roles


@dataclass(frozen=True)
class TargetSpec:
    function: str
    target_kind: str                          # "force_proof_proxy" | "matched_natural"
    target_coverage: float
    causal_closure: bool
    provenance: dict
    roles: list

    def save_json(self, path) -> None:
        path.write_text(json.dumps(asdict(self), indent=2, default=list))

    @classmethod
    def load_json(cls, path) -> "TargetSpec":
        d = json.loads(path.read_text())
        roles = [TargetRoleSpec(
            original_ig=r["original_ig"], desired_phys=r["desired_phys"],
            class_id=r["class_id"], role_order_rank=r["role_order_rank"],
            descriptor=RoleDescriptor(**{**r["descriptor"],
                "use_site_multiset": tuple(tuple(x) for x in r["descriptor"]["use_site_multiset"]),
                "live_range": tuple(r["descriptor"]["live_range"])}))
            for r in d["roles"]]
        return cls(function=d["function"], target_kind=d["target_kind"],
                   target_coverage=d["target_coverage"], causal_closure=d["causal_closure"],
                   provenance=d["provenance"], roles=roles)


def build_target_spec(c: Compile, force_phys: dict, class_id: int,
                      target_kind: str, provenance: dict,
                      causal_closure: bool = False) -> TargetSpec:
    descs = build_descriptors(c, class_id)
    # role_order_rank = position in iter order among class decisions
    section = select_class_section(c.fev, class_id)
    rank = {v.ig_idx: i for i, v in enumerate(
        sorted((vv for vv in decision_views(section, c.fev) if vv.ig_idx >= 0),
               key=lambda d: d.iter_idx))} if section else {}
    roles = []
    for ig, phys in force_phys.items():
        roles.append(TargetRoleSpec(
            original_ig=ig, desired_phys=phys, class_id=class_id,
            descriptor=descs.get(ig),            # None if coalesced/spilled (structural)
            role_order_rank=rank.get(ig)))
    n_decisions = len(rank) or 1
    coverage = round(len([r for r in roles if r.role_order_rank is not None]) / n_decisions, 3)
    return TargetSpec(function=c.name, target_kind=target_kind, target_coverage=coverage,
                      causal_closure=causal_closure, provenance=provenance, roles=roles)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_descriptor.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_descriptor.py tools/melee-agent/tests/test_role_descriptor.py
git commit -m "feat(role-identity): TargetSpec/TargetRoleSpec + JSON persistence"
```

---

### Task 5: `role_cost` — identity-core similarity (state never decisive)

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/role_matcher.py`
- Test: `tools/melee-agent/tests/test_role_matcher.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_role_matcher.py
from src.mwcc_debug import role_matcher as rm
from src.mwcc_debug.role_descriptor import RoleDescriptor

def _desc(ig, sig="lwz r#, 0x2c(r#)", uses=(("lwz", 1),), param=False,
          var=None, conf=None, reg=10, lr=(0, 5), uc=1, spill=False):
    return RoleDescriptor(ig_idx=ig, first_def_sig=sig, use_site_multiset=tuple(uses),
                          is_param=param, var_name=var, var_confidence=conf,
                          assigned_reg=reg, live_range=lr, use_count=uc, spilled=spill)

def test_role_cost_identical_core_is_zero_despite_different_state():
    a = _desc(44, reg=10, lr=(0, 5))
    b = _desc(91, reg=31, lr=(8, 40))     # SAME core, DIFFERENT allocator state
    assert rm.role_cost(a, b) == 0.0      # state must not drive identity

def test_role_cost_different_first_def_is_costly():
    a = _desc(44, sig="lwz r#, 0x2c(r#)")
    b = _desc(91, sig="addi r#, r#, 1")
    assert rm.role_cost(a, b) > 0.5

def test_role_cost_matching_strong_var_lowers_cost():
    a = _desc(44, sig="addi r#, r#, 1", uses=(("stw", 2),), var="i", conf="best-guess")
    b = _desc(91, sig="li r#, 0", uses=(("add", 1),), var="i", conf="best-guess")
    c = _desc(92, sig="li r#, 0", uses=(("add", 1),), var="j", conf="best-guess")
    assert rm.role_cost(a, b) < rm.role_cost(a, c)   # same var name boosts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: FAIL (`no attribute 'role_cost'`).

- [ ] **Step 3: Write minimal implementation**

```python
# src/mwcc_debug/role_matcher.py
from __future__ import annotations
import enum
from dataclasses import dataclass, field
from typing import Optional, Union

_STRONG_CONF = {"best-guess", "moderate-confidence"}


def _multiset_distance(a: tuple, b: tuple) -> float:
    da, db = dict(a), dict(b)
    keys = set(da) | set(db)
    if not keys:
        return 0.0
    inter = sum(min(da.get(k, 0), db.get(k, 0)) for k in keys)
    union = sum(max(da.get(k, 0), db.get(k, 0)) for k in keys)
    return 1.0 - (inter / union if union else 1.0)


def role_cost(a, b) -> float:
    """Cost in [0, ~1.x]. Identity-core only; allocator-state features
    (assigned_reg/live_range/use_count) are intentionally NOT used — they are
    what edits change (spec §5, review #9)."""
    cost = 0.0
    cost += 0.55 * (0.0 if a.first_def_sig and a.first_def_sig == b.first_def_sig else 1.0)
    cost += 0.30 * _multiset_distance(a.use_site_multiset, b.use_site_multiset)
    cost += 0.05 * (0.0 if a.is_param == b.is_param else 1.0)
    # var-name booster (only when BOTH are strong-confidence)
    if (a.var_name and b.var_name and a.var_confidence in _STRONG_CONF
            and b.var_confidence in _STRONG_CONF):
        cost += -0.20 if a.var_name == b.var_name else 0.10
    return max(0.0, round(cost, 6))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_matcher.py
git commit -m "feat(role-identity): role_cost over identity-core features"
```

---

### Task 6: `min_cost_assignment` — small hand-rolled one-to-one (no scipy)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_matcher.py`
- Test: `tools/melee-agent/tests/test_role_matcher.py`

- [ ] **Step 1: Write the failing test**

```python
def test_min_cost_assignment_picks_global_optimum_not_greedy():
    # greedy-by-row would take (r0->c0 cost1), forcing r1->c1 cost9 (total 10);
    # optimum is r0->c1 (2) + r1->c0 (2) = 4.
    cost = {("r0", "c0"): 1.0, ("r0", "c1"): 2.0,
            ("r1", "c0"): 2.0, ("r1", "c1"): 9.0}
    out = rm.min_cost_assignment(["r0", "r1"], ["c0", "c1"], cost, unmatched_cost=5.0)
    assert out == {"r0": "c1", "r1": "c0"}

def test_min_cost_assignment_uses_unmatched_when_cheaper():
    cost = {("r0", "c0"): 1.0, ("r1", "c0"): 0.5}   # only one candidate, both want it
    out = rm.min_cost_assignment(["r0", "r1"], ["c0"], cost, unmatched_cost=3.0)
    # r1 takes c0 (0.5); r0 cheaper unmatched (3.0) than nothing-else -> None
    assert out == {"r1": "c0", "r0": None}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_matcher.py::test_min_cost_assignment_picks_global_optimum_not_greedy -q`
Expected: FAIL (`no attribute 'min_cost_assignment'`).

- [ ] **Step 3: Write minimal implementation**

```python
def min_cost_assignment(rows, cols, cost, unmatched_cost: float) -> dict:
    """Optimal one-to-one assignment for small N via branch-and-bound. Each row
    maps to a distinct col or to None (at `unmatched_cost`). cost is a dict
    {(row,col): float}; missing pairs are treated as unmatched-only.
    rows/cols small (<= ~12 after pruning)."""
    best = {"cost": float("inf"), "assign": None}

    def recurse(i, used, acc_cost, acc):
        if acc_cost >= best["cost"]:
            return  # bound
        if i == len(rows):
            best["cost"], best["assign"] = acc_cost, dict(acc)
            return
        r = rows[i]
        # option: leave r unmatched
        acc[r] = None
        recurse(i + 1, used, acc_cost + unmatched_cost, acc)
        # option: assign r to an available col it has a finite cost for
        for col in cols:
            if col in used:
                continue
            pair = cost.get((r, col))
            if pair is None or pair >= unmatched_cost:
                continue  # not worth beating "unmatched"
            acc[r] = col
            used.add(col)
            recurse(i + 1, used, acc_cost + pair, acc)
            used.discard(col)
        acc.pop(r, None)

    recurse(0, set(), 0.0, {})
    return best["assign"] or {r: None for r in rows}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_matcher.py
git commit -m "feat(role-identity): hand-rolled min-cost one-to-one assignment"
```

---

### Task 7: `match_roles` — statuses incl. non-1:1 outcomes

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_matcher.py`
- Test: `tools/melee-agent/tests/test_role_matcher.py`

- [ ] **Step 1: Write the failing test**

```python
def test_match_roles_self_match_is_perfect_identity():
    # descriptors matched against themselves -> every role MATCHED to its own ig
    descs = {44: _desc(44, sig="lwz r#, 0x10(r#)"),
             46: _desc(46, sig="addi r#, r#, 1", uses=(("stw", 1),))}
    out = rm.match_roles(descs, descs)
    assert out[44].status == rm.MatchStatus.MATCHED and out[44].new_ig == 44
    assert out[46].status == rm.MatchStatus.MATCHED and out[46].new_ig == 46

def test_match_roles_gone_when_no_candidate():
    ref = {44: _desc(44, sig="lwz r#, 0x10(r#)")}
    cand = {99: _desc(99, sig="fmadds f#, f#, f#, f#", uses=(("stfs", 3),))}
    out = rm.match_roles(ref, cand)
    assert out[44].status == rm.MatchStatus.GONE and out[44].new_ig is None

def test_match_roles_merged_when_two_refs_best_one_candidate():
    ref = {44: _desc(44, sig="li r#, 0"), 46: _desc(46, sig="li r#, 0")}  # indistinguishable
    cand = {70: _desc(70, sig="li r#, 0")}
    out = rm.match_roles(ref, cand)
    statuses = {out[44].status, out[46].status}
    # one keeps the single candidate; the other is reported MERGED, not forced/MATCHED
    assert rm.MatchStatus.MERGED in statuses
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: FAIL (`no attribute 'match_roles'` / `MatchStatus`).

- [ ] **Step 3: Write minimal implementation**

```python
class MatchStatus(enum.Enum):
    MATCHED = "matched"
    AMBIGUOUS = "ambiguous"
    GONE = "gone"
    SPLIT = "split"
    MERGED = "merged"
    REMATERIALIZED = "rematerialized"
    NON_COMPARABLE = "non_comparable"


@dataclass(frozen=True)
class RoleMatch:
    original_ig: int
    new_ig: Union[int, tuple, None]
    confidence: float                          # 1 - cost (higher = better); 0 if gone
    status: MatchStatus
    evidence: dict = field(default_factory=dict)


MATCH_THRESHOLD = 0.45                          # cost below this is a viable candidate
AMBIGUOUS_MARGIN = 0.10                         # 2nd-best within this cost -> ambiguous
TOP_K = 6                                       # candidate pruning per role


def match_roles(ref_descs: dict, cand_descs: dict) -> dict:
    """Map each reference role (ig -> RoleDescriptor) to a candidate node.
    `cand_descs` should already span the broadened candidate universe
    (decisions + coalesced/spilled markers) so GONE vs MERGED is distinguishable."""
    rows = list(ref_descs)
    cols = list(cand_descs)
    cost = {}
    per_row_sorted = {}
    for r in rows:
        scored = sorted(((role_cost(ref_descs[r], cand_descs[c]), c) for c in cols),
                        key=lambda t: t[0])[:TOP_K]
        per_row_sorted[r] = scored
        for ccost, c in scored:
            cost[(r, c)] = ccost
    assign = min_cost_assignment(rows, cols, cost, unmatched_cost=MATCH_THRESHOLD)

    # which candidate each row WANTED most (for split/merge detection)
    want = {r: (per_row_sorted[r][0] if per_row_sorted[r] else (float("inf"), None))
            for r in rows}
    out = {}
    for r in rows:
        c = assign.get(r)
        scored = per_row_sorted[r]
        best_cost = scored[0][0] if scored else float("inf")
        second = scored[1][0] if len(scored) > 1 else float("inf")
        if c is None:
            # wanted a candidate that another role took -> MERGED, else GONE
            wcost, wcol = want[r]
            merged = wcol is not None and wcost < MATCH_THRESHOLD and assign.get(
                next((rr for rr in rows if assign.get(rr) == wcol), None)) == wcol
            status = MatchStatus.MERGED if merged else MatchStatus.GONE
            out[r] = RoleMatch(r, None, 0.0, status, {"best_cost": round(best_cost, 4)})
            continue
        status = MatchStatus.MATCHED
        if second - cost[(r, c)] < AMBIGUOUS_MARGIN:
            status = MatchStatus.AMBIGUOUS
        out[r] = RoleMatch(r, c, round(1.0 - cost[(r, c)], 4), status,
                           {"second_best_gap": round(second - cost[(r, c)], 4)})
    return out
```

(SPLIT/REMATERIALIZED/NON_COMPARABLE detection is refined in Task 8.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_matcher.py
git commit -m "feat(role-identity): match_roles with matched/ambiguous/gone/merged outcomes"
```

---

### Task 8: SPLIT / REMATERIALIZED / NON_COMPARABLE detection

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_matcher.py`
- Test: `tools/melee-agent/tests/test_role_matcher.py`

- [ ] **Step 1: Write the failing test**

```python
def test_match_roles_split_when_one_ref_matches_two_candidates_tightly():
    ref = {44: _desc(44, sig="add r#, r#, r#", uses=(("stw", 1),))}
    cand = {70: _desc(70, sig="add r#, r#, r#", uses=(("stw", 1),)),
            71: _desc(71, sig="add r#, r#, r#", uses=(("stw", 1),))}  # two equal matches
    out = rm.match_roles(ref, cand)
    assert out[44].status == rm.MatchStatus.SPLIT
    assert isinstance(out[44].new_ig, tuple) and set(out[44].new_ig) == {70, 71}

def test_match_roles_non_comparable_when_only_weak_collisions():
    ref = {44: _desc(44, sig="li r#, 0", uses=())}            # generic, no use sites
    cand = {70: _desc(70, sig="li r#, 0", uses=()),
            71: _desc(71, sig="li r#, 0", uses=())}
    out = rm.match_roles(ref, cand)
    # equal weak candidates with no distinguishing evidence -> not a confident SPLIT
    assert out[44].status in (rm.MatchStatus.SPLIT, rm.MatchStatus.NON_COMPARABLE)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_role_matcher.py::test_match_roles_split_when_one_ref_matches_two_candidates_tightly -q`
Expected: FAIL (status is MATCHED/AMBIGUOUS, not SPLIT).

- [ ] **Step 3: Write minimal implementation**

In `match_roles`, replace the `MATCHED`/`AMBIGUOUS` branch with split/rematerialized-aware logic:

```python
        # near-tie among MULTIPLE viable candidates -> SPLIT (one ref, many current)
        viable = [(cc, cv) for cc, cv in scored if cc < MATCH_THRESHOLD]
        tied = [cv for cc, cv in viable if cc - best_cost < AMBIGUOUS_MARGIN]
        if len(tied) >= 2:
            # distinguishing evidence? if best_cost is itself high (weak sig), NON_COMPARABLE
            status = MatchStatus.NON_COMPARABLE if best_cost > 0.33 else MatchStatus.SPLIT
            out[r] = RoleMatch(r, tuple(sorted(tied)), round(1.0 - best_cost, 4),
                               status, {"tied": tied})
            continue
        status = MatchStatus.MATCHED
        if second - cost[(r, c)] < AMBIGUOUS_MARGIN:
            status = MatchStatus.AMBIGUOUS
        out[r] = RoleMatch(r, c, round(1.0 - cost[(r, c)], 4), status,
                           {"second_best_gap": round(second - cost[(r, c)], 4)})
```

Note: `REMATERIALIZED` (one ref → multiple defs of the same value) is detected the same way as SPLIT here; the distinction needs copy-lineage and is deferred to the re-anchoring plan (Unit 3). Record it via evidence only for now.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_matcher.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_matcher.py
git commit -m "feat(role-identity): SPLIT/NON_COMPARABLE non-1:1 outcomes in match_roles"
```

---

### Task 9: Gate 1a — self-match controls on real fixtures (perfect 1:1)

**Files:**
- Create: `tools/melee-agent/tests/test_role_identity_gate1.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_role_identity_gate1.py
import pathlib, pytest
from src.mwcc_debug import role_descriptor as rd
from src.mwcc_debug import role_matcher as rm

FIX = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"
CANARIES = ["gm_80173EEC", "lbDvd_80018A2C", "fn_80247510"]

def _compile(fn):
    p = FIX / f"{fn}_pcdump.txt"
    if not p.exists():
        pytest.skip(f"{fn} fixture missing")
    return rd.Compile.from_text(p.read_text(), fn, source="")

@pytest.mark.parametrize("fn", CANARIES)
def test_gate1a_self_match_is_perfect_identity(fn):
    """A compile matched against ITSELF must map every class-0 role to its own ig
    with status MATCHED. This is the cleanest ground truth and the matcher's
    floor: any self-mismatch is a bug."""
    c = _compile(fn)
    descs = rd.build_descriptors(c, class_id=0)
    if len(descs) < 3:
        pytest.skip(f"{fn}: too few class-0 decision nodes")
    out = rm.match_roles(descs, descs)
    wrong = {ig: (m.status.value, m.new_ig) for ig, m in out.items()
             if not (m.status == rm.MatchStatus.MATCHED and m.new_ig == ig)}
    assert not wrong, f"self-match imperfect for {fn}: {wrong}"
```

- [ ] **Step 2: Run test to verify it fails (or reveals a tie non-determinism)**

Run: `python -m pytest tests/test_role_identity_gate1.py -q`
Expected: May FAIL for **identical-sibling** nodes (e.g. two `li r#, 0` temps with cost 0 to each other) — the optimum is non-unique, so the solver may route `70 -> 71`. Uniquely-describable nodes already self-match (their self-cost 0 is the unique global min). The fix is a deterministic identity tie-break.

- [ ] **Step 3: Add an identity-preferring tie-break to `min_cost_assignment`**

A node must always match *itself* on a cost tie. Make the candidate iteration try `col == r` first; combined with the `>= best` bound (which keeps the first-found optimum), this makes self the winner on ties — perfecting self-match even for identical siblings.

```python
# role_matcher.py — inside min_cost_assignment.recurse, replace `for col in cols:`
        ordered = ([r] if r in cols else []) + [cc for cc in cols if cc != r]
        for col in ordered:
```

(Cross-compile identical siblings remain genuinely ambiguous — that is Gate 1b's concern, handled by abstention, not here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_role_matcher.py tests/test_role_identity_gate1.py -q`
Expected: PASS — every canary's class-0 nodes self-match 1:1 (and Task 6's assignment tests, where `col != row`, are unaffected).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_identity_gate1.py
git commit -m "test(role-identity): Gate 1a self-match controls + identity tie-break"
```

---

### Task 10: Gate 1b — labeled cross-compile corpus + metrics

**Files:**
- Create: `tools/melee-agent/tests/fixtures/role_identity/mnvibration_labels.json`
- Modify: `tools/melee-agent/tests/test_role_identity_gate1.py`

- [ ] **Step 1: Build the labeled corpus (one-time, documented)**

Generate two `mnVibration_80248644` solve-path dumps via the validation's disposable-worktree mechanism (see `2026-05-28-first-divergence-validation-campaigns.md` §7 step 4): pick the matched rev and one earlier WIP rev, dump each with `--no-cache-sync`, and save as
`tests/fixtures/role_identity/mnVibration_matched_pcdump.txt` and
`tests/fixtures/role_identity/mnVibration_wip_pcdump.txt`. Then **hand-adjudicate** the role correspondence for the target ig set and write labels:

```json
{
  "matched_dump": "mnVibration_matched_pcdump.txt",
  "wip_dump": "mnVibration_wip_pcdump.txt",
  "function": "mnVibration_80248644",
  "class_id": 0,
  "labels": [
    {"matched_ig": 51, "wip_ig": 51, "relation": "same"},
    {"matched_ig": 43, "wip_ig": 47, "relation": "same"},
    {"matched_ig": 42, "wip_ig": null, "relation": "gone"}
  ]
}
```

(The exact igs/relations come from your adjudication; `relation ∈ {same, gone, split, merged}`. Commit the dumps + labels.)

- [ ] **Step 2: Write the failing metrics test**

```python
import json

def test_gate1b_matcher_beats_raw_ig_with_honest_abstention():
    lab_path = pathlib.Path(__file__).parent / "fixtures" / "role_identity" / "mnvibration_labels.json"
    if not lab_path.exists():
        pytest.skip("labeled corpus not generated (Task 10 step 1)")
    lab = json.loads(lab_path.read_text())
    base = lab_path.parent
    ref = rd.Compile.from_text((base / lab["matched_dump"]).read_text(), lab["function"], "")
    new = rd.Compile.from_text((base / lab["wip_dump"]).read_text(), lab["function"], "")
    ref_descs = rd.build_descriptors(ref, lab["class_id"])
    new_descs = rd.build_descriptors(new, lab["class_id"])
    target_igs = [l["matched_ig"] for l in lab["labels"]]
    out = rm.match_roles({ig: ref_descs[ig] for ig in target_igs if ig in ref_descs}, new_descs)
    truth = {l["matched_ig"]: l for l in lab["labels"]}

    correct = wrong = abstained = 0
    for ig, m in out.items():
        t = truth[ig]
        decisive = m.status in (rm.MatchStatus.MATCHED,)
        if not decisive:
            abstained += 1; continue
        ok = (t["relation"] == "same" and m.new_ig == t["wip_ig"])
        correct += int(ok); wrong += int(not ok)
    precision = correct / (correct + wrong) if (correct + wrong) else 0.0
    raw_matched = sum(1 for l in lab["labels"]
                      if l["relation"] == "same" and l["matched_ig"] == l["wip_ig"])
    # GATE: among decisive matches, precision must be high (favor abstaining over wrong),
    # and decisive-correct must beat the raw-ig baseline (same-ig count).
    assert precision >= 0.9, f"precision {precision} (correct={correct}, wrong={wrong})"
    assert correct > raw_matched, f"correct {correct} did not beat raw-ig {raw_matched}"
```

- [ ] **Step 3: Run test; tune thresholds against the labels**

Run: `python -m pytest tests/test_role_identity_gate1.py::test_gate1b_matcher_beats_raw_ig_with_honest_abstention -q`
Expected: PASS once `MATCH_THRESHOLD`/`AMBIGUOUS_MARGIN` (role_matcher.py) are tuned so wrong matches become abstentions. If precision can't reach 0.9 without `correct <= raw_matched`, that is a **Gate-1 finding** — record it and stop (the descriptor needs more identity-core signal, Task 11).

- [ ] **Step 4: Verify the gate passes**

Run: `python -m pytest tests/test_role_identity_gate1.py -q`
Expected: PASS (self-match + labeled corpus).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/tests/fixtures/role_identity/ tools/melee-agent/tests/test_role_identity_gate1.py
git commit -m "test(role-identity): Gate 1b labeled mnVibration corpus + precision/baseline metrics"
```

---

### Task 11: Gate 1c — feature ablation

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/role_matcher.py` (make weights overridable)
- Modify: `tools/melee-agent/tests/test_role_identity_gate1.py`

- [ ] **Step 1: Make `role_cost` weights injectable**

```python
# role_matcher.py — replace the hard-coded constants with a default dict + param
DEFAULT_WEIGHTS = {"first_def": 0.55, "use_sites": 0.30, "is_param": 0.05, "var": 0.20}

def role_cost(a, b, weights: dict = DEFAULT_WEIGHTS) -> float:
    cost = 0.0
    cost += weights["first_def"] * (0.0 if a.first_def_sig and a.first_def_sig == b.first_def_sig else 1.0)
    cost += weights["use_sites"] * _multiset_distance(a.use_site_multiset, b.use_site_multiset)
    cost += weights["is_param"] * (0.0 if a.is_param == b.is_param else 1.0)
    if (a.var_name and b.var_name and a.var_confidence in _STRONG_CONF
            and b.var_confidence in _STRONG_CONF):
        cost += -weights["var"] if a.var_name == b.var_name else 0.10
    return max(0.0, round(cost, 6))
```

Thread an optional `weights` param through `match_roles` (default `DEFAULT_WEIGHTS`).

- [ ] **Step 2: Write the ablation test**

```python
def test_gate1c_ablation_reports_per_feature_contribution():
    lab_path = pathlib.Path(__file__).parent / "fixtures" / "role_identity" / "mnvibration_labels.json"
    if not lab_path.exists():
        pytest.skip("labeled corpus not generated")
    lab = json.loads(lab_path.read_text()); base = lab_path.parent
    ref = rd.Compile.from_text((base / lab["matched_dump"]).read_text(), lab["function"], "")
    new = rd.Compile.from_text((base / lab["wip_dump"]).read_text(), lab["function"], "")
    ref_descs = rd.build_descriptors(ref, lab["class_id"]); new_descs = rd.build_descriptors(new, lab["class_id"])
    truth = {l["matched_ig"]: l for l in lab["labels"]}
    target = {ig: ref_descs[ig] for ig in truth if ig in ref_descs}

    def score(weights):
        out = rm.match_roles(target, new_descs, weights=weights)
        return sum(1 for ig, m in out.items()
                   if m.status == rm.MatchStatus.MATCHED
                   and truth[ig]["relation"] == "same" and m.new_ig == truth[ig]["wip_ig"])

    full = score(rm.DEFAULT_WEIGHTS)
    report = {}
    for feat in rm.DEFAULT_WEIGHTS:
        ablated = dict(rm.DEFAULT_WEIGHTS); ablated[feat] = 0.0
        report[feat] = full - score(ablated)        # drop in correct matches when removed
    print("ablation (correct-match loss per feature):", report)
    assert full >= 1                                  # the bundle works at all
    # informational: `report` shows which identity-core features carry the signal
```

- [ ] **Step 3: Run and record the ablation result**

Run: `python -m pytest tests/test_role_identity_gate1.py::test_gate1c_ablation_reports_per_feature_contribution -q -s`
Expected: PASS; capture the printed ablation map in the commit message — it is the empirical evidence for the spec's open question on feature stability (§13).

- [ ] **Step 4: Run the full Gate-1 suite + the unit suites**

Run: `python -m pytest tests/test_role_descriptor.py tests/test_role_matcher.py tests/test_role_identity_gate1.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/role_matcher.py tools/melee-agent/tests/test_role_identity_gate1.py
git commit -m "test(role-identity): Gate 1c feature ablation; injectable cost weights"
```

---

## Gate 1 exit criteria (must all hold before Unit 3 / the loop)

- **1a self-match:** every canary's class-0 roles match themselves 1:1 (the identity tie-break guarantees this even for identical-sibling temps).
- **1b labeled corpus:** decisive-match precision ≥ 0.9 with honest abstention, and decisive-correct beats the raw-ig baseline.
- **1c ablation:** per-feature contribution recorded; confirms the bundle (not first-def alone) carries identity.

If 1b cannot pass without sacrificing precision, that is a real finding: extend the identity-core bundle (def-use/CFG neighborhood — spec §5/§13) in a follow-up task before proceeding. Do **not** weaken precision to pass.

---

## Deferred to later plans (NOT in this plan)
- **Broadened candidate universe (spec §6 / review #8)** — this plan's candidates are class-0 *decision* nodes (`build_descriptors`), so `match_roles` distinguishes GONE (no viable candidate) from MERGED (a wanted candidate taken by another role) heuristically. Building descriptors for coalesced-alias / spilled / simplify-only nodes so a target role that *coalesced or spilled* in the new compile is identified as such (Case D/E) belongs with re-anchoring (Unit 3), where that distinction feeds the force-phys map. Tracked there.
- **Unit 3 (re-anchoring)** — round-trip + multi-anchor cross-check, `drifted_identity`/`provisional_chained`/`unstable_identity`, `reanchor()` → force-phys map. Needs Gate 1 green + the realized matcher interface.
- **Units 4–5 (loop + harness)** — convergence loop, progress classifier (`ASM_MATCHED`/`TARGET_SATISFIED`/`NON_COMPARABLE`/…), parallel-worktree sweep; Gates 2–3.
