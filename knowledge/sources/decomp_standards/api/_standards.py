#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def source_root() -> Path:
    return Path(__file__).resolve().parents[1]


def package_root() -> Path:
    return source_root().parents[2]


def descriptor() -> dict[str, Any]:
    return json.loads((source_root() / "source.json").read_text(encoding="utf-8"))


def data_path() -> Path:
    return source_root() / "data" / "standards.jsonl"


def index_path() -> Path:
    return source_root() / "indexes" / "standards.jsonl"


def enrichment_path() -> Path:
    return package_root() / "knowledge" / "resource_graph" / "enrichments" / "knowledge_curator_updates.jsonl"


def load_records() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    path = data_path()
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def record_text(record: dict[str, Any]) -> str:
    parts = [
        record.get("id"),
        record.get("title"),
        record.get("summary"),
        record.get("do"),
        record.get("do_not"),
        record.get("evidence_refs"),
    ]
    return json.dumps(parts, sort_keys=True)


def search_records(query: str, limit: int) -> list[dict[str, Any]]:
    terms = [term.lower() for term in re.findall(r"[A-Za-z0-9_./:-]+", query) if len(term) >= 2]
    phrase = query.lower().strip()
    hits: list[tuple[int, dict[str, Any]]] = []
    for record in load_records():
        text = record_text(record).lower()
        score = 0
        if phrase and phrase in text:
            score += 10
        score += sum(1 for term in terms if term in text)
        if score > 0:
            hits.append((score, record))
    hits.sort(key=lambda item: (-item[0], str(item[1].get("id"))))
    return [format_hit(record, score) for score, record in hits[: max(0, limit)]]


def format_hit(record: dict[str, Any], score: int) -> dict[str, Any]:
    return {
        "id": record.get("id"),
        "title": record.get("title"),
        "score": score,
        "snippet": clip(str(record.get("summary", ""))),
        "evidence_refs": record.get("evidence_refs", []),
        "payload": record,
    }


def proposal_records() -> list[dict[str, Any]]:
    path = enrichment_path()
    if not path.exists():
        return []
    proposals: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        payload = row.get("payload")
        if not isinstance(payload, dict):
            continue
        if payload.get("target_source_id") == "decomp_standards" or payload.get("update_kind") == "global_standard":
            proposals.append(row)
    return proposals


def status_payload() -> dict[str, Any]:
    records = load_records()
    proposals = proposal_records()
    return {
        "source": "decomp_standards",
        "title": descriptor().get("title"),
        "status": "ready" if records else "missing_records",
        "available": bool(records),
        "standard_count": len(records),
        "accepted_standard_count": sum(1 for record in records if record.get("status") == "accepted"),
        "data_path": str(data_path()),
        "index_path": str(index_path()),
        "index_ready": index_path().exists(),
        "index_records": count_jsonl(index_path()),
        "proposal_count": len(proposals),
        "proposal_target_source_id": "decomp_standards",
        "supported_update_kinds": ["global_standard"],
        "mutation_policy": "proposal_only_until_validated",
    }


def write_index() -> dict[str, Any]:
    rows = []
    for record in load_records():
        rows.append(
            {
                "id": record.get("id"),
                "source_id": "decomp_standards",
                "title": record.get("title"),
                "text": "\n".join(
                    [
                        str(record.get("title", "")),
                        str(record.get("summary", "")),
                        " ".join(record.get("do", [])),
                        " ".join(record.get("do_not", [])),
                    ]
                ),
                "evidence_ref": ";".join(record.get("evidence_refs", [])),
                "payload": record,
            }
        )
    index_path().parent.mkdir(parents=True, exist_ok=True)
    index_path().write_text("".join(f"{json.dumps(row, sort_keys=True)}\n" for row in rows), encoding="utf-8")
    return {"index_path": str(index_path()), "records_written": len(rows)}


def count_jsonl(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip())


def clip(text: str, limit: int = 420) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3].rstrip() + "..."


def print_json(payload: dict[str, Any], as_json: bool) -> None:
    if as_json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(json.dumps(payload, indent=2, sort_keys=True))


def json_flag_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    return parser

