#!/usr/bin/env python3
"""Deterministic crop analysis for the hero-model pipeline.

This session has no agent vision, so this script is the eyes: it segments the
crop from its sheet background, then reports everything needed to author a
sculpt spec without guessing:

- silhouette: aspect, per-row width profile (taper curve), left/right symmetry
- structure bands: horizontal runs of similar colour -> stacked tiers, and
  within-band column clustering -> repeated elements (pods, legs, barrels)
- palette: dominant colour clusters in HSV, with a de-lit albedo estimate
  (the sheet is lit with one soft key from upper-left; the de-lit factor
  removes an estimated shading multiplier per pixel luminance percentile)
- emissive: saturated/bright pixels far above the neutral cluster set, with
  their pixel bounding boxes so light strips can be placed in 3D

Output: one JSON per crop in art/img2threejs/<model>/analysis.json plus a
readable analysis.md. Pure stdlib + PIL + numpy.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]  # repo root (art/img2threejs/heroes/..)
MODELS_DIR = ROOT / "art" / "models"

# Sheet background: near-white paper. Everything within 12% of it is background.
BG_LUMA = 235.0
BG_TOL = 42.0


def load_crop(name: str) -> np.ndarray:
    img = Image.open(MODELS_DIR / f"{name}.png").convert("RGB")
    return np.asarray(img, dtype=np.float64)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    """Pixels that are not sheet paper. Also drops the near-white specular blobs."""
    luma = rgb.mean(axis=2)
    return np.abs(luma - BG_LUMA) > BG_TOL


def colour_clusters(rgb: np.ndarray, mask: np.ndarray, k: int = 7) -> list[dict]:
    """Greedy luma/HSV bucket clustering — deterministic, no random init."""
    px = rgb[mask]
    if px.size == 0:
        return []
    # Quantise to 24-level buckets on (r,g,b) then merge nearest by luma.
    q = (px // 24).astype(np.int32)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)
    clusters: list[dict] = []
    for idx in order:
        sel = np.all(q == keys[idx], axis=1)
        mean = px[sel].mean(axis=0)
        share = counts[idx] / px.size
        r, g, b = mean
        mx, mn = max(mean), min(mean)
        sat = 0.0 if mx == 0 else (mx - mn) / mx
        # merge into an existing cluster if close in RGB
        merged = False
        for c in clusters:
            if np.abs(np.array(c["rgb"]) - mean).max() < 30:
                n = c["share"]
                c["rgb"] = [round((c["rgb"][i] * n + mean[i] * share) / (n + share), 1) for i in range(3)]
                c["share"] = round(n + share, 4)
                merged = True
                break
        if not merged:
            clusters.append({"rgb": [round(float(v), 1) for v in mean], "share": round(float(share), 4),
                             "sat": round(float(sat), 3), "luma": round(float(mx * 0.299 + mean[1] * 0.587 + mean[2] * 0.114), 1)})
        if len(clusters) >= k:
            break
    clusters.sort(key=lambda c: -c["share"])
    return clusters


def delit(cluster_rgb: list[float]) -> list[int]:
    """Remove an estimated key-light multiplier. The sheet uses one soft light from
    the upper left; lit tops read ~1.25x, shaded sides ~0.75x. We normalise toward
    the mid luminance of the crop's neutral clusters as the 'true' albedo plane."""
    r, g, b = cluster_rgb
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    # Clamp the shading estimate into [0.72, 1.28] so we never invent saturation.
    factor = max(0.72, min(1.28, luma / 118.0))
    out = [int(max(0, min(255, round(v / factor)))) for v in (r, g, b)]
    return out


