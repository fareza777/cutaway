import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_RUNNER = resolve(ROOT, 'tools/build-apk.mjs');
const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, condition: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

function executable(file, content) {
  writeFileSync(file, content);
  chmodSync(file, 0o755);
}

function fixture({ nativeProject = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cutaway-public-build-'));
  const tools = resolve(root, 'tools');
  const fakeBin = resolve(root, 'fake-bin');
  const log = resolve(root, 'commands.log');
  const fakeApk = resolve(root, 'fixture.apk');
  const fakeGradle = resolve(root, 'fake-gradlew');
  const fakeGradleBat = resolve(root, 'fake-gradlew.bat');
  mkdirSync(tools, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(resolve(root, 'node_modules/expo/bin'), { recursive: true });
  mkdirSync(resolve(root, 'assets/models'), { recursive: true });
  mkdirSync(resolve(root, 'assets/object-icons'), { recursive: true });
  if (!existsSync(SOURCE_RUNNER)) throw new Error(`public build runner is missing: ${SOURCE_RUNNER}`);
  copyFileSync(SOURCE_RUNNER, resolve(tools, 'build-apk.mjs'));
  writeFileSync(resolve(root, 'app.json'), `${JSON.stringify({ expo: { version: '0.13.0' } }, null, 2)}\n`);
  writeFileSync(resolve(root, 'assets/models/current-model.glb'), 'current model bytes\n');
  writeFileSync(resolve(root, 'assets/object-icons/current-icon.png'), 'current icon bytes\n');
  writeFileSync(fakeApk, 'fixture APK bytes\n');

  executable(resolve(fakeBin, 'npm'), `#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\\n' "$*" >> "$CUTAWAY_COMMAND_LOG"
`);
  writeFileSync(resolve(fakeBin, 'fake-npm.mjs'), `
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.CUTAWAY_COMMAND_LOG, \`npm \${process.argv.slice(2).join(' ')}\\n\`);
`);
  writeFileSync(resolve(fakeBin, 'npm.cmd'), '@echo off\r\nnode "%~dp0fake-npm.mjs" %*\r\n');
  writeFileSync(resolve(root, 'node_modules/expo/bin/cli'), `
import { appendFileSync, chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
appendFileSync(process.env.CUTAWAY_COMMAND_LOG, \`expo \${process.argv.slice(2).join(' ')}\\n\`);
mkdirSync(resolve('android/app/build/generated/assets/react'), { recursive: true });
mkdirSync(resolve('android/app/build/generated/res/react'), { recursive: true });
mkdirSync(resolve('android/app/src/main/assets'), { recursive: true });
writeFileSync(resolve('android/app/build/generated/assets/react/keep.txt'), 'keep assets\\n');
writeFileSync(resolve('android/app/build/generated/res/react/keep.txt'), 'keep res\\n');
copyFileSync(resolve('assets/models/current-model.glb'), resolve('android/app/src/main/assets/current-model.glb'));
copyFileSync(process.env.CUTAWAY_FAKE_GRADLEW, resolve('android/gradlew'));
chmodSync(resolve('android/gradlew'), 0o755);
copyFileSync(process.env.CUTAWAY_FAKE_GRADLEW_BAT, resolve('android/gradlew.bat'));
`);
  executable(fakeGradle, `#!/usr/bin/env bash
set -euo pipefail
printf 'gradle %s\\n' "$*" >> "$CUTAWAY_COMMAND_LOG"
if [[ "\${CUTAWAY_EXPECT_RECONCILED:-0}" == "1" ]]; then
  for stale in \
    app/src/main/assets/retired-model.glb \
    app/build/generated/res/react/release/raw/assets_models_retiredmodel.glb \
    app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_retiredicon.png; do
    if [[ -e "$stale" ]]; then
      printf 'stale owned release asset reached Gradle: %s\\n' "$stale" >&2
      exit 43
    fi
  done
  for current in \
    app/src/main/assets/current-model.glb \
    app/build/generated/res/react/release/raw/assets_models_currentmodel.glb \
    app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_currenticon.png; do
    if [[ ! -f "$current" ]]; then
      printf 'current release asset was removed: %s\\n' "$current" >&2
      exit 44
    fi
  done
fi
mkdir -p app/build/outputs/apk/release
cp "$CUTAWAY_FAKE_APK" app/build/outputs/apk/release/app-release.apk
`);
  writeFileSync(resolve(root, 'fake-gradle.mjs'), `
import { appendFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
appendFileSync(process.env.CUTAWAY_COMMAND_LOG, \`gradle \${process.argv.slice(2).join(' ')}\\n\`);
if (process.env.CUTAWAY_EXPECT_RECONCILED === '1') {
  const stale = [
    'app/src/main/assets/retired-model.glb',
    'app/build/generated/res/react/release/raw/assets_models_retiredmodel.glb',
    'app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_retiredicon.png',
  ];
  const current = [
    'app/src/main/assets/current-model.glb',
    'app/build/generated/res/react/release/raw/assets_models_currentmodel.glb',
    'app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_currenticon.png',
  ];
  for (const file of stale) {
    if (existsSync(resolve(file))) {
      console.error(\`stale owned release asset reached Gradle: \${file}\`);
      process.exit(43);
    }
  }
  for (const file of current) {
    if (!existsSync(resolve(file))) {
      console.error(\`current release asset was removed: \${file}\`);
      process.exit(44);
    }
  }
}
mkdirSync(resolve('app/build/outputs/apk/release'), { recursive: true });
copyFileSync(process.env.CUTAWAY_FAKE_APK, resolve('app/build/outputs/apk/release/app-release.apk'));
`);
  writeFileSync(fakeGradleBat, '@echo off\r\nnode "%CUTAWAY_FAKE_GRADLE_MJS%" %*\r\n');
  writeFileSync(resolve(tools, 'verify-apk.mjs'), `
import { appendFileSync, existsSync } from 'node:fs';
const apk = process.argv[2];
appendFileSync(process.env.CUTAWAY_COMMAND_LOG, \`verify \${apk}\\n\`);
if (!existsSync(apk)) {
  console.error(\`fixture APK missing: \${apk}\`);
  process.exit(40);
}
if (process.env.CUTAWAY_VERIFIER_FAIL === '1') {
  console.error('fixture release verification rejected the APK');
  process.exit(41);
}
`);

  function prepareNative() {
    const android = resolve(root, 'android');
    mkdirSync(resolve(android, 'app/src/main/assets'), { recursive: true });
    mkdirSync(resolve(android, 'app/build/generated/assets/react'), { recursive: true });
    mkdirSync(resolve(android, 'app/build/generated/res/react/release/raw'), { recursive: true });
    mkdirSync(resolve(android, 'app/build/generated/res/react/release/drawable-mdpi'), { recursive: true });
    writeFileSync(resolve(android, 'app/build/generated/assets/react/keep.txt'), 'keep assets\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/keep.txt'), 'keep res\n');
    writeFileSync(resolve(android, 'app/src/main/assets/current-model.glb'), 'current model bytes\n');
    writeFileSync(resolve(android, 'app/src/main/assets/retired-model.glb'), 'retired native model bytes\n');
    writeFileSync(resolve(android, 'app/src/main/assets/unrelated-sentinel.txt'), 'native sentinel bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/raw/assets_models_currentmodel.glb'), 'current generated model bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/raw/assets_models_retiredmodel.glb'), 'retired generated model bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/raw/unrelated-sentinel.bin'), 'raw sentinel bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_currenticon.png'), 'current generated icon bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_retiredicon.png'), 'retired generated icon bytes\n');
    writeFileSync(resolve(android, 'app/build/generated/res/react/release/drawable-mdpi/vendor-sentinel.png'), 'drawable sentinel bytes\n');
    copyFileSync(fakeGradle, resolve(android, 'gradlew'));
    chmodSync(resolve(android, 'gradlew'), 0o755);
    copyFileSync(fakeGradleBat, resolve(android, 'gradlew.bat'));
  }
  if (nativeProject) prepareNative();

  function run(version = '0.13.0', extraEnv = {}) {
    const runner = resolve(tools, 'build-apk.mjs');
    return spawnSync(process.execPath, [runner, version], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
        CUTAWAY_COMMAND_LOG: log,
        CUTAWAY_FAKE_APK: fakeApk,
        CUTAWAY_FAKE_GRADLEW: fakeGradle,
        CUTAWAY_FAKE_GRADLEW_BAT: fakeGradleBat,
        CUTAWAY_FAKE_GRADLE_MJS: resolve(root, 'fake-gradle.mjs'),
        ...extraEnv,
      },
      encoding: 'utf8',
      timeout: 120_000,
    });
  }

  return {
    root,
    log,
    run,
    commands: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split(/\r?\n/).filter(Boolean) : []),
    cleanup: () => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
  };
}

