import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
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
  category: string;
  accent: string;
  summary: string;
  scale?: string;
  model: string;
  parts: Array<{ id: string; name: string; short: string; detail: string; hidden?: boolean }>;
  steps: Array<{ title: string; body: string }>;
  quiz: Array<ChoiceQuestion | IdentifyQuestion>;
};

type IconMetric = {
  bounds?: { width?: number; height?: number };
};

type ProsePair = { path: string; english: string; indonesian: string };

type RegistryExpectation = {
  id: string;
  model: string;
};

type RegistryTuple = {
  docPath: string | null;
  modelPath: string | null;
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
};

type RuntimeRegistry = {
  getLibrary(locale: 'id'): RuntimeSummary[];
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
      return { docPath: null, modelPath: null, idTranslationPath: null };
    }
    const translationsValue = propertyInitializer(value, 'translations');
    const translations = translationsValue ? unwrapExpression(translationsValue) : null;
    const idTranslation = translations && ts.isObjectLiteralExpression(translations)
      ? propertyInitializer(translations, 'id')
      : null;
    return {
      docPath: staticRequirePath(propertyInitializer(value, 'doc')),
      modelPath: staticRequirePath(propertyInitializer(value, 'model')),
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

function loadRuntimeRegistry(): RuntimeRegistry {
  type CompilableModule = { exports: unknown; _compile(sourceText: string, filename: string): void };
  type ExtensionLoader = (module: CompilableModule, filename: string) => void;

  const runtimeRequire = createRequire(import.meta.url);
  const extensions = runtimeRequire.extensions as Record<string, ExtensionLoader | undefined>;
  const previousTs = extensions['.ts'];
  const previousGlb = extensions['.glb'];

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

  try {
    return runtimeRequire(REGISTRY) as RuntimeRegistry;
  } finally {
    if (previousTs) extensions['.ts'] = previousTs;
    else delete extensions['.ts'];
    if (previousGlb) extensions['.glb'] = previousGlb;
    else delete extensions['.glb'];
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
  const swappedModels = swapUniqueLiterals(
    registry,
    '../../assets/models/smartphone.glb',
    '../../assets/models/turbofan.glb',
  );
  const swappedTranslations = swapUniqueLiterals(
    registry,
    '../../content/id/smartphone.json',
    '../../content/id/turbofan.json',
  );
  const requirementsPass = (sourceText: string) => expectations.every((expectation) => {
    const registration = registryRequirementsAppear(sourceText, expectation);
    return registration.doc && registration.model && registration.translation;
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
  let runtimeLibraryDetail = '';
  try {
    runtimeLibraryPasses = runtimeLibraryIsCorrect(loadRuntimeRegistry().getLibrary('id'), english);
  } catch (error) {
    runtimeLibraryDetail = error instanceof Error ? error.message : String(error);
  }
  check(
    "runtime getLibrary('id') returns 26 unique correctly localized entries",
    runtimeLibraryPasses,
    runtimeLibraryDetail,
  );
  if (!LOCALIZATION_ONLY) check('object icon metrics exist', metrics !== null);

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
