# First-Divergence Analyzer — v1 Validation Campaigns (read-only handoff)

Date: 2026-05-28 (rev 2 — incorporated an external critical-thinking review:
runnable Campaign B via disposable worktrees, real cache isolation
(`--no-cache-sync`), an operational drift metric, fn_80247510 reclassified, and
provenance fields. rev 3 — Campaign A run: negative-control targets must exclude
`target derive`'s spilled igs; recorded the target-derive round-trip footgun.
rev 4 — landed the Case D fix (`8b33bb7c8`) and `target derive --force-phys-safe`
(`4238992ac`); validation now builds faithful same-source targets via the flag.
rev 5 — Campaign B run: documented the disposable-worktree bootstrap steps; B's
verdict (raw ig_idx ~89% drift → v2 needs a role-descriptor identity layer first)
and sharpened Campaign C with a bridge-quality baseline + identity-layer read.)
Status: HANDOFF BRIEF — self-contained for a fresh agent. Read-only.

## 0. What this is

The `first-divergence` analyzer (v1) shipped to `master` (commits
`ea53132b7`..`d88d1ed16`). It is the "directed tell" tool for the last-mile
MWCC register-allocation matching problem: given a baseline coloring (what MWCC
naturally produced) and a same-source target coloring (a force-phys map known
to match), it reports the single earliest allocator decision that diverges from
target, classifies it (Cases D/E/A/B/B-inverse/C/C2), and emits a local
structural lever.

It passed its two acceptance gates (replay reproduces the recorded coloring;
gm Case D + lbDvd register-choice). But it has only been exercised on ~4
functions, and one output layer is known-broken. **Before we invest in the next
phase (v2 convergence, or wiring the source layer), we want to validate v1 on
real inputs and find tooling gaps.**

This brief defines three sequenced, read-only campaigns. Run them in order; B
and C are only worth doing if A shows the gated facts are trustworthy.

### Source-of-truth docs (read these first)
- Design spec: `docs/superpowers/specs/2026-05-27-first-divergence-analyzer-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-28-first-divergence-analyzer-v1.md`
- Module: `tools/melee-agent/src/mwcc_debug/first_divergence.py`
- CLI: `tools/melee-agent/src/cli/debug.py` (`debug inspect first-divergence`)
- Skill section: `.claude/skills/mwcc-debug/SKILL.md` → "First-divergence analyzer"

## 1. Hard constraints

- **READ-ONLY.** Generate dumps, run the analyzer / symbol bridge, read git
  history, and write a findings log. **Do not** edit tracked `.c`/`.h` source in
  place, commit to shared code, push, or run a full `ninja` object build.
  *Permitted* (and needed for Campaign B): creating **disposable** git worktrees
  at historical revs and running `python configure.py` in them to generate
  `build.ninja`. That reads committed history into a throwaway location; it
  doesn't mutate tracked state. Single-TU dump compiles are inherent to the
  tooling and fine.
- **Isolation.** Do your scratch work in your own git worktree off `master`
  (see `using-git-worktrees`). The concurrent campaign agents work in
  `.codex/worktrees/*`; staying isolated avoids contention. Don't commit to
  `master` from this work except the final findings doc, and only if asked.
- **Read-only dumps MUST skip the shared cache.** `debug dump local` mirrors a
  natural (unforced) dump into `build/mwcc_debug_cache/<unit>.txt` **even when
  you pass `-o`** (it keeps the canonical cache fresh for auto-resolve; see
  debug.py "also synced to cache"). That races other agents and contaminates
  their baselines. So on *every* dump here, pass **`--no-cache-sync`** together
  with `-o /tmp/fdiv/<FN>_<role>.txt`. (Forced dumps already skip the cache, but
  pass the flag uniformly.) For the same reason, give the analyzer and
  symbol-bridge commands an **explicit pcdump path** rather than letting them
  auto-resolve via the (possibly contaminated) cache.
- **Verify commands with `--help`.** This brief lists the commands and their
  key flags as of 2026-05-28, but confirm exact option names with
  `melee-agent <cmd> --help` before scripting a loop.
- **Toolchain.** `debug dump local` compiles via wibo + the MWCC DLL. Confirm
  it works once (`melee-agent debug dump local <any unit>.c -f <any FN> -o -`)
  before starting a campaign.

## 2. Mental model: same-source vs cross-compile (READ THIS)

v1 is **same-source only**: baseline and target must share the interference
graph and processing order, so `ig_idx` aligns exactly. This is the single most
important constraint for designing valid tests.

