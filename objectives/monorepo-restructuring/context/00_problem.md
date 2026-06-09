<problem>
    <objective_question>
        - How should Decomp Orchestrator be restructured into a monorepo-style
          workspace so the dashboard frontend, dashboard server, CLI runtime,
          agents, state/core logic, and knowledge code have clear homes without
          breaking the current operator workflow?
    </objective_question>

    <current_baseline>
        - The repo is currently one private Bun package with one root
          `package.json`, one root `tsconfig.json`, and a Vite React app nested
          at `src/ui/app`.
        - Root scripts build and check the UI with paths such as
          `src/ui/app/vite.config.ts`, run the CLI through
          `src/bin/decomp-orchestrator.ts`, and keep knowledge/PR commands at
          the root.
        - Runtime TypeScript code lives under `src/`: `cli`, `agents`,
          `state`, `board`, `knowledge`, `shell`, `report`, `objdiff`,
          `handoff`, `env`, `types`, and `ui`.
        - `src/ui/app` is a self-contained React frontend that talks to
          `/api/*` and imports only local UI types/helpers.
        - `src/ui/server.ts` is the dashboard API/process-control server. It
          imports core runtime modules directly, serves built static files, and
          shells back into the CLI for long-running operations.
        - Root `knowledge/` is repo-owned runtime evidence: source corpora,
          Python APIs, tool runners, generated indexes, and graph state.
        - Current docs describe a package-local layout, especially
          `docs/20-implementation/00-overview.md`,
          `docs/20-implementation/ui/00-overview.md`, and
          `docs/20-implementation/cli/00-overview.md`.
    </current_baseline>

    <why_current_state_is_insufficient>
        - The UI is conceptually a frontend app, but it is nested inside the
          runtime source tree.
        - The dashboard server is not the frontend; it is an operator API and
          process-control app that deserves an explicit app boundary.
        - Root package scripts blur app concerns, reusable runtime code,
          generated knowledge data, and operator command surfaces.
        - Future growth will make the single `src/` tree harder to reason
          about, especially when changing shared state/core behavior while also
          evolving the UI.
        - Without explicit package boundaries, dependency cycles such as
          `agents` <-> `knowledge` can remain hidden until they block future
          extraction.
    </why_current_state_is_insufficient>

    <failure_modes>
        - `big_bang_path_breakage`: moving many files at once leaves stale
          relative imports, scripts, docs, and hard-coded runtime paths.
        - `fake_monorepo`: directories are renamed to `apps/` and `packages/`
          but still depend on each other through brittle relative paths.
        - `ui_server_confusion`: dashboard frontend and dashboard server are
          treated as one app even though one is browser code and the other
          controls processes, state, artifacts, and CLI commands.
        - `lost_operator_ergonomics`: package-local scripts work but root
          commands such as `bun run orch`, `bun run check`, `bun run smoke`,
          `make status`, and `make ui` regress.
        - `knowledge_data_misplacement`: runtime corpora, Python APIs, and
          generated graph data are forced into TypeScript package source
          folders and become harder to operate.
        - `docs_drift`: README and docs continue to reference the old `src/`
          layout after the migration.
    </failure_modes>

    <prior_evidence>
        - `package.json`: root scripts already separate CLI, UI build/server,
          typecheck, smoke, knowledge, and PR workflows by command.
        - `src/ui/app/tsconfig.json`: the frontend already has a separate
          browser-oriented TypeScript config.
        - `src/ui/app/vite.config.ts`: the frontend already has its own Vite
          root and build output policy.
        - `src/ui/server.ts`: the server is a large app-level integration
          surface, not reusable core.
        - `src/knowledge/paths.ts`: package-root assumptions and root
          `knowledge/` paths must be handled deliberately during extraction.
        - `docs/20-implementation/00-overview.md`: current docs explicitly
          map the single-package source tree and will need updating.
        - `AGENTS.md`: when working on the orchestrator UI, assume the UI
          server is already running and do not start it unless asked.
    </prior_evidence>

    <expected_value>
        - The final repo layout should make it obvious where to add frontend
          UI code, dashboard server endpoints, CLI commands, shared core state
          logic, agent behavior, and knowledge graph code.
        - A future maintainer should be able to run the same root commands as
          before while also working package-locally when useful.
        - Package boundaries should prevent accidental app-to-core coupling and
          expose dependency cycles early.
        - The migration should produce enough artifacts that another agent can
          verify what moved, why it moved, and how functionality was preserved.
    </expected_value>
</problem>