function ordered(commands, expected) {
  let cursor = -1;
  for (const value of expected) {
    const next = commands.findIndex((command, index) => index > cursor && command === value);
    if (next === -1) return false;
    cursor = next;
  }
  return true;
}

const clean = fixture();
try {
  const result = clean.run();
  const commands = clean.commands();
  check(
    'public build creates and builds a missing generated Android project',
    result.status === 0 && existsSync(resolve(clean.root, 'android/gradlew')),
    `exit ${result.status}; ${`${result.stdout}\n${result.stderr}`.replace(/\s+/g, ' ').trim().slice(0, 300)}`,
  );
  check(
    'public build runs models, brand, full checks, native sync, forced ARM64 Gradle, then release verification in order',
    ordered(commands, [
      'npm run build:models',
      'npm run build:brand',
      'npm run check',
      'expo prebuild --platform android --no-install --no-clean',
      'gradle assembleRelease --rerun-tasks --no-build-cache --no-daemon -q --console=plain -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process',
      `verify ${resolve(clean.root, 'dist/cutaway-0.13.0-arm64.apk')}`,
    ]),
    commands.join(' | '),
  );
  check(
    'public build derives the exact app.json versioned artifact name',
    existsSync(resolve(clean.root, 'dist/cutaway-0.13.0-arm64.apk')),
  );
} finally {
  clean.cleanup();
}

