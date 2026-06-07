# Name-Magic Source Declarations Design

## Issue

Issue #375 asks for a source-declaration harvest harness for the
`data-symbol-relocation` queue. These rows are near byte matches where the
remaining diff is anonymous compiler-emitted data symbols, such as `@N` in
`.sdata2` or `...data.N` section anchors, while the target object references a
named symbol.

Existing tooling can prove the problem:

- `tools/checkdiff.py <function> --no-name-magic` exposes raw anonymous-vs-named
  relocation differences.
- `melee-agent debug util verify-name-magic` lists anonymous `.sdata2` symbols
  and can verify object-level renames.
- `src.mwcc_debug.o_rewriter` maps anonymous `.sdata2` symbols to target named
  symbols by value.

The missing piece is shippable source: generate source declaration/reference
variants, compile and score them without object-level name-magic masking, and
let `melee-agent harvest` apply only validated source candidates.

## Goals

- Add a focused `debug mutate name-magic-source-declarations` harness.
- Generate conservative source variants for direct data-symbol relocation cases.
- Validate every successful candidate with `checkdiff --no-name-magic`.
- Register the harness with `harvest data-symbol-relocation`.
- Preserve declaration edits during apply by using whole-file candidate apply for
  this harness.
- Emit stable blockers for cases that are not safe source transforms yet.

## Non-Goals

- Do not synthesize arbitrary structs or field paths from section-anchor offsets.
- Do not rewrite int-to-float bias casts into manual bias math in the first pass.
- Do not rewrite assert-string macros or include-level HSD assertion behavior.
- Do not modify other harvest harness apply behavior.
- Do not treat object-level name-magic success as source validation.

## Approaches

### Option A: Evidence-only suggestions

Parse `verify-name-magic` and `checkdiff --no-name-magic` evidence and print
source suggestions without compiling or applying. This is low risk, but it does
not satisfy #375 because matching agents still need to hand-edit every function.

### Option B: Conservative source-candidate harness

Generate retained `.c` candidates for the narrow transform set that can be
proved from direct relocation evidence. Compile, score, and validate those
candidates with `checkdiff --no-name-magic`. Teach harvest to apply the whole
retained `.c` file for this harness so declaration edits are preserved.

This is the recommended approach. It has a real apply path, but avoids broad
data-layout inference.

### Option C: Full data-model synthesizer

Infer structs, field offsets, literal pools, bias constants, assert strings, and
all section-anchor uses. This has the highest possible yield, but it is too
risky for a single pass because an incorrect declaration can compile while
silently changing the intended data object.

## Evidence Model

The harness collects evidence from three places:

1. `tools/checkdiff.py <function> --format json --no-name-magic`
2. `tools/checkdiff.py <function> --compact --no-name-magic`
3. the freshly built source `.o` and target `.o` through existing
   `src.mwcc_debug.o_rewriter` helpers

Relocation pairing is intentionally strict. A paired relocation candidate exists
only when the raw `--no-name-magic` diff has expected and current relocation
lines at the same instruction offset. The expected side must reference a named
symbol, and the current side must reference either an anonymous `@N` symbol or a
section-anchor-like symbol such as `...data.N`.

Same-offset pairing is required because nearby relocation lines can differ for
unrelated reasons, especially in functions that also have stack offset or data
layout noise.

Non-relocation hunks in the same raw diff do not automatically block probe
generation. The canonical reproducer also has a stack-offset residual, and a
source declaration change can perturb the local layout. The harness blocks
early only when there are no supported data-symbol relocation pairs to probe.
Final acceptance still requires a true `checkdiff --no-name-magic` match; if
non-relocation residuals remain after all source variants, the result is
`no-name-magic-candidate`.

If more than one expected or current relocation exists at the same instruction
offset, the pair is ambiguous and blocks as `ambiguous-relocation-pair`. If the
relocation kinds are incompatible, the harness blocks as `unsupported-reloc-kind`.
If a section-anchor relocation includes a nonzero addend or offset that would
require synthesizing a field path, the harness blocks as
`unsupported-section-anchor-offset`.

