// Local developer render review only. Owns and closes its server and browser.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const port = 5187;
const url = `http://127.0.0.1:${port}`;
if (await fetch(`${url}/health`).then(() => true).catch(() => false)) throw new Error(`Review port ${port} is already in use`);
const server = spawn(process.execPath, ['tools/preview-server.mjs'], {
  cwd: process.cwd(), windowsHide: true, stdio: 'pipe',
  env: { ...process.env, CUTAWAY_PREVIEW_PORT: String(port) },
});
let browser;
try {
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) throw new Error(`Preview server exited ${server.exitCode}`);
    if (await fetch(`${url}/health`).then((r) => r.ok).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CUTAWAY_CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/tools/preview.html?model=espresso_machine&accent=%23D6A76A`);
  await page.waitForFunction(() => window.previewReady === true);
  if (process.env.CUTAWAY_MATERIAL_PROBE) {
    await page.evaluate(() => window.probe({ metalness: 0.78 }));
    await page.evaluate(() => window.capture(['app'], '-material-probe'));
    await page.reload();
    await page.waitForFunction(() => window.previewReady === true);
  }
  await page.evaluate(() => window.capture(['app', 'behind', 'front', 'left', 'back', 'close']));
  const shell = ['outer_shell', 'front_panel', 'brew_bay_panel', 'cup_warmer', 'tank_lid'];
  await page.evaluate((names) => window.hide(names), shell);
  await page.evaluate(() => window.capture(['app', 'behind', 'close'], '-peeled'));
  await page.evaluate((names) => window.hide(names), [...shell, 'boiler_body', 'boiler_lid', 'group_head', 'portafilter_body', 'demitasse']);
  await page.evaluate(() => window.capture(['app', 'close'], '-core'));
  await page.evaluate(() => window.hide([]));
  await page.locator('#theme').click();
  await page.evaluate(() => window.capture(['app', 'behind'], '-light'));
  await page.evaluate((names) => window.hide(names), shell);
  await page.evaluate(() => window.capture(['app'], '-peeled'));
  await page.evaluate(() => window.captureDetail(['boiler_lid', 'heating_element', 'thermostats'], 'heater'));
  await page.evaluate(() => window.captureDetail(['filter_basket'], 'basket'));
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir('.shots/espresso-machine', { recursive: true });
  const views = ['espressomachine-light-light-app', 'espressomachine-peeled-light-app', 'espressomachine-heater-light-detail'];
  const tiles = await Promise.all(views.map((view) => sharp(`tools/shots/${view}.png`).resize(600, 456).png().toBuffer()));
  const label = (text, index) => Buffer.from(`<svg width="600" height="54"><rect width="600" height="54" fill="#101720"/><text x="26" y="34" font-family="Arial" font-size="19" fill="#D6A76A">0${index + 1} / ${text}</text></svg>`);
  await sharp({ create: { width: 1800, height: 510, channels: 4, background: '#07090d' } }).composite([
    ...tiles.map((input, i) => ({ input, left: i * 600, top: 54 })),
    ...['EKSTERIOR', 'KOMPONEN DALAM', 'PEMANAS BOILER'].map((text, i) => ({ input: label(text, i), left: i * 600, top: 0 })),
  ]).png().toFile('.shots/espresso-machine/review.png');
  console.log('Captured 16 espresso views; review: .shots/espresso-machine/review.png');
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
}
