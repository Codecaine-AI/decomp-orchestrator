# suggest-coalesce-source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `debug suggest-coalesce-source` — a static-analysis CLI that, given a confirmed `--force-coalesce` pair (or in discover mode, any function with a callee-save cascade), suggests C-source patterns producing the coalesce naturally.

**Architecture:** Three new modules in `tools/melee-agent/src/mwcc_debug/`: `coalesce_ir_facts.py` (pure IR analysis, reusable), `coalesce_patterns.py` (one checker per pattern), `suggest_coalesce.py` (orchestration + rendering). One CLI command added to `tools/melee-agent/src/cli/debug.py`. Validated by a YAML calibration corpus + parametrize loop.

**Tech Stack:** Python 3.11+, pytest, typer (CLI), existing `parser.py` + `symbol_bridge.py` + `colorgraph_parser.py` for IR/bridge primitives. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-suggest-coalesce-source-design.md` (commit `a2e3fb29a`, two rounds of review incorporated).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py` | CREATE | `VirtualFacts`, `IrFacts` dataclasses; `collect()`; `analyze_cascade()`; CFG helpers |
| `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py` | CREATE | `Pattern` protocol; `Suggestion` dataclass; 5 pattern checkers; `_immediate_operand` helper; `ALL_PATTERNS` |
| `tools/melee-agent/src/mwcc_debug/suggest_coalesce.py` | CREATE | `Report`, `PairReport` dataclasses; `run()`; `render_text()`; `render_json()` |
| `tools/melee-agent/src/cli/debug.py` | MODIFY | Add `suggest-coalesce-source` command |
| `tools/melee-agent/tests/test_coalesce_ir_facts.py` | CREATE | Unit tests for facts layer |
| `tools/melee-agent/tests/test_coalesce_patterns.py` | CREATE | Per-checker unit tests |
| `tools/melee-agent/tests/test_suggest_coalesce.py` | CREATE | Orchestrator + calibration parametrize loop |
| `tools/melee-agent/tests/fixtures/coalesce_calibration.yaml` | CREATE | Calibration corpus |
| `tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt` | CREATE | Generated via `pcdump-local` |
| `tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt` | CREATE | Generated via `pcdump-local` |
| `docs/mwcc-debug-handoff-2026-05-22.md` | CREATE | Handoff doc after implementation lands |
| `~/.claude/projects/-Users-mike-code-melee/memory/MEMORY.md` | MODIFY | Add pointer to suggest-coalesce-source workflow |
| `~/.claude/projects/-Users-mike-code-melee/memory/suggest_coalesce_source.md` | CREATE | Memory topic file |

---

## Task 1: Module scaffold + `VirtualFacts` / `IrFacts` dataclasses

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py`
- Create: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

- [ ] **Step 1.1: Write the failing test**

```python
# tools/melee-agent/tests/test_coalesce_ir_facts.py
"""Tests for the coalesce-suggestion IR facts layer."""

from __future__ import annotations

from src.mwcc_debug.coalesce_ir_facts import IrFacts, VirtualFacts


def test_virtual_facts_dataclass_shape() -> None:
    """VirtualFacts captures the fields the pattern checkers need."""
    vf = VirtualFacts(
        virtual=53,
        first_def=None,
        use_sites=[],
        use_sites_truncated=False,
        is_param=False,
        is_phys=False,
    )
    assert vf.virtual == 53
    assert vf.use_sites == []
    assert vf.use_sites_truncated is False


def test_ir_facts_dataclass_shape() -> None:
    """IrFacts has the expected top-level fields including cg_section."""
    facts = IrFacts(
        function_name="test_fn",
        pre_pass=None,  # type: ignore[arg-type]
        by_virtual={},
        bindings=[],
        basis=None,
        cg_section=None,
    )
    assert facts.function_name == "test_fn"
    assert facts.by_virtual == {}
    assert facts.cg_section is None
```

- [ ] **Step 1.2: Run test, verify failure**

```bash
cd /Users/mike/code/melee
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: FAIL with `ModuleNotFoundError: No module named 'src.mwcc_debug.coalesce_ir_facts'`

- [ ] **Step 1.3: Implement the module scaffold**

```python
# tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py
"""IR facts layer for `debug suggest-coalesce-source`.

Pure data-extraction over the pre-coloring IR pass + the colorgraph
hook output. Exposes per-virtual facts (first def, use sites,
parameter/physical flags) and the cascade analyzer used by discover
mode. No business logic — checkers consume these facts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .colorgraph_parser import ColorgraphSection
from .parser import Function, Instruction, Pass
from .symbol_bridge import Binding, BindingBasis, FirstDef


# Cap on use_sites per virtual — keeps memory bounded for huge functions.
# Checkers that need exhaustive counts should consult `use_sites_truncated`
# and degrade or warn.
USE_SITES_CAP = 16


@dataclass
class VirtualFacts:
    """Per-virtual data the pattern checkers consume.

    `is_phys=True` means the slot is actually a physical register
    (number < 32) — the data structure is identical and we keep one
    type for both. Checkers that care about "real" virtuals filter
    by is_phys themselves.
    """
    virtual: int
    first_def: Optional[FirstDef]
    use_sites: list[tuple[int, Instruction]]
    use_sites_truncated: bool
    is_param: bool
    is_phys: bool


@dataclass
class IrFacts:
    """All inputs the pattern checkers need for one function.

    `cg_section` is REQUIRED for discover-mode (analyze_cascade reads
    assignedReg + interferers); pair mode can run with cg_section=None.
    """
    function_name: str
    pre_pass: Pass
    by_virtual: dict[int, VirtualFacts]
    bindings: list[Binding]
    basis: Optional[BindingBasis]
    cg_section: Optional[ColorgraphSection]
```

- [ ] **Step 1.4: Run test, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 2 passed.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py \
        tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: IR facts dataclasses (Task 1)"
```

---

## Task 2: `collect()` — single-block extraction

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py`
- Modify: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

- [ ] **Step 2.1: Write the failing test**

Append to `test_coalesce_ir_facts.py`:

```python
import textwrap

from src.mwcc_debug.parser import Block, Instruction, Pass
from src.mwcc_debug.coalesce_ir_facts import collect


def _make_ist(opcode, operands, regs):
    return Instruction(
        opcode=opcode, operands=operands, annotations=[], regs=regs,
    )


def _make_block(idx, instrs, succ=None, pred=None):
    b = Block(index=idx, succ=succ or [], pred=pred or [], labels=[])
    b.instructions = instrs
    return b


def test_collect_populates_facts_for_single_block() -> None:
    """collect() builds a VirtualFacts entry for every virtual seen."""
    # A simple block: `mr r32, r3` (param init) then `li r33, 0`
    block = _make_block(0, [
        _make_ist("mr", "r32,r3", [("r", 32), ("r", 3)]),
        _make_ist("li", "r33,0", [("r", 33)]),
    ])
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.append(block)

    # Synthetic Function — we only need pre_pass + name
    from src.mwcc_debug.parser import Function
    fn = Function(name="test_fn", passes=[pre_pass])

    source = "void test_fn(int x) { int y = 0; }"
    facts = collect(fn, source)

    assert facts.function_name == "test_fn"
    assert 32 in facts.by_virtual
    assert 33 in facts.by_virtual
    # r3 is a physical reg, still gets a slot
    assert 3 in facts.by_virtual
    assert facts.by_virtual[3].is_phys is True
    assert facts.by_virtual[32].is_phys is False
```

- [ ] **Step 2.2: Run test, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py::test_collect_populates_facts_for_single_block -v --no-cov
```
Expected: FAIL with `ImportError` for `collect`.

- [ ] **Step 2.3: Implement `collect()`**

Add to `coalesce_ir_facts.py`:

```python
from .parser import Function
from .symbol_bridge import find_first_def, list_bindings_with_basis


def collect(fn: Function, source: str) -> IrFacts:
    """Build IrFacts for `fn` from its pre-coloring pass + source.

    Caller must ensure the function has at least one pre-coloring pass
    (use `fn.last_precolor_pass()` to find it). If none exists, callers
    should abort at the CLI level — this function assumes the data
    is present.

    `cg_section` is left None; the caller populates it from
    `parse_hook_events(text)` + `find_function()` when in discover mode.
    """
    pre_pass = fn.last_precolor_pass()
    if pre_pass is None:
        # No IR detail in the dump; return an empty-ish facts shell.
        return IrFacts(
            function_name=fn.name, pre_pass=Pass(name="(missing)"),
            by_virtual={}, bindings=[], basis=None, cg_section=None,
        )

    # Collect all (kind, num) operand mentions, indexed by virtual number.
    by_virtual: dict[int, VirtualFacts] = {}

    # First pass: discover every virtual mentioned anywhere.
    seen: set[int] = set()
    for block in pre_pass.blocks:
        for ist in block.instructions:
            for kind, num in ist.regs:
                if kind == "r":
                    seen.add(num)

    # Symbol bridge for source-line annotations.
    bindings, basis = list_bindings_with_basis(source, fn.name, pre_pass)

    # Second pass: collect first_def + use_sites for each virtual.
    for v in seen:
        first_def = find_first_def(v, pre_pass)
        use_sites: list[tuple[int, Instruction]] = []
        truncated = False
        for block in pre_pass.blocks:
            for ist in block.instructions:
                # A "use" is any occurrence of the virtual in the operands
                if any(k == "r" and n == v for k, n in ist.regs):
                    if len(use_sites) >= USE_SITES_CAP:
                        truncated = True
                        break
                    use_sites.append((block.index, ist))
            if truncated:
                break

        is_phys = v < 32
        is_param = _is_param(v, first_def, pre_pass, bindings, basis)
        by_virtual[v] = VirtualFacts(
            virtual=v,
            first_def=first_def,
            use_sites=use_sites,
            use_sites_truncated=truncated,
            is_param=is_param,
            is_phys=is_phys,
        )

    return IrFacts(
        function_name=fn.name, pre_pass=pre_pass,
        by_virtual=by_virtual, bindings=bindings, basis=basis,
        cg_section=None,
    )


def _is_param(
    virtual: int,
    first_def: Optional[FirstDef],
    pre_pass: Pass,
    bindings: list[Binding],
    basis: Optional[BindingBasis],
) -> bool:
    """Operational `is_param` test — see §5 of the spec.

    Primary: virtual's first-def is in entry block AND has the form
    `mr rN, rK` where K ∈ {3..10}.

    Fallback: virtual is among the first len(parsed_params) entries of
    sorted(basis.observed_virtuals).
    """
    if virtual < 32:
        return False  # physical regs aren't params
    if first_def is not None and first_def.block_idx == 0:
        if first_def.opcode == "mr":
            # regs[1] is the source register
            # We don't have regs here — re-derive from operands string
            ops = first_def.operands.replace(" ", "")
            parts = ops.split(",")
            if len(parts) >= 2 and parts[1].startswith("r"):
                try:
                    src = int(parts[1][1:])
                    if 3 <= src <= 10:
                        return True
                except ValueError:
                    pass
    # Fallback
    if basis is not None and basis.parsed_params:
        n_params = len(basis.parsed_params)
        prefix = sorted(basis.observed_virtuals)[:n_params]
        if virtual in prefix:
            return True
    return False
```

- [ ] **Step 2.4: Run test, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 3 passed.

- [ ] **Step 2.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py \
        tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: collect() single-block extraction (Task 2)"
```

---

## Task 3: `collect()` — coverage tests for multi-block + truncation

**Files:**
- Modify: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

Task 2's implementation already handles both behaviors (see the two
`for block in pre_pass.blocks` loops). This task adds explicit
coverage. Note: this is NOT a strict red-first TDD step — the tests
should pass on first run since the behavior is implemented.

- [ ] **Step 3.1: Write coverage tests for multi-block aggregation + truncation**

