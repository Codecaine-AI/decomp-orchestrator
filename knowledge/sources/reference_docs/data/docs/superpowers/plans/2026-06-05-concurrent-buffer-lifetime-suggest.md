# Concurrent Buffer Lifetime Suggest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach `debug suggest control-flow-shape` to recognize ASM evidence that stack command buffers are being coalesced because source lifetimes are mutually exclusive.

**Correction from #412:** This detector must not fire on the CardState
40-vs-36 command-buffer stride residual when every current stack home is
distinct. That case is a size/alignment artifact, not coalescing or overlap,
and round-6 evidence showed it is match-neutral. Positive detections require a
repeated current stack-home offset.

**Architecture:** Extend the existing `src/mwcc_debug/suggest_control_flow_shape.py` analyzer with a small ASM-only stack-address-home extractor and a new ranked detector. Keep the existing CLI shape; CLI tests only verify that checkdiff JSON flowing through the current command can surface the new suggestion.

**Tech Stack:** Python, Typer CLI, pytest, existing checkdiff JSON fixtures.

---

## File Structure

- Modify `tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py`: add stack-address-home extraction, new `concurrent-buffer-lifetime` detector, priority entry, and per-suggestion follow-up override support.
- Modify `tools/melee-agent/tests/test_suggest_control_flow_shape.py`: add unit tests for the positive detector, missing-call-layer suppression, differing-call-count suppression, stride/alignment-only negative case, CardState distinct-home 40-vs-36 negative case, and parser edge cases.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`: add one CLI regression proving JSON/text output can include the new suggestion from checkdiff JSON without pcdumps.

## Task 1: Analyzer Regression Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_suggest_control_flow_shape.py`

- [ ] **Step 1: Add positive and negative unit tests**

Append tests near the other `analyze_control_flow_shape` tests:

```python
def _consumer_home_call(symbol: str, offset: int, call_offset: int) -> list[str]:
    return [
        f"/* {call_offset:04X} */ addi r3, r1, 0x{offset:X}",
        f"/* {call_offset + 4:04X} */ bl {symbol}",
        f"/* {call_offset + 4:04X} */ R_PPC_REL24 {symbol}",
    ]


def test_analyze_detects_concurrent_buffer_lifetime_coalescing() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
        + _consumer_home_call("fn_803AC168", 0x198, 0x30)
    )
    current_asm = (
        _consumer_home_call("fn_803AC168", 0x110, 0)
        + _consumer_home_call("fn_803AC168", 0x110, 0x10)
        + _consumer_home_call("fn_803AC168", 0x138, 0x20)
        + _consumer_home_call("fn_803AC168", 0x138, 0x30)
    )

    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )

    suggestion = next(
        item for item in report["suggestions"]
        if item["kind"] == "concurrent-buffer-lifetime"
    )
    assert suggestion["evidence"]["consumer_symbol"] == "fn_803AC168"
    assert suggestion["evidence"]["target_call_count"] == 4
    assert suggestion["evidence"]["current_call_count"] == 4
    assert suggestion["evidence"]["target_unique_home_count"] == 4
    assert suggestion["evidence"]["current_unique_home_count"] == 2
    assert suggestion["evidence"]["target_stride_candidates"] == [40]
    assert suggestion["evidence"]["target_alignment"] == 8
    assert "concurrently live" in suggestion["recommendation"]
    assert all("frame-transform" not in cmd for cmd in suggestion["follow_up_commands"])
```

Add negative tests:

```python
def test_concurrent_buffer_lifetime_suppresses_missing_call_layer() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
    )
    current_asm = [
        "/* 0000 */ addi r3, r1, 0x110",
        "/* 0004 */ bl fn_803AC7DC",
        "/* 0004 */ R_PPC_REL24 fn_803AC7DC",
    ]
    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification={
            "primary": "inline-boundary-toolchain-artifact",
            "reasons": ["control-flow/source shape differs"],
            "inline_boundary_artifact": {
                "missing_ref_calls": ["fn_803AC168"],
                "extra_current_calls": ["fn_803AC7DC"],
            },
        },
    )
    kinds = [item["kind"] for item in report["suggestions"]]
    assert "missing-extra-call-layer" in kinds
    assert "concurrent-buffer-lifetime" not in kinds


def test_concurrent_buffer_lifetime_suppresses_different_call_counts() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
    )
    current_asm = (
        _consumer_home_call("fn_803AC168", 0x110, 0)
        + _consumer_home_call("fn_803AC168", 0x110, 0x10)
    )
    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )
    assert "concurrent-buffer-lifetime" not in [
        item["kind"] for item in report["suggestions"]
    ]


def test_concurrent_buffer_lifetime_suppresses_alignment_only() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
    )
    current_asm = (
        _consumer_home_call("fn_803AC168", 0x124, 0)
        + _consumer_home_call("fn_803AC168", 0x14C, 0x10)
        + _consumer_home_call("fn_803AC168", 0x174, 0x20)
    )
    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )
    assert "concurrent-buffer-lifetime" not in [
        item["kind"] for item in report["suggestions"]
    ]


def test_concurrent_buffer_lifetime_suppresses_cardstate_stride_only_delta() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x5C, 0)
        + _consumer_home_call("fn_803AC168", 0x84, 0x10)
        + _consumer_home_call("fn_803AC168", 0xAC, 0x20)
        + _consumer_home_call("fn_803AC168", 0xD4, 0x30)
        + _consumer_home_call("fn_803AC168", 0xFC, 0x40)
    )
    current_asm = (
        _consumer_home_call("fn_803AC168", 0x60, 0)
        + _consumer_home_call("fn_803AC168", 0x84, 0x10)
        + _consumer_home_call("fn_803AC168", 0xA8, 0x20)
        + _consumer_home_call("fn_803AC168", 0xCC, 0x30)
        + _consumer_home_call("fn_803AC168", 0xF0, 0x40)
    )
    report = analyze_control_flow_shape(
        function="fn_803AE7F8",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )
    assert "concurrent-buffer-lifetime" not in [
        item["kind"] for item in report["suggestions"]
    ]
```

- [ ] **Step 2: Add parser edge-case tests**

Append a parser-focused test:

```python
def test_concurrent_buffer_lifetime_extracts_alias_and_constant_add_homes() -> None:
    target_asm = [
        "/* 0000 */ li r6, 0x120",
        "/* 0004 */ add r5, r1, r6",
        "/* 0008 */ mr r3, r5",
        "/* 000C */ bl fn_803AC168",
        "/* 000C */ R_PPC_REL24 fn_803AC168",
        "/* 0010 */ addi r4, r0, 0x148",
        "/* 0014 */ add r3, r1, r4",
        "/* 0018 */ bl fn_803AC168",
        "/* 0018 */ R_PPC_REL24 fn_803AC168",
        "/* 001C */ addi r4, 0, 0x170",
        "/* 0020 */ add r3, r1, r4",
        "/* 0024 */ bl fn_803AC168",
        "/* 0024 */ R_PPC_REL24 fn_803AC168",
    ]
    current_asm = [
        "/* 0000 */ addi r3, r1, 0x110",
        "/* 0004 */ bl fn_803AC168",
        "/* 0004 */ R_PPC_REL24 fn_803AC168",
        "/* 0008 */ addi r3, r1, 0x110",
        "/* 000C */ bl fn_803AC168",
        "/* 000C */ R_PPC_REL24 fn_803AC168",
        "/* 0010 */ addi r3, r1, 0x138",
        "/* 0014 */ bl fn_803AC168",
        "/* 0014 */ R_PPC_REL24 fn_803AC168",
    ]
    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )
    assert any(
        item["kind"] == "concurrent-buffer-lifetime"
        for item in report["suggestions"]
    )
```

Append a dynamic producer/non-stack negative test:

```python
def test_concurrent_buffer_lifetime_ignores_dynamic_or_non_stack_homes() -> None:
    target_asm = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
    )
    current_asm = [
        "/* 0000 */ lwz r6, 0(r31)",
        "/* 0004 */ add r3, r1, r6",
        "/* 0008 */ bl fn_803AC168",
        "/* 0008 */ R_PPC_REL24 fn_803AC168",
        "/* 000C */ lis r3, global_buffer@ha",
        "/* 0010 */ bl fn_803AC168",
        "/* 0010 */ R_PPC_REL24 fn_803AC168",
        "/* 0014 */ mr r3, r30",
        "/* 0018 */ bl fn_803AC168",
        "/* 0018 */ R_PPC_REL24 fn_803AC168",
    ]
    report = analyze_control_flow_shape(
        function="fn_803B1338",
        target_asm=target_asm,
        current_asm=current_asm,
        classification=_classification(),
    )
    assert "concurrent-buffer-lifetime" not in [
        item["kind"] for item in report["suggestions"]
    ]
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_control_flow_shape.py -q --no-cov
```

