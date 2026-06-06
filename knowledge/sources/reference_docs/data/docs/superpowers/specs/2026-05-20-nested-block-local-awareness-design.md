# Nested-block-local awareness — design spec

**Feature:** Make the mwcc-debug symbol bridge aware of locals declared inside
nested `{...}` blocks (not just function top), so var-to-virtual /
virtual-to-var / future scope-aware mutations can target the variables the
allocator actually colored.

**Status:** Phase 1 of two.

**Phase 1 (this spec):** Tree-sitter rewrite of the bridge core, plus
scope-aware lookups. Public dataclasses gain a `scope_path` field.

**Phase 2 (separate spec, follow-up):** scope-aware mutations
(`mutate insert-alias`) and enumeration (`enumerate-decl-orders`). Defers
until Phase 1 lands and the AST surface is stable.

## Motivation

The heartbeat agent's `fn_80248A78` matching is blocked at 99.6% by
register-allocation issues in the `frame == 14.0f` branch
(`src/melee/mn/mnvibration.c` lines 109+ of the function), where four
locals are declared inside a nested compound statement:

```c
} else if (frame == 14.0f) {
    if (GetNameCount() != 0) {
        MnVibrationData* data2;
        MnVibrationData* data3;
        MnVibrationAssets* assets;
        HSD_JObj* loaded_joint;
        ...
    }
}
```

Today:

- `var-to-virtual data2` returns "variable not found" — the bridge's
  regex walker skips into the outer compound statement and never sees
  `data2`.
- `virtual-to-var <virt>` for whichever virtual MWCC assigned to
  `data2` returns a wrong, low-confidence guess pulled from a
  top-level local (typically `frame` or `jobj` because the cursor
  model overshoots).
- `mutate insert-alias --var data2` fails the same way.
- `enumerate-decl-orders` only considers top-level locals — swap
  candidates within the nested block are unreachable.