const existing = fixture({ nativeProject: true });
try {
  const result = existing.run('0.13.0', { CUTAWAY_EXPECT_RECONCILED: '1' });
  const quarantineRoot = resolve(existing.root, 'dist/.cutaway-release-quarantine');
  const quarantineRuns = existsSync(quarantineRoot) ? readdirSync(quarantineRoot) : [];
  const quarantine = quarantineRuns.length === 1 ? resolve(quarantineRoot, quarantineRuns[0]) : null;
  check(
    'public build reconciles stale owned Android release assets before Gradle',
    result.status === 0
      && !existsSync(resolve(existing.root, 'android/app/src/main/assets/retired-model.glb'))
      && !existsSync(resolve(existing.root, 'android/app/build/generated/res/react/release/raw/assets_models_retiredmodel.glb'))
      && !existsSync(resolve(existing.root, 'android/app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_retiredicon.png')),
    `exit ${result.status}; ${`${result.stdout}\n${result.stderr}`.replace(/\s+/g, ' ').trim().slice(0, 400)}`,
  );
  check(
    'reconciliation quarantines exactly the three stale owned files with recoverable bytes',
    quarantine !== null
      && readFileSync(resolve(quarantine, 'native-assets/retired-model.glb'), 'utf8') === 'retired native model bytes\n'
      && readFileSync(resolve(quarantine, 'generated-res/raw/assets_models_retiredmodel.glb'), 'utf8') === 'retired generated model bytes\n'
      && readFileSync(resolve(quarantine, 'generated-res/drawable-mdpi/assets_objecticons_retiredicon.png'), 'utf8') === 'retired generated icon bytes\n',
    quarantine ?? 'no quarantine run',
  );
  check(
    'reconciliation preserves current expected assets and unrelated same-root sentinels byte-for-byte',
    readFileSync(resolve(existing.root, 'android/app/src/main/assets/current-model.glb'), 'utf8') === 'current model bytes\n'
      && readFileSync(resolve(existing.root, 'android/app/src/main/assets/unrelated-sentinel.txt'), 'utf8') === 'native sentinel bytes\n'
      && readFileSync(resolve(existing.root, 'android/app/build/generated/res/react/release/raw/assets_models_currentmodel.glb'), 'utf8') === 'current generated model bytes\n'
      && readFileSync(resolve(existing.root, 'android/app/build/generated/res/react/release/raw/unrelated-sentinel.bin'), 'utf8') === 'raw sentinel bytes\n'
      && readFileSync(resolve(existing.root, 'android/app/build/generated/res/react/release/drawable-mdpi/assets_objecticons_currenticon.png'), 'utf8') === 'current generated icon bytes\n'
      && readFileSync(resolve(existing.root, 'android/app/build/generated/res/react/release/drawable-mdpi/vendor-sentinel.png'), 'utf8') === 'drawable sentinel bytes\n',
  );
  check(
    'public build preserves existing generated bundle directories instead of deleting them',
    existsSync(resolve(existing.root, 'android/app/build/generated/assets/react/keep.txt'))
      && existsSync(resolve(existing.root, 'android/app/build/generated/res/react/keep.txt')),
  );
} finally {
  existing.cleanup();
}

