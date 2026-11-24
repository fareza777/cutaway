// A self-propelled combine harvester, header lowered and unloading auger folded
// out. The crop path runs from the cutter bar through the feeder house, around
// the threshing drum, over the straw walkers and down through the sieves; the
// grain tank and engine sit above and behind that flow.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const green = () => pbr('#3f6f3a', { roughness: 0.5, metalness: 0.12 });
const greenDark = () => pbr('#294b2b', { roughness: 0.55, metalness: 0.15 });
const yellow = () => pbr('#d9a52c', { roughness: 0.48, metalness: 0.08 });
const steel = () => pbr('#b5bdc1', { metalness: 0.76, roughness: 0.3 });
const darkSteel = () => pbr('#4b5358', { metalness: 0.66, roughness: 0.4 });
const rubber = () => pbr('#23282b', { roughness: 0.94 });
const glass = () => pbr('#6d99a3', { roughness: 0.18, metalness: 0.18 });
const grain = () => pbr('#c9a24a', { roughness: 0.86 });
const orange = () => pbr('#d47f2b', { roughness: 0.46 });

const FRONT_Z = 0.72;
const HEADER_Z = 1.62;

function wheel(radius, width, x, z) {
  // The axle runs across the machine (X), so the tyre's cylinder axis has to
  // lie on X too. Rotating it about X instead would face the wheel forward
  // like a disc and leave the tread blocks orbiting a different axis.
  const bits = [
    cylinder(radius, radius, width, 30, { pos: [x, radius, z], rot: [0, 0, Math.PI / 2] }),
    cylinder(radius * 0.56, radius * 0.56, width * 1.04, 24, { pos: [x, radius, z], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => torus(radius * 0.82, radius * 0.055, 26, 8, { pos: [x + s * width * 0.42, radius, z], rot: [0, Math.PI / 2, 0] })),
    ...Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * TAU;
      return box(width * 0.92, radius * 0.10, radius * 0.11, {
        pos: [x, radius + Math.sin(a) * radius, z + Math.cos(a) * radius],
        rot: [a, 0, 0],
      });
    }),
  ];
  return merge(bits);
}

function reelBat(angle) {
  const r = 0.36;
  return merge([
    box(2.05, 0.025, 0.045, { pos: [0, 1.17 + Math.cos(angle) * r, HEADER_Z + Math.sin(angle) * r], rot: [angle, 0, 0] }),
    ...[-1, 1].map((s) => cylinder(0.012, 0.012, 0.10, 8, { pos: [s * 1.03, 1.17 + Math.cos(angle) * r, HEADER_Z + Math.sin(angle) * r], rot: [angle, 0, 0] })),
  ]);
}

function headerTooth(x) {
  return box(0.025, 0.012, 0.10, { pos: [x, 0.30, 1.92], rot: [0.35, 0, 0] });
}

