# First-Divergence Analyzer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a same-source allocator-state replayer + first-divergence classifier that, given a baseline pcdump and a force-phys target map, emits the single earliest diverging allocator decision, explains it mechanically, and attaches advisory source ideas.

**Architecture:** A new pure-Python core module (`first_divergence.py`) reads the structured colorgraph events from `colorgraph_parser.parse_hook_events`, runs a target-identity pre-pass (Step 1a: detect coalesced/spilled/absent target nodes), then a register-choice walk (Step 1b), reconstructs allocator state by *replaying recorded decisions in real iteration order* (Step 2: volatile pool + fixed blockers + working mask, with cap-hit fail-closed), classifies the divergence (Cases A/B/B-inverse/C/C2/D/E/absent), and derives a local structural target (Step 3). A separate advisory function attaches symbol-bridge source ideas (Step 4/5). A `debug inspect first-divergence` CLI command wires it up. Two same-source acceptance gates validate it: Check 1 (replay reproduces the *recorded* coloring on a dispense+reuse fixture) and Check 2 (reproduces gm's Case D and lbDvd's register-choice first divergence).

**Tech Stack:** Python 3, Typer CLI, pytest. Reuses `src/mwcc_debug/colorgraph_parser.py` (hook-event parser), `src/mwcc_debug/simulator.py` (register-set constants only), `src/mwcc_debug/simplify_order_scoring.py` (force-phys / polarity helpers), `src/mwcc_debug/symbol_bridge.py` (advisory layer).

---

## Reusable infrastructure (already on master — import, don't reinvent)

All paths relative to `tools/melee-agent/`.

**`src/mwcc_debug/colorgraph_parser.py`** — the structured hook-event parser (USE THIS, not `parser.py`):
- `parse_hook_events(text: str) -> list[FunctionEvents]`
- `find_function(events: list[FunctionEvents], name: str) -> Optional[FunctionEvents]`
- `FunctionEvents`: `.name`, `.colorgraph_sections`, `.ig_events`, `.cp_events`, `.simplify_sections`, `.coalesce_sections`, `.coalesced_alias_sections`
- `ColorgraphSection`: `.class_id`, `.result`, `.n_nodes`, `.decisions: list[ColorgraphDecision]`
- `ColorgraphDecision`: `.iter_idx`, `.ig_idx` (`-1` if not in IG), `.assigned_reg`, `.degree`, `.n_interferers` (TRUE original count), `.flags` (bit0 = spilled), `.interferers: list[tuple[int, int]]` = `(interferer_ig_idx, that_node_assigned_reg)`
- **Cap-hit signal:** `len(decision.interferers) < decision.n_interferers` means the dump truncated the row (silent — there is no flag). This is the "fail closed" trigger.
- `SimplifySection`: `.class_id`, `.entries: list[SimplifyEntry]`; `SimplifyEntry`: `.iter_idx`, `.ig_idx` (`-1` = physical-reg node), `.spilled: bool`
- `CoalesceSection`: `.class_id`, `.mappings: list[tuple[int, int]]` = `(alias_ig, root_ig)`
- `CoalescedAliasSection`: `.class_id`, `.aliases: list[tuple[int, int, int]]` = `(alias_idx, root_idx, root_phys)`
- **Register class:** `class_id == 0` is GPR, `class_id == 1` is FPR. gm and lbDvd targets are class 0.

**`src/mwcc_debug/simulator.py`** — import the register-set CONSTANTS ONLY (do NOT use `simulate_function`; it approximates iteration order, ~30% match, and is explicitly not a per-iteration oracle):
- `INITIAL_VOLATILE_REGS = {3, 4, 5, 6, 7, 8, 9, 10, 11, 12}` (caller-save pool)
- `RESERVED_REGS = {1, 2}`
- `NONVOLATILE_ALLOC_ORDER = [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13]` (top-down dispense)

**`src/mwcc_debug/symbol_bridge.py`** — advisory layer (Task 9 only):
- `list_bindings(source: str, fn, pre_pass) -> list[Binding]`
- `Binding`: `.var_name`, `.virtual` (`-1` if unmapped), `.decl_line`, `.kind`, `.type_str`, `.confidence: str` (`"verified"|"best-guess"|"low-confidence"|"ambiguous"|"ambiguous-nested"|...`), `.scope_path: tuple[str, ...]`
- Note: there is NO ig_idx→var ranked-alternates helper; Task 9 builds one by filtering `list_bindings` on `.virtual`.

**CLI pattern** (`src/cli/debug.py`, Typer): sub-group apps (`inspect_app`, etc.) are defined near line 110 and attached via `debug_app.add_typer(...)` near line 135. Mirror the existing `@inspect_app.command("simulate")` handler (around line 793): params are `Annotated[T, typer.Option("--x", "-x")]` / `typer.Argument(...)`; heavy imports are lazy (inside the handler); errors raise `typer.Exit(code)` / `typer.BadParameter(...)`.

**Tests:** live in `tools/melee-agent/tests/`. Run from `tools/melee-agent/` (cwd matters — `pyproject.toml` injects `--cov=src`). Single file: `pytest tests/test_first_divergence.py -v`. Import app code as `from src.mwcc_debug... import ...`. Fixtures live in `tests/fixtures/mwcc_debug/*.txt`; the convention is a module-level `FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"` constant and `pytest.skip(...)` if a file is absent.

---

## File Structure

- **Create** `tools/melee-agent/src/mwcc_debug/first_divergence.py` — the analyzer. Pure functions + dataclasses; the only parser-coupled code is one adapter (`decision_views`). Sole responsibility: baseline events + target map → `FirstDivergenceReport`.
- **Modify** `tools/melee-agent/src/cli/debug.py` — add one `@inspect_app.command("first-divergence")` handler (lazy-imports `first_divergence`).
- **Create** `tools/melee-agent/tests/test_first_divergence.py` — unit tests for the pure core (Tasks 1-9).
- **Create** `tools/melee-agent/tests/test_first_divergence_replay.py` — Check 1 (Task 11).
- **Create** `tools/melee-agent/tests/test_first_divergence_gm_lbdvd.py` — Check 2 (Task 12).
- **Create** `tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt`, `lbDvd_80018A2C_pcdump.txt` — generated in Task 12.
- **Modify** `.claude/skills/mwcc-debug/SKILL.md` — document the command (Task 13; the file is gitignored — stage with `git add -f`).

### Internal API (defined in Task 1, referenced consistently throughout)

```python
class DecisionView(NamedTuple):
    ig_idx: int
    iter_idx: int
    assigned_reg: int
    n_interferers: int                       # true count (for cap detection)
    interferers: tuple[tuple[int, int], ...] # (interferer_ig_idx, its_assigned_reg)
    spilled: bool

class DivergenceCase(enum.Enum):
    A_BLOCKED = "A"
    B_TARGET_HIGHER = "B"
    B_INVERSE = "B-inverse"
    C_DISPENSE_ORDER = "C"
    C2_STICKY_POOL = "C2"
    D_COALESCED = "D"
    E_SPILLED = "E"
    ABSENT = "absent"
    ABSTAINED = "abstained"  # cap-hit / incomplete data — refused to classify
    NONE = "none"          # every target node already on-target

@dataclass(frozen=True)
class TargetColoring:
    class_id: int
    force_phys: Mapping[int, int]    # ig_idx -> target physical; KEYS are the identity set

@dataclass(frozen=True)
class ReplayStep:
    ig_idx: int
    iter_idx: int
    working_mask: frozenset[int]
    predicted_reg: int
    dispensed: bool
    cap_hit: bool
    blockers: frozenset[int]

@dataclass(frozen=True)
class AllocatorFact:                 # the GATED layer
    class_id: int
    ig_idx: int
    case: DivergenceCase
    iter_idx: Optional[int]          # None for pre-walk structural cases
    baseline_reg: Optional[int]
    target_reg: Optional[int]
    coalesced_nodes: tuple[int, ...] # Case D: all target nodes sharing this coalesce
    coalesced_root: Optional[int]
    coalesced_root_phys: Optional[int]
    blocker_ig: Optional[int]        # Case A: interferer holding r_target
    blocker_dependency: bool         # Case A: that interferer is itself off-target
    working_mask: Optional[frozenset[int]]
    cap_hit: bool
    earlier_unmapped_warning: bool   # partial-map caveat
    local_target: str

@dataclass(frozen=True)
class SourceIdea:                    # the ADVISORY layer (never gated)
    ig_idx: int
    var_name: Optional[str]
    confidence: Optional[str]
    alternates: tuple[str, ...]
    ideas: tuple[str, ...]

@dataclass(frozen=True)
class FirstDivergenceReport:
    fact: AllocatorFact
    source: Optional[SourceIdea]     # None unless the advisory layer ran
```

---

### Task 1: Module skeleton — data model + parser adapter

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

- [ ] **Step 1: Confirm the parser dataclass field names**

