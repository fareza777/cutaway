// Generates the app icon, adaptive icon layers and splash mark.
//
//   npm run build:brand
//
// The mark is built from one deterministic set of flat isometric faces. A
// compact housing is open on its right-hand side, where three broad mechanical
// plates and a warm core remain visible even at launcher size. The generated
// concept under tools/brand is visual direction only; production never reads
// or samples it.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Bitmap } from './lib/png.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets');

const BG = [7, 9, 13];
const PALETTE = {
  porcelain: [226, 233, 242],
  porcelainEdge: [226, 233, 242],
  navy: [17, 34, 56],
  cavity: [17, 34, 56],
  steel: [72, 108, 145],
  steelLight: [72, 108, 145],
  steelDark: [17, 34, 56],
  orange: [255, 153, 52],
  orangeDark: [255, 153, 52],
  coral: [255, 87, 82],
  coralDark: [255, 87, 82],
};
const MONO = [226, 233, 242];
const FLAT_COLOURS = [...new Map(Object.values(PALETTE).map((colour) => [colour.join(','), colour])).values()];

// Coordinates live in a stable 1000-unit view box. Every output uses these
// exact faces; only the scale and the optional background change.
const FACES = [
  // Open cavity is painted first, behind the housing and the mechanisms.
  { colour: 'cavity', points: [[424, 414], [854, 331], [854, 687], [424, 760]] },

  // The compact solid housing. Its roof and left wall stay intact; the outer
  // right face is absent, leaving an asymmetric open notch around the layers.
  { colour: 'navy', points: [[62, 267], [474, 478], [474, 820], [62, 609]] },
  { colour: 'porcelain', points: [[62, 267], [448, 50], [887, 266], [474, 478]] },
  { colour: 'porcelainEdge', points: [[474, 478], [887, 266], [887, 345], [474, 559]] },
  { colour: 'steel', points: [[474, 478], [887, 266], [853, 331], [474, 528]] },

  // Lower structural tray: the third visible mechanical layer.
  { colour: 'steelDark', points: [[382, 704], [640, 570], [930, 711], [659, 863]] },
  { colour: 'navy', points: [[382, 704], [659, 863], [659, 932], [382, 774]] },
  { colour: 'porcelainEdge', points: [[659, 863], [930, 711], [930, 783], [659, 932]] },
  { colour: 'steelLight', points: [[416, 696], [641, 578], [881, 697], [650, 826]] },

  // A small chamfer on the foot makes the removed face intentional rather than
  // a generic open cube and strengthens the silhouette under round masks.
  { colour: 'porcelain', points: [[659, 863], [930, 711], [948, 743], [930, 783], [659, 932]] },

  // Warm middle tray: broad enough to remain legible at 48 px.
  { colour: 'orangeDark', points: [[389, 571], [616, 451], [830, 558], [598, 688]] },
  { colour: 'orange', points: [[389, 571], [598, 688], [598, 752], [389, 634]] },
  { colour: 'orangeDark', points: [[598, 688], [830, 558], [830, 624], [598, 752]] },
  { colour: 'orange', points: [[414, 565], [615, 459], [800, 552], [594, 666]] },

  // Two substantial supports link the trays without relying on fine outlines.
  { colour: 'porcelainEdge', points: [[451, 466], [480, 451], [480, 559], [451, 576]] },
  { colour: 'porcelain', points: [[480, 451], [500, 462], [500, 548], [480, 559]] },
  { colour: 'porcelainEdge', points: [[754, 455], [779, 442], [779, 544], [754, 558]] },
  { colour: 'porcelain', points: [[779, 442], [798, 452], [798, 533], [779, 544]] },

  // Upper steel tray: the first visible mechanical layer.
  { colour: 'steelDark', points: [[376, 442], [616, 315], [847, 431], [601, 567]] },
  { colour: 'steelDark', points: [[376, 442], [601, 567], [601, 625], [376, 498]] },
  { colour: 'navy', points: [[601, 567], [847, 431], [847, 490], [601, 625]] },
  { colour: 'steel', points: [[400, 436], [615, 323], [817, 425], [597, 545]] },

  // Coral core rises through the middle of the stack. It is painted last so its
  // tiny top plane survives the overlap between the upper and middle trays.
  { colour: 'coral', points: [[552, 558], [600, 533], [649, 558], [600, 585]] },
  { colour: 'coral', points: [[552, 558], [600, 585], [600, 628], [552, 601]] },
  { colour: 'coralDark', points: [[600, 585], [649, 558], [649, 601], [600, 628]] },
];