The current regex parser in `symbol_bridge.py` explicitly says at
`_top_level_statements`: "Nested-block contents are returned as a single
statement-sized chunk (we DON'T descend into them in v1)." This spec
removes that limitation.

## Architecture

Three new modules + one rewrite, all in
`tools/melee-agent/src/mwcc_debug/`:

- **`ast_walker.py`** (new, ~250 lines) — tree-sitter façade. Parses C
  source via `tree-sitter` + `tree-sitter-c` (already project deps).
  Exposes `walk_function(source, fn_name) -> list[LocalDecl]`.
  One file, one purpose. No regex.
- **`symbol_bridge.py`** (rewrite) — keeps the same public API.
  **Private helpers `_extract_function_text`, `_strip_strings_and_comments`,
  and `walk_local_decls` MUST be preserved as backward-compat adapters**
  because `tools/melee-agent/src/mwcc_debug/mutators.py:14-18` imports
  all three and uses them in `mutate_type_change`, `_get_var_type_in_fn`,
  `mutate_insert_alias_before_use`, and the statement-splitter
  (reviewer 2 feedback C1). Phase 1 thin-wraps these:
  - `walk_local_decls(body)` → delegates to the tree-sitter walker for
    a synthetic single-function source, returns
    `list[LocalDecl]` (top-level only — preserves pre-Phase-1
    behavior for mutators that don't yet understand nested scope).
    Phase 2 migrates mutators to scope-aware lookups.
  - `_strip_strings_and_comments(text)` → can stay as-is. It's a
    text-only utility used by mutators for their *own* string analysis,
    not for decl lookup. Phase 1 keeps it.
  - `_extract_function_text(source, fn_name)` → delegates to
    `ast_walker.extract_function_text` (which uses tree-sitter to
    locate the function body), but signature and return shape stay
    identical so mutators don't change.

  The genuinely-obsolete internals (`_top_level_statements`,
  `_looks_like_decl`, `_skip_initializer`, `_skip_array_brackets`,
  `_DECL_HEAD_RE`, `_DECLARATOR_NAME_RE`) are deleted. Net shrink is
  modest, but module clarity improves substantially. See the File
  Structure table at the end for revised LOC math.
- **`scope_path.py`** (new, ~80 lines) — utilities: `is_nested_within`,
  `nearest_common_ancestor`, `format_for_display`. Shared between
  bridge and (in Phase 2) the mutator.
- **No changes to `parser.py`, `colorgraph_parser.py`,
  `coalesce_ir_facts.py`** — they consume `Binding` through the same
  interface. The new `scope_path` field is additive.

## Data model

### `LocalDecl` (existing in `symbol_bridge.py`, extended)

Current shape (in symbol_bridge.py:21):

```python
@dataclass
class LocalDecl:
    name: str          # variable name
    type_str: str      # canonical type as written in source ("HSD_JObj*")
    decl_index: int    # 0-indexed position in source order
```

Phase 1 extends this in-place (no new parallel type — reviewer
feedback C1 / consistency with the existing API):

```python
@dataclass
class LocalDecl:
    name: str
    type_str: str
    decl_index: int                      # kept for backward compat
    # NEW fields below (all default-valued so existing constructors
    # in tests / mutators / tier3_search keep working):
    line_no: int = 0                     # 1-indexed source line of the decl
    byte_range: tuple[int, int] = (0, 0) # [start, end) byte offsets in source
    scope_path: tuple[str, ...] = ()     # ("fn_80248A78", "block@l234c12")
    scope_byte_range: tuple[int, int] = (0, 0)  # enclosing block body span
    has_initializer: bool = False
    initializer_line_no: Optional[int] = None
```

The fallback path (regex walker on tree-sitter failure) sets the new
fields to their defaults so callers that don't care about scope still
work.

`scope_path` element format:
- Top-level scope (function body): the function name
  (`"fn_80248A78"`). Always the first element.
- Nested scope: `"block@l{line}c{col}"` where `line` is the 1-indexed
  source line and `col` is the 0-indexed byte column of the opening
  `{` token. The column suffix disambiguates two blocks that open on
  the same line (common when macros expand to `if (x) { ... } else
  { ... }` on a single line — reviewer feedback I3).
- **Transient, not persistent.** Stable for the lifetime of one CLI
  invocation. Adding a comment line, reformatting braces, or running
  any source mutation invalidates `scope_path` strings because the
  `line:col` of the block-opening `{` moves. Callers that persist a
  binding across a mutation MUST re-derive its scope_path after the
  edit. Phase 2 mutate/enumerate tooling will internally re-parse
  after every source change (reviewer 2 feedback I2).

CLI display uses `/` as separator (e.g.
`fn_80248A78/block@l234c12`). The `--scope <value>` filter on lookups:
- `--scope fn_80248A78` → exact match on function-top scope (excludes
  nested blocks).
- `--scope fn_80248A78/` → prefix match (function-top AND any nested
  scope inside it). The trailing slash means "and everything inside".
- `--scope fn_80248A78/block@l234c12` → exact match on that specific
  nested block.
- `--scope fn_80248A78/block@l234c12/` → that block AND any blocks
  nested deeper inside it.

(Reviewer feedback I2: trailing-slash convention picked explicitly.)

### `Binding` (existing in `symbol_bridge.py:348`, extended)

Current shape:

```python
@dataclass
class Binding:
    var_name: str
    virtual: int           # -1 if unmapped
    decl_line: int         # 1-indexed line in original source
    kind: str              # "local" | "param"
    type_str: str
    confidence: str        # "verified" | "best-guess" | "low-confidence"
                           # | "rejected" | "ambiguous" | "unsupported"
```

Phase 1 adds **one** field — `scope_path` — and changes nothing else.
`type_str` already carries the type (reviewer feedback C1 corrected
my earlier draft that proposed a duplicate `var_type`). `kind` stays
as-is and continues to drive existing consumers (`tier3_search`,
`mutators`).

```python
@dataclass
class Binding:
    var_name: str
    virtual: int
    decl_line: int
    kind: str
    type_str: str
    confidence: str
    scope_path: tuple[str, ...] = ()     # NEW, defaults empty for legacy paths
```

When the regex-fallback path fires (tree-sitter ImportError or parse
failure — see "Tree-sitter availability and parse failure" below),
returned `LocalDecl` AND `Binding` records consistently set
`scope_path=(fn_name,)` (top-level only — fallback doesn't descend
into nested blocks). The default `()` from the `LocalDecl` field
declaration is only used when constructing test fixtures without a
known function name; production code paths always populate at least
the function-name element (reviewer feedback I4).

### `BindingBasis` (existing in `symbol_bridge.py:365`, extended)

Current shape:

```python
@dataclass
class BindingBasis:
    parsed_params: list[LocalDecl]
    parsed_locals: list[LocalDecl]
    observed_virtuals: list[int]
    unrecognized_decls: list[str]
    red_flags: list[str]
```

Phase 1 keeps all five existing fields. `parsed_locals` continues to be
the flat source-order list (preserves the `--basis` CLI mode wired up
in task #113). One new field:

```python
decls_by_scope: dict[tuple[str, ...], list[LocalDecl]] = field(default_factory=dict)
```

Surfaces all decls grouped by `scope_path`. Phase 1 populates this
fully (reviewer 2 feedback S4 — it's nearly free given we already
have the AST walk, and ships `--basis` strictly more informative).
Phase 2 (mutate + enumerate) consumes it.

(Reviewer 1 feedback C2: `parsed_locals` is preserved,
`decls_by_scope` is additive.)

### `FirstDef` (unchanged)

Pcdump-only concept. No source-position fields needed.

## Lookup behavior

### `var-to-virtual <name>` (API and CLI contract — reviewer 2 C2)

The existing function signature `find_virtual_for_var` returns
`Optional[Binding]` and the CLI displays one binding. Phase 1 keeps
that default behavior — single binding, picked by highest confidence
then top-level-first — to preserve backward compatibility for scripts
and the existing JSON schema.

A NEW `--all` flag (default off) opts in to multi-binding output for
shadowing / nested-reuse cases.

Default behavior (unchanged from today):
1. Walk AST → all `LocalDecl`s with `name == "cursor_row"`.
2. Look up each candidate `Binding`.
3. **Pick one** by (highest confidence → top-level scope first → first
   in source order). Return as `Optional[Binding]` to the CLI.
4. CLI prints single binding, same text + JSON schema as today, BUT
   adds a `scope_path` field to the output.

With `--all`:
1. Same walk + lookup as above.
2. Return `list[Binding]` to the CLI.
3. CLI prints all matches, sorted: confidence then scope (top-level
   first); JSON payload becomes an array under a new top-level key.

With `--scope <value>` (orthogonal to `--all`):
- Filter using exact/prefix semantics from `scope_path` section.
- If `--scope` reduces matches to one, output stays single-binding
  even without `--all`.

API surface change summary:
- `find_virtual_for_var(...)` keeps its `Optional[Binding]` signature
  for back-compat. A new sibling `find_all_virtuals_for_var(...) ->
  list[Binding]` powers `--all`.

Output text (single, default):
```
cursor_row -> r34  (best-guess, type=HSD_JObj*, scope=fn_80248A78/block@l234c12, line 235)
```

Output text (`--all`):
```
cursor_row (2 matches):
  -> r34  (best-guess, type=HSD_JObj*, scope=fn_80248A78/block@l234c12, line 235)
  -> r78  (best-guess, type=HSD_JObj*, scope=fn_80248A78/block@l312c12, line 313)
```

If zero matches: print the existing "variable not found" error. The
heartbeat agent's complaint was that nested-block decls produced this
error because they were invisible — Phase 1 fixes that without
breaking the default single-binding contract.

### `virtual-to-var <virt>`

Input: virtual reg number (e.g. `34`).

1. Existing logic: find first-def, get its block_idx, match against
   basis bindings.
2. NEW: include `scope_path` in the reported best-guess binding.
3. NEW: if multiple bindings tie at best-guess (e.g. shadowed `i` in two
   scopes), print all candidates, sorted by a scope tiebreaker.

Scope tiebreaker (tiebreaker only — never overrides confidence): a
virtual whose first-def is in pcdump block 0 most likely corresponds to
a top-level local; first-def in a later block more likely corresponds to
a nested-block local. We don't have line numbers from MWCC, so this is
heuristic, not exact.

Output (text):
```
r34 -> cursor_row  (best-guess, scope=fn_80248A78/block@l234)
  alternates:
    cursor_row at scope=fn_80248A78/block@l312 (less likely — first-def in block 0)
```

### Per-scope ordinal matching (the key heuristic)

The bridge today matches decls to virtuals by source-order ordinal
within the function (the "cursor model" in `_collect_basis`). The Phase
1 change: do the same ordinal walk, but **partitioned by scope** and
consuming from the pre-pass's observed-virtuals list in declaration
order.

Algorithm:
1. Compute `observed_virtuals: list[int]` = pre-pass destinations
   ≥ 32, in first-def order (existing
   `_collect_virtual_destinations`).
2. Walk scopes in source order: function-top first, then each nested
   block in declaration order.
3. Within each scope, iterate decls in source order. Pop the next
   un-claimed virtual off `observed_virtuals` and assign it to the
   current decl.
4. If `observed_virtuals` runs out, remaining decls get `virtual=-1`
   with `confidence="ambiguous"`.

**Worked example (reviewer feedback I1, using real
`fn_80248A78` shape):** Truncated to illustrate the algorithm, with
placeholder virtual numbers (X, Y, Z for nested-block decls — exact
numbers come from MWCC and are validated empirically; see
"Confidence calibration for nested bindings" below).

```c
void fn_80248A78(HSD_GObj* arg0) {
    MnVibrationData* temp_r30;   // top-level decl 0
    f32 frame;                    // top-level decl 1
    HSD_JObj* jobj;               // top-level decl 2
    // ... 15 more top-level decls including cursor_row, base_y, etc.
    if (frame == 10.0f) { ... }
    else if (frame == 14.0f) {
        if (GetNameCount() != 0) {                 // opens at line L
            MnVibrationData* data2;   // nested decl 0 in this scope
            MnVibrationData* data3;   // nested decl 1
            MnVibrationAssets* assets;// nested decl 2
            HSD_JObj* loaded_joint;   // nested decl 3
            // ... uses data2 / data3 / assets / loaded_joint ...
        }
    }
}
```

Suppose `observed_virtuals = [32, 33, ..., 51, X, Y, Z, W, ...]`
(the cascade after MWCC has assigned all top-level decls reaches
some N at function end; then nested-block first-defs follow).

Per-scope walk:
- Scope `fn_80248A78`: decls = [temp_r30, frame, jobj, jobj2, ...,
  cursor_row, base_y, spacing, temp_x, temp_y, temp_z].
  - Each top-level decl gets the next virtual from `observed_virtuals`
    in source order (existing cursor model, unchanged).
- Scope `fn_80248A78/block@lLcC` (`GetNameCount() != 0` body): decls =
  [data2, data3, assets, loaded_joint].
  - `data2` ← X, `data3` ← Y, `assets` ← Z, `loaded_joint` ← W,
    where X..W are the next un-claimed virtuals after the top-level
    walk finished.

Today's bridge:
- `data2` / `data3` / `assets` / `loaded_joint` don't appear in any
  scope (regex walker skipped the nested compound statement).
- `virtual-to-var X` returns whatever wrong top-level guess the
  cursor model produces because the cursor overshoots.

Phase 1 bridge:
- The four nested-block decls each get a binding with `scope_path`
  set to the nested scope.
- `virtual-to-var X` may return `data2` *if* the per-scope ordinal
  model holds. Whether that's a `"best-guess"` or
  `"ambiguous-nested"` confidence depends on empirical validation
  (see next subsection).

### Confidence calibration for nested bindings (reviewer feedback I6)

The per-scope ordinal heuristic is an extrapolation from today's
"MWCC numbers locals in source order from r32" rule. It is *not*
proven to hold for nested-block decls — MWCC's allocator iterates IR
in IR-emission order, which happens to track source order at function
top but may interleave nested-block decls with body-of-outer-block
CSE temps, induction vars, etc.

Phase 1 ships a **conservative default**: nested-block bindings get
`confidence="ambiguous-nested"` (a new value added to the existing
confidence ladder) until empirical evidence supports promoting them.
`tier3_search` skips `"ambiguous-nested"` by default (same treatment
as `"low-confidence"`); CLI surfaces them with a clear annotation:
`(ambiguous, nested — verify with var-to-virtual --basis)`.

A Phase 1 task (added in writing-plans) executes a small empirical
study before promotion: pick 3-5 functions across `mn/mnvibration.c`,
`mn/mnname.c`, `mn/mnevent.c` that have nested-block decls; run
pcdump; manually correlate observed virtuals to source decls. If the
per-scope ordinal model holds for ≥ 80% of the studied decls, the
nested-binding confidence floor is promoted to `"best-guess"` in a
follow-up commit. If not, the bridge keeps `"ambiguous-nested"` and a
follow-up spec investigates a better algorithm.

Either way, *visibility* — the nested decl appearing in the binding
list at all — is the Phase 1 win. *Precision* is gated behind the
study.

The matching algorithm itself stays best-guess (we still don't have
MWCC line numbers). The improvement is visibility plus an honest
confidence label.

## Error handling

### Tree-sitter availability and parse failure

Two failure modes share one fallback:
1. **Import failure**: `tree-sitter` or `tree-sitter-c` not importable
   (e.g. binary wheel missing for the current platform). `ast_walker`
   wraps its imports in try/except (mirroring the existing pattern at
   `tools/melee-agent/src/hooks/c_analyzer.py:17` and
   `tools/melee-agent/src/cli/extract.py:24`).
2. **Parse failure**: tree-sitter parses but `walk_function` finds
   the requested function's body contains error nodes (preprocessor
   macros that aren't expanded, broken includes). Raises
   `AstWalkError` with the error-node line.

Both trigger the same bridge fallback: a slim ~80-line regex walker
that finds **top-level decls only** (no nested-block awareness). This
preserves pre-Phase-1 behavior as a safety net. Existing matched
functions don't break. The bridge logs:

```
[symbol_bridge] tree-sitter unavailable / parse failed, falling back to regex walker
```

The fallback walker is a thin subset of today's `walk_local_decls` —
just enough to keep top-level lookups working. It does NOT carry
forward `_top_level_statements`, `_strip_strings_and_comments`, or
`_looks_like_decl` in full — those are deleted with the main rewrite.

(Reviewer feedback I5: ImportError handled at module-load time in
addition to AstWalkError at call time.)

### Removed: `red_flags=["nested-decl"]`

The existing bridge sets `red_flags=["nested-decl"]` whenever the body
contains `)\s*{` (any nested compound statement) and demotes
confidence to `"low-confidence"`. The intent was to warn callers that
the cursor model might be wrong because the walker doesn't see nested
decls.

Phase 1 walks nested decls, so this red flag is no longer correct. It
gets removed from `_collect_basis`. The calibration regression tests
(see Testing) MUST include at least one function that previously
triggered this red flag, to confirm:
- The function's bindings are now `"best-guess"` (or higher), not
  `"low-confidence"`.
- The new scope-aware Bindings for the nested-block decls are present.

(Reviewer feedback C3.)

### Removed: `_FN_HEADER_RE` regex

The existing `_extract_function_text` (line 451) uses a regex
`_FN_HEADER_RE` to find the function in the source string. Tree-sitter
locates function definitions natively. `ast_walker.walk_function`
replaces both `_extract_function_text` and the regex header match —
the AST gives us the function's body span directly.

(Reviewer feedback S1.)

### Function not found in source

`ast_walker.walk_function(source, "fn_X")` returns `[]`. Bridge raises
`FunctionNotFoundError` to the CLI, which prints the existing
"function not found" message.

### Multi-declarator decls

`int x, y, z;` produces three `LocalDecl`s with the same
`scope_path` and the same overall declaration `line_no`, but each one
has its own `byte_range` covering exactly that declarator's tokens
(tree-sitter exposes them as separate `init_declarator` children under
the parent `declaration` node). `decl_text` likewise covers only the
single-declarator slice (so e.g. `"x"` not `"int x, y, z"`); callers
that want the full declaration line can reconstruct it from the parent
`scope_byte_range`.

### Block scopes without braces

`if (x) int y;` — rare, deprecated, legal C. Tree-sitter exposes these
as compound_statements implicitly. Treated the same as braced blocks;
they get a `block@lN` element in `scope_path`.

### Shadowing

Two locals with the same name in different scopes (outer `i` + inner
`i`) are both surfaced. The user disambiguates via `--scope`. The
bridge does NOT resolve shadowing the way a C semantic analyzer would;
it's purely lexical.

### Function pointers and complex decls

Tree-sitter handles these natively. The `_looks_like_decl` heuristic
for "unrecognized shapes" in the old parser is no longer needed.

### Macro-heavy source (reviewer 2 feedback S6)

Melee's `.c` files use `PAD_STACK(N)`, `HSD_ASSERT(...)`, and other
macros that tree-sitter sees as undefined identifiers when parsing
without preprocessing. Bare tree-sitter may flag these as `ERROR`
nodes.

`walk_function` softens the error check: an `ERROR` node at the *body
level* (sibling of a decl/statement) is tolerated as long as the
decls themselves parse cleanly. Only `ERROR` nodes that *enclose* or
*interrupt* a decl trigger `AstWalkError` and fallback. This matches
the existing tolerance pattern in `hooks/c_analyzer.py`.

A pre-implementation validation task (added to the writing-plans
output): run `ast_walker.walk_function` on `mnvibration.c`,
`mnname.c`, `mnevent.c` for at least 10 functions and confirm
fallback fires < 10% of the time. If it fires more, increase the
tolerance bar before merging Phase 1.

### Caching (reviewer feedback C3 + I4)

`ast_walker.walk_function` is called many times per CLI invocation
(every CLI command path that needs bindings). The walker caches
parsed `tree_sitter.Tree` objects via a tiered key strategy:

- **On-disk callers**: cache key = `(path, mtime_ns)`. Cheap to
  compute; correct as long as filesystem mtime is reliable (which it
  is for ninja-managed source).
- **In-memory callers** (mutate, permuter staging, test fixtures —
  pass `path=None`): cache key = `("mem", id(source_string))`. The
  Python object identity is sufficient because the same source
  string is typically reused across a single mutator iteration; once
  the string goes out of scope it's GC'd and its entry becomes stale
  (handled by max-size eviction).

A max-size LRU bounds growth to 64 entries (configurable via
`_AST_CACHE_MAX`); least-recently-used entries are evicted on
insert. This handles the `enumerate-decl-orders --iterate` flow
where many distinct source variants are walked sequentially.

`ast_walker.clear_cache()` is exposed for tests. The existing
`tools/melee-agent/tests/conftest.py` is **extended** with an
autouse fixture (reviewer feedback S1 — the file already exists):

```python
@pytest.fixture(autouse=True)
def _clear_ast_walker_cache():
    yield
    from src.mwcc_debug import ast_walker
    ast_walker.clear_cache()
```

If autouse scope proves too coarse during implementation (perf hit
on hot tests that don't touch the bridge), it can be narrowed to a
named fixture explicitly used by ast-walker / bridge / mutators
tests. Start broad, narrow if needed.

## Testing strategy

### Unit tests for `ast_walker.py` (`tests/test_ast_walker.py`, new)

~15 tests:
- Top-level decl walk on a simple function.
- Nested-block: locals in `if` / `for` / `while` / braced compound
  blocks all surfaced with correct `scope_path`.
- Shadowing: outer `int i` + inner `int i` → both returned, distinct
  `scope_path`s.
- Multi-declarator: `int x, y, z;` → 3 decls, same scope and same
  `line_no`, distinct `byte_range`s (each covering only one
  declarator).
- Function pointer: `void (*cb)(int);` → one decl, type captured.
- Array decl: `int arr[10];` → one decl, type captured.
- Two blocks on one line: `if (a) { ... } else { ... }` → distinct
  `scope_path`s via column suffix (`block@l5c8` vs `block@l5c20`).
- Parse failure: malformed input → raises `AstWalkError` with line.
- Tree-sitter ImportError simulation: monkeypatch import to raise →
  `walk_function` raises `AstUnavailableError` (distinct from
  `AstWalkError` so bridge can log the right reason).
- Function not found: returns `[]`.
- Initializers: `int x = 5;` → `has_initializer=True`,
  `initializer_line_no` set.
- Cache hit/miss: two calls on same source return identical objects
  when cache is warm.

### Unit tests for `scope_path.py` (`tests/test_scope_path.py`, new)

~6 tests:
- `is_nested_within`: child starting with ancestor → True; sibling →
  False; same → True.
- `nearest_common_ancestor`: identical → same; cousin → common prefix;
  no common → `()`.
- `format_for_display`: round-trip with a parser.

### Bridge tests (`test_mwcc_debug_symbol_bridge.py`, existing)

- All existing tests continue to pass. `Binding` is backward-compatible
  (the new `scope_path` field has a default of `()`).
- New: `list_bindings` on a function with a nested `for` loop surfaces
  both the outer counter and an inner-block decl with distinct
  `scope_path`s.
- New: `find_var_for_virtual` includes `scope_path` in its returned
  Binding.
- New: `find_virtual_for_var("cursor_row")` on a synthetic source with
  a nested-block `cursor_row` returns the nested-block Binding (today
  this returns `None`).
- **Calibration regression for removed `nested-decl` red flag**: a
  test loads a known function whose body contains `)\s*{` (i.e.
  previously triggered the `nested-decl` red flag and demoted
  confidence to `"low-confidence"`). Phase 1 asserts: bindings are
  now `"best-guess"`, AND the nested-block decls show up with
  scope_path populated.

### Integration test on `fn_80248A78` (slow, `@pytest.mark.integration`)

- Load `src/melee/mn/mnvibration.c` + cached pcdump (skip if missing).
- Assert: `find_virtual_for_var("cursor_row")` returns a non-`None`
  Binding (today returns `None`/"not found").
- Assert: `find_var_for_virtual(34)` returns `cursor_row` with the
  nested-block scope_path (today returns low-confidence top-level
  `frame`).

### Calibration regression

Re-run `coalesce_calibration.yaml` cases. They should keep passing —
bridge upgrade is additive at the data level.

Also explicitly run `pytest test_coalesce_ir_facts.py` since
`coalesce_ir_facts` imports `Binding`, `BindingBasis`, `find_first_def`
and others from `symbol_bridge`. Verify no regression (reviewer 1
feedback S2).

### tier3-search downstream behavior check (reviewer 2 feedback S5)

The new `"ambiguous-nested"` confidence is treated like
`"low-confidence"` by `tier3_search.plan_seeds()` (skipped by
default, opted in via `--include-low-confidence`). Removing the
`nested-decl` red flag means functions with nested blocks may now
have *more* top-level bindings classified as `"best-guess"` than
before (the demotion is gone). Run `tier3-search --dry-run` on 5
representative functions before and after the bridge swap; record
seed count + ordering. Diffs are expected to be small but non-zero
— document any intentional changes in the plan's smoke-test
section.

### Full-suite gate

Run `pytest tools/melee-agent/tests/`. Target: 731 → ~758 (existing +
~27 new tests across ast_walker, scope_path, bridge extensions, and
the calibration regression). No regressions.

## Limitations

- Per-scope ordinal matching is still best-guess. We don't have
  MWCC-emitted line numbers, so virtual→scope correlation is heuristic.
  The improvement over today is *visibility* (nested decls exist in the
  binding list at all) rather than *precision* (knowing which virtual
  exactly maps to which decl).
- Macro-heavy source may trip tree-sitter. The regex fallback preserves
  pre-Phase-1 behavior for those files.
- Phase 1 does not change `mutate insert-alias` or
  `enumerate-decl-orders`. Their existing behavior is unchanged. Phase
  2 will pick those up using the same `scope_path` model.

## Out of scope (Phase 2 candidates)

- `mutate insert-alias` scope-aware insertion (place alias decl at
  nearest enclosing block, not function top).
- `enumerate-decl-orders` nested-scope walk and within-scope swap
  restriction.
- `tier3-search` seeding from compiler-temp facts (depends on this
  spec's `Binding` upgrade landing first).
- A C semantic analyzer (type inference, shadowing resolution) — we
  deliberately stay lexical.

## File structure summary

| File | Action | LOC delta |
|------|--------|-----------|
| `tools/melee-agent/src/mwcc_debug/ast_walker.py` | Create | +~280 |
| `tools/melee-agent/src/mwcc_debug/symbol_bridge.py` | Rewrite (extend `LocalDecl`, `Binding`, `BindingBasis`; replace regex walker with tree-sitter call; keep slim regex fallback; preserve `_extract_function_text`, `_strip_strings_and_comments`, `walk_local_decls` as back-compat adapters for `mutators.py`) | -713 → +~330 (net -383) |
| `tools/melee-agent/src/mwcc_debug/scope_path.py` | Create | +~80 |
| `tools/melee-agent/tests/test_ast_walker.py` | Create | +~320 |
| `tools/melee-agent/tests/test_scope_path.py` | Create | +~120 |
| `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py` | Extend (existing tests stay, add nested-block + scope cases + nested-decl red-flag removal regression) | +~220 |
| `tools/melee-agent/tests/conftest.py` | Extend (existing 37-line file) with autouse fixture for `ast_walker.clear_cache()` | +~10 |

The existing `LocalDecl`, `Binding`, `BindingBasis` are **extended in
place**; no parallel types are introduced. Existing readers continue
to work unchanged (new fields all carry safe defaults). The private
helpers `_extract_function_text`, `_strip_strings_and_comments`, and
`walk_local_decls` are preserved as back-compat adapters so
`mutators.py` does not need to change in Phase 1.

Net repo LOC change: roughly **+520 lines added, 713 removed = +810
net** counting tests. Without tests: net **-303** in production
source. The point of the change is module clarity (one 713-line file
split into focused modules) rather than line count (reviewer 2
feedback S2).

Phase 2 will revisit `mutators.py` and `enumerate-decl-orders` to
adopt the scope-aware API directly, retiring the back-compat
adapters at that point.
