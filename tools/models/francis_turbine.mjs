// Francis hydro turbine: spiral casing, stay and guide vanes, runner, draft tube,
// vertical shaft and generator.
import { TAU, THREE, part, pbr, roundedBox, box, cylinder, tube, torus, lathe, curve, merge } from '../lib/geo.mjs';

const casing = () => pbr('#3f6f78', { roughness: 0.5, metalness: 0.28 });
const steel = () => pbr('#aeb5b8', { metalness: 0.8, roughness: 0.28 });
const dark = () => pbr('#30383d', { roughness: 0.6, metalness: 0.3 });
const copper = () => pbr('#a96c3f', { metalness: 0.78, roughness: 0.32 });
const concrete = () => pbr('#a7a49a', { roughness: 0.88 });
const accent = () => pbr('#d08a2c', { roughness: 0.46 });
const blue = () => pbr('#2b6f85', { roughness: 0.2, metalness: 0.25 });

export default function francisTurbine() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  add('foundation', [
    roundedBox(2.30, 0.24, 2.30, 0.03, 3, { pos: [0, 0.12, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.30, 0.14, 0.30, { pos: [sx * 0.92, 0.26, sz * 0.92] }))),
    ...Array.from({ length: 12 }, (_, i) => cylinder(0.025, 0.025, 0.08, 8, { pos: [Math.cos((i / 12) * TAU) * 0.88, 0.28, Math.sin((i / 12) * TAU) * 0.88] })),
  ], concrete());

  const spiral = [];
  for (let i = 0; i <= 44; i += 1) {
    const t = i / 44;
    const a = t * TAU * 1.45;
    const r = 1.16 - t * 0.44;
    spiral.push([Math.cos(a) * r, 1.24, Math.sin(a) * r]);
  }
  add('spiral_casing', [
    curve(spiral, 0.155, { segments: 90, radial: 12 }),
    torus(0.66, 0.07, 34, 10, { pos: [0, 1.24, 0], rot: [Math.PI / 2, 0, 0] }),
  ], casing());

  add('stay_ring', [
    torus(0.86, 0.045, 40, 10, { pos: [0, 1.24, 0], rot: [Math.PI / 2, 0, 0] }),
    torus(0.60, 0.035, 34, 8, { pos: [0, 1.24, 0], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 12 }, (_, i) => box(0.20, 0.16, 0.045, {
      pos: [Math.cos((i / 12) * TAU) * 0.73, 1.24, Math.sin((i / 12) * TAU) * 0.73],
      rot: [0, -(i / 12) * TAU, 0],
    })),
  ], steel());

  add('stay_vanes', [
    ...Array.from({ length: 12 }, (_, i) => box(0.04, 0.22, 0.20, {
      pos: [Math.cos((i / 12) * TAU) * 0.68, 1.24, Math.sin((i / 12) * TAU) * 0.68],
      rot: [0, -(i / 12) * TAU + 0.28, 0],
    })),
  ], casing());

  add('guide_vanes', [
    ...Array.from({ length: 14 }, (_, i) => box(0.035, 0.24, 0.15, {
      pos: [Math.cos((i / 14) * TAU) * 0.50, 1.24, Math.sin((i / 14) * TAU) * 0.50],
      rot: [0, -(i / 14) * TAU + 0.48, 0],
    })),
    ...Array.from({ length: 14 }, (_, i) => cylinder(0.018, 0.018, 0.10, 8, {
      pos: [Math.cos((i / 14) * TAU) * 0.50, 1.40, Math.sin((i / 14) * TAU) * 0.50],
    })),
  ], copper());

  add('guide_ring', [
    torus(0.53, 0.025, 32, 8, { pos: [0, 1.43, 0], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 6 }, (_, i) => cylinder(0.018, 0.018, 0.22, 8, {
      pos: [Math.cos((i / 6) * TAU) * 0.58, 1.50, Math.sin((i / 6) * TAU) * 0.58],
    })),
    torus(0.62, 0.018, 34, 8, { pos: [0, 1.62, 0], rot: [Math.PI / 2, 0, 0] }),
  ], accent());

  add('runner_hub', [
    cylinder(0.30, 0.24, 0.40, 28, { pos: [0, 1.22, 0] }),
    lathe([[0.24, -0.20], [0.31, -0.08], [0.32, 0.08], [0.25, 0.20]], 32, { pos: [0, 1.22, 0] }),
    cylinder(0.065, 0.065, 0.42, 18, { pos: [0, 1.22, 0] }),
  ], steel());

  add('runner_blades', [
    ...Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * TAU;
      return merge([
        box(0.20, 0.26, 0.045, { pos: [Math.cos(a) * 0.38, 1.19, Math.sin(a) * 0.38], rot: [0.30, -a + 0.55, 0.22] }),
        box(0.13, 0.20, 0.035, { pos: [Math.cos(a) * 0.50, 1.19, Math.sin(a) * 0.50], rot: [0.30, -a + 0.55, 0.22] }),
      ]);
    }),
    torus(0.55, 0.035, 34, 8, { pos: [0, 1.03, 0], rot: [Math.PI / 2, 0, 0] }),
  ], copper());

  add('draft_tube', [
    lathe([[0.56, 0], [0.62, 0.28], [0.78, 0.58], [0.94, 0.86]], 36, { pos: [0, 0.28, 0] }),
    torus(0.56, 0.03, 32, 8, { pos: [0, 0.98, 0], rot: [Math.PI / 2, 0, 0] }),
    torus(0.96, 0.035, 40, 8, { pos: [0, 0.30, 0], rot: [Math.PI / 2, 0, 0] }),
  ], casing());

  add('shaft', [
    cylinder(0.075, 0.075, 1.20, 20, { pos: [0, 1.98, 0] }),
    cylinder(0.12, 0.12, 0.08, 22, { pos: [0, 1.65, 0] }),
    cylinder(0.10, 0.10, 0.06, 20, { pos: [0, 2.48, 0] }),
    torus(0.09, 0.012, 20, 6, { pos: [0, 2.30, 0], rot: [Math.PI / 2, 0, 0] }),
  ], steel());

  add('generator_stator', [
    cylinder(0.62, 0.62, 0.72, 36, { pos: [0, 2.72, 0] }),
    ...Array.from({ length: 18 }, (_, i) => box(0.03, 0.60, 0.06, {
      pos: [Math.cos((i / 18) * TAU) * 0.63, 2.72, Math.sin((i / 18) * TAU) * 0.63],
      rot: [0, -(i / 18) * TAU, 0],
    })),
    torus(0.63, 0.035, 38, 8, { pos: [0, 2.38, 0], rot: [Math.PI / 2, 0, 0] }),
    torus(0.63, 0.035, 38, 8, { pos: [0, 3.06, 0], rot: [Math.PI / 2, 0, 0] }),
  ], dark());

  add('generator_rotor', [
    cylinder(0.44, 0.44, 0.62, 30, { pos: [0, 2.72, 0] }),
    ...Array.from({ length: 10 }, (_, i) => box(0.10, 0.52, 0.05, {
      pos: [Math.cos((i / 10) * TAU) * 0.47, 2.72, Math.sin((i / 10) * TAU) * 0.47],
      rot: [0, -(i / 10) * TAU, 0],
    })),
  ], copper());

  add('generator_top', [
    cylinder(0.55, 0.55, 0.10, 34, { pos: [0, 3.14, 0] }),
    cylinder(0.30, 0.30, 0.20, 24, { pos: [0, 3.26, 0] }),
    ...Array.from({ length: 8 }, (_, i) => cylinder(0.025, 0.025, 0.12, 8, { pos: [Math.cos((i / 8) * TAU) * 0.40, 3.22, Math.sin((i / 8) * TAU) * 0.40] })),
    torus(0.30, 0.020, 24, 6, { pos: [0, 3.36, 0], rot: [Math.PI / 2, 0, 0] }),
  ], steel());

  add('exciter', [
    cylinder(0.16, 0.16, 0.28, 22, { pos: [0.0, 3.56, 0] }),
    ...Array.from({ length: 6 }, (_, i) => torus(0.165, 0.008, 22, 6, { pos: [0, 3.46 + i * 0.04, 0], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.06, 0.06, 0.12, 14, { pos: [0, 3.74, 0] }),
  ], accent());

  add('inlet_valve', [
    cylinder(0.20, 0.20, 0.18, 24, { pos: [1.18, 1.24, 0.56], rot: [0, 0.4, Math.PI / 2] }),
    cylinder(0.07, 0.07, 0.20, 16, { pos: [1.36, 1.24, 0.48], rot: [0, 0.4, Math.PI / 2] }),
    torus(0.12, 0.020, 22, 8, { pos: [1.44, 1.24, 0.45], rot: [0, Math.PI / 2 + 0.4, 0] }),
    ...Array.from({ length: 4 }, (_, i) => box(0.10, 0.02, 0.02, { pos: [1.50, 1.24 + (i - 1.5) * 0.05, 0.45], rot: [0, 0.4, 0] })),
  ], steel());

  add('governor', [
    roundedBox(0.34, 0.52, 0.26, 0.02, 2, { pos: [-1.05, 0.58, 0.42] }),
    roundedBox(0.22, 0.14, 0.02, 0.01, 1, { pos: [-1.05, 0.68, 0.56] }),
    ...Array.from({ length: 3 }, (_, i) => cylinder(0.02, 0.02, 0.04, 8, { pos: [-1.13 + i * 0.08, 0.52, 0.57], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.05, 0.05, 0.36, 12, { pos: [-1.05, 0.86, 0.42] }),
    curve([[-1.05, 0.86, 0.42], [-0.90, 1.02, 0.50], [-0.68, 1.18, 0.50]], 0.020, { segments: 18, radial: 7 }),
  ], accent());

  add('cooling_coils', [
    ...Array.from({ length: 5 }, (_, i) => torus(0.70, 0.018, 40, 6, { pos: [0, 2.34 + i * 0.08, 0], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((s) => cylinder(0.025, 0.025, 0.60, 10, { pos: [s * 0.70, 2.50, 0] })),
    curve([[-0.70, 2.30, 0], [-0.86, 1.92, 0.10], [-0.86, 1.50, 0.16]], 0.024, { segments: 20, radial: 7 }),
  ], steel());

  add('work_light', [
    ...[-1, 1].map((s) => box(0.10, 0.10, 0.08, { pos: [s * 0.90, 1.72, 0.38] })),
    ...[-1, 1].map((s) => cylinder(0.025, 0.025, 0.22, 8, { pos: [s * 0.90, 1.60, 0.38] })),
  ], pbr('#f0dfa0', { emissive: '#c9a94e', emissiveIntensity: 0.6, roughness: 0.3 }));

  add('nameplate', roundedBox(0.24, 0.07, 0.006, 0.004, 1, { pos: [0.64, 0.34, 0.94] }), blue());

  return g;
}
