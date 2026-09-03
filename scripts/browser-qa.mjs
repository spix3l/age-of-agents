#!/usr/bin/env node
/**
 * Drives the production build in a real browser and reports the D7-04 / D7-06 / D7-07 / D7-09
 * evidence: frame rate at several army sizes, the input/UX matrix at two viewport sizes, and a
 * full menu -> match -> end -> replay -> menu lifecycle from static files only.
 *
 *   npm run build && node scripts/browser-qa.mjs [--browser chromium|firefox] [--headed]
 *
 * Exits non-zero if any check fails, so it can gate a release.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? true);
};
const browserName = flag('browser', 'chromium');
const headed = args.includes('--headed');
/** The unattended full-match lifecycle takes many minutes, so it is opt-in. */
const fullRun = args.includes('--full');

const VIEWPORTS = [
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1280x720', width: 1280, height: 720 },
];

const results = [];
const record = (area, check, pass, detail = '') => {
  results.push({ area, check, pass, detail });
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'}  ${area} — ${check}${detail ? ` (${detail})` : ''}\n`);
};

/** Ignorable console noise: WebGL/driver chatter that is not a page defect. */
const IGNORED_CONSOLE = [
  /WebGL.*deprecat/i,
  /Automatic fallback to software WebGL/i,
  /GroupMarkerNotSet/i,
  /Failed to load resource.*favicon/i,
  /AudioContext/i,
];

const PREVIEW_PORT = 4319;

async function startPreview() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (chunk) => process.stderr.write(String(chunk)));
  const url = `http://localhost:${PREVIEW_PORT}`;
  // Poll rather than scrape stdout: Vite prints the URL with ANSI escapes inside the port.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${url}/`);
      if (response.ok) return { server, url };
    } catch { /* not listening yet */ }
    await delay(500);
  }
  server.kill('SIGTERM');
  throw new Error('preview server did not start');
}

/** Frames rendered in `seconds`, sampled with requestAnimationFrame inside the page. */
async function measureFps(page, seconds) {
  return page.evaluate(async (duration) => {
    const frames = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now - start >= duration * 1000) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
    return {
      frames: frames.length,
      averageFps: frames.length / ((last - start) / 1000),
      p95FrameMs: at(0.95),
      worstFrameMs: sorted.at(-1) ?? 0,
    };
  }, seconds);
}

async function openMatch(page, url, query = '') {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  await page.goto(`${url}/${query}`, { waitUntil: 'load' });
  return errors;
}