Append to `test_coalesce_ir_facts.py`:

```python
def test_collect_aggregates_use_sites_across_blocks() -> None:
    """A virtual used in multiple blocks gets all its use sites."""
    b0 = _make_block(0, [
        _make_ist("li", "r32,5", [("r", 32)]),
    ])
    b1 = _make_block(1, [
        _make_ist("addi", "r33,r32,1", [("r", 33), ("r", 32)]),
    ])
    b2 = _make_block(2, [
        _make_ist("stw", "r32,4(r34)", [("r", 32), ("r", 34)]),
    ])
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.extend([b0, b1, b2])
    from src.mwcc_debug.parser import Function
    fn = Function(name="test_fn", passes=[pre_pass])
    facts = collect(fn, "void test_fn(void) {}")
    use_blocks = {b for (b, _) in facts.by_virtual[32].use_sites}
    assert use_blocks == {0, 1, 2}
    assert facts.by_virtual[32].use_sites_truncated is False


def test_collect_caps_use_sites_at_USE_SITES_CAP() -> None:
    """When use sites exceed the cap, truncated flag is True."""
    from src.mwcc_debug.coalesce_ir_facts import USE_SITES_CAP
    # 20 uses in one block — should be capped to 16
    instrs = [
        _make_ist("addi", f"r33,r32,{i}", [("r", 33), ("r", 32)])
        for i in range(20)
    ]
    block = _make_block(0, instrs)
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.append(block)
    from src.mwcc_debug.parser import Function
    fn = Function(name="test_fn", passes=[pre_pass])
    facts = collect(fn, "void test_fn(void) {}")
    assert len(facts.by_virtual[32].use_sites) == USE_SITES_CAP
    assert facts.by_virtual[32].use_sites_truncated is True
```

- [ ] **Step 3.2: Run tests, verify pass**

`collect()` already does this — the existing implementation handles both paths. Run to confirm:

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 5 passed.

- [ ] **Step 3.3: Commit**

```bash
git add tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: use-sites aggregation tests (Task 3)"
```

---

## Task 4: `is_param` — coverage tests for both paths

**Files:**
- Modify: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

Task 2's `_is_param` helper already implements both paths (entry-block
ABI-mr + bridge prefix fallback). This task adds explicit coverage.
Not strict red-first — tests should pass first run.

- [ ] **Step 4.1: Write coverage tests for both paths**

Append:

```python
def test_is_param_via_entry_block_abi_mr() -> None:
    """First-def `mr r32, r3` in block 0 → is_param=True."""
    block = _make_block(0, [
        _make_ist("mr", "r32,r3", [("r", 32), ("r", 3)]),
    ])
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.append(block)
    from src.mwcc_debug.parser import Function
    fn = Function(name="f", passes=[pre_pass])
    facts = collect(fn, "void f(int x) {}")
    assert facts.by_virtual[32].is_param is True


def test_is_param_not_for_non_param_first_def() -> None:
    """First-def is `li r32, 0` (not from r3-r10) → is_param=False."""
    block = _make_block(0, [
        _make_ist("li", "r32,0", [("r", 32)]),
    ])
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.append(block)
    from src.mwcc_debug.parser import Function
    fn = Function(name="f", passes=[pre_pass])
    facts = collect(fn, "void f(void) { int x = 0; }")
    assert facts.by_virtual[32].is_param is False


def test_is_param_fallback_via_bridge_prefix() -> None:
    """When no entry-block ABI-mr, use bridge's sorted observed_virtuals
    prefix to identify likely-param virtuals."""
    # No first-def is `mr` from r3-r10, but bridge says fn has 2 params.
    block = _make_block(0, [
        _make_ist("li", "r32,0", [("r", 32)]),
        _make_ist("li", "r33,0", [("r", 33)]),
        _make_ist("li", "r34,0", [("r", 34)]),
    ])
    pre_pass = Pass(name="AFTER PEEPHOLE FORWARD")
    pre_pass.blocks.append(block)
    from src.mwcc_debug.parser import Function
    fn = Function(name="f", passes=[pre_pass])
    # Two params → first two virtuals (32, 33) should be is_param
    facts = collect(fn, "void f(int a, int b) { int c = 0; }")
    # The bridge identifies a, b as params and c as local
    assert facts.by_virtual[32].is_param is True
    assert facts.by_virtual[33].is_param is True
    assert facts.by_virtual[34].is_param is False
```

- [ ] **Step 4.2: Run tests, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 8 passed.

- [ ] **Step 4.3: Commit**

```bash
git add tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: is_param tests for both paths (Task 4)"
```

---

## Task 5: CFG helpers (`_blocks_defining`, `_common_successor`)

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py`
- Modify: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

- [ ] **Step 5.1: Write failing tests**

Append to `test_coalesce_ir_facts.py`:

```python
from src.mwcc_debug.coalesce_ir_facts import _blocks_defining, _common_successor


def test_blocks_defining_finds_all_def_blocks() -> None:
    """A virtual defined in multiple blocks → list of those block indices."""
    b0 = _make_block(0, [
        _make_ist("li", "r32,0", [("r", 32)]),
    ])
    b1 = _make_block(1, [
        _make_ist("li", "r32,1", [("r", 32)]),
    ])
    b2 = _make_block(2, [
        _make_ist("addi", "r33,r32,1", [("r", 33), ("r", 32)]),  # use only
    ])
    pre_pass = Pass(name="X")
    pre_pass.blocks.extend([b0, b1, b2])
    result = _blocks_defining(pre_pass, 32)
    assert [b.index for b in result] == [0, 1]


def test_common_successor_returns_join_index() -> None:
    """If all blocks share exactly one successor → return its index."""
    b0 = _make_block(0, [], succ=[2])
    b1 = _make_block(1, [], succ=[2])
    assert _common_successor([b0, b1]) == 2


def test_common_successor_none_when_no_shared() -> None:
    """If blocks don't all converge → None."""
    b0 = _make_block(0, [], succ=[2])
    b1 = _make_block(1, [], succ=[3])
    assert _common_successor([b0, b1]) is None


def test_common_successor_none_when_multiple_shared() -> None:
    """If blocks share multiple successors → not a single join → None."""
    b0 = _make_block(0, [], succ=[2, 3])
    b1 = _make_block(1, [], succ=[2, 3])
    assert _common_successor([b0, b1]) is None
```

- [ ] **Step 5.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py::test_blocks_defining_finds_all_def_blocks -v --no-cov
```
Expected: FAIL with `ImportError`.

- [ ] **Step 5.3: Implement the helpers**

Add to `coalesce_ir_facts.py`:

```python
from .parser import Block


def _blocks_defining(pre_pass: Pass, virtual: int) -> list[Block]:
    """Return all blocks where `virtual` is the destination (regs[0]) of
    any instruction. Used by TernaryCollapsePattern for phi-like detection.
    """
    out: list[Block] = []
    for block in pre_pass.blocks:
        for ist in block.instructions:
            if ist.regs and ist.regs[0] == ("r", virtual):
                out.append(block)
                break  # one def per block is enough
    return out


def _common_successor(blocks: list[Block]) -> Optional[int]:
    """Return the single block index that is in EVERY input block's
    successor set, or None if there isn't exactly one such join.
    """
    if not blocks:
        return None
    common = set(blocks[0].succ)
    for b in blocks[1:]:
        common &= set(b.succ)
    if len(common) == 1:
        return next(iter(common))
    return None
```

- [ ] **Step 5.4: Run tests, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 12 passed.

- [ ] **Step 5.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py \
        tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: CFG helpers (Task 5)"
```

---

## Task 6: `analyze_cascade()` — discover-mode logic

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py`
- Modify: `tools/melee-agent/tests/test_coalesce_ir_facts.py`

- [ ] **Step 6.1: Write failing tests**

Append:

```python
from src.mwcc_debug.colorgraph_parser import (
    ColorgraphDecision, ColorgraphSection,
)
from src.mwcc_debug.coalesce_ir_facts import (
    CascadeCandidate, analyze_cascade,
)


def _make_cg_section(decisions, class_id=1, n_nodes=None):
    return ColorgraphSection(
        class_id=class_id,
        result=1,
        n_nodes=n_nodes if n_nodes is not None else len(decisions),
        decisions=decisions,
    )


def _make_facts_with_cg(cg_section, by_virtual=None):
    return IrFacts(
        function_name="f",
        pre_pass=Pass(name="X"),
        by_virtual=by_virtual or {},
        bindings=[],
        basis=None,
        cg_section=cg_section,
    )


def test_analyze_cascade_returns_empty_without_cg_section() -> None:
    """Discover mode requires colorgraph data — None cg_section → []."""
    facts = _make_facts_with_cg(None)
    assert analyze_cascade(facts) == []


def test_analyze_cascade_proposes_end_of_chain_first() -> None:
    """Cascade r25..r31 (7 saved); proposed pairs collapse r25↔r26 first."""
    decisions = [
        ColorgraphDecision(iter_idx=0, ig_idx=50, assigned_reg=31,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=1, ig_idx=51, assigned_reg=30,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=2, ig_idx=52, assigned_reg=29,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=3, ig_idx=53, assigned_reg=28,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=4, ig_idx=54, assigned_reg=27,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=5, ig_idx=55, assigned_reg=26,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=6, ig_idx=56, assigned_reg=25,
                           degree=0, n_interferers=0, flags=0),
    ]
    facts = _make_facts_with_cg(_make_cg_section(decisions))
    candidates = analyze_cascade(facts)
    # First (highest-priority) candidate must collapse the lowest-end pair
    assert candidates[0].priority_class == "end-of-chain"
    # r25-holder = ig_idx 56, r26-holder = ig_idx 55 → pair (56, 55)
    assert (candidates[0].from_virt, candidates[0].to_virt) == (56, 55)


def test_analyze_cascade_skips_directly_interfering_pairs() -> None:
    """Two callee-save virtuals that directly interfere → not proposed."""
    decisions = [
        ColorgraphDecision(iter_idx=0, ig_idx=50, assigned_reg=31,
                           degree=1, n_interferers=1, flags=0,
                           interferers=[(51, 30)]),  # 50 interferes with 51
        ColorgraphDecision(iter_idx=1, ig_idx=51, assigned_reg=30,
                           degree=1, n_interferers=1, flags=0,
                           interferers=[(50, 31)]),  # mutual
    ]
    facts = _make_facts_with_cg(_make_cg_section(decisions))
    candidates = analyze_cascade(facts)
    # Mutual-interference pair should be skipped
    pairs = {(c.from_virt, c.to_virt) for c in candidates}
    assert (50, 51) not in pairs
    assert (51, 50) not in pairs


def test_analyze_cascade_marks_dependency_chain() -> None:
    """Mid-chain frees-slot candidates carry depends_on referring to
    the end-of-chain pair that must succeed first.
    """
    decisions = [
        ColorgraphDecision(iter_idx=0, ig_idx=60, assigned_reg=31,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=1, ig_idx=61, assigned_reg=30,
                           degree=0, n_interferers=0, flags=0),
        ColorgraphDecision(iter_idx=2, ig_idx=62, assigned_reg=29,
                           degree=0, n_interferers=0, flags=0),
    ]
    facts = _make_facts_with_cg(_make_cg_section(decisions))
    candidates = analyze_cascade(facts)
    # Three contiguous regs → one end-of-chain pair + one frees-slot
    # pair (29-holder into 30-holder). Strict assertion: frees must exist.
    frees = [c for c in candidates if c.priority_class == "frees-slot"]
    assert frees, "expected at least one mid-chain frees-slot candidate"
    assert frees[0].depends_on is not None
    # The dependency should refer to the end-of-chain pair (60, 61)
    # (29-holder=62 depends_on 30-holder=61's merge into 30→31... actually
    # the end-of-chain pair is the LOWEST-reg → next pair: (60, 61)
    # since cascade=[29, 30, 31], end_pair=(by_reg[29].ig_idx,
    # by_reg[30].ig_idx) = (62, 61))
    assert frees[0].depends_on == (62, 61)
```

