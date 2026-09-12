import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { PNG } from 'pngjs';

const root = 'C:/How it works 3D';
assert.ok(process.argv[2], 'Usage: node tools/verify-release-bundle.mjs <bundle.aab> [version] [versionCode]');
const file = resolve(process.argv[2]);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const archiveBytes = readFileSync(file);
const entryNames = [];
const entries = unzipSync(archiveBytes, { filter: (entry) => {
  entryNames.push(entry.name);
  return /\.glb$|assets_objecticons_.*\.png$|base\/assets\/(app\.config|index\.android\.bundle)$|^base\/lib\/(arm64-v8a|x86_64)\/.+\.so$/.test(entry.name);
} });
const expected = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const config = JSON.parse(Buffer.from(entries['base/assets/app.config']).toString('utf8'));
const expectedVersion = process.argv[3] ?? expected.version;
const expectedVersionCode = Number(process.argv[4] ?? expected.android.versionCode);
assert.equal(config.version, expectedVersion);
assert.equal(config.android.versionCode, expectedVersionCode);
assert.equal(config.name, expected.name);
assert.equal(config.android.package, expected.android.package);
assert.deepEqual(config.extra.admob, expected.extra.admob);
assert.equal(config.extra.admob.bannerUnitId, 'ca-app-pub-6279186647593327/5209257311');
assert.equal(config.plugins.find((value) => Array.isArray(value) && value[0] === 'react-native-google-mobile-ads')[1].delayAppMeasurementInit, true);
const models = readdirSync(resolve(root, 'assets/models')).filter((name) => name.endsWith('.glb'));
assert.equal(models.length, 28);
assert.equal(entryNames.filter((name) => name.endsWith('.glb')).length, 56);
for (const model of models) {
  const digest = sha(readFileSync(resolve(root, 'assets/models', model)));
  for (const path of [`base/assets/${model}`, `base/res/raw/assets_models_${model}`]) {
    assert.ok(entries[path], `Missing model: ${path}`);
    assert.equal(sha(entries[path]), digest, `Stale model: ${path}`);
  }
}
const icons = readdirSync(resolve(root, 'assets/object-icons')).filter((name) => name.endsWith('.png'));
assert.equal(icons.length, 28);
assert.equal(entryNames.filter((name) => /assets_objecticons_.*\.png$/.test(name)).length, 28);
const iconHashes = new Set();
for (const name of icons) {
  const archiveName = `base/res/drawable-mdpi-v4/assets_objecticons_${name.replace(/-/g, '')}`;
  assert.ok(entries[archiveName], `Missing icon: ${archiveName}`);
  const original = PNG.sync.read(readFileSync(resolve(root, 'assets/object-icons', name)));
  const packaged = PNG.sync.read(Buffer.from(entries[archiveName]));
  assert.equal(packaged.width, original.width);
  assert.equal(packaged.height, original.height);
  const digest = sha(original.data);
  assert.equal(sha(packaged.data), digest, `Stale icon: ${archiveName}`);
  iconHashes.add(digest);
}
assert.equal(iconHashes.size, 28);
const abis = [...new Set(entryNames.filter((name) => /^base\/lib\/.+\.so$/.test(name)).map((name) => name.split('/')[2]))].sort();
assert.deepEqual(abis, ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']);
let checked64BitLibraries = 0;
for (const [path, data] of Object.entries(entries).filter(([path]) => /^base\/lib\/(arm64-v8a|x86_64)\/.+\.so$/.test(path))) {
  const elf = Buffer.from(data);
  assert.equal(elf.subarray(0, 4).toString('hex'), '7f454c46', `Not ELF: ${path}`);
  assert.equal(elf[4], 2, `Not ELF64: ${path}`);
  assert.equal(elf[5], 1, `Unexpected endianness: ${path}`);
  const table = Number(elf.readBigUInt64LE(32));
  const stride = elf.readUInt16LE(54);
  const count = elf.readUInt16LE(56);
  for (let i = 0; i < count; i++) {
    const offset = table + i * stride;
    if (elf.readUInt32LE(offset) !== 1) continue;
    assert.ok(elf.readBigUInt64LE(offset + 48) >= 16384n, `PT_LOAD alignment below 16 KiB: ${path}`);
  }
  checked64BitLibraries++;
}
assert.ok(checked64BitLibraries > 0);
const js = Buffer.from(entries['base/assets/index.android.bundle']);
assert.equal(sha(js), sha(readFileSync(resolve(root, 'android/app/build/generated/assets/react/release/index.android.bundle'))));
for (const token of ['getLibraryBanner', 'library.search', 'library.noResults', 'shouldMountLibraryBanner']) {
  assert.ok(js.includes(Buffer.from(token)), `Release JavaScript missing ${token}`);
}
const signatures = entryNames.filter((name) => /^META-INF\/.+\.(RSA|DSA|EC|SF)$/.test(name));
console.log(JSON.stringify({ bundle: file, bytes: statSync(file).size, sha256: sha(archiveBytes), version: config.version,
  versionCode: config.android.versionCode, package: config.android.package, abis, matchingModelCopies: 56,
  matchingObjectIcons: iconHashes.size, checked64BitLibraries, elf64LoadAlignmentAtLeast16KiB: true,
  bannerUnitId: config.extra.admob.bannerUnitId,
  interstitialUnitId: config.extra.admob.interstitialUnitId, freshJavaScript: true, signatureEntries: signatures }, null, 2));
