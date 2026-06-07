# Tier 3: targeted source mutations + orchestrated search — design

A set of primitives that build on Tier 0/1/2 by making the permuter's
search **informed by mwcc-debug's analysis**. Given a stuck function,
generate a small set of high-probability seed mutations from the pattern
catalog + the actual virtual-register conflicts, then run permuter on
each seed.

Where Tier 2 says "evaluate candidates better," Tier 3 says
**"generate better candidates to start with."**

## Naming note: "Tier 3" in this doc

This spec uses "Tier 3" within the **permuter integration tier
hierarchy** (Tier 0 = triage, Tier 1 = weight-tuned configs, Tier 2 =
blended scoring, Tier 3 = targeted mutations). It is NOT the same as
the broader matching-tool taxonomy (Tier 5 = allocator biasing DLL,
Tier 6 = structural ceilings, Tier 7a-e = permuter integration
commands). Cross-references in `docs/mwcc-debug-permuter-integration.md`
will use "permuter Tier 3" to disambiguate.

## Why Tier 3 now

Tier 2 plumbing exists, but permuter still searches a huge space
randomly. For really-stuck functions (95%+ match, blocked on register
cascade), the right mutation often involves a specific named variable
that random walks rarely target. Tier 3 closes that gap by:

1. Identifying WHICH variable is blocking (via the existing pattern
   catalog + a new symbol bridge)
2. Generating N targeted mutations directly on that variable
3. Using each as a permuter starting point

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ debug tier3-search -f FN  (orchestrator)                      │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ debug guide / stuck  (existing — detect pattern, ID virtuals) │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Symbol bridge  (new — virtual reg ↔ source variable)          │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Mutator library  (new — tokenizer-based targeted mutations)   │
│   - mutate type-change                                        │
│   - mutate insert-alias                                       │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Multi-start permuter  (uses Tier 2 scoring)                   │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ Best result + diff                                            │
└───────────────────────────────────────────────────────────────┘
```

Each layer is independently useful — CLI'd as its own command so the
agent can use them composably.

## Components

### 1. Symbol bridge (new module)

`tools/melee-agent/src/mwcc_debug/symbol_bridge.py`

Bridges between source-level variable names and MWCC's virtual register
numbers. The matching agent reasons about variables; mwcc-debug reasons
about virtuals. This bridge connects them.

**Public API:**

```python
@dataclass
class VarBinding:
    var_name: str         # source-level local name
    virtual: int          # virtual register number (== ig_idx in MWCC IG)
    decl_line: int        # line in source where declared
    confidence: str       # "exact" | "best-guess" | "ambiguous"


def find_virtual_for_var(
    source: str,
    fn_name: str,
    var_name: str,
    pre_pass: Pass,           # from parser.py
) -> Optional[VarBinding]: ...


def find_var_for_virtual(
    source: str,
    fn_name: str,
    virtual: int,
    pre_pass: Pass,
) -> Optional[VarBinding]: ...


