import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Overlay = {
  title?: string;
  subtitle?: string;
  summary?: string;
  scale?: string;
  parts?: Record<string, { name?: string; short?: string; detail?: string }>;
  steps?: Array<{ title?: string; body?: string }>;
  quiz?: Array<{ prompt?: string }>;
};

type ObjectDoc = {
  id: string;
  scale?: string;
  parts: Array<{ id: string }>;
  steps: unknown[];
  quiz: unknown[];
};

type IconMetric = {
  bounds?: { width?: number; height?: number };
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'content');
const ICONS = resolve(ROOT, 'assets/object-icons');
const METRICS = resolve(ROOT, 'tools/object-icon-metrics.json');
const REGISTRY = resolve(ROOT, 'src/content/registry.ts');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let failures = 0;

const check = (label: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures += 1;
  console.error(`  ✕ ${label}${detail ? ` — ${detail}` : ''}`);
};

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
}

function readPngHeader(file: string) {
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  const validSignature = bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  const validIhdr = bytes.length >= 33 && bytes.subarray(12, 16).toString('ascii') === 'IHDR';
  if (!validSignature || !validIhdr) return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colourType: bytes[25],
  };
}

function iconCoverage(metric: IconMetric | undefined) {
  const width = metric?.bounds?.width;
  const height = metric?.bounds?.height;
  return Number.isFinite(width) && Number.isFinite(height) ? { width: width! / 256, height: height! / 256 } : null;
}

function run() {
  console.log('\nCatalog localization and icon contract');

  const english = readdirSync(CONTENT).filter((name) => name.endsWith('.json')).sort();
  const indonesian = existsSync(resolve(CONTENT, 'id'))
    ? readdirSync(resolve(CONTENT, 'id')).filter((name) => name.endsWith('.json')).sort()
    : [];
  const registry = readFileSync(REGISTRY, 'utf8');
  const metrics = readJson<Record<string, IconMetric> | null>(METRICS, null);

  check('every object has Indonesian content', JSON.stringify(indonesian) === JSON.stringify(english));
  check('object icon metrics exist', metrics !== null);

  for (const file of english) {
    const base = readJson<ObjectDoc>(resolve(CONTENT, file), { id: file, parts: [], steps: [], quiz: [] });
    const overlayFile = resolve(CONTENT, 'id', file);
    const overlay = readJson<Overlay>(overlayFile, {});
    const iconFile = resolve(ICONS, `${base.id}.png`);
    const header = readPngHeader(iconFile);
    const coverage = iconCoverage(metrics?.[base.id]);

    check(`${base.id} Indonesian overlay exists`, existsSync(overlayFile));
    check(`${base.id} metadata translated`, Boolean(overlay.title && overlay.subtitle && overlay.summary));
    check(`${base.id} scale translated`, !base.scale || Boolean(overlay.scale));
    check(`${base.id} parts complete`, base.parts.every((part) => {
      const value = overlay.parts?.[part.id];
      return Boolean(value?.name && value?.short && value?.detail);
    }));
    check(`${base.id} steps complete`, overlay.steps?.length === base.steps.length && overlay.steps.every((step) => step.title && step.body));
    check(`${base.id} quiz complete`, overlay.quiz?.length === base.quiz.length && overlay.quiz.every((item) => item.prompt));

    check(
      `${base.id} Indonesian translation is registered`,
      registry.includes(`require('../../content/id/${file}')`),
    );
    check(
      `${base.id} icon is registered`,
      registry.includes(`require('../../assets/object-icons/${base.id}.png')`),
    );
    check(`${base.id} icon exists`, existsSync(iconFile));
    check(`${base.id} icon has a valid PNG header`, header !== null);
    check(`${base.id} icon is 256×256`, header?.width === 256 && header?.height === 256);
    check(`${base.id} icon has an alpha channel`, header?.colourType === 4 || header?.colourType === 6);
    check(`${base.id} icon alpha bounds are recorded`, coverage !== null);
    check(
      `${base.id} icon alpha coverage is 62–88%`,
      coverage !== null && coverage.width >= 0.62 && coverage.width <= 0.88 && coverage.height >= 0.62 && coverage.height <= 0.88,
      coverage ? `${Math.round(coverage.width * 100)}×${Math.round(coverage.height * 100)}%` : '',
    );
  }

  if (failures) {
    console.error(`\n${failures} catalog quality check(s) failed.`);
    process.exit(1);
  }

  console.log('\nCatalog localization and icon contract passed.');
}

run();
