# `gen-permuter-config`: pattern-driven permuter weight tuning — design

A new `melee-agent debug gen-permuter-config` command that emits a tuned
`settings.toml` for `decomp-permuter`, biasing mutation weights based on
mwcc-debug's pattern detection for the target function. Replaces hand-
tuning per-function weights like the existing `nonmatchings/it_802CE400/
settings.toml`.

This is Tier 1 of the "inform the permuter" integration described in
`docs/mwcc-debug-permuter-integration.md`. Tier 2 (custom scorer) and
Tier 3 (custom mutation generator) remain deferred — Tier 1 captures
most of the value with minimal complexity.

## Why this is the right Tier-1 shape

The matching agent's existing workflow already hand-tunes settings.toml:

```toml
# nonmatchings/it_802CE400/settings.toml (already in this codebase)
[weight_overrides]
# Prioritize declaration reordering for register allocation issues
perm_reorder_decls = 50.0
perm_temp_for_expr = 30.0
perm_expand_expr = 20.0
```

So:
- The plumbing already exists in permuter — we just feed it via TOML.
- No permuter patches needed; we're an upstream-compatible config helper.
- The agent's mental work ("this is a decl-order issue, so up-weight
  reorder_decls") is exactly what mwcc-debug's `pattern-catalog`
  already classifies.

## Architecture

### Data flow

```
                      mwcc-debug analysis
                              |
                              v
        ┌──────────────────────────────────────┐
        │  Auto-detect pattern from guide/    │
        │  stuck output, OR use --pattern flag │
        └──────────────────┬───────────────────┘
                           │
                           v
        ┌──────────────────────────────────────┐
        │  PATTERN_WEIGHT_PROFILES table       │
        │  (lives in patterns.py)              │
        └──────────────────┬───────────────────┘
                           │
                           v
        ┌──────────────────────────────────────┐
        │  Render settings.toml (or merge      │
        │  with existing if --merge)           │
        └──────────────────┬───────────────────┘
                           │
                           v
              <perm_root>/nonmatchings/<fn>/settings.toml
```

### Pattern-to-weights table

The mapping table extends the existing `MutationPattern` dataclass in
`tools/melee-agent/src/mwcc_debug/patterns.py` with an optional
`permuter_weights` field. Concretely:

```python
@dataclass
class MutationPattern:
    # ... existing fields ...
    permuter_weights: dict[str, float] = field(default_factory=dict)
    """Weight overrides for decomp-permuter when this pattern is
    detected. Keys are perm_* names from default_weights.toml. Values
    are absolute weights (not multipliers) — they replace whatever
    the [base]/[mwcc] tables provided."""

    permuter_skip: bool = False
    """If True, gen-permuter-config refuses to write the file for this
    pattern (e.g. param-iter-ceiling is a Tier 6 ceiling)."""
```

Initial mappings (one per existing pattern):

| Pattern               | permuter_weights overrides                                | permuter_skip |
|-----------------------|------------------------------------------------------------|---------------|
| `decl-order`          | reorder_decls=80, temp_for_expr=30, ins_block=20          | False         |
| `alias-split`         | temp_for_expr=60, refer_to_var=30, expand_expr=15         | False         |
| `widen-u8-to-u32`     | randomize_internal_type=50, cast_simple=30, expand_expr=15 | False         |
| `shrink-s32-to-u8`    | randomize_internal_type=50, cast_simple=30, expand_expr=15 | False         |
| `drop-variadic-cast`  | cast_simple=60, expand_expr=30                            | False         |
| `subexpr-extract`     | temp_for_expr=80, expand_expr=30                          | False         |
| `chained-init`        | chain_assignment=50, duplicate_assignment=20              | False         |
| `param-iter-ceiling`  | (n/a — Tier 6)                                            | **True**      |

Notes on the numbers:
- mwcc preset already gives `perm_reorder_decls` weight 10 (base) +
  no mwcc override = 10. Setting 80 is an 8x boost.
- Boost values picked to roughly mirror what the agent hand-tuned for
  `it_802CE400` (50x for the primary mutation, 30 for the secondary).
- These are starting heuristics — easy to tune as we gather data.

