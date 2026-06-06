# `debug suggest-coalesce-source` — Design Spec

**Date**: 2026-05-19
**Status**: Approved (brainstorming-skill flow)
**Author**: Claude + Mike
**Implements**: feedback item #6 from the matching agent's `fn_802461BC` session report

## 1. Problem

Today's `--force-coalesce` hook lets an agent verify that a specific
virtual coalesce reaches a target allocation (DLL-patched artifact).
The next step — "what natural C-source pattern would produce this
coalesce?" — is currently hours of trial-and-error. The `register-
cascade` pattern-catalog entry describes the *concept* (introduce a
move instruction between the two virtuals via chain assignment, alias,
or common subexpression), but doesn't *identify* which specific pattern
applies to a given pair.

This spec adds `debug suggest-coalesce-source` — a static-analysis tool
that maps a coalesce target back to applicable C-source patterns,
grounded in the pre-coloring IR. It bridges the "force-coalesce
confirms reachability" and "natural C source achieves it" steps.

## 2. Goals & non-goals

**Goals**
- Given a confirmed `<virt>=<root>` pair, surface IR facts + ranked
  source-pattern suggestions that would produce a natural coalesce
- Given a function (no pair), discover candidate coalesces that would
  shorten the longest callee-save cascade
- Reuse existing infrastructure (symbol-bridge, find_first_def,
  pattern catalog) — no new RE work needed
- Solid tests + a validation corpus so suggestion quality is trusted

**Non-goals (v1)**
- Generating mutated source files (this is a diagnose-and-explain tool,
  not a code-rewriter; see "future extensions" for the v2 hook)
- Coalesce verification (the user is expected to have run `--force-
  coalesce` to confirm the pair works; discover mode is openly
  speculative and tells the agent to verify)
- Interference checking (the pair-mode user has already proved no
  interference via force-coalesce; in discover mode, cascade analysis
  implicitly filters to non-interferers — anything in the chain
  was successfully colored)
- Per-pattern catalog revisions (existing entries are sufficient)

## 3. CLI surface

```bash
# Pair mode — explain how to reach a confirmed coalesce naturally
melee-agent debug suggest-coalesce-source -f mnDiagram3_8024714C -V 53=3

# Discover mode — find candidate coalesces that would shorten cascade
melee-agent debug suggest-coalesce-source -f mnDiagram3_8024714C --discover

# Common options
  -f, --function FN              # required
  -V, --pair VIRT=ROOT           # pair mode; mutually exclusive with --discover
  --discover                     # discover mode; mutually exclusive with --pair
  --pcdump PATH                  # explicit pcdump (else auto-resolves from cache)
  --top N                        # discover mode: max candidates (default 3);
                                 # raises BadParameter if passed in pair mode
                                 # (cleaner than silently ignoring)
  --json                         # structured output
  --include-low-confidence       # use low-confidence bridge bindings for source-line annotations
```

Conventions inherited:
- `-V <virt>=<root>` matches `--force-coalesce` pair syntax
- `-f FN` matches every other debug command
- `--json` matches the M3 universal JSON flag
- Behavior on `low-confidence` bindings matches `tier3-search` — skip by
  default, opt in with `--include-low-confidence`

Validation: exactly one of `--pair` / `--discover` is required; reject
otherwise with `typer.BadParameter`.

## 4. Architecture

### Files

```
tools/melee-agent/src/mwcc_debug/
  coalesce_ir_facts.py       # NEW — IR analysis layer (reusable)
  coalesce_patterns.py       # NEW — pattern checkers, one per pattern
  suggest_coalesce.py        # NEW — top-level orchestration + rendering

tools/melee-agent/src/cli/
  debug.py                   # MODIFY — add `suggest-coalesce-source` command

tools/melee-agent/tests/
  test_coalesce_ir_facts.py     # NEW — IR fact extraction tests
  test_coalesce_patterns.py     # NEW — per-pattern checker tests
  test_suggest_coalesce.py      # NEW — orchestrator integration tests
  fixtures/coalesce_calibration.yaml  # NEW — validation corpus
