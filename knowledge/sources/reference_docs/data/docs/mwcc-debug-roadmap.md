# mwcc-debug roadmap — 2026-05-21

Consolidated "what's next" for the mwcc-debug toolset after the
2026-05-20 and 2026-05-21 feedback passes on `wip/mn-heartbeat` and
`decomp/mndiagram3`.

Phase 2 is now organized around the larger matching unlock:
**Source-Shape Suggestions v1**, centered on planned
`debug suggest inlines`.
Nested-block-local follow-through remains required, but it is treated as
supporting infrastructure for source-shape generation rather than the
headline.

---

## Recently shipped baseline

For context, these landed between 2026-05-18 and 2026-05-21 and define
the current floor.

- Tree-sitter-based **nested-block-local awareness Phase 1**.
  Bridge output carries `scope_path`; `var-to-virtual` and
  `virtual-to-var` expose scope paths; nested bindings remain
  `ambiguous-nested` after the validation study found only 22%
  correctness for the per-scope ordinal heuristic.
- **`debug suggest coalesce`** with pair/discover modes, pattern
  checkers, discover-mode preflight, and use-site context for compiler
  temps.
- **`debug permute verify` protections** including 3-way merge,
  placeholder leak guard, cleaner build-failure diagnostics, and
  failed-source preserve support.
- **`debug util verify-name-magic` / checkdiff name-magic integration**
  with by-value mapping, direct anonymous-symbol mapping, globalize
  support, and transparent checkdiff normalization by default.
- **`debug dump local` reliability improvements**: function-scoped diff,
  content-hash freshness checks, forced-cache skip, `--no-cache-sync`
  for temporary probes, checkdiff timeouts for integrated `--diff`,
  keep-obj warnings, function-scoped `--force-iter-first-fn`, local hang
  diagnostics, and non-zero exit status (`124`) when the watchdog kills a
  compile even if a partial dump was produced.
- **Allocator forcing/scoring**: force-phys, force-phys-iter,
  force-coalesce, `debug target derive`,
  `debug target score-source`, `debug inspect guide`, and
  `debug target match-iter-first` auto-verification with scoped force
  lists and periodic status output, including bounded clean object/report
  restoration after forced probes.
- **Copy tracing diagnostics**: class-aware `debug inspect virtual-to-ig`,
  `debug inspect trace-copy` first-absent-pass reporting, transform
  categorization, and copy discovery filters for `--list-copies`,
  `--involving`, and `--near-block`.
- **Source-shape feedback fixes**: `debug suggest inlines` handles
  tree-sitter byte offsets correctly in source with non-ASCII comments,
  omits full patched sources from JSON unless `--emit-patches` is set,
  treats guide/coalesce seed modes as pattern fallbacks, and records
  per-candidate verification failures instead of aborting. Follow-up
  fixes add typed/top-of-scope dirty-temp patches, grouped X/Y/Z
  hidden-dirty candidates, and baseline/candidate/delta score reporting
  for verified candidates. Verified candidates can attach optional
  copy-trace explanations for newly introduced `mr` copies via
  `--trace-copies`/`--explain`, and JSON output can emit compact unified
  hunks via `--emit-hunks`/`--emit-diffs` without one-line full-TU
  `patched_source` payloads. Follow-up filtering ranks the human trace
  summary toward candidate-relevant copies while reporting how many noisy
  candidate-only copies were omitted.
- **`debug mutate search` v2**: seed generation, smoke compile, per-seed
  permuter wiring, budget/time controls, and `--apply-best`.
- **`checkdiff`**: JSON exit normalization and SDA21 relocation
  normalizer default-on.
- **CLI/docs refresh v2** reorganizes `melee-agent debug` into workflow groups:
  `dump`, `inspect`, `target`, `suggest`, `mutate`, `permute`, and `util`.
  This is the current documented CLI surface.

---

## Phase 2: Source-Shape Suggestions v1

