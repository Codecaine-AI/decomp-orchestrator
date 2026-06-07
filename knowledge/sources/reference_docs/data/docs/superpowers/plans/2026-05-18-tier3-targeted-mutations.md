# Tier 3: Targeted Source Mutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the symbol bridge + mutator library + tier3-search orchestrator so the matching agent can target specific named variables for mutation instead of relying on random walks alone.

**Architecture:** Three new layers stacked on top of existing Tier 0/1/2 infrastructure. Symbol bridge (brace-tokenizer based, no pycparser) maps source variable names ↔ MWCC virtual register numbers via decl-order heuristic + orchestrator-invoked self-verification. Mutator library does tokenizer-based source rewrites for two patterns: type changes and pointer-alias insertions. Orchestrator (`debug tier3-search`) ties them together — runs guide → generates seed variants → runs short permuter session per seed via Tier 2 scoring → reports best.

**Tech Stack:** Python 3.11+, typer (CLI), pytest, existing `source_patch.py` tokenizer pattern, decomp-permuter via the Tier 2 wrapper.

**Spec:** `docs/superpowers/specs/2026-05-18-tier3-targeted-mutations-design.md` (commit `69382c34a`).

---

## File Structure

```
tools/melee-agent/src/mwcc_debug/
├── symbol_bridge.py        (NEW)  brace-tokenizer decl walker + bridge API
├── mutators.py             (NEW)  mutate_type_change + mutate_insert_alias
└── tier3_search.py         (NEW)  seed generator + orchestrator core

tools/melee-agent/src/cli/
└── debug.py                (MODIFY) +5 commands: var-to-virtual,
                                     virtual-to-var, mutate type-change,
                                     mutate insert-alias, tier3-search

tools/melee-agent/tests/
├── test_mwcc_debug_symbol_bridge.py     (NEW)
├── test_mwcc_debug_mutators.py          (NEW)
└── test_mwcc_debug_tier3_search_integration.py  (NEW)

docs/
└── mwcc-debug-permuter-integration.md   (MODIFY) +Tier 3 section,
                                                  reorder Tier 0/1/2
```

Each module has one clear responsibility. `tier3_search.py` is separate from `debug.py` so the orchestrator logic stays testable independent of CLI glue.

---

## Task 1: Symbol bridge — data classes + brace-tokenizer decl walker

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

The bridge needs to walk a function body and identify each local variable declaration in source order. Reuse `source_patch.py`'s tokenizer approach (proven on real Melee TUs). This task just builds the parser — no IG/virtual mapping yet.

- [ ] **Step 1: Write the failing test (decl walker basics)**

Create `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`:

```python
"""Tests for the source variable ↔ virtual register bridge."""

from __future__ import annotations

import textwrap

from src.mwcc_debug.symbol_bridge import (
    LocalDecl,
    walk_local_decls,
)


def test_walk_local_decls_simple() -> None:
    """One local decl gets recognized."""
    body = textwrap.dedent("""\
        {
            int x;
            return x;
        }
    """)
    decls = walk_local_decls(body)
    assert len(decls) == 1
    assert decls[0].name == "x"
    assert decls[0].type_str == "int"


def test_walk_local_decls_multiple_in_order() -> None:
    """Decls returned in source order."""
    body = textwrap.dedent("""\
        {
            int a;
            HSD_JObj* b;
            u32 c;
        }
    """)
    names = [d.name for d in walk_local_decls(body)]
    assert names == ["a", "b", "c"]


def test_walk_local_decls_skips_non_decl_statements() -> None:
    """Plain expression statements aren't decls."""
    body = textwrap.dedent("""\
        {
            int x;
            x = 5;
            foo(x);
            return x;
        }
    """)
    decls = walk_local_decls(body)
    assert [d.name for d in decls] == ["x"]


def test_walk_local_decls_handles_initializers() -> None:
    """`int x = 5;` is one decl, not a statement."""
    body = textwrap.dedent("""\
        {
            int x = 5;
            HSD_JObj* j = gobj->hsd_obj;
        }
    """)
    decls = walk_local_decls(body)
    assert [d.name for d in decls] == ["x", "j"]


def test_walk_local_decls_handles_macro_initializers() -> None:
    """Decls with MACRO(...) initializers (common in Melee) work."""
    body = textwrap.dedent("""\
        {
            MnEventData* data = GET_EVENTDATA(gobj);
        }
    """)
    decls = walk_local_decls(body)
    assert [d.name for d in decls] == ["data"]
    assert decls[0].type_str == "MnEventData*"


def test_walk_local_decls_ignores_decls_inside_nested_blocks() -> None:
    """v1 only sees top-level body decls. Nested block decls are
    skipped (less common in mwcc-targeted code; future work)."""
    body = textwrap.dedent("""\
        {
            int x;
            if (x) {
                int y;
            }
            int z;
        }
    """)
    names = [d.name for d in walk_local_decls(body)]
    assert names == ["x", "z"]


def test_walk_local_decls_skips_string_literal_lookalike() -> None:
    """A `;` inside a string literal doesn't terminate a statement."""
    body = textwrap.dedent('''\
        {
            const char* s = "int fake;";
            int real;
        }
    ''')
    names = [d.name for d in walk_local_decls(body)]
    assert names == ["s", "real"]
```

- [ ] **Step 2: Run tests, confirm import failure**

```bash
cd tools/melee-agent
python -m pytest tests/test_mwcc_debug_symbol_bridge.py -v --no-cov 2>&1 | tail -5
```

Expected: ModuleNotFoundError on `src.mwcc_debug.symbol_bridge`.

- [ ] **Step 3: Implement `walk_local_decls` + `LocalDecl` dataclass**

Create `tools/melee-agent/src/mwcc_debug/symbol_bridge.py`:

```python
"""Source variable ↔ MWCC virtual register bridge.

Uses the same brace-tokenizer pattern as `source_patch.py` (proven on
real Melee TUs full of HSD_ASSERT, PAD_STACK, statement-expression
macros). Does NOT use pycparser. The trade-off: v1 only recognizes
simple top-of-body local declarations; nested-block decls are skipped
(documented limitation).

The bridge's accuracy is "good enough to bias seed selection," not
"exact." Callers see a `confidence` label and can invoke the
self-verification step in the orchestrator when committing to a seed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class LocalDecl:
    """One local variable declaration extracted from a function body."""
    name: str          # variable name
    type_str: str      # canonical type as written in source (e.g., "HSD_JObj*")
    decl_index: int    # 0-indexed position in source order


# Matches a single declaration's leading pattern:
#   <type-tokens> <name> [= ...] ;
# where <type-tokens> is one or more identifier/pointer/qualifier
# tokens, followed by a single identifier that's the variable name.
#
# We tokenize statement-by-statement (splitting on top-level `;`),
# then run this on each statement-leading text to recognize decls.
_DECL_RE = re.compile(
    r"""
    ^\s*
    (?P<type>
        (?:[A-Za-z_][A-Za-z_0-9]*\s*\**\s*)+   # type tokens + pointers
        (?:const\s+|volatile\s+|static\s+)*    # qualifiers (rare)
    )
    (?P<name>[A-Za-z_][A-Za-z_0-9]*)
    \s*
    (?:=|;)                                    # `=` or `;` ends decl head
    """,
    re.VERBOSE,
)

# C keywords that LOOK like type identifiers but introduce control flow
# or other statements. If the first token of a statement is one of these,
# the statement is NOT a declaration.
_NON_DECL_LEADERS = {
    "if", "else", "for", "while", "do", "switch", "case", "default",
    "return", "break", "continue", "goto",
}


def _strip_strings_and_comments(text: str) -> str:
    """Replace string-literal and comment content with same-length
    whitespace so brace/semicolon tokenization isn't fooled by them.
    Newlines preserved so line numbers stay aligned.
    """
    out = []
    i = 0
    while i < len(text):
        c = text[i]
        if c == '"' or c == "'":
            quote = c
            out.append(c)
            i += 1
            while i < len(text) and text[i] != quote:
                if text[i] == "\\" and i + 1 < len(text):
                    out.append(" ")  # don't expose `\\` quirks
                    out.append(" ")
                    i += 2
                    continue
                out.append("\n" if text[i] == "\n" else " ")
                i += 1
            if i < len(text):
                out.append(text[i])
                i += 1
            continue
        if c == "/" and i + 1 < len(text) and text[i + 1] == "/":
            while i < len(text) and text[i] != "\n":
                out.append(" ")
                i += 1
            continue
        if c == "/" and i + 1 < len(text) and text[i + 1] == "*":
            while i + 1 < len(text) and not (
                text[i] == "*" and text[i + 1] == "/"
            ):
                out.append("\n" if text[i] == "\n" else " ")
                i += 1
            if i + 1 < len(text):
                out.append(" ")
                out.append(" ")
                i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _top_level_statements(body: str) -> list[str]:
    """Split a function body (the `{...}` block) into top-level statements
    by tracking brace + paren depth. Strings/comments stripped first.
    Returns each statement WITHOUT the trailing semicolon, in source
    order. Nested-block contents are returned as a single statement-
    sized chunk (we DON'T descend into them in v1).
    """
    # Trim outer braces if present
    stripped = _strip_strings_and_comments(body).strip()
    if stripped.startswith("{"):
        stripped = stripped[1:]
    if stripped.endswith("}"):
        stripped = stripped[:-1]

    stmts: list[str] = []
    buf: list[str] = []
    depth_brace = 0
    depth_paren = 0
    for c in stripped:
        if c == "{":
            depth_brace += 1
        elif c == "}":
            depth_brace -= 1
        elif c == "(":
            depth_paren += 1
        elif c == ")":
            depth_paren -= 1
        if c == ";" and depth_brace == 0 and depth_paren == 0:
            stmts.append("".join(buf).strip())
            buf = []
            continue
        buf.append(c)
    remainder = "".join(buf).strip()
    if remainder:
        stmts.append(remainder)
    return stmts


def walk_local_decls(body: str) -> list[LocalDecl]:
    """Walk a function body, return one LocalDecl per top-level local
    variable declaration in source order.

    `body` may include or omit the outer braces.
    """
    out: list[LocalDecl] = []
    idx = 0
    for stmt in _top_level_statements(body):
        # Skip control-flow leaders
        first_token_m = re.match(r"^\s*([A-Za-z_][A-Za-z_0-9]*)", stmt)
        if first_token_m and first_token_m.group(1) in _NON_DECL_LEADERS:
            continue
        m = _DECL_RE.match(stmt)
        if not m:
            continue
        # Compact whitespace in the type
        type_str = re.sub(r"\s+", " ", m.group("type")).strip()
        # Move trailing pointer asterisks adjacent to type (canonical
        # "HSD_JObj*" rather than "HSD_JObj *")
        type_str = re.sub(r"\s*\*\s*", "*", type_str)
        out.append(LocalDecl(
            name=m.group("name"),
            type_str=type_str,
            decl_index=idx,
        ))
        idx += 1
    return out
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_symbol_bridge.py -v --no-cov 2>&1 | tail -10
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "mwcc-debug: symbol_bridge — brace-tokenizer decl walker

Walks a function body's top-level local declarations in source order.
Uses the same string/comment stripping + brace tracking approach as
source_patch.py. v1 deliberately doesn't descend into nested blocks."
```

