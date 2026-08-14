import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
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
  category: string;
  accent: string;
  summary: string;
  scale?: string;
  model: string;
  parts: Array<{ id: string; name: string; short: string; detail: string; hidden?: boolean }>;
  steps: Array<{ title: string; body: string }>;
  quiz: Array<ChoiceQuestion | IdentifyQuestion>;
};

type IconBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type IconMetric = {
  width?: number;
  height?: number;
  bounds?: Partial<IconBounds>;
};

type ProsePair = { path: string; english: string; indonesian: string };

type RegistryExpectation = {
  id: string;
  model: string;
};

type RegistryTuple = {
  docPath: string | null;
  modelPath: string | null;
  iconPath: string | null;
  idTranslationPath: string | null;
};

type RuntimeSummary = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  accent: string;
  summary: string;
  scale?: string;
  partCount: number;
  icon?: string;
};

type RuntimeRegistry = {
  getLibrary(locale: 'en' | 'id'): RuntimeSummary[];
};

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
const EXACT_SOURCE_ALLOWLIST = new Map<string, string>([
  ['electric-motor.parts.stator.name', 'Stator'],
  ['eye.parts.limbus.name', 'Limbus'],
  ['eye.parts.iris.name', 'Iris'],
  ['eye.parts.pupil.name', 'Pupil'],
  ['eye.parts.retina.name', 'Retina'],
  ['eye.parts.fovea.name', 'Fovea'],
  ['hard-disk.title', 'Hard Disk'],
  ['heart.parts.aorta.name', 'Aorta'],
  ['inner-ear.parts.stapes.name', 'Stapes'],
  ['kidney.parts.ureter.name', 'Ureter'],
  ['kidney.parts.glomerulus.name', 'Glomerulus'],
  ['loudspeaker.parts.magnet.name', 'Magnet'],
  ['lung.parts.pleura.name', 'Pleura'],
  ['lung.parts.alveoli.name', 'Alveoli'],
  ['mechanical-watch.parts.bezel.name', 'Bezel'],
  ['microwave.parts.magnetron.name', 'Magnetron'],
  ['piston-engine.parts.piston.name', 'Piston'],
  ['rocket-engine.parts.gimbal.name', 'Gimbal'],
  ['tooth.parts.dentin.name', 'Dentin'],
  ['tooth.parts.gingiva.name', 'Gingiva'],
  ['violin.quiz.1.choices.3', 'Magnet'],
]);
const TECHNICAL_PHRASE_ALLOWLIST = new Map<string, readonly string[]>([
  ['camera.steps.2.body', ['single lens reflex']],
  ['hard-disk.parts.heads.detail', ['head crash']],
  ['smartphone.parts.logic_board.detail', ['package on package']],
  ['turbofan.subtitle', ['high bypass']],
  ['violin.steps.0.body', ['stick slip']],
]);
const ENGLISH_FUNCTION_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'because', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its',
  'of', 'on', 'or', 'that', 'the', 'this', 'through', 'to', 'when', 'where', 'which', 'while', 'with', 'without',
]);
const ENGLISH_ONLY_WORDS = new Set([
  'after', 'before', 'between', 'bypass', 'captures', 'changes', 'crash', 'during', 'exposure', 'faster', 'flows',
  'head', 'high', 'image', 'images', 'inside', 'lens', 'moves', 'never', 'only', 'outside', 'package', 'pressure',
  'produces', 'pushes', 'reaches', 'reflex', 'returns', 'single', 'slip', 'slower', 'stick', 'stores', 'throughout',
  'toward', 'turns', 'wherever', 'works',
]);
const ENGLISH_RUN_WORDS = new Set([...ENGLISH_FUNCTION_WORDS, ...ENGLISH_ONLY_WORDS]);

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

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : null;
}

function propertyInitializer(object: ts.ObjectLiteralExpression, name: string) {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) return property.initializer;
  }
  return null;
}

function staticRequirePath(expression: ts.Expression | null) {
  if (!expression) return null;
  const value = unwrapExpression(expression);
  if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression) || value.expression.text !== 'require') return null;
  if (value.arguments.length !== 1) return null;
  const argument = value.arguments[0];
  return ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument) ? argument.text : null;
}