Spec:
`docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md`

Implementation plan:
`docs/superpowers/plans/2026-05-21-source-shape-suggestions.md`

### Goal

The current tools can prove allocator targets and explain many
register-cascade hypotheses. The recurring blocker is finding natural C
source that produces the desired shape. Phase 2 adds a tool that
generates and verifies small hidden-inline/extract-helper/source-shape
candidates.

Primary command:

```bash
melee-agent debug suggest inlines -f <fn>
melee-agent debug suggest inlines -f <fn> --verify
melee-agent debug suggest inlines -f <fn> --verify --trace-copies
melee-agent debug suggest inlines -f <fn> --json --emit-hunks
melee-agent debug suggest inlines -f <fn> --target target.json --verify
```

### P2.1: Scope-aware source editing infrastructure (HIGH)

- `mutate insert-alias` places alias declarations at the nearest
  enclosing block for the selected use, not always at function top.
- Alias assignment stays near the selected use and must occur after the
  original local's first real definition.
- `debug mutate decl-orders` walks `BindingBasis.decls_by_scope` and
  enumerates reorders within a single scope only.
- Cross-scope declaration swaps are rejected because they can change C
  semantics.
- CLI output includes scope paths; `--scope` restricts to one scope.

Why first: `debug suggest inlines` must operate inside nested cursor/rumble
blocks without illegal C89 placement or accidental scope hoisting.

### P2.2: Source span and candidate model (HIGH)

- Add shared `SourceAnchor`, `InlineCandidate`, `CandidatePatch`, and
  `CandidateScore` dataclasses.
- Add tree-sitter-backed statement/block span discovery that preserves
  scope paths, byte ranges, and line ranges.
- Reject spans with `goto`, labels, `case/default`, cross-scope ranges,
  macro parse interruptions, ambiguous outputs, or unknown parameter
  types.

### P2.3: `debug suggest inlines` candidate generation (HIGH)

Seed sources:

- repeated/helper-shaped statement groups in the same function;
- `debug inspect guide` compiler-temp facts and wrong-virtual diagnostics;
- `debug suggest coalesce --discover` pairs, especially compiler-temp
  pairs with no bridge binding;
- known `debug util patterns` shapes such as cursor-position blocks,
  `GetNameSlot` sentinel paths, repeated `data->jobjs[...]` accessors,
  short-lived call-argument temps, and header-inline dirty calls hidden
  behind `HSD_JObjSetTranslateX/Y/Z`.

Candidate forms:

- extract a contiguous statement group to a file-scope `static inline
  void` helper;
- extract a single-value expression/helper;
- introduce a short-lived temp for one call argument without changing the
  whole surrounding inline expansion;
- introduce a grouped short-lived temp for visible
  `HSD_JObjSetTranslateX/Y/Z` calls that share the same first argument,
  preserving the apparent source type and local declaration-at-top style.
- trace a source-created copy from visible pcode virtuals to simplify and
  colorgraph decisions (`debug inspect virtual-to-ig`,
  `debug inspect trace-copy`) before
  deciding whether the remaining blocker is source lifetime or allocator
  coalescing.
- scan one level of direct same-source helper calls for
  `HSD_JObjSetTranslateX/Y/Z` pattern seeds, so cursor-copy/dirty-call
  candidates are still proposed when the visible calls live inside a
  static-inline helper.
- keep source splices byte/character-offset safe when comments or
  documentation before the candidate contain non-ASCII characters.

### P2.4: Candidate verification and ranking (HIGH)

- Stage candidates under
  `nonmatchings/<fn>/source_shape_candidate_<idx>/`.
- Smoke-compile with the original TU include directory.
- Temporarily apply candidate source to the real tree for `checkdiff`
  scoring, then restore unless `--apply-best` succeeds.
- If a target spec is supplied, also run `debug dump local` and
  `debug target score-source` so allocator improvements that do not
  immediately improve match percent are still visible.
