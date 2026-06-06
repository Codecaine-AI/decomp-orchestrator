# mwcc-debug local setup (macOS+wibo)

How to run mwcc_debug pcdumps locally on macOS instead of via SSH to a
Windows host. Cuts per-pcdump time from ~30s to ~1s, which makes
per-iteration permuter scoring (Tier 2) viable.

## Prerequisites

- macOS (Apple Silicon or Intel; this guide is Apple Silicon)
- Homebrew Python (3.10+)
- CMake (`brew install cmake`)
- Git

## Step 1: clone melee-harness adjacent

We depend on Luke Champine's patched wibo fork
(<https://github.com/lukechampine/melee-harness>) for two macOS-specific
fixes that aren't upstream:

- `macros.S`: SIGBUS fix on `@NNN` scratch temps in `formatoperands`
- `loader.cpp`/`main.cpp`: relocation fix for nested PE binaries
  (`sjiswrap.exe → mwcceppc.exe`)

```bash
cd ~/code   # or wherever melee lives — keep them sibling
git clone https://github.com/lukechampine/melee-harness
cd melee-harness
```

## Step 2: build wibo only

The full `./setup.sh` also builds objdiff-cli (needs Rust 1.88+) and
luke's mwcc_debug DLL — we don't need either. Just wibo:

```bash
cd ~/code/melee-harness/wibo
env -u VIRTUAL_ENV -u PYTHONHOME cmake --preset release-macos \
    -DPython3_EXECUTABLE=/opt/homebrew/bin/python3
env -u VIRTUAL_ENV -u PYTHONHOME cmake --build --preset release-macos

# Install into bin/ where melee-agent expects it
mkdir -p ~/code/melee-harness/bin
cp build/release/wibo ~/code/melee-harness/bin/wibo
```

If you don't put it at `~/code/melee-harness/bin/wibo`, set
`MWCC_DEBUG_WIBO=<path>` to point at it.

## Step 3: run setup-local

This builds the mwcc_debug DLL (via Zig 0.16.0, auto-downloaded by
`tools/mwcc_debug/build_macos.sh`), patches `mwcceppc.exe` →
`mwcceppc_debug.exe`, and deploys the DLL next to the compiler:

```bash
cd ~/code/melee
melee-agent debug setup-local
```

Output should be:

```
[ok] wibo: /Users/.../melee-harness/bin/wibo
[ok] DLL:  /Users/.../melee/tools/mwcc_debug/MWDBG326.dll
[ok] compiler patched: /Users/.../build/compilers/GC/1.2.5n/mwcceppc_debug.exe
[ok] DLL deployed:     /Users/.../build/compilers/GC/1.2.5n/MWDBG326.dll

Setup complete.
```

The stock `mwcceppc.exe` is unchanged — only the new `mwcceppc_debug.exe`
copy imports our DLL.

## Step 4: use it

```bash
melee-agent debug pcdump-local src/melee/mn/mnvibration.c
# → wrote: build/mwcc_debug_cache/melee/mn/mnvibration.txt (~1 second)
```

All our env-var hooks pass through via the matching CLI flags:

```bash
melee-agent debug pcdump-local src/melee/mn/mnvibration.c \
    --force-iter-first 132,47,45,134 \
    --force-iter-first-fn mnVibration_80247510
# → pcdump shows [FORCE_ITER_FIRST] moved ig_idx ... entries
```

The output is byte-equivalent to what `melee-agent debug pcdump` (SSH
path) produces, including our custom hook events (COLORGRAPH DECISIONS,
SIMPLIFY GRAPH, IG CONSTRUCTED). Downstream commands (analyze, score,
rank-callees, match-iter-first, etc.) all work against the local
pcdump unchanged.

## Why both pcdump and pcdump-local exist

- **`pcdump-local`** is the default for new agents on macOS. Fast,
  reliable for the cases I've tested.
- **`pcdump`** (SSH) is the fallback when wibo has problems on a
  specific TU. Slower but covers files where wibo would hit a SIGBUS
  or the nested-PE bug.

We may eventually wire `pcdump-local` to auto-fallback to SSH on
failure (like `mwcc_dump.py` in melee-harness does between wibo and
Wine). For now, the two are explicit.

## How this enables Tier 2 permuter scoring

The 30s SSH RTT made per-iteration scoring impractical (1000+ permuter
iterations × 30s = 8+ hours). With local pcdump at ~1s, it's ~17
minutes for the same iteration count. That makes the IGNode-distance
scorer (`melee-agent debug score`) practical to wire into
`decomp-permuter` as a custom `--scorer` callback.

See `docs/mwcc-debug-permuter-integration.md` for the Tier 2 plan.

## Troubleshooting

**"wibo binary not found"** — run Step 2, or set `MWCC_DEBUG_WIBO`.

**"patched compiler not found"** — run `melee-agent debug setup-local`.

**Some specific function produces no pcdump.txt** — try the SSH path:
```bash
melee-agent debug pcdump src/melee/path/to/file.c
```
If SSH works but local doesn't, file an issue with the source file +
the wibo output.

**Multi-threaded permuter parallelism** — each wibo invocation runs in
its own process. Concurrency safety untested in this codebase; if it
turns out flaky, set `permuter.py --threads 1` for the affected
function or use the SSH path.
