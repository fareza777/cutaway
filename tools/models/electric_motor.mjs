// Brushed DC motor. Shaft along +Y, cut open toward +Z. What names it is the
// commutator: a ring of copper bars the brushes wipe, reversing the armature
// current every half-turn so the torque never changes sign.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, torus, lathe, merge, ring,
  sphere, curve,
} from '../lib/geo.mjs';

const STEEL = () => pbr('#b0b8c0', { metalness: 0.9, roughness: 0.32 });
const CASE = () => pbr('#6a7480', { metalness: 0.72, roughness: 0.4 });
const COPPER = () => pbr('#d4843c', { metalness: 0.92, roughness: 0.28 });
const IRON = () => pbr('#6a645c', { metalness: 0.68, roughness: 0.48 });
const BRUSH = () => pbr('#3a342e', { metalness: 0.08, roughness: 0.72 });
const BRASS = () => pbr('#d4b05a', { metalness: 0.88, roughness: 0.32 });
const SHAFT = () => pbr('#d8dee4', { metalness: 1, roughness: 0.14 });

function fieldCoil(a) {
  const r = 0.36;
  return curve(
    [
      [Math.cos(a) * r, 0.24, Math.sin(a) * r],
      [Math.cos(a) * (r + 0.11), 0.28, Math.sin(a) * (r + 0.11)],
      [Math.cos(a) * (r + 0.11), -0.28, Math.sin(a) * (r + 0.11)],
      [Math.cos(a) * r, -0.24, Math.sin(a) * r],
    ],
    0.032,
    { segments: 22, radial: 10 },
  );
}

export default function electricMotor() {
  const group = new THREE.Group();

  const window = { phiStart: 0.55, phiLength: TAU - 1.15 };

  group.add(
    part(
      'housing',
      merge([
        lathe(
          [
            [0.46, -0.5],
            [0.54, -0.5],
            [0.54, 0.5],
            [0.46, 0.5],
            [0.46, -0.5],
          ],
          56,
          undefined,
          window,
        ),
        ring(4, () => cylinder(0.02, 0.02, 1.08, 8, { pos: [0.5, 0, 0] })),
      ]),
      CASE(),
    ),
    part(
      'end_cap',
      merge([
        lathe(
          [
            [0.12, 0.5],
            [0.54, 0.5],
            [0.54, 0.58],
            [0.18, 0.58],
            [0.18, 0.54],
            [0.12, 0.54],
          ],
          48,
          undefined,
          window,
        ),
        cylinder(0.18, 0.18, 0.05, 28, { pos: [0, 0.56, 0] }),
        ring(6, () => cylinder(0.016, 0.016, 0.04, 8, { pos: [0.4, 0.56, 0] })),
      ]),
      STEEL(),
    ),
    part(
      'stator',
      merge([
        lathe(
          [
            [0.36, -0.36],
            [0.46, -0.36],
            [0.46, 0.36],
            [0.36, 0.36],
            [0.36, -0.36],
          ],
          48,
          undefined,
          window,
        ),
        box(0.12, 0.58, 0.24, { pos: [0.4, 0, 0] }),
        box(0.12, 0.58, 0.24, { pos: [-0.4, 0, 0] }),
      ]),
      IRON(),
    ),
    part(
      'field_windings',
      merge([fieldCoil(0), fieldCoil(Math.PI)]),
      COPPER(),
    ),
    part(
      'armature',
      merge([
        cylinder(0.3, 0.3, 0.58, 48, { pos: [0, -0.04, 0] }),
        ...[-0.22, -0.08, 0.06, 0.18].map((y) => torus(0.305, 0.007, 8, 40, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] })),
        ring(12, () => box(0.045, 0.52, 0.028, { pos: [0.29, -0.04, 0] })),
      ]),
      IRON(),
    ),
    part(
      'armature_windings',
      merge(
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * TAU;
          const r = 0.28;
          return curve(
            [
              [Math.cos(a) * r, 0.24, Math.sin(a) * r],
              [Math.cos(a) * (r + 0.055), 0.28, Math.sin(a) * (r + 0.055)],
              [Math.cos(a + 0.52) * (r + 0.055), -0.32, Math.sin(a + 0.52) * (r + 0.055)],
              [Math.cos(a + 0.52) * r, -0.28, Math.sin(a + 0.52) * r],
            ],
            0.018,
            { segments: 16, radial: 7 },
          );
        }),
      ),
      COPPER(),
    ),
    part(
      'commutator',
      merge([
        ring(16, () => box(0.04, 0.16, 0.024, { pos: [0.1, 0.44, 0] })),
        cylinder(0.072, 0.072, 0.2, 24, { pos: [0, 0.44, 0] }),
        torus(0.105, 0.012, 10, 28, { pos: [0, 0.35, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.105, 0.012, 10, 28, { pos: [0, 0.53, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      COPPER(),
    ),
    part(
      'brushes',
      merge([
        roundedBox(0.065, 0.09, 0.045, 0.006, 2, { pos: [0.15, 0.44, 0] }),
        roundedBox(0.065, 0.09, 0.045, 0.006, 2, { pos: [-0.15, 0.44, 0] }),
        box(0.018, 0.07, 0.018, { pos: [0.21, 0.5, 0] }),
        box(0.018, 0.07, 0.018, { pos: [-0.21, 0.5, 0] }),
        torus(0.04, 0.008, 8, 16, { pos: [0.21, 0.54, 0], rot: [0, 0, Math.PI / 2] }),
        torus(0.04, 0.008, 8, 16, { pos: [-0.21, 0.54, 0], rot: [0, 0, Math.PI / 2] }),
      ]),
      BRUSH(),
    ),
    part(
      'shaft',
      merge([
        cylinder(0.048, 0.048, 1.42, 24, { pos: [0, 0.04, 0] }),
        cylinder(0.065, 0.065, 0.08, 20, { pos: [0, 0.7, 0] }),
        cylinder(0.065, 0.065, 0.08, 20, { pos: [0, -0.6, 0] }),
      ]),
      SHAFT(),
    ),
    part(
      'bearings',
      merge([
        torus(0.075, 0.024, 12, 20, { pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.075, 0.024, 12, 20, { pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      STEEL(),
    ),
    part(
      'fan',
      merge([
        cylinder(0.09, 0.09, 0.04, 20, { pos: [0, -0.64, 0] }),
        ring(8, () => box(0.24, 0.028, 0.09, { pos: [0.16, -0.64, 0], rot: [0.45, 0, 0] })),
      ]),
      STEEL(),
    ),
    part(
      'terminals',
      merge([
        cylinder(0.02, 0.02, 0.12, 10, { pos: [0.24, 0.62, 0.14] }),
        cylinder(0.02, 0.02, 0.12, 10, { pos: [-0.24, 0.62, 0.14] }),
        sphere(0.03, 10, { pos: [0.24, 0.7, 0.14] }),
        sphere(0.03, 10, { pos: [-0.24, 0.7, 0.14] }),
      ]),
      BRASS(),
    ),
  );

  return group;
}
