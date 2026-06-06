# Composite Harvest Driver Design

## Issue

Issue #382 asks the harvest driver to compose multiple source-fix harnesses for
one function. The current driver selects one registered harness for a taxonomy
row, runs it, and records one result. That works for single-layer functions, but
composite functions often need several verified fixes in sequence before
`checkdiff` reaches `match=true`.

## Context

`tools/melee-agent/src/harvest.py` already has a stable contract for queue rows,
registered harness adapters, candidate validation, function-only apply, rollback,
and ledger output. The registered adapters are:

- `name-magic-source-declarations`
- `indexed-struct-search`
- `frame-transform-search`
- `coalesce-search`
- `select-order-search`

Separate issues track category-specific harness generation. This issue should
not reimplement unbuilt transforms. It should make the harvest driver able to run
several registered harnesses for the same function when those harnesses are
available, and report an explicit residual blocker when a requested layer has no
registered adapter.

## Approaches

1. Always compose every registered harness for every row.
   This is simple from the command line, but it wastes time and produces many
   predictable blockers. Register-search harnesses require a target, and
   unsupported rows should not pay for every adapter.

2. Add a separate composite-only command.
   This keeps the existing command untouched, but it duplicates queue loading,
   ledger writing, apply, and validation behavior that the current driver already
   centralizes.

3. Add an explicit composition mode to `melee-agent harvest`.
   This keeps default behavior stable while letting agents opt in to composed
   layer fixes. Composition reuses the existing adapter runner and apply
   validation paths, so the new code is an orchestration layer rather than a
   second harvest implementation.

Recommended approach: option 3. It resolves #382 without changing the default
single-harness sweep behavior that current buckets and tests rely on.

## CLI

Extend the existing command:

```bash
melee-agent harvest <work_bucket> --compose [--apply] [--target-map PATH] ...
```

Without `--compose`, behavior stays unchanged. With `--compose`, each queue row
is processed by the composite driver and the ledger stores one top-level result
per function. The top-level result has `harness: "composed"` and a
`details.layers` list containing the individual harness results.

## Target Map

The target map remains a JSON object keyed by function. Composition adds a
`harnesses` key:

```json
{
  "fn_80000000": {
    "harnesses": [
      { "harness": "name-magic-source-declarations" },
      { "harness": "indexed-struct-search" },
      { "harness": "frame-transform-search" },
      { "harness": "coalesce-search", "target": "37=40" }
    ]
  }
}
```

For convenience, string entries are accepted:

```json
{
  "fn_80000000": {
    "harnesses": [
      "indexed-struct-search",
      "frame-transform-search"
    ]
  }
}
```

The driver normalizes both forms to an ordered list of layer facts. Per-layer
facts override the row's base facts only for that layer. If `--compose` is used
without `harnesses`, the driver infers a deduplicated sequence from the current
row signals:

1. `name-magic-source-declarations`, when data-symbol row fields select it.
2. `indexed-struct-search`, when indexed-struct row fields select it.
3. The row-selected harness from `select_harness`.

The driver does not invent register targets. Register layers without `target`
return the existing `missing-register-target` blocker. Requested unregistered
families such as a future control-flow harness return `unsupported-harness` at
that layer.

## Composition Flow

For each function:

1. Run the match checker before a layer. If it reports `match=true`, stop with
   `already-matched`.
2. Run the next layer by forcing `request.facts["harness"]` to that harness and
   using the existing adapter command and JSON normalization.
3. Select a full-match candidate when an adapter emits a retained `.c` candidate
   with exact 100% match. Otherwise, in composition mode only, consider retained
   `.c` candidates in descending harness-reported score order. Each candidate is
   temporarily transferred, checked with strict JSON `checkdiff`, and rolled back
   before the next candidate is tried unless that candidate verifies.
4. A sub-100 candidate verifies as a layer improvement when its strict
   post-transfer `checkdiff --format json` payload shows at least one of:
   the new match percent is greater than the pre-layer match percent, the layer's
   classification signal is gone, or the function is now `match=true`. The first
   candidate in score order that verifies is preserved in apply mode or reported
   in dry-run mode. The before and after JSON payloads are stored in the layer
   details.
