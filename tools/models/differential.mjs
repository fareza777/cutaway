// Open differential. Ring-gear axis along +X (the axles), pinion along +Z.
// What names it is the spider: two bevels on a cross-pin inside a carrier,
// meshed with two side gears. That one assembly lets the wheels turn at
// different speeds without the engine noticing.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, merge, ring, place,
  sphere,
} from '../lib/geo.mjs';

const STEEL = () => pbr('#c4ccd4', { metalness: 0.9, roughness: 0.3 });
const CASE = () => pbr('#b0b8c2', { metalness: 0.78, roughness: 0.36 });
const TEETH = () => pbr('#eef2f6', { metalness: 0.96, roughness: 0.18 });
const IRON = () => pbr('#8a8078', { metalness: 0.65, roughness: 0.48 });
const SHAFT = () => pbr('#d8dee4', { metalness: 1, roughness: 0.16 });

function bevel(hub, rim, width, count, pos, rot) {
  const cone = cylinder(rim, hub, width, 36, { pos, rot });
  const teeth = ring(count, () =>
    box((rim - hub) * 0.9, width * 0.9, 0.035, {
      pos: [(hub + rim) / 2, 0, 0],
    }),
  );
  teeth.rotateX(rot?.[0] ?? 0);
  teeth.rotateZ(rot?.[2] ?? 0);
  teeth.translate(pos[0], pos[1], pos[2]);
  return merge([cone, teeth]);
}

export default function differential() {
  const group = new THREE.Group();

  group.add(
    part(
      'housing',
      merge([
        // Banjo: a fat torus with axle tubes.
        torus(0.55, 0.28, 18, 36, { rot: [Math.PI / 2, 0, 0] }),
        place(tube(0.18, 0.1, 0.7, 28), { rot: [0, 0, Math.PI / 2], pos: [0.85, 0, 0] }),
        place(tube(0.18, 0.1, 0.7, 28), { rot: [0, 0, Math.PI / 2], pos: [-0.85, 0, 0] }),
        tube(0.22, 0.14, 0.35, 24, { pos: [0, 0, 0.7], rot: [Math.PI / 2, 0, 0] }),
        ring(8, () => cylinder(0.02, 0.02, 0.06, 8, { pos: [0.78, 0, 0] })),
      ]),
      CASE(),
    ),
    part(
      'ring_gear',
      merge([
        torus(0.52, 0.08, 12, 48, { rot: [Math.PI / 2, 0, 0] }),
        ring(36, () => box(0.12, 0.14, 0.04, { pos: [0.52, 0, 0] })),
        cylinder(0.28, 0.28, 0.08, 32, { pos: [0, 0, -0.06] }),
      ]),
      TEETH(),
    ),
    part(
      'pinion',
      merge([
        bevel(0.08, 0.18, 0.16, 12, [0, 0, 0.42], [Math.PI / 2, 0, 0]),
        cylinder(0.06, 0.06, 0.55, 16, { pos: [0, 0, 0.72], rot: [Math.PI / 2, 0, 0] }),
      ]),
      TEETH(),
    ),
    part(
      'carrier',
      merge([
        tube(0.27, 0.2, 0.16, 36),
        place(cylinder(0.04, 0.04, 0.52, 12), { rot: [0, 0, Math.PI / 2] }),
        place(cylinder(0.04, 0.04, 0.52, 12), { rot: [Math.PI / 2, 0, 0] }),
      ]),
      IRON(),
    ),
    part(
      'spider_gears',
      merge([
        bevel(0.055, 0.145, 0.11, 12, [0, 0.155, 0], [0, 0, 0]),
        bevel(0.055, 0.145, 0.11, 12, [0, -0.155, 0], [Math.PI, 0, 0]),
      ]),
      TEETH(),
    ),
    part(
      'side_gears',
      merge([
        bevel(0.06, 0.14, 0.1, 12, [0.16, 0, 0], [0, 0, -Math.PI / 2]),
        bevel(0.06, 0.14, 0.1, 12, [-0.16, 0, 0], [0, 0, Math.PI / 2]),
      ]),
      TEETH(),
    ),
    part(
      'left_axle',
      merge([
        place(cylinder(0.055, 0.055, 1.1, 16), { rot: [0, 0, Math.PI / 2], pos: [0.7, 0, 0] }),
        place(cylinder(0.09, 0.09, 0.08, 16), { rot: [0, 0, Math.PI / 2], pos: [1.2, 0, 0] }),
      ]),
      SHAFT(),
    ),
    part(
      'right_axle',
      merge([
        place(cylinder(0.055, 0.055, 1.1, 16), { rot: [0, 0, Math.PI / 2], pos: [-0.7, 0, 0] }),
        place(cylinder(0.09, 0.09, 0.08, 16), { rot: [0, 0, Math.PI / 2], pos: [-1.2, 0, 0] }),
      ]),
      SHAFT(),
    ),
    part(
      'pinion_shaft',
      merge([
        cylinder(0.06, 0.06, 0.4, 16, { pos: [0, 0, 0.95], rot: [Math.PI / 2, 0, 0] }),
        cylinder(0.1, 0.1, 0.06, 16, { pos: [0, 0, 1.12], rot: [Math.PI / 2, 0, 0] }),
        torus(0.09, 0.02, 10, 16, { pos: [0, 0, 0.85], rot: [0, 0, 0] }),
      ]),
      SHAFT(),
    ),
    part(
      'bearings',
      merge([
        torus(0.1, 0.024, 10, 16, { pos: [0.55, 0, 0], rot: [0, Math.PI / 2, 0] }),
        torus(0.1, 0.024, 10, 16, { pos: [-0.55, 0, 0], rot: [0, Math.PI / 2, 0] }),
        torus(0.1, 0.024, 10, 16, { pos: [0, 0, 0.55] }),
      ]),
      STEEL(),
    ),
  );

  return group;
}
