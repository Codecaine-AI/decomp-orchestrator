---
name: mwcc-debug
description: Dump MWCC's internal codegen passes (BEFORE/AFTER REGISTER COLORING, instruction scheduling, etc.) for a Melee TU. Runs locally on macOS (via wibo+Zig-built DLL) by default, or on a remote Windows host as a fallback. Use when stuck on register-allocation cascades or other last-mile matching issues; complement to mwcc-inspect (which shows front-end IR / ENodes / ObjObjects).
---

# MWCC Debug

Runs a patched MWCC debug DLL against the GC/1.2.5n compiler and
produces `pcdump.txt`. The dump exposes MWCC's back-end PCode passes,
basic blocks, virtual registers, interference graph events, coloring
decisions, and scheduled instructions.

Use this after lighter tools (`mismatch-db`, `opseq`, `ghidra`, and
Discord knowledge) fail to explain a last-mile mismatch. For front-end
parse structure, use `/mwcc-inspect`; for back-end allocator and codegen
shape, use `/mwcc-debug`.

## Quick Workflow

Use local cached pcdumps first:

```bash
melee-agent debug dump setup                         # one-time local setup
melee-agent debug dump local src/melee/mn/foo.c      # refresh cached pcdump
melee-agent debug inspect guide -f fn_80247510       # first interpretation step
melee-agent debug inspect analyze -f fn_80247510     # detailed virtual/register table
melee-agent debug inspect diff before.txt after.txt -f fn_80247510
```

When you have a desired allocator shape:

```bash
melee-agent debug target derive -f fn_80247510 > /tmp/target.yaml
melee-agent debug target score-dump -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target score-source src/melee/mn/foo.c -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target match-iter-first -f fn_80247510
```

When diagnostics point at source shape:

```bash
melee-agent debug suggest casts fn_80247510 --signedness
melee-agent debug suggest coalesce -f fn_80247510 --discover --top 5
melee-agent debug mutate decl-orders fn_80247510 --strategy all
melee-agent debug mutate type-change -f fn_80247510 --var local_var --type u32
melee-agent debug mutate insert-alias -f fn_80247510 --var local_var --at 0
```

When using decomp-permuter:

```bash
melee-agent debug permute config -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute run -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute verify output-1234/source.c -f fn_80247510
melee-agent debug permute triage permute_output_dir -f fn_80247510 --apply-best
melee-agent debug permute fix-compile path/to/compile.sh
```

Low-level helpers:

```bash
melee-agent debug util patterns
melee-agent debug util patterns decl-order
melee-agent debug util name-magic build/GALE01/src/melee/mn/foo.o --map @123=lbl_804D0000
melee-agent debug util verify-name-magic -f fn_80247510
```

## Tooling Issue Gate

Report bugs, hangs, confusing output, and papercuts immediately. Feature
requests are gated by `melee-agent issue report`: include the reusable class,
known affected functions, source-actionable output, stop condition, and the
existing workflow that failed first.

```bash
melee-agent issue report "mwcc-debug needs a source lever for frame-only walls" \
  --kind feature --tool mwcc-debug --function gm_801A9DD0 \
  --reusable-class "stack/local unused home reservation" \
  --applies-to gm_801A9DD0 \
  --source-actionable-output "ranked frame source transforms and score-source target" \
  --stop-condition "no candidate improves frame score after 50 probes" \
  --existing-workflow-failed "inspect diagnose was register-only and reported no fast transform"
```

For a one-off exploratory feature issue, pass
`--governance-waiver "<reason>"`; the waiver is stored with the issue.

## When to use this

| Situation | Recommendation |
|---|---|
| First look at a function | Start with `tools/checkdiff.py`, m2c, and nearby source. |
| Diff resembles a known compiler pattern | Try `/mismatch-db` or `/opseq` first. |
| Need callers, callees, or string xrefs | Use `/ghidra`. |
| Need parsed expression trees or ObjObject IDs | Use `/mwcc-inspect`. |
| Need basic blocks, virtual registers, allocator decisions, or scheduling | Use this skill. |

`mwcc-debug` and `mwcc-inspect` answer different questions:

- `mwcc-inspect`: how did the compiler parse my C expressions?
- `mwcc-debug`: what did codegen and register allocation produce?

## Command groups

