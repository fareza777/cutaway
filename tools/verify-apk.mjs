// Proves that an APK contains the exact models and object icons currently on
// disk. APK timestamps and a successful Gradle task are not evidence: Gradle
// has previously shipped stale Metro assets while reporting success.
//
//   node tools/verify-apk.mjs dist/cutaway-0.13.0-arm64.apk

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync, inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const imageUtils = require('@expo/image-utils');
const apkArgument = process.argv[2];

if (!apkArgument) {
  console.error('usage: node tools/verify-apk.mjs <path-to-apk>');
  process.exit(1);
}

const apk = resolve(apkArgument);
if (!existsSync(apk)) {
  console.error(`APK does not exist: ${apk}`);
  process.exit(1);
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const problems = [];
const problem = (message) => problems.push(message);
const appConfig = JSON.parse(readFileSync(resolve(ROOT, 'app.json'), 'utf8')).expo;

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end-of-central-directory record is missing');
}

function readZip(file) {
  const fileSize = statSync(file).size;
  if (fileSize > 512 * 1024 * 1024) throw new Error(`APK is ${fileSize} bytes, above the 512 MiB verification limit`);
  const bytes = readFileSync(file);
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const count = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0) throw new Error('multi-disk ZIP archives are unsupported');
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 APKs are unsupported');
  }
  if (count > 50_000) throw new Error(`APK has an unreasonable ZIP entry count: ${count}`);
  if (centralOffset + centralSize > bytes.length) throw new Error('ZIP central directory exceeds the APK bounds');

  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > centralOffset + centralSize) throw new Error(`truncated ZIP central-directory entry ${index}`);
    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`invalid ZIP central-directory entry ${index}`);
    }
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > centralOffset + centralSize) throw new Error(`ZIP central-directory entry ${index} exceeds its bounds`);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBytes.toString(flags & 0x0800 ? 'utf8' : 'latin1');
    if (entries.has(name)) throw new Error(`duplicate ZIP entry: ${name}`);
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
    offset = nextOffset;
  }
  if (offset !== centralOffset + centralSize) throw new Error('ZIP central-directory size does not match its entries');

  function extract(name, maxOutputLength = 64 * 1024 * 1024) {
    const entry = entries.get(name);
    if (!entry) throw new Error(`APK archive entry is missing: ${name}`);
    const { localOffset, compressedSize, uncompressedSize, method } = entry;
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`invalid local ZIP header: ${name}`);
    const nameLength = bytes.readUInt16LE(localOffset + 26);
    const extraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + nameLength + extraLength;
    if (start + compressedSize > bytes.length) throw new Error(`compressed ZIP data exceeds APK bounds: ${name}`);
    if (uncompressedSize > maxOutputLength) {
      throw new Error(`${name} expands to ${uncompressedSize} bytes, above the ${maxOutputLength}-byte verification limit`);
    }
    const compressed = bytes.subarray(start, start + compressedSize);
    let output;
    if (method === 0) output = Buffer.from(compressed);
    else if (method === 8) output = inflateRawSync(compressed, { maxOutputLength });
    else throw new Error(`unsupported ZIP compression method ${method}: ${name}`);
    if (output.length !== uncompressedSize) {
      throw new Error(`uncompressed size mismatch for ${name}: ${output.length} != ${uncompressedSize}`);
    }
    return output;
  }

  return { entries, extract };
}

function parseJavaProperty(value) {
  return value
    .replace(/\\:/g, ':')
    .replace(/\\=/g, '=')
    .replace(/\\\\/g, '\\');
}

