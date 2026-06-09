<constraints>
    <hard_rules>
        - Preserve current behavior unless the objective explicitly identifies
          a path-layout-only change.
        - Keep root commands working throughout the migration:
          `bun run orch`, `bun run check`, `bun run smoke`, `bun run ui:*`,
          `kg:*`, `pr:*`, and the Makefile targets that delegate to them.
        - Keep root `knowledge/` as repo-level runtime data/tooling unless a
          phase produces a specific, tested reason to move part of it.
        - Preserve generated state defaults: normal commands from the
          orchestrator repo should still default state to
          `.decomp-orchestrator-state/` under the package/workspace root.
        - Preserve the nested checkout assumption: the default Melee checkout
          remains the parent directory unless the user supplies `--repo-root`.
        - Keep all moved imports package-based or workspace-relative. Do not
          leave package code reaching into sibling packages through fragile
          `../../..` imports.
        - Do not start `bun run ui:server`, `bun run ui`, `bun run ui:dev`, or
          another UI dev server unless the user specifically asks.
        - Before moving files in a dirty worktree, inspect relevant changed
          files and do not overwrite user changes.
    </hard_rules>

    <forbidden_shortcuts>
        - `directory_rename_only`: invalid because the goal is clear package
          and app boundaries, not just a different folder spelling.
        - `remove_root_scripts`: invalid because existing operator ergonomics
          are part of the product surface.
        - `skip_smoke_until_end`: invalid because the migration must advance
          bit by bit with a working repo at each checkpoint.
        - `bundle_everything_into_core`: invalid because it hides the frontend,
          dashboard server, agent, and knowledge boundaries that motivated the
          objective.
        - `move_knowledge_corpora_into_packages`: invalid unless explicitly
          justified; root `knowledge/` contains data, Python APIs, caches, and
          generated graph state.
        - `break_docs_then_fix_later`: invalid for final completion; docs must
          be updated before handoff.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - Deployable runtime source belongs under `apps/*/src` or
          `packages/*/src`.
        - Root `knowledge/` is deployable runtime data/tooling, not a
          TypeScript package source directory.
        - `docs/`, `objectives/`, `testdata/`, and `ai_docs/` remain
          repo-level assets.
        - Objective artifacts under
          `objectives/monorepo-restructuring/artifacts/` are diagnostic and
          handoff material, not runtime inputs.
        - Existing ignored runtime state, Pi sessions, local env files, and
          generated knowledge caches must not be committed as part of the move
          unless they were already tracked and deliberately updated.
    </data_and_feature_boundaries>

    <risk_budget>
        - `behavior_regression`: zero known regressions in CLI, smoke, UI
          build, dashboard server API behavior, or knowledge command surfaces.
        - `temporary_phase_breakage`: allowed only inside a working branch while
          actively implementing a phase; each phase gate must pass before
          moving on.
        - `import_cycle`: zero circular workspace package dependencies at
          completion.
        - `docs_drift`: zero known references to old paths except documented
          compatibility shims.
        - `server_start_validation`: do not violate repo instruction. If a
          live server check is necessary, ask the user or use an already
          running background server.
    </risk_budget>

    <promotion_or_completion_gates>
        - `baseline_gate`: existing checks pass or every pre-existing failure
          is recorded before migration begins.
        - `phase_gate`: after each file-move phase, typecheck and the narrow
          relevant smoke/build command pass.
        - `dependency_gate`: package dependency direction matches the contract
          in `examples/target_tree.md`.
        - `final_gate`: full validation ladder in
          `context/04_validation_and_handoff.md` passes and final state is
          updated.
    </promotion_or_completion_gates>
</constraints>
