# Harvest Queue Filters Design

## Problem

Small `melee-agent harvest` batches currently use raw taxonomy queue order. That makes source-actionable campaigns noisy: rows that are backend ceilings, generator-gated, diagnostic-only, or meant for unsupported harnesses can consume the whole batch before the rows a campaign is trying to measure. Agents work around this by hand-building filtered TSVs, but those ad hoc files are not repeatable and their filter criteria are not recorded in harvest ledgers.

Issue #394 asks for first-class queue filters so agents can run small, repeatable source-actionable batches such as:

```bash
melee-agent harvest stack-local-layout --where source_actionability=current-tools
melee-agent harvest structural-reconstruction --where headline_tool=control-flow-shape-search
melee-agent harvest structural-reconstruction \
  --exclude-source-actionability backend-ceiling,generator-gated,diagnostic-only
```

## Goals

- Filter taxonomy rows before harness execution and before `--limit` is applied.
- Support repeatable equality filters with `--where FIELD=VALUE`.
- Support repeatable or comma-separated exclusions for `source_actionability`.
- Record active filters in the harvest ledger so filtered ROI can be separated from raw queue noise.
- Preserve existing harvest behavior when no filters are passed.
- Fail early with a clear input error for malformed filters or fields not present in the queue header, even when `--limit 0` or an empty queue would otherwise produce no rows.
- Verify on real generated queue data that excluded rows no longer become `unsupported-harness` blockers in filtered batches.

## Non-Goals

- Do not change harness selection rules.
- Do not add expression languages, inequality filters, regex filters, or OR groups.
- Do not record skipped rows as harvest results; excluded rows should not inflate blocker counts.
- Do not alter `harvest summarize` result counting semantics. It should only process rows in each ledger's `results` array.

## Interface

`melee-agent harvest <work-bucket>` gains:

- `--where FIELD=VALUE`: repeatable. Multiple fields are ANDed. Repeating the same field allows any of that field's values.
- `--exclude-source-actionability VALUE[,VALUE...]`: repeatable. Rows whose `source_actionability` equals any excluded value are skipped.

The internal filter shape is serializable:

```json
{
  "where": {
    "headline_tool": ["control-flow-shape-search"],
    "source_actionability": ["structural-rebuild"]
  },
  "exclude_source_actionability": [
    "backend-ceiling",
    "diagnostic-only",
    "generator-gated"
  ]
}
```

When no filters are active, the ledger stores `"filters": null`.

## Design

Filtering belongs at the queue-loading boundary in `tools/melee-agent/src/harvest.py`. `load_queue_rows` already normalizes TSV rows, applies `--min-match`, and stops at `--limit`. Adding an optional `HarvestFilters` object there keeps all call sites consistent and ensures `--limit` counts rows that would actually be processed.

`HarvestFilters` validates requested fields against the `csv.DictReader.fieldnames` header immediately after the reader is constructed. `where` filters compare stripped raw TSV cell values. Filters on the same field are ORed; filters across different fields are ANDed. `exclude_source_actionability` is a targeted exclusion applied after `where` filters.

`run_harvest`, `_build_ledger`, and `write_ledger` thread the filter object through to ledger metadata. The per-ledger summary remains based on processed results only. Cross-ledger summary adds a lightweight filter rollup so agents can see which ledgers were filtered without changing existing status, harness, blocker, or impact calculations.

`tools/melee-agent/src/cli/harvest.py` parses CLI strings into `HarvestFilters`. Invalid `--where` values and unknown fields raise `ValueError`, which the existing CLI catches as `harvest input error` with exit code 2.

## Test Strategy

- Unit tests for `load_queue_rows` prove `--where` filters include the intended rows, multiple fields AND together, repeated field values OR together, exclusions skip rows before `--limit`, and unknown fields fail before row iteration can bypass validation.
- CLI tests prove `--where` and `--exclude-source-actionability` are parsed and passed to `run_harvest`, and invalid filter syntax exits with an input error.
- Ledger tests prove `write_ledger` records filters and `summarize_harvest_ledgers` reports filtered ledger counts without changing result totals.
- Command-level smoke tests use real taxonomy queue files with `--limit 0` for metadata validation and a small filtered batch to prove excluded source-actionability rows are absent from results and do not produce `unsupported-harness` blockers.
- Existing harvest tests cover the no-filter path and must continue passing.
