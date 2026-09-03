#!/usr/bin/env python3
"""Generate 3D models from models/tile_*.png using the HF Gradio Space API
backing ai3dgen.com's free image-to-3D tool, and download the GLB results.

Protocol (Gradio 4.44):
  1. POST /upload            (multipart)          -> [server_path]
  2. POST /queue/join        (json)               -> event_id
  3. GET  /queue/data?session_hash=... (SSE)       -> process_completed
  4. GET  /file=<glb_path>                        -> binary GLB
"""

import io
import json
import random
import re
import string
import sys
import time
from pathlib import Path

import requests

HOSTS = {
    "test": "https://agualeo-image-to-3d-2-test.hf.space",
    "main": "https://agualeo-image-to-3d-2.hf.space",
}
OUT_DIR = Path(__file__).resolve().parent.parent / "models3d"
SRC_DIR = Path(__file__).resolve().parent.parent / "models"
PROGRESS_FILE = OUT_DIR / "progress.jsonl"

# Endpoint params (from /info): image, steps=5, guidance_scale=5.5, seed=1234,
# octree_resolution=256, num_chunks=8000, target_face_num=10000, randomize_seed=True
STEPS = 5
GUIDANCE_SCALE = 5.5
OCTREE_RESOLUTION = 256
NUM_CHUNKS = 8000
TARGET_FACE_NUM = 20000  # matches the face count selected in the site UI

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def gen_one(png_path: Path, timeout: float = 420.0) -> Path:
    """Generate a GLB for one image; returns the downloaded file path."""
    session_hash = "".join(random.choices(string.ascii_lowercase + string.digits, k=11))

    # 1. upload
    with open(png_path, "rb") as f:
        r = session.post(
            f"{HOST}/upload",
            files={"files": (png_path.name, f, "image/png")},
            timeout=60,
        )
    r.raise_for_status()
    server_path = r.json()[0]

    # 2. queue join
    payload = {
        "data": [
            {"path": server_path, "meta": {"_type": "gradio.FileData"}},
            STEPS,
            GUIDANCE_SCALE,
            1234,  # seed (ignored: randomize)
            OCTREE_RESOLUTION,
            NUM_CHUNKS,
            TARGET_FACE_NUM,
            True,  # randomize_seed
        ],
        "event_data": None,
        "fn_index": 1,
        "trigger_id": 1,
        "session_hash": session_hash,
    }
    r = session.post(f"{HOST}/queue/join", json=payload, timeout=60)
    r.raise_for_status()

    # 3. SSE result stream
    glb_url = None
    started = time.time()
    with session.get(
        f"{HOST}/queue/data",
        params={"session_hash": session_hash},
        stream=True,
        timeout=(30, timeout),
    ) as resp:
        resp.raise_for_status()
        event_name = None
        for raw_line in resp.iter_lines(decode_unicode=True):
            if time.time() - started > timeout:
                raise TimeoutError(f"SSE timeout after {timeout:.0f}s")
            if raw_line is None:
                continue
            line = raw_line.strip()
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
                continue
            if not line.startswith("data:"):
                continue
            data_str = line.split(":", 1)[1].strip()
            if not data_str:
                continue
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            msg = data.get("msg")
            if msg == "process_starts":
                log(f"  {png_path.name}: generation started")
            elif msg == "process_generating":
                pass  # progress events; ignore
            elif msg == "process_completed":
                out = data.get("output", {})
                if data.get("success") is False:
                    raise RuntimeError(f"space error: {str(out)[:300]}")
                # returns: [Output, Download, Glb Path] -> find a .glb file entry
                for entry in out.get("data", []):
                    cand = _extract_glb(entry)
                    if cand:
                        glb_url = cand
                        break
                if not glb_url:
                    raise RuntimeError(f"no glb in output: {json.dumps(out)[:400]}")
                break
            elif msg in ("queue_full",):
                raise RuntimeError("queue full")
            elif msg == "close_stream":
                break

    if not glb_url:
        raise RuntimeError("stream ended without result")

    # 4. download GLB
    if glb_url.startswith("/"):
        # /static/<uuid>/... is served directly; other server paths via /file=
        glb_url = f"{HOST}{glb_url}" if glb_url.startswith("/static/") else f"{HOST}/file={glb_url}"
    dest = OUT_DIR / (png_path.stem + ".glb")
    with session.get(glb_url, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                f.write(chunk)
    return dest


def _extract_glb(entry):
    """Find a GLB url inside a gradio output value (dict, list, or str)."""
    if isinstance(entry, dict):
        url = entry.get("url") or ""
        path = entry.get("path") or ""
        if ".glb" in url.lower() or ".glb" in path.lower():
            return url or path
        for v in entry.values():
            got = _extract_glb(v)
            if got:
                return got
    elif isinstance(entry, (list, tuple)):
        for v in entry:
            got = _extract_glb(v)
            if got:
                return got
    elif isinstance(entry, str) and ".glb" in entry.lower():
        return entry
    return None


def load_done() -> dict:
    done = {}
    if PROGRESS_FILE.exists():
        for line in PROGRESS_FILE.read_text().splitlines():
            try:
                rec = json.loads(line)
                if rec.get("status") == "ok":
                    done[rec["tile"]] = rec
            except json.JSONDecodeError:
                pass
    return done


def main():
    args = sys.argv[1:]
    host_key = "test"
    if args and args[0].startswith("--host="):
        host_key = args.pop(0).split("=", 1)[1]
    global HOST
    HOST = HOSTS[host_key]
    only = args or None
    tiles = sorted(SRC_DIR.glob("tile_*.png"))
    if only:
        tiles = [t for t in tiles if t.stem in only]
    OUT_DIR.mkdir(exist_ok=True)
    log(f"using host {host_key}: {HOST}")
    done = load_done()
    log(f"{len(tiles)} tiles requested, {len([t for t in tiles if t.stem in done])} already done")

    failures = []
    for i, tile in enumerate(tiles, 1):
        if tile.stem in done:
            log(f"({i}/{len(tiles)}) {tile.stem}: already done, skip")
            continue
        log(f"({i}/{len(tiles)}) {tile.stem}: submitting")
        ok = False
        for attempt in range(1, 4):
            try:
                dest = gen_one(tile)
                size = dest.stat().st_size
                log(f"  {tile.stem}: OK -> {dest.name} ({size/1024:.0f} KB)")
                with open(PROGRESS_FILE, "a") as f:
                    f.write(json.dumps({"tile": tile.stem, "status": "ok", "file": str(dest), "bytes": size}) + "\n")
                ok = True
                break
            except Exception as e:
                log(f"  {tile.stem}: attempt {attempt} failed: {str(e)[:200]}")
                time.sleep(10 * attempt)
        if not ok:
            failures.append(tile.stem)
            with open(PROGRESS_FILE, "a") as f:
                f.write(json.dumps({"tile": tile.stem, "status": "failed"}) + "\n")
        time.sleep(3)  # be polite to the shared space

    log(f"FINISHED. ok={len(tiles)-len(failures)}/{len(tiles)} failures={failures}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
