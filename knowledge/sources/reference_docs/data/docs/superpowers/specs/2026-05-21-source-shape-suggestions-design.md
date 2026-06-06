# mwcc-debug source-shape suggestions — design spec

**Date:** 2026-05-21
**Status:** Approved through brainstorming flow
**Author:** Codex + Mike

## Summary

Phase 2 of the mwcc-debug work becomes **Source-Shape Suggestions v1**.
The headline feature is `melee-agent debug suggest inlines`: a tool
that finds hidden-inline or extracted-helper source hypotheses, stages
candidate rewrites, optionally verifies them against the real tree, and
ranks the result with `checkdiff` plus optional mwcc pcdump scoring.

The nested-block-local follow-up from Phase 1 remains in scope, but as
enabling infrastructure rather than the headline. Scope-aware alias
insertion and scope-aware declaration ordering are required because the
highest-value source-shape candidates live inside nested cursor/rumble
blocks, not only at function top.

## Problem

The current toolset can answer allocator questions that used to be
opaque:

- `debug dump local`, `force-phys`, `force-phys-iter`, and `force-coalesce`
  can prove whether a target allocation is reachable.
- `debug inspect guide`, `debug target score-source`,
  `debug suggest coalesce`, and `debug mutate search` can explain many
  register-cascade and lifetime
  hypotheses.
- Phase 1 nested-block-local awareness makes nested locals visible in
  bridge output with honest `ambiguous-nested` confidence.

The remaining gap in the feedback docs is source-shape discovery. Agents
can often prove that a hidden helper, short-lived call-argument temp, or
inline/extract-subroutine structure changes allocator shape in a useful
direction, but they still have to invent those candidates manually. In
`mnvibration.c`, that means repeated cursor-position blocks,
`mnVibration_GetNameSlot` sentinel paths, and narrow
`HSD_JObjSetMtxDirtySub` argument-temp hypotheses. In `mndiagram3.c`,
the same category appears as helper-like repeated statement groups and
permuter-generated source forms that are hard to evaluate cleanly.

## Goals

- Add `debug suggest inlines` as a non-mutating diagnostic command by
  default.
- Generate a small set of high-signal inline/helper/source-shape
  candidates from source and pcdump facts.
- Support three candidate forms in v1:
  - extract a contiguous statement group to a `static inline void`
    helper,
  - extract an expression/helper returning one value,
  - introduce a short-lived temp for one call argument without
    extracting the whole surrounding block.
- Stage and verify candidates when requested, restoring the real source
  unless the user explicitly applies a verified winner.
- Make `debug mutate insert-alias` and `debug mutate decl-orders` scope-aware so
  source-shape tools can work inside nested blocks without illegal
  cross-scope edits.
- Feed compiler-temp facts from `debug inspect guide` and
  `debug suggest coalesce`
  into source-span anchoring so temps with no direct source binding can
  still produce actionable candidate slices.
- Reorganize the roadmap so unimplemented feedback items are explicit
  backlog, not scattered session notes.

## Non-goals

- No full C semantic analyzer. v1 remains lexical/AST-based and rejects
  ambiguous candidates instead of pretending to understand all C
  semantics.
- No arbitrary whole-function refactoring. Candidate spans must be small,
  local, and explainable.
- No stack-slot forcing or stack allocator hook work in this phase.
- No build-system-wide name-magic integration in this phase.
- No `clean-cruft` implementation in this phase.
- No automatic upstream decomp-permuter patching. Existing
  `debug permute verify` guards remain the local protection layer.

## CLI

```bash
# Discover likely inline/helper candidates, print report only.
melee-agent debug suggest inlines -f fn_80247510

# Stage candidates and verify with real-tree checkdiff.
melee-agent debug suggest inlines -f fn_80247510 --verify

# Restrict seed source while debugging the tool.
melee-agent debug suggest inlines -f fn_80247510 --seed-source guide
melee-agent debug suggest inlines -f fn_80247510 --seed-source coalesce
melee-agent debug suggest inlines -f fn_80247510 --seed-source repeated

# Score against a target allocator shape as well as checkdiff.
melee-agent debug suggest inlines -f fn_80248A78 \
    --target /tmp/forced-target.json --verify

# Structured output.
melee-agent debug suggest inlines -f fn_80247510 --json

# Apply only a verified winner that clears the configured threshold.
melee-agent debug suggest inlines -f fn_80247510 --verify --apply-best
```

