// Human lungs, from the front. Right lung on the viewer's left with three
// lobes; left lung on the viewer's right with two and a bite taken out of it
// where the heart sits.
//
// Eighteen named parts. Two decisions carry this model.
//
// First, the lobes are separate solids rather than one lung with grooves cut
// into it. A fissure is not a furrow in a surface — it is the gap where two
// lobes meet, and each lobe really is a separable piece of tissue with its own
// bronchus and its own blood supply. Building them apart means the fissures are
// free, the explode tool does something true, and a lobe can be selected and
// read on its own.
//
// Second, the airway is grown by recursion and then clamped inside the lung at
// every step. The first version grew it in world space and branches came out
// through the front of the organ; `hold()` below is the fix and the reason the
// tree stays where lungs keep theirs.
//
// The alveoli are drawn perhaps two hundred times life size. A real one is
// about a fifth of a millimetre across and there are some 300 million of them.
// The content says so.

import {
  THREE, TAU, part, pbr, blob, curve, lathe, merge, place, sphere,
  displace, paint, fbm, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

const UPPER = srgb('#c58c85');
const MIDDLE = srgb('#bf837c');
const LOWER = srgb('#b87a74');
const PLEURA_TINT = srgb('#d3cabd');
const DIAPHRAGM_TINT = srgb('#9c4a45');

const CARTILAGE = () => pbr('#e2dccb', { metalness: 0, roughness: 0.42 });
const AIRWAY = () => pbr('#d6ccbb', { metalness: 0, roughness: 0.46 });
const ARTERY = () => pbr('#4a6f9c', { metalness: 0.04, roughness: 0.42 });
const VEIN = () => pbr('#a83038', { metalness: 0.04, roughness: 0.4 });
const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.4, vertexColors: true });

// ---------------------------------------------------------------- the space
//
// One profile describes a lung. Each lobe is that profile sliced between two
// heights and closed off at both ends, so neighbouring lobes share a flat face
// and the fissure between them is simply where two solids meet. Building lobes
// as separate ellipsoids instead — the first attempt — gave five lumps with
// gaps between them that read as a bunch of grapes, not as a lung.

const PROFILE = [
  [0, 1.04], [0.2, 0.98], [0.34, 0.8], [0.44, 0.5],
  [0.5, 0.12], [0.53, -0.3], [0.54, -0.66], [0.5, -0.9], [0.3, -1.0], [0, -1.04],
];
const SQUASH = 0.76;
const OFFSET = 0.66;
const HALF = { x: 0.54, y: 1.04, z: 0.54 * SQUASH };

/** Radius of the lung at height `y`. */
function radiusAt(y) {
  const p = PROFILE;
  if (y >= p[0][1]) return p[0][0];
  if (y <= p[p.length - 1][1]) return p[p.length - 1][0];
  for (let i = 1; i < p.length; i += 1) {
    if (y >= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return 0;
}

/** Pulls a point back inside the lung. `keep` < 1 leaves a margin. */
function hold(p, keep = 0.8) {
  const r = radiusAt(p[1]) * keep;
  const q = Math.hypot(p[0] / Math.max(r, 1e-3), p[2] / Math.max(r * SQUASH, 1e-3));
  if (q <= 1) return p;
  return [p[0] / q, p[1], p[2] / q];
}

/**
 * A closed solid: the lung profile between two heights, capped at both ends.
 * The caps are the fissure surfaces, and adjacent lobes sit flush against them.
 */
function slice(from, to, samples = 26) {
  const points = [[0, to]];
  for (let i = 0; i <= samples; i += 1) {
    const y = to + ((from - to) * i) / samples;
    points.push([radiusAt(y), y]);
  }
  points.push([0, from]);
  return smoothProfile(points, 40);
}

/**
 * Leans the whole set of lobes back, which slants every fissure without moving
 * any lobe off its neighbour — a shear applied equally keeps shared faces
 * shared. Real fissures run diagonally; horizontal ones read as slices of bread.
 */
function slant(geometry, amount = 0.42) {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    position.setY(i, position.getY(i) + position.getZ(i) * amount);
  }
  position.needsUpdate = true;
  return geometry;
}

/**
 * Flattens the face that meets the midline and, on the left, presses in the
 * cardiac notch. A shrink toward a plane, never a fold — a transform that moves
 * vertices past one another turns the surface inside out, and backface culling
 * then makes the organ look transparent.
 */
function shapeLobe(geometry, side, cardiac = 0) {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const inner = -x * side;
    let nx = x;
    if (inner > 0.12) nx = -side * (0.12 + (inner - 0.12) * 0.3);
    if (cardiac) {
      const bite = cardiac * Math.exp(-(((y + 0.06) / 0.34) ** 2)) * Math.max(0, (z + 0.02) / 0.42);
      nx += side * bite;
    }
    position.setXYZ(i, nx, y, z);
  }
  position.needsUpdate = true;
  return geometry;
}

