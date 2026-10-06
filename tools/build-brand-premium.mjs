// Export the approved generated master into Android/Play formats. The master
// is versioned in the project; rebuilds never regenerate or reinterpret it.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import sharp from 'sharp';

const root = resolve('.');
const out = resolve(process.argv[2] === '--out' ? process.argv[3] : 'assets');
const rel = relative(root,out);
assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel),'Output must stay inside this project');
const source = resolve('marketing/aso-0.18.0/source/icon-master.png');
const bg = '#07090D';
await mkdir(out,{recursive:true});
for(const [name,size] of [['icon.png',1024],['play-icon.png',512],['favicon.png',64]]) {
  await sharp(source).resize(size,size).flatten({background:bg}).png().toFile(resolve(out,name));
}
const foreground = await sharp(source).resize(768,768).extend({top:128,bottom:128,left:128,right:128,background:'#00000000'}).png().toBuffer();
await sharp(foreground).toFile(resolve(out,'android-icon-foreground.png'));
await sharp({create:{width:1024,height:1024,channels:3,background:bg}}).png().toFile(resolve(out,'android-icon-background.png'));
const alpha = await sharp(foreground).extractChannel('alpha').toBuffer();
await sharp({create:{width:1024,height:1024,channels:3,background:'#FFFFFF'}}).joinChannel(alpha).png().toFile(resolve(out,'android-icon-monochrome.png'));
await sharp(source).resize(576,576).png().toFile(resolve(out,'splash-icon.png'));
console.log(`Seven reproducible brand exports: ${rel}`);