```

### Why three modules

- `coalesce_ir_facts.py` is pure IR analysis (no business logic) — other
  tools can reuse it (e.g., a future variation of `guide`).
- `coalesce_patterns.py` is one checker per pattern, easy to add new
  patterns and easy to test in isolation.
- `suggest_coalesce.py` is glue + rendering. CLI calls it; it produces
  a structured `Report` that renders to text or JSON.

### Data flow

```
suggest-coalesce-source CLI
    ↓
suggest_coalesce.run(fn, mode, ...)
    ↓
Resolve pcdump → parse → find pre-coloring pass
    ↓
list_bindings_with_basis(source, fn, pre)   ← symbol_bridge
    ↓
coalesce_ir_facts.collect(fn, source) → IrFacts
    ↓
PAIR MODE                    DISCOVER MODE
pairs = [(from, to)]         pairs = analyze_cascade(facts)[:top]
    ↓                            ↓
        for each pair:
          for each pattern in coalesce_patterns.ALL:
            suggestion = pattern.check(facts, pair)
            if suggestion: collect
    ↓
Render — text (default) or JSON (--json)
```

### Key interfaces

```python
# coalesce_ir_facts.py
@dataclass
class VirtualFacts:
    virtual: int
    first_def: Optional[FirstDef]            # from symbol_bridge.find_first_def
    use_sites: list[tuple[int, Instruction]] # (block_idx, instr) for all uses
    use_sites_truncated: bool                # True if uses exceeded the cap
                                             #   (16 in v1); checkers needing
                                             #   exhaustive counts should
                                             #   degrade or warn
    is_param: bool
    is_phys: bool                            # < 32

@dataclass
class IrFacts:
    function_name: str
    pre_pass: Pass                           # full pre-coloring pass
    by_virtual: dict[int, VirtualFacts]
    bindings: list[Binding]                  # from symbol_bridge
    basis: Optional[BindingBasis]            # red flags etc.
    cg_section: Optional[ColorgraphSection]  # populated via
                                             #   colorgraph_parser.parse_hook_events()
                                             #   then find_function(); carries
                                             #   per-virtual assignedReg + interferer
                                             #   list. REQUIRED for analyze_cascade();
                                             #   None means discover mode can't run.

def collect(fn: Function, source: str) -> IrFacts: ...
def analyze_cascade(facts: IrFacts) -> list[tuple[int, int]]: ...

# coalesce_patterns.py
@dataclass
class Suggestion:
    pattern_name: str           # e.g. "direct-identity", "chain-init"
    summary: str                # one-line description
    ir_evidence: str            # the IR fact set that triggered the match
    source_hint: Optional[str]  # C-line suggestion if bridge confident
    catalog_ref: Optional[str]  # link to `debug pattern-catalog <name>`

class Pattern(Protocol):
    name: str
    def check(self, facts: IrFacts, pair: tuple[int, int]
              ) -> Optional[Suggestion]: ...

ALL_PATTERNS: list[Pattern] = [
    DirectIdentityPattern(),
    ChainInitPattern(),
    AliasSplitPattern(),
    CommonSubExprPattern(),
    TernaryCollapsePattern(),
]

# suggest_coalesce.py
@dataclass
class Report:
    function: str
    mode: str                   # "pair" | "discover"
    cascade: Optional[list[int]] # discover mode: the cascade phys-reg numbers (descending);
                                 # the text renderer prefixes "r" for display
                                 # the JSON renderer emits as-is (integers)
    pairs: list[PairReport]

@dataclass
class PairReport:
    from_virt: int
    to_virt: int
    ir_facts: dict              # serializable summary
    suggestions: list[Suggestion]
    priority_class: Optional[str]   # discover mode: "end-of-chain" or "frees-slot"
    depends_on: Optional[tuple[int, int]]  # discover mode: pair that must
                                           #   succeed first for this one to
                                           #   shorten stmw range

def run(function: str, *, pair: Optional[tuple[int,int]],
        discover: bool, top: int = 3,
        include_low_confidence: bool = False) -> Report: ...

