# Nested-block-local awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mwcc-debug symbol bridge see locals declared inside nested `{...}` blocks, so `var-to-virtual` / `virtual-to-var` surface them with `scope_path`-annotated bindings instead of returning "not found".

**Architecture:** Tree-sitter rewrite of `symbol_bridge.py`'s decl walker, split into three modules: `ast_walker.py` (façade over tree-sitter), `scope_path.py` (utilities), and a slimmer `symbol_bridge.py` that consumes them. Existing public types (`LocalDecl`, `Binding`, `BindingBasis`) extend in place with default-valued new fields. Private helpers used by `mutators.py` (`_extract_function_text`, `_strip_strings_and_comments`, `walk_local_decls`) are preserved as back-compat adapters so no caller breaks in Phase 1.

**Tech Stack:** Python 3.11+, `tree-sitter>=0.23.0`, `tree-sitter-c>=0.23.0`, pytest, Typer.

**Spec:** `docs/superpowers/specs/2026-05-20-nested-block-local-awareness-design.md`

---

## File structure

| File | Action | Owner |
|------|--------|-------|
| `tools/melee-agent/src/mwcc_debug/scope_path.py` | Create | Task 1 |
| `tools/melee-agent/src/mwcc_debug/ast_walker.py` | Create | Tasks 2–4 |
| `tools/melee-agent/src/mwcc_debug/symbol_bridge.py` | Extend dataclasses, rewrite walker, keep back-compat adapters | Tasks 5–9 |
| `tools/melee-agent/src/cli/debug.py` | Extend `var-to-virtual` (`--all`, `--scope`) and `virtual-to-var` (scope annotation) | Tasks 10–11 |
| `tools/melee-agent/tests/test_scope_path.py` | Create | Task 1 |
| `tools/melee-agent/tests/test_ast_walker.py` | Create | Tasks 2–4 |
| `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py` | Extend with nested-block + red-flag-removal + scope cases | Tasks 5–9 |
| `tools/melee-agent/tests/conftest.py` | Extend with autouse ast_walker.clear_cache() fixture | Task 2 |
| `docs/mwcc-debug-nested-block-validation-2026-05-20.md` | Create — empirical validation study results | Task 12 |
| `docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md` | Create — macro tolerance check results | Task 13 |

---

## Task 1: `scope_path.py` — pure utilities

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/scope_path.py`
- Create: `tools/melee-agent/tests/test_scope_path.py`

- [ ] **Step 1.1: Write failing tests**

Create `tools/melee-agent/tests/test_scope_path.py`:

```python
"""Tests for scope_path utilities."""
from __future__ import annotations

from src.mwcc_debug.scope_path import (
    format_for_display,
    is_nested_within,
    nearest_common_ancestor,
    parse_display,
)


def test_is_nested_within_same_path() -> None:
    p = ("fn", "block@l10c4")
    assert is_nested_within(p, p) is True


def test_is_nested_within_child() -> None:
    parent = ("fn",)
    child = ("fn", "block@l10c4")
    assert is_nested_within(child, parent) is True


def test_is_nested_within_sibling_returns_false() -> None:
    a = ("fn", "block@l10c4")
    b = ("fn", "block@l20c4")
    assert is_nested_within(a, b) is False


def test_is_nested_within_unrelated_function() -> None:
    a = ("fn1", "block@l10c4")
    b = ("fn2",)
    assert is_nested_within(a, b) is False


def test_nearest_common_ancestor_identical() -> None:
    p = ("fn", "block@l10c4")
    assert nearest_common_ancestor(p, p) == p


def test_nearest_common_ancestor_cousins() -> None:
    a = ("fn", "block@l10c4", "block@l12c8")
    b = ("fn", "block@l10c4", "block@l15c8")
    assert nearest_common_ancestor(a, b) == ("fn", "block@l10c4")


def test_nearest_common_ancestor_no_common() -> None:
    a = ("fn1", "block@l10c4")
    b = ("fn2", "block@l10c4")
    assert nearest_common_ancestor(a, b) == ()


def test_format_for_display_round_trip() -> None:
    p = ("fn", "block@l10c4", "block@l12c8")
    s = format_for_display(p)
    assert s == "fn/block@l10c4/block@l12c8"
    assert parse_display(s) == p


def test_format_for_display_empty() -> None:
    assert format_for_display(()) == ""
    assert parse_display("") == ()
