# Harvest Preview Design

## Problem

Filtered `melee-agent harvest` campaigns can silently go stale when taxonomy labels
change. Issue #399 describes two real cases: a structural reconstruction campaign
filtered for the old `headline_tool=control-flow-shape-search` label and a
stack-local-layout campaign filtered for the old
`source_actionability=source-probe` label. Both matched zero rows and wrote empty
ledgers, forcing agents to use ad hoc CSV histograms before each run.

`--limit 0` is not a usable preview because it stops the loader before row
selection, reports `processed=0/total_rows=0`, and hides the current values that
would help an agent repair stale filters.

## Goals

- Add a no-probe preview mode for `melee-agent harvest <bucket>` that reads the
  taxonomy queue and does not run harnesses, pcdump preflight, validators, or
  ledger writes.
- Report queue size, rows surviving `--min-match`, rows matching active filters,
  and rows that would be processed after `--limit`.
- Report top values for key taxonomy fields so label drift is visible.
- When filters match zero rows, report near-miss facet values with each
  `--where` field relaxed individually so the stale field is easy to identify.
- Report the first N matching functions with command context and inferred
  harness when available.
- Keep preview JSON machine-readable and text output scan-friendly.
- Make filtered non-preview harvests fail fast when filters match zero rows,
  before pcdump preflight, harness execution, or ledger creation.
- Preserve existing unfiltered harvest behavior, including empty unfiltered
  queues and explicit `--limit 0` smoke checks.

## Non-Goals

- Do not add a separate `harvest inspect` subcommand.
- Do not add a general expression language, regex matching, inequality filters,
  or arbitrary facet selection.
- Do not change harness selection, taxonomy generation, ledger summary
  semantics, or `harvest summarize`.
- Do not include skipped rows in ledgers.

## Interface

`melee-agent harvest <work-bucket>` gains:

- `--preview`: print queue selection diagnostics and exit without writing a
  ledger or running any harness path.
- `--preview-sample N`: number of matching rows to show in preview output;
  default 10.

Existing options are honored for preview where they affect selection:

- `--taxonomy-dir`
- `--target-map`
- `--min-match`
- `--limit`
- `--where`
- `--exclude-source-actionability`
- `--json`

Options that only affect execution, such as `--apply`, `--compose`,
`--max-probes`, and `--timeout`, are accepted for CLI compatibility but do not
trigger execution in preview mode.

Preview JSON shape:

```json
{
  "schema_version": 1,
  "work_bucket": "structural-reconstruction",
  "taxonomy_queue": ".../structural-reconstruction.tsv",
  "target_map": null,
  "min_match": 0.0,
  "limit": 25,
  "filters": {
    "where": {
      "source_actionability": ["structural-rebuild"]
    }
  },
  "counts": {
    "queue_rows": 250,
    "eligible_rows": 240,
    "matching_rows": 213,
    "would_process_rows": 25
  },
  "facets": {
    "headline_tool": [
      {"value": "extract-opseq-xrefs", "count": 213}
    ],
    "source_actionability": [
      {"value": "structural-rebuild", "count": 213}
    ]
  },
  "near_miss_facets": {
    "headline_tool": [
      {"value": "extract-opseq-xrefs", "count": 213}
    ]
  },
  "sample": [
    {
      "function": "gm_801BE638",
      "match_percent": 92.7,
      "file_path": "melee/gm/gm_unsplit.c",
      "primary": "control-flow-source-shape",
      "source_actionability": "structural-rebuild",
      "headline_tool": "extract-opseq-xrefs",
      "harness": "control-flow-shape-search",
      "next_command": "..."
    }
  ]
}
```

Text output prints the same facts in a compact form:

```text
preview: structural-reconstruction
queue: build/function-taxonomy/queues/structural-reconstruction.tsv
rows: queue=250 eligible=240 matching=213 would_process=25
filters: where source_actionability=structural-rebuild
facets:
  headline_tool: extract-opseq-xrefs=213
sample:
  gm_801BE638 92.7% harness=control-flow-shape-search headline_tool=extract-opseq-xrefs next_command=...
```

If active filters match zero rows, preview exits 0 and prints the zero count plus
near-miss facets from the eligible queue. A non-preview filtered harvest with the
same selection exits 2 with a `harvest input error:` message and writes no
ledger.

## Design

Preview belongs beside the queue loader in
`tools/melee-agent/src/harvest.py`, not in the CLI. A new
`preview_harvest_queue` function performs one TSV pass, reusing
`_validate_filter_fields`, `_row_matches_filters`, `_float_or_none`, and
`select_harness`.

The preview pass counts rows in three stages:

1. `queue_rows`: rows with a non-empty `function` column.
2. `eligible_rows`: queue rows whose `match_percent` is at least `--min-match`.
3. `matching_rows`: eligible rows that pass `HarvestFilters`.

`would_process_rows` applies `--limit` to `matching_rows` without truncating the
facet counts. This is the key difference from `load_queue_rows`, whose job is to
return only executable requests and therefore stops at `--limit`.

Facets are computed from matching rows when at least one row matches. When active
filters match zero rows, facets fall back to eligible rows so agents can see the
current taxonomy labels that replaced their stale criteria. In addition,
`near_miss_facets` is computed for each active `--where` field by reapplying all
other active filters and relaxing only that field. For the stale structural
example, relaxing `headline_tool=control-flow-shape-search` while keeping
`source_actionability=structural-rebuild` exposes the current
`extract-opseq-xrefs` value directly. Blank facet values are omitted. Facets are
sorted by descending count, then ascending value for deterministic ties.

Samples are the first matching rows after `--min-match` and filters. A target map
is loaded when provided so explicit harness overrides remain visible in the
sample's inferred `harness` field. Preview resolves source paths for parity with
`load_queue_rows`, but it does not read or compile source files.

`run_harvest` performs the zero-match guard before pcdump preflight and before
ledger creation when active filters are present. The CLI parses filters exactly
once, then branches before allocating a default ledger path. In preview mode it
calls `preview_harvest_queue` and prints text or JSON. In normal mode it relies
on the core guard; this keeps direct Python callers from writing empty filtered
ledgers too. The guard is limited to active filters to avoid changing existing
unfiltered smoke behavior.

## Test Strategy

- Unit test `preview_harvest_queue` with `--min-match`, filters, and `--limit` to
  prove preview counts all matching rows before limit, computes facets, and
  samples the expected functions.
- Unit test zero-match filtered preview to prove it reports current eligible
  facets and per-field near-miss facets instead of returning an empty diagnostic.
- CLI test `--preview --json` to prove it prints preview JSON, does not call
  `run_harvest`, and does not create a default ledger.
- CLI text test to prove the sample includes function, harness, headline tool,
  and next command context.
- Core test filtered non-preview zero rows to prove `run_harvest` raises before
  pcdump preflight, harness execution, or ledger creation.
- CLI test filtered non-preview zero rows to prove it exits 2 and writes no
  explicit ledger.
- Existing harvest filter, ledger, pcdump, and harness tests must continue to
  pass.