The canonical CLI is grouped under `melee-agent debug`:

| Group | Purpose |
|---|---|
| `dump` | Local and remote pcdump generation. |
| `inspect` | Analyze, diff, simulate, and guide from pcdumps. |
| `target` | Derive allocator targets and score dumps or source. |
| `suggest` | Static source-shape suggestions. |
| `mutate` | Targeted source mutation experiments. |
| `permute` | decomp-permuter setup, run, verify, and triage helpers. |
| `util` | Pattern catalog and name-magic helpers. |

## Dumping a translation unit

Local mode is preferred because it is fast and sees uncommitted worktree
changes:

```bash
melee-agent debug dump setup
melee-agent debug dump local src/melee/lb/lbarq.c
melee-agent debug dump local src/melee/lb/lbarq.c --output build/mwcc_debug/lbarq.txt
melee-agent debug dump local src/melee/lb/lbarq.c --output -
```

Remote mode remains available when local wibo is unavailable.
`melee-agent debug dump setup` is local setup only; `melee-agent debug
dump remote` requires a preconfigured Windows SSH host with repo
checkout, `run_pcdump.ps1`, and patched DLL.

```bash
melee-agent debug dump remote src/melee/lb/lbarq.c
melee-agent debug dump remote src/melee/lb/lbarq.c --output build/mwcc_debug/lbarq.txt
melee-agent debug dump remote src/melee/lb/lbarq.c --timeout 180
melee-agent debug dump remote src/melee/lb/lbarq.c --no-pull
```

With no `--output`, dumps are cached under `build/mwcc_debug_cache/`.
Most follow-up commands can then auto-resolve the dump from `-f <fn>`.
Forced local runs do not update the baseline cache. Pass
`--output /tmp/forced.txt` and pass that pcdump path to follow-up
commands such as `melee-agent debug target derive` or
`melee-agent debug target score-dump`.

## Inspecting dumps

```bash
melee-agent debug inspect analyze -f fn_80247510
melee-agent debug inspect guide -f fn_80247510
melee-agent debug inspect guide -f fn_80247510 --target /tmp/target.yaml
melee-agent debug inspect diff before.txt after.txt -f fn_80247510
melee-agent debug inspect simulate -f fn_80247510 --all
melee-agent debug inspect stuck fn_80247510
melee-agent debug inspect diagnose fn_80247510
```

`inspect analyze` gives a detailed virtual/register table.
`inspect guide` turns allocator facts into source-shape hypotheses.
`inspect diff` compares two source variants (or two pcdump files) pass
by pass through MWCC's pipeline and reports the earliest divergence.

### Reading `inspect diff` output

`inspect diff` accepts either two `.c` source files (forward-compiled
via pcdump-local with `--no-cache-sync`) or two `.txt` pcdump files:

```bash
melee-agent debug inspect diff --fn mnVibration_80248644 src/melee/mn/mnvibration.c /tmp/candidate.c
melee-agent debug inspect diff --fn fn_8024D5B0 /tmp/a.pcdump.txt /tmp/b.pcdump.txt
```

Read the top line first. The earliest diverging pass tells you where in
the pipeline the two inputs first part ways. For register-allocation
divergences:

- `DIVERGENCE (input-derived)` — the allocator input differs (interference
  graph, simplify ordering, or coalesce mappings changed). Continue
  looking upstream at instruction selection or earlier.
- `DIVERGENCE (intrinsic)` — the allocator saw equivalent input and still
  chose different colors. C-source edits are less likely to help than
  `--force-phys`, `--force-phys-iter`, or accepting an allocator-order
  ceiling.

### First-divergence analyzer (directed tell)

`melee-agent debug inspect first-divergence -f FN --force-phys 'ig:phys,...'`

Given a baseline pcdump and a same-source target coloring (force-phys map; the
map KEYS are the target node set), reports the single earliest allocator
decision that diverges from target, classified mechanically:
- **Case D** — a target node coalesced away (lever: prevent the coalesce).
- **Case E** — a target node spilled (lever: reduce its degree).
- **Cases A / B / B-inverse / C / C2** — register-choice divergences (target
  reg blocked by an interferer / wrong dispense order / sticky-pool mismatch),
  each with a local structural lever.

