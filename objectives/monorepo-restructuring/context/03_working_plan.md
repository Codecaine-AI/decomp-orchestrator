<working_plan>
    <overview>
        1. baseline_and_map - Reproduce the current baseline and write the
           migration map before moving files.
        2. workspace_foundation - Add workspace/package config and compatibility
           script scaffolding.
        3. dashboard_frontend - Move the React/Vite frontend to
           `apps/dashboard` with shared UI contract types.
        4. core_package - Extract reusable runtime core into `packages/core`.
        5. knowledge_and_agents - Extract TypeScript knowledge and agents into
           packages while eliminating package cycles.
        6. cli_and_dashboard_server - Move CLI and dashboard server apps onto
           package imports.
        7. docs_and_cleanup - Remove stale paths, update docs, and preserve
           root ergonomics.
        8. final_validation_and_handoff - Run the full validation ladder,
           record artifacts, and update objective state.
    </overview>

    <operating_principles>
        - Each phase should leave the repo runnable before proceeding.
        - Prefer mechanical moves plus import rewrites over behavior edits.
        - Package exports should be explicit enough that apps do not import
          package internals through moved filesystem paths.
        - Maintain root command compatibility as a first-class product
          requirement.
        - If a phase exposes unexpected behavior coupling, split the coupling
          deliberately and document the decision in the migration map.
    </operating_principles>

    <phase id="1" name="baseline_and_map">
        <objective>
            - Establish the current working baseline and an explicit path
              migration map.
        </objective>
        <inputs>
            - `package.json`
            - `tsconfig.json`
            - `Makefile`
            - `README.md`
            - `docs/20-implementation/**`
            - `src/**`
            - `tests/smoke.ts`
            - `AGENTS.md`
        </inputs>
        <process>
            - Inspect `git status --short` and protect unrelated user changes.
            - Run baseline validation commands or record any pre-existing
              failures exactly.
            - Inventory current source areas, package scripts, TypeScript
              configs, hard-coded paths, and docs references.
            - Write the initial old-path to new-path map, including package
              owner and phase.
            - Decide package names. Default to private workspace packages:
              `@decomp-orchestrator/core`,
              `@decomp-orchestrator/agents`,
              `@decomp-orchestrator/knowledge`, and
              `@decomp-orchestrator/ui-contract`.
        </process>
        <outputs>
            - `objectives/monorepo-restructuring/artifacts/baseline_summary.json`
            - `objectives/monorepo-restructuring/artifacts/migration_map.json`
        </outputs>
        <gate>
            - Baseline command status is known and the migration map covers
              every source area that will move.
        </gate>
        <failure_handling>
            - If baseline checks fail before edits, record the exact failure and
              continue only if the failure is unrelated or explicitly accepted.
        </failure_handling>
    </phase>

    <phase id="2" name="workspace_foundation">
        <objective>
            - Introduce workspace structure and package manifests without
              moving major code yet.
        </objective>
        <inputs>
            - Output from phase 1.
            - Root `package.json`, `tsconfig.json`, and `bun.lock`.
        </inputs>
        <process>
            - Add `workspaces` for `apps/*` and `packages/*`.
            - Add `tsconfig.base.json` if useful, and keep root `tsconfig.json`
              as a compatibility/check aggregator.
            - Create package/app manifests and minimal configs needed for
              workspace resolution.
            - Keep root scripts delegating to the current source paths until
              the corresponding phase moves them.
        </process>
        <outputs>
            - Workspace package/app directories and manifests.
            - Updated root package and TypeScript config.
        </outputs>
        <gate>
            - `bun install`, `bun run check`, and `bun run smoke` pass or match
              documented baseline failures.
        </gate>
        <failure_handling>
            - If Bun workspace resolution conflicts with existing source
              imports, keep package manifests private/minimal and defer exports
              until a package's code actually moves.
        </failure_handling>
    </phase>

    <phase id="3" name="dashboard_frontend">
        <objective>
            - Move browser UI code from `src/ui/app` to `apps/dashboard` and
              extract shared UI/API payload types.
        </objective>
        <inputs>
            - `src/ui/app/**`
            - `src/ui/app/tsconfig.json`
            - `src/ui/app/vite.config.ts`
            - `src/ui/server.ts` static-root assumptions.
        </inputs>
        <process>
            - Create `packages/ui-contract` for dashboard payload and form
              types shared by server and frontend.
            - Move React/Vite app files to `apps/dashboard`.
            - Update Vite root, build output, imports, and root `ui:*` scripts.
            - Update dashboard server static-root assumptions only as needed to
              find the new build output.
        </process>
        <outputs>
            - `apps/dashboard/**`
            - `packages/ui-contract/**`
            - Updated root UI build/check scripts.
        </outputs>
        <gate>
            - `bun run ui:check`, `bun run ui:build`, and `bun run check` pass.
        </gate>
        <failure_handling>
            - If the dashboard server cannot serve the moved build without
              broader server edits, document the path conflict and resolve it
              before moving runtime core.
        </failure_handling>
    </phase>

    <phase id="4" name="core_package">
        <objective>
            - Move reusable runtime state/core modules into `packages/core`.
        </objective>
        <inputs>
            - `src/state/**`
            - `src/board/**`
            - `src/shell/**`
            - `src/report/**`
            - `src/objdiff/**`
            - `src/handoff/**`
            - `src/env/**`
            - `src/types/**`
        </inputs>
        <process>
            - Move files into `packages/core/src`.
            - Add package exports for public modules used by apps and other
              packages.
            - Update imports in remaining old locations to package imports.
            - Ensure state defaults and path helpers still resolve the
              orchestrator workspace root correctly.
        </process>
        <outputs>
            - `packages/core/src/**`
            - Updated imports in CLI, agents, knowledge, dashboard server, and
              tests.
        </outputs>
        <gate>
            - `bun run check`, `bun run smoke`, root CLI help/status smoke, and
              any package-local core typecheck pass.
        </gate>
        <failure_handling>
            - If a moved module depends on app behavior, split the app-specific
              behavior out instead of importing an app from `core`.
        </failure_handling>
    </phase>

    <phase id="5" name="knowledge_and_agents">
        <objective>
            - Extract TypeScript knowledge and agent runtime code into separate
              packages with no circular package dependency.
        </objective>
        <inputs>
            - `src/knowledge/**`
            - `src/agents/**`
            - Root `knowledge/**` as read/write data target, not package
              source.
        </inputs>
        <process>
            - Move TypeScript knowledge code into `packages/knowledge/src`.
            - Move agent code, templates, schemas, and context manifest into
              `packages/agents/src`.
            - Break the current agent/knowledge cycle by passing selected
              agent context data into knowledge resource rendering or moving
              neutral contract types into `core`/`ui-contract` as appropriate.
            - Update CLI, tests, and package imports to use package exports.
            - Preserve path helpers for root `knowledge/`, parent checkout, and
              graph database locations.
        </process>
        <outputs>
            - `packages/knowledge/src/**`
            - `packages/agents/src/**`
            - Updated package exports and dependency declarations.
            - `objectives/monorepo-restructuring/artifacts/dependency_graph.json`
        </outputs>
        <gate>
            - `bun run check`, `bun run smoke`, `bun run kg:sources`, and
              dependency graph check pass with no agents/knowledge cycle.
        </gate>
        <failure_handling>
            - If the dependency cycle is deeper than expected, stop and
              document the smallest neutral interface needed before moving more
              code.
        </failure_handling>
    </phase>

    <phase id="6" name="cli_and_dashboard_server">
        <objective>
            - Move app entrypoints onto the package graph.
        </objective>
        <inputs>
            - `src/bin/decomp-orchestrator.ts`
            - `src/cli/**`
            - `src/ui/server.ts`
            - `src/ui/trusted-report.ts`
            - Dashboard build output from phase 3.
        </inputs>
        <process>
            - Move CLI binary and command modules to `apps/cli/src`.
            - Move dashboard server and trusted-report code to
              `apps/dashboard-server/src`.
            - Consider splitting server internals into dashboard data,
              process-control, handoff actions, and static serving only when it
              reduces move risk.
            - Update root scripts and Makefile to delegate to app entrypoints.
            - Preserve endpoint paths, default env vars, process file behavior,
              and root command ergonomics.
        </process>
        <outputs>
            - `apps/cli/src/**`
            - `apps/dashboard-server/src/**`
            - Updated root scripts and Makefile.
        </outputs>
        <gate>
            - `bun run orch -- --help`, fixture status smoke, `bun run check`,
              `bun run smoke`, `bun run ui:build`, and dashboard server import
              smoke pass. Live server validation uses an existing server or
              explicit user approval.
        </gate>
        <failure_handling>
            - If server behavior is hard to validate without starting a server,
              extract a request handler that can be exercised without binding a
              port.
        </failure_handling>
    </phase>

    <phase id="7" name="docs_and_cleanup">
        <objective>
            - Remove stale layout assumptions and update user-facing docs.
        </objective>
        <inputs>
            - `README.md`
            - `docs/20-implementation/**`
            - `docs/README.md`
            - `package.json`
            - `Makefile`
            - `tests/smoke.ts`
            - `rg` results for old paths.
        </inputs>
        <process>
            - Search for stale `src/ui`, `src/bin`, `src/cli`, `src/agents`,
              `src/state`, and `src/knowledge` references.
            - Update implementation docs to describe the new app/package tree.
            - Keep system-design docs implementation-agnostic unless path
              examples have become wrong.
            - Remove empty old directories when safe.
            - Update objective artifacts with final path decisions.
        </process>
        <outputs>
            - Updated README/docs.
            - Cleaned old source tree or documented compatibility shims.
        </outputs>
        <gate>
            - No stale path references remain except intentional compatibility
              notes, and root docs accurately describe how to run the repo.
        </gate>
        <failure_handling>
            - If an old path is intentionally retained as a shim, document the
              shim and removal criteria.
        </failure_handling>
    </phase>

    <phase id="8" name="final_validation_and_handoff">
        <objective>
            - Prove the migrated repo is fully functional and leave durable
              handoff evidence.
        </objective>
        <inputs>
            - Outputs from phases 1-7.
            - Validation ladder in `context/04_validation_and_handoff.md`.
        </inputs>
        <process>
            - Run the full validation ladder.
            - Write `validation_summary.json` with commands, status, and
              notable stdout/stderr summaries.
            - Update `current_state.md` with final package map, commands,
              artifacts, risks, and completion evidence.
            - Prepare a concise final report for the user.
        </process>
        <outputs>
            - `objectives/monorepo-restructuring/artifacts/validation_summary.json`
            - Updated `objectives/monorepo-restructuring/current_state.md`
            - Optional `objectives/monorepo-restructuring/artifacts/final_report.md`
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and acceptance gates in
              `context/04_validation_and_handoff.md` are satisfied.
        </gate>
        <failure_handling>
            - If validation fails, preserve artifacts, name the failing phase,
              and define the smallest next fix. Do not mark complete.
        </failure_handling>
    </phase>
</working_plan>
