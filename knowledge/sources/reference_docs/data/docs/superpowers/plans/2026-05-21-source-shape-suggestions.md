# Source-Shape Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `melee-agent debug suggest inlines` plus the scope-aware source editing infrastructure needed to generate, stage, verify, and rank small inline/helper/source-shape candidates.

**Architecture:** Add a focused source-shape pipeline under `tools/melee-agent/src/mwcc_debug/`: shared dataclasses, tree-sitter source-span discovery, candidate generation/patching, reusable verification, and a CLI orchestrator. Extend existing `mutators.py`, `source_patch.py`, `tier3_search.py`, and `cli/debug.py` only at their existing ownership boundaries.

**Tech Stack:** Python 3.11+, Typer, pytest, tree-sitter/tree-sitter-c, existing mwcc-debug parser/colorgraph/checkdiff/tier3 modules, ninja for integration verification.

**Spec:** `docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md`

---

## Scope Check

The approved spec includes several moving parts, but they serve one deliverable: source-shape candidate discovery and verification. This plan keeps the work in one implementation stream while preserving independently testable slices. Stack-slot provenance, `clean-cruft`, build-time name-magic, relocation extensions, and other backlog items stay out of this plan.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/melee-agent/src/mwcc_debug/source_shape.py` | Create | Shared dataclasses and ranking helpers for source-shape candidates |
| `tools/melee-agent/src/mwcc_debug/source_spans.py` | Create | Tree-sitter statement/block span discovery and lexical read/write facts |
| `tools/melee-agent/src/mwcc_debug/suggest_inlines.py` | Create | Candidate generation, patch generation, reporting, and rendering |
| `tools/melee-agent/src/mwcc_debug/candidate_verify.py` | Create | Stage, smoke-compile, real-tree checkdiff scoring, restoration, and ranking |
| `tools/melee-agent/src/mwcc_debug/mutators.py` | Modify | Scope-aware alias insertion and statement lookup |
| `tools/melee-agent/src/mwcc_debug/source_patch.py` | Modify | Scope-aware declaration block discovery and reorder helpers |
| `tools/melee-agent/src/mwcc_debug/tier3_search.py` | Modify | Seed planning from source-shape compiler-temp anchors |
| `tools/melee-agent/src/cli/debug.py` | Modify | Add `debug suggest inlines`; add scope options for alias and decl-order commands |
| `.claude/skills/mwcc-debug/SKILL.md` | Modify | Document `debug suggest inlines` after CLI lands |
| `tools/melee-agent/tests/test_source_shape.py` | Create | Dataclass/ranking tests |
| `tools/melee-agent/tests/test_source_spans.py` | Create | Span walker, read/write, rejection tests |
| `tools/melee-agent/tests/test_suggest_inlines.py` | Create | Candidate generation, patching, rendering tests |
| `tools/melee-agent/tests/test_candidate_verify.py` | Create | Verification/ranking tests with mocked subprocesses |
| `tools/melee-agent/tests/test_mwcc_debug_mutators.py` | Modify | Scope-aware alias tests |
| `tools/melee-agent/tests/test_mwcc_debug_source_patch.py` | Create | Scope-aware decl-order helper tests |
| `tools/melee-agent/tests/test_mwcc_debug_tier3_search.py` | Modify | Compiler-temp anchor seed tests |
| `tools/melee-agent/tests/test_suggest_inlines_cli.py` | Create | CLI help, validation, and non-applying smoke tests |

---

## Task 1: Source-shape dataclasses and ranking helpers

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/source_shape.py`
- Create: `tools/melee-agent/tests/test_source_shape.py`

- [ ] **Step 1.1: Write failing dataclass and ranking tests**

Create `tools/melee-agent/tests/test_source_shape.py`:

```python
"""Tests for shared source-shape dataclasses."""
from __future__ import annotations

from pathlib import Path

from src.mwcc_debug.source_shape import (
    CandidatePatch,
    CandidateScore,
    InlineCandidate,
    SourceAnchor,
    SourceShapeReport,
    rank_scores,
)


def test_source_anchor_records_scope_and_reason() -> None:
    anchor = SourceAnchor(
        function="fn_test",
        scope_path=("fn_test", "block@l10c4"),
        byte_range=(100, 140),
        line_range=(10, 14),
        kind="repeated",
        reason="two setter blocks share call shape",
        virtuals=(46, 50),
    )
    assert anchor.function == "fn_test"
    assert anchor.scope_path == ("fn_test", "block@l10c4")
    assert anchor.virtuals == (46, 50)


def test_inline_candidate_defaults_to_accepted() -> None:
    anchor = SourceAnchor(
        function="fn_test",
        scope_path=("fn_test",),
        byte_range=(10, 20),
        line_range=(2, 3),
        kind="pattern",
        reason="call argument temp",
    )
    candidate = InlineCandidate(
        candidate_id="arg-temp-0001",
        kind="arg-temp",
        anchor=anchor,
        helper_name="fn_test_arg_temp_0001",
        reads=("jobj",),
        writes=(),
        source_excerpt="HSD_JObjSetMtxDirtySub(jobj);",
    )
    assert candidate.is_rejected is False
    assert candidate.rejection_reason is None


def test_inline_candidate_rejection_flag() -> None:
    anchor = SourceAnchor(
        function="fn_test",
        scope_path=("fn_test",),
        byte_range=(10, 30),
        line_range=(2, 4),
        kind="repeated",
        reason="contains label",
    )
    candidate = InlineCandidate(
        candidate_id="void-helper-0001",
        kind="void-helper",
        anchor=anchor,
        helper_name="fn_test_helper_0001",
        reads=(),
        writes=(),
        source_excerpt="label: x = 1;",
        rejection_reason="span contains label",
    )
    assert candidate.is_rejected is True


def test_rank_scores_prefers_compile_and_positive_delta() -> None:
    scores = [
        CandidateScore(
            candidate_id="bad-compile",
            compile_ok=False,
            checkdiff_pct=None,
            checkdiff_delta=None,
            pcdump_score_delta=None,
            diagnostics_path=Path("/tmp/bad.log"),
            candidate_size=1,
            helper_param_count=0,
        ),
        CandidateScore(
            candidate_id="small-win",
            compile_ok=True,
            checkdiff_pct=95.5,
            checkdiff_delta=0.05,
            pcdump_score_delta=0.0,
            diagnostics_path=None,
            candidate_size=2,
            helper_param_count=1,
        ),
        CandidateScore(
            candidate_id="big-win",
            compile_ok=True,
            checkdiff_pct=95.7,
            checkdiff_delta=0.2,
            pcdump_score_delta=0.0,
            diagnostics_path=None,
            candidate_size=5,
            helper_param_count=2,
        ),
    ]
    ranked = rank_scores(scores)
    assert [s.candidate_id for s in ranked] == [
        "big-win",
        "small-win",
        "bad-compile",
    ]


def test_source_shape_report_partitions_candidates() -> None:
    anchor = SourceAnchor(
        function="fn_test",
        scope_path=("fn_test",),
        byte_range=(1, 2),
        line_range=(1, 1),
        kind="pattern",
        reason="arg temp",
    )
    accepted = InlineCandidate(
        candidate_id="arg-temp-0001",
        kind="arg-temp",
        anchor=anchor,
        helper_name="fn_test_arg_temp_0001",
        reads=("x",),
        writes=(),
        source_excerpt="Call(x);",
    )
    rejected = InlineCandidate(
        candidate_id="void-helper-0002",
        kind="void-helper",
        anchor=anchor,
        helper_name="fn_test_helper_0002",
        reads=(),
        writes=(),
        source_excerpt="goto end;",
        rejection_reason="span contains goto",
    )
    report = SourceShapeReport(
        function="fn_test",
        candidates=[accepted, rejected],
        patches=[
            CandidatePatch(
                candidate_id="arg-temp-0001",
                patched_source="void fn_test(void) { int x; Call(x); }",
                summary="introduce temp",
                touched_ranges=((10, 20),),
            )
        ],
        scores=[],
    )
    assert [c.candidate_id for c in report.accepted_candidates] == ["arg-temp-0001"]
    assert [c.candidate_id for c in report.rejected_candidates] == ["void-helper-0002"]
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_source_shape.py -v --no-cov
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.mwcc_debug.source_shape'`.

- [ ] **Step 1.3: Create `source_shape.py`**

Create `tools/melee-agent/src/mwcc_debug/source_shape.py`:

```python
"""Shared dataclasses for source-shape suggestion tooling."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class SourceAnchor:
    """A source range plus the diagnostic fact that selected it."""

    function: str
    scope_path: tuple[str, ...]
    byte_range: tuple[int, int]
    line_range: tuple[int, int]
    kind: str
    reason: str
    virtuals: tuple[int, ...] = ()


@dataclass(frozen=True)
class InlineCandidate:
    """One possible source-shape rewrite."""

    candidate_id: str
    kind: str
    anchor: SourceAnchor
    helper_name: str
    reads: tuple[str, ...]
    writes: tuple[str, ...]
    source_excerpt: str
    rejection_reason: Optional[str] = None

    @property
    def is_rejected(self) -> bool:
        return self.rejection_reason is not None


@dataclass(frozen=True)
class CandidatePatch:
    """A concrete source rewrite for one accepted candidate."""

    candidate_id: str
    patched_source: str
    summary: str
    touched_ranges: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class CandidateScore:
    """Verification result for one candidate."""

    candidate_id: str
    compile_ok: bool
    checkdiff_pct: Optional[float]
    checkdiff_delta: Optional[float]
    pcdump_score_delta: Optional[float]
    diagnostics_path: Optional[Path]
    candidate_size: int = 0
    helper_param_count: int = 0


@dataclass
class SourceShapeReport:
    """Full report produced by suggest-inlines."""

    function: str
    candidates: list[InlineCandidate] = field(default_factory=list)
    patches: list[CandidatePatch] = field(default_factory=list)
    scores: list[CandidateScore] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)

    @property
    def accepted_candidates(self) -> list[InlineCandidate]:
        return [c for c in self.candidates if not c.is_rejected]

    @property
    def rejected_candidates(self) -> list[InlineCandidate]:
        return [c for c in self.candidates if c.is_rejected]


def rank_scores(scores: list[CandidateScore]) -> list[CandidateScore]:
    """Rank verification results. Higher deltas are better."""

    def key(score: CandidateScore) -> tuple:
        check_delta = score.checkdiff_delta
        pcdump_delta = score.pcdump_score_delta
        return (
            0 if score.compile_ok else 1,
            -(check_delta if check_delta is not None else -9999.0),
            -(pcdump_delta if pcdump_delta is not None else -9999.0),
            score.candidate_size,
            score.helper_param_count,
            score.candidate_id,
        )

    return sorted(scores, key=key)
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_source_shape.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/source_shape.py tools/melee-agent/tests/test_source_shape.py
git commit -m "source-shape: add shared candidate dataclasses"
```

