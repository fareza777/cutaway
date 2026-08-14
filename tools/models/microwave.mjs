// Microwave oven, cut so the high-voltage side and the waveguide are the
// subject. Cavity opens toward +Z; the electronics bay is the right-hand third,
// which is exactly how a real one is laid out.

import { THREE, part, pbr, box, roundedBox, cylinder, tube, torus, merge, ring, place } from '../lib/geo.mjs';

const W = 1.5;
const H = 0.86;
const D = 1.05;
/** The cavity occupies the left two-thirds; electronics live to the right. */
const CAV_W = 0.92;
const CAV_X = -(W - CAV_W) / 2 + 0.02;

const CASE = () => pbr('#d7dae0', { metalness: 0.5, roughness: 0.42 });
const CAVITY = () => pbr('#cfd6dd', { metalness: 0.9, roughness: 0.18 });
const DARK = () => pbr('#2a2e34', { metalness: 0.4, roughness: 0.6 });
const COPPER = () => pbr('#c07a45', { metalness: 1, roughness: 0.32 });
const CERAMIC = () => pbr('#e9e2d2', { metalness: 0.05, roughness: 0.5 });
const GLASS = () => pbr('#b9cddb', { metalness: 0.2, roughness: 0.08 });

export default function microwave() {
  const group = new THREE.Group();

  group.add(
    part(
      'cabinet',
      merge([
        box(W, 0.03, D, { pos: [0, H / 2, 0] }),
        box(W, 0.03, D, { pos: [0, -H / 2, 0] }),
        box(0.03, H, D, { pos: [-W / 2, 0, 0] }),
        box(0.03, H, D, { pos: [W / 2, 0, 0] }),
        box(W, H, 0.03, { pos: [0, 0, -D / 2] }),
        // Ventilation louvres on the right flank, over the electronics bay.
        ...Array.from({ length: 7 }, (_, i) => box(0.02, 0.02, 0.4, { pos: [W / 2 - 0.01, 0.24 - i * 0.08, 0] })),
      ]),
      CASE(),
    ),
    part(
      'cavity',
      merge([
        box(CAV_W, 0.02, D - 0.12, { pos: [CAV_X, H / 2 - 0.07, -0.02] }),
        box(CAV_W, 0.02, D - 0.12, { pos: [CAV_X, -H / 2 + 0.07, -0.02] }),
        box(0.02, H - 0.14, D - 0.12, { pos: [CAV_X - CAV_W / 2, 0, -0.02] }),
        box(0.02, H - 0.14, D - 0.12, { pos: [CAV_X + CAV_W / 2, 0, -0.02] }),
        box(CAV_W, H - 0.14, 0.02, { pos: [CAV_X, 0, -D / 2 + 0.06] }),
      ]),
      CAVITY(),
    ),
    part(
      'door',
      merge([
        roundedBox(CAV_W + 0.14, H - 0.04, 0.06, 0.02, 2, { pos: [CAV_X, 0, D / 2 + 0.03] }),
        roundedBox(0.06, H - 0.2, 0.05, 0.02, 2, { pos: [CAV_X + CAV_W / 2 + 0.02, 0, D / 2 + 0.08] }),
      ]),
      CASE(),
    ),
    part(
      'door_screen',
      merge([
        box(CAV_W - 0.12, H - 0.22, 0.012, { pos: [CAV_X, 0, D / 2 + 0.055] }),
        // The perforated shield, drawn as a coarse grid — the holes are the
        // point of the part, so they have to be visible geometry.
        ...Array.from({ length: 9 }, (_, r) =>
          merge(
            Array.from({ length: 15 }, (_, c) =>
              box(0.028, 0.028, 0.016, {
                pos: [CAV_X - (CAV_W - 0.2) / 2 + (c * (CAV_W - 0.2)) / 14, (H - 0.3) / 2 - (r * (H - 0.3)) / 8, D / 2 + 0.062],
              }),
            ),
          ),
        ),
      ]),
      pbr('#8d939c', { metalness: 0.9, roughness: 0.35 }),
    ),
    part(
      'door_interlocks',
      merge([
        ...[0.1, -0.02, -0.14].map((y) =>
          merge([
            box(0.09, 0.05, 0.05, { pos: [CAV_X + CAV_W / 2 + 0.09, y, D / 2 - 0.1] }),
            box(0.03, 0.012, 0.05, { pos: [CAV_X + CAV_W / 2 + 0.14, y, D / 2 - 0.1] }),
          ]),
        ),
      ]),
      pbr('#7d4a4a', { metalness: 0.2, roughness: 0.7 }),
    ),
    part(
      'magnetron',
      merge([
        cylinder(0.14, 0.14, 0.2, 24, { rot: [Math.PI / 2, 0, 0], pos: [0.34, 0.14, -0.16] }),
        // Cooling fins, the most recognisable thing about a magnetron.
        ...Array.from({ length: 9 }, (_, i) =>
          box(0.34, 0.34, 0.012, { pos: [0.34, 0.14, -0.28 + i * 0.028] }),
        ),
        cylinder(0.05, 0.05, 0.12, 14, { pos: [0.34, 0.3, -0.16] }),
        cylinder(0.09, 0.09, 0.07, 16, { pos: [0.34, 0.02, -0.16] }),
      ]),
      pbr('#9aa1a9', { metalness: 0.95, roughness: 0.34 }),
    ),
    part(
      'waveguide',
      merge([
        box(0.2, 0.11, 0.03, { pos: [0.16, 0.24, -0.16] }),
        box(0.2, 0.11, 0.03, { pos: [0.16, 0.13, -0.16] }),
        box(0.2, 0.015, 0.03, { pos: [0.16, 0.185, -0.175] }),
        box(0.02, 0.11, 0.14, { pos: [0.06, 0.185, -0.16] }),
      ]),
      CAVITY(),
    ),
    part(
      'waveguide_cover',
      box(0.17, 0.13, 0.006, { pos: [CAV_X + CAV_W / 2 - 0.06, 0.185, -0.16], rot: [0, Math.PI / 2, 0] }),
      CERAMIC(),
    ),
    part(
      'stirrer',
      merge([
        cylinder(0.02, 0.02, 0.05, 10, { pos: [CAV_X + 0.1, H / 2 - 0.11, -0.02] }),
        ...Array.from({ length: 4 }, (_, i) =>
          place(box(0.22, 0.008, 0.06), { rot: [0.3, (i / 4) * Math.PI * 2, 0], pos: [CAV_X + 0.1, H / 2 - 0.13, -0.02] }),
        ),
      ]),
      pbr('#b6bcc4', { metalness: 0.9, roughness: 0.3 }),
    ),
    part(
      'turntable',
      merge([
        cylinder(0.34, 0.34, 0.014, 40, { pos: [CAV_X, -H / 2 + 0.12, -0.02] }),
        torus(0.2, 0.018, 28, 8, { rot: [Math.PI / 2, 0, 0], pos: [CAV_X, -H / 2 + 0.1, -0.02] }),
        ring(3, () => cylinder(0.03, 0.03, 0.03, 10, { pos: [0.2, 0, 0] })).translate(CAV_X, -H / 2 + 0.1, -0.02),
        cylinder(0.03, 0.03, 0.06, 12, { pos: [CAV_X, -H / 2 + 0.1, -0.02] }),
      ]),
      GLASS(),
    ),
    part(
      'turntable_motor',
      merge([
        box(0.14, 0.09, 0.14, { pos: [CAV_X, -H / 2 + 0.02, -0.02] }),
        cylinder(0.015, 0.015, 0.08, 10, { pos: [CAV_X, -H / 2 + 0.09, -0.02] }),
      ]),
      DARK(),
    ),
    part(
      'transformer',
      merge([
        box(0.22, 0.24, 0.2, { pos: [0.4, -0.16, 0.14] }),
        ...Array.from({ length: 5 }, (_, i) => box(0.24, 0.04, 0.22, { pos: [0.4, -0.26 + i * 0.05, 0.14] })),
        cylinder(0.02, 0.02, 0.16, 8, { rot: [0, 0, Math.PI / 2], pos: [0.26, -0.06, 0.14] }),
      ]),
      pbr('#4a4f57', { metalness: 0.85, roughness: 0.5 }),
    ),
    part(
      'capacitor_diode',
      merge([
        cylinder(0.07, 0.07, 0.18, 20, { rot: [0, 0, Math.PI / 2], pos: [0.36, 0.06, 0.34] }),
        cylinder(0.018, 0.018, 0.12, 10, { rot: [0, 0, Math.PI / 2], pos: [0.36, -0.06, 0.34] }),
        cylinder(0.012, 0.012, 0.14, 8, { pos: [0.46, 0.0, 0.34] }),
      ]),
      COPPER(),
    ),
    part(
      'cooling_fan',
      merge([
        cylinder(0.05, 0.05, 0.05, 14, { rot: [0, 0, Math.PI / 2], pos: [0.56, 0.14, -0.3] }),
        ...Array.from({ length: 7 }, (_, i) =>
          place(box(0.02, 0.16, 0.07), { rot: [(i / 7) * Math.PI * 2, 0, 0], pos: [0.56, 0.14, -0.3] }),
        ),
      ]),
      DARK(),
    ),
    part(
      'control_panel',
      merge([
        box(0.42, H - 0.06, 0.04, { pos: [W / 2 - 0.24, 0, D / 2 + 0.01] }),
        box(0.3, 0.12, 0.02, { pos: [W / 2 - 0.24, 0.24, D / 2 + 0.035] }),
        ...Array.from({ length: 9 }, (_, i) =>
          box(0.07, 0.05, 0.02, { pos: [W / 2 - 0.36 + (i % 3) * 0.12, 0.02 - Math.floor(i / 3) * 0.09, D / 2 + 0.035] }),
        ),
      ]),
      DARK(),
    ),
  );

  return group;
}
