#!/usr/bin/env node
/**
 * Screenshots the running game from the production build, for art review.
 *
 *   npm run build && node scripts/capture-scene.mjs [--scenario showcase] [--out art/review]
 *
 * Runs headed because the WebGL look depends on real GPU compositing; headless Chromium falls
 * back to SwiftShader and produces a picture that is not what a player sees.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};
const scenario = flag('scenario', 'showcase');
const outDir = flag('out', 'art/review');
const zooms = Number(flag('zooms', 3));
const PORT = 4322;

async function startPreview() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', () => {});
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return server; } catch { /* not up yet */ }
    await delay(500);
  }
  server.kill('SIGTERM');
  throw new Error('preview server did not start');
}

const { chromium } = await import('playwright');
await mkdir(outDir, { recursive: true });
const server = await startPreview();
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (error) => console.error('pageerror:', error.message));
  await page.goto(`http://localhost:${PORT}/?scenario=${scenario}`, { waitUntil: 'load' });
  await page.waitForSelector('.main-menu', { timeout: 15_000 });
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.waitForSelector('.hud', { timeout: 20_000 });
  await delay(3000);

  const canvas = page.locator('canvas.game-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < zooms; step += 1) {
    const name = `${outDir}/${scenario}-zoom${step}.png`;
    await page.screenshot({ path: name });
    console.log(name);
    await page.mouse.wheel(0, -400);
    await delay(900);
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
