// Split air conditioner: indoor unit above, outdoor unit below, joined by the
// refrigerant lines. Showing both in one scene is the point — the reason half
// the machine is bolted to an outside wall only makes sense when you can see
// that the two halves are one sealed loop.

import { THREE, part, pbr, box, roundedBox, cylinder, tube, torus, merge, place } from '../lib/geo.mjs';

const IN_Y = 1.15;
const OUT_Y = -0.85;

const CASE = () => pbr('#eef0f3', { metalness: 0.15, roughness: 0.5 });
const OUTDOOR = () => pbr('#c9ccd1', { metalness: 0.4, roughness: 0.55 });
const FIN = () => pbr('#b9c6cf', { metalness: 0.85, roughness: 0.35 });
const COPPER = () => pbr('#c07a45', { metalness: 1, roughness: 0.3 });
const DARK = () => pbr('#33383f', { metalness: 0.5, roughness: 0.55 });
const COLD = () => pbr('#a8cfe2', { metalness: 0.7, roughness: 0.3 });

/** A finned coil: a stack of thin plates threaded by tube runs. */
function finnedCoil(width, height, depth, fins, runs) {
  const plates = Array.from({ length: fins }, (_, i) =>
    box(0.006, height, depth, { pos: [-width / 2 + (i * width) / (fins - 1), 0, 0] }),
  );
  const tubes = Array.from({ length: runs }, (_, i) =>
    cylinder(0.018, 0.018, width, 10, {
      rot: [0, 0, Math.PI / 2],
      pos: [0, -height / 2 + ((i + 0.5) * height) / runs, 0],
    }),
  );
  return merge([...plates, ...tubes]);
}