Run: `cd tools/melee-agent && grep -nE "class (ColorgraphDecision|ColorgraphSection|SimplifyEntry|SimplifySection|CoalescedAliasSection|CoalesceSection|FunctionEvents)\b" src/mwcc_debug/colorgraph_parser.py`
Expected: the 7 dataclasses listed in "Reusable infrastructure" above. Read each to confirm `.iter_idx`, `.ig_idx`, `.assigned_reg`, `.n_interferers`, `.flags`, `.interferers`, `.spilled` exist as documented. (The adapter in Step 3 is the ONLY code coupled to these names; if any differ, fix the adapter only.)

- [ ] **Step 2: Write the failing test**

```python
# tools/melee-agent/tests/test_first_divergence.py
from src.mwcc_debug import first_divergence as fd


def test_decision_view_reports_cap_hit():
    full = fd.DecisionView(ig_idx=5, iter_idx=0, assigned_reg=3,
                           n_interferers=2, interferers=((4, 9), (6, 10)), spilled=False)
    capped = fd.DecisionView(ig_idx=7, iter_idx=1, assigned_reg=4,
                             n_interferers=82, interferers=((4, 9),), spilled=False)
    assert fd.is_cap_hit(full) is False
    assert fd.is_cap_hit(capped) is True


def test_divergence_case_enum_values():
    assert fd.DivergenceCase.D_COALESCED.value == "D"
    assert fd.DivergenceCase.B_INVERSE.value == "B-inverse"
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError: module ... has no attribute 'DecisionView'`.

- [ ] **Step 4: Write the minimal implementation**

```python
# tools/melee-agent/src/mwcc_debug/first_divergence.py
"""First-divergence analyzer (v1, same-source).

Reads structured colorgraph events (colorgraph_parser.parse_hook_events) and a
force-phys target map, finds the earliest allocator decision that diverges from
target, explains it mechanically, and (optionally) attaches advisory source
ideas. See docs/superpowers/specs/2026-05-27-first-divergence-analyzer-design.md.

Only `decision_views` is coupled to the parser dataclasses; everything else
operates on the local DecisionView so the logic is unit-testable in isolation.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Mapping, NamedTuple, Optional


class DecisionView(NamedTuple):
    ig_idx: int
    iter_idx: int
    assigned_reg: int
    n_interferers: int
    interferers: tuple[tuple[int, int], ...]
    spilled: bool


class DivergenceCase(enum.Enum):
    A_BLOCKED = "A"
    B_TARGET_HIGHER = "B"
    B_INVERSE = "B-inverse"
    C_DISPENSE_ORDER = "C"
    C2_STICKY_POOL = "C2"
    D_COALESCED = "D"
    E_SPILLED = "E"
    ABSENT = "absent"
    ABSTAINED = "abstained"
    NONE = "none"


def is_cap_hit(view: DecisionView) -> bool:
    """True when the dump truncated this decision's interferer row."""
    return len(view.interferers) < view.n_interferers
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -v`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: first-divergence analyzer module skeleton + cap-hit detector"
```

---

### Task 2: Parser adapter + class-section selection + target coloring

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

- [ ] **Step 1: Write the failing test**

```python
def test_select_class_section_picks_matching_class():
    from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function
    import pathlib
    fixtures = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"
    fpath = fixtures / "fn_802461BC_pcdump.txt"
    if not fpath.exists():
        import pytest
        pytest.skip("fn_802461BC_pcdump.txt fixture not present")
    events = parse_hook_events(fpath.read_text())
    fev = find_function(events, "mnDiagram3_8024714C")  # function present in that dump
    assert fev is not None
    section = fd.select_class_section(fev, class_id=0)
    assert section is not None
    views = fd.decision_views(section, fev)
    assert len(views) > 0
    assert all(isinstance(v, fd.DecisionView) for v in views)


def test_target_identity_set_is_force_phys_keys():
    target = fd.TargetColoring(class_id=0, force_phys={42: 28, 38: 28, 34: 31})
    assert fd.target_identity_set(target) == {42, 38, 34}
```

(If `mnDiagram3_8024714C` is not the function in that fixture, Step 2 prints the available names; use the first one with a class-0 colorgraph section.)

- [ ] **Step 2: Verify it fails (and discover the fixture's function name)**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py::test_select_class_section_picks_matching_class -v`
Expected: FAIL — `AttributeError: ... 'select_class_section'`. If it instead fails on the function name, run `python -c "from src.mwcc_debug.colorgraph_parser import parse_hook_events; import pathlib; print([f.name for f in parse_hook_events(pathlib.Path('tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt').read_text())])"` and use a listed name.

- [ ] **Step 3: Write the implementation**

```python
@dataclass(frozen=True)
class TargetColoring:
    class_id: int
    force_phys: Mapping[int, int]


def target_identity_set(target: "TargetColoring") -> set[int]:
    """The set of target nodes is the force-phys map KEYS (not the forced dump's
    surviving nodes) — coalesced-away nodes must remain in this set so Step 1a
    can detect them (Case D)."""
    return set(target.force_phys.keys())


def select_class_section(fev, class_id: int):
    """Return the FINAL colorgraph section for the class (last wins, in case of
    spill-retry sections), or None."""
    matches = [s for s in fev.colorgraph_sections if s.class_id == class_id]
    return matches[-1] if matches else None


def _simplify_section(fev, class_id: int):
    matches = [s for s in fev.simplify_sections if s.class_id == class_id]
    return matches[-1] if matches else None


def decision_views(section, fev) -> list[DecisionView]:
    """Adapter: ColorgraphSection -> list[DecisionView]. The ONLY code coupled to
    the parser dataclass field names."""
    simp = _simplify_section(fev, section.class_id)
    spilled_igs = {e.ig_idx for e in (simp.entries if simp else []) if e.spilled}
    return [
        DecisionView(
            ig_idx=d.ig_idx,
            iter_idx=d.iter_idx,
            assigned_reg=d.assigned_reg,
            n_interferers=d.n_interferers,
            interferers=tuple(d.interferers),
            spilled=bool(d.flags & 0x1) or (d.ig_idx in spilled_igs),
        )
        for d in section.decisions
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -v`
Expected: PASS (4 tests; the fixture test passes or skips if absent).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: target coloring + class-section selection + parser adapter"
```

---

### Task 3: Step 1a — target-identity pre-pass (Case D / E / absent)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

- [ ] **Step 1: Write the failing test**

```python
class _FakeAliasSection:
    def __init__(self, class_id, aliases):
        self.class_id = class_id
        self.aliases = aliases  # list of (alias_idx, root_idx, root_phys)


class _FakeSimplifyEntry:
    def __init__(self, ig_idx, spilled):
        self.ig_idx = ig_idx
        self.iter_idx = 0
        self.spilled = spilled


class _FakeSimplifySection:
    def __init__(self, class_id, entries):
        self.class_id = class_id
        self.entries = entries


class _FakeFunctionEvents:
    def __init__(self, name, colorgraph_sections, coalesced_alias_sections=(),
                 coalesce_sections=(), simplify_sections=()):
        self.name = name
        self.colorgraph_sections = list(colorgraph_sections)
        self.coalesced_alias_sections = list(coalesced_alias_sections)
        self.coalesce_sections = list(coalesce_sections)
        self.simplify_sections = list(simplify_sections)


def _present_views(*ig_idxs):
    # build a class-0 section whose decisions cover the given ig_idxs
    class _Sec:
        class_id = 0
        decisions = []
    sec = _Sec()
    sec.decisions = [
        type("D", (), dict(ig_idx=ig, iter_idx=i, assigned_reg=29, degree=0,
                           n_interferers=0, flags=0, interferers=[]))()
        for i, ig in enumerate(ig_idxs)
    ]
    return sec


def test_step1a_detects_coalesced_case_d():
    sec = _present_views(34, 37, 32, 52)  # 42 and 38 are NOT present (coalesced)
    fev = _FakeFunctionEvents(
        "gm", [sec],
        coalesced_alias_sections=[_FakeAliasSection(0, [(42, 3, 3), (38, 3, 3)])],
    )
    target = fd.TargetColoring(class_id=0, force_phys={34: 31, 37: 30, 32: 29,
                                                       42: 28, 52: 28, 38: 28})
    absent = fd.find_absent_targets(fev, target)
    assert absent is not None
    assert absent.case == fd.DivergenceCase.D_COALESCED
    assert set(absent.coalesced_nodes) == {42, 38}
    assert absent.coalesced_root == 3
    assert absent.coalesced_root_phys == 3


def test_step1a_detects_spilled_case_e():
    sec = _present_views(34, 37)  # 99 absent, and spilled
    fev = _FakeFunctionEvents(
        "f", [sec],
        simplify_sections=[_FakeSimplifySection(0, [_FakeSimplifyEntry(99, True)])],
    )
    target = fd.TargetColoring(class_id=0, force_phys={34: 31, 99: 28})
    absent = fd.find_absent_targets(fev, target)
    assert absent is not None
    assert absent.case == fd.DivergenceCase.E_SPILLED
    assert absent.ig_idx == 99


