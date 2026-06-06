---
covers: Board prioritization, candidate-prior scoring, and director scheduling signals
concepts: [board-prioritization, candidate-prior, helper-score, scheduling, constraint-propagation]
---

# Board Prioritization

Board helpers produce deterministic candidate-prior features. The director uses
those features as input, but final scheduling belongs to the director because it
can reason over the whole run state.

The helper score should surface places where a worker is likely to create useful
information. It should not only surface functions that look locally close to
100%.

## Snapshot And Refill Semantics

`loadBoardSnapshot` reads the current `build/GALE01/report.json` and
`objdiff.json`, builds imperfect-function candidates, scores them with the
helper prior, and returns the highest-ranked candidate window. The snapshot is a
fresh read of the available board artifacts. The trigger does not run the Melee
build or objdiff pipeline itself; when those artifacts are regenerated, the next
snapshot observes the updated scores.

The runtime uses two different limits:

- Candidate window: how many ranked board candidates are inspected during a
  director tick or deterministic refill.
- Queue target size: how many ready queue rows the trigger tries to keep
  available for workers.

For example, a run can keep a queue target of 128 while scanning a candidate
window of 512. As workers consume the first pool, refill can pull candidates
129 and beyond instead of waiting for the pool to reach zero or reusing stale
attempts.

## Candidate Prior

```text
candidate_prior =
  roi_score_from_report
  + duplicate_ref_bonus
  + graph_degree_bonus
  + linked_unlock_bonus
  + constraint_propagation_bonus
  + stale_fact_bonus
  - write_lock_penalty
  - recent_stall_penalty
  - data_rodata_risk_penalty
  - reviewability_debt_penalty
```

## Signals

| Signal | Why It Matters |
| --- | --- |
| Matched duplicate ref | A matched source shape can be adapted across unrelated files when assembly shape supports it. |
| Graph degree | A target connected to many similar functions can propagate more facts if solved or partially improved. |
| Few unit blockers | A small set of blockers can unlock linked progress when they are close and well constrained. |
| Worker context quality | Nearby matched siblings, graph edges, or reducer facts make deep worker research more grounded. |
| Recent stalls | Repeated no-delta attempts should cool down the target unless new facts arrive. |
| Data/rodata risk | Header, static, section-order, split, and relocation-sensitive work needs slower validation and fewer parallel edits. |

## Director Contract

The director receives the board plus the helper prior and decides the next
bounded target packet. A high prior is not an instruction to edit. It is a
claim that this target may produce leverage, which the director can accept,
defer, cool down, or redirect into fact research.

## Parallel Capacity Signal

Raw queue depth is not enough for a parallel run. If many queued targets share
one source file, active file locks can leave most workers idle even while the
queue looks full. Refill therefore tracks schedulable distinct source paths and
prefers fresh candidates from source paths that are not already queued or
actively locked. The trigger asks the director for a replan when the queue is
low, the schedulable distinct-source pool is low, queued work is blocked by
locks, or a long tail persists.

## Related

- [Run director loop](10-run-director-loop.md)
- [Core principles](05-core-principles.md)