---

## Task 2: Symbol bridge — `list_bindings` + heuristic mapping to virtuals

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

Now map locals → virtuals via the decl-order heuristic. Bind locals to the N-th distinct virtual (≥ 32) seen as a destination in the pre-coloring pass, after parameter virtuals.

- [ ] **Step 1: Write the failing tests for `list_bindings`**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
from src.mwcc_debug.parser import (
    Block,
    Function,
    Instruction,
    Pass,
)
from src.mwcc_debug.symbol_bridge import (
    Binding,
    list_bindings,
)


def _make_ist(
    opcode: str, operands: str, regs: list[tuple[str, int]]
) -> Instruction:
    return Instruction(
        opcode=opcode, operands=operands, annotations=[], regs=regs
    )


def _make_pre_pass(virtuals_in_order: list[int]) -> Pass:
    """Construct a single-block pre-coloring pass that hits the
    given virtuals in order as destination operands."""
    pre = Pass(name="AFTER PEEPHOLE FORWARD")
    block = Block(index=0, succ=[], pred=[], labels=["L0"])
    for v in virtuals_in_order:
        block.instructions.append(
            _make_ist("li", f"r{v}, 0", [("r", v)])
        )
    pre.blocks.append(block)
    return pre


def test_list_bindings_locals_only_assigns_in_order() -> None:
    """Two locals get the first two distinct virtuals (≥32) seen."""
    source = textwrap.dedent("""\
        void f(void) {
            int a;
            int b;
        }
    """)
    pre = _make_pre_pass([32, 33, 34])
    bindings = list_bindings(source, "f", pre)
    locals_only = [b for b in bindings if b.kind == "local"]
    assert [b.var_name for b in locals_only] == ["a", "b"]
    assert locals_only[0].virtual == 32
    assert locals_only[1].virtual == 33
    assert all(b.confidence == "best-guess" for b in locals_only)


def test_list_bindings_function_not_found_returns_empty() -> None:
    source = "void other(void) { int x; }"
    pre = _make_pre_pass([32])
    assert list_bindings(source, "missing", pre) == []


def test_list_bindings_includes_params_when_observed() -> None:
    """Parameters appear in the binding list with kind='param'."""
    source = textwrap.dedent("""\
        void f(HSD_GObj* gobj, int n) {
            int local;
        }
    """)
    # Simulate: param virtuals 32, 33 then local virtual 34
    pre = _make_pre_pass([32, 33, 34])
    bindings = list_bindings(source, "f", pre)
    params = [b for b in bindings if b.kind == "param"]
    assert [b.var_name for b in params] == ["gobj", "n"]
    assert all(b.confidence == "best-guess" for b in params)


def test_list_bindings_unobserved_param_is_ambiguous() -> None:
    """If a parameter's expected virtual doesn't appear in pre-pass,
    confidence is 'ambiguous'."""
    source = "void f(HSD_GObj* gobj, int n) { int local; }"
    # Only two virtuals present — n's expected slot is missing
    pre = _make_pre_pass([32, 34])
    bindings = list_bindings(source, "f", pre)
    params = {b.var_name: b for b in bindings if b.kind == "param"}
    # gobj is observed (first virtual present), n is not
    assert params["gobj"].confidence == "best-guess"
    assert params["n"].confidence == "ambiguous"
```

- [ ] **Step 2: Run tests to verify failure**

```bash
python -m pytest tests/test_mwcc_debug_symbol_bridge.py::test_list_bindings_locals_only_assigns_in_order -v --no-cov 2>&1 | tail -5
```

Expected: `ImportError: cannot import name 'Binding'` or `'list_bindings'`.

- [ ] **Step 3: Implement `Binding` + `list_bindings` + a function-extraction helper**

Append to `symbol_bridge.py`:

```python
@dataclass
class Binding:
    """A source variable bound to its predicted MWCC virtual register."""
    var_name: str
    virtual: int           # -1 if unmapped
    decl_line: int         # 1-indexed line in original source
    kind: str              # "local" | "param"
    type_str: str
    confidence: str        # "best-guess" | "verified" | "rejected"
                           # | "ambiguous" | "unsupported"


_FN_HEADER_RE = re.compile(
    r"""
    (?P<retval>[^(){};\n]+?)            # return type / qualifiers
    \s+
    (?P<name>[A-Za-z_][A-Za-z_0-9]*)
    \s*
    \(
    (?P<params>[^()]*)                  # parameter list
    \)
    \s*
    (?=\{)
    """,
    re.VERBOSE | re.MULTILINE,
)


def _extract_function_text(
    source: str, fn_name: str
) -> Optional[tuple[str, str, int]]:
    """Return (params_text, body_text, start_line) for `fn_name`, or
    None if not found. params_text is the text inside (), body_text
    is the text including outer {}, start_line is 1-indexed."""
    cleaned = _strip_strings_and_comments(source)
    for m in _FN_HEADER_RE.finditer(cleaned):
        if m.group("name") != fn_name:
            continue
        # Find the matching body
        body_start = m.end()
        # m.end() points just before `{`
        idx = body_start
        depth = 0
        body_begin = None
        while idx < len(cleaned):
            c = cleaned[idx]
            if c == "{":
                if depth == 0:
                    body_begin = idx
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    body_end = idx + 1
                    body_text = source[body_begin:body_end]
                    params_text = m.group("params").strip()
                    start_line = source.count("\n", 0, m.start()) + 1
                    return (params_text, body_text, start_line)
            idx += 1
        return None
    return None


def _parse_params(params_text: str) -> list[LocalDecl]:
    """Parse a function's parameter list into LocalDecl entries (with
    kind set externally to 'param')."""
    params_text = params_text.strip()
    if not params_text or params_text == "void":
        return []
    out: list[LocalDecl] = []
    depth = 0
    buf: list[str] = []
    parts: list[str] = []
    for c in params_text:
        if c == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        buf.append(c)
    remainder = "".join(buf).strip()
    if remainder:
        parts.append(remainder)
    for i, part in enumerate(parts):
        m = re.match(
            r"^\s*(?P<type>.+?)\s+(?P<name>[A-Za-z_][A-Za-z_0-9]*)\s*$",
            part,
        )
        if m is None:
            continue
        type_str = re.sub(r"\s+", " ", m.group("type")).strip()
        type_str = re.sub(r"\s*\*\s*", "*", type_str)
        out.append(LocalDecl(
            name=m.group("name"),
            type_str=type_str,
            decl_index=i,
        ))
    return out


