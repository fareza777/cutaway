// Checks every content JSON against its GLB and validates complete prose-only
// Indonesian overlays.
//
//   npm run validate

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'content');
const MODELS = resolve(ROOT, 'assets/models');

const AXES = ['x', 'y', 'z'];
const TRANSLATION_FIELDS = new Set(['title', 'subtitle', 'summary', 'scale', 'parts', 'steps', 'quiz']);
const PART_TRANSLATION_FIELDS = new Set(['name', 'short', 'detail']);
const STEP_TRANSLATION_FIELDS = new Set(['title', 'body']);
const QUIZ_TRANSLATION_FIELDS = new Set(['prompt', 'choices', 'explain']);

/** Reads the node names straight out of the GLB's JSON chunk. */
function glbMeshNames(file) {
  const buffer = readFileSync(file);
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return new Set((json.nodes ?? []).filter((node) => node.mesh !== undefined).map((node) => node.name));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownFields(value, allowed, at, path) {
  if (!isRecord(value)) return;
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) at(`${path} contains non-prose field "${field}"`);
  }
}

function validate(doc, meshNames, errors, warnings) {
  const at = (message) => errors.push(`${doc.id}: ${message}`);

  if (doc.schema !== 1) at(`unknown schema ${doc.schema}`);
  for (const field of ['title', 'subtitle', 'category', 'accent', 'summary', 'model']) {
    if (!doc[field]) at(`missing "${field}"`);
  }
  if (!AXES.includes(doc.cutAxis)) at(`cutAxis must be one of ${AXES.join('/')}`);
  // The model file is embedded as an Android raw resource, and those names may
  // only be lowercase letters, digits and underscores. A hyphen here fails at
  // prebuild time with a message that does not obviously point back to here.
  if (!/^[a-z0-9_]+$/.test(doc.model ?? '')) {
    at(`model "${doc.model}" must be lowercase a-z, 0-9 or _ (Android resource name)`);
  }
  if (!Array.isArray(doc.parts) || doc.parts.length === 0) return at('no parts');

  const ids = new Set();
  const claimed = new Map();

  for (const part of doc.parts) {
    if (ids.has(part.id)) at(`duplicate part id "${part.id}"`);
    ids.add(part.id);
    if (!part.name || !part.short || !part.detail) at(`part "${part.id}" is missing name/short/detail`);
    if (typeof part.layer !== 'number') at(`part "${part.id}" has no layer`);
    if (part.explode && part.explode.length !== 3) at(`part "${part.id}" explode must be [x, y, z]`);

    for (const node of part.nodes ?? []) {
      if (!meshNames.has(node)) at(`part "${part.id}" references missing mesh "${node}"`);
      if (claimed.has(node)) at(`mesh "${node}" is claimed by both "${claimed.get(node)}" and "${part.id}"`);
      claimed.set(node, part.id);
    }
    if (!part.nodes?.length) at(`part "${part.id}" lists no nodes`);

    const motion = part.motion ?? {};
    if ('pivot' in motion && (
      !Array.isArray(motion.pivot)
      || motion.pivot.length !== 3
      || motion.pivot.some((value) => typeof value !== 'number' || !Number.isFinite(value))
    )) {
      at(`part "${part.id}" motion pivot must be three finite numbers`);
    }
    if ('pivot' in motion && !motion.spin && !motion.swing && !motion.slide) {
      at(`part "${part.id}" motion pivot requires spin, swing, or slide`);
    }
    for (const [key, spec] of Object.entries(motion)) {
      if (key === 'pivot') continue;
      if (!['spin', 'slide', 'swing'].includes(key)) at(`part "${part.id}" has unknown motion "${key}"`);
      if (!AXES.includes(spec.axis)) at(`part "${part.id}" motion "${key}" has bad axis`);
    }
  }

  for (const node of meshNames) {
    if (!claimed.has(node)) warnings.push(`${doc.id}: mesh "${node}" is in the model but not in the JSON`);
  }

  for (const step of doc.steps ?? []) {
    if (!step.title || !step.body) at('a step is missing title/body');
    for (const focus of step.focus ?? []) {
      if (!ids.has(focus)) at(`step "${step.title}" focuses unknown part "${focus}"`);
    }
  }

  if (!doc.quiz?.length) warnings.push(`${doc.id}: no quiz questions`);
  doc.quiz?.forEach((question, index) => {
    if (question.type === 'identify') {
      if (!ids.has(question.partId)) at(`quiz #${index + 1} targets unknown part "${question.partId}"`);
      const part = doc.parts.find((candidate) => candidate.id === question.partId);
      if (part?.hidden) at(`quiz #${index + 1} targets hidden part "${question.partId}"`);
    } else if (question.type === 'choice') {
      if (!Array.isArray(question.choices) || question.choices.length < 2) at(`quiz #${index + 1} needs choices`);
      if (question.answer == null || !question.choices?.[question.answer]) at(`quiz #${index + 1} answer out of range`);
    } else {
      at(`quiz #${index + 1} has unknown type "${question.type}"`);
    }
  });
}

