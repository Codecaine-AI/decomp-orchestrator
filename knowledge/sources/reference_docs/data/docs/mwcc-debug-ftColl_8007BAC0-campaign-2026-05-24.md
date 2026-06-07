# mwcc-debug Layer A validation: ftColl_8007BAC0

Date: 2026-05-25

Function: `ftColl_8007BAC0`

Source: `src/melee/ft/ftcoll.c`

## Goal

Validate the Layer A `debug mutate simplify-order --triage` workflow on a
clean register-allocation candidate. The screening result said this function
was the right Class A target after `mnEvent_8024E524` failed preflight:

- Baseline match: 98.96%
- Classification: register-allocation
- Diff shape: pure r30/r31 swap in the loop body
- Force proof: `--force-phys-iter "0:13:31,0:9:30"` reaches byte-exact match
- Intended scorer target: `--want-first 37,41`, class 0

The validation question was whether Layer A's integrated `--triage` path would
surface a 100% candidate automatically, with a `*** FIX FOUND ***` banner,
instead of requiring a grVenom-style manual translation survey.

## Environment

The main checkout stayed on `master`. It still had unrelated dirty work in
`src/melee/mn/mnmain.c`, so full `python configure.py && ninja` /
`build/GALE01/report.json` refresh remained blocked by that file. Targeted
`ftcoll.o` and `mwcc-debug` compiles worked.

The installed `/opt/homebrew/bin/melee-agent` did not expose the new Layer A
commands from `1671a567b`, so this campaign used the temporary tools worktree:

```text
/Users/mike/.codex/worktrees/mnevent-layera-tools
```

A small untracked wrapper was created under the ignored permuter workspace:

```text
/Users/mike/code/melee/nonmatchings/bin/melee-agent-layera
```

It invokes the Layer A CLI via `PYTHONPATH` and lets decomp-permuter call the
custom scorer without changing the editable `/opt/homebrew/bin/melee-agent`
install.

`python tools/worktree-doctor.py --fix` was run and failed only at the known
unrelated `mnmain.c` syntax error.

## Setup

Baseline pcdump:

```bash
python -m src.cli debug dump local src/melee/ft/ftcoll.c \
  --function ftColl_8007BAC0 \
  --output build/mwcc_debug_cache/melee/ft/ftcoll.txt
```

Target asm import:

```bash
python -m src.cli extract get ftColl_8007BAC0 \
  --full \
  --output /tmp/ftColl_8007BAC0.s

cd /Users/mike/code/decomp-permuter
.venv/bin/python import.py \
  /Users/mike/code/melee/src/melee/ft/ftcoll.c \
  /tmp/ftColl_8007BAC0.s \
  --function ftColl_8007BAC0
```

The case imported into:

```text
/Users/mike/code/melee/nonmatchings/ftColl_8007BAC0
```

Compile harness and scorer setup:

```bash
python -m src.cli debug permute fix-compile \
  /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0

python -m src.cli debug permute setup-simplify-order-scorer \
  -f ftColl_8007BAC0 \
  --want-first 37,41 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/ft/ftcoll.txt \
  --perm-root /Users/mike/code/melee \
  --melee-agent /Users/mike/code/melee/nonmatchings/bin/melee-agent-layera \
  --force
```

`permuter.py --debug` succeeded with base score `2000000`, confirming the
custom scorer was callable from decomp-permuter.

## Force proof

The screening force proof was rechecked:

```bash
python -m src.cli debug dump local src/melee/ft/ftcoll.c \
  --function ftColl_8007BAC0 \
  --no-cache-sync \
  --force-phys-iter "0:13:31,0:9:30" \
  --force-phys-fn ftColl_8007BAC0 \
  --diff
```

Result:

```text
--- MATCH: ftColl_8007BAC0 matches! ---
[diff] MATCH - function bytes are identical.
```

So the function remains a real allocator-swap case. The failure below is not
because the preflight target was impossible at the codegen level.

## Permuter run

Launched:

