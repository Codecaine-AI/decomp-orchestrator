# mwcc-debug CLI Reorganization Design

Date: 2026-05-21

## Purpose

The `melee-agent debug` command surface has grown organically as the MWCC
debugging toolkit expanded from raw pcdump collection into allocator analysis,
target scoring, source mutation, permuter integration, and source-shape
suggestions. The current flat command list exposes implementation history
instead of the matching workflow. It also leaves the primary docs with stale
remote-first wording even though local cached pcdumps are now the normal path.

This change reorganizes `melee-agent debug` into opinionated workflow groups and
updates the docs so agents learn one command layout. We will not keep legacy
top-level command aliases. Removing the old names avoids another layer of drift
and forces docs, tests, and agent instructions to line up with the new model.

## Command Architecture

`melee-agent debug` will contain only these top-level groups:

```text
debug dump      collect pcdumps and manage local setup
debug inspect   read, compare, and explain dumps
debug target    define and score allocator targets
debug suggest   source-shape and mismatch suggestions
debug mutate    apply focused source mutations
debug permute   permuter integration and candidate verification
debug util      low-level helpers outside the main loop
```

Concrete command moves:

```text
pcdump-local              -> dump local
pcdump                    -> dump remote
setup-local               -> dump setup

analyze                   -> inspect analyze
diff                      -> inspect diff
simulate                  -> inspect simulate
guide                     -> inspect guide
stuck                     -> inspect stuck
ceiling                   -> inspect ceiling
rank-callees              -> inspect rank-callees

derive-target             -> target derive
score                     -> target score-dump
score-source              -> target score-source
match-iter-first          -> target match-iter-first

suggest-casts             -> suggest casts
suggest-coalesce-source   -> suggest coalesce
suggest-inlines           -> suggest inlines when that command lands

type-change               -> mutate type-change
insert-alias              -> mutate insert-alias
enumerate-decl-orders     -> mutate decl-orders
tier3-search              -> mutate search

verify-perm               -> permute verify
triage-perm               -> permute triage
gen-permuter-config       -> permute config
fix-perm-compile          -> permute fix-compile
permute                   -> permute run

pattern-catalog           -> util patterns
name-magic                -> util name-magic
verify-with-name-magic    -> util verify-name-magic
```

The top-level `debug --help` should show the group map and a short common path,
not a long inventory of every low-level command.

## User Workflow

The docs and help text should teach this order:

1. Use `debug dump local` by default.
2. Use `debug inspect guide -f <fn>` as the first interpretation step.
3. Use `debug target derive` and `debug target score-*` only when working from
   a desired allocator mapping.
4. Use `debug suggest ...` when the next step is a source-shape idea.
5. Use `debug mutate ...` or `debug permute ...` only after diagnostics point at
   a concrete source hypothesis.
6. Use `debug dump remote` only as fallback or remote-specific validation.

The CLI should keep option semantics stable where practical, but the help text
should de-emphasize historical tier numbers and emphasize what the command does
in the matching loop. Detailed docs may still mention tier labels where they are
useful historical context.

## Documentation Updates

Update these documents in the same implementation pass:

- `.claude/skills/mwcc-debug/SKILL.md`: agent-facing guide, fully migrated to
  grouped commands.
- `docs/mwcc-debug.md`: current architecture and workflow doc, rewritten around
  local cached pcdumps with remote mode as secondary.
- `docs/mwcc-debug-roadmap.md`: update command names and mark the CLI/docs
  refresh as active or shipped.
- Tests and canonical snippets that assert or demonstrate old command names.

The docs should not include compatibility guidance for removed old commands. The
steady-state guidance should show only the new command layout.

## Implementation Notes

Implementation should be mostly structural inside
`tools/melee-agent/src/cli/debug.py`:

- Create Typer sub-apps for `dump`, `inspect`, `target`, `suggest`, `mutate`,
  `permute`, and `util`.
- Register commands only on their new sub-apps.
- Move existing command bodies with minimal behavior changes.
- Rename Python functions only when it improves clarity.
- Refresh command docstrings and help text while preserving tested behavior.

Because old commands are intentionally removed, regression tests should cover
both sides:

- New grouped commands appear in `debug --help`.
- Representative moved command help works:
  `debug dump local --help`, `debug inspect guide --help`,
  `debug target derive --help`, `debug permute verify --help`.
- Old top-level commands such as `debug pcdump-local`, `debug guide`, and
  `debug verify-perm` are not registered.
- Canonical docs and skill snippets no longer retain stale command forms.

Verification for the implementation should include the targeted CLI tests,
MWCC debug tests touched by the reorganization, and `python -m compileall` for
the CLI module. A full Melee build is not expected for this CLI/docs-only work.
