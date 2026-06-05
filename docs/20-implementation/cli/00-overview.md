---
covers: D-Comp Orchestrator CLI command modules and operator command surface
concepts: [cli, commands, init-run, tick, worker, trigger-agent, babysit, recovery, regression-check]
code-ref: decomp-orchestrator/src/cli, decomp-orchestrator/src/bin/decomp-orchestrator.ts
---

# CLI: Overview

The CLI is split into command modules under `src/cli/commands/`. The binary
entry point stays thin: it parses arguments, applies defaults, and dispatches
to the selected command.

## File Tree

```text
src/
+-- bin/
|   +-- decomp-orchestrator.ts
+-- cli/
    +-- args.ts
    +-- defaults.ts
    +-- main.ts
    +-- usage.ts
    +-- commands/
        +-- babysit.ts
        +-- index.ts
        +-- init-run.ts
        +-- recover-leases.ts
        +-- regression-check.ts
        +-- shared.ts
        +-- status.ts
        +-- tick.ts
        +-- trigger-agent.ts
        +-- worker.ts
```

## Commands

| Command | Purpose |
| --- | --- |
| `init-run` | Creates run state, stores the run checkpoint goal, loads board data, queues initial candidate targets, and writes the initial board snapshot. |
| `tick` | Handles one unhandled wake event by running one director cycle. |
| `worker` | Leases one queued target, runs one worker session, writes report artifacts, releases the lease, and emits a wake event. |
| `trigger-agent` | Resting supervisor loop that wakes the director on events, starts workers up to `desired_workers` or `--max-workers`, and sleeps when the board is quiet. |
| `bootstrap` | Alias for `trigger-agent`. |
| `babysit` | Guardian wrapper that launches the decomp system command, captures process-health incidents, recovers failed or expired leases, and restarts according to policy. |
| `recover-leases` | Converts interrupted or expired active leases into durable stalled reports after operator confirmation. |
| `regression-check` | Wraps the repo's global saved-baseline regression gate and writes run artifacts. |
| `status` | Prints run, queue, lease, event, and report summary data. |

## Boundaries

The CLI keeps the single-step commands for debuggability, exposes
`trigger-agent` / `bootstrap` for autonomous decomp-system runs, and exposes
`babysit` as the outer guardian process for long-running development sessions.

The trigger-agent is deliberately not a Pi agent. It is a thin evented loop over
durable SQLite state: wake the director for unhandled events, start worker
sessions for open slots, then rest until state changes. The babysit command is
also not a Pi agent. It wraps the decomp system process, sleeps while that
process runs, wakes on process exit or worker-process error, writes guardian
artifacts under `state_dir/guardian/`, runs `recover-leases` when appropriate,
and restarts the child when policy allows.

`--worker-thinking-level` lets the trigger actor launch worker Pi sessions with
a different thinking level from the director. For example, the director can stay
on the global default while workers run with `--worker-thinking-level low`.

The trigger actor also owns queue-refill wakeups. It writes a prioritized
`pool_below_target` event when capacity is becoming inefficient and lets the
director decide what to enqueue next. The defaults wake the director when total
queued work falls to 25% of `--candidate-limit`, when unlocked distinct-file
work falls below `--max-workers`, when queued work is blocked by active file
locks, or when a long-tail drain persists for five minutes. Operators can tune
this with:

| Flag | Meaning |
| --- | --- |
| `--queue-low-watermark <n>` | Wake when total queued work is at or below `n` while workers are active. |
| `--schedulable-low-watermark <n>` | Wake when unlocked distinct-file work is at or below `n` while the run is underfilled. |
| `--active-low-watermark <n>` | Active-worker threshold for long-tail detection; default is 75% of `--max-workers`. |
| `--long-tail-replan-ms <n>` | Wake after underfilled long-tail state persists for `n` ms. |
| `--replan-interval-ms <n>` | Optional periodic director wake while workers are active; default `0` disables it. |
| `--replan-cooldown-ms <n>` | Minimum delay between trigger-produced replan events. |
| `--no-blocked-queue-replan` | Disable replans caused only by queued work blocked behind file locks. |

The babysit wrapper forwards these trigger flags to its child `bootstrap` or
`trigger-agent` command.

`init-run --goal-kind matched_code_percent --goal-value <percent>` records the
checkpoint for this run. The checkpoint is a pause/handoff threshold for the
current batch, not the final decompilation objective. The long-term project
target remains `100%` matched code.

## Related

- [State implementation](../state/00-overview.md)
- [Agent runtime](../agents/30-runtime.md)
