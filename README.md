# Decomp Orchestrator

Production-shaped vertical slice for the Melee decomp orchestration runner.

This repository is the canonical source and command surface for the package.
When vendored into a Melee checkout as a submodule, place it at repo-root
`decomp-orchestrator/`. Generated state defaults to
`<melee-repo>/.decomp-orchestrator-state/` so runtime files do not mix with
source files.

The runner stays intentionally thin:

- SQLite stores runs, targets, queue rows, leases, file locks, events, Pi
  sessions, director cycles, and worker reports.
- The runner owns state transitions, locks, artifacts, and Pi invocation.
- Director and worker Pi agents own reasoning.
- Workers communicate through durable reports, facts, and wake events, not by
  talking to each other.
- The required smoke path uses dry-run Pi agents and fixture board data.

## Current Self-Sufficiency

The package now owns the runtime knowledge that the director and workers need:

- `knowledge/manifest.json` routes role defaults and worker capabilities to
  concrete knowledge packs.
- `knowledge/decomp_resources/` stores the local decomp resource library,
  indexes, data-sheet CSVs, and mirrored hint surfaces.
- `knowledge/past_prs/` stores the stable PR dump, searchable postmortem
  library, shared PR-agent prompts, and refresh utilities.
- `package.json` exposes the PR refresh/postmortem/sync utilities as package
  scripts.

The package does not yet have a single autonomous boot command. `init-run`
records `desired_workers`, queues initial targets, and writes run state, but it
does not refresh PR knowledge, start a worker pool, keep workers at the desired
count, run the director loop continuously, or perform global build/report
refreshes. Today those are explicit operator steps.

## Setup

From this directory:

```sh
bun install
bun run check
bun run smoke
```

`bun run smoke` is the fixture-backed vertical-slice gate. It creates a clean
temporary state directory, runs the CLI end to end in dry-run mode, and asserts
the SQLite rows plus artifact files that prove the slice.

## Dependencies

Required for package install, typecheck, and smoke:

- Bun.
- Python 3.
- Git.

Required for live Pi sessions:

- `@earendil-works/pi-coding-agent`, installed by `bun install`.
- Whatever provider/auth setup Pi needs for the selected `--provider`,
  `--model`, and `--thinking-level`.

Required for a live Melee checkout run:

- A configured doldecomp/melee checkout with the normal decomp toolchain.
- Generated `objdiff.json` and `build/GALE01/report.json`.
- The repo's build and verification tools, including `python configure.py`,
  `ninja`, and `build/tools/objdiff-cli`.

Required for PR knowledge refresh:

- GitHub CLI `gh`, authenticated with access to `doldecomp/melee`.
- Network access to GitHub.

Optional tools referenced by knowledge packs and prompts:

- `pdftotext` for rebuilding the PowerPC PDF page index.
- `openpyxl` for re-exporting the SSBM data-sheet workbook to CSV.
- `tools/table-typer` for typed table inference when that repo-local tool is
  present and built.
- `decomp-permuter/`, `permuter_settings.toml`, and
  `tools/permuter/import_func.sh` for permuter handoff workflows.

There is no `decomp-promoter` dependency or installer declared inside this
package today. If a local promoter-style helper is part of an operator workflow,
it is external to the orchestrator package until it is added as a package script,
submodule dependency, or documented optional tool.

## Canonical Command Path

Use the package scripts from this repository root:

```sh
bun run orch -- --help
bun run smoke
```

## Run Model

The CLI is currently a set of single-step commands:

- `init-run` creates the SQLite state, stores the goal and `desired_workers`,
  loads `objdiff.json` plus `build/GALE01/report.json`, queues the initial
  candidate targets, and writes the initial board snapshot.
- `tick` handles one unhandled wake event by launching one director Pi session.
  The director can return target packets, which the runner uses to update queue
  priorities.
- `worker` leases one queued target, launches one worker Pi session, records the
  durable report/facts/blocker artifacts, releases the lease, and emits the
  resulting wake event.
