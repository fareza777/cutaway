import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'content');
const MANIFEST_FILE = resolve(ROOT, 'tools/shots/manifest.json');
const ICONS = resolve(ROOT, 'assets/object-icons');
const METRICS_FILE = resolve(ROOT, 'tools/object-icon-metrics.json');
const CONTACT_SHEET = resolve(
  ROOT,
  '.superpowers/sdd/2026-08-18-cutaway-014-aerospace-objects/task-3-icon-contact-sheet.png',
);
const PORT = 5186;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const EXPECTED_COUNT = 28;
const REQUESTED_IDS = (process.env.CUTAWAY_ICON_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

async function loadCatalog() {
  const files = (await readdir(CONTENT)).filter((name) => name.endsWith('.json')).sort();
  const docs = await Promise.all(files.map(async (file) => {
    const doc = JSON.parse(await readFile(resolve(CONTENT, file), 'utf8'));
    if (!doc.id || !doc.model || !doc.accent) throw new Error(`${file} is missing id, model, or accent`);
    if (file !== `${doc.id}.json`) throw new Error(`${file} does not match content id ${doc.id}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.id)) throw new Error(`unsafe content id: ${doc.id}`);
    return { id: doc.id, model: doc.model, accent: doc.accent };
  }));
  const manifest = JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
  const ids = docs.map((doc) => doc.id);
  const models = docs.map((doc) => doc.model);
  if (docs.length !== EXPECTED_COUNT || new Set(ids).size !== EXPECTED_COUNT || new Set(models).size !== EXPECTED_COUNT) {
    throw new Error(`expected ${EXPECTED_COUNT} unique content/model IDs, found ${docs.length}`);
  }
  const manifestModels = Object.keys(manifest).sort();
  if (JSON.stringify([...models].sort()) !== JSON.stringify(manifestModels)) {
    throw new Error('shots manifest model IDs do not exactly match the content registry inputs');
  }
  return { docs, manifest };
}

function chromeExecutable() {
  const candidates = [
    process.env.CUTAWAY_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    chromium.executablePath(),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error('Chrome/Edge not found; set CUTAWAY_CHROME_PATH');
  return executable;
}

function startPreviewServer() {
  const output = [];
  const child = spawn(process.execPath, ['tools/preview-server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, CUTAWAY_PREVIEW_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const remember = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 20) output.shift();
  };
  child.stdout.on('data', remember);
  child.stderr.on('data', remember);
  child.previewOutput = output;
  return child;
}

async function waitForPreview(child) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`preview server exited ${child.exitCode}: ${child.previewOutput.join('').trim()}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(700) });
      if (response.ok && await response.text() === 'ok') return;
    } catch {
      // The bounded retry below also covers the short interval before listen().
    }
    await wait(100);
  }
  throw new Error(`preview server was not ready within 12s: ${child.previewOutput.join('').trim()}`);
}

async function stopPreview(child) {
  if (!child || child.exitCode !== null) return;
  const pid = child.pid;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  const stopped = await Promise.race([exited.then(() => true), wait(4_000).then(() => false)]);
  if (!stopped && child.exitCode === null) {
    child.kill('SIGKILL');
    const forced = await Promise.race([exited.then(() => true), wait(4_000).then(() => false)]);
    if (!forced && child.exitCode === null) throw new Error(`could not stop preview server pid ${pid}`);
  }
  console.log(`stopped preview pid ${pid}`);
}

async function createContactSheet(page, docs) {
  const cards = docs.map(({ id }) => `
    <figure>
      <div class="tile"><img src="${BASE_URL}/assets/object-icons/${id}.png" alt="${id}"></div>
      <figcaption>${id}</figcaption>
    </figure>`).join('');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setContent(`<!doctype html>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 28px; background: #07090d; color: #e7ecf4; font: 14px/1.3 system-ui, sans-serif; }
      h1 { margin: 0 0 22px; font-size: 24px; }
      main { display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
      figure { margin: 0; min-width: 0; }
      .tile { aspect-ratio: 1; border: 1px solid #313947; border-radius: 18px; overflow: hidden;
        background-color: #151a22;
        background-image: linear-gradient(45deg, #1e2530 25%, transparent 25%), linear-gradient(-45deg, #1e2530 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e2530 75%), linear-gradient(-45deg, transparent 75%, #1e2530 75%);
        background-size: 24px 24px; background-position: 0 0, 0 12px, 12px -12px, -12px 0;
        display: grid; place-items: center; }
      img { width: 100%; height: 100%; object-fit: contain; }
      figcaption { padding: 7px 3px 0; color: #aeb8c7; text-align: center; }
    </style>
    <h1>Cutaway object icons · ${docs.length} shipped GLBs</h1>
    <main>${cards}</main>`, { waitUntil: 'load' });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth === 256));
  await mkdir(dirname(CONTACT_SHEET), { recursive: true });
  await page.screenshot({ path: CONTACT_SHEET, fullPage: true });
}

