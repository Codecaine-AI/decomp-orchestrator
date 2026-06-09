<current_state>
<last_updated>2026-06-08</last_updated>

<status>
    - Project workspace layering is implemented and validated.
    - The orchestrator is now physically located at
      `/Users/Ford/Github Repos/oss/decomp-orchestrator`.
    - The live Melee checkout is now physically located at
      `projects/melee/checkout`.
    - `--project melee` resolves to the live checkout with no project warnings.
</status>

<completed>
    - Added project descriptor/resolver support in
      `packages/core/src/projects/`.
    - Added tracked project workspace docs/config:
      `projects/README.md` and `projects/melee/project.json`.
    - Added ignored local validation override:
      `projects/melee/local.project.json`.
    - Removed the ignored smoke-fixture local override after physically moving
      the live Melee checkout into `projects/melee/checkout`.
    - Archived old smoke-validation project state and fixture graph DB under
      ignored `projects/melee/state/_fixture_validation_*` and
      `projects/melee/graph/_fixture_validation_*`.
    - Rebuilt the selected project graph at
      `projects/melee/graph/graph.sqlite` from the live checkout with
      `code_graph,path_facts`.
    - Updated `.gitignore` for project checkouts, state, graph DBs, local env,
      local project overrides, Pi agent config, and Pi sessions.
    - Wired `--project` through CLI parsing, command defaults, run metadata,
      knowledge commands, director/worker prompt context, dashboard contract,
      dashboard server routes, and dashboard UI request state.
    - Updated README and active docs for the project workspace model.
    - Replaced stale worker prompt/context relative
      `decomp-orchestrator/knowledge` assumptions with resource-map or
      `<orchestrator_package>` guidance.
    - Final audit tightened CLI command-level `--graph-db` handling so run and
      prompt project metadata record the graph DB path actually used by
      `init-run`, `tick`, and `worker`.
    - Created final artifacts:
      `artifacts/current_coupling_map.md`,
      `artifacts/baseline_validation.json`,
      `artifacts/project_resolution_matrix.json`,
      `artifacts/dashboard_route_validation.json`,
      `artifacts/validation_summary.json`,
      and `report.md`.
</completed>

<validation>
    - `bun objectives/project-workspace-layering/artifacts/project_resolution_matrix.ts`
      passed 8 resolver cases.
    - `bun run check` passed.
    - `bun run smoke` passed with run
      `06d505a3-82b2-4768-a9b5-ddc5a4fbb56f` in the final audit pass.
    - `bun run ui:build` passed.
    - `bun run orch -- --help` passed and shows `--project`.
    - Explicit raw path status passed with `testdata/smoke_repo`.
    - `bun run orch -- --project melee status` passed.
    - Project dry-run `init-run`, `tick`, and `worker` passed with run
      `8c7ea4dc-3f01-4a62-89ef-0715f07e656c`.
    - `bun run kg:sources` passed.
    - `bun run kg:status -- --project melee` passed.
    - `bun run kg:rebuild -- --project melee --sources code_graph,path_facts`
      passed and wrote the selected project graph DB from the live checkout.
    - Final physical-migration status passed with `runs: 0`,
      `repoRoot=projects/melee/checkout`, `graphDbExists=true`, and no project
      warnings.
    - Dashboard API `/api/config` and `/api/dashboard?projectId=melee` report
      the moved checkout, moved state dir, live project graph DB, and current
      Melee report metrics.
    - Dashboard is running at `http://localhost:8787` in tmux session
      `decomp-orchestrator-ui`.
    - `bun objectives/project-workspace-layering/artifacts/dashboard_route_validation.ts`
      passed with zero route failures and run
      `81bdf0a0-fce0-4280-97cc-81f0c0569e37` in the final audit pass.
    - Targeted `--project melee --state-dir <tmp> init-run --graph-db <path>`
      passed and recorded the explicit graph DB in run/project metadata.
    - Prompt grep found project id/kind/state/graph/orchestrator fields in
      rendered director and worker prompts.
    - Active stale path scan found no nested/parent checkout or relative
      `decomp-orchestrator/knowledge` command assumptions.
</validation>

<in_progress>
    - No implementation branch remains in progress for this objective.
</in_progress>

<next_actions>
    - Add provider/Pi config values to ignored `projects/melee/local.env` if
      project-specific credentials or overrides are needed; the current file is
      an empty ignored placeholder.
    - Run a full `bun run kg:rebuild -- --project melee` when refreshing all
      global corpora for a live session.
    - Use `tmux attach -t decomp-orchestrator-ui` to watch or stop the live UI
      process.
</next_actions>

<risks_or_open_questions>
    - Full graph rebuild across all global sources was not required for this
      gate; validation used the safe project-derived subset
      `code_graph,path_facts`.
    - This shell resolves `/usr/local/bin/node` v18.15.0 before the nvm Node
      v23.8.0 path; Vite 8 needs Node 20.19+ or 22.12+. The running tmux UI
      session prepends `~/.nvm/versions/node/v23.8.0/bin` before starting.
    - The worktree contains large unrelated/generated changes from the earlier
      monorepo restructuring and knowledge data refresh; they were preserved.
</risks_or_open_questions>

<important_paths>
    - `packages/core/src/projects/resolver.ts`
    - `apps/cli/src/cli/args.ts`
    - `apps/dashboard-server/src/server.ts`
    - `packages/ui-contract/src/dashboard.ts`
    - `packages/knowledge/src/resources.ts`
    - `packages/agents/src/director/prompt.ts`
    - `packages/agents/src/worker/prompt.ts`
    - `projects/README.md`
    - `projects/melee/project.json`
    - `objectives/project-workspace-layering/report.md`
    - `objectives/project-workspace-layering/artifacts/validation_summary.json`
</important_paths>
</current_state>
