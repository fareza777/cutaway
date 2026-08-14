// Human kidney, left, seen from the front. The medial border with its notch
// faces -X, the lateral convex border +X, and the long axis runs up the screen.
//
// Nineteen named parts. What makes this read as a kidney and not as a bean-
// coloured egg is one feature: the hilum. It is not modelled as a separate
// shape but carved out of the outer surface by pushing the medial pole inward,
// and every vessel, the pelvis and the ureter are aimed at the same point — so
// the notch and the things that pass through it cannot drift apart.
//
// The nephron at the end is drawn far larger than life, the way an atlas draws
// it. A real one is about a centimetre long and there are a million of them;
// modelled to scale it would be invisible. The content says so.

import {
  THREE, TAU, part, pbr, blob, curve, lathe, merge, place, sphere,
  displace, paint, fbm, srgb, smoothProfile, smoothSeams, nearestOnCurves,
} from '../lib/geo.mjs';

const CORTEX = srgb('#8a3f36');
const MEDULLA = srgb('#9c5a52');
const CAPSULE_TINT = srgb('#8f8175');
const FAT = srgb('#e3d09a');

const ARTERY = () => pbr('#a8303a', { metalness: 0.05, roughness: 0.38 });
const VEIN = () => pbr('#4a6f9c', { metalness: 0.04, roughness: 0.42 });
const URINE = () => pbr('#d8cf9e', { metalness: 0.02, roughness: 0.34 });
const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.36, vertexColors: true });
const TUBULE = () => pbr('#e0d4b8', { metalness: 0, roughness: 0.4 });
const GLOM = () => pbr('#b8404a', { metalness: 0.06, roughness: 0.36 });

// -------------------------------------------------------------- the surface

const SURFACE = {
  // Long axis vertical. An adult kidney is about 11 x 6 x 3 cm, and those
  // proportions are most of why the silhouette is recognisable.
  profile: [
    [0, -1.05], [0.28, -0.98], [0.46, -0.76], [0.56, -0.42],
    [0.6, 0], [0.56, 0.42], [0.46, 0.76], [0.28, 0.98], [0, 1.05],
  ],
  centre: [0, 0],
  squash: 0.42,
  rings: 48,
  segments: 72,
};

const SMOOTH = smoothProfile(SURFACE.profile, SURFACE.rings);