function versionParts(value) {
  return value.split(/[^0-9]+/).filter(Boolean).map(Number);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const count = Math.max(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return left.localeCompare(right);
}

function findAndroidBuildTool(name, override) {
  const executable = process.platform === 'win32'
    ? `${name}.${name === 'apksigner' ? 'bat' : 'exe'}`
    : name;
  const direct = [override].filter(Boolean);
  const sdkRoots = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME].filter(Boolean);
  const localProperties = resolve(ROOT, 'android/local.properties');
  if (existsSync(localProperties)) {
    const match = readFileSync(localProperties, 'utf8').match(/^sdk\.dir\s*=\s*(.+)$/m);
    if (match) sdkRoots.push(parseJavaProperty(match[1].trim()));
  }

  for (const candidate of direct) if (existsSync(candidate)) return resolve(candidate);
  for (const sdkRoot of [...new Set(sdkRoots.map((value) => resolve(value)))]) {
    const buildTools = resolve(sdkRoot, 'build-tools');
    if (!existsSync(buildTools)) continue;
    const versions = readdirSync(buildTools, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareVersions)
      .reverse();
    for (const version of versions) {
      const candidate = resolve(buildTools, version, executable);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`${name} was not found; configure ANDROID_SDK_ROOT, ANDROID_HOME, or sdk.dir in android/local.properties`);
}

function runCaptured(command, args) {
  const options = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 };
  if (process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(command)) {
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'call', command, ...args], options);
  }
  return spawnSync(command, args, options);
}

function parseResourceFiles(output) {
  const resources = new Map();
  let current = null;
  for (const line of output.split(/\r?\n/)) {
    const header = line.match(/^\s*resource\s+0x[0-9a-f]+\s+([^/\s]+)\/([^\s]+)\s*$/i);
    if (header) {
      current = `${header[1]}/${header[2]}`;
      if (!resources.has(current)) resources.set(current, []);
      continue;
    }
    const file = current && line.match(/^\s*\(([^)]*)\)\s+\(file\)\s+(\S+)(?:\s+type=\S+)?\s*$/);
    if (file) resources.get(current).push({ qualifier: file[1], archivePath: file[2] });
  }
  return resources;
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const dl = Math.abs(estimate - left);
  const da = Math.abs(estimate - above);
  const du = Math.abs(estimate - upperLeft);
  if (dl <= da && dl <= du) return left;
  return da <= du ? above : upperLeft;
}

function decodedPng(fileBytes, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!fileBytes.subarray(0, 8).equals(signature)) throw new Error(`${label} is not a PNG`);

  let offset = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  let ended = false;
  const compressed = [];
  while (offset + 12 <= fileBytes.length) {
    const length = fileBytes.readUInt32BE(offset);
    const type = fileBytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > fileBytes.length) throw new Error(`${label} has a truncated PNG chunk`);
    const data = fileBytes.subarray(start, end);
    if (type === 'IHDR') header = data;
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      ended = true;
      break;
    }
    offset = end + 4;
  }
  if (!header || header.length !== 13 || !compressed.length || !ended) throw new Error(`${label} is an incomplete PNG`);

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colourType = header[9];
  const compression = header[10];
  const filtering = header[11];
  const interlace = header[12];
  const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(colourType);
  if (!width || !height || bitDepth !== 8 || !channels || compression !== 0 || filtering !== 0 || interlace !== 0) {
    throw new Error(`${label} uses unsupported PNG encoding (depth=${bitDepth}, type=${colourType}, interlace=${interlace})`);
  }
  if (colourType === 3 && (!palette || palette.length % 3 !== 0)) throw new Error(`${label} has an invalid PNG palette`);
  if (width * height > 16_777_216) throw new Error(`${label} exceeds the 16-megapixel verification limit`);
  const compressedLength = compressed.reduce((total, chunk) => total + chunk.length, 0);
  if (compressedLength > 32 * 1024 * 1024) throw new Error(`${label} has more than 32 MiB of compressed pixels`);

  const stride = width * channels;
  const expectedEncodedLength = height * (stride + 1);
  const encoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: expectedEncodedLength });
  if (encoded.length !== expectedEncodedLength) throw new Error(`${label} has an invalid decoded PNG length`);
  const scanlines = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * (stride + 1);
    const filter = encoded[sourceRow];
    if (filter > 4) throw new Error(`${label} uses invalid PNG filter ${filter}`);
    const targetRow = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceRow + x + 1];
      const left = x >= channels ? scanlines[targetRow + x - channels] : 0;
      const above = y > 0 ? scanlines[targetRow + x - stride] : 0;
      const upperLeft = y > 0 && x >= channels ? scanlines[targetRow + x - stride - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : paeth(left, above, upperLeft);
      scanlines[targetRow + x] = (raw + predictor) & 0xff;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    let red;
    let green;
    let blue;
    let alpha = 255;
    if (colourType === 6) [red, green, blue, alpha] = scanlines.subarray(source, source + 4);
    else if (colourType === 4) {
      red = green = blue = scanlines[source];
      alpha = scanlines[source + 1];
    } else if (colourType === 2) {
      red = scanlines[source];
      green = scanlines[source + 1];
      blue = scanlines[source + 2];
      if (transparency?.length === 6
        && red === transparency.readUInt16BE(0)
        && green === transparency.readUInt16BE(2)
        && blue === transparency.readUInt16BE(4)) alpha = 0;
    } else if (colourType === 3) {
      const index = scanlines[source];
      if (index * 3 + 2 >= palette.length) throw new Error(`${label} references an invalid PNG palette index`);
      red = palette[index * 3];
      green = palette[index * 3 + 1];
      blue = palette[index * 3 + 2];
      alpha = transparency?.[index] ?? 255;
    } else {
      red = green = blue = scanlines[source];
      if (transparency?.length === 2 && red === transparency.readUInt16BE(0)) alpha = 0;
    }
    // Invisible RGB is not a rendered-pixel difference and AAPT may normalize it.
    rgba[target] = alpha ? red : 0;
    rgba[target + 1] = alpha ? green : 0;
    rgba[target + 2] = alpha ? blue : 0;
    rgba[target + 3] = alpha;
  }
  const dimensions = Buffer.alloc(8);
  dimensions.writeUInt32BE(width, 0);
  dimensions.writeUInt32BE(height, 4);
  return { width, height, hash: sha256(Buffer.concat([dimensions, rgba])) };
}

