# Attempt Fingerprint Dedup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect repeat decomp attempts by fingerprinting the post-edit source state of the target function at `tools/checkdiff.py` time; warn the agent and avoid re-recording identical attempts in the ledger.

**Architecture:** A new `fingerprint.py` module uses the existing tree-sitter-c parser (extracted to a shared `common/tree_sitter_c.py`, alongside the existing `_find_function_definition` helper) to slice the target function's body from its source file and compute two SHA1 fingerprints: `raw` (body with comments stripped) and `normalized` (raw + whitespace collapsed, so reformat-only edits are equivalent). `tracking.py` gets new helpers (`find_attempt_by_fp`, `increment_replay`) plus three optional kwargs on `record_attempt`. `tools/checkdiff.py` adds a pre-build lookup phase, a post-build 3-way classifier (novel / repeat / divergent) extracted into a `record_post_build_attempt` helper for testability, a `[REPEAT]` / `[DIVERGENT REPEAT]` banner, and `--no-fingerprint` / `--dry-run` flags. All ledger I/O reuses the existing JSON file at `~/.config/decomp-me/attempt_ledger.json` and its `file_lock` primitive.

**Tech Stack:** Python 3.11+, `tree-sitter` + `tree-sitter-c` (already in `pyproject.toml`), `pytest`, `typer` (existing CLI framework, only for shared imports).

**Spec:** `docs/superpowers/specs/2026-05-21-attempt-fingerprint-dedup-design.md`

---

## File Structure

**Created:**
- `tools/melee-agent/src/common/__init__.py` — marks the new `common` package
- `tools/melee-agent/src/common/tree_sitter_c.py` — shared tree-sitter-c parser bootstrap
- `tools/melee-agent/src/cli/fingerprint.py` — `extract_function_body`, `compute_fingerprint`, `fingerprint_for`
- `tools/melee-agent/tests/test_fingerprint.py` — unit tests for fingerprint module
- `tools/melee-agent/tests/test_tracking_fingerprint.py` — unit tests for tracking.py extensions
- `tools/melee-agent/tests/test_checkdiff_fingerprint.py` — integration tests for checkdiff
- `tools/melee-agent/tests/fixtures/fingerprint/sample.c` — small C source for fingerprint tests
- `tools/melee-agent/tests/fixtures/fingerprint/report_sample.json` — stub objdiff report for `--dry-run`

**Modified:**
- `tools/melee-agent/src/mwcc_debug/ast_walker.py` — import parser from `common/tree_sitter_c.py` instead of defining it locally
- `tools/melee-agent/src/cli/tracking.py` — add `fingerprint`/`fingerprint_norm`/`source_file` optional kwargs to `record_attempt`; add new `find_attempt_by_fp` and `increment_replay` helpers
- `tools/checkdiff.py` — pre-build fingerprint lookup, post-build classifier, banner output, `--no-fingerprint` flag, `CHECKDIFF_NO_FINGERPRINT` env var, `--dry-run` flag

---

## Task 1: Extract tree-sitter bootstrap into shared `common/tree_sitter_c.py`

**Files:**
- Create: `tools/melee-agent/src/common/__init__.py`
- Create: `tools/melee-agent/src/common/tree_sitter_c.py`
- Modify: `tools/melee-agent/src/mwcc_debug/ast_walker.py` (lines 18–27)
- Test: existing `tools/melee-agent/tests/test_ast_walker.py` (must still pass)

- [ ] **Step 1: Create the empty `common` package marker**

```bash
mkdir -p tools/melee-agent/src/common
touch tools/melee-agent/src/common/__init__.py
```

- [ ] **Step 2: Write the shared parser module + helpers**

Create `tools/melee-agent/src/common/tree_sitter_c.py`. This file holds
the parser bootstrap **and** the two helpers (`_node_text` and
`_find_function_definition`) currently in `ast_walker.py` so that both
`ast_walker.py` and the new `fingerprint.py` can reuse them without
duplicating logic. The `except` clause widens to `Exception` to catch
ABI-mismatched wheel failures (not just `ImportError`).

```python
"""Shared tree-sitter-c parser bootstrap and AST helpers.

Single import site for the tree_sitter / tree_sitter_c wheels so multiple
callers (mwcc_debug.ast_walker, cli.fingerprint, ...) don't each maintain
their own try/except + module-level objects.

Also exposes function-locator helpers (`find_function_definition`,
`node_text`) that were previously private to ast_walker.py.
"""
from __future__ import annotations

from typing import Optional


class TreeSitterUnavailableError(ImportError):
    """Raised when callers ask for a parser but tree-sitter is missing."""


try:
    import tree_sitter
    import tree_sitter_c
    _LANGUAGE = tree_sitter.Language(tree_sitter_c.language())
    _PARSER = tree_sitter.Parser(_LANGUAGE)
    _AVAILABLE = True
except Exception:  # noqa: BLE001 — ImportError or ABI mismatch on bad wheel
    _LANGUAGE = None
    _PARSER = None
    _AVAILABLE = False


def is_available() -> bool:
    """True if tree-sitter and tree-sitter-c are importable."""
    return _AVAILABLE


def get_parser():
    """Return the shared tree-sitter parser; raise if unavailable."""
    if not _AVAILABLE:
        raise TreeSitterUnavailableError(
            "tree-sitter or tree-sitter-c is not installed"
        )
    return _PARSER


def get_language():
    """Return the tree-sitter-c language object; raise if unavailable."""
    if not _AVAILABLE:
        raise TreeSitterUnavailableError(
            "tree-sitter or tree-sitter-c is not installed"
        )
    return _LANGUAGE


def node_text(source_bytes: bytes, node) -> str:
    """Return the source slice for a tree-sitter node, UTF-8 decoded."""
    return source_bytes[node.start_byte:node.end_byte].decode(
        "utf-8", errors="replace"
    )


def find_function_definition(root, source_bytes: bytes, fn_name: str):
    """Search the tree for a function_definition whose declarator name
    matches `fn_name`. Returns the function_definition node or None.

    Handles function-pointer return types and pointer_declarator wrappers
    by unwrapping the declarator chain until an identifier is reached.
    """
    stack = [root]
    while stack:
        node = stack.pop()
        if node.type == "function_definition":
            decl = node.child_by_field_name("declarator")
            while decl is not None and decl.type != "identifier":
                inner = decl.child_by_field_name("declarator")
                if inner is None:
                    break
                decl = inner
            if decl is not None and decl.type == "identifier":
                if node_text(source_bytes, decl) == fn_name:
                    return node
        for child in node.children:
            stack.append(child)
    return None
```

- [ ] **Step 3: Update `ast_walker.py` to use the shared bootstrap and helpers**

In `tools/melee-agent/src/mwcc_debug/ast_walker.py`:

(a) Replace lines 18–27 (the local try/except parser bootstrap):

```python
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
```

with:

```python
from src.common import tree_sitter_c as _ts_module
from src.common.tree_sitter_c import (
    node_text as _node_text,
    find_function_definition as _find_function_definition,
)

_TS_AVAILABLE = _ts_module.is_available()
_LANGUAGE = _ts_module.get_language() if _TS_AVAILABLE else None
_PARSER = _ts_module.get_parser() if _TS_AVAILABLE else None
```

(b) **Delete** the now-duplicate local `_node_text` (lines 183–184) and `_find_function_definition` (lines 187–208). The imported aliases preserve the underscore-prefix so existing call sites (e.g. line 359) need no change.

`AstUnavailableError` (defined at line 49 in `ast_walker.py`) stays where it is for backward-compat with existing callers.

- [ ] **Step 4: Run the existing ast_walker tests to confirm no regression**

Run: `cd tools/melee-agent && uv run pytest tests/test_ast_walker.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/common/__init__.py \
        tools/melee-agent/src/common/tree_sitter_c.py \
        tools/melee-agent/src/mwcc_debug/ast_walker.py
git commit -m "refactor: extract tree-sitter-c parser + function locator into common package"
```

---

## Task 2: Create fingerprint test fixtures

**Files:**
- Create: `tools/melee-agent/tests/fixtures/fingerprint/sample.c`
- Create: `tools/melee-agent/tests/fixtures/fingerprint/report_sample.json`

- [ ] **Step 1: Write the sample C source**

Create `tools/melee-agent/tests/fixtures/fingerprint/sample.c`:

```c
#include <stdint.h>

typedef uint32_t u32;
typedef uint8_t u8;

#pragma auto_inline off

void fn_alpha(u32 arg0) {
    u32 buttons;
    u8 sel;
    int i;

    buttons = arg0;
    for (i = 0; i < 10; i++) {
        sel = (u8) i;
        buttons |= sel;
    }
}

/* fn_beta has the same body shape as fn_alpha but a different name */
void fn_beta(u32 arg0) {
    u32 buttons;
    u8 sel;
    int i;

    buttons = arg0;
    for (i = 0; i < 10; i++) {
        sel = (u8) i;
        buttons |= sel;
    }
}

/* fn_gamma uses a function-pointer return type to exercise tree-sitter
   on a tricky declarator. */
int (*fn_gamma(void))(int) {
    return 0;
}

#pragma auto_inline reset
```

- [ ] **Step 2: Write the stub report.json**

Create `tools/melee-agent/tests/fixtures/fingerprint/report_sample.json`:

```json
{
  "units": [
    {
      "name": "main/melee/mn/sample",
      "functions": [
        {"name": "fn_alpha", "fuzzy_match_percent": 87.2},
        {"name": "fn_beta",  "fuzzy_match_percent": 73.4},
        {"name": "fn_gamma", "fuzzy_match_percent": 100.0}
      ]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/fixtures/fingerprint/sample.c \
        tools/melee-agent/tests/fixtures/fingerprint/report_sample.json
git commit -m "test: add fingerprint fixtures (sample C source + stub report)"
```

