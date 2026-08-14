// Checks every content JSON against the .glb it points at.
//
//   npm run validate
//
// The one failure mode this project is genuinely exposed to is a JSON that
// names a mesh the model does not have — the part would silently never appear.
// Everything here is cheap enough to run on every commit.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'content');
const MODELS = resolve(ROOT, 'assets/models');

const AXES = ['x', 'y', 'z'];

/** Reads the node names straight out of the GLB's JSON chunk. */
function glbMeshNames(file) {
  const buffer = readFileSync(file);
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return new Set((json.nodes ?? []).filter((node) => node.mesh !== undefined).map((node) => node.name));
}

function validate(doc, meshNames, errors, warnings) {
  const at = (msg) => errors.push(`${doc.id}: ${msg}`);

  if (doc.schema !== 1) at(`unknown schema ${doc.schema}`);
  for (const field of ['title', 'subtitle', 'category', 'accent', 'summary', 'model']) {
    if (!doc[field]) at(`missing "${field}"`);
  }
  if (!AXES.includes(doc.cutAxis)) at(`cutAxis must be one of ${AXES.join('/')}`);
  // The model file is embedded as an Android raw resource, and those names may
  // only be lowercase letters, digits and underscores. A hyphen here fails at
  // prebuild time with a message that does not obviously point back to here.
  if (!/^[a-z0-9_]+$/.test(doc.model ?? '')) at(`model "${doc.model}" must be lowercase a-z, 0-9 or _ (Android resource name)`);
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
      const part = doc.parts.find((p) => p.id === question.partId);
      if (part?.hidden) at(`quiz #${index + 1} targets hidden part "${question.partId}"`);
    } else if (question.type === 'choice') {
      if (!Array.isArray(question.choices) || question.choices.length < 2) at(`quiz #${index + 1} needs choices`);
      if (question.answer == null || !question.choices?.[question.answer]) at(`quiz #${index + 1} answer out of range`);
    } else {
      at(`quiz #${index + 1} has unknown type "${question.type}"`);
    }
  });
}

const errors = [];
const warnings = [];
const files = readdirSync(CONTENT).filter((name) => name.endsWith('.json'));

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
  if (!errors.length) console.log(`✓ ${doc.id.padEnd(14)} ${doc.parts.length} parts, ${doc.steps.length} steps, ${doc.quiz.length} questions`);
}

// Translations are overlays keyed by part id and question index. A typo in an
// id silently leaves that part in English, and a choice list of the wrong
// length would move the correct answer — so both are checked here.
const localeDir = resolve(CONTENT, 'id');
if (existsSync(localeDir)) {
  for (const file of readdirSync(localeDir).filter((name) => name.endsWith('.json'))) {
    const id = basename(file, '.json');
    const base = files.includes(file) ? JSON.parse(readFileSync(resolve(CONTENT, file), 'utf8')) : null;
    if (!base) {
      errors.push(`id/${file}: no English original to overlay`);
      continue;
    }
    const overlay = JSON.parse(readFileSync(resolve(localeDir, file), 'utf8'));
    const ids = new Set(base.parts.map((part) => part.id));
    for (const partId of Object.keys(overlay.parts ?? {})) {
      if (!ids.has(partId)) errors.push(`id/${file}: translates unknown part "${partId}"`);
    }
    const missing = base.parts.filter((part) => !overlay.parts?.[part.id]).map((part) => part.id);
    if (missing.length) warnings.push(`id/${file}: ${missing.length} part(s) untranslated — ${missing.slice(0, 4).join(', ')}`);
    (overlay.quiz ?? []).forEach((question, index) => {
      const original = base.quiz[index];
      if (!original) return errors.push(`id/${file}: quiz #${index + 1} has no original`);
      if (question.choices && original.type === 'choice' && question.choices.length !== original.choices.length) {
        errors.push(`id/${file}: quiz #${index + 1} has ${question.choices.length} choices, original has ${original.choices.length}`);
      }
    });
    if ((overlay.steps ?? []).length && overlay.steps.length !== base.steps.length) {
      errors.push(`id/${file}: ${overlay.steps.length} steps, original has ${base.steps.length}`);
    }
    console.log(`✓ id/${id.padEnd(11)} translation`);
  }
}

warnings.forEach((warning) => console.warn(`⚠ ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`✗ ${error}`));
  process.exit(1);
}
console.log(`\n${files.length} object(s) valid.`);
