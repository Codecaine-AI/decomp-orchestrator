#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def load_index_rows(tool_root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted((tool_root / "indexes").glob("*.jsonl")):
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for line_number, line in enumerate(f, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(row, dict):
                    row.setdefault("index_path", str(path))
                    row.setdefault("index_line", line_number)
                    rows.append(row)
    return rows


def status_payload(tool: str, tool_root: Path, empty_message: str) -> dict[str, Any]:
    rows = load_index_rows(tool_root)
    return {
        "tool": tool,
        "available": bool(rows),
        "status": "ready" if rows else "scaffolded",
        "cache_path": str(tool_root / "cache"),
        "indexes_path": str(tool_root / "indexes"),
        "index_records": len(rows),
        "message": "Index is ready for local lookup." if rows else empty_message,
    }


def search_payload(tool: str, tool_root: Path, query: str, limit: int, empty_message: str) -> dict[str, Any]:
    rows = load_index_rows(tool_root)
    results = search_rows(rows, query, limit)
    return {
        "tool": tool,
        "query": query,
        "limit": limit,
        "available": bool(rows),
        "results": results,
        "cache_path": str(tool_root / "cache"),
        "indexes_path": str(tool_root / "indexes"),
        "message": "Index is ready for local lookup." if rows else empty_message,
    }


def search_rows(rows: list[dict[str, Any]], query: str, limit: int) -> list[dict[str, Any]]:
    terms = [term.lower() for term in re.findall(r"[A-Za-z0-9_./:-]+", query) if len(term) >= 2]
    phrase = query.lower().strip()
    scored: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        text = searchable_text(row).lower()
        score = 0
        if phrase and phrase in text:
            score += 10
        for term in terms:
            if term in text:
                score += 1
        if score <= 0:
            continue
        scored.append((score, row))
    scored.sort(key=lambda pair: (-pair[0], len(searchable_text(pair[1]))))
    return [format_result(row, score) for score, row in scored[:limit]]


def searchable_text(row: dict[str, Any]) -> str:
    return "\n".join(
        str(row.get(field) or "")
        for field in ("title", "symbol", "source_path", "unit", "address", "kind", "text", "summary", "evidence_ref")
    )


def format_result(row: dict[str, Any], score: int) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "title": row.get("title") or row.get("symbol") or row.get("id"),
        "score": score,
        "snippet": clip(str(row.get("text") or row.get("summary") or searchable_text(row)), 420),
        "evidence_ref": row.get("evidence_ref") or row.get("index_path"),
        "payload": row.get("payload") or {key: value for key, value in row.items() if key not in {"text"}},
    }


def clip(text: str, max_chars: int) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."