- `recover-leases` writes synthetic stalled reports for interrupted or expired
  active leases after operator confirmation.
- `status` prints the current run, queue, lease, event, and report summary.

`desired_workers` is therefore an input to state and director prompts, not a
process supervisor yet. To run more than one worker today, start multiple
`worker` commands yourself or wrap them with an external process manager.

Manual fixture run:

```sh
STATE_DIR="$(mktemp -d)"
FIXTURE_ROOT="$PWD/testdata/smoke_repo"

bun run orch -- --repo-root "$FIXTURE_ROOT" --state-dir "$STATE_DIR" --dry-run-agents init-run \
  --desired-workers 1 \
  --candidate-limit 8 \
  --goal-kind matched_code_percent \
  --goal-value 72

bun run orch -- --repo-root "$FIXTURE_ROOT" --state-dir "$STATE_DIR" --dry-run-agents tick \
  --candidate-limit 8

bun run orch -- --repo-root "$FIXTURE_ROOT" --state-dir "$STATE_DIR" --dry-run-agents worker \
  --worker-id smoke-worker-1 \
  --report-type stalled_no_useful_guess

bun run orch -- --repo-root "$FIXTURE_ROOT" --state-dir "$STATE_DIR" --dry-run-agents status
```

For real repo data, set `--repo-root` to the Melee checkout root and pass an
explicit `--state-dir` while experimenting. If omitted, `--state-dir` defaults
to `<repo-root>/.decomp-orchestrator-state/`, which is ignored by Git.

## Smoke Fixture

Fixture root:

```text
decomp-orchestrator/testdata/smoke_repo/
+-- objdiff.json
+-- build/GALE01/report.json
+-- src/melee/ft/chara/ftDemo.c
```

The fixture contains one fuzzy function and one already-matched function. The
smoke test proves the board loader queues only the fuzzy function.

## Prompt Templates

Pi launches are rendered from template files under `prompts/`:

```text
prompts/
+-- director/system.md
+-- director/initial_user.md
+-- worker/system.md
+-- worker/initial_user.md
```

The system prompt defines role, authority, safety rules, and output contract.
The initial user prompt carries current run state, files to read first,
available resources/commands, and the concrete director wake event or worker
target packet. Dry-run and live sessions both write rendered prompt artifacts
beside the Pi output.

## Agent Knowledge

Runtime Pi agent knowledge lives under `knowledge/`, not under Codex skills:

```text
knowledge/
+-- manifest.json
+-- decomp_resources/
+-- past_prs/
+-- packs/
    +-- decomp-find/
    +-- melee-decomp/
    +-- melee-decomp-sweep/
```

`manifest.json` maps role defaults and worker capabilities to concrete knowledge
packs. `src/prompts.ts` renders `selected_knowledge_packs` into each session and
lists the manifest, selected packs, and migrated helper scripts in the resource
map. The director gets target-finding/classification knowledge by default; the
worker gets core Melee decomp knowledge plus capability-specific packs such as
focused source editing, fact research, duplicate adaptation, sweep batches, or
permuter handoff.

The decomp resource library and past-PR corpus are also package-owned:

- `knowledge/decomp_resources/` contains the data-sheet CSVs, PowerPC indexes,
  external hint indexes, manifests, and resource notes.
- `knowledge/past_prs/` contains the stable `current/` PR dump, searchable
  `prs/` postmortem library, shared PR-agent prompts under `agent/`, and
  refresh utilities under `utils/`.

## PR Knowledge Refresh

The PR refresh flow lives inside this package, so it can travel with the
orchestrator instead of depending on repo-root docs:

```sh
bun run pr:refresh:dry
bun run pr:refresh
bun run pr:refresh -- --postmortem-mode pi --postmortem-scope fetched --postmortem-jobs 16
bun run pr:postmortems -- --dump-root knowledge/past_prs/current --run-agent --rerun-existing --jobs 16
```