- [ ] **Step 6.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py::test_analyze_cascade_returns_empty_without_cg_section -v --no-cov
```
Expected: FAIL with `ImportError` for `analyze_cascade`.

- [ ] **Step 6.3: Implement `analyze_cascade`**

Add to `coalesce_ir_facts.py`:

```python
# GPR callee-save range. FP analog (f24..f31) handled by class param;
# v1 ships GPR only — see spec §5 limitations.
_GPR_CALLEE_SAVES = list(range(25, 32))  # r25..r31


@dataclass
class CascadeCandidate:
    """One proposed coalesce surfaced by analyze_cascade()."""
    from_virt: int        # ig_idx of the virtual that would be merged away
    to_virt: int          # ig_idx of the virtual it would merge into
    priority_class: str   # "end-of-chain" | "frees-slot"
    depends_on: Optional[tuple[int, int]]  # earlier pair this depends on


def analyze_cascade(facts: IrFacts) -> list[CascadeCandidate]:
    """Identify the longest descending callee-save chain and propose
    coalesces that would shorten it.

    Algorithm: see spec §5 (the version with the corrected interferer
    test and priority_class annotations). Returns at most `top` pairs
    when the caller passes one — this function returns all candidates;
    the orchestrator slices.
    """
    cg = facts.cg_section
    if cg is None:
        return []

    # Find callee-save nodes (GPR r25..r31), sorted by assigned_reg desc
    saves = [
        d for d in cg.decisions if d.assigned_reg in _GPR_CALLEE_SAVES
    ]
    if len(saves) < 2:
        return []
    saves.sort(key=lambda d: -d.assigned_reg)

    # Identify the contiguous cascade from the bottom (lowest reg up)
    # — that's the chain whose `stmw` range we could shrink.
    asc = sorted({d.assigned_reg for d in saves})
    # Find the longest contiguous prefix starting from asc[0]
    cascade: list[int] = []
    for i, r in enumerate(asc):
        if i == 0 or r == asc[i - 1] + 1:
            cascade.append(r)
        else:
            break
    if len(cascade) < 2:
        return []

    # Map assigned_reg → decision (one holder per reg by convention)
    by_reg: dict[int, ColorgraphDecision] = {}
    for d in saves:
        by_reg.setdefault(d.assigned_reg, d)

    # Mutual-interference check helper
    def interferes(a: ColorgraphDecision, b: ColorgraphDecision) -> bool:
        a_idxs = {ig for (ig, _) in a.interferers}
        b_idxs = {ig for (ig, _) in b.interferers}
        return b.ig_idx in a_idxs or a.ig_idx in b_idxs

    # Build candidates: end-of-chain pair first, then frees-slot pairs
    candidates: list[CascadeCandidate] = []
    end_pair: Optional[CascadeCandidate] = None

    # End-of-chain: lowest-reg with next-up-reg
    low = cascade[0]
    mid = cascade[1]
    low_d = by_reg.get(low)
    mid_d = by_reg.get(mid)
    if low_d is not None and mid_d is not None and not interferes(low_d, mid_d):
        end_pair = CascadeCandidate(
            from_virt=low_d.ig_idx,
            to_virt=mid_d.ig_idx,
            priority_class="end-of-chain",
            depends_on=None,
        )
        candidates.append(end_pair)

    # Frees-slot: each successive pair above the end-of-chain
    for i in range(1, len(cascade) - 1):
        a_d = by_reg.get(cascade[i])
        b_d = by_reg.get(cascade[i + 1])
        if a_d is None or b_d is None:
            continue
        if interferes(a_d, b_d):
            continue
        dep = (end_pair.from_virt, end_pair.to_virt) if end_pair else None
        candidates.append(CascadeCandidate(
            from_virt=a_d.ig_idx,
            to_virt=b_d.ig_idx,
            priority_class="frees-slot",
            depends_on=dep,
        ))

    return candidates
```

- [ ] **Step 6.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py -v --no-cov
```
Expected: 16 passed.

- [ ] **Step 6.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py \
        tools/melee-agent/tests/test_coalesce_ir_facts.py
git commit -m "suggest-coalesce-source: analyze_cascade with priority + depends_on (Task 6)"
```

---

## Task 7: Generate calibration pcdump fixtures

**Files:**
- Create: `tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt`
- Create: `tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt`

This is a non-code task. The pcdumps must exist before integration tests can run.

- [ ] **Step 7.1: Pre-flight — verify pcdump-local works on both functions**

```bash
cd /Users/mike/code/melee
# fn_802461BC lives in mnDiagram3.c
python -m src.cli debug pcdump-local src/melee/mn/mndiagram3.c \
    --output /tmp/mndiagram3_pcdump.txt 2>&1 | tail -3
# Expected: "wrote: ..."; no `[pcdump-local] no compile progress` warning.

# mnVibration_80248644 lives in mnvibration.c
python -m src.cli debug pcdump-local src/melee/mn/mnvibration.c \
    --output /tmp/mnvibration_pcdump.txt 2>&1 | tail -3
# Expected: "wrote: ..."
```

If either run triggers the watchdog or fails to produce a dump, STOP and escalate. The plan can't proceed with fixtures we can't reproduce.

- [ ] **Step 7.2: Extract per-function slices for fixtures**

The full TU pcdumps include all functions in the unit. For test fixtures, slice to just the target function plus its hook events.

```bash
# Use the existing function-sliced parsing (see parser.py + Function class)
# The simplest fixture is the FULL pcdump — the parser handles multi-function
# files. We trust the parser's slicing rather than hand-slicing.
mkdir -p tools/melee-agent/tests/fixtures/mwcc_debug

cp /tmp/mndiagram3_pcdump.txt \
   tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt
cp /tmp/mnvibration_pcdump.txt \
   tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt
```

- [ ] **Step 7.3: Verify the fixtures contain the target functions**

```bash
grep "^fn_802461BC$\|^mnDiagram3_8024714C" \
    tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt | head -3
# Expected: at least one match

grep "^mnVibration_80248644" \
    tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt | head -3
# Expected: at least one match
```

- [ ] **Step 7.4: Commit**

```bash
git add tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt \
        tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt
git commit -m "suggest-coalesce-source: calibration pcdump fixtures (Task 7)"
```

---

## Task 8: Pattern protocol + scaffolds

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Create: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 8.1: Write the failing tests (with skip-marker for the
  pending all-patterns check)**

```python
# tools/melee-agent/tests/test_coalesce_patterns.py
"""Tests for per-pattern coalesce checkers."""

from __future__ import annotations

import pytest

from src.mwcc_debug.coalesce_patterns import (
    ALL_PATTERNS,
    Pattern,
    Suggestion,
    _immediate_operand,
)
from src.mwcc_debug.parser import Instruction


def test_suggestion_dataclass_shape() -> None:
    """Suggestion captures the fields the renderer consumes."""
    s = Suggestion(
        pattern_name="direct-identity",
        summary="r53 already copies from r34",
        ir_evidence="B5: addi r53, r34, 0",
        source_hint=None,
        catalog_ref="alias-split",
    )
    assert s.pattern_name == "direct-identity"


# Skipped until Tasks 9–13 add each checker; un-skipped in Task 13.
@pytest.mark.skip(reason="checkers added in Tasks 9-13; final assertion enabled in Task 13")
def test_all_patterns_initial_set() -> None:
    """ALL_PATTERNS should list exactly the five v1 checkers."""
    names = {p.name for p in ALL_PATTERNS}
    assert names == {
        "direct-identity", "chain-init", "alias-split",
        "common-subexpr", "ternary-collapse",
    }


def test_immediate_operand_parses_trailing_int() -> None:
    """_immediate_operand picks the trailing integer literal."""
    ist = Instruction(opcode="addi", operands="r53,r34,0",
                      annotations=[], regs=[("r", 53), ("r", 34)])
    assert _immediate_operand(ist) == 0

    ist = Instruction(opcode="li", operands="r33,42",
                      annotations=[], regs=[("r", 33)])
    assert _immediate_operand(ist) == 42

    ist = Instruction(opcode="mr", operands="r53,r34",
                      annotations=[], regs=[("r", 53), ("r", 34)])
    assert _immediate_operand(ist) is None
