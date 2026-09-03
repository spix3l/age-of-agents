#!/usr/bin/env python3
"""Render every textured GLB from its fitted view in Chrome and verify against
its source image. Prints one JSON line per tile.

Requires: browser-control with a running browser (default: chrome-salmon),
previews already generated (tile_*.preview.html next to the GLBs).
"""
import json
import base64
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEX_DIR = ROOT / "models3d" / "textured"
RENDERS = TEX_DIR / "renders"
BROWSER = "chrome-salmon/glbprev"


def fitted_view(glb_path: Path):
    data = glb_path.read_bytes()
    clen, = struct.unpack_from("<I", data, 12)
    js = json.loads(data[20:20 + clen])
    fv = js.get("extras", {}).get("fittedView", {})
    return fv.get("yaw"), fv.get("pitch"), fv.get("distance")


def bc_eval(expr: str) -> str:
    out = subprocess.run(
        ["browser-control", "eval", "-b", BROWSER, expr],
        capture_output=True, text=True, timeout=60,
    )
    return out.stdout.strip()


def main():
    RENDERS.mkdir(exist_ok=True)
    tiles = sorted(TEX_DIR.glob("tile_*.glb"))
    results = []
    for glb in tiles:
        tile = glb.stem
        yaw, pitch, dist = fitted_view(glb)
        if yaw is None:
            print(json.dumps({"tile": tile, "error": "no fittedView"}), flush=True)
            continue
        deg = 180 / 3.141592653589793
        url = (f"file://{glb.with_suffix('.preview.html')}"
               f"?yaw={round(float(yaw) * deg)}&pitch={round(float(pitch) * deg)}"
               + (f"&dist={float(dist):.2f}" if dist else "") + "&v=1")
        subprocess.run(["browser-control", "tab", "open", BROWSER, url],
                       capture_output=True, text=True, timeout=60)
        time.sleep(4)
        shot = bc_eval("window.__shot()")
        if not shot.startswith("data:image/png"):
            print(json.dumps({"tile": tile, "error": "no shot"}), flush=True)
            continue
        render = RENDERS / f"{tile}.png"
        render.write_bytes(base64.b64decode(shot.split(",", 1)[1]))
        out = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "verify_fit.py"), tile, str(render)],
            capture_output=True, text=True, timeout=60,
        )
        line = next((l for l in out.stdout.splitlines() if l.startswith("JSON:")), None)
        if line:
            rec = json.loads(line[5:])
            results.append(rec)
            print(json.dumps(rec), flush=True)
        else:
            print(json.dumps({"tile": tile, "error": (out.stderr or "verify failed").strip()[:120]}), flush=True)

    ok = [r for r in results if "iou" in r]
    if ok:
        import numpy as np
        ious = [r["iou"] for r in ok]
        deltas = [r["delta"] for r in ok]
        print(f"SUMMARY: n={len(ok)} iou_mean={np.mean(ious):.2f} iou_min={min(ious):.2f} "
              f"delta_mean={np.mean(deltas):.1f} delta_max={max(deltas):.1f}", flush=True)


if __name__ == "__main__":
    main()
