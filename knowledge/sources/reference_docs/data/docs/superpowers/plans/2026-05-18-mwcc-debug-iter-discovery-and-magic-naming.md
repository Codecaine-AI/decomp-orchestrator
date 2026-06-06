# mwcc-debug `match-iter-first` + `--name-magic` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two extensions to the mwcc-debug tooling: (1) a host-side command that recommends `--force-iter-first` arguments by reading the expected `.s` file, and (2) a DLL hook that overrides anonymous `@N` literal-pool symbol names with user-supplied names like `mnVibration_804DC018`.

**Architecture:** Tool 1 adds two pure-Python modules (`asm_parser.py`, `iter_match.py`) that read `build/GALE01/asm/<unit>.s`, find r28..r31's first def in expected, structurally align that instruction to the current pcdump's BEFORE COLORING pass, and report the virtual register's ig_idx. Tool 2 patches the existing `mwcc_debug.c` DLL with a hook on mwcc's literal-pool symbol naming, controlled by a `MWCC_DEBUG_NAME_MAGIC` env var. CLI exposes both through `melee-agent debug`.

**Tech Stack:** Python (typer, dataclasses), C (DLL hook via trampoline pattern), pytest. Existing mwcc-debug infrastructure provides parser/cache/CLI wrappers; we extend without rewriting.

**Spec:** `docs/superpowers/specs/2026-05-18-mwcc-debug-iter-discovery-and-magic-naming-design.md`

---

## File Structure

**New files:**
- `tools/melee-agent/src/mwcc_debug/asm_parser.py` — parse `build/GALE01/asm/<unit>.s`, extract function body, identify prologue boundary, find first def of physical registers.
- `tools/melee-agent/src/mwcc_debug/iter_match.py` — given expected def-positions (from `asm_parser`) and BEFORE COLORING pass (from `parser`), structurally align and report the virtual at each position.
- `tools/melee-agent/tests/test_mwcc_debug_asm_parser.py` — unit tests for asm parsing.
- `tools/melee-agent/tests/test_mwcc_debug_iter_match.py` — unit tests for alignment + integration.

**Modified files:**
- `tools/melee-agent/src/cli/debug.py` — add `match-iter-first` command (~150 lines added); add `--name-magic` flag to `pcdump` (~30 lines).
- `tools/mwcc_debug/mwcc_debug.c` — add env var parser + hook for literal-pool symbol naming (~80 lines).
- `tools/mwcc_debug/win/run_pcdump.ps1` — pass through `MWCC_DEBUG_NAME_MAGIC` env var (~5 lines).

**New docs:**
- `docs/mwcc-debug-handoff-2026-05-18.md` — handoff note for the matching agent describing both tools + usage.

---

## Task 1.1: Create `asm_parser.py` with prologue detection

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/asm_parser.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_asm_parser.py`

This module parses one function from a `build/GALE01/asm/*.s` file produced by dtk's disassembler. The `.s` format we're parsing:

```
.fn fn_80247510, global
/* 80247510 002440F0  7C 08 02 A6 */	mflr r0
/* 80247514 002440F4  90 01 00 04 */	stw r0, 0x4(r1)
/* 80247518 002440F8  94 21 FE E8 */	stwu r1, -0x118(r1)
/* 8024751C 002440FC  DB E1 01 10 */	stfd f31, 0x110(r1)
/* 80247524 00244104  BF 61 00 F4 */	stmw r27, 0xf4(r1)
/* 80247528 00244108  A0 6D B5 28 */	lhz r3, mn_804D6BC8@sda21(r0)
...
.endfn fn_80247510
```

**Prologue detection rule:** consume `mflr`, `stw r0, ...(r1)`, `stwu r1, ...`, `stfd f*, ...(r1)`, `stmw r*, ...(r1)`, and `stfd` instructions in any order at the start of the body. Stop at the first instruction that doesn't fit. Branches and labels (`.L_*`) inside the prologue should also be tolerated but in practice they don't appear before the prologue ends.

- [ ] **Step 1: Write the failing tests**

Create `tools/melee-agent/tests/test_mwcc_debug_asm_parser.py`:

```python
"""Tests for parsing build/GALE01/asm/*.s files."""

from __future__ import annotations

import textwrap

from src.mwcc_debug.asm_parser import (
    AsmInstruction,
    extract_function,
    find_first_def,
    parse_prologue_end,
)


SAMPLE_FN = textwrap.dedent("""\
    .include "macros.inc"
    .file "mnvibration.c"

    # 0x802474C4..0x802492CC | size: 0x1E08
    .text
    .balign 4

    # .text:0x4C | 0x80247510 | size: 0xB74
    .fn fn_80247510, global
    /* 80247510 002440F0  7C 08 02 A6 */\tmflr r0
    /* 80247514 002440F4  90 01 00 04 */\tstw r0, 0x4(r1)
    /* 80247518 002440F8  94 21 FE E8 */\tstwu r1, -0x118(r1)
    /* 8024751C 002440FC  DB E1 01 10 */\tstfd f31, 0x110(r1)
    /* 80247520 00244100  DB C1 01 08 */\tstfd f30, 0x108(r1)
    /* 80247524 00244104  BF 61 00 F4 */\tstmw r27, 0xf4(r1)
    /* 80247528 00244108  A0 6D B5 28 */\tlhz r3, mn_804D6BC8@sda21(r0)
    /* 8024752C 0024410C  80 8D B5 88 */\tlwz r4, mnVibration_804D6C28@sda21(r0)
    /* 80247530 00244110  28 03 00 00 */\tcmplwi r3, 0x0
    /* 80247534 00244114  83 C4 00 2C */\tlwz r30, 0x2c(r4)
    /* 80247538 00244118  41 82 00 20 */\tbeq .L_80247558
    /* 8024753C 0024411C  38 03 FF FF */\tsubi r0, r3, 0x1
    /* 80247540 00244120  3B C0 00 00 */\tli r30, 0x0
    /* 80247544 00244124  3B E0 00 00 */\tli r31, 0x0
    .endfn fn_80247510
""")


def test_extract_function_returns_body_instructions() -> None:
    fn = extract_function(SAMPLE_FN, "fn_80247510")
    assert fn is not None
    assert fn.name == "fn_80247510"
    # Body includes prologue lines (we don't drop them in extraction; that's
    # parse_prologue_end's job).
    assert len(fn.instructions) >= 13
    first = fn.instructions[0]
    assert first.opcode == "mflr"
    assert first.regs == [("r", 0)]


