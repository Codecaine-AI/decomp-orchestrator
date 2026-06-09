# Monorepo Restructuring

This objective plans and executes the Decomp Orchestrator migration from a
single Bun/TypeScript package into a monorepo-style workspace with separate app
and package boundaries.

The work should be implemented as one coherent migration effort, but advanced
bit by bit through phase gates. Each phase must leave the repo in a working
state before the next larger move begins. Completion requires the CLI, agents,
knowledge graph, dashboard frontend, dashboard server, smoke tests, root
scripts, docs, and fixture workflows to function from the new layout.

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
- `examples/target_tree.md` - intended monorepo tree and package dependency
  direction.

Objective path: `objectives/monorepo-restructuring/`