def render_text(report: Report) -> str: ...
def render_json(report: Report) -> str: ...
```

## 5. IR facts collection (`coalesce_ir_facts.py`)

### `collect(fn, source) -> IrFacts`

Steps:
1. Find the last pre-coloring pass via `fn.last_precolor_pass()`. Abort
   if missing (function lacks IR detail in the pcdump).
2. For every virtual reg observed in `pre_pass` (any operand position),
   build a `VirtualFacts`:
   - `first_def`: first instruction where this virtual is in regs[0]
     position. Reuses `symbol_bridge.find_first_def`.
   - `use_sites`: every (block_idx, instr) where the virtual appears in
     any operand. Capped at 16 per virtual to bound memory.
   - `is_param`: operationally defined — TRUE if the virtual's
     `first_def` is in the entry block AND has the form `mr rN, rK`
     where `K` ∈ {3..10} (param-ABI register copy). Fallback when
     no entry-block move appears: TRUE if the virtual's index is
     among the first `len(basis.parsed_params)` entries of
     `sorted(basis.observed_virtuals)`. Avoids the brittle "≤34"
     magic number — actual numbering varies by function.
   - `is_phys`: virtual < 32. (Naming: `VirtualFacts` is a slight
     misnomer when `is_phys` is true; we keep it for simplicity since
     the data structure is identical.)
3. Call `list_bindings_with_basis(source, fn.name, pre_pass)` for
   source-variable annotations.
4. Return `IrFacts`.

### `analyze_cascade(facts) -> list[(int, int)]`

Identifies the longest descending callee-save chain in the function's
allocation and proposes coalesces that would actually reduce the
saved-register footprint. Algorithm:

1. Collect all virtuals with `assignedReg` in the callee-save range
   (r25..r31 GPR; equivalent FP range f24..f31) from the post-coloring
   `AFTER REGISTER COLORING` pass. In *pair mode* this isn't called;
   in discover mode the function MUST have allocator output, else
   return empty list.
2. Sort by `assignedReg` descending. The contiguous tail starting at
   the LOWEST callee-save in use (e.g. r25 if r25..r31 are all used)
   is the cascade.
3. **Priority: end-of-chain pairs first.** Only collapses involving
   the *lowest* callee-save in the chain reduce the `stmw rN, ...`
   range. So `(r25-holder, r26-holder)` is the most valuable merge —
   it lets MWCC drop the r25 save and use `stmw r26,...` instead.
   `(r26-holder, r27-holder)` is the next-best, but only relevant
   AFTER the first merge frees r26 (the tool doesn't track this
   transitively in v1 — see future extensions). Mid-chain merges
   (e.g. r28 with r29) free up a callee-save slot but don't shrink
   the `stmw` range; we still surface them but flag them as
   weaker-impact.
4. **Interference filter — CORRECTED**: skip pairs `(a, b)` where
   `b` appears in `r_a`'s IGNode interferer list (or vice versa).
   This is the actual non-coalesce-able test. Two virtuals can share
   *third-party* interferers and still coalesce; only direct mutual
   interference blocks it.

   **Virtual↔ig_idx mapping**: `ColorgraphDecision.interferers` is a
   `list[tuple[int, int]]` of `(interferer_ig_idx, assigned_reg)`.
   For non-coalesced nodes, virtual number == ig_idx (verified by
   the recent ig_idx-fix work — `node->ig_idx` IS the IGNode array
   index for nodes in the simplification linked list). So matching
   `pair=(a, b)` against `r_a.cg_decision.interferers` is direct:
   any tuple `(b, *)` means they interfere. For coalesced-away
   nodes (flag 0x4 set), virtual ≠ ig_idx and the lookup would need
   to follow the alias chain via `COALESCE_ALIAS` — but those nodes
   don't appear in `cg_section.decisions` anyway (colorgraph skips
   them), so the check is moot in practice.
5. Annotate each proposed pair with a `priority_class` and an
   optional `depends_on`:
   - `"end-of-chain"` — would shrink `stmw` range immediately
   - `"frees-slot"` — frees a callee-save slot, but no `stmw` win
     unless the chain re-cascades. `depends_on` references the
     earlier-in-chain pair that must succeed first.
6. Return at most `top` pairs, end-of-chain pairs first, then
   frees-slot pairs (with their dependencies surfaced in output).

The discover-mode output (text and JSON) renders `depends_on` so the
agent sees "this candidate only shortens the stmw range AFTER pair #1
succeeds" — preventing the "ran all three force-coalesces in parallel
and got confused" failure mode.

Limitations openly documented in the helper docstring:
- Doesn't verify reachability via force-coalesce (user must do that
  themselves; discover-mode output explicitly says so).
- Class-aware (GPR vs FP) — only considers same-class pairs.
- Doesn't simulate the post-merge cascade — `depends_on` marks the
  chain relationship but the tool doesn't attempt transitive analysis
  ("after this merge, which OTHER pairs would shorten the cascade?").

## 6. Pattern checkers (`coalesce_patterns.py`)

Each checker is a small class with a `name` attribute and a `check`
method. The orchestrator calls every checker in `ALL_PATTERNS` order
and collects all non-None results — multiple patterns may match a
single pair, and all are reported in order. To avoid noisy duplicate
suggestions when one pattern is a strict refinement of another (e.g.,
DirectIdentity vs the more general AliasSplit), the more specific
pattern's match condition explicitly excludes the general case (see
AliasSplit's exclusion: "r_a is not already a direct copy of r_b").
This keeps checker logic local — no checker needs to know what
others did.

### 6.1 `DirectIdentityPattern`

**Trigger.** First-def of `r_a` is `addi r_a, r_b, 0` or `mr r_a, r_b`
— already a direct copy from `r_b` (or the source vars are simple
aliases). The coalescer should have merged them; the fact it didn't
means they interfere somewhere.

**Operand model.** Pattern checkers consume `Instruction.regs` (a
`list[tuple[str, int]]` ordered by appearance, e.g. `[("r", 53), ("r",
34)]` for `addi r53,r34,0`). The first entry is the destination for
all destination-first opcodes the checkers care about (`mr`, `addi`,
`li`, `lwz`, etc.). Immediates aren't in `regs`; checkers parse them
out of the `operands` string when needed. The implementation should
add a small `_immediate_operand(instr) -> Optional[int]` helper that
returns the trailing integer literal from `operands` (e.g. `0` for
`addi r53,r34,0`) — kept local to `coalesce_patterns.py`.

**Match condition.**
```python
def check(self, facts, pair):
    a, b = pair
    fa = facts.by_virtual.get(a)
    if fa is None or fa.first_def is None: return None
    fd = fa.first_def
    # regs[0] = dest (r_a), regs[1] = source (must be r_b)
    if len(fd.regs) < 2: return None
    if fd.regs[0] != ("r", a): return None  # sanity: dest must match
    if fd.regs[1] != ("r", b): return None
    if fd.opcode == "mr":
        return _make_direct_identity(facts, pair)
    if fd.opcode == "addi" and _immediate_operand(fd) == 0:
        return _make_direct_identity(facts, pair)
    return None
