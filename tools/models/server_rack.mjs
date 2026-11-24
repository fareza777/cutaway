// Data-centre rack: frame, side panels, eight 2U servers, switches, patch panel,
// cable management, UPS and a precision cooling unit.
import { TAU, THREE, part, pbr, roundedBox, box, cylinder, torus, merge } from '../lib/geo.mjs';

const frameMat = () => pbr('#3a4248', { metalness: 0.55, roughness: 0.4 });
const panel = () => pbr('#20262a', { metalness: 0.35, roughness: 0.55 });
const face = () => pbr('#c7ccce', { metalness: 0.4, roughness: 0.42 });
const dark = () => pbr('#161b1e', { roughness: 0.7 });
const blue = () => pbr('#2e7f9a', { roughness: 0.2, emissive: '#1d5264', emissiveIntensity: 0.4 });
const green = () => pbr('#64b06a', { roughness: 0.3, emissive: '#3d7a42', emissiveIntensity: 0.5 });
const orange = () => pbr('#d08034', { roughness: 0.5 });
const steel = () => pbr('#9aa3a7', { metalness: 0.8, roughness: 0.3 });

function serverUnit(y) {
  const bits = [
    roundedBox(0.62, 0.085, 0.70, 0.008, 1, { pos: [0, y, 0] }),
    box(0.58, 0.070, 0.012, { pos: [0, y, 0.354] }),
    ...Array.from({ length: 4 }, (_, i) => box(0.095, 0.050, 0.014, { pos: [-0.20 + i * 0.105, y, 0.358] })),
    ...Array.from({ length: 6 }, (_, i) => cylinder(0.008, 0.008, 0.010, 6, { pos: [0.20 + i * 0.026, y, 0.360], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((s) => box(0.025, 0.018, 0.012, { pos: [s * 0.27, y + 0.026, 0.362] })),
    ...[-1, 1].map((s) => box(0.035, 0.028, 0.02, { pos: [s * 0.26, y - 0.02, 0.30] })),
  ];
  return merge(bits);
}

export default function serverRack() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('base_plinth', [
    roundedBox(0.80, 0.10, 0.94, 0.015, 2, { pos: [0, 0.05, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cylinder(0.035, 0.035, 0.06, 10, { pos: [sx * 0.31, 0.03, sz * 0.36] }))),
  ], dark());

  add('rack_frame', [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.05, 2.18, 0.05, { pos: [sx * 0.36, 1.17, sz * 0.42] }))),
    ...[-1, 1].map((s) => box(0.76, 0.05, 0.05, { pos: [0, 2.24, s * 0.42] })),
    ...[-1, 1].map((s) => box(0.76, 0.05, 0.05, { pos: [0, 0.12, s * 0.42] })),
    ...[-1, 1].map((s) => box(0.05, 0.05, 0.88, { pos: [s * 0.36, 2.24, 0] })),
    ...Array.from({ length: 10 }, (_, i) => box(0.02, 0.02, 0.78, { pos: [-0.33, 0.24 + i * 0.20, 0] })),
  ], frameMat());

  add('side_panels', [
    ...[-1, 1].map((s) => box(0.025, 2.08, 0.80, { pos: [s * 0.377, 1.17, 0] })),
    ...[-1, 1].map((s) => box(0.025, 1.90, 0.03, { pos: [s * 0.377, 1.17, 0.38] })),
  ], panel());

  add('top_panel', [
    box(0.76, 0.035, 0.88, { pos: [0, 2.27, 0] }),
    ...[-1, 1].map((s) => box(0.10, 0.035, 0.10, { pos: [s * 0.25, 2.30, 0] })),
    box(0.25, 0.06, 0.03, { pos: [0, 2.28, 0.44] }),
  ], panel());

  add('glass_door', [
    roundedBox(0.68, 2.02, 0.02, 0.010, 1, { pos: [0, 1.18, 0.445] }),
    ...[-1, 1].map((s) => box(0.02, 1.96, 0.03, { pos: [s * 0.33, 1.18, 0.45] })),
    cylinder(0.018, 0.018, 0.20, 10, { pos: [0.27, 1.18, 0.47] }),
    ...[-1, 1].map((s) => cylinder(0.02, 0.02, 0.045, 8, { pos: [s * 0.28, 1.05, 0.445], rot: [Math.PI / 2, 0, 0] })),
  ], pbr('#6e99a8', { roughness: 0.14, metalness: 0.35 }));

  add('server_units', Array.from({ length: 8 }, (_, i) => serverUnit(0.32 + i * 0.205)).flat(), face());

  add('server_leds', [
    ...Array.from({ length: 8 }, (_, i) => box(0.012, 0.012, 0.006, { pos: [-0.27, 0.335 + i * 0.205, 0.366] })),
    ...Array.from({ length: 8 }, (_, i) => box(0.012, 0.012, 0.006, { pos: [-0.245, 0.335 + i * 0.205, 0.366] })),
  ], green());

  add('switches', [
    ...[-1, 1].map((s) => merge([
      roundedBox(0.66, 0.075, 0.52, 0.008, 1, { pos: [0, 1.98 + s * 0.10, 0.06] }),
      ...Array.from({ length: 12 }, (_, i) => box(0.032, 0.022, 0.01, { pos: [-0.27 + i * 0.048, 1.98 + s * 0.10, 0.325] })),
      ...Array.from({ length: 3 }, (_, i) => cylinder(0.012, 0.012, 0.012, 6, { pos: [0.24 + i * 0.030, 1.98 + s * 0.10, 0.328], rot: [Math.PI / 2, 0, 0] })),
    ])),
  ], blue());

  add('patch_panel', [
    roundedBox(0.66, 0.10, 0.08, 0.008, 1, { pos: [0, 1.74, 0.36] }),
    ...Array.from({ length: 18 }, (_, i) => box(0.022, 0.032, 0.012, { pos: [-0.29 + i * 0.034, 1.74, 0.404] })),
    ...Array.from({ length: 18 }, (_, i) => box(0.018, 0.018, 0.016, { pos: [-0.29 + i * 0.034, 1.74, 0.412] })),
  ], dark());

  add('cable_tray', [
    ...[-1, 1].map((s) => box(0.04, 1.70, 0.04, { pos: [s * 0.30, 1.15, -0.40] })),
    ...Array.from({ length: 14 }, (_, i) => torus(0.035, 0.008, 12, 6, { pos: [-0.30, 0.35 + i * 0.12, -0.43], rot: [Math.PI / 2, 0, 0] })),
    ...Array.from({ length: 9 }, (_, i) => cylinder(0.009, 0.009, 1.60, 6, { pos: [-0.27 + i * 0.014, 1.10, -0.44] })),
  ], orange());

  add('psu_bus', [
    ...Array.from({ length: 2 }, (_, i) => roundedBox(0.08, 1.70, 0.10, 0.010, 1, { pos: [0.30, 1.15, -0.28 + i * 0.12] })),
    ...Array.from({ length: 6 }, (_, i) => cylinder(0.014, 0.014, 0.03, 8, { pos: [0.30, 0.45 + i * 0.24, -0.22], rot: [Math.PI / 2, 0, 0] })),
  ], steel());

  add('cooling_fans', [
    ...Array.from({ length: 4 }, (_, i) => merge([
      torus(0.085, 0.014, 20, 8, { pos: [-0.18, 1.95 + i * 0.05, 0.35], rot: [Math.PI / 2, 0, 0] }),
      ...Array.from({ length: 5 }, (_, k) => box(0.014, 0.060, 0.006, { pos: [-0.18, 1.95 + i * 0.05, 0.36], rot: [0, 0, (k / 5) * TAU] })),
    ])),
  ], dark());

  add('ups', [
    roundedBox(0.64, 0.30, 0.66, 0.02, 2, { pos: [0, 0.32, 0] }),
    roundedBox(0.20, 0.10, 0.02, 0.005, 1, { pos: [0, 0.36, 0.34] }),
    ...Array.from({ length: 4 }, (_, i) => cylinder(0.012, 0.012, 0.02, 8, { pos: [-0.18 + i * 0.05, 0.25, 0.34], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((s) => box(0.04, 0.20, 0.04, { pos: [s * 0.28, 0.18, 0.28] })),
  ], orange());

  add('crac', [
    roundedBox(0.58, 1.65, 0.52, 0.025, 2, { pos: [0.82, 0.90, -0.10] }),
    ...Array.from({ length: 7 }, (_, i) => box(0.48, 0.025, 0.03, { pos: [0.82, 0.30 + i * 0.07, 0.17] })),
    torus(0.16, 0.02, 26, 8, { pos: [0.82, 1.28, 0.18], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 6 }, (_, i) => box(0.03, 0.14, 0.02, { pos: [0.82, 1.28, 0.19], rot: [0, 0, (i / 6) * TAU] })),
    cylinder(0.07, 0.07, 0.10, 16, { pos: [0.82, 1.78, -0.10] }),
  ], panel());

  add('monitoring', [
    roundedBox(0.24, 0.18, 0.03, 0.01, 1, { pos: [0.82, 1.72, 0.20] }),
    box(0.20, 0.14, 0.006, { pos: [0.82, 1.72, 0.218] }),
    cylinder(0.012, 0.012, 0.18, 8, { pos: [1.00, 1.72, 0.14] }),
    box(0.04, 0.04, 0.10, { pos: [1.00, 1.72, 0.08] }),
  ], blue());

  add('nameplate', roundedBox(0.20, 0.06, 0.005, 0.003, 1, { pos: [0, 2.20, 0.455] }), steel());

  return g;
}