---

## Task 3: `fingerprint.py` — `extract_function_body` (tree-sitter path)

**Files:**
- Create: `tools/melee-agent/src/cli/fingerprint.py`
- Test: `tools/melee-agent/tests/test_fingerprint.py`

- [ ] **Step 1: Write the failing tests**

Create `tools/melee-agent/tests/test_fingerprint.py`:

```python
"""Tests for tools/melee-agent/src/cli/fingerprint.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from src.cli.fingerprint import (
    extract_function_body,
    compute_fingerprint,
    fingerprint_for,
)

FIXTURES = Path(__file__).parent / "fixtures" / "fingerprint"
SAMPLE_C = FIXTURES / "sample.c"


def test_extract_alpha_body_contains_loop():
    body = extract_function_body(SAMPLE_C, "fn_alpha")
    assert body is not None
    assert "for (i = 0; i < 10; i++)" in body
    assert "buttons = arg0;" in body
    # Signature must not be inside the extracted body
    assert "void fn_alpha" not in body


def test_extract_returns_none_for_unknown_function():
    assert extract_function_body(SAMPLE_C, "no_such_function") is None


def test_extract_handles_function_pointer_return_type():
    body = extract_function_body(SAMPLE_C, "fn_gamma")
    assert body is not None
    assert "return 0;" in body


def test_extract_returns_none_for_missing_file(tmp_path):
    nonexistent = tmp_path / "does_not_exist.c"
    assert extract_function_body(nonexistent, "fn_alpha") is None
```

- [ ] **Step 2: Run tests to verify they fail (module doesn't exist yet)**

Run: `cd tools/melee-agent && uv run pytest tests/test_fingerprint.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'src.cli.fingerprint'`.

- [ ] **Step 3: Write the minimal module to make tests pass**

Create `tools/melee-agent/src/cli/fingerprint.py`. The tree-sitter
extraction reuses `find_function_definition` from
`src/common/tree_sitter_c.py` (extracted in Task 1) — do **not**
re-implement function-locator logic here.

```python
"""Source-state fingerprinting for matched-function attempts.

Used by tools/checkdiff.py to detect when an agent has applied the same
source change to the same function on a previous attempt, and to
auto-record attempt outcomes in the ledger.

Public API:
    extract_function_body(source_path, function_name) -> str | None
    compute_fingerprint(function_body) -> (raw, normalized)
    fingerprint_for(source_path, function_name) -> Fingerprint | None
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.common import tree_sitter_c as _ts
from src.common.tree_sitter_c import find_function_definition, node_text


@dataclass(frozen=True)
class Fingerprint:
    raw: str
    normalized: str
    body: str  # the extracted body text (useful for debugging / tests)


def _trim_body(body: str) -> str:
    """Common normalization applied to BOTH extraction paths so they
    produce identical raw hashes for identical inputs.

    1. Strip a leading/trailing newline (cosmetic, tree-sitter often
       includes them inside the `compound_statement` extent)
    2. Do NOT collapse internal whitespace — that's the job of the
       normalized fingerprint.
    """
    return body.strip("\n")


def _extract_via_tree_sitter(source_bytes: bytes, function_name: str) -> Optional[str]:
    """Use tree-sitter-c to locate the function and return its body text."""
    if not _ts.is_available():
        return None
    parser = _ts.get_parser()
    tree = parser.parse(source_bytes)
    fn_node = find_function_definition(tree.root_node, source_bytes, function_name)
    if fn_node is None:
        return None

    body_node = fn_node.child_by_field_name("body")
    if body_node is None or body_node.type != "compound_statement":
        return None

    # Slice INSIDE the outermost braces by byte offset. The
    # compound_statement extent runs from '{' to '}' inclusive, so we
    # skip the first and last byte. Falls back to None on a degenerate
    # zero-byte body (which shouldn't happen but defends against
    # PARSE_SKIP_FUNCTION_BODIES-style anomalies).
    if body_node.end_byte - body_node.start_byte < 2:
        return None
    body_bytes = source_bytes[body_node.start_byte + 1:body_node.end_byte - 1]
    return _trim_body(body_bytes.decode("utf-8", errors="replace"))


def extract_function_body(source_path: Path, function_name: str) -> Optional[str]:
    """Return the source text inside function_name's outermost braces.

    Returns None if the file doesn't exist, the function isn't found, or
    extraction fails. The caller should treat None as "no fingerprint
    available; skip dedup for this attempt."
    """
    try:
        source_bytes = Path(source_path).read_bytes()
    except (OSError, FileNotFoundError):
        return None

    return _extract_via_tree_sitter(source_bytes, function_name)


def compute_fingerprint(function_body: str) -> tuple[str, str]:
    """Return (raw_fingerprint, normalized_fingerprint) — 12-char hex SHA1
    prefixes. raw = sha1 of body with comments stripped; normalized = sha1
    of whitespace-collapsed comment-stripped body."""
    # Strip block comments first, then line comments
    no_block = re.sub(r"/\*.*?\*/", "", function_body, flags=re.DOTALL)
    no_comments = re.sub(r"//[^\n]*", "", no_block)
    raw = hashlib.sha1(no_comments.encode("utf-8", errors="replace")).hexdigest()[:12]

    collapsed = re.sub(r"\s+", " ", no_comments).strip()
    normalized = hashlib.sha1(collapsed.encode("utf-8", errors="replace")).hexdigest()[:12]

    return raw, normalized


def fingerprint_for(source_path: Path, function_name: str) -> Optional[Fingerprint]:
    """Extract + compute. Returns None on extraction failure."""
    body = extract_function_body(source_path, function_name)
    if body is None:
        return None
    raw, norm = compute_fingerprint(body)
    return Fingerprint(raw=raw, normalized=norm, body=body)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_fingerprint.py -v`

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/fingerprint.py \
        tools/melee-agent/tests/test_fingerprint.py
git commit -m "feat: add fingerprint.extract_function_body via tree-sitter"
```

---

## Task 4: `fingerprint.py` — regex fallback for extraction

**Files:**
- Modify: `tools/melee-agent/src/cli/fingerprint.py`
- Test: `tools/melee-agent/tests/test_fingerprint.py`

- [ ] **Step 1: Add failing tests for the fallback**

Append to `tools/melee-agent/tests/test_fingerprint.py`:

```python
def test_regex_fallback_extracts_simple_function(monkeypatch, tmp_path):
    """When tree-sitter is unavailable, regex fallback engages."""
    from src.cli import fingerprint as fp_mod
    monkeypatch.setattr(fp_mod._ts, "is_available", lambda: False)

    source = tmp_path / "simple.c"
    source.write_text(
        "void fn_simple(int x) {\n"
        "    int y = x + 1;\n"
        "    return;\n"
        "}\n"
    )
    body = fp_mod.extract_function_body(source, "fn_simple")
    assert body is not None
    assert "int y = x + 1;" in body
    assert "void fn_simple" not in body


def test_regex_fallback_returns_none_for_unknown(monkeypatch, tmp_path):
    from src.cli import fingerprint as fp_mod
    monkeypatch.setattr(fp_mod._ts, "is_available", lambda: False)

    source = tmp_path / "simple.c"
    source.write_text("void fn_simple(int x) { int y = x; }\n")
    assert fp_mod.extract_function_body(source, "no_such_function") is None


def test_regex_fallback_handles_function_pointer_param(monkeypatch, tmp_path):
    """Parameter list with nested parens (function-pointer callback)
    must not break the parenthesis balancer."""
    from src.cli import fingerprint as fp_mod
    monkeypatch.setattr(fp_mod._ts, "is_available", lambda: False)

    source = tmp_path / "fp.c"
    source.write_text(
        "void fn_cb(int (*cb)(int)) {\n"
        "    int result = cb(0);\n"
        "}\n"
    )
    body = fp_mod.extract_function_body(source, "fn_cb")
    assert body is not None
    assert "int result = cb(0);" in body


def test_regex_fallback_does_not_match_inside_other_function(monkeypatch, tmp_path):
    """If `fn_x` only appears as a call inside `fn_y` (not as a
    definition), fallback must return None — not the body of `fn_y`."""
    from src.cli import fingerprint as fp_mod
    monkeypatch.setattr(fp_mod._ts, "is_available", lambda: False)

    source = tmp_path / "multi.c"
    source.write_text(
        "void fn_y(int x) {\n"
        "    fn_x(x);\n"
        "}\n"
    )
    # fn_x is referenced but not defined → fallback must return None
    assert fp_mod.extract_function_body(source, "fn_x") is None


def test_tree_sitter_and_regex_produce_identical_raw_for_same_input(tmp_path):
    """The two extraction paths must yield identical bodies (and thus
    identical raw fingerprints) for inputs both can parse."""
    from src.cli import fingerprint as fp_mod
    source = tmp_path / "same.c"
    source.write_text(
        "void fn_same(int x) {\n"
        "    int y = x + 1;\n"
        "    return;\n"
        "}\n"
    )
    # Tree-sitter path
    body_ts = fp_mod.extract_function_body(source, "fn_same")
    # Regex path
    import pytest
    monkeypatch = pytest.MonkeyPatch()
    try:
        monkeypatch.setattr(fp_mod._ts, "is_available", lambda: False)
        body_regex = fp_mod.extract_function_body(source, "fn_same")
    finally:
        monkeypatch.undo()
    assert body_ts is not None
    assert body_regex is not None
    assert body_ts == body_regex
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/melee-agent && uv run pytest tests/test_fingerprint.py::test_regex_fallback_extracts_simple_function -v`

Expected: FAIL (no fallback implemented yet — returns None).

- [ ] **Step 3: Implement the regex fallback**

In `tools/melee-agent/src/cli/fingerprint.py`, add this helper before `extract_function_body`. The pattern is anchored to start-of-line and balances *parentheses* (not just `[^)]*`) so it doesn't mis-match function-pointer parameters like `void fn(int (*cb)(int))`. **Conservative by design** — when in doubt, returns None (no fingerprint), never a wrong body.

```python
# Signature head: <line start> + non-greedy stuff + name + '(' .
# We require the function name at a word boundary preceded by a return
# type or whitespace (anchored to line start to avoid matching the name
# inside a string literal or another function's body).
_SIG_HEAD = re.compile(
    rf"^[ \t]*(?:[\w\*\s]+?[\s\*])?{{NAME}}\s*\(",
    re.MULTILINE,
)