def test_step1a_returns_none_when_all_present():
    sec = _present_views(44, 46)
    fev = _FakeFunctionEvents("lbDvd", [sec])
    target = fd.TargetColoring(class_id=0, force_phys={44: 10, 46: 12})
    assert fd.find_absent_targets(fev, target) is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k step1a -v`
Expected: FAIL — `AttributeError: ... 'find_absent_targets'`.

- [ ] **Step 3: Write the implementation**

```python
def _present_ig_idxs(fev, class_id: int) -> set[int]:
    section = select_class_section(fev, class_id)
    if section is None:
        return set()
    return {d.ig_idx for d in section.decisions if d.ig_idx >= 0}


def _coalesce_root(fev, class_id: int, ig_idx: int):
    """Return (root_idx, root_phys) if ig_idx was coalesced, else None.
    Prefers the final CoalescedAliasSection (carries root_phys); falls back to
    the CoalesceSection mappings (no phys)."""
    for sec in fev.coalesced_alias_sections:
        if sec.class_id != class_id:
            continue
        for (alias_idx, root_idx, root_phys) in sec.aliases:
            if alias_idx == ig_idx:
                return (root_idx, root_phys)
    for sec in getattr(fev, "coalesce_sections", []):
        if sec.class_id != class_id:
            continue
        for (alias_ig, root_ig) in sec.mappings:
            if alias_ig == ig_idx:
                return (root_ig, None)
    return None


def _is_spilled(fev, class_id: int, ig_idx: int) -> bool:
    for sec in fev.simplify_sections:
        if sec.class_id != class_id:
            continue
        for e in sec.entries:
            if e.ig_idx == ig_idx and e.spilled:
                return True
    return False


def find_absent_targets(fev, target: TargetColoring) -> Optional[AllocatorFact]:
    """Step 1a. For each target node (force-phys key) not present as an
    independent colorgraph node, classify Case D (coalesced) / E (spilled) /
    absent. Coalesced nodes that share a root are reported together as one fact.
    Returns None when every target node is present (proceed to Step 1b)."""
    present = _present_ig_idxs(fev, target.class_id)
    missing = [ig for ig in sorted(target.force_phys) if ig not in present]
    if not missing:
        return None

    # Group coalesced-away nodes by their root so a merged cluster is one fact.
    coalesced: dict[tuple[int, Optional[int]], list[int]] = {}
    spilled: list[int] = []
    truly_absent: list[int] = []
    for ig in missing:
        root = _coalesce_root(fev, target.class_id, ig)
        if root is not None:
            coalesced.setdefault(root, []).append(ig)
        elif _is_spilled(fev, target.class_id, ig):
            spilled.append(ig)
        else:
            truly_absent.append(ig)

    if coalesced:
        (root_idx, root_phys), nodes = next(iter(coalesced.items()))
        nodes_sorted = tuple(sorted(nodes))
        return AllocatorFact(
            class_id=target.class_id, ig_idx=nodes_sorted[0],
            case=DivergenceCase.D_COALESCED, iter_idx=None,
            baseline_reg=root_phys, target_reg=target.force_phys[nodes_sorted[0]],
            coalesced_nodes=nodes_sorted, coalesced_root=root_idx,
            coalesced_root_phys=root_phys, blocker_ig=None,
            blocker_dependency=False, working_mask=None, cap_hit=False,
            earlier_unmapped_warning=False,
            local_target=local_target_for(DivergenceCase.D_COALESCED,
                                          coalesced_nodes=nodes_sorted,
                                          root=root_idx),
        )
    if spilled:
        ig = spilled[0]
        return AllocatorFact(
            class_id=target.class_id, ig_idx=ig, case=DivergenceCase.E_SPILLED,
            iter_idx=None, baseline_reg=None, target_reg=target.force_phys[ig],
            coalesced_nodes=(), coalesced_root=None, coalesced_root_phys=None,
            blocker_ig=None, blocker_dependency=False, working_mask=None,
            cap_hit=False, earlier_unmapped_warning=False,
            local_target=local_target_for(DivergenceCase.E_SPILLED),
        )
    ig = truly_absent[0]
    return AllocatorFact(
        class_id=target.class_id, ig_idx=ig, case=DivergenceCase.ABSENT,
        iter_idx=None, baseline_reg=None, target_reg=target.force_phys[ig],
        coalesced_nodes=(), coalesced_root=None, coalesced_root_phys=None,
        blocker_ig=None, blocker_dependency=False, working_mask=None,
        cap_hit=False, earlier_unmapped_warning=False,
        local_target=local_target_for(DivergenceCase.ABSENT),
    )
```

Add the `AllocatorFact` dataclass (exactly as in the Internal API section above) near the top of the module, after `DivergenceCase`. Add a temporary stub so imports resolve until Task 7:

```python
def local_target_for(case: "DivergenceCase", **kwargs) -> str:
    return case.value  # replaced with real strings in Task 7
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k step1a -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: Step 1a target-identity pre-pass (Case D/E/absent)"
```

---

### Task 4: Step 1b — register-choice walk (first mapped divergence)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

- [ ] **Step 1: Write the failing test**

```python
def _view(ig, it, reg, interferers=(), n=None):
    return fd.DecisionView(ig_idx=ig, iter_idx=it, assigned_reg=reg,
                           n_interferers=(len(interferers) if n is None else n),
                           interferers=tuple(interferers), spilled=False)


def test_step1b_finds_first_mapped_divergence_in_iter_order():
    views = [_view(44, 0, 12), _view(46, 1, 10), _view(99, 2, 5)]
    target = fd.TargetColoring(class_id=0, force_phys={44: 10, 46: 12})
    point = fd.find_register_choice_divergence(views, target)
    assert point is not None
    assert point.ig_idx == 44          # lowest iter among mismatching mapped nodes
    assert point.baseline_reg == 12
    assert point.target_reg == 10


def test_step1b_none_when_all_mapped_on_target():
    views = [_view(44, 0, 10), _view(46, 1, 12)]
    target = fd.TargetColoring(class_id=0, force_phys={44: 10, 46: 12})
    assert fd.find_register_choice_divergence(views, target) is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k step1b -v`
Expected: FAIL — `AttributeError: ... 'find_register_choice_divergence'`.

- [ ] **Step 3: Write the implementation**

```python
class DivergencePoint(NamedTuple):
    ig_idx: int
    iter_idx: int
    baseline_reg: int
    target_reg: int


def find_register_choice_divergence(views, target: TargetColoring
                                    ) -> Optional["DivergencePoint"]:
    """Step 1b. Walk decisions in iter order; first force-phys node whose
    assigned_reg != its target reg. Only nodes present in `views` are compared
    (Step 1a already removed absent ones)."""
    for v in sorted(views, key=lambda d: d.iter_idx):
        if v.ig_idx in target.force_phys:
            want = target.force_phys[v.ig_idx]
            if v.assigned_reg != want:
                return DivergencePoint(v.ig_idx, v.iter_idx, v.assigned_reg, want)
    return None
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k step1b -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: Step 1b register-choice walk (first mapped divergence)"
```

---

### Task 5: Step 2 — allocator-state replay (volatile pool, fixed blockers, working mask)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

This is the load-bearing correctness piece. The replay walks decisions in *recorded* `iter_idx` order, maintaining `volatile_pool = INITIAL_VOLATILE_REGS ∪ {callee-saves dispensed so far}`. A decision's blockers are: regs held by interferers already processed (lower `iter_idx`) PLUS precolored/fixed interferers (interferer ig_idx that never appears as its own decision — blocks from iteration 0). Future-virtual interferers do NOT block yet.

- [ ] **Step 1: Write the failing test**

```python
def test_replay_lowest_set_bit_pick():
    # one decision, interferer holds r3 (precolored: ig 99 has no decision) -> pick r4
    views = [_view(5, 0, 4, interferers=((99, 3),))]
    steps = {s.ig_idx: s for s in fd.replay_decisions(views)}
    assert steps[5].predicted_reg == 4
    assert steps[5].dispensed is False
    assert 3 not in steps[5].working_mask
    assert 3 in steps[5].blockers


def test_replay_dispenses_top_down_when_volatiles_blocked():
    # node 0 interferes with precolored r3..r12 -> volatile pool empty -> dispense r31
    blockers = tuple((900 + k, r) for k, r in enumerate(range(3, 13)))
    views = [_view(0, 0, 31, interferers=blockers)]
    steps = {s.ig_idx: s for s in fd.replay_decisions(views)}
    assert steps[0].predicted_reg == 31
    assert steps[0].dispensed is True


def test_replay_reuses_dispensed_callee_save():
    # iter0: node A blocks all volatiles -> dispenses r31 (added to pool)
    # iter1: node B blocks all volatiles too, but NOT r31 -> reuses r31 via lowest-bit
    block_vol = tuple((900 + k, r) for k, r in enumerate(range(3, 13)))
    views = [
        _view(0, 0, 31, interferers=block_vol),
        _view(1, 1, 31, interferers=block_vol),   # r31 free for reuse
    ]
    steps = {s.ig_idx: s for s in fd.replay_decisions(views)}
    assert steps[0].predicted_reg == 31 and steps[0].dispensed is True
    assert steps[1].predicted_reg == 31 and steps[1].dispensed is False  # REUSE