def row_profile(mask: np.ndarray) -> dict:
    rows = np.where(mask.any(axis=1))[0]
    if rows.size == 0:
        return {}
    widths = mask.sum(axis=1)
    h = rows[-1] - rows[0] + 1
    prof = widths[rows[0]:rows[-1] + 1].astype(float)
    cols = np.where(mask.any(axis=0))[0]
    w = cols[-1] - cols[0] + 1
    # sample 12 evenly spaced stations of the normalised profile
    stations = [round(float(prof[int(i * (h - 1) / 11)] / w), 3) for i in range(12)]
    # left/right symmetry: flip column occupancy about the silhouette centre
    sub = mask[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
    flip = np.fliplr(sub)
    sym = float((sub & flip).sum() / max(1, (sub | flip).sum()))
    return {"heightPx": int(h), "widthPx": int(w), "aspect": round(h / max(1, w), 3),
            "widthStations": stations, "leftRightSymmetry": round(sym, 3)}


def bands(rgb: np.ndarray, mask: np.ndarray, min_band: int = 4) -> list[dict]:
    """Split into horizontal bands where the dominant hue/width changes."""
    rows = np.where(mask.any(axis=1))[0]
    if rows.size == 0:
        return []
    out: list[dict] = []
    start = rows[0]
    prev_key = None
    for y in range(rows[0], rows[-1] + 2):
        key = None
        if y <= rows[-1] and mask[y].any():
            px = rgb[y][mask[y]]
            mean = px.mean(axis=0)
            mx, mn = float(mean.max()), float(mean.min())
            sat = 0.0 if mx == 0 else (mx - mn) / mx
            hue = "neutral"
            if sat > 0.45:
                r, g, b = mean
                if b >= g and b > r:
                    hue = "cyan"
                elif r > g > b:
                    hue = "amber"
                elif r > g and b > g:
                    hue = "violet"
                elif g > r and g > b:
                    hue = "green"
                else:
                    hue = "warm"
            key = (hue, int(mask[y].sum()) // 6)
        if prev_key is not None and (key is None or abs(key[1] - prev_key[1]) > 2 or key[0] != prev_key[0]):
            if y - start >= min_band:
                out.append((start, y - 1))
            start = y
        prev_key = key
    # describe each band
    desc: list[dict] = []
    for (a, b) in out:
        m = mask[a:b + 1]
        c = colour_clusters(rgb[a:b + 1], m, k=4)
        cols = np.where(m.any(axis=0))[0]
        # column occupancy runs -> repeated elements in this band
        occ = m.any(axis=0)
        runs: list[list[int]] = []
        in_run = False
        for x, v in enumerate(occ):
            if v and not in_run:
                run_start = x
                in_run = True
            elif not v and in_run:
                runs.append([run_start, x - 1])
                in_run = False
        if in_run:
            runs.append([run_start, len(occ) - 1])
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        desc.append({"rows": [int(a), int(b)],
                     "heightPx": int(b - a + 1),
                     "widthPx": int(cols[-1] - cols[0] + 1) if cols.size else 0,
                     "clusters": [{"rgb": c_["rgb"], "share": c_["share"], "sat": c_["sat"]} for c_ in c],
                     "columnRuns": len(runs),
                     "columnGaps": [int(g) for g in gaps][:6]})
    return desc


def emissive(rgb: np.ndarray, mask: np.ndarray) -> list[dict]:
    """Bright, saturated pixels = glow strips. Bounding boxes in normalised coords."""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    glow = mask & (mx > 165) & (sat > 0.5)
    if not glow.any():
        return []
    # connected-ish grouping by labelling via flood on a downsampled grid
    ys, xs = np.where(glow)
    boxes: list[dict] = []
    used = np.zeros_like(glow, dtype=bool)
    step = 2
    for y0, x0 in zip(ys[::37], xs[::37]):
        if used[y0, x0]:
            continue
        y1, y2 = max(0, y0 - 14), min(glow.shape[0], y0 + 15)
        x1, x2 = max(0, x0 - 14), min(glow.shape[1], x0 + 15)
        region = glow[y1:y2, x1:x2] & ~used[y1:y2, x1:x2]
        if region.sum() < 6:
            continue
        used[y1:y2, x1:x2] |= region
        yy, xx = np.where(glow[y1:y2, x1:x2])
        mean = rgb[y1:y2, x1:x2][region].mean(axis=0)
        boxes.append({"bboxNorm": [round(x1 / rgb.shape[1], 3), round(y1 / rgb.shape[0], 3),
                                   round((x1 + xx.max()) / rgb.shape[1], 3), round((y1 + yy.max()) / rgb.shape[0], 3)],
                      "rgb": [int(mean[0]), int(mean[1]), int(mean[2])], "px": int(region.sum())})
    boxes.sort(key=lambda bx: -bx["px"])
    return boxes[:10]


def analyse(name: str) -> dict:
    rgb = load_crop(name)
    mask = foreground_mask(rgb)
    clusters = colour_clusters(rgb, mask)
    prof = row_profile(mask)
    return {
        "name": name,
        "file": f"art/models/{name}.png",
        "sizePx": [int(rgb.shape[1]), int(rgb.shape[0])],
        "coverage": round(float(mask.mean()), 4),
        "palette": [{"rgb": c["rgb"], "delit": delit(c["rgb"]), "share": c["share"], "sat": c["sat"]} for c in clusters],
        "silhouette": prof,
        "bands": bands(rgb, mask),
        "emissive": emissive(rgb, mask),
    }


def markdown(a: dict) -> str:
    lines = [f"# {a['name']} — deterministic crop analysis", "",
             f"Source `{a['file']}`, {a['sizePx'][0]}x{a['sizePx'][1]} px, subject covers {a['coverage']*100:.0f}% of the frame.", "",
             "## Palette (lit → de-lit estimate)", ""]
    for c in a["palette"]:
        rgb = ", ".join(str(int(v)) for v in c["rgb"])
        dl = ", ".join(str(v) for v in c["delit"])
        lines.append(f"- rgb({rgb}) share {c['share']*100:.0f}% sat {c['sat']:.2f} → de-lit rgb({dl})")
    s = a["silhouette"]
    lines += ["", "## Silhouette", "",
              f"- {s['heightPx']} tall x {s['widthPx']} wide (aspect {s['aspect']}), left/right symmetry {s['leftRightSymmetry']}",
              f"- width at 12 stations top→bottom: {s['widthStations']}"]
    lines += ["", "## Bands (top → bottom)", ""]
    for b in a["bands"]:
        cl = "; ".join(f"rgb({', '.join(str(int(v)) for v in c['rgb'])}) {c['share']*100:.0f}%" for c in b["clusters"])
        lines.append(f"- rows {b['rows'][0]}-{b['rows'][1]} (h={b['heightPx']}, w={b['widthPx']}): {cl}; column runs {b['columnRuns']} gaps {b['columnGaps']}")
    if a["emissive"]:
        lines += ["", "## Emissive regions", ""]
        for e in a["emissive"]:
            lines.append(f"- bbox(normalised) {e['bboxNorm']} rgb({', '.join(str(v) for v in e['rgb'])}) {e['px']}px")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    names = sys.argv[1:]
    if not names:
        names = ["matter", "energy", "data", "relay-node", "fabricator", "heavy-foundry",
                 "defense-turret", "worker-agent", "striker", "ranger", "scout-drone", "titan"]
    out_dir = ROOT / "art" / "img2threejs"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in names:
        a = analyse(name)
        d = out_dir / name
        d.mkdir(parents=True, exist_ok=True)
        (d / "analysis.json").write_text(json.dumps(a, indent=1))
        (d / "analysis.md").write_text(markdown(a))
        print(f"analysed {name}: {len(a['palette'])} clusters, {len(a['bands'])} bands, {len(a['emissive'])} emissive")
