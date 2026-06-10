#!/usr/bin/env python3
"""Run tool-local checkdiff for one function and return bounded structured output."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[3] / "_shared"))
from melee_tooling import clamp_int, print_json, resolve_repo_root, run_tool_script


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", help="Target Melee checkout root.")
    parser.add_argument("--function", required=True, help="Function symbol to diff.")
    parser.add_argument("--full-diff", action="store_true", help="Keep matching lines instead of collapsed context.")
    parser.add_argument("--timeout-seconds", type=int, default=180, help="Maximum runtime for the tool-local command.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    args = parser.parse_args()

    command_args: list[str] = []
    if args.full_diff:
        command_args.append("--full-diff")
    command_args.append(args.function)

    repo_root = resolve_repo_root(args.repo_root)
    payload = run_tool_script(
        "checkdiff.py",
        command_args,
        repo_root=repo_root,
        operation="checkdiff:run",
        timeout_seconds=clamp_int(args.timeout_seconds, default=180, minimum=10, maximum=900),
    )
    payload["function"] = args.function
    payload["full_diff"] = bool(args.full_diff)
    print_json(payload)


if __name__ == "__main__":
    main()