---

## Task 2: Tree-sitter source span discovery

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/source_spans.py`
- Create: `tools/melee-agent/tests/test_source_spans.py`

- [ ] **Step 2.1: Write failing span discovery tests**

Create `tools/melee-agent/tests/test_source_spans.py`:

```python
"""Tests for tree-sitter source span discovery."""
from __future__ import annotations

import textwrap

from src.mwcc_debug.source_spans import (
    find_call_argument_spans,
    find_repeated_call_groups,
    list_statement_spans,
    reject_reason_for_span_group,
)


def test_list_statement_spans_tracks_nested_scope() -> None:
    src = textwrap.dedent("""\
        void f(int cond, HSD_JObj* jobj)
        {
            int top;
            if (cond) {
                int nested;
                HSD_JObjSetMtxDirtySub(jobj);
            }
        }
    """)
    spans = list_statement_spans(src, "f")
    call_span = next(s for s in spans if "HSD_JObjSetMtxDirtySub" in s.text)
    assert call_span.scope_path[0] == "f"
    assert len(call_span.scope_path) == 2
    assert call_span.kind == "expression_statement"
    assert call_span.line_range[0] > 0


def test_list_statement_spans_records_reads_and_writes() -> None:
    src = textwrap.dedent("""\
        void f(void)
        {
            int x;
            int y;
            x = y + 1;
            Use(x);
        }
    """)
    spans = list_statement_spans(src, "f")
    assign = next(s for s in spans if "x = y + 1" in s.text)
    assert "x" in assign.writes
    assert "y" in assign.reads
    call = next(s for s in spans if "Use(x)" in s.text)
    assert call.reads == ("Use", "x")
    assert call.writes == ()


def test_find_repeated_call_groups_matches_same_call_shape() -> None:
    src = textwrap.dedent("""\
        void f(HSD_JObj* a, HSD_JObj* b)
        {
            HSD_JObjSetTranslateX(a, 1.0f);
            HSD_JObjSetMtxDirtySub(a);
            HSD_JObjSetTranslateX(b, 2.0f);
            HSD_JObjSetMtxDirtySub(b);
        }
    """)
    groups = find_repeated_call_groups(src, "f", max_span_statements=2)
    excerpts = ["\\n".join(span.text for span in group.spans) for group in groups]
    assert any("HSD_JObjSetTranslateX" in e and "HSD_JObjSetMtxDirtySub" in e for e in excerpts)


def test_reject_reason_for_goto() -> None:
    src = textwrap.dedent("""\
        void f(int x)
        {
            if (x) {
                goto done;
            }
        done:
            return;
        }
    """)
    spans = list_statement_spans(src, "f")
    goto_span = next(s for s in spans if "goto done" in s.text)
    assert reject_reason_for_span_group([goto_span]) == "span contains goto"


def test_find_call_argument_spans_returns_each_argument() -> None:
    src = textwrap.dedent("""\
        void f(HSD_JObj* jobj, HSD_JObj* cursor_jobj)
        {
            HSD_JObjSetMtxDirtySub(cursor_jobj);
            HSD_JObjSetTranslateX(jobj, HSD_JObjGetTranslationX(cursor_jobj));
        }
    """)
    args = find_call_argument_spans(src, "f", "HSD_JObjSetTranslateX")
    texts = [arg.text for arg in args]
    assert "jobj" in texts
    assert "HSD_JObjGetTranslationX(cursor_jobj)" in texts
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_source_spans.py -v --no-cov
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.mwcc_debug.source_spans'`.

- [ ] **Step 2.3: Create source span dataclasses and public functions**

Create `tools/melee-agent/src/mwcc_debug/source_spans.py` with this initial implementation:

```python
"""Tree-sitter source-span helpers for source-shape suggestions."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import ast_walker


@dataclass(frozen=True)
class StatementSpan:
    text: str
    byte_range: tuple[int, int]
    line_range: tuple[int, int]
    scope_path: tuple[str, ...]
    scope_byte_range: tuple[int, int]
    kind: str
    reads: tuple[str, ...]
    writes: tuple[str, ...]


@dataclass(frozen=True)
class SpanGroup:
    spans: tuple[StatementSpan, ...]
    reason: str

    @property
    def byte_range(self) -> tuple[int, int]:
        return (self.spans[0].byte_range[0], self.spans[-1].byte_range[1])

    @property
    def line_range(self) -> tuple[int, int]:
        return (self.spans[0].line_range[0], self.spans[-1].line_range[1])

    @property
    def scope_path(self) -> tuple[str, ...]:
        return self.spans[0].scope_path


@dataclass(frozen=True)
class CallArgumentSpan:
    function_name: str
    call_name: str
    text: str
    byte_range: tuple[int, int]
    line_range: tuple[int, int]
    scope_path: tuple[str, ...]
    statement: StatementSpan


def _node_text(source_bytes: bytes, node) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _line_col(source_bytes: bytes, offset: int) -> tuple[int, int]:
    line = 1
    col = 0
    for b in source_bytes[:offset]:
        if b == 0x0A:
            line += 1
            col = 0
        else:
            col += 1
    return line, col


def _find_function_node(source: str, fn_name: str):
    ast_walker._check_ts()
    tree = ast_walker._parse_cached(source, path=None)
    source_bytes = source.encode("utf-8")
    return ast_walker._find_function_definition(tree.root_node, source_bytes, fn_name)


def _direct_statement_nodes(body_node) -> list:
    out = []
    stack: list[tuple[object, tuple[str, ...], tuple[int, int]]] = []
    stack.append((body_node, (), (body_node.start_byte, body_node.end_byte)))
    while stack:
        node, _scope, _scope_range = stack.pop()
        for child in reversed(node.children):
            if child.type == "compound_statement":
                stack.append((child, (), (child.start_byte, child.end_byte)))
                continue
            if child.type in {
                "declaration",
                "expression_statement",
                "return_statement",
                "goto_statement",
                "labeled_statement",
                "case_statement",
                "break_statement",
                "continue_statement",
            }:
                out.append(child)
            for grand in reversed(child.children):
                if grand.type == "compound_statement":
                    stack.append((grand, (), (grand.start_byte, grand.end_byte)))
    return sorted(out, key=lambda n: n.start_byte)


def _scope_for_node(source: str, fn_name: str, node) -> tuple[tuple[str, ...], tuple[int, int]]:
    decls = ast_walker.walk_function(source, fn_name, path=None)
    best_path = (fn_name,)
    best_range = (0, len(source.encode("utf-8")))
    for decl in decls:
        start, end = decl.scope_byte_range
        if start <= node.start_byte <= node.end_byte <= end:
            if len(decl.scope_path) >= len(best_path):
                best_path = decl.scope_path
                best_range = decl.scope_byte_range
    return best_path, best_range


def _identifier_names(node, source_bytes: bytes) -> list[str]:
    names: list[str] = []
    stack = [node]
    while stack:
        cur = stack.pop()
        if cur.type == "identifier":
            names.append(_node_text(source_bytes, cur))
        for child in cur.children:
            stack.append(child)
    return list(dict.fromkeys(names))


def _read_write_sets(node, source_bytes: bytes) -> tuple[tuple[str, ...], tuple[str, ...]]:
    names = _identifier_names(node, source_bytes)
    text = _node_text(source_bytes, node)
    writes: list[str] = []
    if node.type == "expression_statement" and "=" in text and "==" not in text:
        lhs = text.split("=", 1)[0]
        lhs_names = [name for name in names if name in lhs]
        if lhs_names:
            writes.append(lhs_names[0])
    reads = [name for name in names if name not in writes]
    return tuple(reads), tuple(writes)


def list_statement_spans(source: str, fn_name: str) -> list[StatementSpan]:
    fn_node = _find_function_node(source, fn_name)
    if fn_node is None:
        return []
    body = fn_node.child_by_field_name("body")
    if body is None:
        return []
    source_bytes = source.encode("utf-8")
    spans: list[StatementSpan] = []
    for node in _direct_statement_nodes(body):
        line_start, _ = _line_col(source_bytes, node.start_byte)
        line_end, _ = _line_col(source_bytes, node.end_byte)
        scope_path, scope_range = _scope_for_node(source, fn_name, node)
        reads, writes = _read_write_sets(node, source_bytes)
        spans.append(StatementSpan(
            text=_node_text(source_bytes, node).strip(),
            byte_range=(node.start_byte, node.end_byte),
            line_range=(line_start, line_end),
            scope_path=scope_path,
            scope_byte_range=scope_range,
            kind=node.type,
            reads=reads,
            writes=writes,
        ))
    return spans


def reject_reason_for_span_group(spans: list[StatementSpan]) -> Optional[str]:
    if not spans:
        return "span is empty"
    first_scope = spans[0].scope_path
    if any(span.scope_path != first_scope for span in spans):
        return "span crosses scope boundaries"
    text = "\n".join(span.text for span in spans)
    if "goto " in text:
        return "span contains goto"
    if any(span.kind in {"labeled_statement", "case_statement"} for span in spans):
        return "span contains label or case"
    return None


def _call_names(span: StatementSpan) -> tuple[str, ...]:
    names: list[str] = []
    text = span.text
    for name in span.reads:
        if f"{name}(" in text:
            names.append(name)
    return tuple(names)


def find_repeated_call_groups(
    source: str,
    fn_name: str,
    max_span_statements: int = 6,
) -> list[SpanGroup]:
    spans = list_statement_spans(source, fn_name)
    groups: list[SpanGroup] = []
    seen_shapes: dict[tuple[str, ...], list[StatementSpan]] = {}
    for width in range(1, max_span_statements + 1):
        for idx in range(0, len(spans) - width + 1):
            chunk = spans[idx:idx + width]
            if reject_reason_for_span_group(chunk) is not None:
                continue
            shape = tuple(name for span in chunk for name in _call_names(span))
            if not shape:
                continue
            if shape in seen_shapes:
                prior = seen_shapes[shape]
                groups.append(SpanGroup(
                    spans=tuple(prior),
                    reason=f"repeated call shape: {', '.join(shape)}",
                ))
                groups.append(SpanGroup(
                    spans=tuple(chunk),
                    reason=f"repeated call shape: {', '.join(shape)}",
                ))
            else:
                seen_shapes[shape] = chunk
    unique: dict[tuple[int, int], SpanGroup] = {}
    for group in groups:
        unique[group.byte_range] = group
    return list(unique.values())


def find_call_argument_spans(
    source: str,
    fn_name: str,
    call_name: str,
) -> list[CallArgumentSpan]:
    fn_node = _find_function_node(source, fn_name)
    if fn_node is None:
        return []
    source_bytes = source.encode("utf-8")
    statements = list_statement_spans(source, fn_name)
    out: list[CallArgumentSpan] = []
    stack = [fn_node]
    while stack:
        node = stack.pop()
        if node.type == "call_expression":
            fn_child = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")
            if fn_child is not None and args is not None:
                if _node_text(source_bytes, fn_child) == call_name:
                    statement = next(
                        (s for s in statements if s.byte_range[0] <= node.start_byte <= node.end_byte <= s.byte_range[1]),
                        None,
                    )
                    if statement is not None:
                        for child in args.children:
                            if child.type in {"(", ")", ","}:
                                continue
                            line_start, _ = _line_col(source_bytes, child.start_byte)
                            line_end, _ = _line_col(source_bytes, child.end_byte)
                            out.append(CallArgumentSpan(
                                function_name=fn_name,
                                call_name=call_name,
                                text=_node_text(source_bytes, child).strip(),
                                byte_range=(child.start_byte, child.end_byte),
                                line_range=(line_start, line_end),
                                scope_path=statement.scope_path,
                                statement=statement,
                            ))
        for child in node.children:
            stack.append(child)
    return sorted(out, key=lambda a: a.byte_range)
```

