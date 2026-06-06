# mwcc-debug: `match-iter-first` discovery + `--name-magic` hook — design

Two tool extensions in response to the `mn` decomp agent's feedback in
`docs/mwcc-debug-force-iter-feedback.md` (commit 8382b1c49). The agent is
still iterating on `mn/mnvibration.c` functions and is blocked on:

1. **Local-vs-local cascades** (e.g. fn_80247510) where `--force-iter-first`
   has no obvious argument to try — the parameter is dead, so there's no
   `param-like` virtual to hoist. We need a way to extract the "expected
   r31-bound virtual" from the matched .o and recommend it.
2. **Int-to-float magic-constant naming** (`@N` vs `mnVibration_804DC018`)
   blocking byte-match on 3/4 stuck mnvibration functions. We need a way
   to make MWCC emit the named symbol so the relocation matches expected.

Both fit the existing pattern of MWCC-side diagnostic hooks (force-phys,
force-iter-first, force-coalesce) plus a host-side analysis tool.

## Tool 1: `melee-agent debug match-iter-first`

### Purpose

Read the matched `.s` for a stuck function, find which virtual the
expected output gives r28..r31, trace it back to its ig_idx in the
current pcdump's BEFORE COLORING pass, and recommend the corresponding
`--force-iter-first` arguments.

### CLI

```
melee-agent debug match-iter-first -f <function> [<pcdump>]
                                   [--regs r31,r30,r29,r28]
                                   [--asm <path>]
                                   [--json]
```

- `-f`/`--function`: required. Function name as it appears in `.s`/pcdump.
- `<pcdump>`: optional; auto-resolves from cache via function name.
- `--regs`: comma-separated list of physical registers to report on.
  Default: `r31,r30,r29,r28` (top callee-saves).
- `--asm`: override path to expected `.s` file. Auto-resolves from
  `build/GALE01/asm/<unit>.s` by reading the function's TU from pcdump.
- `--json`: emit as JSON for tooling.

### Algorithm

1. **Resolve inputs**
   - Find pcdump (cache or argument).
   - Read function's source TU from pcdump's header line
     (`# <unit>.c` or equivalent).
   - Map TU → `build/GALE01/asm/<unit>.s`.