def _collect_virtual_destinations(pre_pass) -> list[int]:
    """Return the virtual register numbers (≥32) that appear as
    destinations in `pre_pass`, in first-occurrence order."""
    seen: list[int] = []
    seen_set: set[int] = set()
    for block in pre_pass.blocks:
        for ist in block.instructions:
            if not ist.regs:
                continue
            kind, num = ist.regs[0]
            if kind != "r":
                continue
            if num < 32:
                continue
            if num in seen_set:
                continue
            seen_set.add(num)
            seen.append(num)
    return seen


def list_bindings(source: str, fn_name: str, pre_pass) -> list[Binding]:
    """Return Binding entries (both params and locals) for `fn_name`.

    Heuristic: parameters take the first K virtuals (K = number of
    params), then locals follow in declaration order. If the pre-pass
    doesn't have enough virtuals for some entries, those get
    confidence='ambiguous' with virtual=-1.
    """
    extracted = _extract_function_text(source, fn_name)
    if extracted is None:
        return []
    params_text, body_text, start_line = extracted

    params = _parse_params(params_text)
    locals_ = walk_local_decls(body_text)
    virtuals = _collect_virtual_destinations(pre_pass)

    out: list[Binding] = []
    cursor = 0
    for p in params:
        if cursor < len(virtuals):
            out.append(Binding(
                var_name=p.name,
                virtual=virtuals[cursor],
                decl_line=start_line,
                kind="param",
                type_str=p.type_str,
                confidence="best-guess",
            ))
            cursor += 1
        else:
            out.append(Binding(
                var_name=p.name,
                virtual=-1,
                decl_line=start_line,
                kind="param",
                type_str=p.type_str,
                confidence="ambiguous",
            ))
    for ld in locals_:
        if cursor < len(virtuals):
            out.append(Binding(
                var_name=ld.name,
                virtual=virtuals[cursor],
                decl_line=start_line,
                kind="local",
                type_str=ld.type_str,
                confidence="best-guess",
            ))
            cursor += 1
        else:
            out.append(Binding(
                var_name=ld.name,
                virtual=-1,
                decl_line=start_line,
                kind="local",
                type_str=ld.type_str,
                confidence="ambiguous",
            ))
    return out
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_symbol_bridge.py --no-cov -v 2>&1 | tail -15
```

Expected: all tests pass (decl walker + binding tests).

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "mwcc-debug: symbol_bridge — list_bindings + heuristic mapping

Walks both params and locals, maps to virtuals via first-occurrence
order in the pre-coloring pass. Confidence='best-guess' for matched
entries, 'ambiguous' for entries whose expected virtual didn't
appear."
```

---

## Task 3: Symbol bridge — `find_*` lookups + CLI + calibration test gate

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/symbol_bridge.py`
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py`

Add the two lookup helpers (`find_virtual_for_var`, `find_var_for_virtual`), wire CLI commands, and run the calibration gate against real Melee functions. **If the calibration fails, STOP and report — the entire mutator layer trusts these mappings.**

- [ ] **Step 1: Write the failing tests for `find_*` helpers**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
from src.mwcc_debug.symbol_bridge import (
    find_var_for_virtual,
    find_virtual_for_var,
)


def test_find_virtual_for_var_existing_local() -> None:
    source = "void f(void) { int x; int y; }"
    pre = _make_pre_pass([32, 33])
    binding = find_virtual_for_var(source, "f", "y", pre)
    assert binding is not None
    assert binding.virtual == 33
    assert binding.kind == "local"


def test_find_virtual_for_var_unknown_returns_none() -> None:
    source = "void f(void) { int x; }"
    pre = _make_pre_pass([32])
    assert find_virtual_for_var(source, "f", "z", pre) is None


def test_find_var_for_virtual_inverse() -> None:
    source = "void f(void) { int a; int b; int c; }"
    pre = _make_pre_pass([32, 33, 34])
    binding = find_var_for_virtual(source, "f", 33, pre)
    assert binding is not None
    assert binding.var_name == "b"
```

- [ ] **Step 2: Run, confirm failure**

```bash
python -m pytest tests/test_mwcc_debug_symbol_bridge.py -v --no-cov 2>&1 | tail -5
```

- [ ] **Step 3: Implement the lookups**

Append to `symbol_bridge.py`:

```python
def find_virtual_for_var(
    source: str, fn_name: str, var_name: str, pre_pass
) -> Optional[Binding]:
    for b in list_bindings(source, fn_name, pre_pass):
        if b.var_name == var_name:
            return b
    return None


def find_var_for_virtual(
    source: str, fn_name: str, virtual: int, pre_pass
) -> Optional[Binding]:
    for b in list_bindings(source, fn_name, pre_pass):
        if b.virtual == virtual:
            return b
    return None
```

- [ ] **Step 4: Add CLI commands**

Locate the end of `debug.py` and append:

```python
@inspect_app.command(name="var-to-virtual")
def var_to_virtual(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function to look up (required).",
        ),
    ],
    var_name: Annotated[
        str,
        typer.Argument(help="Source-level variable name."),
    ],
    pcdump: Annotated[
        Optional[Path],
        typer.Argument(
            help="Path to pcdump.txt. Auto-resolves from cache.",
        ),
    ] = None,
    json_out: Annotated[
        bool,
        typer.Option("--json", help="Emit as JSON."),
    ] = False,
) -> None:
    """Bridge: given a source variable name, predict its MWCC virtual.

    Reports `confidence`: best-guess (decl-order heuristic matched),
    ambiguous (no observed virtual for this variable), or unsupported
    (e.g., variable lives in a macro the tokenizer can't see).
    """
    from ..mwcc_debug.symbol_bridge import find_virtual_for_var

    melee_root = DEFAULT_MELEE_ROOT
    pcdump_path = _resolve_pcdump_path(pcdump, function, melee_root)
    text = pcdump_path.read_text()
    fns = parse_pcdump(text)
    fn = next((f for f in fns if f.name == function), None)
    if fn is None:
        _abort_function_not_in_dump(function, [f.name for f in fns])
    pre = fn.last_precolor_pass()
    if pre is None:
        typer.echo(
            f"no pre-coloring pass for {function}", err=True,
        )
        raise typer.Exit(3)

    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(f"{function} not in report.json", err=True)
        raise typer.Exit(2)
    source = (melee_root / "src" / f"{unit}.c").read_text()
    binding = find_virtual_for_var(source, function, var_name, pre)

    if binding is None:
        if json_out:
            print(json.dumps({
                "var_name": var_name,
                "found": False,
            }, indent=2))
        else:
            typer.echo(
                f"variable {var_name!r} not found in {function}",
                err=True,
            )
        raise typer.Exit(1)

    if json_out:
        print(json.dumps({
            "var_name": binding.var_name,
            "virtual": binding.virtual,
            "kind": binding.kind,
            "type": binding.type_str,
            "confidence": binding.confidence,
            "found": True,
        }, indent=2))
    else:
        print(f"variable: {binding.var_name}")
        print(f"  virtual: r{binding.virtual}")
        print(f"  kind:    {binding.kind}")
        print(f"  type:    {binding.type_str}")
        print(f"  conf:    {binding.confidence}")


@inspect_app.command(name="virtual-to-var")
def virtual_to_var(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function to look up (required).",
        ),
    ],
    virtual: Annotated[
        int,
        typer.Argument(
            help="Virtual register number (32+), or ig_idx.",
        ),
    ],
    pcdump: Annotated[
        Optional[Path],
        typer.Argument(
            help="Path to pcdump.txt. Auto-resolves from cache.",
        ),
    ] = None,
    json_out: Annotated[
        bool,
        typer.Option("--json", help="Emit as JSON."),
    ] = False,
) -> None:
    """Bridge inverse: given a virtual register, predict the source
    variable name (decl-order heuristic).
    """
    from ..mwcc_debug.symbol_bridge import find_var_for_virtual

    melee_root = DEFAULT_MELEE_ROOT
    pcdump_path = _resolve_pcdump_path(pcdump, function, melee_root)
    text = pcdump_path.read_text()
    fns = parse_pcdump(text)
    fn = next((f for f in fns if f.name == function), None)
    if fn is None:
        _abort_function_not_in_dump(function, [f.name for f in fns])
    pre = fn.last_precolor_pass()
    if pre is None:
        typer.echo(
            f"no pre-coloring pass for {function}", err=True,
        )
        raise typer.Exit(3)

    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(f"{function} not in report.json", err=True)
        raise typer.Exit(2)
    source = (melee_root / "src" / f"{unit}.c").read_text()
    binding = find_var_for_virtual(source, function, virtual, pre)

    if binding is None:
        if json_out:
            print(json.dumps({
                "virtual": virtual,
                "found": False,
            }, indent=2))
        else:
            typer.echo(
                f"no source variable bound to r{virtual} in {function}",
                err=True,
            )
        raise typer.Exit(1)

    if json_out:
        print(json.dumps({
            "var_name": binding.var_name,
            "virtual": binding.virtual,
            "kind": binding.kind,
            "type": binding.type_str,
            "confidence": binding.confidence,
            "found": True,
        }, indent=2))
    else:
        print(f"r{virtual}: {binding.var_name} ({binding.kind})")
        print(f"  type:    {binding.type_str}")
        print(f"  conf:    {binding.confidence}")