Output has two layers: a **gated** allocator-fact layer (mechanically derived,
trustworthy) and, with `--source`, an **advisory** source-idea layer (heuristic
symbol-bridge mapping — confidence + ranked alternates, NOT validated). Re-run
after each edit to chase the new first divergence.

**Boundaries (the tool abstains rather than guess):** r0 assignments, spilled
nodes, truncated interferer rows, and incomplete decision tables are reported as
ABSTAINED/skipped — the replay model does not predict them. Also note ig indices
drift across compiles (a node's ig_idx is not stable if the source changes), so
derive the force-phys map from the *current* compile. v1 is same-source only;
cross-compile convergence is v2. See
docs/superpowers/specs/2026-05-27-first-divergence-analyzer-design.md and the
plan docs/superpowers/plans/2026-05-28-first-divergence-analyzer-v1.md.

## Targets and scoring

Use target commands when a forced dump or matched sibling shows the
allocator shape you want:

```bash
melee-agent debug target derive -f fn_80247510 --format yaml > /tmp/target.yaml
melee-agent debug target score-dump -f fn_80247510 --target /tmp/target.yaml --breakdown
melee-agent debug target score-source src/melee/mn/foo.c -f fn_80247510 --target /tmp/target.yaml
melee-agent debug target match-iter-first -f fn_80247510
```

`target score-source` is the scorer form used by permuter integration:
it compiles the source with the debug compiler, parses the dump, and
scores the result against the target.

## Force options

Force options are hypothesis tests. They can prove whether a desired
allocation would help, but a forced dump is not natural compiler output.
Do not treat forced results as source-level proof until an unforced
compile reproduces the shape.

```bash
melee-agent debug dump local src/melee/mn/foo.c \
    --force-phys "36:31" --force-phys-fn fn_80247510 \
    --output /tmp/forced.txt
melee-agent debug target derive /tmp/forced.txt -f fn_80247510 > /tmp/target.yaml

melee-agent debug dump local src/melee/mn/foo.c \
    --force-coalesce "53=3" --force-coalesce-fn fn_80247510 \
    --output /tmp/forced.txt

melee-agent debug dump local src/melee/mn/foo.c \
    --force-phys-iter "0:3:31" --force-phys-fn fn_80247510 \
    --output /tmp/forced.txt
```

For `--force-phys-iter`, `class:iter:phys` values come from the
`COLORGRAPH DECISIONS` / `SIMPLIFY GRAPH` sections in the pcdump.

Use `melee-agent debug target match-iter-first -f fn_80247510` before
forced iter-order testing. `--force-iter-first` is global to the whole
translation unit and has no per-function scope; use it only on
single-function TUs or after accepting that it can perturb other
functions in the file:

```bash
melee-agent debug dump local src/melee/mn/foo.c \
    --force-iter-first "62,47" --output /tmp/forced.txt
```

`--force-phys-fn` scopes `--force-phys` and `--force-phys-iter` only.

## Source-shape tools

```bash
melee-agent debug suggest casts fn_80247510
melee-agent debug suggest casts fn_80247510 --severity all --asm
melee-agent debug suggest casts fn_80247510 --signedness
melee-agent debug suggest coalesce -f fn_80247510 -V 53=3
melee-agent debug suggest coalesce -f fn_80247510 --discover --top 5

melee-agent debug mutate decl-orders fn_80247510
melee-agent debug mutate decl-orders fn_80247510 --strategy all
melee-agent debug mutate decl-orders fn_80247510 --keep-best
melee-agent debug mutate type-change -f fn_80247510 --var local_var --type u32
melee-agent debug mutate insert-alias -f fn_80247510 --var local_var --at 0
melee-agent debug mutate search -f fn_80247510
```

These commands are for small, explainable C-source experiments before
launching broad permutation.

## decomp-permuter workflow

There is no patched permuter binary for general use. Run upstream
decomp-permuter as usual; mwcc-debug generates config, scores source,
verifies candidates, and triages output.

```bash
melee-agent debug permute config -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute run -f fn_80247510 --target /tmp/target.yaml
melee-agent debug permute verify output-1234/source.c -f fn_80247510
melee-agent debug permute verify output-1234/source.c -f fn_80247510 --keep
melee-agent debug permute triage permute_output_dir -f fn_80247510
melee-agent debug permute triage permute_output_dir -f fn_80247510 --apply-best
melee-agent debug permute fix-compile path/to/compile.sh
```

### Stuck-function workflow with custom simplify-order scorer

For functions stuck at high match% where the remaining gap is in the
register allocator's simplify order (see
`docs/mwcc-debug-diff-roadmap.md` for the broader framework), use the
custom-scorer + triage workflow. There is a locally-patched
decomp-permuter (branch `custom-scorer-interface`) that supports a
`[scorer].command` interface for this.