def test_replay_marks_cap_hit():
    views = [_view(5, 0, 4, interferers=((99, 3),), n=82)]  # row truncated
    steps = {s.ig_idx: s for s in fd.replay_decisions(views)}
    assert steps[5].cap_hit is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k replay -v`
Expected: FAIL — `AttributeError: ... 'replay_decisions'`.

- [ ] **Step 3: Write the implementation**

```python
from .simulator import INITIAL_VOLATILE_REGS, RESERVED_REGS, NONVOLATILE_ALLOC_ORDER


def replay_decisions(views) -> list[ReplayStep]:
    """Step 2. Replay decisions in recorded iter order, reconstructing the
    working mask at each. Pool is sticky: dispensed callee-saves are returned to
    the volatile pool for later reuse (lowest-set-bit can then pick them)."""
    ordered = sorted(views, key=lambda d: d.iter_idx)
    iter_by_ig = {v.ig_idx: v.iter_idx for v in ordered if v.ig_idx >= 0}
    pool = set(INITIAL_VOLATILE_REGS)
    steps: list[ReplayStep] = []

    for v in ordered:
        fixed_blockers: set[int] = set()
        processed_blockers: set[int] = set()
        for (i_ig, i_reg) in v.interferers:
            if i_ig in iter_by_ig:
                if iter_by_ig[i_ig] < v.iter_idx:
                    processed_blockers.add(i_reg)   # already colored -> blocks
                # future virtual -> not assigned yet -> does not block
            else:
                fixed_blockers.add(i_reg)            # precolored -> blocks from start
        blockers = processed_blockers | fixed_blockers
        working = (pool - blockers) - RESERVED_REGS - {0}

        if working:
            predicted = min(working)                 # lowest set bit
            dispensed = False
        else:
            predicted = -1
            dispensed = True
            for r in NONVOLATILE_ALLOC_ORDER:        # top-down r31..r13
                if r not in pool and r not in blockers:
                    predicted = r
                    pool.add(r)                      # sticky: returns to pool
                    break

        steps.append(ReplayStep(
            ig_idx=v.ig_idx, iter_idx=v.iter_idx,
            working_mask=frozenset(working), predicted_reg=predicted,
            dispensed=dispensed, cap_hit=is_cap_hit(v),
            blockers=frozenset(blockers),
        ))
    return steps
```

Also add the `ReplayStep` dataclass (as in the Internal API section) near the other dataclasses.

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k replay -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: Step 2 allocator-state replay with sticky volatile pool"
```

---

### Task 6: Classification — Cases A / B / B-inverse / C / C2

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

Decision tree, applied at the divergence point `X` using its `ReplayStep`:
- `target_reg` in `blockers` → **A** (held by an interferer). Dependency sub-case: if that interferer is itself a force-phys node and off-target, flag `blocker_dependency`.
- else `target_reg` in `working_mask` and `target_reg > baseline_reg` → **B** (lowest-bit took a lower reg).
- else `baseline_reg > target_reg` → **B-inverse** (baseline landed higher than target).
- else `dispensed` (working mask was empty) → **C**, or **C2** if `target_reg` is a callee-save that some *later* baseline decision dispenses (i.e., it WOULD be in the sticky pool had more nonvolatiles dispensed before X).
- else → **C** (fallback).

- [ ] **Step 1: Write the failing test**

```python
def _step(ig, working, blockers=()):
    return fd.ReplayStep(ig_idx=ig, iter_idx=0, working_mask=frozenset(working),
                         predicted_reg=min(working) if working else -1,
                         dispensed=not working, cap_hit=False,
                         blockers=frozenset(blockers))


def test_classify_case_a_blocked():
    point = fd.DivergencePoint(ig_idx=5, iter_idx=3, baseline_reg=4, target_reg=3)
    step = _step(5, working={4, 5}, blockers={3})       # r3 (target) blocked
    target = fd.TargetColoring(class_id=0, force_phys={5: 3})
    fact = fd.classify_divergence(point, step, target, views_by_ig={},
                                  interferers=((9, 3),))
    assert fact.case == fd.DivergenceCase.A_BLOCKED
    assert fact.blocker_ig == 9


def test_classify_case_b_target_higher():
    point = fd.DivergencePoint(ig_idx=5, iter_idx=1, baseline_reg=3, target_reg=5)
    step = _step(5, working={3, 5})                     # both free, took lower (3)
    target = fd.TargetColoring(class_id=0, force_phys={5: 5})
    fact = fd.classify_divergence(point, step, target, views_by_ig={}, interferers=())
    assert fact.case == fd.DivergenceCase.B_TARGET_HIGHER


def test_classify_case_b_inverse():
    point = fd.DivergencePoint(ig_idx=5, iter_idx=1, baseline_reg=30, target_reg=5)
    step = _step(5, working=set(), blockers={3, 4, 6, 7, 8, 9, 10, 11, 12})
    target = fd.TargetColoring(class_id=0, force_phys={5: 5})
    fact = fd.classify_divergence(point, step, target, views_by_ig={}, interferers=())
    assert fact.case == fd.DivergenceCase.B_INVERSE


def test_classify_case_c_dispense_order():
    point = fd.DivergencePoint(ig_idx=5, iter_idx=4, baseline_reg=31, target_reg=30)
    step = _step(5, working=set())                      # dispensed, no later r30
    target = fd.TargetColoring(class_id=0, force_phys={5: 30})
    fact = fd.classify_divergence(point, step, target, views_by_ig={}, interferers=())
    assert fact.case == fd.DivergenceCase.C_DISPENSE_ORDER


def test_classify_case_c2_sticky_pool():
    point = fd.DivergencePoint(ig_idx=5, iter_idx=2, baseline_reg=31, target_reg=30)
    step = _step(5, working=set())                      # dispensed
    # a LATER decision (iter 4) holds r30 -> target could sticky-pool it by X's turn
    later = fd.DecisionView(ig_idx=8, iter_idx=4, assigned_reg=30,
                            n_interferers=0, interferers=(), spilled=False)
    target = fd.TargetColoring(class_id=0, force_phys={5: 30})
    fact = fd.classify_divergence(point, step, target,
                                  views_by_ig={8: later}, interferers=())
    assert fact.case == fd.DivergenceCase.C2_STICKY_POOL
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k classify -v`
Expected: FAIL — `AttributeError: ... 'classify_divergence'`.

- [ ] **Step 3: Write the implementation**

```python
_CALLEE_SAVE = set(NONVOLATILE_ALLOC_ORDER)  # {13..31}


def classify_divergence(point: "DivergencePoint", step: ReplayStep,
                        target: TargetColoring, views_by_ig: dict,
                        interferers: tuple[tuple[int, int], ...]) -> AllocatorFact:
    """Step 2 classification at the divergence point X."""
    base, want = point.baseline_reg, point.target_reg
    case: DivergenceCase
    blocker_ig: Optional[int] = None
    blocker_dependency = False

    if want in step.blockers:
        case = DivergenceCase.A_BLOCKED
        for (i_ig, i_reg) in interferers:
            if i_reg == want:
                blocker_ig = i_ig
                if i_ig in target.force_phys:
                    v = views_by_ig.get(i_ig)
                    if v is not None and v.assigned_reg != target.force_phys[i_ig]:
                        blocker_dependency = True
                break
    elif want in step.working_mask:
        # target was AVAILABLE at X but baseline picked another register
        case = (DivergenceCase.B_TARGET_HIGHER if want > base
                else DivergenceCase.B_INVERSE)
    elif want in INITIAL_VOLATILE_REGS:
        # target is a volatile that wasn't free at X; baseline ended higher
        # (too much interference / processed too late) -> reduce interference.
        # NOTE: this must precede the dispense cases — a dispensed nonvolatile
        # baseline with a *volatile* target is B-inverse, not C.
        case = DivergenceCase.B_INVERSE
    elif step.dispensed and want in _CALLEE_SAVE and _dispensed_later(
            want, views_by_ig, point.iter_idx):
        case = DivergenceCase.C2_STICKY_POOL
    else:
        case = DivergenceCase.C_DISPENSE_ORDER

    return AllocatorFact(
        class_id=target.class_id, ig_idx=point.ig_idx, case=case,
        iter_idx=point.iter_idx, baseline_reg=base, target_reg=want,
        coalesced_nodes=(), coalesced_root=None, coalesced_root_phys=None,
        blocker_ig=blocker_ig, blocker_dependency=blocker_dependency,
        working_mask=step.working_mask, cap_hit=step.cap_hit,
        earlier_unmapped_warning=False,
        local_target=local_target_for(case, blocker_ig=blocker_ig,
                                      blocker_dependency=blocker_dependency),
    )


def _dispensed_later(reg: int, views_by_ig: dict, after_iter: int) -> bool:
    """True if some decision after `after_iter` was assigned `reg` (a callee-save),
    implying the target coloring could have it sticky-pooled by X's turn."""
    return any(v.assigned_reg == reg and v.iter_idx > after_iter
               for v in views_by_ig.values())
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k classify -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: divergence classification (A/B/B-inverse/C/C2)"
```