```bash
cd /Users/mike/code/decomp-permuter
.venv/bin/python -u permuter.py -j 4 \
  /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0
```

Log:

```text
/tmp/ftColl_8007BAC0_custom_scorer_20260525T063842Z.log
```

Stopped after the scorer showed a hard zero-output plateau:

- Iterations sampled: 3,112
- Compile failures: 103
- Saved outputs: 0
- Base score: `2000000`
- Best finite score observed: `2000000`
- No mutation scored below baseline

The run was healthy in the sense that candidates compiled and scored. It just
never produced a lower score for this target.

## Layer A triage run

The integrated command was run while the permuter pool was still empty:

```bash
python -m src.cli debug mutate simplify-order \
  -f ftColl_8007BAC0 \
  --want-first 37,41 \
  --class 0 \
  --with-permuter \
  --triage \
  --max-candidates 2000
```

Log:

```text
/tmp/ftColl_8007BAC0_triage_20260525T064543Z.log
```

Result:

- `--with-permuter` correctly warned that no `output-*` candidates existed.
- `--triage` correctly reported that no permuter dir was available to triage.
- Primitive adapters compiled 22 variants.
- Compile failures: 0
- Gate rejected: 15
- Progress hits: 0
- Gate-rejected prefix distribution: prefix 0 = 15, prefix 2 = 0

No `*** FIX FOUND ***` banner appeared because there was no real candidate
pool and no primitive variant made progress.

This is a useful UX behavior for an empty pool: the command does not crash and
the warning is clear. It is not a successful Layer A validation because the
workflow never produced a candidate for triage to rank.

## Why the scorer did not produce candidates

Direct scorer breakdown on permuter `base.o`:

```bash
/Users/mike/code/melee/nonmatchings/bin/melee-agent-layera \
  debug target score-simplify-order \
  --function ftColl_8007BAC0 \
  --target /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0/simplify_order_target.yaml \
  /tmp/ftColl_8007BAC0_base.o \
  --breakdown
```

Output:

```text
Function:          ftColl_8007BAC0
Score:             2000000
Target prefix:     [37, 41]
Observed prefix:   [-1, -1]
Common prefix:     0 / 2
Precolor distance: 0
```

The single-function permuter pcdump shows the issue clearly:

```text
SIMPLIFY GRAPH (class=0)
iter  ig_idx
0     -1
1     -1
...
9     -1      SPILLED
...
13    -1

COLORGRAPH DECISIONS (class=0)
iter  ig_idx  assignedReg
9     41      r31
13    37      r30
```

The force proof operates on COLORGRAPH iteration positions
(`0:13:31,0:9:30`), but Layer A's simplify-order scorer reads the simplify
graph prefix. In this case the relevant colorgraph nodes correspond to
`-1` simplify entries, so the scorer sees `[-1, -1]` instead of `[41, 37]`.

That means `--want-first 37,41` is not a well-formed scorer objective for this
SPILLED-node case. The permuter run did exactly what it was configured to do,
but the configured metric could not represent the force-proven target.

## Layer A validation verdict

Layer A was not validated on `ftColl_8007BAC0`.

The important finding is specific and actionable: `--triage` itself handled an
empty pool cleanly, but `setup-simplify-order-scorer` accepted a target that
the scorer could not observe because the relevant allocator decisions are
COLORGRAPH/SPILLED-node positions, not concrete simplify-graph `ig_idx`
prefix entries.

This was filed as tooling issue #83.

For Layer A to handle this class of function, it needs one of these fixes:

1. A scorer mode for COLORGRAPH iteration order or physical-iteration targets,
   not only simplify-graph `ig_idx` prefixes.
2. A setup-time validation that scores base once and warns when the observed
   prefix is `[-1, -1]` for a non-negative `--want-first` target.
3. A target derivation helper that converts force-phys-iter proofs into the
   scorer objective actually supported by the selected mode, or rejects the
   proof as unsupported.

Until then, Layer A is validated for grVenom-style concrete simplify-order
targets, but not for this SPILLED-node `ftColl_8007BAC0` target.

