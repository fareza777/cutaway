// Violin. Long axis +Y, belly toward +Z. What names it is the figure-eight
// bout — two lobes pinched at the waist — and the f-holes cut through the
// belly. The outline is one resampled profile; the plates, the ribs and the
// purfling all ask it where the edge is, so they cannot drift apart.

import {
  THREE, TAU, part, pbr, blob, curve, merge, sphere,
  cylinder, box, roundedBox, paint, fbm, srgb, smoothSeams, smoothProfile,
} from '../lib/geo.mjs';

const WOOD = () => pbr('#ffffff', { metalness: 0.04, roughness: 0.32, vertexColors: true });
const EBONY = () => pbr('#1a1410', { metalness: 0.05, roughness: 0.55 });
const GUT = () => pbr('#f0e6cc', { metalness: 0, roughness: 0.48 });
const SPRUCE = srgb('#e0bc88');
const MAPLE = srgb('#c89858');
const DARK_WOOD = srgb('#3a1c0c');
const FHOLE = srgb('#0c0806');
const VARNISH = srgb('#8a3e18');
const PURFLING = srgb('#1a100c');

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Radius against height, button to neck-block. Lower bout widest, C-bout
// corners held by paired points so Catmull-Rom cannot round them off, waist
// pinched, upper bout a little narrower — the textbook figure-eight.
const BOUT_PTS = [
  [0.04, -1.12],
  [0.22, -1.08],
  [0.48, -0.98],
  [0.62, -0.84],
  [0.65, -0.66],
  [0.60, -0.48],
  [0.50, -0.36],
  [0.48, -0.33],
  [0.34, -0.30],
  [0.24, -0.20],
  [0.215, -0.04],
  [0.215, 0.12],
  [0.26, 0.24],
  [0.46, 0.33],
  [0.48, 0.36],
  [0.54, 0.46],
  [0.56, 0.62],
  [0.50, 0.80],
  [0.30, 0.94],
  [0.08, 1.00],
];

const BOUT = smoothProfile(BOUT_PTS, 96);
const Y0 = BOUT[0][1];
const Y1 = BOUT[BOUT.length - 1][1];
const YMID = (Y0 + Y1) * 0.5;

function bout(y) {
  const p = BOUT;
  if (y <= p[0][1]) return p[0][0];
  if (y >= p[p.length - 1][1]) return p[p.length - 1][0];
  for (let i = 1; i < p.length; i += 1) {
    if (y <= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return mix(p[i - 1][0], p[i][0], t);
    }
  }
  return 0.2;
}

/** Signed distance to either f-hole. Negative is inside the cut. */
function distSeg(x, y, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby + 1e-8)));
  return Math.hypot(x - (ax + abx * t), y - (ay + aby * t));
}

function fSDF(x, y) {
  let best = Infinity;
  for (const s of [-1, 1]) {
    best = Math.min(best, Math.hypot(x - s * 0.185, y + 0.3) - 0.04);
    best = Math.min(best, Math.hypot(x - s * 0.205, y - 0.4) - 0.036);
    const stem = [
      [s * 0.185, -0.3],
      [s * 0.16, -0.1],
      [s * 0.155, 0.08],
      [s * 0.195, 0.24],
      [s * 0.205, 0.4],
    ];
    for (let i = 1; i < stem.length; i += 1) {
      best = Math.min(best, distSeg(x, y, ...stem[i - 1], ...stem[i]) - 0.013);
    }
    best = Math.min(best, distSeg(x, y, s * 0.155, 0.02, s * 0.07, 0.02) - 0.01);
  }
  return best;
}

if (fSDF(0, 0) < 0.06) throw new Error(`f-hole SDF ate the belly centre (${fSDF(0, 0).toFixed(3)})`);
if (fSDF(0.185, -0.3) > 0) throw new Error('f-hole SDF missed the lower eye');

function archZ(x, y, zSign) {
  const r = Math.max(0.05, bout(y));
  const xn = Math.max(-1, Math.min(1, x / r));
  const long = 1 - 0.1 * (((y - YMID) / ((Y1 - Y0) * 0.5)) ** 2);
  const dome = 0.1 * (1 - xn * xn) * long;
  const channel = 0.01 * Math.exp(-((((Math.abs(xn) - 0.84) / 0.12) ** 2)));
  return zSign * (0.05 + dome - channel);
}

function wood(base, isBelly) {
  return (x, y, z) => {
    const r = Math.max(0.06, bout(y));
    const radial = Math.min(1, Math.abs(x) / r);
    const grain = 1 + fbm(x * 1.4, y * 14, z * 1.4, 2) * 0.035;
    const flame = isBelly ? 0 : Math.abs(Math.sin(x * 11 + fbm(x * 2, y * 6, z * 2, 2))) * 0.08 * (1 - radial);
    const varnish = Math.max(0, (radial - 0.18) / 0.82);
    const c = mix3(
      [base[0] * (grain + flame), base[1] * grain, base[2] * grain],
      VARNISH,
      varnish * 0.5,
    );
    const purf = Math.max(
      Math.exp(-((((radial - 0.93) / 0.01) ** 2))),
      Math.exp(-((((radial - 0.955) / 0.008) ** 2))),
    );
    const edged = mix3(c, PURFLING, Math.min(1, purf));
    if (!isBelly) return edged;
    const hole = fSDF(x, y);
    const rim = Math.exp(-(((hole / 0.012) ** 2)));
    return mix3(edged, FHOLE, hole < 0.014 ? Math.min(1, 0.4 + rim) : 0);
  };
}

