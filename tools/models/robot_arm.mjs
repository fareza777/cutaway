// A six-axis industrial robot in a working pose: base, turret, upper arm,
// forearm and a parallel-jaw gripper. Joints are drawn as real motor-and-gearbox
// stacks so a cutaway exposes the drives rather than a hollow tube.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const paintOrange = () => pbr('#e07b2a', { roughness: 0.44, metalness: 0.08 });
const paintDark = () => pbr('#2b3138', { roughness: 0.5, metalness: 0.25 });
const steel = () => pbr('#b7bfc4', { metalness: 0.78, roughness: 0.28 });
const darkSteel = () => pbr('#4c555c', { metalness: 0.68, roughness: 0.38 });
const rubber = () => pbr('#1f2428', { roughness: 0.92 });
const copper = () => pbr('#b06d42', { metalness: 0.8, roughness: 0.34 });
const screenMat = () => pbr('#3f7f8c', { roughness: 0.2, metalness: 0.15 });

const SHOULDER = [0, 0.60, 0];
const ELBOW = [0.58, 1.04, 0];
const WRIST = [1.06, 1.18, 0.06];

function along(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

function link(a, b, width, height, depth, material) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return roundedBox(length, height, depth, Math.min(0.025, height * 0.2), 3, {
    pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [0, 0, along(a, b)],
  });
}

function jointStack(x, y, z, radius, axis) {
  const rotation = axis === 'z' ? [0, 0, 0] : axis === 'x' ? [0, Math.PI / 2, 0] : [Math.PI / 2, 0, 0];
  return merge([
    cylinder(radius, radius, 0.09, 28, { pos: [x, y, z], rot: rotation }),
    torus(radius * 0.92, radius * 0.12, 28, 10, { pos: [x, y, z], rot: rotation }),
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * TAU;
      const dx = axis === 'z' ? Math.cos(angle) * radius * 0.62 : 0;
      const dy = axis === 'x' ? Math.cos(angle) * radius * 0.62 : axis === 'y' ? 0 : Math.sin(angle) * radius * 0.62;
      const dz = axis === 'z' ? Math.sin(angle) * radius * 0.62 : axis === 'x' ? Math.sin(angle) * radius * 0.62 : 0;
      return cylinder(radius * 0.09, radius * 0.09, 0.105, 8, { pos: [x + dx, y + (axis === 'y' ? Math.cos(angle) * radius * 0.62 : dy), z + dz], rot: rotation });
    }),
  ]);
}