## Supported First-Pass Operators

### `data-symbol-static-to-global`

Use when the expected relocation target is a named data symbol and current
relocation target is a section anchor.

The generator searches the source file for a file-scope definition with the same
name as the expected target, for example:

```c
static u16 mn_803EAE68[] = { ... };
```

It emits a candidate that removes `static`:

```c
u16 mn_803EAE68[] = { ... };
```

Safety rules:

- The definition name must exactly match the expected relocation target.
- The definition must be file-scope, single-name, and non-macro text.
- The change must be whole-file retained source, not function-body-only source.
- The final candidate must compile and match under `checkdiff --no-name-magic`.

### `sdata2-named-float-load`

Use when a paired raw relocation shows anonymous `@N` current side and a named
`.sdata2` expected side, and the anonymous symbol value maps to a 4-byte float
or 8-byte double that can be tied to a specific simple literal source site.

The generator emits variants such as:

```c
extern volatile f32 mn_804DBDA8;
...
HSD_JObjReqAnimAll(jobj, mn_804DBDA8);
```

or an explicit volatile load form when needed:

```c
extern f32 mn_804DBDA8;
...
HSD_JObjReqAnimAll(jobj, *(volatile f32*) &mn_804DBDA8);
```

Safety rules:

- The anonymous symbol must be present in the built source `.o`.
- The expected named symbol must come from the paired relocation, not only from
  duplicate-value lookup.
- The literal replacement site must be exact and unique inside the target
  function or explicitly disambiguated by a generated candidate index.
- Duplicate 4-byte values block unless the same-offset relocation evidence and a
  unique source site remove ambiguity.
- The final candidate must compile and match under `checkdiff --no-name-magic`.

### `name-magic-source-combined`

After individual safe probes are generated, the CLI may emit combined candidates
that apply multiple safe source edits to the same whole source file. Combined
candidates are ranked after individual candidates unless they validate at a
higher match percentage.

The combined operator must not include unsupported or blocker-only evidence.

## Explicit Blockers

The harness exits successfully and reports a stable blocker when it cannot
produce a validated candidate. Blockers include:

- `raw-diff-no-supported-data-symbol-pair`
- `target-object-missing`
- `current-object-missing`
- `ambiguous-sdata2-value`
- `ambiguous-relocation-pair`
- `unsupported-reloc-kind`
- `unsupported-source-site`
- `unsupported-section-anchor-offset`
- `sdata2-pool-order-dependent`
- `declaration-apply-unsupported`
- `no-name-magic-validation-failed`
- `no-name-magic-candidate`

For int-to-float bias evidence such as `s32=` or `u32=`, the first-pass harness
records evidence but reports `unsupported-reloc-kind` unless a safe source
literal/declaration rewrite is also available.

## CLI

Add:

```bash
melee-agent debug mutate name-magic-source-declarations \
  -f <function> \
  [--source-file PATH] \
  [--candidate LABEL:OPERATOR=PATH] \
  [--compile-probes/--no-compile-probes] \
  [--score-match-percent/--no-score-match-percent] \
  [--max-probes N] \
  [--timeout SECONDS] \
  [--json]
```

The CLI resolves the source file from `report.json` when omitted, reads raw
name-magic evidence, generates whole-file `.c` candidates, compiles them, scores
them with real-tree report data, and validates with `checkdiff --no-name-magic`.

Because declaration edits can live outside the target function body, scoring and
validation must not use function-only source transfer. The CLI stages the whole
candidate `.c` file into the real source path under the existing source-scoring
lock, builds the object, runs `checkdiff --no-name-magic`, reads report match
percentage, and restores the original file before returning.

`--score-match-percent` is enabled by default. JSON mode retains generated
source files for harvest.

## JSON Contract

