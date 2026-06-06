---
covers: Run director responsibilities, trigger actor semantics, cycle, wake conditions, and worker report contract
concepts: [director, trigger-actor, board, queue, target-packets, wake-events, reports]
---

# Run Director Loop

The run director is the central board-level agent. It reads the current run
state, decides which target packets are most useful next, writes decisions, and
then goes idle. It does not perform source archaeology or source edits.

## Behavior

Each director cycle has four phases:

1. Board read: absorb progress, active leases, queued targets, worker reports,
   accepted facts, rejected hypotheses, duplicate groups, and recent stalls.
2. Prioritization: use helper scores and recent evidence to identify targets
   that can create useful information.
3. Delegation: emit bounded target packets and worker-slot intent.
4. Sleep: write decisions and stop until a durable event wakes the director.

The director's job is to choose the next valuable square on the board. Helper
scores can rank likely targets, but the final scheduling decision belongs to the
director because it has the full context of the run.

## Director Cycle

```text
+------------------+     +------------------+     +------------------+
| Wake event       |---->| Board snapshot   |---->| Pi director      |
| - run started    |     | - run target     |     | choose next      |
| - worker stalled |     | - indexer output |     | influence point  |
| - worker done    |     | - reducer output |     | under budget     |
| - refill needed  |     | - leases/stalls  |     | and locks        |
+--------+---------+     +------------------+     +--------+---------+
         ^                                                 |
         |                                                 v
         |                  +------------------+     +-----+------------+
         |                  | Write state      |<----| Decision bundle  |
         |                  | - queue rows     |     | - target packets |
         |                  | - lease intents  |     | - priorities     |
         |                  | - fact requests  |     | - budgets        |
         |                  | - cooldowns      |     | - cooldowns      |
         |                  | then sleep       |     | - fact packets   |
         |                  +--------+---------+     +------------------+
         |                           |
         |                           v
         +------ director inactive until another durable event wakes it
```

The cycle is intentionally short. The director does one board read, writes one
decision bundle, and exits. It is resumed by durable events rather than kept
alive as a hidden strategic loop.

The trigger actor is the non-agent process component that gives this a
resting-agent feel. It checks durable events, activates one director turn when a
wake event exists, maintains the queued target pool from board snapshots,
realizes worker-slot intent as worker processes, and then sleeps without
keeping a Pi director session alive.

The director does not directly own process spawning. It decides what should be
worked next; the trigger/runtime layer makes that process work happen under
leases.

## Ready Pool Refill

The trigger actor treats queue shape as process state. On each loop pass it
re-reads the current board snapshot artifacts, refills queued work toward the
configured queue target, starts workers for open slots, and then lets the
director handle one wake event. Worker-slot refill therefore does not wait for a
long director turn when unlocked queued work already exists.

The queue target and board scan width are separate:

- Queue target: the number of queued targets the trigger tries to maintain.
- Queue low watermark: the point where a `pool_below_target` event asks the
  director to reconsider the pool.
- Schedulable low watermark: the minimum useful count of distinct unlocked
  source paths, because many queued functions in one locked file cannot keep a
  parallel worker pool full.
- Candidate window: the number of board-ranked candidates inspected for fresh
  refill work.

Refill prefers candidates that have not already been queued, leased, reported,
or stalled in the run. It also prefers distinct unlocked source paths before
adding additional functions from an already queued source. If deterministic
refill cannot satisfy the target or distinct-source floor, the trigger emits a
`pool_below_target` event so the director can replan with the latest worker
reports and facts.

Director target packets can requeue a previously attempted target when new
facts or changed board context make that target worth another pass. That
authority stays with the director; automatic refill is deliberately biased
toward fresh, unattempted work.

## Wake Events

The director wakes when durable state says it should act:

- A run starts.
- Active workers drop below the desired count.
- A worker finishes, stalls, asks for a fact, or produces a score candidate.
- New facts are accepted.
- A score integration changes the board.
- The run checkpoint goal is reached and the system should pause for handoff.

Workers do not need the director to be live while they work. They write reports
and events, then the runner invokes the director again when the next decision is
needed.

## Target Packets

A target packet is the director's bounded delegation contract. It should name
the target, write set, context to read first, relevant facts, rejected
hypotheses, budget, capability hints, validation expectations, and stop
conditions. The packet gives the worker enough shape to act without giving it
board-level authority.

## Worker Report Contract

A worker report should tell the board what changed:

- Progress: verified source improvement or a candidate ready for the score
  integration gate.
- Facts: reusable type, symbol, source-shape, duplicate, resource, or PR-derived
  evidence.
- Negative results: grounded hypotheses that failed and should not be repeated.
- Blockers: exact missing constraints that justify a fact-research packet.
- Stall state: evidence is exhausted and the worker should stop before random
  mutation.

The report is more important than the worker session. Future decisions consume
durable evidence, not hidden conversation state.