- Rank by compile success, checkdiff delta, pcdump score delta,
  candidate size, helper parameter count, and stable candidate id.
- Verification output should show baseline match percent, candidate
  match percent, and delta even when the candidate ties baseline.
- Optional `--trace-copies` / `--explain` verification should compile a
  candidate pcdump, diff its `mr` copies against the baseline pcdump, and
  report whether each new copy reaches simplify/colorgraph or is removed
  before coloring. Human output should show a filtered/ranked summary of
  the candidate-relevant subset, with source-argument and patch-local
  traces ahead of generic dominant-source traces, while JSON keeps the
  raw trace list.
- JSON output should stay compact by default, support compact unified
  hunks with `--emit-hunks` / `--emit-diffs`, and emit full
  `patched_source` only when `--emit-patches` is requested.

### P2.5: Compiler-temp seeding for Tier 3 (MEDIUM)

- Feed `SourceAnchor` records from `debug inspect guide` and
  `debug suggest coalesce --discover` into `debug mutate search`.
- Generate seeds only when compiler-temp facts can be tied to a source
  span, field access, or call argument.
- Report unanchored compiler temps with first-def/use-site evidence
  instead of silently producing no targets.

### P2.6: Documentation and calibration (MEDIUM)

- Add non-applying smoke examples for `fn_80247510`, `fn_80248A78`, and
  one `mndiagram3.c` function.
- Keep a small rejected-candidate corpus so unsupported source shapes
  fail with useful reasons.
- Update the `mwcc-debug` skill once the new suggestion command exists.

---

## Backlog from feedback docs

These are not part of Phase 2 Source-Shape Suggestions v1 unless called
out above.

### Stack layout tools (HIGH, separate spec)

- **Stack-slot provenance helper:** report which source local or compiler
  temp owns each stack slot, identify unreferenced stack holes, and
  suggest equivalent aggregate/local shapes.
- **`--force-stack-slot`:** DLL-side reachability hook for stack allocator
  placement, analogous to `--force-phys`, for cases where total frame
  size matches but one local lands at the wrong offset.

### Source cleanup and permuter hygiene (MEDIUM)

- **`clean-cruft`:** detect permuter-generated patterns such as nested
  no-op masks, XOR with 0, all-ones masks, dead code after `goto`,
  artificial aliases, and questionable 64-bit casts; verify removals
  one by one and apply only non-load-bearing cleanups.
- **Upstream decomp-permuter placeholder fix:** local
  `debug permute verify` guards catch `inline_fn` leaks, but the cleaner
  fix belongs upstream in the randomizer/candidate persistence path.
- **Stale baseline warnings:** continue improving workflows that apply a
  candidate over source changed since import. Current 3-way merge covers
  the local side; upstream or import-time warnings would still help.

### Name/relocation post-processing (MEDIUM)

- **Ninja post-compile name-magic:** run automatic
  `debug util name-magic` behavior after each object compile so
  anonymous int-to-float magic mismatches stop obscuring real text
  differences during normal iteration.
- **Relocation normalizer extensions:** investigate remaining
  relocation-only mismatches beyond the current SDA21 `+2` fold.
- **Anonymous value ambiguity warnings:** when multiple anonymous symbols
  share bytes/value, list all possible matches so value-based
  `debug util name-magic` choices are less surprising.

### Diagnostic suggestions (MEDIUM)

- **HSD_ASSERT override detector:** detect anonymous assert strings such
  as `jobj.h`/`jobj` and suggest the known override pattern before
  `<baselib/jobj.h>`.
- **`debug suggest casts` multi-hop signedness:** surface combined
  `u8 -> unsigned int -> int` style recommendations when width and
  compare-signedness checks both apply.
- **`ceiling` SPILLED fallback:** before reporting a probable ceiling,
  optionally run virtual-to-source fallback on unexpected SPILLED nodes
  and surface sentinel/inline source-shape leads.