const mix = (a, b, t) => a + (b - a) * t;

/** Spongy and evenly grainy — a lung is mostly air, and paler than any organ here. */
function spongy(base) {
  return (x, y, z) => {
    const shade = 1 + fbm(x * 5.5, y * 5.5, z * 5.5, 2) * 0.18 + fbm(x * 17, y * 17, z * 17, 2) * 0.12;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  };
}

function skin(geometry, base, bump = 0.014) {
  const rough = displace(geometry, (x, y, z) => fbm(x * 6, y * 6, z * 6, 3) * bump);
  return paint(smoothSeams(rough), spongy(base));
}

/** One lobe, in place: sliced, slanted, flattened against the midline, shrunk
 *  a hair so the fissure beside it stays a visible line. */
function lobe(side, from, to, { cardiac = 0, tint }) {
  const geometry = lathe(slice(from, to), 60, { scale: [0.995, 1, SQUASH * 0.995] });
  slant(geometry);
  shapeLobe(geometry, side, cardiac);
  geometry.translate(side * OFFSET, 0, 0);
  return skin(geometry, tint);
}

// ------------------------------------------------------------- the airway

/**
 * Grows a branching tube. Deterministic — the wobble comes from depth and
 * index, never from a random number, so every build is byte-identical.
 */
function branch(from, dir, length, radius, depth, index, out) {
  const raw = [from[0] + dir[0] * length, from[1] + dir[1] * length, from[2] + dir[2] * length];
  const to = hold(raw);
  const mid = hold([
    (from[0] + to[0]) / 2 + Math.sin(depth * 2.3 + index) * length * 0.1,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2 + Math.cos(depth * 1.7 + index) * length * 0.1,
  ]);
  out.push(curve([from, mid, to], radius, { segments: 7, radial: depth > 1 ? 6 : 9, taper: 0.78 }));
  if (depth <= 0) return to;

  const lean = depth % 2 === 0 ? 1 : -1;
  for (const swing of [-1, 1]) {
    const next = [dir[0] + swing * 0.5 + lean * 0.1, dir[1] - 0.15, dir[2] + swing * 0.42 * lean];
    const norm = Math.hypot(next[0], next[1], next[2]) || 1;
    branch(to, [next[0] / norm, next[1] / norm, next[2] / norm], length * 0.7, radius * 0.66, depth - 1, index * 2 + (swing > 0 ? 1 : 0), out);
  }
  return to;
}

/** Where the airway and the vessels enter, in lung-local coordinates. */
const GATE = [0.3, 0.3, 0.0];

function airway(side) {
  const out = [];
  branch([GATE[0] * side, GATE[1], GATE[2]], [-0.4 * side, -0.78, 0.28], 0.42, 0.07, 3, 0, out);
  return out.map((g) => g.translate(side * OFFSET, 0, 0));
}

/**
 * The far ends of the tree, where the last visible tubes stop — and a helper to
 * put anything near them safely inside the lung. Everything downstream of the
 * bronchioles is authored as an offset from a tip, and an offset that is not
 * clamped walks straight out through the base: the first version left the
 * alveoli hanging under the lungs like bunches of grapes.
 */
function tips(side) {
  return [
    [-0.16, -0.5, 0.16], [0.1, -0.58, 0.12], [-0.04, -0.36, -0.18],
  ].map(([x, y, z]) => local(side, hold([x * side, y, z], 0.72)));
}

/** Lung-local point to world, clamped inside first. */
function local(side, p, keep = 0.74) {
  const held = hold(p, keep);
  return [held[0] + side * OFFSET, held[1], held[2]];
}

/** Moves a world point near `side`'s lung, staying inside it. */
function near(side, p, dx, dy, dz, keep = 0.74) {
  return local(side, [p[0] - side * OFFSET + dx, p[1] + dy, p[2] + dz], keep);
}

