// High-bypass turbofan. Built along +Y (intake at the top) and laid down onto
// the Z axis by the group transform, so the profile helpers stay readable.

import { THREE, part, pbr, box, cylinder, tube, lathe, merge, ring, place, sphere } from '../lib/geo.mjs';

const TITANIUM = () => pbr('#b9c0c8', { metalness: 1, roughness: 0.3 });
const STEEL = () => pbr('#8d949c', { metalness: 1, roughness: 0.4 });
const NICKEL = () => pbr('#d8cbb4', { metalness: 1, roughness: 0.36 });
const HOT = () => pbr('#8a5a48', { metalness: 0.85, roughness: 0.55, emissive: '#ff5a1e', emissiveIntensity: 0.35 });
const COWL = () => pbr('#c2c9d2', { metalness: 0.45, roughness: 0.3 });
const CORE = () => pbr('#4c535c', { metalness: 0.9, roughness: 0.45 });

/** One bladed stage: a hub disc plus `count` twisted plates. */
function stage(y, hubR, tipR, count, { thick = 0.018, chord = 0.09, twist = 0.5, disc = 0.05 } = {}) {
  const len = tipR - hubR;
  const blades = ring(count, () =>
    place(box(len, thick, chord), { rot: [twist, 0, 0], pos: [hubR + len / 2, 0, 0] }),
  );
  return merge([cylinder(hubR, hubR, disc, 28, { pos: [0, y, 0] }), blades.translate(0, y, 0)]);
}

function spool(from, to, count, hubR, tipR, blades, twist) {
  const stages = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const y = from + (to - from) * t;
    // Compressor annulus narrows towards the back as the air is squeezed.
    const tip = tipR[0] + (tipR[1] - tipR[0]) * t;
    const hub = hubR[0] + (hubR[1] - hubR[0]) * t;
    stages.push(stage(y, hub, tip, blades, { twist: twist - t * 0.12, chord: 0.075 - t * 0.02 }));
  }
  return merge(stages);
}

export default function turbofan() {
  const group = new THREE.Group();
  // Intake forward along -Z once laid down; the viewer frames it side-on.
  group.rotation.x = -Math.PI / 2;

  group.add(
    part(
      'nacelle',
      lathe(
        [
          [1.02, 1.4],
          [1.15, 1.46],
          [1.24, 1.3],
          [1.27, 0.6],
          [1.22, -0.3],
          [1.06, -1.1],
          [1.0, -1.1],
          [1.02, -0.3],
          [1.06, 0.6],
          [1.04, 1.3],
          [1.02, 1.4],
        ],
        56,
      ),
      COWL(),
    ),
    part(
      'pylon',
      merge([
        box(0.15, 1.1, 0.46, { pos: [0, 0.2, 1.44] }),
        box(0.22, 1.35, 0.16, { pos: [0, 0.2, 1.72] }),
      ]),
      COWL(),
    ),
    part('spinner', merge([lathe([[0, 0.34], [0.12, 0.24], [0.2, 0.08], [0.24, -0.02], [0, -0.02]], 32, { pos: [0, 1.22, 0] })]), pbr('#20252b', { metalness: 0.7, roughness: 0.35 })),
    part('fan', stage(1.06, 0.26, 0.94, 20, { thick: 0.028, chord: 0.2, twist: 0.62, disc: 0.14 }), TITANIUM()),
    part('fan_case', tube(1.02, 0.96, 0.44, 48, { pos: [0, 1.02, 0] }), STEEL()),
    part('lp_compressor', spool(0.72, 0.36, 4, [0.2, 0.24], [0.5, 0.42], 26, 0.5), TITANIUM()),
    part('hp_compressor', spool(0.26, -0.06, 6, [0.2, 0.22], [0.38, 0.28], 32, 0.46), STEEL()),
    part(
      'combustor',
      merge([
        tube(0.4, 0.22, 0.4, 44, { pos: [0, -0.28, 0] }),
        ring(14, () => cylinder(0.032, 0.045, 0.1, 10, { pos: [0.31, -0.06, 0] })),
      ]),
      HOT(),
    ),
    part('hp_turbine', stage(-0.56, 0.22, 0.4, 34, { thick: 0.024, chord: 0.07, twist: -0.5, disc: 0.08 }), NICKEL()),
    part('lp_turbine', spool(-0.72, -1.02, 4, [0.2, 0.2], [0.44, 0.52], 30, -0.46), NICKEL()),
    part('shaft', merge([cylinder(0.1, 0.1, 2.3, 24, { pos: [0, 0.1, 0] }), cylinder(0.16, 0.16, 0.1, 24, { pos: [0, 0.86, 0] })]), pbr('#6f7681', { metalness: 1, roughness: 0.25 })),
    part(
      'core_casing',
      merge([
        lathe(
          [
            [0.56, 0.8],
            [0.48, 0.3],
            [0.46, -0.3],
            [0.56, -0.9],
            [0.54, -0.9],
            [0.44, -0.3],
            [0.46, 0.3],
            [0.54, 0.8],
            [0.56, 0.8],
          ],
          44,
        ),
        ring(8, () => box(0.05, 1.7, 0.05, { pos: [0.52, -0.05, 0] })),
      ]),
      CORE(),
    ),
    part(
      'nozzle',
      merge([
        lathe(
          [
            [0.56, -1.04],
            [0.44, -1.5],
            [0.42, -1.5],
            [0.54, -1.04],
            [0.56, -1.04],
          ],
          40,
        ),
        lathe([[0.22, -1.06], [0.18, -1.3], [0.02, -1.52], [0, -1.54]], 28),
        sphere(0.02, 12, { pos: [0, -1.54, 0] }),
      ]),
      HOT(),
    ),
  );

  return group;
}
