import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { sourceLoader } from './lib/load-source.mjs';

const load = sourceLoader({ 'react-native': { Platform: { select: (options) => options.default } } });
const search = load('src/content/search.ts');
const fixtures = [
  { id: 'helicopter', title: 'Helikopter Turboshaft', subtitle: 'Mesin dan rotor', summary: 'Transmisi penggerak', category: 'Aerospace' },
  { id: 'satellite', title: 'Satelit Observasi Bumi', subtitle: 'Optik dan panel surya', summary: 'Mengamati Bumi', category: 'Aerospace' },
  { id: 'vacuum', title: 'Penyedot Debu', subtitle: 'Pembersih siklon', summary: 'Udara dan penyaring', category: 'Appliances' },
];

test('search filters by all normalized words and preserves catalog order', () => {
  assert.equal(typeof search.filterLibrary, 'function', 'Library search is not implemented');
  const ids = (query, category = null) => Array.from(search.filterLibrary(fixtures, query, category), (item) => item.id);
  assert.deepEqual(ids('  HELIKOPTER   rotor '), ['helicopter']);
  assert.deepEqual(ids('ópTik'), ['satellite']);
  assert.deepEqual(ids('penyaring'), ['vacuum']);
  assert.deepEqual(ids('   ', 'Aerospace'), ['helicopter', 'satellite']);
  assert.deepEqual(ids('rotor', 'Appliances'), []);
  assert.deepEqual(ids('tidak ditemukan'), []);
  assert.deepEqual(ids(''), ['helicopter', 'satellite', 'vacuum']);
});

// Independent WCAG calculation: expectations do not use the production helper.
const rgb = (hex) => hex.slice(1).match(/../g).map((value) => parseInt(value, 16));
const lum = (color) => color.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const { palettes, readableAccent } = load('src/ui/theme.ts');
const accents = [...new Set(readdirSync('content').filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(`content/${name}`, 'utf8')).accent))];

test('small secondary text is readable on each solid theme surface', () => {
  for (const [mode, palette] of Object.entries(palettes)) {
    for (const token of ['text', 'textMuted', 'textFaint', 'correct', 'wrong']) {
      for (const surface of ['bg', 'surface', 'surfaceHigh', 'surfacePressed']) {
        assert.ok(ratio(rgb(palette[token]), rgb(palette[surface])) >= 4.5, `${mode}.${token} on ${surface} is too faint`);
      }
    }
  }
});

test('every object accent remains readable on neutral and active tinted surfaces', () => {
  for (const mode of ['light', 'dark']) {
    for (const accent of accents) {
      const foreground = rgb(readableAccent(accent, mode));
      for (const surface of ['bg', 'surface', 'surfaceHigh', 'surfacePressed']) {
        for (const opacity of [0, 0.07, 0.12, 0.18, 0.2]) {
          const background = rgb(palettes[mode][surface]).map((v, i) => v * (1 - opacity) + rgb(accent)[i] * opacity);
          assert.ok(ratio(foreground, background) >= 4.5, `${mode} ${accent} on ${surface} at ${opacity} is too faint`);
        }
      }
    }
  }
});

test('render loop cancels hidden work, preserves a single loop, and resumes without a time jump', () => {
  const { FrameLoop } = load('src/engine/FrameLoop.ts');
  assert.equal(typeof FrameLoop, 'function', 'Pausable render loop is not implemented');
  let id = 0;
  const pending = new Map();
  const deltas = [];
  const loop = new FrameLoop((delta) => deltas.push(delta), {
    request: (callback) => { pending.set(++id, callback); return id; },
    cancel: (key) => pending.delete(key),
  });
  const tick = (now) => {
    const [key, callback] = pending.entries().next().value;
    pending.delete(key);
    callback(now);
  };
  loop.setActive(true);
  loop.setActive(true);
  assert.equal(pending.size, 1);
  tick(1000);
  tick(1016);
  assert.deepEqual(deltas, [0, 0.016]);
  loop.setActive(false);
  assert.equal(pending.size, 0, 'Hidden views must not schedule frames');
  loop.setActive(true);
  tick(101000);
  assert.equal(deltas.at(-1), 0, 'Background time must not advance the mechanism');
  loop.dispose();
  loop.setActive(true);
  assert.equal(pending.size, 0, 'Disposed viewers cannot restart');
});

test('banner only mounts for an active, eligible Android library without the keyboard', () => {
  const { shouldMountLibraryBanner } = load('src/monetization/banner-policy.ts');
  assert.equal(typeof shouldMountLibraryBanner, 'function', 'Library banner eligibility is not implemented');
  const eligible = { platform: 'android', hydrated: true, removeAds: false, active: true, keyboardVisible: false };
  assert.equal(shouldMountLibraryBanner(eligible), true);
  for (const change of [{ platform: 'web' }, { platform: 'ios' }, { hydrated: false }, { removeAds: true }, { active: false }, { keyboardVisible: true }]) {
    assert.equal(shouldMountLibraryBanner({ ...eligible, ...change }), false, JSON.stringify(change));
  }
});
