import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve('marketing/aso-0.18.0');
const listing = JSON.parse(await readFile(resolve(root, 'listing.json'), 'utf8'));
assert.equal(listing.versionName, '0.18.0');
assert.equal(listing.versionCode, 23);
assert.deepEqual(Object.keys(listing.locales).sort(), ['en-US', 'id']);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const metadata = async (path) => sharp(path).metadata();
const text = async (path) => (await readFile(path, 'utf8')).trimEnd();

for (const [locale, content] of Object.entries(listing.locales)) {
  assert.ok(content.title.length <= 30, `${locale} title exceeds Play limit`);
  assert.ok(content.shortDescription.length <= 80, `${locale} short description exceeds Play limit`);
  assert.ok(content.fullDescription.length <= 4000, `${locale} full description exceeds Play limit`);
  assert.equal(content.screens.length, 8, `${locale} must have eight screenshots`);
  assert.equal(new Set(content.screens.map(([name]) => name)).size, 8, `${locale} screenshot names must be unique`);
  const dir = resolve(root, locale);
  assert.equal(await text(resolve(dir, 'title.txt')), content.title);
  assert.equal(await text(resolve(dir, 'short-description.txt')), content.shortDescription);
  assert.equal(await text(resolve(dir, 'full-description.txt')), content.fullDescription);
  assert.equal(await text(resolve(dir, 'release-notes.txt')), content.releaseNotes);

  const graphic = await metadata(resolve(dir, 'feature-graphic.png'));
  assert.deepEqual([graphic.width, graphic.height, graphic.format], [1024, 500, 'png'], `${locale} feature graphic dimensions`);
  const icon = await metadata(resolve(dir, 'app-icon.png'));
  assert.deepEqual([icon.width, icon.height, icon.format], [512, 512, 'png'], `${locale} icon dimensions`);
  assert.equal(icon.channels, 3, `${locale} Play icon must be opaque RGB`);

  for (const [name] of content.screens) {
    const capture = resolve(root, 'captures', locale === 'id' ? 'id' : 'en', `${name}.png`);
    const output = resolve(dir, `${name}.png`);
    const captureMeta = await metadata(capture);
    const outputMeta = await metadata(output);
    assert.deepEqual([captureMeta.width, captureMeta.height], [1170, 2340], `${locale}/${name} source capture size`);
    assert.deepEqual([outputMeta.width, outputMeta.height, outputMeta.format], [1080, 1920, 'png'], `${locale}/${name} store screenshot size`);
  }
}

const manifest = JSON.parse(await readFile(resolve(root, 'asset-manifest.json'), 'utf8'));
assert.equal(manifest.files.length, 16);
for (const entry of manifest.files) {
  const source = await readFile(resolve(root, entry.source));
  assert.equal(sha256(source), entry.sourceSha256, `lineage hash mismatch for ${entry.locale}/${entry.name}`);
  const output = await metadata(resolve(root, entry.locale, entry.name));
  assert.deepEqual([output.width, output.height], [entry.width, entry.height]);
}

const app = JSON.parse(await readFile(resolve('app.json'), 'utf8'));
assert.equal(app.expo.name, 'Cutaway: How Things Work 3D');
assert.equal(app.expo.version, '0.18.0');
assert.equal(app.expo.android.versionCode, 23);
assert.equal(app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads')[1].androidAppId,
  'ca-app-pub-6279186647593327~8674849287');
assert.equal(app.expo.extra.admob.bannerUnitId, 'ca-app-pub-6279186647593327/5209257311');
assert.equal(app.expo.extra.admob.interstitialUnitId, 'ca-app-pub-6279186647593327/7776650259');

console.log(JSON.stringify({
  locales: Object.keys(listing.locales),
  screenshots: manifest.files.length,
  featureGraphics: 2,
  storeIcons: 2,
  metadataLimits: 'pass',
  sourceLineage: 'pass',
  admobConfig: 'pass',
}, null, 2));
