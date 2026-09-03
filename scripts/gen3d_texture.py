#!/usr/bin/env python3
"""Bake colors into the white-mesh GLBs in models3d/ by projecting the source
tile images (models/tile_*.png) top-down onto the geometry.

For each vertex we raycast from above (glTF Y-up) down the Y axis, sampling the
source image at the vertex's (x, z) position; the first opaque (or non-white,
for images without alpha) pixel supplies the color. The color is baked as a
float COLOR_0 vertex attribute with a white PBR base material, so standard
glTF loaders (three.js GLTFLoader included) render it without any sidecar
texture files.

Output: models3d/textured/tile_*.glb
"""

import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_GLB = ROOT / "models3d"
SRC_PNG = ROOT / "models"
OUT_DIR = ROOT / "models3d" / "textured"

RAY_MARGIN = 1.25  # start rays this far above the mesh bbox (in bbox-height units)
MAX_STEPS = 400


def read_glb(data: bytes):
    magic, ver, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67, "not a GLB"
    clen, ctype = struct.unpack_from("<II", data, 12)
    assert ctype == 0x4E4F534A, "first chunk not JSON"
    js = json.loads(data[20:20 + clen])
    offset = 20 + clen
    bin_chunk = b""
    if offset < length:
        blen, btype = struct.unpack_from("<II", data, offset)
        assert btype == 0x004E4942, "second chunk not BIN"
        bin_chunk = data[offset + 8: offset + 8 + blen]
    return js, bin_chunk


def accessor_array(js, bin_chunk, idx):
    """Read a glTF accessor into a numpy array (supports the types we need)."""
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    comp_count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    comp_type = {5120: "i1", 5121: "u1", 5122: "i2", 5123: "u2", 5125: "u4", 5126: "f4"}[acc["componentType"]]
    dt = np.dtype(comp_type)
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    arr = np.frombuffer(bin_chunk, dtype=dt, count=count * comp_count, offset=start)
    return arr.reshape(count, comp_count)


def build_image_sampler(img: Image.Image):
    """Return f(u, v in 0..1) -> (r, g, b, hit: bool) sampling the source image.

    For top-down projection the image coordinate of a ray is fixed; "hitting"
    means the projected pixel is opaque. When it is not, we borrow the color of
    the nearest opaque pixel in the same column (still a hit, marked False in
    the third element... see return signature below).
    """
    img = img.convert("RGBA")
    px = np.asarray(img, dtype=np.uint8)
    h, w = px.shape[:2]
    alpha = px[..., 3]

    if alpha.min() < 250:  # meaningful transparency
        opaque = alpha >= 24
    else:
        # No alpha: treat near-white as background (matches the white cards
        # the tiles were rendered on).
        r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
        maxc = np.maximum(np.maximum(r, g), b)
        minc = np.minimum(np.minimum(r, g), b)
        opaque = ~((minc > 235) & (maxc - minc < 12))

    mean_color = px[opaque].mean(axis=0)[:3] if opaque.any() else np.array([200, 200, 200], dtype=float)

    # For every pixel, the nearest opaque row in its column (or -1).
    nearest = np.full((h, w), -1, dtype=int)
    ys = np.arange(h)
    for x in range(w):
        rows = np.nonzero(opaque[:, x])[0]
        if rows.size == 0:
            continue
        idx = np.searchsorted(rows, ys)
        left = rows[np.clip(idx - 1, 0, rows.size - 1)]
        right = rows[np.clip(idx, 0, rows.size - 1)]
        d_left = np.abs(ys - left)
        d_right = np.abs(ys - right)
        nearest[:, x] = np.where(d_left <= d_right, left, right)

    coverage = opaque.mean()

    def sample(u: float, v: float):
        x = min(w - 1, max(0, int(u * (w - 1))))
        y = min(h - 1, max(0, int(v * (h - 1))))
        if opaque[y, x]:
            return px[y, x][:3].astype(float), True
        ny = nearest[y, x]
        if ny >= 0:
            return px[ny, x][:3].astype(float), True
        return mean_color, False

    return sample, coverage