```

- [ ] **Step 5: Smoke test CLI**

```bash
cd /Users/mike/code/melee
python -m src.cli debug inspect var-to-virtual --help 2>&1 | tail -5
python -m src.cli debug inspect virtual-to-var --help 2>&1 | tail -5
```

Expected: both show help.

- [ ] **Step 6: Calibration gate — write the calibration tests against real functions**

Append to `test_mwcc_debug_symbol_bridge.py`:

```python
import pathlib

import pytest

from src.mwcc_debug.parser import parse_pcdump

CALIBRATION_FIXTURES = (
    pathlib.Path(__file__).parent / "fixtures" / "mwcc_debug"
)


@pytest.mark.skipif(
    not (CALIBRATION_FIXTURES / "fn_80247510_pcdump.txt").exists(),
    reason="fn_80247510 fixture not present",
)
def test_calibration_fn_80247510_has_param_gobj() -> None:
    """Calibration gate: fn_80247510's first parameter gobj must bind
    to a virtual ≥32 with kind='param'."""
    pcdump_text = (
        CALIBRATION_FIXTURES / "fn_80247510_pcdump.txt"
    ).read_text()
    source_path = pathlib.Path(
        "/Users/mike/code/melee/src/melee/mn/mnvibration.c"
    )
    if not source_path.exists():
        pytest.skip("mnvibration.c not present")
    source = source_path.read_text()

    fns = parse_pcdump(pcdump_text)
    fn = next((f for f in fns if f.name == "fn_80247510"), None)
    assert fn is not None
    pre = fn.last_precolor_pass()
    assert pre is not None

    bindings = list_bindings(source, "fn_80247510", pre)
    params = [b for b in bindings if b.kind == "param"]
    assert params, "fn_80247510 must have at least one param binding"
    # gobj is the first param
    assert params[0].var_name == "gobj"
    assert params[0].virtual >= 32
    assert params[0].confidence == "best-guess"


@pytest.mark.skipif(
    not pathlib.Path(
        "/Users/mike/code/melee/src/melee/mn/mnevent.c"
    ).exists(),
    reason="mnevent.c not present",
)
def test_calibration_fn_8024e1b4_dual_pointer_locals() -> None:
    """Calibration: fn_8024E1B4 has locals tree, tmp, data, iter, i
    (per MEMORY.md dual-pointer pattern). The bridge should find them."""
    source = pathlib.Path(
        "/Users/mike/code/melee/src/melee/mn/mnevent.c"
    ).read_text()
    # Build a synthetic pre_pass with enough virtuals (one per
    # expected entity: gobj param + 5 locals = 6 virtuals).
    pre = _make_pre_pass([32, 33, 34, 35, 36, 37])
    bindings = list_bindings(source, "fn_8024E1B4", pre)
    names = [b.var_name for b in bindings]
    # Expect: gobj (param), then tree, tmp, data, iter, i (locals)
    assert "gobj" in names
    assert "tree" in names
    assert "tmp" in names
    assert "data" in names
    assert "iter" in names
    assert "i" in names

    # Verify ordering: gobj is param, the rest are locals in source order
    param_names = [b.var_name for b in bindings if b.kind == "param"]
    local_names = [b.var_name for b in bindings if b.kind == "local"]
    assert param_names == ["gobj"]
    assert local_names == ["tree", "tmp", "data", "iter", "i"]
```

- [ ] **Step 7: Run the calibration tests — HARD GATE**

```bash
python -m pytest tests/test_mwcc_debug_symbol_bridge.py -v --no-cov 2>&1 | tail -20
```

Expected: all tests pass, including the calibration tests against
fn_80247510 and fn_8024E1B4.

**If calibration fails: STOP. Do not proceed to mutators (Task 4+).
Diagnose the bridge bug, fix it, re-run calibration. The mutator
layer depends on this gate.**

- [ ] **Step 8: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/symbol_bridge.py \
        tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py
git commit -m "mwcc-debug: symbol_bridge — find_*, CLI, calibration gate

Adds find_virtual_for_var/find_var_for_virtual lookups, two CLI
commands (debug inspect var-to-virtual, debug inspect virtual-to-var), and the
calibration tests against fn_80247510 (param-iter-ceiling case) and
fn_8024E1B4 (dual-pointer pattern). Calibration is a HARD gate
before Tier 3 mutators ship."
```

---

## Task 4: Mutators — module skeleton + `mutate_type_change`

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/mutators.py`
- Create: `tools/melee-agent/tests/test_mwcc_debug_mutators.py`

First mutator: change a local's declared type. Tokenizer-based, leveraging the existing decl walker.

- [ ] **Step 1: Write the failing tests**

Create `tools/melee-agent/tests/test_mwcc_debug_mutators.py`:

```python
"""Tests for the Tier 3 source mutator library."""

from __future__ import annotations

import textwrap

import pytest

from src.mwcc_debug.mutators import (
    MutationUnsupported,
    mutate_type_change,
)


def test_mutate_type_change_simple() -> None:
    """Change `int x` to `u32 x`."""
    source = textwrap.dedent("""\
        void f(void) {
            int x;
            x = 5;
        }
    """)
    result = mutate_type_change(source, "f", "x", "u32")
    assert "u32 x;" in result
    assert "int x;" not in result


def test_mutate_type_change_with_pointer_type() -> None:
    source = textwrap.dedent("""\
        void f(HSD_GObj* gobj) {
            HSD_JObj* j;
            j = gobj->hsd_obj;
        }
    """)
    result = mutate_type_change(source, "f", "j", "void*")
    assert "void* j;" in result
    assert "HSD_JObj* j;" not in result


def test_mutate_type_change_preserves_initializer() -> None:
    """`int x = 5;` → `u32 x = 5;`."""
    source = "void f(void) { int x = 5; }"
    result = mutate_type_change(source, "f", "x", "u32")
    assert "u32 x = 5;" in result


def test_mutate_type_change_unknown_var_raises() -> None:
    source = "void f(void) { int x; }"
    with pytest.raises(MutationUnsupported):
        mutate_type_change(source, "f", "missing", "u32")


def test_mutate_type_change_unknown_function_raises() -> None:
    source = "void other(void) { int x; }"
    with pytest.raises(MutationUnsupported):
        mutate_type_change(source, "missing", "x", "u32")


def test_mutate_type_change_only_touches_target_decl() -> None:
    """Other decls (and uses) of similarly-named variables aren't
    touched."""
    source = textwrap.dedent("""\
        void f(void) {
            int x;
            int y;
            x = y;
        }
    """)
    result = mutate_type_change(source, "f", "x", "u32")
    assert "u32 x;" in result
    assert "int y;" in result
    # The use `x = y;` is unchanged in body
    assert "x = y;" in result
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
python -m pytest tests/test_mwcc_debug_mutators.py -v --no-cov 2>&1 | tail -5
```

Expected: ModuleNotFoundError.

- [ ] **Step 3: Implement mutators.py with `mutate_type_change`**

Create `tools/melee-agent/src/mwcc_debug/mutators.py`:

```python
"""Tier 3 source mutators — tokenizer-based, no pycparser.

Each mutator takes a full source string + a function name + mutation
parameters, returns mutated source as a string. Raises
`MutationUnsupported` when the tokenizer can't unambiguously locate
the target — orchestrator skips that seed.
"""

from __future__ import annotations

import re
from typing import Optional

from .symbol_bridge import (
    _extract_function_text,
    _strip_strings_and_comments,
    walk_local_decls,
)


class MutationUnsupported(Exception):
    """Raised when a mutator can't unambiguously locate its target."""


def _normalize_type(type_str: str) -> str:
    """Compact whitespace and `*` placement to the canonical form
    used by walk_local_decls (`HSD_JObj*`, not `HSD_JObj *`)."""
    return re.sub(r"\s*\*\s*", "*", re.sub(r"\s+", " ", type_str.strip()))


