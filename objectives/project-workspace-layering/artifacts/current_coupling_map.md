# Current Path Coupling Map

Date: 2026-06-08

## Baseline Layout

The app/package split is present and matches the completed monorepo objective:

- Apps: `apps/cli`, `apps/dashboard`, `apps/dashboard-server`
- Packages: `packages/core`, `packages/agents`, `packages/knowledge`, `packages/ui-contract`
- Repo-level assets: `knowledge/`, `docs/`, `tests/`, `testdata/`, `objectives/`, `ai_docs/`

Root scripts in `package.json` point at app entrypoints, with `bun run orch`
using `apps/cli/src/bin/decomp-orchestrator.ts`.

## Active Coupling Table

| Path | Current assumption | Ownership class | Intended replacement | Phase | Validation note |
| --- | --- | --- | --- | --- | --- |
| `apps/cli/src/cli/args.ts` | Global `repoRoot` defaults to `process.cwd()` and `stateDir` defaults to `<cwd>/.decomp-orchestrator-state`; no project id exists. | resolver-owned CLI defaults | Add `--project`; resolve project defaults first; keep explicit `--repo-root` and `--state-dir` overrides highest precedence. | 2, 3 | Parser tests and `bun run orch -- --project melee status`; explicit smoke repo status must remain valid. |
| `apps/cli/src/cli/main.ts` | Loads root `local.env` before parsing or resolving a project. | resolver-owned environment policy | Keep root env loading for compatibility; allow project descriptors to expose a local env path for later loading once project is resolved. | 2, 3 | Help/status still run without project env; project metadata reports env path when configured. |
| `apps/cli/src/cli/commands/init-run.ts` | Uses `globals.repoRoot`/`globals.stateDir`; graph default comes from global `resourceGraphDbPath()`. | project-derived graph and state | Use resolved project repo/state/graph defaults; write run metadata with project identity. | 3, 4 | Dry-run init against fixture or `melee` writes project-scoped state and graph metadata. |
| `apps/cli/src/cli/commands/tick.ts` | Director tick uses `globals.repoRoot`/`globals.stateDir`; graph default is global. | project-derived graph and agent context | Use resolved project graph path and include project identity in director prompt context. | 3, 4 | Rendered director prompt contains `project_id`, `state_dir`, and project graph DB. |
| `apps/cli/src/cli/commands/worker.ts` | Worker uses `globals.repoRoot`/`globals.stateDir`; graph default is global for file cards/ranking. | project-derived graph and agent context | Use resolved project graph path and pass project metadata into worker prompt/resource map. | 3, 4 | Rendered worker prompt/resource map contains selected project roots and graph DB. |
| `apps/cli/src/cli/commands/trigger-agent.ts` | Spawns child CLI commands by forwarding raw repo/state flags. | command-specific compatibility adapter | Forward `--project` plus explicit overrides, or resolved paths when compatibility requires raw flags. | 3 | Smoke and babysit command construction still pass with explicit fixture paths. |
| `apps/cli/src/cli/commands/babysit.ts` | Builds child command from orchestrator root and raw repo/state flags; graph DB is command local. | command-specific compatibility adapter | Include project id and resolved graph default when present. | 3, 4 | Babysit dry-run command arrays include selected project identity. |
| `apps/cli/src/cli/commands/kg.ts` | `kg-status` has no globals; graph DB defaults to global `knowledge/resource_graph/graph.sqlite`; `knowledgeRepoRoot()` falls back to `checkoutRoot()`. | resolver-owned knowledge defaults | Make knowledge commands accept globals; default graph DB and repo root from resolved project; keep global corpora paths unchanged. | 3, 4 | `kg:sources` still lists global registries; `kg:status -- --project melee` reports project graph DB. |
| `packages/knowledge/src/paths.ts` | `packageRoot()` resolves to orchestrator root; `checkoutRoot()` returns the parent directory, preserving old nested-checkout assumptions; graph DB is global under `knowledge/resource_graph/graph.sqlite`. | knowledge-global vs project-derived boundary | Rename/clarify orchestrator root helpers; remove parent checkout default from project-derived flows; keep global source/tool roots. | 4 | Resource map and graph commands cannot silently use the parent directory as checkout root. |
| `packages/knowledge/src/resources.ts` | `roots.checkout_root` comes from `checkoutRoot()` while `board_repo_root` is passed separately; `knowledge_graph.graph_db` is global. | project-derived resource context | Render resources from a resolved project with `project_id`, project kind, repo root, state dir, graph DB, and orchestrator root. | 4 | Worker/director prompt tests include project fields and global corpora remain present. |
| `packages/knowledge/src/board.ts` | Board ranking default graph DB is global unless caller passes `graphDbPath`. | project-derived graph | Callers should pass `resolvedProject.graphDbPath`; fallback remains only for compatibility/no-project mode. | 4 | Existing explicit graph smoke stays valid; project runs use project graph path. |
| `packages/core/src/state/schema.ts` | `runs` table has no project id, repo root, state dir, graph DB, or config path metadata. | project-scoped state metadata | Add nullable project metadata columns with compatibility migration behavior. | 4 | New runs record selected project metadata; old state DBs open without destructive migration. |
| `packages/core/src/state/runs.ts` | `createRun()` only accepts goal and worker fields; events omit project identity. | project-scoped state metadata | Accept optional project metadata and include it in run records and `run_started` payload. | 4 | Smoke tests assert project metadata for project init while legacy init remains valid. |
| `packages/core/src/state/pi-sessions.ts` | Pi sessions are stored below whichever state dir is passed. | project-scoped state | Project state dir must be resolved before session insertion; session rows may include project id only if schema changes require it. | 4 | Project state dir contains Pi session records/artifacts; legacy path flow remains valid. |
| `packages/agents/src/worker/prompt.ts` | Prompt current state includes `state_dir` and packet, but not project identity; resource map is repo-root only. | project-derived agent context | Add optional resolved project metadata and pass it to `resourceMap()`. | 4 | Rendered worker prompt includes `project_id`, project kind, graph DB, and repo root. |
| `packages/agents/src/director/prompt.ts` | Director prompt includes state dir and board but not project identity; resource map is repo-root only. | project-derived agent context | Add optional resolved project metadata and pass it to `resourceMap()`. | 4 | Rendered director prompt includes project metadata and project-scoped artifact paths. |
| `packages/ui-contract/src/dashboard.ts` | UI config/form/dashboard types expose only `repoRoot` and `stateDir`; no project id, project list, graph path, or project defaults. | dashboard contract | Add project summaries, selected project id, graph DB path, project defaults, and advanced path override fields. | 5 | Contract typecheck and route validation cover `/api/config`, dashboard, run details, and process actions. |
| `apps/dashboard-server/src/server.ts` | Defaults derive `defaultRepoRoot = packageRoot/..` and `defaultStateDir = packageRoot/.decomp-orchestrator-state`; many handlers resolve raw body/query paths directly. | resolver-owned dashboard path identity | Centralize request/body project resolution; command construction and saved process records include project id and resolved paths. | 5 | Non-listening handler validation proves project-aware responses and command arrays. |
| `apps/dashboard/src/lib/api.ts` | API query params are only `repoRoot`/`stateDir`; POST body sends the full form. | dashboard request identity | Send `projectId` plus raw override fields only when advanced overrides are active. | 5 | UI build and handler validation show selected project reaches the server. |
| `apps/dashboard/src/components/App.tsx` and `Sidebar.tsx` | Form state initializes raw repo/state from `/api/config`; process name and validation defaults are hard-coded for Melee. | dashboard UI defaults | Initialize from selected project defaults; expose project selector and keep raw paths as advanced overrides. | 5 | UI build and route validation. |
| `README.md` and active docs | Still describe the normal nested setup where orchestrator is under/next to Melee and operators pass `--repo-root`. | operator documentation | Describe orchestrator-as-platform and Melee as configured project; keep raw path compatibility examples. | 7 | Stale path scan classifies remaining old references as archive/historical or compatibility-only. |
| `.gitignore` | Ignores root state/session/env paths but not `projects/<id>/checkout`, `state`, `graph`, `.pi-sessions`, or local overrides. | project workspace hygiene | Ignore project checkouts, local overrides, env, state, graph outputs, and Pi sessions. | 2, 6 | `git status --ignored` shows project runtime outputs are ignored. |

## Compatibility Surfaces

- Raw path CLI flows are active compatibility surfaces and must continue to work
  with `testdata/smoke_repo`.
- `knowledge/` source registries and corpus data are global orchestrator assets.
- Project-derived graph DBs, code graph slices, board ranking, state, process
  records, and Pi sessions should be resolved from the selected project.
- Archive docs and historical objective artifacts may retain old nested path
  references when they are explicitly historical.
