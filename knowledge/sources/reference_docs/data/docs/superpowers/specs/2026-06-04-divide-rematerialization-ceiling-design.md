# Divide Rematerialization Ceiling Design

## Goal

Resolve issue #367 by teaching the tooling to recognize the reusable CSE-vs-rematerialization pattern where the target object recomputes a signed magic divide in a branch body, but the current MWCC compile value-numbers the quotient across the condition and value use.

## Context

The reported `gm_1832` digit twins have the same source shape:

```c
if ((val / 100) != 0) {
    HSD_JObjReqAnimAll(jobj, (f32) (val / 100));
}
```

The target assembly keeps the shared `mulhw` result alive and recomputes the quotient sequence in the then-branch. The current compile computes the quotient once before the branch and reuses that quotient in the branch's int-to-float conversion. The mismatch is below register allocation: force-phys and force-iter cannot add the missing arithmetic instructions. Prior source perturbations such as casts and fresh locals were value-numbered back into the current shape.

## Design

Add a small `mwcc_debug.value_numbering` detector that compares:

- expected target asm from the existing `build/GALE01/asm/<unit>.s` / extraction path;
- current pcdump evidence from `BEFORE REGISTER COLORING` when available, falling back to the last pre-coloring pass.

The detector returns a structured finding when both sides show the same reusable class:

- target pattern: a signed magic-divide quotient test (`mulhw`, `srawi`, sign-adjust, `add.`/compare, branch) followed by a later `srawi` from the original `mulhw` result before an `xoris` conversion;
- current pattern: a signed magic-divide quotient test whose quotient register is reused by a later branch-body `xoris`, with no second `srawi` from the same `mulhw` result in that branch body.

The finding is intentionally conservative. If either side lacks evidence, the detector returns `None` and the existing diagnosis stays unchanged. It does not rewrite source and does not claim every CSE difference is unreachable from C. It names this exact observed class as a current-tooling intrinsic value-numbering ceiling: the available C-only source levers already tried for #367 did not break MWCC value numbering, and allocator force tools cannot add the missing arithmetic instructions.

## Output Contract

`debug inspect diagnose --json` gains `value_numbering_ceiling` when the pattern is detected:

```json
{
  "status": "intrinsic-value-numbering-ceiling",
  "kind": "signed-magic-divide-rematerialization",
  "confidence": "high",
  "operator": "signed-magic-divide",
  "source_lever_status": "no-current-C-source-lever",
  "target": {"rematerialized_quotient": true},
  "current": {"cse_quotient_reused": true},
  "recommendation": "bank this as a value-numbering ceiling unless a new semantic source-transform family is added"
}
```

Text diagnosis prints a short `[!] Value-numbering ceiling:` block and the final verdict becomes `INTRINSIC VALUE-NUMBERING CEILING` unless a verified cast or declaration-order win exists. The recommendation explains that allocator forcing is not actionable for this class and that future work should be a semantic source-transform feature request, not manual register search.

`tools/checkdiff.py --format json|summary|compact` also reports the same class from target/current final assembly when the target has the rematerialized quotient sequence and current has the CSE quotient reuse. This gives agents a useful signal even before a pcdump cache exists. The detector must accept both `.fn` target asm and normalized checkdiff lines such as `<fn>:` / `+0d0: opcode operands`; it must not depend on exact branch offsets, relocation labels, or pcdump availability for the checkdiff surface. Checkdiff stores the finding under `classification["value_numbering_ceiling"]`, keeps the existing `primary = "backend-ceiling"` taxonomy, and sets `backend_ceiling.subclass = "cse-vs-rematerialized-divconst"`.

## Tests

Regression tests cover:

- core detector identifies target rematerialization plus current precolor CSE reuse;
- core detector identifies the same class from normalized checkdiff-style target/current asm lines;
- detector abstains when target and current both single-compute the quotient;
- detector abstains when current `xoris` uses a different quotient, the second `srawi` comes from a different `mulhw`, or the divide is an unsigned/non-signed-magic shape;
- detector accepts pcdump-style `add` plus `bt`/`bf` condition tests and abstains when the `xoris` appears in the branch-target successor instead of the fallthrough value-use block;
- `debug inspect diagnose --skip-decl-orders --json` includes `value_numbering_ceiling` and the intrinsic verdict for a synthetic pcdump/asm fixture;
- text diagnosis prints the value-numbering ceiling block and avoids generic "NO FAST TRANSFORM FOUND";
- `checkdiff.classify_asm_diff` classifies the final-asm-only line-count delta as `backend-ceiling` with subclass `cse-vs-rematerialized-divconst`.

## Scope Boundaries

This feature resolves #367 by producing a bankable current-tooling verdict for the reported reusable class, grounded in target rematerialization evidence, current CSE evidence, and the failed source-transform history in the issue report. It does not generate unsafe source rewrites to suppress MWCC value numbering. If future source levers are desired, they should be filed as follow-up work with explicit semantic constraints and candidate verification.