def test_extract_function_missing_returns_none() -> None:
    assert extract_function(SAMPLE_FN, "fn_nonexistent") is None


def test_parse_prologue_end_skips_save_block() -> None:
    fn = extract_function(SAMPLE_FN, "fn_80247510")
    assert fn is not None
    end = parse_prologue_end(fn.instructions)
    # Prologue covers mflr, stw r0, stwu, stfd, stfd, stmw -> 6 instructions
    assert end == 6
    assert fn.instructions[end].opcode == "lhz"


def test_find_first_def_r31_dest_register() -> None:
    fn = extract_function(SAMPLE_FN, "fn_80247510")
    assert fn is not None
    end = parse_prologue_end(fn.instructions)
    body = fn.instructions[end:]
    pos, ist = find_first_def(body, target_reg=31)
    # First post-prologue def of r31 is `li r31, 0x0` (the last instr in
    # the sample).
    assert ist.opcode == "li"
    assert ist.regs[0] == ("r", 31)


def test_find_first_def_r30_dest_register() -> None:
    fn = extract_function(SAMPLE_FN, "fn_80247510")
    assert fn is not None
    end = parse_prologue_end(fn.instructions)
    body = fn.instructions[end:]
    pos, ist = find_first_def(body, target_reg=30)
    # First post-prologue def of r30 is `lwz r30, 0x2c(r4)`.
    assert ist.opcode == "lwz"
    assert ist.regs[0] == ("r", 30)


