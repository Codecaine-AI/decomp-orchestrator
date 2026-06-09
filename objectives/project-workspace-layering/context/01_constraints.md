<constraints>
    <hard_rules>
        - Preserve current raw path compatibility while project support is
          introduced. Explicit `--repo-root`, `--state-dir`, and `--graph-db`
          values must override project defaults.
        - Do not physically move, delete, reset, or reclone the live Melee
          checkout until the project resolver works against a fixture and the
          required migration path is documented.
        - Do not use a git submodule as the default Melee relationship. Prefer an
          ignored checkout/worktree path or an ignored local override pointing at
          an external checkout.
        - Project descriptors must be the source of truth for default project
          identity, checkout path, state path, graph path, process name, and
          validation/PR defaults.
        - Resolve and normalize paths before use. Store enough resolved metadata
          in runtime objects to make logs and UI responses auditable.
        - State, graph, process records, and Pi-session artifacts must be
          project-scoped by default.
        - Do not start `bun run ui:server`, `bun run ui`, or a UI dev server
          unless the user explicitly asks. Use non-listening dashboard handler
          validation.
        - Preserve unrelated dirty working tree changes. Do not run destructive
          git commands.
    </hard_rules>

    <forbidden_shortcuts>
        - `hard_code_projects_melee_checkout`: A personal absolute path makes
          the workspace non-portable and defeats project descriptors.
        - `replace_paths_with_project_id_only`: The system still needs explicit
          resolved paths for subprocesses, validation tools, report parsing, and
          compatibility.
        - `move_melee_first`: Moving the checkout before CLI/server/knowledge
          resolution exists creates a fragile half-migration.
        - `share_one_graph_for_every_project`: Board ranking and file cards can
          become incorrect when code graph inputs differ by checkout/project.
        - `ui_only_project_picker`: A visual selector without CLI/server/runtime
          project identity leaves workers and background processes ambiguous.
        - `delete_compatibility_flags`: Existing scripts, smoke tests, and
          operator habits need a transition path.
    </forbidden_shortcuts>

    <data_and_feature_boundaries>
        - `tracked_project_descriptor`: May contain portable defaults such as
          project id, display name, relative checkout path, relative state path,
          graph path, target kind, base ref, and validation defaults.
        - `ignored_local_project_override`: May contain machine-specific
          absolute paths, local environment file references, or temporary
          checkout aliases.
        - `ignored_checkout`: Melee source checkout or worktree must not be
          tracked by the orchestrator repo.
        - `ignored_state`: SQLite state, run artifacts, process pid files,
          Pi-session transcripts, graph DBs, and temporary logs must stay
          ignored unless a specific small artifact is intentionally added to an
          objective.
        - `global_knowledge_corpora`: Past PR data, decomp standards, external
          mirrors, and reference docs can remain orchestrator-owned global
          sources when appropriate.
        - `project_derived_knowledge`: Code graph indexes, graph DB outputs, file
          editability, board ranking, and any checkout-derived records must be
          tied to the resolved project.
        - `secrets`: API keys, local env values, and private checkout paths
          should not be committed in tracked project descriptors or docs.
    </data_and_feature_boundaries>

    <risk_budget>
        - `current_cli_compatibility`: Zero known regressions in existing smoke
          and explicit path commands.
        - `project_resolution_ambiguity`: A command may not silently choose
          between multiple configured projects. Use a default project only when
          the config says so; otherwise fail with a clear message.
        - `state_or_graph_mixup`: Zero accepted cases where a selected project
          reads another project's state or graph path without an explicit
          override.
        - `ui_process_safety`: Process start/stop/drain actions must include the
          selected project identity and resolved state path in the saved process
          record or equivalent response.
        - `docs_drift`: Any changed operator-facing command behavior must be
          reflected in README/docs before completion.
    </risk_budget>

    <promotion_or_completion_gates>
        - `resolver_gate`: A fixture project resolves to expected repo/state/graph
          paths, and invalid/missing projects fail with actionable errors.
        - `cli_gate`: `--project` and raw override precedence are covered by
          tests or smoke commands.
        - `dashboard_gate`: `/api/config`, dashboard data fetch, and process
          command construction work through project-aware contracts without
          starting a listening server.
        - `knowledge_gate`: `kg:*` commands can use the project graph path and
          continue to support explicit `--repo-root` and `--graph-db`.
        - `melee_gate`: A configured `melee` project can run at least `status`
          and a dry-run init flow against the intended checkout or a documented
          fixture fallback.
        - `handoff_gate`: Objective artifacts and `current_state.md` capture
          implemented behavior, commands run, rejected options, and residual
          risks.
    </promotion_or_completion_gates>
</constraints>
