# lbDvd_80018A2C Layer A campaign

## Step 0 confirmation

Brief-provided Step 0 result:

```text
Function:          lbDvd_80018A2C
Score:             2000000
Target prefix:     [46, 44]
Observed prefix:   [43, 42]
Common prefix:     0 / 2
Precolor distance: 0
```

This is a Layer A simplify-order shape: the observed prefix contains concrete
non-`-1` `ig_idx` values. The target nodes `46,44` are absent from the observed
prefix `[43,42]`, so this is not merely a reorder-existing-prefix case. A
successful mutation needed to bring different nodes into the first two
class-0 simplify positions.

## Setup commands run

Pulled current local `master` with the remote scorer doctor updates:

```bash
git merge master
```

Baseline debug setup and pcdump:

```bash
ninja build/compilers
melee-agent debug dump setup
mkdir -p build/mwcc_debug_cache/melee/lb
melee-agent debug dump local src/melee/lb/lbdvd.c \
  --function lbDvd_80018A2C \
  --output build/mwcc_debug_cache/melee/lb/lbdvd.txt
```

Local decomp-permuter import was done directly through `import.py`, not through
decomp.me:

```bash
ninja build/GALE01/src/melee/lb/lbdvd.o
cd /Users/mike/code/decomp-permuter
./.venv/bin/python import.py \
  /Users/mike/.codex/worktrees/2138/melee/src/melee/lb/lbdvd.c \
  /Users/mike/.codex/worktrees/2138/melee/build/GALE01/asm/melee/lb/lbdvd.s \
  --function lbDvd_80018A2C \
  --keep
```

The import wrote `nonmatchings/lbDvd_80018A2C` under the repo checkout. The
historical remote tooling expected `/Users/mike/code/decomp-permuter`, so the
function directory was exposed there and wired for the simplify-order scorer:

```bash
ln -sfn /Users/mike/.codex/worktrees/2138/melee/nonmatchings/lbDvd_80018A2C \
  /Users/mike/code/decomp-permuter/nonmatchings/lbDvd_80018A2C

melee-agent debug permute setup-simplify-order-scorer \
  -f lbDvd_80018A2C \
  --want-first 46,44 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/lb/lbdvd.txt
```

Remote target:

```bash
melee-agent debug permute remote doctor -f lbDvd_80018A2C --target coder1
```

After the updated tooling from `master`, doctor passed including the new custom
scorer checks:

- `local custom scorer`
- `local scorer target path`
- `remote custom scorer`
- `remote scorer command`
- `remote scorer target`

Remote run:

```bash
melee-agent debug permute remote submit \
  -f lbDvd_80018A2C \
  --target coder1 \
  --threads 16
```

Job:

```text
lbDvd_80018A2C-coder1-20260526-105524
```

The run was stopped and fetched after reaching the requested pool size:

```bash
melee-agent debug permute remote stop lbDvd_80018A2C-coder1-20260526-105524
melee-agent debug permute remote fetch lbDvd_80018A2C-coder1-20260526-105524
```

Before harvest, `report.json` was regenerated because the first harvest attempt
could not find the function in the report:

```bash
ninja build/GALE01/report.json
```

Layer A harvest and triage:

```bash
melee-agent debug mutate simplify-order \
  -f lbDvd_80018A2C \
  --want-first 46,44 \
  --class 0 \
  --with-permuter \
  --triage \
  --max-candidates 2000 \
  --permuter-dir /Users/mike/code/decomp-permuter/nonmatchings/lbDvd_80018A2C/remote-runs/lbDvd_80018A2C-coder1-20260526-105524
```

## Run summary

Remote permuter pool:

| Metric | Value |
|---|---:|
| Iterations | 230,967 |
| Errors | 7,341 |
| Saved outputs | 486 |
| Zero simplify-order score | no |

Layer A harvest:

| Metric | Value |
|---|---:|
| Compiled variants | 507 |
| Compile failures | 2 |
| Gate rejected | 499 |
| Progress hits | 0 |
| Triage elapsed | 259.0s |
| Baseline real-tree match | 99.53% |

Best simplify-order candidates all hit the requested prefix but were rejected by
the precolor gate. Top examples:

| Candidate | Prefix | Observed | Distance | Gate result |
|---|---:|---|---:|---|
| `output-251-1` | 2/2 | `46,44` | 251 | rejected: interference graph differs |
| `output-253-1` | 2/2 | `46,44` | 253 | rejected: interference graph differs |
| `output-254-1` | 2/2 | `46,44` | 254 | rejected: interference graph differs |
| `output-260-1` | 2/2 | `46,44` | 260 | rejected: interference graph differs |
| `output-261-1` | 2/2 | `46,44` | 261 | rejected: interference graph differs |

Gate-rejected simplify-order distribution:

| Prefix length | Candidates |
|---:|---:|
| 0 | 55 |
| 1 | 378 |
| 2 | 66 |

Real-tree triage found no candidate above baseline:

| Rank | Candidate | Real-tree match | Delta vs baseline | Simplify-order rank |
|---:|---|---:|---:|---:|
| 1 | `output-1000388-1` | 99.10% | -0.43% | 271 |
| 2 | `output-1000449-1` | 97.41% | -2.12% | 328 |
| 3 | `output-1000423-1` | 97.38% | -2.15% | 302 |
| 4 | `output-1000421-1` | 97.11% | -2.42% | 300 |
| 5 | `output-264-1` | 96.48% | -3.05% | 7 |

## Outcome

Outcome category: **NO PROGRESS**.

The custom scorer did find natural source variants where `46,44` become the
first two class-0 simplify positions. However, every such candidate disturbed
the precolor input shape, especially the interference graph, and real-tree
triage found no candidate above the 99.53% baseline.

## Diagnostic table

Diagnostic candidate: `output-251-1`, the best simplify-order candidate.

It was compiled locally through the permuter wrapper to generate:

```text
/tmp/lbDvd_output_251_1.o.pcdump.txt
```

| Input | ig_idx | SIMPLIFY GRAPH class-0 position | COLORGRAPH class-0 iter | Assigned phys | Coalesce alias |
|---|---:|---:|---:|---|---|
| baseline | 46 | 34 | 34 | `r10` | none |
| baseline | 44 | 36 | 36 | `r12` | none |
| `output-251-1` | 46 | 0 | 0 | `r4` | none |
| `output-251-1` | 44 | 1 | 1 | `r5` | none |

The candidate proves the mutator can bring absent target nodes into the prefix,
but it does so by changing allocator input rather than preserving the baseline
precolor shape. The assigned physical registers also change from the desired
volatile pair (`r10`,`r12`) to (`r4`,`r5`), which is consistent with the large
interference-graph disturbance reported by the gate.

## Time elapsed

- Remote run: 2026-05-26 10:55:24 PDT to 2026-05-26 13:19:19 PDT
- Remote run duration: about 2h 24m
- Local Layer A harvest and triage: 259.0s
- Writeup completed: 2026-05-26 13:33 PDT

## Surprises

- This was the "absent target nodes" sub-shape from the brief: successful
  simplify-order candidates introduced `46,44` into the prefix, rather than
  reordering `[43,42]`.
- Prefix success did not correspond to real-tree progress. The best
  simplify-order candidate reached `46,44` exactly but dropped to 96.48% real
  match and was rejected by the precolor gate.
- The volatile target physicals matter here: baseline assigns `46 -> r10` and
  `44 -> r12`, but the best prefix candidate assigns `46 -> r4` and `44 -> r5`.
  Moving the nodes to the front changed the coloring context enough that the
  desired caller-save choices did not survive.

## Retroactive pre-flight screen (2026-05-26)

After Phase 1 of deferred-debt #20 landed (the pre-flight polarity check
in `score-simplify-order --breakdown` + `--strict-polarity`), the
original lbDvd target was re-screened to confirm the check correctly
identifies the wrong-polarity case.

Target reconstructed from the original force-phys `44:10, 46:12`:

```yaml
function: lbDvd_80018A2C
simplify_order_target: [46, 44]
class_id: 0
baseline_dump: ...
force_phys:
  44: 10
  46: 12
```

Running `score-simplify-order --breakdown` against this target reports
`Polarity check: WRONG POLARITY` and hints at late-target syntax. Adding
`--strict-polarity` makes the check exit non-zero (code 2), which a
screening script would use to refuse the campaign before submitting to
the remote permuter.

**Empirical conclusion:** if `--strict-polarity` had existed at
screening time, the polarity check would have refused this campaign
before its 2.4-hour remote permuter run. The pre-flight extension
delivers on its design intent.

## Phase 3 validation campaign (2026-05-27)

