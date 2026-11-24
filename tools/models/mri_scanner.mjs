// MRI scanner: superconducting magnet cryostat, gradient and RF coils, patient
// table, console and chiller. The bore runs along Z.
import { TAU, THREE, part, pbr, roundedBox, box, cylinder, tube, torus, merge, curve } from '../lib/geo.mjs';

const shell = () => pbr('#e7e8e3', { roughness: 0.42, metalness: 0.08 });
const trim = () => pbr('#8a949b', { roughness: 0.38, metalness: 0.45 });
const dark = () => pbr('#2c3338', { roughness: 0.62, metalness: 0.25 });
const bore = () => pbr('#d8dbd7', { roughness: 0.55 });
const copper = () => pbr('#a96a3e', { metalness: 0.75, roughness: 0.32 });
const steel = () => pbr('#aeb5b8', { metalness: 0.8, roughness: 0.26 });
const blue = () => pbr('#2d7088', { roughness: 0.2, metalness: 0.2 });
const rubber = () => pbr('#252a2d', { roughness: 0.9 });

export default function mriScanner() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('base_skid', [
    roundedBox(2.30, 0.18, 1.70, 0.03, 3, { pos: [0, 0.09, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.26, 0.10, 0.30, { pos: [sx * 0.92, 0.22, sz * 0.60] }))),
    ...[-1, 1].map((s) => roundedBox(0.50, 0.20, 0.24, 0.02, 2, { pos: [s * 0.78, 0.27, 0] })),
  ], trim());

  add('magnet_shell', [
    tube(0.98, 0.78, 1.20, 48, { pos: [0, 1.22, 0], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => cylinder(0.98, 0.98, 0.10, 48, { pos: [0, 1.22, s * 0.62], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((s) => torus(0.88, 0.035, 40, 10, { pos: [0, 1.22, s * 0.67], rot: [0, 0, 0] })),
  ], shell());

  add('cryostat_rings', [
    ...[-1, 1].map((s) => torus(0.91, 0.028, 42, 10, { pos: [0, 1.22, s * 0.46], rot: [0, 0, 0] })),
    torus(0.91, 0.028, 42, 10, { pos: [0, 1.22, 0] }),
    ...Array.from({ length: 8 }, (_, i) => cylinder(0.028, 0.028, 0.94, 8, {
      pos: [Math.cos((i / 8) * TAU) * 0.925, 1.22 + Math.sin((i / 8) * TAU) * 0.925, 0],
      rot: [Math.PI / 2, 0, 0],
    })),
  ], steel());

  add('bore_lining', [
    tube(0.67, 0.60, 1.22, 44, { pos: [0, 1.22, 0], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => torus(0.635, 0.032, 40, 10, { pos: [0, 1.22, s * 0.63] })),
    ...[-1, 1].map((s) => cylinder(0.60, 0.60, 0.03, 44, { pos: [0, 1.22, s * 0.64], rot: [Math.PI / 2, 0, 0] })),
  ], bore());

  add('gradient_coils', [
    ...[-0.34, 0, 0.34].map((z) => torus(0.555, 0.026, 40, 8, { pos: [0, 1.22, z] })),
    ...Array.from({ length: 12 }, (_, i) => box(0.04, 0.10, 0.72, {
      pos: [Math.cos((i / 12) * TAU) * 0.57, 1.22 + Math.sin((i / 12) * TAU) * 0.57, 0],
      rot: [0, 0, (i / 12) * TAU],
    })),
  ], copper());

  add('rf_body_coil', [
    ...[-1, 1].map((s) => torus(0.505, 0.014, 36, 8, { pos: [0, 1.22, s * 0.28] })),
    ...Array.from({ length: 10 }, (_, i) => cylinder(0.008, 0.008, 0.56, 6, {
      pos: [Math.cos((i / 10) * TAU) * 0.505, 1.22 + Math.sin((i / 10) * TAU) * 0.505, 0],
      rot: [Math.PI / 2, 0, 0],
    })),
  ], pbr('#d4b45a', { metalness: 0.65, roughness: 0.3 }));

  add('helium_ports', [
    ...[-1, 1].map((s) => cylinder(0.055, 0.055, 0.18, 14, { pos: [s * 0.62, 2.10, 0.10], rot: [0, 0, s * 0.3] })),
    ...[-1, 1].map((s) => torus(0.058, 0.010, 16, 6, { pos: [s * 0.65, 2.19, 0.10], rot: [Math.PI / 2, 0, 0] })),
    curve([[-0.62, 2.10, 0.10], [-0.45, 2.32, -0.18], [-0.20, 2.34, -0.36]], 0.022, { segments: 20, radial: 7 }),
  ], steel());

  add('quench_vent', [
    cylinder(0.12, 0.12, 0.16, 20, { pos: [0.22, 2.18, -0.10] }),
    cylinder(0.055, 0.055, 0.30, 14, { pos: [0.22, 2.38, -0.10] }),
    torus(0.075, 0.012, 18, 6, { pos: [0.22, 2.54, -0.10], rot: [Math.PI / 2, 0, 0] }),
    box(0.12, 0.04, 0.10, { pos: [0.22, 2.10, -0.10] }),
  ], dark());

  add('patient_table', [
    roundedBox(0.56, 0.10, 1.72, 0.03, 3, { pos: [0, 0.79, -0.42] }),
    roundedBox(0.44, 0.06, 0.42, 0.03, 2, { pos: [0, 0.68, -0.10] }),
    ...[-1, 1].map((s) => roundedBox(0.10, 0.10, 0.10, 0.01, 1, { pos: [s * 0.19, 0.69, -0.86] })),
    cylinder(0.05, 0.05, 0.26, 16, { pos: [0, 0.62, -0.05] }),
  ], shell());

  add('table_rails', [
    ...[-1, 1].map((s) => cylinder(0.022, 0.022, 1.62, 10, { pos: [s * 0.28, 0.70, -0.38] })),
    ...[-1, 1].map((s) => box(0.30, 0.10, 0.34, { pos: [s * 0.31, 0.72, -1.10] })),
    ...[-1, 1].map((s) => cylinder(0.035, 0.035, 0.06, 12, { pos: [s * 0.31, 0.66, -1.10], rot: [0, 0, Math.PI / 2] })),
  ], steel());

  add('control_console', [
    roundedBox(0.70, 0.70, 0.34, 0.03, 3, { pos: [1.42, 0.55, 1.00], rot: [0, -0.38, 0] }),
    roundedBox(0.10, 0.08, 0.26, 0.01, 1, { pos: [1.26, 0.98, 0.92], rot: [0, -0.38, 0] }),
    box(0.56, 0.06, 0.20, { pos: [1.42, 0.93, 1.06], rot: [0.22, -0.38, 0] }),
    ...[-1, 1].map((s) => cylinder(0.02, 0.02, 0.10, 8, { pos: [1.42 + s * 0.20, 0.90, 1.12], rot: [0, 0, Math.PI / 2] })),
  ], trim());

  add('console_screen', [
    roundedBox(0.46, 0.30, 0.02, 0.01, 2, { pos: [1.42, 1.25, 0.98], rot: [0.12, -0.38, 0] }),
    box(0.05, 0.05, 0.05, { pos: [1.20, 1.20, 0.86] }),
  ], blue());

  add('chiller', [
    roundedBox(0.52, 0.94, 0.56, 0.03, 2, { pos: [1.18, 0.57, -0.40] }),
    ...Array.from({ length: 5 }, (_, i) => box(0.40, 0.02, 0.03, { pos: [1.18, 0.28 + i * 0.09, 0.09] })),
    cylinder(0.10, 0.10, 0.12, 20, { pos: [1.18, 1.06, -0.40] }),
    ...Array.from({ length: 6 }, (_, i) => box(0.02, 0.02, 0.20, { pos: [1.18, 1.06, -0.30], rot: [0, (i / 6) * Math.PI, 0] })),
  ], trim());

  add('coolant_hoses', [
    curve([[1.18, 0.22, -0.16], [0.98, 0.30, -0.02], [0.76, 0.50, 0.10], [0.68, 0.86, 0.20]], 0.028, { segments: 26, radial: 8 }),
    curve([[1.18, 0.20, -0.62], [0.90, 0.28, -0.72], [0.60, 0.50, -0.68], [0.48, 0.70, -0.54]], 0.022, { segments: 26, radial: 8 }),
    ...[-1, 1].map((s) => torus(0.04, 0.008, 14, 6, { pos: [1.18, 0.22, -0.16 + s * 0.30], rot: [0, 0, Math.PI / 2] })),
  ], rubber());

  add('work_light', [
    torus(0.66, 0.020, 40, 8, { pos: [0, 1.22, 0.72] }),
    ...Array.from({ length: 8 }, (_, i) => cylinder(0.018, 0.018, 0.05, 8, {
      pos: [Math.cos((i / 8) * TAU) * 0.72, 1.22 + Math.sin((i / 8) * TAU) * 0.72, 0.70],
      rot: [Math.PI / 2, 0, 0],
    })),
  ], pbr('#e8f0e2', { roughness: 0.3, emissive: '#c9d8c2', emissiveIntensity: 0.5 }));

  add('nameplate', roundedBox(0.22, 0.07, 0.006, 0.004, 1, { pos: [0, 0.72, 0.86] }), blue());

  return g;
}
