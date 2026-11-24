// Observatory: slit dome, pier, equatorial fork mount, truss telescope and desk.
import { TAU, THREE, part, pbr, roundedBox, box, cylinder, tube, torus, lathe, curve, merge } from '../lib/geo.mjs';

const domeMat = () => pbr('#98a4ad', { roughness: 0.52, metalness: 0.18 });
const tubeMat = () => pbr('#dfe2dc', { roughness: 0.4, metalness: 0.22 });
const frame = () => pbr('#5b646b', { metalness: 0.55, roughness: 0.4 });
const dark = () => pbr('#2b3237', { roughness: 0.65, metalness: 0.2 });
const steel = () => pbr('#aab1b4', { metalness: 0.82, roughness: 0.24 });
const mirror = () => pbr('#b9d2d8', { metalness: 0.9, roughness: 0.08 });
const accent = () => pbr('#c47b2e', { roughness: 0.45 });
const screen = () => pbr('#2c6f83', { roughness: 0.2 });

export default function observatoryTelescope() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('dome_base', [
    torus(1.34, 0.045, 48, 10, { pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0] }),
    tube(1.40, 1.24, 0.38, 48, { pos: [0, 0.17, 0] }),
    ...Array.from({ length: 16 }, (_, i) => cylinder(0.035, 0.035, 0.06, 8, { pos: [Math.cos((i / 16) * TAU) * 1.24, 0.04, Math.sin((i / 16) * TAU) * 1.24] })),
    ...Array.from({ length: 12 }, (_, i) => box(0.10, 0.08, 0.14, { pos: [Math.cos((i / 12) * TAU) * 1.30, 0.39, Math.sin((i / 12) * TAU) * 1.30], rot: [0, -(i / 12) * TAU, 0] })),
  ], frame());

  add('dome_shell', [
    lathe([[1.26, 0], [1.24, 0.34], [1.13, 0.68], [0.92, 0.96], [0.62, 1.16], [0.30, 1.27], [0.02, 1.30]], 44,
      { pos: [0, 0.38, 0] }, { phiStart: 0.22, phiLength: TAU - 0.44 }),
    ...Array.from({ length: 5 }, (_, i) => torus(1.25 - i * 0.19, 0.018, 40, 6, {
      pos: [0, 0.38 + i * 0.23, 0], rot: [Math.PI / 2, 0, 0],
    })),
  ], domeMat());

  add('dome_slit_frame', [
    ...[-1, 1].map((s) => curve([[s * 1.22, 0.40, 0.24], [s * 1.16, 0.72, 0.20], [s * 0.92, 1.05, 0.14], [s * 0.48, 1.30, 0.08], [0, 1.40, 0]], 0.028, { segments: 22, radial: 7 })),
    ...[-1, 1].map((s) => box(0.04, 0.42, 0.04, { pos: [s * 1.10, 0.52, 0.22], rot: [0.2, 0, 0] })),
  ], frame());

  add('dome_shutters', [
    ...[-1, 1].map((s) => box(0.28, 1.08, 0.035, { pos: [s * 0.43, 0.88, 0.63], rot: [0, s * 0.62, 0] })),
    ...[-1, 1].map((s) => box(0.04, 1.05, 0.06, { pos: [s * 0.15, 0.90, 0.72], rot: [0, s * 0.30, 0] })),
    ...[-1, 1].map((s) => torus(0.045, 0.010, 14, 6, { pos: [s * 0.30, 0.54, 0.68] })),
  ], pbr('#eef0ea', { roughness: 0.42 }));

  add('pier', [
    cylinder(0.44, 0.52, 0.62, 28, { pos: [0, 0.68, 0] }),
    cylinder(0.30, 0.30, 1.10, 24, { pos: [0, 1.50, 0] }),
    torus(0.31, 0.025, 26, 8, { pos: [0, 1.05, 0], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 8 }, (_, i) => cylinder(0.022, 0.022, 0.10, 8, { pos: [Math.cos((i / 8) * TAU) * 0.46, 0.62, Math.sin((i / 8) * TAU) * 0.46] })),
  ], pbr('#b9b6aa', { roughness: 0.75 }));

  add('mount_base', [
    cylinder(0.36, 0.36, 0.18, 28, { pos: [0, 2.10, 0] }),
    cylinder(0.25, 0.25, 0.22, 24, { pos: [0, 2.28, 0] }),
    ...Array.from({ length: 6 }, (_, i) => box(0.12, 0.08, 0.16, { pos: [Math.cos((i / 6) * TAU) * 0.29, 2.20, Math.sin((i / 6) * TAU) * 0.29], rot: [0, -(i / 6) * TAU, 0] })),
  ], frame());

  add('fork', [
    ...[-1, 1].map((s) => roundedBox(0.16, 0.62, 0.22, 0.02, 2, { pos: [s * 0.40, 2.68, 0], rot: [0, 0, -s * 0.18] })),
    box(0.94, 0.16, 0.26, { pos: [0, 2.38, 0] }),
    ...[-1, 1].map((s) => cylinder(0.10, 0.10, 0.14, 20, { pos: [s * 0.31, 2.94, 0], rot: [0, 0, Math.PI / 2] })),
  ], frame());

  add('ra_axis', [
    cylinder(0.08, 0.08, 0.92, 20, { pos: [0, 2.94, 0], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => cylinder(0.14, 0.14, 0.06, 24, { pos: [s * 0.40, 2.94, 0], rot: [0, 0, Math.PI / 2] })),
    torus(0.16, 0.018, 22, 8, { pos: [0.52, 2.94, 0] }),
  ], steel());

  add('telescope_tube', [
    cylinder(0.34, 0.34, 1.70, 36, { pos: [0, 2.95, 0.10], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    ...[-0.55, 0, 0.55].map((z) => torus(0.35, 0.028, 34, 8, { pos: [0, 2.95 - Math.sin(0.28) * z, 0.10 + Math.cos(0.28) * z], rot: [0.28, 0, 0] })),
    ...Array.from({ length: 8 }, (_, i) => box(0.035, 0.035, 1.45, {
      pos: [Math.cos((i / 8) * TAU) * 0.28, 2.95 - Math.sin(0.28) * 0.05, 0.10],
      rot: [0.28, 0, (i / 8) * TAU],
    })),
    // Finder scope and its two brackets, parallel to the main tube.
    cylinder(0.075, 0.075, 0.62, 20, { pos: [0.48, 3.18, 0.36], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    cylinder(0.085, 0.085, 0.06, 20, { pos: [0.48, 3.31, 0.17], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    ...[-1, 1].map((s) => box(0.16, 0.035, 0.035, { pos: [0.39, 3.10 + s * 0.11, 0.30 + s * 0.05] })),
    // Focuser and eyepiece at the back of the tube.
    cylinder(0.10, 0.10, 0.18, 22, { pos: [0, 3.17, -0.72], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    cylinder(0.06, 0.06, 0.12, 18, { pos: [0, 3.18, -0.84], rot: [Math.PI / 2 + 0.28, 0, 0] }),
  ], tubeMat());

  add('primary_mirror', [
    lathe([[0.31, 0], [0.30, 0.03], [0.22, 0.08], [0.10, 0.11], [0.02, 0.12]], 40, { pos: [0, 2.95, -0.76], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    cylinder(0.33, 0.33, 0.05, 36, { pos: [0, 2.95, -0.72], rot: [Math.PI / 2 + 0.28, 0, 0] }),
  ], mirror());

  add('secondary_spider', [
    ...Array.from({ length: 4 }, (_, i) => box(0.018, 0.018, 0.62, {
      pos: [0, 2.95 + Math.sin(0.28) * 0.58, 0.10 + Math.cos(0.28) * 0.58],
      rot: [0.28, 0, (i / 4) * TAU],
    })),
    cylinder(0.09, 0.09, 0.10, 20, { pos: [0, 2.95 + Math.sin(0.28) * 0.58, 0.10 + Math.cos(0.28) * 0.58], rot: [0.28, 0, 0] }),
  ], steel());

  add('secondary_mirror', [
    cylinder(0.075, 0.055, 0.035, 24, { pos: [0, 2.95 + Math.sin(0.28) * 0.64, 0.10 + Math.cos(0.28) * 0.64], rot: [0.28, 0, 0] }),
  ], mirror());

  add('counterweight', [
    cylinder(0.045, 0.045, 0.62, 14, { pos: [0, 2.95 + Math.sin(0.28) * 1.14, 0.10 + Math.cos(0.28) * 1.14], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    cylinder(0.20, 0.20, 0.10, 26, { pos: [0, 2.95 + Math.sin(0.28) * 1.30, 0.10 + Math.cos(0.28) * 1.30], rot: [Math.PI / 2 + 0.28, 0, 0] }),
    cylinder(0.16, 0.16, 0.08, 24, { pos: [0, 2.95 + Math.sin(0.28) * 1.40, 0.10 + Math.cos(0.28) * 1.40], rot: [Math.PI / 2 + 0.28, 0, 0] }),
  ], dark());

  add('drive_motor', [
    ...[-1, 1].map((s) => cylinder(0.10, 0.10, 0.20, 22, { pos: [s * 0.52, 2.40, 0.10] })),
    ...[-1, 1].map((s) => cylinder(0.11, 0.11, 0.03, 22, { pos: [s * 0.52, 2.51, 0.10] })),
    ...[-1, 1].map((s) => cylinder(0.035, 0.035, 0.16, 12, { pos: [s * 0.52, 2.28, 0.10] })),
  ], accent());

  add('encoder', [
    ...[-1, 1].map((s) => cylinder(0.06, 0.06, 0.04, 20, { pos: [s * 0.61, 2.94, 0], rot: [0, 0, Math.PI / 2] })),
    ...[-1, 1].map((s) => torus(0.05, 0.008, 16, 6, { pos: [s * 0.635, 2.94, 0], rot: [0, Math.PI / 2, 0] })),
  ], steel());

  add('control_desk', [
    roundedBox(0.70, 0.10, 0.46, 0.02, 2, { pos: [1.10, 0.62, -0.20], rot: [0, -0.40, 0] }),
    ...[-1, 1].map((s) => box(0.05, 0.60, 0.05, { pos: [1.10 + s * 0.27, 0.32, -0.20] })),
    box(0.66, 0.05, 0.42, { pos: [1.10, 0.68, -0.18], rot: [0.18, -0.40, 0] }),
    roundedBox(0.34, 0.24, 0.02, 0.01, 1, { pos: [1.10, 0.92, -0.10], rot: [0.10, -0.40, 0] }),
  ], frame());

  add('desk_screen', [
    box(0.30, 0.20, 0.008, { pos: [1.10, 0.94, -0.08], rot: [0.10, -0.40, 0] }),
    ...Array.from({ length: 5 }, (_, i) => box(0.22, 0.012, 0.004, { pos: [1.10, 0.88 + i * 0.025, -0.068], rot: [0.10, -0.40, 0] })),
  ], screen());

  add('ladder', [
    ...[-1, 1].map((s) => curve([[s * 0.38, 0.02, 0.90], [s * 0.36, 0.70, 1.10], [s * 0.30, 1.42, 1.18]], 0.025, { segments: 16, radial: 6 })),
    ...Array.from({ length: 7 }, (_, i) => cylinder(0.018, 0.018, 0.72, 8, { pos: [0, 0.12 + i * 0.20, 0.94 + i * 0.04], rot: [0, 0, Math.PI / 2] })),
  ], steel());

  add('nameplate', roundedBox(0.22, 0.06, 0.006, 0.003, 1, { pos: [0, 0.55, 1.02] }), accent());

  return g;
}
