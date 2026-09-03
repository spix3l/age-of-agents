#!/usr/bin/env python3
"""Re-cut a per-model crop from the asset sheet with a margin and derived alpha.

`art/extract_models.py` tightens every crop to the ink, which is right for the
Model Lab but defeats `check_reference_admission.py`: with the subject filling
99% of the frame there is no background to segment against and the reference is
rejected. The pipeline needs surrounding background.

The sheet's backdrop is near-black and the glowing resources bleed a saturated
halo into it, so `build_foreground_mask`'s colour rule (`sat > 0.16` ⇒
foreground) can never find a margin there. This script therefore re-cuts the
SAME box from `art/reference/asset-sheet.png`, grown by a margin, and writes
`art/img2threejs/<model>/reference.png` as RGBA with the background made
transparent: alpha is derived by flood-filling from the frame edges through
strictly neutral dark pixels (the backdrop and nothing else — the RGB channels
are never touched). Downstream, `build_foreground_mask` takes its alpha path
(`transparent_fraction > 0.03` ⇒ mask = alpha > 24) and segments cleanly.

Usage: python3 art/img2threejs/heroes/pad_references.py [names...]
"""
from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SHEET = ROOT / "art" / "reference" / "asset-sheet.png"
MANIFEST = ROOT / "art" / "models.json"

# A margin of 18% of the box's larger side; minimum 12 px so the mask always
# sees a real border of backdrop. The sheet's panels sit far enough apart that
# 18% of a ~150 px box stays clear of neighbouring art in most bands.
MARGIN_FRACTION = 0.18
MIN_MARGIN = 12

# A pixel the edge flood may pass through: dark (luma ≤ 0.16*255) AND near-neutral
# (max-min ≤ max(14, 16% of max)). The relative term alone rejects the backdrop
# itself — at (0,4,6) the blue channel dwarfs red, reading as "saturated" — so a
# small absolute chroma floor is required for near-black pixels.
NEUTRAL_ABS_CHROMA = 14.0
NEUTRAL_MAX_CHROMA = 0.16
BACKDROP_MAX_LUMA = 0.16 * 255


def derive_alpha(rgb: np.ndarray) -> np.ndarray:
    """Flood from the frame edges through neutral dark pixels; everything the
    flood reaches is backdrop (alpha 0), everything else stays opaque."""
    h, w, _ = rgb.shape
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    passable = (luma <= BACKDROP_MAX_LUMA) & ((mx - mn) <= np.maximum(NEUTRAL_ABS_CHROMA, NEUTRAL_MAX_CHROMA * mx))
    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))
    alpha = np.where(visited, 0, 255).astype(np.uint8)
    return alpha


def main() -> None:
    names = set(sys.argv[1:])
    sheet = Image.open(SHEET).convert("RGB")
    entries = json.loads(MANIFEST.read_text())
    made = []
    for entry in entries:
        name = entry["name"]
        if names and name not in names:
            continue
        x0, y0, x1, y1 = entry["box"]
        w, h = x1 - x0, y1 - y0
        margin = max(MIN_MARGIN, round(max(w, h) * MARGIN_FRACTION))
        px0, py0 = max(0, x0 - margin), max(0, y0 - margin)
        px1, py1 = min(sheet.width, x1 + margin), min(sheet.height, y1 + margin)
        out_dir = ROOT / "art" / "img2threejs" / name
        out_dir.mkdir(parents=True, exist_ok=True)
        crop = sheet.crop((px0, py0, px1, py1))
        # If clamping ate the margin on any side, re-pad with the backdrop colour
        # so the subject never touches the frame edge.
        if (x0 - margin < 0) or (y0 - margin < 0) or (x1 + margin > sheet.width) or (y1 + margin > sheet.height):
            backdrop = crop.getpixel((1, 1))
            canvas = Image.new("RGB", (px1 - px0 + 40, py1 - py0 + 40), backdrop)
            canvas.paste(crop, (20, 20))
            crop = canvas
        rgba = np.asarray(crop.convert("RGB"), dtype=np.float64)
        alpha = derive_alpha(rgba)
        out = np.dstack([rgba.astype(np.uint8), alpha])
        Image.fromarray(out, "RGBA").save(out_dir / "reference.png")
        opaque = float((alpha > 24).mean())
        made.append(f"{name}: {crop.width}x{crop.height} margin {margin}px opaque {opaque:.3f}")
    print("\n".join(made) if made else "no matching models")


if __name__ == "__main__":
    main()
