// Refrigerator, cut so the sealed refrigeration loop is the readable subject:
// compressor, condenser, expansion, evaporator. Cabinet along +Y, doors face +Z.

import { THREE, part, pbr, box, roundedBox, cylinder, tube, torus, merge, place } from '../lib/geo.mjs';

const W = 1.15;
const H = 2.1;
const D = 1.0;

const STEEL = () => pbr('#c3c9d1', { metalness: 0.85, roughness: 0.3 });
const WHITE = () => pbr('#e8eaee', { metalness: 0.1, roughness: 0.55 });
const FOAM = () => pbr('#dfd6c4', { metalness: 0, roughness: 0.9 });
const COPPER = () => pbr('#c07a45', { metalness: 1, roughness: 0.3 });
const BLACK = () => pbr('#23272d', { metalness: 0.5, roughness: 0.5 });
const COLD = () => pbr('#9fc4d8', { metalness: 0.7, roughness: 0.35 });

/** A serpentine of tube runs joined by return bends — a heat exchanger. */
function serpentine(runs, length, spacing, radius, axis = 'x') {
  const parts = [];
  for (let i = 0; i < runs; i += 1) {
    const offset = (i - (runs - 1) / 2) * spacing;
    parts.push(
      axis === 'x'
        ? cylinder(radius, radius, length, 12, { rot: [0, 0, Math.PI / 2], pos: [0, offset, 0] })
        : cylinder(radius, radius, length, 12, { rot: [Math.PI / 2, 0, 0], pos: [offset, 0, 0] }),
    );
    if (i < runs - 1) {
      const side = i % 2 === 0 ? 1 : -1;
      parts.push(
        torus(spacing / 2, radius, 10, 10, {
          rot: [Math.PI / 2, 0, 0],
          pos: axis === 'x' ? [side * (length / 2), offset + spacing / 2, 0] : [offset + spacing / 2, 0, side * (length / 2)],
        }),
      );
    }
  }
  return merge(parts);
}

