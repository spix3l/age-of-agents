#!/usr/bin/env python3
"""Texture the white-mesh GLBs by projecting the source image along the view
angle the image was rendered from.

For each tile:
  1. Fit the view (yaw around Y, pitch around X) whose orthographic silhouette
     of the mesh best matches the image's opaque outline (IoU maximization).
  2. Compute UVs by planar projection along that fitted view direction, so the
     model re-projects onto the image almost exactly like the original render.
  3. Embed the source image as baseColor texture.

Output: models3d/textured/tile_*.glb (self-contained glTF 2.0).
"""

import io
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


# ---------------------------------------------------------------- glb io

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


# ---------------------------------------------------------------- view fit

def image_mask(img: Image.Image, res: int = 160):
    """Opaque-pixel mask of the source image, cropped to content, res:res."""
    img = img.convert("RGBA")
    px = np.asarray(img)
    a = px[..., 3]
    if a.min() < 250:
        opaque = a >= 24
    else:
        r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        opaque = ~((mn > 235) & (mx - mn < 12))
    ys, xs = np.nonzero(opaque)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    m = opaque[y0:y1 + 1, x0:x1 + 1]
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((res, res), Image.BILINEAR)
    return np.asarray(im) > 127


def mesh_silhouette(pts: np.ndarray, yaw: float, pitch: float, res: int = 160):
    """Orthographic silhouette of the mesh viewed from ABOVE at azimuth yaw
    (camera at (sin yaw, sin pitch, cos yaw) * dist, looking at the origin),
    matching the preview page's camera convention."""
    cy, sy = np.cos(yaw), np.sin(yaw)
    cp, sp = np.cos(pitch), np.sin(pitch)
    sx = pts[:, 0] * cy - pts[:, 2] * sy                     # screen right
    su = -pts[:, 0] * sy * sp + pts[:, 1] * cp - pts[:, 2] * cy * sp  # screen up
    y = su

    # screen axes: x right, y down (normalized to bbox -> res grid)
    def norm(v):
        v0, v1 = v.min(), v.max()
        return (v - v0) / max(v1 - v0, 1e-9)

    sx = (norm(sx) * (res - 1)).astype(int)
    sy_ = ((1 - norm(y)) * (res - 1)).astype(int)
    grid = np.zeros((res, res), dtype=bool)
    grid[sy_, sx] = True
    # dilate a bit to close pinholes
    for _ in range(2):
        grid = grid | np.roll(grid, 1, 0) | np.roll(grid, -1, 0) | np.roll(grid, 1, 1) | np.roll(grid, -1, 1)
    return grid


def fit_view(pts: np.ndarray, target_mask: np.ndarray):
    """Grid-search yaw/pitch maximizing IoU(mesh silhouette, image mask)."""
    best = (-1.0, 0.0, 0.0)
    for yaw in np.linspace(0, 2 * np.pi, 25, endpoint=False):
        for pitch in np.linspace(np.deg2rad(15), np.deg2rad(60), 6):
            s = mesh_silhouette(pts, yaw, pitch, target_mask.shape[0])
            inter = (s & target_mask).sum()
            union = (s | target_mask).sum()
            iou = inter / max(union, 1)
            if iou > best[0]:
                best = (iou, yaw, pitch)
    # refine around best
    _, yaw0, pitch0 = best
    for yaw in np.linspace(yaw0 - 0.13, yaw0 + 0.13, 9):
        for pitch in np.linspace(max(0.1, pitch0 - 0.12), min(1.2, pitch0 + 0.12), 7):
            s = mesh_silhouette(pts, yaw, pitch, target_mask.shape[0])
            inter = (s & target_mask).sum()
            union = (s | target_mask).sum()
            iou = inter / max(union, 1)
            if iou > best[0]:
                best = (iou, yaw, pitch)
    return best[1], best[2], best[0]


# ---------------------------------------------------------------- bake