**Step 0 — pre-flight check (REQUIRED).** After deriving
`target.yaml` via the usual force-proof flow, pass the same force-phys
mapping to `setup-simplify-order-scorer` via `--force-phys` so the
target.yaml captures it. Then score the baseline:

```bash
melee-agent debug target score-simplify-order \
  -f <function> --target <target.yaml> <baseline.o> --breakdown \
  --strict-polarity
```

The breakdown emits three checks:

1. **`Observed prefix:`** must contain non-`-1` `ig_idx` values. If it
   is empty or all `-1`, the target shape is **phys-iter**
   (`COLORGRAPH DECISIONS` positions, not `SIMPLIFY GRAPH`) and Layer A
   cannot help. Abort before the 2–3 hour permuter run.

2. **`Coalesce preservation:`** should report **ALL TARGETS INDEPENDENT**
   for the baseline. If it reports **REJECTED** at screening time, that
   means the baseline itself coalesces target ig_idx values — a sign
   the force-phys mapping is misaligned with the function's allocator
   shape. Recheck the force proof: the target should presuppose
   independent virtuals for each ig_idx in the mapping. If the baseline
   genuinely has the right shape and the constraint should be disabled
   for this function, pass `--no-coalesce-preservation` to
   `setup-simplify-order-scorer`. The constraint will automatically
   reject coalescing candidates during the permuter run (no further
   action needed at scoring time). The gm_80173EEC campaign documented
   why this check matters.

3. **`Polarity check:`** must report **SAFE**. If it reports
   **WRONG POLARITY**, the target physicals are in the high-volatile
   range (r10–r12) and `--want-first` syntax is structurally wrong for
   this function — MWCC's volatile dispense gives front simplify-order
   positions the LOWEST registers, not r10/r11/r12. `--strict-polarity`
   makes this a hard refusal. The lbDvd_80018A2C campaign documented
   this gotcha; see roadmap "Target shape" under Layer A. UNCERTAIN
   polarity (mid-volatile r4–r9) is allowed but produces a soft note —
   proceed with caution.

See "Target shape" under Layer A in the roadmap for the full taxonomy
of when each pre-flight signal applies.

**Two target-syntax options:** pick the right syntax based on the
function's target physical class:

- **`--want-first N,M`** (Phase 1/2): target `ig_idx` values appear at
  the **start** of simplify order. Use when target physicals are
  non-volatile (r25–r31) or r3.
- **`--want-late N,M`** (Phase 3): target `ig_idx` values appear at the
  **end** of simplify order. Use when target physicals are high-volatile
  (r10–r12). MWCC's volatile dispense is lowest-first, so high-volatile
  targets need to be processed LATE so lower volatiles are consumed first.

Step 0's polarity check tells you which to use. If the breakdown reports
**WRONG POLARITY** with `--want-first`, the hint will recommend switching
to `--want-late` (and vice versa).

```bash
# 1. One-time per function: capture a baseline pcdump and wire up the
#    custom scorer.
melee-agent debug dump local src/melee/gr/grvenom.c \
  --function grVenom_80204284 \
  --output build/mwcc_debug_cache/melee/gr/grvenom.txt

# --want-first: non-volatile target physicals (e.g. r28, r29)
melee-agent debug permute setup-simplify-order-scorer \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/gr/grvenom.txt

# --want-late: high-volatile target physicals (e.g. r10, r11)
# melee-agent debug permute setup-simplify-order-scorer \
#   -f fn_80018A2C \
#   --want-late 17,9 \
#   --class 0 \
#   --baseline-dump build/mwcc_debug_cache/melee/lb/lbdvd.txt

# 2. Run permuter. With the [scorer] config it saves candidates that
#    move our simplify-order metric (not just match%).
cd /Users/mike/code/decomp-permuter
./permuter.py /Users/mike/code/melee/nonmatchings/grVenom_80204284

# 3. *** ALWAYS RUN TRIAGE AFTER PERMUTER FINISHES. ***
#    The custom-scorer ranking is a SEARCH-side proxy metric. Triage
#    uses real-tree match% — the GROUND-TRUTH metric. They don't fully
#    correlate; ranking candidates for inspection by simplify-order
#    distance alone can hide the actual fix.
melee-agent debug permute triage \
  /Users/mike/code/melee/nonmatchings/grVenom_80204284 \
  -f grVenom_80204284 \
  --top 20
```

