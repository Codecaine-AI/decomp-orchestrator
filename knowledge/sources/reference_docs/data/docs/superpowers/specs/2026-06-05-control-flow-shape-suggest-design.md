# Control-Flow Shape Suggest Design

## Problem

`melee-agent debug suggest` has pcdump-backed helpers for frame, casts,
register tiebreaks, coalesces, schedule, and inlines, but it has no suggester
for functions whose dominant mismatch is source-level control-flow shape.
Agents currently hand-diff target ASM against current built ASM, count calls,
and eyeball loop/branch shape before deciding whether to hoist a call, rewrite a
boolean as an explicit branch, use a direct indexed walk, peel or unroll a loop,
or restore a missing call layer.

Issue #402 asks for an ASM-diff-driven command that needs no pcdump cache and
surfaces these source hypotheses with concrete evidence.

## Goals

- Add `melee-agent debug suggest control-flow-shape -f <function>`.
- Read `tools/checkdiff.py <function> --format json` output, either live or from
  `--checkdiff-json`.
- Use only target/current ASM lines plus checkdiff classification metadata.
- Return a ranked list of source-transform hypotheses with evidence and
  follow-up commands.
- Support text output for humans and `--json` output for automation.
- Clip suggestions with `--top`.
- Preserve existing suggesters and mutation search commands.

## Non-Goals

- No pcdump, mwcc-inspector, or debug compiler requirement.
- No CFG alignment engine in this MVP.
- No source patch generation.
- No force-register, force-physical, coalesce, or scheduler knobs.

## Command Contract

```bash
melee-agent debug suggest control-flow-shape -f fn_803ADF90
melee-agent debug suggest control-flow-shape -f fn_803ADF90 --json
melee-agent debug suggest control-flow-shape -f fn_803ADF90 --checkdiff-json /tmp/checkdiff.json
melee-agent debug suggest control-flow-shape -f fn_803ADF90 --top 2 --no-build
```

Options:

- `--function, -f`: required function symbol.
- `--json`: emit JSON instead of text.
- `--checkdiff-json`: read an existing checkdiff JSON file.
- `--checkdiff-timeout`: timeout for live checkdiff.
- `--no-build`: pass `--no-build` to live checkdiff when the caller wants a
  stale but fast current object.
- `--top`: maximum number of ranked suggestions.

Accepted checkdiff JSON is a single object with:

- `target_asm`: required `list[str]`
- `current_asm`: required `list[str]`
- `function`: optional `str`; if present it must match `-f`
- `classification`: optional `dict`

The command exits with code 2 when the JSON is malformed, missing
`target_asm`/`current_asm`, or names a different function than `-f`. It exits
with code 3 for checkdiff execution failures and timeouts. Live checkdiff is
always invoked from the detected Melee repo root with an absolute root path, so
the command behaves the same from the installed entrypoint and from
`tools/melee-agent` tests.

## Analyzer Contract

Create `src/mwcc_debug/suggest_control_flow_shape.py` with:

```python
def analyze_control_flow_shape(
    *,
    function: str,
    target_asm: list[str],
    current_asm: list[str],
    classification: dict | None = None,
    top: int = 5,
) -> dict:
    ...

def render_text(report: dict) -> str:
    ...

def render_json(report: dict) -> str:
    ...
```

The report contains:

- `function`
- `classification`
- `applicability`
- `summary`
- `suggestions`

Each suggestion contains:

- `rank`
- `kind`
- `confidence`
- `recommendation`
- `evidence`
- `follow_up_commands`

`confidence` is a float from 0.0 to 1.0. Ranking is deterministic:
`branch-idiom`, `call-hoist`, `pointer-walk-indexed-shape`,
`loop-peel-unroll`, then `missing-extra-call-layer`; ties sort by descending
confidence and then kind.

## Applicability

The analyzer marks `applicability.is_control_flow_shape` true when any of these
signals are present:

- `classification.primary == "control-flow-source-shape"`
- a classification reason mentions `control-flow-source-shape` or
  `control-flow/source shape`
- classification metadata includes an indexed-struct pointer materialization
  dict
- classification metadata includes an inline-boundary artifact dict

Metadata lookup accepts hyphenated or underscored keys and scans nested
classification dictionaries for:

- `indexed_struct_pointer_materialization`
- `indexed-struct-pointer-materialization`
- `indexed_struct`
- `inline_boundary_artifact`
- `inline-boundary-artifact`
- `inline_boundary`

If a payload is not applicable and the ASM has no transform evidence, the
command still succeeds but reports no suggestions. This avoids turning a helper
into a gatekeeper when checkdiff has already moved the function into another
class handled by existing suggesters.

## Heuristics

The MVP uses small deterministic signals instead of building a CFG.

`call-hoist`: compare call placement around `mtctr`/`bdnz` counted loops and
backward conditional branch loops. If the same helper appears before the target
loop but inside the current loop, rank a call-hoist recommendation. When
multiple calls qualify, prefer the call whose current use is followed by a
compare plus backward loop branch, because that is the strongest trip-count or
loop-condition signal.

`branch-idiom`: detect target explicit compare/branch plus `li 1`/`li 0`, while
current uses boolean-cast instructions such as `subfic`, `cntlzw`, and `srwi`.

`pointer-walk-indexed-shape`: use checkdiff indexed-struct metadata when
available, otherwise look for target indexed/stride addressing while current
materializes element pointers and then dereferences `0(rX)`.

`loop-peel-unroll`: detect repeated short instruction signatures in target or
current ASM that indicate a first-iteration peel or partial unroll should be
tested as a source transform.

`missing-extra-call-layer`: use `inline_boundary_artifact` missing/extra call
metadata and call-count deltas to flag absent or extra helper layers.

## Rendering

Text output starts with:

```text
control-flow-shape suggestions - <function>
classification: <primary>
applicability: <true|false> (...)
```

It then prints ranked suggestions, recommendations, evidence lines, and
follow-up `debug mutate control-flow-shape-search` commands. If no suggestions
exist, it prints `no control-flow-shape suggestions`.

JSON output is stable enough for tests and automation but remains advisory:
confidence values are heuristic scores, not proof of correctness.

Evidence is structured by target/current side whenever the heuristic compares
both sides. Branch evidence includes target branch/li lines and current
boolean-cast lines. Call-hoist evidence includes the call symbol, target/current
placement, loop bounds, target/current call lines, and current compare/backedge
condition lines when present. Pointer-walk evidence includes either normalized
classification metadata or target indexed/stride lines plus current
materialized-pointer lines. Loop evidence includes side, signature, and count.
Call-layer evidence includes missing/extra call lists or target/current call
counts.

## Tests

Core tests cover all five buckets, top clipping, and non-applicable
classification behavior. CLI tests cover help availability, JSON/text output,
malformed payload handling, function mismatch handling, missing ASM handling,
top clipping, and the guarantee that the command does not resolve pcdumps.

## Review Notes

This is intentionally an MVP. The command provides source-actionable hypotheses
with ASM evidence, then points agents to existing mutation search tooling for
testing. A future CFG-aligned recommender can replace or enrich the analyzer
without changing the CLI shape.
