// Single-cylinder four-stroke. Cylinder axis is +Y, crankshaft runs along X, so
// a vertical cross-section plane cuts straight through the bore.

import { THREE, part, pbr, box, cylinder, tube, torus, merge, ring, place, sphere, lathe } from '../lib/geo.mjs';

const BORE = 0.25;
/** Crankshaft centreline, and half the piston stroke. */
const AXIS = -0.82;
const THROW = 0.22;
const ALLOY = () => pbr('#9ea6ae', { metalness: 0.85, roughness: 0.44 });
const CAST = () => pbr('#6b7076', { metalness: 0.6, roughness: 0.68 });
const FORGED = () => pbr('#c4cad2', { metalness: 1, roughness: 0.28 });
const HOT_STEEL = () => pbr('#8f8377', { metalness: 0.95, roughness: 0.42 });
const CERAMIC = () => pbr('#e6e0d4', { metalness: 0.05, roughness: 0.5 });

const X = (geometry, pos) => place(geometry, { rot: [0, 0, Math.PI / 2], pos });

function coolingFins(count, from, to, rInner, rOuter, thick) {
  const fins = [];
  for (let i = 0; i < count; i += 1) {
    const y = from + ((to - from) * i) / (count - 1);
    fins.push(tube(rOuter, rInner, thick, 36, { pos: [0, y, 0] }));
  }
  return merge(fins);
}

function connectingRod() {
  const smallEnd = torus(0.07, 0.035, 20, 10, { pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0] });
  const bigEnd = merge([
    torus(0.13, 0.05, 24, 10, { pos: [0, -0.72, 0], rot: [Math.PI / 2, 0, 0] }),
    box(0.32, 0.06, 0.14, { pos: [0, -0.72, 0] }),
  ]);
  // An I-beam shank: two flanges and a web, which is what a rod actually is.
  const shank = merge([
    box(0.05, 0.72, 0.13, { pos: [0, -0.35, 0] }),
    box(0.11, 0.72, 0.04, { pos: [0, -0.35, 0.05] }),
    box(0.11, 0.72, 0.04, { pos: [0, -0.35, -0.05] }),
  ]);
  return merge([smallEnd, shank, bigEnd]);
}

/** Main journal on the axis, big-end pin offset by THROW. Stroke is 2 × THROW. */
function crankshaft() {
  const journal = X(cylinder(0.11, 0.11, 1.02, 28), [0, AXIS, 0]);
  const webs = [-0.2, 0.2].flatMap((x) => [
    box(0.1, 0.46, 0.26, { pos: [x, AXIS + THROW / 2, 0] }),
    // The counterweight sits opposite the pin. Without it the engine shakes
    // itself apart, and without it drawn the crank reads as a bent bar.
    X(cylinder(0.28, 0.28, 0.1, 30), [x, AXIS - THROW * 0.6, 0]),
  ]);
  const pin = X(cylinder(0.085, 0.085, 0.44, 24), [0, AXIS + THROW, 0]);
  return merge([journal, ...webs, pin]);
}

function valve(x, tilt) {
  return merge([
    place(cylinder(0.028, 0.028, 0.42, 16), { rot: [0, 0, tilt], pos: [x, 0.86, 0] }),
    place(lathe([[0, -0.05], [0.1, 0.0], [0.1, 0.03], [0, 0.05]], 24), { rot: [0, 0, tilt], pos: [x * 0.72, 0.66, 0] }),
    place(cylinder(0.05, 0.05, 0.04, 16), { rot: [0, 0, tilt], pos: [x * 1.12, 1.04, 0] }),
  ]);
}