Options:

- `--function/-f FN`: required target function.
- `--pcdump PATH`: optional pcdump path; otherwise use the normal cache
  resolver.
- `--seed-source all|repeated|guide|coalesce|patterns`: default `all`.
- `--budget N`: maximum candidates to report or verify, default 8.
- `--max-span-statements N`: cap contiguous group size, default 6.
- `--verify`: stage, smoke-compile, and run real-tree scoring.
- `--target PATH`: optional target spec for `debug target score-source`; implies the
  candidate can be ranked by allocator-shape score as well as match
  percent.
- `--threshold FLOAT`: minimum `checkdiff` improvement for
  `--apply-best`, default `0.05`.
- `--apply-best`: leave the best verified candidate applied if it clears
  threshold; otherwise always restore source.
- `--keep-failed`: preserve failed candidate source and compiler logs.
- `--json`: emit parseable JSON.

Default mode is diagnostic and does not edit source files.

## Architecture

New modules live under `tools/melee-agent/src/mwcc_debug/`.

### `source_shape.py`

Shared dataclasses for this phase and later source-shape tools:

```python
@dataclass
class SourceAnchor:
    function: str
    scope_path: tuple[str, ...]
    byte_range: tuple[int, int]
    line_range: tuple[int, int]
    kind: str                 # "repeated", "guide", "coalesce", "pattern"
    reason: str
    virtuals: tuple[int, ...] = ()

@dataclass
class InlineCandidate:
    candidate_id: str
    kind: str                 # "void-helper" | "return-helper" | "arg-temp"
    anchor: SourceAnchor
    helper_name: str
    reads: tuple[str, ...]
    writes: tuple[str, ...]
    source_excerpt: str
    rejection_reason: str | None = None

@dataclass
class CandidatePatch:
    candidate_id: str
    patched_source: str
    summary: str
    touched_ranges: tuple[tuple[int, int], ...]

@dataclass
class CandidateScore:
    candidate_id: str
    compile_ok: bool
    checkdiff_pct: float | None
    checkdiff_delta: float | None
    pcdump_score_delta: float | None
    diagnostics_path: Path | None
```

### `source_spans.py`

Tree-sitter-backed statement and block span discovery. It reuses the
Phase 1 AST approach and carries `scope_path`, byte ranges, line ranges,
parent block ranges, and statement kind.

Responsibilities:

- list statements in one function with stable source offsets;
- group statements by nearest enclosing scope;
- find safe contiguous statement groups;
- map line/block hints from pcdump facts back to nearby source spans;
- reject spans whose control flow crosses the selected range.

### `suggest_inlines.py`

Feature orchestrator:

1. Resolve source and pcdump.
2. Collect `coalesce_ir_facts.IrFacts`, symbol bridge bindings, and
   optional target data.
3. Produce `SourceAnchor` records from enabled seed sources.
4. Generate `InlineCandidate` records.
5. Convert accepted candidates into `CandidatePatch` records.
6. If `--verify` is set, call `candidate_verify`.
7. Render text or JSON report.

### `candidate_verify.py`

Reusable verification layer for source-shape candidates. This should
share behavior with `tier3_search` where possible instead of creating a
second compile/staging convention.

Responsibilities:

- stage candidate source under
  `nonmatchings/<fn>/source_shape_candidate_<idx>/`;
- add the original TU directory to include search paths for smoke
  compile;
- temporarily write the candidate into the real source only during
  real-tree verification;
- run `checkdiff` and parse JSON results;
- optionally run `debug dump local` plus `debug target score-source` when a target is
  supplied;
- always restore source unless `--apply-best` succeeds;
- write compiler/checkdiff diagnostics for rejected candidates.

### Existing modules extended

- `mutators.py`: make `mutate_insert_alias_before_use` scope-aware.
- `source_patch.py`: add scope-aware declaration-block discovery and
  reorder helpers.
- `tier3_search.py`: add an optional seed planner path that can consume
  compiler-temp anchors from `debug inspect guide`/`debug suggest coalesce`.
- `cli/debug.py`: add `debug suggest inlines` and expose scope controls on
  affected existing commands.

## Candidate generation

v1 prioritizes precision over breadth. It should produce a small set of
candidate explanations that are worth compiling.

