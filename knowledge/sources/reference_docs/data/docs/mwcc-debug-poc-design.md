# mwcc_debug PoC — Design

**Date:** 2026-05-16
**Status:** Proposed (Phase 1 only)
**Author:** itsgrimetime / Claude (brainstorming session)
**Related:** [docs/mwcc-pattern-book.md](mwcc-pattern-book.md) (mismatch patterns), [tools/checkdiff.py](../tools/checkdiff.py) (existing diff workflow)

## Goal

Evaluate whether [Savestate2A03/mwcc_debug](https://github.com/Savestate2A03/mwcc_debug) — a drop-in DLL replacement that unlocks Metrowerks CodeWarrior 1.2.5n's internal IR and codegen diagnostic logging — can break us out of register-allocation/last-mile matching dead-ends that the existing toolchain (`tools/checkdiff.py`, `mismatch-db`, `opseq`, `ghidra`, `ppc-ref`, `discord-knowledge`) can't.

The PoC ships the smallest possible workflow that can answer that question, with an explicit kill-switch so we don't sink time into infrastructure for a tool that turns out to be too noisy or wibo-incompatible.

## Background

### What mwcc_debug does

A 10 KB C-source replacement for `lmgr326b.dll` (the CW license-manager stub) that:

1. Patches a flag byte at VA `0x42C8E1` in `mwcceppc.exe` to force `debuglisting=1`
2. Installs `jmp` hooks over the empty `pclistblocks` stubs (the compiler's compiled-out diagnostic entry points)
3. Calls the still-intact `formatoperands` to dump every instruction in every basic block of every pass through the PPC backend
4. Writes output to `pcdump.txt` in the compiler's CWD

It targets **v1.2.5n specifically** (= `mwcc_233_163n`, our compiler). Other CW versions need re-locating those VAs.

### What the dump contains

| Section | Content |
|---|---|
| **IR optimizer log** | Per-event records: `Found propagatable assignment …`, `Found expression propagation at N from M`, dead assignment elimination, CSE, **loop unrolling decisions** (with reason codes like `LP_INDUCTION_NOT_FOUND`), variable range splitting with def/use sets |
| **PPC backend, 9 passes** | Every basic block (succ/pred/labels/flags/loopweight) and every instruction via `formatoperands` (symbol names, `HA()/LO()` relocs, alias annotations). **Virtual registers (r32+) before register coloring, physical (r3+) after** |

The "before vs after register coloring" diff is the headline feature for our use case: it shows exactly what physical-register choices the allocator made, instead of the trial-and-error we currently do with declaration order, intermediate variables, and `static inline` wrappers.

### Why this matters for our pain points

| Pain point | mwcc_debug helps? |
|---|---|
| Register allocation cascades (#1 cause of last-mile stalls per `MEMORY.md`) | **Yes** — direct visibility into the coloring decisions |
| Constant propagation surprises (e.g. `addi rX,rY,0` vs `li rX,0` from `i = count` propagation) | **Yes** — IR log literally names the propagation events |
| Inline heuristics (`-inline auto` surprises, `dont_inline` vs `auto_inline off`) | **Partial** — per-function dumps show whether callees got inlined |
| Stack frame layout / `PAD_STACK` decisions | **No** — these happen later in the pipeline |
| SDA-relocation type decisions | **No** — these are linker-stage relocations, not in the dump |

### Caveats up front

- **Windows-only build** in upstream — author uses MSVC x86 `cl.exe`.
- **Per-TU overwrite**: `pcdump.txt` races during parallel `ninja -j` builds.
- **No "expected" reference dump**: comparison needs a known-good baseline, which is circular for an unmatched function. The Phase 1 workflow side-steps this by comparing **two functions in the same TU** — one matched (baseline), one not.
- **Zero adoption signal**: no forks, no issues, no integration into doldecomp or other decomp projects. We'd be early adopters; bugs might be ours to find.

## Decisions

1. **Comparison strategy: same-TU matched function as the reference baseline.** When a TU contains both matched and unmatched functions, the matched one's dump tells us how MWCC behaves on "correctly written" code in this exact compilation environment. Patterns visible in the matched dump but absent (or different) in the unmatched dump are evidence of what's wrong.
2. **Scope: phased PoC.** Phase 1 is the smallest workflow that proves utility on ≤3 real matching attempts. Phase 2 (CLI tooling, automated diffing) only happens if Phase 1 pays off.
3. **Build approach: MinGW cross-compile on macOS/Linux.** The source is small and uses no MSVC-specific runtime. Fallback to GitHub Actions Windows runner if MinGW fails compatibility with `wibo`.

## Architecture (Phase 1)

Three artifacts, opt-in (none of this runs during normal `ninja` builds):

### 1. `tools/mwcc_debug/`

Vendored fork of upstream source (4 files: README, `mwcc_debug.c`, `mwcc_debug.def`, plus our `Makefile`). Building produces `build/tools/mwcc_debug/lmgr326b.dll`.

```makefile
# tools/mwcc_debug/Makefile (sketch — exact flags discovered in implementation)
CC := i686-w64-mingw32-gcc
CFLAGS := -shared -nostdlib -fno-stack-protector -m32
OUT := ../../build/tools/mwcc_debug/lmgr326b.dll

$(OUT): mwcc_debug.c mwcc_debug.def
	mkdir -p $(dir $(OUT))
	$(CC) $(CFLAGS) -Wl,--kill-at mwcc_debug.def -o $@ $<
```

### 2. `tools/workflow/mwcc-debug-run.sh`

Single-TU wrapper. Responsibilities:

1. Back up stock `build/compilers/GC/1.2.5n/lmgr326b.dll`
2. Symlink patched DLL in its place
3. Register `trap` to restore stock DLL on exit (Ctrl-C, error, normal exit)
4. Invoke compile for one TU (either via `ninja <obj>` with `-j1` or by capturing the ninja command and running it directly with `wibo`)
5. Move resulting `pcdump.txt` from repo root to `build/mwcc_debug/<TU-basename>.txt`

```bash
tools/workflow/mwcc-debug-run.sh src/melee/mn/mnevent.c
# → build/mwcc_debug/mnevent.txt
```

### 3. `docs/mwcc-debug.md` (workflow doc, written after PoC succeeds)

How to use it for the same-TU diff investigation, with one worked example from a real matching attempt.

## Workflow

To investigate an unmatched function `X` in TU `T` where another function `Y` in `T` matches at 100%:

1. `tools/workflow/mwcc-debug-run.sh src/melee/<…>/T.c`
2. Open `build/mwcc_debug/<T>.txt`
3. Locate the per-function dumps for both `X` and `Y` (sections delimited by `Function <name>:` headers)
4. Read the IR optimizer log for each: any propagation/CSE/loop decisions differ in ways that explain the asm divergence?
5. Diff the **BEFORE REGISTER COLORING** vs **AFTER REGISTER COLORING** passes for each: did the allocator make different physical-register choices for similar virtual-register patterns?

Phase 1 is manual inspection. No automated diff tool. If patterns emerge — that's the Phase 2 wedge.

## Phase 1 plan

Sequenced so we hit go/no-go gates early:

| Step | Outcome that gates next step |
|---|---|
| 1. Vendor upstream source, write Makefile | Compiles to a DLL without errors |
| 2. Load DLL via wibo against trivial 1-line TU | `pcdump.txt` exists and is non-empty |
| 3. Run on a real Melee TU (start with one we don't have any matching work in flight on) | Dump is sane — per-function sections present, IR log readable, register coloring passes labeled |
| 4. Write wrapper script with backup/restore | Clean state after each invocation |
| 5. Attempt #1 — pick a stuck function from `MEMORY.md` (candidates: `mnEvent_8024D5B0` 87.3%, `fn_8024D864` 85.6%, `mnDiagram2_GetRankedFighter` 75.2%) | Either find a smoking gun OR confidently conclude "the dump doesn't tell us anything new for this case" |
| 6. Attempts #2 and #3 — different TUs, different mismatch flavors | Same go/no-go question per attempt |
| 7. Decision | If ≥1 of the 3 attempts yielded evidence we couldn't have obtained otherwise → write `docs/mwcc-debug.md`, plan Phase 2. If 0/3 → archive branch, write a short post-mortem in `docs/mwcc-debug-postmortem.md`, move on. |

## Validation criteria

Phase 1 succeeds iff: at least one of the three matching attempts produces a piece of information from the dump that we **could not** have found via `tools/checkdiff.py` + `mismatch-db` + `opseq` + `ghidra` + `ppc-ref` + `discord-knowledge`. "Confirmed something we already suspected" doesn't count; "told us *which* propagation was happening when we didn't know" does count.

If the dump merely re-states things that are already visible in the diff or known patterns, this tool is too heavyweight for our workflow and we shouldn't invest more.

## Risks

- **MinGW PE incompatibility with wibo** — primary risk. The DLL's `DllMain` does the hook installation (`memcpy` of `jmp` opcodes into the compiler's text segment); wibo needs to allow that and its PE loader needs to invoke `DllMain` at the right point. Mitigation: kill PoC and switch to GitHub Actions Windows build if step 2 fails.
- **Stock DLL recovery** — if the wrapper crashes mid-run without restoring the stock DLL, every subsequent build is a debug build. Mitigation: `trap` on `EXIT`, plus a `tools/workflow/mwcc-debug-restore.sh` escape-hatch.
- **Dump noise** — 9 backend passes × every basic block × every instruction may produce 100s of KB per function, drowning the signal. Mitigation is part of step 3's go/no-go assessment.
- **Hardcoded VAs drift** — if our `mwcceppc.exe` binary differs from the one the author reverse-engineered (e.g. patched, repacked), the VAs won't line up. Mitigation: compare SHA256 of our `mwcceppc.exe` to a known-good upstream copy as part of step 2.

## Out of scope (Phase 2 candidates, not designed yet)

- `melee-agent debug compile <fn>` that auto-resolves `fn` → its TU, runs the debug compile, splits output by function, and presents just the register coloring section
- Automated diff between two functions in same TU (or two versions of the same function across attempts)
- Parallel-safe per-TU dump capture (would let mwcc_debug be the default build mode, not opt-in)
- Integration with `mismatch-db` to record "the IR event that explains this mismatch pattern"

## File inventory

New paths (none auto-installed; gitignored where appropriate):

```
tools/mwcc_debug/                 # source + Makefile (committed)
  README.md                       # upstream README, attributed
  mwcc_debug.c                    # upstream source
  mwcc_debug.def                  # upstream def file
  Makefile                        # our addition
tools/workflow/mwcc-debug-run.sh  # wrapper script (committed)
docs/mwcc-debug-poc-design.md     # this file
docs/mwcc-debug.md                # workflow doc, written after PoC succeeds
build/tools/mwcc_debug/           # build output (gitignored)
build/mwcc_debug/                 # captured per-TU dumps (gitignored)
```

`.gitignore` additions: `build/tools/mwcc_debug/`, `build/mwcc_debug/`.

## Open questions to resolve during implementation

- Does `wibo` propagate the `CWD` we set, so that `pcdump.txt` lands in a directory we control? (If not: chdir into a temp dir per invocation, move the dump out.)
- Does upstream's source need any `#define WIN32_LEAN_AND_MEAN` / SDK-version dance to build under MinGW? (Discover via step 1.)
- Are we OK adding `i686-w64-mingw32-gcc` as a build prereq (homebrew/nix-installable on macOS/Linux), or should we vendor a binary toolchain?
