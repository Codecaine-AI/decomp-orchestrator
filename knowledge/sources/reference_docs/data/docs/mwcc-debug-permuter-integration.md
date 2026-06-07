# mwcc-debug ↔ decomp-permuter integration

Implementation notes for the integration. Captures what's shipped,
where the friction points are, and what v2/v3 would look like.

## Important: there is NO patched permuter

`decomp-permuter` itself is unforked upstream. mwcc-debug provides
complementary CLI commands that:
1. **Inform** permuter (pre-run) by generating pattern-tuned config
2. **Filter** permuter output (post-run) by triaging real-tree match%

If a new agent is looking for "the augmented permuter binary," they
won't find one. Direct them at the three commands below.

## Tier 0 (shipped — basic integration)

### `melee-agent debug permute verify <candidate.c> -f FN [--keep]`

Apply ONE permuter candidate to the real source tree and report
whether match% actually improves. Removes the "permuter score=1320 but
actual checkdiff shows no change" cycle by always recompiling against
the real (non-preprocessed) source.

### `melee-agent debug permute triage <perm-dir> -f FN [--apply-best] [--top N]`

Batch version. Iterates every `output-NNNN-N/source.c` in a permuter
session output, applies each to the real tree, builds, reads match%
from `report.json`, and produces a ranked list of which candidates
actually improve real-tree match%.

Per-candidate cost: ~5-10 seconds (one ninja per .c + report.json
regen). For a typical permuter session with ~100 winners, total triage
time is a few minutes.

## Tier 1 (shipped — pattern-tuned config)

### `melee-agent debug permute config -f FN [options]`

Generates a `<perm_root>/nonmatchings/<fn>/settings.toml` whose
`[weight_overrides]` are tuned to mwcc-debug's pattern detection.
Saves the agent from hand-tuning weights per function.

Pattern → weight-boost mapping (from `patterns.py`):

| Pattern | Boosted mutations | Why |
|---------|-------------------|-----|
| `decl-order` | reorder_decls=80, temp_for_expr=30, ins_block=20 | Direct decl moves + intermediate decls in new positions |
| `alias-split` | temp_for_expr=60, refer_to_var=30, expand_expr=15 | Fresh-local extraction shortens live ranges |
| `widen-u8-to-u32` | randomize_internal_type=50, cast_simple=30 | Type changes for promotion-mask elimination |
| `shrink-s32-to-u8` | randomize_internal_type=50, cast_simple=30 | Mirror of widen |
| `drop-variadic-cast` | cast_simple=60, expand_expr=30 | Remove explicit (f32) casts |
| `subexpr-extract` | temp_for_expr=80, expand_expr=30 | Pull subexpressions into named locals |
| `chained-init` | chain_assignment=50, duplicate_assignment=20 | `a = (b = 0)` style |
| `param-iter-ceiling` | (refuses to generate) | Tier 6 — no C-source fix exists |

Detection: scores against `--target` (a YAML/JSON spec, typically
produced by `debug target derive`); the highest-severity suggestion's
category determines the pattern. With no target, falls back to stock
settings unless `--pattern` is given.

Special case for `param-iter-ceiling`: the command refuses to generate
a config and instead prints "this is Tier 6 — permuter cannot fix it,
use `debug target match-iter-first` instead." Pass `--force` to override.

For `decl-order`: also prints a recommendation to try
`debug mutate decl-orders` first, which is deterministic and ~100x faster
than letting permuter rediscover decl-order via random mutation.

### Workflow

```bash
# 1. Generate a tuned config
melee-agent debug permute config -f my_stuck_fn \
    --target target.json

# 2. Run permuter (unmodified upstream)
cd ~/code/decomp-permuter
./permuter.py nonmatchings/my_stuck_fn --threads 8

# 3. Triage winners against the real tree
cd ~/code/melee
melee-agent debug permute triage \
    ~/code/decomp-permuter/nonmatchings/my_stuck_fn -f my_stuck_fn

# 4. Apply the best confirmed winner
melee-agent debug permute triage \
    ~/code/decomp-permuter/nonmatchings/my_stuck_fn -f my_stuck_fn \
    --apply-best
```

## Tier 2 (shipped — per-iteration mwcc-debug scoring)

### `melee-agent debug permute run -f FN [--blend α]`

Runs decomp-permuter with a monkey-patched scorer that blends
`melee-agent debug target score-source` (IGNode-distance from pcdump) into
objdiff's byte-distance scoring. Per-iteration, the candidate source
is compiled via local `wibo + mwcceppc_debug.exe` and scored against
a derived target.

Final score blend: `bytes + α * mwcc` (default α = 0.1). Byte distance
stays dominant; the mwcc signal breaks ties between byte-equivalent
candidates — most useful for register-cascade ceilings where the byte
scorer can't distinguish many mutations.

