# Discord Knowledge API

CLI-style worker access:

- `python3 knowledge/sources/discord_knowledge/api/status.py --json`
- `python3 knowledge/sources/discord_knowledge/api/search.py --query <query> --limit <n> --json`
- `python3 knowledge/sources/discord_knowledge/api/topics_for_terms.py --terms <terms> --limit <n> --json`

The source-local API searches generated chunk indexes and returns citations,
source paths, matched chunk IDs, and payload metadata. Broad graph search is
also available with `bun run kg:search -- --source discord_knowledge --query <query>`.
