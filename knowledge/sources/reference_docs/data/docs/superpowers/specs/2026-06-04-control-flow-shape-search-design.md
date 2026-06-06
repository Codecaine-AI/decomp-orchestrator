# Control-Flow Shape Search Design

Issue #378 asks for a source-transform harness for the
`structural-reconstruction` / `branch-or-control-flow-shape` taxonomy bucket.
The current queue points agents at manual inspection (`extract-opseq-xrefs`) even
though many cases are finite branch-shape rewrites already documented in the
mismatch database. This design adds a conservative harness that generates safe
candidate source rewrites, compiles them, scores them with checkdiff/report data,
and lets `melee-agent harvest` apply only true 100% candidates.

## Goals

- Add `melee-agent debug mutate control-flow-shape-search`.
- Register `control-flow-shape-search` as a harvest harness for
  `branch-or-control-flow-shape` rows.
- Generate source candidates for a bounded first library of branch-shape
  rewrites, mostly by reusing existing conservative actuators from
  `generate_lifetime_layout_probes()`:
  - `early-guard-return`;
  - `condition-nesting`;
  - `loop-init`;
  - `loop-counter-type`;
  - `guard-shape`;
  - `call-return-compare-chain`;
  - `pointer-walk-loop` and `pointer-base-call-loop` when their existing
    safety checks accept the function;
  - ternary assignment to if/else;
  - if/else assignment to ternary;
  - boolean condition spelling toggles (`!x`, `x == 0`, `x != 0`, `x`).
- Compile every candidate before scoring, retain generated `.c` files in JSON
  mode, and emit stable blockers when no safe transform is available.
- Keep #375 merge risk small by isolating the transform library from the shared
  harvest adapter registration.

## Non-Goals

- Do not implement a full C refactoring engine.
- Do not rewrite arbitrary loops, arbitrary switches, macro bodies,
  preprocessor regions, or multi-statement unbraced conditionals. The harness
  may reuse existing vetted loop/switch-shaped actuators from
  `pressure_explorer` only when their current safety checks accept the source.
- Do not apply candidates from the debug command directly. `harvest --apply`
  remains the single apply path with rollback and matched-function regression
  checks.
- Do not change name-magic/data-symbol behavior from #375.

## Existing Patterns

The codebase already has the pieces this harness should follow:

- `tools/melee-agent/src/harvest.py` selects a registered harness, runs a JSON
  command, finds an `ok` candidate with a retained `.c` path and 100.0 final
  match percent, then optionally transfers only the requested function body.
- `debug mutate indexed-struct-search` is a close model for JSON shape, probe
  materialization, compile-only validation, real-tree match scoring, stable
  stop conditions, and harvest compatibility.
- `debug mutate frame-transform-search` is a close model for generated source
  retention and real-tree scoring.
- `tools/melee-agent/src/mwcc_debug/pressure_explorer.py` already uses the
  general `LifetimeLayoutProbe` dataclass for source probes outside strict
  lifetime-layout work, and already implements safe control-flow-adjacent
  operators such as `early-guard-return`, `condition-nesting`, `loop-init`,
  `guard-shape`, `call-return-compare-chain`, `pointer-walk-loop`, and
  `pointer-base-call-loop`.
- `src.common.tree_sitter_c` gives a shared parser and function locator, and
  `mwcc_debug.source_spans` gives function-scoped statement spans. Local
  control-flow rewrites must be bounded by AST/statement spans; when the source
  cannot be located or parsed safely, the harness reports a stable blocker
  rather than falling back to unsafe whole-file regex rewrites.

## CLI Contract

Add:

```bash
melee-agent debug mutate control-flow-shape-search \
  -f <function> \
  [--source-file <path>] \
  [--operator <name>]... \
  [--candidate LABEL:OPERATOR=<path>]... \
  [--compile-probes/--no-compile-probes] \
  [--score-match-percent/--no-score-match-percent] \
  [--output-dir <path>] \
  [--max-probes N] \
  [--timeout SECONDS] \
  [--json]
```

Default behavior compiles generated probes and scores retained `.c` candidates
through the same real-tree match-percent path used by existing harnesses. JSON
output retains candidate sources in a generated directory so harvest can consume
the candidate path. Text output prints a compact summary.

The JSON payload has this shape:

```json
{
  "function": "fn_80000000",
  "source": "src/melee/demo.c",
  "generated_source_dir": "/tmp/control-flow-shape-search-...",
  "probe_count": 3,
  "blocker": null,
  "stop_condition": {
    "kind": "validated",
    "blocker": null,
    "reason": "validated candidate found"
  },
  "probes": [
    {
      "label": "control-flow-ternary-to-if-else-0",
      "operator": "ternary-to-if-else",
      "description": "Expand conditional assignment into if/else.",
      "provenance": {
        "kind": "control-flow-shape",
        "source_lines": [12, 12],
        "pattern": "ternary-vs-if-else"
      }
    }
  ],
  "variants": [
    {
      "label": "control-flow-ternary-to-if-else-0",
      "operator": "ternary-to-if-else",
      "status": "ok",
      "path": "/tmp/.../control-flow-ternary-to-if-else-0.c",
      "source_retained": "/tmp/.../control-flow-ternary-to-if-else-0.c",
      "match_percent": 100.0,
      "final_match_percent": 100.0,
      "match_percent_error": null,
      "error": null
    }
  ]
}
```

