// Hard disk. Platters lie in XZ and spin about +Y. The identity is the stack of
// mirrors and the arm that flies a head across them — a gramophone, miniaturised
// and sealed. Cover is a real lid with resting opacity, not a missing wall.

import {
  THREE, part, pbr, box, roundedBox, cylinder, torus, merge, ring, curve,
} from '../lib/geo.mjs';

const AL = () => pbr('#8a929c', { metalness: 0.88, roughness: 0.34 });
const PLATTER = () => pbr('#7a8a9a', { metalness: 0.96, roughness: 0.06 });
const HUB = () => pbr('#3a4048', { metalness: 0.85, roughness: 0.38 });
const ARM = () => pbr('#c5ccd4', { metalness: 0.9, roughness: 0.26 });
const FERRITE = () => pbr('#2c2c32', { metalness: 0.22, roughness: 0.48 });
const FLEX = () => pbr('#d4b04a', { metalness: 0.18, roughness: 0.5 });
const COVER = () => pbr('#c8ced6', { metalness: 0.45, roughness: 0.22 });
const DARK = () => pbr('#2e343c', { metalness: 0.55, roughness: 0.48 });
const HEAD = () => pbr('#9aa4b0', { metalness: 0.88, roughness: 0.28 });
const PCB = () => pbr('#2a4a38', { metalness: 0.1, roughness: 0.55 });

const PLATTER_Y = [-0.12, 0.02, 0.16];
const PIVOT = [-0.58, 0.02, -0.4];
const ARM_YAW = 0.62;
const HEAD_DIST = 0.78;

function alongArm(dist, y) {
  return [
    PIVOT[0] + Math.cos(ARM_YAW) * dist,
    y,
    PIVOT[2] + Math.sin(ARM_YAW) * dist,
  ];
}

