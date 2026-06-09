<working_plan>
    <overview>
        1. baseline_and_coupling_map - Confirm the post-restructure repo shape
           and record every path/default assumption that must move behind a
           project resolver.
        2. project_model_and_resolver - Add the project descriptor, local
           override, path resolution, and override-precedence layer.
        3. cli_integration - Add `--project` to the CLI and thread resolved
           project paths through commands.
        4. state_graph_and_knowledge_scoping - Scope runtime state, graph paths,
           resource maps, and agent context by resolved project.
        5. dashboard_api_and_ui_integration - Add project-aware config/API/UI and
           project-safe process actions.
        6. melee_workspace_wiring - Configure or attach the Melee project
           checkout after resolver validation.
        7. docs_tests_validation_and_handoff - Update docs, run validation,
           preserve artifacts, and write the final handoff.
    </overview>

    <operating_principles>
        - Make the project resolver the narrow waist. Apps and packages should
          consume resolved project paths instead of independently guessing
          checkout/state/graph defaults.
        - Migration should be additive first: support `--project` while existing
          raw path commands continue to pass.
        - Physical checkout movement is a late phase, not a prerequisite.
        - Every phase should leave an artifact or test that prevents future path
          drift.
        - When a choice is ambiguous, prefer a portable tracked default plus an
          ignored local override.
    </operating_principles>

    <phase id="1" name="baseline_and_coupling_map">
        <objective>
            - Confirm the current monorepo restructuring baseline and produce a
              complete map of path/project assumptions to change.
        </objective>
        <inputs>
            - `objectives/monorepo-restructuring/current_state.md`
            - `objectives/monorepo-restructuring/artifacts/final_report.md`
            - `objectives/monorepo-restructuring/examples/target_tree.md`
            - `apps/cli/src/cli/args.ts`
            - `apps/dashboard-server/src/server.ts`
            - `packages/knowledge/src/paths.ts`
            - `packages/knowledge/src/resources.ts`
            - `packages/ui-contract/src/dashboard.ts`
            - `README.md`, active `docs/`, `tests/smoke.ts`, `package.json`
        </inputs>
        <process>
            - Run targeted searches for `repoRoot`, `stateDir`, `graphDb`,
              `checkoutRoot`, `process.cwd()`, `defaultRepoRoot`,
              `defaultStateDir`, `Melee`, and old nested path examples.
            - Record each callsite as one of: resolver-owned, command-specific
              explicit path, knowledge-global path, project-derived path,
              doc-only, or archive-only.
            - Confirm root scripts and workspace packages still match the
              monorepo final report.
            - Run a small baseline command set if the working tree and local
              environment allow it: `bun run check`, `bun run smoke`,
              `bun run orch -- --help`, and the smoke repo status command.
        </process>
        <outputs>
            - `objectives/project-workspace-layering/artifacts/current_coupling_map.md`:
              callsite table, ownership class, intended change, and risk.
            - `objectives/project-workspace-layering/artifacts/baseline_validation.json`:
              commands run, status, timestamps, and skipped-command reasons.
        </outputs>
        <gate>
            - The app/package split is confirmed and every active path/default
              assumption has an intended owner before code changes begin.
        </gate>
        <failure_handling>
            - If the monorepo restructure is incomplete or tests fail for
              unrelated reasons, document the failure and narrow the first code
              phase to resolver work that can be validated independently.
        </failure_handling>
    </phase>

    <phase id="2" name="project_model_and_resolver">
        <objective>
            - Define and implement a reusable project config/resolution layer.
        </objective>
        <inputs>
            - Output from phase 1.
            - `objectives/project-workspace-layering/examples/melee.project.example.json`
            - `objectives/project-workspace-layering/examples/target_workspace_tree.md`
            - Existing core env/path helpers.
        </inputs>
        <process>
            - Choose the tracked config shape. Preferred starting point:
              `projects/<project-id>/project.json`, optional
              `projects/<project-id>/local.project.json` ignored, and paths
              resolved relative to the descriptor directory unless absolute.
            - Add `ResolvedProject` fields for `projectId`, `displayName`,
              `kind`, `repoRoot`, `stateDir`, `graphDbPath`, `processName`,
              `baseRef`, validation defaults, PR defaults, and source config
              path.
            - Add config discovery from the orchestrator root and explicit
              project id selection. If multiple projects exist and no default is
              configured, fail clearly.
            - Implement override precedence:
              explicit CLI/body override > local project override > tracked
              project descriptor > resolver defaults.
            - Add tests or fixture assertions for relative paths, absolute
              overrides, missing checkout warnings, invalid ids, and default
              project selection.
        </process>
        <outputs>
            - `packages/core/src/projects/` resolver implementation and tests.
            - `projects/` tracked template/docs as needed.
            - `.gitignore` project-local runtime ignores.
            - `objectives/project-workspace-layering/artifacts/project_resolution_matrix.json`.
        </outputs>
        <gate>
            - Resolver tests pass and a fixture `melee` project resolves to the
              expected repo/state/graph paths without requiring the real Melee
              checkout to be moved.
        </gate>
        <failure_handling>
            - If tracked config cannot safely represent a machine-independent
              Melee checkout, use an external-checkout local override as the
              first supported path and document the future in-repo checkout
              migration.
        </failure_handling>
    </phase>

    <phase id="3" name="cli_integration">
        <objective>
            - Make the CLI project-aware without breaking raw path commands.
        </objective>
        <inputs>
            - Outputs from phases 1 and 2.
            - `apps/cli/src/cli/args.ts`
            - `apps/cli/src/cli/usage.ts`
            - `apps/cli/src/cli/commands/`
        </inputs>
        <process>
            - Add `--project <id>` as a global flag.
            - Extend `GlobalArgs` or introduce a resolved runtime context that
              carries both raw resolved paths and project metadata.
            - Thread graph DB defaults through commands that currently parse
              `--graph-db` locally.
            - Update help text and examples.
            - Validate these cases: no project plus explicit paths, explicit
              project, explicit project plus path override, invalid project, and
              fixture smoke repo.
        </process>
        <outputs>
            - Updated CLI parser/types/usage and command wiring.
            - CLI resolver tests or smoke assertions recorded in validation
              artifacts.
        </outputs>
        <gate>
            - `bun run orch -- --help`, explicit path status, and project status
              all behave as documented.
        </gate>
        <failure_handling>
            - If all commands cannot be migrated in one pass, add a central
              compatibility adapter and list any command still using legacy raw
              path parsing in `current_state.md`.
        </failure_handling>
    </phase>

    <phase id="4" name="state_graph_and_knowledge_scoping">
        <objective>
            - Ensure runtime state, graph data, resources, and agent context use
              the resolved project boundary.
        </objective>
        <inputs>
            - Outputs from phases 2 and 3.
            - `packages/core/src/state/`
            - `packages/knowledge/src/paths.ts`
            - `packages/knowledge/src/resources.ts`
            - `packages/knowledge/src/graph/`
            - `packages/agents/src/director/`
            - `packages/agents/src/worker/`
        </inputs>
        <process>
            - Add run metadata for project identity when needed: project id,
              repo root, state dir, graph DB, and config path/version.
            - Replace `checkoutRoot()`-style parent assumptions with explicit
              resolved project roots.
            - Decide which knowledge paths remain orchestrator-global and which
              graph/code paths become project-scoped.
            - Make graph command defaults use the selected project's graph DB,
              while preserving explicit `--graph-db`.
            - Update resource maps and prompt context to include:
              `project_id`, `project_kind`, `board_repo_root`,
              `orchestrator_package`, `state_dir`, and `graph_db`.
            - Add migration or compatibility behavior for existing state/graph
              files when the old default path is detected.
        </process>
        <outputs>
            - Project-aware state/run metadata and/or migration.
            - Project-aware knowledge path/resource APIs.
            - Updated agent prompt context generation.
            - Tests or smoke artifacts for `kg:*` and resource map output.
        </outputs>
        <gate>
            - Knowledge commands and worker/director prompt construction use the
              selected project paths and cannot silently fall back to a parent
              checkout.
        </gate>
        <failure_handling>
            - If graph DB migration is risky, leave old graph data in place,
              create a new project-scoped graph path, and document rebuild steps.
        </failure_handling>
    </phase>

    <phase id="5" name="dashboard_api_and_ui_integration">
        <objective>
            - Make dashboard config, data fetches, forms, and process actions
              project-aware.
        </objective>
        <inputs>
            - Outputs from phases 2 through 4.
            - `apps/dashboard-server/src/server.ts`
            - `apps/dashboard/src/`
            - `packages/ui-contract/src/dashboard.ts`
        </inputs>
        <process>
            - Extend `/api/config` to return available projects, default project
              id, selected project defaults, and advanced override defaults.
            - Add request/body project resolution for dashboard data, run
              details, process status, start/stop/drain, init, QA, PR handoff,
              and report actions.
            - Persist project id and resolved state path in saved process records.
            - Update UI form state to include `projectId` and display project
              choices. Keep raw `repoRoot`/`stateDir` fields as advanced
              overrides.
            - Ensure API requests include project identity and only include raw
              overrides when the user has chosen them.
            - Validate through exported fetch handlers, not by starting the UI
              server.
        </process>
        <outputs>
            - Updated dashboard shared contract, server handling, and UI.
            - `objectives/project-workspace-layering/artifacts/dashboard_route_validation.json`.
        </outputs>
        <gate>
            - Dashboard handler validation proves project-aware config, dashboard
              data, run details, process status, and command construction work
              for fixture/project cases.
        </gate>
        <failure_handling>
            - If UI changes become too large, land server/contract project
              support first and leave a documented UI follow-up only if CLI and
              API are already safe.
        </failure_handling>
    </phase>

    <phase id="6" name="melee_workspace_wiring">
        <objective>
            - Attach the real Melee project to the new workspace model.
        </objective>
        <inputs>
            - Outputs from phases 2 through 5.
            - Current local Melee checkout path, if available.
            - `examples/target_workspace_tree.md`.
        </inputs>
        <process>
            - Choose one of two supported routes:
              tracked `projects/melee/project.json` points to ignored
              `projects/melee/checkout`, or tracked descriptor plus ignored
              local override points to an external checkout.
            - Add or update `.gitignore` so checkout/state/graph/session/env
              files remain untracked.
            - If using an in-workspace checkout, create it as a clone or
              worktree only after confirming no destructive move is required.
            - Validate `--project melee status`, project-scoped graph status,
              and dry-run init behavior against the configured checkout or a
              documented fixture fallback.
        </process>
        <outputs>
            - Configured `melee` project descriptor and any ignored local
              override instructions.
            - Updated workspace docs/examples.
            - Validation artifacts for Melee project commands.
        </outputs>
        <gate>
            - A future operator can run Melee through the project identity
              without relying on the orchestrator's parent directory.
        </gate>
        <failure_handling>
            - If the live checkout cannot be attached in this environment, keep
              the resolver and fixture validation complete, document exact local
              override fields, and mark only the physical checkout step blocked.
        </failure_handling>
    </phase>

    <phase id="7" name="docs_tests_validation_and_handoff">
        <objective>
            - Finish operator documentation, automated checks, and durable
              handoff.
        </objective>
        <inputs>
            - Outputs from phases 1 through 6.
            - `context/04_validation_and_handoff.md`.
        </inputs>
        <process>
            - Run the validation ladder from `context/04_validation_and_handoff.md`.
            - Update README and active docs for project workspace layout,
              commands, dashboard behavior, state/graph locations, and migration
              notes.
            - Search for active stale "parent Melee checkout" instructions and
              either update or explicitly mark them historical.
            - Write final report sections covering final layout, resolver
              contract, compatibility behavior, dashboard behavior, validation,
              rejected options, and remaining risks.
            - Update `current_state.md`.
        </process>
        <outputs>
            - `objectives/project-workspace-layering/report.md`
            - `objectives/project-workspace-layering/artifacts/validation_summary.json`
            - `objectives/project-workspace-layering/current_state.md`
            - Updated README/docs/tests.
        </outputs>
        <gate>
            - Completion criteria in `goal.md` and validation gates in
              `context/04_validation_and_handoff.md` are satisfied, or the
              report clearly marks a narrowly scoped blocker with the smallest
              next step.
        </gate>
        <failure_handling>
            - If validation fails, keep artifacts, explain the failure, and
              route a rollback, compatibility shim, or follow-up objective.
        </failure_handling>
    </phase>
</working_plan>
