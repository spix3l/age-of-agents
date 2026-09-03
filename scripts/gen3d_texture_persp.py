#!/usr/bin/env python3
"""Perspective-refined version of gen3d_texture_fit.py.

Starts from the orthographic fit stored in each textured GLB's
extras.fittedView, then refines (yaw, pitch, camera distance) with a true
perspective camera (FOV 45, matching the source viewer). Bakes UVs by
projection along the refined view, with correct mapping into the
content-cropped square texture canvas.

Output: models3d/textured/tile_*.glb (same files, upgraded).
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

FOV = 45.0  # degrees, vertical; matches the ai3dgen viewer

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


# ---------------------------------------------------------------- camera

def camera_basis(yaw: float, pitch: float):
    """Camera above the scene at azimuth yaw, elevation pitch (matching the
    preview page: eye = R*(sin yaw cos pitch, sin pitch, cos yaw cos pitch),
    looking at origin, world-up +Y)."""
    cy, sy = np.cos(yaw), np.sin(yaw)
    cp, sp = np.cos(pitch), np.sin(pitch)
    eye = np.array([sy * cp, sp, cy * cp])
    fwd = -eye  # look at origin
    right = np.cross(fwd, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    return eye, right, up, fwd


def project_perspective(pts: np.ndarray, yaw: float, pitch: float, dist: float):
    """Project points through a perspective camera at distance `dist`.
    Returns (sx, sy) in tangent units (tan of half-angle scaled), depth."""
    eye, right, up, fwd = camera_basis(yaw, pitch)
    rel = pts - eye * dist
    z = rel @ fwd  # depth along view (positive in front)
    sx = (rel @ right) / z
    sy = (rel @ up) / z
    return sx, sy, z


def mesh_silhouette_persp(pts: np.ndarray, yaw: float, pitch: float, dist: float,
                          shape, margin: float = 1.0):
    """Silhouette at TRUE aspect, uniformly scaled to fit `shape` (h, w).

    Both mesh silhouette and target mask are rendered with uniform scaling
    (longest side -> shape longest side * margin), centered, so IoU compares
    genuine geometry without square distortion.
    """
    res_h, res_w = shape
    sx, sy, z = project_perspective(pts, yaw, pitch, dist)
    keep = z > 1e-6
    sx, sy = sx[keep], sy[keep]

    x0, x1 = sx.min(), sx.max()
    y0, y1 = sy.min(), sy.max()
    scale = min((res_w - 1) / max(x1 - x0, 1e-9), (res_h - 1) / max(y1 - y0, 1e-9)) * margin
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    px = np.round((sx - cx) * scale + (res_w - 1) / 2).astype(int)
    py = np.round((cy - sy) * scale + (res_h - 1) / 2).astype(int)
    ok = (px >= 0) & (px < res_w) & (py >= 0) & (py < res_h)
    grid = np.zeros((res_h, res_w), dtype=bool)
    grid[py[ok], px[ok]] = True
    for _ in range(2):
        grid = grid | np.roll(grid, 1, 0) | np.roll(grid, -1, 0) | np.roll(grid, 1, 1) | np.roll(grid, -1, 1)
    return grid


def iou(a: np.ndarray, b: np.ndarray) -> float:
    return (a & b).sum() / max((a | b).sum(), 1)


def fit_perspective(pts: np.ndarray, target: np.ndarray, yaw0: float, pitch0: float):
    """Refine (yaw, pitch, dist) starting from the orthographic fit."""
    # initial distance from mesh radius + FOV: fit the whole mesh in view
    radius = np.linalg.norm(pts - pts.mean(axis=0), axis=1).max()
    dist0 = radius / np.tan(np.deg2rad(FOV / 2)) * 1.15

    best = (-1.0, yaw0, pitch0, dist0)
    # coarse sweep: yaw (motion is periodic), pitch, dist
    for dy in np.linspace(-0.5, 0.5, 9):
        for dp in np.linspace(-0.25, 0.25, 7):
            for dd in np.linspace(0.75, 1.6, 6):
                d = dist0 * dd
                s = mesh_silhouette_persp(pts, yaw0 + dy, pitch0 + dp, d, target.shape)
                v = iou(s, target)
                if v > best[0]:
                    best = (v, yaw0 + dy, pitch0 + dp, d)
    # refine twice
    for span_y, span_p, span_d in ((0.1, 0.06, 0.12), (0.035, 0.02, 0.05)):
        _, y0, p0, d0 = best
        for yy in np.linspace(y0 - span_y, y0 + span_y, 5):
            for pp in np.linspace(max(0.05, p0 - span_p), p0 + span_p, 5):
                for ddist in np.linspace(max(0.3, d0 * (1 - span_d)), d0 * (1 + span_d), 5):
                    s = mesh_silhouette_persp(pts, yy, pp, ddist, target.shape)
                    v = iou(s, target)
                    if v > best[0]:
                        best = (v, yy, pp, ddist)
    return best[1], best[2], best[3], best[0]


# ---------------------------------------------------------------- image mask / texture

def image_mask_and_crop(img: Image.Image, res: int = 160):
    """Return (mask of content crop at TRUE aspect, content crop RGBA).

    The mask is uniform-scaled so its longest side is `res`, preserving the
    content crop's aspect ratio (no square distortion).
    """
    px = np.asarray(img.convert("RGBA"))
    a = px[..., 3]
    if a.min() < 250:
        opaque = a >= 24
    else:
        r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        opaque = ~((mn > 235) & (mx - mn < 12))
    ys, xs = np.nonzero(opaque)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    crop = img.convert("RGBA").crop((x0, y0, x1 + 1, y1 + 1))
    scale = res / max(crop.width, crop.height)
    tw, th = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    mim = Image.fromarray((opaque[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)).resize((tw, th), Image.BILINEAR)
    return np.asarray(mim) > 127, crop


def square_canvas(crop: Image.Image, size: int = 512):
    """Content crop centered on a square canvas padded with border median."""
    px = np.asarray(crop)
    border = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
    pad_rgb = tuple(int(t) for t in np.median(border, axis=0)[:3]) + (255,)
    side = max(crop.size)
    canvas = Image.new("RGBA", (side, side), pad_rgb)
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- bake

def bake(glb_path: Path, png_path: Path, out_path: Path):
    data = glb_path.read_bytes()
    js, bin_chunk = read_glb(data)
    prim = js["meshes"][0]["primitives"][0]
    pos = accessor_array(js, bin_chunk, prim["attributes"]["POSITION"]).astype(float)
    idx = accessor_array(js, bin_chunk, prim["indices"])

    img = Image.open(png_path)
    mask, crop = image_mask_and_crop(img)

    prev = js.get("extras", {}).get("fittedView", {})
    yaw0 = float(prev.get("yaw", 0.0))
    pitch0 = float(prev.get("pitch", 0.5))

    # Center the mesh (perspective projection is not translation-invariant,
    # and the preview page renders the mesh centered at the origin).
    center = (pos.min(axis=0) + pos.max(axis=0)) / 2
    pts = pos - center
    yaw, pitch, dist, score = fit_perspective(pts, mask, yaw0, pitch0)

    # UVs: perspective projection with the fitted camera, mapped into the
    # square texture canvas exactly like square_canvas maps the crop: the
    # content crop is centered at scale 1 on a side=max(w,h) canvas, then
    # resized to 512. So u/v = position on the content crop mapped through
    # that centering: u in [pad_x/(side), (pad_x+w)/side] etc.
    sx, sy, _ = project_perspective(pts, yaw, pitch, dist)
    x0, x1 = sx.min(), sx.max()
    y0, y1 = sy.min(), sy.max()
    side = max(crop.width, crop.height)
    pad_x = (side - crop.width) / 2
    pad_y = (side - crop.height) / 2
    # glTF v=0 is the TOP row of the image. A vertex at the top of the
    # silhouette (sy = y1) must sample the top of the content area.
    fx = (sx - x0) / max(x1 - x0, 1e-9)
    fy = 1.0 - (sy - y0) / max(y1 - y0, 1e-9)  # canvas y fraction from top
    u = (pad_x + fx * crop.width) / side
    v = (pad_y + fy * crop.height) / side
    uvs = np.stack([np.clip(u, 0, 1), np.clip(v, 0, 1)], axis=1)

    canvas = square_canvas(crop)
    buf = io.BytesIO()
    canvas.save(buf, "PNG", optimize=True)
    png_bytes = buf.getvalue()

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
        "asset": {"version": "2.0", "generator": "gen3d_texture_persp.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": png_path.stem}],
        "meshes": [{"name": png_path.stem, "primitives": [{
            "attributes": {"POSITION": 0, "TEXCOORD_0": 2},
            "indices": 1, "material": 0, "mode": 4}]}],
        "materials": [{
            "name": "fitted-perspective",
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
        "extras": {"fittedView": {
            "yaw": yaw, "pitch": pitch, "distance": dist,
            "fov": FOV, "silhouetteIoU": score, "projection": "perspective",
        }},
    }

    js_bytes = json.dumps(out_js, separators=(",", ":")).encode()
    js_bytes += b" " * PAD4(len(js_bytes))
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_out)
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A) + js_bytes
    out += struct.pack("<II", len(bin_out), 0x004E4942) + bin_out
    out_path.write_bytes(out)
    return score, yaw, pitch, dist


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
        score, yaw, pitch, dist = bake(glb, png, OUT_DIR / f"{png.stem}.glb")
        kb = (OUT_DIR / f"{png.stem}.glb").stat().st_size / 1024
        print(f"{png.stem}: IoU={score:.2f} yaw={np.rad2deg(yaw):.0f} pitch={np.rad2deg(pitch):.0f} dist={dist:.2f} {kb:.0f}KB")


if __name__ == "__main__":
    main()