```

**Suggestion text.**
```
DirectIdentity: r{a} is already defined as a direct copy from r{b}
  (block B<X>: {opcode} r{a}, r{b}, 0). The coalescer didn't merge —
  likely interference. Try:
    (a) Remove an intermediate use of r{a} or r{b} that's preventing
        the merge — shrink the live range.
    (b) If the C-source has `<var_a> = <var_b>;` followed by both
        being used later, restructure so r{a} is the only one used
        after the assignment.
  Catalog: debug pattern-catalog alias-split
```

`alias-split` is the closest existing catalog entry — its "shrink the
live range" advice applies, even though the entry's primary focus is
the inverse direction (splitting a long range). If real-world use
shows this catalog reference is misleading, add a dedicated
`coalesce-direct-identity` catalog entry in a v2 increment.

### 6.2 `ChainInitPattern`

**Trigger.** Both virtuals initialized to the same value (typically
`0`) in nearby blocks. Catalog: `chained-init`.

**Match condition.**
- `r_a.first_def.opcode == "li"` with immediate `K`
- `r_b.first_def.opcode == "li"` with same immediate `K`
- Both defs in same block, OR `r_b.first_def` is followed within
  N=3 instructions by `r_a.first_def` (adjacent heuristic)

**Suggestion text.**
```
ChainInit: r{a} and r{b} are both initialized to {K} in adjacent IR.
  Combining the two C-source assignments into a chained one collapses
  the two `li {K}` ops and lets MWCC coalesce.
    var_a = (var_b = {K});
  Source: var_a @ line N (best-guess); var_b @ line M (best-guess)
  Catalog: debug pattern-catalog chained-init
