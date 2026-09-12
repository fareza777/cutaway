import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Catch malformed exports, clipped adaptive marks, and non-reproducible builds.
mkdirSync('.logs/aso-0.18.0', {recursive:true});
const out = mkdtempSync(resolve('.logs/aso-0.18.0/brand-test-'));
const run = () => spawnSync(process.execPath, ['tools/build-brand-premium.mjs','--out',out],{encoding:'utf8'});
const first = run();
assert.equal(first.status,0,first.stderr);
const expected = {'icon.png':1024,'play-icon.png':512,'android-icon-foreground.png':1024,'android-icon-background.png':1024,'android-icon-monochrome.png':1024,'splash-icon.png':576,'favicon.png':64};
const hashes = {};
for (const [name,size] of Object.entries(expected)) {
  const file = resolve(out,name), meta = await sharp(file).metadata();
  assert.equal(meta.width,size,name); assert.equal(meta.height,size,name);
  hashes[name] = createHash('sha256').update(readFileSync(file)).digest('hex');
}
assert.equal((await sharp(resolve(out,'icon.png')).stats()).isOpaque,true);
assert.equal((await sharp(resolve(out,'play-icon.png')).stats()).isOpaque,true);
const {data,info} = await sharp(resolve(out,'android-icon-foreground.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let occupied = 0;
for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
  if(data[(y*info.width+x)*4+3] > 16) {
    occupied++;
    assert.ok(x>=170 && x<854 && y>=170 && y<854,'Adaptive icon leaves the safe area');
  }
}
assert.ok(occupied>80000,'Adaptive mark must remain visible');
const second = run(); assert.equal(second.status,0,second.stderr);
for(const name of Object.keys(expected)) assert.equal(createHash('sha256').update(readFileSync(resolve(out,name))).digest('hex'),hashes[name],name);
console.log('PASS: seven brand exports, opacity, adaptive safe area, deterministic rebuild');