def _extract_via_regex(source_text: str, function_name: str) -> Optional[str]:
    """Cheap fallback when tree-sitter isn't available.

    Matches the signature line `<return type> function_name (` at start
    of line, parenthesis-balances to the closing paren, then
    brace-balances to find the matching closing brace. Returns None on
    any ambiguity — a false negative is fine (caller records the
    attempt without a fingerprint), but a false positive (wrong body)
    would silently corrupt the ledger.
    """
    pattern_src = _SIG_HEAD.pattern.replace("{NAME}", re.escape(function_name))
    pattern = re.compile(pattern_src, re.MULTILINE)
    match = pattern.search(source_text)
    if match is None:
        return None
    # Balance the parameter parens.
    paren_start = match.end() - 1  # position of the '('
    depth = 1
    i = paren_start + 1
    while i < len(source_text) and depth > 0:
        ch = source_text[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        i += 1
    if depth != 0:
        return None
    # Skip whitespace, expect '{'.
    while i < len(source_text) and source_text[i].isspace():
        i += 1
    if i >= len(source_text) or source_text[i] != "{":
        return None
    brace_start = i + 1
    depth = 1
    i = brace_start
    while i < len(source_text) and depth > 0:
        ch = source_text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        i += 1
    if depth != 0:
        return None
    body = source_text[brace_start:i - 1]
    return _trim_body(body)
```

And modify `extract_function_body` to call the fallback:

```python
def extract_function_body(source_path: Path, function_name: str) -> Optional[str]:
    """Return the source text inside function_name's outermost braces.

    Tries tree-sitter first; falls back to a brace-balancing regex if
    tree-sitter is unavailable or fails. Returns None on total failure.

    Both extraction paths apply the same `_trim_body` normalization, so
    a successful tree-sitter run and a successful regex run on the same
    input produce identical body text (and thus identical raw
    fingerprints).
    """
    try:
        source_bytes = Path(source_path).read_bytes()
    except (OSError, FileNotFoundError):
        return None

    body = _extract_via_tree_sitter(source_bytes, function_name)
    if body is not None:
        return body

    try:
        source_text = source_bytes.decode("utf-8", errors="replace")
    except UnicodeDecodeError:
        return None
    return _extract_via_regex(source_text, function_name)
```

- [ ] **Step 4: Run all fingerprint tests to verify**

Run: `cd tools/melee-agent && uv run pytest tests/test_fingerprint.py -v`

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/fingerprint.py \
        tools/melee-agent/tests/test_fingerprint.py
git commit -m "feat: add regex fallback for fingerprint body extraction"
```

---

## Task 5: `fingerprint.py` — `compute_fingerprint` semantic equivalence tests

**Files:**
- Test: `tools/melee-agent/tests/test_fingerprint.py`

- [ ] **Step 1: Add tests for compute_fingerprint / fingerprint_for**

Append to `tools/melee-agent/tests/test_fingerprint.py`:

```python
def test_compute_fingerprint_returns_two_distinct_hashes():
    body = "int y = x + 1;\nreturn y;"
    raw, norm = compute_fingerprint(body)
    assert len(raw) == 12
    assert len(norm) == 12
    # raw and norm differ on inputs with whitespace
    assert raw != norm


def test_compute_fingerprint_norm_ignores_whitespace_only_diff():
    body_a = "int y = x + 1;\nreturn y;"
    body_b = "int y=x+1; return y;"
    raw_a, norm_a = compute_fingerprint(body_a)
    raw_b, norm_b = compute_fingerprint(body_b)
    assert raw_a != raw_b
    assert norm_a == norm_b


def test_compute_fingerprint_norm_ignores_comments():
    body_a = "int y = x + 1; // adjust\nreturn y;"
    body_b = "int y = x + 1;\nreturn y;"
    _, norm_a = compute_fingerprint(body_a)
    _, norm_b = compute_fingerprint(body_b)
    assert norm_a == norm_b


def test_fingerprint_same_body_different_names_share_hash():
    """fn_alpha and fn_beta in sample.c have identical bodies; the
    extraction is per-function so the bodies are the same. Per-function
    scoping (no cross-function collisions) is enforced at LOOKUP TIME
    in tracking.find_attempt_by_fp, not at hash time."""
    fp_alpha = fingerprint_for(SAMPLE_C, "fn_alpha")
    fp_beta = fingerprint_for(SAMPLE_C, "fn_beta")
    assert fp_alpha is not None
    assert fp_beta is not None
    assert fp_alpha.raw == fp_beta.raw


def test_fingerprint_for_returns_none_on_extraction_failure():
    assert fingerprint_for(SAMPLE_C, "no_such_function") is None
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_fingerprint.py -v`

Expected: all 11 tests pass (no new code needed; `compute_fingerprint` and `fingerprint_for` were already implemented in Task 3).

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_fingerprint.py
git commit -m "test: lock in fingerprint norm/raw + per-function semantics"
```

---

## Task 6: Extend `tracking.py` — `record_attempt` fingerprint kwargs

**Files:**
- Modify: `tools/melee-agent/src/cli/tracking.py` (around lines 285–349)
- Test: `tools/melee-agent/tests/test_tracking_fingerprint.py`

- [ ] **Step 1: Write failing tests**

Create `tools/melee-agent/tests/test_tracking_fingerprint.py`:

```python
"""Tests for fingerprint-related extensions to src/cli/tracking.py."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.cli.tracking import record_attempt


def test_record_attempt_persists_fingerprint_fields(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    record_attempt(
        "fn_test",
        match_percent=87.2,
        outcome="neutral",
        fingerprint="abc123def456",
        fingerprint_norm="def456abc123",
        source_file="src/melee/mn/mnvibration.c",
    )

    data = json.loads(ledger.read_text())
    entry = data["functions"]["fn_test"]
    assert len(entry["attempts"]) == 1
    a = entry["attempts"][0]
    assert a["fingerprint"] == "abc123def456"
    assert a["fingerprint_norm"] == "def456abc123"
    assert a["source_file"] == "src/melee/mn/mnvibration.c"
    assert a["replay_count"] == 0
    assert a["last_replay_ts"] is None


def test_record_attempt_without_fingerprint_kwargs_still_works(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    record_attempt("fn_legacy", match_percent=50.0, outcome="neutral")
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_legacy"]["attempts"][0]
    # Fingerprint fields are absent or None — legacy callers see no
    # change in semantics.
    assert a.get("fingerprint") in (None, "")
    assert a.get("replay_count", 0) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py::test_record_attempt_persists_fingerprint_fields -v`

Expected: FAIL with `TypeError: record_attempt() got an unexpected keyword argument 'fingerprint'`.

- [ ] **Step 3: Extend `record_attempt` signature**

In `tools/melee-agent/src/cli/tracking.py`, replace the `record_attempt` signature (lines 285–296):

```python
def record_attempt(
    function_name: str,
    *,
    match_percent: float,
    outcome: str,
    note: str = "",
    classification: str = "",
    blocker: str = "",
    retained: bool = False,
    threshold: int = DEFAULT_STALL_THRESHOLD,
    path: Path | None = None,
) -> dict[str, Any]:
```

with:

```python
def record_attempt(
    function_name: str,
    *,
    match_percent: float,
    outcome: str,
    note: str = "",
    classification: str = "",
    blocker: str = "",
    retained: bool = False,
    threshold: int = DEFAULT_STALL_THRESHOLD,
    fingerprint: str = "",
    fingerprint_norm: str = "",
    source_file: str = "",
    path: Path | None = None,
) -> dict[str, Any]:
```

Then in the `attempt = { ... }` dict (around line 331), add the new fields:

```python
        attempt = {
            "index": len(entry.get("attempts", [])) + 1,
            "timestamp": time.time(),
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "agent_id": AGENT_ID,
            "worktree": str(Path.cwd()),
            "match_percent": rounded_match,
            "outcome": normalized_outcome,
            "classification": classification,
            "blocker": blocker,
            "retained": retained,
            "note": note,
            "fingerprint": fingerprint,
            "fingerprint_norm": fingerprint_norm,
            "source_file": source_file,
            "replay_count": 0,
            "last_replay_ts": None,
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py -v tests/test_attempts.py -v`

Expected: new tests pass; existing `test_attempts.py` tests continue to pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/tracking.py \
        tools/melee-agent/tests/test_tracking_fingerprint.py
git commit -m "feat(tracking): add fingerprint/source_file kwargs to record_attempt"
```

---

## Task 7: `tracking.py` — `find_attempt_by_fp` helper

**Files:**
- Modify: `tools/melee-agent/src/cli/tracking.py`
- Test: `tools/melee-agent/tests/test_tracking_fingerprint.py`

- [ ] **Step 1: Write failing tests**

Append to `tools/melee-agent/tests/test_tracking_fingerprint.py`:

```python
from src.cli.tracking import find_attempt_by_fp


def _record(fn, **kw):
    """Test helper: defaults outcome/match for brevity."""
    record_attempt(fn, match_percent=kw.pop("match", 50.0),
                   outcome=kw.pop("outcome", "neutral"), **kw)


def test_find_attempt_by_fp_returns_raw_match(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    _record("fn_x", fingerprint="aaa111", fingerprint_norm="zzz999")
    _record("fn_x", fingerprint="bbb222", fingerprint_norm="zzz999")

    result = find_attempt_by_fp("fn_x", "aaa111", "ignored")
    assert result is not None
    assert result["fingerprint"] == "aaa111"
    assert result["match_type"] == "raw"


def test_find_attempt_by_fp_returns_most_recent_raw_match(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    _record("fn_x", fingerprint="aaa111", match=50.0)
    _record("fn_x", fingerprint="aaa111", match=60.0)  # divergent retry
    result = find_attempt_by_fp("fn_x", "aaa111")
    # Most recent has match=60.0 (index 2)
    assert result["match_percent"] == 60.0
    assert result["index"] == 2


def test_find_attempt_by_fp_falls_back_to_norm(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    _record("fn_x", fingerprint="aaa111", fingerprint_norm="zzz999")
    # Different raw, same norm
    result = find_attempt_by_fp("fn_x", "different", "zzz999")
    assert result is not None
    assert result["fingerprint"] == "aaa111"
    assert result["match_type"] == "norm"


def test_find_attempt_by_fp_returns_none_on_miss(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    _record("fn_x", fingerprint="aaa111")
    assert find_attempt_by_fp("fn_x", "no_match") is None


def test_find_attempt_by_fp_returns_none_for_unknown_function(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    assert find_attempt_by_fp("fn_unknown", "anything") is None


def test_find_attempt_by_fp_ignores_entries_without_fingerprint(tmp_path, monkeypatch):
    """Legacy entries (no fingerprint field) must not produce false hits
    when the lookup fingerprint is the empty string."""
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    # Legacy-style record: no fingerprint kwargs
    record_attempt("fn_x", match_percent=50.0, outcome="neutral")
    # Empty-string lookup must not match the legacy entry
    assert find_attempt_by_fp("fn_x", "", "") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py -v -k find_attempt_by_fp`

Expected: FAIL with `ImportError: cannot import name 'find_attempt_by_fp'`.

- [ ] **Step 3: Implement `find_attempt_by_fp`**

In `tools/melee-agent/src/cli/tracking.py`, add after the existing `summarize_attempts` function:

```python
def find_attempt_by_fp(
    function_name: str,
    fingerprint: str,
    fingerprint_norm: str = "",
    *,
    path: Path | None = None,
) -> dict[str, Any] | None:
    """Locate the most-recent attempt entry whose fingerprint matches.

    Lookup order (per spec): raw `fingerprint` first; if no raw match
    AND fingerprint_norm is provided, fall back to `fingerprint_norm`.
    "Most recent" is determined by the attempt's `index` field (which
    is monotonic per function).

    Returns the matching entry dict augmented with `match_type` set to
    "raw" or "norm". Returns None if no match. An empty `fingerprint`
    string never matches (legacy entries without fingerprints).
    """
    if not fingerprint and not fingerprint_norm:
        return None

    ledger = load_attempt_ledger(path)
    entry = ledger["functions"].get(function_name)
    if not entry:
        return None

    attempts = entry.get("attempts", [])

    # Most recent raw match
    if fingerprint:
        raw_matches = [
            a for a in attempts
            if a.get("fingerprint") and a.get("fingerprint") == fingerprint
        ]
        if raw_matches:
            best = max(raw_matches, key=lambda a: a.get("index", 0))
            return {**best, "match_type": "raw"}

    # Fall back to most recent norm match
    if fingerprint_norm:
        norm_matches = [
            a for a in attempts
            if a.get("fingerprint_norm") and a.get("fingerprint_norm") == fingerprint_norm
        ]
        if norm_matches:
            best = max(norm_matches, key=lambda a: a.get("index", 0))
            return {**best, "match_type": "norm"}

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/tracking.py \
        tools/melee-agent/tests/test_tracking_fingerprint.py
git commit -m "feat(tracking): add find_attempt_by_fp lookup helper"
```

---

## Task 8: `tracking.py` — `increment_replay` helper

**Files:**
- Modify: `tools/melee-agent/src/cli/tracking.py`
- Test: `tools/melee-agent/tests/test_tracking_fingerprint.py`

- [ ] **Step 1: Write failing tests**

Append to `tools/melee-agent/tests/test_tracking_fingerprint.py`:

```python
from src.cli.tracking import increment_replay


def test_increment_replay_bumps_count_and_timestamp(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    record_attempt("fn_x", match_percent=50.0, outcome="neutral",
                   fingerprint="aaa111")

    summary = increment_replay("fn_x", attempt_index=1)
    assert summary["attempt_count"] == 1  # still 1 — no new entry
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_x"]["attempts"][0]
    assert a["replay_count"] == 1
    assert a["last_replay_ts"] is not None

    # Second replay → 2
    increment_replay("fn_x", attempt_index=1)
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_x"]["attempts"][0]
    assert a["replay_count"] == 2


def test_increment_replay_preserves_outcome_note_classification(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    record_attempt("fn_x", match_percent=50.0, outcome="reverted",
                   note="tried foo", classification="register-allocation",
                   blocker="r30/r31 swap", fingerprint="aaa111")
    increment_replay("fn_x", attempt_index=1)

    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_x"]["attempts"][0]
    assert a["outcome"] == "reverted"
    assert a["note"] == "tried foo"
    assert a["classification"] == "register-allocation"
    assert a["blocker"] == "r30/r31 swap"


def test_increment_replay_does_not_touch_streak_counter(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    record_attempt("fn_x", match_percent=50.0, outcome="neutral",
                   fingerprint="aaa111")
    data = json.loads(ledger.read_text())
    streak_before = data["functions"]["fn_x"]["no_progress_count"]

    increment_replay("fn_x", attempt_index=1)
    increment_replay("fn_x", attempt_index=1)
    increment_replay("fn_x", attempt_index=1)

    data = json.loads(ledger.read_text())
    streak_after = data["functions"]["fn_x"]["no_progress_count"]
    assert streak_after == streak_before


def test_increment_replay_raises_for_unknown_function(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    with pytest.raises(KeyError):
        increment_replay("fn_unknown", attempt_index=1)


def test_increment_replay_raises_for_unknown_index(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    record_attempt("fn_x", match_percent=50.0, outcome="neutral",
                   fingerprint="aaa111")
    with pytest.raises(KeyError):
        increment_replay("fn_x", attempt_index=999)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py -v -k increment_replay`

Expected: FAIL with `ImportError`.

- [ ] **Step 3: Implement `increment_replay`**

In `tools/melee-agent/src/cli/tracking.py`, add after `find_attempt_by_fp`:

```python
def increment_replay(
    function_name: str,
    attempt_index: int,
    *,
    path: Path | None = None,
) -> dict[str, Any]:
    """Atomically bump replay_count and last_replay_ts on a specific entry.

    Does NOT mutate the entry's outcome, note, classification, blocker, or
    the function's no_progress_count / move_on state — replays are not
    fresh experiments.

    Raises KeyError if function_name or attempt_index is unknown.
    """
    ledger_path = attempt_ledger_path(path)
    with file_lock(_lock_path(ledger_path), exclusive=True):
        ledger = _normalize_ledger(load_json_safe(ledger_path))
        functions = ledger["functions"]
        entry = functions.get(function_name)
        if entry is None:
            raise KeyError(f"unknown function: {function_name}")

        target = None
        for a in entry.get("attempts", []):
            if a.get("index") == attempt_index:
                target = a
                break
        if target is None:
            raise KeyError(f"unknown attempt index {attempt_index} for {function_name}")

        target["replay_count"] = int(target.get("replay_count") or 0) + 1
        target["last_replay_ts"] = time.time()
        entry["updated_at"] = time.time()
        ledger["updated_at"] = entry["updated_at"]

        _write_ledger_unlocked(ledger_path, ledger)
        return _summarize_entry(entry)
```

- [ ] **Step 4: Run all tracking tests to verify**

Run: `cd tools/melee-agent && uv run pytest tests/test_tracking_fingerprint.py tests/test_attempts.py -v`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/tracking.py \
        tools/melee-agent/tests/test_tracking_fingerprint.py
git commit -m "feat(tracking): add increment_replay helper for dedup-on-write"
```

---

## Task 9: `checkdiff.py` — wrap fingerprint logic in helper functions

**Files:**
- Modify: `tools/checkdiff.py` (add helpers; do not change `main()` yet)
- Test: `tools/melee-agent/tests/test_checkdiff_fingerprint.py`

- [ ] **Step 1: Write failing tests for the new helpers**

Create `tools/melee-agent/tests/test_checkdiff_fingerprint.py`:

```python
"""Integration tests for the fingerprint hooks in tools/checkdiff.py."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CHECKDIFF = _REPO_ROOT / "tools" / "checkdiff.py"
_FIXTURES = Path(__file__).parent / "fixtures" / "fingerprint"


