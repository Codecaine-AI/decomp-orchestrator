# Tool Outputs API

CLI-style worker access:

- `python3 knowledge/sources/tool_outputs/api/status.py --json`
- `python3 knowledge/sources/tool_outputs/api/search.py --query <query> --limit <n> --json`
- `python3 knowledge/sources/tool_outputs/api/tool_lookup.py --tool <id> --query <query> --limit <n> --json`
- `python3 knowledge/sources/tool_outputs/api/similar_functions.py --query <query> --limit <n> --json`
- `python3 knowledge/sources/tool_outputs/api/mismatch_patterns.py --query <query> --limit <n> --json`

Workers may also call individual tool APIs directly under `knowledge/tools`
when a graph card or target-specific question justifies a narrower lookup.