def mutate_type_change(
    source: str,
    fn_name: str,
    var_name: str,
    new_type: str,
) -> str:
    """Change `<old_type> <var_name>` to `<new_type> <var_name>` in
    `fn_name`'s body. Only touches the declaration; uses are left alone.
    """
    extracted = _extract_function_text(source, fn_name)
    if extracted is None:
        raise MutationUnsupported(f"function {fn_name!r} not found")
    _params_text, body_text, _start_line = extracted
    decls = walk_local_decls(body_text)
    target = next((d for d in decls if d.name == var_name), None)
    if target is None:
        raise MutationUnsupported(
            f"variable {var_name!r} not found in {fn_name!r}"
        )

    # Find the body's absolute offset in source. We located fn body via
    # extract; redo with character search.
    body_start_in_source = source.find(body_text)
    if body_start_in_source < 0:
        raise MutationUnsupported(
            "could not relocate function body in source"
        )

    # Pattern to match the declaration head:
    # one or more whitespace-separated tokens (type tokens) followed by
    # the variable name and either `=` or `;`. We anchor on the variable
    # name to avoid ambiguity.
    pattern = re.compile(
        r"((?:[A-Za-z_][A-Za-z_0-9]*\s*\**\s*)+)"
        r"(" + re.escape(var_name) + r")"
        r"(\s*(?:=|;))",
    )
    body_modified, count = pattern.subn(
        lambda m: (
            (_normalize_type(new_type) + " " if new_type[-1].isalnum()
             else _normalize_type(new_type))
            + m.group(2)
            + m.group(3)
        ),
        body_text,
        count=1,
    )
    if count == 0:
        raise MutationUnsupported(
            f"declaration of {var_name!r} did not match the expected "
            f"`<type> <name> [=|;]` pattern"
        )

    return (
        source[:body_start_in_source]
        + body_modified
        + source[body_start_in_source + len(body_text):]
    )
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_mutators.py -v --no-cov 2>&1 | tail -10
```

Expected: all 6 type-change tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/mutators.py \
        tools/melee-agent/tests/test_mwcc_debug_mutators.py
git commit -m "mwcc-debug: mutators — mutate_type_change + skeleton

First mutator: changes a local's declared type while leaving uses
unchanged. Tokenizer-based per the v1 spec. MutationUnsupported is
raised when the tokenizer can't unambiguously locate the target."
```

---

## Task 5: Mutators — `mutate_insert_alias_before_use`

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/mutators.py`
- Modify: `tools/melee-agent/tests/test_mwcc_debug_mutators.py`

Second mutator. Insert a fresh local copy of a variable before the N-th statement that reads it, and rewrite that one statement.

- [ ] **Step 1: Write the failing tests**

Append to `test_mwcc_debug_mutators.py`:

```python
from src.mwcc_debug.mutators import mutate_insert_alias_before_use


def test_mutate_insert_alias_before_first_use() -> None:
    """Insert `data_alias = data;` before the first use of `data`."""
    source = textwrap.dedent("""\
        void f(MnEventData* data) {
            data->x = 0;
            data->y = 1;
        }
    """)
    result = mutate_insert_alias_before_use(
        source, "f", "data", at_stmt_index=0,
    )
    # Alias decl is inserted before the first use
    assert "MnEventData* data_alias = data;" in result
    # First use is rewritten to data_alias
    assert "data_alias->x = 0;" in result
    # Second use is unchanged
    assert "data->y = 1;" in result


def test_mutate_insert_alias_before_second_use() -> None:
    source = textwrap.dedent("""\
        void f(MnEventData* data) {
            data->x = 0;
            data->y = 1;
            data->z = 2;
        }
    """)
    result = mutate_insert_alias_before_use(
        source, "f", "data", at_stmt_index=1,
    )
    # First use unchanged
    assert "data->x = 0;" in result
    # Second use rewritten
    assert "data_alias->y = 1;" in result
    # Third use unchanged
    assert "data->z = 2;" in result


def test_mutate_insert_alias_custom_name() -> None:
    source = "void f(int* p) { *p = 0; }"
    result = mutate_insert_alias_before_use(
        source, "f", "p", at_stmt_index=0, new_name="alt",
    )
    assert "int* alt = p;" in result
    assert "*alt = 0;" in result


def test_mutate_insert_alias_unknown_var_raises() -> None:
    source = "void f(int* p) { *p = 0; }"
    with pytest.raises(MutationUnsupported):
        mutate_insert_alias_before_use(
            source, "f", "missing", at_stmt_index=0,
        )


def test_mutate_insert_alias_index_out_of_range_raises() -> None:
    """If at_stmt_index >= number of reading statements, raise."""
    source = "void f(int* p) { *p = 0; }"
    with pytest.raises(MutationUnsupported):
        mutate_insert_alias_before_use(
            source, "f", "p", at_stmt_index=5,
        )


def test_mutate_insert_alias_skips_lhs_of_assignment() -> None:
    """`p = ...;` is a WRITE, not a read — alias-split skips it."""
    source = textwrap.dedent("""\
        void f(void) {
            int* p;
            p = 0;
            p[0] = 1;
        }
    """)
    result = mutate_insert_alias_before_use(
        source, "f", "p", at_stmt_index=0,
    )
    # First read (after the write) is `p[0] = 1;`
    assert "p[0] = 1;" not in result.split("p_alias = p;")[0]
    assert "p_alias[0] = 1;" in result
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
python -m pytest tests/test_mwcc_debug_mutators.py -v --no-cov 2>&1 | tail -10
```

Expected: ImportError on `mutate_insert_alias_before_use`.

- [ ] **Step 3: Implement `mutate_insert_alias_before_use`**

Append to `mutators.py`:

```python
def _get_var_type_in_fn(
    source: str, fn_name: str, var_name: str
) -> Optional[str]:
    """Return the type as declared in `fn_name` for `var_name`.
    Looks at locals first, then parameters."""
    from .symbol_bridge import _parse_params
    extracted = _extract_function_text(source, fn_name)
    if extracted is None:
        return None
    params_text, body_text, _ = extracted
    for d in walk_local_decls(body_text):
        if d.name == var_name:
            return d.type_str
    for p in _parse_params(params_text):
        if p.name == var_name:
            return p.type_str
    return None


def _split_function_body_into_statements(body_text: str) -> list[tuple[int, int, str]]:
    """Return (start_offset, end_offset, statement_text) per top-level
    statement in the body. Offsets are into `body_text`, with the
    end being just after the trailing `;` or `}`. Strings/comments
    are NOT stripped here — caller may need original text for
    rewriting.
    """
    cleaned = _strip_strings_and_comments(body_text)
    # Body starts with `{`, ends with `}`. Skip those.
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx < 0 or end_idx <= start_idx:
        return []

    stmts: list[tuple[int, int, str]] = []
    depth_brace = 0
    depth_paren = 0
    stmt_start: Optional[int] = None
    i = start_idx + 1
    while i < end_idx:
        c = cleaned[i]
        if stmt_start is None and not c.isspace():
            stmt_start = i
        if c == "{":
            depth_brace += 1
        elif c == "}":
            depth_brace -= 1
        elif c == "(":
            depth_paren += 1
        elif c == ")":
            depth_paren -= 1
        if c == ";" and depth_brace == 0 and depth_paren == 0:
            if stmt_start is not None:
                stmts.append((
                    stmt_start, i + 1, body_text[stmt_start:i + 1]
                ))
                stmt_start = None
        i += 1
    return stmts


def _statement_is_reading_use(
    stmt_text: str, var_name: str
) -> bool:
    """True if `stmt_text` reads `var_name` somewhere AND is NOT a
    simple `var_name = ...;` write.

    v1 only checks the simple write case (LHS = single bare identifier).
    Compound writes like `var_name->x = ...` are reads-of-var_name.
    """
    cleaned = _strip_strings_and_comments(stmt_text)
    word_re = re.compile(r"\b" + re.escape(var_name) + r"\b")
    if not word_re.search(cleaned):
        return False
    # If statement is `<var> = <expr>;` exactly, it's a write.
    write_re = re.compile(
        r"^\s*" + re.escape(var_name) + r"\s*=\s*[^=]"
    )
    return not write_re.match(cleaned)


