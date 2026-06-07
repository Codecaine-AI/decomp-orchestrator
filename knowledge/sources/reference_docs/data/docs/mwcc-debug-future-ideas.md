# mwcc_debug — future improvement ideas

The current tooling answers "which register did MWCC pick" and (with the
analyze command) "what were the constraints" — but not "why this register
specifically." These are notes on what we could build next to close that
gap. Not detailed designs; just enough that we don't re-derive the ideas
from scratch later.

## Tier 2 — hook MWCC's register-allocator entry point — ✅ DONE

Implemented in commit 17517fb08. Hook on `colorgraph` at VA 0x4CE2D0 in
mwcceppc.exe v1.2.5n. After the original runs, the hook walks the IGNode
linked list and emits a `COLORGRAPH DECISIONS` section to `pcdump.txt`
with per-virtual: iteration index, assigned physical reg, degree,
original interferer count, flags.

Critical finding from the hook: MWCC dispenses nonvolatiles **TOP-DOWN
from r31** (r31 → r30 → r29 → ...), not bottom-up from r27 as our
positional-alignment analysis had suggested. The simulator (Tier 1.5)
and algorithm docs have been corrected.

IGNode struct layout for v1.2.5n (different from 7.0!): see
`tools/mwcc_debug/mwcc_debug.c` or `docs/mwcc-allocator-algorithm.md`.

~~What we still don't capture: the **iteration order** within colorgraph
(determined by `simplifygraph`'s spill-cost-aware Chaitin-style
simplification). Adding a hook on `simplifygraph` would surface this.~~

✅ Done in commit ff4a358c8 (Tier 2.5). The simplifygraph hook at
0x4CE400 emits `SIMPLIFY GRAPH (class=N, n_colors=K, n_class_regs=M)`
sections with per-iter rows containing `ig_idx`, post-simplification
`degree`, original `arraySize` (interferer count), and `flags` — the
0x08 bit indicates a SPILLED node (potential spill candidate).

Still not captured: the workingMask state per-decision is computed but
not stored across the loop — would need an in-loop hook (much more
invasive). Marginal value: we can already reason backwards from the
COLORGRAPH DECISIONS output's interferer list.

## Tier 2.5 — simplifygraph hook (simplification order + spill markers) — ✅ DONE

Implemented in commit ff4a358c8. Hooks `simplifygraph` at VA 0x4CE400
with the discovered 3-arg signature `(int rclass, int n_colors, int
n_class_regs)`. After the trampoline call, walks the returned linked
list and emits per-iteration data.

Output shape:
```
SIMPLIFY GRAPH (class=0, n_colors=29, n_class_regs=56)
iter  ig_idx  degree  arraySize flags     notes
0     -1      0       0        0x2
...
15    -1      0       3        0xa       SPILLED
16    36      0       0        0x2
17    35      14      27       0x2
...
```

Columns:
- `iter`: position in the simplified linked list (=order colorgraph
  walks it; head colored first)
- `ig_idx`: index in `interferencegraph[]`. -1 for "physical reg"
  nodes (representing r0/r3/r4/...) that weren't part of the virtual-
  reg IG.
- `degree`: post-simplification degree (often 0 once neighbors are
  removed)
- `arraySize`: pre-simplification interferer count (= original degree)
- `flags`: IGNode flags. Bit 0x08 (8) is the SPILLED marker
- `notes`: convenience text (`SPILLED` when flags & 0x08 is set)