export default function combineHarvester() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  // ------------------------------------------------------------------ chassis
  add('chassis', [
    roundedBox(1.55, 0.30, 2.40, 0.05, 3, { pos: [0, 0.48, -0.15] }),
    ...[-1, 1].map((s) => roundedBox(0.14, 0.36, 2.10, 0.03, 2, { pos: [s * 0.72, 0.56, -0.15] })),
    box(1.45, 0.08, 0.22, { pos: [0, 0.36, FRONT_Z] }),
  ], greenDark());

  add('body_panels', [
    ...[-1, 1].map((s) => roundedBox(0.035, 0.75, 1.80, 0.02, 2, { pos: [s * 0.80, 0.85, -0.20] })),
    roundedBox(1.58, 0.06, 0.90, 0.02, 2, { pos: [0, 1.24, -0.55] }),
    ...Array.from({ length: 5 }, (_, i) => box(0.02, 0.40, 0.50, { pos: [0.82, 0.86, -0.90 + i * 0.34] })),
  ], green());

  // ---------------------------------------------------------------------- cab
  add('cab_shell', [
    roundedBox(0.52, 0.72, 0.62, 0.04, 3, { pos: [-0.45, 1.42, 0.62] }),
    roundedBox(0.56, 0.06, 0.68, 0.02, 2, { pos: [-0.45, 1.80, 0.62] }),
    ...[-1, 1].map((s) => box(0.05, 0.22, 0.04, { pos: [-0.45, 1.88, 0.62 + s * 0.27] })),
  ], green());

  add('cab_glass', [
    roundedBox(0.44, 0.46, 0.015, 0.01, 1, { pos: [-0.45, 1.48, 0.925] }),
    ...[-1, 1].map((s) => roundedBox(0.015, 0.44, 0.46, 0.01, 1, { pos: [-0.45 + s * 0.255, 1.48, 0.62] })),
    roundedBox(0.42, 0.40, 0.015, 0.01, 1, { pos: [-0.45, 1.48, 0.315] }),
  ], glass());

  add('cab_interior', [
    roundedBox(0.26, 0.10, 0.26, 0.02, 2, { pos: [-0.45, 1.28, 0.58] }),
    roundedBox(0.26, 0.28, 0.05, 0.02, 2, { pos: [-0.45, 1.40, 0.44] }),
    cylinder(0.025, 0.025, 0.20, 12, { pos: [-0.45, 1.34, 0.78], rot: [0.5, 0, 0] }),
    torus(0.10, 0.012, 20, 6, { pos: [-0.45, 1.45, 0.78], rot: [0.5, 0, 0] }),
    roundedBox(0.10, 0.14, 0.04, 0.01, 1, { pos: [-0.58, 1.40, 0.83], rot: [0, 0.3, 0] }),
  ], darkSteel());

  add('cab_lights', [
    ...[-1, 1].map((s) => cylinder(0.035, 0.035, 0.025, 14, { pos: [-0.45 + s * 0.20, 1.78, 0.94], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((s) => box(0.025, 0.08, 0.05, { pos: [-0.72 + s * 0.54, 1.75, 0.94] })),
  ], yellow());

  add('mirrors', [-1, 1].map((s) => merge([
    cylinder(0.008, 0.008, 0.22, 8, { pos: [-0.45 + s * 0.31, 1.70, 0.78], rot: [0, 0, s * 0.6] }),
    roundedBox(0.10, 0.14, 0.02, 0.01, 1, { pos: [-0.45 + s * 0.39, 1.80, 0.78] }),
  ])), darkSteel());

  add('ladder', [
    ...[-1, 1].map((s) => box(0.025, 0.72, 0.025, { pos: [-0.60 + s * 0.10, 0.80, 0.94], rot: [0, 0, 0.10] })),
    ...Array.from({ length: 5 }, (_, i) => box(0.16, 0.018, 0.018, { pos: [-0.55, 0.52 + i * 0.14, 0.94] })),
  ], steel());

  // ------------------------------------------------------------------- header
  add('header_frame', [
    roundedBox(2.20, 0.16, 0.30, 0.03, 2, { pos: [0, 0.40, HEADER_Z] }),
    ...[-1, 1].map((s) => roundedBox(0.10, 0.42, 0.42, 0.03, 2, { pos: [s * 1.02, 0.42, HEADER_Z] })),
    roundedBox(2.10, 0.10, 0.36, 0.03, 2, { pos: [0, 0.20, HEADER_Z + 0.10] }),
  ], yellow());

  add('cutter_bar', [
    box(2.16, 0.05, 0.10, { pos: [0, 0.27, HEADER_Z + 0.22] }),
    ...Array.from({ length: 28 }, (_, i) => headerTooth(-1.04 + (i / 27) * 2.08)),
  ], steel());

  add('reel', [
    cylinder(0.035, 0.035, 2.12, 18, { pos: [0, 1.17, HEADER_Z], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => torus(0.34, 0.022, 28, 8, { pos: [s * 1.02, 1.17, HEADER_Z], rot: [0, Math.PI / 2, 0] })),
    ...Array.from({ length: 5 }, (_, i) => reelBat((i / 5) * TAU)),
  ], yellow());

  add('reel_supports', [
    ...[-1, 1].map((s) => merge([
      box(0.06, 0.40, 0.06, { pos: [s * 1.02, 0.92, HEADER_Z - 0.06] }),
      cylinder(0.025, 0.025, 0.16, 12, { pos: [s * 1.02, 1.17, HEADER_Z], rot: [0, 0, Math.PI / 2] }),
    ])),
  ], darkSteel());

  add('header_auger', [
    cylinder(0.13, 0.13, 1.96, 24, { pos: [0, 0.44, HEADER_Z + 0.08], rot: [0, 0, Math.PI / 2] }),
    curve(Array.from({ length: 44 }, (_, i) => {
      const t = i / 43;
      const a = t * TAU * 4;
      return [-0.92 + t * 1.84, 0.44 + Math.sin(a) * 0.14, HEADER_Z + 0.08 + Math.cos(a) * 0.14];
    }), 0.012, { segments: 110, radial: 5 }),
    ...[-1, 1].map((s) => cylinder(0.035, 0.035, 0.16, 12, { pos: [s * 1.02, 0.44, HEADER_Z + 0.08], rot: [0, 0, Math.PI / 2] })),
  ], darkSteel());

  add('header_lift_cylinders', [-1, 1].map((s) => merge([
    cylinder(0.045, 0.045, 0.44, 16, { pos: [s * 0.52, 0.56, 1.28], rot: [0.9, 0, 0] }),
    cylinder(0.022, 0.022, 0.26, 12, { pos: [s * 0.52, 0.42, 1.42], rot: [0.9, 0, 0] }),
  ])), orange());

  add('feeder_house', [
    roundedBox(0.72, 0.42, 0.86, 0.03, 2, { pos: [0, 0.72, 1.02], rot: [0.22, 0, 0] }),
    ...[-1, 1].map((s) => box(0.04, 0.34, 0.76, { pos: [s * 0.36, 0.72, 1.02], rot: [0.22, 0, 0] })),
    ...Array.from({ length: 4 }, (_, i) => box(0.60, 0.02, 0.04, { pos: [0, 0.56 + i * 0.08, 1.12], rot: [0.22, 0, 0] })),
  ], green());

  // ------------------------------------------------------------- threshing
  add('threshing_drum', [
    cylinder(0.30, 0.30, 1.24, 30, { pos: [0, 0.90, -0.12], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return box(1.18, 0.05, 0.06, { pos: [0, 0.90 + Math.sin(a) * 0.31, -0.12 + Math.cos(a) * 0.31], rot: [a, 0, 0] });
    }),
    cylinder(0.045, 0.045, 1.36, 16, { pos: [0, 0.90, -0.12], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('concave', [
    ...Array.from({ length: 7 }, (_, i) => box(1.20, 0.018, 0.10, {
      pos: [0, 0.62 + Math.abs(i - 3) * 0.025, -0.36 + i * 0.07],
      rot: [0.35 - i * 0.08, 0, 0],
    })),
    ...[-1, 1].map((s) => box(0.04, 0.26, 0.58, { pos: [s * 0.63, 0.68, -0.12], rot: [0.2, 0, 0] })),
  ], steel());

  add('straw_walkers', [
    ...Array.from({ length: 4 }, (_, i) => roundedBox(0.24, 0.06, 1.10, 0.02, 2, { pos: [-0.42 + i * 0.28, 0.68, -0.58], rot: [0.10, 0, 0] })),
    ...Array.from({ length: 4 }, (_, i) => box(0.22, 0.06, 0.04, { pos: [-0.42 + i * 0.28, 0.72, -0.30], rot: [0.10, 0, 0] })),
  ], darkSteel());

  add('cleaning_fan', [
    cylinder(0.22, 0.22, 0.52, 26, { pos: [0.38, 0.56, -0.52], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * TAU;
      return box(0.46, 0.10, 0.02, { pos: [0.38, 0.56 + Math.sin(a) * 0.14, -0.52 + Math.cos(a) * 0.14], rot: [a, 0, 0] });
    }),
    cylinder(0.03, 0.03, 0.60, 12, { pos: [0.38, 0.56, -0.52], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('sieves', [
    roundedBox(0.86, 0.04, 0.52, 0.01, 1, { pos: [0.18, 0.40, -0.72], rot: [0.12, 0, 0] }),
    ...Array.from({ length: 8 }, (_, i) => box(0.80, 0.015, 0.03, { pos: [0.18, 0.43 + i * 0.006, -0.94 + i * 0.06], rot: [0.12, 0, 0] })),
    roundedBox(0.70, 0.035, 0.40, 0.01, 1, { pos: [-0.08, 0.35, -0.60], rot: [-0.10, 0, 0] }),
  ], steel());

  // --------------------------------------------------------------- grain tank
  add('grain_tank', [
    roundedBox(1.10, 0.44, 0.86, 0.03, 2, { pos: [0.10, 1.48, -0.62] }),
    ...[-1, 1].map((s) => box(0.02, 0.36, 0.76, { pos: [0.10 + s * 0.56, 1.48, -0.62] })),
    ...Array.from({ length: 4 }, (_, i) => box(1.02, 0.02, 0.03, { pos: [0.10, 1.30 + i * 0.10, -0.62] })),
  ], green());

  add('grain', roundedBox(1.00, 0.10, 0.76, 0.02, 2, { pos: [0.10, 1.74, -0.62] }), grain());

  add('grain_auger', [
    cylinder(0.075, 0.075, 0.90, 20, { pos: [0.10, 1.24, -0.62], rot: [0, 0, Math.PI / 2] }),
    curve(Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      const a = t * TAU * 3;
      return [-0.32 + t * 0.84, 1.24 + Math.sin(a) * 0.08, -0.62 + Math.cos(a) * 0.08];
    }), 0.010, { segments: 70, radial: 5 }),
  ], steel());

  add('unloading_auger', [
    cylinder(0.085, 0.085, 1.30, 22, { pos: [0.72, 1.48, -0.20], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.085, 0.085, 0.34, 22, { pos: [1.36, 1.34, -0.20], rot: [0, 0, 0.55] }),
    cylinder(0.095, 0.060, 0.18, 22, { pos: [1.48, 1.16, -0.20], rot: [0, 0, 0.55] }),
    torus(0.095, 0.012, 22, 8, { pos: [0.10, 1.48, -0.20], rot: [0, Math.PI / 2, 0] }),
    ...Array.from({ length: 4 }, (_, i) => cylinder(0.010, 0.010, 0.06, 8, { pos: [0.40 + i * 0.22, 1.56, -0.20] })),
  ], yellow());

  // ------------------------------------------------------------------- engine
  add('engine', [
    roundedBox(0.62, 0.40, 0.70, 0.03, 2, { pos: [0.10, 0.90, -1.20] }),
    ...Array.from({ length: 4 }, (_, i) => cylinder(0.075, 0.075, 0.18, 18, { pos: [-0.10 + i * 0.16, 1.16, -1.20] })),
    ...Array.from({ length: 4 }, (_, i) => box(0.12, 0.05, 0.58, { pos: [-0.10 + i * 0.16, 1.06, -1.20] })),
    cylinder(0.045, 0.045, 0.24, 14, { pos: [0.34, 1.02, -1.20], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('radiator', [
    roundedBox(0.56, 0.42, 0.12, 0.02, 2, { pos: [0.10, 0.98, -1.58] }),
    ...Array.from({ length: 9 }, (_, i) => box(0.50, 0.34, 0.008, { pos: [0.10, 0.98, -1.64 + i * 0.015] })),
    cylinder(0.035, 0.035, 0.10, 12, { pos: [0.10, 1.24, -1.58] }),
  ], steel());

  add('exhaust', [
    cylinder(0.045, 0.045, 0.55, 16, { pos: [0.32, 1.30, -1.30] }),
    torus(0.048, 0.008, 16, 6, { pos: [0.32, 1.56, -1.30], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.030, 0.030, 0.20, 12, { pos: [0.32, 1.10, -1.30], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('chaff_spreader', [
    cylinder(0.24, 0.24, 0.06, 24, { pos: [0, 0.55, -1.52], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return box(0.10, 0.02, 0.12, { pos: [0, 0.55 + Math.sin(a) * 0.13, -1.52 + Math.cos(a) * 0.13], rot: [a, 0, 0] });
    }),
  ], steel());

  // -------------------------------------------------------------------- wheels
  add('front_wheels', [wheel(0.46, 0.26, -0.86, 0.52), wheel(0.46, 0.26, 0.86, 0.52)], rubber());
  add('rear_wheels', [wheel(0.28, 0.18, -0.66, -1.16), wheel(0.28, 0.18, 0.66, -1.16)], rubber());

  add('front_axle', [
    cylinder(0.05, 0.05, 1.70, 18, { pos: [0, 0.48, 0.52], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => cylinder(0.10, 0.10, 0.22, 18, { pos: [s * 0.72, 0.48, 0.52], rot: [0, 0, Math.PI / 2] })),
  ], darkSteel());

  add('rear_axle', [
    cylinder(0.035, 0.035, 1.34, 14, { pos: [0, 0.28, -1.16], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => box(0.08, 0.20, 0.10, { pos: [s * 0.55, 0.28, -1.16] })),
  ], darkSteel());

  add('lights', [
    ...[-1, 1].map((s) => cylinder(0.045, 0.045, 0.03, 16, { pos: [s * 0.60, 1.18, 0.98], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.035, 0.035, 0.05, 12, { pos: [0, 1.90, 0.62] }),
  ], yellow());

  add('nameplate', roundedBox(0.20, 0.05, 0.004, 0.003, 1, { pos: [0.42, 0.82, 0.99] }), orange());

  return g;
}
