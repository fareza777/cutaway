import { chromium } from 'playwright-core';

const models = process.argv.slice(2);
if (!models.length) {
  console.error('usage: node tools/capture.mjs <model> [model...]');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});

for (const model of models) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  await page.goto(`http://localhost:5179/?model=${model}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => typeof window.capture === 'function', { timeout: 20000 });
  await page.waitForTimeout(700);
  const n = await page.evaluate(() => window.capture(['app', 'front', 'close', 'left', 'behind']));
  console.log(model, n);
  await page.close();
}

await browser.close();