def list_bindings(
    source: str,
    fn_name: str,
    pre_pass: Pass,
) -> list[VarBinding]: ...
```

**Mechanism — heuristic + self-verification, not "exact":**

The v1 bridge does NOT try to be exact via deep AST analysis. Instead
it uses a simple decl-order heuristic plus an OPTIONAL verification
step the orchestrator can invoke to confirm a mapping before committing
20-50 minutes to a seed.

1. **Decl-order heuristic ("best-guess" by default).** Use the same
   regex-based brace-tokenizer the existing `source_patch.py` uses to
   walk a function body and collect local declarations in source
   order. Map the N-th local to the N-th distinct virtual (r ≥ 32)
   appearing as a destination in the pre-coloring pass after the
   parameter virtuals. This is the dominant path and produces
   `confidence="best-guess"`.

2. **Self-verification (raises confidence to "verified").** The
   orchestrator (NOT the bridge itself) can verify a claimed mapping
   by applying a no-op type-change mutation (e.g., add `volatile`
   qualifier) and re-running pcdump-local. If the predicted virtual's
   destination type/usage changes in the new pre-coloring pass, the
   mapping was correct → label `confidence="verified"`. If nothing
   moves, the mapping was wrong → label `confidence="rejected"`,
   skip this seed. This costs one extra pcdump call (~1s) per
   verification, paid only when the orchestrator decides to commit a
   seed.

3. **No pycparser dependency.** v1 does NOT use pycparser. Real Melee
   functions are full of HSD_ASSERT, PAD_STACK, statement-expressions,
   and other constructs that vanilla pycparser refuses. The brace-
   tokenizer in `source_patch.py` already handles these (treats macro
   text as opaque), is proven on this codebase, and is sufficient for
   v1's mutator scope. If/when v2 mutators need real AST manipulation,
   we'll add the pycparser+fake-libc layer then.

4. **Calibration gate (REQUIRED before any tier3-search runs).**
   Before downstream layers proceed, the bridge MUST be validated
   against ≥3 functions where the variable↔virtual mapping is known:
   `fn_80247510` (param-iter-ceiling case; r3 param → some virtual),
   `fn_8024E1B4` (dual-pointer pattern from MEMORY.md;
   `ptr`/`data`/`root` locals' virtuals known from prior decomp work),
   and one more from a recently-matched function. Bridge fails
   calibration → Tier 3 implementation pauses until fixed.

**Parameters in v1.** Parameter virtuals get a low ig_idx (32-34) but
their mapping to parameter names is determined by both the C ABI AND
whether the function actually uses them.

- Parameters observed in the pre-coloring pass with a known virtual
  → `confidence="best-guess"` (heuristic matched the C ABI ordering).
- Parameters NOT observed in the pre-coloring pass (dead parameter, or
  the function only uses them indirectly) → `confidence="ambiguous"`
  with a clear note. `list_bindings` still returns them so the
  orchestrator can decide to skip vs include.

Floating-point arguments (`f0..f8`), struct-by-value args, and varargs
are **out of scope for v1 bridging**. `list_bindings` reports them
with `confidence="unsupported"`. Mutators refuse to operate on them.

`list_bindings` returns BOTH parameters and locals, each tagged with
its `kind` field (`"param"` | `"local"`) so callers can filter.
Mutators in v1 refuse to operate on parameters regardless of
confidence — changing parameter types is a callers-API change, out
of scope for v1.

**CLI:** `debug inspect var-to-virtual -f FN <var-name>` and
`debug inspect virtual-to-var -f FN <ig-idx>`. Both also have `--json`
for tooling.

### 2. Mutator library (new module)

`tools/melee-agent/src/mwcc_debug/mutators.py`

**Tokenizer-based source mutations** targeting specific variables. v1
does NOT use pycparser — instead it builds on the same brace-tokenizer
+ regex approach `source_patch.py` already uses successfully on real
Melee functions (proven against the `auto_inline`/`dont_inline`/HSD
macro zoo).

Each mutator returns the mutated source as a string; if a mutation
target can't be unambiguously located via the tokenizer (e.g., variable
name appears inside an opaque macro that the tokenizer treats as a
black box), the mutator raises `MutationUnsupported` and the
orchestrator skips that seed.

This trade-off — tokenizer instead of AST — means v1 mutators are
restricted to simple shapes (single-decl rewrites, statement-level
inserts). v2 can introduce a pycparser+fake-libc layer if/when the
mutator catalog grows complex enough to need real AST work.

**Two mutators in v1:**

**`mutate_type_change`** — changes a local's type. Handles primitive
types (`u8` ↔ `u32`, `s32` → `s8`, etc.) and pointer types.

```python
def mutate_type_change(
    source: str,
    fn_name: str,
    var_name: str,
    new_type: str,
) -> str: ...
```

**`mutate_insert_alias_before_use` (renamed from `mutate_alias_split`
for clarity — v1's pointer-alias rewrite).**

v1 restricts to the dominant catalog shape: a pointer/pointer-like
variable that's read multiple times and we want to **insert a fresh
local copy before the N-th statement that reads it, then rewrite that
one statement to use the fresh local.** This models patterns like
`fn_8024E1B4`'s `ptr = data = gobj->user_data` and similar from
MEMORY.md.

Concretely:

- "Use" = a statement-level token-occurrence of `<var>` outside string
  literals/comments, where the variable is **read** (not on the LHS of
  a single-equals `=` assignment in that statement).
- `at_stmt_index` = the 0-indexed N-th such reading statement,
  counting in source order within the function body.
- The rewrite:
  1. Inserts `<type> <new_name> = <var>;` immediately before that
     statement.
  2. Replaces THAT ONE statement's token occurrences of `<var>` with
     `<new_name>`.
  3. All other reads of `<var>` keep the original name.

```python
def mutate_insert_alias_before_use(
    source: str,
    fn_name: str,
    var_name: str,
    at_stmt_index: int,    # 0-indexed; counts read-only statement uses
    new_name: Optional[str] = None,  # default: var_name + "_alias"
) -> str: ...
```

Out of v1 (deferred to Tier 4+): aliasing lvalues with side effects,
aliasing write-targets, multi-statement use sites, splits where the
variable appears in macros the tokenizer can't see into. Each adds
rewrite ambiguity; defer until the simple form proves useful.

Both return new source strings; callers are responsible for writing.

**CLI:** `debug mutate type-change -f FN --var V --type T [--apply]` and
`debug mutate insert-alias -f FN --var V --at N [--apply]`. Default:
write to stdout. `--apply` writes back to the source file.

Errors (variable not found, parse failure, ambiguous variable,
`MutationUnsupported`) raise typer.Exit with a clear message and a
non-zero code.

### 3. Multi-start orchestrator

`debug tier3-search -f FN [--budget N] [--per-seed-iters M]`

Coordinated search using everything above + the Tier 2 permuter.

**Workflow:**

1. Resolve pcdump + target (auto-derive if needed; reuse `permute`'s
   logic).
2. Run `guide` to detect patterns. For each high-severity suggestion,
   identify the source variable via symbol bridge.
3. Generate up to N seed variants:
   - For each (pattern, variable) pair, apply 1-3 targeted mutations
     via the mutator library
   - Stage each variant inside `nonmatchings/<fn>/tier3_seed_<idx>/`
   - Skip seeds that fail to compile or that `mutators` flag as
     unsupported
4. For each surviving seed, run a permuter session with our blended
   scorer (`--per-seed-iters` iterations, default 200).
5. Track best score across seeds + the unmutated baseline.
6. Report the best result with its diff and which seed produced it.

**Empty-suggestion fallback.** If `guide` returns no high-severity
suggestions (function is at high-but-stuck match with no obvious named
blocker), tier3-search falls back to:

- Read `rank-callees` output and pick the top-3 callee-save virtuals
  the cascade is dispensing to. Look those up via the bridge to source
  variables.
- Generate `mutate_type_change` and `mutate_alias_split` seeds for
  each. This is the "speculative" path; expected to be lower-yield
  but worth trying when there's nothing else.

If both guide AND rank-callees produce no usable targets,
tier3-search exits with a clear message: "no Tier 3 targets;
fall back to `debug permute -f FN` for a vanilla Tier 2 run."

**Seed parallelism.** Within one tier3-search invocation, seeds CAN
run in parallel because each invokes a separate permuter session
that runs `-j 1` (which is the existing Tier 2 constraint to avoid
pcdump.txt races). v1 runs seeds sequentially for simplicity and
clean log output; `--parallel-seeds N` is a Tier 3.1 follow-up if the
budget proves painful. The deferred parallelism is purely a UX win,
not a correctness gate.

**Default budget — calibrated, not optimistic.** Tier 2 measured one
scored iteration at ~1s under ideal conditions but real candidates
(failing compiles, longer functions, full IGNode-distance) typically
land at 2-3s. The default budget of 5 seeds × 200 iterations =
1000 scoring calls = **20-50 minutes wall-clock** on a single host.
We document this range. Agents using tier3-search are signing up for
a long-ish run; the orchestrator emits a clear up-front estimate
based on a single warmup score call.

**`--budget N` is a hard cap on seed COUNT, not on (variable × variant)
combinations.** If guide+fallback produce more candidate
(variable, mutation_direction) pairs than `N`, the orchestrator
truncates by priority (high-severity suggestions first, then
rank-callees order). The "both widening AND shrinking" policy still
applies but only within the budget — if the cap is hit after 2 widening
seeds, no shrinking seeds get generated. The orchestrator logs which
candidate seeds were dropped due to the cap.

**Loud failure detection.** If, of N generated seeds, **zero compile
successfully**, the orchestrator EXITS NON-ZERO with a clear message:
"all N tier3 seeds failed to compile — bridge mapping likely wrong or
mutation produced invalid C." This prevents the silent-failure trap
where a 30-minute run returns "no improvement" when actually no seeds
ever ran. If some seeds compile and some don't, the run continues
normally and reports per-seed compile success in the summary.

## Data flow

```
guide output       symbol bridge      mutator library
─────────────  ─►  ─────────────  ─►  ────────────────
  "r36 should     "r36 is variable    "Generate variant
   be r31"        cooldown_timer       with cooldown_timer
                  at line 42"          aliased before its
                                       3rd use"

