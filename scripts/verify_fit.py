#!/usr/bin/env python3
"""Verify a fitted-view render against its source image.

Usage: verify_fit.py <tile> <render_png>
Prints: silhouette IoU and mean color delta (5x5 grid over the mask).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def mask_of(img: Image.Image):
    px = np.asarray(img.convert("RGBA")).astype(int)
    a = px[..., 3]
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    bad = (a < 24) | ((mn > 225) & (mx - mn < 14)) | ((np.abs(r - 34) < 10) & (np.abs(g - 38) < 10) & (np.abs(b - 46) < 10))
    return ~bad, px[..., :3]


def crop(m, c):
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    return m[y0:y1 + 1, x0:x1 + 1], c[y0:y1 + 1, x0:x1 + 1]


def grid(m, c, n=5):
    H, W = m.shape
    out = []
    for gy in range(n):
        row = []
        for gx in range(n):
            sl = (slice(gy * H // n, (gy + 1) * H // n), slice(gx * W // n, (gx + 1) * W // n))
            cell = m[sl]
            row.append(c[sl][cell].mean(axis=0) if cell.sum() > 30 else None)
        out.append(row)
    return out


def main():
    tile, render_png = sys.argv[1], sys.argv[2]
    ms, cs = mask_of(Image.open(ROOT / "models" / f"{tile}.png"))
    mr, cr = mask_of(Image.open(render_png))
    mc_s, cc_s = crop(ms, cs)
    mc_r, cc_r = crop(mr, cr)
    th, tw = mc_s.shape
    mrz = np.asarray(Image.fromarray((mc_r * 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)) > 127
    crz = np.asarray(Image.fromarray(cc_r.astype(np.uint8)).resize((tw, th), Image.BILINEAR)).astype(int)
    iou = (mc_s & mrz).sum() / max((mc_s | mrz).sum(), 1)
    gs, gr = grid(mc_s, cc_s.astype(int)), grid(mrz, crz)
    deltas = [np.abs(gs[i][j] - gr[i][j]).mean() for i in range(5) for j in range(5)
              if gs[i][j] is not None and gr[i][j] is not None]
    delta = float(np.mean(deltas)) if deltas else float("nan")
    print(f"{tile}: IoU={iou:.2f} delta={delta:.1f} cells={len(deltas)}")
    print(f"JSON: {{\"tile\": \"{tile}\", \"iou\": {iou:.4f}, \"delta\": {delta:.2f}, \"cells\": {len(deltas)}}}")


if __name__ == "__main__":
    main()
