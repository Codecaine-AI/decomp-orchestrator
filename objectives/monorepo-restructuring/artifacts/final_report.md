# Monorepo Restructuring Final Report

Date: 2026-06-08

## Final Layout

- `apps/cli`: CLI binary and command modules.
- `apps/dashboard`: React/Vite dashboard frontend.
- `apps/dashboard-server`: Bun dashboard API, static serving, process controls, and PR handoff actions.
- `packages/core`: board/state/shell/report/objdiff/handoff/env/types runtime core.
- `packages/agents`: director, worker, PR-review, knowledge-curator, and Pi runtime helpers.
- `packages/knowledge`: TypeScript knowledge graph/resource APIs over repo-level `knowledge/` data.
- `packages/ui-contract`: browser-safe dashboard contracts and formatting helpers.

Repo-level `knowledge/`, `docs/`, `tests/`, `testdata/`, `objectives/`, and `ai_docs/` remain outside packages.

## Dependency Direction

- Apps depend on packages.
- `packages/agents` depends on `packages/core` and `packages/knowledge`.
- `packages/knowledge` depends on `packages/core`.
- `packages/core` and `packages/ui-contract` do not depend on apps, agents, or knowledge.

## Compatibility

Root scripts still provide the operator surface:

- `bun run orch`
- `bun run check`
- `bun run smoke`
- `bun run ui:*`
- `bun run kg:*`
- `bun run pr:*`
- Makefile wrappers for check, smoke, status, and run operations.

The dashboard server exports a request handler for non-listening validation and starts the UI server only when run as its entrypoint.

## Validation

Passed:

- `bun install`
- `bun run check`
- `bun run smoke`
- `bun run ui:build`
- `bun run orch -- --help`
- `bun run orch -- --repo-root testdata/smoke_repo --state-dir <tmp> status`
- `bun run kg:sources`
- `bun run kg:status`
- `make check`
- `make smoke`
- `REPO_ROOT=<repo>/testdata/smoke_repo STATE_DIR=<tmp> make status`
- Dashboard static `/` plus config, dashboard, process, run, PR handoff, and report routes through the exported non-listening handler.

Docs audit:

- `python3 .codex/skills/docs-framework/scripts/audit.py docs/` still exits `2` because of legacy archive/frontmatter/naming issues and missing archived chart assets.
- Active monorepo layout docs and root `src/...` path references were updated; remaining audit issues are outside the migration's active code layout.

## Residual Notes

- Generated/runtime data changes already present in `.decomp-orchestrator-state/` and knowledge indexes were preserved.
- Root `src/` has no source files left; app and package sources live under `apps/` and `packages/`.
- Full dashboard route evidence is in `objectives/monorepo-restructuring/artifacts/dashboard_route_validation.json`.