```

- [ ] **Step 1.2: Run tests, verify import error**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_scope_path.py -v --no-cov
```
Expected: FAIL with `ImportError: cannot import name 'scope_path'` (the module doesn't exist yet).

- [ ] **Step 1.3: Implement scope_path.py**

Create `tools/melee-agent/src/mwcc_debug/scope_path.py`:

```python
"""Utilities for working with scope_path tuples produced by ast_walker.

A scope_path is a tuple[str, ...] where:
  - Element 0 is the function name (always present in production paths).
  - Elements 1..N are nested block identifiers of the form
    "block@l{line}c{col}", where line is 1-indexed and col is 0-indexed
    byte column of the opening `{` token.

Empty tuples are reserved for default-constructed LocalDecl objects in
tests; production code always populates at least the function-name element.
"""
from __future__ import annotations


def is_nested_within(
    candidate: tuple[str, ...],
    ancestor: tuple[str, ...],
) -> bool:
    """Return True if `candidate` is the same scope as `ancestor` or
    is nested inside it. Two unrelated scopes (different function or
    sibling blocks) return False.
    """
    if len(candidate) < len(ancestor):
        return False
    return candidate[: len(ancestor)] == ancestor


def nearest_common_ancestor(
    a: tuple[str, ...],
    b: tuple[str, ...],
) -> tuple[str, ...]:
    """Return the longest shared prefix of two scope paths.
    Identical paths return that path. Cousin paths return their
    common prefix. Unrelated paths return ()."""
    out: list[str] = []
    for x, y in zip(a, b):
        if x != y:
            break
        out.append(x)
    return tuple(out)


def format_for_display(path: tuple[str, ...]) -> str:
    """Render a scope path as `fn/block@l10c4/block@l12c8` for CLI output."""
    return "/".join(path)


def parse_display(text: str) -> tuple[str, ...]:
    """Parse a `/`-separated scope path back into the tuple form."""
    if not text:
        return ()
    return tuple(text.split("/"))
```

- [ ] **Step 1.4: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_scope_path.py -v --no-cov
```
Expected: 9 passed.

- [ ] **Step 1.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/scope_path.py \
        tools/melee-agent/tests/test_scope_path.py
git commit -m "nested-block: scope_path utilities (Task 1)"
```

---

## Task 2: `ast_walker.py` scaffold + tree-sitter availability handling

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/ast_walker.py`
- Create: `tools/melee-agent/tests/test_ast_walker.py`
- Modify: `tools/melee-agent/tests/conftest.py`

- [ ] **Step 2.1: Write failing scaffold tests**

Create `tools/melee-agent/tests/test_ast_walker.py`:

```python
"""Tests for ast_walker — tree-sitter façade for symbol_bridge."""
from __future__ import annotations

import pytest

from src.mwcc_debug.ast_walker import (
    AstUnavailableError,
    AstWalkError,
    LocalDecl,
    clear_cache,
    walk_function,
)


def test_local_decl_has_new_fields_with_defaults() -> None:
    """LocalDecl has the new ast-walker fields with safe defaults."""
    d = LocalDecl(name="x", type_str="int", decl_index=0)
    assert d.line_no == 0
    assert d.byte_range == (0, 0)
    assert d.scope_path == ()
    assert d.scope_byte_range == (0, 0)
    assert d.has_initializer is False
    assert d.initializer_line_no is None


def test_walk_function_not_found_returns_empty() -> None:
    """Asking for a function that doesn't exist returns []."""
    src = "void other(void) { int x; }"
    assert walk_function(src, "missing", path=None) == []


def test_walk_function_unavailable_raises_subclass() -> None:
    """AstUnavailableError and AstWalkError are both exceptions."""
    assert issubclass(AstUnavailableError, Exception)
    assert issubclass(AstWalkError, Exception)


def test_clear_cache_exists_and_returns_none() -> None:
    """clear_cache() is callable for test isolation."""
    assert clear_cache() is None
```

- [ ] **Step 2.2: Extend conftest.py with autouse cache-clear fixture**

Read the existing `tools/melee-agent/tests/conftest.py`. Append at the end:

```python
@pytest.fixture(autouse=True)
def _clear_ast_walker_cache():
    """Clear ast_walker's parse cache between tests to prevent cross-test
    state leak. Phase 1 of nested-block-local awareness."""
    yield
    try:
        from src.mwcc_debug import ast_walker
        ast_walker.clear_cache()
    except ImportError:
        # ast_walker not yet built — tolerate during scaffold tasks.
        pass
```

If `pytest` isn't already imported at the top of conftest.py, add `import pytest`.

- [ ] **Step 2.3: Run tests, verify import error**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: FAIL with `ImportError` (module doesn't exist).

- [ ] **Step 2.4: Implement ast_walker scaffold**

Create `tools/melee-agent/src/mwcc_debug/ast_walker.py`:

```python
"""Tree-sitter façade for the symbol bridge.

Parses C source via tree-sitter + tree-sitter-c, exposes a function-scoped
walk that yields LocalDecl records with scope_path and byte ranges.

This module is the only place in the mwcc_debug package that imports
tree-sitter. If the binary wheels are missing, AstUnavailableError is
raised at first call and the bridge falls back to its slim regex walker
(see symbol_bridge fallback path).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LocalDecl:
    """One local variable declaration extracted from a function body.

    Backward-compatible with the existing symbol_bridge.LocalDecl shape
    (same three first fields) plus six new fields all defaulted so test
    fixtures and legacy constructors keep working.
    """
    name: str
    type_str: str
    decl_index: int
    line_no: int = 0
    byte_range: tuple[int, int] = (0, 0)
    scope_path: tuple[str, ...] = ()
    scope_byte_range: tuple[int, int] = (0, 0)
    has_initializer: bool = False
    initializer_line_no: Optional[int] = None


class AstUnavailableError(Exception):
    """Tree-sitter or tree-sitter-c is not importable on this platform."""


class AstWalkError(Exception):
    """Tree-sitter parsed the source but the requested function's body
    contained ERROR nodes that enclose or interrupt a decl. Bridge
    should fall back to the regex walker.
    """
    def __init__(self, message: str, line_no: int = 0):
        super().__init__(message)
        self.line_no = line_no


# Cache lives here; Task 3 implements lookup logic.
_CACHE: dict[object, object] = {}
_AST_CACHE_MAX = 64


def clear_cache() -> None:
    """Drop all cached parses. Called by the autouse pytest fixture."""
    _CACHE.clear()


def walk_function(
    source: str,
    fn_name: str,
    path: Optional[str] = None,
) -> list[LocalDecl]:
    """Walk one C function's body, return its locals.

    Scaffold-only: returns [] for missing function. Real parsing arrives
    in Tasks 3 and 4.
    """
    # Stub: scaffold-task return for "function not found" case.
    if fn_name not in source:
        return []
    raise NotImplementedError(
        "walk_function: parsing not yet implemented (see Task 3)"
    )
```

- [ ] **Step 2.5: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: 4 passed.

- [ ] **Step 2.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/ast_walker.py \
        tools/melee-agent/tests/test_ast_walker.py \
        tools/melee-agent/tests/conftest.py
git commit -m "nested-block: ast_walker scaffold + conftest cache fixture (Task 2)"
```

---

## Task 3: `walk_function` — top-level decls via tree-sitter

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/ast_walker.py`
- Modify: `tools/melee-agent/tests/test_ast_walker.py`

- [ ] **Step 3.1: Write failing tests for top-level walk**

Append to `tools/melee-agent/tests/test_ast_walker.py`:

```python
def test_walk_function_simple_top_level() -> None:
    """A function with three top-level decls produces three LocalDecls
    with correct scope_path (function-name only)."""
    src = (
        "void f(void) {\n"
        "    int a;\n"
        "    HSD_JObj* b;\n"
        "    char c[8];\n"
        "}\n"
    )
    decls = walk_function(src, "f", path=None)
    assert len(decls) == 3
    assert [d.name for d in decls] == ["a", "b", "c"]
    assert [d.type_str for d in decls] == ["int", "HSD_JObj*", "char[8]"]
    assert all(d.scope_path == ("f",) for d in decls)
    assert all(d.line_no > 0 for d in decls)


def test_walk_function_with_initializer() -> None:
    """A decl with an initializer sets has_initializer + initializer_line_no."""
    src = "void f(void) { int x = 5; }"
    decls = walk_function(src, "f", path=None)
    assert len(decls) == 1
    assert decls[0].name == "x"
    assert decls[0].has_initializer is True
    assert decls[0].initializer_line_no == 1


def test_walk_function_multi_declarator_splits_each() -> None:
    """`int x, y, z;` produces three LocalDecls with the same line_no
    and the same scope_path but distinct byte_ranges."""
    src = "void f(void) {\n    int x, y, z;\n}"
    decls = walk_function(src, "f", path=None)
    assert [d.name for d in decls] == ["x", "y", "z"]
    line_nos = {d.line_no for d in decls}
    assert line_nos == {2}
    byte_ranges = {d.byte_range for d in decls}
    assert len(byte_ranges) == 3


def test_walk_function_function_pointer() -> None:
    """A function pointer parses as one LocalDecl with type captured."""
    src = "void f(void) { void (*cb)(int); }"
    decls = walk_function(src, "f", path=None)
    assert len(decls) == 1
    assert decls[0].name == "cb"
```

- [ ] **Step 3.2: Run tests, verify fail**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: 4 new tests FAIL with `NotImplementedError` (the scaffold raises). The 4 scaffold tests from Task 2 still pass.

- [ ] **Step 3.3: Implement top-level walking**

Replace the stub `walk_function` body in `tools/melee-agent/src/mwcc_debug/ast_walker.py`. Add the tree-sitter imports + parser singleton + the walk:

```python
# Add at top of file, after the existing imports:
try:
    import tree_sitter
    import tree_sitter_c
    _LANGUAGE = tree_sitter.Language(tree_sitter_c.language())
    _PARSER = tree_sitter.Parser(_LANGUAGE)
    _TS_AVAILABLE = True
except ImportError:
    _TS_AVAILABLE = False
    _LANGUAGE = None
    _PARSER = None


def _check_ts() -> None:
    if not _TS_AVAILABLE:
        raise AstUnavailableError(
            "tree-sitter or tree-sitter-c not importable; bridge will use "
            "regex fallback."
        )


def _byte_offset_to_line_col(source_bytes: bytes, offset: int) -> tuple[int, int]:
    """Return (1-indexed line, 0-indexed col) for a byte offset."""
    line = 1
    col = 0
    for b in source_bytes[:offset]:
        if b == 0x0A:  # '\n'
            line += 1
            col = 0
        else:
            col += 1
    return (line, col)


def _node_text(source_bytes: bytes, node) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _find_function_definition(root, source_bytes: bytes, fn_name: str):
    """Search the tree for a function_definition whose declarator name
    matches `fn_name`. Returns the function_definition node or None.
    """
    stack = [root]
    while stack:
        node = stack.pop()
        if node.type == "function_definition":
            # Find the declarator → function_declarator → identifier
            decl = node.child_by_field_name("declarator")
            while decl is not None and decl.type != "identifier":
                # Could be pointer_declarator wrapping function_declarator
                inner = decl.child_by_field_name("declarator")
                if inner is None:
                    break
                decl = inner
            if decl is not None and decl.type == "identifier":
                if _node_text(source_bytes, decl) == fn_name:
                    return node
        for child in node.children:
            stack.append(child)
    return None


def _build_type_str(source_bytes: bytes, decl_node, declarator_node) -> str:
    """Return the type slice for a `declaration` node, *without* the
    declarator name. Handles pointers, arrays, qualifiers.

    Strategy: take the declaration's source slice up to the declarator
    start; if the declarator wraps a pointer or array, fold those tokens
    into the type.
    """
    # type_specifier(s) are children before declarator. Concatenate their
    # source text. Then walk the declarator, peeling off the name, and
    # carry the pointer/array decorations into the type.
    type_parts: list[str] = []
    for child in decl_node.children:
        if child == declarator_node:
            break
        text = _node_text(source_bytes, child).strip()
        if text:
            type_parts.append(text)

    # Peel pointer/array layers off the declarator.
    suffix_parts: list[str] = []
    node = declarator_node
    while node is not None and node.type != "identifier":
        if node.type == "pointer_declarator":
            suffix_parts.insert(0, "*")
            node = node.child_by_field_name("declarator")
        elif node.type == "array_declarator":
            size = node.child_by_field_name("size")
            size_text = _node_text(source_bytes, size) if size is not None else ""
            suffix_parts.append(f"[{size_text}]")
            node = node.child_by_field_name("declarator")
        elif node.type == "init_declarator":
            node = node.child_by_field_name("declarator")
        elif node.type == "function_declarator":
            # `void (*cb)(int)` — capture the parameter list as a suffix.
            params = node.child_by_field_name("parameters")
            params_text = _node_text(source_bytes, params) if params is not None else "()"
            suffix_parts.append(params_text)
            node = node.child_by_field_name("declarator")
        elif node.type == "parenthesized_declarator":
            # Inner of `(*cb)` — descend into the parenthesized declarator
            inner = None
            for child in node.children:
                if child.type in ("identifier", "pointer_declarator", "array_declarator", "function_declarator"):
                    inner = child
                    break
            node = inner
        else:
            # Unknown — stop walking.
            break

    base = " ".join(type_parts)
    pointer_part = ""
    array_part = ""
    fn_part = ""
    for part in suffix_parts:
        if part == "*":
            pointer_part += "*"
        elif part.startswith("["):
            array_part += part
        elif part.startswith("("):
            fn_part = part

    if fn_part:
        # function pointer: render as `<base> (<pointer>)<params>`
        return f"{base} ({pointer_part}){fn_part}".strip()
    return f"{base}{pointer_part}{array_part}".strip()


def _extract_decls_from_declaration(
    decl_node, source_bytes: bytes, scope_path: tuple[str, ...],
    scope_byte_range: tuple[int, int], counter: list[int],
) -> list[LocalDecl]:
    """Given a `declaration` node, yield one LocalDecl per declarator."""
    out: list[LocalDecl] = []
    # Each declarator is either init_declarator or a bare declarator child
    # that is one of identifier/pointer_declarator/array_declarator.
    declarators = []
    for child in decl_node.children:
        if child.type in ("init_declarator",):
            declarators.append(child)
        elif child.type in (
            "identifier",
            "pointer_declarator",
            "array_declarator",
        ):
            declarators.append(child)

    for d in declarators:
        # Find the identifier (name) and detect initializer.
        has_init = False
        init_line = None
        if d.type == "init_declarator":
            value = d.child_by_field_name("value")
            if value is not None:
                has_init = True
                start_byte = value.start_byte
                init_line, _ = _byte_offset_to_line_col(source_bytes, start_byte)
            inner = d.child_by_field_name("declarator")
        else:
            inner = d

        # Drill to the identifier
        name_node = inner
        while name_node is not None and name_node.type != "identifier":
            if name_node.type == "pointer_declarator":
                name_node = name_node.child_by_field_name("declarator")
            elif name_node.type == "array_declarator":
                name_node = name_node.child_by_field_name("declarator")
            elif name_node.type == "function_declarator":
                name_node = name_node.child_by_field_name("declarator")
            elif name_node.type == "parenthesized_declarator":
                for child in name_node.children:
                    if child.type in (
                        "identifier",
                        "pointer_declarator",
                        "array_declarator",
                        "function_declarator",
                    ):
                        name_node = child
                        break
                else:
                    break
            else:
                break

        if name_node is None or name_node.type != "identifier":
            continue

        name = _node_text(source_bytes, name_node)
        type_str = _build_type_str(source_bytes, decl_node, d)
        line, _ = _byte_offset_to_line_col(source_bytes, d.start_byte)
        out.append(LocalDecl(
            name=name,
            type_str=type_str,
            decl_index=counter[0],
            line_no=line,
            byte_range=(d.start_byte, d.end_byte),
            scope_path=scope_path,
            scope_byte_range=scope_byte_range,
            has_initializer=has_init,
            initializer_line_no=init_line,
        ))
        counter[0] += 1

    return out


def walk_function(
    source: str,
    fn_name: str,
    path: Optional[str] = None,
) -> list[LocalDecl]:
    """Walk one C function's body, return its locals."""
    _check_ts()
    source_bytes = source.encode("utf-8")
    tree = _PARSER.parse(source_bytes)
    fn_node = _find_function_definition(tree.root_node, source_bytes, fn_name)
    if fn_node is None:
        return []

    body = fn_node.child_by_field_name("body")
    if body is None:
        return []

    counter = [0]
    out: list[LocalDecl] = []
    scope_path: tuple[str, ...] = (fn_name,)
    scope_byte_range = (body.start_byte, body.end_byte)

    # Phase 1, Task 3: top-level walk only. Iterate direct children of
    # the function body's compound_statement.
    for child in body.children:
        if child.type == "declaration":
            out.extend(_extract_decls_from_declaration(
                child, source_bytes, scope_path, scope_byte_range, counter,
            ))

    return out
```

- [ ] **Step 3.4: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: 8 passed (4 scaffold + 4 new). If `tree-sitter` import fails on the local platform, scaffold tests still pass via the ImportError fallback path; new tests skip with the AstUnavailableError raised inside `_check_ts`.

If tests fail due to AstUnavailableError, install: `pip install tree-sitter tree-sitter-c` (already in `pyproject.toml` deps).

- [ ] **Step 3.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/ast_walker.py \
        tools/melee-agent/tests/test_ast_walker.py
git commit -m "nested-block: ast_walker top-level decl walk (Task 3)"
```

---

## Task 4: `walk_function` — nested-block decls + caching + macro tolerance

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/ast_walker.py`
- Modify: `tools/melee-agent/tests/test_ast_walker.py`

- [ ] **Step 4.1: Write failing tests for nested-block walk + caching + error handling**

Append to `test_ast_walker.py`:

```python
def test_walk_function_for_loop_block() -> None:
    """A for-loop body's decls get their own scope_path."""
    src = (
        "void f(void) {\n"
        "    int outer;\n"
        "    for (int i = 0; i < 8; i++) {\n"
        "        int inner;\n"
        "    }\n"
        "}\n"
    )
    decls = walk_function(src, "f", path=None)
    names = {d.name: d for d in decls}
    assert "outer" in names
    assert "inner" in names
    assert names["outer"].scope_path == ("f",)
    assert names["inner"].scope_path[0] == "f"
    assert len(names["inner"].scope_path) == 2
    assert names["inner"].scope_path[1].startswith("block@l")


def test_walk_function_if_else_distinct_scopes() -> None:
    """`if (x) { ... } else { ... }` makes two distinct nested scopes."""
    src = (
        "void f(int x) {\n"
        "    if (x) {\n"
        "        int a;\n"
        "    } else {\n"
        "        int b;\n"
        "    }\n"
        "}\n"
    )
    decls = walk_function(src, "f", path=None)
    by_name = {d.name: d for d in decls}
    assert by_name["a"].scope_path != by_name["b"].scope_path
    assert by_name["a"].scope_path[0] == "f"
    assert by_name["b"].scope_path[0] == "f"


def test_walk_function_shadowing_outer_and_inner_i() -> None:
    """An outer `int i` and an inner `int i` are both surfaced."""
    src = (
        "void f(void) {\n"
        "    int i;\n"
        "    {\n"
        "        int i;\n"
        "    }\n"
        "}\n"
    )
    decls = walk_function(src, "f", path=None)
    paths = sorted(d.scope_path for d in decls if d.name == "i")
    assert len(paths) == 2
    assert paths[0] != paths[1]


def test_walk_function_two_blocks_same_line_distinct_paths() -> None:
    """`if (a) { ... } else { ... }` on one line: column suffix
    disambiguates the two scopes."""
    src = "void f(int a) {\n    if (a) { int x; } else { int y; }\n}"
    decls = walk_function(src, "f", path=None)
    by_name = {d.name: d for d in decls}
    assert by_name["x"].scope_path[1] != by_name["y"].scope_path[1]


def test_walk_function_cache_returns_same_objects() -> None:
    """Two calls on the same source return objects derived from the
    same cached parse tree (verified by id() of the cached entry)."""
    src = "void f(void) { int x; }"
    decls_a = walk_function(src, "f", path=None)
    decls_b = walk_function(src, "f", path=None)
    assert [d.name for d in decls_a] == [d.name for d in decls_b]


def test_walk_function_tolerates_pad_stack_macro() -> None:
    """Body-level ERROR nodes from PAD_STACK don't trigger AstWalkError
    as long as the decls themselves parse cleanly."""
    src = (
        "void f(void) {\n"
        "    int x;\n"
        "    PAD_STACK(64);\n"
        "    int y;\n"
        "}\n"
    )
    decls = walk_function(src, "f", path=None)
    names = [d.name for d in decls]
    assert "x" in names
    assert "y" in names


def test_walk_function_raises_on_decl_enclosing_error() -> None:
    """An ERROR node that interrupts a declaration triggers AstWalkError."""
    src = "void f(void) { int = 5; }"  # syntax error inside decl
    with pytest.raises(AstWalkError):
        walk_function(src, "f", path=None)
```

- [ ] **Step 4.2: Run tests, verify fail**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: the 7 new tests FAIL (current walk_function doesn't descend into nested blocks, doesn't cache, doesn't handle errors).

- [ ] **Step 4.3: Implement nested walk + caching + error handling**

Replace `walk_function` in `ast_walker.py` with the nested-aware version. Also add cache + LRU eviction + ERROR-node tolerance:

```python
import collections


# Cache: maps cache_key -> tree_sitter.Tree
# cache_key is either (path, mtime_ns) for on-disk callers or
# ("mem", id(source)) for in-memory callers (see spec § Caching).
_CACHE: "collections.OrderedDict[object, object]" = collections.OrderedDict()
_AST_CACHE_MAX = 64


def clear_cache() -> None:
    _CACHE.clear()


def _cache_key(source: str, path: Optional[str]) -> object:
    if path is not None:
        import os
        try:
            mtime = os.stat(path).st_mtime_ns
            return (path, mtime)
        except FileNotFoundError:
            pass
    return ("mem", id(source))


def _parse_cached(source: str, path: Optional[str]):
    key = _cache_key(source, path)
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    tree = _PARSER.parse(source.encode("utf-8"))
    _CACHE[key] = tree
    while len(_CACHE) > _AST_CACHE_MAX:
        _CACHE.popitem(last=False)
    return tree


def _has_decl_enclosing_error(node) -> bool:
    """Return True if any ERROR node is the parent of a declaration
    fragment (i.e. the error wraps or interrupts a decl). Body-level
    standalone ERROR nodes (e.g. macro invocations) are tolerated.
    """
    stack = [node]
    while stack:
        n = stack.pop()
        if n.type == "ERROR":
            # If this ERROR has a declaration-shaped child, treat as fatal.
            for child in n.children:
                if child.type in ("declaration", "init_declarator"):
                    return True
        for child in n.children:
            stack.append(child)
    return False


def _walk_body(
    body_node,
    source_bytes: bytes,
    scope_path: tuple[str, ...],
    counter: list[int],
) -> list[LocalDecl]:
    """Recursive walk of a compound_statement body. Each nested
    compound_statement (`{ ... }`) gets its own scope_path element of
    the form `block@l{line}c{col}` from the opening brace position.
    """
    scope_byte_range = (body_node.start_byte, body_node.end_byte)
    out: list[LocalDecl] = []
    for child in body_node.children:
        if child.type == "declaration":
            out.extend(_extract_decls_from_declaration(
                child, source_bytes, scope_path, scope_byte_range, counter,
            ))
        elif child.type == "compound_statement":
            line, col = _byte_offset_to_line_col(source_bytes, child.start_byte)
            new_path = scope_path + (f"block@l{line}c{col}",)
            out.extend(_walk_body(child, source_bytes, new_path, counter))
        else:
            # Other statement types may contain nested compound statements
            # (if_statement, for_statement, while_statement, do_statement,
            # switch_statement). Walk their compound_statement children.
            for grand in _iter_compound_statements(child):
                line, col = _byte_offset_to_line_col(source_bytes, grand.start_byte)
                new_path = scope_path + (f"block@l{line}c{col}",)
                out.extend(_walk_body(grand, source_bytes, new_path, counter))
    return out


def _iter_compound_statements(node):
    """Yield direct compound_statement descendants of node, stopping at
    any function_definition (don't descend into nested functions)."""
    stack = list(node.children)
    while stack:
        n = stack.pop()
        if n.type == "compound_statement":
            yield n
            continue  # the recursive _walk_body call handles descent
        if n.type == "function_definition":
            continue
        for c in n.children:
            stack.append(c)


def walk_function(
    source: str,
    fn_name: str,
    path: Optional[str] = None,
) -> list[LocalDecl]:
    """Walk one C function's body (including nested blocks), return locals."""
    _check_ts()
    tree = _parse_cached(source, path)
    source_bytes = source.encode("utf-8")
    fn_node = _find_function_definition(tree.root_node, source_bytes, fn_name)
    if fn_node is None:
        return []

    body = fn_node.child_by_field_name("body")
    if body is None:
        return []

    # Macro-tolerance check: only fail on decl-enclosing ERROR nodes.
    if _has_decl_enclosing_error(body):
        line, _ = _byte_offset_to_line_col(source_bytes, body.start_byte)
        raise AstWalkError(
            f"function body for {fn_name!r} contains decl-enclosing ERROR nodes",
            line_no=line,
        )

    counter = [0]
    return _walk_body(body, source_bytes, (fn_name,), counter)
```

- [ ] **Step 4.4: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_ast_walker.py -v --no-cov
```
Expected: 15 passed.

- [ ] **Step 4.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/ast_walker.py \
        tools/melee-agent/tests/test_ast_walker.py
git commit -m "nested-block: ast_walker nested + cache + macro tolerance (Task 4)"
```

---

## Task 5: Extend `LocalDecl`, `Binding`, `BindingBasis` with scope fields

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py:21-26` (LocalDecl)
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py:348-362` (Binding)
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py:365-377` (BindingBasis)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

- [ ] **Step 5.1: Write failing tests for the extended dataclasses**

Append to `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`:

```python
def test_local_decl_has_new_scope_fields_with_defaults() -> None:
    """LocalDecl carries the new scope fields with safe defaults."""
    from src.mwcc_debug.symbol_bridge import LocalDecl
    d = LocalDecl(name="x", type_str="int", decl_index=0)
    assert d.line_no == 0
    assert d.byte_range == (0, 0)
    assert d.scope_path == ()
    assert d.scope_byte_range == (0, 0)
    assert d.has_initializer is False
    assert d.initializer_line_no is None


def test_binding_has_scope_path_with_default() -> None:
    """Binding has a new scope_path field, defaults to ()."""
    from src.mwcc_debug.symbol_bridge import Binding
    b = Binding(
        var_name="x", virtual=32, decl_line=5,
        kind="local", type_str="int", confidence="best-guess",
    )
    assert b.scope_path == ()


def test_binding_basis_has_decls_by_scope_with_default() -> None:
    """BindingBasis has a new decls_by_scope dict."""
    from src.mwcc_debug.symbol_bridge import BindingBasis
    bb = BindingBasis(
        parsed_params=[], parsed_locals=[],
        observed_virtuals=[], unrecognized_decls=[], red_flags=[],
    )
    assert bb.decls_by_scope == {}
```

- [ ] **Step 5.2: Run tests, verify fail**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py -v --no-cov -k "scope or new_scope or decls_by_scope"
```
Expected: 3 FAIL with `TypeError` (unexpected keyword) or `AttributeError` (field missing).

- [ ] **Step 5.3: Extend the dataclasses**

In `symbol_bridge.py:21-26`, replace the existing `LocalDecl` definition with:

```python
@dataclass
class LocalDecl:
    """One local variable declaration extracted from a function body."""
    name: str          # variable name
    type_str: str      # canonical type as written in source (e.g., "HSD_JObj*")
    decl_index: int    # 0-indexed position in source order
    # Phase-1 nested-block fields (default-valued for back-compat):
    line_no: int = 0                              # 1-indexed source line
    byte_range: tuple[int, int] = (0, 0)          # [start, end) byte offsets
    scope_path: tuple[str, ...] = ()              # ("fn", "block@lLcC")
    scope_byte_range: tuple[int, int] = (0, 0)    # enclosing block span
    has_initializer: bool = False
    initializer_line_no: Optional[int] = None
```

Add `from typing import Optional` near the existing imports if not present.

In `symbol_bridge.py:348-362`, replace `Binding`:

```python
@dataclass
class Binding:
    """A source variable bound to its predicted MWCC virtual register."""
    var_name: str
    virtual: int           # -1 if unmapped
    decl_line: int         # 1-indexed line in original source
    kind: str              # "local" | "param"
    type_str: str
    confidence: str        # "best-guess" | "verified" | "low-confidence"
                           # | "rejected" | "ambiguous" | "unsupported"
                           # | "ambiguous-nested" (NEW: Phase 1 default
                           #   for nested-block bindings pending validation)
    scope_path: tuple[str, ...] = ()
```

In `symbol_bridge.py:365-377`, replace `BindingBasis`:

```python
@dataclass
class BindingBasis:
    """Evidence + red-flag set for an entire function's bindings.

    Returned alongside the Binding list by `list_bindings_with_basis`.
    Lets callers explain WHY each binding got its confidence label,
    and lets `var-to-virtual --basis` surface the heuristic's inputs.
    """
    parsed_params: list[LocalDecl]
    parsed_locals: list[LocalDecl]
    observed_virtuals: list[int]      # destinations seen in pre-pass, >=32, in order
    unrecognized_decls: list[str]     # decl-shaped statements the parser couldn't handle
    red_flags: list[str]              # human-readable concerns
    # Phase-1 grouped view:
    decls_by_scope: dict[tuple[str, ...], list[LocalDecl]] = field(default_factory=dict)
```

Ensure `from dataclasses import dataclass, field` is present at the top of the file (it already is per the existing imports).

- [ ] **Step 5.4: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py -v --no-cov
```
Expected: all existing tests still pass + 3 new tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: extend LocalDecl/Binding/BindingBasis with scope_path (Task 5)"
```

---

## Task 6: Bridge — primary path uses ast_walker, regex stays as fallback

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py:408-432` (`_collect_basis`)
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py:421-422` (remove nested-decl red flag)

- [ ] **Step 6.1: Write failing test for primary-path AST use**

Append to `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`:

```python
def test_list_bindings_with_basis_surfaces_nested_decls() -> None:
    """A function with a nested block returns LocalDecls in both
    top-level and nested scope_paths via decls_by_scope."""
    from src.mwcc_debug.symbol_bridge import list_bindings_with_basis
    from src.mwcc_debug.parser import Pass, Block, Instruction

    source = (
        "void f(int arg0) {\n"
        "    int outer;\n"
        "    if (arg0) {\n"
        "        int inner;\n"
        "    }\n"
        "}\n"
    )
    # Synthetic pre-pass with destinations: r32 (outer), r33 (inner).
    pp = Pass(name="AFTER PEEPHOLE FORWARD")
    pp.blocks.append(Block(index=0, succ=[], pred=[], labels=[]))
    pp.blocks[0].instructions = [
        Instruction(opcode="li", operands="r32,0", annotations=[], regs=[("r", 32)]),
        Instruction(opcode="li", operands="r33,0", annotations=[], regs=[("r", 33)]),
    ]
    bindings, basis = list_bindings_with_basis(source, "f", pp)

    # Scope grouping was populated by the AST walker.
    scope_groups = list(basis.decls_by_scope.values())
    all_names = {d.name for group in scope_groups for d in group}
    assert "outer" in all_names
    assert "inner" in all_names


def test_list_bindings_no_longer_emits_nested_decl_red_flag() -> None:
    """Removing the nested-decl red flag: bindings on a function with
    nested blocks are no longer demoted to low-confidence."""
    from src.mwcc_debug.symbol_bridge import list_bindings_with_basis
    from src.mwcc_debug.parser import Pass, Block, Instruction

    source = (
        "void f(int arg0) {\n"
        "    int outer;\n"
        "    if (arg0) { int inner; }\n"
        "}\n"
    )
    pp = Pass(name="AFTER PEEPHOLE FORWARD")
    pp.blocks.append(Block(index=0, succ=[], pred=[], labels=[]))
    pp.blocks[0].instructions = [
        Instruction(opcode="li", operands="r32,0", annotations=[], regs=[("r", 32)]),
        Instruction(opcode="li", operands="r33,0", annotations=[], regs=[("r", 33)]),
    ]
    _, basis = list_bindings_with_basis(source, "f", pp)
    assert "nested-decl" not in basis.red_flags
```

- [ ] **Step 6.2: Run tests, verify fail**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_list_bindings_with_basis_surfaces_nested_decls tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_list_bindings_no_longer_emits_nested_decl_red_flag -v --no-cov
```
Expected: 2 FAIL (current bridge doesn't expose `decls_by_scope`; still emits `nested-decl` red flag).

- [ ] **Step 6.3: Add primary AST path to `_collect_basis`**

Replace the body of `_collect_basis` in `symbol_bridge.py:380-432`:

```python
def _collect_basis(
    body_text: str,
    params_text: str,
    pre_pass,
    *,
    function_name: Optional[str] = None,
    full_source: Optional[str] = None,
) -> tuple[list[LocalDecl], list[LocalDecl], list[int], list[str], list[str], dict[tuple[str, ...], list[LocalDecl]]]:
    """Collect the raw inputs used by `list_bindings`'s heuristic.

    Returns (params, locals, observed_virtuals, unrecognized_decls,
    red_flags, decls_by_scope). When `function_name` and `full_source`
    are provided, uses the tree-sitter AST walker (which sees nested
    blocks); falls back to the legacy regex walker otherwise OR if
    tree-sitter is unavailable.
    """
    unrecognized: list[str] = []
    decls_by_scope: dict[tuple[str, ...], list[LocalDecl]] = {}

    ast_succeeded = False
    locals_: list[LocalDecl] = []

    if function_name is not None and full_source is not None:
        try:
            from . import ast_walker as _aw
            ast_decls = _aw.walk_function(full_source, function_name, path=None)
            # Convert ast_walker.LocalDecl to symbol_bridge.LocalDecl
            # (same shape; types are duck-compatible since we extended
            # symbol_bridge.LocalDecl in Task 5).
            locals_ = [LocalDecl(
                name=d.name,
                type_str=d.type_str,
                decl_index=d.decl_index,
                line_no=d.line_no,
                byte_range=d.byte_range,
                scope_path=d.scope_path,
                scope_byte_range=d.scope_byte_range,
                has_initializer=d.has_initializer,
                initializer_line_no=d.initializer_line_no,
            ) for d in ast_decls]
            for d in locals_:
                decls_by_scope.setdefault(d.scope_path, []).append(d)
            ast_succeeded = True
        except _aw.AstUnavailableError:
            pass  # fall back to regex
        except _aw.AstWalkError:
            pass  # fall back to regex

    if not ast_succeeded:
        # Legacy regex fallback (preserves pre-Phase-1 behavior).
        locals_ = walk_local_decls(body_text, on_unrecognized=unrecognized.append)
        # Populate decls_by_scope with a single top-level entry under
        # the fallback function name (or empty tuple if unknown).
        fallback_scope: tuple[str, ...] = (function_name,) if function_name else ()
        for d in locals_:
            # Patch the legacy decls to carry scope_path = fallback_scope
            d.scope_path = fallback_scope
        decls_by_scope[fallback_scope] = list(locals_)

    params = _parse_params(params_text)
    virtuals = _collect_virtual_destinations(pre_pass)

    red_flags: list[str] = []
    if unrecognized:
        red_flags.append("unrecognized-decl")

    # NOTE: the "nested-decl" red flag was removed in Phase 1 of nested-
    # block-local awareness. The AST walker now sees nested decls, so
    # demoting all nested-bearing functions to low-confidence was
    # incorrect.

    # Static-local detection (still useful — those don't get virtuals).
    stripped = _strip_strings_and_comments(body_text)
    if re.search(r"\bstatic\s+[A-Za-z_]", stripped):
        red_flags.append("static-local")

    # Compiler-introduced virtuals overshoot.
    if len(virtuals) >= len(params) + len(locals_) + 3:
        red_flags.append("extra-virtuals")

    return params, locals_, virtuals, unrecognized, red_flags, decls_by_scope
```

Now update the only caller of `_collect_basis`, which is
`list_bindings_with_basis`. Read its existing body first
(`tools/melee-agent/src/mwcc_debug/symbol_bridge.py:558-644`).

The actual `_extract_function_text` signature returns
`Optional[tuple[str, str, int]]` = `(params_text, body_text,
start_line)`. The existing code at line 589-592 unpacks the 3-tuple
correctly:

```python
extracted = _extract_function_text(source, fn_name)
if extracted is None:
    return [], None
params_text, body_text, start_line = extracted
```

Phase 1 changes are surgical — DO NOT rewrite the whole function:

1. Modify the `_collect_basis(...)` call to pass the new kwargs and
   unpack the new 6-tuple:
   ```python
   (params, locals_, virtuals, unrecognized, red_flags,
    decls_by_scope) = _collect_basis(
       body_text, params_text, pre_pass,
       function_name=fn_name, full_source=source,
   )
   ```
2. Modify the `BindingBasis(...)` construction at the end of the
   function (find it — it's after the bindings loop) to pass the new
   `decls_by_scope` kwarg:
   ```python
   return out, BindingBasis(
       parsed_params=params,
       parsed_locals=locals_,
       observed_virtuals=virtuals,
       unrecognized_decls=unrecognized,
       red_flags=red_flags,
       decls_by_scope=decls_by_scope,    # NEW
   )
   ```
3. Leave the binding-construction loop (the three `Binding(...)` call
   sites around lines 603, 618, 627) UNCHANGED in this task. Task 7
   wires `scope_path` onto each `Binding(...)` and adds the
   `ambiguous-nested` post-pass.

There is no `_bindings_from_basis` helper — confidence assignment is
inlined in the loop. Task 7 will add the demotion helper after this
task ships clean.

- [ ] **Step 6.4: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py -v --no-cov
```
Expected: all existing tests still pass + the two new tests now pass. If existing tests fail because of the new `decls_by_scope` argument unpacking, search for `_collect_basis(` callers and update each to consume the 6-tuple.

- [ ] **Step 6.5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: bridge uses ast_walker primary path (Task 6)"
```

---

## Task 7: `ambiguous-nested` confidence for nested-block bindings

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py` (`_bindings_from_basis` or equivalent)
- Modify: `tools/melee-agent/src/mwcc_debug/tier3_search.py:67-69`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

- [ ] **Step 7.1: Write failing tests**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
def test_nested_block_bindings_default_to_ambiguous_nested() -> None:
    """Bindings whose decl has a non-trivial scope_path get
    confidence='ambiguous-nested' pending validation."""
    from src.mwcc_debug.symbol_bridge import list_bindings_with_basis
    from src.mwcc_debug.parser import Pass, Block, Instruction

    source = (
        "void f(int arg0) {\n"
        "    int outer;\n"
        "    if (arg0) { int inner; }\n"
        "}\n"
    )
    pp = Pass(name="AFTER PEEPHOLE FORWARD")
    pp.blocks.append(Block(index=0, succ=[], pred=[], labels=[]))
    pp.blocks[0].instructions = [
        Instruction(opcode="li", operands="r32,0", annotations=[], regs=[("r", 32)]),
        Instruction(opcode="li", operands="r33,0", annotations=[], regs=[("r", 33)]),
    ]
    bindings, _ = list_bindings_with_basis(source, "f", pp)
    by_name = {b.var_name: b for b in bindings}
    assert by_name["outer"].confidence in {"best-guess", "verified"}
    assert by_name["inner"].confidence == "ambiguous-nested"
```

- [ ] **Step 7.2: Run test, verify fail**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_nested_block_bindings_default_to_ambiguous_nested -v --no-cov
```
Expected: FAIL — current bindings emit `best-guess` for nested decls too.

- [ ] **Step 7.3: Wire scope_path onto each Binding and add demotion post-pass**

Search for each `Binding(...)` construction in `symbol_bridge.py`:

```bash
grep -n "Binding(" tools/melee-agent/src/mwcc_debug/symbol_bridge.py | head
```

Expect 3 sites inside `list_bindings_with_basis` (around lines 603, 618, 627). At each site, the surrounding loop has access to a `LocalDecl` variable (e.g. `decl`, `local`, `param`). Add `scope_path=decl.scope_path` as a keyword argument when constructing the Binding. For param bindings, set `scope_path=(fn_name,)` since params live at function-top scope.

Add a helper near the other private helpers in the file:

```python
def _demote_nested_to_ambiguous(bindings: list[Binding]) -> None:
    """Apply Phase-1 confidence rule: any nested-block binding gets
    'ambiguous-nested' until the empirical validation study in Task 12
    promotes it.
    """
    for b in bindings:
        if len(b.scope_path) > 1:
            # Only demote bindings whose confidence is in the
            # "could be right but not yet validated" tier.
            if b.confidence in {"best-guess", "low-confidence"}:
                b.confidence = "ambiguous-nested"
```

Call `_demote_nested_to_ambiguous(bindings)` from `list_bindings_with_basis` immediately before its `return` statement.

- [ ] **Step 7.4: Update tier3_search to skip ambiguous-nested by default**

Find the `accepted = {"best-guess", "verified"}` line in `tools/melee-agent/src/mwcc_debug/tier3_search.py` (near line 67):

```bash
grep -n 'accepted = {"best-guess"' tools/melee-agent/src/mwcc_debug/tier3_search.py
```

Replace the two-line block:

```python
accepted = {"best-guess", "verified"}
if include_low_confidence:
    accepted = accepted | {"low-confidence"}
```

with:

```python
accepted = {"best-guess", "verified"}
if include_low_confidence:
    accepted = accepted | {"low-confidence", "ambiguous-nested"}
```

- [ ] **Step 7.5: Run tests, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py tools/melee-agent/tests/test_mwcc_debug_tier3_search.py -v --no-cov
```
Expected: all pass.

- [ ] **Step 7.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/src/mwcc_debug/tier3_search.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: ambiguous-nested confidence + tier3 opt-in (Task 7)"
```

---

## Task 8: Bridge — preserve back-compat adapters for `mutators.py`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py` (verify adapters still exported)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

- [ ] **Step 8.1: Write smoke test for the back-compat adapters**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
def test_extract_function_text_still_importable() -> None:
    """mutators.py imports _extract_function_text. Phase 1 keeps it.
    Signature: returns Optional[tuple[str, str, int]] =
    (params_text, body_text, start_line)."""
    from src.mwcc_debug.symbol_bridge import _extract_function_text
    extracted = _extract_function_text("void f(int x) { int y; }", "f")
    assert extracted is not None
    params, body, start_line = extracted
    assert "int y" in body
    assert params == "int x"
    assert start_line == 1


def test_strip_strings_and_comments_still_importable() -> None:
    """mutators.py uses _strip_strings_and_comments. Phase 1 keeps it."""
    from src.mwcc_debug.symbol_bridge import _strip_strings_and_comments
    out = _strip_strings_and_comments('a = "hello"; /* c */ b = 1;')
    assert '"hello"' not in out
    assert "/* c */" not in out
    assert "b = 1" in out


def test_walk_local_decls_still_importable() -> None:
    """mutators.py uses walk_local_decls. Phase 1 keeps top-level walk."""
    from src.mwcc_debug.symbol_bridge import walk_local_decls
    out = walk_local_decls("{ int x; HSD_JObj* y; }")
    names = {d.name for d in out}
    assert "x" in names
    assert "y" in names


def test_mutators_module_imports_cleanly() -> None:
    """Smoke test: mutators imports the helpers it expects."""
    from src.mwcc_debug import mutators
    # If symbol_bridge stopped exporting required helpers, the import
    # above would have raised. Confirm the module's expected entry
    # points are still callable:
    assert callable(mutators.mutate_type_change)
    assert callable(mutators.mutate_insert_alias_before_use)
```

- [ ] **Step 8.2: Run tests, verify all pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py tools/melee-agent/tests/test_mwcc_debug_mutators.py -v --no-cov
```
Expected: ALL pass — Tasks 5–7 should have preserved the adapters. If anything fails, those helpers were inadvertently dropped; restore them as thin wrappers.

- [ ] **Step 8.3: Commit**

```bash
git add tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: smoke-test mutators back-compat adapters (Task 8)"
```

---

## Task 9: Calibration regression — confirm nested-decl red flag removal doesn't break tier3

**Files:**
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

- [ ] **Step 9.1: Write the regression test**

Append:

```python
def test_function_with_nested_block_is_no_longer_low_confidence() -> None:
    """A function that previously triggered nested-decl red flag and
    got demoted to low-confidence is now best-guess (top-level decls)
    or ambiguous-nested (nested-block decls)."""
    from src.mwcc_debug.symbol_bridge import list_bindings_with_basis
    from src.mwcc_debug.parser import Pass, Block, Instruction

    source = (
        "void f(int arg0) {\n"
        "    int top1;\n"
        "    int top2;\n"
        "    if (arg0) {\n"
        "        int nested1;\n"
        "    }\n"
        "}\n"
    )
    pp = Pass(name="AFTER PEEPHOLE FORWARD")
    pp.blocks.append(Block(index=0, succ=[], pred=[], labels=[]))
    pp.blocks[0].instructions = [
        Instruction(opcode="li", operands="r32,0", annotations=[], regs=[("r", 32)]),
        Instruction(opcode="li", operands="r33,0", annotations=[], regs=[("r", 33)]),
        Instruction(opcode="li", operands="r34,0", annotations=[], regs=[("r", 34)]),
    ]
    bindings, basis = list_bindings_with_basis(source, "f", pp)
    by_name = {b.var_name: b for b in bindings}

    # Top-level decls are no longer demoted.
    assert by_name["top1"].confidence in {"best-guess", "verified"}
    assert by_name["top2"].confidence in {"best-guess", "verified"}
    # Nested decls get the new ambiguous-nested label.
    assert by_name["nested1"].confidence == "ambiguous-nested"
    # Red flag is gone.
    assert "nested-decl" not in basis.red_flags
```

- [ ] **Step 9.2: Run, verify pass**

Run:
```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_function_with_nested_block_is_no_longer_low_confidence -v --no-cov
```
Expected: PASS.

- [ ] **Step 9.3: Commit**

```bash
git add tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: regression test for removed nested-decl red flag (Task 9)"
```

---

## Task 10: CLI — `var-to-virtual` gains `--all` + `--scope` filters with scope-annotated output

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (locate `var_to_virtual` command — search `def var_to_virtual` and the inspect-app decorator)

- [ ] **Step 10.1: Investigation — locate the existing command**

Run:
```bash
grep -n 'def var_to_virtual\|var-to-virtual' tools/melee-agent/src/cli/debug.py | head
```
Read the function body and surrounding context.

- [ ] **Step 10.2: Add a new helper to symbol_bridge for the `--all` case**

In `symbol_bridge.py`, after the existing `find_virtual_for_var` (search `def find_virtual_for_var`):

```python
def find_all_virtuals_for_var(
    bindings: list[Binding],
    var_name: str,
) -> list[Binding]:
    """Return ALL bindings whose `var_name` matches. Sorted by:
    1. Confidence rank (verified > best-guess > ambiguous-nested
       > low-confidence > others).
    2. Scope depth (top-level scope_path of length 1 before nested).
    """
    _RANK = {
        "verified": 0,
        "best-guess": 1,
        "ambiguous-nested": 2,
        "low-confidence": 3,
        "ambiguous": 4,
        "unsupported": 5,
        "rejected": 6,
    }
    matches = [b for b in bindings if b.var_name == var_name]
    matches.sort(key=lambda b: (_RANK.get(b.confidence, 99), len(b.scope_path)))
    return matches
```

- [ ] **Step 10.3: Wire CLI flags and output (surgical edits)**

The current var-to-virtual command is at
`tools/melee-agent/src/cli/debug.py:5983-6112`. Apply THREE
edits:

**Edit 1 — add two new params to the function signature** (after the
existing `basis` parameter at line 6018, before the `) -> None:` close):

```python
    all_matches: Annotated[
        bool,
        typer.Option(
            "--all",
            help="Return ALL bindings matching the name. Default picks "
                 "the highest-confidence top-level binding for back-compat.",
        ),
    ] = False,
    scope_filter: Annotated[
        Optional[str],
        typer.Option(
            "--scope",
            help="Filter bindings by scope path. Exact match by default; "
                 "trailing '/' for prefix (e.g. 'fn_X/' matches the "
                 "function and all nested blocks inside it).",
        ),
    ] = None,
```

**Edit 2 — update the import at line 6028-6031** to add the new symbols:

```python
    from ..mwcc_debug.symbol_bridge import (
        find_virtual_for_var,
        find_all_virtuals_for_var,
        list_bindings_with_basis,
    )
    from ..mwcc_debug.scope_path import format_for_display, is_nested_within
```

**Edit 3 — replace the binding-selection block** at lines 6053-6055
(`binding = next(...)`):

```python
    # Phase 1 nested-block awareness: scope-aware lookup with optional
    # --all and --scope filters. Default behavior (single binding,
    # highest confidence) preserves back-compat.
    matches = find_all_virtuals_for_var(bindings, var_name)

    if scope_filter is not None:
        scope_value = scope_filter.rstrip("/")
        prefix_mode = scope_filter.endswith("/")
        target = tuple(scope_value.split("/")) if scope_value else ()
        if prefix_mode:
            matches = [b for b in matches if is_nested_within(b.scope_path, target)]
        else:
            matches = [b for b in matches if b.scope_path == target]

    binding = matches[0] if matches else None
```

The rest of the function (lines 6057+ — the `binding is None` branch,
JSON output, text output, `--basis` dump) stays untouched at this
step. The `--all` flag is wired in via a NEW output branch added
right BEFORE the existing `if binding is None:` block:

```python
    if all_matches:
        # New --all output path — emit the full match list, then return.
        if not matches:
            if json_out:
                print(json.dumps(
                    {"var_name": var_name, "found": False, "bindings": []},
                    indent=2,
                ))
            else:
                typer.echo(
                    f"variable {var_name!r} not found in {function}",
                    err=True,
                )
            raise typer.Exit(1)
        if json_out:
            payload = {
                "var_name": var_name,
                "found": True,
                "bindings": [
                    {
                        "virtual": b.virtual,
                        "decl_line": b.decl_line,
                        "kind": b.kind,
                        "type": b.type_str,
                        "confidence": b.confidence,
                        "scope_path": list(b.scope_path),
                    } for b in matches
                ],
            }
            if basis and basis_data is not None:
                payload["basis"] = _basis_to_dict(basis_data)
            print(json.dumps(payload, indent=2))
        else:
            print(f"{var_name} ({len(matches)} matches):")
            for b in matches:
                scope_str = format_for_display(b.scope_path) or "(top)"
                print(
                    f"  -> r{b.virtual}  ({b.confidence}, "
                    f"type={b.type_str}, scope={scope_str}, "
                    f"line {b.decl_line})"
                )
        return
```

Also update the existing default-text output (around line 6090) to
include scope info:

```python
        # Existing single-binding text output — augment with scope.
        scope_str = format_for_display(binding.scope_path) or "(top)"
        print(
            f"{binding.var_name} -> r{binding.virtual}  "
            f"({binding.confidence}, type={binding.type_str}, "
            f"scope={scope_str}, line {binding.decl_line})"
        )
```

(Read the existing text-output block first to match its exact style —
the snippet above is the target shape.)

If `json` is not imported at the top of debug.py, add `import json`
near the existing imports. Check the existing var-to-virtual JSON
block — it already uses `json.dumps`, so the import is already there.

- [ ] **Step 10.4: Smoke-test via subprocess**

Add a smoke test in `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`:

```python
def test_cli_var_to_virtual_help_shows_scope_and_all_flags() -> None:
    """CLI --help mentions the new flags."""
    import subprocess
    import pathlib
    cwd = pathlib.Path(__file__).parent.parent  # tools/melee-agent
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "inspect", "var-to-virtual", "--help"],
        cwd=cwd, capture_output=True, text=True, timeout=15,
    )
    assert proc.returncode == 0
    assert "--all" in proc.stdout
    assert "--scope" in proc.stdout
```

- [ ] **Step 10.5: Run tests, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py -v --no-cov
```
Expected: all pass including the new smoke test.

- [ ] **Step 10.6: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: var-to-virtual --all + --scope flags (Task 10)"
```

---

## Task 11: CLI — `virtual-to-var` includes `scope_path` in output

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py` (locate `virtual_to_var` command)
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

- [ ] **Step 11.1: Locate the existing command**

Run:
```bash
grep -n 'def virtual_to_var\|virtual-to-var' tools/melee-agent/src/cli/debug.py | head
```

- [ ] **Step 11.2: Write a smoke test**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
def test_cli_virtual_to_var_help_mentions_scope() -> None:
    """CLI --help mentions scope in output description."""
    import subprocess
    import pathlib
    cwd = pathlib.Path(__file__).parent.parent
    proc = subprocess.run(
        ["python", "-m", "src.cli", "debug", "inspect", "virtual-to-var", "--help"],
        cwd=cwd, capture_output=True, text=True, timeout=15,
    )
    assert proc.returncode == 0
    # Verify help text was updated to mention scope (covers user's expectation)
    assert "scope" in proc.stdout.lower()
```

- [ ] **Step 11.3: Run the test, verify fail**

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_cli_virtual_to_var_help_mentions_scope -v --no-cov
```
Expected: FAIL — help string doesn't yet mention scope.

- [ ] **Step 11.4: Update `virtual-to-var` command output**

Find the `virtual-to-var` command body in `cli/debug.py`. Locate where it prints the matched binding. Augment both text and JSON output with `scope_path`:

```python
# Text output: add scope to the line that reports the match
from ..mwcc_debug.scope_path import format_for_display
scope_str = format_for_display(binding.scope_path) if binding.scope_path else ""
print(f"r{virtual} -> {binding.var_name}  ({binding.confidence}"
      f"{', scope=' + scope_str if scope_str else ''})")

# JSON output: add scope_path key
payload["scope_path"] = list(binding.scope_path)
```

Also update the command's docstring (the `"""...""" `that Typer surfaces via `--help`) to mention scope-aware output explicitly:

```python
def virtual_to_var(
    ...,
) -> None:
    """Reverse-lookup a virtual register to the source variable that
    most likely holds its value, including the variable's scope path
    (function-top vs nested-block).

    Bindings for nested-block decls have confidence='ambiguous-nested'
    pending validation; use --include-low-confidence to opt in.
    """
```

- [ ] **Step 11.5: Run tests, verify pass**

```bash
python -m pytest tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py::test_cli_virtual_to_var_help_mentions_scope -v --no-cov
```
Expected: PASS.

- [ ] **Step 11.6: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: virtual-to-var emits scope_path (Task 11)"
```

---

## Task 12: Empirical validation study — does per-scope ordinal hold?

**Files:**
- Create: `docs/mwcc-debug-nested-block-validation-2026-05-20.md`

**Goal:** Pick 3-5 functions across `mn/mnvibration.c`, `mn/mnname.c`, `mn/mnevent.c` that have nested-block decls. Run pcdump-local. Manually correlate observed virtuals to source decls. Decide whether to promote `ambiguous-nested` → `best-guess` for nested decls.

- [ ] **Step 12.1: Identify candidate functions**

For each of `mn/mnvibration.c`, `mn/mnname.c`, `mn/mnevent.c`:

```bash
# Find functions that contain nested-block declarations
python -c "
from pathlib import Path
import re
for p in [
    'src/melee/mn/mnvibration.c',
    'src/melee/mn/mnname.c',
    'src/melee/mn/mnevent.c',
]:
    text = Path(p).read_text()
    # crude: count functions whose body matches ')\\s*{' followed by a
    # declaration in the next 200 chars
    fns = re.findall(r'^(?:void|s32|u32|f32|HSD_\\w+|MnVib\\w+)\\s+(\\w+)\\(', text, re.MULTILINE)
    print(f'{p}: {len(fns)} fns')
    for fn in fns[:30]:
        print('  ', fn)
"
```

Pick 4 functions:
- `fn_80248A78` (heartbeat case — has nested-block decls inside `frame == 14.0f`).
- One function from `mnname.c` with nested decls (e.g. find via `grep -nE "if.*{" src/melee/mn/mnname.c | head`).
- One from `mnevent.c`.
- One more from `mnvibration.c` (any function with `for ... { ... }` or `if ... { ... }` body decls).

- [ ] **Step 12.2: Run pcdump-local on each function's TU and capture observed virtuals**

```bash
cd /Users/mike/code/melee
for tu in src/melee/mn/mnvibration.c src/melee/mn/mnname.c src/melee/mn/mnevent.c; do
    python -m src.cli debug pcdump-local "$tu" \
        --output "/tmp/$(basename $tu .c)_pcdump.txt" 2>&1 | tail -2
done
```

For each candidate function, read its pcdump section and list all `r3X` destination virtuals in first-def order.

- [ ] **Step 12.3: Manually correlate virtuals to source decls**

For each candidate function:
1. Open the source `.c` file.
2. Open the pcdump output.
3. For each top-level local in source order, identify which observed virtual it claims (typically the next un-claimed virtual at function entry).
4. For each nested-block local, identify which observed virtual claims it AFTER the top-level walk.
5. Tally: does the per-scope ordinal model hold (nested decl[k] → next un-claimed virtual)?

Record results in `docs/mwcc-debug-nested-block-validation-2026-05-20.md`:

```markdown
# Nested-block per-scope ordinal validation — 2026-05-20

Tested 4 functions for the Phase-1 bridge's per-scope ordinal heuristic.

## Methodology

For each candidate function, manually correlate AST `LocalDecl`s
(in source order, grouped by scope) against `observed_virtuals`
from the pre-pass.

The per-scope ordinal model predicts: top-level decls claim virtuals
in source order; nested-block decls claim the next un-claimed
virtuals after top-level walk completes.

## Results

| Function | Top-level decls | Nested decls | Top match | Nested match | Pass? |
|----------|-----------------|--------------|-----------|--------------|-------|
| fn_80248A78 | <N> | <M> | <X/N> | <Y/M> | <yes/no> |
| <fn2> | ... | ... | ... | ... | ... |
| <fn3> | ... | ... | ... | ... | ... |
| <fn4> | ... | ... | ... | ... | ... |

## Decision

If aggregate nested-decl correct match rate is >= 80%, the bridge's
`ambiguous-nested` confidence is promoted to `best-guess` in a
follow-up commit. Below 80%, keep `ambiguous-nested` and investigate
a better algorithm in Phase 2.

Aggregate rate: <P>%.
Decision: <promote / keep>.
```

**Placeholder gate:** Before running `git add` on the validation doc,
grep for `<` to verify no `<N>`/`<M>`/`<P>` placeholders remain.
Commit only after every `<...>` is replaced with measured values or
a definite "yes"/"no". If the agent doesn't have data to fill them
in, the agent reports BLOCKED rather than committing template
text.

- [ ] **Step 12.4: If decision = promote, follow-up commit on the demotion**

If the validation supports promotion, edit `_demote_nested_to_ambiguous`
in `symbol_bridge.py`:

```python
def _demote_nested_to_ambiguous(bindings: list[Binding]) -> None:
    """Phase-1 promotion: empirical validation (see
    docs/mwcc-debug-nested-block-validation-2026-05-20.md) showed
    the per-scope ordinal model holds for nested decls. Nested
    bindings keep the same confidence as their top-level counterparts.
    """
    # No-op after validation — kept as a hook for future demotion rules.
    return
```

Also: **rename** the now-baseline Task 7 test
`test_nested_block_bindings_default_to_ambiguous_nested` to
`test_nested_block_bindings_pre_promotion_baseline_DELETE_ME` and add
a new test `test_nested_block_bindings_after_promotion_are_best_guess`
that asserts nested decls now get `best-guess`. The renamed
baseline test gets removed in the SAME commit (use git rm or the
agent's edit-then-delete approach). This way each commit's
regression test set is internally consistent.

If decision = keep, leave the Task 7 test as-is. No `_demote_…`
edit needed.

- [ ] **Step 12.5: Commit**

```bash
git add docs/mwcc-debug-nested-block-validation-2026-05-20.md \
        tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "nested-block: empirical validation study + (promotion/keep) (Task 12)"
```

---

## Task 13: Macro-tolerance validation + tier3-search dry-run before/after

**Files:**
- Create: `docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md`

- [ ] **Step 13.1: Macro-tolerance check on 10+ mn functions**

Run `ast_walker.walk_function` against 10 representative functions across `mn/mnvibration.c`, `mn/mnname.c`, `mn/mnevent.c`. For each, record whether `walk_function` returned cleanly or raised `AstWalkError`.

```bash
python -c "
from pathlib import Path
from src.mwcc_debug.ast_walker import walk_function, AstWalkError
import re

for tu in ['src/melee/mn/mnvibration.c', 'src/melee/mn/mnname.c', 'src/melee/mn/mnevent.c']:
    text = Path(tu).read_text()
    fns = re.findall(r'^(?:void|s32|u32|f32|HSD_\\w+|MnVib\\w+)\\s+(\\w+)\\(', text, re.MULTILINE)[:5]
    for fn in fns:
        try:
            decls = walk_function(text, fn, path=tu)
            print(f'{tu} :: {fn}: OK ({len(decls)} decls)')
        except AstWalkError as e:
            print(f'{tu} :: {fn}: FAIL line {e.line_no}: {e}')
        except Exception as e:
            print(f'{tu} :: {fn}: UNEXPECTED {type(e).__name__}: {e}')
"
```

Record results in `docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md`:

```markdown
# Tree-sitter macro tolerance — 2026-05-20

Validated `ast_walker.walk_function` on 15 representative mn-module
functions. Fallback rate target: < 10%.

## Results

| TU | Function | Outcome |
|----|----------|---------|
| mnvibration.c | fn_80248A78 | OK (N decls) |
| mnvibration.c | fn_80247510 | OK / FAIL line LL |
| ... |

Total: <N>/15 succeeded.
Fallback rate: <P>%.

## Conclusion

<If pass rate >= 90%: ship as-is. Else: increase tolerance of error
nodes in walk_function (loosen _has_decl_enclosing_error).>
```

- [ ] **Step 13.2: tier3-search seed-count comparison on 5 functions**

`tier3-search` has no `--dry-run` flag in the CLI, but it logs its seed plan before running per-seed permute. We compare seed counts by capturing the first ~20 lines of output (which lists the planned seeds) and stopping the run after the seed-plan summary.

For each of 5 representative functions, capture the seed plan
header that `tier3-search` prints before per-seed permute runs. The
verified output line format is:

```
[tier3] 5 seed plans:
  seed0: insert-alias before first use of <var> (<type>)
  seed1: type-change <var>: <from> -> <to>
  ...
```

Setting `--per-seed-time 0 --total-time 0` causes the permute loop
to skip every seed after printing the plan.

```bash
for fn in fn_80248A78 mnVibration_80248644 mnName_GetPageCount mnEvent_8024CE74 fn_802487A8; do
    echo "=== $fn ==="
    timeout 30 python -m src.cli debug tier3-search -f "$fn" \
        --include-low-confidence --per-seed-time 0 --total-time 0 2>&1 | \
        grep -E "^\[tier3\] [0-9]+ seed plans|^  seed[0-9]+:" | head -20
done
```

The `[tier3] N seed plans:` line gives the count directly. If a
function is not found in `report.json` (e.g. unmapped fn_), skip
that function and pick another.

Append a section to `docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md`:

```markdown
## tier3-search seed-count snapshot (Phase 1)

Captured on current master (Phase 1 landed):

| Function | Seed count | Notes |
|----------|------------|-------|
| fn_80248A78 | <N> | <bridge sees N nested decls now> |
| mnVibration_80248644 | <N> | <comment> |
| mnName_GetPageCount | <N> | ... |
| mnEvent_8024CE74 | <N> | ... |
| fn_802487A8 | <N> | ... |

This snapshot is the baseline for future regression checks. The
pre-Phase-1 seed count is recoverable by reverting to a tag before
the Phase-1 merge and re-running.
```

We don't gate the merge on a specific delta — the bridge's seed
set is *expected* to shift as nested-decl visibility unlocks more
candidates. The snapshot is for future regression diffing, not for
this merge.

- [ ] **Step 13.3: Commit**

```bash
git add docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md
git commit -m "nested-block: macro tolerance + tier3-search dry-run validation (Task 13)"
```

---

## Task 14: Full suite + final verification

**Files:** (verification only)

- [ ] **Step 14.1: Run the full test suite**

```bash
cd /Users/mike/code/melee
python -m pytest tools/melee-agent/tests/ --no-cov 2>&1 | tail -5
```
Expected: all pass. Target: 731 → ~758 (existing + ~27 new).

- [ ] **Step 14.2: Run all bridge-impact tests**

```bash
python -m pytest \
    tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py \
    tools/melee-agent/tests/test_ast_walker.py \
    tools/melee-agent/tests/test_scope_path.py \
    tools/melee-agent/tests/test_coalesce_ir_facts.py \
    tools/melee-agent/tests/test_mwcc_debug_mutators.py \
    tools/melee-agent/tests/test_mwcc_debug_tier3_search.py \
    -v --no-cov
```
Expected: all pass.

- [ ] **Step 14.3: Real-world smoke test — `var-to-virtual data2 -f fn_80248A78`**

```bash
cd tools/melee-agent
python -m src.cli debug inspect var-to-virtual data2 -f fn_80248A78 2>&1 | head -5
```
Expected: prints a binding for `data2` with `scope=fn_80248A78/block@l...` (NOT "variable not found").

```bash
python -m src.cli debug inspect var-to-virtual data2 -f fn_80248A78 --all 2>&1 | head -10
```
Expected: prints all bindings if shadowed; just the one if not.

- [ ] **Step 14.4: Real-world smoke test — `virtual-to-var <N> -f fn_80248A78`**

Pick a virtual N that you know corresponds to a nested-block decl (from Task 12's validation study). Run:

```bash
python -m src.cli debug inspect virtual-to-var <N> -f fn_80248A78 2>&1 | head -5
```
Expected: prints `r<N> -> <name> (ambiguous-nested or best-guess, scope=fn_80248A78/block@l...)`.

- [ ] **Step 14.5: If everything passes — done.**

The plan is complete. Phase 2 (mutate-aware insertion + scope-aware enumerate-decl-orders) is a separate spec/plan.