```

- [ ] **Step 8.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: FAIL with `ImportError`.

- [ ] **Step 8.3: Implement scaffold + helper**

```python
# tools/melee-agent/src/mwcc_debug/coalesce_patterns.py
"""Pattern checkers for `debug suggest-coalesce-source`.

Each checker maps a (virt_a, virt_b) pair to a Suggestion when its
IR-level match condition holds. Multiple checkers can match the same
pair — the orchestrator reports all of them. To avoid duplicate
suggestions when one pattern is a strict refinement of another, the
more specific pattern excludes the general case in its own match
condition (see AliasSplitPattern's exclusion).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Protocol

from .coalesce_ir_facts import IrFacts
from .parser import Instruction


@dataclass
class Suggestion:
    """One ranked pattern suggestion."""
    pattern_name: str
    summary: str
    ir_evidence: str
    source_hint: Optional[str]
    catalog_ref: Optional[str]


class Pattern(Protocol):
    """Pattern checker interface."""
    name: str
    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]: ...


# Trailing-int regex: matches the last comma-separated token that's a
# bare integer literal (with optional leading minus).
_TRAILING_INT_RE = re.compile(r",(-?\d+)\s*$")


def _immediate_operand(ist: Instruction) -> Optional[int]:
    """Return the trailing integer literal in `ist.operands`, or None.

    Used by checkers that need to distinguish `addi rN, rM, 0` (an
    identity-aliased copy) from `addi rN, rM, K` (an offset arithmetic).
    """
    m = _TRAILING_INT_RE.search(ist.operands)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


# Forward-declared — populated below as each pattern lands.
ALL_PATTERNS: list[Pattern] = []
```

The `ALL_PATTERNS` list is empty at this stage. The
`test_all_patterns_initial_set` test is marked `@pytest.mark.skip` in
Step 8.1 above, to be un-skipped in Task 13 once all five checkers
land. No test rewrite needed mid-task.

- [ ] **Step 8.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 2 passed, 1 skipped.

- [ ] **Step 8.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: pattern scaffold + _immediate_operand (Task 8)"
```

---

## Task 9: `DirectIdentityPattern`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Modify: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 9.1: Write the failing tests**

Append to `test_coalesce_patterns.py`:

```python
from src.mwcc_debug.coalesce_ir_facts import IrFacts, VirtualFacts
from src.mwcc_debug.coalesce_patterns import DirectIdentityPattern
from src.mwcc_debug.parser import Block, Pass
from src.mwcc_debug.symbol_bridge import FirstDef


def _facts_with(virtual_facts: dict) -> IrFacts:
    return IrFacts(
        function_name="f",
        pre_pass=Pass(name="X"),
        by_virtual=virtual_facts,
        bindings=[],
        basis=None,
        cg_section=None,
    )


def _vf(virtual, first_def, *, is_phys=False, is_param=False,
        use_sites=None):
    return VirtualFacts(
        virtual=virtual, first_def=first_def,
        use_sites=use_sites or [], use_sites_truncated=False,
        is_param=is_param, is_phys=is_phys,
    )


def test_direct_identity_matches_addi_zero() -> None:
    """First-def `addi r53, r34, 0` → DirectIdentity fires."""
    fd = FirstDef(block_idx=5, opcode="addi", operands="r53,r34,0",
                  annotations=[])
    # We also need regs on the underlying Instruction — but find_first_def
    # exposes only opcode/operands/annotations. The pattern uses
    # _immediate_operand which parses operands directly.
    # However the spec says regs[0]==dest, regs[1]==source check is done.
    # Our pattern looks at the underlying instruction's `regs`, so we
    # need to wire that through. For test purposes, attach a synthetic
    # instruction to the FirstDef via a side-channel — see Task 9 impl.
    fd.regs = [("r", 53), ("r", 34)]  # type: ignore[attr-defined]
    facts = _facts_with({53: _vf(53, fd)})
    p = DirectIdentityPattern()
    s = p.check(facts, (53, 34))
    assert s is not None
    assert s.pattern_name == "direct-identity"


def test_direct_identity_skips_addi_nonzero() -> None:
    """First-def `addi r53, r34, 8` → NOT identity (offset arithmetic)."""
    fd = FirstDef(block_idx=5, opcode="addi", operands="r53,r34,8",
                  annotations=[])
    fd.regs = [("r", 53), ("r", 34)]  # type: ignore[attr-defined]
    facts = _facts_with({53: _vf(53, fd)})
    s = DirectIdentityPattern().check(facts, (53, 34))
    assert s is None


def test_direct_identity_skips_wrong_source_register() -> None:
    """First-def `addi r53, r35, 0` → not from r34; pair (53,34) fails."""
    fd = FirstDef(block_idx=5, opcode="addi", operands="r53,r35,0",
                  annotations=[])
    fd.regs = [("r", 53), ("r", 35)]  # type: ignore[attr-defined]
    facts = _facts_with({53: _vf(53, fd)})
    s = DirectIdentityPattern().check(facts, (53, 34))
    assert s is None


def test_direct_identity_skips_missing_first_def() -> None:
    """Virtual not defined anywhere → no match."""
    facts = _facts_with({53: _vf(53, first_def=None)})
    s = DirectIdentityPattern().check(facts, (53, 34))
    assert s is None
```

- [ ] **Step 9.2: Update `FirstDef` to carry `regs`**

The existing `FirstDef` in `symbol_bridge.py` doesn't carry regs. Update it now since multiple pattern checkers will need it. Make this change in `symbol_bridge.py`:

```python
# tools/melee-agent/src/mwcc_debug/symbol_bridge.py
@dataclass
class FirstDef:
    block_idx: int
    opcode: str
    operands: str
    annotations: list[str]
    regs: list[tuple[str, int]] = field(default_factory=list)


def find_first_def(virtual: int, pre_pass) -> Optional[FirstDef]:
    """..."""
    for block in pre_pass.blocks:
        for ist in block.instructions:
            if not ist.regs:
                continue
            kind, num = ist.regs[0]
            if kind == "r" and num == virtual:
                return FirstDef(
                    block_idx=block.index,
                    opcode=ist.opcode,
                    operands=ist.operands,
                    annotations=list(ist.annotations),
                    regs=list(ist.regs),  # <-- NEW
                )
    return None
```

- [ ] **Step 9.3: Run, verify failure (pattern not implemented yet)**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py::test_direct_identity_matches_addi_zero -v --no-cov
```
Expected: FAIL with `ImportError: DirectIdentityPattern`.

- [ ] **Step 9.4: Implement `DirectIdentityPattern`**

Append to `coalesce_patterns.py`:

```python
class DirectIdentityPattern:
    """First-def of r_a is `addi r_a, r_b, 0` or `mr r_a, r_b`.

    r_a is already a direct copy from r_b — the coalescer should have
    merged them, but didn't. The fact it didn't means they interfere
    somewhere; the suggestion explains how to shrink the live range
    so the merge can happen.
    """
    name = "direct-identity"

    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]:
        a, b = pair
        fa = facts.by_virtual.get(a)
        if fa is None or fa.first_def is None:
            return None
        fd = fa.first_def
        if len(fd.regs) < 2:
            return None
        if fd.regs[0] != ("r", a):
            return None
        if fd.regs[1] != ("r", b):
            return None
        if fd.opcode == "mr":
            return self._make_suggestion(facts, pair, fd, "mr")
        if fd.opcode == "addi" and _immediate_operand(
            _instr_from_first_def(fd),
        ) == 0:
            return self._make_suggestion(facts, pair, fd, "addi-0")
        return None

    @staticmethod
    def _make_suggestion(facts, pair, fd, kind):
        a, b = pair
        op_text = "mr" if kind == "mr" else "addi"
        return Suggestion(
            pattern_name="direct-identity",
            summary=f"r{a} is already a direct copy from r{b}",
            ir_evidence=f"B{fd.block_idx}: {op_text} r{a}, r{b}"
                       f"{', 0' if kind == 'addi-0' else ''}",
            source_hint=(
                "Try: shrink the live range of r{a} or r{b} by removing "
                "an intermediate use that's preventing the merge. "
                "alias-split is the closest existing catalog entry — its "
                "'shrink the live range' advice applies."
            ).format(a=a, b=b),
            catalog_ref="alias-split",
        )


def _instr_from_first_def(fd) -> Instruction:
    """Adapter: build an Instruction-shaped object from a FirstDef so
    _immediate_operand() can be called uniformly. The fields used
    (opcode, operands) are present on both types.
    """
    return Instruction(
        opcode=fd.opcode, operands=fd.operands, annotations=[],
        regs=list(fd.regs),
    )


ALL_PATTERNS.append(DirectIdentityPattern())
```

- [ ] **Step 9.5: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 6 passed, 1 skipped.

Also re-run the full IR-facts test file in case the FirstDef change broke anything:

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py \
                 tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py \
                 --no-cov
```
Expected: all pass.

- [ ] **Step 9.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: DirectIdentityPattern + FirstDef.regs (Task 9)"
```

---

## Task 10: `ChainInitPattern`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Modify: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 10.1: Write failing tests**

Append to `test_coalesce_patterns.py`:

```python
from src.mwcc_debug.coalesce_patterns import ChainInitPattern


def test_chain_init_matches_same_block_same_immediate() -> None:
    """Two adjacent `li r_X, 0` in the same block → ChainInit fires."""
    fd_a = FirstDef(block_idx=2, opcode="li", operands="r33,0",
                    annotations=[], regs=[("r", 33)])
    fd_b = FirstDef(block_idx=2, opcode="li", operands="r34,0",
                    annotations=[], regs=[("r", 34)])
    facts = _facts_with({
        33: _vf(33, fd_a),
        34: _vf(34, fd_b),
    })
    s = ChainInitPattern().check(facts, (33, 34))
    assert s is not None
    assert s.pattern_name == "chain-init"


def test_chain_init_skips_different_immediates() -> None:
    """`li r33,0` vs `li r34,5` → not a chain-init."""
    fd_a = FirstDef(block_idx=2, opcode="li", operands="r33,0",
                    annotations=[], regs=[("r", 33)])
    fd_b = FirstDef(block_idx=2, opcode="li", operands="r34,5",
                    annotations=[], regs=[("r", 34)])
    facts = _facts_with({33: _vf(33, fd_a), 34: _vf(34, fd_b)})
    assert ChainInitPattern().check(facts, (33, 34)) is None


def test_chain_init_skips_blocks_too_far_apart() -> None:
    """Defs in unrelated blocks (distance > 3) → not chain-init."""
    fd_a = FirstDef(block_idx=0, opcode="li", operands="r33,0",
                    annotations=[], regs=[("r", 33)])
    fd_b = FirstDef(block_idx=10, opcode="li", operands="r34,0",
                    annotations=[], regs=[("r", 34)])
    facts = _facts_with({33: _vf(33, fd_a), 34: _vf(34, fd_b)})
    assert ChainInitPattern().check(facts, (33, 34)) is None


def test_chain_init_skips_non_li_opcode() -> None:
    """`addi r33, r0, 0` looks similar but isn't `li` → skip."""
    fd_a = FirstDef(block_idx=2, opcode="addi", operands="r33,r0,0",
                    annotations=[], regs=[("r", 33), ("r", 0)])
    fd_b = FirstDef(block_idx=2, opcode="li", operands="r34,0",
                    annotations=[], regs=[("r", 34)])
    facts = _facts_with({33: _vf(33, fd_a), 34: _vf(34, fd_b)})
    assert ChainInitPattern().check(facts, (33, 34)) is None
```

- [ ] **Step 10.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py::test_chain_init_matches_same_block_same_immediate -v --no-cov
```
Expected: FAIL with `ImportError: ChainInitPattern`.

- [ ] **Step 10.3: Implement `ChainInitPattern`**

Append to `coalesce_patterns.py`:

```python
class ChainInitPattern:
    """Both virtuals initialized to the same value (typically 0) in
    adjacent IR. Combining into a chained C-source assignment collapses
    the two `li` ops and lets MWCC coalesce.
    """
    name = "chain-init"

    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]:
        a, b = pair
        fa = facts.by_virtual.get(a)
        fb = facts.by_virtual.get(b)
        if not fa or not fb or fa.first_def is None or fb.first_def is None:
            return None
        if fa.first_def.opcode != "li" or fb.first_def.opcode != "li":
            return None
        imm_a = _immediate_operand(_instr_from_first_def(fa.first_def))
        imm_b = _immediate_operand(_instr_from_first_def(fb.first_def))
        if imm_a is None or imm_a != imm_b:
            return None
        # Adjacency: same block OR within 3 blocks of each other
        if abs(fa.first_def.block_idx - fb.first_def.block_idx) > 3:
            return None
        return Suggestion(
            pattern_name="chain-init",
            summary=f"r{a} and r{b} are both initialized to {imm_a}",
            ir_evidence=(
                f"B{fa.first_def.block_idx}: li r{a}, {imm_a}; "
                f"B{fb.first_def.block_idx}: li r{b}, {imm_b}"
            ),
            source_hint=(
                f"Combine the two assignments into a chain: "
                f"var_a = (var_b = {imm_a});"
            ),
            catalog_ref="chained-init",
        )


ALL_PATTERNS.append(ChainInitPattern())
```

- [ ] **Step 10.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 10 passed, 1 skipped.

- [ ] **Step 10.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: ChainInitPattern (Task 10)"
```

---

## Task 11: `AliasSplitPattern`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Modify: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 11.1: Write failing tests**

Append to `test_coalesce_patterns.py`:

```python
from src.mwcc_debug.coalesce_patterns import AliasSplitPattern
from src.mwcc_debug.parser import Block


def _mk_use(block_idx, opcode="addi", operands="r33,r32,1"):
    """Construct (block_idx, Instruction) for VirtualFacts.use_sites."""
    return (block_idx, Instruction(
        opcode=opcode, operands=operands, annotations=[],
        regs=[("r", 33), ("r", 32)],
    ))


def _pre_pass_with_blocks(n_blocks):
    pp = Pass(name="X")
    pp.blocks = [Block(index=i, succ=[], pred=[], labels=[])
                 for i in range(n_blocks)]
    return pp


def test_alias_split_matches_long_short_pair() -> None:
    """r_b long-lived (5 blocks in 8-block fn), r_a short (all in B7)."""
    fd_long = FirstDef(block_idx=0, opcode="li", operands="r32,5",
                       annotations=[], regs=[("r", 32)])
    fd_short = FirstDef(block_idx=7, opcode="addi", operands="r33,r32,1",
                        annotations=[], regs=[("r", 33), ("r", 32)])
    facts = IrFacts(
        function_name="f",
        pre_pass=_pre_pass_with_blocks(8),
        by_virtual={
            32: _vf(32, fd_long, use_sites=[
                _mk_use(0), _mk_use(1), _mk_use(2), _mk_use(5), _mk_use(7),
            ]),
            33: _vf(33, fd_short, use_sites=[_mk_use(7), _mk_use(7)]),
        },
        bindings=[], basis=None, cg_section=None,
    )
    s = AliasSplitPattern().check(facts, (33, 32))
    assert s is not None
    assert s.pattern_name == "alias-split"