- [ ] **Step 2.4: Run span tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_source_spans.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/source_spans.py tools/melee-agent/tests/test_source_spans.py
git commit -m "source-shape: add source span discovery"
```

---

## Task 3: Scope-aware alias insertion

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/mutators.py`
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_mutators.py`

- [ ] **Step 3.1: Add failing nested-block alias tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_mutators.py`:

```python
def test_mutate_insert_alias_places_decl_in_nearest_nested_block() -> None:
    source = textwrap.dedent("""\
        void f(int cond, HSD_JObj* cursor_jobj)
        {
            int top;
            if (cond) {
                int nested;
                HSD_JObjSetMtxDirtySub(cursor_jobj);
            }
        }
    """)
    result = mutate_insert_alias_before_use(
        source, "f", "cursor_jobj", at_stmt_index=0,
    )
    lines = result.splitlines()
    outer_decl_idx = next(i for i, line in enumerate(lines) if "int top;" in line)
    if_idx = next(i for i, line in enumerate(lines) if "if (cond)" in line)
    alias_decl_idx = next(i for i, line in enumerate(lines) if "cursor_jobj_alias;" in line)
    nested_decl_idx = next(i for i, line in enumerate(lines) if "int nested;" in line)
    call_idx = next(i for i, line in enumerate(lines) if "HSD_JObjSetMtxDirtySub" in line)
    assert outer_decl_idx < if_idx < alias_decl_idx < nested_decl_idx < call_idx
    assert "HSD_JObjSetMtxDirtySub(cursor_jobj_alias);" in result


def test_mutate_insert_alias_scope_filter_disambiguates_shadowed_name() -> None:
    source = textwrap.dedent("""\
        void f(int cond)
        {
            HSD_JObj* jobj;
            UseTop(jobj);
            if (cond) {
                HSD_JObj* jobj;
                UseNested(jobj);
            }
        }
    """)
    result = mutate_insert_alias_before_use(
        source,
        "f",
        "jobj",
        at_stmt_index=0,
        new_name="inner_alias",
        scope_filter_prefix=("f", "block@"),
    )
    assert "UseTop(jobj);" in result
    assert "UseNested(inner_alias);" in result
```

- [ ] **Step 3.2: Run mutator tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_mutators.py -k "nested_block or scope_filter" -v --no-cov
```

Expected: FAIL because `scope_filter_prefix` is not accepted and nested insertion still uses function top.

- [ ] **Step 3.3: Extend mutator signature and select statement spans**

In `tools/melee-agent/src/mwcc_debug/mutators.py`, add imports:

```python
from .source_spans import StatementSpan, list_statement_spans
from .scope_path import is_nested_within
```

Change the signature:

```python
def mutate_insert_alias_before_use(
    source: str,
    fn_name: str,
    var_name: str,
    at_stmt_index: int,
    new_name: Optional[str] = None,
    scope_filter: Optional[tuple[str, ...]] = None,
    scope_filter_prefix: Optional[tuple[str, ...]] = None,
) -> str:
```

Add this helper near `_statement_is_reading_use`:

```python
def _span_matches_scope(
    span: StatementSpan,
    scope_filter: Optional[tuple[str, ...]],
    scope_filter_prefix: Optional[tuple[str, ...]],
) -> bool:
    if scope_filter is not None:
        return span.scope_path == scope_filter
    if scope_filter_prefix is not None:
        if len(scope_filter_prefix) == 2 and scope_filter_prefix[1] == "block@":
            return len(span.scope_path) > 1
        return is_nested_within(span.scope_path, scope_filter_prefix)
    return True
```

Inside `mutate_insert_alias_before_use`, replace the current `statements` / `reading_stmts` selection with:

```python
    span_statements = list_statement_spans(source, fn_name)
    target_span_candidates = [
        span for span in span_statements
        if _span_matches_scope(span, scope_filter, scope_filter_prefix)
        and _statement_is_reading_use(span.text, var_name)
    ]
    if at_stmt_index >= len(target_span_candidates):
        raise MutationUnsupported(
            f"at_stmt_index={at_stmt_index} out of range "
            f"(only {len(target_span_candidates)} reading statements)"
        )
    target_span = target_span_candidates[at_stmt_index]
```

Keep the old tokenizer statement list for C89 first-write detection:

```python
    statements = _split_function_body_into_statements(body_text)
```

- [ ] **Step 3.4: Insert alias declaration in the selected block**

In `mutate_insert_alias_before_use`, compute source-relative positions from `target_span`:

```python
    target_start_abs, target_end_abs = target_span.byte_range
    target_text = source[target_start_abs:target_end_abs]
    word_re = re.compile(r"\b" + re.escape(var_name) + r"\b")
    rewritten = word_re.sub(new_name, target_text)
```

Add this helper below `_stmt_is_declaration`:

```python
def _find_block_decl_insert_pos(source: str, scope_byte_range: tuple[int, int]) -> int:
    start, end = scope_byte_range
    open_brace = source.find("{", start, end)
    if open_brace < 0:
        return start
    pos = open_brace + 1
    while pos < end and source[pos] in " \t\r\n":
        pos += 1
    lines = source[pos:end].splitlines(keepends=True)
    cursor = pos
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("/*"):
            cursor += len(line)
            continue
        if _stmt_is_declaration(line):
            cursor += len(line)
            continue
        break
    return cursor
```

Replace function-top bare declaration placement with:

```python
    decl_insert_abs = _find_block_decl_insert_pos(source, target_span.scope_byte_range)
    target_line_start_abs = source.rfind("\n", 0, target_start_abs) + 1
    indent = source[target_line_start_abs:target_start_abs]
    decl_indent = indent
    decl_line = f"{decl_indent}{var_type} {new_name};\n"
    assign_line = f"{indent}{new_name} = {var_name};\n"
```

Build source edits in descending position order so offsets remain valid:

```python
    edits: list[tuple[int, int, str]] = []
    edits.append((target_start_abs, target_end_abs, rewritten))
    edits.append((target_line_start_abs, target_line_start_abs, assign_line))
    edits.append((decl_insert_abs, decl_insert_abs, decl_line))
    out = source
    for start, end, replacement in sorted(edits, key=lambda e: e[0], reverse=True):
        out = out[:start] + replacement + out[end:]
    return out
