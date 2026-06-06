# Harvest Pcdump Preflight Design

## Problem

`melee-agent harvest stack-local-layout` sends frame-transform rows directly to
`debug mutate frame-transform-search`. That harness auto-resolves its baseline
pcdump from `build/mwcc_debug_cache`. In a fresh worktree the cache is missing,
so every row fails as `harness-exit-nonzero` before source probes run. Issue
#396 shows this on eight current-tools stack rows: after manually running
`debug dump setup` and `debug dump local` for the five unique TUs, the same
batch produced real `validated` and `no_match` outcomes.

## Goals

- Warm the mwcc_debug pcdump prerequisites before frame-transform harvest rows
  are scored.
- Run setup once per harvest batch and dump each unique source TU at most once.
- Refresh stale pcdumps as well as missing pcdumps, using the existing
  `src.mwcc_debug.cache` freshness rules.
- Preserve the existing harness scoring, validation, and apply behavior.
- Record preflight activity in the harvest ledger so agents can see which TUs
  were already cached, refreshed, or failed.

## Non-Goals

- Do not change the debug dump implementation or cache format.
- Do not warm caches for unrelated harnesses such as name-magic, indexed-struct,
  coalesce, select-order, or control-flow-shape.
- Do not hide a setup or dump failure by turning it into one row error per
  queued function.

## Design

Add a small preflight layer in `src.harvest` that runs after queue rows are
loaded and before the row harness loop starts. It inspects selected requests,
keeps only rows whose selected harness is `frame-transform-search`,
`source_actionability` is `current-tools`, and `frame_closability_tier` is
`current-tools-padstack`, then maps their `source_file` paths to repo-relative
TU units. It calls `src.mwcc_debug.cache.lookup(repo_root, unit)` to classify
each unique TU as fresh, stale, or missing.

If every current-tools frame-transform TU is fresh, the harvest proceeds
without invoking debug commands. If at least one TU is missing or stale, the
preflight runs `debug dump setup` once via the same runner abstraction harvest
already uses, then runs
`debug dump local <absolute-source-file> --function <first-row-function>` for
each required TU. The absolute path matters because the default harvest runner
executes from `tools/melee-agent`, while `debug dump local` resolves the path
against the melee checkout. The per-TU function argument makes `pcdump_local`
fail early when the dump did not contain the expected function, without
affecting cache identity.

The preflight returns a serializable report:

- `enabled`: whether the preflight hook was active.
- `required_units`: all frame-transform units considered.
- `fresh_units`: units already fresh before preflight.
- `generated_units`: units dumped by this preflight.
- `setup_command`: command and return code when setup ran.
- `dump_commands`: per-TU dump commands, return codes, and short stderr/stdout.

If setup or any dump command exits nonzero, `run_harvest` raises `ValueError`
with a concise message. The CLI already maps harvest `ValueError` exceptions to
exit code 2; stopping here prevents ledgers full of misleading
`harness-exit-nonzero` rows.

## Testing

Unit tests in `tools/melee-agent/tests/test_harvest.py` use a fake cache lookup
and fake runner. Tests cover:

- Missing frame-transform pcdumps run setup once, dump each unique TU once, then
  run the normal harness commands.
- Fresh frame-transform pcdumps skip setup and dump commands.
- Stale pcdumps are refreshed.
- Non-frame-transform harvest rows do not trigger the pcdump preflight.
- The ledger includes the preflight report.