function parseRegistryTuples(sourceText: string): RegistryTuple[] {
  const source = ts.createSourceFile(REGISTRY, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let entries: ts.ArrayLiteralExpression | null = null;

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'ENTRIES' || !declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrayLiteralExpression(initializer)) entries = initializer;
    }
  }

  if (!entries) return [];
  return entries.elements.map((element) => {
    const value = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(value)) {
      return { docPath: null, modelPath: null, iconPath: null, idTranslationPath: null };
    }
    const translationsValue = propertyInitializer(value, 'translations');
    const translations = translationsValue ? unwrapExpression(translationsValue) : null;
    const idTranslation = translations && ts.isObjectLiteralExpression(translations)
      ? propertyInitializer(translations, 'id')
      : null;
    return {
      docPath: staticRequirePath(propertyInitializer(value, 'doc')),
      modelPath: staticRequirePath(propertyInitializer(value, 'model')),
      iconPath: staticRequirePath(propertyInitializer(value, 'icon')),
      idTranslationPath: staticRequirePath(idTranslation),
    };
  });
}

function registryTupleStatus(tuples: RegistryTuple[], expectation: RegistryExpectation) {
  const file = `${expectation.id}.json`;
  const docPath = `../../content/${file}`;
  const tuple = tuples.find((candidate) => candidate.docPath === docPath);
  return {
    doc: Boolean(tuple),
    model: tuple?.modelPath === `../../assets/models/${expectation.model}.glb`,
    icon: tuple?.iconPath === `../../assets/object-icons/${expectation.id}.png`,
    translation: tuple?.idTranslationPath === `../../content/id/${file}`,
  };
}

function registryRequirementsAppear(sourceText: string, expectation: RegistryExpectation) {
  return registryTupleStatus(parseRegistryTuples(sourceText), expectation);
}

function swapUniqueLiterals(sourceText: string, first: string, second: string) {
  const marker = '__catalog_quality_swap_marker__';
  if (sourceText.split(first).length !== 2 || sourceText.split(second).length !== 2 || sourceText.includes(marker)) {
    throw new Error(`Mutation fixture requires unique literals: ${first}, ${second}`);
  }
  return sourceText.replace(first, marker).replace(second, first).replace(marker, second);
}

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

/** Decode the browser-generated 8-bit alpha PNG rather than trusting its header. */
function readPng(file: string) {
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file);
  const validSignature = bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (!validSignature) return null;

  let offset = PNG_SIGNATURE.length;
  let ihdr: Buffer | null = null;
  const idat: Buffer[] = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') ihdr = data;
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') {
      ended = true;
      break;
    }
    offset = dataEnd + 4;
  }
  if (!ihdr || ihdr.length !== 13 || !idat.length || !ended) return null;

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colourType = ihdr[9];
  const compression = ihdr[10];
  const filtering = ihdr[11];
  const interlace = ihdr[12];
  const channels = colourType === 6 ? 4 : colourType === 4 ? 2 : 0;
  if (!width || !height || bitDepth !== 8 || !channels || compression !== 0 || filtering !== 0 || interlace !== 0) {
    return null;
  }

  let encoded: Buffer;
  try {
    encoded = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = width * channels;
  if (encoded.length !== height * (stride + 1)) return null;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = y * (stride + 1);
    const filter = encoded[sourceRow];
    if (filter > 4) return null;
    const targetRow = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceRow + x + 1];
      const left = x >= channels ? pixels[targetRow + x - channels] : 0;
      const above = y > 0 ? pixels[targetRow + x - stride] : 0;
      const upperLeft = y > 0 && x >= channels ? pixels[targetRow + x - stride - channels] : 0;
      const predictor = filter === 0
        ? 0
        : filter === 1
          ? left
          : filter === 2
            ? above
            : filter === 3
              ? Math.floor((left + above) / 2)
              : paeth(left, above, upperLeft);
      pixels[targetRow + x] = (raw + predictor) & 0xff;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * channels + channels - 1];
      if (alpha === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const bounds: IconBounds | null = maxX < minX || maxY < minY
    ? null
    : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return { width, height, bitDepth, colourType, pixels, bounds };
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

function loadRuntimeRegistry(): RuntimeRegistry {
  type CompilableModule = { exports: unknown; _compile(sourceText: string, filename: string): void };
  type ExtensionLoader = (module: CompilableModule, filename: string) => void;

  const runtimeRequire = createRequire(import.meta.url);
  const extensions = runtimeRequire.extensions as Record<string, ExtensionLoader | undefined>;
  const previousTs = extensions['.ts'];
  const previousGlb = extensions['.glb'];
  const previousPng = extensions['.png'];

  extensions['.ts'] = (module, filename) => {
    const transpiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
      reportDiagnostics: true,
    });
    const errors = transpiled.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
    if (errors.length) {
      throw new Error(ts.formatDiagnostics(errors, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => ROOT,
        getNewLine: () => '\n',
      }));
    }
    module._compile(transpiled.outputText, filename);
  };
  extensions['.glb'] = (module, filename) => {
    module.exports = filename;
  };
  extensions['.png'] = (module, filename) => {
    module.exports = filename;
  };

  try {
    return runtimeRequire(REGISTRY) as RuntimeRegistry;
  } finally {
    if (previousTs) extensions['.ts'] = previousTs;
    else delete extensions['.ts'];
    if (previousGlb) extensions['.glb'] = previousGlb;
    else delete extensions['.glb'];
    if (previousPng) extensions['.png'] = previousPng;
    else delete extensions['.png'];
  }
}