- **Baseline** = the *natural* coloring of a source file: `debug dump local
  <unit>.c -f FN`. The COLORGRAPH DECISIONS section is the per-iteration
  `ig_idx -> assigned_reg` map.
- **Target (force-phys map)** = `ig:phys[,ig:phys...]`. The map *keys* define
  the target node set. For a valid same-source test, the target must describe a
  coloring of *the same source* the baseline came from.
- **`ig_idx` drift ("raw ig_idx lies"):** if the source changes at all, node
  numbering shifts. gm already drifted: the 2026-05-25 campaign's `42/38` are
  `43/46` in the current compile. So a force-proof recorded against an old
  source may name the wrong nodes today. Re-confirm a recorded map's indices
  against the *current* natural dump before trusting it (read the current
  COLORGRAPH DECISIONS and/or cross-check with `virtual-to-var`); do NOT run a
  fresh force-phys search to "re-derive" one — that is expensive and out of
  scope here.

Where each campaign sits:
- **Campaign A** is strictly same-source (valid v1 territory).
- **Campaign B** deliberately walks cross-compile git history to *measure* the
  drift problem — it is NOT a v1 correctness test; it quantifies what v2 needs.
- **Campaign C** is same-source (symbol bridge over the baseline source).

## 3. How to obtain baseline + target

```bash
mkdir -p /tmp/fdiv

# Baseline (natural coloring) — the dump the analyzer reads.
# --no-cache-sync is REQUIRED here (see Section 1): without it, a natural dump
# is mirrored into the shared build/mwcc_debug_cache even with -o.
melee-agent debug dump local src/melee/<module>/<unit>.c -f <FN> \
    --no-cache-sync -o /tmp/fdiv/<FN>_baseline.txt

# A forced dump (apply a candidate coloring) — only if you need to derive a
# target spec from a force-proof. (Forced dumps skip the cache anyway.)
melee-agent debug dump local src/melee/<module>/<unit>.c -f <FN> \
    --force-phys 'IG:PHYS,...' --force-phys-fn <FN> \
    --no-cache-sync -o /tmp/fdiv/<FN>_forced.txt

# Capture a dump's coloring as a target spec (virtuals: {ig: phys}).
melee-agent debug target derive -f <FN> /tmp/fdiv/<FN>_forced.txt --format json

# Run the analyzer: baseline dump (explicit path) + target map.
melee-agent debug inspect first-divergence -f <FN> \
    --force-phys 'IG:PHYS,...' /tmp/fdiv/<FN>_baseline.txt
# add --source to also emit the (currently broken) advisory layer
```

`target derive`'s `virtuals` map converts directly to the `--force-phys`
argument (`{"43": 28}` → `43:28`).

**For a faithful SAME-SOURCE target (recommended), use `--force-phys-safe`.**
Default `target derive` builds `virtuals` from `analyze_function` (a
post-coloring reconstruction) which disagrees with the analyzer's raw colorgraph
decisions for coalesced / spilled / r0 nodes, so it does NOT round-trip cleanly.
`--force-phys-safe` reads the coloring straight from the decisions (excluding
r0 / spilled / aliases):
```bash
melee-agent debug target derive -f <FN> /tmp/fdiv/<FN>_baseline.txt \
    --force-phys-safe --class 0 --format json
# feed its `virtuals` (ig:phys,...) to first-divergence as the target
```

## 4. Corpus (verify status as step 0, then use or replace)

Memory-sourced seed list. **First action of every campaign:** confirm each
function's current status / location before using it (functions get matched,
renamed, or drift). If a seed is stale, replace it using the selection criteria
below.

### 4a. Known-answer POSITIVE cases (Campaign A correctness gate)
Functions with a recorded force-proof AND on-record manual *first-divergence*
analysis. Small but high-confidence. These are where "is the reported case
correct?" has a real answer.
- `gm_80173EEC` — expect **Case D** (loop-NULL-store cluster coalesces into
  root 3 [r3]); current indices `43,46` (NOT the stale `42,38`). Fixture:
  `tools/melee-agent/tests/fixtures/mwcc_debug/gm_80173EEC_pcdump.txt`.
- `lbDvd_80018A2C` — expect a **register-choice** case (B family), nodes
  `44/46`, `r10<->r12` polarity. Force-proof `44:10,46:12`. Fixture present.