def _load_checkdiff():
    """Load tools/checkdiff.py as the importable `checkdiff` module.

    Mirrors the loader convention in test_checkdiff_reloc_normalize.py.
    The melee-agent src/ path is already inserted at checkdiff.py
    module-import time (see Task 10), so we don't need to manipulate
    sys.path here.
    """
    spec = importlib.util.spec_from_file_location("checkdiff", _CHECKDIFF)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["checkdiff"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def checkdiff():
    return _load_checkdiff()


def test_fingerprint_for_function_uses_src_path(checkdiff, tmp_path, monkeypatch):
    """The new helper resolves `src/melee/<obj_path>.c` and computes a fingerprint."""
    # Stub the source file in tmp_path
    src = tmp_path / "src" / "melee" / "mn" / "sample.c"
    src.parent.mkdir(parents=True)
    src.write_text(
        "void fn_alpha(int x) {\n"
        "    int y = x + 1;\n"
        "}\n"
    )

    monkeypatch.setattr(checkdiff, "SRC_ROOT", tmp_path / "src")
    fp = checkdiff.fingerprint_for_function("fn_alpha", "melee/mn/sample")
    assert fp is not None
    assert fp.raw  # 12-char hex
    assert "int y = x + 1;" in fp.body


def test_fingerprint_for_function_returns_none_for_missing_src(checkdiff, tmp_path, monkeypatch):
    monkeypatch.setattr(checkdiff, "SRC_ROOT", tmp_path / "src")
    fp = checkdiff.fingerprint_for_function("fn_alpha", "nonexistent")
    assert fp is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py::test_fingerprint_for_function_uses_src_path -v`

Expected: FAIL with `AttributeError: module 'checkdiff' has no attribute 'fingerprint_for_function'`.

- [ ] **Step 3: Add the helper to `checkdiff.py`**

In `tools/checkdiff.py`, near the top after the existing imports, add:

```python
# sys.path shim so `src.cli.*` imports resolve. checkdiff.py lives
# outside the melee-agent package; we already do this dance for
# apply_name_magic_if_available below. Bringing it forward so the
# fingerprint imports work for all callers.
_MELEE_AGENT_SRC = SCRIPT_DIR / "melee-agent" / "src"
if _MELEE_AGENT_SRC.exists():
    _path_str = str(_MELEE_AGENT_SRC)
    if _path_str not in sys.path:
        sys.path.insert(0, _path_str)

try:
    from src.cli.fingerprint import fingerprint_for, Fingerprint
    from src.cli.tracking import (
        find_attempt_by_fp,
        increment_replay,
        record_attempt,
    )
    _FINGERPRINT_AVAILABLE = True
except ImportError:
    _FINGERPRINT_AVAILABLE = False
    Fingerprint = None  # type: ignore
```

Then add the helper near `find_unit_for_function` (around line 634):

```python
def fingerprint_for_function(func_name: str, obj_path: str) -> Optional["Fingerprint"]:
    """Compute the fingerprint for `func_name` from its source file.

    `obj_path` is the unit path returned by find_unit_for_function (e.g.
    "melee/mn/sample"). Returns None if fingerprinting is disabled,
    the source file is missing, or the function can't be extracted.
    """
    if not _FINGERPRINT_AVAILABLE:
        return None
    source = SRC_ROOT / f"{obj_path}.c"
    if not source.exists():
        return None
    return fingerprint_for(source, func_name)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v`

Expected: pass.

- [ ] **Step 5: Run the existing checkdiff tests to confirm no regression**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_name_magic.py tests/test_checkdiff_reloc_normalize.py -v`

Expected: pass (the new imports must not break existing loading).

- [ ] **Step 6: Commit**

```bash
git add tools/checkdiff.py tools/melee-agent/tests/test_checkdiff_fingerprint.py
git commit -m "feat(checkdiff): add fingerprint_for_function helper"
```

---

## Task 10: `checkdiff.py` — `--no-fingerprint` flag + env var

**Files:**
- Modify: `tools/checkdiff.py` (argparse in `main()`)
- Test: `tools/melee-agent/tests/test_checkdiff_fingerprint.py`

- [ ] **Step 1: Write failing tests**

Append to `tools/melee-agent/tests/test_checkdiff_fingerprint.py`:

```python
def test_no_fingerprint_flag_parsed(checkdiff):
    """The argparse setup includes --no-fingerprint."""
    # Build the parser the same way main() does. We can introspect it
    # by checking that the flag string appears in the help text.
    import argparse
    ap = checkdiff._build_arg_parser()
    actions = {opt for action in ap._actions for opt in action.option_strings}
    assert "--no-fingerprint" in actions


def test_no_fingerprint_env_var_recognized(checkdiff, monkeypatch):
    """CHECKDIFF_NO_FINGERPRINT=1 disables fingerprinting."""
    monkeypatch.setenv("CHECKDIFF_NO_FINGERPRINT", "1")
    assert checkdiff.fingerprint_disabled() is True
    monkeypatch.setenv("CHECKDIFF_NO_FINGERPRINT", "0")
    assert checkdiff.fingerprint_disabled() is False
    monkeypatch.delenv("CHECKDIFF_NO_FINGERPRINT", raising=False)
    assert checkdiff.fingerprint_disabled() is False
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py::test_no_fingerprint_flag_parsed -v`

Expected: FAIL with `AttributeError: ... _build_arg_parser`.

- [ ] **Step 3: Refactor argparse setup into `_build_arg_parser`**

In `tools/checkdiff.py`, extract the argparse block from inside `main()` (lines 654–683) into a module-level function:

```python
def _build_arg_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("function", help="Function name")
    ap.add_argument("--no-tty", action="store_true",
                    help="Force non-interactive output (auto-detected if no TTY)")
    ap.add_argument("--format", choices=["plain", "side-by-side", "json"], default="side-by-side",
                    help="Output format when using --no-tty (default: side-by-side)")
    ap.add_argument("--no-build", action="store_true",
                    help="Skip the ninja rebuild step and diff the .o as-is.")
    ap.add_argument("--normalize-reloc", dest="normalize_reloc", action="store_true",
                    default=True,
                    help="Round reloc-line offsets down to the containing 4-byte instruction.")
    ap.add_argument("--no-normalize-reloc", dest="normalize_reloc", action="store_false",
                    help="Disable reloc-offset normalization.")
    ap.add_argument("--no-name-magic", dest="name_magic", action="store_false",
                    default=True,
                    help="Disable transparent name-magic .o symbol rewriting.")
    ap.add_argument("--no-fingerprint", dest="fingerprint", action="store_false",
                    default=True,
                    help="Disable source-state fingerprinting + auto-record + "
                         "repeat detection. Also disabled by env var "
                         "CHECKDIFF_NO_FINGERPRINT=1.")
    return ap


def fingerprint_disabled() -> bool:
    """True if the CHECKDIFF_NO_FINGERPRINT env var is set to a truthy value."""
    return os.environ.get("CHECKDIFF_NO_FINGERPRINT", "") in ("1", "true", "yes")
```

Then in `main()`, replace the argparse block with:

```python
def main() -> int:
    args = _build_arg_parser().parse_args()
    if fingerprint_disabled():
        args.fingerprint = False
    # ... rest unchanged
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py tests/test_checkdiff_name_magic.py tests/test_checkdiff_reloc_normalize.py -v`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/checkdiff.py tools/melee-agent/tests/test_checkdiff_fingerprint.py
git commit -m "feat(checkdiff): add --no-fingerprint flag and CHECKDIFF_NO_FINGERPRINT env"
```

---

## Task 11: `checkdiff.py` — pre-build fingerprint lookup + post-build classifier

**Files:**
- Modify: `tools/checkdiff.py` (`main()` body)
- Test: `tools/melee-agent/tests/test_checkdiff_fingerprint.py`

- [ ] **Step 1: Write failing tests for the classifier**

Append to `tools/melee-agent/tests/test_checkdiff_fingerprint.py`:

```python
def test_classify_attempt_novel(checkdiff):
    """No prior fingerprint → novel branch."""
    branch = checkdiff.classify_attempt(prior=None, current_match=87.2)
    assert branch == "novel"


def test_classify_attempt_repeat_same_match(checkdiff):
    prior = {"match_percent": 87.2, "match_type": "raw"}
    branch = checkdiff.classify_attempt(prior=prior, current_match=87.2)
    assert branch == "repeat"


def test_classify_attempt_repeat_within_tolerance(checkdiff):
    """0.1% tolerance absorbs rounding noise."""
    prior = {"match_percent": 87.2, "match_type": "raw"}
    branch = checkdiff.classify_attempt(prior=prior, current_match=87.25)
    assert branch == "repeat"


def test_classify_attempt_divergent(checkdiff):
    prior = {"match_percent": 87.2, "match_type": "raw"}
    branch = checkdiff.classify_attempt(prior=prior, current_match=98.5)
    assert branch == "divergent"


def test_format_banner_repeat(checkdiff):
    prior = {
        "index": 5,
        "match_percent": 99.2,
        "classification": "register-allocation",
        "outcome": "reverted",
        "agent_id": "pid83109",
        "timestamp_utc": "2026-05-15T22:34:17+00:00",
        "note": "Tried assigning aligned_100 before width...",
        "replay_count": 28,
        "match_type": "raw",
    }
    banner = checkdiff.format_banner("repeat", "fn_8024E1B4", prior, current_match=99.2)
    assert "[REPEAT]" in banner
    assert "fn_8024E1B4" in banner
    assert "99.2" in banner
    assert "register-allocation" in banner
    assert "30th time" in banner  # replay_count=28 → next will be 30th


def test_format_banner_repeat_semantic(checkdiff):
    prior = {
        "index": 5, "match_percent": 99.2, "classification": "",
        "outcome": "neutral", "agent_id": "pid7842",
        "timestamp_utc": "2026-05-15T22:34:17+00:00", "note": "",
        "replay_count": 0, "match_type": "norm",
    }
    banner = checkdiff.format_banner("repeat", "fn_x", prior, current_match=99.2)
    assert "[REPEAT (semantic)]" in banner


def test_format_banner_divergent(checkdiff):
    prior = {
        "index": 5, "match_percent": 99.2, "classification": "",
        "outcome": "neutral", "agent_id": "pid7842",
        "timestamp_utc": "2026-05-15T22:34:17+00:00", "note": "",
        "replay_count": 0, "match_type": "raw",
    }
    banner = checkdiff.format_banner("divergent", "fn_x", prior,
                                     current_match=98.5,
                                     distinct_match_count=2)
    assert "[DIVERGENT REPEAT]" in banner
    assert "99.2" in banner
    assert "98.5" in banner
    assert "2 distinct match%s" in banner
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v -k "classify or format_banner"`

Expected: FAIL with `AttributeError: ... classify_attempt`.

- [ ] **Step 3: Implement `classify_attempt` and `format_banner` in `checkdiff.py`**

Add to `tools/checkdiff.py`:

```python
MATCH_TOLERANCE = 0.1  # match% delta below which we treat two attempts as identical


def classify_attempt(prior: Optional[dict], current_match: float) -> str:
    """Three-way classifier: 'novel', 'repeat', or 'divergent'.

    Used by main() to decide between increment_replay (repeat),
    record_attempt with a fresh entry (novel or divergent), and which
    banner — if any — to emit.
    """
    if prior is None:
        return "novel"
    prior_match = float(prior.get("match_percent", 0.0))
    if abs(current_match - prior_match) <= MATCH_TOLERANCE:
        return "repeat"
    return "divergent"


def format_banner(branch: str, func_name: str, prior: dict, *,
                  current_match: float,
                  distinct_match_count: int = 1) -> str:
    """Build the [REPEAT] / [DIVERGENT REPEAT] banner text.

    `distinct_match_count` is only meaningful for the divergent branch:
    it's the number of distinct match%s recorded for this fingerprint
    (including the current one), derived by the caller from the ledger.
    """
    if branch == "repeat":
        header = "[REPEAT (semantic)]" if prior.get("match_type") == "norm" else "[REPEAT]"
        next_count_ordinal = _ordinal(int(prior.get("replay_count", 0)) + 2)
        prior_outcome = prior.get("outcome", "")
        prior_class = prior.get("classification", "")
        return (
            f"{header} this source matches attempt #{prior.get('index', '?')} for {func_name}\n"
            f"  - prior match%:    {prior.get('match_percent', 0):.1f}   "
            f"(class={prior_class}, outcome={prior_outcome})\n"
            f"  - current match%:  {current_match:.1f}   (same — verified)\n"
            f"  - prior agent:     {prior.get('agent_id', '?')}, "
            f"{prior.get('timestamp_utc', '')}\n"
            f"  - prior note:      \"{prior.get('note', '')}\"\n"
            f"  - repeat count:    this is the {next_count_ordinal} time at this fingerprint\n"
        )
    elif branch == "divergent":
        prior_class = prior.get("classification", "")
        return (
            f"[DIVERGENT REPEAT] same source as attempt #{prior.get('index', '?')} "
            f"but new outcome\n"
            f"  - prior match%:    {prior.get('match_percent', 0):.1f}   "
            f"(class={prior_class})\n"
            f"  - current match%:  {current_match:.1f}   ← changed; external state differs\n"
            f"  - prior agent:     {prior.get('agent_id', '?')}, "
            f"{prior.get('timestamp_utc', '')}\n"
            f"  - prior note:      \"{prior.get('note', '')}\"\n"
            f"  - this fingerprint has produced {distinct_match_count} distinct match%s historically\n"
        )
    return ""


def _count_distinct_match_percents(function_name: str, fingerprint: str) -> int:
    """Helper for the divergent banner: count distinct match%s recorded
    for this (function, fingerprint) in the ledger. Used to render the
    'N distinct match%s historically' line.

    Returns at least 1 (the current attempt counts even before it's
    written). Tolerates the ledger being empty or missing.
    """
    from src.cli.tracking import load_attempt_ledger
    ledger = load_attempt_ledger()
    entry = ledger.get("functions", {}).get(function_name, {})
    matches = {
        round(a.get("match_percent", 0), 1)
        for a in entry.get("attempts", [])
        if a.get("fingerprint") == fingerprint
    }
    return max(1, len(matches) + 1)  # +1 for the new (uncommitted) match%


def _ordinal(n: int) -> str:
    """1 -> '1st', 2 -> '2nd', 30 -> '30th'."""
    if 10 <= (n % 100) <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v -k "classify or format_banner"`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add tools/checkdiff.py tools/melee-agent/tests/test_checkdiff_fingerprint.py
git commit -m "feat(checkdiff): add classify_attempt + format_banner helpers"
```

---

## Task 12: `checkdiff.py` — extract post-build classifier + wire into `main()`

**Files:**
- Modify: `tools/checkdiff.py` (`main()` body)
- Test: `tools/melee-agent/tests/test_checkdiff_fingerprint.py`

The existing `main()` has multiple early-return paths on errors (build failure, missing function, etc.) and two success-path returns: line 902 inside the `--format json` branch, and line 948 (`return result.returncode`) at the bottom. There is **no** literal `return 0` at the end. The wiring strategy:

1. **Refactor success paths** so both reach a single post-build phase. The `--format json` branch currently `return`s on line 902; change it to set `result = subprocess.CompletedProcess([], 1 if ref_asm != our_asm else 0)` and fall through (matching the side-by-side branch on lines 920/929/932).
2. **Extract** the post-build phase into a module-level helper `record_post_build_attempt(args, func_name, obj_path, fp, prior_attempt, c_file, current_match)` so it's directly unit-testable without driving the whole `main()`.
3. **Call** that helper once, between the `killall wine-preloader` line (946) and the final `return result.returncode` (948).
4. **Skip** the helper on build-failure early returns — those represent "we couldn't even diff," which the spec correctly excludes from the ledger.
5. **Clamp** the match% to [0, 100] before passing to `record_attempt` (which raises `ValueError` outside that range). Use `max(0.0, min(100.0, x))`.

- [ ] **Step 1: Write unit tests for the post-build helper**

Append to `tools/melee-agent/tests/test_checkdiff_fingerprint.py`:

```python
def test_record_post_build_novel(checkdiff, tmp_path, monkeypatch):
    """Novel branch: writes a new ledger entry, no banner."""
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)

    fp = checkdiff.Fingerprint(raw="abc111", normalized="def222",
                               body="int y = x;")
    msg = checkdiff.record_post_build_attempt(
        func_name="fn_alpha", obj_path="melee/mn/sample",
        fp=fp, prior_attempt=None,
        c_file=tmp_path / "src" / "melee" / "mn" / "sample.c",
        current_match=87.2,
    )
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_alpha"]["attempts"][0]
    assert a["fingerprint"] == "abc111"
    assert a["match_percent"] == 87.2
    assert a["replay_count"] == 0
    assert msg == ""  # no banner on novel


def test_record_post_build_repeat(checkdiff, tmp_path, monkeypatch):
    """Repeat branch: bumps replay_count, returns banner string."""
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)

    fp = checkdiff.Fingerprint(raw="abc111", normalized="def222",
                               body="int y = x;")
    # Seed a prior entry
    checkdiff.record_attempt(
        "fn_alpha", match_percent=87.2, outcome="neutral",
        fingerprint="abc111", fingerprint_norm="def222",
    )
    prior = checkdiff.find_attempt_by_fp("fn_alpha", "abc111", "def222")

    msg = checkdiff.record_post_build_attempt(
        func_name="fn_alpha", obj_path="melee/mn/sample",
        fp=fp, prior_attempt=prior,
        c_file=tmp_path / "src" / "melee" / "mn" / "sample.c",
        current_match=87.2,
    )
    data = json.loads(ledger.read_text())
    assert len(data["functions"]["fn_alpha"]["attempts"]) == 1
    assert data["functions"]["fn_alpha"]["attempts"][0]["replay_count"] == 1
    assert "[REPEAT]" in msg
    assert "2nd time" in msg


def test_record_post_build_divergent(checkdiff, tmp_path, monkeypatch):
    """Divergent branch: writes new entry, banner mentions distinct match%s."""
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)

    fp = checkdiff.Fingerprint(raw="abc111", normalized="def222",
                               body="int y = x;")
    checkdiff.record_attempt(
        "fn_alpha", match_percent=87.2, outcome="neutral",
        fingerprint="abc111", fingerprint_norm="def222",
    )
    prior = checkdiff.find_attempt_by_fp("fn_alpha", "abc111", "def222")

    msg = checkdiff.record_post_build_attempt(
        func_name="fn_alpha", obj_path="melee/mn/sample",
        fp=fp, prior_attempt=prior,
        c_file=tmp_path / "src" / "melee" / "mn" / "sample.c",
        current_match=98.5,
    )
    data = json.loads(ledger.read_text())
    attempts = data["functions"]["fn_alpha"]["attempts"]
    assert len(attempts) == 2
    assert attempts[1]["match_percent"] == 98.5
    assert attempts[0]["fingerprint"] == attempts[1]["fingerprint"]
    assert "[DIVERGENT REPEAT]" in msg
    assert "2 distinct match%s" in msg


def test_record_post_build_clamps_out_of_range_match(checkdiff, tmp_path, monkeypatch):
    """A corrupt report.json with match% > 100 must not crash."""
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)

    fp = checkdiff.Fingerprint(raw="abc111", normalized="def222",
                               body="int y = x;")
    msg = checkdiff.record_post_build_attempt(
        func_name="fn_alpha", obj_path="melee/mn/sample",
        fp=fp, prior_attempt=None,
        c_file=tmp_path / "src" / "melee" / "mn" / "sample.c",
        current_match=150.0,  # clearly bogus
    )
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_alpha"]["attempts"][0]
    assert a["match_percent"] == 100.0  # clamped


def test_record_post_build_handles_negative_match(checkdiff, tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)

    fp = checkdiff.Fingerprint(raw="abc111", normalized="def222",
                               body="int y = x;")
    checkdiff.record_post_build_attempt(
        func_name="fn_alpha", obj_path="melee/mn/sample",
        fp=fp, prior_attempt=None,
        c_file=tmp_path / "src" / "melee" / "mn" / "sample.c",
        current_match=-3.0,
    )
    data = json.loads(ledger.read_text())
    a = data["functions"]["fn_alpha"]["attempts"][0]
    assert a["match_percent"] == 0.0  # clamped
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v -k record_post_build`

Expected: FAIL with `AttributeError: ... record_post_build_attempt`.

- [ ] **Step 3: Implement the post-build helper**

In `tools/checkdiff.py`, add a module-level helper (place it near `classify_attempt` / `format_banner`):

```python
def record_post_build_attempt(
    *,
    func_name: str,
    obj_path: str,
    fp: "Fingerprint",
    prior_attempt: Optional[dict],
    c_file: Path,
    current_match: float,
) -> str:
    """Apply the dedup-on-write policy and return a banner string (or "").

    Called once per successful checkdiff run. The caller is responsible
    for printing the returned banner; this function only mutates the
    ledger and computes the message.
    """
    # Clamp to [0, 100] — record_attempt raises ValueError outside that
    # range, and we'd rather degrade silently on a corrupt report.json
    # than kill checkdiff.
    clamped_match = max(0.0, min(100.0, float(current_match)))
    source_file = str(c_file.relative_to(ROOT)) if c_file.is_absolute() else str(c_file)

    branch = classify_attempt(prior_attempt, clamped_match)

    if branch == "novel":
        record_attempt(
            func_name,
            match_percent=clamped_match,
            outcome="neutral",
            fingerprint=fp.raw,
            fingerprint_norm=fp.normalized,
            source_file=source_file,
        )
        return ""

    if branch == "repeat":
        increment_replay(func_name, attempt_index=prior_attempt["index"])
        return format_banner("repeat", func_name, prior_attempt,
                             current_match=clamped_match)

    # divergent
    record_attempt(
        func_name,
        match_percent=clamped_match,
        outcome="neutral",
        fingerprint=fp.raw,
        fingerprint_norm=fp.normalized,
        source_file=source_file,
    )
    distinct = _count_distinct_match_percents(func_name, fp.raw)
    return format_banner("divergent", func_name, prior_attempt,
                         current_match=clamped_match,
                         distinct_match_count=distinct)
```

- [ ] **Step 4: Wire the pre-build phase + the helper into `main()`**

In `tools/checkdiff.py`, inside `main()`:

(a) After `obj_path = find_unit_for_function(func_name)` and the `c_file = SRC_ROOT / f"{obj_path}.c"` line (around line 701), insert the pre-build phase:

```python
    # Pre-build phase: compute fingerprint and look up prior attempt.
    fp = None
    prior_attempt = None
    if args.fingerprint and _FINGERPRINT_AVAILABLE:
        fp = fingerprint_for_function(func_name, obj_path)
        if fp is not None:
            prior_attempt = find_attempt_by_fp(func_name, fp.raw, fp.normalized)
```

(b) **Refactor** the `--format json` early-return at line 902 so it falls through. Change:

```python
            print(json_mod.dumps(diff_data, indent=2))
            return 1 if ref_asm != our_asm else 0
```

to:

```python
            print(json_mod.dumps(diff_data, indent=2))
            result = subprocess.CompletedProcess([], 1 if ref_asm != our_asm else 0)
```

(no early return; both branches now arrive at the post-build phase below).

(c) **Insert** the post-build call between the `killall wine-preloader` line (946) and the final `return result.returncode` (948):

```python
    # kill wine-preloader so we don't eat the user's battery life
    subprocess.run(["killall", "wine-preloader"], capture_output=True)

    # Post-build: dedup-on-write + banner.
    if args.fingerprint and _FINGERPRINT_AVAILABLE and fp is not None:
        current_match = get_fuzzy_match_percent(func_name) or 0.0
        banner = record_post_build_attempt(
            func_name=func_name, obj_path=obj_path, fp=fp,
            prior_attempt=prior_attempt, c_file=c_file,
            current_match=current_match,
        )
        if banner:
            print(banner, file=sys.stderr)

    return result.returncode
```

(d) **Leave** all build-failure returns (lines 699, 716, 727, 742) untouched — they bypass the post-build phase intentionally (no successful diff = no ledger entry).

- [ ] **Step 5: Run unit tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v -k record_post_build`

Expected: 5 tests pass (novel, repeat, divergent, clamp-high, clamp-low).

- [ ] **Step 6: Run all existing checkdiff tests to confirm no regression**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_name_magic.py tests/test_checkdiff_reloc_normalize.py -v`

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add tools/checkdiff.py tools/melee-agent/tests/test_checkdiff_fingerprint.py
git commit -m "feat(checkdiff): extract post-build classifier helper + wire pre-build phase"
```

---

## Task 13: `checkdiff.py` — `--dry-run` mode (read-only)

**Files:**
- Modify: `tools/checkdiff.py`
- Test: `tools/melee-agent/tests/test_checkdiff_fingerprint.py`

- [ ] **Step 1: Write failing tests**

Append to `tools/melee-agent/tests/test_checkdiff_fingerprint.py`:

```python
def _make_stub_repo(tmp_path: Path, fn_name: str, match_pct: float,
                    body: str = "int y = x + 1;\n") -> Path:
    """Build a fake repo tree: SRC_ROOT, REPORT_PATH, build dir."""
    (tmp_path / "src" / "melee" / "mn").mkdir(parents=True)
    (tmp_path / "src" / "melee" / "mn" / "sample.c").write_text(
        f"void {fn_name}(int x) {{\n    {body}}}\n"
    )
    (tmp_path / "build" / "GALE01").mkdir(parents=True)
    (tmp_path / "build" / "GALE01" / "report.json").write_text(json.dumps({
        "units": [{
            "name": "main/melee/mn/sample",
            "functions": [{"name": fn_name, "fuzzy_match_percent": match_pct}],
        }],
    }))
    return tmp_path


def _patch_paths(checkdiff, monkeypatch, tmp_path):
    """Re-point checkdiff's module-level Path constants at the fake repo.

    Uses monkeypatch.setattr so the originals are restored on test
    teardown — crucial because the checkdiff module is loaded once
    per pytest module (scope="module" on the fixture).
    """
    monkeypatch.setattr(checkdiff, "ROOT", tmp_path)
    monkeypatch.setattr(checkdiff, "SRC_ROOT", tmp_path / "src")
    monkeypatch.setattr(checkdiff, "REPORT_PATH",
                        tmp_path / "build" / "GALE01" / "report.json")


def test_dry_run_does_not_invoke_subprocess(checkdiff, tmp_path, monkeypatch):
    _make_stub_repo(tmp_path, "fn_alpha", match_pct=87.2)
    _patch_paths(checkdiff, monkeypatch, tmp_path)
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(sys, "argv",
                        ["checkdiff.py", "fn_alpha", "--dry-run", "--no-tty"])

    def _fail(*args, **kwargs):
        raise AssertionError(f"--dry-run must not invoke subprocess: {args!r}")

    monkeypatch.setattr(checkdiff.subprocess, "run", _fail)
    rc = checkdiff.main()
    assert rc == 0


def test_dry_run_does_not_mutate_ledger(checkdiff, tmp_path, monkeypatch):
    _make_stub_repo(tmp_path, "fn_alpha", match_pct=87.2)
    _patch_paths(checkdiff, monkeypatch, tmp_path)
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))
    monkeypatch.setattr(sys, "argv",
                        ["checkdiff.py", "fn_alpha", "--dry-run", "--no-tty"])

    checkdiff.main()
    assert not ledger.exists()