export default function refrigerator() {
  const group = new THREE.Group();

  group.add(
    part(
      'cabinet',
      merge([
        box(W, H, 0.06, { pos: [0, 0, -D / 2] }),
        box(0.06, H, D, { pos: [-W / 2, 0, 0] }),
        box(0.06, H, D, { pos: [W / 2, 0, 0] }),
        box(W, 0.06, D, { pos: [0, H / 2, 0] }),
        box(W, 0.06, D, { pos: [0, -H / 2, 0] }),
        box(W, 0.05, D, { pos: [0, 0.34, 0] }),
      ]),
      WHITE(),
    ),
    part(
      'insulation',
      merge([
        box(W - 0.14, H - 0.14, 0.11, { pos: [0, 0, -D / 2 + 0.09] }),
        box(0.11, H - 0.14, D - 0.16, { pos: [-W / 2 + 0.09, 0, 0.02] }),
        box(0.11, H - 0.14, D - 0.16, { pos: [W / 2 - 0.09, 0, 0.02] }),
      ]),
      FOAM(),
    ),
    part(
      'freezer_door',
      merge([
        roundedBox(W - 0.02, 0.66, 0.09, 0.02, 2, { pos: [0, 0.72, D / 2 - 0.02] }),
        roundedBox(0.05, 0.42, 0.05, 0.02, 2, { pos: [W / 2 - 0.16, 0.72, D / 2 + 0.06] }),
      ]),
      STEEL(),
    ),
    part(
      'fridge_door',
      merge([
        roundedBox(W - 0.02, 1.24, 0.09, 0.02, 2, { pos: [0, -0.36, D / 2 - 0.02] }),
        roundedBox(0.05, 0.5, 0.05, 0.02, 2, { pos: [W / 2 - 0.16, -0.2, D / 2 + 0.06] }),
      ]),
      STEEL(),
    ),
    part(
      'door_gasket',
      merge([
        tube(0.5, 0.46, 0.05, 4, { pos: [0, 0.72, D / 2 - 0.07], rot: [Math.PI / 2, 0, 0] }).scale(1.1, 1, 0.66),
        tube(0.62, 0.58, 0.05, 4, { pos: [0, -0.36, D / 2 - 0.07], rot: [Math.PI / 2, 0, 0] }).scale(0.9, 1, 1.0),
      ]),
      pbr('#3b4048', { metalness: 0.1, roughness: 0.85 }),
    ),
    part(
      'compressor',
      merge([
        cylinder(0.24, 0.26, 0.3, 24, { pos: [0.22, -H / 2 + 0.2, -D / 2 + 0.26] }),
        cylinder(0.06, 0.06, 0.1, 12, { pos: [0.22, -H / 2 + 0.38, -D / 2 + 0.26] }),
        box(0.56, 0.04, 0.3, { pos: [0.22, -H / 2 + 0.04, -D / 2 + 0.26] }),
      ]),
      BLACK(),
    ),
    part(
      'condenser',
      serpentine(9, W - 0.2, 0.13, 0.022).translate(0, -0.1, -D / 2 - 0.06),
      COPPER(),
    ),
    part(
      'capillary_tube',
      merge([
        cylinder(0.012, 0.012, 0.6, 8, { rot: [0, 0, Math.PI / 2], pos: [-0.1, -H / 2 + 0.5, -D / 2 - 0.04] }),
        cylinder(0.012, 0.012, 0.75, 8, { pos: [-0.4, -H / 2 + 0.88, -D / 2 - 0.04] }),
        torus(0.05, 0.012, 10, 8, { pos: [-0.4, -H / 2 + 0.5, -D / 2 - 0.04], rot: [0, Math.PI / 2, 0] }),
      ]),
      COPPER(),
    ),
    part(
      'evaporator',
      merge([
        serpentine(6, W - 0.36, 0.1, 0.02).translate(0, 0.62, -D / 2 + 0.2),
        ...Array.from({ length: 16 }, (_, i) =>
          box(W - 0.36, 0.52, 0.008, { pos: [0, 0.62, -D / 2 + 0.2 - 0.06 + i * 0.012] }),
        ),
      ]),
      COLD(),
    ),
    part(
      'evaporator_fan',
      merge([
        cylinder(0.05, 0.05, 0.06, 16, { pos: [0, 0.36, -D / 2 + 0.24], rot: [Math.PI / 2, 0, 0] }),
        ...Array.from({ length: 5 }, (_, i) =>
          place(box(0.17, 0.012, 0.07), { rot: [0, 0, (i / 5) * Math.PI * 2], pos: [0, 0.36, -D / 2 + 0.24] }),
        ),
      ]),
      pbr('#7a828d', { metalness: 0.7, roughness: 0.45 }),
    ),
    part(
      'thermostat',
      merge([
        roundedBox(0.16, 0.12, 0.1, 0.02, 2, { pos: [-W / 2 + 0.22, 0.16, -D / 2 + 0.3] }),
        cylinder(0.008, 0.008, 0.42, 8, { rot: [0, 0, Math.PI / 2], pos: [-W / 2 + 0.44, 0.14, -D / 2 + 0.3] }),
      ]),
      pbr('#4a5058', { metalness: 0.4, roughness: 0.6 }),
    ),
    part(
      'shelves',
      merge([
        box(W - 0.26, 0.02, D - 0.3, { pos: [0, -0.1, 0.05] }),
        box(W - 0.26, 0.02, D - 0.3, { pos: [0, -0.52, 0.05] }),
        box(W - 0.26, 0.02, D - 0.3, { pos: [0, -0.9, 0.05] }),
      ]),
      pbr('#b9d3dd', { metalness: 0.2, roughness: 0.15 }),
    ),
    part(
      'crisper',
      merge([
        box(W - 0.3, 0.3, D - 0.34, { pos: [0, -0.86, 0.06] }),
        box(W - 0.34, 0.02, D - 0.38, { pos: [0, -0.71, 0.06] }),
      ]),
      pbr('#cfe0e8', { metalness: 0.1, roughness: 0.25 }),
    ),
  );

  return group;
}