We do NOT down-weight unrelated mutations. The mwcc preset already
covers known-bad-for-mwcc mutations (`perm_xor_zero=0.5` etc.); piling
on more overrides risks over-narrowing the search.

### CLI surface

```
melee-agent debug gen-permuter-config -f FUNCTION [options]
```

**Required:**
- `-f`/`--function FUNCTION`: function name (matches existing mwcc-debug commands).

**Options:**

| Flag             | Default                                  | Behavior                                                                                |
|------------------|------------------------------------------|----------------------------------------------------------------------------------------|
| `--pattern PAT`  | auto-detect via guide                    | Override pattern detection. Useful when guide's confidence is low.                     |
| `--out PATH`     | `<perm_root>/nonmatchings/<fn>/settings.toml` | Output path.                                                                       |
| `--perm-root P`  | `~/code/decomp-permuter`                 | Root of decomp-permuter clone.                                                          |
| `--print`        | False                                    | Print to stdout instead of writing.                                                     |
| `--merge`        | False                                    | Preserve existing `[weight_overrides]` entries not touched by our pattern.              |
| `--force`        | False                                    | Allow writing even when `permuter_skip=True` (param-iter-ceiling).                      |
| `--json`         | False                                    | Emit JSON describing the action (for tooling).                                          |

**Behavior:**

1. **Resolve pcdump** via `_resolve_pcdump_path` (existing helper).
2. **Detect pattern**: if `--pattern` not given, derive from `guide`/
   `stuck` output. Use the highest-severity suggestion's category.
