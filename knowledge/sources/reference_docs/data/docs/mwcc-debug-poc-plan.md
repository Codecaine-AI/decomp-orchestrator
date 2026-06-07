# mwcc_debug PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a Phase 1 proof-of-concept that runs `Savestate2A03/mwcc_debug` against our Melee build to unlock MWCC 1.2.5n's internal IR/codegen diagnostic logging. Decide go/no-go on Phase 2 tooling after ≤3 real matching attempts.

**Architecture:** A vendored fork of the upstream DLL source built with MinGW, plus a small shell wrapper that swaps the patched `lmgr326b.dll` into `build/compilers/GC/1.2.5n/`, invokes `wibo`-driven single-TU compiles, and captures the resulting `pcdump.txt` to a per-TU file. No build-system integration in Phase 1 — opt-in tool only.

**Tech Stack:** `i686-w64-mingw32-gcc` (MinGW cross-compile), `wibo` (already in repo at `build/tools/wibo`), `ninja` (existing build system), bash (wrapper script).

**Spec:** [docs/mwcc-debug-poc-design.md](mwcc-debug-poc-design.md)

---

## Pre-flight check

Before starting, confirm MinGW is installed:

```bash
i686-w64-mingw32-gcc --version
```

If missing, install on macOS (`brew install mingw-w64`) or Linux (`apt install gcc-mingw-w64-i686`). If install is blocked, abort and revisit the build-approach decision (switch to GitHub Actions Windows runner per spec § "Build approach").

---

### Task 1: Vendor upstream source

**Files:**
- Create: `tools/mwcc_debug/README.md`
- Create: `tools/mwcc_debug/mwcc_debug.c`
- Create: `tools/mwcc_debug/mwcc_debug.def`
- Create: `tools/mwcc_debug/UPSTREAM` (attribution + SHA pin)

- [ ] **Step 1: Download upstream files at a pinned commit**

Get the latest commit SHA of upstream master, then download the three source files at that SHA:

```bash
UPSTREAM_SHA=$(gh api repos/Savestate2A03/mwcc_debug/branches/master --jq .commit.sha)
echo "Pinning to ${UPSTREAM_SHA}"
mkdir -p tools/mwcc_debug
for f in README.md mwcc_debug.c mwcc_debug.def; do
  curl -fsSL "https://raw.githubusercontent.com/Savestate2A03/mwcc_debug/${UPSTREAM_SHA}/${f}" \
    -o "tools/mwcc_debug/${f}"
done
```

- [ ] **Step 2: Write `tools/mwcc_debug/UPSTREAM` with attribution and pin**

```
Upstream: https://github.com/Savestate2A03/mwcc_debug
Author:   Rei El-Khouri (Savestate2A03)
License:  None specified upstream; vendored here for internal melee-decomp tooling use only.
          Do not redistribute. If PoC succeeds, contact author about licensing.

Pinned commit: <paste UPSTREAM_SHA from step 1>

To update:
  1. Re-run the download in Task 1 of docs/mwcc-debug-poc-plan.md with a new SHA.
  2. Update this file with the new SHA.
  3. Verify Makefile still produces a working DLL (Task 4).
```

- [ ] **Step 3: Verify files are present and non-empty**

```bash
ls -la tools/mwcc_debug/
wc -l tools/mwcc_debug/mwcc_debug.c
```

Expected: 4 files; `mwcc_debug.c` should be roughly 200–300 lines.

- [ ] **Step 4: Commit**

```bash
git add tools/mwcc_debug/
git commit -m "tools/mwcc_debug: vendor upstream source at pinned commit

From https://github.com/Savestate2A03/mwcc_debug — DLL that unlocks
MWCC 1.2.5n internal IR/codegen diagnostic logging. See
docs/mwcc-debug-poc-design.md for the integration plan."
```

---

### Task 2: Verify our mwcceppc.exe matches a known-good copy

The upstream tool hardcodes virtual addresses inside `mwcceppc.exe` (e.g. `debug_printf` at `0x44D580`). If our binary differs, the hooks land on the wrong bytes.

**Files:**
- Modify: `tools/mwcc_debug/UPSTREAM` (append observed SHA)

- [ ] **Step 1: Hash our mwcceppc.exe**

```bash
shasum -a 256 build/compilers/GC/1.2.5n/mwcceppc.exe
```