def test_dry_run_exits_3_on_missing_report(checkdiff, tmp_path, monkeypatch):
    _make_stub_repo(tmp_path, "fn_alpha", match_pct=87.2)
    _patch_paths(checkdiff, monkeypatch, tmp_path)
    # Remove the report.json
    (tmp_path / "build" / "GALE01" / "report.json").unlink()
    monkeypatch.setattr(sys, "argv",
                        ["checkdiff.py", "fn_alpha", "--dry-run", "--no-tty"])
    rc = checkdiff.main()
    assert rc == 3


def test_dry_run_exits_3_on_unknown_function(checkdiff, tmp_path, monkeypatch):
    """report.json exists but the function isn't in it."""
    _make_stub_repo(tmp_path, "fn_alpha", match_pct=87.2)
    _patch_paths(checkdiff, monkeypatch, tmp_path)
    monkeypatch.setattr(sys, "argv",
                        ["checkdiff.py", "fn_unknown", "--dry-run", "--no-tty"])
    rc = checkdiff.main()
    assert rc == 3


def test_dry_run_reports_banner_for_prior_attempt(checkdiff, tmp_path, monkeypatch, capsys):
    _make_stub_repo(tmp_path, "fn_alpha", match_pct=87.2)
    _patch_paths(checkdiff, monkeypatch, tmp_path)
    ledger = tmp_path / "ledger.json"
    monkeypatch.setenv("DECOMP_ATTEMPT_LEDGER_FILE", str(ledger))

    # Seed the ledger via the helper directly (avoids needing a working
    # build environment for the seeding run)
    fp = checkdiff.fingerprint_for_function("fn_alpha", "melee/mn/sample")
    assert fp is not None
    checkdiff.record_attempt(
        "fn_alpha", match_percent=87.2, outcome="neutral",
        fingerprint=fp.raw, fingerprint_norm=fp.normalized,
    )

    # Now dry-run with the same source; banner must appear
    monkeypatch.setattr(sys, "argv",
                        ["checkdiff.py", "fn_alpha", "--dry-run", "--no-tty"])
    rc = checkdiff.main()
    err = capsys.readouterr().err
    assert rc == 0
    assert "[REPEAT]" in err
