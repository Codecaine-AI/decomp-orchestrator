# Project Workspace Layering Report

Date: 2026-06-08

## Outcome

Project workspace layering is implemented. The orchestrator is the platform
repository at `/Users/Ford/Github Repos/oss/decomp-orchestrator`, and Melee is
a configured project selected with `--project melee`. Raw `--repo-root`,
`--state-dir`, and `--graph-db` paths remain compatible and take precedence
when explicitly supplied.

## Implemented Layout

Tracked project config:

```text
projects/
+-- README.md
+-- melee/
    +-- project.json
```

Ignored local/runtime project material:

```text
projects/melee/
+-- checkout/
+-- local.env
+-- .pi-agent/
+-- .pi-sessions/
+-- state/
+-- graph/
```

The tracked Melee descriptor points at `./checkout`, `./state`, and
`./graph/graph.sqlite`. After the physical migration, the live Melee checkout
is populated at `projects/melee/checkout`, the smoke-fixture local override has
been removed, and an empty ignored `projects/melee/local.env` placeholder keeps
project resolution warning-free.

The previous smoke-validation project state and fixture graph DB were archived
inside ignored runtime folders:

```text
projects/melee/state/_fixture_validation_*
projects/melee/graph/_fixture_validation_*
```

## Resolver Contract

The resolver lives in `packages/core/src/projects/`. It reads
`projects/<id>/project.json`, applies optional ignored
`projects/<id>/local.project.json`, then applies explicit CLI/body overrides.
Relative descriptor and local override paths resolve from the project
directory; explicit overrides resolve from the invoking context.

Precedence:

1. Explicit CLI/dashboard/body overrides.
2. Ignored local project override.
3. Tracked project descriptor.
4. Built-in defaults.

Resolved project data includes project id/display/kind, repo root, state dir,
graph DB path, process name, base ref, local env path, validation defaults,
dashboard defaults, PR defaults, descriptor path, optional local override path,
and warnings for missing local paths.

## CLI Behavior

`apps/cli/src/cli/args.ts` accepts `--project <id>` globally. Project mode
threads the resolved repo/state/graph paths and project metadata through run,
worker, director, babysit, PR, regression, status, and knowledge commands.
The CLI loads root `local.env` for compatibility, then loads the selected
project's configured `localEnv` file when a project is selected.

Raw path mode remains available:

```sh
bun run orch -- --repo-root testdata/smoke_repo --state-dir "$(mktemp -d)" status
```

Project mode uses the project graph DB unless `--graph-db` is explicit:

```sh
bun run orch -- --project melee status
bun run kg:status -- --project melee
```

When a command-level `--graph-db` override is explicit, `init-run`, `tick`, and
`worker` pass that graph path into run/prompt project metadata so resource maps
and stored run records match the graph DB actually used by the command.

## Dashboard Behavior

The dashboard contract exposes project summaries, default project id, selected
project defaults, graph DB path, and an advanced path override switch. The
server routes requests through one project-resolution helper, and API requests
send `projectId` by default. Raw repo/state/graph paths are applied only when
`usePathOverrides` is true.

Process-start command construction includes `--project melee`, resolved
repo/state paths, and the resolved graph DB. Saved process records include the
project summary, repo root, state dir, graph DB path, and command array.
Dashboard validation uses `fetchDashboardServer` directly and does not start a
listening UI server.

## State, Graph, And Prompts

The `runs` table records nullable project metadata:

- project id and kind;
- project repo root;
- project state dir;
- project graph DB;
- descriptor path;
- local override path.

Knowledge graph commands default to the selected project's graph DB and selected
project repo root. Global corpora and source registries remain under
`knowledge/`; project-derived code graph/rank/file-card data uses the selected
project repo and graph DB.

Director and worker prompts include the selected project metadata plus
resource-map fields such as `project_id`, `project_kind`, `state_dir`,
`graph_db`, and `orchestrator_package`. Worker static guidance uses
`RESOURCES_JSON` or `<orchestrator_package>` placeholders rather than assuming a
relative `decomp-orchestrator/knowledge` path from the project checkout.

## Validation

Detailed artifacts:

- `artifacts/project_resolution_matrix.json`
- `artifacts/dashboard_route_validation.json`
- `artifacts/validation_summary.json`

Validation passed:

- resolver matrix, 8 cases;
- `bun run check`;
- `bun run smoke`;
- `bun run ui:build`;
- `bun run orch -- --help`;
- explicit raw path status;
- `bun run orch -- --project melee status`;
- project dry-run init/tick/worker prompt path;
- explicit project graph override metadata probe;
- `bun run kg:sources`;
- `bun run kg:status -- --project melee`;
- safe project graph rebuild with `--sources code_graph,path_facts`;
- physical migration status/config/dashboard probes against
  `projects/melee/checkout`;
- dashboard non-listening route validation;
- prompt project-field grep;
- stale path scan.

## Rejected Options

- No git submodule default for Melee. The tracked descriptor uses a portable
  checkout path, and local overrides handle machine-specific external paths.
- No destructive move/reclone of a live checkout. Fixture validation uses an
  ignored local override.
- No broad dashboard rewrite. Project resolution is centralized while the route
  bodies and UI keep their existing workflow shape.
- No global graph-only default in project mode. Global corpora remain global,
  but project graph outputs are selected project paths.

## Physical Migration Notes

The dashboard is running at `http://localhost:8787` from tmux session
`decomp-orchestrator-ui`. The launch prepends
`~/.nvm/versions/node/v23.8.0/bin` because the shell's default
`/usr/local/bin/node` is v18.15.0 and Vite 8 requires Node 20.19+ or 22.12+.

## Risks And Follow-Up

Live runs should add ignored project env/provider config to
`projects/melee/local.env` as needed.
- Full graph rebuild across every global source was not needed for this gate;
  the safe `code_graph,path_facts` rebuild proved selected project repo/graph
  routing. Run a full rebuild when refreshing global corpora for a live session.
