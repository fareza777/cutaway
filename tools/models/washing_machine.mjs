// Front-loading washing machine. Drum axis is +Z (out of the door), cabinet
// along +Y. Built so the suspension and the counterweight — the two parts
// nobody expects — are visible once the outer shell is peeled.

import { THREE, part, pbr, box, roundedBox, cylinder, tube, torus, lathe, merge, ring, place } from '../lib/geo.mjs';

const W = 1.3;
const H = 1.45;
const D = 1.25;

const SHELL = () => pbr('#e6e8ec', { metalness: 0.25, roughness: 0.45 });
const STEEL = () => pbr('#b8bec7', { metalness: 1, roughness: 0.28 });
const DRUM = () => pbr('#cdd4dc', { metalness: 1, roughness: 0.22 });
const PLASTIC = () => pbr('#5c636d', { metalness: 0.1, roughness: 0.7 });
const CONCRETE = () => pbr('#9a958c', { metalness: 0, roughness: 0.95 });
const RUBBER = () => pbr('#31353b', { metalness: 0.05, roughness: 0.9 });

export default function washingMachine() {
  const group = new THREE.Group();

  group.add(
    part(
      'cabinet',
      merge([
        box(W, H, 0.05, { pos: [0, 0, -D / 2] }),
        box(0.05, H, D, { pos: [-W / 2, 0, 0] }),
        box(0.05, H, D, { pos: [W / 2, 0, 0] }),
        box(W, 0.05, D, { pos: [0, H / 2, 0] }),
        box(W, 0.05, D, { pos: [0, -H / 2, 0] }),
      ]),
      SHELL(),
    ),
    part(
      'front_panel',
      merge([
        box(W, H, 0.05, { pos: [0, 0, D / 2] }),
        roundedBox(W - 0.1, 0.2, 0.07, 0.03, 2, { pos: [0, H / 2 - 0.16, D / 2 + 0.02] }),
        cylinder(0.07, 0.07, 0.06, 20, { pos: [W / 2 - 0.2, H / 2 - 0.16, D / 2 + 0.06], rot: [Math.PI / 2, 0, 0] }),
      ]),
      SHELL(),
    ),
    part(
      'door',
      merge([
        lathe([[0.3, 0.06], [0.34, 0.03], [0.34, -0.04], [0.3, -0.06]], 40, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, D / 2 + 0.08] }),
        lathe([[0, -0.03], [0.16, -0.02], [0.26, 0.02], [0.29, 0.05]], 40, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, D / 2 + 0.08] }),
      ]),
      pbr('#8fa3b4', { metalness: 0.4, roughness: 0.1 }),
    ),
    part(
      'door_seal',
      torus(0.33, 0.07, 40, 14, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, D / 2 - 0.02] }),
      RUBBER(),
    ),
    part(
      'outer_tub',
      merge([
        tube(0.56, 0.53, D - 0.34, 44, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, -0.02] }),
        lathe([[0.56, 0], [0.5, 0.05], [0.36, 0.07], [0.34, 0.07]], 40, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, D / 2 - 0.2] }),
        lathe([[0.56, 0], [0.5, -0.06], [0.2, -0.08], [0, -0.08]], 40, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, -D / 2 + 0.14] }),
      ]),
      PLASTIC(),
    ),
    part(
      'drum',
      merge([
        tube(0.48, 0.455, D - 0.44, 44, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, -0.02] }),
        lathe([[0.48, 0], [0.42, -0.05], [0.12, -0.07], [0.08, -0.07]], 40, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, -D / 2 + 0.2] }),
        // Perforations read as a band of dimples rather than real holes; real
        // holes would multiply the triangle count for something invisible at
        // any sensible zoom.
        ring(28, () =>
          merge([0.18, -0.02, -0.22].map((z) => cylinder(0.018, 0.018, 0.03, 6, { pos: [0.465, 0, z], rot: [0, 0, Math.PI / 2] }))),
        ).translate(0, -0.06, 0),
        ...[0, 1, 2].map((i) =>
          place(box(0.1, 0.09, D - 0.5), { rot: [0, 0, (i / 3) * Math.PI * 2], pos: [0, -0.06, -0.02] }).translate(0, 0, 0),
        ),
      ]),
      DRUM(),
    ),
    part(
      'counterweight',
      merge([
        box(0.9, 0.26, 0.3, { pos: [0, 0.52, 0.16] }),
        box(0.5, 0.2, 0.26, { pos: [0, -0.62, 0.1] }),
      ]),
      CONCRETE(),
    ),
    part(
      'suspension',
      merge([
        ...[-1, 1].map((s) =>
          merge([
            cylinder(0.05, 0.05, 0.52, 12, { rot: [0, 0, s * 0.42], pos: [s * 0.44, -0.5, 0.02] }),
            cylinder(0.09, 0.09, 0.16, 14, { rot: [0, 0, s * 0.42], pos: [s * 0.52, -0.72, 0.02] }),
          ]),
        ),
        ...[-1, 1].map((s) =>
          merge(
            Array.from({ length: 12 }, (_, i) =>
              torus(0.06, 0.012, 12, 8, { rot: [Math.PI / 2, 0, 0], pos: [s * 0.5, 0.62 - i * 0.028, -0.3] }),
            ),
          ),
        ),
      ]),
      STEEL(),
    ),
    part(
      'motor',
      merge([
        cylinder(0.18, 0.18, 0.22, 24, { rot: [0, 0, Math.PI / 2], pos: [0.34, -0.4, -0.24] }),
        cylinder(0.06, 0.06, 0.3, 14, { rot: [0, 0, Math.PI / 2], pos: [0.2, -0.4, -0.24] }),
      ]),
      pbr('#4d545d', { metalness: 0.85, roughness: 0.45 }),
    ),
    part(
      'drive_belt',
      merge([
        torus(0.4, 0.02, 40, 8, { pos: [0, -0.06, -D / 2 + 0.1] }).scale(1, 1, 0.35),
        cylinder(0.42, 0.42, 0.02, 32, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.06, -D / 2 + 0.1] }),
      ]),
      RUBBER(),
    ),
    part(
      'pump',
      merge([
        cylinder(0.11, 0.11, 0.14, 20, { rot: [Math.PI / 2, 0, 0], pos: [-0.36, -0.6, 0.2] }),
        cylinder(0.05, 0.05, 0.2, 12, { rot: [0, 0, Math.PI / 2], pos: [-0.5, -0.6, 0.2] }),
        cylinder(0.04, 0.04, 0.3, 12, { pos: [-0.36, -0.72, 0.34], rot: [0.6, 0, 0] }),
      ]),
      PLASTIC(),
    ),
    part(
      'detergent_drawer',
      merge([
        box(0.42, 0.16, 0.3, { pos: [-W / 2 + 0.3, H / 2 - 0.16, D / 2 - 0.12] }),
        box(0.44, 0.03, 0.02, { pos: [-W / 2 + 0.3, H / 2 - 0.16, D / 2 + 0.05] }),
      ]),
      pbr('#d8dde3', { metalness: 0.05, roughness: 0.6 }),
    ),
    part(
      'heater',
      merge([
        cylinder(0.022, 0.022, 0.62, 10, { rot: [0, 0, Math.PI / 2], pos: [0, -0.56, -0.05] }),
        cylinder(0.022, 0.022, 0.62, 10, { rot: [0, 0, Math.PI / 2], pos: [0, -0.56, 0.09] }),
        torus(0.07, 0.022, 10, 8, { pos: [0.31, -0.56, 0.02], rot: [Math.PI / 2, 0, 0] }),
      ]),
      pbr('#8a6a4f', { metalness: 0.8, roughness: 0.5, emissive: '#ff5a1e', emissiveIntensity: 0.2 }),
    ),
  );

  return group;
}