mutator output    permuter run        scorer (Tier 2)
─────────────  ─►  ─────────────  ─►  ──────────────────
  Variant source   200 iterations    Per-iter scores;
  written to       on this variant   final best per seed
  nonmatchings/
  tier3_seed_0/
```

## Files

**New:**
- `tools/melee-agent/src/mwcc_debug/symbol_bridge.py` — brace-tokenizer
  based decl walker + the heuristic+self-verify bridge API.
- `tools/melee-agent/src/mwcc_debug/mutators.py` — tokenizer-based
  `mutate_type_change` and `mutate_insert_alias_before_use`.
- `tools/melee-agent/tests/test_mwcc_debug_symbol_bridge.py` — unit
  tests + the calibration tests against `fn_80247510`, `fn_8024E1B4`,
  and one more known-mapping function.
- `tools/melee-agent/tests/test_mwcc_debug_mutators.py` — unit tests
  + the `fn_8024E1B4` dual-pointer regression test.
- `tools/melee-agent/tests/test_mwcc_debug_tier3_search_integration.py`
  — explicitly named `_integration` so CI can select/skip it; depends
  on live build artifacts (report.json, pcdumps).

**Doc strategy.** Single permuter-integration doc is the source of
truth: extend `docs/mwcc-debug-permuter-integration.md` with a Tier 3
section (under "permuter Tier 3" label per the naming note above). No
separate tutorial file — the integration doc already contains the
workflow chapters for Tier 0/1/2, so Tier 3 slots in alongside them.
While there, **reorder the existing headings to a linear Tier 0→1→2
flow** (current doc presents Tier 0, Tier 2, Tier 1 in that order
because Tier 2 shipped after Tier 1 was specced; cleaning the order
is a 5-minute fix worth doing alongside the Tier 3 addition).

**Modified:**
- `tools/melee-agent/src/cli/debug.py` — 4 new CLI commands
  (~200 lines added):
  - `var-to-virtual`
  - `virtual-to-var`
  - `mutate type-change` and `mutate alias-split` (Typer subcommands)
  - `tier3-search`
- `docs/mwcc-debug-permuter-integration.md` — add Tier 3 section
- `.claude/skills/mwcc-debug/SKILL.md` — add Tier 3 command discovery

## Testing strategy

**Symbol bridge:**
- Unit: synthetic functions with known decl order → known virtual
  numbers. Includes edge cases: decl-shadowing, conditional decls in
  nested blocks, no-init vs initialized decls.
- **Calibration test (REQUIRED — must pass before Tier 3 implementation
  proceeds past the bridge):** validate `list_bindings` against at
  least 3 real Melee functions where the ground truth is known. v1
  set: `fn_80247510` (param-iter-ceiling case; ig_idx 32-34 known
  as params), `fn_8024E1B4` (dual-pointer pattern from MEMORY.md;
  `ptr`/`data` mapping known), and one more from the matched set
  to be selected during implementation. Bridge fails calibration →
  Tier 3 implementation pauses until fixed.

**Mutators:**
- Unit: small synthetic functions, mutate, parse mutated output, check
  AST structure.
- **Regression test against a known-good baseline (REQUIRED):**
  `mutate_alias_split` applied to `fn_8024E1B4` reproducing the
  dual-pointer pattern (`ptr = data = gobj->user_data`) MUST compile
  cleanly and produce a .o matching the documented 100% baseline. This
  converts the catalog pattern from "we noticed this works" into an
  actively-tested mutator output.
- Integration: real Melee TU, mutate, run through `compile.sh` (via
  fix-perm-compile), verify the .o builds. This is the cheaper smoke
  test on top of the regression test.

**Orchestrator:**
- End-to-end: known stuck function, run `tier3-search`, verify some
  seed produces a non-baseline score. (May not improve match in tests
  — just verify the pipeline works.)
- Empty-suggestion path: a function where `guide` produces no
  high-severity suggestions → orchestrator must use the rank-callees
  fallback and either find seeds OR exit cleanly with the
  documented message.

## Out of scope (Tier 4+)

- **Predict-before-compile** — model the score of a mutation without
  actually compiling. Needs a learned cost model or analytical IG-walk.
- **Mutation chaining** — apply 2+ mutations to one seed. Permuter
  already handles this stochastically; targeted chaining is research.
- **Subexpression-extract / chained-init / drop-variadic-cast
  mutators** — additional pattern coverage. Add when v1 mutators prove
  useful and the patterns are observed in agent feedback.
- **Cross-TU mutations** — changes affecting headers or callees. Out of
  scope.
- **Inline ASM / pragma-driven mutations** — too risky to automate.

## Risk

- **AST manipulation fragility.** pycparser doesn't handle some
  real-world C constructs (GCC attributes, K&R-style decls). Mutators
  should fall back gracefully — log + skip the mutation, don't crash.
- **Bridge accuracy.** Virtual register numbering depends on MWCC's
  internal scan order. Our best-guess via decl-order alignment is
  accurate for typical cases but can be wrong for unusual functions
  (e.g., functions with goto-based decl reordering). Confidence
  reporting is essential.
- **Compile failures from mutations.** Mutators may produce
  syntactically valid but semantically invalid C (e.g., type-changing
  a variable whose uses require the original type). Pipeline must
  silently skip failed seeds.
- **Time budget.** Default tier3-search budget of ~17 minutes is
  longer than most existing commands. Document clearly.

## Open questions

- **Mutation diversity.** Should we run BOTH widening AND shrinking
  variants for the same variable, or pick one based on analysis? In
  v1: try both; let the score sort.
- **Memoization.** Some mutations may produce identical sources
  across seed combinations. Detect + dedupe? In v1: no — extra
  complexity, minor cost.
- **When to grow the mutator set.** Adding more mutators
  (subexpr-extract, chained-init, drop-variadic-cast, etc.) is cheap
  individually but expands the seed space. **Bar: ≥3 production
  matches landed via Tier 3 before considering additional mutators.**
  This prevents bloat from speculative additions and forces evidence-
  driven growth.

  **Tracking Tier 3 matches.** Commits that land a match where
  tier3-search produced the winning seed should include a
  `Tier3-Search: <seed-description>` trailer in the commit message
  (analogous to `Co-Authored-By`). A future `melee-agent debug
  tier3-stats` command (out of v1 scope) can tally these by `git log
  --grep "Tier3-Search:"`. v1 just establishes the convention.

## Success metric

A "really stuck" function that vanilla permuter couldn't crack in 5000
iterations should converge under tier3-search in <1000 total scoring
calls (sum across all seeds). One concrete observed case where this
happens is enough validation for v1.
