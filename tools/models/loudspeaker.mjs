// Moving-coil loudspeaker. Cone faces +Z (toward the camera). The identity is
// the paper cone hanging off a corrugated surround, with a voice coil in the
// gap of a fat ferrite magnet behind it. Those three — cone, coil, magnet —
// are derived from one axis, so they cannot drift apart.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, lathe, merge, ring, sphere,
} from '../lib/geo.mjs';

const PAPER = () => pbr('#e2d2b0', { metalness: 0, roughness: 0.68 });
const SURR = () => pbr('#2a2420', { metalness: 0, roughness: 0.88 });
const DUST = () => pbr('#d8d0c0', { metalness: 0, roughness: 0.55 });
const COPPER = () => pbr('#d4843c', { metalness: 0.92, roughness: 0.28 });
const FERRITE = () => pbr('#1a1a1e', { metalness: 0.12, roughness: 0.58 });
const STEEL = () => pbr('#c4cad2', { metalness: 0.92, roughness: 0.28 });
const FRAME = () => pbr('#6a7280', { metalness: 0.7, roughness: 0.42 });
const CLOTH = () => pbr('#c4b090', { metalness: 0, roughness: 0.82 });
const TERM = () => pbr('#d4b070', { metalness: 0.9, roughness: 0.26 });

export default function loudspeaker() {
  const group = new THREE.Group();

  group.add(
    part(
      'cone',
      merge([
        lathe(
          [
            [0.1, 0.1],
            [0.24, 0.02],
            [0.5, -0.24],
            [0.64, -0.38],
            [0.64, -0.4],
            [0.5, -0.26],
            [0.24, 0],
            [0.1, 0.06],
            [0.1, 0.1],
          ],
          96,
        ),
        torus(0.22, 0.005, 8, 48, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.36, 0.005, 8, 56, { pos: [0, -0.1, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.5, 0.005, 8, 64, { pos: [0, -0.24, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      PAPER(),
    ),
    part(
      'surround',
      merge([
        torus(0.68, 0.038, 16, 64, { pos: [0, -0.39, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.68, 0.024, 12, 56, { pos: [0, -0.42, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.68, 0.016, 10, 48, { pos: [0, -0.445, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      SURR(),
    ),
    part(
      'dust_cap',
      lathe(
        [
          [0, 0.16],
          [0.05, 0.155],
          [0.1, 0.1],
          [0.1, 0.07],
          [0, 0.07],
        ],
        48,
      ),
      DUST(),
    ),
    part(
      'voice_coil',
      merge([
        tube(0.09, 0.076, 0.18, 48, { pos: [0, -0.02, 0] }),
        ...Array.from({ length: 12 }, (_, i) =>
          torus(0.094, 0.007, 10, 32, { pos: [0, -0.07 + i * 0.012, 0], rot: [Math.PI / 2, 0, 0] }),
        ),
      ]),
      COPPER(),
    ),
    part(
      'former',
      tube(0.076, 0.068, 0.22, 36, { pos: [0, -0.02, 0] }),
      PAPER(),
    ),
    part(
      'spider',
      merge(
        Array.from({ length: 6 }, (_, i) => {
          const r = 0.12 + i * 0.038;
          return torus(r, 0.007, 10, 48, { pos: [0, -0.16, 0], rot: [Math.PI / 2, 0, 0] });
        }),
      ),
      CLOTH(),
    ),
    part(
      'magnet',
      merge([
        tube(0.36, 0.155, 0.26, 80, { pos: [0, -0.46, 0] }),
        torus(0.255, 0.045, 14, 48, { pos: [0, -0.34, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      FERRITE(),
    ),
    part(
      'pole_piece',
      merge([
        cylinder(0.066, 0.066, 0.32, 40, { pos: [0, -0.4, 0] }),
        cylinder(0.16, 0.16, 0.045, 48, { pos: [0, -0.58, 0] }),
        cylinder(0.38, 0.38, 0.04, 56, { pos: [0, -0.59, 0] }),
      ]),
      STEEL(),
    ),
    part(
      'basket',
      merge([
        torus(0.7, 0.02, 14, 72, { pos: [0, -0.4, 0], rot: [Math.PI / 2, 0, 0] }),
        ...[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * TAU;
          return box(0.05, 0.44, 0.028, {
            pos: [Math.cos(a) * 0.42, -0.58, Math.sin(a) * 0.42],
            rot: [0, -a, 0.52],
          });
        }),
        cylinder(0.4, 0.4, 0.045, 56, { pos: [0, -0.76, 0] }),
      ]),
      FRAME(),
    ),
    part(
      'terminals',
      merge([
        roundedBox(0.09, 0.045, 0.055, 0.01, 2, { pos: [0.14, -0.82, 0] }),
        roundedBox(0.09, 0.045, 0.055, 0.01, 2, { pos: [-0.14, -0.82, 0] }),
        cylinder(0.018, 0.018, 0.07, 12, { pos: [0.14, -0.86, 0] }),
        cylinder(0.018, 0.018, 0.07, 12, { pos: [-0.14, -0.86, 0] }),
        sphere(0.022, 10, { pos: [0.14, -0.9, 0] }),
        sphere(0.022, 10, { pos: [-0.14, -0.9, 0] }),
      ]),
      TERM(),
    ),
  );

  group.rotation.x = Math.PI / 2;
  return group;
}
