// Lower molar, roots down (−Y), crown toward +Y, buccal +Z. The identity is
// the layered cut everyone has seen in a poster: a hard white cap, a yellow
// body, a red room, and two roots. Crown from one profile; roots as a pair
// of offset lathes so they read as a molar, not a carrot.

import {
  THREE, TAU, part, pbr, curve, lathe, merge,
  displace, paint, fbm, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.4, vertexColors: true });
const ENAMEL_M = () => pbr('#ffffff', { metalness: 0.1, roughness: 0.18, vertexColors: true });
const PINK = () => pbr('#ffffff', { metalness: 0, roughness: 0.45, vertexColors: true });
const BONE_M = () => pbr('#ffffff', { metalness: 0, roughness: 0.5, vertexColors: true });
const NERVE = () => pbr('#e8dcc8', { metalness: 0, roughness: 0.42 });
const VESSEL = () => pbr('#a83038', { metalness: 0.04, roughness: 0.4 });

const ENAMEL = srgb('#f4f0e6');
const DENTIN = srgb('#e2c070');
const PULP = srgb('#d44848');
const CEMENT = srgb('#d8c8a8');
const GUM = srgb('#c07070');
const BONE = srgb('#e0c8a8');

function tissue(base, grain = 0.14) {
  return (x, y, z) => {
    const s = 1 + fbm(x * 6, y * 6, z * 6, 2) * grain;
    return [base[0] * s, base[1] * s, base[2] * s];
  };
}

export default function tooth() {
  const group = new THREE.Group();
  const roots = [
    [0.11, 0.08],
    [-0.11, -0.04],
  ];

  const enamel = paint(
    smoothSeams(
      displace(
        lathe(
          [
            [0, 0.74],
            [0.2, 0.72],
            [0.38, 0.6],
            [0.44, 0.42],
            [0.42, 0.2],
            [0.38, 0.12],
            [0, 0.12],
          ],
          80,
          undefined,
          { phiStart: 0.5, phiLength: TAU - 1.05 },
        ),
        (x, y, z) => {
          const bump = (cx, cz) =>
            Math.exp(-((((x - cx) / 0.15) ** 2) + (((z - cz) / 0.13) ** 2) + (((y - 0.66) / 0.09) ** 2))) * 0.07;
          const cusp = bump(0.17, 0.13) + bump(-0.17, 0.13) + bump(0.17, -0.11) + bump(-0.17, -0.11);
          return cusp + fbm(x * 10, y * 10, z * 10, 2) * 0.004;
        },
      ),
    ),
    tissue(ENAMEL, 0.05),
  );

  const dentin = paint(
    smoothSeams(
      merge([
        lathe(
          [
            [0, 0.54], [0.16, 0.52], [0.3, 0.4], [0.36, 0.16],
            [0.32, 0.08], [0.18, 0.22], [0.12, 0.42], [0, 0.48],
          ],
          48,
          undefined,
          { phiStart: 0.5, phiLength: TAU - 1.05 },
        ),
        ...roots.map(([ox, oz]) =>
          lathe(
            [
              [0.15, 0.12], [0.13, -0.08], [0.1, -0.4], [0.06, -0.72], [0.03, -0.94], [0, -0.96],
              [0, -0.9], [0.05, -0.7], [0.09, -0.38], [0.13, 0.1],
            ],
            32,
            { pos: [ox, 0, oz] },
          ),
        ),
      ]),
    ),
    tissue(DENTIN, 0.1),
  );

  const pulp = paint(
    smoothSeams(
      merge([
        lathe(
          smoothProfile(
            [
              [0, 0.4], [0.12, 0.38], [0.16, 0.22], [0.1, 0.08],
              [0.04, 0.02], [0, 0.06],
            ],
            18,
          ),
          28,
        ),
        ...roots.map(([ox, oz]) =>
          lathe(
            smoothProfile(
              [
                [0, 0.1], [0.05, 0.08], [0.045, -0.4], [0.028, -0.78], [0, -0.82],
              ],
              16,
            ),
            20,
            { pos: [ox, 0, oz] },
          ),
        ),
      ]),
    ),
    tissue(PULP, 0.08),
  );

  group.add(
    part('enamel', enamel, ENAMEL_M()),
    part('dentin', dentin, FLESH()),
    part('pulp', pulp, FLESH()),
    part(
      'cementum',
      paint(
        smoothSeams(
          merge(
            roots.map(([ox, oz]) =>
              lathe(
                [
                  [0.16, 0.1], [0.14, -0.08], [0.11, -0.42], [0.07, -0.74], [0.04, -0.94],
                  [0.03, -0.92], [0.06, -0.72], [0.1, -0.4], [0.13, -0.06], [0.15, 0.1],
                ],
                32,
                { pos: [ox, 0, oz] },
              ),
            ),
          ),
        ),
        tissue(CEMENT, 0.08),
      ),
      FLESH(),
    ),
    part(
      'periodontal_ligament',
      paint(
        smoothSeams(
          merge(
            roots.map(([ox, oz]) =>
              lathe(
                [
                  [0.175, 0.1], [0.155, -0.08], [0.125, -0.42], [0.085, -0.7],
                  [0.075, -0.68], [0.115, -0.4], [0.145, -0.06], [0.165, 0.1],
                ],
                28,
                { pos: [ox, 0, oz] },
              ),
            ),
          ),
        ),
        tissue(srgb('#d4a090'), 0.1),
      ),
      FLESH(),
    ),
    part(
      'gingiva',
      paint(
        smoothSeams(
          displace(
            lathe(
              smoothProfile(
                [
                  [0.4, 0.2], [0.58, 0.14], [0.66, 0.02], [0.64, -0.08],
                  [0.52, -0.1], [0.4, 0.08], [0.38, 0.18],
                ],
                32,
              ),
              96,
            ),
            (x, y, z) => fbm(x * 7, y * 7, z * 7, 3) * 0.012,
          ),
        ),
        tissue(GUM, 0.12),
      ),
      PINK(),
    ),
    part(
      'alveolar_bone',
      paint(
        smoothSeams(
          displace(
            lathe(
              [
                [0.42, 0.02], [0.72, -0.06], [0.8, -0.42], [0.72, -0.88], [0.42, -1.08],
                [0.28, -1.0], [0.38, -0.8], [0.46, -0.38], [0.4, 0],
              ],
              80,
            ),
            (x, y, z) => fbm(x * 5, y * 5, z * 5, 2) * 0.018,
          ),
        ),
        tissue(BONE, 0.12),
      ),
      BONE_M(),
    ),
    part(
      'nerves',
      merge([
        curve([[0, 0.22, 0], [0.1, -0.35, 0.06], [0.11, -0.92, 0.08], [0.1, -1.18, 0.06]], 0.016, { segments: 16, radial: 6 }),
        curve([[0, 0.18, 0], [-0.1, -0.35, -0.02], [-0.11, -0.9, -0.04], [-0.1, -1.16, -0.02]], 0.014, { segments: 14, radial: 5 }),
      ]),
      NERVE(),
    ),
    part(
      'vessels',
      merge([
        curve([[0.02, 0.2, 0.02], [0.1, -0.45, 0.06], [0.1, -1.14, 0.05]], 0.011, { segments: 14, radial: 5 }),
        curve([[-0.02, 0.16, -0.02], [-0.1, -0.4, -0.03], [-0.1, -1.12, -0.02]], 0.01, { segments: 12, radial: 5 }),
      ]),
      VESSEL(),
    ),
  );

  return group;
}