Prerequisites (in addition to Tier 0/1):
- `melee-agent debug dump setup` (one-time wibo + DLL + compiler patch)
- `<perm-root>/nonmatchings/<FN>/` exists (run `import.py` first)
- compile.sh fixed for mac (`melee-agent debug permute fix-compile <perm_dir>`
  — auto-applied by `debug permute config`)

Workflow:

```bash
# 1. Tune permuter weights for the function's detected pattern
#    (also auto-fixes compile.sh for mac+wine)
melee-agent debug permute config -f my_stuck_fn

# 2. Run permuter with mwcc-debug blending. Target auto-derived.
melee-agent debug permute run -f my_stuck_fn --blend 0.05

# 3. Triage winners against the real tree as usual
melee-agent debug permute triage \
    ~/code/decomp-permuter/nonmatchings/my_stuck_fn -f my_stuck_fn
```

### Implementation notes

- Built on `tools/melee-agent/scripts/permute_with_mwcc.py`, a thin
  monkey-patch wrapper around upstream `permuter.py`. No fork of
  decomp-permuter needed.
- Single-threaded by default (`-j 1`). Our DLL writes pcdump.txt to
  project root, so parallel threads would race. Per-thread output
  handling deferred.
- The scoring path uses `debug target score-source --cflags-from <unit>` so a
  candidate staged at `nonmatchings/.permuter_score_<pid>.c` gets
  compiled with the original TU's flags — no need to fake a ninja
  build block for the staged file.
- On scoring failure (timeout, parse error, etc.), we fall back to
  the plain objdiff score so permuter never blocks on our infrastructure.

### When NOT to use it

- Pure byte-distance cases (functions where the byte scorer is doing
  fine, like first-pass decomp under 70%). Tier 2's marginal value is
  on the last mile — 95%+ match where byte distance has flatlined.
- Pattern-targeted searches that converge in <100 iterations.
  `debug mutate decl-orders` is still faster for decl-reorder, and Tier 1's
  weight tuning often gets there in a few hundred iterations without
  needing Tier 2.

## Tier 2.5 (shipped — permuter harvest mode for simplify-order)

### `melee-agent debug mutate simplify-order -f FN --want-first ... --with-permuter`

Adds permuter-generated candidates to `simplify-order`'s variant stream
without launching permuter itself. The user runs permuter separately
(typically `./permuter.py nonmatchings/FN` against an unmodified upstream
clone), and `--with-permuter` walks `<perm_root>/nonmatchings/FN/output-*/source.c`
to harvest each candidate as a `SourceVariant`.

Compose with the existing 3 primitive adapters (`decl_orders_source`,
`insert_alias_source`, `type_change_source`); cross-source dedup is
handled by the search driver, so the same byte-identical candidate is
never compiled twice even if it shows up via multiple adapters.

```bash
# 1. Run permuter against the function (one-time per session, hours-long).
cd ~/code/decomp-permuter
./permuter.py nonmatchings/grVenom_80204284 --threads 8

# 2. Re-run simplify-order with harvest mode.
cd ~/code/melee
melee-agent debug mutate simplify-order \
    --fn grVenom_80204284 --want-first '42,32' --with-permuter

# 3. (Optional) Point at a non-standard perm dir.
melee-agent debug mutate simplify-order \
    --fn grVenom_80204284 --want-first '42,32' --with-permuter \
    --permuter-dir /tmp/some_other_perm_dir
```

If no permuter output is found, the command emits a one-line hint
("`run ./permuter.py nonmatchings/<fn>` first") on stderr and continues
with the three primitive adapters. The brute-force MVP doesn't
orchestrate the permuter run itself — auto-run is a possible follow-up,
but harvest mode is enough to validate the variant-stream + permuter
combination.

### Why "harvest only"?

Launching permuter from the simplify-order CLI is an orchestration
concern of its own (process lifecycle, parallelism, output dir naming).
Keeping the MVP focused on harvesting lets agents and humans iterate
on the variant-stream architecture quickly and verify cross-source dedup
works end-to-end before adding any orchestration complexity.

Composition with custom scorers (telling permuter to use simplify-order
prefix-match as its scoring criterion) is the next planned step. With
harvest mode in place, that work can layer cleanly on top: the same
adapter would just point at a richer pool of permuter candidates.

## Remote CPU runs

For long CPU-bound permuter runs, `debug permute remote` can submit the
function's permuter directory to an existing SSH-accessible Ubuntu instance and
start a detached tmux job:

```bash
melee-agent debug permute remote targets
melee-agent debug permute remote doctor --target coder64 -f my_stuck_fn
melee-agent debug permute remote doctor --target coder64 -f my_stuck_fn --repair
melee-agent debug permute remote submit -f my_stuck_fn --target coder64
melee-agent debug permute remote status my_stuck_fn-coder64-YYYYMMDD-HHMMSS
melee-agent debug permute remote fetch my_stuck_fn-coder64-YYYYMMDD-HHMMSS
```

