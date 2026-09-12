import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.CUTAWAY_PREVIEW_URL ?? 'http://127.0.0.1:5199';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw Error('UI tests only target a local preview');
const out = resolve('.logs/product-0.17.0');
mkdirSync(out, { recursive: true });
const executablePath = process.env.CUTAWAY_CHROME ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--force-color-profile=srgb'] });
const report = { screens: [], interactions: [], errors: [] };

function initialize({ locale, mode }) {
  localStorage.setItem('cutaway.settings.v1', JSON.stringify({ state: { locale, mode, onboarded: true }, version: 0 }));
  const ids = new WeakMap();
  let id = 0;
  window.__cutawayDraws = {};
  for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = type.prototype[name];
      if (!original) continue;
      type.prototype[name] = function (...args) {
        if (!ids.has(this)) { ids.set(this, ++id); window.__cutawayDraws[id] = { count: 0, canvas: this.canvas }; }
        window.__cutawayDraws[ids.get(this)].count++;
        return original.apply(this, args);
      };
    }
  }
}

async function contrast(page, name) {
  const failures = await page.evaluate(() => {
    const parse = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * (top[3] ?? 1) + bottom[i] * (1 - (top[3] ?? 1))).concat(1);
    const background = (element) => {
      const chain = [];
      for (let node = element; node; node = node.parentElement) chain.unshift(parse(getComputedStyle(node).backgroundColor));
      return chain.reduce((sum, color) => color.length >= 3 ? over(color, sum) : sum, [255, 255, 255, 1]);
    };
    const lum = (rgb) => rgb.slice(0, 3).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    return [...document.querySelectorAll('div,span,p')].filter((element) => {
      if (element.children.length || !/[A-Za-z0-9]/.test(element.textContent) || !element.clientWidth) return false;
      if (element.closest('[aria-disabled="true"]')) return false;
      for (let p = element; p; p = p.parentElement) if (Number(getComputedStyle(p).opacity) < 1) return false;
      return true;
    }).map((element) => {
      const style = getComputedStyle(element), bg = background(element), fg = over(parse(style.color), bg);
      const ratio = (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      return { text: element.textContent.trim().slice(0, 80), ratio: +ratio.toFixed(2), required: large ? 3 : 4.5 };
    }).filter((item) => item.ratio < item.required);
  });
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  report.screens.push({ name, lowContrast: failures });
  assert.deepEqual(failures, [], `${name}: active text must be readable`);
}

const draws = (page) => page.evaluate(() => Object.entries(window.__cutawayDraws).map(([id, value]) => ({
  id, count: value.count, width: value.canvas.getBoundingClientRect().width, height: value.canvas.getBoundingClientRect().height,
})));
async function readyModel(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => c.getBoundingClientRect().width > 0)
    && !/(Loading |Memuat )/.test(document.body.innerText), null, { timeout: 90000 });
}

try {
  for (const [locale, mode, width] of [['en', 'light', 390], ['id', 'light', 360], ['en', 'dark', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    await context.addInitScript(initialize, { locale, mode });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle', timeout: 180000 });
    const input = page.getByRole('textbox', { name: locale === 'id' ? 'Cari objek…' : 'Search objects…' });
    await input.waitFor();
    const icons = page.locator('[aria-label^="3D model preview"], [aria-label^="Pratinjau model 3D"]');
    assert.equal(await icons.count(), 28);
    await contrast(page, `library-${locale}-${mode}-${width}`);
    await input.fill(locale === 'id' ? '  HELIKOPTER  ' : '  HELICOPTER  ');
    await page.waitForFunction(() => document.querySelectorAll('[aria-label^="3D model preview"], [aria-label^="Pratinjau model 3D"]').length === 1);
    assert.equal(await icons.count(), 1);
    await contrast(page, `search-${locale}-${mode}`);
    await input.fill('zzzz-no-matching-object');
    await page.getByText(locale === 'id' ? 'Objek tidak ditemukan' : 'No matching objects', { exact: true }).waitFor();
    assert.equal(await icons.count(), 0);
    await page.getByRole('button', { name: locale === 'id' ? 'Tampilkan semua objek' : 'Show all objects' }).click();
    assert.equal(await icons.count(), 28);
    await input.blur();

    if (locale === 'en' && mode === 'light') {
      await page.getByRole('button', { name: /^Turboshaft Helicopter\./ }).click();
      await readyModel(page);
      await contrast(page, 'helicopter-light');
      await page.getByRole('button', { name: 'How it works', exact: true }).click();
      await page.getByRole('button', { name: 'Close How it works', exact: true }).waitFor();
      await page.waitForTimeout(450); // Let the sheet's documented enter animation finish.
      const beforeStory = await draws(page);
      await page.waitForTimeout(1200); // A measured quiet interval, not a readiness assumption.
      const afterStory = await draws(page);
      assert.deepEqual(afterStory, beforeStory, 'Covered viewer must not draw');
      report.interactions.push({ case: 'covered viewer', before: beforeStory, after: afterStory });
      await contrast(page, 'story-light');
      await page.getByRole('button', { name: 'Close How it works', exact: true }).click();
      await page.getByRole('button', { name: 'Quiz', exact: true }).click();
      await readyModel(page);
      await page.waitForFunction(() => Object.values(window.__cutawayDraws).filter((d) => d.canvas.getBoundingClientRect().width > 0).length === 1
        && Object.values(window.__cutawayDraws).some((d) => d.canvas.getBoundingClientRect().width === 0));
      const beforeQuiz = await draws(page);
      await page.waitForTimeout(1200);
      const afterQuiz = await draws(page);
      for (const hidden of beforeQuiz.filter((d) => d.width === 0)) {
        assert.equal(afterQuiz.find((d) => d.id === hidden.id).count, hidden.count, 'Previous viewer must stop behind quiz');
      }
      report.interactions.push({ case: 'previous viewer behind quiz', before: beforeQuiz, after: afterQuiz });
      await page.getByRole('button', { name: 'Leave quiz', exact: true }).click();
      await readyModel(page);
      const resumed = await draws(page);
      await page.waitForFunction((previous) => Object.entries(window.__cutawayDraws).some(([id, d]) => d.canvas.getBoundingClientRect().width > 0
        && d.count > (previous.find((p) => p.id === id)?.count ?? 0)), resumed, { timeout: 10000 });
      report.interactions.push({ case: 'viewer resumes on return', passed: true });
      await page.goto(`${base}/object/earth-observation-satellite`, { waitUntil: 'networkidle' });
      await readyModel(page);
      await contrast(page, 'satellite-light');
      await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
      await contrast(page, 'settings-light');
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ passed: true, screens: report.screens.length, interactions: report.interactions, errors: report.errors }, null, 2));
} catch (error) {
  report.errors.push(error.stack);
  process.exitCode = 1;
  console.error(error);
} finally {
  writeFileSync(resolve(out, 'ui-results.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
