// Probe: print each mesh's world-space bounding box from the live Model Lab page.
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://localhost:5173';
const model = process.argv[3] ?? 'matter';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.goto(`${origin}/model-lab.html?ui=0&grid=0&model=${model}&bg=none`, { waitUntil: 'networkidle' });
await page.waitForFunction((id) => document.body.dataset.modelReady === id, model, { timeout: 15_000 });
await page.waitForTimeout(300);

const boxes = await page.evaluate(() => {
  const out = [];
  const canvases = document.querySelectorAll('canvas');
  // ModelViewer instance is reachable through the react root's fiber tree; simpler: hook THREE
  // is not exposed. Fall back: the viewer stores nothing global, so use window.__viewer if set.
  const viewer = window.__viewer;
  if (!viewer) return { error: 'no window.__viewer' };
  viewer.root.updateWorldMatrix(true, true);
  viewer.root.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.computeBoundingBox();
      const bb = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
      out.push({
        name: obj.userData?.sculptComponent?.id ?? obj.name ?? '(mesh)',
        min: bb.min.toArray().map((v) => +v.toFixed(3)),
        max: bb.max.toArray().map((v) => +v.toFixed(3)),
        visible: obj.visible,
      });
    }
  });
  return out;
});
console.log(JSON.stringify(boxes, null, 1));
await browser.close();