function runtimeLibraryIsCorrect(library: RuntimeSummary[], files: string[]) {
  if (library.length !== 26 || new Set(library.map((summary) => summary.id)).size !== 26) return false;
  const summaries = new Map(library.map((summary) => [summary.id, summary]));
  return files.every((file) => {
    const base = readJson<ObjectDoc>(resolve(CONTENT, file), {
      id: '',
      title: '',
      subtitle: '',
      category: '',
      accent: '',
      summary: '',
      model: '',
      parts: [],
      steps: [],
      quiz: [],
    });
    const overlay = readJson<Overlay>(resolve(CONTENT, 'id', file), {});
    const summary = summaries.get(base.id);
    return summary?.title === overlay.title
      && summary.subtitle === overlay.subtitle
      && summary.summary === overlay.summary
      && summary.scale === (overlay.scale ?? base.scale)
      && summary.category === base.category
      && summary.accent === base.accent
      && summary.partCount === base.parts.filter((part) => !part.hidden).length;
  });
}

function runtimeLibraryIconsAreCorrect(library: RuntimeSummary[], files: string[]) {
  if (library.length !== 26 || new Set(library.map((summary) => summary.id)).size !== 26) return false;
  const summaries = new Map(library.map((summary) => [summary.id, summary]));
  return files.every((file) => {
    const base = readJson<ObjectDoc>(resolve(CONTENT, file), {
      id: '',
      title: '',
      subtitle: '',
      category: '',
      accent: '',
      summary: '',
      model: '',
      parts: [],
      steps: [],
      quiz: [],
    });
    return summaries.get(base.id)?.icon === resolve(ICONS, `${base.id}.png`);
  });
}