export default function lung() {
  const group = new THREE.Group();

  group.add(
    // ----------------------------------------------------------- the lobes
    part(
      'upper_lobe_right',
      lobe(-1, 1.04, 0.2, { tint: UPPER }),
      FLESH(),
    ),
    part(
      'middle_lobe_right',
      // Small, wedge-shaped, and only on the right. The left lung has no room
      // for it because the heart is in the way.
      lobe(-1, 0.18, -0.12, { tint: MIDDLE }),
      FLESH(),
    ),
    part(
      'lower_lobe_right',
      lobe(-1, -0.14, -1.04, { tint: LOWER }),
      FLESH(),
    ),
    part(
      'upper_lobe_left',
      // Carries the lingula, the little tongue that curls under the heart, and
      // the notch the heart presses into its front edge.
      lobe(1, 1.04, -0.1, { cardiac: 0.26, tint: UPPER }),
      FLESH(),
    ),
    part(
      'lower_lobe_left',
      lobe(1, -0.12, -1.04, { tint: LOWER }),
      FLESH(),
    ),
    part(
      'pleura',
      // Two slippery sheets with a film of fluid between them. A lung is not
      // fixed to the chest wall at all: it is held out against it by suction,
      // which is why a hole letting air into that gap collapses the lung.
      skin(
        merge(
          [-1, 1].map((side) => {
            const shell = lathe(
              smoothProfile(PROFILE.map(([r, y]) => [r > 0 ? r + 0.035 : r, y]), 40),
              52,
              { scale: [1, 1, SQUASH] },
            );
            slant(shell);
            shapeLobe(shell, side, side > 0 ? 0.26 : 0);
            return shell.translate(side * OFFSET, 0, 0);
          }),
        ),
        PLEURA_TINT,
        0.004,
      ),
      FLESH(),
    ),

    // ---------------------------------------------------------- the airway
    part(
      'trachea',
      merge([
        curve([[0, 1.52, 0.02], [0, 1.12, 0.02], [0, 0.76, 0.02]], 0.115, { segments: 18, radial: 18 }),
        // C-shaped rings: cartilage at the front and sides, soft at the back so
        // a swallowed mouthful can bulge into it.
        ...Array.from({ length: 9 }, (_, i) =>
          lathe(
            [[0.115, 0.02], [0.14, 0.015], [0.14, -0.015], [0.115, -0.02]],
            18,
            { pos: [0, 1.46 - i * 0.085, 0.02] },
            { phiStart: -1.15, phiLength: TAU - 2.3 },
          ),
        ),
      ]),
      CARTILAGE(),
    ),
    part(
      'carina',
      // The fork, and the most sensitive spot in the whole airway. Touch it and
      // the cough is violent and entirely involuntary.
      merge([
        place(blob(0.09, 0.08, 0.09, 20), { pos: [0, 0.72, 0.02] }),
        curve([[0, 0.76, 0.02], [-0.14, 0.6, 0.02], [-0.26, 0.46, 0.01]], 0.09, { segments: 12, radial: 14, taper: 0.85 }),
        curve([[0, 0.76, 0.02], [0.14, 0.6, 0.02], [0.26, 0.46, 0.01]], 0.085, { segments: 12, radial: 14, taper: 0.85 }),
      ]),
      CARTILAGE(),
    ),
    part(
      'right_main_bronchus',
      // Wider, shorter and steeper than the left, because the heart shoulders
      // the left one aside. That is why something inhaled almost always ends up
      // in the right lung.
      curve([[-0.26, 0.46, 0.01], [-0.5, 0.36, 0.01], [-OFFSET + GATE[0] * -1 * -1, 0.3, 0]], 0.082, {
        segments: 14,
        radial: 14,
      }),
      AIRWAY(),
    ),
    part(
      'left_main_bronchus',
      curve([[0.26, 0.46, 0.01], [0.52, 0.4, 0.01], [OFFSET - GATE[0], 0.3, 0]], 0.072, { segments: 16, radial: 14 }),
      AIRWAY(),
    ),
    part(
      'bronchial_tree',
      merge([...airway(-1), ...airway(1)]),
      AIRWAY(),
    ),
    part(
      'bronchioles',
      // Below about a millimetre the wall loses its cartilage entirely, so
      // these are held open only by the pull of the tissue around them. Squeeze
      // the muscle in their walls and they close. That is an asthma attack.
      merge(
        [-1, 1].flatMap((side) =>
          tips(side).flatMap((tip, i) =>
            [-0.4, 0, 0.4].map((swing) =>
              curve(
                [
                  tip,
                  near(side, tip, swing * 0.08, -0.1, 0.04),
                  near(side, tip, swing * 0.14, -0.2 - i * 0.02, 0.06),
                ],
                0.016,
                { segments: 8, radial: 5, taper: 0.5 },
              ),
            ),
          ),
        ),
      ),
      AIRWAY(),
    ),
    part(
      'alveoli',
      // Together they come to roughly the area of half a tennis court, folded
      // into a chest. Drawn far larger than life; see the description.
      merge(
        [-1, 1].flatMap((side) =>
          tips(side).flatMap((tip, i) =>
            Array.from({ length: 6 }, (_, k) => {
              const a = (k / 6) * TAU + i;
              return sphere(0.03, 10, {
                pos: near(side, tip, Math.cos(a) * 0.06, -0.24 + Math.sin(a) * 0.05, 0.07 + Math.sin(a * 2) * 0.03, 0.7),
              });
            }),
          ),
        ),
      ),
      AIRWAY(),
    ),

    // -------------------------------------------------------- circulation
    part(
      'pulmonary_arteries',
      // Blue, and correctly so: this is blood that has already been used, on
      // its way to be recharged.
      merge(
        [-1, 1].flatMap((side) => [
          curve([[0, 0.5, 0.26], [side * 0.24, 0.4, 0.2], [side * (OFFSET - 0.28), 0.3, 0.08]], 0.07, {
            segments: 14,
            radial: 12,
            taper: 0.8,
          }),
          ...[0.16, -0.24, -0.6].map((y) =>
            curve(
              [
                [side * (OFFSET - 0.28), 0.3, 0.08],
                hold([side * 0.12, y + 0.2, 0.12], 0.6).map((v, k) => (k === 0 ? v + side * OFFSET : v)),
                hold([side * 0.2, y, 0.16], 0.74).map((v, k) => (k === 0 ? v + side * OFFSET : v)),
              ],
              0.03,
              { segments: 14, radial: 8, taper: 0.5 },
            ),
          ),
        ]),
      ),
      ARTERY(),
    ),
    part(
      'pulmonary_veins',
      // Red, and also correctly so. Four of them, and the only veins in the
      // body carrying oxygenated blood.
      merge(
        [-1, 1].flatMap((side) =>
          [0.1, -0.44].map((y) =>
            curve(
              [
                hold([side * 0.22, y, -0.2], 0.74).map((v, k) => (k === 0 ? v + side * OFFSET : v)),
                [side * (OFFSET - 0.3), y + 0.16, -0.12],
                [side * 0.2, 0.3, -0.06],
                [side * 0.04, 0.34, -0.02],
              ],
              0.046,
              { segments: 18, radial: 10, taper: 1.25 },
            ),
          ),
        ),
      ),
      VEIN(),
    ),
    part(
      'capillary_bed',
      // A mesh so fine that red cells pass through it in single file. The
      // barrier between air and blood is about half a micron — thinner than the
      // wall of a soap bubble.
      merge(
        [-1, 1].flatMap((side) =>
          tips(side).slice(0, 2).flatMap((tip) =>
            Array.from({ length: 7 }, (_, k) => {
              const a = (k / 7) * TAU;
              return curve(
                [
                  near(side, tip, Math.cos(a) * 0.09, -0.24 + Math.sin(a) * 0.07, 0.02, 0.7),
                  near(side, tip, Math.cos(a + 1) * 0.1, -0.24 + Math.sin(a + 1) * 0.08, 0.11, 0.7),
                  near(side, tip, Math.cos(a + 2) * 0.08, -0.24 + Math.sin(a + 2) * 0.06, 0.06, 0.7),
                ],
                0.01,
                { segments: 12, radial: 5 },
              );
            }),
          ),
        ),
      ),
      VEIN(),
    ),

    // ---------------------------------------------------------- the bellows
    part(
      'diaphragm',
      // A lung has no muscle of its own and cannot pull anything. This sheet
      // does the work: it flattens, the chest gets bigger, the pressure inside
      // drops, and air falls in on its own.
      skin(
        // Run the profile out and back so the dome is a shell with two sides.
        // A single-sided sheet is invisible from behind and a tap aimed at it
        // can pass straight through — the smoke test's ray check catches this.
        lathe(
          smoothProfile(
            [
              [0, -1.06], [0.55, -1.16], [1.05, -1.34], [1.45, -1.54], [1.66, -1.76], [1.7, -1.9],
              [1.64, -1.92], [1.6, -1.78], [1.39, -1.57], [1.0, -1.38], [0.53, -1.2], [0, -1.1],
            ],
            36,
          ),
          56,
          { scale: [1, 1, 0.82] },
        ),
        DIAPHRAGM_TINT,
        0.012,
      ),
      FLESH(),
    ),
    part(
      'hilum',
      // Not a structure so much as a doorway: the single place where bronchus,
      // artery, veins, nerves and lymphatics all cross into the lung together.
      merge([-1, 1].map((side) => place(blob(0.11, 0.18, 0.13, 20), { pos: [side * (OFFSET - 0.3), 0.3, 0] }))),
      AIRWAY(),
    ),
  );

  return group;
}
