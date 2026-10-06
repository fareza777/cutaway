// Capture the real, locally exported application. Never connects to a user's
// browser profile or Play Console. No production data or purchases are used.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve('.logs/aso-0.18.0/web');
const out = resolve('marketing/aso-0.18.0/captures');
const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.ttf':'font/ttf', '.glb':'model/gltf-binary' };
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
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath, headless:true, args:['--force-color-profile=srgb'] });
const report = { source:'Actual application web renderer, not generated UI', viewport:{width:390,height:780}, deviceScaleFactor:3, screens:[], errors:[] };
const localeArgs = process.argv.slice(2).filter(x => ['en','id'].includes(x));
const locales = localeArgs.length ? localeArgs : ['en','id'];
async function shot(page, locale, name) {
  await page.evaluate(() => document.fonts.ready);
  // Allow the app's damped camera and Reanimated sheets to finish settling.
  // Count rendered frames rather than capturing the first loading frame.
  await page.evaluate(() => new Promise(done => { let frames=0; const tick=()=>++frames>=90?done():requestAnimationFrame(tick); requestAnimationFrame(tick); }));
  await page.screenshot({ path:resolve(out,locale,`${name}.png`) });
  report.screens.push({ locale,name,url:new URL(page.url()).pathname,buttons:await page.getByRole('button').allTextContents() });
  console.log(`${locale}/${name}`);
}
async function model(page, id, locale) {
  await page.goto(`${base}/object/${id}`, {waitUntil:'networkidle'});
  await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(c => c.clientWidth > 0) && !/(Loading |Memuat )/.test(document.body.innerText), null, {timeout:60000});
  await page.getByRole('button',{name:locale === 'id' ? 'Aktifkan atau nonaktifkan rotasi otomatis' : 'Toggle auto-rotate',exact:true}).click();
  await page.getByRole('button',{name:locale === 'id' ? 'Atur ulang tampilan' : 'Reset view',exact:true}).click();
}
async function zoomOut(page, factor) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.synthesizePinchGesture',{x:195,y:335,scaleFactor:factor,relativeSpeed:500,gestureSourceType:'touch'});
  await session.detach();
}
try {
  for (const locale of locales) {
    await mkdir(resolve(out,locale), {recursive:true});
    const context = await browser.newContext({viewport:report.viewport, deviceScaleFactor:3,hasTouch:true});
    await context.addInitScript(({locale}) => localStorage.setItem('cutaway.settings.v1',JSON.stringify({state:{locale,mode:'light',onboarded:true},version:0})),{locale});
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await model(page,'mechanical-watch',locale);
    await zoomOut(page,.86);
    await shot(page,locale,'01-explore');
    await model(page,'mechanical-watch',locale);
    await page.getByRole('button',{name:locale === 'id' ? 'Uraikan' : 'Explode',exact:true}).click();
    const label = page.getByText(locale === 'id' ? 'Pisahkan bagian' : 'Separate parts',{exact:true});
    await label.waitFor();
    const slider = label.locator('..').locator('..');
    const bounds = await slider.boundingBox();
    await page.mouse.click(bounds.x + bounds.width * .36, bounds.y + bounds.height - 17);
    await zoomOut(page,.63);
    await shot(page,locale,'02-explode');
    await model(page,'cordless-drill',locale);
    await page.getByRole('button',{name:locale === 'id' ? 'Kupas' : 'Peel',exact:true}).click();
    const cutLabel = page.getByText(locale === 'id' ? 'Kupas lapisan' : 'Peel away layers',{exact:true});
    await cutLabel.waitFor();
    const cutBounds = await cutLabel.locator('..').locator('..').boundingBox();
    await page.mouse.click(cutBounds.x + cutBounds.width*.45,cutBounds.y+cutBounds.height-17);
    await shot(page,locale,'03-inside');
    await model(page,'turboshaft-helicopter',locale);
    await zoomOut(page,.6);
    await page.getByRole('button',{name:locale === 'id' ? 'Jalankan' : 'Run',exact:true}).click();
    await shot(page,locale,'04-motion');
    await model(page,'mechanical-watch',locale);
    await page.getByRole('button',{name:locale === 'id' ? 'Bagian' : 'Parts',exact:true}).click();
    await shot(page,locale,'05-parts');
    await model(page,'earth-observation-satellite',locale);
    await page.getByRole('button',{name:locale === 'id' ? 'Cara kerja' : 'How it works',exact:true}).click();
    await shot(page,locale,'06-story');
    await page.goto(`${base}/quiz/turbofan`,{waitUntil:'networkidle'});
    await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some(c => c.clientWidth > 0) && !/(Loading |Memuat )/.test(document.body.innerText),null,{timeout:60000});
    await shot(page,locale,'07-quiz');
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByRole('textbox',{name:locale === 'id' ? 'Cari objek…' : 'Search objects…'}).waitFor();
    await shot(page,locale,'08-library');
    await context.close();
  }
  if (report.errors.length) throw Error(`UI errors: ${report.errors.join('; ')}`);
} finally {
  await mkdir(out,{recursive:true});
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
  await new Promise(done => server.close(done));
}
