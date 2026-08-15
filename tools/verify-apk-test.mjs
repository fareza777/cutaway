import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const verifier = resolve(ROOT, 'tools/verify-apk.mjs');
const releaseVersion = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8')).expo.version;
const acceptedApk = resolve(process.env.CUTAWAY_APK ?? resolve(ROOT, `dist/cutaway-${releaseVersion}-arm64.apk`));
const work = mkdtempSync(resolve(tmpdir(), 'cutaway-apk-mutations-'));
const checks = [];

if (!existsSync(acceptedApk)) {
  console.error(`APK mutation contract requires an accepted APK: ${acceptedApk}`);
  process.exit(2);
}

function check(name, condition, detail = '') {
  checks.push({ name, condition: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

function runVerifier(apk) {
  return spawnSync(process.execPath, [verifier, apk], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function findAapt2() {
  const executable = process.platform === 'win32' ? 'aapt2.exe' : 'aapt2';
  if (process.env.AAPT2 && existsSync(process.env.AAPT2)) return resolve(process.env.AAPT2);
  const sdkRoots = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME].filter(Boolean);
  const localProperties = resolve(ROOT, 'android/local.properties');
  if (existsSync(localProperties)) {
    const match = readFileSync(localProperties, 'utf8').match(/^sdk\.dir\s*=\s*(.+)$/m);
    if (match) sdkRoots.push(match[1].trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\'));
  }
  for (const sdk of sdkRoots) {
    const buildTools = resolve(sdk, 'build-tools');
    if (!existsSync(buildTools)) continue;
    const versions = readdirSync(buildTools).sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = resolve(buildTools, version, executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('aapt2 is required for the packaged-brand mutation contract');
}

function resourceArchivePath(apk, resourceName, qualifier) {
  const result = spawnSync(findAapt2(), ['dump', 'resources', apk], {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `aapt2 exited ${result.status}`);
  let current = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    const header = line.match(/^\s*resource\s+0x[0-9a-f]+\s+([^\s]+)\s*$/i);
    if (header) current = header[1];
    const file = current === resourceName && line.match(/^\s*\(([^)]*)\)\s+\(file\)\s+(\S+)/);
    if (file && file[1] === qualifier) return file[2];
  }
  throw new Error(`${resourceName} (${qualifier}) is missing from ${apk}`);
}

function mutate(apk, action, entryName) {
  // ZipArchive updates only one temporary APK at a time. The accepted artifact
  // is never modified and peak fixture storage stays bounded to one APK copy.
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open($env:CUTAWAY_MUTATION_APK, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
  $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Update, $false)
  try {
    $entry = $archive.GetEntry($env:CUTAWAY_MUTATION_ENTRY)
    if ($env:CUTAWAY_MUTATION_ACTION -eq 'stale') {
      if ($null -eq $entry) { throw "entry not found: $env:CUTAWAY_MUTATION_ENTRY" }
      $entry.Delete()
      $replacement = $archive.CreateEntry($env:CUTAWAY_MUTATION_ENTRY, [System.IO.Compression.CompressionLevel]::Optimal)
      $output = $replacement.Open()
      try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('intentionally stale GLB fixture')
        $output.Write($bytes, 0, $bytes.Length)
      } finally { $output.Dispose() }
    } elseif ($env:CUTAWAY_MUTATION_ACTION -eq 'remove') {
      if ($null -eq $entry) { throw "entry not found: $env:CUTAWAY_MUTATION_ENTRY" }
      $entry.Delete()
    } elseif ($env:CUTAWAY_MUTATION_ACTION -eq 'extra') {
      if ($null -ne $entry) { throw "entry already exists: $env:CUTAWAY_MUTATION_ENTRY" }
      $extra = $archive.CreateEntry($env:CUTAWAY_MUTATION_ENTRY, [System.IO.Compression.CompressionLevel]::Optimal)
      $output = $extra.Open()
      try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('unexpected GLB fixture')
        $output.Write($bytes, 0, $bytes.Length)
      } finally { $output.Dispose() }
    } else {
      throw "unknown mutation: $env:CUTAWAY_MUTATION_ACTION"
    }
  } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    env: {
      ...process.env,
      CUTAWAY_MUTATION_APK: apk,
      CUTAWAY_MUTATION_ACTION: action,
      CUTAWAY_MUTATION_ENTRY: entryName,
    },
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`could not create ${action} mutation: ${result.stderr || result.stdout}`);
  }
}

function mutationCase({ name, action, entryName, expected }) {
  const fixture = resolve(work, `${action}-${basename(acceptedApk)}`);
  copyFileSync(acceptedApk, fixture);
  try {
    mutate(fixture, action, entryName);
    const result = runVerifier(fixture);
    const output = `${result.stdout}\n${result.stderr}`;
    check(name, result.status !== 0 && expected.test(output), `exit ${result.status}`);
    if (result.status === 0 || !expected.test(output)) {
      console.log(output.trim().slice(0, 2_000));
    }
  } finally {
    rmSync(fixture, { force: true, maxRetries: 5, retryDelay: 100 });
  }
}

try {
  const pristine = runVerifier(acceptedApk);
  const pristineOutput = `${pristine.stdout}\n${pristine.stderr}`;
  check(
    'accepted APK passes before mutations',
    pristine.status === 0,
    `exit ${pristine.status}`,
  );
  check(
    'verifier proves current package, versionName, and versionCode',
    /Package: com\.cutaway\.explorer; versionName=0\.13\.0; versionCode=17/i.test(pristineOutput),
  );
  check('verifier proves arm64-v8a is the only native ABI', /Native ABI: arm64-v8a \(only\)/i.test(pristineOutput));
  check('verifier proves the APK signature is valid', /Signature: valid/i.test(pristineOutput));
  check(
    'verifier proves every packaged brand density matches current source pixels',
    /Brand: 30\/30 current source-pixel matches/i.test(pristineOutput),
  );

  mutationCase({
    name: 'rejects a stale assets/*.glb copy while the AAPT copy stays current',
    action: 'stale',
    entryName: 'assets/smartphone.glb',
    expected: /smartphone\.glb: packaged Metro model bytes do not match the current source/i,
  });
  mutationCase({
    name: 'rejects a missing assets/*.glb copy while the AAPT copy stays current',
    action: 'remove',
    entryName: 'assets/smartphone.glb',
    expected: /missing Metro model archive entry: assets\/smartphone\.glb/i,
  });
  mutationCase({
    name: 'rejects an extra GLB archive entry outside the exact two-family set',
    action: 'extra',
    entryName: 'assets/unexpected-review-fixture.glb',
    expected: /unexpected GLB archive entry: assets\/unexpected-review-fixture\.glb/i,
  });
  mutationCase({
    name: 'rejects a stale packaged launcher while current native resources remain unchanged',
    action: 'stale',
    entryName: resourceArchivePath(acceptedApk, 'mipmap/ic_launcher', 'mdpi'),
    expected: /mipmap\/ic_launcher \(mdpi\).*not a PNG|packaged brand/i,
  });
} finally {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const failures = checks.filter((item) => !item.condition);
console.log(`\n${checks.length - failures.length}/${checks.length} APK mutation checks passed`);
if (failures.length) process.exitCode = 1;