export default function robotArm() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('base_plate', [
    cylinder(0.34, 0.34, 0.045, 40, { pos: [0, 0.0225, 0] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return cylinder(0.020, 0.020, 0.055, 10, { pos: [Math.sin(a) * 0.28, 0.03, Math.cos(a) * 0.28] });
    }),
  ], darkSteel());

  add('base_housing', [
    cylinder(0.265, 0.30, 0.18, 40, { pos: [0, 0.14, 0] }),
    torus(0.27, 0.018, 40, 8, { pos: [0, 0.23, 0], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU;
      return box(0.05, 0.10, 0.03, { pos: [Math.sin(a) * 0.245, 0.14, Math.cos(a) * 0.245], rot: [0, a, 0] });
    }),
  ], paintOrange());

  add('j1_gearbox', [
    torus(0.20, 0.035, 36, 10, { pos: [0, 0.255, 0], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.17, 0.17, 0.05, 32, { pos: [0, 0.255, 0] }),
  ], darkSteel());

  add('j1_motor', [
    cylinder(0.072, 0.072, 0.20, 24, { pos: [0.24, 0.255, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.082, 0.082, 0.035, 24, { pos: [0.35, 0.255, 0], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 6 }, (_, i) => torus(0.076, 0.006, 24, 6, { pos: [0.18 + i * 0.025, 0.255, 0], rot: [0, Math.PI / 2, 0] })),
  ], steel());

  add('turret', [
    roundedBox(0.38, 0.16, 0.30, 0.03, 3, { pos: [0, 0.35, 0] }),
    cylinder(0.12, 0.12, 0.08, 28, { pos: [0.10, 0.44, 0] }),
    roundedBox(0.08, 0.22, 0.32, 0.02, 2, { pos: [-0.12, 0.46, 0] }),
  ], paintOrange());

  add('j2_yoke', [
    ...[-1, 1].map((s) => roundedBox(0.20, 0.26, 0.045, 0.02, 2, { pos: [0.02, 0.58, s * 0.145] })),
    cylinder(0.10, 0.10, 0.26, 30, { pos: [0, 0.58, 0], rot: [Math.PI / 2, 0, 0] }),
  ], paintDark());

  add('j2_motor', [
    jointStack(0.02, 0.58, 0.24, 0.095, 'z'),
    cylinder(0.055, 0.055, 0.16, 20, { pos: [0.18, 0.58, 0.24], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.065, 0.065, 0.03, 20, { pos: [0.27, 0.58, 0.24], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('upper_arm', [
    link(SHOULDER, ELBOW, 0.22, 0.24, 0.18, paintOrange()),
    cylinder(0.105, 0.105, 0.20, 30, { pos: [0.25, 0.76, 0], rot: [Math.PI / 2, 0, 0] }),
    roundedBox(0.34, 0.05, 0.05, 0.015, 2, { pos: [0.28, 0.76, 0.105] }),
  ], paintOrange());

  add('upper_arm_ribs', [
    ...[-1, 1].map((s) => box(0.30, 0.12, 0.02, { pos: [0.30, 0.80, s * 0.10], rot: [0, 0, 0.69] })),
    ...[-1, 1].map((s) => box(0.06, 0.16, 0.02, { pos: [0.16, 0.68, s * 0.10] })),
  ], paintDark());

  add('j3_motor', [
    jointStack(ELBOW[0], ELBOW[1], ELBOW[2], 0.092, 'z'),
    cylinder(0.050, 0.050, 0.15, 20, { pos: [ELBOW[0] - 0.02, ELBOW[1], ELBOW[2] + 0.22], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('elbow_housing', [
    cylinder(0.115, 0.115, 0.17, 32, { pos: [ELBOW[0], ELBOW[1], ELBOW[2]], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => roundedBox(0.10, 0.16, 0.04, 0.018, 2, { pos: [ELBOW[0] + 0.02, ELBOW[1], ELBOW[2] + s * 0.10] })),
  ], paintOrange());

  add('forearm', [
    link(ELBOW, WRIST, 0.16, 0.18, 0.15, paintOrange()),
    roundedBox(0.20, 0.03, 0.03, 0.01, 2, { pos: [0.82, 1.11, 0.11] }),
  ], paintOrange());

  add('j4_motor', [
    cylinder(0.055, 0.055, 0.20, 22, {
      pos: [0.82, 1.10, 0.05],
      rot: [0, 0, Math.PI / 2 + 0.25],
    }),
    torus(0.062, 0.010, 22, 8, { pos: [0.72, 1.07, 0.05], rot: [0, 0, Math.PI / 2 + 0.25] }),
    cylinder(0.030, 0.030, 0.06, 14, { pos: [0.94, 1.14, 0.05], rot: [0, 0, Math.PI / 2 + 0.25] }),
  ], darkSteel());

  add('wrist_roll', [
    cylinder(0.085, 0.085, 0.12, 26, {
      pos: [WRIST[0], WRIST[1], WRIST[2]],
      rot: [0, 0, Math.PI / 2 + 0.25],
    }),
    torus(0.090, 0.012, 26, 8, { pos: [WRIST[0] - 0.04, WRIST[1] - 0.01, WRIST[2]], rot: [0, 0, Math.PI / 2 + 0.25] }),
  ], steel());

  add('j5_motor', [
    jointStack(WRIST[0], WRIST[1], WRIST[2], 0.070, 'z'),
  ], darkSteel());

  add('wrist_fork', [
    ...[-1, 1].map((s) => roundedBox(0.13, 0.11, 0.035, 0.015, 2, { pos: [WRIST[0] + 0.09, WRIST[1], WRIST[2] + s * 0.065] })),
    box(0.10, 0.03, 0.11, { pos: [WRIST[0] + 0.05, WRIST[1] + 0.05, WRIST[2]] }),
  ], paintDark());

  add('j6_motor', [
    cylinder(0.058, 0.058, 0.17, 22, { pos: [WRIST[0] + 0.13, WRIST[1], WRIST[2]], rot: [0, 0, Math.PI / 2] }),
    torus(0.062, 0.010, 22, 8, { pos: [WRIST[0] + 0.21, WRIST[1], WRIST[2]], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('tool_flange', [
    cylinder(0.072, 0.072, 0.035, 26, { pos: [WRIST[0] + 0.23, WRIST[1], WRIST[2]], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU;
      return cylinder(0.008, 0.008, 0.045, 8, { pos: [WRIST[0] + 0.235, WRIST[1] + Math.sin(a) * 0.052, WRIST[2] + Math.cos(a) * 0.052], rot: [0, 0, Math.PI / 2] });
    }),
  ], steel());

  add('gripper_body', [
    roundedBox(0.17, 0.11, 0.13, 0.02, 3, { pos: [WRIST[0] + 0.31, WRIST[1], WRIST[2]] }),
    box(0.10, 0.04, 0.10, { pos: [WRIST[0] + 0.26, WRIST[1] + 0.06, WRIST[2]] }),
    cylinder(0.038, 0.038, 0.14, 18, { pos: [WRIST[0] + 0.27, WRIST[1] + 0.10, WRIST[2]], rot: [0, 0, Math.PI / 2] }),
  ], paintDark());

  add('gripper_fingers', [
    ...[-1, 1].map((s) => merge([
      box(0.14, 0.035, 0.035, { pos: [WRIST[0] + 0.44, WRIST[1], WRIST[2] + s * 0.075] }),
      box(0.04, 0.13, 0.035, { pos: [WRIST[0] + 0.38, WRIST[1] + 0.05, WRIST[2] + s * 0.075] }),
    ])),
  ], steel());

  add('gripper_pads', [
    ...[-1, 1].map((s) => roundedBox(0.08, 0.10, 0.022, 0.008, 1, { pos: [WRIST[0] + 0.47, WRIST[1], WRIST[2] + s * 0.095] })),
  ], rubber());

  add('gripper_cylinder', [
    cylinder(0.045, 0.045, 0.12, 20, { pos: [WRIST[0] + 0.30, WRIST[1] + 0.13, WRIST[2]], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.020, 0.020, 0.06, 12, { pos: [WRIST[0] + 0.37, WRIST[1] + 0.13, WRIST[2]], rot: [0, 0, Math.PI / 2] }),
  ], copper());

  add('air_hoses', [
    curve([[WRIST[0] + 0.30, WRIST[1] + 0.16, WRIST[2] + 0.02], [WRIST[0] + 0.20, WRIST[1] + 0.18, WRIST[2] + 0.04], [WRIST[0] + 0.06, WRIST[1] + 0.14, WRIST[2] + 0.06]], 0.010, { segments: 16, radial: 7 }),
    curve([[WRIST[0] + 0.30, WRIST[1] + 0.16, WRIST[2] - 0.02], [WRIST[0] + 0.20, WRIST[1] + 0.18, WRIST[2] - 0.04], [WRIST[0] + 0.06, WRIST[1] + 0.14, WRIST[2] - 0.06]], 0.010, { segments: 16, radial: 7 }),
  ], rubber());

  add('cable_harness', [
    curve([
      [-0.10, 0.30, -0.20], [-0.06, 0.48, -0.20], [0.06, 0.62, -0.18],
      [0.24, 0.76, -0.16], [0.48, 0.92, -0.14], [0.72, 1.04, -0.10],
      [0.92, 1.10, -0.04], [1.02, 1.12, 0.02],
    ], 0.016, { segments: 40, radial: 8 }),
    ...Array.from({ length: 5 }, (_, i) => torus(0.022, 0.004, 14, 5, {
      pos: [-0.10 + i * 0.04, 0.32 + i * 0.06, -0.20 + i * 0.01],
      rot: [0, 0, 0],
    })),
  ], rubber());

  add('counterbalance', [
    cylinder(0.035, 0.035, 0.32, 18, { pos: [0.14, 0.54, -0.16], rot: [0, 0, -0.55] }),
    cylinder(0.028, 0.028, 0.10, 14, { pos: [0.02, 0.40, -0.16], rot: [0, 0, -0.55] }),
    cylinder(0.028, 0.028, 0.10, 14, { pos: [0.27, 0.67, -0.16], rot: [0, 0, -0.55] }),
  ], steel());

  add('brakes', [
    cylinder(0.085, 0.085, 0.018, 24, { pos: [0.02, 0.58, -0.19], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.075, 0.075, 0.016, 24, { pos: [ELBOW[0], ELBOW[1], ELBOW[2] - 0.13], rot: [Math.PI / 2, 0, 0] }),
  ], darkSteel());

  add('encoders', [
    cylinder(0.025, 0.025, 0.05, 14, { pos: [0.02, 0.58, 0.31], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.022, 0.022, 0.04, 12, { pos: [ELBOW[0], ELBOW[1], ELBOW[2] + 0.18], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.020, 0.020, 0.04, 12, { pos: [WRIST[0] + 0.23, WRIST[1], WRIST[2] + 0.10], rot: [Math.PI / 2, 0, 0] }),
  ], copper());

  add('control_cabinet', [
    roundedBox(0.36, 0.62, 0.26, 0.025, 3, { pos: [-0.58, 0.33, 0.38] }),
    ...Array.from({ length: 9 }, (_, i) => box(0.26, 0.008, 0.02, { pos: [-0.58, 0.14 + i * 0.038, 0.515] })),
    roundedBox(0.12, 0.08, 0.01, 0.008, 1, { pos: [-0.58, 0.52, 0.516] }),
    cylinder(0.018, 0.018, 0.03, 12, { pos: [-0.40, 0.33, 0.38], rot: [0, 0, Math.PI / 2] }),
  ], paintDark());

  add('teach_pendant', [
    roundedBox(0.13, 0.20, 0.035, 0.015, 2, { pos: [-0.58, 0.72, 0.50], rot: [0.15, 0, 0] }),
    roundedBox(0.09, 0.11, 0.006, 0.006, 1, { pos: [-0.58, 0.75, 0.519], rot: [0.15, 0, 0] }),
    ...Array.from({ length: 3 }, (_, i) => cylinder(0.010, 0.010, 0.012, 8, { pos: [-0.61 + i * 0.03, 0.66, 0.52], rot: [Math.PI / 2, 0, 0] })),
  ], paintOrange());

  add('pendant_cable', curve([
    [-0.58, 0.64, 0.50], [-0.60, 0.56, 0.44], [-0.58, 0.50, 0.34], [-0.56, 0.48, 0.26],
  ], 0.008, { segments: 18, radial: 6 }), rubber());

  add('nameplate', roundedBox(0.14, 0.045, 0.004, 0.003, 1, { pos: [-0.58, 0.22, 0.512] }), screenMat());

  return g;
}
