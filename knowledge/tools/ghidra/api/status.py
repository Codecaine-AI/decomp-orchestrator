#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[2] / "_shared"))
from search_index import status_payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Report Ghidra tool cache status.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    parser.parse_args()

    tool_root = Path(__file__).resolve().parents[1]
    payload = status_payload("ghidra", tool_root, "No Ghidra cache has been generated yet.")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
