#!/usr/bin/env python3
"""Verify a fitted-view render against its source image.

Usage: verify_fit.py <tile> <render_png>
Uniform-scale alignment (no square distortion): both masks are scaled to a
common area, centered on a common canvas, and compared. Prints silhouette IoU
and mean color delta over a 5x5 grid.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def mask_of(img: Image.Image, flat: bool = False):
    """flat=True: render is unlit over magenta -> mask = not-magenta.
    Source images: mask = not transparent and not near-white."""
    px = np.asarray(img.convert("RGBA")).astype(int)
    a = px[..., 3]
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    if flat:
        magenta = (r > 200) & (b > 200) & (g < 90)
        return ~magenta, px[..., :3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    bad = (a < 24) | ((mn > 225) & (mx - mn < 14))
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


def uniform_mask(src_mask: np.ndarray, target_area: int):
    m = Image.fromarray((src_mask * 255).astype(np.uint8))
    scale = float(np.sqrt(target_area / max(m.width * m.height, 1)))
    tw, th = max(1, round(m.width * scale)), max(1, round(m.height * scale))
    return np.asarray(m.resize((tw, th), Image.BILINEAR)) > 127


def uniform_color(src_color: np.ndarray, size):
    return np.asarray(Image.fromarray(src_color.astype(np.uint8)).resize(size, Image.BILINEAR)).astype(int)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    tile, render_png = args[0], args[1]
    flat = "--flat" in sys.argv
    ms, cs = mask_of(Image.open(ROOT / "models" / f"{tile}.png"))
    mr, cr = mask_of(Image.open(render_png), flat=flat)
    mc_s, cc_s = crop(ms, cs)
    mc_r, cc_r = crop(mr, cr)

    # uniform-scale alignment: match areas, center both on a common canvas
    area = int((mc_s.sum() + mc_r.sum()) // 2)
    ma = uniform_mask(mc_s, area)
    mb = uniform_mask(mc_r, area)
    H = max(ma.shape[0], mb.shape[0]) + 8
    W = max(ma.shape[1], mb.shape[1]) + 8

    ca = np.zeros((H, W, 3), dtype=int)
    cb = np.zeros((H, W, 3), dtype=int)

    ay, ax = (H - ma.shape[0]) // 2, (W - ma.shape[1]) // 2
    by, bx = (H - mb.shape[0]) // 2, (W - mb.shape[1]) // 2
    ma_c = np.zeros((H, W), dtype=bool)
    mb_c = np.zeros((H, W), dtype=bool)
    ma_c[ay:ay + ma.shape[0], ax:ax + ma.shape[1]] = ma
    mb_c[by:by + mb.shape[0], bx:bx + mb.shape[1]] = mb
    ca[ay:ay + ma.shape[0], ax:ax + ma.shape[1]] = uniform_color(cc_s, (ma.shape[1], ma.shape[0]))
    cb[by:by + mb.shape[0], bx:bx + mb.shape[1]] = uniform_color(cc_r, (mb.shape[1], mb.shape[0]))

    iou = (ma_c & mb_c).sum() / max((ma_c | mb_c).sum(), 1)
    gs, gr = grid(ma_c, ca), grid(mb_c, cb)
    both = ma_c & mb_c
    gb_a, gb_b = grid(both, ca), grid(both, cb)
    deltas = [np.abs(gb_a[i][j] - gb_b[i][j]).mean() for i in range(5) for j in range(5)
              if gb_a[i][j] is not None and gb_b[i][j] is not None]
    delta = float(np.mean(deltas)) if deltas else float("nan")
    print(f"{tile}: IoU={iou:.2f} delta={delta:.1f} cells={len(deltas)}")
    print(f'JSON: {{"tile": "{tile}", "iou": {iou:.4f}, "delta": {delta:.2f}, "cells": {len(deltas)}}}')


if __name__ == "__main__":
    main()