def test_find_first_def_returns_none_when_unused() -> None:
    # r29 doesn't appear as a destination in the sample body.
    fn = extract_function(SAMPLE_FN, "fn_80247510")
    assert fn is not None
    end = parse_prologue_end(fn.instructions)
    body = fn.instructions[end:]
    result = find_first_def(body, target_reg=29)
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd tools/melee-agent
pytest tests/test_mwcc_debug_asm_parser.py -v
```

Expected: ImportError / ModuleNotFoundError on `src.mwcc_debug.asm_parser`.

- [ ] **Step 3: Implement `asm_parser.py`**

Create `tools/melee-agent/src/mwcc_debug/asm_parser.py`:

```python
"""Parse build/GALE01/asm/*.s files produced by dtk's disassembler.

Each `.s` file has many functions in a flat layout: `.fn <name>, <scope>`
opens a function, `.endfn <name>` closes it. Inside, instructions are
formatted as:

    /* <addr> <fileoff>  <bytes> */\\t<opcode> <operands>

We parse just enough to:
- Locate one function by name.
- Walk its body line by line.
- Identify the prologue boundary so callers can skip save/restore code.
- Find the first instruction that defines (writes to) a target physical
  register.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


# Matches "/* addr fileoff  bytes */\topcode operands" — the leading addr
# block is what disambiguates a real instruction line from a directive.
_INSTR_RE = re.compile(
    r"^\s*/\*\s*[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+(?:[0-9A-Fa-f]{2}\s*)+\*/\s*(.+)$"
)
# Register tokens: r0-r127 (we don't validate), f0-f127, cr0-cr7.
_REG_RE = re.compile(r"\b([rf])(\d+)\b")
_FN_START_RE = re.compile(r"^\s*\.fn\s+(\S+)\s*(?:,\s*\w+)?\s*$")
_FN_END_RE = re.compile(r"^\s*\.endfn\b")
# Prologue opcodes (the typical PowerPC entry sequence emitted by mwcc).
_PROLOGUE_OPCODES = {"mflr", "stw", "stwu", "stfd", "stmw", "stwux"}


@dataclass
class AsmInstruction:
    opcode: str
    operands: str
    # Register tokens in order of appearance in the operand string.
    regs: list[tuple[str, int]]


@dataclass
class AsmFunction:
    name: str
    instructions: list[AsmInstruction]


def _parse_instr_line(line: str) -> Optional[AsmInstruction]:
    m = _INSTR_RE.match(line)
    if not m:
        return None
    rest = m.group(1).strip()
    parts = rest.split(None, 1)
    if not parts:
        return None
    opcode = parts[0]
    operands = parts[1] if len(parts) > 1 else ""
    regs = [(t, int(n)) for t, n in _REG_RE.findall(operands)]
    return AsmInstruction(opcode=opcode, operands=operands, regs=regs)


def extract_function(asm_text: str, function_name: str) -> Optional[AsmFunction]:
    """Find `function_name` in the .s text and return its instruction list.

    Returns None if not found.
    """
    in_fn = False
    instructions: list[AsmInstruction] = []
    for line in asm_text.splitlines():
        if not in_fn:
            m = _FN_START_RE.match(line)
            if m and m.group(1) == function_name:
                in_fn = True
            continue
        if _FN_END_RE.match(line):
            return AsmFunction(name=function_name, instructions=instructions)
        ist = _parse_instr_line(line)
        if ist is not None:
            instructions.append(ist)
    if in_fn:
        # `.endfn` never appeared but we found the start — return what we
        # have. dtk always emits .endfn but we don't want to error here.
        return AsmFunction(name=function_name, instructions=instructions)
    return None


def _is_prologue_instr(ist: AsmInstruction) -> bool:
    """True if the instruction looks like part of the function entry sequence.

    We accept:
      - mflr (always)
      - stw r0, X(r1)         (saved LR)
      - stwu r1, ...           (frame alloc)
      - stfd fN, X(r1)         (saved FPR)
      - stmw rN, X(r1)         (saved GPR group)
      - stwux r1, ...          (variable-size frame alloc; rare)
    """
    if ist.opcode not in _PROLOGUE_OPCODES:
        return False
    if ist.opcode == "mflr":
        return True
    # All other prologue opcodes touch r1 as base address. The cheapest check
    # is that "r1" appears in the operand string.
    return "r1" in ist.operands or "(r1)" in ist.operands


def parse_prologue_end(instructions: list[AsmInstruction]) -> int:
    """Return the index of the first non-prologue instruction.

    Walks the instruction list from the front and stops at the first
    instruction that doesn't look like a prologue save. Returns the index;
    for an empty list or one that's all prologue, returns len(instructions).
    """
    for i, ist in enumerate(instructions):
        if not _is_prologue_instr(ist):
            return i
    return len(instructions)


def find_first_def(
    instructions: list[AsmInstruction],
    target_reg: int,
    reg_kind: str = "r",
) -> Optional[tuple[int, AsmInstruction]]:
    """Find the first instruction in `instructions` where `target_reg`
    appears as the destination operand (the first register slot).

    The destination is conventionally the first register token in the
    operand string for arithmetic/load opcodes (`addi rD, rA, simm`,
    `lwz rD, X(rA)`, `li rD, simm`, `mr rD, rA`). For stores (`stw rS,
    X(rA)`) the first reg is the SOURCE, not the destination — but those
    instructions don't *define* the target register, so we exclude store
    opcodes when checking for "def".

    Returns `(index, instruction)` or `None` if no def found.
    """
    for i, ist in enumerate(instructions):
        if not ist.regs:
            continue
        # Skip store opcodes — they don't define their first register.
        if ist.opcode.startswith("st") or ist.opcode.startswith("psq_st"):
            continue
        # Skip branches and compares (don't write a GPR-as-dest).
        if ist.opcode.startswith("b") or ist.opcode.startswith("cmp"):
            continue
        first_kind, first_num = ist.regs[0]
        if first_kind == reg_kind and first_num == target_reg:
            return (i, ist)
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

```
pytest tests/test_mwcc_debug_asm_parser.py -v
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```
git add tools/melee-agent/src/mwcc_debug/asm_parser.py \
        tools/melee-agent/tests/test_mwcc_debug_asm_parser.py
git commit -m "mwcc-debug: asm_parser for build/asm/*.s files"
```

---

## Task 1.2: Create `iter_match.py` with structural alignment

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/iter_match.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_iter_match.py`

This module takes (a) the AsmInstruction returned by `find_first_def` for some physical register, and (b) the BEFORE COLORING pass from the current pcdump, and finds the structurally-equivalent instruction in BEFORE COLORING. From that instruction, it reads the destination virtual register and looks up its ig_idx via the SimplifySection entries.

**Structural match key:** `(opcode, non_register_operand_signature)`. Non-register signature is the operand string with `r\d+` and `f\d+` tokens replaced by `R`/`F` placeholders. So `lwz r30, 0x2c(r4)` and `lwz r5, 0x2c(r4)` both have signature `R, 0x2c(R)`.

**Tolerance:** when multiple instructions in BEFORE COLORING share the signature, prefer the one closest to the expected position (after adjusting for the BEFORE COLORING pass's own prologue size). If no exact match, return None.

- [ ] **Step 1: Write the failing tests**

Create `tools/melee-agent/tests/test_mwcc_debug_iter_match.py`:

```python
"""Tests for matching expected r28..r31 defs to BEFORE COLORING virtuals."""

from __future__ import annotations

from src.mwcc_debug.asm_parser import AsmInstruction
from src.mwcc_debug.colorgraph_parser import (
    FunctionEvents,
    SimplifyEntry,
    SimplifySection,
)
from src.mwcc_debug.iter_match import (
    instr_signature,
    match_virtual_for_expected_def,
)
from src.mwcc_debug.parser import (
    Block,
    Function,
    Instruction,
    Pass,
)


def _make_ist(opcode: str, operands: str, regs: list[tuple[str, int]]) -> Instruction:
    return Instruction(opcode=opcode, operands=operands, annotations=[], regs=regs)


def test_instr_signature_replaces_registers() -> None:
    assert instr_signature("lwz", "r30, 0x2c(r4)") == ("lwz", "R, 0x2c(R)")
    assert instr_signature("li", "r31, 0x0") == ("li", "R, 0x0")
    assert instr_signature("addi", "r30, r4, 0x10") == ("addi", "R, R, 0x10")


def test_instr_signature_keeps_label_and_symbol_operands() -> None:
    sig = instr_signature("lwz", "r4, mnVibration_804D6C28@sda21(r0)")
    # Symbol names are NOT registers, so they stay literal.
    assert sig == ("lwz", "R, mnVibration_804D6C28@sda21(R)")


def test_match_virtual_for_expected_def_simple() -> None:
    """Expected has `lwz r30, 0x2c(r4)` at position 0 of body. Current
    BEFORE COLORING has `lwz r33, 0x2c(r36)` at position 0. The matched
    virtual should be 33.
    """
    expected_ist = AsmInstruction(
        opcode="lwz", operands="r30, 0x2c(r4)", regs=[("r", 30), ("r", 4)]
    )
    pre = Pass(name="BEFORE REGISTER COLORING")
    block = Block(index=0, succ=[], pred=[], labels=["L0"])
    block.instructions = [
        _make_ist("lwz", "r33, 0x2c(r36)", [("r", 33), ("r", 36)]),
        _make_ist("li", "r34, 0x0", [("r", 34)]),
    ]
    pre.blocks.append(block)
    fn = Function(name="test_fn", passes=[pre])
    events = FunctionEvents(name="test_fn")
    events.simplify_sections.append(SimplifySection(
        class_id=0, n_colors=19, n_class_regs=19,
        entries=[
            SimplifyEntry(iter_idx=0, ig_idx=87, degree=0, array_size=5,
                          flags=0, spilled=False),
            SimplifyEntry(iter_idx=1, ig_idx=88, degree=0, array_size=5,
                          flags=0, spilled=False),
        ],
    ))
    # Provide a virtual→ig_idx mapping the test can rely on. The real
    # function relies on order: simplify entries are emitted in iter
    # order, but ig_idx is assigned by the IG builder. We test the API
    # surface that maps virtual → ig_idx directly.
    virt_to_ig = {33: 87, 34: 88}
    result = match_virtual_for_expected_def(
        expected_ist=expected_ist,
        expected_position=0,
        pre_pass=pre,
        virtual_to_ig_idx=virt_to_ig,
    )
    assert result is not None
    assert result.virtual == 33
    assert result.ig_idx == 87
    assert result.instruction_index == 0
    assert result.confidence == "exact"


def test_match_virtual_prefers_closest_position() -> None:
    """When two BEFORE COLORING instructions share signature, pick the
    one closest to the expected position.
    """
    expected_ist = AsmInstruction(
        opcode="lwz", operands="r30, 0x2c(r4)", regs=[("r", 30), ("r", 4)]
    )
    pre = Pass(name="BEFORE REGISTER COLORING")
    block = Block(index=0, succ=[], pred=[], labels=["L0"])
    block.instructions = [
        _make_ist("li", "r33, 0x0", [("r", 33)]),
        _make_ist("li", "r34, 0x0", [("r", 34)]),
        _make_ist("li", "r35, 0x0", [("r", 35)]),
        _make_ist("lwz", "r36, 0x2c(r4)", [("r", 36), ("r", 4)]),  # pos 3
        _make_ist("li", "r37, 0x0", [("r", 37)]),
        _make_ist("lwz", "r38, 0x2c(r4)", [("r", 38), ("r", 4)]),  # pos 5
    ]
    pre.blocks.append(block)
    virt_to_ig = {33: 60, 34: 61, 35: 62, 36: 63, 37: 64, 38: 65}
    result = match_virtual_for_expected_def(
        expected_ist=expected_ist,
        expected_position=4,  # closer to pos 5 than pos 3
        pre_pass=pre,
        virtual_to_ig_idx=virt_to_ig,
    )
    assert result is not None
    assert result.virtual == 38
    assert result.ig_idx == 65


def test_match_virtual_returns_none_when_no_signature_match() -> None:
    expected_ist = AsmInstruction(
        opcode="lwz", operands="r30, 0x2c(r4)", regs=[("r", 30), ("r", 4)]
    )
    pre = Pass(name="BEFORE REGISTER COLORING")
    block = Block(index=0, succ=[], pred=[], labels=["L0"])
    block.instructions = [
        _make_ist("li", "r33, 0x0", [("r", 33)]),
    ]
    pre.blocks.append(block)
    virt_to_ig = {33: 60}
    result = match_virtual_for_expected_def(
        expected_ist=expected_ist,
        expected_position=0,
        pre_pass=pre,
        virtual_to_ig_idx=virt_to_ig,
    )
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```
pytest tests/test_mwcc_debug_iter_match.py -v
```

Expected: ImportError on `src.mwcc_debug.iter_match`.

- [ ] **Step 3: Implement `iter_match.py`**

Create `tools/melee-agent/src/mwcc_debug/iter_match.py`:

```python
"""Match expected r28..r31 defs to BEFORE COLORING virtuals.

