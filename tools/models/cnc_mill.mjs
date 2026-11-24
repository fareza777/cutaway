// A vertical machining centre, front door open. The table travels in X, the
// spindle head in Y and Z; every axis is drawn as rails plus a ballscrew and a
// servo, so the cutaway shows the same three-loop layout a real VMC uses.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const cast = () => pbr('#5c656b', { roughness: 0.62, metalness: 0.28 });
const castDark = () => pbr('#3c4449', { roughness: 0.58, metalness: 0.32 });
const panel = () => pbr('#e8e9e5', { roughness: 0.5, metalness: 0.04 });
const steel = () => pbr('#b9c0c4', { metalness: 0.8, roughness: 0.28 });
const darkSteel = () => pbr('#4d565c', { metalness: 0.7, roughness: 0.36 });
const orange = () => pbr('#d9862d', { roughness: 0.46, metalness: 0.08 });
const copper = () => pbr('#ae6b3f', { metalness: 0.8, roughness: 0.34 });
const rubber = () => pbr('#202528', { roughness: 0.92 });
const screenMat = () => pbr('#2f6f7d', { roughness: 0.18, metalness: 0.2 });

function tSlotTable() {
  const bits = [roundedBox(0.82, 0.11, 0.46, 0.015, 2, { pos: [0, 0.63, 0.16] })];
  for (let i = 0; i < 5; i += 1) {
    bits.push(box(0.76, 0.012, 0.025, { pos: [0, 0.686, -0.02 + i * 0.09] }));
  }
  return merge(bits);
}

