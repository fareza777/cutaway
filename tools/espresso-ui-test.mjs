// Real exported-app acceptance test; uses an isolated headless profile and
// localhost only. Never touches Play Console, AdMob, purchases or user settings.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(process.env.CUTAWAY_E2E_ROOT ?? 'dist/espresso-web');
const out = resolve('.shots/espresso-machine/ui');
assert.ok(existsSync(resolve(root, 'index.html')), 'Export the app to dist/espresso-web before running this test');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    const local = relative(root, file);
    if (local.startsWith('..') || isAbsolute(local)) { res.writeHead(403).end(); return; }
    if (!extname(file)) file = resolve(root, 'index.html');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const report = { source: root, errors: [], checks: [], screenshots: [] };
let browser, page;
async function shot(name) {
  await page.evaluate(() => document.fonts.ready);
  // Camera and sheet transitions finish on frames, not an arbitrary sleep.
  await page.evaluate(() => new Promise((done) => {
    let frames = 0;
    const frame = () => ++frames >= 45 ? done() : requestAnimationFrame(frame);
    requestAnimationFrame(frame);
  }));
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  report.screenshots.push(name);
}
async function ready(title) {
  // Expo Router retains the previous screen; ignore its hidden catalog title.
  await page.getByText(title, { exact: true }).filter({ visible: true }).first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.clientWidth > 0) && !/(Loading |Memuat )/.test(document.body.innerText));
}
async function checkLocale(locale) {
  const id = locale === 'id';
  const title = id ? 'Mesin Espresso' : 'Espresso Machine';
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: id ? 'Cari objek…' : 'Search objects…' }).fill('espresso');
  const card = page.getByRole('button', { name: new RegExp(`^${title}\\.`) });
  await card.waitFor({ timeout: 4000 });
  assert.match(await card.innerText(), /37/);
  await shot(`${locale}-library`);
  await card.click();
  await ready(title);
  await page.getByRole('button', { name: id ? 'Aktifkan atau nonaktifkan rotasi otomatis' : 'Toggle auto-rotate', exact: true }).click();
  await page.getByRole('button', { name: id ? 'Atur ulang tampilan' : 'Reset view', exact: true }).click();
  await shot(`${locale}-exterior`);
  await page.getByRole('button', { name: id ? 'Jalankan' : 'Run', exact: true }).click();
  await page.getByRole('button', { name: id ? 'Jeda' : 'Pause', exact: true }).waitFor();
  await page.getByRole('button', { name: id ? 'Jeda' : 'Pause', exact: true }).click();
  await page.getByRole('button', { name: id ? 'Jalankan' : 'Run', exact: true }).waitFor();
  await page.getByRole('button', { name: id ? 'Kupas' : 'Peel', exact: true }).click();
  const peelLabel = page.getByText(id ? 'Kupas lapisan' : 'Peel away layers', { exact: true });
  const slider = await peelLabel.locator('..').locator('..').boundingBox();
  await page.mouse.click(slider.x + slider.width * 0.39, slider.y + slider.height - 17);
  await shot(`${locale}-peeled`);
  await page.getByRole('button', { name: id ? 'Bagian' : 'Parts', exact: true }).click();
  const boilerName = id ? 'Badan Boiler Kuningan' : 'Brass Boiler Body';
  await page.getByText(boilerName, { exact: true }).click();
  await page.getByRole('button', { name: id ? /Selengkapnya/ : /Read more/ }).click();
  await page.getByText(id ? /^Boiler menyimpan sedikit air/ : /^The boiler contains a relatively small volume/).waitFor();
  await shot(`${locale}-boiler-detail`);
  await page.goto(`${base}/object/espresso-machine`, { waitUntil: 'networkidle' });
  await ready(title);
  await page.getByRole('button', { name: id ? 'Cara kerja' : 'How it works', exact: true }).click();
  await page.getByRole('button', { name: /^Step 8:/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Step [1-8]:/ }).count(), 8);
  await page.getByRole('button', { name: /^Step 8:/ }).click();
  await page.getByText(id ? '8 · Pahami keseluruhan sistem' : '8 · See the complete system', { exact: true }).scrollIntoViewIfNeeded();
  await shot(`${locale}-guide`);
  await page.goto(`${base}/quiz/espresso-machine`, { waitUntil: 'networkidle' });
  await page.getByText(id ? 'Temukan ruang tempat air dipanaskan sebelum penyeduhan.' : 'Find the chamber where water is heated before brewing.', { exact: true }).waitFor();
  await page.getByText(id ? 'Soal 1 dari 10' : 'Question 1 of 10', { exact: true }).waitFor();
  await shot(`${locale}-quiz`);
  report.checks.push(`${locale}: search, 37-part card, model load, animation, peel, boiler detail, eight-step guide and ten-question quiz`);
  console.log(`PASS ${report.checks.at(-1)}`);
}
try {
  await mkdir(out, { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CUTAWAY_CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  await context.addInitScript(() => {
    if (!localStorage.getItem('cutaway.settings.v1')) localStorage.setItem('cutaway.settings.v1', JSON.stringify({ state: { locale: 'en', mode: 'light', onboarded: true }, version: 0 }));
  });
  page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await checkLocale('en');
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: /Bahasa Indonesia/ }).click();
  await page.getByRole('button', { name: 'Kembali', exact: true }).waitFor();
  await checkLocale('id');
  assert.deepEqual(report.errors, [], 'The real app must not emit uncaught runtime errors');
  report.checks.push('Language changed through the actual Settings screen and persisted across navigation');
  console.log('PASS Settings language switch and no uncaught app errors');
} catch (error) {
  if (page) await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((done) => server.close(done));
}