5. In dry-run mode, a validated or improving candidate is recorded but not
   applied. Because later layers cannot observe a dry-run source change, the
   composite result stops after the first candidate layer with
   `details.stop_reason: "dry-run-first-candidate-layer"` and records later
   configured layers as `not_observed`.
6. In apply mode, a full-match layer is applied through the existing validation
   path. A verified sub-100 layer is applied through a partial-layer path that
   snapshots the source file, writes each candidate, runs strict JSON checkdiff,
   runs the same-file matched-function regression guard, preserves the first
   candidate that meets the verified-improvement rule, and rolls back every
   rejected candidate. Both paths keep the same-file matched-function regression
   guard.
7. Stop after a layer that returns `blocked`, `error`, `unsupported`, or
   `no_match`. The top-level result uses the same status and blocker so the
   ledger remains easy to scan.
8. After the final applied layer, run the match checker once more. If it reports
   `match=true`, return `already-matched` with
   `details.stop_reason: "matched-after-layers"`. If not, return the final
   applied result with `details.stop_reason: "layer-sequence-exhausted"`.

The top-level result preserves `function`, `work_bucket`, taxonomy fields,
`source_file`, `applied`, and the final layer's candidate path and match percent
when present.

## Strict Classification

Composition uses a strict JSON match checker. Non-JSON stdout is not treated as a
match in composed mode. Each observed layer stores the pre-layer payload, the
post-layer payload when a candidate is applied, and the normalized before/after
classification primary where present.

The first implementation recognizes these layer signals:

- `name-magic-source-declarations`: data-symbol relocation classifications.
- `indexed-struct-search`: indexed-struct pointer materialization
  classifications.
- `frame-transform-search`: stack-frame and stack-slot classifications.
- `coalesce-search` and `select-order-search`: register-allocation
  classifications.

If a layer does not have a known classification signal, score improvement or
`match=true` is required for a sub-100 candidate.

## Error Handling

Composition reuses existing stable blockers:

- `unsupported-harness`
- `missing-source-file`
- `missing-register-target`
- `harness-exit-nonzero`
- `harness-invalid-json`
- `no-validated-candidate`
- `apply-transfer-failed`
- `apply-validation-failed`

The composite driver adds no new blocker unless the harness sequence itself is
empty; in that case it returns `unsupported-harness` with
`reason: "no harness sequence was available for composition"`.

## Ledger

The ledger schema version remains unchanged. A composed row is represented by one
top-level result so existing consumers keep seeing one result per function. The
top-level result uses:

```python
harness = "composed"
details = {
    "layers": [HarvestResult, ...],
    "stop_reason": str,
    "harness_sequence": list[str],
    "not_observed_layers": list[str],
}
```

`summary.by_status` counts the final composed outcome. `summary.by_harness`
counts `"composed"` for composed rows. Detailed per-layer accounting is available
from `details.layers`.

## Testing

Regression tests should cover:

- Default non-compose behavior still runs a single selected harness.
- `--compose` accepts a target-map `harnesses` sequence and runs layers in order.
- The data-symbol row selector maps to `name-magic-source-declarations`.
- Apply-mode composition applies layer one, re-checks, runs layer two, and stops
  when the match checker reports `match=true`.
- Dry-run composition stops after the first validated layer because later layers
  cannot observe unapplied source changes.
- A sub-100 candidate with improved strict JSON match percent is preserved as a
  verified layer improvement.
- A sub-100 candidate with no strict JSON improvement is rolled back and reported
  as `apply-validation-failed`.
- A requested future harness such as `control-flow-search` returns
  `unsupported-harness` at both layer and top level.
- A register layer without `target` returns `missing-register-target` in the
  layer and top-level result.
- CLI `--compose` writes a parseable ledger and passes the flag through to
  `run_harvest`.

Tests should use fake runners, temporary source files, and fake match checkers.
They should not run live MWCC compiles.