Skipping step 3 cost the grVenom_80204284 campaign multiple days when
the manual translation survey ranked by simplify-order distance, only
inspected the top 5 by that metric, and concluded "no fix exists." The
actual fix was at `permuter output-180-1` — a candidate with higher
simplify-order distance but 100% real-tree match. Triage on the full
pool found it in ~20 minutes.

Shortcut for steps 1-3 once Step 0 has passed:

```bash
melee-agent debug mutate simplify-order \
  -f grVenom_80204284 \
  --want-first 42,32 \
  --with-permuter \
  --triage
```

The `--triage` flag landed in commit `415f957d0`. It wraps
`setup-simplify-order-scorer`, the permuter invocation, and
`debug permute triage`. Step 0 still runs separately because it has
to happen before the scorer is wired up.

## Copy and inline-shape diagnostics

```bash
melee-agent debug inspect var-to-virtual my_var -f my_fn
melee-agent debug inspect var-to-virtual my_var -f my_fn --basis
melee-agent debug inspect virtual-to-var r53 -f my_fn
melee-agent debug inspect virtual-to-ig -f my_fn --virtual r108
melee-agent debug inspect virtual-to-ig -f my_fn --virtual r50 --class gpr
melee-agent debug inspect trace-copy -f my_fn --from r50 --to r108
melee-agent debug inspect trace-copy -f my_fn --list-copies
melee-agent debug inspect trace-copy -f my_fn --involving r50 --near-block 245

melee-agent debug suggest inlines -f my_fn
melee-agent debug suggest inlines -f my_fn --seed-source repeated
melee-agent debug suggest inlines -f my_fn --seed-source coalesce
melee-agent debug suggest inlines -f my_fn --verify
melee-agent debug suggest inlines -f my_fn --verify --trace-copies
melee-agent debug suggest inlines -f my_fn --verify --apply-best
melee-agent debug suggest inlines -f my_fn --json --emit-hunks
melee-agent debug suggest inlines -f my_fn --json --emit-patches
```

`suggest inlines` is diagnostic by default. It reports repeated/helper-shaped
statement groups, short-lived call-argument temp candidates, and rejected
candidates with reasons. Use `--verify` to stage candidates and score them
against real-tree `checkdiff`; source is restored unless `--apply-best` keeps
a verified winner. Use `--trace-copies` or `--explain` with `--verify` when
you need to know whether a candidate-introduced `mr` copy survives to
simplify/colorgraph or is eliminated before coloring.

## Temporary probes and cleanup

```bash
melee-agent debug dump local src/melee/mn/mnvibration.c --no-cache-sync
melee-agent debug dump local src/melee/mn/mnvibration.c --diff --checkdiff-timeout 120
melee-agent debug dump local src/melee/mn/mnvibration.c --output /tmp/probe.txt --no-cache-sync
melee-agent debug dump restore-object-report src/melee/mn/mnvibration.c
melee-agent debug dump restore-object-report src/melee/mn/mnvibration.c --force
```

`restore-object-report` runs `ninja -n` first, refuses unexpectedly large
restore plans by default (`MWCC_DEBUG_RESTORE_MAX_STEPS`, default 64), and
uses the same timeout/process-group handling as auto-verify. Oversized
refusals include a dry-run preview and explain the common stale-metadata case:
if `worktree-doctor` reports `build/GALE01/report.json is older than
build.ninja`, there is no metadata-only repair for that generated
report/object state; run `python configure.py`, then retry the managed restore
or use `--force` only when you intentionally want the rebuild.

For `debug dump local --diff`, pass `--function` when the TU starts with static
inline helpers or when you want a non-first function. If `--diff` infers a
first function that is absent from `report.json`, it prints a targeted
`--function` hint instead of falling through to a confusing `checkdiff` error.

