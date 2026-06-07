# Harvest Driver Design

## Issue

Issue #379 asks for a single `melee-agent harvest <work_bucket>` driver that can sweep function-taxonomy queues, dispatch category harnesses through a common contract, optionally apply validated source transforms, and write a per-function yield ledger. The current workflow has category-specific commands such as `debug mutate frame-transform-search` and `debug mutate lifetime-layout`, but no common sweep loop or common result shape.

## Context

The taxonomy inventory writes queue files under `build/function-taxonomy/queues/*.tsv`. Each actionable queue row includes `match_percent`, `function`, `file_path`, `source_actionability`, `headline_tool`, and `next_command`. Existing harnesses already produce JSON with function name, generated probes, ranked variants, generated source paths, and candidate scores.

## Approaches

1. Build every category harness now.
   This would create first-class harness APIs for data symbols, indexed struct pointers, control-flow rewrites, frame transforms, and register allocation. It overreaches #379 because #375, #376, and #378 are separate harness-building issues. The harvest driver should compose those harnesses as they appear, not implement their source transforms.

2. Shell out to every row's `next_command`.
   This is very flexible and requires little code, but it has no stable contract. The driver would parse arbitrary command lines and terminal output, which would recreate the bespoke orchestration problem at a larger scale.

3. Add a typed harvest orchestrator with registered adapters for validate harnesses.
   This satisfies the stop condition without inventing category transforms. The driver reads queue rows, builds a request from census fields plus adapter-specific facts, selects a registered adapter, runs that harness with JSON output, normalizes the output into a common result contract, writes a ledger, and applies only candidates that are validated as a true 100% match.

Recommended approach: option 3. It creates the common contract requested by #379 while leaving category-specific generation to the category harnesses. The initial implementation supports the existing frame harness and the existing register-allocation search harnesses when their required targets are supplied.

## CLI

Add a top-level Typer app:

```bash
melee-agent harvest <work_bucket> [--apply] [--min-match N] [--limit N] [--taxonomy-dir PATH] [--ledger PATH] [--target-map PATH] [--max-probes N] [--timeout SECONDS] [--json]
```

The command reads `build/function-taxonomy/queues/<work_bucket>.tsv` by default. It processes rows with `match_percent >= --min-match`, stops after `--limit` processed rows when provided, and writes a JSON ledger. Text mode prints a compact summary and the ledger path. `--json` prints the same ledger object to stdout after writing the file.

`--target-map` is a JSON object keyed by function name. It supplies adapter-specific facts that the taxonomy queue cannot currently express, especially register allocator search targets:

```json
{
  "fn_80000000": {
    "harness": "coalesce-search",
    "target": "37=40",
    "class_id": 0
  },
  "fn_80000004": {
    "harness": "select-order-search",
    "target": "43<33",
    "class_id": 1
  }
}
```

## Harness Contract

Each adapter receives a `HarvestRequest`:

```python
function: str
work_bucket: str
match_percent: float
file_path: str
headline_tool: str
source_file: Path | None
primary: str
subcategory: str
source_actionability: str
frame_closability_tier: str
next_command: str
frame_next_command: str
facts: dict
apply: bool
timeout: int
max_probes: int
```

Each adapter returns a `HarvestResult`:

```python
function: str
work_bucket: str
headline_tool: str
status: "applied" | "validated" | "no_match" | "blocked" | "unsupported" | "error"
blocker: str | None
reason: str
command: list[str]
candidate_path: str | None
source_file: str | None
final_match_percent: float | None
applied: bool
details: dict
```

The initial registry supports at least two current harness categories:

- `frame-transform-search`: runs `melee-agent debug mutate frame-transform-search -f <function> --source-file <source> --compile-probes --json`.
- `coalesce-search`: runs `melee-agent debug coalesce-search -f <function> --target <target> --source-file <source> --compile-probes --json` when `facts.target` is supplied.
- `select-order-search`: runs `melee-agent debug select-order-search -f <function> --target <target> --class <class_id> --source-file <source> --compile-probes --json` when `facts.target` is supplied.

Adapter selection uses `facts.harness`, `headline_tool`, `source_actionability`, `frame_closability_tier`, `next_command`, and `frame_next_command`, in that order of specificity. Other tools return `unsupported` with a stable blocker code. That lets future category harnesses for #375, #376, and #378 register without changing the sweep loop.

## Named Blockers

Every non-validated result must include a stable `blocker` code. Initial codes are:

- `unsupported-harness`: no adapter is registered for the row.
- `missing-source-file`: the row's `file_path` cannot be resolved to a repo source file.
- `missing-register-target`: a register adapter was selected without `facts.target`.
- `harness-exit-nonzero`: the harness subprocess failed.
- `harness-invalid-json`: the harness did not emit parseable JSON.
- `no-validated-candidate`: the harness ran, but no candidate scored as a true 100% match.
- `apply-transfer-failed`: the candidate could not be transferred into the target source function.
- `apply-validation-failed`: post-apply validation did not confirm the function stayed matched.

## Validation And Apply

The driver treats a candidate as validated only when a ranked variant has `status == "ok"`, a retained `.c` source path, and a score equal to 100.0 within a small floating tolerance. Score extraction checks top-level `final_match_percent`, top-level `match_percent`, and nested `objective.match_percent` so frame and register harnesses share validation logic.

Dry runs keep the retained source path in the ledger. With `--apply`, the driver resolves the row path against `<repo>/src/<file_path>` first, then `<repo>/<file_path>`. It reads both candidate and target source, extracts the candidate function, replaces only that function in the target file using the existing source-patch helper logic, writes through a temporary file followed by atomic replace, and runs post-apply validation. If post-apply validation fails, it writes back the original target text and returns `apply-validation-failed`. It never applies candidates without an explicit 100% score.

## Error Handling

Missing queue files fail the command. Missing source files produce a per-row `blocked` result rather than aborting the sweep. Unsupported tools produce `unsupported`. Harness subprocess failures produce `error` with captured stderr/stdout snippets. Invalid JSON also produces `error`. These outcomes are written to the ledger so overnight harvests are auditable.

## Yield Ledger

Default path:

```text
build/harvest/<work_bucket>-YYYYMMDD-HHMMSS.json
```

Schema:

```python
work_bucket: str
started_at: str
finished_at: str
apply: bool
min_match: float
limit: int | None
taxonomy_queue: str
target_map: str | None
summary: {
    total_rows: int,
    processed: int,
    by_status: dict[str, int],
    by_harness: dict[str, int],
    by_tier: dict[str, int],
    by_blocker: dict[str, int],
}
results: list[HarvestResult]
```

`by_tier` is keyed by `frame_closability_tier` when present, otherwise `source_actionability`, otherwise `unclassified`.

## Testing

Regression tests should cover queue parsing, adapter registration and unsupported tools, register target-map dispatch, missing register targets, successful validation without apply, successful apply with function-only replacement, rejected non-100 candidates, nested score extraction, ledger summary aggregation, command-level text output, JSON output, and missing queue behavior. Tests should use fake runners and temporary queue/source files, not live MWCC compiles.
