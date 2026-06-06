---
name: opseq
description: Find functions by opcode sequence patterns. Use when stuck on a function and want to find similar already-decompiled code for reference.
---

# Opcode Sequence Matching

Find functions that share a specific sequence of opcodes. Useful for:
- Finding already-decompiled reference functions with similar structure
- Finding undecompiled candidates that likely use the same pattern

## Usage

### Find decompiled reference functions

```bash
melee-agent opseq <comma,separated,opcodes>
```

### Find undecompiled candidates

```bash
melee-agent opseq -candidates <comma,separated,opcodes>
```

## Examples

### Basic opcode pattern

```bash
# Find functions with beq,mr,bl sequence
melee-agent opseq beq,mr,bl
```

Output shows asm file location and corresponding source file:
```
build/GALE01/asm/melee/ft/chara/ftSeak/ftSk_SpecialS.s:1048 src/melee/ft/chara/ftSeak/ftSk_SpecialS.c:586
```

### Finding floating-point patterns

```bash
# Functions that load float, compare, and branch
melee-agent opseq lfs,fcmpo,bge
```

### Finding loop patterns

```bash
# Functions with counter increment and compare
melee-agent opseq addi,cmpwi,blt
```

## Common Use Cases

### Stuck on a function?

1. Extract a distinctive opcode sequence from the target asm:
   ```bash
   melee-agent extract get <func_name>  # Look at the asm output
   ```

2. Find similar already-matched functions:
   ```bash
   melee-agent opseq <pattern>
   ```

3. Read the decompiled source for inspiration on structure

### Finding related unmatched functions

When you've successfully matched one function, find similar unmatched ones:
```bash
melee-agent opseq -candidates <pattern_from_matched_func>
```

## Tips

- Shorter patterns (3-4 opcodes) give more results
- Longer patterns (5-6 opcodes) are more specific
- `melee-agent opseq` runs `tools/table-typer` from the current checkout and
  falls back to `go run` when the helper binary is not built.
- The tool searches `build/GALE01/asm/melee/` for asm files
- Results include line numbers for quick navigation
