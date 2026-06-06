---
name: decomp-remote
description: Match decompiled C code using the remote decomp.me server workflow. Use this skill when you want to iterate on a scratch using the remote server. For most tasks, prefer /decomp which uses the faster local workflow.
---

# Melee Decompilation Matching (Remote Server Workflow)

You are an expert at matching C source code to PowerPC assembly for the Melee decompilation project. Your goal is to achieve byte-for-byte identical compilation output.

**Note:** This skill uses the remote decomp.me server for compilation and diff viewing. For most tasks, the local workflow (`/decomp`) is faster and recommended.

## Session State Tracking

**Track your session state throughout the session.** After every context reset or when resuming work, remember:

- **Active function**: (the one you're working on)
- **Active scratch**: (the slug you're iterating on)
- **Current match %**: (your progress)

## Workflow

### Step 0: Automatic Build Validation

When you first run a `melee-agent` command, the system automatically:
1. Validates the build is successful
2. If the build fails, shows the errors (your uncommitted changes are preserved)
3. Caches the validation result for 30 minutes

You'll see messages like:
- `[dim]Running build validation (this may take a minute)...[/dim]`
- `[green]Build OK[/green]` - you're good to go
- `[yellow]Build has errors - fix before committing[/yellow]` - fix the errors shown

**If build has errors:** Use `/decomp-fixup` skill to diagnose and fix them.

### Step 1: Choose a Function

**If user specifies a function:** Skip to Step 2.

**Otherwise:** Find a good candidate:
```bash
# Best: Use recommendation scoring (considers size, match%, module)
melee-agent extract list --min-match 0 --max-match 0.50 --sort score --show-score

# Filter by module for focused work
melee-agent extract list --module lb --sort score --show-score
melee-agent extract list --module ft --sort score --show-score
```

**Prioritization:** The `--sort score` option ranks functions by:
- **Size:** 50-300 bytes ideal (small enough to match, complex enough to matter)
- **Match %:** Lower is better (more room to improve)
- **Module:** ft/, lb/ preferred (well-documented)

#### Finding Functions in a Specific Source File

To see which functions in a specific file need work, check the build report:

```bash
# Build the project first to generate report
python configure.py && ninja

# Query the report for functions in a specific file
python3 << 'EOF'
import json
with open('build/GALE01/report.json') as f:
    data = json.load(f)
for unit in data.get('units', []):
    if 'mndiagram.c' in unit.get('name', ''):  # Change filename as needed
        print(f"File: {unit['name']}")
        for func in unit.get('functions', []):
            name = func.get('name', 'unknown')
            match_pct = func.get('fuzzy_match_percent', 0)
            if match_pct < 100:
                print(f'  {name}: {match_pct:.1f}%')
EOF
```

This shows all unmatched functions and their current match percentage, helping you pick functions close to 100% for quick wins.

### Step 2: Local Decompilation (Recommended)

**Always run local m2c first** using `tools/decomp.py`. This supports advanced flags that produce much better initial code than the server-side decompiler.

```bash
# Basic usage (copies to clipboard)
python tools/decomp.py <function_name>

# Without clipboard copy (for piping/scripting)
python tools/decomp.py <function_name> --no-copy

# With formatting
python tools/decomp.py <function_name> -f  # clang-format
python tools/decomp.py <function_name> -c  # colorized output
```

**Module-specific flags** dramatically improve output quality:

| Module | Recommended Flags |
|--------|-------------------|
| `it_*` (items) | `--union-field Item_ItemVars:<item_type>` `--void-field-type Article.x4_specialAttributes:<attrs_type>` |
| `ft_*` (fighters) | `--void-var-type fp:FighterData` |
| Callbacks | `--void` (if return type unknown) |
| Complex stack | `--stack-structs` (generates templates) |

**Item function example:**
```bash
python tools/decomp.py --no-copy it_802E1C4C -- \
  --union-field Item_ItemVars:linkarrow \
  --void-field-type Article.x4_specialAttributes:itLinkArrowAttributes
```

**All available m2c flags** (pass after `--`):
- `--union-field STRUCT:FIELD` - Select which union member to use
- `--void-field-type STRUCT.FIELD:TYPE` - Specify type for void* struct fields
- `--void-var-type VAR:TYPE` - Specify type for void* variables
- `--void` - Assume function returns void
- `--valid-syntax` - Emit valid C with macros for unknowns
- `--stack-structs` - Generate template structs for stack variables
- `--reg-vars REGS` - Force specific registers to single variables
- `--deterministic-vars` - Name vars after asm location (helps diff iterations)

### Step 3: Create Scratch with Local Output

After running local m2c, create a scratch and paste the improved code:

```bash
# Create scratch (will have basic m2c output)
melee-agent extract get <function_name> --create-scratch
# → Created scratch `xYz12`

# Then compile with your improved local m2c output using heredoc
cat << 'EOF' | melee-agent scratch compile xYz12 --stdin --diff
<paste your local m2c output here, cleaned up>
EOF
```

**Alternative: Write local output to file first:**
```bash
python tools/decomp.py <function_name> --no-copy > /tmp/decomp.c
# Edit /tmp/decomp.c as needed
melee-agent scratch compile xYz12 -s /tmp/decomp.c --diff
```

**To re-run server-side decompilation** (without advanced flags):
```bash
melee-agent scratch decompile <slug>              # Show decompiled code
melee-agent scratch decompile <slug> --apply      # Apply to scratch source
melee-agent scratch decompile <slug> --no-context # Skip context (faster)
```

#### Using Existing Source Code from the Repository

If the function already has a first-pass decompilation in `src/melee/`, you can test that code directly:

```bash
# 1. Create scratch for the function
melee-agent extract get <function_name> --create-scratch
# → Created scratch `xYz12`

# 2. Copy the current implementation from the source file into a heredoc
cat << 'EOF' | melee-agent scratch compile xYz12 --stdin --diff
void mnDiagram_80241B4C(void* arg0, int arg1)
{
    void* temp_r31 = ((HSD_GObj*) arg0)->user_data;
    PAD_STACK(8);
    // ... rest of function from src/melee/...
}
EOF
```

This workflow is useful when:
- The file already has stub implementations that need refinement
- You want to see the current match % of existing code
- You're iterating on a function that's already partially matched

### Step 4: Read Source Context

Read the source file in `src/melee/` for context. Look for:
- Function signature and local struct definitions (must include these!)
- Nearby functions for coding patterns

### Step 5: Compile and Iterate

Use heredoc with `--stdin` to compile (avoids shell escaping issues):

```bash
cat << 'EOF' | melee-agent scratch compile <slug> --stdin --diff
void func(s32 arg0) {
    if (!arg0 || arg0 != expected) {
        return;
    }
    // ... rest of function
}
EOF
```

**IMPORTANT:** Always use `cat << 'EOF' | ... --stdin` pattern. The quoted `'EOF'` prevents shell expansion of !, !=, $, etc. Do NOT use `--code` with inline source - it corrupts special characters.

The compile shows **match % history**:
```
Compiled successfully!
Match: 85.0%
History: 45% → 71.5% → 85%  # Shows your progress over iterations
```

**Diff markers:**
- `r` = register mismatch → fix LAST (see below)
- `i` = offset difference → usually OK, ignore
- `>/<` = extra/missing instruction → fix FIRST (check types, casts, operator precedence)

### CRITICAL: Structure First, Registers Last

**Do NOT try to fix `r` (register) differences until the instruction sequence matches.**

Register allocation is highly dynamic - it changes based on variable declaration order, control flow, and inlining. Trying to fix registers early leads to a "local maximum" where you're stuck at 85% because the underlying structure is wrong.

**The right approach:**
1. First, fix `>/<` diffs - get the **instruction sequence** correct
2. Then, fix control flow - branches, loops, conditions
3. **Only after** structure matches, fix `r` diffs by reordering declarations

**Signs you're chasing registers too early:**
- Reordering the same declarations back and forth
- Match % oscillates but doesn't improve
- Diff shows `>/<` (extra/missing instructions), not just `r`

### CRITICAL: Match % Can Drop When You're on the Right Track

**Do NOT revert a change just because match % dropped - if the structure became MORE correct, keep it.**

Fuzzy match % measures instruction similarity, not semantic correctness. A structurally correct version can score LOWER than an incorrect one.

**Example:** If target has `bl some_func` but your code inlines it:
- Inlined: 85% match (wrong structure, but instructions similar)
- With `#pragma dont_inline`: 60% match (correct `bl`, rest needs work)

**The 60% version is BETTER** - you can improve from correct structure. The 85% is a dead end.

**Accept a match % drop when:**
- You fixed a `bl` (function call) that was inlined
- You fixed loop structure (do-while vs while vs for)
- You fixed control flow (if/else ordering, switch vs if-chain)
- You added correct `#pragma` directives

**Revert when:**
- Diff shows MORE wrong instructions, not just different ones
- You introduced new structural problems

**Rule of thumb:** If you can explain WHY the change is structurally correct, keep it even if match % dropped.

**Common fixes (in priority order):**

| Priority | Marker | Fix |
|----------|--------|-----|
| 1st | `>/<` | Fix types, casts, operators, control flow |
| 2nd | `>/<` | Restructure if/else, use switch |
| 3rd | `>/<` | Type fixes: `float`→`f32`, `int`→`s32` |
| **Last** | `r` | Reorder variable declarations |

### WARNING: PAD_STACK is Usually Wrong

**Do NOT reach for `PAD_STACK` as a first solution for stack size mismatches.**

`PAD_STACK(n)` is a "fakematch" that forces stack size but doesn't represent real code. It should be a **last resort**.

**When you see a stack mismatch (`stwu` offset differs), first investigate:**
1. **Missing inline function** - 8-byte difference often means missing inline
2. **Missing local variables** - Original may have variables you haven't declared
3. **Wrong types** - `Vec3` vs `float[3]` allocate differently

**Before using PAD_STACK:**
- Look for inline functions that should be called
- Compare variable declarations to similar matched functions
- Check for unused variables (retail asserts leave stubs)

**When PAD_STACK is acceptable:**
- You've exhausted other options
- Function is otherwise 100% matched
- No pointers passed to stack data

**When PAD_STACK is harmful:**
- Function passes pointers to stack variables (padding location matters)
- It masks a real structural problem

### Step 6: Know When to Stop

- **Match achieved:** score = 0
- **Time limit:** Don't spend more than 10 minutes on a single function
- **Stop iterating:** Stuck with only `r`/`i` diffs, or same changes oscillating

### Step 7: Commit to Repository

**Threshold:** Any improvement over the starting match %. Progress is progress.

**Direct Edit workflow:**
1. Edit the source file (`src/melee/<module>/<file>.c`) to add/update the function
2. Edit the header file (`src/melee/<module>/<file>.h` or `include/melee/<module>/forward.h`) if signature changes
3. Verify build: `python configure.py && ninja`
4. Commit with descriptive message

**CRITICAL: Commit Requirements**

Before committing, you MUST ensure:

1. **No merge conflict markers** - Files must not contain `<<<<<<<`, `=======`, or `>>>>>>>` markers.

2. **No naming regressions** - Do not change names of functions, params, variables, etc. from an "english" name to their address-based name, e.g. do not change `ItemStateTable_GShell[] -> it_803F5BA8[]`

3. **No pointer arithmetic/magic numbers** - don't do things like `if (((u8*)&lbl_80472D28)[0x116] == 1) {`, if you find yourself needing to do this to get a 100% match, you should investigate and update the struct definition accordingly.

4. **Build passes** - Run `python configure.py && ninja` to verify. If it fails due to header mismatches or caller issues, use the `/decomp-fixup` skill to resolve them.

## Human Readability

Matching is not just about achieving 100% - the code should be readable. Apply these improvements when the purpose is **clear from the code**:

### Function Names

Rename `fn_XXXXXXXX` when the function's purpose is obvious:
```c
// Before
fn_80022120(data, row, col, &r, &g, &b, &a);

// After - function clearly reads RGBA8 texture coordinates
lbRefract_ReadTexCoordRGBA8(data, row, col, &r, &g, &b, &a);
```

Keep the address-based name if purpose is unclear.

### Parameter Names

Rename parameters when their usage is obvious in the function body:
```c
// Before
void lbBgFlash_800205F0(s32 arg0) {
    if (arg0 < 1) { arg0 = 1; }
    ...
}

// After - clearly a duration/count
void lbBgFlash_800205F0(s32 duration) {
    if (duration < 1) { duration = 1; }
    ...
}
```

Keep `arg0`, `arg1`, etc. if the parameter is unused or purpose is unclear.

### Variable Names

Use descriptive names instead of decompiler defaults:
```c
// Before
s32 temp_r3 = gobj->user_data;
f32 var_f1 = fp->x2C;

// After
FighterData* fp = gobj->user_data;
f32 facing_dir = fp->facing_direction;
```

### Struct Field Access

**Never use pointer arithmetic.** If you need to access a field by offset, update the struct definition:
```c
// BAD - pointer arithmetic
if (((u8*)&lbl_80472D28)[0x116] == 1) {

// GOOD - proper struct access (update struct definition if needed)
if (lbl_80472D28.some_flag == 1) {
```

If you don't know the field name, use an `x` prefix with the offset:
```c
// Acceptable when field purpose is unknown
if (lbl_80472D28.x116 == 1) {
```

**Important:** If you think pointer arithmetic is "required for matching" - you're almost certainly wrong. The real solution is to properly define the struct with correct padding and alignment:

```c
// BAD - pointer arithmetic with index (NEVER DO THIS)
*(s16*)((u8*)gp + idx * 0x1C + 0xDE) = 1;
*(float*)((u8*)gp + idx * 0x1C + 0xCC) += delta;

// GOOD - define the struct properly with padding, then use array access
struct AwningData {
    /* +0x00 */ float accumulator;
    /* +0x04 */ float velocity;
    /* +0x08 */ float position;
    /* +0x0C */ s16 counter;
    /* +0x0E */ s16 prev_counter;
    /* +0x10 */ s16 cooldown;
    /* +0x12 */ s16 flag;
    /* +0x14 */ u8 pad[8];   // Padding to 0x1C stride
};

struct GroundVars {
    u8 x0_b0 : 1;
    u8 pad[0xCC - 0xC5];     // Align array to correct offset
    struct AwningData awnings[2];
};

// Now use clean struct access - this DOES match!
gp->gv.onett.awnings[idx].flag = 1;
gp->gv.onett.awnings[idx].accumulator += delta;
```

The `mulli` instruction pattern (e.g., `mulli r0, r6, 0x1c`) proves the struct stride, which tells you the element size for the array.

### Struct Field Renaming

When you access a field and understand its purpose, rename it:
```c
// Before - in types.h
struct BgFlashData {
    int x4;
    int x8;
    int xC;
};

// After - if you see xC is set from a duration parameter
struct BgFlashData {
    int x4;
    int x8;
    int duration;  // or keep as xC if uncertain
};
```

**Only rename fields you've seen accessed and understood.** Don't guess.

### Conservative Principle

When uncertain, prefer:
- Address-based function names over guessed names
- `arg0`/`arg1` over guessed parameter names
- `x4`/`x8` over guessed field names
- Simple `@brief` over detailed speculative docs

See `/understand` skill for detailed conservative documentation guidelines.

## Type and Context Tips

**Quick struct lookup:** Use the struct command to find field offsets and known issues:
```bash
melee-agent struct offset 0x1898              # What field is at offset 0x1898?
melee-agent struct show dmg --offset 0x1890   # Show fields near offset
melee-agent struct issues                     # Show all known type issues
melee-agent struct callback FtCmd2            # Look up callback signature
melee-agent struct callback                   # List all known callback types
```

**Inspect scratch context (struct definitions, etc.):**
```bash
melee-agent scratch get <slug> --context           # Show context (truncated)
melee-agent scratch get <slug> --grep "StructName" # Search context for pattern
melee-agent scratch get <slug> --diff              # Show instruction diff
melee-agent scratch decompile <slug>               # Re-run m2c decompiler
```

**Refresh context when headers change:**
```bash
melee-agent scratch update-context <slug>          # Rebuild context from repo
melee-agent scratch update-context <slug> --compile  # Rebuild + compile in one step
melee-agent scratch compile <slug> -r              # Compile with refreshed context
```

Use these when:
- You've fixed a header signature
- You've updated struct definitions
- Context is stale after pulling upstream changes

**Search context (supports multiple patterns):**
```bash
melee-agent scratch search-context <slug> "HSD_GObj" "FtCmd2" "ColorOverlay"
```

**File-local definitions:** If a function uses a `static struct` defined in the .c file, you MUST include it in your scratch source - the context only has headers.

## Known Type Issues

The context headers may have some incorrect type declarations. When you see assembly that doesn't match the declared type, use these workarounds:

| Field | Declared | Actual | Detection | Workaround |
|-------|----------|--------|-----------|------------|
| `fp->dmg.x1894` | `int` | `HSD_GObj*` | `lwz` then dereferenced | `((HSD_GObj*)fp->dmg.x1894)` |
| `fp->dmg.x1898` | `int` | `float` | Loaded with `lfs` | `(*(float*)&fp->dmg.x1898)` |
| `fp->dmg.x1880` | `int` | `Vec3*` | Passed as pointer arg | `((Vec3*)&fp->dmg.x1880)` |
| `item->xD90.x2073` | - | `u8` | Same as `fp->x2070.x2073` | Access via union field |

**When to suspect a type issue:**
- Assembly uses `lfs`/`stfs` but header declares `int` → should be `float`
- Assembly does `lwz` then immediately dereferences → should be pointer
- Register allocation doesn't match despite correct logic → type mismatch causing extra conversion code

**Workaround pattern:**
```c
/* Cast helpers for mistyped fields */
#define DMG_X1898(fp) (*(float*)&(fp)->dmg.x1898)
#define DMG_X1894(fp) ((HSD_GObj*)(fp)->dmg.x1894)
```

## melee-re Reference Materials

The `melee-re/` submodule contains reverse-engineering documentation that can help with decompilation:

### Symbol Lookup
```bash
# Look up a function by address
grep "80008440" melee-re/meta_GALE01.map

# Find all symbols in an address range
awk '$1 >= "80070000" && $1 < "80080000"' melee-re/meta_GALE01.map
```

### Key Documentation Files

| File | Contents |
|------|----------|
| `melee-re/docs/STRUCT.md` | Function table layouts, callback signatures, memory structures |
| `melee-re/docs/LINKERMAP.md` | Which addresses belong to which modules (SDK, HSD, game code) |
| `melee-re/bin/analysis/ntsc102_defs.py` | Enums for character IDs, stage IDs, action states, item IDs |

### Character ID Mapping

When working on fighter code, know the difference between **external** and **internal** IDs:

```python
# External IDs (CSS order, used in saves/replays)
CaptainFalcon=0x00, DonkeyKong=0x01, Fox=0x02, MrGameNWatch=0x03...

# Internal IDs (used in code, function tables)
Mario=0x00, Fox=0x01, CaptainFalcon=0x02, DonkeyKong=0x03, Kirby=0x04...
```

See `melee-re/bin/analysis/ntsc102_defs.py` for complete mappings.

### Function Table Addresses

From `melee-re/docs/STRUCT.md`:
- **Global action states**: 0x803c2800 (341 entries × 0x20 bytes)
- **Character-specific tables**: 0x803c12e0 (pointers indexed by internal char ID)
- **Stage function tables**: 0x803dfedc (0x1bc bytes, indexed by internal stage ID)
- **Item tables**: 0x803f14c4 (regular), 0x803f3100 (projectiles), 0x803f23cc (pokemon)

### Per-Character Special Move Entry Counts

| Character | Entries | Character | Entries |
|-----------|---------|-----------|---------|
| Mario | 12 | Kirby | 203 |
| Fox | 35 | Marth | 32 |
| Captain Falcon | 23 | Jigglypuff | 32 |
| Link | 31 | Game & Watch | 40 |

Kirby's high count is due to copy abilities.

## PowerPC / MWCC Reference

### Calling Convention
- Integer args: r3, r4, r5, r6, r7, r8, r9, r10
- Float args: f1, f2, f3, f4, f5, f6, f7, f8
- Return: r3 (int/ptr) or f1 (float)

### Register Allocation
- Registers allocated in variable declaration order
- Loop counters often use CTR register (not a GPR)
- Compiler may reorder loads for optimization

### Compiler Flags (Melee)
```
-O4,p -nodefaults -fp hard -Cpp_exceptions off -enum int -fp_contract on -inline auto
```

- `-O4,p` = aggressive optimization with pooling
- `-inline auto` = compiler decides what to inline

## Example Session

```bash
# Find best candidates using recommendation scoring
melee-agent extract list --min-match 0 --max-match 0.50 --sort score --show-score --limit 10
# Pick a function with high score (130+), reasonable size (50-300 bytes)

# Step 1: Run LOCAL m2c first for better initial output
python tools/decomp.py lbColl_80008440 --no-copy -f > /tmp/decomp.c
# Review and clean up the output

# For item functions, use module-specific flags:
python tools/decomp.py --no-copy it_802E1C4C -- \
  --union-field Item_ItemVars:linkarrow \
  --void-field-type Article.x4_specialAttributes:itLinkArrowAttributes

# Step 2: Create scratch
melee-agent extract get lbColl_80008440 --create-scratch
# → Created scratch `xYz12`

# Step 3: Compile with your improved local m2c output
melee-agent scratch compile xYz12 -s /tmp/decomp.c --diff
# Or use heredoc for quick iterations:
cat << 'EOF' | melee-agent scratch compile xYz12 --stdin --diff
void lbColl_80008440(CollData* data) {
    // your implementation
}
EOF
# → 65% match (better starting point than server-side m2c!)

# If stuck, check for type issues
melee-agent struct issues
melee-agent struct offset 0x1898  # What field is at this offset?

# Search for struct definitions in the scratch context
melee-agent scratch search-context xYz12 "CollData" "HSD_GObj"

# Once satisfied, edit the source file directly and verify build
# Edit src/melee/lb/lbcollision.c with the matched code
python configure.py && ninja
```

## Checking Your Progress

Track your match percentage using the scratch diff:

```bash
melee-agent scratch get <slug> --diff     # Shows current match % and instruction diff
melee-agent scratch compile <slug> --diff # Shows match % after compile
```

Check local build status:
```bash
python configure.py && ninja              # Verify build passes
python tools/checkdiff.py <func_name>     # Detailed local diff comparison
```

## What NOT to Do

1. **Don't search decomp.me first when starting fresh** - find functions from the melee repo
2. **Don't spend >10 minutes on one function** - commit your progress and move on
3. **Don't ignore file-local types** - they must be included in source
4. **Don't keep trying the same changes** - if reordering doesn't help after 3-4 attempts, the issue is likely context-related
5. **Don't forget to commit** - edit the source files and verify build when done
6. **Don't use raw curl/API calls** - use CLI tools like `scratch get --grep` or `scratch search-context`

## Getting Unstuck

**Don't spin on the same mismatch!** After 2-3 failed attempts at the same issue, proactively use these skills:

### `/mismatch-db` - Known Mismatch Patterns
Search the database of documented mismatch patterns and their fixes:
```bash
/mismatch-db search "frsp"           # Extra float conversion
/mismatch-db search "register"       # Register allocation issues
/mismatch-db search "stwu"           # Stack frame problems
```

### `/discord-knowledge` - Historical Context
Search 6+ years of Discord discussions for compiler tricks and matching techniques:
```bash
/discord-knowledge search "inline"       # Inlining behavior
/discord-knowledge search "volatile"     # Volatile tricks
/discord-knowledge search "bitfield"     # Bitfield patterns
```

### `/opseq` - Find Similar Functions
Find already-matched functions with similar opcode sequences, then study how they solved similar issues:
```bash
/opseq <function_name>
```

### `/ppc-ref` - Instruction Reference
Look up what a PowerPC instruction actually does:
```bash
/ppc-ref rlwinm    # Rotate and mask
/ppc-ref fctiwz    # Float to int
```

**Pro tip:** The mismatch-db and discord-knowledge contain solutions to hundreds of common issues. Search for patterns before trying random changes - someone has likely solved your exact problem.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Undefined identifier | `melee-agent scratch search-context <slug> "name"` or include file-local definition |
| Score drops dramatically | Reverted an inline expansion - try different approach |
| Stuck at same score | Change had no codegen effect - try structural change |
| Only `i` (offset) diffs | Usually fine - focus on `r` and instruction diffs |
| Missing stub marker | Run `melee-agent stub add <function_name>` to add it |
| Stuck at 85-90% with extra conversion code | Likely type mismatch - run `melee-agent struct issues` and check for known issues |
| Assembly uses `lfs` but code generates `lwz`+conversion | Field is float but header says int - use cast workaround |
| Can't find struct offset | `melee-agent struct offset 0xXXX --struct StructName` |
| Struct field not visible in context | Use `M2C_FIELD(ptr, offset, type)` macro for raw offset access |
| Build fails after matching | Use `/decomp-fixup` skill to fix header/caller issues |
| Header has UNK_RET/UNK_PARAMS | Use `/decomp-fixup` skill to update signatures |
| Context outdated after header fix | `melee-agent scratch update-context <slug>` to rebuild from repo |

**NonMatching files:** You CAN work on functions in NonMatching files. The build uses original .dol for linking, so builds always pass. Match % is tracked per-function.

**Header signature bugs:** If assembly shows parameter usage (e.g., `cmpwi r3, 1`) but header declares `void func(void)`:
1. Use `/decomp-fixup` skill for guidance on fixing headers
2. Fix the header in the melee repo
3. Update the scratch context: `melee-agent scratch update-context <slug>` (rebuilds from repo)

## Server Unreachable

If the decomp.me server is unreachable, **STOP and report the issue to the user**. Do NOT attempt to work around it with local-only workflows. The server should always be available - if it's not, something is wrong that needs to be fixed.

## CLI Quick Reference

### Getting Help
```bash
melee-agent --help                    # List all commands
melee-agent scratch --help            # List scratch subcommands
melee-agent scratch compile --help    # Show all flags for compile
```

### Common Flags by Command

| Command | Short | Long | Description |
|---------|-------|------|-------------|
| `scratch compile` | `-s` | `--source` | Source file to compile |
| `scratch compile` | `-d` | `--diff` | Show instruction diff |
| `scratch compile` | `-r` | `--refresh-context` | Rebuild context from repo first |
| `scratch compile` | | `--stdin` | Read source from stdin (use with heredoc) |
| `scratch get` | `-c` | `--context` | Show scratch context |
| `scratch get` | `-d` | `--diff` | Show instruction diff |
| `scratch get` | `-g` | `--grep` | Search context for pattern |
| `scratch update-context` | `-s` | `--source` | Source file for context |
| `scratch update-context` | | `--compile` | Compile after updating |
| `extract list` | | `--module` | Filter by module (e.g., `lb`, `ft`) |
| `extract list` | | `--sort score` | Sort by recommendation score |
| `extract get` | | `--create-scratch` | Create scratch after extracting |
| `extract get` | | `--full` | Show full output including ASM |

### Heredoc Pattern (Recommended)
```bash
cat << 'EOF' | melee-agent scratch compile <slug> --stdin --diff
void func(void) {
    if (!flag) return;  # Note: quotes around EOF prevent ! escaping
}
EOF
```

## Note on objdiff-cli

The `objdiff-cli diff` command is an **interactive TUI tool for humans** - it requires a terminal and does NOT work for agents. Do not attempt to use it.

If you need to verify match percentage after a build, check `build/GALE01/report.json` which is generated by `ninja`.

## When to Use Remote vs Local Workflow

**Use `/decomp` (local workflow) when:**
- You want faster iteration (no network round-trips)
- You're editing source files directly
- You just need to see the assembly diff

**Use `/decomp-remote` (this skill) when:**
- You need to inspect scratch context (struct definitions, etc.)
- You want to use `melee-agent scratch` commands for context search
- You need to track scratch history on the server
- The local build environment is unavailable

## Integration with Other Skills

**Proactively use these skills - don't wait until you're completely stuck!**

### When Stuck on Matching
- `/mismatch-db` - Search database of known mismatch patterns and fixes
- `/discord-knowledge` - Search 6+ years of Discord for compiler tricks and techniques
- `/opseq` - Find similar already-matched functions by opcode patterns
- `/ppc-ref` - Look up PowerPC instruction documentation
- `/ghidra` - Get Ghidra's decompilation for a second opinion, find callers/callees

### Build & Header Issues
- `/decomp-fixup` - Fix build failures after matching (header/caller issues)

### After Matching
- `/understand` - Document and name functions, structs, and fields

### Faster Workflow
- `/decomp` - Switch to local workflow for faster iteration
