// Human brain, superior-anterior toward the camera. Two hemispheres sit a
// fissure apart; the cerebellum tucks under at the back; the brainstem drops
// out below. What names it is the sulci — trenches derived from the same
// surface the paint runs on, the way the heart's grooves are.

import {
  THREE, part, pbr, blob, curve, lathe, merge, sphere, cylinder,
  torus, displace, paint, fbm, nearestOnCurves, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.36, vertexColors: true });
const MEM = () => pbr('#ffffff', { metalness: 0, roughness: 0.28, vertexColors: true });
const ARTERY = () => pbr('#a83038', { metalness: 0.04, roughness: 0.4 });
const NERVE = () => pbr('#ffffff', { metalness: 0, roughness: 0.45, vertexColors: true });

const CORTEX = srgb('#c89080');
const WHITE = srgb('#e8dcc8');
const CEREB = srgb('#c48880');
const STEM = srgb('#c4a090');
const PIA = srgb('#f0d0c8');
const CORD = srgb('#e6ddc8');
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const HEMI = {
  profile: [
    [0, -0.3], [0.36, -0.28], [0.62, -0.08], [0.76, 0.16],
    [0.74, 0.4], [0.52, 0.56], [0.2, 0.64], [0, 0.66],
  ],
  rings: 72,
  segments: 96,
};
const SMOOTH = smoothProfile(HEMI.profile, HEMI.rings);
const GAP = 0.01;
const SQUASH = 0.92;

