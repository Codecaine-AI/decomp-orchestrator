# Project Workspace Layering

This follow-up objective owns the move from "Decomp Orchestrator lives inside a
Melee checkout" to "Decomp Orchestrator runs configured projects." It should be
started after the monorepo app/package restructuring has landed.

Keep durable handoff notes in `current_state.md`, not in a top-level
`CURRENT_STATE.md`.

## Objective Files

- `goal.md` - objective, context refresh, strategy, success metrics, non-goals,
  and completion criteria.
- `current_state.md` - compact objective-local handoff state for active work.
- `context/00_problem.md` - problem statement and motivation.
- `context/01_constraints.md` - hard constraints, validity rules, and boundaries.
- `context/02_implementation_scope.md` - files, modules, and systems this
  objective may change.
- `context/03_working_plan.md` - phase-gated execution plan with inputs,
  outputs, gates, and failure handling.
- `context/04_validation_and_handoff.md` - acceptance checks and handoff rules.
- `examples/` - configs, prompts, command snippets, or fixtures that make the
  objective concrete.

Objective path: `objectives/project-workspace-layering/`

## Important Starting Point

The prerequisite monorepo layout is already represented by:

- `apps/cli`
- `apps/dashboard`
- `apps/dashboard-server`
- `packages/core`
- `packages/agents`
- `packages/knowledge`
- `packages/ui-contract`

This objective should build on that split. It should not redo the monorepo
restructure.
