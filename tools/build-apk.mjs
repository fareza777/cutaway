// Reproducible local Android release entrypoint.
//
// The native project is generated and ignored, so a release build must sync it
// from app.json and the current brand assets before Gradle runs. The verifier is
// deliberately the final gate: an assembled but stale APK is not a release.

import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appJson = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8'));
const appVersion = appJson?.expo?.version;
const requestedVersion = process.argv[2] ?? appVersion;

if (typeof appVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appVersion)) {
  console.error(`app.json has an invalid Expo version: ${JSON.stringify(appVersion)}`);
  process.exit(2);
}
if (requestedVersion !== appVersion) {
  console.error(`Requested version ${requestedVersion} does not match app.json version ${appVersion}`);
  process.exit(2);
}

function run(label, command, args, { cwd = ROOT, env = process.env } = {}) {
  console.log(`\n==> ${label}`);
  let result;
  if (process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(command)) {
    result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'call', command, ...args], {
      cwd,
      env,
      stdio: 'inherit',
    });
  } else {
    result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  }
  if (result.error) {
    console.error(`${label} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run('Build deterministic models', npm, ['run', 'build:models']);
run('Build deterministic brand assets', npm, ['run', 'build:brand']);
run('Run the full source contract', npm, ['run', 'check']);

const expoCli = resolve(ROOT, 'node_modules/expo/bin/cli');
if (!existsSync(expoCli)) {
  console.error('Expo CLI is missing; run npm ci before building the APK');
  process.exit(1);
}
run('Synchronize the generated Android project from app.json', process.execPath, [
  expoCli,
  'prebuild',
  '--platform',
  'android',
  '--no-install',
  '--no-clean',
]);

const sourceModels = resolve(ROOT, 'assets/models');
const sourceIcons = resolve(ROOT, 'assets/object-icons');
const nativeAssets = resolve(ROOT, 'android/app/src/main/assets');
const generatedReleaseResources = resolve(ROOT, 'android/app/build/generated/res/react/release');
const quarantineBase = resolve(ROOT, 'dist/.cutaway-release-quarantine');
const imageExtensions = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.bmp', '.avif']);
const maximumOwnedCandidates = 512;
const maximumScannedGeneratedEntries = 20_000;

function displayPath(file) {
  const local = relative(ROOT, file);
  return local && !local.startsWith(`..${sep}`) && local !== '..' && !isAbsolute(local)
    ? local.split(sep).join('/')
    : file;
}

function pathInside(anchor, target, label) {
  const local = relative(anchor, target);
  if (local === '' || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    throw new Error(`${label} is outside its managed root: ${target}`);
  }
  return local;
}

function assertOrdinaryPathChain(target, label, { allowMissing = false } = {}) {
  const local = pathInside(ROOT, target, label);
  let cursor = ROOT;
  const rootStats = lstatSync(cursor);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`${label} project root is a symbolic/reparse path or is not a directory: ${ROOT}`);
  }
  for (const part of local.split(sep)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) {
      if (allowMissing) return false;
      throw new Error(`${label} does not exist: ${cursor}`);
    }
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic-link, junction, or reparse path: ${cursor}`);
    }
  }
  return true;
}

function assertDirectory(directory, label, { allowMissing = false } = {}) {
  if (!assertOrdinaryPathChain(directory, label, { allowMissing })) return false;
  if (!lstatSync(directory).isDirectory()) throw new Error(`${label} is not a directory: ${directory}`);
  return true;
}