export default function pistonEngine() {
  const group = new THREE.Group();

  group.add(
    part(
      'crankcase',
      merge([
        box(0.86, 0.54, 0.62, { pos: [0, AXIS - 0.06, 0] }),
        tube(0.36, 0.32, 0.64, 36, { pos: [0, AXIS, 0], rot: [0, 0, Math.PI / 2] }),
        box(1.02, 0.06, 0.74, { pos: [0, AXIS - 0.36, 0] }),
      ]),
      CAST(),
    ),
    part(
      'cylinder_block',
      merge([
        tube(0.33, BORE + 0.005, 0.98, 40, { pos: [0, 0.06, 0] }),
        coolingFins(7, -0.34, 0.5, 0.33, 0.44, 0.035),
        box(0.78, 0.07, 0.66, { pos: [0, -0.45, 0] }),
      ]),
      ALLOY(),
    ),
    part('cylinder_liner', tube(BORE + 0.004, BORE - 0.012, 0.96, 40, { pos: [0, 0.06, 0] }), HOT_STEEL()),
    part(
      'cylinder_head',
      merge([
        box(0.7, 0.24, 0.62, { pos: [0, 0.68, 0] }),
        lathe([[0.24, 0.56], [0.2, 0.62], [0, 0.64]], 28),
        coolingFins(3, 0.82, 0.98, 0.3, 0.4, 0.035),
        box(0.66, 0.1, 0.58, { pos: [0, 1.12, 0] }),
      ]),
      ALLOY(),
    ),
    part(
      'piston',
      merge([
        cylinder(BORE - 0.02, BORE - 0.02, 0.24, 32, { pos: [0, 0.2, 0] }),
        lathe([[0, 0.34], [0.12, 0.32], [BORE - 0.02, 0.3], [BORE - 0.02, 0.28]], 32),
        X(cylinder(0.038, 0.038, 0.4, 16), [0, 0.14, 0]),
      ]),
      FORGED(),
    ),
    part(
      'piston_rings',
      merge([0.28, 0.245, 0.2].map((y) => torus(BORE - 0.016, 0.014, 32, 8, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }))),
      pbr('#3c4149', { metalness: 1, roughness: 0.22 }),
    ),
    part('connecting_rod', connectingRod().translate(0, 0.12, 0), FORGED()),
    part('crankshaft', crankshaft(), FORGED()),
    part(
      'flywheel',
      merge([
        X(cylinder(0.42, 0.42, 0.09, 40), [0.58, AXIS, 0]),
        X(cylinder(0.12, 0.12, 0.16, 20), [0.62, AXIS, 0]),
        // Starter ring gear.
        ring(48, () => box(0.03, 0.05, 0.03, { pos: [0.4, 0, 0] })).rotateZ(Math.PI / 2).translate(0.58, AXIS, 0),
      ]),
      CAST(),
    ),
    part('intake_valve', valve(-0.13, 0.16), HOT_STEEL()),
    part('exhaust_valve', valve(0.13, -0.16), pbr('#7d6a5c', { metalness: 0.95, roughness: 0.5, emissive: '#ff4d15', emissiveIntensity: 0.18 })),
    part(
      'camshaft',
      merge([
        X(cylinder(0.055, 0.055, 0.66, 20), [0, 1.2, 0]),
        ...[-0.16, 0.16].map((x) =>
          merge([
            X(cylinder(0.1, 0.1, 0.07, 24), [x, 1.2, 0]),
            place(cylinder(0.055, 0.055, 0.07, 20), { rot: [0, 0, Math.PI / 2], pos: [x, 1.28, 0] }),
          ]),
        ),
      ]),
      FORGED(),
    ),
    part(
      'spark_plug',
      merge([
        lathe([[0.05, 0.62], [0.05, 0.78], [0.075, 0.82], [0.06, 0.9], [0.075, 0.96], [0.06, 1.04], [0.04, 1.1], [0, 1.1]], 20),
        cylinder(0.012, 0.012, 0.08, 12, { pos: [0, 0.6, 0] }),
        sphere(0.014, 10, { pos: [0.03, 0.58, 0] }),
      ]),
      CERAMIC(),
    ),
  );

  return group;
}