For the combined branch sync plus PR-library refresh:

```sh
bun run pr:sync -- --postmortem-jobs 16
```

These scripts default to `knowledge/past_prs`, with the refresh window recorded
in `knowledge/past_prs/current/fetch_metadata.json`.

PR refresh is built into the package command surface, but it is not
automatically run by `init-run`, `tick`, or `worker`. Run it before starting a
live orchestration run, or schedule it as a separate operator maintenance step.

## State And Artifacts

State directory layout:

```text
<state-dir>/
+-- orchestrator.sqlite
+-- runs/
    +-- <run_id>/
        +-- snapshots/initial_board.json
        +-- director_cycles/director_<session>.system.md
        +-- director_cycles/director_<session>.user.md
        +-- director_cycles/director_<session>.txt
        +-- worker_logs/<lease_id>/worker_<session>.system.md
        +-- worker_logs/<lease_id>/worker_<session>.user.md
        +-- worker_logs/<lease_id>/worker_<session>.txt
        +-- worker_logs/<lease_id>/report/worker_report.json
        +-- worker_logs/<lease_id>/report/facts.json
        +-- worker_logs/<lease_id>/report/blocker.json
        +-- smoke_summary.json
```

The smoke command asserts row counts in `runs`, `targets`, `queue`, `events`,
`pi_sessions`, `director_cycles`, `leases`, `file_locks`, and
`worker_reports`. It also asserts the initial board snapshot, director output,
director system/user prompts, worker output, worker system/user prompts, worker
report, and smoke summary artifacts.

`recover-leases` is the operator recovery path for interrupted workers. By
default it recovers only expired active leases. Pass `--force` only after a
process scan confirms the run's worker process is gone. Recovery writes a
synthetic `stalled_no_useful_guess` report, releases the lease, preserves the
worker report artifact, removes the transient file-lock row, and emits a
`worker_stalled` wake event for the director.

```sh
bun run orch -- --repo-root "$REPO_ROOT" --state-dir "$STATE_DIR" recover-leases \
  --run-id "$RUN_ID" \
  --force \
  --reason "operator-confirmed interrupted worker process"
```

## Dry-Run And Live Pi Mode

`--dry-run-agents` writes the Pi prompt and metadata to an artifact instead of
calling the Pi SDK. This is the required mode for `bun run smoke`.

Without `--dry-run-agents`, `tick` and `worker` attempt to use
`@earendil-works/pi-coding-agent`. The adapter passes the rendered system prompt
through Pi's `DefaultResourceLoader` system-prompt override, then sends the
rendered initial user prompt as the session prompt. Both director and worker
sessions default to `--provider codex-lb --model gpt-5.5 --thinking-level
xhigh`; those flags remain overrideable per CLI invocation. Live Pi execution
is not part of the required smoke gate yet. The current worker command still
writes an explicit runner-side report row after the Pi session; parsing a live
worker's report is future work.

## Current Limitations

- No Melee source files are edited by the smoke path.
- No real build, objdiff, score gate, or patch integration runs in this slice.
- No built-in bootstrap command refreshes PR knowledge, starts a director loop,
  or maintains a pool of `desired_workers`.
- One worker lease/report path is exercised by the smoke gate; broad scheduling
  is deferred.
- File-lock rows are transient lease guards; worker reports and recovery remove
  them when a lease is released.
- `matched_code_percent` is the long-term progress metric. `fuzzy_match_percent`
  remains target-selection telemetry only.

## Intended Bootstrap Shape

The eventual installable/submodule shape should probably grow a command like:

```sh
bun run orch -- bootstrap \
  --repo-root "$REPO_ROOT" \
  --state-dir "$STATE_DIR" \
  --desired-workers 16 \
  --refresh-pr-knowledge
```

That command does not exist yet. It would be the place to optionally run the PR
refresh, initialize or resume a run, keep the director ticking, maintain the
worker pool, recover stale leases, and serialize global progress/report refreshes
after workers are idle.
