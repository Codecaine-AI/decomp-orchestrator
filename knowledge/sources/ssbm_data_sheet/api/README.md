# SSBM Data Sheet API

CLI-style worker access:

- `python3 knowledge/sources/ssbm_data_sheet/api/status.py --json`
- `python3 knowledge/sources/ssbm_data_sheet/api/search.py --query <query> --limit <n> --json`
- `python3 knowledge/sources/ssbm_data_sheet/api/lookup_address.py --address <hex> --limit <n> --json`
- `python3 knowledge/sources/ssbm_data_sheet/api/lookup_offset.py --type <type> --offset <hex> --limit <n> --json`

Results include sheet/source CSV paths, row/column context, evidence refs, and
payload rows. Treat data-sheet names as hints until local code and assembly
confirm them.
