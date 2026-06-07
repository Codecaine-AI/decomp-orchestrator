# Reference Docs API

CLI-style worker access:

- `python3 knowledge/sources/reference_docs/api/status.py --json`
- `python3 knowledge/sources/reference_docs/api/search.py --query <query> --limit <n> --json`

This source is optional context, but its generated index is searchable and
worker-callable when a target needs legacy notes, imported docs, or skill text.
