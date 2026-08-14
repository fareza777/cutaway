// Inner ear, left. The snail of the cochlea sits on +X, the canals loop above
// it in three orthogonal planes, and the ossicles hang in front of the oval
// window. The spiral is a tube of varying radius swept with a stable frame —
// Frenet torsion on a helix reads as overlapping blades.

import {
  THREE, TAU, part, pbr, blob, curve, torus, merge, place, sphere, cylinder, box,
  paint, fbm, srgb, smoothSeams, lathe,
} from '../lib/geo.mjs';

const BONE = () => pbr('#ffffff', { metalness: 0, roughness: 0.46, vertexColors: true });
const MEM = () => pbr('#ffffff', { metalness: 0, roughness: 0.42, vertexColors: true });
const NERVE = () => pbr('#ffffff', { metalness: 0, roughness: 0.45, vertexColors: true });
const OSSICLE = () => pbr('#ffffff', { metalness: 0.04, roughness: 0.34, vertexColors: true });
const DRUM = () => pbr('#ffffff', { metalness: 0, roughness: 0.42, vertexColors: true });

const BONE_C = srgb('#e4d4b8');
const COCH_C = srgb('#eddcc4');
const NERVE_C = srgb('#e8dcc4');
const MEM_C = srgb('#dcc4b0');
const DRUM_C = srgb('#c49870');
const OSS_C = srgb('#f0e6d0');
const mix = (a, b, t) => a + (b - a) * t;

function tint(base, freq = 8, amt = 0.1) {
  return (x, y, z) => {
    const s = 1 + fbm(x * freq, y * freq, z * freq, 2) * amt;
    return [base[0] * s, base[1] * s, base[2] * s];
  };
}

function bonePaint(geom) {
  return paint(smoothSeams(geom), tint(BONE_C, 9, 0.12));
}

function tubeVarying(points, radiusAt, { segments = 96, radial = 14 } = {}) {
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const positions = [];
  const indices = [];
    let lastN = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const p = path.getPointAt(t);
      const tangent = path.getTangentAt(t).normalize();
      let n = lastN.clone().addScaledVector(tangent, -lastN.dot(tangent));
      if (n.lengthSq() < 1e-8) {
        n = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x);
      }
      n.normalize();
      lastN = n;
      const b = new THREE.Vector3().crossVectors(tangent, n).normalize();
    const r = radiusAt(t);
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * TAU;
      positions.push(
        p.x + n.x * Math.cos(a) * r + b.x * Math.sin(a) * r,
        p.y + n.y * Math.cos(a) * r + b.y * Math.sin(a) * r,
        p.z + n.z * Math.cos(a) * r + b.z * Math.sin(a) * r,
      );
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const c = i * radial + ((j + 1) % radial);
      const d = (i + 1) * radial + j;
      const e = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, d, c, c, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function cochleaPts(n = 110) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const a = t * 2.55 * TAU;
    const r = 0.48 * (1 - t * 0.55);
    return [0.2 + r * Math.cos(a), -0.04 + t * 0.44, r * Math.sin(a)];
  });
}