Targets are configured locally in `~/.config/decomp-me/permuter-remotes.toml`.
The remote host must already have a Melee checkout, a decomp-permuter checkout,
`rsync`, and `tmux`; SSH connection is enough to wake idle Coder instances.
Remote commands are run through `sh -lc`, so Coder instances whose login shell is
`fish` or `zsh` still use POSIX shell syntax for the submitted job.

Example target config:

```toml
[target.coder3]
ssh = "mike-grimes-dev-3.coder"
remote_melee_root = "/home/discord/melee"
remote_perm_root = "/home/discord/decomp-permuter"
threads = 32
session_prefix = "melee-perm"
```

Before submitting, import/configure the function locally so
`<perm_root>/nonmatchings/<fn>/` exists and has Ubuntu-ready `compile.sh` and
`settings.toml`:

```bash
melee-agent debug permute import -f my_stuck_fn
melee-agent debug permute fix-compile ~/code/decomp-permuter/nonmatchings/my_stuck_fn
melee-agent debug permute remote doctor -f my_stuck_fn --target coder3
melee-agent debug permute remote submit -f my_stuck_fn --target coder3 --threads 32
```

`remote doctor` is read-only. It checks for the failure modes that are easy to
miss before a long run: stale temporary target roots, missing `rsync`/`tmux`,
missing remote checkouts, the Python interpreter used by `permuter.py` lacking
`toml`, missing Linux `wibo`, missing MWCC, missing remote `melee-agent`, and
local `/Users/...` path leaks in `compile.sh`, `settings.toml`, or nearby YAML
scorer config files. It exits nonzero if any required check fails.

When the local `settings.toml` has a `[scorer]` section, `remote doctor -f`
also validates the custom scorer path. It requires the local scorer `--target`
to be an absolute remote path, confirms the remote decomp-permuter checkout has
`CustomCommandScorer` support, runs the scorer executable with `--help` from the
remote permuter root to catch cwd-sensitive wrappers, and checks that the remote
target YAML exists. This catches the common failure where an older remote
decomp-permuter silently falls back to objdump scoring or where `melee-agent`
imports the wrong `src` package from inside decomp-permuter.

Use `remote doctor --repair` when a Coder instance is stale or only partially
bootstrapped:

```bash
melee-agent debug permute remote doctor -f my_stuck_fn --target coder3 --repair
```

Repair mode is explicit; plain `remote doctor` remains read-only. `--repair`
syncs repo-owned tooling to the configured remote roots, refreshes
`tools/melee-agent`, `tools/mwcc_debug`, MWCC debug compiler files, the
decomp-permuter checkout, and the function directory used by custom scorer
targets. It also installs the known `melee-agent` Python runtime dependencies
with `pip install --user`, downloads the Linux `wibo-x86_64` binary if needed,
and rewrites `$HOME/.local/bin/melee-agent` so it imports from the remote
`tools/melee-agent` directory regardless of the current working directory.
It does not use `sudo` or install OS packages such as `tmux`, `rsync`, or
`python3`; those still report as doctor failures if absent.

Remote submit currently supports stock decomp-permuter mode. Each job is copied
into an isolated remote run directory under
`<remote_perm_root>/remote-runs/<job>/nonmatchings/<fn>/` and launched detached
in tmux. Local job metadata is stored under
`~/.config/decomp-me/permuter-jobs/`.

Fetched outputs land back under the local function directory:

```text
<perm_root>/nonmatchings/<fn>/remote-runs/<job>/
├── output-*/source.c
└── remote-run/
    ├── metadata.json
    └── permuter.log
```

Use `fetch --triage` to print the follow-up local triage command, or run
`melee-agent debug permute triage <fetched-run-dir> --function <fn>` manually.

## Tier 3 (shipped — targeted mutations + multi-start)

Where Tier 2 says "evaluate candidates better," Tier 3 says "generate
better candidates to start with." Given a stuck function, the agent
identifies WHICH variable is blocking via the new symbol bridge, then
applies targeted mutations (type-change, alias-split) directly on that
variable. Each mutation becomes a permuter starting point.

### Primitives (each also a CLI command)

| Command | Purpose |
|---|---|
| `debug inspect var-to-virtual -f FN <var>` | Predict MWCC virtual for a source variable name |
| `debug inspect virtual-to-var -f FN <ig_idx>` | Inverse lookup |
| `debug mutate type-change -f FN --var V --type T` | Change a local's declared type |
| `debug mutate insert-alias -f FN --var V --at N` | Alias before N-th reading statement |
| `debug mutate search -f FN` | Multi-start orchestrator (plans + materializes seeds) |

### Workflow

