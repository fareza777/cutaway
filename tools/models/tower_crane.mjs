// Tower crane: lattice mast, slewing ring, working jib, counter-jib and trolley.
import { THREE, TAU, part, pbr, place, roundedBox, box, cylinder, torus, merge, curve } from '../lib/geo.mjs';

const yellow = () => pbr('#e0a51e', { roughness: 0.48, metalness: 0.18 });
const steel = () => pbr('#8f989e', { metalness: 0.7, roughness: 0.34 });
const dark = () => pbr('#343b40', { roughness: 0.6, metalness: 0.3 });
const concrete = () => pbr('#9b9a92', { roughness: 0.9 });
const glass = () => pbr('#5f8fa3', { roughness: 0.16, metalness: 0.35 });
const red = () => pbr('#c44432', { roughness: 0.5 });

function strut(a, b, r = 0.018, radial = 7) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const g = cylinder(r, r, d.length(), radial);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(va.add(vb).multiplyScalar(0.5)));
  return g;
}

export default function towerCrane() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('base_ballast', [
    roundedBox(1.62, 0.26, 1.62, 0.03, 3, { pos: [0, 0.13, 0] }),
    roundedBox(1.42, 0.10, 1.42, 0.02, 2, { pos: [0, 0.29, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.46, 0.30, 0.46, { pos: [sx * 0.55, 0.34, sz * 0.55] }))),
    ...[-1, 1].map((s) => box(1.30, 0.09, 0.12, { pos: [0, 0.40, s * 0.66] })),
    ...Array.from({ length: 8 }, (_, i) => cylinder(0.024, 0.024, 0.10, 8, { pos: [Math.cos((i / 8) * TAU) * 0.70, 0.28, Math.sin((i / 8) * TAU) * 0.70] })),
  ], concrete());

  const mast = [];
  const post = (x, z) => cylinder(0.035, 0.035, 2.62, 8, { pos: [x, 1.55, z] });
  mast.push(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => post(sx * 0.19, sz * 0.19))));
  for (let i = 0; i < 8; i += 1) {
    const y = 0.34 + i * 0.31;
    mast.push(...[-1, 1].map((s) => box(0.42, 0.035, 0.035, { pos: [0, y, s * 0.19] })));
    mast.push(...[-1, 1].map((s) => box(0.035, 0.035, 0.42, { pos: [s * 0.19, y, 0] })));
    mast.push(strut([-0.19, y, 0.19], [0.19, y + 0.31, 0.19]));
    mast.push(strut([0.19, y, -0.19], [-0.19, y + 0.31, -0.19]));
  }
  // Climbing cage and ladder around the lower mast: the access route is a
  // recognisable part of a tower crane and gives the silhouette scale.
  for (let i = 0; i < 4; i += 1) {
    const x = i < 2 ? -0.30 : 0.30;
    const z = i % 2 ? -0.30 : 0.30;
    mast.push(cylinder(0.012, 0.012, 1.70, 6, { pos: [x, 1.16, z] }));
  }
  for (let y = 0.34; y < 2.0; y += 0.28) {
    mast.push(...[-1, 1].map((s) => box(0.60, 0.012, 0.012, { pos: [0, y, s * 0.30] })));
    mast.push(...[-1, 1].map((s) => box(0.012, 0.012, 0.30, { pos: [s * 0.30, y, 0] })));
  }
  mast.push(...Array.from({ length: 7 }, (_, i) => box(0.30, 0.018, 0.018, { pos: [0, 0.40 + i * 0.22, 0.30] })));
  add('mast', mast, yellow());

  add('slew_ring', [
    torus(0.30, 0.045, 30, 10, { pos: [0, 0.31, 0], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.27, 0.27, 0.08, 28, { pos: [0, 0.31, 0] }),
    ...Array.from({ length: 12 }, (_, i) => cylinder(0.018, 0.018, 0.05, 8, {
      pos: [Math.cos((i / 12) * TAU) * 0.24, 0.37, Math.sin((i / 12) * TAU) * 0.24],
    })),
  ], dark());

  add('slewing_drive', [
    cylinder(0.08, 0.08, 0.22, 18, { pos: [-0.30, 0.48, 0.06] }),
    cylinder(0.055, 0.055, 0.08, 16, { pos: [-0.30, 0.62, 0.06] }),
    cylinder(0.10, 0.10, 0.035, 20, { pos: [-0.30, 0.40, 0.06], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.035, 0.035, 0.20, 12, { pos: [0.12, 0.47, 0.10], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('cab_shell', [
    roundedBox(0.46, 0.46, 0.42, 0.025, 2, { pos: [0.44, 2.40, 0.34] }),
    box(0.50, 0.05, 0.46, { pos: [0.44, 2.64, 0.34] }),
    box(0.04, 0.34, 0.36, { pos: [0.68, 2.40, 0.34] }),
  ], yellow());

  add('cab_glass', [
    box(0.012, 0.30, 0.34, { pos: [0.674, 2.43, 0.34] }),
    box(0.36, 0.26, 0.012, { pos: [0.44, 2.45, 0.553] }),
    box(0.012, 0.26, 0.30, { pos: [0.212, 2.45, 0.34] }),
  ], glass());

  add('cab_interior', [
    roundedBox(0.22, 0.08, 0.18, 0.02, 2, { pos: [0.45, 2.25, 0.32] }),
    box(0.18, 0.32, 0.04, { pos: [0.45, 2.34, 0.24] }),
    cylinder(0.018, 0.018, 0.12, 8, { pos: [0.56, 2.28, 0.42] }),
    box(0.10, 0.02, 0.08, { pos: [0.56, 2.35, 0.42], rot: [0.4, 0, 0] }),
  ], dark());

  const jib = [];
  for (let i = 0; i <= 10; i += 1) {
    const x = 0.25 + i * 0.25;
    jib.push(strut([x, 2.95, -0.16], [x, 3.22, -0.16], 0.014));
    jib.push(strut([x, 2.95, 0.16], [x, 3.22, 0.16], 0.014));
    if (i < 10) {
      jib.push(strut([x, 3.22, -0.16], [x + 0.25, 3.22, -0.16], 0.016));
      jib.push(strut([x, 2.95, -0.16], [x + 0.25, 2.95, -0.16], 0.016));
      jib.push(strut([x, 2.95, 0.16], [x + 0.25, 3.22, 0.16], 0.012));
      jib.push(strut([x, 2.95, -0.16], [x + 0.25, 3.22, -0.16], 0.012));
    }
    // Walkway handrail along the working jib, where the trolley is serviced.
    jib.push(box(0.018, 0.34, 0.018, { pos: [x, 3.39, 0.155] }));
  }
  jib.push(box(2.55, 0.018, 0.018, { pos: [1.52, 3.56, 0.155] }));
  add('jib', jib, yellow());

  add('jib_tip', [
    box(0.08, 0.46, 0.34, { pos: [2.78, 3.08, 0] }),
    cylinder(0.035, 0.02, 0.16, 10, { pos: [2.78, 3.38, 0] }),
    box(0.04, 0.04, 0.04, { pos: [2.78, 3.46, 0] }),
  ], red());

  const counter = [];
  for (let i = 0; i < 5; i += 1) {
    const x = -0.20 - i * 0.22;
    counter.push(strut([x, 2.95, -0.18], [x, 3.18, -0.18], 0.014));
    counter.push(strut([x, 2.95, 0.18], [x, 3.18, 0.18], 0.014));
    counter.push(strut([x, 3.18, -0.18], [x - 0.22, 3.18, -0.18], 0.016));
    counter.push(strut([x, 2.95, 0.18], [x - 0.22, 3.18, 0.18], 0.012));
  }
  add('counter_jib', counter, yellow());

  add('counterweights', [
    ...Array.from({ length: 4 }, (_, i) => box(0.18, 0.48, 0.42, { pos: [-0.95 - i * 0.20, 2.72, 0] })),
    box(0.86, 0.04, 0.44, { pos: [-1.25, 2.98, 0] }),
  ], concrete());

  add('tower_peak', [
    strut([-0.20, 3.22, -0.18], [0, 3.95, 0], 0.030),
    strut([0.20, 3.22, 0.18], [0, 3.95, 0], 0.030),
    strut([-0.20, 3.22, 0.18], [0, 3.95, 0], 0.030),
    strut([0.20, 3.22, -0.18], [0, 3.95, 0], 0.030),
    box(0.18, 0.10, 0.18, { pos: [0, 3.95, 0] }),
    cylinder(0.022, 0.022, 0.46, 8, { pos: [0, 4.18, 0] }),
    cylinder(0.045, 0.045, 0.05, 12, { pos: [0, 4.42, 0] }),
    ...[-1, 1].map((s) => strut([0, 3.95, 0], [0, 3.60, s * 0.28], 0.018)),
  ], yellow());

  add('tie_bars', [
    curve([[0, 3.92, 0], [0.55, 3.55, 0], [1.15, 3.32, 0], [1.65, 3.22, 0]], 0.012, { segments: 30, radial: 6 }),
    curve([[0, 3.92, 0], [-0.40, 3.55, 0], [-0.78, 3.28, 0], [-0.98, 3.20, 0]], 0.012, { segments: 24, radial: 6 }),
  ], steel());

  add('trolley', [
    roundedBox(0.28, 0.10, 0.34, 0.015, 2, { pos: [1.65, 2.90, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cylinder(0.035, 0.035, 0.035, 12, {
      pos: [1.65 + sx * 0.10, 2.96, sz * 0.12], rot: [Math.PI / 2, 0, 0],
    }))),
    box(0.12, 0.08, 0.16, { pos: [1.65, 2.82, 0] }),
  ], steel());

  add('hoist_rope', [
    cylinder(0.008, 0.008, 1.34, 6, { pos: [1.65, 2.18, 0] }),
    cylinder(0.008, 0.008, 0.34, 6, { pos: [1.65, 1.42, 0] }),
  ], dark());

  add('hook_block', [
    roundedBox(0.14, 0.16, 0.10, 0.015, 2, { pos: [1.65, 1.22, 0] }),
    torus(0.055, 0.018, 18, 8, { pos: [1.65, 1.10, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.012, 0.012, 0.10, 8, { pos: [1.65, 1.34, 0] }),
    ...[-1, 1].map((s) => box(0.05, 0.03, 0.03, { pos: [1.65 + s * 0.07, 1.10, 0] })),
  ], red());

  add('hoist_drum', [
    cylinder(0.12, 0.12, 0.26, 22, { pos: [-0.42, 2.82, 0], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => cylinder(0.15, 0.15, 0.025, 22, { pos: [-0.42, 2.82, s * 0.15], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.028, 0.028, 0.30, 10, { pos: [-0.42, 2.82, 0], rot: [Math.PI / 2, 0, 0] }),
  ], steel());

  add('hoist_motor', [
    cylinder(0.09, 0.09, 0.20, 20, { pos: [-0.65, 2.60, 0] }),
    cylinder(0.10, 0.10, 0.03, 20, { pos: [-0.65, 2.71, 0] }),
    box(0.16, 0.08, 0.12, { pos: [-0.65, 2.48, 0] }),
  ], red());

  add('lights', [
    ...[-1, 1].map((s) => box(0.06, 0.06, 0.10, { pos: [2.72, 3.18, s * 0.18] })),
    ...[-1, 1].map((s) => box(0.10, 0.10, 0.06, { pos: [0.58, 2.66, s * 0.26] })),
  ], pbr('#f2d37a', { roughness: 0.3, emissive: '#d9a63a', emissiveIntensity: 0.7 }));

  add('nameplate', roundedBox(0.22, 0.07, 0.006, 0.004, 1, { pos: [0, 0.30, 0.64] }), red());

  // The jib is long relative to the mast; a slight narrowing keeps the icon
  // readable without changing the tower's proportions.
  g.scale.x = 0.82;
  return g;
}