Stable blockers:

- `source-unavailable`
- `no-control-flow-shape-probes`
- `no-control-flow-shape-candidate`
- `unsupported-control-flow-shape`
- `ambiguous-control-flow-source-region`

## Probe Library

Create `tools/melee-agent/src/mwcc_debug/control_flow_shape.py`.

The module owns the control-flow harness's source scanning and probe selection.
It returns `LifetimeLayoutProbe` instances so the debug command can share
existing materialization and JSON conventions. The module first calls
`generate_lifetime_layout_probes()` with the default control-flow operator set,
then appends its own narrowly-scoped ternary/boolean spelling probes. Local
probes use `list_statement_spans()` and tree-sitter function nodes to bind exact
statement/header ranges before replacing source.

Public functions:

```python
def scan_control_flow_shape_probes(
    source: str,
    function: str,
    *,
    operator_filter: tuple[str, ...] | None = None,
    max_probes: int = 12,
) -> tuple[list[LifetimeLayoutProbe], dict[str, object]]:
    ...

def generate_control_flow_shape_probes(
    source: str,
    function: str,
    *,
    operator_filter: tuple[str, ...] | None = None,
    max_probes: int = 12,
) -> list[LifetimeLayoutProbe]:
    ...
```

The status dict reports `blocker`, `reason`, `supported_candidate_count`, and
`rejected_candidate_count`, mirroring indexed-struct search. When the requested
function cannot be located unambiguously, it reports
`ambiguous-control-flow-source-region`. When no operator can produce a safe
candidate, it reports `no-control-flow-shape-probes`.

Default operator set:

```python
(
    "early-guard-return",
    "condition-nesting",
    "loop-init",
    "loop-counter-type",
    "guard-shape",
    "call-return-compare-chain",
    "pointer-walk-loop",
    "pointer-base-call-loop",
    "ternary-to-if-else",
    "if-else-to-ternary",
    "bool-condition-spelling",
)
```

### `ternary-to-if-else`

Detect expression statements of the form:

```c
lhs = cond ? true_expr : false_expr;
```

Safety rules:

- the statement must be wholly inside the requested function;
- the statement must be an AST `expression_statement` span from
  `list_statement_spans()`;
- not inside a preprocessor directive;
- `lhs`, `cond`, `true_expr`, and `false_expr` must not contain calls, comma
  operators, assignments, increments, decrements, `return`, `goto`, labels, or
  braces;
- the conditional expression must be parenthesis-balanced;
- the whole statement must be a standalone expression statement.

Rewrite:

```c
if (cond) {
    lhs = true_expr;
} else {
    lhs = false_expr;
}
```

### `if-else-to-ternary`

Detect braced if/else statements where both branches contain exactly one
assignment to the same left-hand side and no nested control flow:

```c
if (cond) {
    lhs = true_expr;
} else {
    lhs = false_expr;
}
```

Rewrite:

```c
lhs = cond ? true_expr : false_expr;
```

This operator skips unbraced bodies and branches with declarations, calls with
comma arguments, nested `if`, loops, `switch`, `return`, `break`, `continue`, or
`goto`. The `if` statement must be identified from the parsed function AST, not
by a whole-file regex.

### `bool-condition-spelling`

Generate local spelling alternatives for simple boolean conditions in `if` and
`while` headers:

- `if (!x)` -> `if (x == 0)`
- `if (x == 0)` -> `if (!x)`
- `if (x != 0)` -> `if (x)`
- `if (x)` -> `if (x != 0)`

The condition must be a simple identifier, member access, pointer member access,
array access, or a fully parenthesized form of the same. Calls and assignments
are rejected. Header replacements are made only from parsed `if_statement` or
`while_statement` condition nodes.

### Reused Operators

For `early-guard-return`, `condition-nesting`, `loop-init`,
`loop-counter-type`, `guard-shape`, `call-return-compare-chain`,
`pointer-walk-loop`, and `pointer-base-call-loop`, the new module delegates to
`generate_lifetime_layout_probes()` with an operator filter. These operators
already include project-specific safety checks and provenance. The control-flow
harness does not weaken those checks.

## Harvest Integration

Add `HARNESS_CONTROL_FLOW_SHAPE = "control-flow-shape-search"` to
`src.harvest.REGISTERED_HARNESSES`.

`select_harness()` should choose this harness when:

- `facts.harness`, `headline_tool`, or `next_command` explicitly mentions
  `control-flow-shape-search`; or
- `request.primary == "control-flow-source-shape"`; or
- the row is scoped to structural reconstruction
  (`request.work_bucket == "structural-reconstruction"` or
  `request.primary == "structural-reconstruction"`) and
  `request.subcategory == "branch-or-control-flow-shape"`; or
- the row is scoped to structural reconstruction, has
  `request.subcategory == "branch-or-control-flow-shape"`, and has
  `request.source_actionability == "structural-rebuild"`.

For old queues generated before taxonomy actionability is updated, the
subcategory/source-actionability rules are enough to select the new harness.

The command builder should run:

```python
[
    "debug", "mutate", "control-flow-shape-search",
    "-f", request.function,
    "--source-file", str(request.source_file),
    "--compile-probes",
    "--score-match-percent",
    "--json",
    "--max-probes", str(request.max_probes),
    "--timeout", str(request.timeout),
]
```

The general harvest apply path remains unchanged.

## Taxonomy Integration

Update `describe_actionability()` for
`structural-reconstruction` / `branch-or-control-flow-shape` to emit:

- `source_actionability`: `structural-rebuild`
- `headline_tool`: `control-flow-shape-search`

The actionability text should still describe rebuilding natural branch or loop
structure.

Update `next_command()` for the same bucket/subcategory to emit an executable
source-harness command:

```bash
melee-agent debug mutate control-flow-shape-search -f <function> --source-file src/<file_path> --compile-probes --json
```

This changes future queue generation and manual next steps to route directly to
the new harness while still allowing older queues to select the harness by
subcategory or target-map facts.

## Tests

Add `tools/melee-agent/tests/test_control_flow_shape.py` covering:

- ternary assignment expands to if/else;
- braced if/else assignment collapses to ternary;
- boolean condition spelling probes are generated and skip side-effectful
  calls/assignments;
- delegated `guard-shape` and `early-guard-return` probes still flow through
  the control-flow module when their existing safety checks accept the source;
- existing pressure-explorer operators are delegated through the control-flow
  module when selected by `--operator`;
- local probes reject side-effectful LHS expressions, calls in LHS, assignments,
  `++`/`--`, comma expressions, nested control flow, labels, macros,
  preprocessor regions, comments, strings, and unbalanced delimiters.

Update `tools/melee-agent/tests/test_debug_cli_reorg.py` or a focused CLI test
to cover:

- `debug mutate control-flow-shape-search --help`;
- no-source JSON blocker;
- fake compile/score path emits a retained `.c` candidate.

Update `tools/melee-agent/tests/test_harvest.py` to cover:

- subcategory/source-actionability selection for `branch-or-control-flow-shape`;
- target-map explicit harness selection;
- command construction with `--score-match-percent`;
- stable blocker propagation from the harness JSON.

Update taxonomy tests to expect `control-flow-shape-search` for
`branch-or-control-flow-shape`.

## Verification

Minimum verification before resolving #378:

```bash
cd /Users/mike/code/melee/.claude/worktrees/codex-issue-378-control-flow/tools/melee-agent
python -m pytest tests/test_control_flow_shape.py tests/test_harvest.py -q
python -m pytest tests/test_debug_cli_reorg.py -k control_flow -q
python -m pytest tests/test_function_taxonomy_inventory.py -q
python -m ruff check src/mwcc_debug/control_flow_shape.py src/harvest.py src/cli/debug.py tests/test_control_flow_shape.py tests/test_harvest.py
cd /Users/mike/code/melee/.claude/worktrees/codex-issue-378-control-flow
python -m compileall -q tools/melee-agent/src tools/function_taxonomy_inventory.py
git diff --check
PYTHONPATH=tools/melee-agent python -m src.cli debug mutate control-flow-shape-search --help
PYTHONPATH=tools/melee-agent python -m src.cli harvest structural-reconstruction --limit 0 --json
```

If a real taxonomy queue exists, also smoke:

```bash
PYTHONPATH=tools/melee-agent python -m src.cli harvest structural-reconstruction \
  --min-match 95 --limit 1 --json
```

## Merge Notes

The likely #375 overlap is limited to:

- harness constants and command selection in `tools/melee-agent/src/harvest.py`;
- harvest tests near other harness registration tests;
- taxonomy actionability expectations if #375 also changes
  `tools/function_taxonomy_inventory.py`.

The transform implementation lives in its own module and the CLI command lives
in its own mutate subcommand, so merging after #375 should be mechanical:
preserve both harness constants, both command builders, and both selection
branches.

#375 is expected to add harness-specific whole-file candidate acceptance,
whole-file apply, and `checkdiff --no-name-magic` validation for
`name-magic-source-declarations`. Do not reuse that path for #378. Preserve
#375's name-magic-specific gate and apply logic, while #378 continues to use the
generic harvest candidate contract and function-body-only transfer.