---

### Task 7: Step 3 — local structural targets (real strings)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

Replace the Task-3 stub `local_target_for` with the real per-case levers from the spec (Step 3).

- [ ] **Step 1: Write the failing test**

```python
def test_local_target_strings_per_case():
    assert "prevent the coalesce" in fd.local_target_for(
        fd.DivergenceCase.D_COALESCED, coalesced_nodes=(42, 38), root=3)
    assert "interference degree" in fd.local_target_for(fd.DivergenceCase.E_SPILLED)
    assert "structural" in fd.local_target_for(fd.DivergenceCase.ABSENT).lower()
    a = fd.local_target_for(fd.DivergenceCase.A_BLOCKED, blocker_ig=9,
                            blocker_dependency=False)
    assert "interference" in a and "process X" in a
    a_dep = fd.local_target_for(fd.DivergenceCase.A_BLOCKED, blocker_ig=9,
                                blocker_dependency=True)
    assert "recolor" in a_dep.lower()
    assert "simplify order" in fd.local_target_for(fd.DivergenceCase.B_TARGET_HIGHER)
    assert "earlier" in fd.local_target_for(fd.DivergenceCase.B_INVERSE)
    assert "simplify-order" in fd.local_target_for(fd.DivergenceCase.C_DISPENSE_ORDER)
    assert "nonvolatiles dispense" in fd.local_target_for(fd.DivergenceCase.C2_STICKY_POOL)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k local_target -v`
Expected: FAIL — assertion errors (stub returns `case.value`).

- [ ] **Step 3: Write the implementation (replace the stub)**

```python
def local_target_for(case: DivergenceCase, *, coalesced_nodes=(), root=None,
                     blocker_ig=None, blocker_dependency=False) -> str:
    if case is DivergenceCase.D_COALESCED:
        nodes = ", ".join(str(n) for n in coalesced_nodes)
        return (f"prevent the coalesce that merges node(s) {nodes} into root "
                f"{root} (shorten/separate the live ranges MWCC is merging)")
    if case is DivergenceCase.E_SPILLED:
        return "reduce X's interference degree so it colors cleanly (shrink/split the live range)"
    if case is DivergenceCase.ABSENT:
        return "structural mismatch (wrong class or pair-register constraint); no single local lever"
    if case is DivergenceCase.A_BLOCKED:
        if blocker_dependency:
            return (f"recolor the upstream blocker (ig {blocker_ig}) first — X's "
                    f"divergence is downstream of it")
        return (f"eliminate the X-Y interference (ig {blocker_ig}) by shortening one "
                f"live range, or process X before Y")
    if case is DivergenceCase.B_TARGET_HIGHER:
        return ("introduce interference with the holders of the registers below "
                "r_target, or move X later in simplify order")
    if case is DivergenceCase.B_INVERSE:
        return "reduce X's interference or process X earlier so it isn't pushed higher than target"
    if case is DivergenceCase.C_DISPENSE_ORDER:
        return "shift X's simplify-order position so top-down dispense reaches r_target"
    if case is DivergenceCase.C2_STICKY_POOL:
        return ("change how many nonvolatiles dispense before X (reorder upstream "
                "virtuals) so r_target is in the sticky pool by X's turn")
    return case.value
```

- [ ] **Step 4: Run to verify it passes (and re-run Tasks 3/6 tests for no regression)**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k "local_target or step1a or classify" -v`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: Step 3 local structural target strings (all cases)"
```

---

### Task 8: Report assembly — `analyze_first_divergence` (gated layer)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

Wire Step 1a → Step 1b → Step 2 → classify into one entry point returning a `FirstDivergenceReport` whose `.fact` is the gated layer and `.source` is `None` (advisory added in Task 9). Handle: no divergence (Case NONE), and the partial-map `earlier_unmapped_warning` (always true when the force-phys map is partial, i.e. there exist class decisions whose ig_idx is not a force-phys key and sit before the divergence).

- [ ] **Step 1: Write the failing test**

```python
def test_analyze_gm_like_returns_case_d():
    sec = _present_views(34, 37, 32, 52)
    fev = _FakeFunctionEvents(
        "gm", [sec],
        coalesced_alias_sections=[_FakeAliasSection(0, [(42, 3, 3), (38, 3, 3)])],
    )
    target = fd.TargetColoring(class_id=0, force_phys={34: 31, 37: 30, 32: 29,
                                                       42: 28, 52: 28, 38: 28})
    report = fd.analyze_first_divergence(fev, target)
    assert report.fact.case == fd.DivergenceCase.D_COALESCED
    assert set(report.fact.coalesced_nodes) == {42, 38}
    assert report.source is None


def test_analyze_lbdvd_like_returns_register_choice():
    # baseline 44->r12, 46->r10 ; target wants 44->r10, 46->r12
    class _Sec:
        class_id = 0
    sec = _Sec()
    sec.decisions = [
        type("D", (), dict(ig_idx=44, iter_idx=0, assigned_reg=12, degree=0,
                           n_interferers=0, flags=0, interferers=[]))(),
        type("D", (), dict(ig_idx=46, iter_idx=1, assigned_reg=10, degree=0,
                           n_interferers=0, flags=0, interferers=[]))(),
    ]
    fev = _FakeFunctionEvents("lbDvd", [sec])
    target = fd.TargetColoring(class_id=0, force_phys={44: 10, 46: 12})
    report = fd.analyze_first_divergence(fev, target)
    assert report.fact.case in (fd.DivergenceCase.B_TARGET_HIGHER,
                                fd.DivergenceCase.B_INVERSE)
    assert report.fact.ig_idx in (44, 46)


def test_analyze_no_divergence_is_case_none():
    class _Sec:
        class_id = 0
    sec = _Sec()
    sec.decisions = [
        type("D", (), dict(ig_idx=44, iter_idx=0, assigned_reg=10, degree=0,
                           n_interferers=0, flags=0, interferers=[]))(),
    ]
    fev = _FakeFunctionEvents("f", [sec])
    target = fd.TargetColoring(class_id=0, force_phys={44: 10})
    report = fd.analyze_first_divergence(fev, target)
    assert report.fact.case == fd.DivergenceCase.NONE
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k analyze -v`
Expected: FAIL — `AttributeError: ... 'analyze_first_divergence'`.

- [ ] **Step 3: Write the implementation**

```python
def analyze_first_divergence(fev, target: TargetColoring) -> FirstDivergenceReport:
    """Gated pipeline: Step 1a -> 1b -> 2 -> classify. `.source` stays None here;
    Task 9's attach_source_ideas fills it on request."""
    # Step 1a — structural pre-pass.
    absent = find_absent_targets(fev, target)
    if absent is not None:
        return FirstDivergenceReport(fact=absent, source=None)

    section = select_class_section(fev, target.class_id)
    if section is None:
        raise ValueError(f"no colorgraph section for class {target.class_id}")
    views = decision_views(section, fev)
    views_by_ig = {v.ig_idx: v for v in views if v.ig_idx >= 0}

    # Step 1b — register-choice walk.
    point = find_register_choice_divergence(views, target)
    if point is None:
        return FirstDivergenceReport(
            fact=AllocatorFact(
                class_id=target.class_id, ig_idx=-1, case=DivergenceCase.NONE,
                iter_idx=None, baseline_reg=None, target_reg=None,
                coalesced_nodes=(), coalesced_root=None, coalesced_root_phys=None,
                blocker_ig=None, blocker_dependency=False, working_mask=None,
                cap_hit=False, earlier_unmapped_warning=False,
                local_target="no divergence — all target nodes already on-target",
            ),
            source=None,
        )

    # Step 2 — replay + state at X.
    steps = {s.ig_idx: s for s in replay_decisions(views)}
    step = steps[point.ig_idx]
    interferers = views_by_ig[point.ig_idx].interferers

    if step.cap_hit:                                   # fail closed (spec P2)
        fact = AllocatorFact(
            class_id=target.class_id, ig_idx=point.ig_idx,
            case=DivergenceCase.ABSTAINED, iter_idx=point.iter_idx,
            baseline_reg=point.baseline_reg, target_reg=point.target_reg,
            coalesced_nodes=(), coalesced_root=None, coalesced_root_phys=None,
            blocker_ig=None, blocker_dependency=False,
            working_mask=step.working_mask, cap_hit=True,
            earlier_unmapped_warning=False,
            local_target="ABSTAINED — interferer row truncated in dump; "
                         "regenerate with an uncapped dump before classifying",
        )
        return FirstDivergenceReport(fact=fact, source=None)

    fact = classify_divergence(point, step, target, views_by_ig, interferers)

    # Partial-map caveat: warn if an earlier non-target node exists.
    earlier_unmapped = any(
        v.ig_idx not in target.force_phys and v.iter_idx < point.iter_idx
        for v in views if v.ig_idx >= 0
    )
    if earlier_unmapped:
        fact = _replace_fact(fact, earlier_unmapped_warning=True)
    return FirstDivergenceReport(fact=fact, source=None)


def _replace_fact(fact: AllocatorFact, **changes) -> AllocatorFact:
    import dataclasses
    return dataclasses.replace(fact, **changes)
```