```bash
# 1. Identify the blocker
melee-agent debug inspect guide -f my_stuck_fn

# 2. Plan + materialize seeds
melee-agent debug mutate search -f my_stuck_fn --budget 5

# 3. For each tier3_seed_<i>/ that compiled, run permuter (Tier 2)
for seed in ~/code/decomp-permuter/nonmatchings/my_stuck_fn/tier3_seed_*; do
    melee-agent debug permute run -f my_stuck_fn \
        --perm-root ~/code/decomp-permuter \
        --blend 0.05
done
```

### Calibration + confidence

The symbol bridge reports confidence per binding: `best-guess`,
`verified`, `rejected`, `ambiguous`, `unsupported`. The orchestrator
skips bindings with `ambiguous`/`unsupported`/`rejected`. If
`debug mutate search` reports "all seeds failed to compile," the bridge is
likely wrong for that function — `debug inspect var-to-virtual` lets you
inspect the mappings interactively.

### Tracking Tier 3 matches

Commits where `debug mutate search` produced the winning seed should include:

```
Tier3-Search: <seed-description>
```

as a trailer (analogous to `Co-Authored-By:`). A future
`debug tier3-stats` can count via `git log --grep "Tier3-Search:"`.

## How to use with decomp-permuter

Upstream decomp-permuter doesn't have a `--scorer` flag at the moment.
The integration is post-hoc:

```bash
# Run permuter as normal — let it find winners against objdiff bytes
./permuter.py path/to/permute_dir --threads 8

# Permuter writes winning candidates to nonmatchings/* (or similar).
# Triage them against the real tree:
melee-agent debug permute triage permute_dir/nonmatchings -f my_stuck_fn

# If a winner transfers, apply it:
melee-agent debug permute triage permute_dir/nonmatchings -f my_stuck_fn \
    --apply-best
```

The triage step is what catches the base.c-vs-real-tree drift the
agent's session noted.

## Why per-iteration integration is deferred

The natural v2 — plugging `melee-agent debug target score-dump` into a permuter
`--scorer` flag for per-candidate IGNode-distance scoring — requires
either:

1. A pcdump per candidate. Each pcdump is ~30 seconds (SSH to
   nzxt-local, run mwcceppc with debug DLL, stream output back). At
   1000+ permuter candidates per session, that's 8+ hours of pcdumps.
2. A local IGNode estimator built from objdump output instead of
   pcdump. Possible but loses some of what pcdump provides (e.g.
   SIMPLIFY GRAPH events, COLORGRAPH DECISIONS per-iter data).

For now, v1 (post-hoc triage) gets ~90% of the value at ~1% of the
cost. v2 makes sense once the project is consistently running 1000+
iteration permuter sessions on the few remaining stuck functions.

## v2 design sketch (when warranted)

If/when v2 is needed:

1. **Local mwcc invocation.** Build a path-of-least-resistance way to
   run mwcceppc locally with debug DLL output (e.g., wibo +
   rosetta) — the current SSH workflow is too slow for the inner loop.
2. **Custom scorer wrapper.** A shell/Python wrapper that takes a .o
   path (what permuter's `--scorer` would pass), generates the pcdump
   for that .o, and runs `debug target score-dump`. Wraps the SSH or local
   invocation transparently.
3. **decomp-permuter patch.** Add `--scorer-command <cmd>` to the
   permuter CLI that invokes the wrapper instead of the default
   objdiff-bytes scorer.
4. **Score weight tuning.** Likely needs the IGNode-distance to be the
   PRIMARY signal (high weight) and bytes a SECONDARY signal (low
   weight). Current default weights are byte-primary, which is the
   right starting point.

## v3 design sketch (research-grade)

A truly "guided" permuter that knows about MWCC's pipeline:

- Mutation engine biased by analyze output: if the wrong virtual is
  r36 with target r31, prefer mutations that change r36's live range
  or its IG-neighbors' lifetimes
- Decl-order enumeration as a first-class mutation strategy (overlaps
  with our `debug mutate decl-orders` command)
- Pattern catalog awareness — when permuter sees a stuck virtual with
  no direct blocker, prefer the decl-order mutation family

This is well beyond MVP scope and would best live in a separate tool
rather than as a permuter patch.

## Files in this repo

- `tools/melee-agent/src/cli/debug.py` — `debug permute verify`,
  `debug permute triage`, `debug target score-dump`,
  `debug target derive`, `debug inspect guide` commands
- `tools/melee-agent/src/mwcc_debug/scoring.py` — score function +
  ScoreWeights + derive_target_from_function
- `tools/melee-agent/src/mwcc_debug/source_patch.py` — function-body
  extraction/replacement (used by `debug permute verify` and
  `debug permute triage`)

## Files NOT in this repo (potential v2)

- A vendored or forked `decomp-permuter` with the `--scorer-command`
  hook. Currently you'd patch it manually if you wanted to try v2.
