# PowerPC Documents API

CLI-style worker access:

- `python3 knowledge/sources/powerpc_docs/api/status.py --json`
- `python3 knowledge/sources/powerpc_docs/api/search.py --query <query> --limit <n> --json`
- `python3 knowledge/sources/powerpc_docs/api/lookup_instruction.py --mnemonic <mnemonic> --limit <n> --json`

Results cite document IDs, page refs, generated chunk IDs, and PDF/page
metadata where available.