Expected: the new tests fail because `concurrent-buffer-lifetime` is not implemented.

## Task 2: Analyzer Implementation

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py`

- [ ] **Step 1: Add priority and detector registration**

Update `_PRIORITY` and detector order:

```python
_PRIORITY = {
    "branch-idiom": 10,
    "call-hoist": 20,
    "pointer-walk-indexed-shape": 30,
    "concurrent-buffer-lifetime": 35,
    "loop-peel-unroll": 40,
    "missing-extra-call-layer": 50,
}
```

In `analyze_control_flow_shape`, include `_detect_concurrent_buffer_lifetime`
after `_detect_pointer_walk` and before `_detect_loop_peel_unroll`.

- [ ] **Step 2: Allow custom follow-up commands**

Change `_suggestion` signature:

```python
def _suggestion(
    *,
    function: str,
    kind: str,
    confidence: float,
    recommendation: str,
    evidence: dict[str, Any],
    operator: str | None,
    follow_up_commands: list[str] | None = None,
) -> dict[str, Any]:
    commands = follow_up_commands
    if commands is None and operator:
        commands = [
            "melee-agent debug mutate control-flow-shape-search "
            f"-f {function} --operator {operator} --json"
        ]
    return {
        "kind": kind,
        "confidence": confidence,
        "recommendation": recommendation,
        "evidence": evidence,
        "follow_up_commands": commands or [],
    }
```

Keep existing call sites passing the same `operator` strings.

- [ ] **Step 3: Add stack-home helper dataclass and parser**

Add below `_LoopRegion`:

```python
@dataclass(frozen=True)
class _StackHomeCall:
    call_index: int
    symbol: str
    offset: int
    line: str
```

Add helpers near the call utilities:

```python
_ARG_REGS = tuple(f"r{index}" for index in range(3, 11))


def _stack_home_calls_by_symbol(
    instructions: list[_Instruction],
    *,
    window_size: int = 8,
) -> dict[str, list[_StackHomeCall]]:
    grouped: dict[str, list[_StackHomeCall]] = {}
    for index, item in enumerate(instructions):
        if item.opcode not in _CALL_OPS:
            continue
        symbol = item.relocation_symbol or _call_symbol(item.operands)
        if symbol is None:
            continue
        homes = _stack_homes_before_call(instructions, index, window_size=window_size)
        for offset, line in homes:
            grouped.setdefault(symbol, []).append(
                _StackHomeCall(index, symbol, offset, line)
            )
    return grouped


def _stack_homes_before_call(
    instructions: list[_Instruction],
    call_index: int,
    *,
    window_size: int,
) -> list[tuple[int, str]]:
    constants: dict[str, int] = {}
    homes: dict[str, tuple[int, str]] = {}
    for item in instructions[max(0, call_index - window_size) : call_index]:
        dest = _first_register(item.operands)
        if dest is None:
            continue
        if item.opcode == "li":
            value = _second_immediate(item.operands)
            _set_or_clear(constants, homes, dest, value=value)
            continue
        if item.opcode == "addi":
            parsed = _parse_addi(item.operands)
            if parsed is None:
                _clear_register(constants, homes, dest)
                continue
            dst, base, imm = parsed
            if base == "r1":
                homes[dst] = (imm, item.line)
                constants.pop(dst, None)
            elif base in {"r0", "0"}:
                constants[dst] = imm
                homes.pop(dst, None)
            else:
                _clear_register(constants, homes, dst)
            continue
        if item.opcode == "add":
            parsed_add = _parse_add(item.operands)
            if parsed_add is None:
                _clear_register(constants, homes, dest)
                continue
            dst, left, right = parsed_add
            if left == "r1" and right in constants:
                homes[dst] = (constants[right], item.line)
                constants.pop(dst, None)
            elif right == "r1" and left in constants:
                homes[dst] = (constants[left], item.line)
                constants.pop(dst, None)
            else:
                _clear_register(constants, homes, dst)
            continue
        if item.opcode == "mr":
            regs = _registers(item.operands)
            if len(regs) >= 2 and regs[1] in homes:
                homes[regs[0]] = homes[regs[1]]
                constants.pop(regs[0], None)
            elif len(regs) >= 2 and regs[1] in constants:
                constants[regs[0]] = constants[regs[1]]
                homes.pop(regs[0], None)
            else:
                _clear_register(constants, homes, dest)
            continue
        _clear_register(constants, homes, dest)

    result: list[tuple[int, str]] = []
    seen_offsets: set[int] = set()
    for reg in _ARG_REGS:
        if reg not in homes:
            continue
        offset, line = homes[reg]
        if offset in seen_offsets:
            continue
        seen_offsets.add(offset)
        result.append((offset, line))
    return result