Expected output (from current repo): `ccf4b465cec73b5aae9c5c5543dcf8cda8a62aba246f89e2e0b200d742f2e55c`

- [ ] **Step 2: Look up the SHA the upstream author worked against**

Check `tools/mwcc_debug/README.md` for any SHA / build-id information. If not documented, scan `mwcc_debug.c` for comments noting the binary version. If still not found, this is a known limitation — record both SHAs and proceed cautiously.

- [ ] **Step 3: Document the comparison in UPSTREAM**

Append to `tools/mwcc_debug/UPSTREAM`:

```
Local mwcceppc.exe SHA-256: ccf4b465cec73b5aae9c5c5543dcf8cda8a62aba246f89e2e0b200d742f2e55c
Upstream reference SHA-256: <from step 2, or "undocumented">

If these differ, the hardcoded VAs in mwcc_debug.c may not point at the
intended bytes. Proceed with extra suspicion on the Task 5 smoke test —
DLL load failure or empty pcdump.txt would be the symptom.
```

- [ ] **Step 4: Commit**

```bash
git add tools/mwcc_debug/UPSTREAM
git commit -m "tools/mwcc_debug: record mwcceppc.exe SHA for VA-match check"
```

---

### Task 3: Write MinGW Makefile

**Files:**
- Create: `tools/mwcc_debug/Makefile`

- [ ] **Step 1: Write the Makefile**

Create `tools/mwcc_debug/Makefile` with this exact content:

```makefile
# Build mwcc_debug.dll (lmgr326b.dll replacement) via MinGW cross-compile.
# See docs/mwcc-debug-poc-design.md for context.

CC := i686-w64-mingw32-gcc
CFLAGS := -shared -m32 -nostdlib -fno-stack-protector -Os
LDFLAGS := -Wl,--kill-at

# Output as lmgr326b.dll because that's the filename mwcceppc.exe loads.
OUT := ../../build/tools/mwcc_debug/lmgr326b.dll

SRCS := mwcc_debug.c
DEF  := mwcc_debug.def

.PHONY: all clean

all: $(OUT)

$(OUT): $(SRCS) $(DEF)
	@mkdir -p $(dir $(OUT))
	$(CC) $(CFLAGS) $(LDFLAGS) $(DEF) -o $@ $(SRCS)

clean:
	rm -f $(OUT)
```

- [ ] **Step 2: Verify Makefile syntax**

```bash
make -C tools/mwcc_debug -n all
```

Expected: prints the `i686-w64-mingw32-gcc …` command without errors.

- [ ] **Step 3: Commit**

```bash
git add tools/mwcc_debug/Makefile
git commit -m "tools/mwcc_debug: add MinGW cross-compile Makefile"
```

---

### Task 4: Build the DLL (first go/no-go gate)

- [ ] **Step 1: Build**

```bash
make -C tools/mwcc_debug clean all
```

- [ ] **Step 2: Verify output**

```bash
ls -la build/tools/mwcc_debug/lmgr326b.dll
file build/tools/mwcc_debug/lmgr326b.dll
```

Expected: file exists; `file` reports `PE32 executable (DLL)` or similar Windows DLL identification.

- [ ] **Step 3: Diagnose if it fails**

If the build errors:

- **`fatal error: windows.h: No such file or directory`** — MinGW is installed but missing headers. On macOS, try `brew reinstall mingw-w64`. On Linux, `apt install mingw-w64-i686-dev` or equivalent.
- **Linker errors on `_lp_checkin@8` etc.** — the `.def` file's stub-name decoration needs `--kill-at`. Verify the Makefile has `-Wl,--kill-at`.
- **Other** — record the exact error in `tools/mwcc_debug/UPSTREAM` under a new `# Build issues` section, then per spec § "Risks" abort PoC and switch to GitHub Actions Windows runner.

- [ ] **Step 4: Commit nothing — this is verification only**

(The DLL itself is gitignored under `build/`.)

---

### Task 5: Smoke test — does wibo load the patched DLL?

This is the **second and most important go/no-go gate**. If wibo can't load the MinGW-built DLL, we either rebuild the binary in a different environment (GitHub Actions) or abort the PoC.

**Files:**
- Create: `tools/mwcc_debug/smoke_test.c` (trivial input)
- Create: `tools/mwcc_debug/smoke_test.sh` (test script)

