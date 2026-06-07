# Knowledge Sources

Shallow vertical slices for source corpora that can be indexed, searched, and
emitted into the shared resource graph.

Each source keeps the same top-level shape:

```text
<source_id>/
+-- source.json
+-- README.md
+-- data/
|   +-- README.md
+-- indexes/
|   +-- README.md
+-- api/
|   +-- README.md
|   +-- status.py
|   +-- search.py
+-- commands/
|   +-- README.md
+-- tests/
    +-- README.md
```

`data/` is the canonical home for that source's corpus. Generated indexes stay
in `indexes/`; source-local maintenance scripts stay in `commands/`; and
worker-facing lookup notes or scripts stay in `api/`.

Every registered source has a source-local status/search CLI backed by generated
JSONL indexes:

```bash
python3 knowledge/sources/<source_id>/api/status.py --json
python3 knowledge/sources/<source_id>/api/search.py --query "<term>" --limit 10 --json
```

Some sources also expose lightweight lookup aliases, such as
`ssbm_data_sheet/api/lookup_address.py`,
`powerpc_docs/api/lookup_instruction.py`, and
`external_mirrors/api/lookup_external_symbol.py`. These CLIs are intentionally
thin; graph-wide search remains available through `bun run kg:search`.

The normal graph rebuild now materializes the declared `indexes/*.jsonl` outputs
for every registered source. Use `bun run kg:rebuild -- --sources all` followed
by `bun run kg:smoke -- --strict` to verify the data layer after source changes.

Current corpus locations:

| Source | Primary data paths |
| --- | --- |
| `code_graph` | Current checkout paths under the worker repo root, such as `src/`, symbols, splits, objdiff, and report artifacts. |
| `past_prs` | `knowledge/sources/past_prs/data/current` and `knowledge/sources/past_prs/data/prs`. |
| `discord_knowledge` | `knowledge/sources/discord_knowledge/data/docs` and Discord-related reference docs/skills. |
| `ssbm_data_sheet` | `knowledge/sources/ssbm_data_sheet/data`. |
| `powerpc_docs` | `knowledge/sources/powerpc_docs/data`. |
| `external_mirrors` | `knowledge/sources/external_mirrors/data`. |
| `resource_guides` | `knowledge/sources/resource_guides/data`. |
| `reference_docs` | `knowledge/sources/reference_docs/data`. |
| `tool_outputs` | `knowledge/tools` caches and generated tool indexes. |

Full PR corpus refresh:

```bash
bun run pr:refresh:all
```

This discovers the whole `doldecomp/melee` PR corpus, fetches missing raw PR
slices with 32 workers, and runs missing model-reviewed PR postmortems with 32
workers. If GitHub rate limits the fetch, rerun the same command after reset;
completed PR slices are skipped.

Current bootstrap status, 2026-06-06: the full PR corpus is fetched and
model-reviewed postmortems are complete for `2501 / 2501` discovered PRs. The
resource graph and strict source/tool smoke checks have been rebuilt and pass.
