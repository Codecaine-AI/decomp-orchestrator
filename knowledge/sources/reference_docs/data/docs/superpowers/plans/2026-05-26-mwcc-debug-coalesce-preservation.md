# mwcc-debug Coalesce-Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coalesce-preservation constraint to the custom simplify-order scorer that rejects candidates where any target `ig_idx` (from `force_phys`) has been coalesced into another root virtual. Validated empirically against the existing gm_80173EEC candidate pool.

**Architecture:** Reuse the existing pcdump COALESCE event parsing (`colorgraph_parser.py`). Add a helper that, given a candidate pcdump + target ig_idx set + class id, returns the subset that are coalesced as aliases. In `compute_lex_score`, return a sentinel "structural rejection" score (effectively infinity) when any target ig_idx is coalesced — this drives permuter to discard those candidates. Hook through a target.yaml field `coalesce_preservation` (default `true` when `force_phys` is present) and a `--no-coalesce-preservation` opt-out on the setup CLI for cases where the user knows the target tolerates coalescing.

**Tech Stack:** Python 3.11+, pytest, existing `colorgraph_parser` + `simplify_order_scoring` + `permuter_config`. No new dependencies.

**Spec:** Deferred technical debt item #19 in `docs/mwcc-debug-diff-roadmap.md`.

