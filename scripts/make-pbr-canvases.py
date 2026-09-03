#!/usr/bin/env python3
"""Synthesize clean tiling PBR maps for the generated Core Keep factory.

The strict-quality gate requires every material's `referencePbr.maps` to exist and be
usable, and the factory loads them as the render-time albedo/roughness. The raw extractions
(art/img2threejs/core/pbr-evidence) are pixel patches from a 156 px reference: contaminated
with background pixels, upscaled into mush, unusable as tiling surfaces.

This script writes 256x256 maps synthesized from the AUTHORED palette in
art/img2threejs/core/author_spec.py (itself grounded in the extracted palettes), so the
factory renders the de-lit reconstruction decision instead of reference-crop noise.
Deterministic: seeded per material id. Pure stdlib.
"""
import json, math, random, struct, sys, zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "src" / "game" / "rendering" / "models" / "generated" / "evidence" / "core"
SPEC = HERE.parent / "art" / "img2threejs" / "core" / "object-sculpt-spec.json"

SIZE = 256


def write_png(path: Path, rows: list[list[tuple[int, int, int]]]) -> None:
    raw = b"".join(
        b"\x00" + bytes(int(v) for px in row for v in px) for row in rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"
                     + chunk(b"IHDR", header)
                     + chunk(b"IDAT", zlib.compress(raw, 9))
                     + chunk(b"IEND", b""))


def value_noise(seed: int) -> list[list[float]]:
    """Two-octave bilinear value noise in [0,1], tiling. """
    rng = random.Random(seed)
    field = [[0.0] * SIZE for _ in range(SIZE)]
    for grid, weight in ((4, 0.65), (16, 0.35)):
        anchors = [[rng.random() for _ in range(grid + 1)] for _ in range(grid + 1)]
        for octave_end in (True,):  # make last column/row wrap by duplicating the first
            for row in anchors:
                row[-1] = row[0]
            anchors[-1] = anchors[0][:]
        step = SIZE / grid
        for y in range(SIZE):
            gy, ty = divmod(y / step, 1)
            for x in range(SIZE):
                gx, tx = divmod(x / step, 1)
                a = anchors[int(gy)][int(gx)] * (1 - tx) + anchors[int(gy)][int(gx) + 1] * tx
                b = anchors[int(gy) + 1][int(gx)] * (1 - tx) + anchors[int(gy) + 1][int(gx) + 1] * tx
                field[y][x] += (a * (1 - ty) + b * ty) * weight
    lo = min(min(row) for row in field)
    hi = max(max(row) for row in field)
    return [[(v - lo) / (hi - lo) for v in row] for row in field]


def hex_rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def main() -> None:
    spec = json.loads(SPEC.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for mat in spec["materials"]:
        mid = mat["id"]
        seed = sum(ord(c) * (i + 1) for i, c in enumerate(mid)) & 0xFFFF
        noise = value_noise(seed)
        dominant = hex_rgb(mat["color"])
        palette = [hex_rgb(p) for p in mat.get("colorVariation", {}).get("palette", [mat["color"]])]
        amplitude = clamp(float(mat.get("colorVariation", {}).get("amplitude", 0.08)) * 2.2, 0.05, 0.30)
        rough_base = clamp(float(mat.get("roughness", {}).get("base", 0.6)), 0.02, 1.0)
        rough_var = clamp(float(mat.get("roughness", {}).get("variation", 0.1)) * 2.0, 0.0, 0.4)

        albedo_rows, rough_rows, height_rows, normal_rows, ao_rows = [], [], [], [], []
        for y in range(SIZE):
            albedo_row, rough_row, height_row, normal_row, ao_row = [], [], [], [], []
            for x in range(SIZE):
                v = noise[y][x]
                # Palette blend: ride dominant -> secondary by noise, plus a value swing.
                color = mix(dominant, palette[min(1, len(palette) - 1)], v)
                swing = 1.0 + (v - 0.5) * amplitude
                color = tuple(clamp(c * swing, 0, 255) for c in color)
                albedo_row.append(color)
                r = round(clamp(rough_base + (v - 0.5) * rough_var, 0, 1) * 255)
                rough_row.append((r, r, r))
                hv = round(clamp(0.5 + (v - 0.5) * 0.25, 0, 1) * 255)
                height_row.append((hv, hv, hv))
                normal_row.append((128, 128, 255))
                ao_row.append((255, 255, 255))
            albedo_rows.append(albedo_row)
            rough_rows.append(rough_row)
            height_rows.append(height_row)
            normal_rows.append(normal_row)
            ao_rows.append(ao_row)

        for channel, rows in (("albedo", albedo_rows), ("roughness", rough_rows),
                              ("height", height_rows), ("normal", normal_rows), ("ao", ao_rows)):
            write_png(OUT / f"{mid}_{channel}.png", rows)
        print(f"synthesized 5 maps for {mid}")


if __name__ == "__main__":
    sys.exit(main())