- [ ] **Step 1: Write a trivial C TU to compile**

Create `tools/mwcc_debug/smoke_test.c`:

```c
int add(int a, int b) {
    return a + b;
}
```

- [ ] **Step 2: Write the smoke test script**

Create `tools/mwcc_debug/smoke_test.sh`:

```bash
#!/usr/bin/env bash
# Smoke test: verify the patched DLL produces a non-empty pcdump.txt.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPILER_DIR="${REPO_ROOT}/build/compilers/GC/1.2.5n"
DEBUG_DLL="${REPO_ROOT}/build/tools/mwcc_debug/lmgr326b.dll"
SMOKE_DIR="$(mktemp -d)"
PCDUMP="${SMOKE_DIR}/pcdump.txt"

cleanup() {
  # Restore stock DLL no matter how we exit
  if [[ -f "${COMPILER_DIR}/lmgr326b.dll.stock" ]]; then
    mv -f "${COMPILER_DIR}/lmgr326b.dll.stock" "${COMPILER_DIR}/lmgr326b.dll"
    echo "Restored stock lmgr326b.dll"
  fi
  rm -rf "${SMOKE_DIR}"
}
trap cleanup EXIT

# Back up stock DLL and install patched one
cp "${COMPILER_DIR}/lmgr326b.dll" "${COMPILER_DIR}/lmgr326b.dll.stock"
cp "${DEBUG_DLL}" "${COMPILER_DIR}/lmgr326b.dll"
echo "Installed patched DLL"

# Compile trivial TU from inside the SMOKE_DIR so pcdump.txt lands there
cp "${REPO_ROOT}/tools/mwcc_debug/smoke_test.c" "${SMOKE_DIR}/"
cd "${SMOKE_DIR}"

"${REPO_ROOT}/build/tools/wibo" \
  "${COMPILER_DIR}/mwcceppc.exe" \
  -c -O4,p -proc gekko -enum int -fp hardware \
  -o smoke_test.o smoke_test.c

if [[ ! -s "${PCDUMP}" ]]; then
  echo "FAIL: pcdump.txt missing or empty in ${SMOKE_DIR}"
  ls -la "${SMOKE_DIR}"
  exit 1
fi

echo "PASS: pcdump.txt is $(wc -c < "${PCDUMP}") bytes"
echo "First 20 lines:"
head -20 "${PCDUMP}"
```

- [ ] **Step 3: Make executable and run**

```bash
chmod +x tools/mwcc_debug/smoke_test.sh
tools/mwcc_debug/smoke_test.sh
```

Expected: prints `PASS: pcdump.txt is N bytes` and shows the first 20 lines, which should contain readable text like `Function add:` or IR optimizer events.

- [ ] **Step 4: Diagnose if it fails**

| Symptom | Likely cause | Action |
|---|---|---|
| Wibo crashes immediately | DLL incompatible with wibo's PE loader | Try Task 4's GitHub Actions fallback. If still failing, abort PoC. |
| Compile runs but pcdump.txt empty | DLL loaded but hooks didn't install (VA mismatch, see Task 2) | Compare SHAs, consider whether a different `mwcceppc.exe` build is needed. |
| Compile runs but pcdump.txt unreadable / binary garbage | `formatoperands` returning unexpected format | Reach out to upstream author. |
| Stock DLL not restored after a crash | Trap didn't fire | Run `cp build/compilers/GC/1.2.5n/lmgr326b.dll.stock build/compilers/GC/1.2.5n/lmgr326b.dll` manually. |

- [ ] **Step 5: Commit if it passed**

```bash
git add tools/mwcc_debug/smoke_test.c tools/mwcc_debug/smoke_test.sh
git commit -m "tools/mwcc_debug: smoke test verifies DLL load + pcdump.txt output"
```

**If this step fails and can't be fixed, STOP HERE.** Record the failure in `docs/mwcc-debug-postmortem.md` and skip to Task 13 step 3 (postmortem path).

---

### Task 6: Write the per-TU wrapper script

**Files:**
- Create: `tools/workflow/mwcc-debug-run.sh`

- [ ] **Step 1: Write the wrapper**

Create `tools/workflow/mwcc-debug-run.sh`:

```bash
#!/usr/bin/env bash
# Run a single-TU compile under the patched mwcc_debug DLL and capture pcdump.txt.
#
# Usage:
#   tools/workflow/mwcc-debug-run.sh <path/to/source.c>
#
# Output:
#   build/mwcc_debug/<basename>.txt  (the full IR + codegen dump for the TU)
#
# Implementation notes:
#   * Backs up the stock lmgr326b.dll, swaps in the patched one, restores on exit.
#   * Uses ninja with -j1 to compile just the one TU so pcdump.txt isn't raced.
#   * pcdump.txt is written to the compiler's CWD (= repo root for ninja), so we
#     scoop it from there and move it into build/mwcc_debug/.
#   * Never run a parallel build while this script is active — the DLL swap is
#     repo-wide.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path/to/source.c>" >&2
  exit 64
fi

SRC="$1"
if [[ ! -f "${SRC}" ]]; then
  echo "Source file not found: ${SRC}" >&2
  exit 66
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPILER_DIR="${REPO_ROOT}/build/compilers/GC/1.2.5n"
DEBUG_DLL="${REPO_ROOT}/build/tools/mwcc_debug/lmgr326b.dll"
OUT_DIR="${REPO_ROOT}/build/mwcc_debug"
TU_BASE="$(basename "${SRC}" .c)"
OUT_FILE="${OUT_DIR}/${TU_BASE}.txt"
PCDUMP_LIVE="${REPO_ROOT}/pcdump.txt"

if [[ ! -f "${DEBUG_DLL}" ]]; then
  echo "Patched DLL missing — run: make -C tools/mwcc_debug all" >&2
  exit 1
fi

if [[ -f "${COMPILER_DIR}/lmgr326b.dll.stock" ]]; then
  echo "WARNING: stock DLL backup already exists." >&2
  echo "A previous run may have crashed without restoring. Run:" >&2
  echo "  tools/workflow/mwcc-debug-restore.sh" >&2
  echo "before re-running this script." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
rm -f "${PCDUMP_LIVE}"

cleanup() {
  if [[ -f "${COMPILER_DIR}/lmgr326b.dll.stock" ]]; then
    mv -f "${COMPILER_DIR}/lmgr326b.dll.stock" "${COMPILER_DIR}/lmgr326b.dll"
    echo "Restored stock lmgr326b.dll"
  fi
}
trap cleanup EXIT

# Install patched DLL
cp "${COMPILER_DIR}/lmgr326b.dll" "${COMPILER_DIR}/lmgr326b.dll.stock"
cp "${DEBUG_DLL}" "${COMPILER_DIR}/lmgr326b.dll"
echo "Installed patched DLL"

# Resolve the .o ninja target for this source file
REL_SRC="${SRC#${REPO_ROOT}/}"
OBJ_TARGET="build/GALE01/${REL_SRC%.c}.o"

# Force re-compile by removing the .o first
rm -f "${REPO_ROOT}/${OBJ_TARGET}"

# Build single TU with no parallelism
cd "${REPO_ROOT}"
ninja -j1 "${OBJ_TARGET}"

if [[ ! -s "${PCDUMP_LIVE}" ]]; then
  echo "ERROR: pcdump.txt was not produced or is empty" >&2
  exit 1
fi

mv "${PCDUMP_LIVE}" "${OUT_FILE}"
echo "Dump written to ${OUT_FILE} ($(wc -c < "${OUT_FILE}") bytes)"
```

- [ ] **Step 2: Make executable and dry-run**

```bash
chmod +x tools/workflow/mwcc-debug-run.sh
tools/workflow/mwcc-debug-run.sh   # no args: should print usage
```

Expected: prints "Usage: …" and exits 64.

- [ ] **Step 3: Commit**

```bash
git add tools/workflow/mwcc-debug-run.sh
git commit -m "tools/workflow: mwcc-debug-run.sh — per-TU debug compile wrapper"
```

---

### Task 7: Write the escape-hatch DLL restore script

If the wrapper or another tool crashes between `cp stock → backup` and `cp backup → stock`, the repo is left with the patched DLL active. Every subsequent build becomes a debug build (slow + races `pcdump.txt`). This script is the manual recovery.

**Files:**
- Create: `tools/workflow/mwcc-debug-restore.sh`

- [ ] **Step 1: Write the script**

Create `tools/workflow/mwcc-debug-restore.sh`:

```bash
#!/usr/bin/env bash
# Recover from a crashed mwcc-debug-run.sh that left the patched DLL installed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPILER_DIR="${REPO_ROOT}/build/compilers/GC/1.2.5n"
STOCK="${COMPILER_DIR}/lmgr326b.dll.stock"
LIVE="${COMPILER_DIR}/lmgr326b.dll"

if [[ ! -f "${STOCK}" ]]; then
  echo "No backup at ${STOCK} — nothing to restore." >&2
  echo "If you suspect the patched DLL is active, redownload the stock DLL" >&2
  echo "by removing the 1.2.5n compiler directory and re-running configure.py." >&2
  exit 0
fi

mv -f "${STOCK}" "${LIVE}"
echo "Restored stock lmgr326b.dll from ${STOCK}"
```

- [ ] **Step 2: Make executable and verify it handles the no-backup case**

```bash
chmod +x tools/workflow/mwcc-debug-restore.sh
tools/workflow/mwcc-debug-restore.sh
```

Expected (clean repo): prints "No backup at … nothing to restore" and exits 0.

- [ ] **Step 3: Commit**

```bash
git add tools/workflow/mwcc-debug-restore.sh
git commit -m "tools/workflow: mwcc-debug-restore.sh — escape hatch for crashed runs"
```

---

### Task 8: Real-TU smoke test (third go/no-go gate)

Validate that the wrapper produces a usable dump on a real Melee TU. Use a TU we're **not** currently iterating on (avoid corrupting any active matching work).

- [ ] **Step 1: Pick a small, stable TU**

A TU with multiple already-matched functions makes for the best initial dump. Candidate: `src/melee/lb/lbarq.c` (medium size, several matched functions per `MEMORY.md` context). Adjust if that TU is in flight.

- [ ] **Step 2: Run the wrapper**

```bash
tools/workflow/mwcc-debug-run.sh src/melee/lb/lbarq.c
```

Expected: succeeds, prints "Dump written to build/mwcc_debug/lbarq.txt (N bytes)".

- [ ] **Step 3: Inspect the dump**

```bash
wc -l build/mwcc_debug/lbarq.txt
grep -c '^Function ' build/mwcc_debug/lbarq.txt
grep -n 'REGISTER COLORING' build/mwcc_debug/lbarq.txt | head -20
```

Expected:
- Many thousand lines
- One `Function <name>:` header per top-level function in the TU
- At least one pair of `BEFORE REGISTER COLORING` / `AFTER REGISTER COLORING` markers per function

- [ ] **Step 4: Confirm stock DLL is back**

```bash
ls build/compilers/GC/1.2.5n/lmgr326b.dll*
shasum -a 256 build/compilers/GC/1.2.5n/lmgr326b.dll
```

Expected: only `lmgr326b.dll` is present (no `.stock` leftover). The SHA should match the pre-patch stock SHA — if you didn't record it before, do so now so future verifications have a baseline.

- [ ] **Step 5: If dump is unreadable, abort**

If the dump file is garbage or the per-function structure isn't there: same go/no-go decision as Task 5. Record observations in `docs/mwcc-debug-postmortem.md` and skip to Task 13.

- [ ] **Step 6: Commit nothing — this is verification only**

The dump file is gitignored under `build/`.

---

### Task 9: Attempt #1 — investigate a stuck function

The first real test of the tool's utility. The validation criterion from the spec: did the dump give us a piece of information we couldn't have found via `tools/checkdiff.py` + `mismatch-db` + `opseq` + `ghidra` + `ppc-ref` + `discord-knowledge`?

**Files:**
- Create: `docs/mwcc-debug-attempts/01-<funcname>.md`

- [ ] **Step 1: Pick the target function**

From `MEMORY.md`, recommended candidates (any one):
- `mnEvent_8024D5B0` (87.3% — register cascade r27/r28, missing clrlwi masks)
- `fn_8024D864` (85.6% — 56-byte stack gap, stmw r27 vs r28)
- `mnDiagram2_GetRankedFighter` (75.2% — register cascade)

These all sit in TUs with at least one matched sibling function. Verify by `grep "100% " <recent attempts ledger>` or just by looking at the source file.

- [ ] **Step 2: Establish the baseline (matched sibling fn dump)**

```bash
# Replace lbarq.c with the actual TU containing your target
tools/workflow/mwcc-debug-run.sh src/melee/mn/mnevent.c
```