```

Use the existing first-write logic to move `assign_line` after the first plain write when such a write exists before the target. If no plain write exists, keep it immediately before the selected use.

- [ ] **Step 3.5: Add CLI `--scope` passthrough**

In the `mutate_insert_alias_cmd` signature in `tools/melee-agent/src/cli/debug.py`, add:

```python
    scope: Annotated[
        Optional[str],
        typer.Option(
            "--scope",
            help="Optional exact scope_path display string, e.g. "
                 "fn/block@l10c4. Use var-to-virtual --all to inspect.",
        ),
    ] = None,
```

Before calling the mutator:

```python
    parsed_scope = tuple(scope.split("/")) if scope else None
```

Pass it:

```python
        out = mutate_insert_alias_before_use(
            source,
            function,
            var,
            at_stmt_index=at,
            new_name=new_name,
            scope_filter=parsed_scope,
        )
```

- [ ] **Step 3.6: Run mutator tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_mutators.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 3.7: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/mutators.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_mwcc_debug_mutators.py
git commit -m "source-shape: make alias insertion scope-aware"
```

---

## Task 4: Scope-aware declaration ordering

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/source_patch.py`
- Modify: `tools/melee-agent/src/cli/debug.py`
- Create: `tools/melee-agent/tests/test_mwcc_debug_source_patch.py`

- [ ] **Step 4.1: Write failing source-patch tests**

Create `tools/melee-agent/tests/test_mwcc_debug_source_patch.py`:

```python
"""Tests for source_patch declaration-order helpers."""
from __future__ import annotations

import textwrap

from src.mwcc_debug.source_patch import (
    get_decl_names_by_scope,
    reorder_decls_in_function_scope,
)


def test_get_decl_names_by_scope_includes_nested_block() -> None:
    source = textwrap.dedent("""\
        void f(int cond)
        {
            int top_a;
            int top_b;
            if (cond) {
                HSD_JObj* row_0_jobj;
                HSD_JObj* cursor_row;
                Use(row_0_jobj, cursor_row);
            }
        }
    """)
    scopes = get_decl_names_by_scope(source, "f")
    assert ("f",) in scopes
    nested_scope = next(scope for scope in scopes if len(scope) == 2)
    assert scopes[("f",)] == ["top_a", "top_b"]
    assert scopes[nested_scope] == ["row_0_jobj", "cursor_row"]


def test_reorder_decls_in_function_scope_only_changes_target_scope() -> None:
    source = textwrap.dedent("""\
        void f(int cond)
        {
            int top_a;
            int top_b;
            if (cond) {
                HSD_JObj* row_0_jobj;
                HSD_JObj* cursor_row;
                Use(row_0_jobj, cursor_row);
            }
        }
    """)
    scopes = get_decl_names_by_scope(source, "f")
    nested_scope = next(scope for scope in scopes if len(scope) == 2)
    result = reorder_decls_in_function_scope(source, "f", nested_scope, [1, 0])
    assert result is not None
    assert result.index("int top_a;") < result.index("int top_b;")
    assert result.index("HSD_JObj* cursor_row;") < result.index("HSD_JObj* row_0_jobj;")
```

- [ ] **Step 4.2: Run source-patch tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_source_patch.py -v --no-cov
```

Expected: FAIL because `get_decl_names_by_scope` and `reorder_decls_in_function_scope` do not exist.

- [ ] **Step 4.3: Add scope-aware helper functions**

Append these functions to `tools/melee-agent/src/mwcc_debug/source_patch.py` after `get_decl_names`:

```python
def _line_bounds_for_range(file_text: str, byte_range: tuple[int, int]) -> tuple[int, int]:
    start, end = byte_range
    line_start = file_text.rfind("\n", 0, start) + 1
    line_end = file_text.find("\n", end)
    if line_end < 0:
        line_end = len(file_text)
    else:
        line_end += 1
    return line_start, line_end


def _decl_line_ranges_for_scope(
    file_text: str,
    function: str,
    scope_path: tuple[str, ...],
) -> list[tuple[str, int, int]]:
    from .ast_walker import walk_function

    decls = [
        decl for decl in walk_function(file_text, function, path=None)
        if decl.scope_path == scope_path
    ]
    out: list[tuple[str, int, int]] = []
    for decl in decls:
        start, end = _line_bounds_for_range(file_text, decl.byte_range)
        line = file_text[start:end]
        out.append((decl.name, start, end))
    return out


def get_decl_names_by_scope(
    file_text: str,
    function: str,
) -> dict[tuple[str, ...], list[str]]:
    from .ast_walker import walk_function

    out: dict[tuple[str, ...], list[str]] = {}
    for decl in walk_function(file_text, function, path=None):
        out.setdefault(decl.scope_path, []).append(decl.name)
    return out


def reorder_decls_in_function_scope(
    file_text: str,
    function: str,
    scope_path: tuple[str, ...],
    order: list[int],
) -> Optional[str]:
    decl_ranges = _decl_line_ranges_for_scope(file_text, function, scope_path)
    if not decl_ranges:
        return None
    if len(order) != len(decl_ranges):
        return None
    if sorted(order) != list(range(len(decl_ranges))):
        return None
    line_ranges = [(start, end) for _name, start, end in decl_ranges]
    block_start = line_ranges[0][0]
    block_end = line_ranges[-1][1]
    original_lines = [file_text[start:end] for start, end in line_ranges]
    reordered = "".join(original_lines[i] for i in order)
    return file_text[:block_start] + reordered + file_text[block_end:]
```

- [ ] **Step 4.4: Extend `debug mutate decl-orders` to support `--scope`**

In `tools/melee-agent/src/cli/debug.py`, add imports:

```python
from ..mwcc_debug.source_patch import (
    get_decl_names,
    get_decl_names_by_scope,
    reorder_decls_in_function,
    reorder_decls_in_function_scope,
    transfer_candidate,
)
```

Add to the `debug mutate decl-orders` parameters:

```python
    scope: Annotated[
        Optional[str],
        typer.Option(
            "--scope",
            help="Optional scope_path display string. When omitted, "
                 "enumerates the function-top scope first.",
        ),
    ] = None,
```

Replace the current name lookup:

```python
    scope_map = get_decl_names_by_scope(orig, function)
    selected_scope = tuple(scope.split("/")) if scope else (function,)
    names = scope_map.get(selected_scope)
    if not names:
        typer.echo(
            f"could not find a declaration block in {function} scope "
            f"{'/'.join(selected_scope)}.",
            err=True,
        )
        raise typer.Exit(3)
```

Replace candidate patching inside `run_one_round`:

```python
            if selected_scope == (function,):
                patched = reorder_decls_in_function(current_text, function, perm)
            else:
                patched = reorder_decls_in_function_scope(
                    current_text, function, selected_scope, perm,
                )
```

In the iterate re-apply section use the same branch.

- [ ] **Step 4.5: Run tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_source_patch.py -v --no-cov
python -m pytest tools/melee-agent/tests/test_cli.py -v --no-cov
```

Expected: PASS. If `test_cli.py` is broad and slow in this checkout, run the narrower command-specific tests it reports as impacted by `debug.py`.

- [ ] **Step 4.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/source_patch.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_mwcc_debug_source_patch.py
git commit -m "source-shape: enumerate decl orders by scope"
```

---

## Task 5: Candidate generation and patching

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`
- Create: `tools/melee-agent/tests/test_suggest_inlines.py`

- [ ] **Step 5.1: Write failing candidate generation tests**

Create `tools/melee-agent/tests/test_suggest_inlines.py`:

```python
"""Tests for suggest-inlines candidate generation and rendering."""
from __future__ import annotations

import json
import textwrap

from src.mwcc_debug.suggest_inlines import (
    generate_candidates,
    generate_patches,
    render_json,
    render_text,
    run,
)


def test_generate_candidates_from_repeated_call_groups() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* a, HSD_JObj* b)
        {
            HSD_JObjSetTranslateX(a, 1.0f);
            HSD_JObjSetMtxDirtySub(a);
            HSD_JObjSetTranslateX(b, 2.0f);
            HSD_JObjSetMtxDirtySub(b);
        }
    """)
    candidates = generate_candidates(
        source=source,
        function="f",
        seed_source="repeated",
        max_span_statements=2,
        budget=8,
    )
    assert candidates
    assert any(c.kind == "void-helper" for c in candidates)
    assert all(c.anchor.kind == "repeated" for c in candidates)


def test_generate_arg_temp_candidate_for_named_call() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* cursor_jobj)
        {
            HSD_JObjSetMtxDirtySub(cursor_jobj);
        }
    """)
    candidates = generate_candidates(
        source=source,
        function="f",
        seed_source="patterns",
        max_span_statements=2,
        budget=8,
    )
    assert any(c.kind == "arg-temp" and "cursor_jobj" in c.reads for c in candidates)


def test_generate_patches_for_arg_temp_candidate() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* cursor_jobj)
        {
            HSD_JObjSetMtxDirtySub(cursor_jobj);
        }
    """)
    candidates = generate_candidates(
        source=source,
        function="f",
        seed_source="patterns",
        max_span_statements=2,
        budget=8,
    )
    arg_temp = next(c for c in candidates if c.kind == "arg-temp")
    patches = generate_patches(source, "f", [arg_temp])
    assert len(patches) == 1
    patch = patches[0]
    assert "cursor_jobj_arg_temp" in patch.patched_source
    assert "HSD_JObjSetMtxDirtySub(cursor_jobj_arg_temp);" in patch.patched_source


def test_run_diagnostic_report_does_not_require_pcdump() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* cursor_jobj)
        {
            HSD_JObjSetMtxDirtySub(cursor_jobj);
        }
    """)
    report = run(
        source=source,
        function="f",
        pcdump_text="",
        seed_source="patterns",
        budget=8,
        max_span_statements=2,
        verify=False,
    )
    assert report.function == "f"
    assert report.candidates
    assert report.scores == []


