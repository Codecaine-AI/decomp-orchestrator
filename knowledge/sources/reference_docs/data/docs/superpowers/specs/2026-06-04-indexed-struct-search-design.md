# Indexed Struct Search Design

## Issue

Issue #376 asks for a source-transform harness for the
`indexed-struct-pointer-materialization` taxonomy class. These functions differ
because current source materializes a live element pointer, then accesses fields
through that pointer, while the target code keeps the array/base expression and
uses indexed or base-plus-offset loads and stores directly.

The existing `tools/checkdiff.py` already detects this class and reports an
`indexed_struct_pointer_materialization` diagnostic. The missing piece is a
harness that turns the diagnostic into source candidates, compiles and scores
those candidates, and exposes a JSON contract that the new `melee-agent harvest`
driver can sweep.

## Context

The function taxonomy queue lives at:

```text
build/function-taxonomy/queues/indexed-struct-pointer.tsv
```

Rows use `primary=indexed-struct-pointer-materialization`,
`source_actionability=current-tools-indexed-pointer`, and
`headline_tool=source-shape`. The current harvest adapter selection does not
recognize these rows, so #376 needs both the category harness and harvest
registration.

Existing nearby patterns:

- `tools/checkdiff.py` classifies the target/current asm shape.
- `src.mwcc_debug.pressure_explorer` owns `LifetimeLayoutProbe` and existing
  source-shape probe generators.
- `debug mutate frame-transform-search` compiles generated source probes,
  scores real-tree match percent, retains generated `.c` files in JSON mode,
  and emits variants that `melee-agent harvest` can normalize.

## Approaches

1. Full C AST rewrite for every materialized pointer shape.
   This could eventually cover all 46 rows, but it would require a larger
   parser-aware refactor and broad alias analysis. It is too risky for the first
   harness because incorrect rewrites can duplicate side effects or change
   pointer lifetime semantics.

2. Add the indexed transform into `generate_lifetime_layout_probes`.
   This would reuse existing search commands immediately, but it would feed a
   targeted dematerialization into unrelated frame/register searches. That makes
   those commands noisier and harder to reason about.

3. Build a focused conservative harness and register it with harvest.
   Add a dedicated probe generator and a `debug mutate indexed-struct-search`
   command. The generator only handles obvious side-effect-free materialized
   element pointers. The command compiles and scores candidates, reports stable
   blockers for unsafe cases, and leaves broader transformations to future
   work.

Recommended approach: option 3. It satisfies #376's stop condition for the
mechanically safe subset, gives harvest a real category adapter, and avoids
shipping speculative C rewrites.

## Source Transform Scope

The first pass supports single-line pointer initializers inside the target
function:

```c
Type* p = &base[index];
Type* p = base + index;
Type* p = &base[index][subindex];
```

The probe rewrites field accesses from:

```c
p->field
(*p).field
```

to direct expressions such as:

```c
base[index].field
(base + index)->field
base[index][subindex].field
```

Replacement is determined by the initializer form, not by the access spelling:

- For `Type* p = &base[index];` and `Type* p = &base[index][subindex];`,
  both `p->field` and `(*p).field` become direct struct-value access such as
  `base[index].field` or `base[index][subindex].field`.
- For `Type* p = base + index;`, both `p->field` and `(*p).field` become
  pointer access through the original pointer expression, such as
  `(base + index)->field`.

If the pointer declaration has an initializer and the first field access is a
read used to seed a variable, the generator may emit a "split first field"
variant that keeps that first field in a scalar local and rewrites later field
uses. This matches the guidance emitted by `checkdiff.py`.

The first pass deliberately does not support `&base[index].owner`, nested owner
field pointer declarations, assignments that build the pointer over multiple
statements, macro-expanded regions, or transformations that require evaluating
the base/index expression more than once when it is not syntactically
side-effect-free.

## Safety Rules

A materialized pointer candidate is safe only when all of these are true:

- The initializer expression is one of the supported forms.
- The base, index, and subindex expressions contain no calls, assignments,
  increments, decrements, comma operators, or obvious macro directives in the
  affected text.
- The pointer variable is not reassigned.
- The pointer variable is not passed as a call argument.
- The pointer variable is not compared, incremented, decremented, indexed, cast,
  address-taken, returned, or used in arithmetic after initialization.
- Every later use in the rewrite region is `p->field` or `(*p).field`.
- The rewrite stays within the target function body.

Unsafe candidates are not emitted. The harness exits successfully and returns a
stable blocker instead of treating the absence of candidates as a command
failure.

## CLI

Add:

```bash
melee-agent debug mutate indexed-struct-search \
  -f <function> \
  [--source-file PATH] \
  [--candidate LABEL:OPERATOR=PATH] \
  [--compile-probes/--no-compile-probes] \
  [--score-match-percent/--no-score-match-percent] \
  [--max-probes N] \
  [--timeout SECONDS] \
  [--json]
```

The command resolves the source file from the repo when `--source-file` is
omitted. It generates indexed-struct probes, optionally compiles them, optionally
scores real-tree match percent, ranks results by validated match percent first,
and prints JSON when `--json` is set.

`--score-match-percent` is enabled by default. The harvest adapter still passes
it explicitly so the validation path is obvious at the call site.