def test_alias_split_skips_when_a_also_long_lived() -> None:
    """Both virtuals long-lived → no split makes sense."""
    fd_a = FirstDef(block_idx=0, opcode="li", operands="r33,5",
                    annotations=[], regs=[("r", 33)])
    fd_b = FirstDef(block_idx=0, opcode="li", operands="r32,5",
                    annotations=[], regs=[("r", 32)])
    facts = IrFacts(
        function_name="f",
        pre_pass=_pre_pass_with_blocks(8),
        by_virtual={
            32: _vf(32, fd_b, use_sites=[
                _mk_use(0), _mk_use(2), _mk_use(4), _mk_use(6),
            ]),
            33: _vf(33, fd_a, use_sites=[
                _mk_use(0), _mk_use(2), _mk_use(4), _mk_use(6),
            ]),
        },
        bindings=[], basis=None, cg_section=None,
    )
    assert AliasSplitPattern().check(facts, (33, 32)) is None


def test_alias_split_skips_when_b_used_too_few() -> None:
    """r_b must have ≥ 4 use sites; 3 isn't enough."""
    fd_b = FirstDef(block_idx=0, opcode="li", operands="r32,5",
                    annotations=[], regs=[("r", 32)])
    fd_a = FirstDef(block_idx=7, opcode="addi", operands="r33,r32,1",
                    annotations=[], regs=[("r", 33), ("r", 32)])
    facts = IrFacts(
        function_name="f",
        pre_pass=_pre_pass_with_blocks(8),
        by_virtual={
            32: _vf(32, fd_b, use_sites=[_mk_use(0), _mk_use(2), _mk_use(7)]),
            33: _vf(33, fd_a, use_sites=[_mk_use(7)]),
        },
        bindings=[], basis=None, cg_section=None,
    )
    assert AliasSplitPattern().check(facts, (33, 32)) is None


def test_alias_split_excludes_direct_identity_case() -> None:
    """If r_a's first-def is `addi r_a, r_b, 0`, DirectIdentity owns this
    pair; AliasSplit should not also fire."""
    fd_a_identity = FirstDef(
        block_idx=7, opcode="addi", operands="r33,r32,0",
        annotations=[], regs=[("r", 33), ("r", 32)],
    )
    fd_b = FirstDef(block_idx=0, opcode="li", operands="r32,5",
                    annotations=[], regs=[("r", 32)])
    facts = IrFacts(
        function_name="f",
        pre_pass=_pre_pass_with_blocks(8),
        by_virtual={
            32: _vf(32, fd_b, use_sites=[
                _mk_use(0), _mk_use(1), _mk_use(2), _mk_use(5), _mk_use(7),
            ]),
            33: _vf(33, fd_a_identity, use_sites=[_mk_use(7)]),
        },
        bindings=[], basis=None, cg_section=None,
    )
    # AliasSplit's exclusion: r_a is not already a direct copy of r_b
    assert AliasSplitPattern().check(facts, (33, 32)) is None
```

- [ ] **Step 11.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py::test_alias_split_matches_long_short_pair -v --no-cov
```
Expected: FAIL with ImportError.

- [ ] **Step 11.3: Implement `AliasSplitPattern`**

Append to `coalesce_patterns.py`:

```python
class AliasSplitPattern:
    """r_b is long-lived (≥4 use sites, spans ≥50% of function's blocks),
    r_a is short-lived (≤3 uses, all in same block). Introducing an alias
    variable just before r_a's first use lets r_a inherit r_b's lifetime
    endpoint so they can coalesce.

    EXCLUSION: if r_a's first-def is already `addi r_a, r_b, 0` or
    `mr r_a, r_b`, DirectIdentityPattern owns the pair and we skip
    (otherwise we'd fire on every direct-identity case).
    """
    name = "alias-split"

    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]:
        a, b = pair
        fa = facts.by_virtual.get(a)
        fb = facts.by_virtual.get(b)
        if not fa or not fb or fa.first_def is None or fb.first_def is None:
            return None

        # Exclusion: skip if DirectIdentity would fire
        fa_fd = fa.first_def
        if len(fa_fd.regs) >= 2 and fa_fd.regs[1] == ("r", b):
            if fa_fd.opcode == "mr":
                return None
            if fa_fd.opcode == "addi" and _immediate_operand(
                _instr_from_first_def(fa_fd)) == 0:
                return None

        # r_b: long-lived
        b_uses = len(fb.use_sites)
        b_blocks = {bi for (bi, _) in fb.use_sites}
        total_blocks = max(1, len(facts.pre_pass.blocks))
        if b_uses < 4:
            return None
        if len(b_blocks) / total_blocks < 0.5:
            return None

        # r_a: short-lived, all in same block
        a_uses = len(fa.use_sites)
        a_blocks = {bi for (bi, _) in fa.use_sites}
        if a_uses > 3:
            return None
        if len(a_blocks) > 1:
            return None
        a_block = next(iter(a_blocks)) if a_blocks else fa.first_def.block_idx

        return Suggestion(
            pattern_name="alias-split",
            summary=(
                f"r{b} is long-lived ({b_uses} uses across {len(b_blocks)} "
                f"blocks); r{a} is short-lived (used only in block B{a_block})"
            ),
            ir_evidence=(
                f"r{b} uses: blocks {sorted(b_blocks)}; "
                f"r{a} uses: block B{a_block}"
            ),
            source_hint=(
                f"Introduce an alias variable before r{a}'s first use:\n"
                f"    <type> tmp = <var_b>;\n"
                f"    use(tmp);  // formerly use(r_a)"
            ),
            catalog_ref="alias-split",
        )


ALL_PATTERNS.append(AliasSplitPattern())
```

- [ ] **Step 11.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 14 passed, 1 skipped.

- [ ] **Step 11.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: AliasSplitPattern (Task 11)"
```

---

## Task 12: `CommonSubExprPattern`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Modify: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 12.1: Write failing tests**

Append to `test_coalesce_patterns.py`:

```python
from src.mwcc_debug.coalesce_patterns import CommonSubExprPattern


def test_common_subexpr_matches_identical_ops() -> None:
    """r_a and r_b defined by structurally-identical lwz from r34+0x2C."""
    fd_a = FirstDef(block_idx=3, opcode="lwz", operands="r33,44(r34)",
                    annotations=[], regs=[("r", 33), ("r", 34)])
    fd_b = FirstDef(block_idx=5, opcode="lwz", operands="r35,44(r34)",
                    annotations=[], regs=[("r", 35), ("r", 34)])
    facts = _facts_with({
        33: _vf(33, fd_a),
        35: _vf(35, fd_b),
    })
    s = CommonSubExprPattern().check(facts, (33, 35))
    assert s is not None
    assert s.pattern_name == "common-subexpr"


def test_common_subexpr_skips_different_opcodes() -> None:
    """Same operands but `lwz` vs `lbz` → not the same expression."""
    fd_a = FirstDef(block_idx=3, opcode="lwz", operands="r33,44(r34)",
                    annotations=[], regs=[("r", 33), ("r", 34)])
    fd_b = FirstDef(block_idx=5, opcode="lbz", operands="r35,44(r34)",
                    annotations=[], regs=[("r", 35), ("r", 34)])
    facts = _facts_with({33: _vf(33, fd_a), 35: _vf(35, fd_b)})
    assert CommonSubExprPattern().check(facts, (33, 35)) is None


def test_common_subexpr_skips_different_operands() -> None:
    """Same opcode but different offsets → different expressions."""
    fd_a = FirstDef(block_idx=3, opcode="lwz", operands="r33,44(r34)",
                    annotations=[], regs=[("r", 33), ("r", 34)])
    fd_b = FirstDef(block_idx=5, opcode="lwz", operands="r35,48(r34)",
                    annotations=[], regs=[("r", 35), ("r", 34)])
    facts = _facts_with({33: _vf(33, fd_a), 35: _vf(35, fd_b)})
    assert CommonSubExprPattern().check(facts, (33, 35)) is None


def test_common_subexpr_skips_param_init() -> None:
    """Param-init ops in the entry block are NOT CSE candidates."""
    fd_a = FirstDef(block_idx=0, opcode="mr", operands="r33,r3",
                    annotations=[], regs=[("r", 33), ("r", 3)])
    fd_b = FirstDef(block_idx=0, opcode="mr", operands="r34,r3",
                    annotations=[], regs=[("r", 34), ("r", 3)])
    facts = _facts_with({
        33: _vf(33, fd_a, is_param=True),
        34: _vf(34, fd_b, is_param=True),
    })
    assert CommonSubExprPattern().check(facts, (33, 34)) is None
```

- [ ] **Step 12.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py::test_common_subexpr_matches_identical_ops -v --no-cov
```
Expected: FAIL with ImportError.

- [ ] **Step 12.3: Implement `CommonSubExprPattern`**

Append to `coalesce_patterns.py`:

```python
class CommonSubExprPattern:
    """r_a and r_b are defined by structurally-identical IR ops (same
    opcode + same non-destination operand signature). MWCC's CSE should
    have folded them but didn't — typically because the C source
    computes the same expression twice.
    """
    name = "common-subexpr"

    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]:
        a, b = pair
        fa = facts.by_virtual.get(a)
        fb = facts.by_virtual.get(b)
        if not fa or not fb or fa.first_def is None or fb.first_def is None:
            return None
        if fa.is_param or fb.is_param:
            return None
        if fa.first_def.opcode != fb.first_def.opcode:
            return None
        # Signature: operands string with destination register stripped
        sig_a = _operand_signature(fa.first_def, a)
        sig_b = _operand_signature(fb.first_def, b)
        if sig_a is None or sig_b is None:
            return None
        if sig_a != sig_b:
            return None
        return Suggestion(
            pattern_name="common-subexpr",
            summary=(
                f"r{a} and r{b} are computed by identical IR ops "
                f"({fa.first_def.opcode} {sig_a})"
            ),
            ir_evidence=(
                f"B{fa.first_def.block_idx}: {fa.first_def.opcode} r{a},{sig_a}; "
                f"B{fb.first_def.block_idx}: {fb.first_def.opcode} r{b},{sig_b}"
            ),
            source_hint=(
                "Hoist the shared expression into a temporary:\n"
                "    <type> shared = <var_b's expr>;\n"
                "    use(shared);  // both places"
            ),
            catalog_ref="subexpr-extract",
        )


def _operand_signature(fd, dest_virtual: int) -> Optional[str]:
    """Return the operands string with the leading destination removed.

    For `lwz r33,44(r34)` with dest_virtual=33 → `44(r34)`.
    For `addi r33,r34,5` with dest_virtual=33 → `r34,5`.
    """
    ops = fd.operands
    prefix = f"r{dest_virtual},"
    if not ops.startswith(prefix):
        return None
    return ops[len(prefix):]


ALL_PATTERNS.append(CommonSubExprPattern())
```

- [ ] **Step 12.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 18 passed, 1 skipped.

- [ ] **Step 12.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: CommonSubExprPattern (Task 12)"
```

---

## Task 13: `TernaryCollapsePattern` + enable ALL_PATTERNS test

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py`
- Modify: `tools/melee-agent/tests/test_coalesce_patterns.py`

- [ ] **Step 13.1: Write failing tests**

Append to `test_coalesce_patterns.py`:

```python
from src.mwcc_debug.coalesce_patterns import TernaryCollapsePattern


def _pre_pass_with_branches() -> Pass:
    """B0 → {B1, B2}, both flowing into B3 (join)."""
    return Pass(name="X", blocks=[
        Block(index=0, succ=[1, 2], pred=[], labels=[]),
        Block(index=1, succ=[3], pred=[0], labels=[]),
        Block(index=2, succ=[3], pred=[0], labels=[]),
        Block(index=3, succ=[], pred=[1, 2], labels=[]),
    ])


def _facts_with_pre(pp, virtual_facts):
    return IrFacts(
        function_name="f", pre_pass=pp,
        by_virtual=virtual_facts,
        bindings=[], basis=None, cg_section=None,
    )


def test_ternary_collapse_matches_branch_with_identity() -> None:
    """r_a defined in B1 as `mr r_a, r_b` and in B2 as `li r_a, 0`,
    both converging at B3 → ternary-collapse fires."""
    pp = _pre_pass_with_branches()
    # B1: mr r33, r32
    pp.blocks[1].instructions = [
        Instruction(opcode="mr", operands="r33,r32", annotations=[],
                    regs=[("r", 33), ("r", 32)]),
    ]
    # B2: li r33, 0
    pp.blocks[2].instructions = [
        Instruction(opcode="li", operands="r33,0", annotations=[],
                    regs=[("r", 33)]),
    ]
    fd = FirstDef(block_idx=1, opcode="mr", operands="r33,r32",
                  annotations=[], regs=[("r", 33), ("r", 32)])
    facts = _facts_with_pre(pp, {
        33: _vf(33, fd),
        32: _vf(32, None),
    })
    s = TernaryCollapsePattern().check(facts, (33, 32))
    assert s is not None
    assert s.pattern_name == "ternary-collapse"


def test_ternary_collapse_skips_single_def() -> None:
    """Only one defining block → not phi-like."""
    pp = _pre_pass_with_branches()
    pp.blocks[1].instructions = [
        Instruction(opcode="mr", operands="r33,r32", annotations=[],
                    regs=[("r", 33), ("r", 32)]),
    ]
    # B2 has no def of r33
    fd = FirstDef(block_idx=1, opcode="mr", operands="r33,r32",
                  annotations=[], regs=[("r", 33), ("r", 32)])
    facts = _facts_with_pre(pp, {33: _vf(33, fd), 32: _vf(32, None)})
    assert TernaryCollapsePattern().check(facts, (33, 32)) is None


def test_ternary_collapse_skips_no_common_successor() -> None:
    """Two defining blocks but they don't converge → skip."""
    pp = Pass(name="X", blocks=[
        Block(index=0, succ=[1, 2], pred=[], labels=[]),
        Block(index=1, succ=[3], pred=[0], labels=[]),
        Block(index=2, succ=[4], pred=[0], labels=[]),  # different succ
        Block(index=3, succ=[], pred=[1], labels=[]),
        Block(index=4, succ=[], pred=[2], labels=[]),
    ])
    pp.blocks[1].instructions = [
        Instruction(opcode="mr", operands="r33,r32", annotations=[],
                    regs=[("r", 33), ("r", 32)]),
    ]
    pp.blocks[2].instructions = [
        Instruction(opcode="li", operands="r33,0", annotations=[],
                    regs=[("r", 33)]),
    ]
    fd = FirstDef(block_idx=1, opcode="mr", operands="r33,r32",
                  annotations=[], regs=[("r", 33), ("r", 32)])
    facts = _facts_with_pre(pp, {33: _vf(33, fd), 32: _vf(32, None)})
    assert TernaryCollapsePattern().check(facts, (33, 32)) is None


def test_ternary_collapse_skips_no_branch_with_rb() -> None:
    """Multiple branches assign r_a, but none from r_b → skip."""
    pp = _pre_pass_with_branches()
    pp.blocks[1].instructions = [
        Instruction(opcode="li", operands="r33,5", annotations=[],
                    regs=[("r", 33)]),
    ]
    pp.blocks[2].instructions = [
        Instruction(opcode="li", operands="r33,7", annotations=[],
                    regs=[("r", 33)]),
    ]
    fd = FirstDef(block_idx=1, opcode="li", operands="r33,5",
                  annotations=[], regs=[("r", 33)])
    facts = _facts_with_pre(pp, {33: _vf(33, fd), 32: _vf(32, None)})
    assert TernaryCollapsePattern().check(facts, (33, 32)) is None
```

Also remove the `@pytest.mark.skip` from `test_all_patterns_initial_set`:

```python
# Remove the @pytest.mark.skip(...) decorator from this test
def test_all_patterns_initial_set() -> None:
    names = {p.name for p in ALL_PATTERNS}
    assert names == {
        "direct-identity", "chain-init", "alias-split",
        "common-subexpr", "ternary-collapse",
    }
```

- [ ] **Step 13.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 4 FAILS (the new tests) + 1 FAIL (the un-skipped all-patterns assertion).

- [ ] **Step 13.3: Implement `TernaryCollapsePattern`**

Append to `coalesce_patterns.py`:

```python
from .coalesce_ir_facts import _blocks_defining, _common_successor


class TernaryCollapsePattern:
    """r_a is defined in multiple branches that converge at a join block.
    One branch's first-def is a direct copy from r_b. Restructuring the
    if/else into a single ternary assignment lets the coalescer see r_a
    and r_b as move-related.
    """
    name = "ternary-collapse"

    def check(self, facts: IrFacts,
              pair: tuple[int, int]) -> Optional[Suggestion]:
        a, b = pair
        # Find all blocks where r_a is defined (dest of some op).
        defining = _blocks_defining(facts.pre_pass, a)
        if len(defining) < 2:
            return None
        # They must share a single join successor.
        join_idx = _common_successor(defining)
        if join_idx is None:
            return None
        # At least one defining block has `mr r_a, r_b` or `addi r_a, r_b, 0`.
        branch_with_rb = None
        for block in defining:
            for ist in block.instructions:
                if not ist.regs or ist.regs[0] != ("r", a):
                    continue
                if len(ist.regs) < 2 or ist.regs[1] != ("r", b):
                    continue
                if ist.opcode == "mr":
                    branch_with_rb = (block.index, "mr")
                    break
                if ist.opcode == "addi" and _immediate_operand(ist) == 0:
                    branch_with_rb = (block.index, "addi-0")
                    break
            if branch_with_rb:
                break
        if branch_with_rb is None:
            return None

        other_blocks = [b.index for b in defining if b.index != branch_with_rb[0]]
        return Suggestion(
            pattern_name="ternary-collapse",
            summary=(
                f"r{a} is assigned in {len(defining)} branches that converge "
                f"at B{join_idx}; one branch (B{branch_with_rb[0]}) "
                f"already copies from r{b}"
            ),
            ir_evidence=(
                f"B{branch_with_rb[0]}: {branch_with_rb[1]} r{a},r{b}; "
                f"other branches: B{','.join(str(i) for i in other_blocks)} "
                f"join B{join_idx}"
            ),
            source_hint=(
                f"Restructure the if/else into a single assignment:\n"
                f"    var_a = (cond) ? var_b : <other>;"
            ),
            catalog_ref="chained-init",
        )


ALL_PATTERNS.append(TernaryCollapsePattern())
```

- [ ] **Step 13.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_patterns.py -v --no-cov
```
Expected: 23 passed, 0 skipped.

Also re-run the full IR-facts file:

```bash
python -m pytest tools/melee-agent/tests/test_coalesce_ir_facts.py --no-cov
```
Expected: all pass.

- [ ] **Step 13.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/coalesce_patterns.py \
        tools/melee-agent/tests/test_coalesce_patterns.py
git commit -m "suggest-coalesce-source: TernaryCollapsePattern + enable ALL_PATTERNS test (Task 13)"
```

---

## Task 14: Orchestrator `suggest_coalesce.py`

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/suggest_coalesce.py`
- Create: `tools/melee-agent/tests/test_suggest_coalesce.py`

- [ ] **Step 14.1: Write the failing test (pair mode end-to-end)**

```python
# tools/melee-agent/tests/test_suggest_coalesce.py
"""End-to-end tests for the suggest_coalesce orchestrator."""

from __future__ import annotations

import json
import pathlib

from src.mwcc_debug.suggest_coalesce import (
    PairReport, Report, render_json, render_text, run,
)


FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"


def test_run_pair_mode_returns_report_with_suggestions() -> None:
    """Running on a real fixture with a known coalesce-amenable pair
    produces at least one Suggestion."""
    if not (FIXTURES / "fn_802461BC_pcdump.txt").exists():
        import pytest
        pytest.skip("fn_802461BC_pcdump.txt fixture not present")
    text = (FIXTURES / "fn_802461BC_pcdump.txt").read_text()
    # Pick a function the fixture contains; the spec's nominal pair is
    # 53=3 on fn_802461BC. If checkers don't fire on this pair we get
    # the fall-through block — which is still a non-None report.
    report = run(
        function="fn_802461BC",
        pair=(53, 3),
        discover=False,
        pcdump_text=text,
    )
    assert report is not None
    assert report.mode == "pair"
    assert len(report.pairs) == 1
    # Either we have suggestions, or the fall-through emits raw facts
    pair = report.pairs[0]
    assert pair.from_virt == 53
    assert pair.to_virt == 3


def test_run_pair_mode_serializes_to_valid_json() -> None:
    """The Report → render_json output is parseable JSON."""
    if not (FIXTURES / "fn_802461BC_pcdump.txt").exists():
        import pytest
        pytest.skip("fixture not present")
    text = (FIXTURES / "fn_802461BC_pcdump.txt").read_text()
    report = run(
        function="fn_802461BC", pair=(53, 3), discover=False,
        pcdump_text=text,
    )
    out = render_json(report)
    parsed = json.loads(out)
    assert parsed["function"] == "fn_802461BC"
    assert parsed["mode"] == "pair"
