#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[2] / "_shared"))
from search_index import search_payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Lookup cached Ghidra evidence.")
    parser.add_argument("--query", required=True, help="Symbol, address, string, or file query.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum number of results.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    args = parser.parse_args()

    tool_root = Path(__file__).resolve().parents[1]
    payload = search_payload(
        "ghidra",
        tool_root,
        args.query,
        args.limit,
        "Ghidra lookup is scaffolded; add generated cache/index files before expecting results.",
    )
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
