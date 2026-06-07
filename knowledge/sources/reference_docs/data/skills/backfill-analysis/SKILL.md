---
name: backfill-analysis
description: Analyze matched functions to discover mismatch patterns. Use when backfilling the mismatch-db from git history.
---

# Backfill Analysis Skill

Analyze a matched function commit to discover patterns that could help future decompilation work.

## Usage

```
/backfill-analyze <job_id>
/backfill-analyze <job_id> --tasks <N>
```

## Workflow

### 1. Claim a Task

```bash
python3 -m src.mismatch_db.cli backfill claim-task <job_id> --agent $AGENT_ID
```

This returns:
- Task ID
- Commit SHA
- Function name
- File path

If no tasks are available, report this and exit.

### 2. Gather Analysis Inputs

#### Get the final matched code from the commit:

```bash
cd ~/code/melee
git show <commit_sha>:<file_path> | grep -A 50 "<function_name>"
```

Or use the full commit diff:
```bash
git show <commit_sha> -- <file_path>
```

#### Get the m2c decompiler output (starting point):

```bash
melee-agent scratch create <function_name> --melee-root ~/code/melee
melee-agent scratch get <slug>
```

Note: If the function is already 100% matched, the scratch will show 0% because our code differs from m2c output. That's expected - we want to see what m2c produces vs what the final code looks like.

If scratch creation fails (function not found, etc.), note this and analyze just the commit diff.

### 3. Analyze Transformations

Compare the m2c output to the final matched code. Look for:

1. **Structural changes**
   - Loops rewritten (do-while -> for, unrolled -> loop)
   - Conditions restructured (ternary <-> if-else)
   - Switch statements vs if-else chains

2. **Type refinements**
   - `void*` -> typed pointer
   - Offset arithmetic -> struct field access
   - `M2C_FIELD(ptr, type, offset)` -> `ptr->field`

3. **Compiler quirks**
   - `& 0xFF` masks for u8 types
   - Variable declaration order affecting register allocation
   - `PAD_STACK()` usage

4. **m2c artifacts replaced**
   - `M2C_STRUCT_COPY` -> struct assignment or loop
   - `M2C_ERROR` -> proper variable usage
   - `M2C_UNK` -> typed expressions

5. **Macro usage**
   - `GET_ITEM()`, `GET_FIGHTER()` instead of `gobj->user_data`
   - `ARRAY_SIZE()` instead of magic numbers
   - `ABS()`, `FABS()` instead of manual checks

6. **Inline function patterns**
   - NULL-check-and-return inlines affecting branch polarity
   - Extra `mr` instructions from inline returns

### 4. Check for Existing Patterns

Before submitting a candidate, check if a similar pattern already exists:

```bash
python3 -m src.mismatch_db.cli search "<keywords>"
python3 -m src.mismatch_db.cli list --category <category>
```

Only submit NEW patterns or significant variations of existing ones.

### 5. Submit Results

Create a JSON file with your findings:

```json
{
  "analysis_notes": "Analyzed commit abc123 for function X. Found 2 patterns...",
  "candidates": [
    {
      "suggested_id": "pattern-slug-here",
      "name": "Human Readable Pattern Name",
      "description": "What the pattern looks like / when to suspect it",
      "root_cause": "Why this happens (compiler behavior, m2c limitation, etc.)",
      "signals": [
        {"type": "opcode_mismatch", "expected": "lwz", "actual": "lfs"},
        {"type": "m2c_artifact", "artifact": "M2C_STRUCT_COPY"}
      ],
      "examples": [
        {
          "function": "the_function_name",
          "before": "// m2c output\nvoid* temp = ptr + 0x40;",
          "after": "// matched code\nVec3* pos = &item->position;",
          "context": "Item position access"
        }
      ],
      "fixes": [
        {
          "description": "Use typed struct field access instead of offset arithmetic",
          "before": "ptr + 0x40",
          "after": "&item->position"
        }
      ],
      "opcodes": ["lwz", "lfs", "stw"],
      "categories": ["struct", "type"],
      "confidence": 0.8
    }
  ]
}
```

Submit the results:

```bash
python3 -m src.mismatch_db.cli backfill complete-task <task_id> /tmp/analysis_result.json
```

### 6. Repeat or Exit

If `--tasks N` was specified, continue claiming and analyzing up to N tasks.
Otherwise, exit after one task.

## Confidence Guidelines

- **0.9+**: Pattern seen in multiple functions, clear fix that always works
- **0.7-0.9**: Pattern likely generalizable, fix works in this case
- **0.5-0.7**: Possible pattern, needs more examples to confirm
- **<0.5**: Uncertain, might be function-specific quirk

## Signal Types

Use these signal types in your candidates:

| Type | Fields | Example |
|------|--------|---------|
| `opcode_mismatch` | `expected`, `actual` | `{"type": "opcode_mismatch", "expected": "beq", "actual": "bne"}` |
| `m2c_artifact` | `artifact` | `{"type": "m2c_artifact", "artifact": "M2C_STRUCT_COPY"}` |
| `offset_delta` | `register`, `delta` | `{"type": "offset_delta", "register": "r1", "delta": 8}` |
| `instruction_sequence` | `sequence` | `{"type": "instruction_sequence", "sequence": ["lwz", "mr", "stw"]}` |
| `extra_instruction` | `opcode`, `context` | `{"type": "extra_instruction", "opcode": "mr", "context": "after inline"}` |
| `branch_polarity` | `expected`, `actual` | `{"type": "branch_polarity", "expected": "bne", "actual": "beq"}` |

## Categories

Use these categories:

`stack`, `branch`, `control-flow`, `register`, `inline`, `struct`, `type`, `float`, `bitfield`, `loop`, `calling-conv`, `data-layout`

## Example Session

```
$ /backfill-analyze abc123

Claiming task from job abc123...
Claimed task: task-xyz
  Commit: def456
  Function: GetNameTotalKOs
  File: src/melee/mn/mndiagram.c

Fetching m2c output...
Created scratch: http://10.200.0.1/scratch/AbCd

M2C Output:
  void GetNameTotalKOs(void) {
      u8 var_r29 = 0;
      do { ... } while ((s32) var_r29 < 0x78);
  }

Final Code (from commit):
  s32 GetNameTotalKOs(u8 field_index) {
      u8 idx = (u8)(field_index & 0xFF);
      for (i = 0; i < 0x78; i++) { ... }
      return total;
  }

Analysis:
- Pattern 1: u8 parameter needs & 0xFF mask for clrlwi instruction
- Pattern 2: do-while converted to for loop

Checking existing patterns...
  Found similar: "u8-parameter-mask-clrlwi" (already exists)
  No match for loop conversion pattern

Submitting 1 new candidate...
Completed task task-xyz with 1 candidate(s)
```

## Notes

- If a commit touches multiple functions, focus on the one mentioned in the commit message
- Some commits may not yield any new patterns - that's fine, submit empty candidates array
- Prefer concrete before/after code examples over abstract descriptions
- The goal is to build a knowledge base that helps future decompilation work
