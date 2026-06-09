<implementation_scope>
    <owned_surfaces>
        - `packages/core/src/projects/`: Add project descriptor types, schema or
          validation helpers, config discovery, local override loading, path
          resolution, default project selection, and override precedence.
        - `packages/core/src/index.ts`: Export project resolver APIs for apps and
          packages that need runtime path identity.
        - `apps/cli/src/cli/args.ts`: Add `--project`, resolved project metadata,
          and override precedence while preserving current raw path flags.
        - `apps/cli/src/cli/usage.ts`: Document project-aware global flags and
          examples.
        - `apps/cli/src/cli/commands/`: Thread resolved project/graph/state
          paths into status, init, trigger, babysit, checkpoint, report, PR, and
          knowledge commands as needed.
        - `apps/dashboard-server/src/server.ts`: Resolve project identity for
          config, dashboard data, process actions, init/run commands, PR handoff,
          QA, and report actions. Small extractions are allowed if they keep the
          project wiring understandable.
        - `apps/dashboard/src/`: Add project selection and project-aware API
          requests while keeping raw path fields available as advanced
          overrides.
        - `packages/ui-contract/src/dashboard.ts`: Extend shared browser/server
          types with project summaries, selected project id, graph path, and
          advanced override fields.
        - `packages/knowledge/src/paths.ts`: Separate orchestrator package
          knowledge roots from project checkout roots and project graph DB
          paths.
        - `packages/knowledge/src/resources.ts`: Render resource maps from a
          resolved project so workers see correct checkout, state, graph, and
          package roots.
        - `packages/knowledge/src/graph/` and knowledge CLI commands: Accept
          project-scoped graph paths and checkout-derived inputs.
        - `packages/agents/src/`: Include project identity in director/worker
          prompt context and runtime artifacts where useful.
        - `packages/core/src/state/`: Add or migrate run metadata fields for
          project id, repo root, graph DB, and/or project config version if the
          current schema cannot audit project identity.
        - `tests/` and `testdata/`: Add focused resolver, CLI, dashboard handler,
          and smoke coverage using fixture projects.
        - `projects/`: Add tracked examples/templates and ignored local runtime
          directories for project workspaces.
        - `.gitignore`: Ignore project checkouts, project state, graph outputs,
          `.pi-sessions`, and local env/override files.
        - `README.md` and `docs/`: Update operator-facing workspace, CLI, UI,
          state, knowledge, and current-mechanics documentation.
        - `objectives/project-workspace-layering/artifacts/`: Store baseline
          maps, validation summaries, and final reports produced by this
          objective.
    </owned_surfaces>

    <read_only_references>
        - `objectives/monorepo-restructuring/`: Read for prerequisite decisions
          and final layout evidence; do not rewrite the completed objective.
        - `objectives/monorepo-restructuring/artifacts/final_report.md`: Treat
          as the baseline report for the app/package split.
        - `objectives/monorepo-restructuring/examples/target_tree.md`: Treat as
          the baseline layout this follow-up builds on.
        - `docs/archive/`: Historical docs may mention old nested paths. Update
          only if active docs explicitly point users there for current behavior.
        - `knowledge/sources/past_prs/data/`: Corpus data can be read and
          refreshed only through existing PR/knowledge workflows; do not hand-edit
          large generated corpus files for this objective.
    </read_only_references>

    <generated_outputs>
        - `objectives/project-workspace-layering/artifacts/current_coupling_map.md`:
          Human-readable map of current path/default assumptions before edits.
        - `objectives/project-workspace-layering/artifacts/project_resolution_matrix.json`:
          Cases covering default project, explicit project, missing project,
          explicit repo/state overrides, and fixture projects.
        - `objectives/project-workspace-layering/artifacts/dashboard_route_validation.json`:
          Non-listening dashboard route/API validation results.
        - `objectives/project-workspace-layering/artifacts/validation_summary.json`:
          Commands run, pass/fail status, timestamps, and important output paths.
        - `objectives/project-workspace-layering/report.md`: Final report with
          implemented layout, decisions, validation, rejected shortcuts, and
          remaining work.
    </generated_outputs>

    <commands_and_entrypoints>
        - `bun run check`: TypeScript and dashboard type validation.
        - `bun run smoke`: Existing smoke flow; must keep passing.
        - `bun run ui:build`: Dashboard build validation.
        - `bun run orch -- --help`: Confirms global flag usage stays coherent.
        - `bun run orch -- --repo-root testdata/smoke_repo --state-dir <tmp> status`:
          Confirms explicit path compatibility.
        - `bun run orch -- --project melee status`: Confirms project resolution
          for the Melee project once configured.
        - `bun run orch -- --project melee --dry-run-agents init-run ...`:
          Confirms project-scoped dry-run orchestration once command arguments
          are selected during implementation.
        - `bun run kg:sources`: Confirms global source/tool registry listing.
        - `bun run kg:status -- --project melee`: Confirms project-aware graph
          path/status once supported.
        - `bun run kg:rebuild -- --project melee`: Confirms project-aware graph
          rebuild when safe for the selected checkout or fixture.
        - `dashboard handler validation script`: Import the exported server fetch
          handler and exercise config/dashboard/process/run/PR/report routes
          without starting `ui:server`.
    </commands_and_entrypoints>

    <adjacent_surfaces_requiring_caution>
        - `live Melee checkout`: Moving, replacing, or recloning it can disturb
          active user work. Only attach or migrate it after resolver gates pass,
          and prefer non-destructive worktree/clone instructions.
        - `.decomp-orchestrator-state/`: Existing runtime SQLite/artifacts may
          be dirty. Do not delete them; migrate or leave compatibility shims.
        - `knowledge/resource_graph/graph.sqlite`: Existing graph DB may be
          useful and large. Do not discard it without an explicit migration or
          rebuild plan.
        - `apps/dashboard-server/src/server.ts`: Large file with many path
          callsites. Project wiring may require extraction, but avoid broad
          cleanup unrelated to project identity.
        - `package scripts and Makefile`: Keep operator commands stable unless a
          compatibility alias is added.
        - `docs-framework audit issues`: Existing archive/frontmatter issues are
          outside this objective unless changed active docs create new drift.
    </adjacent_surfaces_requiring_caution>

    <out_of_scope>
        - `decomp scheduling heuristics`: Project layering should not change how
          candidates are selected except for path/graph scoping.
        - `PR review standards and split policy`: Keep existing behavior unless
          base ref or path defaults need project config.
        - `knowledge corpus redesign`: This objective clarifies global versus
          project-scoped paths; it does not redesign source descriptors.
        - `CI publishing or GitHub PR creation`: Not required unless the user
          separately asks to publish these changes.
        - `UI visual redesign`: Add project controls in the current dashboard
          style; do not turn this into a broad redesign.
        - `multi-project decomp behavior beyond Melee`: The resolver should be
          generic enough for future projects, but full support for another
          concrete project is not required.
    </out_of_scope>
</implementation_scope>
