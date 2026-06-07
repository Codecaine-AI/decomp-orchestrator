# Ghidra API

CLI-style worker access:

- `python3 knowledge/tools/ghidra/api/status.py --json`
- `python3 knowledge/tools/ghidra/api/lookup.py --query <query> --limit <n> --json`

The lookup API should prefer cached indexes. Live Ghidra calls belong in
`runners/` and should only run when explicitly requested by a worker or operator.