- Harvest more force-proofs from: the attempts DB / `docs/` notes / commit
  messages / `MEMORY.md`. Any function with a recorded `--force-phys` map that
  matched is a candidate — re-verify its indices against the current compile.

> **Not a first-divergence positive: `fn_80247510`.** It is the **replay
> (Gate 1)** fixture — its on-record ground truth is that the allocator-state
> *replay* reproduces the recorded coloring, NOT a classified first divergence
> (see `test_first_divergence_replay.py`: it asserts predicted == recorded, not a
> case). It has no force-phys target or expected case, so don't score it as a
> positive. Use it instead as the **replay-harness sanity check** in Campaign A
> step 0 (fixtures `fn_80247510_pcdump.txt` and `mnVibration_80248644_pcdump.txt`).

### 4b. NEGATIVE controls (Campaign A no-false-positive check)
Solved functions, dumped naturally, with **target = their own natural
coloring** (derive it from the natural dump and feed it straight back). Expect
**Case NONE** ("all target nodes already on-target"). A divergence here is a
bug.
- `mnVibration_80248644`, `mnEvent_8024CE74`, `mnInfo_802522B8`,
  `mnCount_GetRowValue_Character`, `mnDiagram2_ClearStatRows`, `fn_8024E1B4`.

> **Build the natural-self target with `target derive --force-phys-safe`** (see
> Section 3), NOT default `target derive`. The default `virtuals` come from
> `analyze_function` and disagree with the analyzer's raw colorgraph decisions
> for coalesced / spilled / r0 nodes, so the round trip spuriously reports
> Case D, then Case E, then an r0 abstain (all three observed on `mn_8022A5D0`
> during the Campaign A run). `--force-phys-safe` reads the coloring from the
> decisions and excludes those, so a clean round trip returns NONE. (The Case D
> analyzer fix `8b33bb7c8` independently handles coalesced-on-target nodes.)

### 4c. STUCK / realism cases (Campaign A usefulness signal)
Currently unmatched, register-cascade-stuck. Used to measure abstain rate,
target availability, and lever actionability — even without perfect ground
truth.
- `mnEvent_8024D5B0` (~87.3%), `fn_8024D864` (~85.6%),
  `mnEvent_8024D15C` (~86.6%), `mnEvent_8024E524` (~86.5%).
- More via `melee-agent extract list --max-match 0.50` (filter by module).

### 4d. RETROSPECTIVE history (Campaign B)
Solved functions with a *multi-commit* fix history (several WIP source versions
between first attempt and match). `mnVibration_80248644` (permuter solve, has
intermediate states) is the prime candidate. Find others with
`git log --follow --oneline -- <path>` and look for functions whose source went
through several register-allocation-motivated edits.

### Selection criteria (when replacing stale seeds)
- Class-0 (GPR) functions that exhaust the volatile pool (dispense + reuse
  callee-saves) are the meaningful cases; trivial functions are uninformative.
- Prefer functions whose stuck/solved reason was *register allocation* (cascade,
  coalesce, dispense order), not data/reloc/inline-shape issues.

## 5. Findings record (shared format)

Maintain one CSV/markdown table, one row per `(function, target, role)`. The
provenance fields are first-class, not optional: this whole exercise is about
drift and stale targets, so a finding nobody can reproduce (or detect as stale)
is worthless.

*Provenance / identity:*

| field | meaning |
|-------|---------|
| function | FN name |
| role | positive / negative-control / stuck / retrospective / replay-sanity |
| tool_commit | `master` short SHA the tooling ran from (`git -C <repo> rev-parse --short HEAD`) |
| source_rev | git SHA of the source compiled for the baseline (current HEAD for A/C; the WIP rev for B) |
| unit_path | `src/melee/<module>/<unit>.c` |
| register_class | `--class` value (0=GPR, 1=FPR) |
| target_src | how the target was obtained (fixture / derive / recorded force-proof / natural-self) |
| target_map | the exact force-phys map used (`ig:phys,...`) |
| dump_path | path to the baseline pcdump used |
| dump_sha256 | sha256 of that pcdump (reproducibility + stale detection) |
| exact_command | the full `first-divergence` invocation (copy-pasteable) |

*Result + judgment:*

| field | meaning |
|-------|---------|
| case | DivergenceCase reported (D/E/A/B/B-inverse/C/C2/NONE/ABSTAINED) |
| ig_idx | reported divergence node |
| baseline_reg / target_reg | the two physical regs |
| abstained | yes/no + reason (r0 / cap-hit / unreliable) |
| correct | for positive/negative roles: does the fact match ground truth? (yes/no/n-a) |
| lever_actionable | 1 (vague) – 3 (directly actionable) + one-line why |
| notes | free-text: surprises, crashes, drift, workflow friction |

