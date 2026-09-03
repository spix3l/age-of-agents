#!/usr/bin/env node
// Screenshots one model from the Model Lab at a fixed camera, for art review and for the
// img2threejs review gates (which compare a render against art/models/<id>.png).
//
//   node scripts/capture-model.mjs --model core --az 0 --az 90 --az 180 --az 270 --out shots/
//
// Assumes `npm run dev` is already serving; pass --url to point at another origin.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const many = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const one = (flag, fallback) => (many(flag)[0] ?? fallback);

const model = one('--model');
if (!model) {
  console.error('usage: capture-model.mjs --model <id> [--az <deg>]... [--el <deg>] [--zoom <n>] [--out <dir>] [--url <origin>]');
  process.exit(2);
}
const origin = one('--url', 'http://localhost:5200');
const outDir = one('--out', 'art/renders');
const el = one('--el', '28');
const zoom = one('--zoom', '1');
const azimuths = many('--az').length ? many('--az') : ['35'];
const size = Number(one('--size', '1024'));
// --maps 0 renders every mesh in one neutral matte, which is what the blockout gate wants.
const maps = one('--maps', '1');
// --bg none renders on transparent, which is what the review gates need to segment the subject.
const bg = one('--bg', '');
// --cam ortho renders with an orthographic camera, matching the flat sheet-cell references.
const cam = one('--cam', '');

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 2 });
const failures = [];
page.on('pageerror', (error) => failures.push(String(error)));
page.on('console', (message) => message.type() === 'error' && failures.push(message.text()));

for (const az of azimuths) {
  const url = `${origin}/model-lab.html?ui=0&grid=0&model=${model}&az=${az}&el=${el}&zoom=${zoom}&maps=${maps}${bg ? `&bg=${encodeURIComponent(bg)}` : ''}${cam ? `&cam=${encodeURIComponent(cam)}` : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  // The lab stamps the body once the model is in the scene, so this waits on the render, not a clock.
  await page.waitForFunction((id) => document.body.dataset.modelReady === id, model, { timeout: 15_000 });
  await page.waitForTimeout(400);
  const file = join(outDir, `${model}${maps === '0' ? '-flat' : ''}-az${az}.png`);
  await page.screenshot({ path: file, omitBackground: bg === 'none' });
  console.log(file);
}

await browser.close();
if (failures.length) {
  console.error('page errors:', failures.slice(0, 5));
  process.exit(1);
}
