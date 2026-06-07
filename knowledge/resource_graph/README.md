# Resource Graph

Shared graph state for source slices and external tool outputs.

Generated files:

- `graph.sqlite`
- `graph.sqlite-shm`
- `graph.sqlite-wal`
- `indexes/*.jsonl`

Graph-owned enrichment artifacts:

- `enrichments/agent_shared_state_lessons.jsonl` - curated lessons imported
  from a legacy `agent_state-shared.db`. The importer keeps durable tool issues
  and useful function hints, skips stale operational state, and does not require
  the original DB after import.
- `enrichments/knowledge_curator_updates.jsonl` - generated worker/PR lessons
  and proposal-only source updates produced by `kg-curate` or `kg-maintain`.
  This is ingestion output, not a registered knowledge source.

CLI entry points are exposed through `bun run kg:*` package scripts.

Useful commands:

- `bun run kg:import-agent-state -- --input agent_state-shared.db`
- `bun run kg:tool-indexes -- --repo-root <repo_root>`
- `bun run kg:curate -- --state-dir <state_dir>`
- `bun run kg:maintain -- --state-dir <state_dir> --repo-root <repo_root>`
- `bun run kg:rebuild -- --repo-root <repo_root>`
- `bun run kg:smoke -- --strict`
- `bun run kg:search -- --source agent_shared_state --query <query>`

Current v1 graph ingestion builds source versions and search chunks for all
registered sources: `code_graph`, `past_prs`, `discord_knowledge`,
`ssbm_data_sheet`, `powerpc_docs`, `external_mirrors`, `resource_guides`,
`reference_docs`, and `tool_outputs`. `agent_shared_state` and
`curator_enrichment` are graph-owned enrichments, not registered source slices.