function placeholders(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

function collectProsePairs(base: ObjectDoc, overlay: Overlay) {
  const pairs: ProsePair[] = [];
  const add = (path: string, english: string | undefined, indonesian: string | undefined) => {
    if (nonEmpty(english) && nonEmpty(indonesian)) pairs.push({ path: `${base.id}.${path}`, english, indonesian });
  };

  add('title', base.title, overlay.title);
  add('subtitle', base.subtitle, overlay.subtitle);
  add('summary', base.summary, overlay.summary);
  add('scale', base.scale, overlay.scale);
  base.parts.forEach((part) => {
    const translated = overlay.parts?.[part.id];
    add(`parts.${part.id}.name`, part.name, translated?.name);
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

function proseWords(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}

function maskAllowlistedTechnicalPhrases(path: string, words: string[]) {
  const masked = [...words];
  for (const phrase of TECHNICAL_PHRASE_ALLOWLIST.get(path) ?? []) {
    const phraseWords = proseWords(phrase);
    for (let index = 0; index <= words.length - phraseWords.length; index += 1) {
      if (phraseWords.every((word, offset) => words[index + offset] === word)) {
        masked.fill('', index, index + phraseWords.length);
      }
    }
  }
  return masked;
}

function containsRun(words: string[], candidates: Set<string>, minimum: number) {
  let run = 0;
  for (const word of words) {
    run = candidates.has(word) ? run + 1 : 0;
    if (run >= minimum) return true;
  }
  return false;
}

function containsSharedSourceRun(english: string[], indonesian: string[], minimum: number) {
  if (english.length < minimum || indonesian.length < minimum) return false;
  const sourceRuns = new Set<string>();
  for (let index = 0; index <= english.length - minimum; index += 1) {
    sourceRuns.add(english.slice(index, index + minimum).join('\u0000'));
  }
  for (let index = 0; index <= indonesian.length - minimum; index += 1) {
    if (sourceRuns.has(indonesian.slice(index, index + minimum).join('\u0000'))) return true;
  }
  return false;
}

function likelyEnglishLeak({ path, english, indonesian }: ProsePair) {
  const englishWords = proseWords(english);
  const words = proseWords(indonesian);
  const exactSource = englishWords.join(' ') === words.join(' ');
  if (exactSource) {
    const allowlisted = EXACT_SOURCE_ALLOWLIST.get(path);
    return !(allowlisted === english.trim() && allowlisted === indonesian.trim());
  }

  if (containsRun(maskAllowlistedTechnicalPhrases(path, words), ENGLISH_RUN_WORDS, 2)) return true;
  if (containsSharedSourceRun(englishWords, words, 4)) return true;

  const indonesianFunctionWords = new Set([
    'agar', 'atau', 'dalam', 'dan', 'dari', 'dengan', 'di', 'ini', 'itu', 'karena', 'ke', 'ketika', 'pada',
    'sebagai', 'sehingga', 'tanpa', 'untuk', 'yang',
  ]);
  const englishScore = words.filter((word) => ENGLISH_FUNCTION_WORDS.has(word)).length;
  const indonesianScore = words.filter((word) => indonesianFunctionWords.has(word)).length;
  return words.length >= 8 && englishScore >= 3 && englishScore > indonesianScore;
}

function runMutationFixtureChecks(registry: string) {
  const expectations: RegistryExpectation[] = [
    { id: 'smartphone', model: 'smartphone' },
    { id: 'turbofan', model: 'turbofan' },
  ];
  const registryWithIconFixture = registry.includes('../../assets/object-icons/smartphone.png')
    ? registry
    : registry
      .replace(
        "model: require('../../assets/models/smartphone.glb'),",
        "model: require('../../assets/models/smartphone.glb'),\n    icon: require('../../assets/object-icons/smartphone.png'),",
      )
      .replace(
        "model: require('../../assets/models/turbofan.glb'),",
        "model: require('../../assets/models/turbofan.glb'),\n    icon: require('../../assets/object-icons/turbofan.png'),",
      );
  const swappedModels = swapUniqueLiterals(
    registryWithIconFixture,
    '../../assets/models/smartphone.glb',
    '../../assets/models/turbofan.glb',
  );
  const swappedTranslations = swapUniqueLiterals(
    registryWithIconFixture,
    '../../content/id/smartphone.json',
    '../../content/id/turbofan.json',
  );
  const swappedIcons = swapUniqueLiterals(
    registryWithIconFixture,
    '../../assets/object-icons/smartphone.png',
    '../../assets/object-icons/turbofan.png',
  );
  const requirementsPass = (sourceText: string) => expectations.every((expectation) => {
    const registration = registryRequirementsAppear(sourceText, expectation);
    return registration.doc && registration.model && registration.icon && registration.translation;
  });
  const camera = readJson<ObjectDoc>(resolve(CONTENT, 'camera.json'), {
    id: '',
    title: '',
    subtitle: '',
    category: '',
    accent: '',
    summary: '',
    model: '',
    parts: [],
    steps: [],
    quiz: [],
  });
  const cameraOverlay = readJson<Overlay>(resolve(CONTENT, 'id', 'camera.json'), {});
  const hardDisk = readJson<ObjectDoc>(resolve(CONTENT, 'hard-disk.json'), {
    id: '',
    title: '',
    subtitle: '',
    category: '',
    accent: '',
    summary: '',
    model: '',
    parts: [],
    steps: [],
    quiz: [],
  });
  const hardDiskOverlay = readJson<Overlay>(resolve(CONTENT, 'id', 'hard-disk.json'), {});
  const withSensorDetail = (detail: string): Overlay => ({
    ...cameraOverlay,
    parts: {
      ...cameraOverlay.parts,
      sensor: { ...cameraOverlay.parts?.sensor, detail },
    },
  });
  const collectedLeakPaths = (overlay: Overlay) => collectProsePairs(camera, overlay)
    .filter(likelyEnglishLeak)
    .map((pair) => pair.path);

  check('mutation: swapped registry model tuples are rejected', !requirementsPass(swappedModels));
  check('mutation: swapped registry translation tuples are rejected', !requirementsPass(swappedTranslations));
  check('mutation: swapped registry icon tuples are rejected', !requirementsPass(swappedIcons));
  check('mutation: exact short English choices are rejected', likelyEnglishLeak({
    path: 'turbofan.quiz.2.choices.3',
    english: 'All of it',
    indonesian: 'All of it',
  }));
  check(
    'mutation: two consecutive English content words are rejected through prose collection',
    collectedLeakPaths(withSensorDetail('Sensor stores images setelah pencahayaan.'))
      .includes('camera.parts.sensor.detail'),
  );
  check(
    'mutation: an English verb and function word are rejected through prose collection',
    collectedLeakPaths(withSensorDetail('Komponen ini stores the image setelah pencahayaan.'))
      .includes('camera.parts.sensor.detail'),
  );
  const legitimateTechnicalPhrase = collectProsePairs(hardDisk, hardDiskOverlay)
    .find((pair) => pair.path === 'hard-disk.parts.heads.detail');
  check(
    'mutation: a legitimate two-word technical phrase remains valid through prose collection',
    Boolean(
      legitimateTechnicalPhrase?.indonesian.includes('(head crash)')
      && !likelyEnglishLeak(legitimateTechnicalPhrase)
    ),
  );
  check('mutation: allowlisted technical terms remain valid', !likelyEnglishLeak({
    path: 'microwave.parts.magnetron.name',
    english: 'Magnetron',
    indonesian: 'Magnetron',
  }));
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
  const registryTuples = parseRegistryTuples(registry);
  const registeredDocs = registryTuples.flatMap((tuple) => {
    const prefix = '../../content/';
    return tuple.docPath?.startsWith(prefix) && tuple.docPath.endsWith('.json')
      ? [tuple.docPath.slice(prefix.length)]
      : [];
  });
  const leaks: ProsePair[] = [];
  const objectIds: string[] = [];
  const iconPixelHashes: string[] = [];

  runMutationFixtureChecks(registry);

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
  let runtimeLibraryPasses = false;
  let runtimeEnglishIconsPass = false;
  let runtimeIndonesianIconsPass = false;
  let runtimeLibraryDetail = '';
  try {
    const runtime = loadRuntimeRegistry();
    runtimeLibraryPasses = runtimeLibraryIsCorrect(runtime.getLibrary('id'), english);
    runtimeEnglishIconsPass = runtimeLibraryIconsAreCorrect(runtime.getLibrary('en'), english);
    runtimeIndonesianIconsPass = runtimeLibraryIconsAreCorrect(runtime.getLibrary('id'), english);
  } catch (error) {
    runtimeLibraryDetail = error instanceof Error ? error.message : String(error);
  }
  check(
    "runtime getLibrary('id') returns 26 unique correctly localized entries",
    runtimeLibraryPasses,
    runtimeLibraryDetail,
  );
  if (!LOCALIZATION_ONLY) {
    check("runtime getLibrary('en') retains the exact object-specific icon tuple", runtimeEnglishIconsPass);
    check("runtime getLibrary('id') retains the exact object-specific icon tuple", runtimeIndonesianIconsPass);
    check('object icon metrics exist', metrics !== null);
  }

  for (const file of english) {
    const base = readJson<ObjectDoc>(resolve(CONTENT, file), {
      id: file,
      title: '',
      subtitle: '',
      category: '',
      accent: '',
      summary: '',
      model: '',
      parts: [],
      steps: [],
      quiz: [],
    });
    const overlayFile = resolve(CONTENT, 'id', file);
    const overlay = readJson<Overlay>(overlayFile, {});
    const result = validateOverlay(base, overlay);
    objectIds.push(base.id);

    check(`${base.id} Indonesian overlay exists`, existsSync(overlayFile));
    check(`${base.id} overlay contains prose fields only`, exactKeys(overlay, TOP_LEVEL_OVERLAY_FIELDS, ['parts', 'quiz', 'steps', 'subtitle', 'summary', 'title']));
    check(`${base.id} metadata translated`, nonEmpty(overlay.title) && nonEmpty(overlay.subtitle) && nonEmpty(overlay.summary));
    check(`${base.id} scale translated`, !base.scale || nonEmpty(overlay.scale));
    check(`${base.id} parts have exact coverage and fields`, result.partsComplete);
    check(`${base.id} steps have exact coverage and fields`, result.stepsComplete);
    check(`${base.id} quiz choices and explanations are complete`, result.quizComplete);
    const registration = registryTupleStatus(registryTuples, { id: base.id, model: base.model });
    check(`${base.id} English document is registered`, registration.doc);
    check(`${base.id} production model is registered`, registration.model);
    check(`${base.id} Indonesian translation is registered`, registration.translation);
    leaks.push(...collectProsePairs(base, overlay).filter(likelyEnglishLeak));

    if (LOCALIZATION_ONLY) continue;

    const iconFile = resolve(ICONS, `${base.id}.png`);
    const png = readPng(iconFile);
    const coverage = iconCoverage(metrics?.[base.id]);
    check(
      `${base.id} icon is registered`,
      registration.icon,
    );
    check(`${base.id} icon exists`, existsSync(iconFile));
    check(`${base.id} icon has a valid decodable PNG payload`, png !== null);
    check(`${base.id} icon is 256×256`, png?.width === 256 && png?.height === 256);
    check(`${base.id} icon has an 8-bit alpha channel`, png?.bitDepth === 8 && (png.colourType === 4 || png.colourType === 6));
    check(`${base.id} icon contains visible pixels`, Boolean(png?.bounds));
    check(
      `${base.id} icon alpha bounds stay inside the canvas`,
      Boolean(png?.bounds && png.bounds.minX >= 0 && png.bounds.minY >= 0 && png.bounds.maxX < 256 && png.bounds.maxY < 256),
    );
    check(`${base.id} icon canvas size is recorded`, metrics?.[base.id]?.width === 256 && metrics?.[base.id]?.height === 256);
    check(`${base.id} icon alpha bounds are recorded`, coverage !== null);
    check(
      `${base.id} recorded alpha bounds match the decoded PNG`,
      Boolean(png?.bounds && JSON.stringify(metrics?.[base.id]?.bounds) === JSON.stringify(png.bounds)),
    );
    check(
      `${base.id} icon alpha coverage is 62–88%`,
      coverage !== null && coverage.width >= 0.62 && coverage.width <= 0.88 && coverage.height >= 0.62 && coverage.height <= 0.88,
      coverage ? `${Math.round(coverage.width * 100)}×${Math.round(coverage.height * 100)}%` : '',
    );
    if (png) iconPixelHashes.push(createHash('sha256').update(png.pixels).digest('hex'));
  }

  if (!LOCALIZATION_ONLY) {
    const iconFiles = existsSync(ICONS)
      ? readdirSync(ICONS).filter((name) => name.endsWith('.png')).sort()
      : [];
    const expectedIconFiles = objectIds.map((id) => `${id}.png`).sort();
    check('object icon directory contains exactly the 26 catalog PNGs', JSON.stringify(iconFiles) === JSON.stringify(expectedIconFiles));
    check('object icon metrics contain exactly the 26 catalog IDs', metrics !== null && sameSet(Object.keys(metrics), objectIds));
    check(
      'all 26 object icons have unique decoded pixel payloads',
      iconPixelHashes.length === 26 && new Set(iconPixelHashes).size === 26,
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