2. **Parse expected `.s`**
   - Find `.fn <function>, <scope>` line.
   - Scan until `.endfn`.
   - Track the prologue boundary: skip `mflr`, `stw r0, ...`, `stwu`,
     `stfd`, `stmw`, and the load-PC trampoline pattern. End-of-prologue
     is the first instruction that isn't one of those.
   - For each target register `rN` in `--regs`:
     - Find the first instruction (after prologue) where `rN` appears
       as the destination operand (the conventional "def" — for `stw`,
       `stfd`, etc. the register is the *source*, but those are still
       the first uses of `rN` and identify where it's "live").
     - Capture: `(opcode, operand_structure_without_register_names,
       instruction_index_in_function)`.

3. **Parse current pcdump's BEFORE COLORING pass for the function**
   - Re-use existing parser modules in `src/mwcc_debug/`.
   - Build per-instruction list of `(opcode, operands, virtual_regs)`.

4. **Structural alignment** (per target register):
   - Match the captured expected instruction (`opcode + non-register
     operands`) to the first instruction in BEFORE COLORING with that
     signature occurring at or near the same position.
   - "Near" tolerance: ±5 instructions to account for minor sequence
     differences. If no match within tolerance, fall back to first
     opcode/operand match anywhere.
   - Extract the virtual register at the destination operand slot.
   - Map virtual to ig_idx via the SimplifySection entries (already
     parsed in `colorgraph_parser.py`).

5. **Output**
   - Text format:
     ```
     Expected iter-first targets for fn_80247510 (mnvibration.c):
       r31 ← ig_idx 241  (instr 12: stw rN, 0x10(r1))
       r30 ← ig_idx 239  (instr 14: lwz rN, 0x4(rN))
       r29 ← ig_idx 218  (instr 18: addi rN, rN, 0x1)
       r28 ← ig_idx 188  (instr 22: ...)

     Try:
       melee-agent debug pcdump src/melee/mn/mnvibration.c \
           --force-iter-first 241,239,218,188
     ```
   - JSON format: array of `{reg, ig_idx, instr_idx, opcode, confidence}`.

### Edge cases

- **No `.s` file** (function not in build/asm yet): error with hint
  to run `python configure.py && ninja` first.
- **Function not found in `.s`**: error with available `.fn` labels
  in the TU.
- **Register never used in expected**: skip with note "rN unused in
  expected; no recommendation."
- **No structural match in BEFORE COLORING**: emit low-confidence
  guess (first opcode match anywhere) with a warning.
- **Two virtuals tie at same instruction position**: pick the one
  matching the destination operand index; warn if ambiguous.

### Out of scope (v1)

- Multi-pass alignment (only BEFORE COLORING, not intermediate passes).
- Handling rematerialized virtuals (split live ranges).
- Cross-block alignment (we only need the *first* use, typically near
  function entry).

## Tool 2: `--name-magic` DLL hook

### Purpose

Make MWCC emit user-supplied symbol names for magic constants in the
`.sdata2` literal pool, replacing the anonymous `@N` naming. Fixes
byte-match on functions whose only diff is the relocation target name.

### Background

When MWCC compiles an int-to-float cast, it emits a 64-bit magic
constant into the file's `.sdata2` literal pool:

- Signed: `0x4330000080000000` (decimal: 4503599627370496.0 + bias)
- Unsigned: `0x4330000000000000`

The constant gets an anonymous local symbol name like `@472`. The
relocation in the `.o` points to this anonymous symbol. The matched
`.o` (extracted from the binary) has the same data but referenced by
a named global like `mnVibration_804DC018` (from `symbols.txt`).

### CLI

```
melee-agent debug pcdump <source.c> \
    --name-magic <pattern>=<name> [--name-magic ...]
```

Where `<pattern>` is one of:
- `s32` → matches signed int→float bias (`0x4330000080000000`)
- `u32` → matches unsigned int→float bias (`0x4330000000000000`)
- A hex literal like `0x4330000080000000`

`<name>` is the desired symbol name (e.g. `mnVibration_804DC018`).

Multiple `--name-magic` flags are allowed. They're concatenated into
`MWCC_DEBUG_NAME_MAGIC` env var as `s32:mnVibration_804DC018,u32:mnVibration_804DC010`
(comma-separated, colon between value and name).

### MWCC side

#### RE plan

1. Locate `.sdata2` literal pool emission in `mwcceppc.exe`. Likely
   near existing hooks (the same file emits things like `__FILE__`
   strings for asserts).
2. Identify the symbol naming code path. Common pattern: a function
   that gets called when a new literal needs to be placed, returns a
   symbol pointer, and the symbol has a name field.
3. Find the hook point: ideally the function that mints the `@N` name
   (so we can override it before any reloc references it).

#### Hook implementation

Pseudocode for `mwcc_debug.c`:

```c
// Parse MWCC_DEBUG_NAME_MAGIC=s32:mnVibration_804DC018,u32:...
typedef struct {
    uint64_t value;
    const char *name;
} MagicMapping;

static MagicMapping g_magic_mappings[16];
static int g_magic_mapping_count;

static void parse_magic_from_env(void);

// Hook on the symbol-naming function for .sdata2 literal entries.
// When the literal value matches a mapping, return the user-supplied
// name instead of generating @N.
static char *hook_name_literal(void *literal_entry) {
    uint64_t value = read_literal_value(literal_entry);
    for (int i = 0; i < g_magic_mapping_count; i++) {
        if (g_magic_mappings[i].value == value) {
            return strdup(g_magic_mappings[i].name);
        }
    }
    return original_name_literal(literal_entry);
}
```

#### Fallback if RE proves hard

If the literal pool code path is buried too deep, fall back to **post-
processing the `.o`**: after mwcc emits the file, scan the symbol
table for anonymous symbols whose backing data matches a magic constant
value, and rename them. Same observable outcome, no DLL hook.

Decision criterion: timebox RE to ~1 hour. If no clear hook point found,
ship the post-process fallback.

### Verification

For mnvibration.c:
1. Run `melee-agent debug pcdump src/melee/mn/mnvibration.c
   --name-magic s32:mnVibration_804DC018`
2. Inspect the pcdump (or downloaded .o): symbol should be named
   `mnVibration_804DC018` instead of `@N`.
3. Run `checkdiff` on fn_80248A78: bytes should now match (assuming
   no other diffs).

## Testing strategy

**Tool 1:**
- Unit tests for the prologue-skip parser (synthetic `.s` snippets).
- Unit tests for structural alignment (synthetic BEFORE COLORING).
- Integration test: run on fn_80247510 from the live build, confirm
  output recommends sensible ig_idx values.

**Tool 2:**
- If DLL hook: smoke test that pcdump emits the named symbol on a
  synthetic int-to-float source.
- If post-process: unit tests for the .o rewriter on a fixture .o.
- Integration test: run on fn_80248A78, confirm checkdiff bytes
  match.

## Files touched

**Tool 1:**
- `tools/melee-agent/src/cli/debug.py` — new `match-iter-first` command.
- `tools/melee-agent/src/mwcc_debug/asm_parser.py` — new module for
  `.s` parsing (prologue skip + first-def detection).
- `tools/melee-agent/src/mwcc_debug/iter_match.py` — new module for
  structural alignment between expected `.s` and pcdump BEFORE COLORING.
- `tools/melee-agent/tests/test_mwcc_debug_match_iter_first.py` — tests.

**Tool 2:**
- `tools/mwcc_debug/mwcc_debug.c` — add env var parser + hook.
- `tools/melee-agent/src/cli/debug.py` — add `--name-magic` flag to
  pcdump command.
- `tools/mwcc_debug/win/run_pcdump.ps1` — pass through env var.
- (Possibly) `tools/melee-agent/src/mwcc_debug/o_rewriter.py` if
  fallback path is taken.

## Risk

- **Tool 1**: Low. Pure host-side parsing with well-defined inputs.
- **Tool 2**: Medium. RE work has unknown duration. Fallback path
  exists if hook proves too hard.