```

### 6.3 `AliasSplitPattern`

**Trigger.** `r_b` is long-lived (used across many blocks), `r_a` is
short-lived AND non-interfering with `r_b`'s tail. Catalog:
`alias-split`.

**Match condition.**
- `len(r_b.use_sites)` ≥ 4 AND uses span ≥ 50% of the function's blocks
- `len(r_a.use_sites)` ≤ 3 AND all uses in the same block
- r_a is not already a direct copy of r_b (otherwise DirectIdentity
  fires first; we run checkers in order)

**Suggestion text.**
```
AliasSplit: r{b} is long-lived (used in N blocks) and r{a} is short-
  lived (used only in block B<X>). Introduce an alias variable right
  before r{a}'s first use, so r{a} inherits the endpoint of r{b}'s
  live range:
    <type> tmp = <var_b>;
    use(tmp);  // formerly use(r_a)
  Source: var_b @ line N (last-use before block B<X>)
  Catalog: debug pattern-catalog alias-split
```

### 6.4 `CommonSubExprPattern`

**Trigger.** `r_a` and `r_b` are defined by structurally-identical IR
ops. MWCC's CSE should fold them but didn't — typically because the
C-source computes the same expression twice.

**Match condition.**
- `r_a.first_def.opcode == r_b.first_def.opcode`
- `_operand_signature(r_a.first_def) == _operand_signature(r_b.first_def)`
  (everything except destination)
- Both defs are in the function body (not entry — those are param-init)

**Suggestion text.**
```
CommonSubExpr: r{a} and r{b} are computed by identical IR ops:
    block B<X>: {op} r{a}, {operands}
    block B<Y>: {op} r{b}, {operands}
  The C-source likely computes the same expression twice. Hoist it:
    <type> shared = <expr>;
    use(shared);  // both places
  Source: r_a @ line N, r_b @ line M (best-guess)
  Catalog: debug pattern-catalog subexpr-extract
```

### 6.5 `TernaryCollapsePattern`

**Trigger.** `r_a` is assigned in 2+ predecessor blocks of a join (phi-
like behavior). One branch's first-def is a direct copy from `r_b`.

**Match condition.**
- `r_a` has 2+ definitions across different blocks
- One of the defining blocks contains `mr r_a, r_b` or `addi r_a, r_b, 0`
- The other defining blocks define `r_a` from different sources
- All defining blocks share a single successor (the join)

**CFG analysis note.** The "join" test requires walking `Block.succ`
for each block where `r_a` is defined, and checking that the set of
successors-of-defining-blocks contains exactly one common block. The
implementation should add a small helper in `coalesce_ir_facts.py`:
`_blocks_defining(facts, virtual) -> list[Block]` and
`_common_successor(blocks) -> Optional[int]`. Keep these local to the
patterns module if they're not used elsewhere — promote to facts
later if reuse emerges.

**Suggestion text.**
```
TernaryCollapse: r{a} is assigned in multiple branches that converge.
  One branch assigns directly from r{b}:
    B<X>:  addi r{a}, r{b}, 0
    B<Y>:  li   r{a}, {other}
  Restructuring the if/else into a single assignment lets the coalescer
  see r{a} and r{b} as move-related:
    var_a = (cond) ? var_b : <other>;
  Source: conditional starts @ line N (best-guess)
  Catalog: debug pattern-catalog chained-init