function hemiR(y) {
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

function onHemi(side, y, a, out = 0) {
  const r = hemiR(y) + out;
  return [
    side * GAP + side * r * Math.sin(a),
    y,
    r * Math.cos(a) * SQUASH,
  ];
}

function sulci(side) {
  const s = side > 0 ? 1 : -1;
  const stroke = (n, fn) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
  return [
    stroke(20, (t) => onHemi(s, 0.06 + 0.1 * Math.sin(t * 2.2), 0.32 + t * 1.25, 0.016)),
    stroke(18, (t) => onHemi(s, 0.6 - t * 0.7, 0.15 + t * 1.25 + 0.08 * Math.sin(t * 3), 0.016)),
    stroke(16, (t) => onHemi(s, 0.58 - t * 0.55, 0.08 + t * 0.85 + 0.12 * Math.sin(t * 2.5), 0.015)),
    stroke(14, (t) => onHemi(s, -0.05 - 0.08 * Math.sin(t * 2), 0.55 + t * 0.9, 0.015)),
    stroke(14, (t) => onHemi(s, 0.5 - t * 0.35, 0.25 + 0.35 * Math.sin(t * 4.2), 0.015)),
    stroke(12, (t) => onHemi(s, 0.28 - t * 0.5, 1.28 + 0.2 * Math.sin(t * 3), 0.015)),
    stroke(12, (t) => onHemi(s, 0.4 - t * 0.3, 0.9 + t * 0.35, 0.015)),
    stroke(12, (t) => onHemi(s, 0.45 - t * 0.6, 0.12 + 0.08 * Math.sin(t * 2), 0.014)),
  ];
}

const SULCI = [...sulci(1), ...sulci(-1)];
const nearSulcus = nearestOnCurves(SULCI, 40);

function cortexColour(x, y, z) {
  const shade = 1 + fbm(x * 5, y * 5, z * 5, 3) * 0.2 + fbm(x * 14, y * 14, z * 14, 2) * 0.12;
  const d = nearSulcus(x, y, z);
  const trench = Math.max(0, 1 - d / 0.048) ** 1.2;
  const c = mix3(CORTEX, srgb('#7a4038'), trench * 0.7);
  return [c[0] * shade * (1 - trench * 0.22), c[1] * shade * (1 - trench * 0.22), c[2] * shade * (1 - trench * 0.22)];
}

function hemiGeom(side) {
  const start = side > 0 ? 0.02 : Math.PI + 0.02;
  const geom = lathe(SMOOTH, HEMI.segments, undefined, { phiStart: start, phiLength: Math.PI - 0.04 });
  geom.translate(side * GAP, 0, 0);
  geom.scale(1.12, 0.95, SQUASH);
  return paint(
    smoothSeams(
      displace(geom, (x, y, z) => {
        const gyri = fbm(x * 10, y * 10, z * 10, 4) * 0.042;
        const trench = 0.13 * Math.exp(-((nearSulcus(x, y, z) / 0.028) ** 2));
        return gyri - trench;
      }),
    ),
    cortexColour,
  );
}

function folia() {
  return Array.from({ length: 14 }, (_, i) => {
    const y = -0.68 + i * 0.038;
    return Array.from({ length: 12 }, (_, k) => {
      const a = -0.75 + (k / 11) * 1.5;
      const r = 0.4;
      return [Math.sin(a) * r, y, -0.55 + Math.cos(a) * r * 0.42];
    });
  });
}
const nearFolia = nearestOnCurves(folia(), 24);

export default function brain() {
  const group = new THREE.Group();

  const cerebellum = paint(
    smoothSeams(
      displace(blob(0.5, 0.3, 0.4, 48, { pos: [0, -0.6, -0.52] }), (x, y, z) => {
        const n = fbm(x * 7, y * 22, z * 7, 3) * 0.016;
        return n - 0.028 * Math.exp(-((nearFolia(x, y, z) / 0.024) ** 2));
      }),
    ),
    (x, y, z) => {
      const shade = 1 + fbm(x * 9, y * 22, z * 9, 2) * 0.22;
      const t = Math.max(0, 1 - nearFolia(x, y, z) / 0.026);
      const c = mix3(CEREB, srgb('#7a4038'), t * 0.5);
      return [c[0] * shade, c[1] * shade, c[2] * shade];
    },
  );

  group.add(
    part('left_hemisphere', hemiGeom(-1), FLESH()),
    part('right_hemisphere', hemiGeom(1), FLESH()),
    part('cerebellum', cerebellum, FLESH()),
    part(
      'brainstem',
      paint(
        smoothSeams(
          merge([
            cylinder(0.15, 0.12, 0.58, 28, { pos: [0, -0.88, -0.22] }),
            blob(0.17, 0.13, 0.15, 22, { pos: [0, -0.58, -0.18] }),
          ]),
        ),
        (x, y, z) => {
          const s = 1 + fbm(x * 6, y * 6, z * 6, 2) * 0.12;
          return [STEM[0] * s, STEM[1] * s, STEM[2] * s];
        },
      ),
      FLESH(),
    ),
    part(
      'corpus_callosum',
      paint(
        smoothSeams(blob(0.4, 0.075, 0.15, 24, { pos: [0, 0.12, 0.02] })),
        () => WHITE,
      ),
      FLESH(),
    ),
    part(
      'ventricles',
      merge([
        blob(0.18, 0.12, 0.1, 18, { pos: [-0.16, 0.1, 0.04] }),
        blob(0.18, 0.12, 0.1, 18, { pos: [0.16, 0.1, 0.04] }),
        blob(0.08, 0.15, 0.06, 14, { pos: [0, 0.02, -0.06] }),
      ]),
      pbr('#d4e8ee', { metalness: 0, roughness: 0.2 }),
    ),
    part(
      'thalamus',
      paint(
        smoothSeams(
          merge([
            blob(0.13, 0.11, 0.11, 18, { pos: [-0.1, -0.02, -0.08] }),
            blob(0.13, 0.11, 0.11, 18, { pos: [0.1, -0.02, -0.08] }),
          ]),
        ),
        () => srgb('#c4a078'),
      ),
      FLESH(),
    ),
    part(
      'meninges',
      // Whole sac, see-through. Opening it at the front hid the organ from
      // behind and left a hole the pick-ray fell through; opacity is the fix.
      paint(
        smoothSeams(
          lathe(
            smoothProfile(
              [
                [0.06, -0.5], [0.5, -0.44], [0.9, -0.08], [1.0, 0.2],
                [0.94, 0.5], [0.66, 0.72], [0.26, 0.8], [0, 0.82],
              ],
              36,
            ),
            64,
            { scale: [1.02, 1.02, 0.94] },
          ),
        ),
        (x, y, z) => {
          const s = 1 + fbm(x * 4, y * 4, z * 4, 2) * 0.08;
          return [PIA[0] * s, PIA[1] * s, PIA[2] * s];
        },
      ),
      MEM(),
    ),
    part(
      'cerebral_arteries',
      merge([
        curve([[0, -0.55, -0.15], [0.12, -0.4, 0.05], [0.35, -0.1, 0.25], [0.45, 0.25, 0.35]], 0.018, { segments: 18, radial: 7 }),
        curve([[0, -0.55, -0.15], [-0.12, -0.4, 0.05], [-0.35, -0.1, 0.25], [-0.45, 0.25, 0.35]], 0.018, { segments: 18, radial: 7 }),
        curve([[0, -0.55, -0.15], [0, -0.35, -0.35], [0.15, -0.15, -0.55]], 0.016, { segments: 14, radial: 6 }),
        curve([[0, -0.55, -0.15], [0, -0.35, -0.35], [-0.15, -0.15, -0.55]], 0.016, { segments: 14, radial: 6 }),
        torus(0.12, 0.016, 8, 24, { pos: [0, -0.52, -0.12], rot: [Math.PI / 2, 0, 0] }),
      ]),
      ARTERY(),
    ),
    part(
      'pituitary',
      paint(smoothSeams(blob(0.07, 0.05, 0.07, 16, { pos: [0, -0.42, 0.12] })), () => srgb('#e0b8b0')),
      FLESH(),
    ),
    part(
      'olfactory_bulbs',
      paint(
        smoothSeams(
          merge([
            blob(0.06, 0.05, 0.13, 14, { pos: [-0.12, 0.28, 0.62] }),
            blob(0.06, 0.05, 0.13, 14, { pos: [0.12, 0.28, 0.62] }),
          ]),
        ),
        () => srgb('#d8b0a8'),
      ),
      FLESH(),
    ),
    part(
      'spinal_cord',
      paint(
        smoothSeams(
          merge([
            cylinder(0.09, 0.08, 0.45, 20, { pos: [0, -1.22, -0.22] }),
            sphere(0.09, 12, { pos: [0, -1.44, -0.22] }),
          ]),
        ),
        (x, y, z) => {
          const s = 1 + fbm(x * 8, y * 8, z * 8, 2) * 0.08;
          return [CORD[0] * s, CORD[1] * s, CORD[2] * s];
        },
      ),
      NERVE(),
    ),
  );

  return group;
}
