# Ghidra Tool

Cache-backed Ghidra lookup surface for xrefs, strings, names, and optional live
decompile results.

Current state: operational fallback. `build_tool_indexes.py` generates
`indexes/symbol_lookup.jsonl` from `build/GALE01/report.json`, so
`api/status.py` reports ready and `api/lookup.py` can answer symbol/address/file
queries. This is not a live Ghidra decompiler cache yet.

Reference material:

- `reference/SKILL.md`