function safeEntries(directory, label) {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const file = resolve(directory, entry.name);
    pathInside(directory, file, label);
    const stats = lstatSync(file);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic-link, junction, or reparse path: ${file}`);
    }
    return { entry, file, stats };
  });
}

function sourceFiles(directory, extensionTest, label) {
  assertDirectory(directory, label);
  const files = [];
  for (const { entry, file, stats } of safeEntries(directory, label)) {
    if (!extensionTest(entry.name)) continue;
    if (!stats.isFile()) throw new Error(`${label} candidate is not an ordinary file: ${file}`);
    files.push(entry.name);
  }
  if (files.length === 0 || files.length > maximumOwnedCandidates) {
    throw new Error(`${label} manifest has an unsafe file count: ${files.length}`);
  }
  return files.sort();
}

function resourceStem(filename, label) {
  const extension = extname(filename);
  const stem = filename.slice(0, -extension.length).toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!stem) throw new Error(`${label} cannot be mapped to an Android resource name: ${filename}`);
  return stem;
}

function exactSet(values, label) {
  const result = new Set(values);
  if (result.size !== values.length) throw new Error(`${label} contains colliding Android resource names`);
  return result;
}

function nativeCandidates() {
  if (!assertDirectory(nativeAssets, 'native model asset root', { allowMissing: true })) return [];
  const candidates = [];
  for (const { entry, file, stats } of safeEntries(nativeAssets, 'native model asset root')) {
    if (!entry.name.toLowerCase().endsWith('.glb')) continue;
    if (!stats.isFile()) throw new Error(`native model candidate is not an ordinary file: ${file}`);
    candidates.push({ file, relativePath: entry.name, quarantineGroup: 'native-assets' });
  }
  return candidates;
}

function generatedCandidates() {
  if (!assertDirectory(generatedReleaseResources, 'generated release resource root', { allowMissing: true })) return [];
  const candidates = [];
  const pending = [generatedReleaseResources];
  let scanned = 0;
  while (pending.length) {
    const directory = pending.pop();
    for (const { entry, file, stats } of safeEntries(directory, 'generated release resource root')) {
      scanned += 1;
      if (scanned > maximumScannedGeneratedEntries) {
        throw new Error(`generated release resource scan exceeded ${maximumScannedGeneratedEntries} entries`);
      }
      if (stats.isDirectory()) {
        pending.push(file);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const isModel = lower.startsWith('assets_models_') && lower.endsWith('.glb');
      const isIcon = lower.startsWith('assets_objecticons_') && imageExtensions.has(extname(lower));
      if (!isModel && !isIcon) continue;
      if (!stats.isFile()) throw new Error(`generated release asset candidate is not an ordinary file: ${file}`);
      candidates.push({
        file,
        relativePath: pathInside(generatedReleaseResources, file, 'generated release asset candidate').split(sep).join('/'),
        quarantineGroup: 'generated-res',
      });
    }
  }
  return candidates;
}

function ensureOrdinaryDirectory(directory, anchor, label) {
  const local = pathInside(anchor, directory, label);
  let cursor = anchor;
  for (const part of local.split(sep)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) mkdirSync(cursor);
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`${label} contains a symbolic/reparse path or non-directory: ${cursor}`);
    }
  }
}

function reconcileAndroidReleaseAssets() {
  const modelFiles = sourceFiles(sourceModels, (name) => name.toLowerCase().endsWith('.glb'), 'source model root');
  const iconFiles = sourceFiles(
    sourceIcons,
    (name) => imageExtensions.has(extname(name).toLowerCase()),
    'source object-icon root',
  );
  const expectedNative = exactSet(modelFiles, 'native model manifest');
  const expectedGenerated = exactSet([
    ...modelFiles.map((name) => `raw/assets_models_${resourceStem(name, 'model')}.glb`),
    ...iconFiles.map((name) => `drawable-mdpi/assets_objecticons_${resourceStem(name, 'object icon')}${extname(name).toLowerCase()}`),
  ], 'generated release asset manifest');

  const candidates = [...nativeCandidates(), ...generatedCandidates()];
  if (candidates.length > maximumOwnedCandidates) {
    throw new Error(`Android release asset reconciliation found an unsafe candidate count: ${candidates.length}`);
  }
  const stale = candidates.filter((candidate) => (
    candidate.quarantineGroup === 'native-assets'
      ? !expectedNative.has(candidate.relativePath)
      : !expectedGenerated.has(candidate.relativePath)
  ));
  if (stale.length === 0) {
    console.log(`\nAndroid release asset reconciliation: 0 stale owned files (${candidates.length} candidates inspected)`);
    return;
  }

  // Validate every source and every destination before the first recoverable move.
  for (const candidate of stale) {
    const anchor = candidate.quarantineGroup === 'native-assets' ? nativeAssets : generatedReleaseResources;
    pathInside(anchor, candidate.file, 'stale Android release asset');
    const stats = lstatSync(candidate.file);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`stale Android release asset is not an ordinary file: ${candidate.file}`);
    }
  }
  assertOrdinaryPathChain(quarantineBase, 'release quarantine root', { allowMissing: true });
  ensureOrdinaryDirectory(quarantineBase, ROOT, 'release quarantine root');
  const runId = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${process.pid}-${randomUUID()}`;
  const quarantine = resolve(quarantineBase, runId);
  pathInside(quarantineBase, quarantine, 'release quarantine run');
  if (existsSync(quarantine)) throw new Error(`release quarantine run already exists: ${quarantine}`);
  mkdirSync(quarantine);

  const moves = stale.map((candidate) => {
    const destination = resolve(quarantine, candidate.quarantineGroup, ...candidate.relativePath.split('/'));
    pathInside(quarantine, destination, 'release quarantine destination');
    if (existsSync(destination)) throw new Error(`release quarantine destination already exists: ${destination}`);
    return { ...candidate, destination };
  });

  console.log(`\nAndroid release asset reconciliation: moving ${moves.length} stale owned file(s)`);
  let moved = 0;
  try {
    for (const item of moves) {
      ensureOrdinaryDirectory(dirname(item.destination), quarantine, 'release quarantine destination');
      const stats = lstatSync(item.file);
      if (stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error(`stale Android release asset changed before move: ${item.file}`);
      }
      renameSync(item.file, item.destination);
      moved += 1;
      console.log(`  moved ${displayPath(item.file)} -> ${displayPath(item.destination)}`);
    }
  } catch (error) {
    throw new Error(`${error.message}; ${moved} file(s) remain recoverable at ${quarantine}`);
  }
  console.log(`Recovery quarantine (not removed automatically): ${quarantine}`);
}