```

Add the small parsing helpers called by `_stack_homes_before_call`:

```python
def _registers(operands: str) -> list[str]:
    return re.findall(r"\br\d+\b", operands.lower())


def _first_register(operands: str) -> str | None:
    regs = _registers(operands)
    return regs[0] if regs else None


def _parse_int(value: str) -> int | None:
    try:
        return int(value.strip(), 0)
    except ValueError:
        return None


def _second_immediate(operands: str) -> int | None:
    pieces = [piece.strip() for piece in operands.split(",")]
    if len(pieces) < 2:
        return None
    return _parse_int(pieces[1])


def _parse_addi(operands: str) -> tuple[str, str, int] | None:
    pieces = [piece.strip().lower() for piece in operands.split(",")]
    if len(pieces) != 3:
        return None
    imm = _parse_int(pieces[2])
    if imm is None:
        return None
    return pieces[0], pieces[1], imm


def _parse_add(operands: str) -> tuple[str, str, str] | None:
    pieces = [piece.strip().lower() for piece in operands.split(",")]
    if len(pieces) != 3:
        return None
    return pieces[0], pieces[1], pieces[2]


def _clear_register(
    constants: dict[str, int],
    homes: dict[str, tuple[int, str]],
    reg: str,
) -> None:
    constants.pop(reg, None)
    homes.pop(reg, None)


def _set_or_clear(
    constants: dict[str, int],
    homes: dict[str, tuple[int, str]],
    reg: str,
    *,
    value: int | None,
) -> None:
    if value is None:
        _clear_register(constants, homes, reg)
        return
    constants[reg] = value
    homes.pop(reg, None)
```

- [ ] **Step 4: Add detector and evidence helpers**

Add:

```python
def _detect_concurrent_buffer_lifetime(
    *,
    function: str,
    target: list[_Instruction],
    current: list[_Instruction],
    classification: dict[str, Any],
) -> dict[str, Any] | None:
    target_homes = _stack_home_calls_by_symbol(target)
    current_homes = _stack_home_calls_by_symbol(current)
    target_calls = _calls(target)
    current_calls = _calls(current)

    candidates: list[tuple[float, str, dict[str, Any]]] = []
    for symbol in sorted(target_homes):
        if symbol not in current_calls:
            continue
        target_call_count = len(target_calls.get(symbol, []))
        current_call_count = len(current_calls.get(symbol, []))
        if target_call_count != current_call_count:
            continue
        target_home_items = target_homes.get(symbol, [])
        current_home_items = current_homes.get(symbol, [])
        target_offsets = [item.offset for item in target_home_items]
        current_offsets = [item.offset for item in current_home_items]
        target_home_call_count = len({item.call_index for item in target_home_items})
        current_home_call_count = len({item.call_index for item in current_home_items})
        if len(set(target_offsets)) < 3:
            continue
        if current_home_call_count < 2:
            continue
        if len(set(current_offsets)) >= len(set(target_offsets)):
            continue
        repeated = sorted(
            offset for offset, count in Counter(current_offsets).items() if count > 1
        )
        if not repeated:
            continue
        confidence = 0.88 if repeated and _alignment(target_offsets) >= 8 else 0.74
        candidates.append((
            confidence,
            symbol,
            _suggestion(
                function=function,
                kind="concurrent-buffer-lifetime",
                confidence=confidence,
                recommendation=(
                    f"test a source reshape where {symbol} command buffers are "
                    "built before consumption so their lifetimes overlap; this "
                    "can prevent MWCC from coalescing mutually exclusive stack homes"
                ),
                evidence={
                    "consumer_symbol": symbol,
                    "target_call_count": target_call_count,
                    "current_call_count": current_call_count,
                    "target_home_bearing_call_count": target_home_call_count,
                    "current_home_bearing_call_count": current_home_call_count,
                    "target_unique_home_count": len(set(target_offsets)),
                    "current_unique_home_count": len(set(current_offsets)),
                    "current_repeated_offsets": repeated,
                    "target_alignment": _alignment(target_offsets),
                    "target_stride_candidates": _stride_candidates(target_offsets),
                    "target_home_lines": [item.line for item in target_homes[symbol]][:6],
                    "current_home_lines": [item.line for item in current_homes[symbol]][:6],
                },
                operator=None,
                follow_up_commands=[
                    f"tools/checkdiff.py {function} --format json",
                    (
                        "after testing a source candidate: melee-agent debug inspect "
                        f"frame-reservations -f {function} --json"
                    ),
                ],
            ),
        ))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][2]
