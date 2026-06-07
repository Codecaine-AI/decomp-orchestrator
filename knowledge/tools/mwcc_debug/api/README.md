# MWCC Debug API

CLI-style worker access:

- `python3 knowledge/tools/mwcc_debug/api/status.py --json`
- `python3 knowledge/tools/mwcc_debug/api/lookup_dump.py --query <query> --limit <n> --json`

This API should read cached dump/index files. Expensive compiler experiments
belong in `runners/` and should be explicit.
