// Generates the app icon, adaptive icon layers and splash mark.
//
//   npm run build:brand
//
// The mark is the app's own idea drawn flat: a solid object with a wedge taken
// out of it, revealing the layers inside. It reads at 48px, it is one shape, and
// it means something — which is more than the placeholder it replaces.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Bitmap } from './lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets');

const BG = [7, 9, 13];
const SHELL = [214, 220, 230];
const MID = [122, 132, 148];
const CORE = [255, 159, 69];
const HOT = [255, 107, 107];

/** The wedge is cut from the upper right, so the layers read left to right. */
const CUT_FROM = -1.15;
const CUT_TO = -0.12;

function mark(size, { background = null } = {}) {
  const bitmap = new Bitmap(size, background ? [...background, 255] : [0, 0, 0, 0]);
  const r = size / 2;

  // Outside the wedge the object is closed: one solid face, nothing to see.
  for (const arc of [{ from: CUT_TO, to: Math.PI }, { from: -Math.PI, to: CUT_FROM }]) {
    bitmap.ring(0, r * 0.86, SHELL, arc);
  }

  // Inside the wedge it is open, and the strata run all the way to the centre.
  // That contrast — closed here, layered there — is the whole idea of the app
  // in one shape, and it survives being shrunk to a 48px launcher tile.
  const cut = { from: CUT_FROM, to: CUT_TO };
  bitmap.ring(r * 0.64, r * 0.86, MID, cut);
  bitmap.ring(r * 0.42, r * 0.62, [58, 66, 80], cut);
  bitmap.ring(r * 0.2, r * 0.4, CORE, cut);
  bitmap.ring(0, r * 0.18, HOT, cut);
  return bitmap;
}

function write(name, bitmap) {
  const file = resolve(OUT, name);
  writeFileSync(file, bitmap.toPng());
  console.log(`✓ ${name.padEnd(32)} ${bitmap.size}×${bitmap.size}`);
}

function solid(size, colour) {
  return new Bitmap(size, [...colour, 255]);
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// Store icon: opaque, full bleed.
write('icon.png', mark(1024, { background: BG }));

// Adaptive icon: Android masks these, and crops hard. The foreground has to sit
// inside the middle two-thirds or the shape loses its edges on a round mask.
const foreground = new Bitmap(1024, [0, 0, 0, 0]);
const inner = mark(680);
const offset = Math.round((1024 - 680) / 2);
for (let y = 0; y < 680; y += 1) {
  for (let x = 0; x < 680; x += 1) {
    const i = (y * 680 + x) * 4;
    foreground.blend(x + offset, y + offset, [inner.data[i], inner.data[i + 1], inner.data[i + 2]], inner.data[i + 3] / 255);
  }
}
write('android-icon-foreground.png', foreground);
write('android-icon-background.png', solid(1024, BG));
write('android-icon-monochrome.png', foreground);

// Splash: the mark alone, on the splash background the native window already
// paints, so there is no flash of a different colour behind it.
write('splash-icon.png', mark(576, { background: null }));
write('favicon.png', mark(64, { background: BG }));
