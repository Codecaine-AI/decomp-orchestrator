<validation_and_handoff>
    <validation_ladder>
        - `git status --short`: record dirty worktree state before and after;
          do not revert unrelated user changes.
        - `bun install`: workspace dependency/link validation after manifests
          change; must complete without lockfile/package errors.
        - `bun run check`: root TypeScript validation across packages/apps;
          must pass.
        - `bun run smoke`: vertical smoke over CLI/core/agents/state/UI helper
          imports; must pass.
        - `bun run ui:check`: dashboard frontend typecheck; must pass.
        - `bun run ui:build`: dashboard production build; must pass and produce
          the build output the server expects.
        - `bun run orch -- --help`: root CLI compatibility smoke; must print
          usage through the new app entrypoint.
        - `bun run orch -- --repo-root testdata/smoke_repo --state-dir <tmp> status`:
          fixture path/state smoke; must return status without path resolution
          errors.
        - `bun run kg:sources`: knowledge command smoke; must list registered
          knowledge sources/tools from the new package/app graph.
        - `bun run kg:status`: knowledge graph path smoke when the local graph
          database exists; if skipped, record why.
        - `make check`, `make smoke`, and `make status` with fixture-safe
          variables where needed: operator wrapper smoke; must pass or match
          documented baseline behavior.
        - Dashboard server validation: prove `/api/config`, `/api/dashboard`,
          `/api/process`, run, report, and PR handoff routes still resolve.
          Prefer a non-listening handler test or an already-running server;
          ask the user before starting a UI server.
        - Static asset validation: prove the dashboard server serves the
          `apps/dashboard` production build path.
        - Dependency graph validation: prove package dependencies follow
          `apps -> packages`, `agents -> knowledge/core`,
          `knowledge -> core`, and `core -> none`.
        - Stale path scan: `rg` for old paths and package-private relative
          imports; all hits must be either fixed or documented shims.
    </validation_ladder>

    <artifact_contract>
        - `objectives/monorepo-restructuring/artifacts/baseline_summary.json`:
          baseline commands, pass/fail state, known pre-existing failures, and
          dirty-worktree notes.
        - `objectives/monorepo-restructuring/artifacts/migration_map.json`:
          old path, new path, owner package/app, phase, and import rewrite
          policy for moved areas.
        - `objectives/monorepo-restructuring/artifacts/dependency_graph.json`:
          package graph, allowed edges, detected edges, and forbidden edge
          findings.
        - `objectives/monorepo-restructuring/artifacts/validation_summary.json`:
          final command list, exit status, short result summaries, skipped
          checks with reasons, artifact paths, and residual risks.
        - `objectives/monorepo-restructuring/artifacts/final_report.md`
          optional: human-readable summary of what moved, why, validation
          evidence, and follow-up recommendations.
    </artifact_contract>

    <acceptance_gates>
        - Root command compatibility is preserved: existing operator commands
          still work from the repo root.
        - App/package tree exists and matches the target map:
          `apps/cli`, `apps/dashboard`, `apps/dashboard-server`,
          `packages/core`, `packages/agents`, `packages/knowledge`, and
          `packages/ui-contract`.
        - Runtime package dependencies have no forbidden cycles.
        - `packages/core` has no dependency on apps, agents, or knowledge.
        - `apps/dashboard` has no Node/Bun runtime imports and only depends on
          browser-safe UI contract and frontend dependencies.
        - `apps/dashboard-server` owns server/API/process-control behavior and
          no longer lives inside frontend source.
        - Root `knowledge/` remains usable by CLI, workers, knowledge graph
          code, and Python APIs.
        - Tests and docs refer to new paths.
        - Full validation ladder passes or any skipped live-server checks have
          an explicit user-instruction reason and an alternate non-listening
          validation.
    </acceptance_gates>

    <report_contract>
        - Final report must summarize the final tree, package dependency
          direction, root command compatibility, validation commands, artifacts,
          stale-path cleanup, and residual risks.
        - Include any intentionally retained compatibility shims and their
          removal criteria.
        - If a validation command was skipped, state why and what alternate
          evidence covers the same behavior.
    </report_contract>

    <current_state_update>
        - Update `current_state.md` at the start of implementation, after each
          major phase, before compaction, and before final response.
        - Final state must include package map, commands run, artifact paths,
          known residual risks, and whether completion criteria are satisfied.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If the objective cannot complete, preserve artifacts, identify the
          failing phase, state whether the repo is currently runnable, and
          define the smallest useful next step.
        - Do not mark the objective complete if root scripts work but package
          boundaries are fake, cyclic, undocumented, or unvalidated.
    </blocked_or_failed_handoff>
</validation_and_handoff>