After Phase 3 of deferred-debt #20 landed (`--want-late N,M` target
syntax), re-ran the `lbDvd_80018A2C` campaign with the late target to test
whether late simplify-order positioning can unlock the `r10`/`r12` volatile
assignment case.

Setup:

```bash
melee-agent debug dump local src/melee/lb/lbdvd.c \
  --function lbDvd_80018A2C \
  --output build/mwcc_debug_cache/melee/lb/lbdvd.txt

melee-agent debug permute setup-simplify-order-scorer \
  -f lbDvd_80018A2C \
  --want-late 46,44 \
  --class 0 \
  --baseline-dump build/mwcc_debug_cache/melee/lb/lbdvd.txt \
  --force-phys '44:10,46:12' \
  --force
```

Step 0 sanity check passed locally and remotely:

```text
Function:          lbDvd_80018A2C
Score:             2000000
Target suffix:     [46, 44]
Observed suffix:   [37, 32]
Common suffix:     0 / 2
Precolor distance: 0
  IG       +0 -0
  Coalesce +0 -0
  Spill    +0 -0

Coalesce preservation:    ALL TARGETS INDEPENDENT
Polarity check:           SAFE
```

Remote setup notes:

- `debug mutate simplify-order` now accepts `--want-late`, so the Layer A
  triage path is available.
- `remote doctor --repair` passed from a real
  `/Users/mike/code/decomp-permuter/nonmatchings/lbDvd_80018A2C` directory.
  The previous symlinked function dir was replaced with a real function import
  before repair/submission.

Remote run:

| Field | Value |
|---|---:|
| Job | `lbDvd_80018A2C-coder1-20260527-124327` |
| Target | `coder1` |
| Threads | 16 |
| Iterations | 275,101 |
| Compile/scoring errors | 23,081 |
| Permuter failures | 665 |
| Saved outputs | 0 |
| Best score below baseline | none |

The run was stopped and fetched after passing the requested 200-250K iteration
budget. It produced no `output-*` directories because no candidate scored below
the late-mode baseline score (`2,000,000`).

Layer A check:

```bash
melee-agent debug mutate simplify-order \
  -f lbDvd_80018A2C \
  --want-late 46,44 \
  --class 0 \
  --with-permuter \
  --triage \
  --max-candidates 2000 \
  --permuter-dir /Users/mike/code/decomp-permuter/nonmatchings/lbDvd_80018A2C/remote-runs/lbDvd_80018A2C-coder1-20260527-124327
```

Result:

| Metric | Value |
|---|---:|
| Permuter candidates to triage | 0 |
| Built-in variants compiled | 21 |
| Compile failures | 0 |
| Gate rejected | 15 |
| Progress hits | 0 |
| Best built-in suffix match | 0/2 |

The command reported:

```text
--triage: no candidate sources in ...; nothing to triage.
Target suffix:   46,44
Baseline order:  43,42,41,36,35,33,-1,-1...
No variants made progress beyond baseline.
```

Diagnostic:

| Input | ig_idx | SIMPLIFY GRAPH class-0 position | Distance from end | COLORGRAPH class-0 iter | Assigned phys | Coalesce alias |
|---|---:|---:|---:|---:|---|---|
| baseline | 46 | 34 | 7 | 34 | `r10` | none |
| baseline | 44 | 36 | 5 | 36 | `r12` | none |

The target nodes are already relatively late in baseline, but not in the final
two meaningful simplify-order slots and with the opposite physical assignment
from the force proof (`46 -> r12`, `44 -> r10`). The late scorer searched for
the suffix form that should make those high-volatiles reachable, but current
permuter mutations did not produce even a suffix `1/2` improvement in 275K
iterations.

**Outcome: C / no progress.** The `--want-late` target syntax works as a
scoring and triage mode, and the polarity check correctly treats this
high-volatile case as `SAFE` in late mode. For `lbDvd_80018A2C`, however, the
search neighborhood appears exhausted under current decomp-permuter mutations:
wrong-polarity `--want-first` could manufacture prefix hits that did not help
real-tree match, while correct-polarity `--want-late` could not produce any
saved suffix-improving candidates.

**Implications for the toolchain:** Phase 3 is validated as a safer target
syntax, but it does not unlock this function. Together with the `gm_80173EEC`
coalesce-preservation result, this points away from more same-shape scorer
refinements and toward richer source search: new mutation primitives,
source-corpus mining, or backwards inference.