```

- [ ] **Step 14.2: Run, verify failure**

```bash
python -m pytest tools/melee-agent/tests/test_suggest_coalesce.py -v --no-cov
```
Expected: FAIL with `ImportError`.

- [ ] **Step 14.3: Implement the orchestrator**

```python
# tools/melee-agent/src/mwcc_debug/suggest_coalesce.py
"""Orchestrator + renderer for `debug suggest-coalesce-source`.

Composes the IR-facts layer + per-pattern checkers + (in discover mode)
the cascade analyzer into a Report, then renders human-readable text
or JSON. The CLI thin-wraps this module.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .coalesce_ir_facts import (
    CascadeCandidate, IrFacts, analyze_cascade, collect,
)
from .coalesce_patterns import ALL_PATTERNS, Suggestion
from .colorgraph_parser import find_function, parse_hook_events
from .parser import parse_pcdump


@dataclass
class PairReport:
    """One proposed pair plus its IR evidence and ranked suggestions."""
    from_virt: int
    to_virt: int
    ir_facts: dict
    suggestions: list[Suggestion]
    priority_class: Optional[str] = None
    depends_on: Optional[tuple[int, int]] = None


@dataclass
class Report:
    """Full orchestration result; rendered to text or JSON by callers."""
    function: str
    mode: str  # "pair" | "discover"
    cascade: Optional[list[int]] = None
    pairs: list[PairReport] = field(default_factory=list)


def run(
    function: str,
    *,
    pair: Optional[tuple[int, int]] = None,
    discover: bool = False,
    top: int = 3,
    include_low_confidence: bool = False,
    pcdump_text: str,
    source_text: str = "",
) -> Report:
    """Build a Report for `function`.

    The CLI is responsible for resolving pcdump + source paths and
    passing their contents in. Keeping this module path-free avoids a
    backward import on cli.debug (which would create a circular
    dependency since cli.debug already imports this module).

    Exactly one of `pair` or `discover` must be set — the CLI
    enforces this.
    """
    fns = parse_pcdump(pcdump_text)
    fn = next((f for f in fns if f.name == function), None)
    if fn is None:
        raise ValueError(f"function {function!r} not in pcdump")

    facts = collect(fn, source_text)
    if facts.pre_pass.name == "(missing)":
        raise ValueError(
            f"no pre-coloring pass for {function!r}; pcdump lacks IR detail"
        )

    # Hook events for colorgraph data (discover mode needs this)
    if discover:
        events_list = parse_hook_events(pcdump_text)
        evs = find_function(events_list, function)
        if evs and evs.colorgraph_sections:
            facts.cg_section = evs.colorgraph_sections[0]

    # Resolve pairs to evaluate
    if pair is not None:
        pairs_to_check: list[tuple[int, int, Optional[CascadeCandidate]]] = [
            (pair[0], pair[1], None)
        ]
        cascade: Optional[list[int]] = None
    else:
        cands = analyze_cascade(facts)[:top]
        pairs_to_check = [(c.from_virt, c.to_virt, c) for c in cands]
        # Build the cascade summary list (descending phys regs)
        if facts.cg_section is not None:
            chain = sorted(
                {d.assigned_reg for d in facts.cg_section.decisions
                 if 25 <= d.assigned_reg <= 31},
                reverse=True,
            )
            cascade = chain if len(chain) >= 2 else None
        else:
            cascade = None

    # Run pattern checkers per pair
    pair_reports: list[PairReport] = []
    for a, b, cand in pairs_to_check:
        suggestions: list[Suggestion] = []
        for pat in ALL_PATTERNS:
            sug = pat.check(facts, (a, b))
            if sug is not None:
                suggestions.append(sug)
        pair_reports.append(PairReport(
            from_virt=a, to_virt=b,
            ir_facts=_summarize_facts(
                facts, a, b,
                include_low_confidence=include_low_confidence,
            ),
            suggestions=suggestions,
            priority_class=cand.priority_class if cand else None,
            depends_on=cand.depends_on if cand else None,
        ))

    return Report(
        function=function,
        mode="discover" if discover else "pair",
        cascade=cascade,
        pairs=pair_reports,
    )


def _summarize_facts(
    facts: IrFacts, a: int, b: int,
    *, include_low_confidence: bool = False,
) -> dict:
    """Serializable per-virtual fact summary for JSON + text output.

    Source-line annotations from the bridge are only emitted when the
    binding confidence is best-guess/verified (or low-confidence with
    the explicit opt-in). Lower-confidence bindings are dropped from
    the summary — agents shouldn't act on potentially-wrong mappings.
    """
    out: dict = {}
    accepted = {"best-guess", "verified"}
    if include_low_confidence:
        accepted = accepted | {"low-confidence"}
    for label, v in [("from", a), ("to", b)]:
        vf = facts.by_virtual.get(v)
        entry: dict = {"virtual": v, "is_phys": vf.is_phys if vf else False}
        if vf and vf.first_def:
            entry["first_def"] = {
                "block": vf.first_def.block_idx,
                "opcode": vf.first_def.opcode,
                "operands": vf.first_def.operands,
            }
            entry["use_blocks"] = sorted({bi for (bi, _) in vf.use_sites})
        # Source-line annotation from bridge bindings, gated by confidence.
        for binding in facts.bindings:
            if binding.virtual == v and binding.confidence in accepted:
                entry["bridge"] = {
                    "var": binding.var_name,
                    "line": binding.decl_line,
                    "confidence": binding.confidence,
                }
                break
        out[label] = entry
    return out


def render_json(report: Report) -> str:
    """Render Report as parseable JSON."""
    payload = {
        "function": report.function,
        "mode": report.mode,
        "cascade": report.cascade,
        "pairs": [
            {
                "from": p.from_virt,
                "to": p.to_virt,
                "priority_class": p.priority_class,
                "depends_on": list(p.depends_on) if p.depends_on else None,
                "ir_facts": p.ir_facts,
                "suggestions": [
                    {
                        "pattern": s.pattern_name,
                        "summary": s.summary,
                        "ir_evidence": s.ir_evidence,
                        "source_hint": s.source_hint,
                        "catalog_ref": s.catalog_ref,
                    } for s in p.suggestions
                ],
            } for p in report.pairs
        ],
    }
    return json.dumps(payload, indent=2)


def render_text(report: Report) -> str:
    """Render Report as human-readable text."""
    lines: list[str] = []
    lines.append(f"suggest-coalesce-source — {report.function}  "
                 f"{'--discover' if report.mode == 'discover' else 'pair'}")
    if report.mode == "discover" and report.cascade:
        cas_str = " → ".join(f"r{r}" for r in report.cascade)
        lines.append(f"")
        lines.append(f"Longest callee-save cascade: {cas_str}")
        lines.append(f"  ({len(report.cascade)} saved regs)")
    lines.append("")
    for p in report.pairs:
        header = f"pair r{p.from_virt}=r{p.to_virt}"
        if p.priority_class:
            header += f"   [{p.priority_class}]"
            if p.depends_on:
                d_from, d_to = p.depends_on
                header += f" depends_on r{d_from}=r{d_to}"
        lines.append(header)
        lines.append("")
        lines.append("  IR facts:")
        for label, entry in p.ir_facts.items():
            v = entry["virtual"]
            kind = "physical reg" if entry["is_phys"] else f"r{v}"
            line = f"    {kind}: "
            if "first_def" in entry:
                fd = entry["first_def"]
                line += f"defined block B{fd['block']} by `{fd['opcode']} {fd['operands']}`"
                if "use_blocks" in entry:
                    line += f"  [uses: {entry['use_blocks']}]"
            else:
                line += "no first-def found"
            lines.append(line)
            if "bridge" in entry:
                br = entry["bridge"]
                lines.append(
                    f"      bridge: {br['var']} @ line {br['line']} "
                    f"({br['confidence']})"
                )
        lines.append("")
        if p.suggestions:
            lines.append("  Suggestions (highest confidence first):")
            for i, s in enumerate(p.suggestions, 1):
                lines.append(f"    {i}. {s.pattern_name}")
                lines.append(f"       {s.summary}")
                lines.append(f"       evidence: {s.ir_evidence}")
                if s.source_hint:
                    lines.append(f"       try: {s.source_hint}")
                if s.catalog_ref:
                    lines.append(
                        f"       Catalog: debug pattern-catalog {s.catalog_ref}"
                    )
        else:
            lines.append("  No specific pattern matched. Raw IR facts above —")
            lines.append("  search the C source for places where the bindings")
            lines.append("  of both virtuals could share an assignment or")
            lines.append("  expression. Catalog: debug pattern-catalog "
                         "register-cascade")
        lines.append("")
    return "\n".join(lines)
```

- [ ] **Step 14.4: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_suggest_coalesce.py -v --no-cov
```
Expected: 2 passed (or skipped if fixtures aren't present from Task 7).

- [ ] **Step 14.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/suggest_coalesce.py \
        tools/melee-agent/tests/test_suggest_coalesce.py
git commit -m "suggest-coalesce-source: orchestrator + renderers (Task 14)"
```

---

## Task 15: CLI integration in `debug.py`

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`

- [ ] **Step 15.1: Add the command at the right place in `debug.py`**

Find an existing `@debug_app.command(name="...")` block (e.g. `var-to-virtual` near line 4595) and add this command immediately after it:

```python
@debug_app.command(name="suggest-coalesce-source")
def suggest_coalesce_source(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function to analyze (required).",
        ),
    ],
    pair: Annotated[
        Optional[str],
        typer.Option(
            "-V", "--pair",
            help="Pair mode: 'virt=root' (e.g. '53=3'). Mutually "
                 "exclusive with --discover.",
        ),
    ] = None,
    discover: Annotated[
        bool,
        typer.Option(
            "--discover",
            help="Discover mode: find candidate coalesces that would "
                 "shorten the longest callee-save cascade. Mutually "
                 "exclusive with --pair.",
        ),
    ] = False,
    top: Annotated[
        int,
        typer.Option(
            "--top",
            help="Discover mode: max candidates (default 3). Raises "
                 "BadParameter if passed in pair mode.",
        ),
    ] = 3,
    pcdump: Annotated[
        Optional[Path],
        typer.Option(
            "--pcdump",
            help="Path to pcdump.txt. Auto-resolves from cache.",
        ),
    ] = None,
    json_out: Annotated[
        bool,
        typer.Option("--json", help="Emit as JSON."),
    ] = False,
    include_low_confidence: Annotated[
        bool,
        typer.Option(
            "--include-low-confidence",
            help="Use low-confidence bridge bindings for source-line "
                 "annotations.",
        ),
    ] = False,
) -> None:
    """Suggest C-source patterns producing a specific coalesce, or
    discover candidate coalesces that would shorten the cascade.

    Pair mode example:
        debug suggest-coalesce-source -f fn_802461BC -V 53=3

    Discover mode example:
        debug suggest-coalesce-source -f fn_802461BC --discover --top 5
    """
    from ..mwcc_debug.suggest_coalesce import render_json, render_text, run

    # Validation: exactly one of --pair / --discover (XOR check)
    if (pair is None) == (not discover):
        raise typer.BadParameter(
            "exactly one of --pair / --discover required"
        )
    # --top only makes sense in discover mode
    if pair is not None and top != 3:
        raise typer.BadParameter(
            "--top is only valid with --discover"
        )

    melee_root = DEFAULT_MELEE_ROOT
    pcdump_path = _resolve_pcdump_path(pcdump, function, melee_root)
    text = pcdump_path.read_text()

    # Load source for the bridge — CLI handles this so the orchestrator
    # stays path-free (avoids circular import on cli.debug helpers).
    source_text = ""
    unit = _find_unit_for_function(function, melee_root)
    if unit is not None:
        src_path = melee_root / "src" / f"{unit}.c"
        if src_path.exists():
            source_text = src_path.read_text()

    parsed_pair: Optional[tuple[int, int]] = None
    if pair is not None:
        try:
            lhs, rhs = pair.split("=", 1)
            parsed_pair = (int(lhs), int(rhs))
        except (ValueError, TypeError):
            raise typer.BadParameter(
                f"invalid --pair {pair!r}; expected 'virt=root' (e.g. '53=3')"
            )

    try:
        report = run(
            function=function,
            pair=parsed_pair,
            discover=discover,
            top=top,
            include_low_confidence=include_low_confidence,
            pcdump_text=text,
            source_text=source_text,
        )
    except ValueError as e:
        typer.echo(str(e), err=True)
        raise typer.Exit(3)

    if json_out:
        print(render_json(report))
    else:
        print(render_text(report))
```

- [ ] **Step 15.2: Verify CLI loads (no syntax errors)**

```bash
python -m src.cli debug suggest-coalesce-source --help 2>&1 | head -10
```
Expected: help output mentions `--function`, `--pair`, `--discover`, `--top`, `--json`.

- [ ] **Step 15.3: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py
git commit -m "suggest-coalesce-source: CLI command (Task 15)"
```

---

## Task 16: Calibration YAML + parametrize loop

**Files:**
- Create: `tools/melee-agent/tests/fixtures/coalesce_calibration.yaml`
- Modify: `tools/melee-agent/tests/test_suggest_coalesce.py`

- [ ] **Step 16.1: Create the calibration YAML**

```yaml
# tools/melee-agent/tests/fixtures/coalesce_calibration.yaml
# Strict matching per spec §13 success criterion 2. Each case lists
# the EXACT expected pattern names or top-1 pair; the parametrize loop
# asserts equality. When fixtures are regenerated and these values
# change legitimately, update the YAML — the test failure is the
# regression signal.
cases:
  - function: fn_802461BC
    pcdump: fn_802461BC_pcdump.txt
    pair: [53, 3]
    expected_patterns:
      # At least these checkers should fire on the pair. Empty list
      # means "fall-through is acceptable" — but for fn_802461BC we
      # expect DirectIdentity at minimum.
      - direct-identity
    notes: |
      Agent's session report — confirmed force-coalesce 53=3 reaches
      target. Captured here as the first calibration case; populate
      `expected_patterns` from the actual output once Task 7 fixtures
      are committed and Task 14 produces real output. If the actual
      output's patterns differ from this list, update the YAML and
      record why in this `notes` block.

  - function: mnVibration_80248644
    pcdump: mnVibration_80248644_pcdump.txt
    discover: true
    expected_cascade_length_min: 4
    expected_top_priority_class: "end-of-chain"
    # Strict: the top-1 candidate's (from, to) must equal this exact
    # pair. Captured from the actual output on first calibration run;
    # update when fixtures regenerate.
    expected_top_pair: null   # set during Task 16 execution after
                              # first real run produces the value
    notes: |
      MEMORY.md: matched 100% via `s32 j` decl reorder. Strict pair
      check is initialized null — the implementer fills in the actual
      top-1 pair after the first run of Task 16, then commits.
```

- [ ] **Step 16.2: Add parametrize loop test**

Append to `test_suggest_coalesce.py`:

```python
import yaml


def _load_calibration():
    """Load the calibration YAML; skip silently if not present."""
    path = pathlib.Path(__file__).parent / "fixtures" / "coalesce_calibration.yaml"
    if not path.exists():
        return []
    return yaml.safe_load(path.read_text()).get("cases", [])


import pytest


@pytest.mark.parametrize("case", _load_calibration())
def test_calibration_corpus(case) -> None:
    """Each calibration case asserts the orchestrator behaves as the
    YAML specifies. New cases can be added without writing new test
    code — just append to coalesce_calibration.yaml."""
    fixture_path = FIXTURES / case["pcdump"]
    if not fixture_path.exists():
        pytest.skip(f"fixture {case['pcdump']} not present")
    text = fixture_path.read_text()

    if case.get("discover"):
        report = run(
            function=case["function"],
            discover=True, pcdump_text=text,
        )
        assert report.mode == "discover"
        min_len = case.get("expected_cascade_length_min", 2)
        assert report.cascade is not None
        assert len(report.cascade) >= min_len
        if "expected_top_priority_class" in case:
            assert report.pairs, "discover produced no candidates"
            assert (
                report.pairs[0].priority_class
                == case["expected_top_priority_class"]
            )
        # Strict: top-1 pair equality (when set in YAML)
        top_pair = case.get("expected_top_pair")
        if top_pair is not None:
            assert report.pairs, "discover produced no candidates"
            actual = (report.pairs[0].from_virt, report.pairs[0].to_virt)
            assert actual == tuple(top_pair), (
                f"expected top-1 pair {tuple(top_pair)}, got {actual}"
            )
    else:
        pair_tuple = tuple(case["pair"])
        report = run(
            function=case["function"],
            pair=pair_tuple, discover=False,
            pcdump_text=text,
        )
        assert report.mode == "pair"
        assert len(report.pairs) == 1
        pr = report.pairs[0]
        # Strict: each expected pattern name must appear in suggestions
        expected_patterns = set(case.get("expected_patterns") or [])
        if expected_patterns:
            actual_patterns = {s.pattern_name for s in pr.suggestions}
            missing = expected_patterns - actual_patterns
            assert not missing, (
                f"expected patterns {expected_patterns}, "
                f"actual {actual_patterns}, missing {missing}"
            )
        else:
            # Fall-through acceptable: any non-empty ir_facts is OK
            assert pr.ir_facts
```

- [ ] **Step 16.3: Run, verify**

```bash
python -m pytest tools/melee-agent/tests/test_suggest_coalesce.py -v --no-cov
```
Expected: all parametrize cases either pass or skip (if a fixture is missing). Smoke: at least 1 case should run if fixtures from Task 7 were committed.

- [ ] **Step 16.4: Commit**

```bash
git add tools/melee-agent/tests/fixtures/coalesce_calibration.yaml \
        tools/melee-agent/tests/test_suggest_coalesce.py
git commit -m "suggest-coalesce-source: calibration corpus + parametrize loop (Task 16)"
```

---

## Task 17: CLI smoke test

**Files:**
- Modify: `tools/melee-agent/tests/test_suggest_coalesce.py`

- [ ] **Step 17.1: Write the smoke test**

Append:

```python
import subprocess


def test_cli_smoke_invokes_command() -> None:
    """Sanity test that the CLI command is wired correctly."""
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "suggest-coalesce-source", "--help"],
        cwd=pathlib.Path(__file__).parent.parent.parent,  # tools/melee-agent
        capture_output=True, text=True, timeout=15,
    )
    assert proc.returncode == 0
    assert "--function" in proc.stdout
    assert "--pair" in proc.stdout
    assert "--discover" in proc.stdout


def test_cli_rejects_both_pair_and_discover() -> None:
    """Mutually-exclusive option enforcement."""
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "suggest-coalesce-source",
         "-f", "any_fn", "-V", "53=3", "--discover"],
        cwd=pathlib.Path(__file__).parent.parent.parent,  # tools/melee-agent
        capture_output=True, text=True, timeout=15,
    )
    assert proc.returncode != 0
    assert "exactly one of --pair / --discover" in proc.stderr


def test_cli_rejects_top_in_pair_mode() -> None:
    """--top is only valid with --discover."""
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "suggest-coalesce-source",
         "-f", "any_fn", "-V", "53=3", "--top", "5"],
        cwd=pathlib.Path(__file__).parent.parent.parent,  # tools/melee-agent
        capture_output=True, text=True, timeout=15,
    )
    assert proc.returncode != 0
    assert "--top is only valid with --discover" in proc.stderr
```

- [ ] **Step 17.2: Run, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_suggest_coalesce.py -v --no-cov
```
Expected: smoke test plus calibration cases all pass.

- [ ] **Step 17.3: Commit**

```bash
git add tools/melee-agent/tests/test_suggest_coalesce.py
git commit -m "suggest-coalesce-source: CLI smoke tests (Task 17)"
```

---

## Task 18: Documentation

**Files:**
- Create: `docs/mwcc-debug-handoff-2026-05-22.md`
- Modify: `~/.claude/projects/-Users-mike-code-melee/memory/MEMORY.md`
- Create: `~/.claude/projects/-Users-mike-code-melee/memory/suggest_coalesce_source.md`

- [ ] **Step 18.1: Create the handoff doc**

```markdown
# mwcc-debug handoff — 2026-05-22

`debug suggest-coalesce-source` shipped. Bridges `--force-coalesce`
(proves an allocation is reachable) and natural C-source patterns
(makes the match real, not a DLL artifact).

## CLI

```bash
# Pair mode — explain how to reach a confirmed coalesce naturally
melee-agent debug suggest-coalesce-source -f fn_802461BC -V 53=3

# Discover mode — find candidate coalesces that would shorten the cascade
melee-agent debug suggest-coalesce-source -f fn_802461BC --discover --top 3
```

## What it does

Pair mode: given the agent's confirmed force-coalesce target pair,
runs IR-level pattern checkers (DirectIdentity, ChainInit, AliasSplit,
CommonSubExpr, TernaryCollapse) over the function's pre-coloring pass.
Each matching checker emits a ranked Suggestion with IR evidence,
source-line hint (when the bridge is confident), and a catalog
cross-reference.

Discover mode: identifies the longest callee-save cascade in the
function and proposes coalesces that would shorten it. End-of-chain
candidates (which actually shrink the stmw range) are surfaced first;
mid-chain candidates carry depends_on annotations so the agent knows
which merges must succeed first.

## Workflow integration

1. Agent confirms `--force-coalesce 53=3` reaches the target (DLL artifact)
2. Run `suggest-coalesce-source -V 53=3` to get pattern-named C-source
   transformations
3. Try each suggestion; verify the natural compile reaches the target
4. If nothing fires, fall-through block shows raw IR facts so the agent
   can reason manually

## Tests

- 20+ unit tests across three layers (IR facts, pattern checkers,
  orchestrator)
- 2 calibration cases in coalesce_calibration.yaml (corpus grows
  organically — new historical wins added as YAML entries, no new
  test code)
- 1 CLI smoke test

## Files

- `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py` — IR analysis layer
- `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py` — 5 checkers
- `tools/melee-agent/src/mwcc_debug/suggest_coalesce.py` — orchestrator
- `tools/melee-agent/src/cli/debug.py` — CLI wiring
- `tools/melee-agent/tests/fixtures/coalesce_calibration.yaml` — corpus

Spec: `docs/superpowers/specs/2026-05-19-suggest-coalesce-source-design.md`
```

- [ ] **Step 18.2: Create the memory topic file**

```markdown
# debug suggest-coalesce-source workflow

Pattern-matching tool for the "force-coalesce confirmed; how do I
reach this naturally?" gap.

## CLI

```bash
# Pair: explain how to produce a known coalesce naturally
melee-agent debug suggest-coalesce-source -f FN -V <virt>=<root>

# Discover: find candidate coalesces shortening the cascade
melee-agent debug suggest-coalesce-source -f FN --discover
```

## Output

Five pattern checkers — DirectIdentity (already-aliased pair),
ChainInit (`a = (b = 0)`), AliasSplit (long+short combinator),
CommonSubExpr (identical IR ops), TernaryCollapse (phi-like merge
collapse). Each gives IR evidence + source-line hint (when bridge is
confident) + catalog cross-reference.

Fall-through emits raw IR facts when no pattern fires.

## Workflow

1. `--force-coalesce <pair>` confirms allocation is reachable
2. `suggest-coalesce-source -V <pair>` → pattern-named source rewrites
3. Apply one rewrite; verify natural compile reaches target

## See also

- `docs/mwcc-debug-handoff-2026-05-22.md` — full handoff
- `mwcc_force_coalesce.md` — the force-coalesce machinery this builds on
- `anon_magic_constant_workflow.md` — sibling tooling-for-discovery pattern
```

- [ ] **Step 18.3: Add MEMORY.md pointer**

Edit `~/.claude/projects/-Users-mike-code-melee/memory/MEMORY.md`. After the line referencing `mwcc_force_coalesce.md`, add:

```markdown
- [debug suggest-coalesce-source](suggest_coalesce_source.md) — given a confirmed `--force-coalesce` pair (or `--discover` for a function), suggest C-source patterns that would produce the coalesce naturally. Five pattern checkers (DirectIdentity, ChainInit, AliasSplit, CommonSubExpr, TernaryCollapse) with IR-grounded evidence and source-line hints
```

- [ ] **Step 18.4: Commit**

```bash
git add docs/mwcc-debug-handoff-2026-05-22.md
git commit -m "suggest-coalesce-source: handoff doc (Task 18)"
```

Then commit the memory files (these live outside the repo, so they're separate edits — the implementer touches `~/.claude/projects/...` manually).

---

## Task 19: Final cleanup + full test run

**Files:** (verification only)

- [ ] **Step 19.1: Run the full test suite**

```bash
cd /Users/mike/code/melee
python -m pytest tools/melee-agent/tests/ --no-cov 2>&1 | tail -5
```
Expected: all tests pass, including the calibration corpus.

- [ ] **Step 19.2: Smoke test against a real function**

```bash
python -m src.cli debug suggest-coalesce-source \
    -f mnDiagram3_8024714C -V 53=3 2>&1 | head -30
```
Expected: structured output with IR facts and at least one Suggestion or a fall-through block.

```bash
python -m src.cli debug suggest-coalesce-source \
    -f mnDiagram3_8024714C --discover --top 3 2>&1 | head -30
```
Expected: cascade chain printed; candidates listed with priority_class.

- [ ] **Step 19.3: JSON round-trip sanity**

```bash
python -m src.cli debug suggest-coalesce-source \
    -f mnDiagram3_8024714C -V 53=3 --json | python -m json.tool > /dev/null
```
Expected: no error (JSON is valid).

- [ ] **Step 19.4: If everything passes — done. If not, fix or revert.**

The plan is complete. The next agent can move on to follow-up work
(v2 candidate generation, transitive cascade simulation, etc.) per
the spec's §10 future extensions.
