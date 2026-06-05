#!/usr/bin/env python3
"""Organize a PR dump into one vertical slice folder per PR."""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import filecmp
import json
import re
import shutil
from pathlib import Path


RAW_FILE_MAP = {
    "pr": "pr.json",
    "issue_comments": "issue_comments.json",
    "review_comments": "review_comments.json",
    "reviews": "reviews.json",
}

JSONL_ANALYSIS_FILES = {
    "analysis/text_corpus.jsonl": "text_corpus.jsonl",
    "analysis/changed_files.jsonl": "changed_files.jsonl",
    "analysis/diff_lines.jsonl": "diff_lines.jsonl",
}

JSON_ARRAY_FILES = {
    "analysis/per_pr_activity.json": ("pr", "activity.json"),
    "pr_counts.json": ("number", "counts.json"),
}

MARKDOWN_ANALYSIS_FILES = {
    "analysis/human_pr_text.md": "human_pr_text.md",
    "analysis/review_comments.md": "review_comments.md",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Reorganize a PR dump into prs/pr-NNNN vertical slice folders."
        )
    )
    parser.add_argument("dump_root", type=Path)
    parser.add_argument("--prs-dir", default="prs")
    parser.add_argument(
        "--old-days-dir",
        default="days",
        help="Existing day-bucketed slice tree to migrate away from.",
    )
    parser.add_argument(
        "--keep-flat",
        action="store_true",
        help="Copy raw/diff files into slices instead of moving them.",
    )
    parser.add_argument(
        "--keep-empty-diff-errors",
        action="store_true",
        help="Keep empty .diff.err files as empty diff.err files in PR folders.",
    )
    return parser.parse_args()


def read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def pr_number(pr: dict) -> int:
    return int(pr.get("number") or pr.get("pr"))


def created_day(pr: dict) -> str:
    created = pr.get("createdAt") or pr.get("created_at")
    if not created:
        return "unknown-date"
    return created[:10]


def pr_dir(dump_root: Path, prs_dir: str, pr: dict) -> Path:
    return dump_root / prs_dir / f"pr-{pr_number(pr)}"


def same_file(src: Path, dest: Path) -> bool:
    return dest.exists() and filecmp.cmp(src, dest, shallow=False)


def place_file(src: Path, dest: Path, keep_flat: bool) -> bool:
    if not src.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    if same_file(src, dest):
        if not keep_flat:
            src.unlink()
        return True
    if dest.exists():
        dest.unlink()
    if keep_flat:
        shutil.copy2(src, dest)
    else:
        shutil.move(str(src), str(dest))
    return True