function validateTranslation(base, overlay, file, errors) {
  const at = (message) => errors.push(`id/${file}: ${message}`);
  if (!isRecord(overlay)) {
    at('overlay must be an object');
    return;
  }
  rejectUnknownFields(overlay, TRANSLATION_FIELDS, at, 'overlay');

  for (const field of ['title', 'subtitle', 'summary']) {
    if (!nonEmptyString(overlay[field])) at(`missing translated "${field}"`);
  }
  if (base.scale && !nonEmptyString(overlay.scale)) at('missing translated "scale"');
  if (!base.scale && 'scale' in overlay) at('translates "scale" but the English document has none');

  const basePartIds = base.parts.map((part) => part.id);
  if (!isRecord(overlay.parts)) {
    at('missing translated "parts" object');
  } else {
    for (const partId of Object.keys(overlay.parts)) {
      if (!basePartIds.includes(partId)) at(`translates unknown part "${partId}"`);
    }
    for (const part of base.parts) {
      const translated = overlay.parts[part.id];
      if (!isRecord(translated)) {
        at(`missing translation for part "${part.id}"`);
        continue;
      }
      rejectUnknownFields(translated, PART_TRANSLATION_FIELDS, at, `part "${part.id}"`);
      for (const field of PART_TRANSLATION_FIELDS) {
        if (!nonEmptyString(translated[field])) at(`part "${part.id}" is missing translated "${field}"`);
      }
    }
  }

  if (!Array.isArray(overlay.steps)) {
    at('missing translated "steps" array');
  } else {
    if (overlay.steps.length !== base.steps.length) {
      at(`${overlay.steps.length} translated steps, English document has ${base.steps.length}`);
    }
    base.steps.forEach((_, index) => {
      const translated = overlay.steps[index];
      if (!isRecord(translated)) {
        at(`step #${index + 1} is missing`);
        return;
      }
      rejectUnknownFields(translated, STEP_TRANSLATION_FIELDS, at, `step #${index + 1}`);
      for (const field of STEP_TRANSLATION_FIELDS) {
        if (!nonEmptyString(translated[field])) at(`step #${index + 1} is missing translated "${field}"`);
      }
    });
  }

  if (!Array.isArray(overlay.quiz)) {
    at('missing translated "quiz" array');
  } else {
    if (overlay.quiz.length !== base.quiz.length) {
      at(`${overlay.quiz.length} translated quiz items, English document has ${base.quiz.length}`);
    }
    base.quiz.forEach((original, index) => {
      const translated = overlay.quiz[index];
      if (!isRecord(translated)) {
        at(`quiz #${index + 1} is missing`);
        return;
      }
      rejectUnknownFields(translated, QUIZ_TRANSLATION_FIELDS, at, `quiz #${index + 1}`);
      if (!nonEmptyString(translated.prompt)) at(`quiz #${index + 1} is missing translated "prompt"`);

      if (original.type === 'identify') {
        if ('choices' in translated) at(`quiz #${index + 1} adds choices to an identify question`);
        if ('explain' in translated) at(`quiz #${index + 1} adds an explanation with no English original`);
        return;
      }

      if (!Array.isArray(translated.choices)) {
        at(`quiz #${index + 1} is missing translated choices`);
      } else {
        if (translated.choices.length !== original.choices.length) {
          at(`quiz #${index + 1} has ${translated.choices.length} choices, English document has ${original.choices.length}`);
        }
        translated.choices.forEach((choice, choiceIndex) => {
          if (!nonEmptyString(choice)) at(`quiz #${index + 1} choice #${choiceIndex + 1} is empty`);
        });
      }
      if (original.explain && !nonEmptyString(translated.explain)) {
        at(`quiz #${index + 1} is missing translated "explain"`);
      }
      if (!original.explain && 'explain' in translated) {
        at(`quiz #${index + 1} adds an explanation with no English original`);
      }
    });
  }
}

const errors = [];
const warnings = [];
const files = readdirSync(CONTENT).filter((name) => name.endsWith('.json')).sort();

if (!files.length) {
  console.error('no content found in content/');
  process.exit(1);
}

for (const file of files) {
  const doc = JSON.parse(readFileSync(resolve(CONTENT, file), 'utf8'));
  if (doc.id !== basename(file, '.json')) errors.push(`${file}: id "${doc.id}" does not match the filename`);

  const model = resolve(MODELS, `${doc.model}.glb`);
  if (!existsSync(model)) {
    errors.push(`${doc.id}: model "${doc.model}.glb" not found — run npm run build:models`);
    continue;
  }
  validate(doc, glbMeshNames(model), errors, warnings);
  console.log(`✓ ${doc.id.padEnd(18)} ${doc.parts.length} parts, ${doc.steps.length} steps, ${doc.quiz.length} questions`);
}

// A typo or omission in an overlay silently falls back to English at runtime.
// Validate every English document, not merely whichever translation files
// happen to exist, so filename and field coverage are strict one-to-one gates.
const localeDir = resolve(CONTENT, 'id');
const localeFiles = existsSync(localeDir)
  ? readdirSync(localeDir).filter((name) => name.endsWith('.json')).sort()
  : [];

for (const file of localeFiles) {
  if (!files.includes(file)) errors.push(`id/${file}: no English original to overlay`);
}

for (const file of files) {
  const id = basename(file, '.json');
  if (!localeFiles.includes(file)) {
    errors.push(`id/${file}: missing Indonesian overlay`);
    continue;
  }
  const base = JSON.parse(readFileSync(resolve(CONTENT, file), 'utf8'));
  const overlay = JSON.parse(readFileSync(resolve(localeDir, file), 'utf8'));
  validateTranslation(base, overlay, file, errors);
  console.log(`✓ id/${id.padEnd(18)} translation`);
}

warnings.forEach((warning) => console.warn(`⚠ ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`✗ ${error}`));
  process.exit(1);
}
console.log(`\n${files.length} object(s) valid.`);
