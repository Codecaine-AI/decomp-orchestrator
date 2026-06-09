<goal>
    - Restructure Decomp Orchestrator into a monorepo-style workspace with
      `apps/cli`, `apps/dashboard`, `apps/dashboard-server`,
      `packages/core`, `packages/agents`, `packages/knowledge`, and
      `packages/ui-contract`.
    - Keep root `knowledge/`, `docs/`, `tests`, `testdata`, `objectives`, and
      `ai_docs` as repo-level assets.
    - Treat the work as one coherent migration, but advance through small
      validated phases so each checkpoint stays runnable and recoverable.
</goal>

<context_refresh>
    <required_files>
        - objectives/monorepo-restructuring/goal.md
        - objectives/monorepo-restructuring/current_state.md
        - objectives/monorepo-restructuring/context/00_problem.md
        - objectives/monorepo-restructuring/context/01_constraints.md
        - objectives/monorepo-restructuring/context/02_implementation_scope.md
        - objectives/monorepo-restructuring/context/03_working_plan.md
        - objectives/monorepo-restructuring/context/04_validation_and_handoff.md
    </required_files>

    <instruction>
        - At objective start and after compaction/resume, reread the required
          files and treat this bundle as the authority for this objective.
    </instruction>
</context_refresh>

<working_strategy>
    - Reproduce the current baseline, then write a path/package migration map
      before moving files.
    - Move frontend/UI contract first, then `core`, then `knowledge` and
      `agents`, then CLI and dashboard server apps.
    - Enforce dependency direction: apps -> packages; `agents` ->
      `knowledge`/`core`; `knowledge` -> `core`; `core` -> no app deps.
    - Untangle the current `agents`/`knowledge` cycle before enforcing package
      boundaries.
    - Keep root compatibility scripts such as `bun run orch`, `bun run check`,
      `bun run smoke`, `bun run ui:*`, `kg:*`, and `pr:*` working throughout.
</working_strategy>

<success_metrics>
    - The final tree, manifests, TypeScript configs, exports, and imports match
      the documented app/package map.
    - CLI, dashboard frontend, dashboard server, core runtime, agents, and
      knowledge commands all run from the new layout through root scripts.
    - `packages/core` has no app/agent/knowledge deps, and `agents`/`knowledge`
      have no circular package dependency.
    - README, docs, Makefile, tests, scripts, and objective state describe the
      new layout accurately.
</success_metrics>

<non_goals>
    - Do not redesign orchestrator scheduling, worker behavior, knowledge
      graph semantics, PR handoff policy, or dashboard UX beyond the minimum
      required by the restructure.
    - Do not move root `knowledge/` corpora or generated graph data into
      package source folders unless a phase proves that is necessary.
    - Do not remove root compatibility commands merely because package-local
      commands exist.
    - Do not start the UI server or a UI dev server unless the user explicitly
      asks; use the existing background server when available or validate by
      build/import/API handler tests.
</non_goals>

<completion_criteria>
    - All planned files are moved or intentionally left in place with their
      final ownership documented.
    - `bun install`, `bun run check`, `bun run smoke`, `bun run ui:build`, root
      CLI help/status smoke, knowledge command smoke, and package/app type
      checks pass from the new layout.
    - Dashboard server validation proves built static serving and existing
      `/api/*` behavior for config, dashboard, process, run, PR handoff, and
      report routes.
    - No stale imports, scripts, docs, or hard-coded `src/ui`/`src/bin` paths
      remain except where documented as compatibility shims.
    - `objectives/monorepo-restructuring/current_state.md` is updated with
      final commands, artifact paths, package map, residual risks, and
      completion evidence.
</completion_criteria>