**What's new vs. just looking at COLORGRAPH DECISIONS:** The colorgraph
output has the same `iter` and `ig_idx` columns BUT the degree it
reports is the post-simplification degree (always low). The simplify
output shows the ORIGINAL `arraySize` (real interferer count) and which
nodes simplifygraph itself flagged as potential spills BEFORE colorgraph
got to them. That tells you which virtuals are structurally hard to
color (Chaitin's "can't be removed cleanly") even before the per-
virtual coloring attempts run.

Why this matters for matching: when a stuck function shows a spill
marker on a virtual that ended up at the "wrong" physical, the
constraint may be earlier than the allocator — the simplification
algorithm gave up on it and pushed it through with a sentinel that
biases later decisions. A C-source restructure that reduces that
virtual's degree (= fewer simultaneously-live values touching it)
might unblock the case.

**Known limitation:** Reading `INTERFERENCEGRAPH[]` BEFORE the trampoline
call crashes mwcceppc (the prior disabled hook hit this). Reading after
is safe — and matches what we want anyway (post-simplification state).
A "before snapshot" would let us diff degrees and surface spill flags
added by simplifygraph itself; right now we can only see flags that were
already set at hook exit. Workaround: pair the SIMPLIFY GRAPH section
with the immediately-following COLORGRAPH DECISIONS in the parser — the
colorgraph hook already captures per-node interferer arrays which encode
the pre-simplification edges.

Parser support: `parse_hook_events()` now returns `SimplifySection` /
`SimplifyEntry` objects on each `FunctionEvents`.

## Tier 3.5 — mechanism investigation (propagateconstants hook + PCode-gen finding) — ✅ DONE

Investigation triggered by the matching agent reporting that their
"use scroll_offset as NULL store source" attempt produced no new
interferences for r36 — they observed MWCC was "splitting the live
range" but didn't know the mechanism.

Implemented in commits described below. Three findings:

**A.** Empirical proof via pcdump: scroll_offset's "split" between
cleanup-loop and j-loop is present in the EARLIEST pass (BEFORE GLOBAL
OPTIMIZATION) — `li r50, 0; stw r50, 112(r45)` for cleanup, `lbz r36,
10(r39)` for j-loop. Two distinct virtuals from creation.

**B.** Cross-source-form invariance: baseline source (`= NULL` literal)
and experimental (`= (HSD_Text*)(s32) scroll_offset`) produce
**byte-identical** IR in BEFORE GLOBAL OPTIMIZATION. MWCC's PCode
generator inlines compile-time-known constants at the use site, erasing
C variable identity. No C-source pattern can defeat this when the
constant is statically provable.

**C.** Optimization-pass invariance: r50 is unchanged across all 8
optimization passes (verified by Tier 3.5 propagateconstants hook at
VA 0x52B530). CP fires but doesn't touch r50 — because there's nothing
to propagate after PCode gen already inlined the constant.

The propagateconstants hook emits `CONSTPROP RAN (changed_flag: before=X
after=Y)` events. For functions where CP changes something, the flag
flips. For unchanged functions, it stays. Useful general visibility into
which functions get heavy CP treatment vs. which arrive at PCode gen
already-optimized.

**Implication for matching cascades:** when the binary hook shows a
cleanup-loop "constant-store" pattern (`li rX, 0; stw rX, ...`) paired
with a runtime-load pattern (`lbz rY, ...`) elsewhere in the same
function, both deriving from the same C variable — those virtuals are
unmergeable through pure C source. Document the case and move on.

Documented in [`docs/mwcc-allocator-mechanism-deep-dive.md`](mwcc-allocator-mechanism-deep-dive.md).

## Tier 3 — hook IG construction + cross-ref 7.0 source — ✅ DONE

Implemented in commits described below. Two parts:

**A. 7.0 source cross-reference (done during Tier 2).**
We read `compiler_and_linker/BackEnd/PowerPC/RegisterAllocator/{Coloring,
InterferenceGraph,RegisterInfo}.c` from git.wuffs.org/MWCC. That established:
- The Chaitin-style coloring algorithm
- The TOP-DOWN nonvolatile dispense order (corrected our wrong hypothesis)
- IGNode structure layout (different offsets in 1.2.5n vs 7.0)
- Build pipeline: `buildinterferencegraph` → `simplifygraph` → `colorgraph` → `rewritepcode`

The Python simulator (`melee-agent debug simulate`) replays the colorgraph
algorithm based on this understanding.

**B. IG construction hook.**
Hooked `buildinterferencegraph` at VA 0x530A00 (9-byte prologue). After
construction completes, emits an `IG CONSTRUCTED (class=N, n_nodes=K)`
event line to pcdump.txt. This gives agents ordering visibility — they
can see exactly when each (function, register class) pair has its IG
constructed, paired with the subsequent COLORGRAPH DECISIONS section.

**Known limitation:** iterating `interferencegraph[]` from inside the
build_ig hook causes mwcceppc to crash (Rosetta exception at 0x6c2e1xxx).
Likely cause: `findrematerializations` (called near the end of
buildinterferencegraph) may reallocate the array, leaving stale pointers
at some indices. The minimal hook (just logging the event) is stable.

**Workaround:** the colorgraph hook's per-iter interferer dumps (committed
in c232825c2) provide the full adjacency-list data for all virtuals that
made it to the worklist. Simplified-out leaves aren't visible there, but
their interferences would have been edges to non-simplified virtuals
which ARE in the output. The data is functionally complete for matching
investigations.