def bake(glb_path: Path, png_path: Path, out_path: Path):
    data = glb_path.read_bytes()
    js, bin_chunk = read_glb(data)
    prim = js["meshes"][0]["primitives"][0]
    pos = accessor_array(js, bin_chunk, prim["attributes"]["POSITION"]).astype(float)
    idx = accessor_array(js, bin_chunk, prim["indices"])

    img = Image.open(png_path).convert("RGBA")
    mask = image_mask(img)

    yaw, pitch, iou = fit_view(pos, mask)

    # view-space basis from fitted yaw/pitch (camera above at azimuth yaw,
    # same convention as the preview page)
    cy, sy = np.cos(yaw), np.sin(yaw)
    cp, sp = np.cos(pitch), np.sin(pitch)
    right = np.array([cy, 0.0, -sy])
    up = np.array([-sy * sp, cp, -cy * sp])
    eye = np.array([sy * cp, sp, cy * cp])  # towards camera

    depth = pos @ eye
    sx = pos @ right
    sy_ = pos @ up
    d0, d1 = depth.min(), depth.max()
    x0, x1 = sx.min(), sx.max()
    y0, y1 = sy_.min(), sy_.max()

    # screen -> uv, matching the silhouette normalization (image = content crop)
    u = (sx - x0) / max(x1 - x0, 1e-9)
    v = 1.0 - (sy_ - y0) / max(y1 - y0, 1e-9)
    uvs = np.stack([np.clip(u, 0, 1), np.clip(v, 0, 1)], axis=1)

    # texture: source image content-cropped onto square canvas
    px = np.asarray(img)
    a = px[..., 3]
    if a.min() < 250:
        opaque = a >= 24
    else:
        r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        opaque = ~((mn > 235) & (mx - mn < 12))
    ys, xs = np.nonzero(opaque)
    crop = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = max(crop.size)
    border = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
    pad_rgb = tuple(int(t) for t in np.median(border, axis=0)[:3]) + (255,)
    canvas = Image.new("RGBA", (side, side), pad_rgb)
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    canvas = canvas.resize((512, 512), Image.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, "PNG", optimize=True)
    png_bytes = buf.getvalue()

    # binary: pos, idx, uv, png
    pos_bytes = pos.astype("<f4").tobytes()
    idx_dt = np.dtype("<u4") if idx.max() > 65535 or idx.dtype.itemsize == 4 else np.dtype("<u2")
    idx_bytes = idx.astype(idx_dt).tobytes()
    uv_bytes = uvs.astype("<f4").tobytes()
    views, off = [], 0
    for bl in (pos_bytes, idx_bytes, uv_bytes):
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(bl)})
        off += len(bl) + PAD4(len(bl))
    views.append({"buffer": 0, "byteOffset": off, "byteLength": len(png_bytes)})
    bin_out = (pos_bytes + b"\0" * PAD4(len(pos_bytes))
               + idx_bytes + b"\0" * PAD4(len(idx_bytes))
               + uv_bytes + b"\0" * PAD4(len(uv_bytes))
               + png_bytes + b"\0" * PAD4(len(png_bytes)))

    icomp = 5125 if idx_dt.itemsize == 4 else 5123
    out_js = {
        "asset": {"version": "2.0", "generator": "gen3d_texture_fit.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": png_path.stem}],
        "meshes": [{"name": png_path.stem, "primitives": [{
            "attributes": {"POSITION": 0, "TEXCOORD_0": 2},
            "indices": 1, "material": 0, "mode": 4}]}],
        "materials": [{
            "name": "fitted-projection",
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
             "type": "VEC3", "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()},
            {"bufferView": 1, "componentType": icomp, "count": len(idx), "type": "SCALAR"},
            {"bufferView": 2, "componentType": 5126, "count": len(uvs), "type": "VEC2"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_out)}],
        "extras": {"fittedView": {"yaw": yaw, "pitch": pitch, "silhouetteIoU": iou}},
    }

    js_bytes = json.dumps(out_js, separators=(",", ":")).encode()
    js_bytes += b" " * PAD4(len(js_bytes))
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A) + js_bytes
    out += struct.pack("<II", len(bin_out), 0x004E4942) + bin_out
    out_path.write_bytes(out)
    return iou, yaw, pitch


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
        iou, yaw, pitch = bake(glb, png, OUT_DIR / f"{png.stem}.glb")
        kb = (OUT_DIR / f"{png.stem}.glb").stat().st_size / 1024
        print(f"{png.stem}: IoU={iou:.2f} yaw={np.rad2deg(yaw):.0f}deg pitch={np.rad2deg(pitch):.0f}deg {kb:.0f}KB")


if __name__ == "__main__":
    main()