def vertex_color(pos: np.ndarray, sample) -> np.ndarray:
    """Assign rgb per vertex by projecting (x, z) into the source image."""
    mn, mx = pos.min(axis=0), pos.max(axis=0)
    size = mx - mn
    size[size == 0] = 1e-6
    cx = (mn[0] + mx[0]) / 2
    cz = (mn[2] + mx[2]) / 2
    colors = np.empty((len(pos), 3), dtype=float)
    fallback = np.array([190, 190, 195], dtype=float)
    for i, (x, y, z) in enumerate(pos):
        u = (x - (cx - size[0] / 2)) / size[0]
        v = 1.0 - (z - (cz - size[2] / 2)) / size[2]  # image top row = -Z side
        c, hit = sample(u, v)
        colors[i] = c if hit else fallback
    return colors / 255.0


def bake_glb(glb_path: Path, png_path: Path, out_path: Path):
    data = glb_path.read_bytes()
    js, bin_chunk = read_glb(data)
    mesh = js["meshes"][0]
    prim = mesh["primitives"][0]
    pos = accessor_array(js, bin_chunk, prim["attributes"]["POSITION"]).astype(float)
    idx = accessor_array(js, bin_chunk, prim["indices"])

    img = Image.open(png_path)
    sample, coverage = build_image_sampler(img)
    colors = vertex_color(pos, sample)

    # New binary: position, indices, then color block.
    pos_bytes = pos.astype("<f4").tobytes()
    idx_dt = np.dtype("<u4") if idx.max() > 65535 or idx.dtype.itemsize == 4 else np.dtype("<u2")
    idx_bytes = idx.astype(idx_dt).tobytes()
    col_bytes = colors.astype("<f4").tobytes()

    pad4 = lambda n: (4 - n % 4) % 4
    bv_pos, bv_idx, bv_col = 0, 1, 2
    off = 0
    views = []
    for bl in (pos_bytes, idx_bytes, col_bytes):
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(bl)})
        off += len(bl) + pad4(len(bl))
    bin_out = (pos_bytes + b"\0" * pad4(len(pos_bytes))
               + idx_bytes + b"\0" * pad4(len(idx_bytes))
               + col_bytes + b"\0" * pad4(len(col_bytes)))

    icomp = 5125 if idx_dt.itemsize == 4 else 5123
    out_js = {
        "asset": {"version": "2.0", "generator": "gen3d_texture.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": png_path.stem}],
        "meshes": [{
            "name": png_path.stem,
            "primitives": [{
                "attributes": {"POSITION": 0, "COLOR_0": 2},
                "indices": 1,
                "material": 0,
                "mode": 4,
            }],
        }],
        "materials": [{
            "name": "baked",
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.85,
            },
        }],
        "accessors": [
            {"bufferView": bv_pos, "componentType": 5126, "count": len(pos),
             "type": "VEC3", "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()},
            {"bufferView": bv_idx, "componentType": icomp, "count": len(idx), "type": "SCALAR"},
            {"bufferView": bv_col, "componentType": 5126, "count": len(pos), "type": "VEC3"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_out)}],
    }

    js_bytes = json.dumps(out_js, separators=(",", ":")).encode()
    js_bytes += b" " * pad4(len(js_bytes))
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A) + js_bytes
    out += struct.pack("<II", len(bin_out), 0x004E4942) + bin_out
    out_path.write_bytes(out)
    return len(pos), len(idx) // 3, coverage


def main():
    only = sys.argv[1:] or None
    OUT_DIR.mkdir(exist_ok=True)
    tiles = sorted(SRC_PNG.glob("tile_*.png"))
    if only:
        tiles = [t for t in tiles if t.stem in only]
    for png in tiles:
        glb = SRC_GLB / f"{png.stem}.glb"
        if not glb.exists():
            print(f"skip {png.stem}: no source glb")
            continue
        nv, nf, cov = bake_glb(glb, png, OUT_DIR / f"{png.stem}.glb")
        kb = (OUT_DIR / f"{png.stem}.glb").stat().st_size / 1024
        print(f"{png.stem}: {nv} verts, {nf} faces, img coverage {cov:.0%}, {kb:.0f} KB -> textured/{png.stem}.glb")


if __name__ == "__main__":
    main()