For Campaign B, also record per rev: `drift_rate`, the matched/ambiguous/missing
counts, the denominator, and whether the rev passed the identity-validity
threshold. Plus a per-campaign rollup (see each campaign's pass/fail).

## 6. Campaign A — Correctness & usefulness sweep (FOUNDATIONAL GATE)

**Goal.** Establish that the gated allocator-fact layer is correct and measure
how useful it is in practice.

**Procedure.**
1. **Replay-harness sanity (do FIRST).** Confirm the allocator-state replay
   reproduces the recorded coloring on `fn_80247510` (the Gate 1 fixture; see
   4a). If the replay harness is wrong, every classification downstream is
   suspect — stop and fix before proceeding. This is what `fn_80247510` is for;
   it is not a first-divergence positive.
2. Verify the corpus (4a/4b/4c) statuses.
3. **Positive cases (4a):** for each, build baseline + target (Section 3), run
   `first-divergence`, record the row. Compare `case`/`ig_idx`/`local_target`
   to the on-record manual analysis. Start with gm/lbDvd against their fixtures
   to confirm your harness reproduces the gate results.
4. **Negative controls (4b):** dump naturally, build the target with
   `target derive --force-phys-safe` on that same dump (see 4b/Section 3 — the
   default derive does NOT round-trip cleanly), feed its `virtuals` back as
   `--force-phys`. Expect Case NONE.
5. **Stuck cases (4c):** for each, attempt to obtain a target. If a force-proof
   exists, run the analyzer and record. **If no target coloring is available,
   record that** — it is a first-class finding (the tool is unusable on a stuck
   function with no force-proof; note how one would have to be produced).

**Record + rollup metrics (the real signal):**
- **Abstain rate** overall and by reason. Break out r0 specifically — r0 is
  heavily assigned by MWCC (182/283 decisions on one fixture), so if most first
  divergences involve r0 the tool abstains constantly. **This is the headline
  usefulness number.**
- **Case distribution.** Which cases actually occur? Any divergence the
  taxonomy can't classify, or that looks misclassified vs ground truth?
- **Lever actionability.** Are the `local_target` strings specific enough to act
  on, or so generic ("shorten the live range") they don't direct an edit?
- **Cap-hit frequency.** How often do dumps truncate interferer rows → forced
  abstain? If common, the uncapped-dump hook extension matters.
- **Target-availability rate** on stuck functions.

**Pass/fail.**
- PASS: positive cases reproduce their known case + lever; negative controls all
  report NONE (zero false positives); the metrics above are quantified.
- FAIL signals to surface loudly: any negative control reporting a divergence;
  any positive case reporting the wrong case; abstain rate so high the tool is
  effectively unusable on real inputs.

## 7. Campaign B — Retrospective convergence + drift quantifier (v2 PREMISE)

**Goal.** Two questions: (1) does directed first-divergence climbing track real
fix progress? (2) **how badly does `ig_idx` drift across source edits?** —
because that drift is exactly what the spec says gates v2's identity layer.
This is the single highest-value finding for the next-phase go/no-go.

**This is deliberately cross-compile.** Each WIP source version is a different
compile, so v1's same-source contract does not hold. Expect rough behavior; the
*value is measuring how rough*.

**Mechanism (the only one that works — read this before step 4).** You CANNOT
dump a historical source by writing it to `/tmp/*.c`: `debug dump local` rejects
files outside the repo (`_resolve_src_relative` → "not inside the melee repo")
and then needs a registered `build.ninja` unit for the file. And read-only
forbids overwriting the real tracked `.c`. The mechanism is a **disposable git
worktree per rev**: the historical `.c` sits at its real registered unit path
inside the throwaway checkout, and the tooling resolves the repo root from CWD
(`_detect_melee_root`), so dumping from inside the worktree dumps that rev. This
is permitted under read-only (see Section 1): it reads committed history into a
throwaway location and never mutates tracked state.

**Procedure.**
1. Pick 1–2 functions from 4d with a multi-step fix history. Note the unit path
   and the matching commit.
2. `git log --follow --oneline -- <path>` → the ordered rev list from first
   attempt to the matching commit. Choose the revs to sample (all, or a fixed
   subset incl. first / middle / last). Record the chosen revs.
3. **Final target** = the matched coloring. Dump the matched source
   (`--no-cache-sync -o /tmp/fdiv/<FN>_matched.txt`), then build a faithful
   target with `target derive -f <FN> /tmp/fdiv/<FN>_matched.txt
   --force-phys-safe --class 0 --format json` (NOT default derive — see
   Section 3). Its `virtuals` map and keys are the fixed reference for drift
   below.
4. For each sampled rev `R` (disposable worktree). A fresh historical worktree
   needs MORE bootstrap than a bare `configure.py` (learned in the 2026-05-28
   run); the exact set varies with rev age:
   ```bash
   git worktree add --detach /tmp/fdiv/wt-$R $R
   cd /tmp/fdiv/wt-$R
   # --- bootstrap: borrow build prerequisites from the main checkout ($MAIN) ---
   mkdir -p orig/GALE01/sys
   ln -sf  $MAIN/orig/GALE01/sys/main.dol orig/GALE01/sys/main.dol  # configure needs it
   ln -sfn $MAIN/build/compilers          build/compilers           # patched debug compiler
   python configure.py
   ninja build/GALE01/config.json         # some revs need this, then re-configure:
   python configure.py
   ln -sf  $MAIN/build/GALE01/report.json build/GALE01/report.json  # for step-5 virtual-to-var
   # --- dump this rev (cwd root → this WT) ---
   melee-agent debug dump local src/melee/<module>/<unit>.c -f <FN> \
       --no-cache-sync -o /tmp/fdiv/<FN>_$R.txt
   cd - && git worktree remove --force /tmp/fdiv/wt-$R
   melee-agent debug inspect first-divergence -f <FN> \
       --force-phys '<final target map>' /tmp/fdiv/<FN>_$R.txt
   ```
   Use the CURRENT `melee-agent` on PATH (so `--no-cache-sync` etc. exist) — only
   the *source* is historical. If a rev's `configure.py` fails, record it as a
   per-rev limitation. Record the first divergence at each rev. (These bootstrap
   frictions are themselves a recorded tooling gap — a `--from-worktree` helper
   would remove them.)
5. **Drift measurement (operational — do NOT eyeball "a couple").** For each
   sampled rev `R`:
   - **Denominator** = every target key (force-phys `ig_idx`) from step 3; or,
     if the map is large, a fixed pre-registered sample of keys used for *all*
     revs (same set every rev).
   - For each key, map `ig_idx` → role descriptor at `R` via the symbol bridge
     (`virtual-to-var` + first-def / `trace-copy`; pass the explicit
     `/tmp/fdiv/<FN>_$R.txt` path), and classify:
     - **matched** = resolves to the SAME role/variable as at the matched rev
     - **ambiguous** = bridge returns low-confidence / multiple candidates
     - **missing** = no such node at `R` (coalesced / spilled / absent)
   - Record the three counts. `drift_rate(R) = (ambiguous + missing) / denominator`.
6. **Convergence read — GATED on identity validity.** Define a validity
   threshold (default: matched ≥ 0.8 of the denominator). Only for revs at/above
   threshold, judge whether the first divergence moved later / tracked the actual
   edit path. For revs below threshold, the raw `ig_idx` comparison is
   untrustworthy → mark that rev's convergence signal **INVALID** and exclude it
   from the verdict (its drift number still counts).

**Pass/fail (exploratory — "pass" = a clear, quantified answer, not green tests).**
- Report `drift_rate` per sampled rev with the denominator stated, and the
  fraction of revs that fell below the identity-validity threshold.
- Deliver a verdict gated on that: if most sampled revs are above threshold AND
  the first divergence tracks the real edit path, a live v2 loop is plausibly
  viable on raw `ig_idx`; if drift pushes many revs below threshold, v2 must
  build the role-descriptor identity layer BEFORE the convergence loop. State
  which, with the numbers behind it.

## 8. Campaign C — Source-layer probe (CONFIRM + BASELINE THE BRIDGE)

Runs against the CURRENT checkout (no disposable worktrees). Goals: confirm the
advisory layer is non-functional, **rigorously baseline the symbol bridge's
quality**, scope the wiring fix, and judge whether the bridge can underpin the
role-descriptor identity layer v2 needs.

**Known bug to confirm first.** In `first_divergence.py`,
`_list_bindings_safe(source_text, fev)` calls
`list_bindings(source_text, fev, pre)`, but `symbol_bridge.list_bindings` has
signature `(source: str, fn_name: str, pre_pass)`. It passes a `FunctionEvents`
where a function-name string is expected, so it always throws and the `except`
returns `[]`. The CLI also calls `attach_source_ideas(report.fact, "", fev)` with
an EMPTY source string. Net: `--source` never produces a variable binding
("(symbol binding unavailable in v1)"). Verify empirically.

**Corpus.** Functions that produce a divergence: `gm_80173EEC` (Case D, ig
43/46), `lbDvd_80018A2C` (Case B, ig 46), + any harvested force-proofs. Build
targets with `target derive --force-phys-safe --class 0`. `virtual-to-var` needs
`build/GALE01/report.json` (present on a normal current build).

**Procedure.**
1. CONFIRM THE BUG: run `first-divergence ... --source` on gm + lbDvd; capture
   the verbatim "unavailable" advisory output.
2. PER-DIVERGENCE MAPPING: for each divergence `ig_idx`, run the working bridge
   CLIs with an EXPLICIT pcdump path (`virtual-to-var`, `trace-copy`,
   `virtual-to-ig`; confirm flags via `--help`). Record the var + confidence;
   judge correct?(vs the `.c`) and actionable?(for the case's lever).
3. BRIDGE QUALITY BASELINE (quantifies Campaign B's gap #4; baselines what a v2
   identity layer must beat): map EVERY class-0 decision `ig_idx` to a var and
   tabulate the confidence distribution (verified / best-guess / low-confidence /
   ambiguous / first-def-only / unmapped). Spot-check correctness on ~8-10 nodes
   to estimate the true high-confidence-correct rate.
4. SCOPE THE WIRING FIX: name the exact call sites and what each needs —
   `_list_bindings_safe`/`attach_source_ideas` must pass the function-name STRING
   + the right pre_pass (not the FunctionEvents) to `list_bindings`; the CLI
   `--source` branch in `debug.py` must read the actual unit `.c` text instead of
   `""` (and where that path/source comes from).
5. IDENTITY-LAYER READ: given step 3 + Campaign B's ~89% raw-`ig_idx` drift,
   report whether the current bridge can underpin a role-descriptor identity
   layer, or what it must add (first-def opcode/signature, live range, copy
   lineage, coalesce root — design spec open question #1).

**Pass/fail.**
- PASS: bug confirmed; bridge quality QUANTIFIED (a distribution + spot-checked
  correctness, not a vibe); wiring fix precisely scoped; clear read on whether
  the bridge can underpin the identity layer.

## 9. Overall go/no-go synthesis

After the three campaigns, answer for the user:
1. **Is v1 sound?** (A) — gated facts correct, no false positives, taxonomy
   sufficient on the corpus.
2. **Is v1 useful?** (A) — abstain rate (esp. r0), lever actionability,
   target-availability on stuck functions. Is the tool worth reaching for, or
   does it abstain/hand-wave too often?
3. **Is v2 convergence viable, and in what order?** (B) — does directed climbing
   track real progress, and is the drift bad enough that the role-descriptor
   identity layer must come before the convergence loop?
4. **What does the source layer need?** (C) — confirmed bug + concrete wiring
   scope + whether the bridge mapping quality justifies it.

Recommend the next phase based on these, not on a predetermined plan.

## 10. Hypotheses / gaps to actively probe (don't just confirm — try to break)

- **r0 abstain dominates** → tool rarely produces an actionable fact on real
  functions. (A: measure.)
- **`ig_idx` drift is pervasive, not occasional** → v1's same-source constraint
  is more limiting than it looks, and v2 is blocked on identity. (B: quantify.)
- **Target supply is the real bottleneck** → v1 only works where a force-proof
  already exists, i.e. after the hard part is done. (A 4c: how often is a target
  even available?)
- **Levers too generic to act on** → the gated layer names the right decision
  but not a source edit; the value depends on the (broken) source layer. (A + C.)
- **Cap-hit common on large functions** → many real targets abstain on
  truncated rows; the uncapped-dump hook is a prerequisite. (A: measure.)
- **`target derive` round-trip** → does derive→force-phys reproduce the same
  coloring exactly? (A negative controls double as this check.)

## 11. Deliverable back to the user

- The findings table (Section 5) for all campaigns.
- The four go/no-go answers (Section 9).
- A ranked list of concrete tooling gaps found, each with: what broke / fell
  short, the evidence (function + command + output), and a suggested fix size
  (small / medium / needs-design).
- An explicit recommendation for the next phase.