Ensure `FirstDivergenceReport` and `SourceIdea` dataclasses (from the Internal API section) are defined in the module.

- [ ] **Step 4: Run to verify it passes (and full module suite)**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -v`
Expected: PASS (all tests so far).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: analyze_first_divergence gated pipeline (Step 1a->1b->2->classify)"
```

---

### Task 9: Advisory source-idea layer (symbol bridge, confidence + alternates)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

This layer is NEVER gated (spec Step 5). It must degrade gracefully: if the bridge can't resolve a variable, return a `SourceIdea` with `var_name=None` rather than raising. It builds the ig_idx→var ranked alternates the bridge lacks, by filtering `list_bindings` on `.virtual` and sorting by a confidence rank.

Note the identity chain: colorgraph `ig_idx` is NOT the virtual register number. Mapping needs ig_idx→virtual→var. For v1, accept the bridge's best-effort: try `ig_idx` as the virtual directly (often aligned for simple functions) and, on miss, return `var_name=None`. (A precise ig_idx→virtual inverse is a v2 follow-on; this layer is advisory.)

**What's reliable vs best-effort in v1.** The `ideas` list (structural levers derived from `fact.local_target` — e.g. "prevent the coalesce") is ALWAYS emitted and is the dependable part of this layer. The `var_name`/`alternates` (the actual symbol binding) is genuinely best-effort and **may degrade to `None` in real usage**, because `symbol_bridge.list_bindings` consumes a `parser.py` `Function` + unit source, not the `colorgraph_parser` `FunctionEvents` this analyzer is built on. Wiring that second parse + source resolution is a deliberate v1 follow-on; `_list_bindings_safe` catches the type mismatch and degrades. The unit tests below monkeypatch `_list_bindings_safe`, so they validate the ranking logic independent of that integration. None of this is gated (Check 1/2 don't touch the source layer).

- [ ] **Step 1: Write the failing test**

```python
def test_attach_source_ideas_degrades_when_no_bindings(monkeypatch):
    monkeypatch.setattr(fd, "_list_bindings_safe", lambda *a, **k: [])
    fact = fd.AllocatorFact(
        class_id=0, ig_idx=42, case=fd.DivergenceCase.D_COALESCED, iter_idx=None,
        baseline_reg=3, target_reg=28, coalesced_nodes=(42, 38), coalesced_root=3,
        coalesced_root_phys=3, blocker_ig=None, blocker_dependency=False,
        working_mask=None, cap_hit=False, earlier_unmapped_warning=False,
        local_target="prevent the coalesce ...")
    idea = fd.attach_source_ideas(fact, source_text="", fev=None)
    assert idea.ig_idx == 42
    assert idea.var_name is None
    assert idea.ideas  # still emits case-level structural ideas


def test_attach_source_ideas_ranks_alternates(monkeypatch):
    class _B:
        def __init__(self, name, virtual, conf, scope):
            self.var_name, self.virtual, self.confidence, self.scope_path = (
                name, virtual, conf, scope)
            self.decl_line, self.kind, self.type_str = 0, "local", "s32"
    monkeypatch.setattr(fd, "_list_bindings_safe", lambda *a, **k: [
        _B("c2", 42, "low-confidence", ("fn", "block@1")),
        _B("c1", 42, "best-guess", ("fn",)),
        _B("other", 7, "verified", ("fn",)),
    ])
    fact = fd.AllocatorFact(
        class_id=0, ig_idx=42, case=fd.DivergenceCase.A_BLOCKED, iter_idx=3,
        baseline_reg=4, target_reg=3, coalesced_nodes=(), coalesced_root=None,
        coalesced_root_phys=None, blocker_ig=9, blocker_dependency=False,
        working_mask=frozenset({4}), cap_hit=False, earlier_unmapped_warning=False,
        local_target="eliminate the X-Y interference ...")
    idea = fd.attach_source_ideas(fact, source_text="...", fev=object())
    assert idea.var_name == "c1"                 # best-guess outranks low-confidence
    assert idea.confidence == "best-guess"
    assert "c2" in idea.alternates
    assert "other" not in idea.alternates        # different virtual filtered out
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k source_ideas -v`
Expected: FAIL — `AttributeError: ... 'attach_source_ideas'`.

- [ ] **Step 3: Write the implementation**

```python
_CONFIDENCE_RANK = {
    "verified": 0, "best-guess": 1, "low-confidence": 2,
    "ambiguous": 3, "ambiguous-nested": 4, "unsupported": 5, "rejected": 6,
}


def _list_bindings_safe(source_text: str, fev) -> list:
    """Best-effort symbol-bridge call; never raises (advisory layer)."""
    try:
        from .symbol_bridge import list_bindings
        pre = fev.last_precolor_pass() if hasattr(fev, "last_precolor_pass") else fev
        return list_bindings(source_text, fev, pre)
    except Exception:
        return []


def attach_source_ideas(fact: AllocatorFact, source_text: str, fev) -> SourceIdea:
    """Step 4/5 advisory layer. Emits the ig->var best guess + ranked alternates
    (confidence-sorted) and case-level structural ideas. Degrades to var_name=None
    on any bridge failure; NEVER gated."""
    bindings = [b for b in _list_bindings_safe(source_text, fev)
                if getattr(b, "virtual", -1) == fact.ig_idx]
    bindings.sort(key=lambda b: (_CONFIDENCE_RANK.get(getattr(b, "confidence", ""), 9),
                                 len(getattr(b, "scope_path", ()))))
    best = bindings[0] if bindings else None
    alternates = tuple(b.var_name for b in bindings[1:])

    ideas: list[str] = [fact.local_target]
    if fact.case is DivergenceCase.A_BLOCKED and best is not None:
        ideas.append(f"shorten {best.var_name}'s live range so it doesn't overlap the blocker")
    if fact.case is DivergenceCase.D_COALESCED and best is not None:
        ideas.append(f"split {best.var_name} so MWCC can't merge it into its coalesce root")

    return SourceIdea(
        ig_idx=fact.ig_idx,
        var_name=(best.var_name if best is not None else None),
        confidence=(best.confidence if best is not None else None),
        alternates=alternates,
        ideas=tuple(ideas),
    )
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k source_ideas -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: advisory source-idea layer (confidence + ranked alternates, graceful degrade)"
```

---

### Task 10: CLI subcommand `debug inspect first-divergence`

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Test: `tools/melee-agent/tests/test_first_divergence.py`

Add a `format_report(report) -> str` to the module (so the CLI and tests share rendering), then a thin Typer handler that resolves the pcdump, parses it, builds the target from `--force-phys` (reuse `_normalize_force_phys` parsing semantics: `ig:phys[,ig:phys]`), runs `analyze_first_divergence`, and optionally attaches source ideas with `--source`.

- [ ] **Step 1: Write the failing test (renderer + force-phys parse)**

```python
def test_parse_force_phys_map():
    assert fd.parse_force_phys_arg("42:28,38:28,34:31") == {42: 28, 38: 28, 34: 31}


def test_format_report_has_gated_and_advisory_sections():
    fact = fd.AllocatorFact(
        class_id=0, ig_idx=42, case=fd.DivergenceCase.D_COALESCED, iter_idx=None,
        baseline_reg=3, target_reg=28, coalesced_nodes=(42, 38), coalesced_root=3,
        coalesced_root_phys=3, blocker_ig=None, blocker_dependency=False,
        working_mask=None, cap_hit=False, earlier_unmapped_warning=False,
        local_target="prevent the coalesce ...")
    report = fd.FirstDivergenceReport(fact=fact, source=None)
    text = fd.format_report(report)
    assert "ALLOCATOR FACTS" in text and "Case D" in text
    assert "42" in text and "38" in text
    assert "ADVISORY" in text  # advisory header present even when source is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k "force_phys_map or format_report" -v`
Expected: FAIL — `AttributeError: ... 'parse_force_phys_arg'`.

- [ ] **Step 3: Implement renderer + parser in the module**

