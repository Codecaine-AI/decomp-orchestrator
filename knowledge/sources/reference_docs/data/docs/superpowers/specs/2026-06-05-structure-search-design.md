# Structure Search Design

## Problem

Issue #416 reports a recurring Melee matching failure mode: agents bank
functions as backend/register ceilings before trying source-structure changes
that are legal C and measurable. The campaign examples include switch case
order, declaration order, branch idiom, loop/source shape, statement hoists, and
inline boundaries. Existing tools cover pieces of this space, but there is no
single command that runs the source-structure axes, ranks measured outcomes, and
produces candidate source paths or exact reproduction commands.

The highest-signal motivating example is `hsd_803AAA48`, where reordering
switch cases to the target's physical block order moved the match from roughly
28.6% to 77.6%. An MVP that only discovers existing decl-order and
control-flow-shape searches would improve ergonomics but would not address the
headline case-order failure.

## Goals

- Add `melee-agent debug search structure -f <function>`.
- Orchestrate and normalize three source-structure axes:
  - existing `debug mutate decl-orders --strategy all --json`;
  - existing `debug mutate control-flow-shape-search --json`;
  - a new conservative `case-order` source probe generator.
- Rank all measured variants by exact-match status, match percent, delta from
  baseline, status, and label.
- Emit JSON and text output with stable candidate fields, exact rerun commands,
  and retained source paths when available.
- Keep the command read-only for the working tree. It may generate candidate
  `.c` files under an output directory, but it must not leave source mutations
  applied.
- Make unsupported future axes explicit in the payload so callers know the stop
  condition is "not searched yet" rather than "proved impossible".

## Non-Goals

- Do not build a general C refactoring engine.
- Do not implement statement-order, inline-boundary, arbitrary loop-shape, or
  helper inline/outline transforms in this MVP.
- Do not apply a winning candidate. Existing review/apply flows remain
  separate.
- Do not replace decomp-permuter or the existing fast-search scheduler.
- Do not try unsafe switch rewrites involving fallthrough, labels/gotos crossing
  arms, preprocessor directives inside arms, nested switch ambiguity, or
  multi-label case groups that cannot be moved as a unit.

## Alternatives

### Recommended: Orchestrator Plus Minimal Case-Order

Create `debug search structure` under the existing `debug search` namespace.
The command calls existing axes through injectable runner functions, adds a
small case-order generator, normalizes all results, and ranks them. This is the
smallest design that addresses #416's main example and gives agents one command
to run before claiming a backend ceiling.

### Rejected: Orchestrator Only

Running only decl-order and control-flow-shape-search would reuse existing
tooling quickly, but it would miss switch case order. Independent review
confirmed that closing #416 without a case-order axis would overstate the fix.

### Deferred: Full Structure Permuter

A full search engine covering case order, statement order, loop-shape families,
inline-boundary toggles, helper outlining, and branch idiom synthesis would be
valuable, but it needs a broader source-analysis/refactoring design. The MVP
keeps those as future axes with explicit payload entries.

## Architecture

Add a focused structure-search module under `src/search/structure.py`.

Responsibilities:

- represent normalized axis results as dataclasses;
- parse/normalize decl-order JSON payloads;
- parse/normalize control-flow-shape-search JSON payloads;
- generate bounded case-order source probes;
- score/rank normalized candidates;
- render JSON-compatible payloads.

Add CLI wiring in `src/search/cli.py` because `debug search` already mounts
that Typer app. Keep `src/cli/debug.py` unchanged except for any shared helper
import that proves unavoidable.

The CLI uses thin runner callables:

- `run_decl_order_axis(function, options)`;
- `run_control_flow_axis(function, options)`;
- `run_case_order_axis(function, source_path, options)`.

Tests can inject fake runners for orchestration/ranking and exercise the real
case-order generator separately.

## CLI Contract

```bash
melee-agent debug search structure \
  -f <function> \
  [--source-file <source.c>] \
  [--axis decl-order] [--axis control-flow] [--axis case-order] \
  [--output-dir build/structure-search/<function>] \
  [--max-candidates N] \
  [--timeout SECONDS] \
  [--json]
```

Defaults:

- axes: `decl-order`, `control-flow`, `case-order`;
- `--max-candidates`: 24 total retained candidates across axes;
- `--timeout`: forwarded to child scoring commands;
- output directory: temporary directory unless `--output-dir` is supplied;
- read-only working tree behavior.

Stable blockers:

- `source-unavailable`;
- `axis-disabled`;
- `axis-command-failed`;
- `axis-timeout`;
- `no-decl-order-candidates`;
- `no-control-flow-shape-probes`;
- `no-case-order-probes`;
- `unsafe-switch-fallthrough`;
- `unsafe-switch-preprocessor`;
- `unsafe-switch-cross-label`;
- `unsafe-switch-nested-ambiguous`;

## JSON Contract

The payload shape:

```json
{
  "function": "hsd_803AAA48",
  "source": "src/melee/hsd/hsd_3AA7.c",
  "generated_source_dir": "/tmp/structure-search-hsd_803AAA48",
  "baseline_percent": 28.6,
  "axes": [
    {"axis": "decl-order", "status": "evaluated", "candidate_count": 4},
    {"axis": "control-flow", "status": "blocked", "blocker": "no-control-flow-shape-probes"},
    {"axis": "case-order", "status": "evaluated", "candidate_count": 12}
  ],
  "variants": [
    {
      "axis": "case-order",
      "operator": "case-order-adjacent-swap",
      "label": "case-order-swap-3-4",
      "status": "ok",
      "path": "/tmp/structure-search-hsd_803AAA48/case-order-swap-3-4.c",
      "source_retained": "/tmp/structure-search-hsd_803AAA48/case-order-swap-3-4.c",
      "baseline_percent": 28.6,
      "match_percent": 77.6,
      "final_match_percent": 77.6,
      "delta": 49.0,
      "command": "melee-agent debug search structure -f hsd_803AAA48 --axis case-order --max-candidates 24",
      "apply_hint": "review candidate source, then transfer verified function body",
      "metadata": {
        "switch_line": 120,
        "strategy": "adjacent-swap",
        "case_order": ["0", "5", "11"]
      }
    }
  ],
  "future_axes": [
    {"axis": "statement-order", "status": "not-implemented"},
    {"axis": "inline-boundary", "status": "not-implemented"},
    {"axis": "loop-shape-expanded", "status": "not-implemented"}
  ],
  "stop_condition": {
    "kind": "improved",
    "blocker": null,
    "reason": "one or more structure variants improved over baseline"
  }
}
```

`variants` is sorted by:

1. exact match candidates first;
2. higher `final_match_percent` / `match_percent`;
3. higher `delta`;
4. `ok` before non-ok statuses;
5. deterministic `axis`, `operator`, `label`.

If no axis improves over baseline, the command still succeeds with
`stop_condition.kind == "no-improvement"` and lists axis blockers. This is the
evidence agents need before banking a backend ceiling.

## Case-Order Axis

Implement case-order helpers inside `src/search/structure.py`. The helpers find
one switch at a time inside the requested function and generate source variants
by reordering whole case arms.

Safety rules:

- operate only inside the requested function body;
- consider top-level switch arms only;
- move a case arm only when it ends with `break`, `return`, `goto`, or another
  terminal statement before the next arm;
- reject any arm with comment text that looks like fallthrough intent;
- reject preprocessor directives between the switch open and close braces;
- reject labels or `goto` targets that could cross arm boundaries;
- reject nested switch bodies for this MVP;
- treat grouped labels as one arm and move them together;
- never edit the working tree directly.

Bounded strategies:

- `adjacent-swap`: swap each adjacent pair of movable arms;
- `promote`: move each arm to the first position;
- `demote`: move each arm to the last position;
- `physical-order` is a future strategy that can consume checkdiff/ASM block
  evidence once available.

Full permutation is intentionally omitted from the default MVP. It can be added
later behind a small-switch-only option if the bounded strategies prove useful.

Each generated case-order probe writes a retained `.c` source file and includes
metadata with the source line range, original labels, new labels, and strategy.

## Existing Axis Normalization

### Decl Order

Run the existing decl-order command with JSON:

```bash
melee-agent debug mutate decl-orders <function> --strategy all --json
```

Normalize each result row when possible. If the existing command does not
retain candidate sources, the structure-search result must still emit:

- `axis = "decl-order"`;
- `operator = "decl-order-<strategy>"`;
- `delta`;
- `match_percent`;
- an exact rerun command, including `--keep-best` only as an apply hint, not
  as a default action.

### Control Flow

Run:

```bash
melee-agent debug mutate control-flow-shape-search -f <function> --json
```

Normalize `variants[*]` directly, preserving `source_retained`,
`final_match_percent`, `match_percent_error`, and `probe` metadata.

## Text Output

Text output is compact:

```text
structure search - hsd_803AAA48
source: src/melee/hsd/hsd_3AA7.c
baseline: 28.60000
axes: decl-order=evaluated(3), control-flow=blocked(no-control-flow-shape-probes), case-order=evaluated(12)

Top variants:
1. case-order / case-order-adjacent-swap / case-order-swap-3-4
   match: 77.60000 delta: +49.00000
   source: /tmp/structure-search-hsd_803AAA48/case-order-swap-3-4.c
   command: melee-agent debug search structure -f hsd_803AAA48 --axis case-order --max-candidates 24
```

When nothing improves, the final line explicitly says:

```text
No structure-search axis improved the baseline. Backend ceiling claims are now better supported.
```

## Error Handling

- Child command failures become axis blockers instead of crashing the entire
  search.
- Timeouts become `axis-timeout` with stdout/stderr tails.
- Malformed child JSON becomes `axis-command-failed`.
- Candidate generation failures include the axis and source range when known.
- The command exits nonzero only for invalid CLI input, missing source when no
  candidate-only axis is selected, or internal invariant violations.

## Tests

Unit tests:

- split a safe switch into movable case arms;
- reject fallthrough/preprocessor/nested-switch/cross-label cases;
- generate adjacent-swap/promote/demote case-order candidates with retained
  source text;
- normalize fake decl-order and control-flow payloads;
- rank variants deterministically by match/delta/status/label.

CLI tests:

- `debug search structure --help`;
- JSON smoke with fake runners for decl-order/control-flow/case-order;
- blocker propagation from no decls, no control-flow probes, and unsafe switch;
- working-tree source restoration/no mutation after failed or no-win runs;
- text output includes top ranked variant and exact rerun command.

Command smokes:

- `melee-agent debug search structure --help`;
- `melee-agent debug search structure -f <known function> --axis case-order --max-candidates 1 --json --output-dir <tmp>` on a controlled fixture or mocked test path.

## Review Result

Independent Codex review recommended the orchestrator MVP but required a
minimal case-order axis before resolving #416. The design incorporates that
requirement and defers statement-order/inline-boundary to explicit future axes.
