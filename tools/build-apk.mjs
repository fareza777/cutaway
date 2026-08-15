// Reproducible local Android release entrypoint.
//
// The native project is generated and ignored, so a release build must sync it
// from app.json and the current brand assets before Gradle runs. The verifier is
// deliberately the final gate: an assembled but stale APK is not a release.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
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
