# Opseq Tool

Opcode sequence lookup surface for finding similar matched and unmatched
functions by instruction patterns.

Current state: operational fallback. `build_tool_indexes.py` generates
`indexes/function_shapes.jsonl` from `build/GALE01/report.json`, so
`api/status.py` reports ready and `api/similar_functions.py` can answer
function/source/size-shape queries. This is not a true opcode-sequence index yet.

Reference material:

- `reference/SKILL.md`