```python
def parse_force_phys_arg(raw: str) -> dict[int, int]:
    """Parse 'ig:phys[,ig:phys]*' (class prefixes like 'gpr:ig:phys' are accepted
    and the class is dropped — v1 operates within a single --class)."""
    out: dict[int, int] = {}
    for entry in (e.strip() for e in raw.split(",") if e.strip()):
        parts = entry.split(":")
        if len(parts) == 3:
            parts = parts[1:]            # drop class prefix
        if len(parts) != 2:
            raise ValueError(f"bad force-phys entry: {entry!r}")
        out[int(parts[0])] = int(parts[1])
    return out


def format_report(report: FirstDivergenceReport) -> str:
    f = report.fact
    lines = ["=== ALLOCATOR FACTS (gated) ==="]
    if f.case is DivergenceCase.D_COALESCED:
        nodes = ", ".join(str(n) for n in f.coalesced_nodes)
        lines.append(f"First divergence: class {f.class_id}, Case D — "
                     f"node(s) {nodes} coalesced into root {f.coalesced_root} "
                     f"[r{f.coalesced_root_phys}]")
    elif f.case in (DivergenceCase.NONE, DivergenceCase.ABSTAINED):
        lines.append(f"class {f.class_id}: {f.local_target}")
    else:
        lines.append(f"First divergence: class {f.class_id}, iter {f.iter_idx}, "
                     f"ig_idx {f.ig_idx}")
        lines.append(f"  baseline: ig {f.ig_idx} -> r{f.baseline_reg}")
        lines.append(f"  target:   ig {f.ig_idx} -> r{f.target_reg}")
        lines.append(f"  cause: Case {f.case.value}"
                     + (f" — r{f.target_reg} held by interferer ig {f.blocker_ig}"
                        if f.case is DivergenceCase.A_BLOCKED else ""))
    lines.append(f"  local target: {f.local_target}")
    if f.cap_hit:
        lines.append("  WARNING: interferer row truncated — abstained (regenerate uncapped dump)")
    if f.earlier_unmapped_warning:
        lines.append("  NOTE: partial target map — an earlier unmapped node may dominate")

    lines.append("")
    lines.append("=== SOURCE IDEAS (advisory, NOT validated) ===")
    s = report.source
    if s is None:
        lines.append("  (run with --source to attach symbol-bridge ideas)")
    else:
        lines.append(f"  ig {s.ig_idx} -> var {s.var_name} "
                     f"[confidence: {s.confidence}]")
        if s.alternates:
            lines.append(f"  alternates: {', '.join(s.alternates)}")
        for i, idea in enumerate(s.ideas, 1):
            lines.append(f"    {i}. {idea}")
    return "\n".join(lines)
```