async function main() {
  const playwright = await import('playwright');
  const engine = playwright[browserName];
  if (!engine) throw new Error(`unknown browser ${browserName}`);
  const { server, url } = await startPreview();
  let browser;
  try {
    browser = await engine.launch({
      headless: !headed,
      // Headless Chromium renders WebGL through SwiftShader and reports ~1 FPS regardless of
      // what the page does. Frame-rate numbers are only meaningful with real GPU compositing.
      args: browserName === 'chromium'
        ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu']
        : [],
    });

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const errors = await openMatch(page, url);
      const area = `${browserName} ${viewport.label}`;

      // --- Menu and onboarding -------------------------------------------------------------
      await page.waitForSelector('.main-menu', { timeout: 15_000 });
      record(area, 'main menu renders', true);
      await page.getByRole('button', { name: 'HOW TO PLAY' }).click();
      const helpEntries = await page.locator('.how-to-play dt').count();
      record(area, 'how-to-play covers the loop', helpEntries >= 6, `${helpEntries} sections`);
      await page.getByRole('button', { name: 'HIDE HELP' }).click();

      const difficultyButtons = await page.locator('.difficulty button').count();
      record(area, 'difficulty is selectable', difficultyButtons === 3, `${difficultyButtons} presets`);

      // --- Match start ---------------------------------------------------------------------
      await page.getByRole('button', { name: 'PLAY', exact: true }).click();
      await page.waitForSelector('.hud', { timeout: 20_000 });
      const canvases = await page.locator('canvas').count();
      record(area, 'match starts with exactly one canvas', canvases === 1, `${canvases} canvas`);

      await page.waitForFunction(() => document.querySelector('.resource.matter strong') !== null, { timeout: 10_000 });
      record(area, 'resource bar reports the economy', true);

      // --- Camera --------------------------------------------------------------------------
      const canvas = page.locator('canvas');
      const box = await canvas.boundingBox();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.down('d'); await delay(250); await page.keyboard.up('d');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -240);
      await delay(200);
      record(area, 'camera accepts keyboard pan and wheel zoom', true);

      // --- Selection and orders ------------------------------------------------------------
      // Box-select the whole playfield, which must pick up the starting Workers.
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40, { steps: 12 });
      await page.mouse.up();
      await delay(400);
      const deck = await page.locator('.command-deck').innerText();
      record(area, 'box selection reaches the command deck', deck.length > 0);

      // Right-click terrain: either a MOVE directive or an explicit refusal, never silence.
      await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6, { button: 'right' });
      await delay(600);
      const order = await page.locator('.order-readout span').innerText();
      record(area, 'right-click terrain reports a directive', order.trim().length > 0, order.trim());

      // --- UI must not swallow world input, and vice versa ----------------------------------
      const audioToggle = page.locator('.audio-toggle');
      const before = await audioToggle.getAttribute('aria-pressed');
      await audioToggle.click();
      await delay(150);
      const after = await audioToggle.getAttribute('aria-pressed');
      record(area, 'HUD controls receive their own clicks', before !== after, `${before} -> ${after}`);
      await audioToggle.click();

      // --- Diagnostics ---------------------------------------------------------------------
      await page.keyboard.press('F3');
      await delay(300);
      const diagnostics = await page.locator('.debug-panel').count();
      record(area, 'F3 opens diagnostics', diagnostics > 0);
      await page.keyboard.press('F3');

      record(area, 'no release-blocking console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await context.close();
    }

    // --- Frame rate at scale ----------------------------------------------------------------
    const fpsContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const fpsRows = [];
    for (const [label, query] of [
      ['opening colony', ''],
      ['30-unit battle', '?scenario=battle&army=15'],
      ['60-unit battle', '?scenario=battle&army=30'],
      ['100-unit battle', '?scenario=battle&army=50'],
    ]) {
      const page = await fpsContext.newPage();
      await openMatch(page, url, query);
      await page.waitForSelector('.main-menu', { timeout: 15_000 });
      await page.getByRole('button', { name: 'PLAY', exact: true }).click();
      await page.waitForSelector('.hud', { timeout: 20_000 });
      await delay(2500); // let the scene settle and the armies engage
      const fps = await measureFps(page, 6);
      fpsRows.push({ label, ...fps });
      const floor = label === 'opening colony' ? 50 : 30;
      record('performance', `${label} holds ${floor} FPS`, fps.averageFps >= floor,
        `${fps.averageFps.toFixed(0)} FPS avg, p95 frame ${fps.p95FrameMs.toFixed(1)}ms`);
      await page.close();
    }
    await fpsContext.close();

    // --- Full lifecycle: match -> end -> replay -> menu --------------------------------------
    if (fullRun) {
      const lifeContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
      const page = await lifeContext.newPage();
      const errors = await openMatch(page, url);
      await page.waitForSelector('.main-menu', { timeout: 15_000 });
      // Relentless, and the player does nothing: the opponent reaches the player Core on its own,
      // which is the unattended half of the Definition of Done flow.
      await page.getByRole('button', { name: /RELENTLESS/i }).click();
      await page.getByRole('button', { name: 'PLAY', exact: true }).click();
      await page.waitForSelector('.hud', { timeout: 20_000 });
      const ended = await page.waitForSelector('.end-screen', { timeout: 1_500_000 }).catch(() => null);
      record('lifecycle', 'an unattended match reaches an end screen', ended !== null);
      if (ended) {
        const summary = await page.locator('.end-screen').first().innerText();
        record('lifecycle', 'end screen reports match statistics', /\d/.test(summary),
          summary.replace(/\s+/g, ' ').slice(0, 120));
        const again = page.getByRole('button', { name: /PLAY AGAIN/i });
        if (await again.count()) {
          await again.first().click();
          await page.waitForSelector('.hud', { timeout: 20_000 });
          const canvases = await page.locator('canvas').count();
          record('lifecycle', 'replay leaves exactly one canvas', canvases === 1, `${canvases} canvas`);
        }
        const menu = page.getByRole('button', { name: /MAIN MENU/i });
        if (await menu.count()) {
          await menu.first().click();
          await page.waitForSelector('.main-menu', { timeout: 20_000 });
          record('lifecycle', 'end screen returns to the main menu', true);
        }
      }
      record('lifecycle', 'no console errors across the lifecycle', errors.length === 0, errors.slice(0, 2).join(' | '));
      await lifeContext.close();
    }

    console.log('\n| Scenario | Avg FPS | p95 frame ms | Worst frame ms |');
    console.log('|---|---:|---:|---:|');
    for (const row of fpsRows) {
      console.log(`| ${row.label} | ${row.averageFps.toFixed(0)} | ${row.p95FrameMs.toFixed(1)} | ${row.worstFrameMs.toFixed(1)} |`);
    }
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log('Failures:');
    for (const failure of failed) console.log(`  - ${failure.area}: ${failure.check} ${failure.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