def test_render_text_mentions_rejections_and_candidates() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* cursor_jobj)
        {
            HSD_JObjSetMtxDirtySub(cursor_jobj);
        }
    """)
    report = run(
        source=source,
        function="f",
        pcdump_text="",
        seed_source="patterns",
        budget=8,
        max_span_statements=2,
        verify=False,
    )
    out = render_text(report)
    assert "suggest-inlines" in out
    assert "f" in out
    assert "arg-temp" in out


def test_render_json_is_parseable() -> None:
    source = "void f(HSD_JObj* cursor_jobj) { HSD_JObjSetMtxDirtySub(cursor_jobj); }"
    report = run(
        source=source,
        function="f",
        pcdump_text="",
        seed_source="patterns",
        budget=8,
        max_span_statements=2,
        verify=False,
    )
    payload = json.loads(render_json(report))
    assert payload["function"] == "f"
    assert payload["candidates"]
```

- [ ] **Step 5.2: Run tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines.py -v --no-cov
```

Expected: FAIL because `suggest_inlines.py` does not exist.

- [ ] **Step 5.3: Implement candidate generation and patching**

Create `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`:

```python
"""Candidate generation and rendering for `debug suggest inlines`."""
from __future__ import annotations

import json
from dataclasses import asdict
from typing import Optional

from .source_shape import (
    CandidatePatch,
    InlineCandidate,
    SourceAnchor,
    SourceShapeReport,
    rank_scores,
)
from .source_spans import (
    CallArgumentSpan,
    SpanGroup,
    find_call_argument_spans,
    find_repeated_call_groups,
    reject_reason_for_span_group,
)


def _candidate_id(kind: str, idx: int) -> str:
    return f"{kind}-{idx:04d}"


def _helper_name(function: str, kind: str, idx: int) -> str:
    safe_kind = kind.replace("-", "_")
    return f"{function}_{safe_kind}_{idx:04d}"


def _anchor_from_group(function: str, group: SpanGroup) -> SourceAnchor:
    return SourceAnchor(
        function=function,
        scope_path=group.scope_path,
        byte_range=group.byte_range,
        line_range=group.line_range,
        kind="repeated",
        reason=group.reason,
    )


def _candidate_from_group(function: str, idx: int, group: SpanGroup) -> InlineCandidate:
    rejection = reject_reason_for_span_group(list(group.spans))
    reads = tuple(dict.fromkeys(name for span in group.spans for name in span.reads))
    writes = tuple(dict.fromkeys(name for span in group.spans for name in span.writes))
    return InlineCandidate(
        candidate_id=_candidate_id("void-helper", idx),
        kind="void-helper",
        anchor=_anchor_from_group(function, group),
        helper_name=_helper_name(function, "void_helper", idx),
        reads=reads,
        writes=writes,
        source_excerpt="\n".join(span.text for span in group.spans),
        rejection_reason=rejection,
    )


def _candidate_from_arg(function: str, idx: int, arg: CallArgumentSpan) -> InlineCandidate:
    anchor = SourceAnchor(
        function=function,
        scope_path=arg.scope_path,
        byte_range=arg.byte_range,
        line_range=arg.line_range,
        kind="pattern",
        reason=f"short-lived argument temp for {arg.call_name}",
    )
    return InlineCandidate(
        candidate_id=_candidate_id("arg-temp", idx),
        kind="arg-temp",
        anchor=anchor,
        helper_name=_helper_name(function, "arg_temp", idx),
        reads=(arg.text,),
        writes=(),
        source_excerpt=arg.statement.text,
    )


def generate_candidates(
    *,
    source: str,
    function: str,
    seed_source: str = "all",
    max_span_statements: int = 6,
    budget: int = 8,
) -> list[InlineCandidate]:
    candidates: list[InlineCandidate] = []
    idx = 1
    if seed_source in {"all", "repeated"}:
        for group in find_repeated_call_groups(
            source, function, max_span_statements=max_span_statements,
        ):
            candidates.append(_candidate_from_group(function, idx, group))
            idx += 1
    if seed_source in {"all", "patterns"}:
        for arg in find_call_argument_spans(source, function, "HSD_JObjSetMtxDirtySub"):
            if not arg.text:
                continue
            candidates.append(_candidate_from_arg(function, idx, arg))
            idx += 1
    return candidates[:budget]


def _patch_arg_temp(source: str, candidate: InlineCandidate) -> CandidatePatch:
    arg_text = candidate.reads[0]
    temp_name = f"{arg_text}_arg_temp"
    call_start, call_end = candidate.anchor.byte_range
    statement_start = source.rfind("\n", 0, call_start) + 1
    indent = source[statement_start:call_start]
    decl = f"{indent}void* {temp_name};\n"
    assign = f"{indent}{temp_name} = {arg_text};\n"
    patched_arg = temp_name
    out = source[:call_start] + patched_arg + source[call_end:]
    out = out[:statement_start] + decl + assign + out[statement_start:]
    return CandidatePatch(
        candidate_id=candidate.candidate_id,
        patched_source=out,
        summary=f"introduce short-lived temp {temp_name}",
        touched_ranges=(candidate.anchor.byte_range,),
    )


def _patch_void_helper(source: str, function: str, candidate: InlineCandidate) -> CandidatePatch:
    helper_lines = [
        f"static inline void {candidate.helper_name}(void)",
        "{",
    ]
    for line in candidate.source_excerpt.splitlines():
        helper_lines.append(f"    {line}")
    helper_lines.append("}")
    helper = "\n".join(helper_lines) + "\n\n"
    insert_pos = source.find(f"void {function}")
    if insert_pos < 0:
        insert_pos = 0
    call = f"{candidate.helper_name}();"
    start, end = candidate.anchor.byte_range
    out = source[:start] + call + source[end:]
    out = out[:insert_pos] + helper + out[insert_pos:]
    return CandidatePatch(
        candidate_id=candidate.candidate_id,
        patched_source=out,
        summary=f"extract {candidate.helper_name}",
        touched_ranges=(candidate.anchor.byte_range,),
    )


def generate_patches(
    source: str,
    function: str,
    candidates: list[InlineCandidate],
) -> list[CandidatePatch]:
    patches: list[CandidatePatch] = []
    for candidate in candidates:
        if candidate.is_rejected:
            continue
        if candidate.kind == "arg-temp":
            patches.append(_patch_arg_temp(source, candidate))
        elif candidate.kind == "void-helper":
            patches.append(_patch_void_helper(source, function, candidate))
    return patches


def run(
    *,
    source: str,
    function: str,
    pcdump_text: str,
    seed_source: str = "all",
    budget: int = 8,
    max_span_statements: int = 6,
    verify: bool = False,
    verifier=None,
) -> SourceShapeReport:
    candidates = generate_candidates(
        source=source,
        function=function,
        seed_source=seed_source,
        max_span_statements=max_span_statements,
        budget=budget,
    )
    patches = generate_patches(source, function, candidates)
    scores = []
    if verify and verifier is not None:
        scores = verifier(patches)
        scores = rank_scores(scores)
    messages = []
    if not candidates:
        messages.append("no source-shape candidates found")
    return SourceShapeReport(
        function=function,
        candidates=candidates,
        patches=patches,
        scores=scores,
        messages=messages,
    )


def render_text(report: SourceShapeReport) -> str:
    lines = [f"suggest-inlines — {report.function}", ""]
    if report.messages:
        for message in report.messages:
            lines.append(message)
        lines.append("")
    lines.append(f"Candidates: {len(report.candidates)}")
    for candidate in report.candidates:
        status = "rejected" if candidate.is_rejected else "accepted"
        lines.append(f"- {candidate.candidate_id} [{candidate.kind}] {status}")
        lines.append(f"  reason: {candidate.anchor.reason}")
        lines.append(f"  scope: {'/'.join(candidate.anchor.scope_path)}")
        lines.append(f"  lines: {candidate.anchor.line_range[0]}-{candidate.anchor.line_range[1]}")
        if candidate.rejection_reason:
            lines.append(f"  rejection: {candidate.rejection_reason}")
        lines.append("  source:")
        for line in candidate.source_excerpt.splitlines():
            lines.append(f"    {line}")
    if report.scores:
        lines.append("")
        lines.append("Scores:")
        for score in report.scores:
            delta = score.checkdiff_delta
            delta_text = "n/a" if delta is None else f"{delta:+.3f}"
            lines.append(f"- {score.candidate_id}: compile={score.compile_ok} delta={delta_text}")
    return "\n".join(lines)


def render_json(report: SourceShapeReport) -> str:
    return json.dumps(asdict(report), indent=2, default=str)
```

- [ ] **Step 5.4: Run tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/suggest_inlines.py tools/melee-agent/tests/test_suggest_inlines.py
git commit -m "source-shape: generate suggest-inlines candidates"
```

---

## Task 6: Return-helper candidate form

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/source_shape.py`
- Modify: `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`
- Modify: `tools/melee-agent/tests/test_suggest_inlines.py`

- [ ] **Step 6.1: Write failing return-helper tests**

Append to `tools/melee-agent/tests/test_suggest_inlines.py`:

```python
def test_generate_return_helper_candidate_for_single_assignment() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* jobj)
        {
            f32 y;
            y = HSD_JObjGetTranslationY(jobj);
            Use(y);
        }
    """)
    candidates = generate_candidates(
        source=source,
        function="f",
        seed_source="patterns",
        max_span_statements=2,
        budget=8,
    )
    candidate = next(c for c in candidates if c.kind == "return-helper")
    assert candidate.writes == ("y",)
    assert candidate.metadata["return_type"] == "f32"
    assert candidate.metadata["rhs"] == "HSD_JObjGetTranslationY(jobj)"


