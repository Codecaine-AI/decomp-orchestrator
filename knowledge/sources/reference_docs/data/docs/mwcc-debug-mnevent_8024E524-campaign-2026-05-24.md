# mwcc-debug Layer A validation: mnEvent_8024E524

Date: 2026-05-24

Function: `mnEvent_8024E524`

Source: `src/melee/mn/mnevent.c`

## Goal

Validate the Layer A `debug mutate simplify-order --triage` workflow on a
stuck menu function. The hoped-for shape was the same as the successful
`grVenom_80204284` campaign: prove a narrow allocator-order target, run a
custom-scorer harvest, then let integrated real-tree triage surface any
candidate whose actual match percentage improves.

## Preflight environment

The main checkout was left on `master` and not merged with the newer tooling
branch because it had unrelated dirty work in `src/melee/mn/mnmain.c`. The new
Layer A CLI was invoked from a temporary tools worktree at:

```text
/Users/mike/.codex/worktrees/mnevent-layera-tools
```

That worktree was at `origin/master` commit `1671a567b`, which contains the
`--triage` flag. Commands were run from `/Users/mike/code/melee` with:

```bash
PYTHONPATH=/Users/mike/.codex/worktrees/mnevent-layera-tools/tools/melee-agent \
  python -m src.cli ...
```

`python tools/worktree-doctor.py --fix` could not refresh
`build/GALE01/report.json` because the unrelated dirty `mnmain.c` does not
compile:

```text
src\melee\mn\mnmain.c:1423: ';' expected
```

The targeted `mwcc-debug` compiles for `src/melee/mn/mnevent.c` still worked,
so the preflight used `debug dump local --no-cache-sync` and integrated
`--diff` checks only.

## Baseline

Fresh targeted dump:

```bash
python -m src.cli debug dump local src/melee/mn/mnevent.c \
  --function mnEvent_8024E524 \
  --no-cache-sync \
  --output /tmp/mnEvent_8024E524_baseline.pcdump.txt \
  --keep-obj /tmp/mnEvent_8024E524_baseline.o \
  --diff
```

Current result:

- Match: 83.1% (`83.09%` via targeted `checkdiff.py` summary)
- Classification: stack-layout
- Current fingerprint matches prior attempt #60

This differs from the older automation-memory note that described the function
as 86.5% matched. The current checkout's real baseline is 83.09%.

The visible early symptom is still the expected r26/r27 swap:

```text
expected +020: addi r27,r3,0
current  +020: addi r26,r3,0

expected +04c: addi r26,r3,0
current  +04c: addi r27,r3,0
```

But the current diff is not limited to that swap. There is also substantial
later instruction-shape and stack-layout divergence, including a four-byte
function size difference.

## Allocator facts

`debug inspect analyze` on the baseline dump showed these relevant class-0
decisions:

```text
r32 -> r26  live 2..51
r38 -> r27  live 16..89
r40 -> r31
r37 -> r30
r42 -> r28
```

The function's class-0 simplify order near the relevant nodes was:

```text
..., 42,41,39,38,36,35,34,33,32
```

So the obvious hypothesis was to make `r32` color before `r38`, or otherwise
force the local allocation to `r32 -> r27` and `r38 -> r26`.

## Force-proof attempts

All force attempts were run with `--force-iter-first-fn mnEvent_8024E524` or
`--force-phys-fn mnEvent_8024E524`, `--no-cache-sync`, and `--diff`.

| Force target | Result |
|---|---|
| `--force-iter-first 32,38` | 83.1%, mismatch |
| `--force-iter-first 38,32` | 83.1%, mismatch |
| `--force-iter-first 32,37` | 83.1%, mismatch |
| `--force-iter-first 37,32` | 83.1%, mismatch |
| `--force-iter-first 32,40` | 83.1%, mismatch |
| `--force-iter-first 40,32` | 83.1%, mismatch |
| `--force-iter-first 32,36` | 83.1%, mismatch |
| `--force-iter-first 36,32` | 83.1%, mismatch |
| Full local-prefix swap ending `...,39,32,38,36,35,34,33` | 83.1%, mismatch |
| Short local-prefix swap ending `...,39,32,38,36` | 83.1%, mismatch |
| `--force-phys gpr:32:27,gpr:38:26` | 83.1%, mismatch |
| `--force-phys-iter 0:40:26,0:45:27` | 83.1%, mismatch |

The direct physical swap did apply in the forced dump:

```text
iter 40 ig_idx 38 -> r26
iter 45 ig_idx 32 -> r27
```

Even with that local swap forced, the integrated diff stayed at the same
83.1% fingerprint. That means the advertised r26/r27 symptom is real, but it
is not sufficient to improve the actual function match in this checkout.

## Decision

No force-proven simplify-order target was found. Per the campaign brief, this
means `mnEvent_8024E524` should not proceed to custom-scorer setup or an
overnight permuter run yet. A Layer A `--triage` validation run would be poorly
posed here because there is no demonstrated allocator target for the scorer to
optimize.

The current evidence points to a broader source-shape or stack-layout problem
where the r26/r27 allocation is one visible downstream symptom, not the
primary unlock. The next useful step for Layer A validation is to pick a
function with a force-proven target, such as the next candidate mentioned in
the brief (`mnEvent_8024D5B0`), rather than spending a custom-scorer overnight
budget on this function.

## Layer A validation verdict

Layer A was not validated on `mnEvent_8024E524` because the Phase 1 preflight
failed its gating condition. The preflight itself was useful: it prevented a
misleading campaign by showing that a local r26/r27 allocator swap does not
move real-tree match percentage.

One UX note for the future Layer B orchestrator: it should preserve this
explicit gate. Before queueing permuter, require a force-proof result that
improves actual match percentage, not just a plausible allocator-table symptom.