### Force/preflight/CLI UX (LOW-MEDIUM)

- **Copy-survival force proof:** add a DLL-side `--force-copy-survives`
  or no-coalesce hook for a specific `mr rTO,rFROM` edge. This remains
  the unimplemented 2026-05-21 feedback item: forcing final physical
  registers is not enough to prove whether preserving a specific copy
  would create the target `mr` instructions.
- **`root-identity`:** either ship the command or remove stale references
  from any remaining handoff/skill docs.
- **Force iter-order clarity:** keep help text explicit that
  `--force-iter-first` is global to the translation unit and has no
  per-function scope. Run
  `melee-agent debug target match-iter-first -f <fn>` before forced
  iter-order testing, and use the forced option only on single-function
  TUs or after accepting cross-function blast radius.
- **Class-scoped force regression watch:** if `--force-phys` again
  applies to both GPR and FP classes, fix the DLL-side class filter; use
  `--force-phys-iter` as the reliable workaround meanwhile.
- **Coalesce preflight coverage:** continue broadening the invalid-pair
  checks that prevent local wibo hangs before a forced run. Current
  coverage flags physical-register pairs, direct interference,
  cross-class pairs, missing colorgraph nodes, absent colorgraph data,
  and non-interfering pairs with no direct pre-coloring copy/identity
  edge. Such pairs remain useful source-shape leads, but should not be
  presented as safe `--force-coalesce` proofs.

### Test corpus health (LOW)

- Add a pre-match calibration case for `debug suggest coalesce
  --discover` with concrete expected top pair/priority, not only a
  post-match fixture that yields zero candidates.
- Keep smoke tests for cache freshness and forced-cache isolation.

---

## Punted with reasoning

- **Full C semantic analyzer:** Phase 2 remains AST/lexical. Type
  inference, shadowing resolution, and full preprocessor expansion are a
  separate multi-month project.
- **Per-iteration workingMask hook:** useful but invasive; current
  simplify/colorgraph outputs are enough for the planned source-shape
  work.
- **Per-function decompiled-source caching:** bridge and AST walks are
  currently fast enough; more cache state adds little.

---

## How to decide what is next

- For the largest matching unlock: implement Phase 2 Source-Shape
  Suggestions v1, starting with scope-aware source editing.
- For immediate nested-local blockers: P2.1 alone can unblock targeted
  alias and declaration-order experiments.
- For stack-only mismatches like `mnDiagram3_8024714C`: write a separate
  stack-layout spec after Source-Shape Suggestions v1 lands.
- For day-to-day diff readability: keep improving name/relocation
  post-processing, but avoid making it a dependency of source-shape
  generation.

---

## Source documents

- `docs/superpowers/specs/2026-05-21-source-shape-suggestions-design.md`
  — Phase 2 design.
- `docs/superpowers/specs/2026-05-20-nested-block-local-awareness-design.md`
  — Phase 1 nested-local design.
- `docs/superpowers/plans/2026-05-20-nested-block-local-awareness.md`
  — Phase 1 implementation plan.
- `docs/mwcc-debug-nested-block-validation-2026-05-20.md`
  — 22% nested ordinal validation result.
- `docs/mwcc-debug-nested-block-macro-tolerance-2026-05-20.md`
  — macro tolerance and tier3 seed-count snapshot.
- `docs/mwcc-debug-future-ideas.md`
  — historical tier roadmap; mostly superseded by this file for current
  prioritization.
- `decomp/mndiagram3:mwcc-debug-feedback-5-20-2026.md`
  — mndiagram3 campaign feedback.
- `wip/mn-heartbeat:mwcc-debug-feedback-5-20-2026.md`
  — mnvibration heartbeat feedback and source of the inline/extract
  tooling request.
- `wip/mn-heartbeat:mwcc-debug-feedback-5-21-2026.md`
  — fn_80247510 copy-tracing follow-up and remaining copy-survival force
  proof request.