Given an expected `AsmInstruction` (extracted from build/GALE01/asm/*.s)
and a BEFORE COLORING `Pass` (from the current pcdump), find the virtual
register that the current compile assigned to the "slot" that expected
gave to a specific physical register.

The mapping is positional + structural: we normalize each instruction to
`(opcode, operand_signature_with_regs_replaced_by_R)`, find instructions
in the pre-coloring pass with the matching signature, and pick the one
closest to the expected position. From that, we read the virtual at the
destination slot and look up its ig_idx.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from .asm_parser import AsmInstruction
from .parser import Instruction, Pass


_REG_TOKEN_RE = re.compile(r"\b([rf])\d+\b")


def instr_signature(opcode: str, operands: str) -> tuple[str, str]:
    """Normalize an instruction for cross-pass structural comparison.

    Replaces register tokens with placeholders: `r30` → `R`, `f5` → `F`.
    Symbol/label operands and numeric literals are preserved verbatim.
    """

    def repl(m: re.Match[str]) -> str:
        return "R" if m.group(1) == "r" else "F"

    norm = _REG_TOKEN_RE.sub(repl, operands)
    return (opcode, norm)


@dataclass
class MatchResult:
    virtual: int  # the virtual register that occupied this slot
    ig_idx: int  # its ig_idx from SimplifySection
    instruction_index: int  # position within the pre-pass linear instr list
    confidence: str  # "exact" (one signature match) | "ambiguous" (multiple) | "fuzzy" (out of tolerance)


def _linear_instructions(pre_pass: Pass) -> list[Instruction]:
    out: list[Instruction] = []
    for block in pre_pass.blocks:
        out.extend(block.instructions)
    return out


def _destination_virtual(ist: Instruction) -> Optional[int]:
    """Return the destination virtual register number (the first reg token
    that's r32+), or None if the instruction has no virtual destination."""
    if not ist.regs:
        return None
    kind, num = ist.regs[0]
    if kind != "r":
        return None
    if num < 32:
        return None
    return num


def match_virtual_for_expected_def(
    expected_ist: AsmInstruction,
    expected_position: int,
    pre_pass: Pass,
    virtual_to_ig_idx: dict[int, int],
) -> Optional[MatchResult]:
    """Find the virtual register in `pre_pass` that occupies the position
    corresponding to `expected_ist` in the expected output.

    `expected_position` is the body-relative index in expected (post-prologue).
    We compare to the *linear* instruction list of `pre_pass` (we don't
    bother with block-relative positions because BEFORE COLORING and the
    final asm have the same block layout for high-match functions).
    """
    target_sig = instr_signature(expected_ist.opcode, expected_ist.operands)
    instructions = _linear_instructions(pre_pass)

    # Find all candidates with matching signature
    candidates: list[tuple[int, Instruction]] = []
    for i, ist in enumerate(instructions):
        if instr_signature(ist.opcode, ist.operands) == target_sig:
            candidates.append((i, ist))

    if not candidates:
        return None

    # Pick the candidate whose position is closest to expected_position
    candidates.sort(key=lambda p: abs(p[0] - expected_position))
    best_i, best_ist = candidates[0]
    virt = _destination_virtual(best_ist)
    if virt is None:
        return None
    if virt not in virtual_to_ig_idx:
        return None

    confidence = "exact"
    if len(candidates) > 1:
        confidence = "ambiguous"

    return MatchResult(
        virtual=virt,
        ig_idx=virtual_to_ig_idx[virt],
        instruction_index=best_i,
        confidence=confidence,
    )


def build_virtual_to_ig_idx(
    pre_pass: Pass,
    simplify_entries: list,  # list[SimplifyEntry]
) -> dict[int, int]:
    """Build a virtual → ig_idx mapping.

    SimplifyEntry rows are emitted in iter order (= ig_idx descending),
    one per virtual register that participates in coloring. The mapping
    from ig_idx to virtual register number isn't directly stated in the
    pcdump, so we infer it via the pre_pass's use order: the K-th distinct
    virtual register seen in pre_pass instructions is the K-th entry by
    ig_idx (ascending).

    This is a heuristic that works for the typical case where every
    pre-pass virtual gets a SimplifyEntry. If the count mismatches, we
    return what we can compute up to min(len(entries), len(distinct_virts)).
    """
    seen: list[int] = []
    seen_set: set[int] = set()
    for block in pre_pass.blocks:
        for ist in block.instructions:
            for kind, num in ist.regs:
                if kind == "r" and num >= 32 and num not in seen_set:
                    seen.append(num)
                    seen_set.add(num)

    # ig_idx ascending order corresponds to virtual register discovery order
    # in the IG builder. Sort entries by ig_idx ascending.
    entries_by_ig = sorted(simplify_entries, key=lambda e: e.ig_idx)
    mapping: dict[int, int] = {}
    for virt, entry in zip(seen, entries_by_ig):
        mapping[virt] = entry.ig_idx
    return mapping
```

- [ ] **Step 4: Run tests to verify they pass**

```
pytest tests/test_mwcc_debug_iter_match.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```
git add tools/melee-agent/src/mwcc_debug/iter_match.py \
        tools/melee-agent/tests/test_mwcc_debug_iter_match.py
git commit -m "mwcc-debug: iter_match for aligning expected defs to pre-coloring virtuals"
```

---

## Task 1.3: Add `match-iter-first` CLI command

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (append a new command around line 2920, after `rank-callees`).

The command orchestrates: resolve pcdump → find expected `.s` → extract function → find first defs of r31..r28 → align each to BEFORE COLORING → emit a sorted list of `ig_idx` for the user to feed `--force-iter-first`.

- [ ] **Step 1: Find the right insertion point**

The new command goes after the existing `rank_callees` function. Locate it:

```
grep -n "^@debug_app.command(name=.rank-callees" tools/melee-agent/src/cli/debug.py
```

Insert after the end of `rank_callees` (look for the closing of the print loop and footer).

- [ ] **Step 2: Add imports for the new modules**

At the top of `debug.py`, add to existing `from src.mwcc_debug...` imports:

```python
from src.mwcc_debug.asm_parser import (
    extract_function as asm_extract_function,
    find_first_def as asm_find_first_def,
    parse_prologue_end as asm_parse_prologue_end,
)
from src.mwcc_debug.iter_match import (
    build_virtual_to_ig_idx,
    match_virtual_for_expected_def,
)
```

If the imports are organized in alphabetical / grouped blocks, follow the existing convention.

- [ ] **Step 3: Implement the command**

Append after `rank-callees`:

```python
@debug_app.command(name="match-iter-first")
def match_iter_first(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function to analyze (required)",
        ),
    ],
    pcdump: Annotated[
        Optional[Path],
        typer.Argument(
            help="Path to pcdump.txt. Omit to auto-resolve via --function "
                 "from the cache.",
        ),
    ] = None,
    regs: Annotated[
        str,
        typer.Option(
            "--regs",
            help="Comma-separated physical regs to report on (default: r31,r30,r29,r28).",
        ),
    ] = "r31,r30,r29,r28",
    asm: Annotated[
        Optional[Path],
        typer.Option(
            "--asm",
            help="Override path to expected .s file. Auto-resolves via report.json.",
        ),
    ] = None,
    json_out: Annotated[
        bool,
        typer.Option("--json", help="Emit as JSON."),
    ] = False,
) -> None:
    """Recommend --force-iter-first arguments by reading the expected .s.

    For each physical register in --regs, finds the first instruction in
    the expected output that defines it (post-prologue), structurally
    aligns that instruction to the current pcdump's BEFORE COLORING pass,
    and reports the virtual register's ig_idx.

    Useful for local-vs-local iter-order cascades where rank-callees
    can't tell which local "should have" gotten r31. Pipe the output's
    ig_idx list into --force-iter-first.
    """
    melee_root = DEFAULT_MELEE_ROOT
    pcdump_path = _resolve_pcdump_path(pcdump, function, melee_root)
    pcdump_text = pcdump_path.read_text()

    # Find the source unit for the function via report.json
    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(
            f"function '{function}' not found in report.json. "
            f"Run `ninja build/GALE01/report.json` and retry.",
            err=True,
        )
        raise typer.Exit(2)

    if asm is None:
        asm_path = melee_root / "build" / "GALE01" / "asm" / f"{unit}.s"
    else:
        asm_path = asm
    if not asm_path.exists():
        typer.echo(
            f"expected .s not found: {asm_path}\n"
            f"Run `python configure.py && ninja` to build it.",
            err=True,
        )
        raise typer.Exit(3)

    asm_text = asm_path.read_text()
    asm_fn = asm_extract_function(asm_text, function)
    if asm_fn is None:
        typer.echo(
            f"function '{function}' not found in {asm_path}",
            err=True,
        )
        raise typer.Exit(3)

    prologue_end = asm_parse_prologue_end(asm_fn.instructions)
    body = asm_fn.instructions[prologue_end:]

    # Parse current pcdump's BEFORE COLORING pass for the function
    fns = parse_pcdump(pcdump_text)
    fn = next((f for f in fns if f.name == function), None)
    if fn is None:
        _abort_function_not_in_dump(function, [f.name for f in fns])
    pre_pass = fn.last_precolor_pass()
    if pre_pass is None:
        typer.echo(
            f"no pre-coloring pass found in pcdump for {function}",
            err=True,
        )
        raise typer.Exit(4)

    # Build virtual→ig_idx mapping from simplify_sections
    events_list = parse_hook_events(pcdump_text)
    fn_events = find_function(events_list, function)
    simplify_entries: list = []
    if fn_events is not None:
        for sec in fn_events.simplify_sections:
            simplify_entries.extend(sec.entries)
    virt_to_ig = build_virtual_to_ig_idx(pre_pass, simplify_entries)

    # Parse --regs
    reg_list: list[int] = []
    for token in regs.split(","):
        token = token.strip()
        if not token:
            continue
        if not token.startswith("r"):
            typer.echo(f"invalid reg token: {token}", err=True)
            raise typer.Exit(2)
        try:
            reg_list.append(int(token[1:]))
        except ValueError:
            typer.echo(f"invalid reg token: {token}", err=True)
            raise typer.Exit(2)

    results: list[dict] = []
    for reg in reg_list:
        expected_def = asm_find_first_def(body, target_reg=reg)
        if expected_def is None:
            results.append({
                "reg": reg,
                "status": "unused",
                "note": f"r{reg} never used as a destination in expected",
            })
            continue
        pos, expected_ist = expected_def
        match = match_virtual_for_expected_def(
            expected_ist=expected_ist,
            expected_position=pos,
            pre_pass=pre_pass,
            virtual_to_ig_idx=virt_to_ig,
        )
        if match is None:
            results.append({
                "reg": reg,
                "status": "no_match",
                "note": f"no structural match in BEFORE COLORING for "
                        f"`{expected_ist.opcode} {expected_ist.operands}`",
            })
            continue
        results.append({
            "reg": reg,
            "status": "ok",
            "ig_idx": match.ig_idx,
            "virtual": match.virtual,
            "instr_idx": match.instruction_index,
            "opcode": expected_ist.opcode,
            "operands": expected_ist.operands,
            "confidence": match.confidence,
        })

    if json_out:
        print(json.dumps({
            "function": function,
            "unit": unit,
            "results": results,
        }, indent=2))
        return

    print(f"Function: {function}")
    print(f"Unit:     {unit}")
    print(f"ASM:      {asm_path.relative_to(melee_root)}")
    print()
    print(f"Expected iter-first targets:")
    ig_indices: list[int] = []
    for r in results:
        reg_str = f"r{r['reg']}"
        if r["status"] == "ok":
            print(
                f"  {reg_str} ← ig_idx {r['ig_idx']:<3} "
                f"(virt r{r['virtual']}, instr {r['instr_idx']}: "
                f"{r['opcode']} {r['operands']}) [{r['confidence']}]"
            )
            ig_indices.append(r["ig_idx"])
        else:
            print(f"  {reg_str} - {r['note']}")
    if ig_indices:
        ig_csv = ",".join(str(i) for i in ig_indices)
        print()
        print(f"Try:")
        print(f"  melee-agent debug pcdump <source.c> --force-iter-first {ig_csv}")
```

- [ ] **Step 4: Smoke test the command**

```
cd /Users/mike/code/melee
python -m src.cli debug match-iter-first --help 2>&1 | head -20
```

Expected: typer help output for the new command.

- [ ] **Step 5: Run against a real function (requires fresh pcdump cache)**

```
melee-agent debug match-iter-first -f fn_80247510
```

Expected output: a list of r28..r31 with their ig_idx recommendations, plus a `--force-iter-first <csv>` line.

If the function isn't cached, the command will tell you to run `pcdump` first. That's the expected error path.

- [ ] **Step 6: Commit**

```
git add tools/melee-agent/src/cli/debug.py
git commit -m "mwcc-debug: match-iter-first CLI command"
```

---

## Task 1.4: Integration test on fn_80247510

**Files:**
- Modify: `tools/melee-agent/tests/test_mwcc_debug_iter_match.py` (add an integration test class that uses real fixture data).

This test confirms end-to-end behavior on the agent's actual stuck case. We need a small fixture: a snippet of expected `.s` and a snippet of pcdump text. Build them from the live files but trim to keep the test self-contained.

- [ ] **Step 1: Capture fixture data**

```
mkdir -p tools/melee-agent/tests/fixtures/mwcc_debug
sed -n '/^.fn fn_80247510, global/,/^.endfn fn_80247510/p' \
    build/GALE01/asm/melee/mn/mnvibration.s \
    > tools/melee-agent/tests/fixtures/mwcc_debug/fn_80247510.s
```

For the pcdump fixture, we want the BEFORE COLORING + SIMPLIFY GRAPH sections only. Use awk to extract:

```
awk '
  /^Starting function fn_80247510/ { capture=1 }
  /^Starting function/ && !/fn_80247510/ { capture=0 }
  capture { print }
' build/mwcc_debug_cache/melee/mn/mnvibration.txt \
  > tools/melee-agent/tests/fixtures/mwcc_debug/fn_80247510_pcdump.txt
```

- [ ] **Step 2: Add the integration test**

Append to `test_mwcc_debug_iter_match.py`:

```python
import pathlib

FIXTURES = pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"


def test_integration_fn_80247510() -> None:
    """End-to-end: read expected fn_80247510.s + pcdump, ensure
    we recommend at least one ig_idx for r31.
    """
    from src.mwcc_debug.asm_parser import (
        extract_function as asm_extract_function,
        find_first_def as asm_find_first_def,
        parse_prologue_end as asm_parse_prologue_end,
    )
    from src.mwcc_debug.colorgraph_parser import (
        find_function,
        parse_hook_events,
    )
    from src.mwcc_debug.parser import parse_pcdump

    asm_text = (FIXTURES / "fn_80247510.s").read_text()
    pcdump_text = (FIXTURES / "fn_80247510_pcdump.txt").read_text()

    asm_fn = asm_extract_function(asm_text, "fn_80247510")
    assert asm_fn is not None
    prologue_end = asm_parse_prologue_end(asm_fn.instructions)
    body = asm_fn.instructions[prologue_end:]
    expected_def = asm_find_first_def(body, target_reg=31)
    assert expected_def is not None, "r31 must have a def in fn_80247510"

    fns = parse_pcdump(pcdump_text)
    fn = next((f for f in fns if f.name == "fn_80247510"), None)
    assert fn is not None
    pre_pass = fn.last_precolor_pass()
    assert pre_pass is not None

    events_list = parse_hook_events(pcdump_text)
    fn_events = find_function(events_list, "fn_80247510")
    simplify_entries: list = []
    if fn_events is not None:
        for sec in fn_events.simplify_sections:
            simplify_entries.extend(sec.entries)
    virt_to_ig = build_virtual_to_ig_idx(pre_pass, simplify_entries)
    assert len(virt_to_ig) > 0, "virtual→ig_idx mapping must be non-empty"

    pos, expected_ist = expected_def
    match = match_virtual_for_expected_def(
        expected_ist=expected_ist,
        expected_position=pos,
        pre_pass=pre_pass,
        virtual_to_ig_idx=virt_to_ig,
    )
    # We may not match (low-confidence cases), but if we do, the ig_idx
    # should be a positive number.
    if match is not None:
        assert match.ig_idx > 0
```

- [ ] **Step 3: Run all tier-related tests to confirm nothing regressed**

```
pytest tests/test_mwcc_debug_asm_parser.py tests/test_mwcc_debug_iter_match.py -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit fixture + test**

```
git add tools/melee-agent/tests/fixtures/mwcc_debug/ \
        tools/melee-agent/tests/test_mwcc_debug_iter_match.py
git commit -m "mwcc-debug: integration test for match-iter-first on fn_80247510"
```

---

## Task 2.1: RE the literal-pool symbol naming in mwcceppc.exe

**Timebox:** 60 minutes. If no clean hook found, switch to post-process fallback (Task 2.1-fallback).

The goal: locate the function in `mwcceppc.exe` v1.2.5n that creates the anonymous `@N` symbol for a `.sdata2` literal pool entry, and identify whether it's hookable via the existing trampoline pattern in `tools/mwcc_debug/mwcc_debug.c`.

**Starting hypotheses:**
1. The function probably lives in the symbol/object emission module (alongside `EmitObject` / `EmitSdata` / similar).
2. The naming likely happens at literal pool *placement* time (when a new literal needs a slot), separate from the relocation emit (which uses the already-named symbol).
3. Cross-reference: any anonymous symbol naming code that produces strings starting with `@` followed by a number.

- [ ] **Step 1: Disassemble mwcceppc.exe in Ghidra (or radare2) and search for `@%d` format strings**

If Ghidra is set up on the binary:
- Open `tools/mwcc_233_163n/mwcceppc.exe` (or whatever local copy exists).
- Search → For Strings → filter for `@%d` or `@`.
- The format string used for `sprintf` of anonymous labels gives an entry point.

If no Ghidra, fall back to running `strings -t x mwcceppc.exe | grep '@'`.

- [ ] **Step 2: Find xrefs to the format string**

For each `@%d`-like format string found, list its references. The reference inside a routine that returns a symbol/object pointer is the candidate.

- [ ] **Step 3: Identify hook point**

Look for a function with signature `void *NameAnonymousSymbol(int *counter_or_value, ...)` or `Object *CreateLiteralEntry(uint64_t value, ...)`. Document its VA, signature, and calling convention.

- [ ] **Step 4: Record findings in `tools/mwcc_debug/UPSTREAM`**

Append:

```
Literal-pool symbol naming (v1.2.5n):
  - VA: 0xNNNNNN
  - Signature: <inferred from call sites>
  - Hook strategy: <patch-jmp into our trampoline, read literal value,
                    consult MWCC_DEBUG_NAME_MAGIC, return user name or
                    fall through to original>
```

- [ ] **Step 5: Decision gate**

If a clean hook point was found, proceed to Task 2.2. If RE didn't converge inside the timebox, jump to **Task 2.1-fallback** (post-process .o).

- [ ] **Step 6: Commit RE notes**

```
git add tools/mwcc_debug/UPSTREAM
git commit -m "mwcc_debug: locate literal-pool symbol naming in mwcceppc.exe"
```

---

## Task 2.1-fallback: Post-process .o symbol rewriting

**Only run this if Task 2.1's RE didn't find a clean hook.**

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/o_rewriter.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_o_rewriter.py`

Rewrite `@N` symbols in a `.o` file to user-supplied names when their backing data matches a magic constant value. Uses the ELF symbol table directly (mwcc emits ELF on Wii/GC targets).

- [ ] **Step 1: Implement using pyelftools**

Add `pyelftools` to test requirements if not present:

```
pip install pyelftools
```

Skeleton (full impl in next step):

```python
"""Post-process MWCC-produced .o to rename anonymous @N symbols whose
backing .sdata2 data matches a user-supplied magic constant."""

from __future__ import annotations

import struct
from pathlib import Path

from elftools.elf.elffile import ELFFile


def rename_magic_symbols(
    o_path: Path,
    mapping: dict[int, str],  # 64-bit value → new symbol name
    output_path: Path,
) -> list[tuple[str, str]]:
    """Walk .sdata2 entries; for any anonymous @N pointing at data
    matching a value in `mapping`, replace the name with mapping[value].

    Returns a list of (old_name, new_name) renames performed.
    """
    # ... implement ...
```

(Full implementation deferred — only build this if the hook approach fails.)

- [ ] **Step 2: Wire into CLI**

If using fallback, the `--name-magic` flag in `pcdump` triggers a post-compile rename pass on the downloaded `.o` cache.

---

## Task 2.2: Implement `--name-magic` hook in mwcc_debug.c

**Files:**
- Modify: `tools/mwcc_debug/mwcc_debug.c` (add env parser + hook function around the existing hook block).

Pattern follows the existing `force-iter-first` and `force-phys` hooks. Reuse the same trampoline approach: prologue copy + JMP-back.

- [ ] **Step 1: Add env var parser**

After the existing `parse_iter_first_from_env()`:

```c
typedef struct {
    uint64_t value;
    char name[64];
} MagicNameMapping;

static MagicNameMapping g_magic_names[16];
static int g_magic_name_count = 0;

static void parse_magic_names_from_env(void) {
    const char *env = getenv("MWCC_DEBUG_NAME_MAGIC");
    if (!env || !*env) return;
    g_magic_name_count = 0;
    // Format: "s32:mnVibration_804DC018,u32:mnVibration_804DC010,0x12345:foo"
    const char *p = env;
    while (*p && g_magic_name_count < 16) {
        // Read key (up to ':')
        const char *colon = strchr(p, ':');
        if (!colon) break;
        char keybuf[32];
        size_t keylen = (size_t)(colon - p);
        if (keylen >= sizeof(keybuf)) break;
        memcpy(keybuf, p, keylen);
        keybuf[keylen] = '\0';
        // Resolve key to value
        uint64_t value;
        if (strcmp(keybuf, "s32") == 0) value = 0x4330000080000000ULL;
        else if (strcmp(keybuf, "u32") == 0) value = 0x4330000000000000ULL;
        else value = strtoull(keybuf, NULL, 0);
        // Read name (up to ',' or end)
        const char *q = colon + 1;
        const char *comma = strchr(q, ',');
        size_t namelen = comma ? (size_t)(comma - q) : strlen(q);
        if (namelen >= sizeof(g_magic_names[0].name)) break;
        g_magic_names[g_magic_name_count].value = value;
        memcpy(g_magic_names[g_magic_name_count].name, q, namelen);
        g_magic_names[g_magic_name_count].name[namelen] = '\0';
        fprintf(stderr,
                "[NAME_MAGIC] value 0x%016llx -> '%s'\n",
                (unsigned long long)value,
                g_magic_names[g_magic_name_count].name);
        g_magic_name_count++;
        if (!comma) break;
        p = comma + 1;
    }
}

static const char *lookup_magic_name(uint64_t value) {
    for (int i = 0; i < g_magic_name_count; i++) {
        if (g_magic_names[i].value == value) {
            return g_magic_names[i].name;
        }
    }
    return NULL;
}
```

- [ ] **Step 2: Implement the hook**

Hook signature depends on what RE turned up. Skeleton:

```c
static void *(*orig_name_literal)(void *literal) = NULL;

static void *hook_name_literal(void *literal) {
    // literal layout determined during RE
    uint64_t value = *(uint64_t *)((char *)literal + LITERAL_VALUE_OFFSET);
    const char *user_name = lookup_magic_name(value);
    if (user_name) {
        // Allocate using mwcc's allocator (so it survives the compile)
        char *name = (char *)mwcc_alloc(strlen(user_name) + 1);
        strcpy(name, user_name);
        fprintf(stderr,
                "[NAME_MAGIC] renamed literal at %p to '%s'\n",
                literal, user_name);
        // Set the literal's symbol name field, then call original
        // (or return whatever the original would have returned).
        *(char **)((char *)literal + LITERAL_NAME_OFFSET) = name;
    }
    return orig_name_literal(literal);
}
```

- [ ] **Step 3: Install hook in DllMain**

In the `attach_hooks()` function, add:

```c
parse_magic_names_from_env();
if (g_magic_name_count > 0) {
    install_trampoline_hook(
        (void *)LITERAL_NAME_FN_VA,
        hook_name_literal,
        (void **)&orig_name_literal
    );
}
```

- [ ] **Step 4: Build the DLL on the Windows host**

Push the source to the Windows host's mwcc_debug build dir, then:

```
cd /Users/mike/code/melee
./tools/mwcc_debug/win/build_dll.sh   # or whatever build script exists
```

(Reuse the existing build pipeline.)

- [ ] **Step 5: Smoke test**

Run pcdump with the env var set on a known int-to-float source:

```
MWCC_DEBUG_NAME_MAGIC=s32:mnVibration_804DC018 \
melee-agent debug pcdump src/melee/mn/mnvibration.c --output /tmp/named.txt
grep mnVibration_804DC018 /tmp/named.txt
```

Expected: the named symbol appears in the dump (rather than `@N`).

- [ ] **Step 6: Commit**

```
git add tools/mwcc_debug/mwcc_debug.c
git commit -m "mwcc_debug: --name-magic hook for literal-pool symbol naming"
```

---

## Task 2.3: Add `--name-magic` CLI flag to `pcdump`

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (the existing `pcdump` command around line 82).
- Modify: `tools/mwcc_debug/win/run_pcdump.ps1` (add env passthrough).

- [ ] **Step 1: Locate the existing `pcdump` command and the `force-iter-first` flag pattern**

```
grep -n "force-iter-first\|force_iter_first" tools/melee-agent/src/cli/debug.py | head -10
```

Match the existing pattern when wiring the new flag through.

- [ ] **Step 2: Add `--name-magic` flag**

Inside the `pcdump` command function signature, add:

```python
    name_magic: Annotated[
        Optional[list[str]],
        typer.Option(
            "--name-magic",
            help="Map a magic constant to a symbol name. Format: "
                 "'<value>=<name>' where <value> is one of s32, u32, "
                 "or a 64-bit hex literal. May be repeated.",
        ),
    ] = None,
```

In the body of `pcdump` (where env vars are constructed for the remote command), add:

```python
if name_magic:
    # Convert "s32=mnVibration_804DC018" to internal "s32:mnVibration_804DC018"
    mappings = []
    for m in name_magic:
        if "=" not in m:
            typer.echo(f"invalid --name-magic value (need '='): {m}", err=True)
            raise typer.Exit(2)
        k, v = m.split("=", 1)
        mappings.append(f"{k.strip()}:{v.strip()}")
    env_pairs.append(("MWCC_DEBUG_NAME_MAGIC", ",".join(mappings)))
```

(Wire `env_pairs` into the existing `cmd.exe set NAME=value && ...` chain that already supports `MWCC_DEBUG_FORCE_ITER_FIRST` etc.)

- [ ] **Step 3: Add passthrough in `run_pcdump.ps1`**

In `tools/mwcc_debug/win/run_pcdump.ps1`, find the existing env var passthrough block (around the `MWCC_DEBUG_BRANCH.Trim()` line) and add:

```powershell
if ($env:MWCC_DEBUG_NAME_MAGIC) {
    $magicEnv = $env:MWCC_DEBUG_NAME_MAGIC.Trim()
    Write-Host "[run_pcdump] MWCC_DEBUG_NAME_MAGIC=$magicEnv"
    # already inherited via the env block; no extra plumbing needed
}
```

(Defensive trim, mirroring the existing pattern.)

- [ ] **Step 4: Smoke test end to end**

```
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --name-magic s32=mnVibration_804DC018 \
    --output /tmp/named.txt
grep -c mnVibration_804DC018 /tmp/named.txt
```

Expected: at least one match (the renamed symbol).

- [ ] **Step 5: Commit**

```
git add tools/melee-agent/src/cli/debug.py \
        tools/mwcc_debug/win/run_pcdump.ps1
git commit -m "mwcc-debug: --name-magic CLI flag + run_pcdump passthrough"
```

---

## Task 3: Verify on real stuck functions

- [ ] **Step 1: Test match-iter-first on fn_80247510**

```
melee-agent debug match-iter-first -f fn_80247510
```

Expected: outputs recommended ig_idx for r28..r31. Confidence per row should be "exact" for most cases.

- [ ] **Step 2: Apply the suggestion and verify**

Take the recommended `--force-iter-first` argument from step 1 and run:

```
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --force-iter-first <recommended_csv> \
    --output /tmp/forced.txt
melee-agent debug rank-callees -f fn_80247510 /tmp/forced.txt
```

Expected: rank-callees now shows the forced ig_idx assigned to its target physical register (e.g. r31).

- [ ] **Step 3: Test --name-magic on fn_80248A78 (or any of the magic-stuck functions)**

```
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --name-magic s32=mnVibration_804DC018 \
    --output /tmp/named.txt
# Then re-compile via the normal build and run checkdiff
python tools/checkdiff.py -f fn_80248A78
```

Expected: byte-match improves (or hits 100% bytes if this was the only diff).

- [ ] **Step 4: Document any failures in the handoff doc**

Capture: what worked, what didn't, what the agent should know. Move to Task 4.

---

## Task 4: Handoff doc, commit, push

**Files:**
- Create: `docs/mwcc-debug-handoff-2026-05-18.md`

- [ ] **Step 1: Write handoff doc**

Mirror the structure of `docs/mwcc-debug-handoff-2026-05-20.md`. Sections:
- What's shipped (one bullet per tool)
- How to use it (concrete CLI examples)
- Caveats / known limitations
- Open wishlist items still pending

- [ ] **Step 2: Commit and push**

```
git add docs/mwcc-debug-handoff-2026-05-18.md
git commit -m "docs: handoff for match-iter-first + --name-magic"
git push origin master
```

---

## Self-Review Checklist

After implementing all tasks, verify:

- [ ] All new modules have unit tests with at least one happy-path and one edge case
- [ ] `pytest tools/melee-agent/tests/test_mwcc_debug_*.py` passes
- [ ] `melee-agent debug match-iter-first --help` shows help text
- [ ] `melee-agent debug pcdump --help` shows `--name-magic` in the flags
- [ ] Handoff doc references actual functions tested
- [ ] All commits pushed to master