**What we still don't have:** the FULL pre-simplification graph including
simplified-out leaves. Would require either:
- Hooking a stable intermediate function (e.g. between `buildinterferencematrix`
  and `findrematerializations`)
- Reading the interference *matrix* directly (at global 0x583088) instead of
  the post-coalescing adjacency vectors — the matrix is bit-packed and stable

**Effort spent:** ~half-day, mostly RE work on mwcceppc.exe to find VAs and
debugging the iteration crash.

## Tier 4 — permuter integration scoring + guidance (v1) — ✅ DONE

Implemented as scoring/guidance primitives that can be wrapped by
upstream decomp-permuter, plus a standalone "guide" command for manual
investigation.

See [docs/mwcc-debug-tier4-permuter.md](mwcc-debug-tier4-permuter.md)
for the full design + integration paths.

**What v1 ships:**

- `melee-agent debug score <pcdump> -f FN -t target.{yaml,json}` — emits
  a single floating-point score (lower = better) compatible with
  permuter's `--scorer` convention. Combines:
  - byte_penalty (% of virtuals at wrong physical)
  - virtual_penalty (per-wrong-virtual)
  - spill_penalty (unexpected SPILLED markers)
  - interferer_penalty (degree-distance)
- `melee-agent debug guide <pcdump> -f FN [-t target]` — human-readable
  diagnostic listing wrong virtuals, blockers, spill warnings, and
  suggested C-source nudges. Hints, not guarantees.
- `melee-agent debug derive-target <pcdump> -f FN` — extracts the
  current virtual→physical mapping as a target spec. Useful for
  capturing known-good (matched sibling) or experimental (Tier 5
  force-phys) targets.

**Verified on mnVibration_80248644:**
- Forced r36 → r31 via Tier 5, captured target spec
- Scored natural-source baseline against forced target
- `guide` correctly identifies: "r36 wants r31 but r31 is taken by
  interfering virtual r51. Try: shrink the live range of r51..."
- This pinpoints exactly the scroll_offset-vs-cleanup-loop-NULL
  interference the matching agent was investigating manually.

**What v1 doesn't do (deferred):**

- Direct wrap-around of decomp-permuter — the scorer is callable from
  outside but we haven't built the glue script that points permuter at
  it. To use: write a small bash wrapper that takes a permuter
  candidate's `.o`, generates a pcdump (via SSH), and calls our score.
- Local pcdump generation (still requires SSH to nzxt-local).
- Targeted-mutation library — the guidance suggests directions but
  doesn't apply them automatically.
- Per-byte assembly diffing — currently the "byte" component is a
  synthetic stand-in based on the virtual mapping ratio.

These deferred items would be a Tier 4 v2 / v3 if matching workflows
warrant the investment.

**Effort spent:** ~half-day for v1 (scoring + guidance + derive-target
+ tests). v2/v3 are explicit future work.

## Tier 5 — allocator biasing via env var — ✅ DONE

Implemented in commit c8c8555aa. Lets us answer "what if r36 got r31?"
by actually compiling that variant and diffing the emitted code.

**Mechanism:**
- DLL reads `MWCC_DEBUG_FORCE_PHYS` at `DllMain`. Format:
  `"virtIdx:physReg[,virtIdx:physReg]*"`. Example: `"36:31"` forces
  virtual #36 to physical r31. Example: `"36:31,50:27"` forces both.
- In `hook_colorgraph`, AFTER the trampoline call (normal coloring
  runs), the hook walks the IGNode worklist, finds each node's
  `ig_idx` via `INTERFERENCEGRAPH[]` scan, and patches
  `IGNode->assignedReg` if there's a matching override.
- Next pass (`rewritepcode`) reads the patched field, so the override
  propagates all the way to the emitted `.text`.

**CLI exposure:**
```bash
melee-agent debug pcdump src/melee/mn/mnvibration.c \
  --force-phys "36:31" \
  --output /tmp/mnvib_force.txt
```
The CLI validates that the value contains no quotes/semicolons/
whitespace, then passes it as `set MWCC_DEBUG_FORCE_PHYS=...` on the
remote SSH side.