def mutate_insert_alias_before_use(
    source: str,
    fn_name: str,
    var_name: str,
    at_stmt_index: int,
    new_name: Optional[str] = None,
) -> str:
    """Insert `<type> <new_name> = <var_name>;` immediately before the
    N-th reading statement of `var_name`, and replace bare references
    to `var_name` in THAT statement with `new_name`. Other statements
    are unchanged.
    """
    if new_name is None:
        new_name = var_name + "_alias"

    extracted = _extract_function_text(source, fn_name)
    if extracted is None:
        raise MutationUnsupported(f"function {fn_name!r} not found")
    _params_text, body_text, _ = extracted

    var_type = _get_var_type_in_fn(source, fn_name, var_name)
    if var_type is None:
        raise MutationUnsupported(
            f"variable {var_name!r} not found in {fn_name!r}"
        )

    statements = _split_function_body_into_statements(body_text)
    reading_stmts = [
        (start, end, text) for (start, end, text) in statements
        if _statement_is_reading_use(text, var_name)
    ]
    if at_stmt_index >= len(reading_stmts):
        raise MutationUnsupported(
            f"at_stmt_index={at_stmt_index} out of range "
            f"(only {len(reading_stmts)} reading statements)"
        )
    target_start, target_end, target_text = reading_stmts[at_stmt_index]

    # Rewrite the target statement: replace bare `var_name` tokens
    # with `new_name`. Use word-boundary regex to avoid touching
    # substrings.
    word_re = re.compile(r"\b" + re.escape(var_name) + r"\b")
    rewritten = word_re.sub(new_name, target_text)

    # Find leading indentation on the target line so the inserted
    # alias decl matches it.
    line_start = body_text.rfind("\n", 0, target_start) + 1
    indent = ""
    j = line_start
    while j < target_start and body_text[j] in " \t":
        indent += body_text[j]
        j += 1

    insert = f"{indent}{var_type} {new_name} = {var_name};\n"

    new_body = (
        body_text[:line_start]
        + insert
        + body_text[line_start:target_start]
        + rewritten
        + body_text[target_end:]
    )

    body_start_in_source = source.find(body_text)
    if body_start_in_source < 0:
        raise MutationUnsupported(
            "could not relocate function body in source"
        )
    return (
        source[:body_start_in_source]
        + new_body
        + source[body_start_in_source + len(body_text):]
    )
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_mutators.py -v --no-cov 2>&1 | tail -15
```

Expected: all 12 mutator tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/mutators.py \
        tools/melee-agent/tests/test_mwcc_debug_mutators.py
git commit -m "mwcc-debug: mutators — mutate_insert_alias_before_use

Inserts a fresh local before the N-th reading statement of a target
variable, rewriting that one statement's references to use the
alias. Skips the simple `var = ...;` write case so only reads are
counted. v1 restricted to bare-identifier reads — macros and complex
lvalue patterns deferred to v2."
```

---

## Task 6: Mutator regression test on fn_8024E1B4

**Files:**
- Modify: `tools/melee-agent/tests/test_mwcc_debug_mutators.py`

Pin the spec's required regression test: applying `mutate_insert_alias_before_use` to a synthetic "before" version of fn_8024E1B4 produces source matching the current "after" shape.

- [ ] **Step 1: Write the regression test**

Append to `test_mwcc_debug_mutators.py`:

```python
def test_regression_fn_8024e1b4_dual_pointer_shape() -> None:
    """Pin the dual-pointer mutation shape: starting from a simple
    function reading `data` once, mutate_insert_alias to produce the
    aliased version. This is the v1 mutator's reproduction target
    from MEMORY.md (`fn_8024E1B4` dual-pointer pattern).
    """
    before = textwrap.dedent("""\
        void fn_8024E1B4(HSD_GObj* gobj)
        {
            MnEventData* data = GET_EVENTDATA(gobj);
            HSD_GObjPLink_80390228(data->gobjs[0]);
        }
    """)
    result = mutate_insert_alias_before_use(
        before, "fn_8024E1B4", "data", at_stmt_index=0,
        new_name="tmp",
    )
    # The dual-pointer pattern: `tmp = data;` inserted before the use
    assert "MnEventData* tmp = data;" in result
    assert "HSD_GObjPLink_80390228(tmp->gobjs[0]);" in result
    # The decl line itself isn't touched
    assert "MnEventData* data = GET_EVENTDATA(gobj);" in result
```

- [ ] **Step 2: Run, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_mutators.py::test_regression_fn_8024e1b4_dual_pointer_shape -v --no-cov 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/tests/test_mwcc_debug_mutators.py
git commit -m "mwcc-debug: mutators — fn_8024E1B4 dual-pointer regression test

Pins the spec's required regression: applying mutate_insert_alias to
a synthetic 'before' version of fn_8024E1B4 produces the documented
dual-pointer pattern from MEMORY.md."
```

---

## Task 7: Mutator CLI commands

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`

Expose the mutators as CLI subcommands.

- [ ] **Step 1: Add CLI commands**

Append to `debug.py`:

```python
mutate_app = typer.Typer(
    help="Tier 3: targeted source mutations on specific variables.",
)
debug_app.add_typer(mutate_app, name="mutate")


def _read_source_for(function: str, melee_root: Path) -> tuple[Path, str]:
    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(f"{function} not in report.json", err=True)
        raise typer.Exit(2)
    p = melee_root / "src" / f"{unit}.c"
    return p, p.read_text()


@mutate_app.command(name="type-change")
def mutate_type_change_cmd(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function containing the variable.",
        ),
    ],
    var: Annotated[
        str,
        typer.Option("--var", help="Local variable name to retype."),
    ],
    new_type: Annotated[
        str,
        typer.Option("--type", help="New type string (e.g., 'u32')."),
    ],
    apply: Annotated[
        bool,
        typer.Option(
            "--apply",
            help="Write the mutated source back to the file. "
                 "Default: print to stdout.",
        ),
    ] = False,
) -> None:
    """Change a local variable's declared type."""
    from ..mwcc_debug.mutators import MutationUnsupported, mutate_type_change

    melee_root = DEFAULT_MELEE_ROOT
    src_path, source = _read_source_for(function, melee_root)
    try:
        out = mutate_type_change(source, function, var, new_type)
    except MutationUnsupported as e:
        typer.echo(f"mutation failed: {e}", err=True)
        raise typer.Exit(2)
    if apply:
        src_path.write_text(out)
        typer.echo(f"wrote: {src_path}", err=True)
    else:
        print(out, end="")


@mutate_app.command(name="insert-alias")
def mutate_insert_alias_cmd(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function containing the variable.",
        ),
    ],
    var: Annotated[
        str,
        typer.Option("--var", help="Local variable name to alias."),
    ],
    at: Annotated[
        int,
        typer.Option(
            "--at",
            help="0-indexed N-th reading statement to alias before.",
        ),
    ] = 0,
    new_name: Annotated[
        Optional[str],
        typer.Option(
            "--name",
            help="Alias variable name (default: <var>_alias).",
        ),
    ] = None,
    apply: Annotated[
        bool,
        typer.Option(
            "--apply",
            help="Write the mutated source back to the file. "
                 "Default: print to stdout.",
        ),
    ] = False,
) -> None:
    """Insert a fresh local copy of a variable before the N-th
    reading statement and rewrite that statement to use the alias."""
    from ..mwcc_debug.mutators import (
        MutationUnsupported, mutate_insert_alias_before_use,
    )

    melee_root = DEFAULT_MELEE_ROOT
    src_path, source = _read_source_for(function, melee_root)
    try:
        out = mutate_insert_alias_before_use(
            source, function, var, at_stmt_index=at, new_name=new_name,
        )
    except MutationUnsupported as e:
        typer.echo(f"mutation failed: {e}", err=True)
        raise typer.Exit(2)
    if apply:
        src_path.write_text(out)
        typer.echo(f"wrote: {src_path}", err=True)
    else:
        print(out, end="")
```

- [ ] **Step 2: Smoke test the CLI**

```bash
cd /Users/mike/code/melee
python -m src.cli debug mutate --help 2>&1 | tail -10
python -m src.cli debug mutate type-change --help 2>&1 | tail -10
python -m src.cli debug mutate insert-alias --help 2>&1 | tail -10
```

Expected: each shows help text with the documented flags.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py
git commit -m "mwcc-debug: debug mutate type-change / insert-alias CLI

Exposes the v1 mutators as Typer subcommands. Default writes to
stdout; --apply writes back to the source file."
```

---

## Task 8: Orchestrator — `tier3_search.py` module + seed generation

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/tier3_search.py`
- Create: `tools/melee-agent/tests/test_mwcc_debug_tier3_search.py`

Seed generator: given a function + analysis output, produce a list of seed descriptions. No permuter integration yet — just the seed candidates as data.

- [ ] **Step 1: Write the failing tests**

Create `tools/melee-agent/tests/test_mwcc_debug_tier3_search.py`:

