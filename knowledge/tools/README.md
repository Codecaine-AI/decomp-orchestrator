# Knowledge Tools

Callable external tool integrations live here. They are not nested under
`knowledge/resource_graph` because they are not the graph itself; the graph only
consumes their normalized cached outputs through the `tool_outputs` source.

Each tool keeps the same top-level shape:

```text
<tool_id>/
+-- tool.json
+-- README.md
+-- api/
|   +-- README.md
+-- runners/
|   +-- README.md
+-- cache/
|   +-- README.md
+-- indexes/
|   +-- README.md
+-- tests/
    +-- README.md
```

The v1 APIs are intentionally small CLI-style scripts. Optional tools may return
an empty JSON result set when their cache has not been generated yet.

Generated local indexes:

- `python3 knowledge/tools/build_tool_indexes.py --repo-root <repo_root>`
  creates JSONL indexes for every registered tool.
- `ghidra` currently gets a source-symbol/address fallback index from
  `build/GALE01/report.json`.
- `opseq` currently gets a report-based function-shape fallback index.
- `mismatch_db` and `mwcc_debug` get searchable chunks from the imported MWCC
  and mismatch reference docs.

These fallbacks make the CLI APIs operational without pretending they are full
live Ghidra/opcode/MWCC integrations. Richer tool-specific runners can replace
or augment the generated indexes later.
