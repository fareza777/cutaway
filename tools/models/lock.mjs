// Pin-tumbler lock. Plug axis along +X, key enters from −X, bible stands +Y.
// The one feature that names it is the shear line: six pin stacks sitting on a
// key whose bitting lifts every pair exactly to that line. Housing is a tube
// you can see into from the side, not a solid brick.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, merge, ring,
  place, sphere, curve,
} from '../lib/geo.mjs';

const BRASS = () => pbr('#d4b86a', { metalness: 0.82, roughness: 0.36 });
const BRASS_DARK = () => pbr('#a88840', { metalness: 0.8, roughness: 0.4 });
const STEEL = () => pbr('#c0c8d0', { metalness: 0.92, roughness: 0.24 });
const KEY_METAL = () => pbr('#efe0a8', { metalness: 0.92, roughness: 0.18 });
const SPRING = () => pbr('#b8c0c8', { metalness: 1, roughness: 0.2 });
const NICKEL = () => pbr('#c5ccd3', { metalness: 1, roughness: 0.18 });

// Depths from the shear line down to the key. These six numbers ARE the key:
// they lift every pin pair so the split sits on the plug's outer radius.
const BITTING = [0.14, 0.08, 0.2, 0.1, 0.16, 0.12];
const PIN_X = BITTING.map((_, i) => -0.18 + i * 0.12);
const SHEAR = 0.16;
const PLUG_R = 0.16;
const PLUG_LEN = 0.82;

function coil(x, y0, y1, radius = 0.028, turns = 5) {
  const pts = Array.from({ length: 28 }, (_, k) => {
    const t = k / 27;
    const a = t * turns * TAU;
    return [x + Math.cos(a) * radius, y0 + (y1 - y0) * t, Math.sin(a) * radius];
  });
  return curve(pts, 0.006, { segments: 36, radial: 5 });
}

function keyGeom() {
  const head = merge([
    roundedBox(0.22, 0.28, 0.055, 0.04, 3, { pos: [-0.62, 0.02, 0] }),
    torus(0.055, 0.014, 12, 20, { pos: [-0.68, 0.08, 0] }),
    torus(0.03, 0.01, 8, 14, { pos: [-0.58, -0.06, 0] }),
  ]);
  const blade = box(0.72, 0.055, 0.038, { pos: [-0.12, -0.04, 0] });
  const steps = BITTING.map((h, i) =>
    box(0.1, h, 0.04, { pos: [PIN_X[i], -0.04 + 0.055 / 2 + h / 2, 0] }),
  );
  const groove = box(0.7, 0.012, 0.008, { pos: [-0.12, -0.02, 0.016] });
  return merge([head, blade, ...steps, groove]);
}

export default function pinTumblerLock() {
  const group = new THREE.Group();

  const keyPins = merge(
    BITTING.map((h, i) =>
      merge([
        cylinder(0.028, 0.028, h, 14, { pos: [PIN_X[i], SHEAR - h / 2, 0] }),
        sphere(0.028, 10, { pos: [PIN_X[i], SHEAR - h, 0] }),
      ]),
    ),
  );

  const drivers = merge(
    BITTING.map((_, i) => cylinder(0.028, 0.028, 0.11, 14, { pos: [PIN_X[i], SHEAR + 0.055, 0] })),
  );

  const springs = merge(BITTING.map((_, i) => coil(PIN_X[i], SHEAR + 0.12, SHEAR + 0.28)));

  group.add(
    part(
      'housing',
      merge([
        place(tube(0.28, 0.175, PLUG_LEN + 0.08, 48), { rot: [0, 0, Math.PI / 2], pos: [0.02, 0, 0] }),
        roundedBox(0.7, 0.22, 0.22, 0.03, 2, { pos: [0.02, 0.28, 0] }),
        place(cylinder(0.05, 0.08, 0.07, 20), { rot: [0, 0, Math.PI / 2], pos: [-0.44, -0.02, 0] }),
        ring(8, () => cylinder(0.018, 0.018, 0.04, 8, { pos: [0.26, 0, 0], rot: [0, 0, Math.PI / 2] })),
      ]),
      BRASS(),
    ),
    part(
      'plug',
      merge([
        place(cylinder(PLUG_R, PLUG_R, PLUG_LEN, 48), { rot: [0, 0, Math.PI / 2], pos: [0, 0, 0] }),
        // Keyway as a shallow slot so the key has somewhere to sit.
        box(0.7, 0.05, 0.028, { pos: [-0.04, -0.04, 0] }),
      ]),
      BRASS_DARK(),
    ),
    part('key_pins', keyPins, BRASS_DARK()),
    part('driver_pins', drivers, STEEL()),
    part('springs', springs, SPRING()),
    part('key', keyGeom(), KEY_METAL()),
    part(
      'cam',
      merge([
        place(cylinder(0.09, 0.09, 0.06, 20), { rot: [0, 0, Math.PI / 2], pos: [0.48, 0, 0] }),
        box(0.05, 0.22, 0.08, { pos: [0.52, -0.08, 0] }),
      ]),
      NICKEL(),
    ),
    part(
      'retaining_clip',
      place(torus(0.175, 0.016, 12, 28), { rot: [0, Math.PI / 2, 0], pos: [0.4, 0, 0] }),
      STEEL(),
    ),
  );

  return group;
}
