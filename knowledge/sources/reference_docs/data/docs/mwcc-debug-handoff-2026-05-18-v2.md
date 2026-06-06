# mwcc-debug handoff — 2026-05-18 (v2)

Response to your `--force-iter-first` feedback in
`docs/mwcc-debug-force-iter-feedback.md` (commit 8382b1c49). Two new
tools shipped to cover the gaps you flagged:

1. `debug match-iter-first` — extends iter-first to local-vs-local
   cascades like fn_80247510.
2. `debug name-magic` — renames anonymous `@N` .sdata2 symbols so the
   int-to-float magic constants (and any other anonymous float
   literals) byte-match the expected `.o`.

## Tool 1: `debug match-iter-first`

### What it does

Reads `build/GALE01/asm/<unit>.s`, finds the first instruction where
r28..r31 are defined (post-prologue), structurally aligns each one to
the current pcdump's pre-coloring pass, and reports the virtual
register (= ig_idx in MWCC's IG) the expected output assigns to that
physical.

Bridges the gap where `rank-callees` can only predict the cascade
based on ig_idx descending order — but for functions like fn_80247510
where the parameter is dead-on-arrival, the actual expected-r31 target
is some specific local that the cascade prediction can't identify.

### How to use it

```bash
melee-agent debug match-iter-first -f fn_80247510
```

Output:

```
Function: fn_80247510
Unit:     melee/mn/mnvibration
ASM:      build/GALE01/asm/melee/mn/mnvibration.s

Expected iter-first targets:
  r31 <- ig_idx 132  (virt r132, instr 17: li r31, 0x0) [ambiguous]
  r30 <- ig_idx 47   (virt r47, instr 3: lwz r30, 0x2c(r4)) [ambiguous]
  r29 <- ig_idx 45   (virt r45, instr 37: li r29, 0x0) [ambiguous]
  r28 <- ig_idx 134  (virt r134, instr 15: addi r28, r4, mn_804A04F0@l) [exact]

Try:
  melee-agent debug pcdump <source.c> --force-iter-first 132,47,45,134
```

Run the suggested `--force-iter-first` to confirm that the recommended
virtuals get the expected physicals when forced first in iter order.

### Confidence levels

- **exact**: only one pre-coloring instruction matches the signature.
  High confidence the virtual is correct.
- **ambiguous**: multiple pre-coloring instructions share the
  signature (e.g. many `li R,0`). Tool picks the one closest to the
  expected position. Usually right, but verify with `--force-iter-first`.
- **unused**: the physical register isn't used in expected (e.g.
  function only uses r28..r30, not r31). No recommendation needed.
- **no_match**: no pre-coloring instruction has the matching signature.
  Could indicate an opcode mnemonic the normalizer doesn't yet handle.

### Normalization details

The tool normalizes both expected `.s` and pcdump operands to a common
form before comparing:

| expected `.s`     | pcdump          | normalized |
|-------------------|-----------------|------------|
| `0x2c`            | `44`            | `44`       |
| `sym@sda21`       | `sym`           | `sym`      |
| `sym@l`           | `LO(sym)`       | `sym`      |
| `cmplwi r3, 0x0`  | `cmpli cr0,r3,0`| (cr0 stripped) |
| (no annotation)   | `; fIsPtrOp`    | (annotation stripped) |
| registers         | registers       | `R`/`F` placeholders |
| whitespace        | whitespace      | stripped entirely |

If you hit a case where the normalizer should handle some new
syntactic difference, file a bug.

### Options

- `--regs r31,r30` — restrict to a subset of registers
- `--asm <path>` — override the expected `.s` path
- `--json` — emit as JSON for tooling

---

## Tool 2: `debug name-magic`

### What it does

Post-processes a `.o` file to rename anonymous `@N` symbols in
`.sdata2` to user-supplied names. Uses `powerpc-eabi-objcopy
--redefine-sym` under the hood; no `mwcc` mutation involved.

Closes byte-match diffs caused by MWCC's anonymous naming of:
- Int-to-float magic constants (`0x4330000080000000` signed,
  `0x4330000000000000` unsigned) — the agent's primary use case
- Other anonymous float literals (`@791`, `@792`, etc. for `0.1f`,
  `10.0f`, etc.)

### Why a post-processor, not a DLL hook

I timeboxed the `mwcceppc.exe` RE to locate the literal-pool naming
function. Found the format strings (`@%ld@` family at file offset
0x15f614) but the xref work to find the calling functions didn't
converge fast enough to justify the risk. The post-process approach is
simpler, has no host-side dependency, and produces the identical
observable result (renamed symbol in the `.o`).