export default function hardDisk() {
  const group = new THREE.Group();
  const hx = alongArm(HEAD_DIST, 0)[0];
  const hz = alongArm(HEAD_DIST, 0)[2];

  group.add(
    part(
      'base',
      merge([
        roundedBox(1.78, 0.1, 1.32, 0.07, 3, { pos: [0, -0.34, 0] }),
        // Side walls of the casting — a drive is a tray, not a slab.
        roundedBox(1.78, 0.38, 0.06, 0.02, 2, { pos: [0, -0.12, -0.63] }),
        roundedBox(1.78, 0.38, 0.06, 0.02, 2, { pos: [0, -0.12, 0.63] }),
        roundedBox(0.06, 0.38, 1.32, 0.02, 2, { pos: [-0.86, -0.12, 0] }),
        roundedBox(0.06, 0.38, 1.32, 0.02, 2, { pos: [0.86, -0.12, 0] }),
        cylinder(0.11, 0.11, 0.05, 20, { pos: [0.7, -0.26, -0.48] }),
      ]),
      AL(),
    ),
    part(
      'cover',
      merge([
        roundedBox(1.74, 0.035, 1.28, 0.05, 3, { pos: [0, 0.38, 0] }),
        cylinder(0.76, 0.76, 0.016, 56, { pos: [0.1, 0.355, 0.02] }),
      ]),
      COVER(),
    ),
    part(
      'platters',
      merge([
        ...PLATTER_Y.map((y) => cylinder(0.7, 0.7, 0.016, 80, { pos: [0.1, y, 0.02] })),
        ...[0.28, 0.4, 0.5, 0.58, 0.64].map((r) =>
          torus(r, 0.003, 6, 72, { pos: [0.1, 0.172, 0.02], rot: [Math.PI / 2, 0, 0] }),
        ),
      ]),
      PLATTER(),
    ),
    part(
      'spindle',
      merge([
        cylinder(0.15, 0.15, 0.4, 36, { pos: [0.1, 0.02, 0.02] }),
        cylinder(0.2, 0.2, 0.05, 32, { pos: [0.1, 0.2, 0.02] }),
        cylinder(0.2, 0.2, 0.05, 32, { pos: [0.1, -0.22, 0.02] }),
        ring(6, () => cylinder(0.012, 0.012, 0.02, 8, { pos: [0.16, 0.23, 0.02] })),
      ]),
      HUB(),
    ),
    part(
      'actuator',
      merge([
        cylinder(0.13, 0.13, 0.34, 28, { pos: PIVOT }),
        torus(0.13, 0.018, 12, 28, { pos: [PIVOT[0], 0.2, PIVOT[2]], rot: [Math.PI / 2, 0, 0] }),
        ...PLATTER_Y.map((y) =>
          merge([
            roundedBox(0.2, 0.03, 0.12, 0.008, 2, {
              pos: alongArm(0.12, y),
              rot: [0, -ARM_YAW, 0],
            }),
            box(0.58, 0.018, 0.048, {
              pos: alongArm(0.44, y),
              rot: [0, -ARM_YAW, 0],
            }),
          ]),
        ),
      ]),
      ARM(),
    ),
    part(
      'voice_coil',
      merge([
        torus(0.15, 0.032, 12, 28, {
          pos: [PIVOT[0] - 0.16, 0.02, PIVOT[2] - 0.1],
          rot: [Math.PI / 2, ARM_YAW, 0],
        }),
        box(0.07, 0.2, 0.12, {
          pos: [PIVOT[0] - 0.16, 0.02, PIVOT[2] - 0.1],
          rot: [0, ARM_YAW, 0],
        }),
      ]),
      FERRITE(),
    ),
    part(
      'magnet',
      merge([
        roundedBox(0.3, 0.07, 0.24, 0.02, 2, {
          pos: [PIVOT[0] - 0.16, 0.16, PIVOT[2] - 0.1],
          rot: [0, ARM_YAW, 0],
        }),
        roundedBox(0.3, 0.07, 0.24, 0.02, 2, {
          pos: [PIVOT[0] - 0.16, -0.12, PIVOT[2] - 0.1],
          rot: [0, ARM_YAW, 0],
        }),
      ]),
      FERRITE(),
    ),
    part(
      'heads',
      merge(
        PLATTER_Y.flatMap((y) => [
          roundedBox(0.09, 0.01, 0.038, 0.004, 1, {
            pos: [hx, y + 0.016, hz],
            rot: [0, -ARM_YAW, 0],
          }),
          roundedBox(0.09, 0.01, 0.038, 0.004, 1, {
            pos: [hx, y - 0.016, hz],
            rot: [0, -ARM_YAW, 0],
          }),
        ]),
      ),
      HEAD(),
    ),
    part(
      'flex_cable',
      curve(
        [
          [PIVOT[0] + 0.08, 0.12, PIVOT[2] + 0.08],
          alongArm(0.35, 0.14),
          [hx - 0.04, 0.12, hz],
        ],
        0.01,
        { segments: 18, radial: 6 },
      ),
      FLEX(),
    ),
    part(
      'filter',
      merge([
        cylinder(0.09, 0.09, 0.035, 20, { pos: [0.7, -0.22, -0.48] }),
        torus(0.07, 0.012, 8, 20, { pos: [0.7, -0.2, -0.48], rot: [Math.PI / 2, 0, 0] }),
        roundedBox(0.28, 0.02, 0.18, 0.02, 2, { pos: [0.62, -0.26, 0.48] }),
      ]),
      DARK(),
    ),
    part(
      'ramp',
      merge([
        roundedBox(0.18, 0.1, 0.07, 0.015, 2, { pos: [0.62, 0.02, 0.48], rot: [0, 0.25, 0] }),
        box(0.1, 0.025, 0.04, { pos: [0.54, 0.08, 0.44], rot: [0.35, 0.25, 0] }),
        roundedBox(0.22, 0.04, 0.16, 0.01, 1, { pos: [-0.72, -0.22, 0.42] }),
      ]),
      PCB(),
    ),
  );

  return group;
}
