// SLR camera. Optical axis along +Z, pentaprism standing +Y. The silhouette is
// a box with a barrel and a pentagonal hump — that hump is why this is a camera
// that you look down into, not a phone. Glass elements use resting opacity.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, lathe, merge, ring,
  sphere,
} from '../lib/geo.mjs';

const BODY = () => pbr('#5c646e', { metalness: 0.32, roughness: 0.44 });
const GRIP = () => pbr('#3a4048', { metalness: 0.08, roughness: 0.78 });
const CHROME = () => pbr('#e0e6ec', { metalness: 1, roughness: 0.12 });
const GLASS = () => pbr('#e8f2f8', { metalness: 0.12, roughness: 0.04 });
const BRASS = () => pbr('#a88858', { metalness: 0.75, roughness: 0.36 });
const SHUTTER = () => pbr('#4a2a1a', { metalness: 0.22, roughness: 0.55 });
const SENSOR = () => pbr('#1a3850', { metalness: 0.35, roughness: 0.18, emissive: '#1a4060', emissiveIntensity: 0.18 });
const MIRROR = () => pbr('#d0d8e0', { metalness: 1, roughness: 0.06 });
const BLADE = () => pbr('#5a6068', { metalness: 0.65, roughness: 0.36 });
export default function camera() {
  const group = new THREE.Group();

  group.add(
    part(
      'body',
      merge([
        roundedBox(1.32, 0.74, 0.58, 0.07, 4, { pos: [0, 0, -0.12] }),
        roundedBox(0.3, 0.7, 0.46, 0.09, 4, { pos: [-0.58, -0.04, 0.1] }),
        roundedBox(1.12, 0.045, 0.44, 0.012, 2, { pos: [0, 0.39, -0.12] }),
        // Leatherette patch on the front, a shut-line the light can catch.
        roundedBox(0.55, 0.42, 0.02, 0.02, 2, { pos: [0.28, -0.04, 0.18] }),
      ]),
      BODY(),
    ),
    part(
      'lens_barrel',
      merge([
        tube(0.36, 0.29, 0.2, 56, { pos: [0.08, 0, 0.42], rot: [Math.PI / 2, 0, 0] }),
        tube(0.34, 0.27, 0.3, 56, { pos: [0.08, 0, 0.66], rot: [Math.PI / 2, 0, 0] }),
        tube(0.38, 0.3, 0.08, 56, { pos: [0.08, 0, 0.84], rot: [Math.PI / 2, 0, 0] }),
        torus(0.36, 0.018, 12, 48, { pos: [0.08, 0, 0.52] }),
        torus(0.34, 0.016, 12, 44, { pos: [0.08, 0, 0.72] }),
        torus(0.38, 0.012, 10, 48, { pos: [0.08, 0, 0.88] }),
        ring(24, () => box(0.035, 0.01, 0.028, { pos: [0.36, 0, 0.84] })),
      ]),
      CHROME(),
    ),
    part(
      'front_element',
      sphere(0.3, 32, { pos: [0.08, 0, 0.96] }).scale(1, 1, 0.38),
      GLASS(),
    ),
    part(
      'lens_group',
      merge([
        sphere(0.24, 24, { pos: [0.08, 0, 0.58] }).scale(1, 1, 0.42),
        sphere(0.22, 22, { pos: [0.08, 0, 0.4] }).scale(1, 1, 0.36),
      ]),
      GLASS(),
    ),
    part(
      'aperture',
      merge(
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU;
          return box(0.13, 0.038, 0.01, {
            pos: [0.08 + Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.5],
            rot: [0, 0, a + 0.45],
          });
        }),
      ),
      BLADE(),
    ),
    part(
      'mirror',
      box(0.44, 0.3, 0.012, { pos: [0.08, -0.02, 0.08], rot: [0.7, 0, 0] }),
      MIRROR(),
    ),
    part(
      'shutter',
      merge([
        box(0.46, 0.17, 0.008, { pos: [0.08, 0.12, -0.12] }),
        box(0.46, 0.17, 0.008, { pos: [0.08, -0.12, -0.12] }),
      ]),
      SHUTTER(),
    ),
    part(
      'sensor',
      roundedBox(0.4, 0.28, 0.022, 0.01, 1, { pos: [0.08, 0, -0.28] }),
      SENSOR(),
    ),
    part(
      'pentaprism',
      merge([
        lathe(
          [
            [0, 0.38],
            [0.26, 0.38],
            [0.22, 0.62],
            [0.1, 0.76],
            [0, 0.76],
          ],
          5,
          { pos: [0.08, 0.24, -0.08] },
        ),
        cylinder(0.1, 0.1, 0.09, 20, { pos: [0.08, 0.4, -0.34], rot: [Math.PI / 2, 0, 0] }),
        roundedBox(0.18, 0.04, 0.12, 0.008, 1, { pos: [0.08, 0.44, -0.08] }),
        roundedBox(0.16, 0.022, 0.08, 0.004, 1, { pos: [0.08, 0.78, -0.08] }),
        box(0.11, 0.01, 0.035, { pos: [0.08, 0.8, -0.08] }),
      ]),
      BODY(),
    ),
    part(
      'viewfinder',
      merge([
        cylinder(0.075, 0.1, 0.07, 20, { pos: [0.08, 0.4, -0.42], rot: [Math.PI / 2, 0, 0] }),
        cylinder(0.055, 0.055, 0.022, 20, { pos: [0.08, 0.4, -0.46], rot: [Math.PI / 2, 0, 0] }),
      ]),
      CHROME(),
    ),
    part(
      'mount',
      merge([
        torus(0.32, 0.022, 12, 40, { pos: [0.08, 0, 0.28] }),
        ring(3, () => box(0.07, 0.022, 0.045, { pos: [0.32, 0, 0.28] })),
      ]),
      BRASS(),
    ),
    part(
      'shutter_dial',
      merge([
        cylinder(0.09, 0.09, 0.045, 24, { pos: [0.44, 0.42, -0.04] }),
        ring(10, () => box(0.022, 0.014, 0.032, { pos: [0.51, 0.42, -0.04] })),
        cylinder(0.045, 0.045, 0.05, 16, { pos: [-0.42, 0.42, -0.04] }),
      ]),
      CHROME(),
    ),
  );

  return group;
}