export default function airConditioner() {
  const group = new THREE.Group();

  group.add(
    // ---------------------------------------------------------- indoor unit
    part(
      'indoor_housing',
      merge([
        roundedBox(1.7, 0.44, 0.42, 0.12, 3, { pos: [0, IN_Y, 0] }),
        box(1.5, 0.03, 0.2, { pos: [0, IN_Y - 0.19, 0.14] }),
      ]),
      CASE(),
    ),
    part(
      'air_filter',
      merge([
        box(1.44, 0.3, 0.012, { pos: [0, IN_Y + 0.08, 0.19] }),
        ...Array.from({ length: 22 }, (_, i) => box(0.012, 0.3, 0.02, { pos: [-0.7 + i * 0.066, IN_Y + 0.08, 0.19] })),
      ]),
      pbr('#dfe4ea', { metalness: 0.05, roughness: 0.75 }),
    ),
    part(
      'evaporator_coil',
      finnedCoil(1.34, 0.3, 0.12, 26, 4).translate(0, IN_Y + 0.06, 0.02),
      COLD(),
    ),
    part(
      'blower',
      merge([
        cylinder(0.13, 0.13, 1.28, 26, { rot: [0, 0, Math.PI / 2], pos: [0, IN_Y - 0.04, -0.05] }),
        // A cross-flow drum: many small forward-curved blades along its length.
        ...Array.from({ length: 24 }, (_, i) =>
          place(box(0.05, 0.03, 1.3), { rot: [0, 0, (i / 24) * Math.PI * 2] })
            .rotateY(Math.PI / 2)
            .translate(0, IN_Y - 0.04, -0.05),
        ),
      ]),
      pbr('#8f959d', { metalness: 0.6, roughness: 0.5 }),
    ),
    part(
      'louver',
      merge([
        box(1.5, 0.05, 0.16, { pos: [0, IN_Y - 0.2, 0.12], rot: [0.5, 0, 0] }),
        box(1.5, 0.03, 0.1, { pos: [0, IN_Y - 0.14, 0.16], rot: [0.8, 0, 0] }),
      ]),
      CASE(),
    ),
    part(
      'drain_pan',
      merge([
        box(1.4, 0.02, 0.16, { pos: [0, IN_Y - 0.12, 0.02] }),
        box(1.4, 0.05, 0.012, { pos: [0, IN_Y - 0.1, 0.1] }),
        cylinder(0.025, 0.025, 0.5, 10, { rot: [0, 0, Math.PI / 2], pos: [-0.95, IN_Y - 0.12, 0.02] }),
      ]),
      pbr('#cdd3da', { metalness: 0.05, roughness: 0.7 }),
    ),
    // -------------------------------------------------------- the link
    part(
      'refrigerant_lines',
      merge([
        // The cold return line, inside its foam lagging — the content calls out
        // that only one pipe is insulated, so the model has to show it.
        cylinder(0.035, 0.035, 1.5, 12, { pos: [-0.78, IN_Y - 0.85, -0.12] }),
        tube(0.058, 0.037, 1.42, 14, { rot: [Math.PI / 2, 0, 0], pos: [-0.78, IN_Y - 0.85, -0.12] }),
        cylinder(0.022, 0.022, 1.5, 12, { pos: [-0.68, IN_Y - 0.85, -0.12] }),
        torus(0.1, 0.035, 12, 8, { rot: [0, Math.PI / 2, 0], pos: [-0.68, OUT_Y + 0.5, -0.12] }),
        cylinder(0.035, 0.035, 0.2, 12, { rot: [0, 0, Math.PI / 2], pos: [-0.62, OUT_Y + 0.5, -0.12] }),
      ]),
      COPPER(),
    ),
    // --------------------------------------------------------- outdoor unit
    part(
      'outdoor_casing',
      merge([
        box(1.5, 0.03, 0.72, { pos: [0, OUT_Y + 0.42, 0] }),
        box(1.5, 0.03, 0.72, { pos: [0, OUT_Y - 0.42, 0] }),
        box(0.03, 0.84, 0.72, { pos: [0.75, OUT_Y, 0] }),
        box(1.5, 0.84, 0.03, { pos: [0, OUT_Y, -0.36] }),
        // The grille the fan blows through.
        ...Array.from({ length: 5 }, (_, i) => torus(0.1 + i * 0.07, 0.014, 28, 6, { pos: [0.2, OUT_Y, 0.36] })),
      ]),
      OUTDOOR(),
    ),
    part(
      'condenser_coil',
      merge([
        finnedCoil(1.4, 0.72, 0.1, 30, 5).translate(0, OUT_Y, -0.3),
        finnedCoil(0.66, 0.72, 0.1, 16, 5).rotateY(Math.PI / 2).translate(-0.72, OUT_Y, 0),
      ]),
      FIN(),
    ),
    part(
      'condenser_fan',
      merge([
        cylinder(0.07, 0.07, 0.08, 16, { rot: [Math.PI / 2, 0, 0], pos: [0.2, OUT_Y, 0.26] }),
        ...Array.from({ length: 3 }, (_, i) =>
          place(box(0.44, 0.02, 0.13), { rot: [0.35, 0, (i / 3) * Math.PI * 2] })
            .translate(0.2, OUT_Y, 0.26),
        ),
      ]),
      DARK(),
    ),
    part(
      'compressor',
      merge([
        cylinder(0.2, 0.2, 0.46, 26, { pos: [-0.34, OUT_Y - 0.12, 0.06] }),
        cylinder(0.05, 0.05, 0.1, 12, { pos: [-0.34, OUT_Y + 0.16, 0.06] }),
        box(0.5, 0.03, 0.34, { pos: [-0.34, OUT_Y - 0.37, 0.06] }),
      ]),
      DARK(),
    ),
    part(
      'expansion_valve',
      merge([
        box(0.11, 0.13, 0.11, { pos: [-0.62, OUT_Y + 0.16, 0.16] }),
        cylinder(0.016, 0.016, 0.22, 8, { rot: [0, 0, Math.PI / 2], pos: [-0.74, OUT_Y + 0.16, 0.16] }),
        cylinder(0.03, 0.03, 0.09, 10, { pos: [-0.62, OUT_Y + 0.27, 0.16] }),
      ]),
      COPPER(),
    ),
    part(
      'reversing_valve',
      merge([
        cylinder(0.055, 0.055, 0.3, 16, { rot: [0, 0, Math.PI / 2], pos: [-0.1, OUT_Y + 0.3, 0.1] }),
        cylinder(0.025, 0.025, 0.12, 10, { pos: [-0.1, OUT_Y + 0.38, 0.1] }),
        ...[-0.08, 0.02, 0.12].map((x) => cylinder(0.018, 0.018, 0.14, 8, { pos: [x, OUT_Y + 0.22, 0.1] })),
      ]),
      COPPER(),
    ),
    part(
      'service_valves',
      merge([
        ...[0, 0.11].map((dy) =>
          merge([
            box(0.08, 0.08, 0.08, { pos: [0.62, OUT_Y - 0.16 + dy, 0.14] }),
            cylinder(0.02, 0.02, 0.09, 10, { pos: [0.62, OUT_Y - 0.1 + dy, 0.14] }),
          ]),
        ),
      ]),
      pbr('#a5713f', { metalness: 1, roughness: 0.4 }),
    ),
  );

  return group;
}