Non-JSON output is a compact summary for humans. JSON output is the stable
contract for `melee-agent harvest`.

## JSON Contract

Successful command output has this shape:

```python
{
    "function": str,
    "source": str | None,
    "generated_source_dir": str | None,
    "probe_count": int,
    "blocker": str | None,
    "stop_condition": {
        "kind": "validated" | "blocked" | "unvalidated",
        "blocker": str | None,
        "reason": str,
    },
    "probes": [
        {
            "label": str,
            "operator": "indexed-struct-pointer",
            "description": str,
            "provenance": {
                "kind": "indexed-struct-pointer",
                "diagnostic": "indexed_struct_pointer_materialization",
                "pointer": str,
                "source_lines": [int, int],
                "declaration": str,
                "base_expression": str,
                "index_expression": str,
                "direct_expression": str,
                "field_uses": [
                    {
                        "field": str,
                        "source_lines": [int, int],
                        "syntax": "arrow" | "deref-dot",
                    }
                ],
                "split_first_field": bool,
            },
        }
    ],
    "variants": [
        {
            "label": str,
            "operator": "indexed-struct-pointer",
            "status": "ok" | "build-failed" | "failed",
            "path": str,
            "source_retained": str | None,
            "match_percent": float | None,
            "final_match_percent": float | None,
            "match_percent_error": str | None,
            "error": str | None,
            "probe": dict | None,
        }
    ],
}
```

Stable blockers:

- `no-safe-materialized-pointer`: the source scan found one or more supported
  materialized pointer initializer shapes associated with the indexed-struct
  class, but every candidate was rejected by the safety rules.
- `indexed-struct-hint-unavailable`: checkdiff did not emit an
  `indexed_struct_pointer_materialization` diagnostic, or the source scan could
  not find any syntactically supported materialized pointer initializer shape to
  associate with that diagnostic.
- `no-indexed-struct-candidate`: candidates existed, but none reached a true
  100% match.
- `source-unavailable`: no source file could be found for the function.

`blocker` and `stop_condition.blocker` must match whenever the stop condition is
`blocked` or `unvalidated`. For `validated`, both blocker fields are `None` and
at least one variant has `status == "ok"`, a retained `.c` source path, and
`match_percent == 100.0` or `final_match_percent == 100.0`.

The command exits `0` for all stable search outcomes, including blockers. It
exits nonzero only for usage errors or unexpected internal failures.

## Harvest Integration

Add `indexed-struct-search` to the harvest harness registry. Adapter selection
must choose it when any of these are true:

- `facts.harness == "indexed-struct-search"`
- `primary == "indexed-struct-pointer-materialization"`
- `source_actionability == "current-tools-indexed-pointer"`
- a queue command or tool text mentions `indexed-struct-search`

The adapter command is:

```bash
melee-agent debug mutate indexed-struct-search \
  -f <function> \
  --source-file <source> \
  --compile-probes \
  --score-match-percent \
  --json \
  --max-probes <max_probes> \
  --timeout <timeout>
```

Harvest should propagate harness-emitted stable blockers into the ledger when no
validated 100% candidate exists. A true 100% retained `.c` candidate follows the
existing `harvest --apply` function-only replacement and post-apply validation
flow.

Apply acceptance criteria:

- `harvest indexed-struct-pointer --apply` applies only candidates with an
  explicit retained `.c` path and an exact 100% score.
- Apply replaces only the requested function body in the target source file.
- Sibling functions and file-local declarations outside the target function stay
  byte-identical.
- Post-apply validation runs `tools/checkdiff.py <function> --compact`.
- If validation fails or is interrupted, the original source file is restored
  and the ledger records `apply-validation-failed`.
- The issue is resolved only after a dry-run validated candidate path and the
  apply/rollback path are covered by tests; a live apply is not required unless
  a safe real queue candidate reaches 100% during validation.

## Testing

Focused tests should cover:

- Probe generation for `Type* p = &base[index];` with multiple `p->field` uses.
- Probe generation for `Type* p = base + index;` with `(*p).field` uses.
- Safety rejection for call arguments, reassignment, increments, comparisons,
  address escape, indexed pointer uses, and side-effectful index expressions.
- CLI JSON shape for no-source, no-candidate, generated-probe, candidate-build,
  and real-score paths using fake compile/scoring hooks.
- Harvest selection from `primary` and `source_actionability`.
- Harvest command construction for `indexed-struct-search`.
- Harvest blocker propagation from harness JSON.
- Harvest apply with an indexed-struct retained 100% candidate replacing only
  the target function.
- Harvest rollback when post-apply validation fails.
- Existing frame/register harvest behavior remains unchanged.

Command-level smoke checks should include:

```bash
python -m src.cli debug mutate indexed-struct-search --help
melee-agent debug mutate indexed-struct-search --help
melee-agent harvest indexed-struct-pointer --limit 0 --json
```

If a real queue row produces a safe candidate during validation, run it without
`--apply` and inspect the retained candidate path and JSON. If no current row
falls inside the conservative subset, that is an acceptable blocker outcome for
the first pass as long as the harness reports `no-safe-materialized-pointer`
instead of failing.
