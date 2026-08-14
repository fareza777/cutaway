// Asserts that an APK actually contains the models currently on disk.
//
//   node tools/verify-apk.mjs dist/cutaway-0.9.0-arm64.apk
//
// This exists because it failed silently and twice. Gradle decided its bundling
// task was up to date, packaged the previous build's copies of every .glb, and
// produced an APK four bytes different from the last one. Two rounds of "I have
// fixed the model" reached a phone that was still running the old geometry, and
// nothing in the toolchain said a word — `npm run check` validates the sources,
// not the artefact.
//
// Comparing hashes is the only honest check. A newer timestamp on the APK
// proves nothing: the stale one had that too.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apk = process.argv[2];

if (!apk) {
  console.error('usage: node tools/verify-apk.mjs <path-to-apk>');
  process.exit(1);
}

const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');

function entries() {
  const listing = execFileSync('unzip', ['-l', apk], { encoding: 'utf8', maxBuffer: 1 << 24 });
  return listing
    .split('\n')
    .map((line) => line.trim().split(/\s+/).pop())
    .filter((name) => name && name.endsWith('.glb'));
}

let names;
try {
  names = entries();
} catch (error) {
  console.error(`Could not read ${apk} — is unzip on PATH?`);
  console.error(error.message);
  process.exit(1);
}

// One .glb is packaged more than once (assets/ and res/), so a set is enough:
// the question is only whether the current bytes are in there at all.
const packaged = new Set(
  names.map((name) => md5(execFileSync('unzip', ['-p', apk, name], { maxBuffer: 1 << 26 }))),
);

const models = readdirSync(resolve(ROOT, 'assets/models')).filter((name) => name.endsWith('.glb'));
const stale = models.filter((name) => !packaged.has(md5(readFileSync(resolve(ROOT, 'assets/models', name)))));

console.log(`${basename(apk)}: ${models.length} model(s) on disk, ${packaged.size} distinct model(s) packaged`);

if (stale.length) {
  console.error(`\n✗ ${stale.length} model(s) in the APK are not the ones on disk:`);
  stale.forEach((name) => console.error(`    ${name}`));
  console.error(
    '\nGradle almost certainly skipped bundling as up to date. Delete\n' +
      '  android/app/build/generated/assets/react\n' +
      '  android/app/build/generated/res/react\n' +
      'and assemble again — or just use `npm run build:apk`, which does it for you.',
  );
  process.exit(1);
}

console.log('✓ every model on disk is in the APK');
