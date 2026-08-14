import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Overlay = {
  title?: string;
  subtitle?: string;
  summary?: string;
  scale?: string;
  parts?: Record<string, { name?: string; short?: string; detail?: string }>;
  steps?: Array<{ title?: string; body?: string }>;
  quiz?: Array<{ prompt?: string; choices?: string[]; explain?: string }>;
};

type ChoiceQuestion = {
  type: 'choice';
  prompt: string;
  choices: string[];
  answer: number;
  explain?: string;
};

type IdentifyQuestion = {
  type: 'identify';
  prompt: string;
  partId: string;
};

type ObjectDoc = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  scale?: string;
  model: string;
  parts: Array<{ id: string; name: string; short: string; detail: string }>;
  steps: Array<{ title: string; body: string }>;
  quiz: Array<ChoiceQuestion | IdentifyQuestion>;
};

type IconMetric = {
  bounds?: { width?: number; height?: number };
};

type ProsePair = { path: string; english: string; indonesian: string };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'content');
const ICONS = resolve(ROOT, 'assets/object-icons');
const METRICS = resolve(ROOT, 'tools/object-icon-metrics.json');
const REGISTRY = resolve(ROOT, 'src/content/registry.ts');
const UI_STRINGS = resolve(ROOT, 'src/i18n/strings.ts');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LOCALIZATION_ONLY = process.argv.includes('--localization-only');
const TOP_LEVEL_OVERLAY_FIELDS = ['parts', 'quiz', 'scale', 'steps', 'subtitle', 'summary', 'title'];
const PART_OVERLAY_FIELDS = ['detail', 'name', 'short'];
const STEP_OVERLAY_FIELDS = ['body', 'title'];
const QUIZ_OVERLAY_FIELDS = ['choices', 'explain', 'prompt'];

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

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(value: unknown, allowed: string[], required: string[] = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.every((key) => allowed.includes(key)) && required.every((key) => keys.includes(key));
}

function sameSet(actual: string[], expected: string[]) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
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

function readStringDictionary(sourceText: string, variableName: string) {
  const source = ts.createSourceFile(UI_STRINGS, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const values = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName) continue;
      const initializer = declaration.initializer;
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) continue;
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name)
          ? property.name.text
          : ts.isIdentifier(property.name)
            ? property.name.text
            : null;
        const value = property.initializer;
        if (key && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
          values.set(key, value.text);
        }
      }
    }
  }

  return values;
}

function placeholders(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

function collectProsePairs(base: ObjectDoc, overlay: Overlay) {
  const pairs: ProsePair[] = [];
  const add = (path: string, english: string | undefined, indonesian: string | undefined) => {
    if (nonEmpty(english) && nonEmpty(indonesian)) pairs.push({ path: `${base.id}.${path}`, english, indonesian });
  };

  add('subtitle', base.subtitle, overlay.subtitle);
  add('summary', base.summary, overlay.summary);
  base.parts.forEach((part) => {
    const translated = overlay.parts?.[part.id];
    add(`parts.${part.id}.short`, part.short, translated?.short);
    add(`parts.${part.id}.detail`, part.detail, translated?.detail);
  });
  base.steps.forEach((step, index) => {
    const translated = overlay.steps?.[index];
    add(`steps.${index}.title`, step.title, translated?.title);
    add(`steps.${index}.body`, step.body, translated?.body);
  });
  base.quiz.forEach((question, index) => {
    const translated = overlay.quiz?.[index];
    add(`quiz.${index}.prompt`, question.prompt, translated?.prompt);
    if (question.type === 'choice') {
      question.choices.forEach((choice, choiceIndex) => {
        add(`quiz.${index}.choices.${choiceIndex}`, choice, translated?.choices?.[choiceIndex]);
      });
      add(`quiz.${index}.explain`, question.explain, translated?.explain);
    }
  });
  return pairs;
}

function likelyEnglishLeak({ english, indonesian }: ProsePair) {
  const normalise = (value: string) => value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim();
  const words = normalise(indonesian).split(/\s+/).filter(Boolean);
  if (words.length >= 4 && normalise(english) === normalise(indonesian)) return true;

  const englishFunctionWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'because', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its',
    'of', 'on', 'or', 'that', 'the', 'this', 'through', 'to', 'when', 'where', 'which', 'while', 'with', 'without',
  ]);
  const indonesianFunctionWords = new Set([
    'agar', 'atau', 'dalam', 'dan', 'dari', 'dengan', 'di', 'ini', 'itu', 'karena', 'ke', 'ketika', 'pada',
    'sebagai', 'sehingga', 'tanpa', 'untuk', 'yang',
  ]);
  const englishScore = words.filter((word) => englishFunctionWords.has(word)).length;
  const indonesianScore = words.filter((word) => indonesianFunctionWords.has(word)).length;
  return words.length >= 8 && englishScore >= 3 && englishScore > indonesianScore;
}