**Verified on mnVibration_80248644:** forcing virtual 36
(scroll_offset) from r27 → r31 produced FINAL CODE AFTER INSTRUCTION
SCHEDULING with `lbz r31,10(r28)` and `add r0,r31,r29` — exactly the
codegen the matching agent's experimental tried (and failed) to coax
with C-source restructuring. 13 `[FORCE_PHYS]` events fired across the
TU. (Note: cleanup-loop NULL also lives in r31 because its live range
ends before scroll_offset's begins — same physical for both is correct
under interference-graph rules.)

**What it unlocks:** ground-truth answers via experimentation. Before
spending hours trying to coax a specific allocation via C-source
shuffling, force it via the env var, see whether the resulting `.text`
matches the target. If yes, the goal is reachable; spend the time
finding the C pattern. If no, the constraint is elsewhere (instruction
selection, scheduling, etc) and the allocator isn't the problem.

**Caveats (documented in mwcc_debug.c):**
- Forcing two interfering virtuals to the same physical produces
  incorrect code (data corruption — multiple live values sharing one
  reg). DLL-patched ASM is NOT what the real compiler would emit from
  any C source — it's a hypothesis-test artifact, not a match target.
- Forcing across register classes (GPR vs FPR) likely crashes.
- Only operates on virtuals that survive `simplifygraph` (made it onto
  the worklist). Simplified-out leaves are colored elsewhere and
  aren't reachable from the colorgraph hook.

**Effort spent:** ~half-day, mostly cmd-line plumbing and env-var
parsing in C. The IGNode patching itself is 5 lines.

## Tier 7 — permuter session learnings + matching workflow tools — ✅ DONE

Following the matching agent's permuter session that cracked
`mnVibration_80248644` and `mnVibration_80248ED4` to 100%, five
incremental commands address the specific friction points they
flagged:

**Tier 7a — `debug verify-perm`** (commit ea03c1e13)

Apply a permuter candidate to the real source tree, run ninja +
checkdiff, report match% delta. Removes the "permuter says score=1320
but actual match% unchanged" cycle entirely. Reverts by default;
`--keep` to apply.

**Tier 7b — `debug enumerate-decl-orders`** (commit 60a7a1142)

Brute-force the small declaration-order search space. Promote/demote/
swap strategies cover ~3N candidates; full N! permutation refused for
N>7. Would have found the mnVibration_80248644 `s32 j` move in ~10
iterations vs permuter's 2000.

**Tier 7c — pattern catalog + patternized guide** (commit 9e517f83e)

Moves the seven recurring mutation patterns from the matching agent's
session findings into `src/mwcc_debug/patterns.py` as structured
entries. `debug guide` cites pattern names directly; new `debug
pattern-catalog` command browses the catalog. Patterns: alias-split,
widen-u8-to-u32, shrink-s32-to-u8, drop-variadic-cast, subexpr-extract,
decl-order, chained-init.

**Tier 7d — `debug suggest-casts`** (commit 4df91bc41)

Static lint surfacing explicit casts in call-site arguments. Three-tier
severity: HIGH when the cast's inner expression has a proven integer
type (from local declarations/parameters), MEDIUM by heuristic
(loop counter names, integer suffixes), LOW for general audit. Verified
on `fn_80247510`: correctly flagged 5 `(f32) rumble_setting` casts
(declared `u8`) as HIGH severity — the exact case the agent identified
manually at 1.7% match% improvement.

**Tier 7e — `debug triage-perm`** (commit pending)

Batch-triage permuter session outputs. For each `output-NNNN-N/source.c`,
applies the candidate to the real tree, builds, reads match%, ranks
the results. `--apply-best` leaves the top transferring candidate
in place. Per-candidate cost ~5-10sec; a 100-winner triage takes a
few minutes. See [docs/mwcc-debug-permuter-integration.md](mwcc-debug-permuter-integration.md)
for the integration model and v2/v3 sketches.

## Other small wins not worth their own tier

Done (commits 81fbe074e, c3a26d82a):
- ✅ **JSON output mode** for the analyze command (`--json`)
- ✅ **Comparison mode** — `melee-agent debug diff` compares two
  pcdumps for the same function
- ✅ **ABI annotation** in analyze — shows `r3 = arg0`, `r4 = arg1`
  etc. derived from function signature

Done (Tier 1b — commit 1b65af0f4):
- ✅ **Live-range alignment improvements** — replaced greedy
  skip-forward in `_align_block` with proper Needleman-Wunsch DP
  alignment. Score function combines opcode match + physical reg
  agreement; gap penalty allows multi-instruction insertions/deletions.
  Unmapped virtuals on the test corpus dropped from 54 → 10 (~80%
  reduction).