/** Filled figure-eight plate with thickness. F-holes go through; the back shows. */
function plate(zSign) {
  const ny = 128;
  const nx = 80;
  const th = 0.018;
  const positions = [];
  const vertex = (i, j, layer) => {
    const y = Y0 + (Y1 - Y0) * (i / ny);
    const r = Math.max(0.04, bout(y));
    const xn = (j / nx) * 2 - 1;
    const x = xn * r;
    return [x, y, archZ(x, y, zSign) - zSign * layer * th];
  };
  for (let layer = 0; layer < 2; layer += 1) {
    for (let i = 0; i <= ny; i += 1) {
      for (let j = 0; j <= nx; j += 1) {
        positions.push(...vertex(i, j, layer));
      }
    }
  }
  const stride = (ny + 1) * (nx + 1);
  const hole = (i, j) => {
    if (zSign < 0) return false;
    const a = (i * (nx + 1) + j) * 3;
    const d = ((i + 1) * (nx + 1) + (j + 1)) * 3;
    return fSDF((positions[a] + positions[d]) * 0.5, (positions[a + 1] + positions[d + 1]) * 0.5) < 0;
  };
  const indices = [];
  let kept = 0;
  for (let i = 0; i < ny; i += 1) {
    for (let j = 0; j < nx; j += 1) {
      if (hole(i, j)) continue;
      kept += 1;
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      if (zSign > 0) indices.push(a, b, d, a, d, c);
      else indices.push(a, d, b, a, c, d);
      const e = a + stride;
      const f = b + stride;
      const g = c + stride;
      const h = d + stride;
      if (zSign > 0) indices.push(e, h, f, e, g, h);
      else indices.push(e, f, h, e, h, g);
    }
  }
  if (kept < ny * nx * 0.85) throw new Error(`belly lost too many faces (${kept}/${ny * nx})`);
  const quad = (a, b, c, d) => indices.push(a, b, d, a, d, c);
  for (let i = 0; i < ny; i += 1) {
    const left = i * (nx + 1);
    const right = left + nx;
    quad(left, left + (nx + 1), left + (nx + 1) + stride, left + stride);
    quad(right, right + stride, right + (nx + 1) + stride, right + (nx + 1));
  }
  const cellHole = (i, j) => i < 0 || j < 0 || i >= ny || j >= nx || hole(i, j);
  for (let i = 0; i < ny; i += 1) {
    for (let j = 0; j < nx; j += 1) {
      if (hole(i, j)) continue;
      const a = i * (nx + 1) + j;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      if (cellHole(i, j - 1) && j > 0) quad(a, c, c + stride, a + stride);
      if (cellHole(i, j + 1) && j < nx - 1) quad(b, b + stride, d + stride, d);
      if (cellHole(i - 1, j) && i > 0) quad(a, a + stride, b + stride, b);
      if (cellHole(i + 1, j) && i < ny - 1) quad(c, d, d + stride, c + stride);
    }
  }
  for (let j = 0; j < nx; j += 1) {
    if (!hole(0, j)) {
      const a = j;
      quad(a, a + stride, a + 1 + stride, a + 1);
    }
    if (!hole(ny - 1, j)) {
      const a = ny * (nx + 1) + j;
      quad(a, a + 1, a + 1 + stride, a + stride);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return paint(geom, wood(zSign > 0 ? SPRUCE : MAPLE, zSign > 0));
}

/** Closed rib loop with inward linings — the linings face ±Z so a tap-ray hits. */
function ribsGeom() {
  const n = 140;
  const hz = 0.06;
  const flange = 0.05;
  const loop = [];
  for (let i = 0; i <= n; i += 1) {
    const y = Y0 + ((Y1 - Y0) * i) / n;
    loop.push([bout(y), y]);
  }
  for (let i = n; i >= 0; i -= 1) {
    const y = Y0 + ((Y1 - Y0) * i) / n;
    loop.push([-bout(y), y]);
  }
  const positions = [];
  const indices = [];
  const push = (x, y, z) => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };
  const inward = ([x, y]) => {
    const len = Math.hypot(x, y - YMID) || 1;
    return [-x / len, -(y - YMID) / len];
  };
  for (let i = 0; i < loop.length; i += 1) {
    const [x, y] = loop[i];
    const [nx, ny] = loop[(i + 1) % loop.length];
    const [inx, iny] = inward([x, y]);
    const [jnx, jny] = inward([nx, ny]);
    const a = push(x, y, hz);
    const b = push(x, y, -hz);
    const c = push(nx, ny, hz);
    const d = push(nx, ny, -hz);
    const e = push(x + inx * flange, y + iny * flange, hz);
    const f = push(nx + jnx * flange, ny + jny * flange, hz);
    const g = push(x + inx * flange, y + iny * flange, -hz);
    const h = push(nx + jnx * flange, ny + jny * flange, -hz);
    // Outer wall, then the two linings that face the camera and the back.
    indices.push(a, c, b, b, c, d);
    indices.push(a, e, f, a, f, c);
    indices.push(b, d, h, b, h, g);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export default function violin() {
  const group = new THREE.Group();

  const ribs = paint(
    smoothSeams(
      merge([
        ribsGeom(),
        box(0.16, 0.028, 0.12, { pos: [0, Y0, 0] }),
        box(0.24, 0.028, 0.12, { pos: [0, Y1, 0] }),
      ]),
    ),
    wood(MAPLE, false),
  );

  const scrollPts = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    const a = 0.2 + t * 2.7 * TAU;
    const r = 0.12 * (1 - t * 0.62);
    return [r * Math.cos(a) * 0.62, 1.66 + r * Math.sin(a), 0.015];
  });

  group.add(
    part('belly', plate(1), WOOD()),
    part('back', plate(-1), WOOD()),
    part('ribs', ribs, WOOD()),
    part(
      'neck',
      paint(
        smoothSeams(
          merge([
            cylinder(0.052, 0.068, 0.62, 20, { pos: [0, 1.28, -0.01], rot: [0.12, 0, 0] }),
            roundedBox(0.13, 0.24, 0.11, 0.02, 2, { pos: [0, 1.58, 0] }),
          ]),
        ),
        wood(MAPLE, false),
      ),
      WOOD(),
    ),
    part(
      'scroll',
      paint(
        smoothSeams(
          merge([
            curve(scrollPts, 0.034, { segments: 40, radial: 12 }),
            sphere(0.046, 14, { pos: scrollPts[scrollPts.length - 1] }),
          ]),
        ),
        wood(MAPLE, false),
      ),
      WOOD(),
    ),
    part(
      'fingerboard',
      roundedBox(0.145, 0.78, 0.032, 0.008, 2, { pos: [0, 1.12, 0.08] }),
      EBONY(),
    ),
    part(
      'bridge',
      paint(
        smoothSeams(
          merge([
            box(0.36, 0.02, 0.012, { pos: [0, 0.03, 0.172] }),
            box(0.1, 0.04, 0.01, { pos: [0, 0.0, 0.165] }),
            box(0.02, 0.09, 0.012, { pos: [-0.13, -0.03, 0.15] }),
            box(0.02, 0.09, 0.012, { pos: [0.13, -0.03, 0.15] }),
            box(0.055, 0.018, 0.016, { pos: [-0.13, -0.08, 0.125] }),
            box(0.055, 0.018, 0.016, { pos: [0.13, -0.08, 0.125] }),
            ...[-0.055, -0.018, 0.018, 0.055].map((x) =>
              box(0.012, 0.016, 0.01, { pos: [x, 0.042, 0.176] }),
            ),
          ]),
        ),
        wood(MAPLE, false),
      ),
      WOOD(),
    ),
    part(
      'strings',
      merge(
        [-0.055, -0.018, 0.018, 0.055].map((x) =>
          curve(
            [
              [x * 1.35, -0.72, 0.12],
              [x * 1.15, -0.02, 0.205],
              [x * 0.55, 1.44, 0.1],
            ],
            0.005,
            { segments: 16, radial: 5 },
          ),
        ),
      ),
      GUT(),
    ),
    part(
      'tailpiece',
      merge([
        roundedBox(0.155, 0.2, 0.032, 0.02, 2, { pos: [0, -0.78, 0.1] }),
        curve([[0, -0.88, 0.08], [0, -0.98, 0.02], [0, -1.04, 0]], 0.01, { segments: 8, radial: 5 }),
      ]),
      EBONY(),
    ),
    part(
      'pegs',
      merge(
        [-1, 1].flatMap((s) =>
          [1.56, 1.7].map((y) =>
            merge([
              cylinder(0.016, 0.026, 0.18, 12, {
                pos: [s * 0.09, y, 0],
                rot: [0, 0, Math.PI / 2],
              }),
              sphere(0.03, 10, { pos: [s * 0.18, y, 0] }),
            ]),
          ),
        ),
      ),
      EBONY(),
    ),
    part(
      'soundpost',
      paint(
        smoothSeams(cylinder(0.016, 0.016, 0.22, 12, { pos: [0.1, -0.08, 0], rot: [Math.PI / 2, 0, 0] })),
        wood(MAPLE, false),
      ),
      WOOD(),
    ),
    part(
      'bass_bar',
      paint(smoothSeams(box(0.032, 0.78, 0.028, { pos: [-0.13, 0.02, 0.075] })), wood(SPRUCE, false)),
      WOOD(),
    ),
    part(
      'chinrest',
      blob(0.15, 0.1, 0.045, 16, { pos: [0.18, -0.96, 0.12] }),
      EBONY(),
    ),
  );

  return group;
}