```python
"""Tests for the Tier 3 orchestrator's seed generator + planner."""

from __future__ import annotations

import textwrap

from src.mwcc_debug.symbol_bridge import Binding
from src.mwcc_debug.tier3_search import (
    SeedPlan,
    plan_seeds,
)


def _local(name: str, type_str: str, virtual: int = 33) -> Binding:
    return Binding(
        var_name=name, virtual=virtual, decl_line=1,
        kind="local", type_str=type_str, confidence="best-guess",
    )


def test_plan_seeds_emits_type_widen_and_shrink_for_locals() -> None:
    """For an integer local, plan both widening and shrinking seeds
    (let the score sort)."""
    bindings = [_local("count", "u8")]
    plans = plan_seeds(bindings, budget=10)
    descriptions = [p.description for p in plans]
    assert any(
        "type-change" in d and "count" in d for d in descriptions
    )
    # u8 → u32 widen AND u8 → s8 shrink expected
    assert sum("u32" in d for d in descriptions) >= 1
    assert sum("s8" in d for d in descriptions) >= 1


def test_plan_seeds_emits_alias_split_for_pointer_locals() -> None:
    """For a pointer local, plan an alias-split seed."""
    bindings = [_local("data", "HSD_GObj*")]
    plans = plan_seeds(bindings, budget=5)
    assert any(p.mutator == "insert-alias" for p in plans)


def test_plan_seeds_respects_budget() -> None:
    """If candidates exceed budget, truncate by priority order."""
    bindings = [_local(f"v{i}", "u8") for i in range(10)]
    plans = plan_seeds(bindings, budget=3)
    assert len(plans) == 3


def test_plan_seeds_skips_unsupported_confidence() -> None:
    """Bindings with confidence='unsupported' or 'ambiguous' are skipped."""
    bindings = [
        _local("ok", "u8"),
        Binding(
            var_name="bad", virtual=-1, decl_line=1,
            kind="local", type_str="u8", confidence="ambiguous",
        ),
    ]
    plans = plan_seeds(bindings, budget=10)
    target_vars = {p.target_var for p in plans}
    assert "ok" in target_vars
    assert "bad" not in target_vars


def test_plan_seeds_skips_params() -> None:
    """v1 mutators don't operate on params — skip them in planning."""
    bindings = [
        Binding(
            var_name="gobj", virtual=32, decl_line=1, kind="param",
            type_str="HSD_GObj*", confidence="best-guess",
        ),
        _local("data", "HSD_GObj*"),
    ]
    plans = plan_seeds(bindings, budget=10)
    target_vars = {p.target_var for p in plans}
    assert "gobj" not in target_vars
    assert "data" in target_vars
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
python -m pytest tests/test_mwcc_debug_tier3_search.py -v --no-cov 2>&1 | tail -5
```

Expected: ModuleNotFoundError.

- [ ] **Step 3: Implement seed planner**

Create `tools/melee-agent/src/mwcc_debug/tier3_search.py`:

```python
"""Tier 3 orchestrator: seed planner + multi-start search."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .symbol_bridge import Binding


_INTEGER_TYPES = {"u8", "u16", "u32", "s8", "s16", "s32", "int", "long"}
_POINTER_SUFFIXES = ("*",)

# Per-pattern seed expansions: source-type → list of new types to try.
# v1 keeps this small; expanded as Tier 3 matures.
_TYPE_VARIANTS: dict[str, list[str]] = {
    "u8": ["u32", "s8"],
    "u16": ["u32", "s16"],
    "s8": ["u8", "s32"],
    "s16": ["s32", "u16"],
    "u32": ["s32", "u8"],
    "s32": ["u32", "s8"],
    "int": ["long", "short"],
}


@dataclass
class SeedPlan:
    """One planned seed to materialize + score."""
    mutator: str            # "type-change" | "insert-alias"
    target_var: str
    args: dict              # mutator-specific args
    description: str        # human-readable; goes into logs + reports


def plan_seeds(
    bindings: list[Binding], budget: int = 5,
) -> list[SeedPlan]:
    """Given the function's variable bindings, propose up to `budget`
    seed mutations in priority order.

    Priority:
      1. Locals with confidence='best-guess' or 'verified'
      2. Pointer locals → alias-split before first use
      3. Integer locals → type-change widening + shrinking variants
    Bindings with kind='param' or confidence in {ambiguous, unsupported,
    rejected} are skipped.
    """
    plans: list[SeedPlan] = []

    for b in bindings:
        if b.kind != "local":
            continue
        if b.confidence not in ("best-guess", "verified"):
            continue

        # Pointer alias-split
        if any(b.type_str.endswith(s) for s in _POINTER_SUFFIXES):
            plans.append(SeedPlan(
                mutator="insert-alias",
                target_var=b.var_name,
                args={"at_stmt_index": 0},
                description=(
                    f"insert-alias before first use of "
                    f"{b.var_name} ({b.type_str})"
                ),
            ))
            continue

        # Integer type-change variants
        base = b.type_str.strip()
        for variant in _TYPE_VARIANTS.get(base, []):
            plans.append(SeedPlan(
                mutator="type-change",
                target_var=b.var_name,
                args={"new_type": variant},
                description=(
                    f"type-change {b.var_name}: {base} → {variant}"
                ),
            ))

    return plans[:budget]
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
python -m pytest tests/test_mwcc_debug_tier3_search.py -v --no-cov 2>&1 | tail -10
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/tier3_search.py \
        tools/melee-agent/tests/test_mwcc_debug_tier3_search.py
git commit -m "mwcc-debug: tier3_search — seed planner

Given a list of source variable bindings, propose up to N seed
mutations in priority order. v1 plans alias-splits for pointer
locals and type-change widening/shrinking for integer locals. Skips
params (out of v1 mutator scope) and low-confidence bindings."
```

---

## Task 9: Orchestrator — `tier3-search` CLI command with loud failure detection

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/src/mwcc_debug/tier3_search.py`

Wire the planner into a full CLI command. Materialize each seed inside `nonmatchings/<fn>/tier3_seed_<idx>/`, run the existing Tier 2 `permute` infrastructure on each, track best. Exit non-zero if all seeds fail to compile.

- [ ] **Step 1: Add `materialize_seeds` to `tier3_search.py`**

Append to `tier3_search.py`:

```python
import shlex
import subprocess
from pathlib import Path

from .mutators import (
    MutationUnsupported,
    mutate_insert_alias_before_use,
    mutate_type_change,
)


@dataclass
class MaterializedSeed:
    """A seed source written to disk + its plan."""
    plan: SeedPlan
    source_path: Path        # the mutated .c file
    seed_dir: Path           # nonmatchings/<fn>/tier3_seed_<idx>/
    compiles: bool           # set after the smoke compile


def materialize_seed(
    base_source: str,
    fn_name: str,
    plan: SeedPlan,
    seed_dir: Path,
) -> Optional[Path]:
    """Apply the plan to base_source, write result to seed_dir/base.c.

    Returns the path to the written .c, or None if the mutation
    raises MutationUnsupported.
    """
    try:
        if plan.mutator == "type-change":
            mutated = mutate_type_change(
                base_source, fn_name, plan.target_var,
                plan.args["new_type"],
            )
        elif plan.mutator == "insert-alias":
            mutated = mutate_insert_alias_before_use(
                base_source, fn_name, plan.target_var,
                at_stmt_index=plan.args["at_stmt_index"],
            )
        else:
            return None
    except MutationUnsupported:
        return None

    seed_dir.mkdir(parents=True, exist_ok=True)
    out = seed_dir / "base.c"
    out.write_text(mutated)
    return out


def smoke_compile(
    seed_source_path: Path,
    wibo: Path,
    debug_compiler: Path,
    cflags: str,
    cwd: Path,
) -> bool:
    """Quick compile attempt — returns True iff the .o is produced
    successfully. Discards the .o."""
    args = (
        [str(wibo), str(debug_compiler)]
        + shlex.split(cflags)
        + ["-c", str(seed_source_path.relative_to(cwd)),
           "-o", "/tmp/tier3_smoke.o"]
    )
    try:
        proc = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=30,
        )
        return proc.returncode == 0 and Path("/tmp/tier3_smoke.o").exists()
    except subprocess.TimeoutExpired:
        return False
