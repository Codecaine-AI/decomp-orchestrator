<validation_and_handoff>
    <validation_ladder>
        - `resolver_unit_checks`: Project config resolution covers default
          project, explicit project, local override, raw path override, invalid
          project id, missing checkout, and relative/absolute path cases.
        - `bun run check`: TypeScript and dashboard type checks pass.
        - `bun run smoke`: Existing dry-run smoke flow passes unchanged.
        - `bun run ui:build`: Dashboard builds after project UI/contract changes.
        - `bun run orch -- --help`: Help includes `--project` and preserves
          existing global flags.
        - `bun run orch -- --repo-root testdata/smoke_repo --state-dir <tmp> status`:
          Explicit path compatibility returns a valid status JSON.
        - `bun run orch -- --project melee status`: Project resolution returns a
          valid status JSON for the configured Melee project or a documented
          fixture fallback.
        - `bun run orch -- --project melee --dry-run-agents init-run <args>`:
          Dry-run initialization uses project-scoped state and records project
          metadata. Choose safe init arguments during implementation and record
          them exactly.
        - `bun run kg:sources`: Global knowledge source/tool registry still
          lists expected sources and tools.
        - `bun run kg:status -- --project melee`: Project-aware graph status
          reports the selected graph DB path.
        - `bun run kg:rebuild -- --project melee`: Rebuilds the project graph
          when safe; if skipped, record why and validate with a fixture graph
          path instead.
        - `dashboard_non_listening_routes`: Import the dashboard server fetch
          handler and validate `/api/config`, dashboard data, run details,
          process status, process command construction, PR handoff routes, and
          report actions without starting a listening UI server.
        - `stale_path_scan`: Search active README/docs/prompts/code for outdated
          "parent Melee checkout" or `decomp-orchestrator/...` assumptions and
          update or classify each hit as archive/historical.
    </validation_ladder>

    <artifact_contract>
        - `objectives/project-workspace-layering/artifacts/current_coupling_map.md`:
          Table with columns for path, current assumption, ownership class,
          intended replacement, implementation phase, and validation note.
        - `objectives/project-workspace-layering/artifacts/project_resolution_matrix.json`:
          JSON array of resolver cases with input flags/body/config, expected
          selected project, expected repo root, state dir, graph DB, and
          pass/fail result.
        - `objectives/project-workspace-layering/artifacts/dashboard_route_validation.json`:
          Route list, request payload/query, selected project id, status code,
          response summary, and command arrays for process-start style routes.
        - `objectives/project-workspace-layering/artifacts/validation_summary.json`:
          Command, cwd, timestamp, duration when available, status, notable
          stdout/stderr summary, and skip reason if not run.
        - `objectives/project-workspace-layering/report.md`: Final narrative
          report with decisions, implemented layout, compatibility notes,
          validation, rejected approaches, risks, and future work.
    </artifact_contract>

    <acceptance_gates>
        - `project_identity`: CLI, dashboard server, dashboard UI, state/run
          metadata, knowledge/resource paths, and agent context all carry a
          resolved project identity.
        - `path_precedence`: Explicit raw path overrides win over project
          defaults and are documented.
        - `state_graph_scoping`: Default state and graph outputs are scoped to
          the selected project and cannot silently use another project.
        - `melee_operability`: The configured `melee` project can run status and
          at least one safe dry-run orchestration path.
        - `compatibility`: Existing smoke repo commands and root scripts remain
          usable.
        - `ui_safety`: Dashboard process actions include selected project
          identity and resolved paths in server-side command construction and
          saved process records.
        - `documentation`: README and active docs describe the project workspace
          model and no longer present the nested checkout as the primary current
          architecture.
    </acceptance_gates>

    <report_contract>
        - `report.md` must summarize the baseline, final workspace layout,
          project descriptor schema, resolver precedence, CLI behavior, dashboard
          behavior, state/graph locations, Melee wiring route, validation
          results, rejected routes, risks, and recommended next action.
    </report_contract>

    <current_state_update>
        - Before handoff, update `current_state.md` with completed work,
          active decision, commands run, important paths, risks, and next
          actions.
    </current_state_update>

    <blocked_or_failed_handoff>
        - If project resolver or compatibility work fails, preserve artifacts,
          keep raw path behavior intact, state the blocker, and define the
          smallest next implementation step.
        - If attaching the live Melee checkout is the only blocker, mark the
          resolver/API/UI implementation complete and document the exact local
          override or checkout command needed.
        - If validation cannot run because of environment prerequisites, record
          skipped commands with concrete reasons and provide fixture-based
          substitute evidence where possible.
    </blocked_or_failed_handoff>
</validation_and_handoff>
