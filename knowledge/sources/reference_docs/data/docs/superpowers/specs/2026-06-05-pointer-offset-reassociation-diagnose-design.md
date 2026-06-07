# Pointer-Offset Reassociation Diagnose Design

## Context

Issue #417 reports a recurring MWCC address-lowering mismatch in
`hsd_3AA7.c`: source expressions such as `state->x0 + hdr_offset + 0x20`
can lower as `addi hdr_offset,0x20` followed by `add base,...`, while retail
uses `add base,hdr_offset` followed by `addi ...,0x20`. Manual expression
spelling did not produce a source win for `fn_803ACFC0`, and generic diagnose
currently reports only `NO FAST TRANSFORM FOUND`.

## Design

Add a conservative `debug inspect diagnose` hint named
`pointer_offset_reassociation`. The hint is diagnostic-only: it does not claim a
verified win, and it does not change higher-priority verdicts.

The detector reports only when all three signals are present for the target
function:

1. Source span evidence: the target function contains a pointer argument site
   with a variable offset plus a constant.
2. Expected asm evidence: the expected function body contains a split-address
   sequence for the same constant and call consumer, `add base,var` followed by
   `addi ...,const`.
3. Current pcdump evidence: the current compiler dump contains the folded
   sequence for the same constant and call consumer, `addi var,const` followed
   by `add base,...`.

Only matched call sites are listed. The initial supported consumers are calls
that already appear in the issue evidence: `memcpy`, `memset`, and
`fn_803AC3F8`. Byte stores such as `[0x10]`, `[0x11]`, and `[0x12]` are not
reported by this feature because they are not the #417 root cause.

## Output

JSON adds:

- `kind: "pointer-offset-constant-reassociation"`
- `source_lever_status: "expression-spelling-alone-not-actionable-from-current-diagnose"`
- `sites[]` with source expression, constant, consumer, source line, expected
  shape, and current shape
- `recommendations[]` with conservative next steps

Text output prints a `[!] Pointer-offset reassociation:` block. Recommendations
are prepended only for the generic `NO FAST TRANSFORM FOUND` path so real wins,
frame residuals, and intrinsic ceilings keep priority.

## Tests

Cover helper-level positive and negative cases, diagnose JSON/text fixtures, and
a priority test showing a verified cast win keeps the `WIN AVAILABLE`
recommendation ahead of this hint.