```

- [ ] **Step 2: Add the `tier3-search` CLI command**

Append to `debug.py`:

```python
@debug_app.command(name="tier3-search")
def tier3_search(
    function: Annotated[
        str,
        typer.Option(
            "--function", "-f",
            help="Function to search (required).",
        ),
    ],
    budget: Annotated[
        int,
        typer.Option(
            "--budget",
            help="Maximum number of seed mutations to try. Hard cap "
                 "on seed count; truncated by priority order.",
        ),
    ] = 5,
    per_seed_iters: Annotated[
        int,
        typer.Option(
            "--per-seed-iters",
            help="Permuter iterations per seed.",
        ),
    ] = 200,
    perm_root: Annotated[
        Path,
        typer.Option(
            "--perm-root",
            help="Root of decomp-permuter clone.",
        ),
    ] = Path("~/code/decomp-permuter").expanduser(),
    target: Annotated[
        Optional[Path],
        typer.Option(
            "--target", "-t",
            help="Target spec; auto-derived if omitted.",
        ),
    ] = None,
    blend: Annotated[
        float,
        typer.Option("--blend", help="mwcc-score blend weight."),
    ] = 0.1,
) -> None:
    """Tier 3: multi-start search over targeted mutation seeds.

    Workflow:
      1. Resolve pcdump + target.
      2. Enumerate variable bindings via the symbol bridge.
      3. Plan up to --budget seed mutations.
      4. Materialize each seed inside
         nonmatchings/<fn>/tier3_seed_<idx>/.
      5. Smoke-compile each. If all seeds fail, exit non-zero with a
         clear message.
      6. For each compiling seed, run `debug permute` (Tier 2) with
         --per-seed-iters iterations.
      7. Report the best result.
    """
    from ..mwcc_debug.symbol_bridge import list_bindings
    from ..mwcc_debug.tier3_search import (
        materialize_seed,
        plan_seeds,
        smoke_compile,
    )

    melee_root = DEFAULT_MELEE_ROOT

    # Resolve unit + sources
    unit = _find_unit_for_function(function, melee_root)
    if unit is None:
        typer.echo(f"{function} not in report.json", err=True)
        raise typer.Exit(2)
    src_rel = f"src/{unit}.c"
    src_path = melee_root / src_rel
    base_source = src_path.read_text()

    # Resolve pcdump for the bridge
    pcdump_path = _resolve_pcdump_path(None, function, melee_root)
    text = pcdump_path.read_text()
    fns = parse_pcdump(text)
    fn = next((f for f in fns if f.name == function), None)
    if fn is None:
        _abort_function_not_in_dump(function, [f.name for f in fns])
    pre = fn.last_precolor_pass()
    if pre is None:
        typer.echo(
            f"no pre-coloring pass for {function}", err=True,
        )
        raise typer.Exit(3)

    bindings = list_bindings(base_source, function, pre)
    plans = plan_seeds(bindings, budget=budget)
    if not plans:
        typer.echo(
            "no Tier 3 targets; fall back to `debug permute -f "
            f"{function}` for a vanilla Tier 2 run.",
            err=True,
        )
        raise typer.Exit(1)

    print(f"[tier3] {len(plans)} seed plans:")
    for i, p in enumerate(plans):
        print(f"  seed{i}: {p.description}")

    # Materialize + smoke-compile
    wibo = _find_wibo()
    debug_compiler = _find_compiler_dir() / "mwcceppc_debug.exe"
    if wibo is None or not wibo.exists() or not debug_compiler.exists():
        typer.echo(
            "wibo or patched compiler missing. "
            "Run `debug setup-local` first.",
            err=True,
        )
        raise typer.Exit(4)
    cflags, _mw = _ninja_cflags_for_unit(src_rel)

    perm_dir = perm_root / "nonmatchings" / function
    if not perm_dir.exists():
        typer.echo(
            f"{perm_dir} not found. Run decomp-permuter's "
            "import.py first.",
            err=True,
        )
        raise typer.Exit(2)

    materialized: list = []
    for i, plan in enumerate(plans):
        seed_dir = perm_dir / f"tier3_seed_{i}"
        out_c = materialize_seed(base_source, function, plan, seed_dir)
        if out_c is None:
            print(f"[tier3] seed{i}: mutation unsupported; skipping")
            continue
        ok = smoke_compile(out_c, wibo, debug_compiler, cflags, melee_root)
        print(f"[tier3] seed{i}: compile={'ok' if ok else 'FAIL'}")
        materialized.append((plan, seed_dir, ok))

    compiled = [m for m in materialized if m[2]]
    if not compiled:
        typer.echo(
            f"all {len(materialized)} tier3 seeds failed to compile — "
            "bridge mapping likely wrong or mutation produced invalid C.",
            err=True,
        )
        raise typer.Exit(5)

    print()
    print(
        f"[tier3] {len(compiled)}/{len(materialized)} seeds compiled. "
        f"Estimated wall-clock: {2 * len(compiled) * per_seed_iters} "
        f"to {3 * len(compiled) * per_seed_iters} seconds."
    )
    print(
        "[tier3] Per-seed permuter runs not yet wired in v1 — running "
        "`debug permute -f FN` against each seed dir manually is the "
        "current workaround. See "
        "docs/mwcc-debug-permuter-integration.md."
    )
```

- [ ] **Step 3: Smoke test the CLI**

```bash
cd /Users/mike/code/melee
python -m src.cli debug tier3-search --help 2>&1 | tail -15
```

Expected: shows help.

- [ ] **Step 4: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py \
        tools/melee-agent/src/mwcc_debug/tier3_search.py
git commit -m "mwcc-debug: debug tier3-search — orchestrator CLI

Enumerates variable bindings → plans seed mutations → materializes
each + smoke-compiles. Exits non-zero if all seeds fail to compile
(loud-failure detection per spec). Per-seed permuter run is the
documented next step but explicitly out-of-v1 for the orchestrator
itself — agents invoke `debug permute` per seed dir for now."
```

---

## Task 10: Update permuter-integration doc with Tier 3 section

**Files:**
- Modify: `docs/mwcc-debug-permuter-integration.md`

Add a Tier 3 section, reorder existing Tier 0/1/2 headings to linear flow.

- [ ] **Step 1: Read current state of the integration doc**

```bash
head -10 docs/mwcc-debug-permuter-integration.md
grep -n "^## Tier" docs/mwcc-debug-permuter-integration.md
```

- [ ] **Step 2: Reorder existing Tier 0/1/2 headings to linear flow**

The existing doc has Tier 0, Tier 2, Tier 1 in that order (Tier 2 shipped after Tier 1 was specced). Reorder so they read 0 → 1 → 2.

Use Edit to move the Tier 1 section (`## Tier 1 (shipped — pattern-tuned config)` plus subsections) to appear immediately after Tier 0 and before Tier 2.

- [ ] **Step 3: Add the Tier 3 section**

After the Tier 2 section, insert:

```markdown
## Tier 3 (shipped — targeted mutations + multi-start)

Where Tier 2 says "evaluate candidates better," Tier 3 says "generate
better candidates to start with." Given a stuck function, the agent
identifies WHICH variable is blocking via the new symbol bridge, then
applies targeted mutations (type-change, alias-split) directly on that
variable. Each mutation becomes a permuter starting point.

### Primitives (each also a CLI command)

| Command | Purpose |
|---|---|
| `debug inspect var-to-virtual -f FN <var>` | Predict MWCC virtual for a source variable name |
| `debug inspect virtual-to-var -f FN <ig_idx>` | Inverse lookup |
| `debug mutate type-change -f FN --var V --type T` | Change a local's declared type |
| `debug mutate insert-alias -f FN --var V --at N` | Alias before N-th reading statement |
| `debug tier3-search -f FN` | Multi-start orchestrator (plans + materializes seeds) |

### Workflow

```bash
# 1. Identify the blocker
melee-agent debug guide -f my_stuck_fn

# 2. Plan + materialize seeds
melee-agent debug tier3-search -f my_stuck_fn --budget 5

# 3. For each tier3_seed_<i>/ that compiled, run permuter (Tier 2)
for seed in ~/code/decomp-permuter/nonmatchings/my_stuck_fn/tier3_seed_*; do
    melee-agent debug permute -f my_stuck_fn \
        --perm-root ~/code/decomp-permuter \
        --blend 0.05
done
```

### Calibration + confidence

The symbol bridge reports confidence per binding: `best-guess`,
`verified`, `rejected`, `ambiguous`, `unsupported`. The orchestrator
skips bindings with `ambiguous`/`unsupported`/`rejected`. If
`tier3-search` reports "all seeds failed to compile," the bridge is
likely wrong for that function — `debug inspect var-to-virtual` lets you
inspect the mappings interchange.

### Tracking Tier 3 matches

Commits where tier3-search produced the winning seed should include:

```
Tier3-Search: <seed-description>
```

as a trailer (analogous to `Co-Authored-By:`). A future
`debug tier3-stats` can count via `git log --grep "Tier3-Search:"`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/mwcc-debug-permuter-integration.md
git commit -m "docs: permuter integration — Tier 3 section + reorder Tier 0/1/2

Adds the Tier 3 workflow + primitive reference. Reorders the existing
Tier 0/1/2 headings to a linear flow (Tier 2 originally shipped after
Tier 1 was specced, so the doc had them out of order)."
```

---

## Task 11: Run full test suite + push

**Files:**
- Run all tests to confirm nothing regressed, then push.

- [ ] **Step 1: Run all mwcc-debug tests**

```bash
cd /Users/mike/code/melee
python -m pytest tools/melee-agent/tests/test_mwcc_debug_*.py --no-cov -q 2>&1 | tail -10
```

Expected: all tests pass (prior 121 + the new ~30 from this plan ≈ 150).

- [ ] **Step 2: Push to remote**

```bash
git push origin master 2>&1 | tail -5
```

Expected: clean push to origin.

---

## Self-Review Checklist

- [ ] Symbol bridge calibration gate tests run + pass on real Melee functions (fn_80247510, fn_8024E1B4).
- [ ] `mutate_type_change` and `mutate_insert_alias_before_use` both produce expected text for their pinned regression cases.
- [ ] `debug tier3-search` shows help, planner produces sensible seed lists for the calibration functions.
- [ ] If `tier3-search` reports "all seeds failed to compile" — that's the loud-failure path. Triage means revisiting the bridge / mutator output, not the orchestrator.
- [ ] Updated permuter-integration doc reads 0 → 1 → 2 → 3 linearly.
- [ ] No new dependencies introduced (no pycparser).
- [ ] `pytest tools/melee-agent/tests/test_mwcc_debug_*.py` reports green.