Then in `build/mwcc_debug/mnevent.txt`, locate and read the dump for a matched function in the same TU. Note any patterns in:
- IR optimizer events (which propagations / CSEs / loop unrollings happened)
- BEFORE → AFTER register coloring (how virtual regs map to physical)

- [ ] **Step 3: Compare to the unmatched function in the same dump**

Locate the dump for the target unmatched function. Read it with the baseline still in mind:
- Are there extra (or missing) propagation events?
- Did the IR optimizer make a different loop decision?
- In AFTER REGISTER COLORING, did a similar-shape virtual-reg pattern get a different physical register?

- [ ] **Step 4: Record the attempt write-up**

Create `docs/mwcc-debug-attempts/01-<funcname>.md` (replace `<funcname>`):

```markdown
# Attempt 1 — <funcname>

## Setup
- TU: <path/to/file.c>
- Target match %: <X>%
- Matched sibling used as baseline: <name>

## What the dump showed
<concrete findings — quote specific lines from pcdump.txt with line numbers>

## What it told us vs. what we already knew
- Already-known via existing tooling: <list>
- New from mwcc_debug: <list, or "nothing">

## Verdict
- [ ] Found smoking-gun evidence
- [ ] Confirmed something already suspected (does NOT count)
- [ ] Dump didn't help

## Next steps for this function (if any)
<what we'd try based on findings>
```

- [ ] **Step 5: Commit**

```bash
git add docs/mwcc-debug-attempts/
git commit -m "mwcc_debug attempt 1: <funcname> — <one-line outcome>"
```

---

### Task 10: Attempt #2 — different mismatch flavor

Pick a target that exercises a different failure mode than attempt #1. E.g. if #1 was a register cascade, try a stack-frame mismatch or an inline-decision issue.

**Files:**
- Create: `docs/mwcc-debug-attempts/02-<funcname>.md`

- [ ] **Step 1: Pick a different-flavor target**

Suggested mix:
- If attempt 1 was a register cascade, pick something with `dont_inline` confusion or unexpected loop unrolling.
- If attempt 1 was stack-frame, pick a register-allocation case.

Candidates from `MEMORY.md`:
- `mnEvent_8024E524` (86.5% — register r26/r27 swap, was 50.5% from auto-inlining)
- `mnEvent_8024D15C` (86.6% — 64-byte stack gap, stmw r23 vs r25)
- A `mndiagram2.c` function (10 functions still stuck on stmw cascades)

- [ ] **Step 2: Establish the baseline (matched sibling fn dump)**

```bash
# Replace the path with the actual TU containing your target
tools/workflow/mwcc-debug-run.sh src/melee/<module>/<file>.c
```

Then in `build/mwcc_debug/<file>.txt`, locate and read the dump for a matched function in the same TU. Note any patterns in:
- IR optimizer events (which propagations / CSEs / loop unrollings happened)
- BEFORE → AFTER register coloring (how virtual regs map to physical)

- [ ] **Step 3: Compare to the unmatched function in the same dump**

Locate the dump for the target unmatched function. Read it with the baseline still in mind:
- Are there extra (or missing) propagation events?
- Did the IR optimizer make a different loop decision?
- In AFTER REGISTER COLORING, did a similar-shape virtual-reg pattern get a different physical register?

- [ ] **Step 4: Record the attempt write-up**

Create `docs/mwcc-debug-attempts/02-<funcname>.md` (replace `<funcname>`):

```markdown
# Attempt 2 — <funcname>

## Setup
- TU: <path/to/file.c>
- Target match %: <X>%
- Matched sibling used as baseline: <name>
- Mismatch flavor: <register cascade / stack frame / inline decision / other>
- Why we picked this flavor (relative to attempt 1): <one sentence>

## What the dump showed
<concrete findings — quote specific lines from pcdump.txt with line numbers>

## What it told us vs. what we already knew
- Already-known via existing tooling: <list>
- New from mwcc_debug: <list, or "nothing">

## Verdict
- [ ] Found smoking-gun evidence
- [ ] Confirmed something already suspected (does NOT count)
- [ ] Dump didn't help

## Next steps for this function (if any)
<what we'd try based on findings>
```

- [ ] **Step 5: Commit**

```bash
git add docs/mwcc-debug-attempts/
git commit -m "mwcc_debug attempt 2: <funcname> — <one-line outcome>"
```

