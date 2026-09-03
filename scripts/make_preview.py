#!/usr/bin/env python3
"""Build a self-contained three.js preview HTML for a GLB (data-URI embedded).

Usage: python3 make_preview.py <glb-path> [out-html]
Writes preview HTML next to the GLB and prints the path. Open with file://
"""
import base64
import sys
from pathlib import Path

glb = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else glb.with_suffix(".preview.html")
b64 = base64.b64encode(glb.read_bytes()).decode()

HTML = """<!doctype html>
<html>
<head><meta charset="utf-8"><title>__TITLE__</title>
<script type="importmap">
{"imports": {"three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js"}}
</script>
<style>body{margin:0;background:#22262e}canvas{display:block}</style>
</head>
<body>
<script>
window.__stats = {state: "loading"};
window.addEventListener('error', e => { window.__stats = {state: "error", error: String(e.error || e.message)}; });
window.addEventListener('unhandledrejection', e => { window.__stats = {state: "error", error: String(e.reason)}; });
</script>
<script type="module">
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x22262e);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
renderer.setPixelRatio(1);
renderer.setSize(512, 512);
document.body.appendChild(renderer.domElement);
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2, 4, 2);
scene.add(key, new THREE.AmbientLight(0xffffff, 1.1));

const b64 = "__B64__";
const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
new GLTFLoader().parse(bytes.buffer, "", (gltf) => {
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  const radius = Math.max(size.x, size.y, size.z);
  const qy = new URLSearchParams(location.search).get("yaw");
  const qp = new URLSearchParams(location.search).get("pitch");
  const qd = new URLSearchParams(location.search).get("dist");
  if (qy !== null && qp !== null) {
    const yaw = parseFloat(qy) * Math.PI / 180, pitch = parseFloat(qp) * Math.PI / 180;
    const dist = qd !== null ? parseFloat(qd) : radius * 2.2;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(radius * 1.1, radius * 1.2, radius * 1.6);
    camera.lookAt(0, 0, 0);
  }
  scene.add(obj);
  renderer.render(scene, camera);
  window.__stats = {state: "ok", size: [size.x, size.y, size.z].map(v => +v.toFixed(2))};
  // ---- verification hook: top-down 8x8 mean-color grid (unlit, baked colors only) ----
  window.__grid = (gridN) => {
    const orig = new Map();
    obj.traverse(o => {
      if (o.isMesh) {
        orig.set(o, o.material);
        o.material = new THREE.MeshBasicMaterial({map: o.material.map, vertexColors: !!o.geometry.attributes.color, side: THREE.DoubleSide});
      }
    });
    const wb = new THREE.Box3().setFromObject(obj);
    const wc = wb.getCenter(new THREE.Vector3()), ws = wb.getSize(new THREE.Vector3());
    const maxDim = Math.max(ws.x, ws.y, ws.z);
    const fitDist = (maxDim / 2) / Math.tan((45 * Math.PI / 180) / 2) * 1.05;
    const cam2 = new THREE.PerspectiveCamera(45, 1, 0.001, 1000);
    cam2.position.set(wc.x, wc.y + fitDist, wc.z + fitDist * 0.001);
    cam2.up.set(0, 0, -1);
    cam2.lookAt(wc.x, wc.y, wc.z);
    renderer.render(scene, cam2);
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const grid = [];
    for (let gy = 0; gy < gridN; gy++) {
      const row = [];
      for (let gx = 0; gx < gridN; gx++) {
        let r = 0, g = 0, b = 0, n = 0;
        const xs = Math.floor(gx * w / gridN), xe = Math.floor((gx + 1) * w / gridN);
        const ys = Math.floor(gy * h / gridN), ye = Math.floor((gy + 1) * h / gridN);
        for (let y = ys; y < ye; y += 2) {
          for (let x = xs; x < xe; x += 2) {
            const i = (y * w + x) * 4;
            const isBg = Math.abs(px[i] - 34) < 8 && Math.abs(px[i+1] - 38) < 8 && Math.abs(px[i+2] - 46) < 8;
            if (!isBg && px[i+3] > 10) { r += px[i]; g += px[i+1]; b += px[i+2]; n++; }
          }
        }
        row.push(n >= 3 ? [Math.round(r/n), Math.round(g/n), Math.round(b/n)] : null);
      }
      grid.push(row);
    }
    renderer.render(scene, camera); // restore beauty view
    for (const [mesh, mat] of orig) mesh.material = mat;
    return grid;
  };
  // ---- beauty-shot export: returns downscaled PNG data URL ----
  window.__shot = () => {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c2 = document.createElement('canvas');
    c2.width = 256; c2.height = 256;
    c2.getContext('2d').drawImage(src, 0, 0, 256, 256);
    return c2.toDataURL('image/png');
  };
}, (err) => { window.__stats = {state: "error", error: String(err)}; });
</script>
</body>
</html>
"""

html = HTML.replace("__TITLE__", glb.stem).replace("__B64__", b64)
out.write_text(html)
print(out)