def test_generate_patches_for_return_helper_candidate() -> None:
    source = textwrap.dedent("""\
        void f(HSD_JObj* jobj)
        {
            f32 y;
            y = HSD_JObjGetTranslationY(jobj);
            Use(y);
        }
    """)
    candidates = generate_candidates(
        source=source,
        function="f",
        seed_source="patterns",
        max_span_statements=2,
        budget=8,
    )
    candidate = next(c for c in candidates if c.kind == "return-helper")
    patches = generate_patches(source, "f", [candidate])
    assert len(patches) == 1
    patched = patches[0].patched_source
    assert "static inline f32 f_return_helper_" in patched
    assert "return HSD_JObjGetTranslationY(jobj);" in patched
    assert "y = f_return_helper_" in patched
```

- [ ] **Step 6.2: Run tests to verify failure**

Run:

```bash
python -m pytest \
  tools/melee-agent/tests/test_suggest_inlines.py::test_generate_return_helper_candidate_for_single_assignment \
  tools/melee-agent/tests/test_suggest_inlines.py::test_generate_patches_for_return_helper_candidate \
  -v --no-cov
```

Expected: FAIL because `InlineCandidate` has no `metadata` field and `return-helper` candidates are not generated.

- [ ] **Step 6.3: Add candidate metadata field**

In `tools/melee-agent/src/mwcc_debug/source_shape.py`, add a default-valued field to `InlineCandidate`:

```python
@dataclass(frozen=True)
class InlineCandidate:
    """One possible source-shape rewrite."""

    candidate_id: str
    kind: str
    anchor: SourceAnchor
    helper_name: str
    reads: tuple[str, ...]
    writes: tuple[str, ...]
    source_excerpt: str
    rejection_reason: Optional[str] = None
    metadata: dict[str, str] = field(default_factory=dict)
```

- [ ] **Step 6.4: Generate return-helper candidates**

In `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`, add imports:

```python
import re

from .ast_walker import walk_function
from .source_spans import list_statement_spans
```

Add these helpers near `_candidate_from_arg`:

```python
def _local_type_map(source: str, function: str) -> dict[str, str]:
    return {decl.name: decl.type_str for decl in walk_function(source, function, path=None)}


def _return_helper_candidates(
    source: str,
    function: str,
    start_idx: int,
) -> list[InlineCandidate]:
    local_types = _local_type_map(source, function)
    out: list[InlineCandidate] = []
    idx = start_idx
    assign_re = re.compile(
        r"^\s*(?P<lhs>[A-Za-z_][A-Za-z_0-9]*)\s*=\s*(?P<rhs>.+);\s*$",
        re.DOTALL,
    )
    for span in list_statement_spans(source, function):
        m = assign_re.match(span.text)
        if m is None:
            continue
        lhs = m.group("lhs")
        rhs = m.group("rhs").strip()
        if lhs not in local_types:
            continue
        if "(" not in rhs or ")" not in rhs:
            continue
        reads = tuple(name for name in span.reads if name != lhs)
        anchor = SourceAnchor(
            function=function,
            scope_path=span.scope_path,
            byte_range=span.byte_range,
            line_range=span.line_range,
            kind="pattern",
            reason=f"single-output helper for {lhs}",
        )
        out.append(InlineCandidate(
            candidate_id=_candidate_id("return-helper", idx),
            kind="return-helper",
            anchor=anchor,
            helper_name=_helper_name(function, "return_helper", idx),
            reads=reads,
            writes=(lhs,),
            source_excerpt=span.text,
            metadata={
                "return_type": local_types[lhs],
                "rhs": rhs,
                "lhs": lhs,
            },
        ))
        idx += 1
    return out
```

In `generate_candidates`, after arg-temp candidates are added, append return-helper candidates:

```python
    if seed_source in {"all", "patterns"}:
        for candidate in _return_helper_candidates(source, function, idx):
            candidates.append(candidate)
            idx += 1
```

- [ ] **Step 6.5: Patch return-helper candidates**

Add this helper near `_patch_void_helper`:

```python
def _patch_return_helper(source: str, function: str, candidate: InlineCandidate) -> CandidatePatch:
    return_type = candidate.metadata["return_type"]
    rhs = candidate.metadata["rhs"]
    lhs = candidate.metadata["lhs"]
    helper = (
        f"static inline {return_type} {candidate.helper_name}(void)\n"
        "{\n"
        f"    return {rhs};\n"
        "}\n\n"
    )
    insert_pos = source.find(f"void {function}")
    if insert_pos < 0:
        insert_pos = 0
    start, end = candidate.anchor.byte_range
    replacement = f"{lhs} = {candidate.helper_name}();"
    out = source[:start] + replacement + source[end:]
    out = out[:insert_pos] + helper + out[insert_pos:]
    return CandidatePatch(
        candidate_id=candidate.candidate_id,
        patched_source=out,
        summary=f"extract {candidate.helper_name}",
        touched_ranges=(candidate.anchor.byte_range,),
    )
```

In `generate_patches`, add:

```python
        elif candidate.kind == "return-helper":
            patches.append(_patch_return_helper(source, function, candidate))
```

- [ ] **Step 6.6: Run suggest-inlines tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines.py tools/melee-agent/tests/test_source_shape.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 6.7: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/source_shape.py tools/melee-agent/src/mwcc_debug/suggest_inlines.py tools/melee-agent/tests/test_suggest_inlines.py
git commit -m "source-shape: add return-helper candidates"
```

---

## Task 7: Candidate verification layer

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/candidate_verify.py`
- Create: `tools/melee-agent/tests/test_candidate_verify.py`
- Modify: `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`

- [ ] **Step 6.1: Write failing verification tests**

Create `tools/melee-agent/tests/test_candidate_verify.py`:

```python
"""Tests for candidate verification helpers."""
from __future__ import annotations

from pathlib import Path

from src.mwcc_debug.candidate_verify import (
    CheckdiffResult,
    parse_checkdiff_json,
    stage_patch,
    verify_patches,
)
from src.mwcc_debug.source_shape import CandidatePatch


def test_stage_patch_writes_base_c(tmp_path: Path) -> None:
    patch = CandidatePatch(
        candidate_id="arg-temp-0001",
        patched_source="void f(void) {}\n",
        summary="introduce temp",
        touched_ranges=((1, 2),),
    )
    staged = stage_patch(tmp_path, "fn_test", patch)
    assert staged.source_path.exists()
    assert staged.source_path.name == "base.c"
    assert staged.source_path.read_text() == "void f(void) {}\n"


def test_parse_checkdiff_json_reads_match_percent_and_delta() -> None:
    payload = '{"function": "fn", "fuzzy_match_percent": 97.5, "delta": 0.25}'
    parsed = parse_checkdiff_json(payload)
    assert parsed == CheckdiffResult(match_pct=97.5, delta=0.25)


def test_verify_patches_uses_runner_and_returns_scores(tmp_path: Path) -> None:
    patch = CandidatePatch(
        candidate_id="arg-temp-0001",
        patched_source="void f(void) {}\n",
        summary="introduce temp",
        touched_ranges=((1, 2),),
    )

    def runner(candidate: CandidatePatch, staged_source: Path) -> CheckdiffResult:
        assert candidate.candidate_id == "arg-temp-0001"
        assert staged_source.exists()
        return CheckdiffResult(match_pct=98.0, delta=0.1)

    scores = verify_patches(
        function="fn_test",
        patches=[patch],
        stage_root=tmp_path,
        checkdiff_runner=runner,
    )
    assert len(scores) == 1
    assert scores[0].candidate_id == "arg-temp-0001"
    assert scores[0].compile_ok is True
    assert scores[0].checkdiff_delta == 0.1
```

- [ ] **Step 6.2: Run verification tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_candidate_verify.py -v --no-cov
```

Expected: FAIL because `candidate_verify.py` does not exist.

- [ ] **Step 6.3: Implement verification primitives**

Create `tools/melee-agent/src/mwcc_debug/candidate_verify.py`:

```python
"""Verification helpers for source-shape candidates."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from .source_shape import CandidatePatch, CandidateScore, rank_scores


@dataclass(frozen=True)
class StagedCandidate:
    candidate_id: str
    seed_dir: Path
    source_path: Path


@dataclass(frozen=True)
class CheckdiffResult:
    match_pct: Optional[float]
    delta: Optional[float]


CheckdiffRunner = Callable[[CandidatePatch, Path], CheckdiffResult]


def stage_patch(stage_root: Path, function: str, patch: CandidatePatch) -> StagedCandidate:
    seed_dir = stage_root / function / patch.candidate_id
    seed_dir.mkdir(parents=True, exist_ok=True)
    source_path = seed_dir / "base.c"
    source_path.write_text(patch.patched_source)
    return StagedCandidate(
        candidate_id=patch.candidate_id,
        seed_dir=seed_dir,
        source_path=source_path,
    )


def parse_checkdiff_json(text: str) -> CheckdiffResult:
    payload = json.loads(text)
    match_pct = payload.get("fuzzy_match_percent")
    if match_pct is None:
        match_pct = payload.get("match_pct")
    delta = payload.get("delta")
    return CheckdiffResult(match_pct=match_pct, delta=delta)


def verify_patches(
    *,
    function: str,
    patches: list[CandidatePatch],
    stage_root: Path,
    checkdiff_runner: CheckdiffRunner,
) -> list[CandidateScore]:
    scores: list[CandidateScore] = []
    for patch in patches:
        staged = stage_patch(stage_root, function, patch)
        try:
            result = checkdiff_runner(patch, staged.source_path)
            scores.append(CandidateScore(
                candidate_id=patch.candidate_id,
                compile_ok=True,
                checkdiff_pct=result.match_pct,
                checkdiff_delta=result.delta,
                pcdump_score_delta=None,
                diagnostics_path=None,
                candidate_size=len(patch.patched_source.splitlines()),
                helper_param_count=0,
            ))
        except Exception as exc:
            log_path = staged.seed_dir / "verify_error.txt"
            log_path.write_text(f"{type(exc).__name__}: {exc}\n")
            scores.append(CandidateScore(
                candidate_id=patch.candidate_id,
                compile_ok=False,
                checkdiff_pct=None,
                checkdiff_delta=None,
                pcdump_score_delta=None,
                diagnostics_path=log_path,
                candidate_size=len(patch.patched_source.splitlines()),
                helper_param_count=0,
            ))
    return rank_scores(scores)
```

