#!/usr/bin/env python3
"""Render alignment residual sheets for V3 residual Pi image attachments."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


SAFE_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    return parser.parse_args()


def open_rgb(path: Path) -> Image.Image:
    with Image.open(path) as image:
        return ImageOps.exif_transpose(image).convert("RGB")


def thumbnail_panel(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    panel = Image.new("RGB", size, (246, 246, 244))
    thumb = image.copy()
    thumb.thumbnail(size, Image.Resampling.LANCZOS)
    panel.paste(thumb, ((size[0] - thumb.width) // 2, (size[1] - thumb.height) // 2))
    return panel


def resize_pair(left: Image.Image, right: Image.Image, audit_size: int) -> tuple[np.ndarray, np.ndarray]:
    width, height = left.size
    if right.size != left.size:
        width = min(width, right.size[0])
        height = min(height, right.size[1])
    if width <= 0 or height <= 0:
        width = height = audit_size
    scale = min(audit_size / max(width, height), 1.0)
    out_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    left_small = left.resize(out_size, Image.Resampling.LANCZOS)
    right_small = right.resize(out_size, Image.Resampling.LANCZOS)
    left_arr = np.asarray(left_small, dtype=np.float32) / 255.0
    right_arr = np.asarray(right_small, dtype=np.float32) / 255.0
    return left_arr, right_arr


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def align_luminance(reference: np.ndarray, target: np.ndarray) -> np.ndarray:
    ref_mean = float(reference.mean())
    target_mean = float(target.mean())
    ref_std = float(reference.std())
    target_std = float(target.std())
    if ref_std < 1e-5 or target_std < 1e-5:
        return np.clip(target - target_mean + ref_mean, 0.0, 1.0)
    return np.clip((target - target_mean) * (ref_std / target_std) + ref_mean, 0.0, 1.0)


def shifted_edge_magnitude(gray: np.ndarray) -> np.ndarray:
    padded = np.pad(gray, 1, mode="edge")
    center = padded[1:-1, 1:-1]
    dx = np.abs(padded[1:-1, 2:] - padded[1:-1, :-2])
    dy = np.abs(padded[2:, 1:-1] - padded[:-2, 1:-1])
    diagonal = 0.5 * (
        np.abs(padded[2:, 2:] - padded[:-2, :-2])
        + np.abs(padded[2:, :-2] - padded[:-2, 2:])
    )
    return np.maximum(np.maximum(dx, dy), np.maximum(diagonal, np.abs(center - gray.mean())))


def heatmap(values: np.ndarray, size: tuple[int, int], scale: float) -> Image.Image:
    clipped = np.clip(values / scale, 0.0, 1.0)
    red = (255 * clipped).astype(np.uint8)
    green = (255 * np.clip((clipped - 0.35) / 0.65, 0.0, 1.0)).astype(np.uint8)
    blue = (45 * (1.0 - clipped)).astype(np.uint8)
    rgb = np.stack([red, green, blue], axis=-1)
    return Image.fromarray(rgb, "RGB").resize(size, Image.Resampling.NEAREST)


def analyze_pair(pair: dict[str, Any], audit_size: int) -> dict[str, Any]:
    left_path = Path(str(pair.get("left_path", "")))
    right_path = Path(str(pair.get("right_path", "")))
    if not left_path.exists() or not right_path.exists():
        return {
            "ok": False,
            "missing": [str(path) for path in [left_path, right_path] if not path.exists()],
        }

    left = open_rgb(left_path)
    right = open_rgb(right_path)
    left_arr, right_arr = resize_pair(left, right, audit_size)
    left_gray = luminance(left_arr)
    right_gray = luminance(right_arr)
    right_aligned = align_luminance(left_gray, right_gray)
    diff = np.abs(left_gray - right_aligned)

    left_centered = left_gray - left_gray.mean()
    right_centered = right_aligned - right_aligned.mean()
    denom = float(np.sqrt(np.sum(left_centered**2) * np.sum(right_centered**2)))
    aligned_corr = float(np.sum(left_centered * right_centered) / denom) if denom > 1e-8 else 1.0

    left_edges = shifted_edge_magnitude(left_gray)
    right_edges = shifted_edge_magnitude(right_aligned)
    edge_diff = np.abs(left_edges - right_edges)

    return {
        "ok": True,
        "aligned_corr": aligned_corr,
        "mean_abs_diff": float(diff.mean()),
        "p95_abs_diff": float(np.percentile(diff, 95)),
        "p99_abs_diff": float(np.percentile(diff, 99)),
        "strong_diff_fraction": float(np.mean(diff > 0.18)),
        "edge_delta_fraction": float(np.mean(edge_diff > 0.16)),
        "left_preview": left,
        "right_preview": right,
        "diff_array": diff,
        "edge_diff_array": edge_diff,
    }


def risk_key(row: dict[str, Any]) -> tuple[float, float, float, float]:
    analysis = row.get("analysis") or {}
    if not analysis.get("ok"):
        return (0.0, 0.0, 0.0, 0.0)
    return (
        float(analysis.get("p99_abs_diff") or 0.0),
        float(analysis.get("edge_delta_fraction") or 0.0),
        float(analysis.get("strong_diff_fraction") or 0.0),
        1.0 - float(analysis.get("aligned_corr") or 1.0),
    )


def wrap_text(value: str, max_chars: int, max_lines: int) -> list[str]:
    clean = " ".join(str(value).split())
    if not clean:
        return [""]
    words = clean.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word[:max_chars]
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(clean) > len(" ".join(lines)):
        lines[-1] = lines[-1][: max(0, max_chars - 3)] + "..."
    return lines


def draw_text_lines(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    lines: list[str],
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
) -> int:
    x, y = xy
    line_height = 14
    if hasattr(font, "size"):
        line_height = int(getattr(font, "size")) + 3
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def render_sheet(manifest: dict[str, Any], rows: list[dict[str, Any]], output_path: Path) -> None:
    title_font = ImageFont.load_default()
    font = ImageFont.load_default()
    small_font = ImageFont.load_default()

    panel_w = int(manifest.get("panel_width") or 220)
    panel_h = int(manifest.get("panel_height") or 144)
    label_h = 58
    gap = 10
    margin = 16
    header_h = 122
    row_h = panel_h + label_h + gap
    sheet_pairs = max(1, int(manifest.get("sheet_pairs") or 10))
    selected = sorted(rows, key=risk_key, reverse=True)[:sheet_pairs]
    width = margin * 2 + panel_w * 4 + gap * 3
    height = header_h + margin + max(1, len(selected)) * row_h
    canvas = Image.new("RGB", (width, height), (248, 248, 246))
    draw = ImageDraw.Draw(canvas)

    object_id = str(manifest.get("object_id") or "")
    title = f"{object_id} alignment residuals"
    draw.text((margin, 14), title, font=title_font, fill=(18, 24, 28))
    draw.text(
        (margin, 36),
        "Luminance-normalized residuals expose small viewpoint, rotation, parallax, crop, and state shifts.",
        font=font,
        fill=(42, 50, 55),
    )
    draw.text(
        (margin, 56),
        "Red/yellow means larger mismatch after exposure alignment. Edge mismatch highlights shifted fixed geometry.",
        font=font,
        fill=(42, 50, 55),
    )
    draw.text((margin, 90), "Left", font=font, fill=(30, 30, 30))
    draw.text((margin + panel_w + gap, 90), "Right", font=font, fill=(30, 30, 30))
    draw.text((margin + (panel_w + gap) * 2, 90), "Aligned residual", font=font, fill=(30, 30, 30))
    draw.text((margin + (panel_w + gap) * 3, 90), "Edge mismatch", font=font, fill=(30, 30, 30))

    y = header_h
    for row in selected:
        pair = row.get("pair") or {}
        analysis = row.get("analysis") or {}
        x_left = margin
        x_right = margin + panel_w + gap
        x_diff = margin + (panel_w + gap) * 2
        x_edge = margin + (panel_w + gap) * 3

        if analysis.get("ok"):
            left_panel = thumbnail_panel(analysis["left_preview"], (panel_w, panel_h))
            right_panel = thumbnail_panel(analysis["right_preview"], (panel_w, panel_h))
            diff_panel = heatmap(analysis["diff_array"], (panel_w, panel_h), 0.35)
            edge_panel = heatmap(analysis["edge_diff_array"], (panel_w, panel_h), 0.22)
        else:
            left_panel = Image.new("RGB", (panel_w, panel_h), (235, 235, 232))
            right_panel = Image.new("RGB", (panel_w, panel_h), (235, 235, 232))
            diff_panel = Image.new("RGB", (panel_w, panel_h), (235, 235, 232))
            edge_panel = Image.new("RGB", (panel_w, panel_h), (235, 235, 232))
            tmp = ImageDraw.Draw(diff_panel)
            tmp.text((12, 62), "missing/load error", font=font, fill=(120, 30, 30))

        for x, panel in [(x_left, left_panel), (x_right, right_panel), (x_diff, diff_panel), (x_edge, edge_panel)]:
            canvas.paste(panel, (x, y))
            draw.rectangle((x, y, x + panel_w - 1, y + panel_h - 1), outline=(178, 178, 174))

        label_y = y + panel_h + 5
        left_label = str(pair.get("left_filename") or Path(str(pair.get("left_path") or "")).name)
        right_label = str(pair.get("right_filename") or Path(str(pair.get("right_path") or "")).name)
        relationship = str(pair.get("relationship") or "")
        draw_text_lines(draw, (x_left, label_y), wrap_text(left_label, 30, 2), small_font, (32, 35, 38))
        draw_text_lines(draw, (x_right, label_y), wrap_text(right_label, 30, 2), small_font, (32, 35, 38))
        if analysis.get("ok"):
            metric_text = (
                f"p99 {float(analysis.get('p99_abs_diff') or 0):.3f}  "
                f"strong {float(analysis.get('strong_diff_fraction') or 0):.4f}\n"
                f"corr {float(analysis.get('aligned_corr') or 0):.4f}  "
                f"edge {float(analysis.get('edge_delta_fraction') or 0):.4f}"
            )
        else:
            metric_text = "missing/load error"
        draw_text_lines(draw, (x_diff, label_y), metric_text.split("\n"), small_font, (32, 35, 38))
        draw_text_lines(draw, (x_edge, label_y), wrap_text(relationship, 30, 2), small_font, (32, 35, 38))
        y += row_h

    output_path.parent.mkdir(parents=True, exist_ok=True)
    suffix = output_path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        canvas.save(output_path, quality=90, optimize=True)
    elif suffix == ".png":
        canvas.save(output_path, optimize=True)
    else:
        canvas.save(output_path.with_suffix(".jpg"), quality=90, optimize=True)


def serializable_analysis(analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in analysis.items()
        if key not in {"left_preview", "right_preview", "diff_array", "edge_diff_array"}
    }


def main() -> None:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf8"))
    output_path = Path(str(manifest["output_path"]))
    audit_size = max(64, int(manifest.get("audit_size") or 320))
    rows = []
    for pair in manifest.get("pairs", []):
        analysis = analyze_pair(pair, audit_size)
        rows.append({"pair": pair, "analysis": analysis})

    if rows:
        render_sheet(manifest, rows, output_path)

    manifest["rendered"] = [
        {
            "pair": row["pair"],
            "analysis": serializable_analysis(row["analysis"]),
        }
        for row in rows
    ]
    manifest["output_exists"] = output_path.exists()
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
