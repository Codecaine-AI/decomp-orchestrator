---
name: mismatch-db
description: Knowledge base for common assembly mismatches. Use to interpret diffs when matching functions.
---

# Mismatch Pattern Database

A searchable knowledge base of common assembly mismatches encountered during decompilation. Patterns are stored in a SQLite database with full-text search.

## When to Use This Skill

Use `/mismatch-db` when:
- You see a diff between expected and actual assembly and don't know why
- A function won't match despite looking correct
- You want to find patterns related to specific opcodes
- You need to understand common compiler behaviors

## CLI Commands

### Search by keyword
```bash
melee-agent mismatch search "stack size"
melee-agent mismatch search "inline"
melee-agent mismatch search "register allocation"
```

### Search by opcode mismatch
```bash
# Find patterns where expected opcode differs from actual
melee-agent mismatch opcode beq bne
melee-agent mismatch opcode lwz lfs
melee-agent mismatch opcode mulhw mulhwu
```

### List all patterns
```bash
melee-agent mismatch list
melee-agent mismatch list --category stack
melee-agent mismatch list --opcode clrlwi
```

### Get full pattern details
```bash
melee-agent mismatch get incorrect-stack-size
melee-agent mismatch get branch-polarity-beq-vs-bne-with-null-checks
```

### Search by m2c artifact
```bash
melee-agent mismatch m2c M2C_STRUCT_COPY
```

### Record when a pattern helps
```bash
melee-agent mismatch record-success <pattern-id> <function-name> --scratch <slug>
```

## Workflow

1. **Get the diff** from your scratch or `tools/checkdiff.py`

2. **Identify the mismatch type**:
   - Single opcode difference? Use `mismatch opcode <expected> <actual>`
   - Stack offset issues? Search "stack"
   - Register allocation? Search "register" or "callee-saved"
   - Loop/control flow? Search "loop" or "control-flow"

3. **Read the pattern** with `mismatch get <id>` to understand:
   - Root cause
   - Signals to look for
   - Suggested fixes with before/after examples

4. **Apply the fix** and recompile

5. **Record success** if the pattern helped match the function

## Common Pattern Categories

| Category | Description |
|----------|-------------|
| `stack` | Stack size, PAD_STACK, local variable placement |
| `branch` | Branch polarity (beq/bne), condition inversion |
| `control-flow` | Loops, if-else, ternary operators |
| `register` | Callee-saved allocation (r27-r31), register moves |
| `inline` | Inline function behavior, unwanted inlining |
| `struct` | Struct copy patterns, field access |
| `type` | Type casting, signed/unsigned, u8 masking |
| `float` | Float comparisons, fabs, float instructions |
| `loop` | Loop unrolling, counter patterns, array indexing |
| `calling-conv` | Variadic functions, va_list |
| `data-layout` | String addressing, data section placement |

## Example: Debugging a Mismatch

```
Diff shows:
-0x000010: bne 0x24
+0x000010: beq 0x24
```

1. Search by opcode:
   ```bash
   melee-agent mismatch opcode bne beq
   ```

2. Get pattern details:
   ```bash
   melee-agent mismatch get branch-polarity-beq-vs-bne-with-null-checks
   ```

3. Learn that NULL check patterns can invert branch polarity, and the fix involves using inline functions with early-return NULL checks.

## Database Statistics

Run `melee-agent mismatch stats` to see current pattern counts and category breakdown.