- [ ] **Step 6.4: Wire verifier into `suggest_inlines.run`**

In `tools/melee-agent/src/mwcc_debug/suggest_inlines.py`, change the verification branch:

```python
    scores = []
    if verify and verifier is not None:
        scores = verifier(patches)
        scores = rank_scores(scores)
```

Keep this call signature stable; CLI wiring in Task 8 will pass a closure that calls `verify_patches`.

- [ ] **Step 6.5: Run tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_candidate_verify.py tools/melee-agent/tests/test_suggest_inlines.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 6.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/candidate_verify.py tools/melee-agent/src/mwcc_debug/suggest_inlines.py tools/melee-agent/tests/test_candidate_verify.py
git commit -m "source-shape: add candidate verification helpers"
```

---

## Task 8: `debug suggest inlines` CLI

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Create: `tools/melee-agent/tests/test_suggest_inlines_cli.py`

- [ ] **Step 7.1: Write failing CLI tests**

Create `tools/melee-agent/tests/test_suggest_inlines_cli.py`:

```python
"""CLI tests for debug suggest inlines."""
from __future__ import annotations

import pathlib
import subprocess


CLI_CWD = pathlib.Path(__file__).parent.parent


def test_suggest_inlines_help() -> None:
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "suggest", "inlines", "--help"],
        cwd=CLI_CWD,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert proc.returncode == 0
    assert "--function" in proc.stdout
    assert "--seed-source" in proc.stdout
    assert "--verify" in proc.stdout
    assert "--apply-best" in proc.stdout


