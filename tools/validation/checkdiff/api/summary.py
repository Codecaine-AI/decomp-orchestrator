#!/usr/bin/env python3
"""Run tool-local checkdiff summary mode for one or more functions."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[3] / "_shared"))
from melee_tooling import clamp_int, print_json, resolve_repo_root, run_tool_script


def split_functions(values: list[str], joined: str | None) -> list[str]:
    """Normalize repeated and comma/space-separated function arguments."""

    raw = list(values)
    if joined:
        raw.extend(re.split(r"[\s,]+", joined))
    return [value.strip() for value in raw if value.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", help="Target Melee checkout root.")
    parser.add_argument("--function", action="append", default=[], help="Function symbol to include; may repeat.")
    parser.add_argument("--functions", help="Comma- or space-separated function symbols.")
    parser.add_argument("--timeout-seconds", type=int, default=240, help="Maximum runtime for the tool-local command.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    args = parser.parse_args()

    functions = split_functions(args.function, args.functions)
    if not functions:
        print_json({"status": "missing_function", "operation": "checkdiff:summary"})
        return

    repo_root = resolve_repo_root(args.repo_root)
    payload = run_tool_script(
        "checkdiff.py",
        ["--summary", *functions],
        repo_root=repo_root,
        operation="checkdiff:summary",
        timeout_seconds=clamp_int(args.timeout_seconds, default=240, minimum=10, maximum=1200),
    )
    payload["functions"] = functions
    print_json(payload)


if __name__ == "__main__":
    main()
