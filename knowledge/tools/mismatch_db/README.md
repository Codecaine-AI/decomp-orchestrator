# Mismatch DB Tool

Search surface for known assembly mismatch patterns, source-shape fixes, and
last-mile matching tactics.

Current state: operational. `build_tool_indexes.py` generates
`indexes/patterns.jsonl` from imported mismatch/MWCC reference docs, so
`api/status.py` reports ready and `api/search.py` returns local pattern notes.

Reference material:

- `reference/SKILL.md`
