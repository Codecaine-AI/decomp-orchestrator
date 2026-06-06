# MWCC Debug Tool

Lookup surface for cached MWCC pcdump output, compiler-pass summaries, and
last-mile compiler behavior notes.

Current state: operational. `build_tool_indexes.py` generates
`indexes/dumps.jsonl` from imported MWCC reference docs, so `api/status.py`
reports ready and `api/lookup_dump.py` returns local compiler-behavior notes.
This can later be augmented with real pcdump/cache output.

Reference material:

- `reference/SKILL.md`
- `reference/mwcc-inspect-SKILL.md`
- `knowledge/sources/reference_docs/data/docs/mwcc-debug.md`
