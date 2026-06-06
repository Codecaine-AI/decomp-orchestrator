# Resource Guides API

CLI-style worker access:

- `python3 knowledge/sources/resource_guides/api/status.py --json`
- `python3 knowledge/sources/resource_guides/api/search.py --query <query> --limit <n> --json`

Workers can still read `data/index.md` directly when they need the full guide,
but the source-local API provides quick indexed lookups.