export default function innerEar() {
  const group = new THREE.Group();
  const helix = cochleaPts();

  group.add(
    part(
      'cochlea',
      paint(
        smoothSeams(
          merge([
            tubeVarying(helix, (t) => 0.048 * (1 - t * 0.62), { segments: 160, radial: 14 }),
            lathe(
              [
                [0, -0.04],
                [0.09, 0.0],
                [0.07, 0.2],
                [0.04, 0.36],
                [0, 0.4],
              ],
              20,
              { pos: [0.2, -0.04, 0] },
            ),
          ]),
        ),
        tint(COCH_C, 7, 0.1),
      ),
      BONE(),
    ),
    part(
      'vestibule',
      bonePaint(blob(0.17, 0.15, 0.15, 28, { pos: [0.04, 0.14, 0] })),
      BONE(),
    ),
    part(
      'anterior_canal',
      bonePaint(
        place(torus(0.3, 0.042, 18, 64), { rot: [0.2, 0, Math.PI / 2], pos: [0.02, 0.46, 0.02] }),
      ),
      BONE(),
    ),
    part(
      'posterior_canal',
      bonePaint(
        place(torus(0.28, 0.04, 18, 64), { rot: [Math.PI / 2, 0.35, 0], pos: [-0.02, 0.3, -0.24] }),
      ),
      BONE(),
    ),
    part(
      'lateral_canal',
      bonePaint(
        place(torus(0.26, 0.04, 18, 64), { rot: [0.15, 0, 0], pos: [0.08, 0.24, 0.08] }),
      ),
      BONE(),
    ),
    part(
      'oval_window',
      bonePaint(cylinder(0.05, 0.05, 0.022, 20, { pos: [-0.14, 0.12, 0.08], rot: [0, 0.6, 0.3] })),
      BONE(),
    ),
    part(
      'round_window',
      bonePaint(cylinder(0.038, 0.038, 0.018, 18, { pos: [-0.12, 0, 0.12], rot: [0.4, 0.5, 0] })),
      BONE(),
    ),
    part(
      'malleus',
      paint(
        smoothSeams(
          merge([
            blob(0.05, 0.062, 0.045, 18, { pos: [-0.3, 0.26, 0.24] }),
            curve(
              [
                [-0.3, 0.22, 0.24],
                [-0.28, 0.04, 0.18],
                [-0.22, -0.02, 0.14],
                [-0.16, 0.1, 0.09],
              ],
              0.016,
              { segments: 18, radial: 8 },
            ),
          ]),
        ),
        tint(OSS_C, 10, 0.08),
      ),
      OSSICLE(),
    ),
    part(
      'incus',
      paint(
        smoothSeams(
          merge([
            blob(0.048, 0.04, 0.038, 16, { pos: [-0.24, 0.2, 0.16] }),
            box(0.07, 0.06, 0.045, { pos: [-0.2, 0.15, 0.13] }),
            curve(
              [
                [-0.24, 0.18, 0.16],
                [-0.2, 0.14, 0.12],
                [-0.16, 0.08, 0.08],
                [-0.14, 0.12, 0.07],
              ],
              0.024,
              { segments: 16, radial: 8 },
            ),
          ]),
        ),
        tint(OSS_C, 10, 0.08),
      ),
      OSSICLE(),
    ),
    part(
      'stapes',
      paint(
        smoothSeams(
          merge([
            torus(0.032, 0.009, 10, 20, { pos: [-0.155, 0.12, 0.085], rot: [0.5, 0.4, 0] }),
            box(0.01, 0.045, 0.01, { pos: [-0.15, 0.12, 0.07], rot: [0.4, 0.3, 0] }),
            box(0.034, 0.01, 0.014, { pos: [-0.145, 0.12, 0.055], rot: [0.3, 0.5, 0] }),
          ]),
        ),
        tint(OSS_C, 10, 0.08),
      ),
      OSSICLE(),
    ),
    part(
      'tympanic_membrane',
      paint(
        smoothSeams(
          lathe(
            [
              [0, 0.02],
              [0.06, 0.008],
              [0.12, 0],
              [0.17, -0.004],
              [0.17, -0.012],
              [0.12, -0.008],
              [0, 0.01],
            ],
            36,
            { pos: [-0.44, 0.14, 0.3], rot: [0.3, 0.7, 0] },
          ),
        ),
        tint(DRUM_C, 12, 0.1),
      ),
      DRUM(),
    ),
    part(
      'auditory_nerve',
      paint(
        smoothSeams(
          merge([
            curve(
              [
                [0.14, 0.06, 0],
                [0.36, -0.14, -0.14],
                [0.56, -0.4, -0.22],
              ],
              0.058,
              { segments: 18, radial: 12 },
            ),
            sphere(0.065, 12, { pos: [0.56, -0.4, -0.22] }),
          ]),
        ),
        tint(NERVE_C, 8, 0.1),
      ),
      NERVE(),
    ),
    part(
      'eustachian_tube',
      paint(
        smoothSeams(
          curve(
            [
              [-0.2, -0.04, 0.18],
              [-0.36, -0.24, 0.3],
              [-0.46, -0.55, 0.36],
            ],
            0.03,
            { segments: 16, radial: 10 },
          ),
        ),
        tint(MEM_C, 8, 0.1),
      ),
      MEM(),
    ),
  );

  return group;
}