- [ ] **Step 4: Run renderer tests; verify pass**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py -k "force_phys_map or format_report" -v`
Expected: PASS.

- [ ] **Step 5: Add the CLI handler**

Find the `@inspect_app.command("simulate")` handler in `src/cli/debug.py` and add this directly after it (mirror its `_resolve_pcdump_path` usage — grep `def simulate(` then `_resolve_pcdump_path` to copy the exact resolution call):

```python
@inspect_app.command("first-divergence")
def first_divergence_cmd(
    function: Annotated[str, typer.Option("--function", "-f", help="Function name")],
    force_phys: Annotated[str, typer.Option("--force-phys",
        help="Target coloring as ig:phys[,ig:phys] (the map KEYS are the target node set)")],
    dump: Annotated[Optional[Path], typer.Argument(help="pcdump (auto-resolved if omitted)")] = None,
    class_id: Annotated[int, typer.Option("--class", help="Register class (0=GPR, 1=FPR)")] = 0,
    source: Annotated[bool, typer.Option("--source", help="Attach advisory source ideas")] = False,
):
    """Find the earliest allocator decision diverging from a same-source target.

    Gated allocator facts are derived mechanically from the recorded colorgraph;
    --source adds a NON-gated advisory layer (heuristic symbol-bridge mapping).
    """
    from ..mwcc_debug import first_divergence as fd
    from ..mwcc_debug.colorgraph_parser import parse_hook_events, find_function

    dump_path = _resolve_pcdump_path(dump, function)  # same helper simulate() uses
    events = parse_hook_events(Path(dump_path).read_text())
    fev = find_function(events, function)
    if fev is None:
        raise typer.BadParameter(f"function {function!r} not found in dump")
    try:
        fp_map = fd.parse_force_phys_arg(force_phys)
    except ValueError as exc:
        raise typer.BadParameter(str(exc))
    target = fd.TargetColoring(class_id=class_id, force_phys=fp_map)
    report = fd.analyze_first_divergence(fev, target)
    if source:
        # v1: structural ideas always emit; var-name binding is the follow-on
        # (needs a parser.py Function + unit source). Empty text degrades cleanly.
        unit_src = ""
        report = fd.FirstDivergenceReport(
            fact=report.fact,
            source=fd.attach_source_ideas(report.fact, unit_src, fev),
        )
    typer.echo(fd.format_report(report))
```

- [ ] **Step 6: Smoke-test the CLI wiring**

Run: `cd tools/melee-agent && python -m src.cli debug inspect first-divergence --help`
Expected: help text lists `--function`, `--force-phys`, `--class`, `--source`. (If `_resolve_pcdump_path` has a different name, grep the `simulate` handler body for the resolver it calls and use that.)

- [ ] **Step 7: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/first_divergence.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_first_divergence.py
git commit -m "feat: debug inspect first-divergence CLI + report renderer"
```

---

### Task 11: Check 1 — replay smoke test (ACCEPTANCE GATE 1)

**Files:**
- Test: `tools/melee-agent/tests/test_first_divergence_replay.py`

Gate: on a fixture that exercises callee-save **dispense AND reuse**, the replay's predicted register reproduces the **recorded** `assigned_reg` at every non-spilled class-0 decision. The oracle is the recorded coloring, NOT `simulate`.

- [ ] **Step 1: Pick/verify a dispense+reuse fixture**

Run: `cd tools/melee-agent && python -c "
from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function
import pathlib
for fn in ['fn_802461BC_pcdump.txt','mnVibration_80248644_pcdump.txt','fn_80247510_pcdump.txt']:
    p = pathlib.Path('tests/fixtures/mwcc_debug')/fn
    if not p.exists():
        print(fn,'MISSING'); continue
    evs = parse_hook_events(p.read_text())
    for fe in evs:
        for s in fe.colorgraph_sections:
            if s.class_id!=0: continue
            regs=[d.assigned_reg for d in s.decisions]
            nonvol=[r for r in regs if 13<=r<=31]
            print(fn, fe.name, 'class0 decisions',len(regs),'nonvol dispenses',len(nonvol))
"`
Expected: identify a fixture/function with ≥2 nonvolatile (r13–r31) assignments in class 0 (necessary for reuse). Record the `(fixture_file, function_name)` for Step 2. If NONE qualifies, generate one: find a dispense-heavy function (e.g. `melee-agent extract get mnVibration_80248644`), then `melee-agent debug dump local <unit.c> -f <FN> --output tests/fixtures/mwcc_debug/<FN>_pcdump.txt` and commit it.

- [ ] **Step 2: Write the gate test (substitute the verified fixture/function)**

```python
# tools/melee-agent/tests/test_first_divergence_replay.py
import pathlib
import pytest
from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function
from src.mwcc_debug import first_divergence as fd

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"
# Replace with the (file, function) verified in Step 1:
FIXTURE_FILE = "fn_802461BC_pcdump.txt"
FIXTURE_FN = "mnDiagram3_8024714C"


def _load():
    p = FIXTURES / FIXTURE_FILE
    if not p.exists():
        pytest.skip(f"{FIXTURE_FILE} not present")
    fev = find_function(parse_hook_events(p.read_text()), FIXTURE_FN)
    if fev is None:
        pytest.skip(f"{FIXTURE_FN} not in {FIXTURE_FILE}")
    return fev


def test_fixture_exercises_dispense_and_reuse():
    """Guard: the gate is meaningless on a fixture with no callee-save reuse."""
    fev = _load()
    section = fd.select_class_section(fev, 0)
    views = fd.decision_views(section, fev)
    steps = fd.replay_decisions(views)
    dispenses = [s for s in steps if s.dispensed]
    reuses = [s for s in steps
              if not s.dispensed and s.predicted_reg in set(range(13, 32))]
    assert len(dispenses) >= 1, "fixture never dispenses a callee-save"
    assert len(reuses) >= 1, "fixture never reuses a dispensed callee-save (won't validate C2)"


def test_replay_reproduces_recorded_coloring():
    """ACCEPTANCE GATE 1: predicted == recorded at every non-spilled, non-capped
    class-0 decision. Oracle = recorded assigned_reg (NOT simulate)."""
    fev = _load()
    section = fd.select_class_section(fev, 0)
    views = fd.decision_views(section, fev)
    recorded = {v.ig_idx: v.assigned_reg for v in views}
    mismatches = []
    for s in fd.replay_decisions(views):
        v = next(vv for vv in views if vv.ig_idx == s.ig_idx)
        if v.spilled or s.cap_hit:
            continue
        if s.predicted_reg != recorded[s.ig_idx]:
            mismatches.append((s.ig_idx, s.iter_idx, s.predicted_reg, recorded[s.ig_idx]))
    assert not mismatches, f"replay diverged from recorded coloring: {mismatches}"
```

- [ ] **Step 3: Run the gate**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence_replay.py -v`
Expected: PASS. If `test_replay_reproduces_recorded_coloring` FAILS, the mismatch list localizes the modeling gap — debug `replay_decisions` (Task 5) against the listed iters before proceeding. This gate MUST pass before Task 12 (don't trust classification until replay reproduces the recorded coloring). If failures are concentrated on capped rows, confirm Step 2 is skipping `s.cap_hit` and that the cap-hit count is small; a fixture dominated by capped rows is a poor Check-1 choice — pick another.

- [ ] **Step 4: Commit**

```bash
git add tools/melee-agent/tests/test_first_divergence_replay.py
git commit -m "test: Check 1 replay smoke test vs recorded coloring (acceptance gate 1)"
```

---

### Task 12: Check 2 — gm Case D + lbDvd register-choice (ACCEPTANCE GATE 2)

**Files:**
- Create: `tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt`
- Create: `tools/melee-agent/tests/fixtures/mwcc_debug/lbDvd_80018A2C_pcdump.txt`
- Test: `tools/melee-agent/tests/test_first_divergence_gm_lbdvd.py`

Gate: the analyzer mechanically reproduces each function's first-divergence allocator fact. gm → Case D (42/38 coalesced to root 3); lbDvd → register-choice on {44,46} with the r10↔r12 swap. NOT the full multi-decision manual narrative (that's a v1 non-goal).

- [ ] **Step 1: Generate and commit the gm + lbDvd baseline pcdumps**

Run (discover each source unit, then dump its NATURAL baseline — no `--force-phys`; the force map is supplied to the analyzer, not the compiler):
```bash
cd /Users/mike/code/melee
# Source units (resolved): gm_80173EEC -> src/melee/gm/gm_16F1.c (defines it at the
# `void gm_80173EEC(void)` body, with a `gm_80173EEC_inline` static inline above);
# lbDvd_80018A2C -> src/melee/lb/lbdvd.c. The NATURAL baseline dump takes no
# --force-phys (the force map is supplied to the analyzer, not the compiler).
melee-agent debug dump local src/melee/gm/gm_16F1.c -f gm_80173EEC \
  --output tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt
melee-agent debug dump local src/melee/lb/lbdvd.c -f lbDvd_80018A2C \
  --output tools/melee-agent/tests/fixtures/mwcc_debug/lbDvd_80018A2C_pcdump.txt
```

(`gm_16F1.c` is a large multi-function TU — the dump will contain every function's hook events; `find_function(events, "gm_80173EEC")` selects the right one, so no trimming is needed. If `dump local` requires the function to be matched/buildable and gm/lbDvd are still unmatched, and the dump fails, fall back to `dump remote` with the same `-f`/`--output` flags.)
Verify each dump contains a class-0 `COLORGRAPH DECISIONS` block and (for gm) a `COALESCED ALIASES` block:
```bash
grep -c "COLORGRAPH DECISIONS" tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt
grep "42 ->" tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt   # expect 42 -> 3
```

- [ ] **Step 2: Pin lbDvd's exact baseline regs from the generated fixture**

Run: `cd tools/melee-agent && python -c "
from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function
import pathlib
fev=find_function(parse_hook_events(pathlib.Path('tests/fixtures/mwcc_debug/lbDvd_80018A2C_pcdump.txt').read_text()),'lbDvd_80018A2C')
from src.mwcc_debug import first_divergence as fd
sec=fd.select_class_section(fev,0)
for v in fd.decision_views(sec,fev):
    if v.ig_idx in (44,46): print(v.ig_idx, v.iter_idx, 'r%d'%v.assigned_reg)
"`
Expected: prints ig 44 and 46 with their recorded regs (expected to be the r10/r12 pair). Record which of 44/46 has the lower `iter_idx` (that's the first divergence) and its baseline reg — used to tighten the assertion below.

- [ ] **Step 3: Write the gate tests**

```python
# tools/melee-agent/tests/test_first_divergence_gm_lbdvd.py
import pathlib
import pytest
from src.mwcc_debug.colorgraph_parser import parse_hook_events, find_function
from src.mwcc_debug import first_divergence as fd

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"


def _load(fname, fn):
    p = FIXTURES / fname
    if not p.exists():
        pytest.skip(f"{fname} not present (generate in Task 12 Step 1)")
    fev = find_function(parse_hook_events(p.read_text()), fn)
    if fev is None:
        pytest.skip(f"{fn} not in {fname}")
    return fev


def test_gm_first_divergence_is_case_d():
    """ACCEPTANCE GATE 2a: gm -> Case D, 42/38 coalesced into root 3 [r3]."""
    fev = _load("gm_80173EEC_pcdump.txt", "gm_80173EEC")
    target = fd.TargetColoring(class_id=0, force_phys={34: 31, 37: 30, 32: 29,
                                                       42: 28, 52: 28, 38: 28})
    report = fd.analyze_first_divergence(fev, target)
    assert report.fact.case == fd.DivergenceCase.D_COALESCED
    assert {42, 38}.issubset(set(report.fact.coalesced_nodes))
    assert report.fact.coalesced_root == 3
    assert report.fact.coalesced_root_phys == 3
    assert "prevent the coalesce" in report.fact.local_target


def test_lbdvd_first_divergence_is_register_choice():
    """ACCEPTANCE GATE 2b: lbDvd -> register-choice (B / B-inverse) on {44,46},
    baseline/target regs are the r10<->r12 swap."""
    fev = _load("lbDvd_80018A2C_pcdump.txt", "lbDvd_80018A2C")
    target = fd.TargetColoring(class_id=0, force_phys={44: 10, 46: 12})
    report = fd.analyze_first_divergence(fev, target)
    f = report.fact
    assert f.case in (fd.DivergenceCase.B_TARGET_HIGHER, fd.DivergenceCase.B_INVERSE)
    assert f.ig_idx in (44, 46)
    assert {f.baseline_reg, f.target_reg} <= {10, 12}
    assert f.baseline_reg != f.target_reg
```

(If Step 2 showed lbDvd's first-divergence node and exact regs, tighten the last test to `assert f.ig_idx == <observed>` and `assert (f.baseline_reg, f.target_reg) == (<observed_base>, <observed_target>)`.)

- [ ] **Step 4: Run the gate**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence_gm_lbdvd.py -v`
Expected: PASS (2 tests). If gm is NOT Case D, inspect the fixture's `COALESCED ALIASES` block — confirm `42 -> 3` / `38 -> 3` are present and that `_coalesce_root` reads `coalesced_alias_sections` correctly. If lbDvd's case is unexpected, re-derive from Step 2's printed regs and the classifier tree (Task 6).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt \
        tools/melee-agent/tests/fixtures/mwcc_debug/lbDvd_80018A2C_pcdump.txt \
        tools/melee-agent/tests/test_first_divergence_gm_lbdvd.py
git commit -m "test: Check 2 gm Case D + lbDvd register-choice (acceptance gate 2)"
```

---

### Task 13: Docs + final verification

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md` (gitignored — stage with `git add -f`)
- Test: full suite

- [ ] **Step 1: Document the command in SKILL.md**

Add a subsection under the diagnostic-tools area of `.claude/skills/mwcc-debug/SKILL.md`:

```markdown
### First-divergence analyzer (directed tell)

`melee-agent debug inspect first-divergence -f FN --force-phys 'ig:phys,...'`

Given a baseline pcdump and a same-source target coloring (force-phys map; the
map KEYS are the target node set), reports the single earliest allocator
decision that diverges from target, classified mechanically:
- **Case D** — a target node coalesced away (lever: prevent the coalesce).
- **Case E** — a target node spilled (lever: reduce its degree).
- **Cases A/B/B-inverse/C/C2** — register-choice divergences (blocked / wrong
  dispense order / sticky-pool mismatch), each with a local structural lever.

Output has two layers: a **gated** allocator-fact layer (mechanically derived,
trustworthy) and, with `--source`, an **advisory** source-idea layer (heuristic
symbol-bridge mapping — confidence + alternates, NOT validated). Re-run after
each edit to chase the new first divergence. v1 is same-source only; cross-
compile convergence is v2. See
docs/superpowers/specs/2026-05-27-first-divergence-analyzer-design.md.
```

- [ ] **Step 2: Run the full analyzer test suite**

Run: `cd tools/melee-agent && pytest tests/test_first_divergence.py tests/test_first_divergence_replay.py tests/test_first_divergence_gm_lbdvd.py -v`
Expected: PASS (all). Both acceptance gates green.

- [ ] **Step 3: Run the broader suite to confirm no regression**

Run: `cd tools/melee-agent && pytest tests/ -q`
Expected: no new failures attributable to this work (pre-existing unrelated failures, if any, unchanged).

- [ ] **Step 4: Commit**

```bash
git add -f .claude/skills/mwcc-debug/SKILL.md
git add tools/melee-agent/
git commit -m "docs: document debug inspect first-divergence in mwcc-debug SKILL"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```

---

## Acceptance summary

v1 is complete when both same-source gates are green:
1. **Check 1** (Task 11): replay reproduces the *recorded* class-0 coloring at every non-spilled decision on a dispense+reuse fixture. Validates the workingMask/sticky-pool model against ground truth (not against the approximate `simulate`).
2. **Check 2** (Task 12): the analyzer mechanically reproduces gm's first divergence (Case D, 42/38 → root 3) and lbDvd's first divergence (register-choice, r10↔r12 swap on {44,46}).

Out of scope for v1 (deferred to v2, per the spec): cross-compile role-descriptor identity, the iterative convergence loop, matched-source / grVenom validation, permuter biasing, and the fixed-IR mutual-exclusivity check. The advisory source-idea layer is emitted but explicitly NOT gated.