```

Add:

```python
def _alignment(offsets: list[int]) -> int:
    if not offsets:
        return 0
    alignment = 0
    for offset in offsets:
        lowbit = offset & -offset if offset else 0
        if lowbit:
            alignment = lowbit if alignment == 0 else min(alignment, lowbit)
    return alignment


def _stride_candidates(offsets: list[int]) -> list[int]:
    unique = sorted(set(offsets))
    strides = [
        right - left
        for left, right in zip(unique, unique[1:])
        if right > left
    ]
    if not strides:
        return []
    counts = Counter(strides)
    return [stride for stride, _count in counts.most_common(3)]
```

- [ ] **Step 5: Run analyzer tests and verify green**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_control_flow_shape.py -q --no-cov
```

Expected: all tests pass.

## Task 3: CLI Regression Tests

**Files:**
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Add checkdiff fixture helper**

Near `_control_flow_shape_checkdiff_payload`, add:

```python
def _consumer_home_call(symbol: str, offset: int, call_offset: int) -> list[str]:
    return [
        f"/* {call_offset:04X} */ addi r3, r1, 0x{offset:X}",
        f"/* {call_offset + 4:04X} */ bl {symbol}",
        f"/* {call_offset + 4:04X} */ R_PPC_REL24 {symbol}",
    ]


def _control_flow_shape_buffer_lifetime_payload() -> dict:
    payload = _control_flow_shape_checkdiff_payload()
    payload["target_asm"] = (
        _consumer_home_call("fn_803AC168", 0x120, 0)
        + _consumer_home_call("fn_803AC168", 0x148, 0x10)
        + _consumer_home_call("fn_803AC168", 0x170, 0x20)
    )
    payload["current_asm"] = (
        _consumer_home_call("fn_803AC168", 0x110, 0)
        + _consumer_home_call("fn_803AC168", 0x110, 0x10)
        + _consumer_home_call("fn_803AC168", 0x138, 0x20)
    )
    return payload
```

- [ ] **Step 2: Add JSON CLI regression**

Add:

```python
def test_debug_suggest_control_flow_shape_json_reports_buffer_lifetime(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        debug_cli,
        "_read_control_flow_shape_checkdiff_payload",
        lambda **kwargs: (
            _control_flow_shape_buffer_lifetime_payload(),
            "fixture",
        ),
    )

    result = runner.invoke(
        app,
        ["debug", "suggest", "control-flow-shape", "-f", "fn_80000000", "--json"],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    kinds = [item["kind"] for item in payload["suggestions"]]
    assert "concurrent-buffer-lifetime" in kinds
    suggestion = next(
        item for item in payload["suggestions"]
        if item["kind"] == "concurrent-buffer-lifetime"
    )
    assert suggestion["evidence"]["consumer_symbol"] == "fn_803AC168"
    assert all(
        "frame-transform" not in command
        for command in suggestion["follow_up_commands"]
    )
```

- [ ] **Step 3: Add text CLI regression**

Add:

```python
def test_debug_suggest_control_flow_shape_text_reports_buffer_lifetime(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        debug_cli,
        "_read_control_flow_shape_checkdiff_payload",
        lambda **kwargs: (
            _control_flow_shape_buffer_lifetime_payload(),
            "fixture",
        ),
    )

    result = runner.invoke(
        app,
        ["debug", "suggest", "control-flow-shape", "-f", "fn_80000000"],
    )

    assert result.exit_code == 0, result.output
    assert "concurrent-buffer-lifetime" in result.output
    assert "concurrently live" in result.output
    assert "fn_803AC168" in result.output
```

- [ ] **Step 4: Run CLI tests and verify green**

Run:

```bash
python -m pytest \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_json_reports_buffer_lifetime \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_text_reports_buffer_lifetime \
  -q --no-cov
```

Expected: both tests pass.

## Task 4: Verification and Commit

**Files:**
- Modified files from Tasks 1-3.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
python -m pytest \
  tools/melee-agent/tests/test_suggest_control_flow_shape.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_json_uses_checkdiff_without_pcdump \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_text_renders_ranked_hypotheses \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_json_reports_buffer_lifetime \
  tools/melee-agent/tests/test_debug_cli_reorg.py::test_debug_suggest_control_flow_shape_text_reports_buffer_lifetime \
  -q --no-cov
```

Expected: all selected tests pass.

- [ ] **Step 2: Run compile and diff checks**

Run:

```bash
python -m compileall tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py tools/melee-agent/src/cli/debug.py
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 3: Run command-level smoke**

Create a temporary checkdiff fixture and run:

```bash
tmpdir=$(mktemp -d)
cat > "$tmpdir/checkdiff.json" <<'JSON'
{
  "function": "fn_80000000",
  "classification": {
    "primary": "control-flow-source-shape",
    "reasons": ["control-flow/source shape differs"]
  },
  "target_asm": [
    "/* 0000 */ addi r3, r1, 0x120",
    "/* 0004 */ bl fn_803AC168",
    "/* 0004 */ R_PPC_REL24 fn_803AC168",
    "/* 0010 */ addi r3, r1, 0x148",
    "/* 0014 */ bl fn_803AC168",
    "/* 0014 */ R_PPC_REL24 fn_803AC168",
    "/* 0020 */ addi r3, r1, 0x170",
    "/* 0024 */ bl fn_803AC168",
    "/* 0024 */ R_PPC_REL24 fn_803AC168"
  ],
  "current_asm": [
    "/* 0000 */ addi r3, r1, 0x110",
    "/* 0004 */ bl fn_803AC168",
    "/* 0004 */ R_PPC_REL24 fn_803AC168",
    "/* 0010 */ addi r3, r1, 0x110",
    "/* 0014 */ bl fn_803AC168",
    "/* 0014 */ R_PPC_REL24 fn_803AC168",
    "/* 0020 */ addi r3, r1, 0x138",
    "/* 0024 */ bl fn_803AC168",
    "/* 0024 */ R_PPC_REL24 fn_803AC168"
  ]
}
JSON
melee-agent debug suggest control-flow-shape -f fn_80000000 \
  --checkdiff-json "$tmpdir/checkdiff.json" --json
```

Expected: JSON includes `concurrent-buffer-lifetime` and does not include
`frame-transform` in that suggestion's follow-up commands.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add -f \
  tools/melee-agent/src/mwcc_debug/suggest_control_flow_shape.py \
  tools/melee-agent/tests/test_suggest_control_flow_shape.py \
  tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Suggest concurrent buffer lifetime reshapes"
```

Expected: commit succeeds.

- [ ] **Step 5: Resolve verified issues and refresh install**

Run:

```bash
commit=$(git rev-parse --short HEAD)
melee-agent issue resolve 407 --note "addressed in ${commit}: implemented the source-lever reframe before any backend force-frame operator"
python -m pip install -e tools/melee-agent
python - <<'PY'
import inspect
import src.cli
print(inspect.getfile(src.cli))
PY
```

Expected: #407 resolves, install succeeds, import path prints
`/Users/mike/code/melee/tools/melee-agent/src/cli/__init__.py`.

Do not resolve #406 solely from this detector. #412 later corrected the
CardState report: those command-buffer homes were distinct and non-overlapping,
so #406 needed a size/alignment/governance correction rather than an
anti-coalescing source lever.
