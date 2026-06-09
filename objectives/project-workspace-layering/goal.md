<goal>
    - Implement project workspace layering: the orchestrator is the platform
      repo, and Melee is a configured project it runs on.
    - Add a project descriptor/resolver for project id, checkout root, state dir,
      graph DB, process name, validation/PR/dashboard defaults, and local
      override precedence.
    - Wire CLI, dashboard, knowledge graph/resources, state metadata, agent
      context, docs, and tests so `--project melee` runs the Melee flow while
      raw path flags remain compatible.
</goal>

<context_refresh>
    <required_files>
        - objectives/project-workspace-layering/goal.md
        - objectives/project-workspace-layering/current_state.md
        - objectives/project-workspace-layering/context/*.md
        - objectives/monorepo-restructuring/current_state.md
        - objectives/monorepo-restructuring/artifacts/final_report.md
        - objectives/project-workspace-layering/examples/
    </required_files>
    <instruction>
        - Reread the required files at start/resume.
        - Confirm the `apps/` and `packages/` split before editing.
    </instruction>
</context_refresh>

<working_strategy>
    - Start with a coupling map of current repo/state/graph/checkout-root
      assumptions.
    - Build the resolver first. Tracked project config owns portable defaults;
      ignored local overrides own machine paths; explicit path overrides win.
    - Scope state, graph, process records, and Pi sessions per project.
    - Wire CLI/server before UI polish; move or attach live Melee only after
      fixture project resolution works.
    - Validate dashboard changes through non-listening handlers unless asked to
      start the UI server.
</working_strategy>

<success_metrics>
    - `bun run orch -- --project melee status` resolves without nested-checkout
      assumptions.
    - Explicit path flow still works with `testdata/smoke_repo`.
    - Dashboard config/API/UI expose project identity and advanced path
      overrides.
    - Knowledge commands use project repo/graph paths without losing global
      corpora.
    - Worker/director context uses resolved project, state, graph, and package
      roots.
    - README/docs present "orchestrator runs projects" as current architecture.
</success_metrics>

<non_goals>
    - Do not redo the app/package monorepo restructuring.
    - Do not make Melee a git submodule by default.
    - Do not destructively move/reset/reclone live Melee before resolver
      validation.
    - Do not redesign scheduling, workers, PR splitting, or knowledge semantics
      beyond project path identity.
    - Do not start the UI server unless explicitly requested.
</non_goals>

<completion_criteria>
    - Project resolver is used by CLI, dashboard, knowledge/resources, state
      metadata, and agent context.
    - `melee` can be configured as a project with either an ignored
      `projects/melee/checkout` or a local external-checkout override.
    - State, graph, process, and Pi-session outputs are project-scoped and
      ignored correctly.
    - Root scripts and direct path flags remain compatible.
    - Validation in `context/04_validation_and_handoff.md` passes or any
      blocker is documented with exact commands/artifacts.
    - `current_state.md` and a final report record decisions, validation, risks,
      and follow-up work.
</completion_criteria>