If `MWCC_DEBUG_HANG_TIMEOUT` kills a local compile, `debug dump local` exits
124 even if it wrote a partial dump, so scripts do not treat the partial as
valid.

## Utilities

```bash
melee-agent debug util patterns
melee-agent debug util patterns decl-order
melee-agent debug util name-magic build/GALE01/src/melee/mn/foo.o --map @123=lbl_804D0000
melee-agent debug util verify-name-magic -f fn_80247510
```

### Useful env-var overrides

| Var | Default | What |
|-----|---------|------|
| `MWCC_DEBUG_HOST` | `nzxt-local` | SSH alias for the Windows machine |
| `MWCC_DEBUG_REMOTE_SCRIPT` | `C:\Users\mikes\code\mwcc_debug\run_pcdump.ps1` | Remote script path |
| `MWCC_DEBUG_REPO` (set on remote) | `C:\Users\mikes\code\melee` | Remote repo path |
| `MWCC_DEBUG_TIMEOUT_SECS` (passed to remote) | 60 | Per-compile timeout |
| `MWCC_DEBUG_RESTORE_TIMEOUT` | 180 | Auto-verify/restore cleanup timeout (falls back to `MWCC_DEBUG_HANG_TIMEOUT`) |
| `MWCC_DEBUG_RESTORE_MAX_STEPS` | 64 | Max `ninja -n` restore steps before managed cleanup refuses without `--force` |

## Workflow: register-cascade investigation

Diff the BEFORE/AFTER REGISTER COLORING passes between a matched sibling function and the stuck one:

1. Identify the TU and a matched function in it. (Any same-file function that's at 100% works as a baseline.)

2. Dump:
   ```bash
   melee-agent debug dump local src/melee/<module>/<file>.c --output /tmp/<file>.txt
   ```

3. In the dump, find the matched fn's `AFTER REGISTER COLORING` block. Note the virtual→physical register mapping pattern.

4. Find the unmatched fn's `AFTER REGISTER COLORING` block. Diff the mappings. Look for:
   - Same-shape virtual registers (e.g. `r32` first-defined here, used there) mapped to different physical registers
   - Different basic-block boundaries between matched and unmatched
   - Different instruction order within blocks (suggesting scheduling decisions diverged)

5. Use that signal to inform C-source changes — usually adding/removing intermediate variables or reordering declarations to nudge the allocator.

For front-end investigation (why did the IR look different in the first place), pair with `/mwcc-inspect` on the same TU.

## Output sample

```
Starting function lbArq_80014ABC
--------------------------------------------------------------------------------
Removing unreachable code at: 1
*****************
Dumps for pass=0
*****************

BEFORE GLOBAL OPTIMIZATION
lbArq_80014ABC
:{0005}::::LOOPWEIGHT=0
B0: Succ={B1 } Pred={} Labels={L0 }

:{0004}::::LOOPWEIGHT=0
B1: Succ={B2 } Pred={B0 } Labels={L1 }

    mr      r32,r3

:{0004}::::LOOPWEIGHT=0
B2: Succ={B3 } Pred={B1 } Labels={L2 }

    lwz     r3,4(r32); fIsPtrOp

:{0006}::::LOOPWEIGHT=0
B3: Succ={} Pred={B2 } Labels={L3 }


AFTER COPY PROPAGATION
lbArq_80014ABC
...
AFTER REGISTER COLORING
lbArq_80014ABC
B0: Succ={B1 } Pred={} Labels={L0 }

B1: Succ={B3 } Pred={B0 } Labels={L1 }

    lwz     r3,4(r3); fIsPtrOp
...
```

## Limitations

- Back-end only. Use `/mwcc-inspect` for parsed expression trees,
  ObjObjects, and front-end structure.
- One translation unit at a time. Remote mode serializes through the
  Windows wrapper lock; local mode uses per-invocation dump paths.
- Dumps are large. Prefer cached dumps or `--output` over streaming.
- Remote mode sees the remote checkout, not uncommitted local changes.

## See also

- Workflow doc: [docs/mwcc-debug.md](../../docs/mwcc-debug.md)
- Upstream tool: https://github.com/Savestate2A03/mwcc_debug
- Sister skill: `/mwcc-inspect`
