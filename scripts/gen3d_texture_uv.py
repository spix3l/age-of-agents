#!/usr/bin/env python3
"""Bake a top-down projected texture + UVs into the white-mesh GLBs.

Each models3d/tile_*.glb gets:
  - TEXCOORD_0 UVs computed by planar projection onto the XZ plane
    (u from x, v from z — a top-down view, matching RTS cameras),
  - the source tile PNG embedded as the baseColor texture.

Output: models3d/textured/tile_*.glb (self-contained, standard glTF 2.0).
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

PAD4 = lambda n: (4 - n % 4) % 4


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
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    comp_count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    comp_type = {5120: "i1", 5121: "u1", 5122: "i2", 5123: "u2", 5125: "u4", 5126: "f4"}[acc["componentType"]]
    dt = np.dtype(comp_type)
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    arr = np.frombuffer(bin_chunk, dtype=dt, count=acc["count"] * comp_count, offset=start)
    return arr.reshape(acc["count"], comp_count)


def bake_glb(glb_path: Path, png_path: Path, out_path: Path):
    data = glb_path.read_bytes()
    js, bin_chunk = read_glb(data)
    prim = js["meshes"][0]["primitives"][0]
    pos = accessor_array(js, bin_chunk, prim["attributes"]["POSITION"]).astype(float)
    idx = accessor_array(js, bin_chunk, prim["indices"])

    mn, mx = pos.min(axis=0), pos.max(axis=0)
    size = np.maximum(mx - mn, 1e-6)
    cx, cz = (mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2

    # Planar top-down UVs: u along +x, v along -z (image top row = far side).
    u = (pos[:, 0] - (cx - size[0] / 2)) / size[0]
    v = 1.0 - (pos[:, 2] - (cz - size[2] / 2)) / size[2]
    uvs = np.stack([np.clip(u, 0, 1), np.clip(v, 0, 1)], axis=1)

    # Texture: source image on a square canvas (keeps aspect, avoids
    # stretching; UVs were normalized to the mesh footprint, so we map the
    # image content into the same normalized square). Padding uses the
    # image's own median border color so the mesh skirt blends in.
    img = Image.open(png_path).convert("RGBA")
    px = np.asarray(img)
    border = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
    pad_rgb = tuple(int(v) for v in np.median(border, axis=0)[:3]) + (255,)
    side = max(img.size)
    canvas = Image.new("RGBA", (side, side), pad_rgb)
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    canvas = canvas.resize((512, 512), Image.LANCZOS)
    tex_bytes = canvas.tobytes()
    import io
    buf = io.BytesIO()
    canvas.save(buf, "PNG", optimize=True)
    png_bytes = buf.getvalue()

    # Assemble binary chunk: positions, indices, uvs, png
    pos_bytes = pos.astype("<f4").tobytes()
    idx_dt = np.dtype("<u4") if idx.max() > 65535 or idx.dtype.itemsize == 4 else np.dtype("<u2")
    idx_bytes = idx.astype(idx_dt).tobytes()
    uv_bytes = uvs.astype("<f4").tobytes()

    views, off = [], 0
    for bl in (pos_bytes, idx_bytes, uv_bytes):
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(bl)})
        off += len(bl) + PAD4(len(bl))
    png_view_len = len(png_bytes)
    views.append({"buffer": 0, "byteOffset": off, "byteLength": png_view_len})
    bin_out = (pos_bytes + b"\0" * PAD4(len(pos_bytes))
               + idx_bytes + b"\0" * PAD4(len(idx_bytes))
               + uv_bytes + b"\0" * PAD4(len(uv_bytes))
               + png_bytes + b"\0" * PAD4(len(png_bytes)))

    icomp = 5125 if idx_dt.itemsize == 4 else 5123
    out_js = {
        "asset": {"version": "2.0", "generator": "gen3d_texture_uv.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": png_path.stem}],
        "meshes": [{
            "name": png_path.stem,
            "primitives": [{
                "attributes": {"POSITION": 0, "TEXCOORD_0": 2},
                "indices": 1,
                "material": 0,
                "mode": 4,
            }],
        }],
        "materials": [{
            "name": "projected",
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9,
            },
        }],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [{"bufferView": 3, "mimeType": "image/png"}],
        "samplers": [{"wrapS": 33071, "wrapT": 33071, "magFilter": 9729, "minFilter": 9987}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos),
             "type": "VEC3", "min": mn.tolist(), "max": mx.tolist()},
            {"bufferView": 1, "componentType": icomp, "count": len(idx), "type": "SCALAR"},
            {"bufferView": 2, "componentType": 5126, "count": len(uvs), "type": "VEC2"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_out)}],
    }

    js_bytes = json.dumps(out_js, separators=(",", ":")).encode()
    js_bytes += b" " * PAD4(len(js_bytes))
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A) + js_bytes
    out += struct.pack("<II", len(bin_out), 0x004E4942) + bin_out
    out_path.write_bytes(out)
    return len(pos), len(idx) // 3


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
        nv, nf = bake_glb(glb, png, OUT_DIR / f"{png.stem}.glb")
        kb = (OUT_DIR / f"{png.stem}.glb").stat().st_size / 1024
        print(f"{png.stem}: {nv} verts, {nf} faces, {kb:.0f} KB -> textured/{png.stem}.glb")


if __name__ == "__main__":
    main()