## Comparison to grVenom

The grVenom campaign showed why real-tree triage matters: simplify-order proxy
ranking missed the useful source candidate, while full-pool triage found the
100% match.

This campaign exposed a different boundary. Here the physical allocator proof
is clean and reaches 100%, but the current custom scorer cannot express the
same target. Triage cannot rescue an objective that produces no candidate
pool. Layer B should therefore include a preflight validation step that checks
the chosen scorer mode against the forced proof before launching a long
permuter run.

## Layer B implications

A campaign orchestrator should not accept `--want-first` blindly. Before
launching permuter, it should:

- Compile and score the imported `base.o`.
- Show the observed prefix from the exact permuter single-function pcdump.
- Refuse or warn when the target nodes are hidden behind `-1` SPILLED entries.
- Prefer a COLORGRAPH/phys-iter scorer for cases whose force proof is stated
  as `--force-phys-iter`.
- Still run `--triage` after candidates exist, because the command's empty-pool
  behavior was clear and decision-friendly.

## Re-validation with Fix A (2026-05-25)

Fix A landed in commit `5b4bd782f` and filters `-1` entries out of simplify
orders before prefix scoring. The intended result was that
`--want-first 37,41` would ignore placeholder rows and compare against the
first meaningful `ig_idx` entries.

The temporary Layer A tools worktree was updated from `1671a567b` to:

```text
5b4bd782f987fdb7085e75db4ae8f0dd0b0005d8
```

The existing permuter wrapper at
`/Users/mike/code/melee/nonmatchings/bin/melee-agent-layera` already points at
that tools worktree, so no scorer setup files needed to change.

Stale outputs were cleared:

```bash
rm -rf /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0/output-*
```

Baseline was recompiled through the existing wrapped `compile.sh`:

```bash
cd /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0
touch /tmp/ftColl_baseline.o
./compile.sh base.c -o /tmp/ftColl_baseline.o
```

Then the fixed scorer was checked directly:

```bash
/Users/mike/code/melee/nonmatchings/bin/melee-agent-layera \
  debug target score-simplify-order \
  --function ftColl_8007BAC0 \
  --target /Users/mike/code/melee/nonmatchings/ftColl_8007BAC0/simplify_order_target.yaml \
  /tmp/ftColl_baseline.o \
  --breakdown
```

Result:

```text
Function:          ftColl_8007BAC0
Score:             2000000
Target prefix:     [37, 41]
Observed prefix:   []
Common prefix:     0 / 2
Precolor distance: 0
```

This confirms Fix A is being picked up: the observed prefix is no longer the
literal placeholder pair `[-1, -1]`. However, it also shows Fix A is not
sufficient for this function. After filtering placeholders, the scorer sees no
meaningful simplify-order entries at all.

The fresh sidecar pcdump explains why:

```text
SIMPLIFY GRAPH (class=0)
iter  ig_idx
0     -1
1     -1
...
9     -1      SPILLED
...
13    -1
...
18    -1

COLORGRAPH DECISIONS (class=0)
iter  ig_idx  assignedReg
9     41      r31
13    37      r30
```

The meaningful allocator nodes still only appear in the COLORGRAPH decision
table, not in the simplify graph. Filtering `-1` rows removes the entire
simplify-order stream for this imported single-function case.

### Fix A verdict

Fix A resolves literal-position confusion for functions whose simplify graph
contains meaningful `ig_idx` rows after placeholder filtering. It does not
solve `ftColl_8007BAC0`, because this function's relevant force proof is
inherently COLORGRAPH/phys-iter based.

The 2-3 hour permuter run was not launched. The sanity check showed the scorer
still cannot differentiate candidates toward the force-proven objective, so a
long run would be expected to reproduce the previous zero-output plateau.

Tooling issue #83 remains the correct follow-up: Layer A needs either a
COLORGRAPH/phys-iter scorer mode or setup-time validation that rejects this
unsupported target shape before queueing permuter.