```
(chained-init is the closest existing catalog entry — collapsing two
assignments into one. If a dedicated "ternary-collapse" entry is
needed later, add it to the catalog and update this reference.)

### 6.6 Fall-through (no pattern matched)

The orchestrator always emits a fall-through block when no checker
matched. It includes the raw IR facts for both virtuals, the
applicable register-cascade pattern as a workflow anchor, and an
honest "next step is manual" note:

```
No specific pattern matched. Raw facts:
  r{a} defined: block B<X>, opcode {op}, operands {...}
  r{b} defined: block B<Y>, opcode {op}, operands {...}
  Use sites of r{a}: B<X>, B<Z>
  Use sites of r{b}: B<Y>, B<W>, B<V>
  Bridge: r{a} → var_a (line N, best-guess); r{b} → <reason>

  Next step: search the C source for places where var_a and the binding
  of r{b} could share an assignment or expression. The
  `register-cascade` catalog entry has the general workflow.
```

## 7. Output format

### Human-readable (default)

**Pair mode**:
```
suggest-coalesce-source — {function}  pair r{from}=r{to}

IR facts:
  r{from}: defined block B<X> by `{opcode} {operands}`  [N use sites]
           bridge: <var_name> @ line N (<confidence>)
  r{to}:   physical reg — first set by `bl <fn>` at block B<Y>
           bridge: <return register, not a source variable>

Suggestions (highest confidence first):

  1. <PatternName>
     <ir_evidence sentence>
     <source_hint or 'see catalog for general recipe'>
     Catalog: debug pattern-catalog <catalog_ref>

  2. <PatternName>
     …

(or, if nothing matched, the fall-through block from §6.6)
```

**Discover mode** — same per-pair sub-section, preceded by the
cascade summary:
```
suggest-coalesce-source — {function}  --discover (top N)

Longest callee-save cascade detected: r25 → ... → r31
                                       (M saved regs; target has K)

Top N collapse candidates (would shorten cascade by 1 each):

  pair r{a}=r{b}   shortens cascade end (r31)
    1. <PatternName> — <one-line ir_evidence>
       Catalog: <catalog_ref>
    2. <PatternName> — <one-line ir_evidence>
       Catalog: <catalog_ref>

  pair r{c}=r{d}   shortens cascade middle
    1. <PatternName> — ...

Total: N candidates examined. Run `--force-coalesce` on each pair
to verify reachability before pursuing the source patterns.
```

### JSON (`--json`)

Top-level shape:
```json
{
  "function": "mnDiagram3_8024714C",
  "mode": "pair",
  "cascade": null,
  "pairs": [
    {
      "from": 53, "to": 3,
      "ir_facts": {
        "from": {
          "first_def": {"block": 5, "opcode": "addi",
                        "operands": "r53,r34,0"},
          "use_blocks": [5, 6, 7, 8, 9],
          "bridge": {"var": "name_flag", "line": 142,
                     "confidence": "best-guess"}
        },
        "to": {
          "is_phys": true,
          "first_def": {"block": 4, "opcode": "bl",
                        "operands": "GetNameText"},
          "bridge": null
        }
      },
      "suggestions": [
        {
          "pattern": "direct-identity",
          "summary": "r53 already copies from r34",
          "ir_evidence": "B5: addi r53, r34, 0",
          "source_hint": "Restructure line 142 …",
          "catalog_ref": "alias-split"
        },
        …
      ]
    }
  ]
}
```

In discover mode, `cascade` is the list of register numbers in the
descending chain as **integers** (e.g. `[31, 30, 29, 28, 27, 26, 25]`
— text renderer adds the `r` prefix), and `pairs` is the proposed
coalesces with `priority_class` + `depends_on` annotated:

```json
{
  "function": "mnDiagram3_8024714C",
  "mode": "discover",
  "cascade": [31, 30, 29, 28, 27, 26, 25],
  "pairs": [
    {
      "from": 53, "to": 3,
      "priority_class": "end-of-chain",
      "depends_on": null,
      "ir_facts": {...},
      "suggestions": [...]
    },
    {
      "from": 48, "to": 29,
      "priority_class": "frees-slot",
      "depends_on": [53, 3],
      "ir_facts": {...},
      "suggestions": [...]
    }
  ]
}
```

### Source-line annotation rules
- Annotation appears ONLY when the bridge produces `best-guess` or
  `verified` bindings (or `low-confidence` with `--include-low-
  confidence`).
- When omitted, the suggestion is honest about why
  (`bridge: <reason>`), keeping the IR facts authoritative.

## 8. Testing & validation

### Test files (created with the modules)

`test_coalesce_ir_facts.py` (~12 tests)
- `collect()` returns the right `VirtualFacts` for a single-block fn
- `collect()` aggregates use sites across multiple blocks correctly
- `analyze_cascade()` identifies a descending callee-save chain
- `analyze_cascade()` skips already-coalesced pairs
- Edge cases: empty fn, no callee-saves used, all-phys-reg, single virt

`test_coalesce_patterns.py` (~20 tests, 4 per pattern)
- Per pattern: 1 positive + 3 negatives (different ways it could fail to
  trigger; each negative documents in its docstring why)

`test_suggest_coalesce.py` (~5 tests)
- Pair-mode end-to-end on a real pcdump fixture
- Discover-mode end-to-end on a fn with a known cascade
- `--json` produces parsable structure
- `--include-low-confidence` opt-in path
- Smoke test invoking the CLI

### Calibration corpus

`tests/fixtures/coalesce_calibration.yaml`:
```yaml
cases:
  - function: fn_802461BC
    pcdump: fn_802461BC_pcdump.txt
    pair: [53, 3]
    expected_patterns:
      - direct-identity
      - chain-init
    notes: |
      Agent's session report — explicit if/else inversion was the actual
      win. DirectIdentityPattern should surface via the "shrink live
      range" suggestion.

  - function: mnVibration_80248644
    pcdump: mnVibration_80248644_pcdump.txt
    discover: true
    expected_cascade_top:
      - [r28, r27]
    notes: |
      MEMORY.md: matched 100% via `s32 j` decl reorder. The cascade
      analysis should propose this pair as a top candidate.