**Phase roadmap:** Phase 2 of 4. Phase 1 (#20 pre-flight polarity check) shipped at `ef0f95b2c`. Phases 3 (full late-target syntax) and 4 (phys-iter scorer mode) follow.

---

## Stage Structure (Critical)

**Phase 2 is gated by an empirical sub-experiment.** The roadmap entry for #19 captures the open question:

> Whether candidates that satisfy the simplify-order prefix WITHOUT coalescing target virtuals exist in the mutation neighborhood. If yes, the constraint shapes search productively. If no, gm-style targets are unreachable via decomp-permuter regardless, and the constraint just makes the failure explicit rather than letting search burn cycles.

We don't yet know which case we're in. The gm_80173EEC campaign showed that mutations satisfying the simplify-order prefix `[34, 37, 32]` also coalesced ig_idx 42 and 38 into root virtual 3 — but the diagnostic only inspected one candidate (output-139-1). The whole pool (~500 candidates) might contain candidates that preserve all 6 force-phys ig_idx as independent nodes. Or it might not.

Phase 2 therefore has two stages:

| Stage | Scope | Decides |
|---|---|---|
| **Stage 1: Empirical sub-experiment** | Static analysis on the existing gm pool. No code changes to the scorer. | Whether Stage 2 is worth building. |
| **Stage 2: Build the constraint** | Implementation tasks for the scorer + CLI + validation. Only if Stage 1 says proceed. | The Phase 2 deliverable itself. |

Stage 1 is fully planned below. Stage 2 is sketched at the end — its detailed task breakdown gets written after Stage 1 reports back, because the design will be informed by what Stage 1 finds (e.g., do we need a strict reject, or a soft penalty?).

---

## Scope Check

Stage 1 is a single deliverable: a yes/no answer to "do non-coalescing candidates exist in the gm pool?" Plus a histogram showing the distribution of preserved-count across candidates and the match% of any candidates that preserve all 6.

Out of scope for Stage 1:
- Any code changes to the scorer module
- Any new permuter runs
- Any decisions about the constraint's UX (CLI flag shape, target.yaml field semantics)

In scope for Stage 1:
- An ad-hoc Python analysis script (lives in campaign agent's working dir, not committed to the main repo unless useful for reuse)
- A report appended to `docs/mwcc-debug-gm_80173EEC-campaign-2026-05-25.md` documenting the findings
- A go/no-go recommendation for Stage 2

Stage 2 scope (preliminary) is described at the end of this plan.

## File Structure

**Stage 1:**

| File | Action | Responsibility |
|------|--------|----------------|
| `nonmatchings/gm_80173EEC/coalesce_experiment.py` (or similar path in campaign agent's worktree) | Create (ad-hoc) | Analyze pool for coalesce preservation |
| `docs/mwcc-debug-gm_80173EEC-campaign-2026-05-25.md` | Modify | Append Stage 1 results section |

**Stage 2:** see sketch at end.

---

## Task 1 (Stage 1): Empirical sub-experiment — gm pool coalesce preservation analysis

**Goal:** For each candidate in the existing gm_80173EEC pool, determine whether the 6 force-phys target ig_idx values (`34, 37, 32, 42, 52, 38`) remain *independent* in the candidate's allocator graph (not coalesced as aliases of another root). Produce a histogram and a top-N list with match% data.

**Files:**
- Create (ad-hoc, in campaign agent's working dir): `coalesce_experiment.py`
- Modify: `docs/mwcc-debug-gm_80173EEC-campaign-2026-05-25.md`

**Method (per candidate):**

1. Locate the candidate's `.o` file in the pool directory (e.g. `nonmatchings/gm_80173EEC/output-N-M/`).
2. Generate the candidate's pcdump (either from cache if it exists, or by re-compiling via the existing `compile.sh` wrapper).
3. Parse the pcdump using `colorgraph_parser.parse_hook_events`. Look at the `COALESCE` events for class 0 — specifically the "natural mappings (virt -> root)" lines.
4. For each target ig_idx in `{34, 37, 32, 42, 52, 38}`, check whether it appears as the LHS of any natural coalesce mapping (i.e., it's an alias of some root). If yes → that ig_idx is coalesced-away.
5. Record per candidate: `preserved_count` (0–6), `aliased_set` (subset of the 6 that are coalesced), and the candidate's real-tree match% (look up from the existing triage data — there's an existing triage report in the campaign writeup; if it's not directly accessible, re-run triage on the pool).

**Output:**

```text
Pool size: N candidates
Histogram of preserved_count (out of 6):
  6 preserved: N6
  5 preserved: N5
  4 preserved: N4
  3 preserved: N3
  2 preserved: N2
  1 preserved: N1
  0 preserved: N0

Top-N candidates by preserved_count (ties broken by match%):
  output-XXX-Y: preserved=6/6, match=99.XX%, aliased=[]
  output-YYY-Z: preserved=5/6, match=99.XX%, aliased=[42]
  ...

Match% summary for preserved=6/6 candidates:
  max: ...
  mean: ...
  count >= 99.5%: ...
  count == 100.0%: ...
```

- [ ] **Step 1.1: Write the analysis script**

Create `coalesce_experiment.py` in the campaign agent's working directory. It should be runnable as `python3 coalesce_experiment.py /path/to/gm_80173EEC/pool`.

Skeleton (campaign agent fills in the pcdump-generation and triage-lookup details based on what's available in their worktree):

```python
"""Coalesce preservation experiment on gm_80173EEC pool.

For each candidate in the pool, determine whether the 6 force-phys
target ig_idx values remain independent (not coalesced) in the
candidate's class-0 allocator graph. Output histogram + top-N report.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from collections import defaultdict


TARGET_IG_IDX: set[int] = {34, 37, 32, 42, 52, 38}
CLASS_ID = 0


def find_coalesced_targets(pcdump_text: str, function: str) -> set[int]:
    """Return the subset of TARGET_IG_IDX that are coalesced as aliases
    in the function's class-0 natural coalesce mappings."""
    # Import from the in-repo parser. Adjust the import to whatever
    # works from the campaign agent's working dir; if needed, set
    # PYTHONPATH=/Users/mike/code/melee/tools/melee-agent.
    from src.mwcc_debug.colorgraph_parser import find_function, parse_hook_events

    events = parse_hook_events(pcdump_text)
    fn_events = find_function(events, function)
    if fn_events is None:
        return set()

    coalesced: set[int] = set()
    for section in fn_events.coalesce_sections:
        if section.class_id != CLASS_ID:
            continue
        # natural mappings are virt -> root pairs; the LHS is the
        # virtual that becomes an alias of the RHS root
        for virt, root in section.natural_mappings:
            if virt in TARGET_IG_IDX:
                coalesced.add(virt)
    return coalesced


def get_match_percent(candidate_dir: Path) -> float | None:
    """Look up the candidate's real-tree match% from triage data.

    Implementation depends on what's available in the campaign agent's
    worktree. Options in order of preference:
    1. Re-read triage output files (e.g. triage_report.json) if cached
    2. Run `tools/checkdiff.py` on a freshly-compiled .o (slowest)
    3. Parse the existing campaign writeup for top-N match% data
    """
    # Campaign agent fills in based on their tooling.
    ...


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pool", type=Path, help="Path to nonmatchings/<function>/")
    args = parser.parse_args()

    function = "gm_80173EEC"
    histogram: dict[int, int] = defaultdict(int)
    rows: list[tuple[str, int, set[int], float | None]] = []

    for candidate_dir in sorted(args.pool.glob("output-*")):
        # Generate or fetch the candidate's pcdump (campaign agent details)
        pcdump_text = ...  # bytes -> str via the compile.sh wrapper
        coalesced = find_coalesced_targets(pcdump_text, function)
        preserved_count = len(TARGET_IG_IDX) - len(coalesced)
        match = get_match_percent(candidate_dir)
        histogram[preserved_count] += 1
        rows.append((candidate_dir.name, preserved_count, coalesced, match))

    # Sort by preserved_count desc, then match desc
    rows.sort(key=lambda r: (-r[1], -(r[3] or 0.0)))

    print(f"Pool size: {len(rows)} candidates")
    print()
    print("Histogram of preserved_count (out of 6):")
    for k in range(6, -1, -1):
        print(f"  {k} preserved: {histogram[k]}")
    print()
    print("Top 20 candidates by preserved_count:")
    for name, preserved, aliased, match in rows[:20]:
        aliased_str = ",".join(str(x) for x in sorted(aliased)) or "(none)"
        match_str = f"{match:.2f}%" if match is not None else "?"
        print(f"  {name}: preserved={preserved}/6, match={match_str}, "
              f"aliased=[{aliased_str}]")
    print()
    print("Match% summary for preserved=6/6 candidates:")
    six_six = [r for r in rows if r[1] == 6 and r[3] is not None]
    if six_six:
        matches = sorted(r[3] for r in six_six)
        print(f"  count: {len(six_six)}")
        print(f"  max: {matches[-1]:.2f}%")
        print(f"  mean: {sum(matches) / len(matches):.2f}%")
        print(f"  count >= 99.5%: {sum(1 for m in matches if m >= 99.5)}")
        print(f"  count == 100.0%: {sum(1 for m in matches if m == 100.0)}")
    else:
        print("  (none with preserved=6/6)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 1.2: Validate the script on a known candidate**

Before running on the full pool, sanity-check the script against `output-139-1` (the gm campaign's diagnostic candidate). Expected result:
- `preserved_count = 4` (ig_idx 42 and 38 coalesced; 34, 37, 32, 52 preserved)
- `aliased = {42, 38}`

Run: `python3 coalesce_experiment.py /path/to/nonmatchings/gm_80173EEC | head -30`

If output-139-1 doesn't show preserved=4/6 with aliased={42, 38}, the script has a parsing bug. Stop and debug before running on the full pool.

- [ ] **Step 1.3: Run on the full pool**

Run: `python3 coalesce_experiment.py /path/to/nonmatchings/gm_80173EEC > /tmp/coalesce_experiment_report.txt`

Capture the full report. Expected runtime: a few minutes (most candidates have cached pcdumps already from the original campaign).

- [ ] **Step 1.4: Decision based on results**

Three outcomes:

**Outcome A: ANY candidate has preserved=6/6 AND match% ≥ 99.5%**

Strong evidence the constraint would be productive: there's at least one candidate near 100% that the constraint would have ranked highly. Recommend proceeding to Stage 2 build, with a follow-up validation campaign on a fresh permuter run.

**Outcome B: SOME candidates have preserved=6/6 but NONE have match% ≥ 99.5%**

Mixed signal: non-coalescing candidates exist (the constraint has something to score), but none close the gap in the existing pool. Recommend proceeding to Stage 2 build — the constraint shapes the search, and a new permuter run biased toward preserve-6/6 may find a 100% match in the unexplored region of the mutation space. Note this as a riskier bet than Outcome A.

**Outcome C: NO candidate has preserved=6/6 (or only 1–2 candidates do, with low match%)**

The constraint would reject essentially the entire current mutation neighborhood. gm-style targets are likely unreachable via decomp-permuter regardless of how we score. STOP. Document the ceiling in the roadmap (#19 entry: "verified empirically that gm-style coalescing-dependent targets are not reachable by decomp-permuter mutations as of 2026-05-26") and skip the build. Move to Phase 3 (late-target scorer).

- [ ] **Step 1.5: Append findings to the campaign writeup**

In `docs/mwcc-debug-gm_80173EEC-campaign-2026-05-25.md`, append a new section:

```markdown

## Coalesce-preservation experiment (2026-05-27)

Static analysis on the existing 500-candidate gm_80173EEC pool to
determine whether non-coalescing candidates exist in the mutation
neighborhood. Method: for each candidate, parse class-0 natural
coalesce mappings; record how many of the 6 force-phys target ig_idx
values `{34, 37, 32, 42, 52, 38}` remain independent.

Script: `coalesce_experiment.py` (ad-hoc; not committed to main repo).

[paste the histogram + top-N report from /tmp/coalesce_experiment_report.txt]

**Outcome:** [A / B / C — describe which case]

**Recommendation:** [proceed to Stage 2 build / or document ceiling]

**Implications for deferred-debt #19:** [if Outcome A or B, the
constraint is a useful refinement; if Outcome C, document the
gm-style ceiling as a known limit of decomp-permuter for this kind
of target.]
```

Commit the writeup update with message:
```
docs: append coalesce-preservation experiment to gm campaign

Stage 1 of Phase 2 of deferred-debt #19. Records the empirical
sub-experiment finding that gates whether the build proceeds.

Outcome: [A/B/C].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Push to origin/master.

- [ ] **Step 1.6: Report back to the controller**

After Step 1.5, report the outcome to the controller (this conversation). Format:

```
Stage 1 outcome: [A / B / C]

Histogram:
  6 preserved: N
  5 preserved: N
  ...

Top candidates with preserved=6/6:
  output-X: match=Y%
  ...

Recommendation: [proceed / stop]
Writeup committed at: <commit SHA>
```

The controller then either writes the Stage 2 build plan (if A or B) or updates the roadmap and moves to Phase 3 (if C).

---

## Stage 2: Build the coalesce-preservation constraint (SKETCH — full plan written post-Stage-1)

Only triggered if Stage 1 reports Outcome A or B. Skeleton:

### Sketch Task 2A: Coalesce-tracking helper in scoring module

Add `find_coalesced_targets(events: FunctionEvents, targets: set[int], class_id: int) -> set[int]` in `simplify_order_scoring.py`. Mirrors the Stage 1 script's logic but lives in the in-repo module so it's testable and reusable.

### Sketch Task 2B: Add coalesce_preservation to compute_lex_score

When `spec.force_phys` is non-empty AND `spec.coalesce_preservation` is enabled, check whether any of `force_phys.keys()` are coalesced in the candidate. If yes, return a sentinel "structural rejection" score (the existing `LEX_BIG * (target_len + 1)` would dominate any normal score and effectively reject).

### Sketch Task 2C: Add coalesce_preservation field to SimplifyOrderTargetSpec

Optional bool, default `True`. When False, the constraint is disabled (useful for diagnostics or for cases where the user knows the target tolerates coalescing).

### Sketch Task 2D: Add CLI plumbing

- New `--no-coalesce-preservation` flag on `setup-simplify-order-scorer` (writes `coalesce_preservation: false` into target.yaml)
- New `Coalesce preservation:` line in `score-simplify-order --breakdown` showing whether the candidate would be rejected
- Optionally: a `--breakdown` polarity-like section showing which target ig_idx are coalesced

### Sketch Task 2E: Update permuter_config rendering

If `force_phys` is rendered, also render `coalesce_preservation` when set (or rely on the loader's default).

### Sketch Task 2F: Validation campaign on gm_80173EEC

Re-run the remote permuter for gm_80173EEC with the new constraint enabled. Acceptance: either a 100% candidate is found (Phase 2 succeeds end-to-end, validates #19 as the right answer), or the post-run triage's top match% is the same as the existing pool's (constraint correctly shaped the search but the function genuinely is unreachable — Stage 1 Outcome B confirmed).

Detailed tasks/steps for Stage 2 will be written after Stage 1 reports back. Estimated effort once triggered: 1-2 days for the implementation + a remote permuter run (~2-3 hours of cloud time).

---

## Self-Review Notes

Stage 1 coverage check:
- ✅ Analysis script with skeleton code
- ✅ Sanity-check on output-139-1
- ✅ Full-pool run
- ✅ Decision tree (Outcomes A/B/C)
- ✅ Writeup append + commit
- ✅ Report back to controller

Placeholder scan: the script skeleton has `...` for two campaign-agent-specific functions (pcdump generation and match% lookup). These are intentional — the implementer knows their worktree's tooling better than I do. The skeleton names the responsibility clearly.

Stage 2 sketch is intentionally light. Per the writing-plans skill, speculative tasks become dead weight if the premise changes. The full Stage 2 plan gets written when (and if) Stage 1 says proceed.

## Validation Campaign

Stage 1's writeup append IS the validation: the report documents the empirical answer to whether the constraint is worth building. If Outcome A or B, Stage 2's task list ends with a separate validation campaign (remote permuter re-run). If Outcome C, no Stage 2 happens and the documentation update is the closure.