def test_suggest_inlines_rejects_apply_best_without_verify() -> None:
    proc = subprocess.run(
        [
            "python", "-m", "src.cli", "debug", "suggest", "inlines",
            "-f", "fn_test",
            "--apply-best",
        ],
        cwd=CLI_CWD,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert proc.returncode != 0
    assert "--apply-best requires --verify" in proc.stderr
```

- [ ] **Step 7.2: Run CLI tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines_cli.py -v --no-cov
```

Expected: FAIL because the command is not registered.

- [ ] **Step 7.3: Add CLI command**

In `tools/melee-agent/src/cli/debug.py`, add a command near `debug suggest coalesce`:

```python
@suggest_app.command(name="inlines")
def suggest_inlines_cmd(
    function: Annotated[
        str,
        typer.Option("--function", "-f", help="Function to analyze."),
    ],
    pcdump: Annotated[
        Optional[Path],
        typer.Option("--pcdump", help="Optional pcdump path."),
    ] = None,
    seed_source: Annotated[
        str,
        typer.Option(
            "--seed-source",
            help="Candidate seed source: all, repeated, guide, coalesce, or patterns.",
        ),
    ] = "all",
    budget: Annotated[
        int,
        typer.Option("--budget", help="Maximum candidate count."),
    ] = 8,
    max_span_statements: Annotated[
        int,
        typer.Option("--max-span-statements", help="Max statements per repeated group."),
    ] = 6,
    verify: Annotated[
        bool,
        typer.Option("--verify", help="Stage and verify candidates."),
    ] = False,
    apply_best: Annotated[
        bool,
        typer.Option("--apply-best", help="Apply best verified candidate."),
    ] = False,
    json_out: Annotated[
        bool,
        typer.Option("--json", help="Emit JSON."),
    ] = False,
) -> None:
    """Suggest hidden inline/helper/source-shape candidates."""
    if seed_source not in {"all", "repeated", "guide", "coalesce", "patterns"}:
        raise typer.BadParameter(
            "--seed-source must be one of: all, repeated, guide, coalesce, patterns"
        )
    if apply_best and not verify:
        typer.echo("--apply-best requires --verify", err=True)
        raise typer.Exit(2)

    from ..mwcc_debug.suggest_inlines import render_json, render_text, run

    melee_root = DEFAULT_MELEE_ROOT
    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(f"{function} not in report.json", err=True)
        raise typer.Exit(2)
    source_path = melee_root / "src" / f"{unit}.c"
    source = source_path.read_text()
    pcdump_text = ""
    if pcdump is not None:
        pcdump_text = pcdump.read_text()

    report = run(
        source=source,
        function=function,
        pcdump_text=pcdump_text,
        seed_source=seed_source,
        budget=budget,
        max_span_statements=max_span_statements,
        verify=False,
    )
    if json_out:
        print(render_json(report))
    else:
        print(render_text(report))
```

This task intentionally wires diagnostic mode first. Real verification is wired in Task 9 after restoration behavior is tested through CLI-level paths.

- [ ] **Step 7.4: Run CLI tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines_cli.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_suggest_inlines_cli.py
git commit -m "source-shape: add suggest-inlines cli"
```

---

## Task 9: Real-tree verification and restoration path

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/candidate_verify.py`
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_candidate_verify.py`

- [ ] **Step 8.1: Add restoration test**

Append to `tools/melee-agent/tests/test_candidate_verify.py`:

```python
def test_verify_real_tree_restores_source(tmp_path: Path) -> None:
    from src.mwcc_debug.candidate_verify import verify_real_tree_patches

    source_path = tmp_path / "file.c"
    source_path.write_text("void f(void) { Original(); }\n")
    patch = CandidatePatch(
        candidate_id="arg-temp-0001",
        patched_source="void f(void) { Candidate(); }\n",
        summary="candidate",
        touched_ranges=((1, 2),),
    )

    def runner(function: str) -> CheckdiffResult:
        assert function == "fn_test"
        assert "Candidate" in source_path.read_text()
        return CheckdiffResult(match_pct=90.0, delta=0.1)

    scores = verify_real_tree_patches(
        function="fn_test",
        source_path=source_path,
        patches=[patch],
        checkdiff_runner=runner,
        apply_best=False,
        threshold=0.05,
    )
    assert scores[0].checkdiff_delta == 0.1
    assert source_path.read_text() == "void f(void) { Original(); }\n"
```

- [ ] **Step 8.2: Run test to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_candidate_verify.py::test_verify_real_tree_restores_source -v --no-cov
```

Expected: FAIL because `verify_real_tree_patches` does not exist.

- [ ] **Step 8.3: Implement restoration verification**

Append to `tools/melee-agent/src/mwcc_debug/candidate_verify.py`:

```python
RealTreeCheckdiffRunner = Callable[[str], CheckdiffResult]


def verify_real_tree_patches(
    *,
    function: str,
    source_path: Path,
    patches: list[CandidatePatch],
    checkdiff_runner: RealTreeCheckdiffRunner,
    apply_best: bool,
    threshold: float,
) -> list[CandidateScore]:
    original = source_path.read_text()
    scores: list[CandidateScore] = []
    best_patch: Optional[CandidatePatch] = None
    best_delta = threshold
    try:
        for patch in patches:
            source_path.write_text(patch.patched_source)
            result = checkdiff_runner(function)
            delta = result.delta if result.delta is not None else -9999.0
            if delta >= best_delta:
                best_delta = delta
                best_patch = patch
            scores.append(CandidateScore(
                candidate_id=patch.candidate_id,
                compile_ok=True,
                checkdiff_pct=result.match_pct,
                checkdiff_delta=result.delta,
                pcdump_score_delta=None,
                diagnostics_path=None,
                candidate_size=len(patch.patched_source.splitlines()),
                helper_param_count=0,
            ))
    finally:
        if apply_best and best_patch is not None:
            source_path.write_text(best_patch.patched_source)
        else:
            source_path.write_text(original)
    return rank_scores(scores)
```

- [ ] **Step 8.4: Wire CLI `--verify` to restoration path**

In `suggest_inlines_cmd`, after `report = run(...)`, add verification when requested:

```python
    if verify:
        from ..mwcc_debug.candidate_verify import (
            CheckdiffResult,
            parse_checkdiff_json,
            verify_real_tree_patches,
        )
        from ..mwcc_debug.source_shape import rank_scores

        def _checkdiff_runner(fn_name: str) -> CheckdiffResult:
            proc = subprocess.run(
                [
                    "python",
                    "tools/checkdiff.py",
                    fn_name,
                    "--no-build",
                    "--no-tty",
                    "--format",
                    "json",
                ],
                cwd=melee_root,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if not proc.stdout.strip():
                raise RuntimeError(proc.stderr.strip() or "checkdiff produced no JSON")
            return parse_checkdiff_json(proc.stdout)

        report.scores = rank_scores(verify_real_tree_patches(
            function=function,
            source_path=source_path,
            patches=report.patches,
            checkdiff_runner=_checkdiff_runner,
            apply_best=apply_best,
            threshold=0.05,
        ))
```

Keep `--threshold` wiring for Task 10 when CLI arguments are rounded out.

- [ ] **Step 8.5: Run tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_candidate_verify.py tools/melee-agent/tests/test_suggest_inlines_cli.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 8.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/candidate_verify.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_candidate_verify.py
git commit -m "source-shape: verify candidates with source restoration"
```

---

## Task 10: CLI option completion and JSON score output

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_suggest_inlines_cli.py`
- Modify: `tools/melee-agent/tests/test_suggest_inlines.py`

- [ ] **Step 9.1: Add tests for threshold and JSON score shape**

Append to `tools/melee-agent/tests/test_suggest_inlines.py`:

```python
def test_render_json_includes_scores() -> None:
    from src.mwcc_debug.source_shape import CandidateScore, SourceShapeReport

    report = SourceShapeReport(
        function="f",
        candidates=[],
        patches=[],
        scores=[
            CandidateScore(
                candidate_id="arg-temp-0001",
                compile_ok=True,
                checkdiff_pct=99.0,
                checkdiff_delta=0.1,
                pcdump_score_delta=None,
                diagnostics_path=None,
            )
        ],
    )
    payload = json.loads(render_json(report))
    assert payload["scores"][0]["candidate_id"] == "arg-temp-0001"
    assert payload["scores"][0]["checkdiff_delta"] == 0.1
```

Append to `tools/melee-agent/tests/test_suggest_inlines_cli.py`:

```python
def test_suggest_inlines_help_mentions_threshold_and_keep_failed() -> None:
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "suggest", "inlines", "--help"],
        cwd=CLI_CWD,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert proc.returncode == 0
    assert "--threshold" in proc.stdout
    assert "--keep-failed" in proc.stdout
    assert "--target" in proc.stdout
```

- [ ] **Step 9.2: Run tests to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines.py::test_render_json_includes_scores tools/melee-agent/tests/test_suggest_inlines_cli.py::test_suggest_inlines_help_mentions_threshold_and_keep_failed -v --no-cov
```

Expected: FAIL until CLI options are added.

- [ ] **Step 9.3: Add CLI options**

In `suggest_inlines_cmd`, add:

```python
    target: Annotated[
        Optional[Path],
        typer.Option("--target", help="Optional target spec for allocator scoring."),
    ] = None,
    threshold: Annotated[
        float,
        typer.Option("--threshold", help="Minimum checkdiff delta for --apply-best."),
    ] = 0.05,
    keep_failed: Annotated[
        bool,
        typer.Option("--keep-failed", help="Preserve failed candidate diagnostics."),
    ] = False,
```

Use `threshold=threshold` in the `verify_real_tree_patches` call.

For this task, validate but do not run pcdump score:

```python
    if target is not None and not verify:
        typer.echo("--target is only used with --verify", err=True)
```

- [ ] **Step 9.4: Run focused tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_suggest_inlines.py tools/melee-agent/tests/test_suggest_inlines_cli.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_suggest_inlines.py tools/melee-agent/tests/test_suggest_inlines_cli.py
git commit -m "source-shape: complete suggest-inlines cli options"
```

---

## Task 11: Compiler-temp anchors for source-shape and Tier 3

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/source_shape.py`
- Modify: `tools/melee-agent/src/mwcc_debug/tier3_search.py`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_tier3_search.py`

- [ ] **Step 10.1: Add failing compiler-temp seed tests**

Append to `tools/melee-agent/tests/test_mwcc_debug_tier3_search.py`:

```python
def test_plan_seeds_from_source_anchors_adds_arg_temp_seed() -> None:
    from src.mwcc_debug.source_shape import SourceAnchor
    from src.mwcc_debug.tier3_search import plan_seeds_from_source_anchors

    anchors = [
        SourceAnchor(
            function="fn_test",
            scope_path=("fn_test", "block@l10c4"),
            byte_range=(100, 130),
            line_range=(10, 12),
            kind="coalesce",
            reason="compiler temp r46 repeated load near call argument",
            virtuals=(46, 50),
        )
    ]
    plans = plan_seeds_from_source_anchors(anchors, budget=5)
    assert len(plans) == 1
    assert plans[0].mutator == "source-shape"
    assert plans[0].target_var == "r46_r50"
    assert "compiler temp" in plans[0].description
```

- [ ] **Step 10.2: Run test to verify failure**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_tier3_search.py::test_plan_seeds_from_source_anchors_adds_arg_temp_seed -v --no-cov
```

Expected: FAIL because `plan_seeds_from_source_anchors` does not exist.

- [ ] **Step 10.3: Add Tier 3 source-anchor seed planner**

In `tools/melee-agent/src/mwcc_debug/tier3_search.py`, import:

```python
from .source_shape import SourceAnchor
```

Add:

```python
def plan_seeds_from_source_anchors(
    anchors: list[SourceAnchor],
    budget: int = 5,
) -> list[SeedPlan]:
    plans: list[SeedPlan] = []
    for anchor in anchors:
        if not anchor.virtuals:
            continue
        joined = "_".join(f"r{v}" for v in anchor.virtuals)
        plans.append(SeedPlan(
            mutator="source-shape",
            target_var=joined,
            args={
                "anchor": anchor,
                "kind": anchor.kind,
            },
            description=(
                f"source-shape seed from {anchor.kind}: {anchor.reason}"
            ),
        ))
        if len(plans) >= budget:
            break
    return plans
```

- [ ] **Step 10.4: Run Tier 3 tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_tier3_search.py -v --no-cov
```

Expected: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/tier3_search.py tools/melee-agent/tests/test_mwcc_debug_tier3_search.py
git commit -m "source-shape: seed tier3 from compiler-temp anchors"
```

---

## Task 12: Documentation and skill text

**Files:**
- Modify: `.claude/skills/mwcc-debug/SKILL.md`
- Modify: `docs/mwcc-debug-roadmap.md`
- Modify: `docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md`

- [ ] **Step 11.1: Add skill text section**

In `.claude/skills/mwcc-debug/SKILL.md`, add this after the `debug suggest coalesce` examples:

```markdown
# Suggest hidden inline/helper source shapes
melee-agent debug suggest inlines -f my_fn
melee-agent debug suggest inlines -f my_fn --seed-source repeated
melee-agent debug suggest inlines -f my_fn --verify
melee-agent debug suggest inlines -f my_fn --verify --apply-best
```

Add this paragraph below the command list:

```markdown
`suggest-inlines` is diagnostic by default. It reports repeated/helper-shaped
statement groups, short-lived call-argument temp candidates, and rejected
candidates with reasons. Use `--verify` to stage candidates and score them
against real-tree `checkdiff`; source is restored unless `--apply-best`
keeps a verified winner.
```

- [ ] **Step 11.2: Update roadmap status**

In `docs/mwcc-debug-roadmap.md`, under Phase 2, add:

```markdown
Implementation plan:
`docs/superpowers/plans/2026-05-21-source-shape-suggestions.md`
```

- [ ] **Step 11.3: Run docs checks**

Run:

```bash
rg -n "suggest-inlines|Source-Shape Suggestions|source_shape_candidate" .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug-roadmap.md docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md
git diff --check
```

Expected: `rg` finds the new command docs, and `git diff --check` prints no errors.

- [ ] **Step 11.4: Commit**

```bash
git add .claude/skills/mwcc-debug/SKILL.md docs/mwcc-debug-roadmap.md docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md
git commit -m "docs: document source-shape suggestions workflow"
```

---

## Task 13: Final verification

**Files:**
- No source edits expected.

- [ ] **Step 12.1: Run focused source-shape test set**

Run:

```bash
python -m pytest \
  tools/melee-agent/tests/test_source_shape.py \
  tools/melee-agent/tests/test_source_spans.py \
  tools/melee-agent/tests/test_suggest_inlines.py \
  tools/melee-agent/tests/test_candidate_verify.py \
  tools/melee-agent/tests/test_suggest_inlines_cli.py \
  tools/melee-agent/tests/test_mwcc_debug_mutators.py \
  tools/melee-agent/tests/test_mwcc_debug_source_patch.py \
  tools/melee-agent/tests/test_mwcc_debug_tier3_search.py \
  -v --no-cov
```

Expected: PASS.

- [ ] **Step 12.2: Run full melee-agent tests if runtime is acceptable**

Run:

```bash
python -m pytest tools/melee-agent/tests/ -v --no-cov
```

Expected: PASS. If the suite times out because integration fixtures are unavailable, record the last passing focused command and the timeout/error in the final implementation summary.

- [ ] **Step 12.3: Run CLI help smoke**

Run:

```bash
cd tools/melee-agent
python -m src.cli debug suggest inlines --help
python -m src.cli debug mutate insert-alias --help
python -m src.cli debug mutate decl-orders --help
```

Expected: all three commands exit 0 and show the new options.

- [ ] **Step 12.4: Run repository checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; status shows only intentional working-tree changes if the implementation has not been fully committed.

- [ ] **Step 13.5: Commit final verification notes if docs changed**

If Task 13 produced a docs note or test fixture update:

```bash
git add docs/mwcc-debug-roadmap.md docs/superpowers/plans/2026-05-21-source-shape-suggestions.md
git commit -m "source-shape: record verification notes"
```

If no files changed, do not create an empty commit.

---

## Self-Review Notes

Spec coverage:

- `debug suggest inlines` diagnostic mode: Tasks 5 and 8.
- Candidate forms: Task 5 covers `void-helper` and `arg-temp`; Task 6 covers `return-helper`.
- Verification and restoration: Tasks 7 and 9.
- Scope-aware alias insertion: Task 3.
- Scope-aware declaration ordering: Task 4.
- Compiler-temp anchor seeding: Task 11.
- Docs and roadmap: Task 12.

Known plan constraint:

- The initial `void-helper` patcher uses a zero-argument helper to establish the pipeline. Before using it on real decomp work, extend helper parameter inference from `reads` and `writes` in the same module if verification shows generated helpers compile only for trivial spans.