function vise() {
  return [
    roundedBox(0.34, 0.10, 0.22, 0.012, 2, { pos: [0.02, 0.735, 0.15] }),
    roundedBox(0.04, 0.14, 0.20, 0.008, 1, { pos: [-0.12, 0.80, 0.15] }),
    roundedBox(0.04, 0.14, 0.20, 0.008, 1, { pos: [0.16, 0.80, 0.15] }),
    cylinder(0.022, 0.022, 0.30, 14, { pos: [0.02, 0.80, 0.15], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.010, 0.010, 0.16, 10, { pos: [0.02, 0.88, 0.15], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => cylinder(0.012, 0.012, 0.10, 8, { pos: [0.02, 0.95, 0.15 + s * 0.075], rot: [Math.PI / 2, 0, 0] })),
  ];
}

function atcTool(angle) {
  const x = Math.cos(angle) * 0.30;
  const z = Math.sin(angle) * 0.30;
  return merge([
    cylinder(0.022, 0.022, 0.13, 14, { pos: [0.68 + x, 1.34, -0.28 + z] }),
    cylinder(0.014, 0.006, 0.10, 12, { pos: [0.68 + x, 1.25, -0.28 + z] }),
    torus(0.028, 0.006, 16, 6, { pos: [0.68 + x, 1.40, -0.28 + z], rot: [Math.PI / 2, 0, 0] }),
  ]);
}

export default function cncMill() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('base_casting', [
    roundedBox(1.72, 0.24, 1.20, 0.04, 3, { pos: [0, 0.12, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => roundedBox(0.20, 0.16, 0.20, 0.03, 2, { pos: [sx * 0.70, 0.18, sz * 0.45] }))),
    ...[-1, 1].map((s) => box(1.5, 0.04, 0.05, { pos: [0, 0.25, s * 0.50] })),
  ], cast());

  add('leveling_feet', [-1, 1].flatMap((sx) => [-1, 1].map((sz) => merge([
    cylinder(0.05, 0.06, 0.06, 16, { pos: [sx * 0.74, 0.03, sz * 0.46] }),
    cylinder(0.012, 0.012, 0.10, 8, { pos: [sx * 0.74, 0.09, sz * 0.46] }),
    cylinder(0.045, 0.045, 0.012, 16, { pos: [sx * 0.74, 0.006, sz * 0.46] }),
  ]))), darkSteel());

  add('column', [
    roundedBox(0.58, 1.55, 0.48, 0.045, 3, { pos: [-0.02, 0.98, -0.43] }),
    ...Array.from({ length: 8 }, (_, i) => box(0.46, 0.020, 0.02, { pos: [-0.02, 0.44 + i * 0.13, -0.185] })),
    ...[-1, 1].map((s) => roundedBox(0.10, 0.60, 0.12, 0.02, 2, { pos: [-0.02 + s * 0.33, 0.75, -0.43] })),
  ], cast());

  add('enclosure_frame', [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.06, 1.70, 0.06, { pos: [sx * 0.86, 0.92, sz * 0.62] }))),
    ...[-1, 1].map((sx) => box(0.06, 0.06, 1.30, { pos: [sx * 0.86, 1.75, 0] })),
    ...[-1, 1].map((sz) => box(1.78, 0.06, 0.06, { pos: [0, 1.75, sz * 0.62] })),
    ...[-1, 1].map((sx) => box(0.06, 1.55, 0.06, { pos: [sx * 0.62, 0.90, 0.62] })),
  ], castDark());

  add('enclosure_panels', [
    ...[-1, 1].map((s) => box(0.035, 1.55, 1.18, { pos: [s * 0.855, 0.92, 0] })),
    box(1.70, 1.55, 0.035, { pos: [0, 0.92, -0.60] }),
    box(1.70, 0.035, 1.18, { pos: [0, 1.72, 0] }),
  ], panel());

  add('front_door', [
    roundedBox(0.62, 1.12, 0.04, 0.015, 2, { pos: [0.46, 0.94, 0.64], rot: [0, -0.55, 0] }),
    roundedBox(0.50, 0.56, 0.045, 0.01, 1, { pos: [0.60, 1.10, 0.78], rot: [0, -0.55, 0] }),
    ...[-1, 1].map((s) => cylinder(0.020, 0.020, 0.08, 12, { pos: [0.30, 0.94 + s * 0.35, 0.68], rot: [Math.PI / 2, 0, 0] })),
  ], steel());

  add('worktable', tSlotTable(), steel());

  add('table_saddle', [
    roundedBox(0.54, 0.18, 0.52, 0.02, 2, { pos: [0, 0.50, 0.16] }),
    ...[-1, 1].map((s) => box(0.10, 0.10, 0.46, { pos: [s * 0.20, 0.40, 0.16] })),
  ], castDark());

  add('x_rails', [
    ...[-1, 1].map((s) => cylinder(0.032, 0.032, 1.30, 18, { pos: [0, 0.42, 0.16 + s * 0.27], rot: [0, 0, Math.PI / 2] })),
    ...[-1, 1].flatMap((s) => [-1, 1].map((e) => box(0.07, 0.08, 0.07, { pos: [e * 0.62, 0.42, 0.16 + s * 0.27] }))),
  ], steel());

  add('x_ballscrew', [
    cylinder(0.022, 0.022, 1.18, 16, { pos: [0, 0.38, 0.16], rot: [0, 0, Math.PI / 2] }),
    box(0.10, 0.06, 0.08, { pos: [0.02, 0.38, 0.16] }),
    cylinder(0.035, 0.035, 0.08, 14, { pos: [-0.62, 0.38, 0.16], rot: [0, 0, Math.PI / 2] }),
  ], copper());

  add('x_servo', [
    cylinder(0.065, 0.065, 0.18, 22, { pos: [0.72, 0.38, 0.16], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.074, 0.074, 0.03, 22, { pos: [0.82, 0.38, 0.16], rot: [0, 0, Math.PI / 2] }),
    torus(0.072, 0.008, 22, 8, { pos: [0.72, 0.38, 0.16], rot: [0, Math.PI / 2, 0] }),
  ], orange());

  add('y_rails', [
    ...[-1, 1].map((s) => cylinder(0.030, 0.030, 0.92, 18, { pos: [s * 0.20, 1.02, -0.16] })),
    ...[-1, 1].flatMap((s) => [-1, 1].map((e) => box(0.065, 0.065, 0.08, { pos: [s * 0.20, 0.56 + e * 0.46, -0.16] }))),
  ], steel());

  add('y_ballscrew', [
    cylinder(0.020, 0.020, 0.82, 16, { pos: [0.30, 1.02, -0.16] }),
    box(0.07, 0.10, 0.06, { pos: [0.30, 1.03, -0.16] }),
    cylinder(0.030, 0.030, 0.06, 14, { pos: [0.30, 0.58, -0.16] }),
    cylinder(0.030, 0.030, 0.06, 14, { pos: [0.30, 1.46, -0.16] }),
  ], copper());

  add('y_servo', [
    cylinder(0.060, 0.060, 0.17, 22, { pos: [0.30, 1.53, -0.16] }),
    cylinder(0.068, 0.068, 0.03, 22, { pos: [0.30, 1.62, -0.16] }),
  ], orange());

  add('spindle_head', [
    roundedBox(0.44, 0.36, 0.36, 0.03, 3, { pos: [0, 1.24, -0.06] }),
    ...[-1, 1].map((s) => roundedBox(0.10, 0.28, 0.10, 0.02, 2, { pos: [s * 0.20, 1.20, 0.06] })),
    box(0.32, 0.05, 0.28, { pos: [0, 1.06, -0.06] }),
  ], cast());

  add('spindle_motor', [
    cylinder(0.13, 0.13, 0.30, 28, { pos: [0, 1.53, -0.06] }),
    ...Array.from({ length: 10 }, (_, i) => torus(0.133, 0.007, 28, 6, { pos: [0, 1.40 + i * 0.028, -0.06], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.065, 0.065, 0.08, 20, { pos: [0, 1.70, -0.06] }),
  ], darkSteel());

  add('spindle', [
    cylinder(0.075, 0.075, 0.18, 24, { pos: [0, 1.10, -0.06] }),
    cylinder(0.055, 0.030, 0.12, 20, { pos: [0, 0.98, -0.06] }),
    cylinder(0.022, 0.022, 0.06, 14, { pos: [0, 0.91, -0.06] }),
    ...Array.from({ length: 6 }, (_, i) => box(0.012, 0.05, 0.012, {
      pos: [Math.sin((i / 6) * TAU) * 0.028, 0.87, -0.06 + Math.cos((i / 6) * TAU) * 0.028],
      rot: [0, (i / 6) * TAU, 0],
    })),
  ], steel());

  add('z_rails', [
    ...[-1, 1].map((s) => cylinder(0.025, 0.025, 0.52, 16, { pos: [s * 0.14, 1.26, -0.18] })),
  ], steel());

  add('z_ballscrew', [
    cylinder(0.017, 0.017, 0.46, 14, { pos: [0, 1.30, -0.20] }),
    box(0.06, 0.08, 0.05, { pos: [0, 1.24, -0.20] }),
  ], copper());

  add('z_servo', [
    cylinder(0.050, 0.050, 0.15, 20, { pos: [0, 1.58, -0.22] }),
    cylinder(0.058, 0.058, 0.025, 20, { pos: [0, 1.66, -0.22] }),
  ], orange());

  add('tool_carousel', [
    cylinder(0.34, 0.34, 0.055, 32, { pos: [0.68, 1.44, -0.28] }),
    torus(0.34, 0.018, 32, 8, { pos: [0.68, 1.44, -0.28], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 12 }, (_, i) => atcTool((i / 12) * TAU)),
    cylinder(0.04, 0.04, 0.12, 16, { pos: [0.68, 1.50, -0.28] }),
  ], darkSteel());

  add('atc_arm', [
    cylinder(0.045, 0.045, 0.40, 18, { pos: [0.68, 1.22, -0.28] }),
    box(0.34, 0.045, 0.06, { pos: [0.56, 1.22, -0.28], rot: [0, 0.55, 0] }),
    torus(0.06, 0.012, 20, 8, { pos: [0.68, 1.22, -0.28], rot: [Math.PI / 2, 0, 0] }),
  ], orange());

  add('coolant_tank', [
    roundedBox(0.62, 0.26, 0.34, 0.02, 2, { pos: [-0.30, 0.20, -0.64] }),
    cylinder(0.06, 0.06, 0.12, 18, { pos: [-0.60, 0.24, -0.64] }),
    cylinder(0.025, 0.025, 0.18, 12, { pos: [-0.60, 0.38, -0.64] }),
  ], darkSteel());

  add('coolant_pump', [
    cylinder(0.075, 0.075, 0.14, 20, { pos: [-0.52, 0.29, -0.58], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.035, 0.035, 0.20, 12, { pos: [-0.38, 0.29, -0.58], rot: [0, 0, Math.PI / 2] }),
    curve([[-0.38, 0.32, -0.58], [-0.22, 0.48, -0.42], [0.02, 0.72, -0.24], [0.04, 0.96, -0.12]], 0.022, { segments: 26, radial: 8 }),
    curve([[-0.38, 0.32, -0.58], [0.10, 0.52, -0.44], [0.26, 0.74, -0.26], [0.20, 0.98, -0.12]], 0.022, { segments: 26, radial: 8 }),
  ], copper());

  add('chip_auger', [
    cylinder(0.035, 0.035, 1.10, 16, { pos: [0, 0.20, 0.50], rot: [0, 0, Math.PI / 2] }),
    curve(Array.from({ length: 36 }, (_, i) => {
      const t = i / 35;
      const a = t * TAU * 5;
      return [-0.52 + t * 1.04, 0.20 + Math.sin(a) * 0.048, 0.50 + Math.cos(a) * 0.048];
    }), 0.008, { segments: 90, radial: 5 }),
    cylinder(0.05, 0.05, 0.06, 16, { pos: [0.58, 0.20, 0.50], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('way_covers', [
    ...[-1, 1].map((s) => box(0.34, 0.10, 0.42, { pos: [s * 0.40, 0.40, 0.16] })),
    ...Array.from({ length: 6 }, (_, i) => box(0.30, 0.012, 0.40, { pos: [0.25 + i * 0.04, 0.46, 0.16] })),
  ], rubber());

  add('vise', vise(), darkSteel());

  add('control_panel', [
    roundedBox(0.34, 0.44, 0.16, 0.02, 2, { pos: [0.86, 1.10, 0.48], rot: [0, -0.35, 0] }),
    roundedBox(0.24, 0.18, 0.01, 0.008, 1, { pos: [0.86, 1.17, 0.57], rot: [0, -0.35, 0] }),
    ...Array.from({ length: 3 }, (_, i) => cylinder(0.014, 0.014, 0.02, 10, { pos: [0.78, 0.99, 0.55 + i * 0.03], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.028, 0.028, 0.04, 14, { pos: [0.95, 1.00, 0.55], rot: [Math.PI / 2, 0, 0] }),
  ], panel());

  add('control_screen', [
    roundedBox(0.21, 0.15, 0.006, 0.006, 1, { pos: [0.86, 1.17, 0.577], rot: [0, -0.35, 0] }),
  ], screenMat());

  add('work_light', [
    torus(0.09, 0.018, 24, 8, { pos: [0.02, 1.02, 0.10], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.085, 0.085, 0.02, 24, { pos: [0.02, 1.02, 0.10] }),
    cylinder(0.012, 0.012, 0.22, 10, { pos: [0.02, 1.12, 0.10] }),
  ], orange());

  add('pneumatic_panel', [
    roundedBox(0.22, 0.30, 0.10, 0.015, 2, { pos: [-0.72, 1.25, -0.30] }),
    ...Array.from({ length: 5 }, (_, i) => cylinder(0.018, 0.018, 0.035, 10, { pos: [-0.80 + i * 0.04, 1.34, -0.24], rot: [Math.PI / 2, 0, 0] })),
    curve([[-0.72, 1.16, -0.30], [-0.56, 1.06, -0.28], [-0.42, 1.02, -0.24]], 0.010, { segments: 14, radial: 6 }),
  ], panel());

  add('nameplate', roundedBox(0.24, 0.06, 0.004, 0.003, 1, { pos: [0.55, 0.70, 0.615] }), orange());

  return g;
}
