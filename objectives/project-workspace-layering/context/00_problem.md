<problem>
    <objective_question>
        - How should the orchestrator repository be layered so it owns the
          orchestration platform and runs Melee as a configured project, instead
          of depending on being located inside or next to one implicit Melee
          checkout?
        - What code, state, graph, UI, and documentation changes are required so
          the full Melee workflow can run from this monorepo through a project
          identity such as `--project melee`?
    </objective_question>

    <current_baseline>
        - The monorepo restructuring is complete: apps live in `apps/` and
          reusable TypeScript packages live in `packages/`.
        - Root scripts still expose the operator surface, including
          `bun run orch`, `bun run check`, `bun run smoke`, `bun run ui:*`, and
          `bun run kg:*`.
        - The orchestrator can already point at a Melee checkout through raw
          `--repo-root` and `--state-dir` paths.
        - Several defaults still encode a one-project checkout assumption:
          `apps/cli/src/cli/args.ts` defaults `repoRoot` and `stateDir` from the
          current working directory, `apps/dashboard-server/src/server.ts`
          derives default repo/state paths from package adjacency, and
          `packages/knowledge/src/paths.ts` exposes `checkoutRoot()` as a parent
          of the package root.
        - The dashboard contract in `packages/ui-contract/src/dashboard.ts`
          exposes raw paths but not project ids, project labels, graph paths, or
          per-project defaults.
    </current_baseline>

    <why_current_state_is_insufficient>
        - The current layout is still mentally and operationally "the
          orchestrator runs in Melee." The desired future is "the orchestrator
          runs on Melee, and later on other projects."
        - Raw path flags are useful for compatibility but too weak as the primary
          model for a multi-project runner. They do not name project identity,
          default process names, graph databases, validation rules, PR defaults,
          target kinds, or local checkout policy.
        - State and graph outputs can be confused when two checkouts or future
          projects share an orchestrator installation.
        - UI workflows need a human-friendly project selector instead of making
          operators type or trust raw filesystem paths for every action.
        - Knowledge/resource context currently mixes orchestrator package roots,
          knowledge roots, graph roots, and checkout roots without a project
          descriptor that explains which pieces are global and which are
          project-scoped.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `implicit_checkout_drift`: Commands accidentally operate on the
          orchestrator repository, the old parent Melee checkout, or a stale
          external path because no project id is resolved first.
        - `state_cross_contamination`: A dashboard/process/run reads state from
          one checkout while commands write to another, causing misleading
          status, leases, PR handoff artifacts, or worker reports.
        - `graph_cross_contamination`: Resource graph or code-graph outputs built
          for one checkout influence board ranking or file cards for another
          checkout.
        - `ui_path_footgun`: The dashboard launches workers, QA, or PR handoff
          against a path different from what the operator thinks is selected.
        - `git_boundary_confusion`: Putting Melee directly under the
          orchestrator without ignore/config rules makes git status noisy or
          risks committing checkout/state artifacts to the orchestrator repo.
        - `transition_regression`: Removing raw path behavior too early breaks
          current smoke tests, fixture runs, or local workflows before project
          config is fully wired.
    </failure_modes>

    <prior_evidence>
        - `objectives/monorepo-restructuring/current_state.md`: Confirms the
          app/package split and validation are complete.
        - `objectives/monorepo-restructuring/artifacts/final_report.md`:
          Records the final app/package layout, dependency direction, root
          compatibility scripts, and validation commands.
        - `objectives/monorepo-restructuring/examples/target_tree.md`: Shows the
          post-restructure tree that this objective should build on.
        - `apps/cli/src/cli/args.ts`: Shows CLI globals currently know
          `repoRoot` and `stateDir`, but not `project`.
        - `apps/dashboard-server/src/server.ts`: Shows the server API and process
          actions thread raw repo/state paths through many handlers.
        - `packages/knowledge/src/paths.ts`: Shows graph and knowledge paths are
          currently package-root based, with a `checkoutRoot()` helper that is
          incompatible with a project workspace model.
        - `packages/knowledge/src/resources.ts`: Shows worker resource maps
          include both checkout/package roots and knowledge graph commands that
          must be project-aware.
        - `packages/ui-contract/src/dashboard.ts`: Shows the browser/server
          contract lacks a project model.
    </prior_evidence>

    <expected_value>
        - The orchestrator becomes a stable platform repository that can manage
          Melee and future decomp projects through explicit project descriptors.
        - Melee can live under an ignored `projects/melee/checkout` directory or
          in an external checkout selected by local project override without the
          orchestrator tracking Melee git state.
        - CLI, UI, state, graph, and prompt context all agree on one resolved
          project at runtime.
        - The resulting workspace model is easier to document, validate, and
          extend than the current "run from the right directory" convention.
    </expected_value>
</problem>