---

### Task 11: Attempt #3 — open-ended

Pick whatever's most interesting after the first two attempts have surfaced strengths/weaknesses of the tool.

**Files:**
- Create: `docs/mwcc-debug-attempts/03-<funcname>.md`

- [ ] **Step 1: Pick a target informed by attempts 1 and 2**

If attempts 1 and 2 both produced wins, pick a hard case to stress-test. If they were mixed, pick a case that plays to whichever signal proved usable.

- [ ] **Step 2: Establish the baseline (matched sibling fn dump)**

```bash
# Replace the path with the actual TU containing your target
tools/workflow/mwcc-debug-run.sh src/melee/<module>/<file>.c
```

Then in `build/mwcc_debug/<file>.txt`, locate and read the dump for a matched function in the same TU. Note any patterns in:
- IR optimizer events (which propagations / CSEs / loop unrollings happened)
- BEFORE → AFTER register coloring (how virtual regs map to physical)

- [ ] **Step 3: Compare to the unmatched function in the same dump**

Locate the dump for the target unmatched function. Read it with the baseline still in mind:
- Are there extra (or missing) propagation events?
- Did the IR optimizer make a different loop decision?
- In AFTER REGISTER COLORING, did a similar-shape virtual-reg pattern get a different physical register?

- [ ] **Step 4: Record the attempt write-up**

Create `docs/mwcc-debug-attempts/03-<funcname>.md` (replace `<funcname>`):

```markdown
# Attempt 3 — <funcname>

## Setup
- TU: <path/to/file.c>
- Target match %: <X>%
- Matched sibling used as baseline: <name>
- Why we picked this target (informed by attempts 1 and 2): <one sentence>

## What the dump showed
<concrete findings — quote specific lines from pcdump.txt with line numbers>

## What it told us vs. what we already knew
- Already-known via existing tooling: <list>
- New from mwcc_debug: <list, or "nothing">

## Verdict
- [ ] Found smoking-gun evidence
- [ ] Confirmed something already suspected (does NOT count)
- [ ] Dump didn't help

## Next steps for this function (if any)
<what we'd try based on findings>
```

- [ ] **Step 5: Commit**

```bash
git add docs/mwcc-debug-attempts/
git commit -m "mwcc_debug attempt 3: <funcname> — <one-line outcome>"
```

---

### Task 12: Make the go/no-go decision

**Files:**
- Create: `docs/mwcc-debug-decision.md`

- [ ] **Step 1: Score the attempts**

Re-read all three `docs/mwcc-debug-attempts/0*.md` files. Apply the spec's validation criterion:

> Phase 1 succeeds iff at least one of the three matching attempts produces a piece of information from the dump that we could not have found via existing tooling. "Confirmed something we already suspected" does not count.

Each attempt is `find-new`, `confirmed-known`, or `no-help`.

- [ ] **Step 2: Write the decision document**

Create `docs/mwcc-debug-decision.md`:

```markdown
# mwcc_debug PoC Decision

**Date:** <date>
**Verdict:** GO / NO-GO  (pick one)

## Attempt scoring
| # | Function | Outcome |
|---|----------|---------|
| 1 | <name>   | find-new / confirmed-known / no-help |
| 2 | <name>   | … |
| 3 | <name>   | … |

## Reasoning
<2–4 paragraphs: what worked, what didn't, what surprised>

## If GO — Phase 2 priorities
<list of tooling to build next, ordered by leverage. Pull from spec § "Out of scope" and refine based on attempts.>

## If NO-GO — what we learned
<what made the tool not pay off; whether it's worth retrying later if MWCC internals are documented better, etc.>
```

- [ ] **Step 3: Commit**

```bash
git add docs/mwcc-debug-decision.md
git commit -m "docs: mwcc_debug PoC decision — <GO|NO-GO>"
```

---

### Task 13: Write the workflow doc (GO path) or postmortem (NO-GO path)

Only one of these two steps applies, based on Task 12's verdict.

**Files (GO):**
- Create: `docs/mwcc-debug.md`

**Files (NO-GO):**
- Create: `docs/mwcc-debug-postmortem.md`

- [ ] **Step 1 (GO path only): Write the workflow doc**

Create `docs/mwcc-debug.md` with:

```markdown
# mwcc_debug — Compiler Diagnostic Dumps Workflow

## When to use this

After existing tools (`tools/checkdiff.py`, `mismatch-db`, `opseq`, `ghidra`,
`ppc-ref`, `discord-knowledge`) have not explained a mismatch, especially for:

- Last-mile register-allocation cascades (`stmw rN` vs `stmw rN+1`)
- Constant-propagation mismatches (e.g. `addi rX,rY,0` vs `li rX,0`)
- Surprising loop-unrolling decisions

Do NOT use for: stack-frame layout decisions (PAD_STACK), SDA relocation
selection — these are not in the dump.

## How to use

1. Pick a target function `X` in TU `T` that has at least one matched sibling
   function `Y` in the same TU.
2. Build the patched DLL: `make -C tools/mwcc_debug all`
3. Run: `tools/workflow/mwcc-debug-run.sh src/melee/<…>/T.c`
4. Open `build/mwcc_debug/T.txt`
5. Read both `Function X:` and `Function Y:` sections. Look for:
   - IR optimizer events that differ between X and Y
   - Register-coloring decisions (BEFORE vs AFTER passes) that differ for
     similar virtual-register patterns

## Recovering from a crash

If the wrapper crashed and left the patched DLL active:

    tools/workflow/mwcc-debug-restore.sh

## Worked example

<reference one of the GO attempts as a concrete example — paste the
key dump excerpts and the resulting C-source fix>

## Limitations

- Single TU at a time, `-j1` only. Don't run during a parallel build.
- `pcdump.txt` is overwritten per invocation.
- VAs are pinned to mwcceppc.exe SHA `ccf4b465…` (current repo copy).
```

- [ ] **Step 1 (NO-GO path only): Write the postmortem**

Create `docs/mwcc-debug-postmortem.md` with:

```markdown
# mwcc_debug PoC Postmortem

## What we tried
<phase 1 plan summary>

## What worked
<DLL built? loaded? produced output?>

## What didn't
<root cause of the no-go>

## Decision
<archive vs revisit-later, with conditions for revisit>

## Cleanup
<what gets removed from the repo, what stays>
```

- [ ] **Step 2: Commit the doc**

```bash
git add docs/mwcc-debug.md  # or docs/mwcc-debug-postmortem.md
git commit -m "docs: mwcc-debug workflow doc"   # or "...postmortem"
```

- [ ] **Step 3 (NO-GO path only): Decide cleanup**

The vendored upstream, Makefile, smoke test, wrapper scripts are committed but unused. Options:
- Leave them committed (small, may be useful if revisited)
- Remove the tooling, keep only the postmortem + design doc as historical record

Recommend leaving them committed in NO-GO unless they bloat the repo meaningfully. The design + postmortem are the institutional knowledge.

---

## Self-review against spec

After completing the tasks above, verify against [docs/mwcc-debug-poc-design.md](mwcc-debug-poc-design.md):

| Spec requirement | Implemented in |
|---|---|
| Vendored fork at `tools/mwcc_debug/` | Task 1 |
| `Makefile` producing DLL via MinGW | Task 3 |
| `tools/workflow/mwcc-debug-run.sh` with backup + trap restore | Task 6 |
| `build/tools/mwcc_debug/` (build output, gitignored) | Covered by `build/` in `.gitignore` (verified at planning time) |
| `build/mwcc_debug/<TU>.txt` (per-TU dumps, gitignored) | Same |
| `docs/mwcc-debug.md` (workflow doc, on GO) | Task 13 |
| Validation criteria: 3 real attempts, kill-switch | Tasks 9–12 |
| Risk: stock DLL recovery → escape hatch | Task 7 |
| Risk: VA mismatch with our mwcceppc.exe | Task 2 |
| Risk: MinGW PE incompat with wibo | Task 5 (with explicit STOP path) |

## Notes for the executor

- Tasks 9–11 are open-ended investigations, not mechanical implementation. Block out 30–60 min per attempt at minimum; allow for re-reading prior matched-function attempts to set the right baseline.
- Task 5 and Task 8 are go/no-go gates. **Do not proceed past a failing gate without consulting the spec's risk section** and either fixing the underlying issue or aborting cleanly to the postmortem path.
- The wrapper script in Task 6 makes a destructive change to `build/compilers/` (overwrites DLL). Never run it concurrently with another `ninja` build of the same repo.
