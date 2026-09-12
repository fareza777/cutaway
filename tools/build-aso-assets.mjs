// Compose store screenshots from unchanged captures of the real application.
// AI is used only for the separately versioned brand artwork, never fake UI.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const root = resolve('marketing/aso-0.18.0');
const listing = JSON.parse(await readFile(resolve(root,'listing.json'),'utf8'));
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({executablePath,headless:true,args:['--force-color-profile=srgb']});
const page = await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
const esc = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const manifest = {title:listing.locales['en-US'].title,created:'2026-09-12',screenshots:'Real app captures with editorial framing; no synthesized UI',files:[]};
const css = `*{box-sizing:border-box}body{margin:0;background:#080c12;color:#fff;font-family:'Segoe UI',Arial,sans-serif;width:1080px;height:1920px;overflow:hidden}.glow{position:absolute;width:1150px;height:1150px;left:-100px;top:600px;border-radius:50%;background:radial-gradient(circle,rgba(244,135,57,.16),transparent 66%)}.rail{position:absolute;top:0;bottom:0;left:42px;width:1px;background:linear-gradient(transparent,#b36b343b,transparent)}header{position:relative;padding:57px 75px 0}.brand{display:flex;align-items:center;gap:12px;font-size:27px;font-weight:650;letter-spacing:-.7px}.brand img{width:47px;height:47px}.number{position:absolute;right:76px;top:72px;font-size:20px;color:#c29d7c;letter-spacing:3px}.eyebrow{margin-top:35px;font-size:18px;letter-spacing:3px;font-weight:700;color:#ffad68}h1{margin:14px 0 0;font-size:72px;line-height:1.06;letter-spacing:-2.4px;font-weight:750;white-space:pre-line}p{font-size:27px;line-height:1.3;margin:17px 0 0;color:#bdc7d3;white-space:nowrap}.phone{position:absolute;top:405px;left:175px;width:730px;height:1460px;border:9px solid #222831;border-radius:51px;overflow:hidden;background:#f4f5f8;box-shadow:0 44px 105px #000b,0 0 0 2px #53555b;line-height:0}.phone img{width:100%;height:100%;object-fit:contain}.foot{position:absolute;left:75px;right:75px;bottom:19px;display:flex;justify-content:space-between;font-size:15px;color:#acb6c2;letter-spacing:2px}.spec{position:absolute;left:77px;top:438px;height:1260px;width:35px;border-left:1px solid #9c693050}.spec:before,.spec:after{content:'';position:absolute;left:0;width:14px;height:1px;background:#b7814766}.spec:after{bottom:0}.wide h1{font-size:62px}.light{background:#eae6e0;color:#1a1e24}.light p{color:#51565e}.light .eyebrow{color:#915020}.light .number,.light .foot{color:#705742}.light .glow{background:radial-gradient(circle,#b9916440,transparent 65%)}`;
try {
  for(const [locale,content] of Object.entries(listing.locales)) {
    assert.ok(content.title.length<=30 && content.shortDescription.length<=80 && content.fullDescription.length<=4000,`Store text limits: ${locale}`);
    assert.equal(content.screens.length,8);
    const out = resolve(root,locale); await mkdir(out,{recursive:true});
    await sharp(resolve(root,'source',locale==='id'?'banner-id.png':'banner-en.png')).resize(1024,500,{fit:'fill'}).flatten({background:'#07090d'}).png().toFile(resolve(out,'feature-graphic.png'));
    await sharp(resolve('assets/play-icon.png')).png().toFile(resolve(out,'app-icon.png'));
    await writeFile(resolve(out,'title.txt'),content.title+'\n');
    await writeFile(resolve(out,'short-description.txt'),content.shortDescription+'\n');
    await writeFile(resolve(out,'full-description.txt'),content.fullDescription+'\n');
    await writeFile(resolve(out,'release-notes.txt'),content.releaseNotes+'\n');
    for(const [i,[name,title,subtitle,kicker]] of content.screens.entries()) {
      const capture = resolve(root,'captures',locale==='id'?'id':'en',`${name}.png`);
      const data = await readFile(capture);
      const dataUrl = `data:image/png;base64,${data.toString('base64')}`;
      const iconUrl = `data:image/png;base64,${(await readFile(resolve('assets/icon.png'))).toString('base64')}`;
      const bodyClass = `${[2,5].includes(i)?'light ':''}${title.split('\n').some(x=>x.length>20)?'wide':''}`;
      const footerProduct = locale === 'id' ? 'CARA KERJA BENDA 3D' : 'HOW THINGS WORK 3D';
      const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><title>${esc(name)}</title><style>${css}</style><body class="${bodyClass}"><div class="glow"></div><div class="rail"></div><header><div class="brand"><img src="${iconUrl}" alt="">Cutaway</div><div class="number">${String(i+1).padStart(2,'0')} / 08</div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></header><div class="spec"></div><div class="phone"><img src="${dataUrl}" alt="${esc(name)}"></div><div class="foot"><span>${footerProduct}</span><span>${locale==='id'?'JELAJAHI · PAHAMI · PELAJARI':'EXPLORE · UNDERSTAND · LEARN'}</span></div></body></html>`;
      await page.setContent(html);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      const fit = await page.evaluate(()=>{const p=document.querySelector('p'),h=document.querySelector('h1');return {subtitleRight:p.getBoundingClientRect().left+p.scrollWidth,titleBottom:h.getBoundingClientRect().bottom,subtitleBottom:p.getBoundingClientRect().bottom};});
      assert.ok(fit.subtitleRight<1030 && fit.subtitleBottom<390,`Caption overflow: ${locale}/${name} ${JSON.stringify(fit)}`);
      await page.screenshot({path:resolve(out,`${name}.png`)});
      manifest.files.push({locale,name:`${name}.png`,source:`captures/${locale==='id'?'id':'en'}/${name}.png`,sourceSha256:createHash('sha256').update(data).digest('hex'),width:1080,height:1920});
    }
  }
  const tiles = [];
  for(const locale of ['en-US','id']) {
    for(const [name] of listing.locales[locale].screens) tiles.push(`<figure><img src="${locale}/${name}.png"><figcaption>${locale} · ${name}</figcaption></figure>`);
  }
  await writeFile(resolve(root,'preview.html'),`<!doctype html><html><meta charset="utf-8"><title>Cutaway — ASO review</title><style>body{margin:40px;background:#0b1017;color:#eee;font-family:'Segoe UI',sans-serif}h1{font-weight:650}p{color:#a9b3c0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}figure{margin:0}img{width:100%;border-radius:12px}figcaption{padding:8px;font-size:13px}.banners{display:flex;gap:24px;margin:30px 0}.banners img{width:48%}</style><h1>Cutaway: How Things Work 3D</h1><p>Production asset review · 8 screenshots per language · Local files, not yet published</p><div class="banners"><img src="en-US/feature-graphic.png"><img src="id/feature-graphic.png"></div><div class="grid">${tiles.join('')}</div></html>`);
  const review = await browser.newPage({viewport:{width:1200,height:1800},deviceScaleFactor:1});
  await review.goto(pathToFileURL(resolve(root,'preview.html')).href);
  await review.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
  await review.screenshot({path:resolve(root,'contact-sheet.png'),fullPage:true});
  await writeFile(resolve(root,'asset-manifest.json'),JSON.stringify(manifest,null,2));
  console.log('Created 16 screenshots, 2 localized feature graphics, 2 store icons, 8 text files and review sheet.');
} finally { await browser.close(); }
