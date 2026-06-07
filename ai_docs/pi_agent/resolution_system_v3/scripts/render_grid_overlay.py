#!/usr/bin/env python3
"""Render gray 3x3 grid overlays for V3 residual Pi image attachments."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    return parser.parse_args()


def draw_grid(source_path: Path, output_path: Path) -> dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    width, height = image.size
    line_width = max(2, min(width, height) // 350)
    draw = ImageDraw.Draw(image)
    fill = (128, 128, 128)
    for x in (width / 3, 2 * width / 3):
        xi = round(x)
        draw.line([(xi, 0), (xi, height)], fill=fill, width=line_width)
    for y in (height / 3, 2 * height / 3):
        yi = round(y)
        draw.line([(0, yi), (width, yi)], fill=fill, width=line_width)

    suffix = output_path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        image.save(output_path, quality=95, optimize=True)
    elif suffix == ".png":
        image.save(output_path, optimize=True)
    elif suffix == ".webp":
        image.save(output_path, quality=95, method=6)
    else:
        image.save(output_path.with_suffix(".jpg"), quality=95, optimize=True)

    return {
        "source_path": str(source_path),
        "output_path": str(output_path),
        "width": width,
        "height": height,
        "line_width": line_width,
    }


def main() -> None:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text())
    rendered = []
    failed = []
    for item in manifest.get("items", []):
        source_path = Path(item["source_path"])
        output_path = Path(item["output_path"])
        try:
            rendered.append(draw_grid(source_path, output_path))
        except Exception as exc:  # noqa: BLE001 - batch manifest should keep going.
            failed.append(
                {
                    "source_path": str(source_path),
                    "output_path": str(output_path),
                    "error": str(exc),
                }
            )

    args.manifest.write_text(
        json.dumps(
            {
                **manifest,
                "rendered": rendered,
                "failed": failed,
            },
            indent=2,
        )
        + "\n"
    )
    if failed:
        raise SystemExit(f"grid overlay failed for {len(failed)} image(s)")


if __name__ == "__main__":
    main()