### Seed source 1: repeated statement groups

Find contiguous statement groups in the same function with similar AST
shape:

- same primary call names;
- same field-access offsets or array-index structure;
- same setter/getter pattern with different identifiers;
- similar literal/sentinel branch shape.

This targets cursor-position blocks, name-slot sentinel paths, and
helper-like repeated blocks that are not text-identical.

### Seed source 2: `guide` compiler-temp facts

Use wrong virtuals, first-defs, use blocks, and category labels from
allocator guidance. A repeated load such as `lwz 80(r51)` should anchor
the tool near source statements that load the same field or pass the
same object through repeated call arguments.

### Seed source 3: `debug suggest coalesce --discover`

When discover mode finds a useful pair but the bridge cannot bind both
virtuals to source variables, feed the pair's first-def and use-site
facts into source-span discovery. This addresses the feedback case where
the tool found a plausible compiler-temp pair but could not generate a
seed.

### Seed source 4: pattern catalog

Use known local patterns as labels and filters, not as broad rewrite
permission. Initial pattern-backed anchors:

- cursor position/setter blocks;
- `GetNameSlot` sentinel/return paths;
- repeated `data->jobjs[...]` accessors;
- short-lived temp for a call argument.

## Candidate forms

### `void-helper`

Extract a contiguous statement group to a file-scope `static inline void`
helper inserted before the target function. Inputs are identifiers read
inside the span and declared outside it. v1 accepts this form when the
span has no local scalar output that must be returned to the caller, or
when effects are through calls/pointers already present in the span.

### `return-helper`

Extract a small expression or statement group that computes exactly one
value used by the caller. v1 rejects candidates with multiple outputs,
ambiguous write-after-read behavior, or outputs whose type cannot be
read from the bridge/AST.

### `arg-temp`

Introduce a short-lived local immediately before one call:

```c
temp = original_argument;
SomeCall(..., temp, ...);
```

or, when C89 requires it:

```c
Type temp;
...
temp = original_argument;
SomeCall(..., temp, ...);
```

The declaration is placed at the nearest legal enclosing block top. The
assignment stays near the call and must be after any first real
definition of identifiers it reads. This form directly targets the
feedback about adding only a missing argument temp around
`HSD_JObjSetMtxDirtySub` without changing the whole inline expansion.

## Candidate rejection

Unsupported candidates are reported with a rejection reason. They do not
fail the command.

Reject when:

- the span contains `goto`, labels, `case`, or `default`;
- the span crosses scope boundaries;
- declarations inside the span would escape or collide with caller
  declarations;
- there are multiple scalar outputs and no obvious return/out-param
  shape;
- a macro or tree-sitter parse error interrupts the candidate span;
- the candidate would move a declaration across a C89 executable
  statement boundary illegally;
- helper parameter types cannot be determined from AST/bridge data.

## Scope-aware infrastructure

### `mutate insert-alias`

Current behavior places the alias declaration at function top and the
assignment near the selected use. Phase 2 changes placement:

- find the selected reading use as a statement span, including nested
  blocks;
- use that statement's nearest enclosing block from `scope_path`;
- place the alias declaration at the top of that block, after existing
  declarations and before executable statements;
- place the alias assignment immediately before the selected use, unless
  the original local is assigned later; in that case, place the alias
  assignment after the first real assignment that dominates the selected
  use;
- reject instead of generating code when dominance is unclear.

The CLI should accept `--scope` for disambiguating repeated local names.

### `debug mutate decl-orders`

Current behavior enumerates only the function-top declaration block.
Phase 2 enumerates each eligible scope independently:

- use `BindingBasis.decls_by_scope` and AST statement spans;
- never swap declarations across scope boundaries;
- default output includes all eligible scopes, ordered function-top
  first and then source order;
- `--scope <scope_path>` restricts enumeration to one scope;
- JSON output includes scope path, candidate label, and touched decls.

This directly targets the cursor-row/jobjs nested-block reorder cases
from the heartbeat feedback.

### `debug mutate search`

Add a seed source for compiler-temp anchors:

- consume anchors from `debug suggest coalesce --discover` and
  `debug inspect guide`;
- create candidate plans only when the temp can be tied to a source
  span, field access, or call argument;
- otherwise report "unanchored compiler temp" with first-def/use-site
  evidence.

This can share the `SourceAnchor` model from `source_shape.py`.