function validateOverlay(base: ObjectDoc, overlay: Overlay) {
  const partIds = base.parts.map((part) => part.id);
  const overlayPartIds = Object.keys(overlay.parts ?? {});
  const partsComplete = sameSet(overlayPartIds, partIds) && base.parts.every((part) => {
    const value = overlay.parts?.[part.id];
    return exactKeys(value, PART_OVERLAY_FIELDS) && nonEmpty(value?.name) && nonEmpty(value?.short) && nonEmpty(value?.detail);
  });

  const stepsComplete = overlay.steps?.length === base.steps.length && overlay.steps.every((step) => (
    exactKeys(step, STEP_OVERLAY_FIELDS) && nonEmpty(step.title) && nonEmpty(step.body)
  ));

  const quizComplete = overlay.quiz?.length === base.quiz.length && overlay.quiz.every((item, index) => {
    const original = base.quiz[index];
    if (!original || !nonEmpty(item.prompt)) return false;
    if (original.type === 'identify') return exactKeys(item, QUIZ_OVERLAY_FIELDS, ['prompt']) && !item.choices && !item.explain;
    const requiresExplain = nonEmpty(original.explain);
    return exactKeys(item, QUIZ_OVERLAY_FIELDS, requiresExplain ? ['choices', 'explain', 'prompt'] : ['choices', 'prompt'])
      && item.choices?.length === original.choices.length
      && item.choices.every(nonEmpty)
      && (!requiresExplain || nonEmpty(item.explain));
  });

  return { partsComplete, stepsComplete: Boolean(stepsComplete), quizComplete: Boolean(quizComplete) };
}

function run() {
  console.log(`\nCatalog localization${LOCALIZATION_ONLY ? '' : ' and icon'} contract`);

  const english = readdirSync(CONTENT).filter((name) => name.endsWith('.json')).sort();
  const indonesian = existsSync(resolve(CONTENT, 'id'))
    ? readdirSync(resolve(CONTENT, 'id')).filter((name) => name.endsWith('.json')).sort()
    : [];
  const registry = readFileSync(REGISTRY, 'utf8');
  const metrics = LOCALIZATION_ONLY ? null : readJson<Record<string, IconMetric> | null>(METRICS, null);
  const uiSource = readFileSync(UI_STRINGS, 'utf8');
  const englishUi = readStringDictionary(uiSource, 'en');
  const indonesianUi = readStringDictionary(uiSource, 'id');
  const registeredDocs = [...registry.matchAll(/doc:\s*require\('\.\.\/\.\.\/content\/([^']+\.json)'\)/g)]
    .map((match) => match[1]);
  const leaks: ProsePair[] = [];

  check('English and Indonesian filenames match exactly', JSON.stringify(indonesian) === JSON.stringify(english));
  check('registry contains exactly 26 unique documents', registeredDocs.length === 26 && new Set(registeredDocs).size === 26);
  check('registry document set matches English content', sameSet(registeredDocs, english));
  check('English and Indonesian UI keys match', sameSet([...englishUi.keys()], [...indonesianUi.keys()]));
  const placeholderMismatches = [...englishUi.entries()].filter(([key, value]) => (
    JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(indonesianUi.get(key) ?? ''))
  ));
  check(
    'Indonesian UI placeholders match English exactly',
    placeholderMismatches.length === 0,
    placeholderMismatches.map(([key]) => key).join(', '),
  );
  if (!LOCALIZATION_ONLY) check('object icon metrics exist', metrics !== null);

  for (const file of english) {
    const base = readJson<ObjectDoc>(resolve(CONTENT, file), {
      id: file,
      title: '',
      subtitle: '',
      summary: '',
      model: '',
      parts: [],
      steps: [],
      quiz: [],
    });
    const overlayFile = resolve(CONTENT, 'id', file);
    const overlay = readJson<Overlay>(overlayFile, {});
    const result = validateOverlay(base, overlay);

    check(`${base.id} Indonesian overlay exists`, existsSync(overlayFile));
    check(`${base.id} overlay contains prose fields only`, exactKeys(overlay, TOP_LEVEL_OVERLAY_FIELDS, ['parts', 'quiz', 'steps', 'subtitle', 'summary', 'title']));
    check(`${base.id} metadata translated`, nonEmpty(overlay.title) && nonEmpty(overlay.subtitle) && nonEmpty(overlay.summary));
    check(`${base.id} scale translated`, !base.scale || nonEmpty(overlay.scale));
    check(`${base.id} parts have exact coverage and fields`, result.partsComplete);
    check(`${base.id} steps have exact coverage and fields`, result.stepsComplete);
    check(`${base.id} quiz choices and explanations are complete`, result.quizComplete);
    check(`${base.id} English document is registered`, registry.includes(`require('../../content/${file}')`));
    check(`${base.id} production model is registered`, registry.includes(`require('../../assets/models/${base.model}.glb')`));
    check(`${base.id} Indonesian translation is registered`, registry.includes(`require('../../content/id/${file}')`));
    leaks.push(...collectProsePairs(base, overlay).filter(likelyEnglishLeak));

    if (LOCALIZATION_ONLY) continue;

    const iconFile = resolve(ICONS, `${base.id}.png`);
    const header = readPngHeader(iconFile);
    const coverage = iconCoverage(metrics?.[base.id]);
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

  check(
    'Indonesian overlays contain no likely English prose leakage',
    leaks.length === 0,
    leaks.slice(0, 8).map((leak) => leak.path).join(', '),
  );

  if (failures) {
    console.error(`\n${failures} catalog quality check(s) failed.`);
    process.exit(1);
  }

  console.log(`\nCatalog localization${LOCALIZATION_ONLY ? '' : ' and icon'} contract passed.`);
}

run();