```python
{
    "function": str,
    "source": str | None,
    "generated_source_dir": str | None,
    "evidence": {
        "raw_relocations": list[dict],
        "anonymous_sdata2": list[dict],
        "name_magic_suggestions": list[dict],
    },
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
            "operator": (
                "data-symbol-static-to-global"
                | "sdata2-named-float-load"
                | "name-magic-source-combined"
            ),
            "description": str,
            "provenance": dict,
        }
    ],
    "variants": [
        {
            "label": str,
            "operator": str,
            "status": "ok" | "build-failed" | "failed",
            "path": str,
            "source_retained": str | None,
            "match_percent": float | None,
            "final_match_percent": float | None,
            "match_percent_error": str | None,
            "no_name_magic_match": bool | None,
            "error": str | None,
            "probe": dict | None,
        }
    ],
}
```

A validated result requires:

- at least one variant with `status == "ok"`
- retained `.c` source
- `match_percent == 100.0` or `final_match_percent == 100.0`
- `no_name_magic_match is True`
- `stop_condition.kind == "validated"`
- `blocker is None`

For `blocked` and `unvalidated`, top-level `blocker` and
`stop_condition.blocker` must match.

## Harvest Integration

Register `name-magic-source-declarations` in `src.harvest`.

Select it for normal queue dispatch when:

- the requested harvest work bucket is `data-symbol-relocation`
- `source_actionability == "current-tools-data-symbol"`
- `headline_tool == "checkdiff-name-magic"`
- `subcategory == "persistent-data-symbol-or-relocation"` when present
- `primary` is either the current queue value `data-symbol-or-relocation` or a
  future normalized value `data-symbol-relocation`

An explicit `facts.harness == "name-magic-source-declarations"` may also select
this harness for future generated rows, but it is an override, not a requirement
for the current queue. The live queue does not have a `facts.harness` column.

The adapter command passes:

```bash
debug mutate name-magic-source-declarations \
  -f <function> \
  --source-file <queued source> \
  --compile-probes \
  --score-match-percent \
  --json \
  --max-probes <n> \
  --timeout <seconds>
```

Apply behavior is harness-specific. For this harness only, harvest applies the
whole retained `.c` candidate over the queued source file because declaration
edits can live outside the requested function body. It must snapshot the
original file, validate with `checkdiff --no-name-magic`, and roll back on
validation failure or interruption. Other harnesses keep existing function-only
apply behavior.

Preflight already-matched checks and post-apply validation for this harness must
also use `checkdiff --no-name-magic`; otherwise object-level name-magic can mask
the very source issue #375 is meant to fix.

Harvest must also use a harness-specific candidate acceptance gate. A candidate
from this harness is eligible for apply only when the payload has
`stop_condition.kind == "validated"`, the selected variant has
`no_name_magic_match is True`, the variant is `status == "ok"`, and the retained
source path is a `.c` file with an exact 100% match percent. Generic 100% match
percent alone is not enough for this harness.

## Testing

Unit and CLI tests should cover:

- strict same-offset relocation pairing
- static-to-global generation
- named `.sdata2` float/double declaration variants
- ambiguous duplicate values and unsupported bias blockers
- command help and JSON stable blockers
- candidate ranking by no-name-magic validated match first
- harvest selection for data-symbol queue rows
- harvest command construction
- whole-file apply and rollback for declaration edits
- no-name-magic validation/preflight for the new harness

Command smokes:

```bash
melee-agent debug mutate name-magic-source-declarations --help
melee-agent harvest data-symbol-relocation --limit 0 --json
python tools/checkdiff.py mn_8022DDA8_OnEnter --format json --no-name-magic
```

When local object state makes a real function smoke noisy, the command should
still return a stable blocker rather than a traceback.

## Rollout

1. Add generator/evidence unit tests and implementation.
2. Add CLI JSON tests and implementation.
3. Add harvest selection/apply/no-name-magic validation tests and implementation.
4. Run focused tests and CLI smokes.
5. Commit code plus this spec and the implementation plan.
6. Resolve #375 only after the new harness is committed, verified, and installed.