const reparse = fixture({ nativeProject: true });
try {
  const target = resolve(reparse.root, 'reparse-target');
  const link = resolve(reparse.root, 'android/app/src/main/assets/reparse-fixture');
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, 'target-sentinel.txt'), 'reparse target bytes\n');
  let supported = true;
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    supported = false;
    console.log(`SKIP reparse refusal fixture (${error.message})`);
  }
  if (supported) {
    const result = reparse.run();
    const output = `${result.stdout}\n${result.stderr}`;
    check(
      'public build refuses a symbolic-link or reparse path before Gradle',
      result.status !== 0
        && /symbolic|reparse|junction/i.test(output)
        && !reparse.commands().some((command) => command.startsWith('gradle '))
        && readFileSync(resolve(target, 'target-sentinel.txt'), 'utf8') === 'reparse target bytes\n',
      `exit ${result.status}; ${output.replace(/\s+/g, ' ').trim().slice(0, 300)}`,
    );
  }
} finally {
  reparse.cleanup();
}

const mismatch = fixture();
try {
  const result = mismatch.run('0.12.0');
  const output = `${result.stdout}\n${result.stderr}`;
  check(
    'public build rejects an output version that differs from app.json before doing work',
    result.status !== 0
      && /does not match app\.json version 0\.13\.0/i.test(output)
      && mismatch.commands().length === 0,
    `exit ${result.status}; ${output.replace(/\s+/g, ' ').trim().slice(0, 300)}`,
  );
} finally {
  mismatch.cleanup();
}

const rejection = fixture();
try {
  const result = rejection.run('0.13.0', { CUTAWAY_VERIFIER_FAIL: '1' });
  check(
    'public build fails when strong post-build verification rejects the APK',
    result.status === 41 && /fixture release verification rejected the APK/i.test(`${result.stdout}\n${result.stderr}`),
    `exit ${result.status}`,
  );
} finally {
  rejection.cleanup();
}

const failures = checks.filter((item) => !item.condition);
console.log(`\n${checks.length - failures.length}/${checks.length} public Android build checks passed`);
if (failures.length) process.exitCode = 1;