function surfaceRadius(y) {
  const p = SMOOTH;
  if (y <= p[0][1]) return p[0][0];
  if (y >= p[p.length - 1][1]) return p[p.length - 1][0];
  for (let i = 1; i < p.length; i += 1) {
    if (y <= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return 0;
}

/** `angle` runs from +Z (anterior) toward +X (lateral). */
function onSurface(y, angle, out = 0) {
  const r = surfaceRadius(y) + out;
  return [r * Math.sin(angle), y, r * Math.cos(angle) * SURFACE.squash];
}

/**
 * How much a point faces the medial pole, at the height where the notch is.
 *
 * Cubed, so the trough stays narrow and the lateral border keeps its full
 * convex bulge — a kidney is deeply indented on one side and untouched on the
 * other, and a gentler falloff makes it look merely dented.
 */
function hilumField(x, y, z) {
  const r = Math.hypot(x, z / SURFACE.squash) || 1e-6;
  const medial = Math.max(0, -x / r);
  return Math.exp(-((y / 0.36) ** 2)) * medial ** 3;
}

/**
 * A point a fraction of the way in from the surface.
 *
 * Not the same thing as subtracting from the radius, which is the trap: this
 * body is flattened to 0.42 in Z, so a structure placed "0.15 inward" in radius
 * sits only 0.06 under the anterior face and breaks through it. Every vessel
 * that was supposed to run inside the cortex was showing on the surface as a
 * red sliver. Shrinking toward the centre is depth that means the same thing in
 * every direction.
 */
function inside(y, angle, fraction) {
  const p = onSurface(y * (1 - fraction * 0.3), angle, 0);
  return [p[0] * (1 - fraction), p[1], p[2] * (1 - fraction)];
}

/** Where everything that enters the kidney is aimed. */
const HILUM = [-0.3, 0, 0];

/**
 * The nephron is drawn larger than life — it has to be, a real one is about a
 * centimetre long — but the first attempt was fifty times over and sat proud of
 * the cortex looking like something growing on the kidney rather than something
 * inside it. Authored in a unit box and then placed, so its size and its depth
 * are one number each instead of thirty hand-written coordinates.
 */
const NEPHRON = { at: [0.2, 0.46, 0.0], size: 0.42 };
const np = (x, y, z) => [
  NEPHRON.at[0] + x * NEPHRON.size,
  NEPHRON.at[1] + y * NEPHRON.size,
  NEPHRON.at[2] + z * NEPHRON.size * 0.5,
];

/**
 * Presses the medial pole inward, in position space rather than along normals.
 *
 * This has to be a transform on the coordinates, not a `displace()`. A shell
 * with a wall — the capsule — has inward-facing normals on its inner surface,
 * so a normal-space push carves the outer wall in and splays the inner wall
 * out, and the notch opens into a pale funnel instead of a groove. Moving the
 * vertex toward the axis is the same operation whichever way it happens to be
 * facing.
 */
function carveHilum(geometry, amount = 0.34) {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const field = hilumField(x, y, z);
    if (field < 1e-4) continue;
    const r = Math.hypot(x, z / SURFACE.squash);
    if (r < 1e-5) continue;
    const scale = Math.max(0.05, (r - amount * field) / r);
    position.setXYZ(i, x * scale, y, z * scale);
  }
  position.needsUpdate = true;
  return geometry;
}

// ------------------------------------------------------------------ surfaces

const mix = (a, b, t) => a + (b - a) * t;

/** Fat sits in the notch, packed round the vessels. Nowhere else. */
const nearHilum = nearestOnCurves([[[-0.52, -0.3, 0], [-0.34, 0, 0], [-0.52, 0.3, 0]]], 40);

function renal({ bump = 0.014 } = {}) {
  return (x, y, z) => fbm(x * 7, y * 7, z * 7, 3) * bump + fbm(x * 17, y * 17, z * 17, 2) * bump * 0.5;
}

function tissue(base, { fat = 0, grain = 0.2 } = {}) {
  return (x, y, z) => {
    // Two scales again, but finer than the heart: a kidney's surface is smooth
    // and evenly grainy, not lumpy, and coarse mottling reads as disease.
    const shade = 1 + fbm(x * 5, y * 5, z * 5, 2) * grain + fbm(x * 19, y * 19, z * 19, 2) * grain * 0.5;
    const t = fat ? fat * 0.9 * Math.max(0, 1 - nearHilum(x, y, z) / 0.22) ** 1.4 : 0;
    return [
      mix(base[0] * shade, FAT[0], t),
      mix(base[1] * shade, FAT[1], t),
      mix(base[2] * shade, FAT[2], t),
    ];
  };
}

function skin(geometry, base, options = {}) {
  const shaped = options.notch === 0 ? geometry : carveHilum(geometry, options.notch ?? 0.34);
  return paint(smoothSeams(displace(shaped, renal(options))), tissue(base, options));
}

// The eight renal pyramids, as (height, angle) on the lateral aspect. Two
// staggered rows, which is how they sit round the pelvis in a real kidney.
const PYRAMIDS = [
  [0.66, 1.57], [0.34, 1.15], [0.02, 1.57], [-0.32, 1.15], [-0.66, 1.57],
  [0.5, 2.05], [-0.14, 2.1], [-0.5, 2.0],
].map(([y, angle]) => ({
  y,
  angle,
  base: inside(y, angle, 0.24),
  apex: [HILUM[0] + 0.16, y * 0.52, 0],
}));

export default function kidney() {
  const group = new THREE.Group();

  group.add(
    part(
      'renal_capsule',
      // Thin, tough and glossy, and in a specimen it is peeled back rather than
      // left on. Modelled peeled: a closed capsule is the outermost layer, so
      // it would hide the whole organ behind a smooth pale shell.
      skin(
        lathe(
          SMOOTH.map(([r, y]) => [r + 0.009, y]).concat(SMOOTH.map(([r, y]) => [r + 0.003, y]).reverse()),
          SURFACE.segments,
          { scale: [1, 1, SURFACE.squash] },
          { phiStart: 0.95, phiLength: TAU - 1.9 },
        ),
        CAPSULE_TINT,
        { bump: 0.004, notch: 0.34, grain: 0.1 },
      ),
      FLESH(),
    ),
    part(
      'renal_cortex',
      // The outer third, and the surface you actually see.
      skin(
        lathe(SMOOTH, SURFACE.segments, { scale: [1, 1, SURFACE.squash] }),
        CORTEX,
        { bump: 0.014, notch: 0.34, fat: 1, grain: 0.22 },
      ),
      FLESH(),
    ),
    part(
      'renal_medulla',
      // Eight pyramids, each striped with collecting ducts running to its tip.
      skin(
        merge(PYRAMIDS.map((p) => curve([p.base, p.apex], 0.13, { segments: 10, radial: 16, taper: 0.18 }))),
        MEDULLA,
        { bump: 0.008, notch: 0, grain: 0.16 },
      ),
      FLESH(),
    ),
    part(
      'renal_columns',
      // Cortex reaching down between the pyramids. Not decoration: this is the
      // road the interlobar vessels take to get from the hilum to the surface.
      skin(
        merge(
          PYRAMIDS.map((p) => {
            const between = [p.y + (p.y > 0 ? -0.3 : 0.3), p.angle + 0.42];
            return curve([inside(between[0], between[1], 0.3), [HILUM[0] + 0.2, between[0] * 0.5, 0]], 0.06, {
              segments: 10,
              radial: 10,
              taper: 0.5,
            });
          }),
        ),
        CORTEX,
        { bump: 0.006, notch: 0, grain: 0.18 },
      ),
      FLESH(),
    ),
    part(
      'renal_papillae',
      merge(PYRAMIDS.map((p) => sphere(0.05, 14, { pos: p.apex }))),
      FLESH(),
    ),
    part(
      'minor_calyces',
      // A cup round each papilla. Urine leaves the papilla as a drip and is
      // caught here — the first place in the body it exists as a fluid pool.
      merge(
        PYRAMIDS.map((p) =>
          curve([p.apex, [HILUM[0] + 0.04, p.y * 0.34, 0]], 0.075, { segments: 8, radial: 12, taper: 0.75 }),
        ),
      ),
      URINE(),
    ),
    part(
      'major_calyces',
      merge([
        curve([[HILUM[0] + 0.06, 0.42, 0.02], [HILUM[0] - 0.02, 0.2, 0.01]], 0.1, { segments: 8, radial: 14 }),
        curve([[HILUM[0] + 0.06, -0.42, 0.02], [HILUM[0] - 0.02, -0.2, 0.01]], 0.1, { segments: 8, radial: 14 }),
        curve([[HILUM[0] + 0.06, 0.02, 0.02], [HILUM[0] - 0.02, 0, 0.01]], 0.09, { segments: 6, radial: 12 }),
      ]),
      URINE(),
    ),
    part(
      'renal_pelvis',
      // A flat funnel in the notch, gathering three streams into one.
      merge([
        place(blob(0.1, 0.3, 0.16, 26), { pos: [HILUM[0] - 0.04, 0, 0.01] }),
        curve([[HILUM[0] - 0.06, -0.16, 0.01], [HILUM[0] - 0.1, -0.42, 0]], 0.09, { segments: 10, radial: 14, taper: 0.62 }),
      ]),
      URINE(),
    ),
    part(
      'ureter',
      curve(
        [[HILUM[0] - 0.1, -0.42, 0], [HILUM[0] - 0.06, -0.9, -0.02], [HILUM[0] + 0.02, -1.5, -0.04]],
        0.055,
        { segments: 26, radial: 12 },
      ),
      URINE(),
    ),

    // ------------------------------------------------------------- vessels
    part(
      'renal_artery',
      curve(
        [[HILUM[0] - 0.86, 0.22, -0.12], [HILUM[0] - 0.4, 0.14, -0.08], [HILUM[0] - 0.06, 0.07, -0.03], [HILUM[0] + 0.12, 0.04, -0.01]],
        0.085,
        { segments: 26, radial: 16, taper: 0.6 },
      ),
      ARTERY(),
    ),
    part(
      'renal_vein',
      // In front of the artery, and wider — the vein carries the same volume at
      // a fraction of the pressure.
      curve(
        [[HILUM[0] - 0.92, -0.2, 0.2], [HILUM[0] - 0.44, -0.12, 0.16], [HILUM[0] - 0.08, -0.06, 0.09], [HILUM[0] + 0.1, -0.04, 0.04]],
        0.105,
        { segments: 26, radial: 16, taper: 0.66 },
      ),
      VEIN(),
    ),
    part(
      'segmental_arteries',
      merge(
        [0.44, 0.14, -0.16, -0.46].map((y) =>
          curve([[HILUM[0] + 0.04, 0.06, -0.02], [HILUM[0] + 0.16, y * 0.7, y * 0.1], [HILUM[0] + 0.28, y, y * 0.16]], 0.038, {
            segments: 14,
            radial: 10,
            taper: 0.6,
          }),
        ),
      ),
      ARTERY(),
    ),
    part(
      'interlobar_arteries',
      // Up the columns, between the pyramids.
      merge(
        PYRAMIDS.slice(0, 5).map((p) =>
          curve([[HILUM[0] + 0.28, p.y * 0.62, 0], inside(p.y * 0.9, p.angle + 0.42, 0.34)], 0.024, {
            segments: 14,
            radial: 8,
            taper: 0.5,
          }),
        ),
      ),
      ARTERY(),
    ),
    part(
      'arcuate_arteries',
      // Arching across the base of each pyramid, at the cortex-medulla border.
      merge(
        PYRAMIDS.slice(0, 5).map((p) =>
          curve(
            [
              inside(p.y * 0.9, p.angle + 0.42, 0.32),
              inside(p.y, p.angle, 0.32),
              inside(p.y * 0.9, p.angle - 0.42, 0.32),
            ],
            0.018,
            { segments: 18, radial: 8 },
          ),
        ),
      ),
      ARTERY(),
    ),

    // ------------------------------------------------- the nephron, enlarged
    part(
      'glomerulus',
      // A knot of capillaries. Drawn as a coil, because that is what it is.
      merge(
        Array.from({ length: 5 }, (_, i) => {
          const t = i / 5;
          return curve(
            [
              np(Math.sin(t * 9) * 0.11, 0.62 + Math.cos(t * 7) * 0.1, 0.1),
              np(0.1 + Math.cos(t * 8) * 0.12, 0.68 + Math.sin(t * 6) * 0.1, 0.2),
              np(-0.02 + Math.sin(t * 5) * 0.1, 0.6 + Math.cos(t * 9) * 0.09, 0.26),
              np(0.07 + Math.cos(t * 6) * 0.1, 0.66, 0.12),
            ],
            0.012,
            { segments: 20, radial: 6, closed: true },
          );
        }),
      ),
      GLOM(),
    ),
    part(
      'bowmans_capsule',
      // The cup the filtrate drips into — a double-walled sac round the knot.
      lathe(
        [[0.13, -0.06], [0.15, 0.02], [0.14, 0.09], [0.1, 0.13], [0.1, 0.11], [0.13, 0.08], [0.13, 0.02], [0.11, -0.05]],
        30,
        { pos: np(0.04, 0.64, 0.18), scale: [0.72, 0.72, 0.72] },
        { phiStart: 1.1, phiLength: TAU - 2.2 },
      ),
      TUBULE(),
    ),
    part(
      'proximal_tubule',
      // Coiled hard against the capsule: length is surface area, and this is
      // where most of what was filtered gets taken straight back.
      curve(
        [
          np(-0.05, 0.48, 0.22), np(0.26, 0.4, 0.3), np(0.4, 0.54, 0.12), np(0.22, 0.68, 0.0),
          np(-0.03, 0.58, -0.04), np(-0.12, 0.34, 0.06), np(0.02, 0.16, 0.16),
        ],
        0.024,
        { segments: 34, radial: 9 },
      ),
      TUBULE(),
    ),
    part(
      'loop_of_henle',
      // Down into the medulla and back. The hairpin is the trick: it builds a
      // salt gradient in the pyramid that the collecting duct then exploits.
      curve(
        [
          np(0.02, 0.16, 0.16), np(-0.02, -0.34, 0.08), np(-0.06, -0.86, 0.0),
          np(-0.16, -1.06, -0.06), np(-0.24, -0.84, -0.1), np(-0.22, -0.3, -0.04), np(-0.14, 0.14, 0.04),
        ],
        0.02,
        { segments: 40, radial: 9 },
      ),
      TUBULE(),
    ),
    part(
      'collecting_duct',
      // Many nephrons drain into one, and it runs the whole depth of a pyramid
      // to the papilla — losing water to that salt gradient the whole way down.
      merge([
        curve([np(-0.14, 0.14, 0.04), np(-0.26, 0.02, 0.0), np(-0.36, -0.12, -0.02)], 0.022, { segments: 12, radial: 9 }),
        curve([np(-0.36, -0.12, -0.02), PYRAMIDS[1].apex], 0.028, { segments: 20, radial: 10, taper: 0.7 }),
      ]),
      TUBULE(),
    ),
  );

  return group;
}