3. **Look up `permuter_weights`** for the pattern in `PATTERNS`.
4. **Handle skip case**: if `permuter_skip=True` and no `--force`, print
   a clear message ("This is a Tier 6 ceiling — permuter won't help.
   See `<doc>` for context.") and exit non-zero.
5. **Locate target dir**: `<perm_root>/nonmatchings/<fn>/`.
6. **Error on missing dir**: if dir doesn't exist, print:
   ```
   Error: <perm_root>/nonmatchings/<fn> not found.
   Run `./import.py <c_file> <s_file>` in <perm_root> first.
   ```
   exit 2.
7. **Read existing settings.toml** if present.
8. **Build new TOML**:
   - If existing file: preserve top-level keys (`func_name`,
     `compiler_type`, `objdump_command`).
   - Replace `[weight_overrides]` with our pattern's overrides UNLESS
     `--merge` is set, in which case union them (ours wins on conflict).
   - Add a header comment naming the source pattern and the
     `melee-agent debug gen-permuter-config` invocation.
9. **Write** (or stream to stdout if `--print`).
10. **Emit recommendation**: after writing, print a follow-up tip:
   - For `decl-order`: "Consider running `melee-agent debug
     enumerate-decl-orders -f <fn> --keep-best` first — it's
     deterministic and ~100x faster for this pattern."
   - For other patterns: "Now run: cd <perm_root> && ./permuter.py
     nonmatchings/<fn>"

### Sample output

```
$ melee-agent debug gen-permuter-config -f fn_xyz
Pattern: alias-split (detected via guide)
Profile: permuter_weights = {temp_for_expr: 60.0, refer_to_var: 30.0, expand_expr: 15.0}
Wrote: /Users/mike/code/decomp-permuter/nonmatchings/fn_xyz/settings.toml

Run: cd /Users/mike/code/decomp-permuter && ./permuter.py nonmatchings/fn_xyz
```

```
$ melee-agent debug gen-permuter-config -f fn_80247510
Pattern: param-iter-ceiling (detected via guide)

This is a Tier 6 ceiling — permuter cannot fix it from C source.
The parameter virtual gets a low ig_idx by C semantics, and the
cascade dispenses callee-saves to higher-ig_idx locals first.

Recommendation: use `--force-iter-first` for diagnostic confirmation:
  melee-agent debug match-iter-first -f fn_80247510

Pass --force to gen-permuter-config anyway if you want to override.
```

```
$ melee-agent debug gen-permuter-config -f fn_xyz --print
# Generated by melee-agent debug gen-permuter-config
# Pattern: alias-split
# 2026-05-18

func_name = "fn_xyz"
compiler_type = "mwcc"
objdump_command = "/opt/devkitpro/devkitPPC/bin/powerpc-eabi-objdump -dr -EB -mpowerpc -M broadway"

[weight_overrides]
# alias-split — bias toward introducing fresh locals for aliased values
perm_temp_for_expr = 60.0
perm_refer_to_var = 30.0
perm_expand_expr = 15.0
```

## Pattern auto-detection

Reuse the existing `guide` / `stuck` infrastructure. Already produces
ranked suggestions with `category` fields (mostly aligned with pattern
names already: `interference`, `spill`, `decl-order`,
`param-iter-ceiling`, etc.).

When pattern detection produces multiple candidates, pick the
highest-severity suggestion's category. If that category has no
`permuter_weights`, fall back to the next-highest.

If no detected pattern has weights and `--pattern` wasn't specified,
emit a generic "mwcc defaults, no pattern detected" settings.toml
with no weight overrides — that's still useful (correct `func_name` +
`compiler_type` + `objdump_command`).

## Error handling

| Scenario                                  | Behavior                                                                  |
|-------------------------------------------|----------------------------------------------------------------------------|
| Function not in report.json               | Reuse existing `_abort_function_not_in_dump` helper.                       |
| `<perm_root>` missing or not a dir        | Error with hint to `git clone` decomp-permuter to the expected path.       |
| `<perm_root>/nonmatchings/<fn>` missing   | Error with hint to run `./import.py` in decomp-permuter to set up.         |
| Settings.toml exists, conflicting weight  | Default: overwrite. With `--merge`: pattern wins on conflict.              |
| Pattern is `param-iter-ceiling`           | Refuse to write; explain why. `--force` overrides.                         |
| No pattern detected                       | Emit no-overrides settings.toml, log warning.                              |

## Files to touch

- `tools/melee-agent/src/mwcc_debug/patterns.py` — extend
  `MutationPattern` with `permuter_weights` + `permuter_skip` fields,
  populate for the 8 existing patterns.
- `tools/melee-agent/src/mwcc_debug/permuter_config.py` — new module
  that renders TOML and handles the merge logic. Keeping it separate
  from the CLI keeps the unit-test surface small.
- `tools/melee-agent/src/cli/debug.py` — new `gen-permuter-config`
  command (~150 lines).
- `tools/melee-agent/tests/test_mwcc_debug_permuter_config.py` —
  unit tests for the renderer + merger.
- `docs/mwcc-debug-permuter-integration.md` — add a Tier 1 section
  describing the new command and how it pairs with `triage-perm`.

## Testing strategy

**Unit tests** (no permuter dep):
- Render settings.toml from a pattern → string equality.
- Merge mode preserves existing keys, ours wins on conflict.
- Skip flag respected for `param-iter-ceiling`.
- `--force` overrides the skip.
- Auto-detection picks highest-severity suggestion.
- Pattern with no weights falls back to generic settings.

**Integration test**:
- Given a synthetic stuck function name + cached pcdump, generate the
  config and verify it parses with `toml.load`.
- (Skip if no real `~/code/decomp-permuter/nonmatchings/<fn>` exists.)

## Out of scope (still deferred)

- **Custom scorer wiring (Tier 2)** — needs local fast mwcc or a
  pcdump-free IGNode estimator. Per `permuter-integration.md` v2 sketch.
- **Custom mutation generator (Tier 3)** — research-grade, requires
  virtual-reg-to-source-variable bridging.
- **Live permuter runs from mwcc-debug** — no orchestration command.
  User still invokes `./permuter.py` directly after we generate config.
- **PERM_LINESWAP / PERM_GENERAL macro insertion** — automatic source
  rewriting to add explicit alternation points. Deferred until we see
  the simpler weight-tuning approach is insufficient.

## Risk assessment

- **Weight choices are heuristic.** First-pass numbers may not be
  optimal; easy to tune as we gather data on which functions benefit.
- **Pattern detection accuracy.** Existing `guide` already produces
  the input; if it's wrong, our config is wrong. Same risk as the
  existing pattern-catalog command.
- **Permuter behavior drift.** Permuter could rename `perm_*` weights
  upstream; we'd need to chase. Unit tests will catch parse failures.
- **None of this risks breaking existing workflows** — generating a
  TOML file is read-only for the rest of the build.