```

A `pytest.mark.parametrize` loops the YAML and asserts behavior.
**New historical cases can be added by editing the YAML alone — no
new test code required.** This doubles as regression coverage when
checkers change.

### Test-quality bar at ship time
- ≥ 20 unit tests across the three layers
- ≥ 3 calibration cases in the YAML
- 1 smoke test of the CLI
- All run in <2s combined (no compile dependencies — pure parser)

### Validation framework over time

The calibration corpus grows organically: every time a matching agent
finds a pattern that suggest-coalesce-source SHOULD have caught,
they add a YAML entry. Drift in any checker fails its corresponding
case immediately.

## 9. Edge cases & limitations

| Case | Behavior |
|------|----------|
| Function not in pcdump | Exit 2 with the standard "did you mean" suggestion (mirrors other debug commands) |
| pcdump missing pre-coloring pass | Exit 3 with "no pre-coloring pass for {fn}"; matches symbol-bridge's existing behavior |
| `--pair X=Y` where X or Y is out of range | Exit 2 with bounds explanation |
| `--discover` on a function with no cascade | Print "no cascade detected" + a note pointing at the catalog's `decl-order` workflow |
| `--pair` and `--discover` both given | Exit 2 with "exactly one of --pair/--discover required" |
| Symbol-bridge basis has red flags | Source-line annotations are skipped (or printed with `--include-low-confidence`) |
| All patterns miss the pair | Fall-through block emits raw IR facts + register-cascade catalog ref |
| Pcdump has events from MWCC_DEBUG_FORCE_PHYS already applied | Tool operates on the pre-coloring pass; FORCE_PHYS only affects colorgraph output. No interaction. |

## 10. Future extensions (out of scope for v1)

These are the natural follow-ups once v1 ships:
1. **Candidate generation (v2)**: lift suggestions into actual mutated
   `.c` files (à la tier3-search). Add `--generate <dir>` to write each
   suggestion as a candidate source. Each pattern checker would need a
   `materialize(source, pair) -> Optional[str]` companion method.
2. **Interference check in discover mode**: cross-reference the IGNode
   interferer arrays so discover-mode candidates are pre-filtered to
   coalesce-able pairs. Requires the post-coloring IG state to be
   reliably parseable (currently we get this from the pcdump).
3. **Cross-pcdump diffing**: given a pre-change and post-change
   pcdump, identify which coalesces flipped and surface as a learning
   signal — feeds back into the calibration corpus.
4. **Integration with `debug stuck`**: include suggest-coalesce-source
   output as an additional section when stuck-mode detects a long
   cascade.

## 11. Files to create / modify

| File | Action |
|------|--------|
| `tools/melee-agent/src/mwcc_debug/coalesce_ir_facts.py` | NEW |
| `tools/melee-agent/src/mwcc_debug/coalesce_patterns.py` | NEW |
| `tools/melee-agent/src/mwcc_debug/suggest_coalesce.py` | NEW |
| `tools/melee-agent/src/cli/debug.py` | MODIFY (add command) |
| `tools/melee-agent/tests/test_coalesce_ir_facts.py` | NEW |
| `tools/melee-agent/tests/test_coalesce_patterns.py` | NEW |
| `tools/melee-agent/tests/test_suggest_coalesce.py` | NEW |
| `tools/melee-agent/tests/fixtures/coalesce_calibration.yaml` | NEW |
| `tools/melee-agent/tests/fixtures/mwcc_debug/fn_802461BC_pcdump.txt` | NEW (generate via `pcdump-local` during plan execution) |
| `tools/melee-agent/tests/fixtures/mwcc_debug/mnVibration_80248644_pcdump.txt` | NEW (generate via `pcdump-local` during plan execution) |
| Additional fixture pcdumps as calibration cases grow | NEW (one .txt per case in the YAML) |
| `docs/mwcc-debug-handoff-<date>.md` | NEW (after implementation lands) |

## 12. Implementation order

For the executing plan, tackle in this order to maximize per-step
testability:

1. `coalesce_ir_facts.py` + `test_coalesce_ir_facts.py`. Pure
   data-extraction with synthetic Pass/Block/Instruction fixtures
   (existing helpers in `test_mwcc_debug_symbol_bridge.py`). Land
   `collect()` and `analyze_cascade()` separately, each with its own
   tests.
2. **Generate calibration pcdump fixtures.** Run `pcdump-local` on
   `fn_802461BC` and `mnVibration_80248644`, commit the .txt files to
   `tests/fixtures/mwcc_debug/`. **Pre-flight check**: confirm both
   functions compile cleanly under the current `pcdump-local`
   command — neither should trigger the `[pcdump-local] no compile
   progress` watchdog. If either does, escalate; the plan can't
   proceed with hung fixtures. These unblock integration tests.
3. `coalesce_patterns.py` — one pattern at a time. For each:
   write the checker, write 4 tests (1 positive + 3 negatives),
   confirm they pass before moving on. Order: DirectIdentity →
   ChainInit → AliasSplit → CommonSubExpr → TernaryCollapse.
4. `suggest_coalesce.py` — orchestration + rendering. Render text
   first, then JSON.
5. `debug.py` CLI integration — wire `suggest-coalesce-source`
   command with both `--pair` and `--discover` modes.
6. `coalesce_calibration.yaml` + the parametrize loop in
   `test_suggest_coalesce.py`. Smoke test of the CLI.
7. Docs: handoff entry, MEMORY.md pointer.

## 13. Success criteria

After implementation lands:
1. `melee-agent debug suggest-coalesce-source -f FN -V X=Y` produces
   useful output on the agent's `fn_802461BC` 53=3 case (at least one
   pattern checker fires; if none fire, the fall-through emits IR
   facts the agent could act on).
2. `--discover` on `mnVibration_80248644` identifies the cascade
   chain that contained the virtual the permuter eventually merged
   in MEMORY's `permuter_breakthrough` win. The agent's underlying
   fix was a decl-reorder, not a coalesce per se — the validation in
   the calibration YAML is **strict**: `expected_cascade_top` lists
   the exact (a, b) pair that should appear as the top-1 candidate,
   and the parametrize loop asserts equality. Looser "in the same
   cascade" matching would let bugs slip; strict matching makes
   regressions loud.
3. ≥ 20 unit tests pass; ≥ 3 calibration cases pass; smoke test passes.
4. JSON output round-trips through `python -m json.tool` cleanly.
5. Docs updated (handoff entry written, MEMORY.md pointer added).