function pointInConvexPolygon(x, y, points) {
  let sign = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-7) continue;
    const nextSign = cross > 0 ? 1 : -1;
    if (sign && sign !== nextSign) return false;
    sign = nextSign;
  }
  return true;
}

function polygon(bitmap, points, colour) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map(([x]) => x))));
  const maxX = Math.min(bitmap.size - 1, Math.ceil(Math.max(...points.map(([x]) => x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(bitmap.size - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInConvexPolygon(x + 0.5, y + 0.5, points)) bitmap.blend(x, y, colour, 1);
    }
  }
}

function renderMark(size, extent, { background = null } = {}) {
  // Rasterize at 2x and box-filter once. Shared edges stay opaque and flat,
  // while the outside silhouette receives deterministic one-pixel antialiasing.
  const supersample = 2;
  const highSize = size * supersample;
  const highExtent = extent * supersample;
  const offset = (highSize - highExtent) / 2;
  const scale = highExtent / 1000;
  const bitmap = new Bitmap(highSize);

  for (const face of FACES) {
    const points = face.points.map(([x, y]) => [offset + x * scale, offset + y * scale]);
    polygon(bitmap, points, PALETTE[face.colour]);
  }
  const mark = bitmap.resized(size);

  // Supersampling creates correct edge alpha, then every nontransparent RGB is
  // snapped back to one of the five brand swatches. This keeps the result
  // genuinely flat instead of introducing accidental one-pixel gradients.
  for (let i = 0; i < mark.data.length; i += 4) {
    if (mark.data[i + 3] === 0) continue;
    let nearest = FLAT_COLOURS[0];
    let distance = Infinity;
    for (const colour of FLAT_COLOURS) {
      const next = (mark.data[i] - colour[0]) ** 2
        + (mark.data[i + 1] - colour[1]) ** 2
        + (mark.data[i + 2] - colour[2]) ** 2;
      if (next < distance) {
        nearest = colour;
        distance = next;
      }
    }
    mark.data[i] = nearest[0];
    mark.data[i + 1] = nearest[1];
    mark.data[i + 2] = nearest[2];
  }

  if (!background) return mark;
  const composite = new Bitmap(size, [...background, 255]);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      composite.blend(x, y, [mark.data[i], mark.data[i + 1], mark.data[i + 2]], mark.data[i + 3] / 255);
    }
  }
  return composite;
}

function monochromeFrom(bitmap) {
  const mono = new Bitmap(bitmap.size);
  for (let i = 0; i < bitmap.data.length; i += 4) {
    if (bitmap.data[i + 3] === 0) continue;
    mono.data[i] = MONO[0];
    mono.data[i + 1] = MONO[1];
    mono.data[i + 2] = MONO[2];
    mono.data[i + 3] = bitmap.data[i + 3];
  }
  return mono;
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
write('icon.png', renderMark(1024, 900, { background: BG }));

// Adaptive icon: every occupied pixel stays within the middle two-thirds.
const foreground = renderMark(1024, 680);
write('android-icon-foreground.png', foreground);
write('android-icon-background.png', solid(1024, BG));
write('android-icon-monochrome.png', monochromeFrom(foreground));

// Splash and favicon reuse the identical geometry at purpose-specific scales.
write('splash-icon.png', renderMark(576, 500));
write('favicon.png', renderMark(64, 58, { background: BG }));