try {
  reconcileAndroidReleaseAssets();
} catch (error) {
  console.error(`Android release asset reconciliation refused to continue: ${error.message}`);
  process.exit(1);
}

const android = resolve(ROOT, 'android');
const gradle = resolve(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (!existsSync(gradle)) {
  console.error(`Expo prebuild did not create the Gradle wrapper: ${gradle}`);
  process.exit(1);
}
run('Assemble a fresh ARM64 release', gradle, [
  'assembleRelease',
  '--rerun-tasks',
  '--no-build-cache',
  '--no-daemon',
  '-q',
  '--console=plain',
  '-PreactNativeArchitectures=arm64-v8a',
], {
  cwd: android,
  env: { ...process.env, NODE_ENV: 'production' },
});

const assembled = resolve(android, 'app/build/outputs/apk/release/app-release.apk');
if (!existsSync(assembled)) {
  console.error(`Gradle did not create the expected release APK: ${assembled}`);
  process.exit(1);
}
const dist = resolve(ROOT, 'dist');
const artifact = resolve(dist, `cutaway-${appVersion}-arm64.apk`);
mkdirSync(dist, { recursive: true });
copyFileSync(assembled, artifact);

run('Verify release metadata, ABI, signature, assets, and brand', process.execPath, [
  resolve(ROOT, 'tools/verify-apk.mjs'),
  artifact,
]);

const bytes = readFileSync(artifact);
console.log(`\nRelease APK: ${artifact}`);
console.log(`Bytes: ${statSync(artifact).size}`);
console.log(`SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`);
