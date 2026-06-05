# Past PR Library

Searchable decomp-orchestrator library generated from `decomp-orchestrator/knowledge/past_prs` PR slices.

Important files:

- `index.csv`: spreadsheet-friendly index of every processed PR.
- `index.jsonl`: one JSON record per processed PR for script/RAG ingestion.
- `known_fixes.md`: compact human-readable rollup.
- `pr-NNNN/postmortem.json`: structured per-PR knowledge record.

Shared Pi instructions live in `../agent/`; per-PR folders intentionally only store JSON records.

Records with `agent_status=scaffolded_without_agent` are deterministic drafts. Rerun with `--run-agent --rerun-existing --jobs 16` for model-reviewed JSON records.