function resourceNameForModel(file) {
  return `raw/assets_models_${basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
}

function resourceNameForIcon(file) {
  return `drawable/assets_objecticons_${basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
}

function singleArchivePath(resources, resourceName) {
  const files = resources.get(resourceName) ?? [];
  const paths = [...new Set(files.map((entry) => entry.archivePath))];
  if (paths.length !== 1) {
    problem(`${resourceName}: expected one APK resource file, found ${paths.length}`);
    return null;
  }
  return paths[0];
}

const densityScales = new Map([
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
]);

function configAsset(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} is missing from app.json`);
  const file = resolve(ROOT, value);
  if (!existsSync(file)) throw new Error(`${label} does not exist: ${file}`);
  return file;
}

function splashConfig() {
  const plugin = appConfig.plugins?.find((entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen');
  const options = plugin?.[1];
  if (!options || typeof options.imageWidth !== 'number') throw new Error('expo-splash-screen image/imageWidth is missing from app.json');
  return { source: configAsset(options.image, 'splash image'), width: options.imageWidth };
}

async function generateCurrentBrand(kind, scale) {
  const adaptive = appConfig.android?.adaptiveIcon ?? {};
  const createImage = async (src, size, extra = {}) => (await imageUtils.generateImageAsync(
    { projectRoot: ROOT },
    { src, width: size, height: size, resizeMode: 'cover', ...extra },
  )).source;

  if (kind === 'launcher') return createImage(configAsset(appConfig.icon, 'Expo icon'), 48 * scale);
  if (kind === 'round') {
    const size = 48 * scale;
    return createImage(configAsset(appConfig.icon, 'Expo icon'), size, { borderRadius: size / 2 });
  }
  if (kind === 'foreground') {
    return createImage(configAsset(adaptive.foregroundImage, 'adaptive foreground'), 108 * scale, { backgroundColor: 'transparent' });
  }
  if (kind === 'monochrome') {
    return createImage(configAsset(adaptive.monochromeImage, 'adaptive monochrome'), 108 * scale, { backgroundColor: 'transparent' });
  }
  if (kind === 'background') {
    if (adaptive.backgroundImage) {
      return createImage(configAsset(adaptive.backgroundImage, 'adaptive background'), 108 * scale, { backgroundColor: 'transparent' });
    }
    return imageUtils.generateImageBackgroundAsync({
      width: 108 * scale,
      height: 108 * scale,
      backgroundColor: adaptive.backgroundColor ?? '#ffffff',
    });
  }
  if (kind === 'splash') {
    const splash = splashConfig();
    const canvasSize = 288 * scale;
    const imageSize = splash.width * scale;
    const background = await imageUtils.generateImageBackgroundAsync({
      width: canvasSize,
      height: canvasSize,
      backgroundColor: 'transparent',
    });
    const foreground = (await imageUtils.generateImageAsync(
      { projectRoot: ROOT },
      { src: splash.source, width: imageSize, height: imageSize, resizeMode: 'contain' },
    )).source;
    return imageUtils.compositeImagesAsync({
      background,
      foreground,
      x: (canvasSize - imageSize) / 2,
      y: (canvasSize - imageSize) / 2,
    });
  }
  throw new Error(`unknown brand image kind: ${kind}`);
}

let zip;
let aapt2;
let resources;
let badging;
let signature;
try {
  zip = readZip(apk);
  aapt2 = findAndroidBuildTool('aapt2', process.env.AAPT2);
  const dump = execFileSync(aapt2, ['dump', 'resources', apk], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  resources = parseResourceFiles(dump);
  badging = execFileSync(aapt2, ['dump', 'badging', apk], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const apksigner = findAndroidBuildTool('apksigner', process.env.APKSIGNER);
  signature = runCaptured(apksigner, ['verify', '--verbose', '--print-certs', apk]);
  if (signature.error) throw signature.error;
} catch (error) {
  console.error(`Could not inspect ${apk}: ${error.message}`);
  process.exit(1);
}

const packageMatch = badging.match(/^package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'/m);
const actualPackage = packageMatch?.[1];
const actualVersionCode = packageMatch?.[2];
const actualVersionName = packageMatch?.[3];
const expectedPackage = appConfig?.android?.package;
const expectedVersionCode = String(appConfig?.android?.versionCode ?? '');
const expectedVersionName = appConfig?.version;
if (!packageMatch) problem('aapt2 badging did not contain package/version metadata');
if (actualPackage !== expectedPackage) problem(`package is ${actualPackage}, expected ${expectedPackage}`);
if (actualVersionName !== expectedVersionName) problem(`versionName is ${actualVersionName}, expected ${expectedVersionName}`);
if (actualVersionCode !== expectedVersionCode) problem(`versionCode is ${actualVersionCode}, expected ${expectedVersionCode}`);

const packagedAbis = new Set(
  [...zip.entries.keys()]
    .map((name) => name.match(/^lib\/([^/]+)\/[^/]+\.so$/)?.[1])
    .filter(Boolean),
);
if (packagedAbis.size !== 1 || !packagedAbis.has('arm64-v8a')) {
  problem(`native ABI set is ${[...packagedAbis].sort().join(', ') || '(empty)'}, expected only arm64-v8a`);
}
const badgingAbis = badging.match(/^native-code:\s+(.+)$/m)?.[1]
  ?.match(/'([^']+)'/g)
  ?.map((value) => value.slice(1, -1)) ?? [];
if (badgingAbis.length !== 1 || badgingAbis[0] !== 'arm64-v8a') {
  problem(`aapt2 native-code is ${badgingAbis.join(', ') || '(empty)'}, expected only arm64-v8a`);
}

const signatureOutput = `${signature.stdout ?? ''}\n${signature.stderr ?? ''}`;
const signatureValid = signature.status === 0;
if (!signatureValid) {
  problem(`APK signature verification failed (apksigner exit ${signature.status}): ${signatureOutput.replace(/\s+/g, ' ').trim().slice(0, 500)}`);
}
const debugCertificate = /CN=Android Debug/i.test(signatureOutput);

const modelFiles = readdirSync(resolve(ROOT, 'assets/models')).filter((name) => name.endsWith('.glb')).sort();
const iconFiles = readdirSync(resolve(ROOT, 'assets/object-icons')).filter((name) => name.endsWith('.png')).sort();
if (modelFiles.length !== 26) problem(`source model count is ${modelFiles.length}, expected 26`);
if (iconFiles.length !== 26) problem(`source object-icon count is ${iconFiles.length}, expected 26`);

const expectedModelResources = new Set(modelFiles.map(resourceNameForModel));
const packagedModelResources = [...resources.keys()].filter((name) => name.startsWith('raw/assets_models_'));
for (const extra of packagedModelResources.filter((name) => !expectedModelResources.has(name))) {
  problem(`unexpected packaged model resource: ${extra}`);
}
let matchingModels = 0;
const expectedAaptModelPaths = new Set();
for (const file of modelFiles) {
  const resourceName = resourceNameForModel(file);
  const archivePath = singleArchivePath(resources, resourceName);
  if (!archivePath) continue;
  expectedAaptModelPaths.add(archivePath);
  try {
    const sourceHash = sha256(readFileSync(resolve(ROOT, 'assets/models', file)));
    const packagedHash = sha256(zip.extract(archivePath));
    if (sourceHash !== packagedHash) problem(`${file}: packaged model bytes do not match the current source (${archivePath})`);
    else matchingModels += 1;
  } catch (error) {
    problem(`${file}: ${error.message}`);
  }
}

let matchingMetroModels = 0;
const expectedMetroModelPaths = new Set(modelFiles.map((file) => `assets/${file}`));
for (const file of modelFiles) {
  const archivePath = `assets/${file}`;
  if (!zip.entries.has(archivePath)) {
    problem(`missing Metro model archive entry: ${archivePath}`);
    continue;
  }
  try {
    const sourceHash = sha256(readFileSync(resolve(ROOT, 'assets/models', file)));
    const packagedHash = sha256(zip.extract(archivePath));
    if (sourceHash !== packagedHash) {
      problem(`${file}: packaged Metro model bytes do not match the current source (${archivePath})`);
    } else matchingMetroModels += 1;
  } catch (error) {
    problem(`${file}: ${error.message}`);
  }
}

const expectedGlbPaths = new Set([...expectedMetroModelPaths, ...expectedAaptModelPaths]);
const packagedGlbPaths = [...zip.entries.keys()].filter((name) => name.endsWith('.glb'));
for (const archivePath of packagedGlbPaths) {
  if (!expectedGlbPaths.has(archivePath)) problem(`unexpected GLB archive entry: ${archivePath}`);
}

const expectedIconResources = new Set(iconFiles.map(resourceNameForIcon));
const packagedIconResources = [...resources.keys()].filter((name) => name.startsWith('drawable/assets_objecticons_'));
for (const extra of packagedIconResources.filter((name) => !expectedIconResources.has(name))) {
  problem(`unexpected packaged object-icon resource: ${extra}`);
}
let matchingIcons = 0;
const sourceIconHashes = new Set();
const packagedIconHashes = new Set();
for (const file of iconFiles) {
  const resourceName = resourceNameForIcon(file);
  const archivePath = singleArchivePath(resources, resourceName);
  if (!archivePath) continue;
  try {
    const source = decodedPng(readFileSync(resolve(ROOT, 'assets/object-icons', file)), file);
    const packaged = decodedPng(zip.extract(archivePath), `${file} in ${archivePath}`);
    sourceIconHashes.add(source.hash);
    packagedIconHashes.add(packaged.hash);
    if (source.width !== 256 || source.height !== 256) problem(`${file}: source icon is ${source.width}x${source.height}, expected 256x256`);
    if (packaged.width !== source.width || packaged.height !== source.height || packaged.hash !== source.hash) {
      problem(`${file}: packaged decoded pixels do not match the current source (${archivePath})`);
    } else matchingIcons += 1;
  } catch (error) {
    problem(`${file}: ${error.message}`);
  }
}
if (sourceIconHashes.size !== iconFiles.length) problem(`source object icons have only ${sourceIconHashes.size}/${iconFiles.length} unique decoded-pixel hashes`);
if (packagedIconHashes.size !== matchingIcons) problem(`packaged object icons have only ${packagedIconHashes.size}/${matchingIcons} unique decoded-pixel hashes`);

const brandResources = [
  { resource: 'mipmap/ic_launcher', folder: 'mipmap', file: 'ic_launcher.webp', kind: 'launcher', adaptiveXml: true },
  { resource: 'mipmap/ic_launcher_background', folder: 'mipmap', file: 'ic_launcher_background.webp', kind: 'background' },
  { resource: 'mipmap/ic_launcher_foreground', folder: 'mipmap', file: 'ic_launcher_foreground.webp', kind: 'foreground' },
  { resource: 'mipmap/ic_launcher_monochrome', folder: 'mipmap', file: 'ic_launcher_monochrome.webp', kind: 'monochrome' },
  { resource: 'mipmap/ic_launcher_round', folder: 'mipmap', file: 'ic_launcher_round.webp', kind: 'round', adaptiveXml: true },
  { resource: 'drawable/splashscreen_logo', folder: 'drawable', file: 'splashscreen_logo.png', kind: 'splash' },
];
let matchingBrand = 0;
for (const definition of brandResources) {
  const files = resources.get(definition.resource) ?? [];
  const allowedQualifiers = new Set([
    ...densityScales.keys(),
    ...(definition.adaptiveXml ? ['anydpi-v26'] : []),
  ]);
  for (const entry of files) {
    if (!allowedQualifiers.has(entry.qualifier)) {
      problem(`${definition.resource}: unexpected packaged qualifier ${entry.qualifier || '(default)'}`);
    }
  }
  if (definition.adaptiveXml) {
    const xml = files.filter((entry) => entry.qualifier === 'anydpi-v26');
    if (xml.length !== 1) problem(`${definition.resource}: expected one anydpi-v26 adaptive-icon resource, found ${xml.length}`);
  }

  for (const [density, scale] of densityScales) {
    const candidates = files.filter((entry) => entry.qualifier === density);
    if (candidates.length !== 1) {
      problem(`${definition.resource} (${density}): expected one APK resource file, found ${candidates.length}`);
      continue;
    }
    const archivePath = candidates[0].archivePath;
    const localPath = resolve(ROOT, `android/app/src/main/res/${definition.folder}-${density}/${definition.file}`);
    try {
      if (!existsSync(localPath)) throw new Error(`generated native resource is missing: ${localPath}`);
      const expected = decodedPng(await generateCurrentBrand(definition.kind, scale), `${definition.resource} (${density}) expected source`);
      const native = decodedPng(readFileSync(localPath), `${definition.resource} (${density}) generated native resource`);
      const packaged = decodedPng(zip.extract(archivePath, 32 * 1024 * 1024), `${definition.resource} (${density}) in ${archivePath}`);
      if (native.width !== expected.width || native.height !== expected.height || native.hash !== expected.hash) {
        problem(`${definition.resource} (${density}): generated native pixels do not match the current app.json brand source`);
      }
      if (packaged.width !== expected.width || packaged.height !== expected.height || packaged.hash !== expected.hash) {
        problem(`${definition.resource} (${density}): packaged brand pixels do not match the current app.json source (${archivePath})`);
      } else matchingBrand += 1;
    } catch (error) {
      problem(`${definition.resource} (${density}): ${error.message}`);
    }
  }
}

console.log(`${basename(apk)}: ${zip.entries.size} archive entries inspected with ${basename(aapt2)}`);
console.log(`Package: ${actualPackage}; versionName=${actualVersionName}; versionCode=${actualVersionCode}`);
console.log(`Native ABI: ${[...packagedAbis].sort().join(', ') || '(none)'}${packagedAbis.size === 1 && packagedAbis.has('arm64-v8a') ? ' (only)' : ''}`);
console.log(`Signature: ${signatureValid ? 'valid' : 'INVALID'}${debugCertificate ? ' (Android Debug certificate warning)' : ''}`);
console.log(`Models (Metro): ${matchingMetroModels}/${modelFiles.length} exact assets/*.glb byte matches`);
console.log(`Models (AAPT): ${matchingModels}/${modelFiles.length} exact named resource-byte matches (${packagedModelResources.length} packaged model resources)`);
console.log(`GLB archive set: ${packagedGlbPaths.length}/${expectedGlbPaths.size} entries across the exact Metro + AAPT families`);
console.log(`Object icons: ${matchingIcons}/${iconFiles.length} exact named decoded-pixel matches (${packagedIconResources.length} packaged icon resources)`);
console.log(`Brand: ${matchingBrand}/${brandResources.length * densityScales.size} current source-pixel matches`);

if (problems.length) {
  console.error(`\nAPK asset verification failed with ${problems.length} problem(s):`);
  for (const message of problems) console.error(`  - ${message}`);
  process.exit(1);
}

console.log('OK: both exact 26-model families and all 26 unique object icons are present in the APK');