If we hit a case where we need this to be a DLL hook (e.g. pcdump
output needs the named symbol, not just the `.o`), we can revisit RE
later.

### How to use it

#### Step 1: see what's available

```bash
melee-agent debug name-magic build/GALE01/src/melee/mn/mnvibration.o --list
```

Output:

```
Anonymous .sdata2 symbols in build/GALE01/src/melee/mn/mnvibration.o:
  name        offset  sz  value               notes
  ----------  ------  --  ------------------  -----
  @473             0   8  0x4330000000000000  int-to-float bias (unsigned)
  @491             8   8  0x4330000080000000  int-to-float bias (signed)
  @522            16   4  0x00000000          float ≈ 0
  @550            20   4  0x3cf5c28f          float ≈ 0.03
  @791            24   4  0x41200000          float ≈ 10
  ...
```

#### Step 2: rename

```bash
melee-agent debug name-magic <o> --map "s32=mnVibration_804DC018,u32=mnVibration_804DC010"
```

Or by direct symbol name (for arbitrary float literals):

```bash
melee-agent debug name-magic <o> --map "@791=mnVibration_804DC050"
```

Or mixed:

```bash
melee-agent debug name-magic <o> --map "s32=mnVib_018,@791=mnVib_050"
```

#### Step 3: verify

```bash
python tools/checkdiff.py fn_80248A78
```

If the magic-constant reloc was the last diff, the function is now
byte-matched.

### Caveats

- **The `.o` is rewritten in place**. Each `ninja` re-runs the compile
  and produces a fresh `.o` with anonymous names, so you'd re-run
  `name-magic` after each rebuild. Wrap it in a script if you iterate
  often.
- **The `@N` numbering varies between compiles**. Prefer `s32`/`u32`
  shortcuts or direct value matching for the magic constants. For
  other float literals, use `--list` to find the current `@N` before
  building the map.
- **objcopy path**: defaults to `/opt/devkitpro/devkitPPC/bin/powerpc-eabi-objcopy`.
  If your toolchain lives elsewhere, the tool's `o_rewriter.py` API
  has an `objcopy=` parameter.

### Options

- `--list` — enumerate anonymous `.sdata2` symbols (no rename)
- `--map <pairs>` — rename rules (required when not `--list`)
- `--out <path>` — write to a different file instead of in-place
- `--json` — JSON output

---

## End-to-end workflow on fn_80247510

The function the agent flagged as the "doesn't fit the param case"
cascade. Combining both tools:

```bash
# 1. Identify which virtual should be each callee-save (in current compile)
melee-agent debug match-iter-first -f fn_80247510

# 2. Confirm by forcing those virtuals first
melee-agent debug pcdump src/melee/mn/mnvibration.c \
    --force-iter-first 132,47,45,134 \
    --output /tmp/forced.txt

melee-agent debug rank-callees -f fn_80247510 /tmp/forced.txt
# Should now show ig_idx 132 → r31 (matching expected)

# 3. If int-to-float magic also stuck on this function,
#    rename in the .o after build
melee-agent debug name-magic build/GALE01/src/melee/mn/mnvibration.o \
    --map "s32=mnVibration_804DC018,u32=mnVibration_804DC010"

# 4. Check
python tools/checkdiff.py fn_80247510
```

If both tools confirm "yes, this function would match if those
diagnostic patches were applied to mwcc," document it as Tier 6 and
move on. The patches aren't shippable as real fixes — they're
hypothesis-test artifacts — but they let you rule out further C-source
work.

## Open wishlist items

Still pending:

- **`triage-perm --minimal-diff`** — preserve formatting/comments
  when applying permuter winners. Deferred pending AST-diff
  implementation.
- **`debug ig-swap-cost`** — speculative tool; needs more
  structural-ceiling case data to design.
- **Full `coalescenodes` hook** — buildable in ~half-day if both
  iter-first and name-magic prove insufficient.
- **`name-magic` auto-detection from symbols.txt** — if the .o knows
  what unit it's compiling and symbols.txt has named symbols at
  predictable .sdata2 offsets, we could auto-construct the mapping.

## Tests

39 tests across new modules:
- `tests/test_mwcc_debug_asm_parser.py` (6) — `.s` parsing, prologue
  detection, first-def finding
- `tests/test_mwcc_debug_iter_match.py` (10) — signature normalization,
  structural alignment, integration on fn_80247510
- `tests/test_mwcc_debug_o_rewriter.py` (11) — mapping parser, symbol
  enumeration, rename via objcopy on real `.o`

All existing mwcc-debug tests still pass.

## Commits

- `f65a07972` — match-iter-first command
- `d3fe11c18` — name-magic command
- This handoff: pending
