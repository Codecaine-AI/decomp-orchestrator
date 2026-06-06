# Decomp Orchestrator Knowledge

This directory is the runtime evidence surface for the orchestrator. It owns
source corpora, callable tools, and the shared resource graph.

Agent role behavior and prompt context live beside the agents under
`src/agents/*/context/`. Historical role/workflow docs live under
`docs/archive/`, not here.

Reusable corpora:

- `sources/` - shallow vertical slices for knowledge sources such as the code
  graph, past PRs, Discord knowledge, data sheets, PowerPC docs, external
  mirrors, and normalized tool outputs. Each slice has `data/`
  so the actual corpus path is visible from the slice.
- `tools/` - helper scripts plus callable external tool integration descriptors.
- `resource_graph/` - generated SQLite graph state, graph schemas/placeholders,
  graph command notes, generated graph-level indexes, and graph-owned
  enrichment artifacts.

Where the actual corpora live:

- PRs: `knowledge/sources/past_prs/data/current` for fetched PR data and
  `knowledge/sources/past_prs/data/prs` for processed postmortems/indexes.
- Discord knowledge: `knowledge/sources/discord_knowledge/data/docs`.
- Data sheet: `knowledge/sources/ssbm_data_sheet/data`.
- PowerPC PDFs: `knowledge/sources/powerpc_docs/data`.
- External mirrors: `knowledge/sources/external_mirrors/data`.
- Resource guides/manifests: `knowledge/sources/resource_guides/data`.
- Imported reference docs/legacy skills: `knowledge/sources/reference_docs/data`.
- Tool integrations: `knowledge/tools/<tool_id>`, with generated caches under
  each tool's `cache/` folder.
- Legacy shared agent-state lessons:
  `knowledge/resource_graph/enrichments/agent_shared_state_lessons.jsonl`.
  This is an internal graph enrichment, not a source slice; it is generated from
  a legacy SQLite DB and keeps only durable tool/function lessons.
- Knowledge curator updates:
  `knowledge/resource_graph/enrichments/knowledge_curator_updates.jsonl`.
  This generated enrichment is reduced from worker reports and PR postmortems.
  It can contain accepted worker/PR lessons plus proposal-only updates for
  source slices such as the data sheet or tool-output indexes. It is ingestion
  output, not a registered source that workers query directly.

Package command surface:

- `bun run kg:sources` lists registered source slices and external tools.
- `bun run kg:import-agent-state -- --input agent_state-shared.db` imports a
  legacy shared agent-state DB into the graph-owned enrichment JSONL.
- `bun run kg:curate -- --state-dir <state_dir>` rewrites curator enrichment
  records from worker reports and PR postmortems.
- `bun run kg:maintain -- --state-dir <state_dir> --repo-root <repo_root>` runs
  pending PR postmortem indexing, tool index generation, curator reduction, and
  graph rebuild.
- `bun run kg:rebuild -- --repo-root <repo_root>` rebuilds the v1 graph from
  all registered source slices, normalized tool outputs, and any available
  graph enrichments.
- `bun run kg:tool-indexes -- --repo-root <repo_root>` generates local JSONL
  indexes for the callable tool APIs.
- `bun run kg:smoke -- --strict` verifies every registered source has a graph
  version/search chunks and every registered tool API reports ready.
- `bun run kg:file-card -- --repo-root <repo_root> --source <source_path>`
  returns file graph context, editability, PR history, and rank signals.
- `bun run kg:search -- --repo-root <repo_root> --source past_prs --query <term>`
  searches indexed graph chunks.
- `bun run kg:rank-features -- --repo-root <repo_root>` shows graph-derived
  ranking features for board candidates.
- `python3 knowledge/sources/<source_id>/api/status.py --json` checks
  source-local index readiness for any registered source.
- `python3 knowledge/sources/<source_id>/api/search.py --query <term> --json`
  searches that source's generated JSONL indexes without going through a graph
  rebuild.
- `python3 knowledge/tools/<tool_id>/api/status.py --json` and each tool's
  lookup/search API provide direct CLI access to generated tool evidence.
- `bun run pr:refresh:dry` previews recent PR discovery.
- `bun run pr:refresh` refreshes missing PR slices and rebuilds deterministic
  searchable records.
- `bun run pr:refresh:all` refreshes the full PR corpus with 32 fetch workers
  and 32 PR-review workers.
- `bun run pr:postmortems -- --dump-root knowledge/sources/past_prs/data/current --run-agent`
  reruns model-reviewed PR records.
- `bun run pr:sync` syncs the local branch and PR library together.
- `bun run pr:sync:all` syncs the branch and then refreshes the full PR corpus
  with 32-way fetch/postmortem processing.

Bootstrap status, 2026-06-06:

- Full PR corpus fetched and model-reviewed: `2501 / 2501` PR postmortems are
  `agent_completed`.
- Registered source APIs and registered tool APIs have passing status/search
  smoke checks.
- `bun run kg:tool-indexes`, `bun run kg:rebuild -- --sources all`, and
  `bun run kg:smoke -- --strict` pass against the current graph.
