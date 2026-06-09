<current_state>
<last_updated>2026-06-08</last_updated>

<status>
    - Monorepo restructuring is implemented through final validation.
    - App surfaces live in `apps/`: `apps/cli`, `apps/dashboard`, and
      `apps/dashboard-server`.
    - Reusable TypeScript runtime packages live in `packages/`:
      `packages/core`, `packages/agents`, `packages/knowledge`, and
      `packages/ui-contract`.
    - Root compatibility scripts and Makefile wrappers remain usable from the
      repository root.
    - Root `knowledge/`, `docs/`, `tests`, `testdata`, `objectives`, and
      `ai_docs` remain repo-level assets.
</status>

<completed>
    - Created `objectives/monorepo-restructuring/` with goal, context,
      migration map, baseline, dependency graph, phase summaries, validation
      summary, and final report artifacts.
    - Added Bun workspace structure for `apps/*` and `packages/*`.
    - Moved the dashboard frontend to `apps/dashboard` and extracted dashboard
      contracts/formatting helpers to `packages/ui-contract`.
    - Moved state, board, shell, report, objdiff, handoff, env, and shared
      runtime types to `packages/core`.
    - Moved TypeScript knowledge code to `packages/knowledge` while keeping
      root `knowledge/` as data/tool/graph state.
    - Moved agent code, schemas, templates, and context manifest to
      `packages/agents`.
    - Broke the agents/knowledge package cycle by passing selected agent
      context into knowledge resource rendering from callers.
    - Moved the CLI binary and commands to `apps/cli/src`.
    - Moved the dashboard server and trusted report helper to
      `apps/dashboard-server/src`.
    - Updated root scripts for `orch`, `regression-check`, `kg:*`, and
      `ui:*` to app entrypoints.
    - Updated CLI/dashboard server subprocess paths to
      `apps/cli/src/bin/decomp-orchestrator.ts`.
    - Exported the dashboard server fetch handler so API/static behavior can be
      validated without starting a UI server.
    - Updated active README and implementation docs for the workspace layout.
    - Fixed `packages/core/src/env/local.ts` to resolve `local.env` from the
      orchestrator root after the core move.
    - Fixed the dashboard route validation artifact to match the
      `/api/run/details` response shape (`runId` / `status.run.id`) and
      reran it successfully.
</completed>

<validation>
    - `bun install` passed.
    - `bun run check` passed.
    - `bun run smoke` passed.
    - `bun run ui:build` passed.
    - `bun run orch -- --help` passed.
    - `bun run orch -- --repo-root testdata/smoke_repo --state-dir <tmp> status`
      passed with `{"runs":0}`.
    - Dashboard non-listening validation passed for static `/` plus config,
      dashboard, process, run, PR handoff, and report routes through
      `fetchDashboardServer`.
    - `bun run kg:sources` passed with 11 sources and 4 tools.
    - `bun run kg:status` passed against the local graph DB.
    - `make check` passed.
    - `make smoke` passed.
    - `REPO_ROOT=<repo>/testdata/smoke_repo STATE_DIR=<tmp> make status`
      passed.
    - Stale active root `src/...` path scan passed; remaining `src/` matches are
      package/app-internal paths or Melee source paths.
    - Docs audit still exits `2` due to legacy archive/frontmatter/naming
      issues and missing archived chart assets; active monorepo path drift was
      cleaned up.
    - Final resumed sanity checks passed: `bun run check`, `bun run smoke`, and
      `jq empty` over the validation/dependency/migration JSON artifacts.
</validation>

<next_actions>
    - No required migration implementation work remains.
    - Optional follow-up: handle broad docs-framework audit hygiene for archived
      docs and missing chart assets as a separate documentation cleanup.
    - Optional follow-up: split `apps/dashboard-server/src/server.ts` into
      smaller server modules if future dashboard work needs narrower ownership.
</next_actions>

<risks_or_open_questions>
    - Existing generated/runtime changes under `.decomp-orchestrator-state/`,
      `knowledge/sources/past_prs/data/prs/run_summary.json`, and
      `knowledge/tools/opseq/indexes/opcode_sequences.jsonl` remain preserved.
    - Historical/objective artifacts intentionally preserve old `src/...`
      references as migration evidence.
    - Docs audit residuals are legacy archive structure/frontmatter/naming and
      missing chart assets, not active app/package path drift.
    - Repo instructions still say not to start the UI server unless explicitly
      asked; validation used the exported non-listening dashboard handler.
</risks_or_open_questions>

<important_paths>
    - `apps/cli/src/bin/decomp-orchestrator.ts`
    - `apps/cli/src/cli/`
    - `apps/dashboard/`
    - `apps/dashboard-server/src/server.ts`
    - `packages/core/src/`
    - `packages/agents/src/`
    - `packages/knowledge/src/`
    - `packages/ui-contract/src/`
    - `objectives/monorepo-restructuring/artifacts/cli_dashboard_server_summary.json`
    - `objectives/monorepo-restructuring/artifacts/dashboard_route_validation.json`
    - `objectives/monorepo-restructuring/artifacts/validation_summary.json`
    - `objectives/monorepo-restructuring/artifacts/final_report.md`
    - `objectives/monorepo-restructuring/artifacts/dependency_graph.json`
    - `objectives/monorepo-restructuring/artifacts/migration_map.json`
</important_paths>
</current_state>
