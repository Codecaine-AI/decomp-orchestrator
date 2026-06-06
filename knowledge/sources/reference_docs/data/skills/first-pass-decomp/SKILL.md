---
name: first-pass-decomp
description: Generate initial C code from assembly using local m2c. Use this skill to get first-pass decompilations for unmatched functions before manual refinement.
---

## Prerequisites

Ensure context is up to date:
```bash
python tools/m2ctx/m2ctx.py --quiet -p
```

This regenerates `build/ctx.c` using pcpp. Only needed once per session or after header changes.

## Basic Usage

```bash
# With context (preferred - gets struct field names)
python tools/decomp.py --function <function_name>

# Without context (pure inference - useful for checking signature)
python tools/decomp.py --no-context --function <function_name>

# With clang-format
python tools/decomp.py -f --function <function_name>
```

**Important:** Flags must come BEFORE the function name.

## Inferring Correct Signatures

When the header declaration is wrong, m2c will:
1. Show `M2C_ERROR(/* Read from unset register $rN */)` - means function uses more args than declared
2. Generate incorrect casts/conversions - means return type is wrong

**To get m2c's inferred signature:**
```bash
python tools/decomp.py --no-context --function <function_name>
```

This ignores headers and shows what m2c infers from assembly alone.

## Signature Detection from Assembly

### Arguments (PowerPC calling convention)
- Integer args: r3, r4, r5, r6, r7, r8, r9, r10
- Float args: f1, f2, f3, f4, f5, f6, f7, f8

### Type inference patterns
| Pattern | Type |
|---------|------|
| `clrlwi rX, rY, 24` | u8 |
| `clrlwi rX, rY, 16` | u16 |
| `extsb rX, rY` | s8 |
| `extsh rX, rY` | s16 |
| `cmplwi` | unsigned comparison |
| `cmpwi` | signed comparison |

### Return type detection
- `li r3, N` before `blr` → returns int
- `fctiwz` + `stfd` + `lwz r3` → returns s32 (float→int)
- `lfs f1` before `blr` → returns float

## Batch Processing Multiple Functions

To decompile multiple stubs from a file:

```bash
# List stub markers in a file
grep -n "^/// #" src/melee/mn/mndiagram.c

# Decompile each and append to output file
for func in func1 func2 func3; do
    echo "// $func" >> /tmp/decomp_output.c
    python tools/decomp.py -f --function "$func" >> /tmp/decomp_output.c 2>/dev/null
    echo "" >> /tmp/decomp_output.c
done
```

## Common Issues

### "Syntax error when parsing C context"
Context has `#include` directives. Regenerate with pcpp:
```bash
python tools/m2ctx/m2ctx.py --quiet -p
```

### Function not found
The function must exist in built object files. Run build first:
```bash
python configure.py && ninja
```

### Wrong signature in output
Run without context to see m2c's inference:
```bash
python tools/decomp.py --no-context --function <function_name>
```

Then fix the header and regenerate context before running with context.

## Module-Specific Flags

Pass m2c flags after `--`:

| Module | Flags |
|--------|-------|
| `it_*` (items) | `--union-field Item_ItemVars:<type>` `--void-field-type Article.x4_specialAttributes:<type>` |
| `ft_*` (fighters) | `--void-var-type fp:FighterData` |
| Callbacks | `--void` (if return type unknown) |

Example:
```bash
python tools/decomp.py --function it_802E1C4C -- \
  --union-field Item_ItemVars:linkarrow \
  --void-field-type Article.x4_specialAttributes:itLinkArrowAttributes
```

## Output

The decompiled C code is printed to stdout. The output includes:
- External function declarations (commented)
- The decompiled function body
- Placeholder types for unknowns

This is a starting point - manual cleanup is usually required for matching.

## Updating source files

Once you have the decomplied C code, always update the original source with it, replacing the stub marker or creating the function if no stub marker existed.