```

- [ ] **Step 2: Run to verify failure**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v -k dry_run`

Expected: FAIL (no `--dry-run` flag).

- [ ] **Step 3: Add `--dry-run` to `_build_arg_parser`**

In `tools/checkdiff.py`, in `_build_arg_parser()`, add before the return:

```python
    ap.add_argument("--dry-run", action="store_true",
                    help="Read-only fingerprint preview: skips ninja and "
                         "all ledger writes, but reads cached report.json "
                         "and emits the [REPEAT]/[DIVERGENT REPEAT] banner "
                         "that a real run would emit. Exits 3 if report.json "
                         "is missing.")
```

- [ ] **Step 4: Add the `--dry-run` short-circuit in `main()`**

Near the top of `main()` (after `args = _build_arg_parser().parse_args()` and the env-var override that sets `args.fingerprint = False` when the env var is set), add:

```python
    if args.dry_run:
        # Read-only mode: never invoke subprocess, never write to the
        # ledger. Exits 3 on any missing precondition (report.json
        # absent, function not in report) so CI and test harnesses can
        # distinguish from "ran fine, no repeat" (exit 0).
        if not REPORT_PATH.exists():
            print(f"--dry-run: {REPORT_PATH} does not exist", file=sys.stderr)
            return 3
        func_name = args.function
        obj_path = find_unit_for_function(func_name)
        if obj_path is None:
            print(f"--dry-run: function '{func_name}' not in report.json",
                  file=sys.stderr)
            return 3
        if args.fingerprint and _FINGERPRINT_AVAILABLE:
            fp = fingerprint_for_function(func_name, obj_path)
            if fp is not None:
                prior = find_attempt_by_fp(func_name, fp.raw, fp.normalized)
                current = max(0.0, min(100.0, get_fuzzy_match_percent(func_name) or 0.0))
                branch = classify_attempt(prior, current)
                if branch == "repeat":
                    print(format_banner("repeat", func_name, prior,
                                        current_match=current), file=sys.stderr)
                elif branch == "divergent":
                    distinct = _count_distinct_match_percents(func_name, fp.raw)
                    print(format_banner("divergent", func_name, prior,
                                        current_match=current,
                                        distinct_match_count=distinct),
                          file=sys.stderr)
        return 0
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd tools/melee-agent && uv run pytest tests/test_checkdiff_fingerprint.py -v`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tools/checkdiff.py tools/melee-agent/tests/test_checkdiff_fingerprint.py
git commit -m "feat(checkdiff): add --dry-run read-only fingerprint preview"
```

---

## Task 14: Full-suite verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full melee-agent test suite**

Run: `cd tools/melee-agent && uv run pytest -v`

Expected: every test in `tools/melee-agent/tests/` passes. If any preexisting test fails, investigate before proceeding.

- [ ] **Step 2: Manual smoke test on a real function**

From the repo root, with a working build environment:

```bash
# Pick a function from extract list with a small attempt history
melee-agent extract list --max-match 0.50 | head -5
# Pick one, e.g. fn_8024E1B4
tools/checkdiff.py fn_8024E1B4
tools/checkdiff.py fn_8024E1B4  # second run should show [REPEAT]
```

Expected: first run shows the normal objdiff output. Second run prepends a `[REPEAT]` banner; ledger entry shows `replay_count=1`.

- [ ] **Step 3: Inspect the ledger entry**

```bash
melee-agent attempts show fn_8024E1B4
```

Expected: one attempt entry with the fingerprint fields populated; if you ran a second checkdiff, `replay_count` is 1.

- [ ] **Step 4: Verify `--dry-run`**

```bash
tools/checkdiff.py --dry-run fn_8024E1B4
```

Expected: emits the `[REPEAT]` banner without invoking ninja; ledger is unchanged.

- [ ] **Step 5: Verify `--no-fingerprint`**

```bash
CHECKDIFF_NO_FINGERPRINT=1 tools/checkdiff.py fn_8024E1B4
```

Expected: no banner; no new ledger writes (verify with `melee-agent attempts show fn_8024E1B4`).

- [ ] **Step 6: Commit final cleanup if any tweaks were needed**

```bash
git status
# If clean, no commit. If there are smoke-test-driven adjustments,
# bundle them into a single commit:
git add -p
git commit -m "fix(checkdiff): smoke-test adjustments"
```

---

## Self-review

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| Component 1: `fingerprint.py` (extract_function_body, compute_fingerprint, fingerprint_for) | Tasks 3, 4, 5 |
| Component 1: tree-sitter refactor + shared `find_function_definition` | Task 1 |
| Component 1: regex fallback (with parenthesis balancing, anchor) | Task 4 |
| Component 1: identical body normalization across both paths | Tasks 3, 4 (`_trim_body`) |
| Component 2: ledger schema extension (5 new fields) | Tasks 6, 7, 8 |
| Component 3: pre-build phase | Tasks 9, 12 |
| Component 3: post-build 3-way classifier (novel/repeat/divergent) | Tasks 11, 12 |
| Component 3: `--no-fingerprint` flag + env var | Task 10 |
| Component 3: `--dry-run` read-only mode (+ exits 3 on missing report/function) | Task 13 |
| Component 3: banner format (REPEAT, REPEAT (semantic), DIVERGENT REPEAT, "N distinct match%s") | Task 11 |
| Component 3: direct in-process import (no subprocess) | Task 9 (sys.path shim) |
| Component 3: match% clamping to [0,100] | Task 12 (`record_post_build_attempt`) |
| Testing: unit tests for fingerprint | Tasks 3, 4, 5 |
| Testing: unit tests for tracking | Tasks 6, 7, 8 |
| Testing: unit tests for checkdiff helpers (post-build classifier, banner, dry-run) | Tasks 9, 10, 11, 12, 13 |
| Testing: migration test (old entries without fields) | Task 6 (`test_record_attempt_without_fingerprint_kwargs_still_works`) |
| Testing: cross-path body equivalence (tree-sitter vs regex) | Task 4 (`test_tree_sitter_and_regex_produce_identical_raw_for_same_input`) |
| Testing: regex fallback safety (function-pointer params, no false positives) | Task 4 |
| Rollout step 1: tree-sitter refactor | Task 1 |
| Rollout step 2: `fingerprint.py` | Tasks 2–5 |
| Rollout step 3: `tracking.py` extensions | Tasks 6–8 |
| Rollout step 4: `checkdiff.py` integration | Tasks 9–13 |
| Edge case: function in `.s`-only TU | Task 9 (`fingerprint_for_function` returns None on missing `.c`) |
| Edge case: SIGKILL mid-run | Task 12 (post-build only writes if reached; no commit if interrupted) |
| Edge case: parallel checkdiff races | Task 7, 8 (reuse existing `file_lock`) |
| Edge case: replay immutability | Task 8 (`test_increment_replay_preserves_*`) |
| Edge case: corrupt report.json (match% out of range) | Task 12 (`test_record_post_build_clamps_out_of_range_match`) |
| Success criterion (post-rollout analysis script) | NOT in this plan — defer to a follow-up analysis pass after rollout |

**Type consistency check:** `record_attempt`/`find_attempt_by_fp`/`increment_replay` signatures match across tracking.py + tracking tests + checkdiff `record_post_build_attempt`. `Fingerprint` dataclass shape (raw/normalized/body) matches across fingerprint.py + tests + checkdiff helpers. `classify_attempt` returns string literals ("novel"/"repeat"/"divergent") consistently between definition (Task 11) and use (Task 12). `format_banner` `distinct_match_count` kwarg added in Task 11, used by `record_post_build_attempt` in Task 12 and by `--dry-run` in Task 13.

**Placeholder scan:** No TBDs, no "implement later," no orphan references. Every code block is complete. Every test has actual assertions. Every command has expected output.

**Open: post-rollout analysis script** is mentioned in the spec rollout section but isn't a task here. It's a one-time human-driven analysis (run the existing `/tmp/repeat_attempts.py`-style script against post-rollout sessions) rather than committed code, so it doesn't belong in the implementation plan. The plan delivers the *mechanism*; success measurement is a follow-up.

**Auto-push reminder:** per `~/.claude/projects/.../memory/auto_push_master.md`, any commit landing on `master` will auto-push to origin. The current worktree branch (`claude/ecstatic-engelbart-4425c2`) is *not* master, so commits in Tasks 1–13 stay local. The Task 14 smoke test runs against the user's main workspace — if the user runs it on master, the smoke-test commit (Step 6) will auto-push.
