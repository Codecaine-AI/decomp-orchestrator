---
covers: Centralized agent catalog, runtime role boundaries, and non-agent trigger/guardian actors
concepts: [agents, director-agent, worker-agent, pr-review-agent, runtime, trigger-actors, guardians]
---

# Agent Model

The orchestrator has a small set of named agents with explicit boundaries. New
agents should be added to the central catalog and given a colocated prompt,
input builder, output contract, and runtime integration.

The package also has evented process actors such as the trigger actor and
guardian process. They can make rule-based decisions and sleep between events,
but they are not Pi agents. They own process and state-machine mechanics, not
board reasoning.

## Roles

| Agent | Owns | Does Not Own |
| --- | --- | --- |
| Director | Board-level scheduling, target-packet selection, wake-event decisions | Source edits, local decomp research, direct worker supervision |
| Worker | One leased target packet, research, edits, local validation, durable report | Board strategy, cross-worker coordination, unleased file edits |
| PR-review | PR postmortem/review analysis and reusable review knowledge | Live decomp worker execution, director scheduling |

## Process Actors

| Actor | Owns | Does Not Own |
| --- | --- | --- |
| Trigger actor | Durable wake-event reaction, director activation, worker-slot realization, sleep between board events | Source edits, board strategy independent of the director, process crash repair |
| Guardian process | Decomp system process health, incident capture, failed/expired lease recovery, restart policy | Target selection, worker tactics, hidden always-on agent memory |

## Runtime Boundary

The non-agent runner owns process control, state transitions, file locks,
artifact paths, and Pi session invocation. Agents own reasoning and structured
outputs. This split keeps coordination deterministic while still letting agents
make high-context decisions where they are useful.

The director may decide that more worker work should happen, but the runtime
materializes that intent as leases and worker processes. The guardian may decide
that a process incident needs recovery, but the runtime materializes that intent
as lease recovery commands and process restarts.

## Prompt Shape

Each agent receives:

- A system prompt that defines authority, role boundaries, safety rules, and
  output contract.
- An initial user prompt that contains the current run state or assigned target
  packet, selected knowledge, available tools, and required output path.

Rendered prompts are artifacts. They are part of the audit trail and should be
preserved beside agent output.

## Adding Agents

A new agent should enter through the same catalog as the director, worker, and
PR-review agents. It should not create a side-channel prompt tree or hidden
runtime path. The package should have one obvious place to discover every agent
role and its contract.