## Verification and scoring

`suggest-inlines` has two modes.

Diagnostic mode:

- no source edits;
- prints candidate source excerpt, reason, seed source, reads/writes,
  helper form, and rejection reasons.

Verification mode:

1. Generate candidate patch.
2. Stage under `nonmatchings/<fn>/source_shape_candidate_<idx>/`.
3. Smoke-compile staged source with the original TU include directory.
4. Temporarily apply the patch to the real source.
5. Run `checkdiff` and parse JSON.
6. If `--target` is supplied, run `debug dump local` and `debug target score-source`.
7. Restore source unless `--apply-best` chooses this candidate.

Ranking:

1. compiling candidates before non-compiling candidates;
2. positive `checkdiff` delta;
3. positive pcdump/allocator score delta;
4. smaller candidate span;
5. fewer helper parameters;
6. stable candidate id for tie-breaking.

Candidates that preserve match percent but improve allocator score should
still be surfaced. This matters for functions where match percent is
noisy but forced-target scoring shows a better shape.

## Error handling

- Missing function/source/pcdump: command exits non-zero.
- Invalid CLI argument: Typer validation error.
- Candidate unsupported: report rejected candidate, continue.
- Smoke compile failure: record diagnostic path, continue.
- Real-tree verification infrastructure failure: restore source and exit
  non-zero.
- `--apply-best` with no verified candidate clearing threshold: restore
  source and exit zero with an explanatory report.

## Tests

Unit tests:

- source span discovery for nested blocks, repeated groups, and call
  arguments;
- candidate rejection for labels, `case/default`, cross-scope spans,
  macros interrupting spans, multiple outputs, and unknown types;
- `void-helper`, `return-helper`, and `arg-temp` patch generation on
  compact synthetic C;
- scope-aware alias placement in nested blocks;
- scope-aware declaration reordering within one block and rejection of
  cross-scope reorders;
- candidate ranking with mocked `CandidateScore` values.

CLI/rendering tests:

- diagnostic text includes source excerpt, seed source, reason, and
  rejection reasons;
- JSON output is stable and includes candidate ids, scope paths,
  reads/writes, scores, and diagnostics paths;
- `--apply-best` refuses to apply unverified candidates.

Integration smoke tests:

- non-applying `debug suggest inlines -f fn_80247510`;
- non-applying `debug suggest inlines -f fn_80248A78`;
- non-applying `debug suggest inlines` on one `mndiagram3.c` function;
- optional slow verification path behind an integration marker for one
  synthetic or known-safe candidate.

## Roadmap/backlog from feedback

In scope for this spec:

- `debug suggest inlines`;
- targeted short-lived call-argument temp suggestions;
- nested-block alias placement;
- nested-scope declaration ordering;
- compiler-temp source anchoring from `debug inspect guide` and
  `debug suggest coalesce`.

Explicitly deferred:

- Stack-slot provenance and "unreferenced stack hole" reporting.
- `--force-stack-slot` reachability hook.
- `clean-cruft` command for permuter-generated cosmetic cleanup.
- Ninja post-compile name-magic integration.
- Further relocation normalizer extensions beyond the current SDA21
  default.
- HSD_ASSERT override detection.
- `debug suggest casts` multi-hop signedness recommendations.
- Upstream decomp-permuter `inline_fn` placeholder fix.
- Pre-match calibration case for `debug suggest coalesce`.
- `root-identity` command/help cleanup.
- Force/preflight UX follow-ups, including class-scoped force regressions
  if they recur.
- `ceiling` fallback that surfaces SPILLED compiler-temp source hints.
- Full C semantic analyzer.

## Acceptance criteria

- `debug suggest inlines -f <fn>` reports at least one candidate or a
  clear "no candidates" reason without editing source.
- `--json` output is parseable and includes enough data for agents to
  inspect candidate provenance.
- `--verify` restores the real source after every candidate unless
  `--apply-best` succeeds.
- Scope-aware `mutate insert-alias` can target a nested local/use in a
  synthetic nested block without placing the declaration at function top.
- Scope-aware `debug mutate decl-orders` can enumerate swaps within a
  nested block and refuses cross-scope swaps.
- Unsupported candidates produce rejection records, not tracebacks.
- The roadmap names Source-Shape Suggestions as Phase 2 and lists the
  deferred feedback items above.