async function verifyOutputSet(docs) {
  const actual = (await readdir(ICONS)).filter((name) => name.endsWith('.png')).sort();
  const expected = docs.map(({ id }) => `${id}.png`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`icon output set mismatch\nexpected: ${expected.join(', ')}\nactual: ${actual.join(', ')}`);
  }
  for (const file of actual) {
    const info = await stat(resolve(ICONS, file));
    if (!info.isFile() || info.size < 512) throw new Error(`${file} is empty or implausibly small`);
  }
}

const { docs } = await loadCatalog();
const requested = new Set(REQUESTED_IDS);
if (requested.size !== REQUESTED_IDS.length) throw new Error('CUTAWAY_ICON_IDS contains duplicates');
const unknownRequested = REQUESTED_IDS.filter((id) => !docs.some((doc) => doc.id === id));
if (unknownRequested.length) throw new Error(`unknown CUTAWAY_ICON_IDS: ${unknownRequested.join(', ')}`);
const captureDocs = requested.size ? docs.filter((doc) => requested.has(doc.id)) : docs;
await mkdir(ICONS, { recursive: true });
const preview = startPreviewServer();
let browser;

try {
  await waitForPreview(preview);
  console.log(`preview ready pid ${preview.pid}`);
  browser = await chromium.launch({
    executablePath: chromeExecutable(),
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--use-angle=swiftshader',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60_000);
  const metrics = requested.size && existsSync(METRICS_FILE)
    ? JSON.parse(await readFile(METRICS_FILE, 'utf8'))
    : {};

  console.log(`capturing ${captureDocs.length}/${docs.length} icon(s)`);
  for (const doc of captureDocs) {
    const query = new URLSearchParams({
      icon: '1',
      id: doc.id,
      model: doc.model,
      accent: doc.accent,
    });
    await page.goto(`${BASE_URL}/?${query}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForFunction(() => window.previewReady === true && typeof window.captureIcon === 'function');
    const metric = await page.evaluate(() => window.captureIcon());
    metrics[doc.id] = metric;
    const width = Math.round(metric.bounds.width / 2.56);
    const height = Math.round(metric.bounds.height / 2.56);
    console.log(`${doc.id.padEnd(20)} ${String(width).padStart(2)}×${String(height).padStart(2)}%`);
  }

  await verifyOutputSet(docs);
  if (JSON.stringify(Object.keys(metrics).sort()) !== JSON.stringify(docs.map((doc) => doc.id).sort())) {
    throw new Error('icon metrics set does not exactly match the 28-object catalog');
  }
  await writeFile(METRICS_FILE, `${JSON.stringify(metrics, null, 2)}\n`);
  await createContactSheet(page, docs);
  console.log(`metrics: ${METRICS_FILE}`);
  console.log(`contact sheet: ${CONTACT_SHEET}`);
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    await stopPreview(preview);
  }
}
