#!/usr/bin/env python3
"""Slice `art/reference/asset-sheet.png` into one PNG per model.

The sheet is a labelled contact sheet: panels of models laid out in rows under
title text. Rather than hand-tuning 60 bounding boxes, each row is declared as a
*band* (a rectangle that contains only model art, no label text) plus the ordered
names of the models inside it. The band is then split automatically on the empty
columns between models and tightened to the ink, so a small mis-declaration of the
band still yields a correct crop.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
SHEET = ROOT / "reference" / "asset-sheet.png"
OUT = ROOT / "models"

# Luminance above which a pixel counts as model ink. The panel ground sits around
# 12-30 and the faint panel grid lines around 40; model art is far brighter.
INK = 62
# A column needs this many ink pixels to count as occupied, which ignores the
# stray antialiased pixel and the 1px panel rules.
MIN_COL_INK = 2
# Columns of empty space that separate two models in a band.
MIN_GAP = 7
# Padding kept around the tightened box so nothing is clipped.
PAD = 6

# Bands whose models sit closer together than MIN_GAP declare their own gap.
GAP_OVERRIDES = {"resources-tier-a": 4, "economy": 4, "defense-hero": 4}

Band = tuple[str, tuple[int, int, int, int], list[str]]

BANDS: list[Band] = [
    # --- RESOURCES ---
    ("resources-hero", (12, 70, 566, 252), ["matter", "energy", "data"]),
    ("resources-tier-a", (12, 282, 566, 368),
     ["matter-tier-1", "matter-tier-2", "energy-tier-2", "energy-tier-3",
      "data-tier-1", "data-tier-2", "data-tier-3"]),
    ("resources-tier-b", (12, 378, 380, 478),
     ["matter-tier-1-alt", "matter-tier-2-alt", "energy-tier-2-alt", "energy-tier-3-alt"]),

    # --- CORE & ECONOMY (the Core sits in its own tall cell to the left) ---
    ("core", (578, 8, 745, 250), ["core"]),
    ("economy", (750, 86, 1192, 250), ["relay-node", "power-generator", "supply-depot"]),

    # --- PRODUCTION BUILDINGS ---
    ("production", (578, 330, 1192, 502),
     ["fabricator", "ranger-facility", "drone-bay", "heavy-foundry"]),

    # --- DEFENSE ---
    ("defense-hero", (1208, 86, 1528, 236), ["defense-turret", "wall-segment"]),
    ("defense-a", (1208, 258, 1528, 346),
     ["defense-turret-level-1", "wall-segment-level-2", "wall-segment-level-3"]),
    ("defense-b", (1208, 366, 1528, 444),
     ["defense-turret-level-1-alt", "wall-segment-level-2-alt", "wall-segment-level-3-alt"]),

    # --- UNITS: ECONOMY ---
    ("units-economy-hero", (12, 576, 460, 690), ["worker-agent", "worker-agent-alt", "harvester"]),
    ("units-economy-tier", (17, 718, 470, 820),
     ["worker-agent-tier-1", "worker-agent-tier-2", "worker-agent-tier-3",
      "harvester-tier-1", "harvester-tier-2", "harvester-tier-3"]),

    # --- UNITS: COMBAT ---
    ("units-combat-hero", (496, 570, 1100, 690), ["striker", "ranger", "scout-drone", "titan"]),
    ("units-combat-tier-a", (496, 718, 1100, 818),
     ["striker-tier-1", "striker-tier-2", "ranger-tier-2", "ranger-tier-3",
      "scout-drone-tier-1", "scout-drone-tier-3", "titan-tier-1", "titan-tier-3"]),
    ("units-combat-tier-b", (496, 822, 1100, 906),
     ["striker-tier-1-alt", "striker-tier-2-alt", "ranger-tier-2-alt", "ranger-tier-3-alt",
      "scout-drone-tier-1-alt", "scout-drone-tier-3-alt", "titan-tier-1-alt", "titan-tier-3-alt"]),

    # --- SPECIAL STRUCTURES ---
    ("special", (1116, 570, 1528, 692), ["research-array", "command-center", "shield-generator"]),

    # --- EFFECTS & UI ---
    ("effects-a", (1118, 792, 1530, 882),
     ["rally-point", "command-marker", "selection-circle", "projectile"]),
    ("effects-b", (1170, 924, 1460, 1006), ["laser-impact", "destruction"]),
]


def ink_mask(im: Image.Image) -> list[list[bool]]:
    px = im.load()
    w, h = im.size
    return [[(px[x, y][0] * 299 + px[x, y][1] * 587 + px[x, y][2] * 114) // 1000 >= INK
             for y in range(h)] for x in range(w)]


def runs(occupied: list[bool], min_gap: int) -> list[tuple[int, int]]:
    """Contiguous occupied spans, merging spans closer together than `min_gap`."""
    spans: list[list[int]] = []
    for i, on in enumerate(occupied):
        if not on:
            continue
        if spans and i - spans[-1][1] <= min_gap:
            spans[-1][1] = i
        else:
            spans.append([i, i])
    return [(a, b) for a, b in spans]


def main() -> int:
    sheet = Image.open(SHEET).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []
    problems: list[str] = []

    for band_name, (bx0, by0, bx1, by1), names in BANDS:
        band = sheet.crop((bx0, by0, bx1, by1))
        mask = ink_mask(band)
        bw, bh = band.size
        cols = [sum(1 for y in range(bh) if mask[x][y]) >= MIN_COL_INK for x in range(bw)]
        gap = GAP_OVERRIDES.get(band_name, MIN_GAP)
        spans = [s for s in runs(cols, gap) if s[1] - s[0] >= 8]
        if len(spans) != len(names):
            problems.append(f"{band_name}: found {len(spans)} models, expected {len(names)} "
                            f"({[ (a+bx0, b+bx0) for a, b in spans ]})")
            continue
        for (x0, x1), name in zip(spans, names):
            ys = [y for y in range(bh)
                  if sum(1 for x in range(x0, x1 + 1) if mask[x][y]) >= MIN_COL_INK]
            if not ys:
                problems.append(f"{band_name}/{name}: no ink")
                continue
            box = (max(0, bx0 + x0 - PAD), max(0, by0 + min(ys) - PAD),
                   min(sheet.width, bx0 + x1 + 1 + PAD), min(sheet.height, by0 + max(ys) + 1 + PAD))
            sheet.crop(box).save(OUT / f"{name}.png")
            manifest.append({"name": name, "band": band_name, "file": f"models/{name}.png",
                             "box": list(box)})

    (ROOT / "models.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(manifest)} crops to {OUT}")
    for p in problems:
        print("PROBLEM", p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