def move_tree_contents(src_dir: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for child in src_dir.iterdir():
        dest = dest_dir / child.name
        if child.is_dir():
            move_tree_contents(child, dest)
            if not any(child.iterdir()):
                child.rmdir()
            continue
        if same_file(child, dest):
            child.unlink()
            continue
        if dest.exists():
            dest.unlink()
        shutil.move(str(child), str(dest))


def remove_empty_tree(path: Path) -> None:
    if not path.exists() or not path.is_dir():
        return
    for child in sorted(path.iterdir(), key=lambda p: len(p.parts), reverse=True):
        if child.is_dir():
            remove_empty_tree(child)
    if not any(path.iterdir()):
        path.rmdir()


def migrate_day_slices(dump_root: Path, old_days_dir: str, prs_dir: str, prs: list[dict]) -> int:
    old_root = dump_root / old_days_dir
    if not old_root.exists():
        return 0

    migrated = 0
    for pr in prs:
        source = old_root / created_day(pr) / f"pr-{pr_number(pr)}"
        if not source.exists():
            continue
        move_tree_contents(source, pr_dir(dump_root, prs_dir, pr))
        if not any(source.iterdir()):
            source.rmdir()
        migrated += 1

    remove_empty_tree(old_root)
    return migrated


def place_raw_and_diffs(
    dump_root: Path,
    prs: list[dict],
    prs_dir: str,
    keep_flat: bool,
    keep_empty_diff_errors: bool,
) -> dict[str, int]:
    stats = collections.Counter()
    for pr in prs:
        number = pr_number(pr)
        dest_dir = pr_dir(dump_root, prs_dir, pr)

        for kind, dest_name in RAW_FILE_MAP.items():
            src = dump_root / "raw" / f"{number}_{kind}.json"
            dest = dest_dir / dest_name
            if place_file(src, dest, keep_flat) or dest.exists():
                stats["raw_files"] += 1

        diff_src = dump_root / "diffs" / f"{number}.diff"
        diff_dest = dest_dir / "diff.diff"
        if place_file(diff_src, diff_dest, keep_flat) or diff_dest.exists():
            stats["diff_files"] += 1

        err_src = dump_root / "diffs" / f"{number}.diff.err"
        err_dest = dest_dir / "diff.err"
        if err_src.exists():
            if err_src.stat().st_size > 0 or keep_empty_diff_errors:
                if place_file(err_src, err_dest, keep_flat):
                    stats["diff_error_files"] += 1
            elif not keep_flat:
                err_src.unlink()
                stats["empty_diff_error_files_dropped"] += 1
        elif err_dest.exists():
            stats["diff_error_files"] += 1

    return dict(stats)


def split_jsonl_by_pr(dump_root: Path, prs_by_number: dict[int, dict], prs_dir: str) -> dict[str, int]:
    stats = collections.Counter()
    for source_rel, dest_name in JSONL_ANALYSIS_FILES.items():
        source = dump_root / source_rel
        if not source.exists():
            continue

        lines_by_pr: dict[int, list[str]] = collections.defaultdict(list)
        with source.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                record = json.loads(line)
                number = int(record["pr"])
                lines_by_pr[number].append(line)

        for number, lines in lines_by_pr.items():
            pr = prs_by_number.get(number)
            if not pr:
                continue
            write_text(pr_dir(dump_root, prs_dir, pr) / dest_name, "".join(lines))
            stats[dest_name] += 1

    return dict(stats)


def split_json_arrays_by_pr(
    dump_root: Path, prs_by_number: dict[int, dict], prs_dir: str
) -> dict[str, int]:
    stats = collections.Counter()
    for source_rel, (number_key, dest_name) in JSON_ARRAY_FILES.items():
        source = dump_root / source_rel
        records = read_json(source, [])
        if not isinstance(records, list):
            continue

        for record in records:
            number = int(record[number_key])
            pr = prs_by_number.get(number)
            if not pr:
                continue
            write_json(pr_dir(dump_root, prs_dir, pr) / dest_name, record)
            stats[dest_name] += 1

    return dict(stats)


def split_markdown_by_pr(
    dump_root: Path, prs_by_number: dict[int, dict], prs_dir: str
) -> dict[str, int]:
    stats = collections.Counter()
    heading = re.compile(r"^## PR #(?P<number>\d+):.*?(?=^## PR #\d+:|\Z)", re.M | re.S)
    for source_rel, dest_name in MARKDOWN_ANALYSIS_FILES.items():
        source = dump_root / source_rel
        if not source.exists():
            continue

        blocks_by_pr: dict[int, list[str]] = collections.defaultdict(list)
        text = source.read_text(encoding="utf-8")
        for match in heading.finditer(text):
            number = int(match.group("number"))
            block = match.group(0).rstrip() + "\n"
            blocks_by_pr[number].append(block)

        for number, blocks in blocks_by_pr.items():
            pr = prs_by_number.get(number)
            if not pr:
                continue
            write_text(pr_dir(dump_root, prs_dir, pr) / dest_name, "\n".join(blocks))
            stats[dest_name] += 1

    return dict(stats)


def remove_empty_flat_dirs(dump_root: Path) -> None:
    for dirname in ("raw", "diffs"):
        path = dump_root / dirname
        if path.exists() and path.is_dir() and not any(path.iterdir()):
            path.rmdir()


def build_slice_index(dump_root: Path, prs: list[dict], prs_dir: str) -> list[dict]:
    index = []
    for pr in prs:
        dest = pr_dir(dump_root, prs_dir, pr)
        index.append(
            {
                "number": pr_number(pr),
                "created_day": created_day(pr),
                "title": pr.get("title"),
                "state": pr.get("state"),
                "author": (pr.get("author") or {}).get("login")
                if isinstance(pr.get("author"), dict)
                else pr.get("author"),
                "url": pr.get("url") or pr.get("html_url"),
                "path": str(dest.relative_to(dump_root)),
            }
        )
    return index


def update_manifest(dump_root: Path, prs_dir: str, slice_index: list[dict]) -> None:
    manifest_path = dump_root / "manifest.json"
    manifest = read_json(manifest_path, {})
    manifest["organized_at"] = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()
    manifest["layout"] = {
        "name": "pr_vertical_slices_v1",
        "created_day_source": "GitHub PR createdAt/created_at date in UTC",
        "pr_dir_template": f"{prs_dir}/pr-NNNN",
        "files_per_pr": [
            "pr.json",
            "issue_comments.json",
            "review_comments.json",
            "reviews.json",
            "diff.diff",
            "counts.json",
            "activity.json",
            "text_corpus.jsonl",
            "changed_files.jsonl",
            "diff_lines.jsonl",
            "human_pr_text.md",
            "review_comments.md",
        ],
    }
    manifest["files"] = {
        "index": "prs.json",
        "per_pr_counts": "pr_counts.json",
        "aggregate_analysis_dir": "analysis",
        "prs_dir": prs_dir,
        "vertical_slice_index": "vertical_slice_index.json",
    }
    manifest.pop("day_count", None)
    manifest["created_day_count"] = len({entry["created_day"] for entry in slice_index})
    write_json(manifest_path, manifest)


def update_summary(dump_root: Path, prs_dir: str, slice_index: list[dict], stats: dict) -> None:
    summary_path = dump_root / "summary.json"
    summary = read_json(summary_path, {})
    summary.setdefault("files", {})
    summary["files"].pop("days_dir", None)
    summary["files"].update(
        {
            "prs_dir": prs_dir,
            "vertical_slice_index": "vertical_slice_index.json",
            "vertical_slice_pr_dirs": len(slice_index),
            "aggregate_analysis_dir": "analysis",
        }
    )
    summary["layout"] = "pr_vertical_slices_v1"
    summary["created_day_count"] = len({entry["created_day"] for entry in slice_index})
    summary["organization_stats"] = stats
    write_json(summary_path, summary)


def main() -> int:
    args = parse_args()
    dump_root = args.dump_root
    prs = read_json(dump_root / "prs.json", [])
    if not isinstance(prs, list) or not prs:
        raise SystemExit(f"No PR index found at {dump_root / 'prs.json'}")

    prs_by_number = {pr_number(pr): pr for pr in prs}
    for pr in prs:
        pr_dir(dump_root, args.prs_dir, pr).mkdir(parents=True, exist_ok=True)

    stats = {}
    stats["migrated_day_slice_dirs"] = migrate_day_slices(
        dump_root, args.old_days_dir, args.prs_dir, prs
    )
    stats.update(
        place_raw_and_diffs(
            dump_root,
            prs,
            args.prs_dir,
            args.keep_flat,
            args.keep_empty_diff_errors,
        )
    )
    stats.update(split_jsonl_by_pr(dump_root, prs_by_number, args.prs_dir))
    stats.update(split_json_arrays_by_pr(dump_root, prs_by_number, args.prs_dir))
    stats.update(split_markdown_by_pr(dump_root, prs_by_number, args.prs_dir))

    slice_index = build_slice_index(dump_root, prs, args.prs_dir)
    write_json(dump_root / "vertical_slice_index.json", slice_index)
    update_manifest(dump_root, args.prs_dir, slice_index)
    update_summary(dump_root, args.prs_dir, slice_index, stats)

    if not args.keep_flat:
        remove_empty_flat_dirs(dump_root)

    print(
        f"organized {len(slice_index)} PRs into {dump_root / args.prs_dir} "
        f"({len({entry['created_day'] for entry in slice_index})} created dates in index)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
