// A three-blade utility wind turbine, cut open at the nacelle. The rotor axis
// runs along +Z, the tower along +Y. Every internal component is placed from
// the same drivetrain line, so the low-speed shaft, gearbox and generator stay
// coaxial when the nacelle is sectioned.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const shell = () => pbr('#eef1f1', { roughness: 0.46, metalness: 0.04 });
const shellDark = () => pbr('#cfd6d9', { roughness: 0.5, metalness: 0.08 });
const steel = () => pbr('#aeb7bd', { metalness: 0.72, roughness: 0.33 });
const darkSteel = () => pbr('#3b444b', { metalness: 0.62, roughness: 0.4 });
const copper = () => pbr('#b46d3d', { metalness: 0.82, roughness: 0.32 });
const orange = () => pbr('#d8872c', { roughness: 0.44, metalness: 0.08 });
const rubber = () => pbr('#202529', { roughness: 0.9 });
const bladeSkin = () => pbr('#f4f5f2', { roughness: 0.42, metalness: 0.03 });
const glass = () => pbr('#7d9aa4', { roughness: 0.18, metalness: 0.2 });

const HUB_Y = 2.3;
const HUB_Z = 0.46;
const ROTOR = [0, HUB_Y, HUB_Z];
const BLADE_LENGTH = 1.28;

function bladeAt(angle) {
  const pieces = [];
  const segments = 9;
  let inner = 0.16;
  for (let i = 0; i < segments; i += 1) {
    const t = (i + 1) / segments;
    const outer = 0.16 + t * BLADE_LENGTH;
    const chord = 0.25 * (1 - 0.68 * t) + 0.018;
    const thickness = 0.06 * (1 - 0.62 * t) + 0.008;
    const mid = (inner + outer) / 2;
    const twist = -0.42 * (1 - t) ** 1.3;
    pieces.push(roundedBox(chord, (outer - inner) * 1.03, thickness,
      Math.min(0.012, thickness * 0.35), 2, { pos: [0, mid, 0], rot: [0, twist, 0] }));
    inner = outer;
  }
  // Root ferrule and the bonded blade root.
  pieces.push(cylinder(0.048, 0.072, 0.18, 18, { pos: [0, 0.12, 0] }));
  pieces.push(cylinder(0.072, 0.09, 0.06, 18, { pos: [0, 0.20, 0] }));
  const blade = merge(pieces);
  blade.rotateZ(angle);
  blade.translate(ROTOR[0], ROTOR[1], ROTOR[2]);
  return blade;
}

function bladeRoot(angle) {
  const x = Math.sin(angle) * 0.20;
  const y = Math.cos(angle) * 0.20;
  return torus(0.085, 0.022, 28, 10, {
    pos: [ROTOR[0] + x, ROTOR[1] + y, ROTOR[2] - 0.02],
    rot: [0, 0, 0],
  });
}

function yawDrive(angle) {
  const x = Math.sin(angle) * 0.14;
  const z = Math.cos(angle) * 0.14;
  return merge([
    cylinder(0.038, 0.038, 0.12, 16, { pos: [x, 2.14, z] }),
    cylinder(0.048, 0.048, 0.02, 16, { pos: [x, 2.08, z] }),
    cylinder(0.024, 0.024, 0.035, 12, { pos: [x, 2.205, z] }),
  ]);
}

export default function windTurbine() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  // ----------------------------------------------------------------- tower
  add('tower', [
    cylinder(0.115, 0.205, 2.24, 40, { pos: [0, 1.12, 0] }),
    cylinder(0.26, 0.29, 0.12, 40, { pos: [0, 0.06, 0] }),
    ...[0.42, 0.95, 1.48, 2.02].map((y) => torus(0.12 + (2.02 - y) * 0.035, 0.008, 32, 6, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] })),
    // Door frame and handle at the tower foot.
    roundedBox(0.11, 0.25, 0.02, 0.018, 2, { pos: [0, 0.20, 0.205] }),
    cylinder(0.006, 0.006, 0.018, 8, { pos: [0.035, 0.22, 0.218], rot: [Math.PI / 2, 0, 0] }),
  ], shell());

  add('tower_ladder', [
    ...[-1, 1].map((s) => box(0.012, 1.9, 0.012, { pos: [s * 0.055, 1.0, 0.10] })),
    ...Array.from({ length: 16 }, (_, i) => box(0.105, 0.008, 0.008, { pos: [0, 0.18 + i * 0.115, 0.10] })),
  ], steel());

  add('foundation_bolts', Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU;
    return cylinder(0.012, 0.012, 0.035, 8, { pos: [Math.sin(a) * 0.245, 0.135, Math.cos(a) * 0.245] });
  }), darkSteel());

  // --------------------------------------------------------------- yaw deck
  add('yaw_bearing', [
    torus(0.16, 0.025, 40, 12, { pos: [0, 2.245, 0], rot: [Math.PI / 2, 0, 0] }),
    tube(0.19, 0.155, 0.05, 40, { pos: [0, 2.245, 0] }),
    ...Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * TAU;
      return cylinder(0.009, 0.009, 0.03, 8, { pos: [Math.sin(a) * 0.175, 2.245, Math.cos(a) * 0.175], rot: [0, 0, 0] });
    }),
  ], darkSteel());

  add('yaw_drives', [0, 2.094, 4.188].map(yawDrive), orange());

  add('bedplate', [
    roundedBox(0.34, 0.07, 0.92, 0.02, 2, { pos: [0, 2.24, -0.22] }),
    ...[-0.36, -0.12, 0.12].map((z) => box(0.30, 0.035, 0.04, { pos: [0, 2.18, z] })),
  ], darkSteel());

  // ------------------------------------------------------------- nacelle skin
  add('nacelle_shell', [
    roundedBox(0.46, 0.50, 0.98, 0.17, 4, { pos: [0, 2.34, -0.16] }),
    // Tapered rear cap and the top service hatch.
    cylinder(0.19, 0.23, 0.16, 28, { pos: [0, 2.34, -0.66], rot: [Math.PI / 2, 0, 0] }),
    roundedBox(0.30, 0.035, 0.30, 0.015, 2, { pos: [0, 2.585, -0.22] }),
    ...[-1, 1].map((s) => box(0.006, 0.22, 0.55, { pos: [s * 0.232, 2.34, -0.12] })),
    // Cooling louvres at the back.
    ...Array.from({ length: 7 }, (_, i) => box(0.26, 0.012, 0.025, { pos: [0, 2.20 + i * 0.032, -0.64] })),
  ], shell());

  add('nacelle_hatch_hinges', [-0.10, 0.10].map((x) => box(0.035, 0.018, 0.05, { pos: [x, 2.60, -0.36] })), steel());

  // ------------------------------------------------------------- drivetrain
  add('low_speed_shaft', [
    cylinder(0.062, 0.062, 0.56, 24, { pos: [0, 2.32, 0.12], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.10, 0.10, 0.035, 24, { pos: [0, 2.32, 0.38], rot: [Math.PI / 2, 0, 0] }),
  ], steel());

  add('main_bearing', [
    torus(0.092, 0.026, 32, 12, { pos: [0, 2.32, 0.33] }),
    tube(0.115, 0.085, 0.075, 32, { pos: [0, 2.32, 0.33], rot: [Math.PI / 2, 0, 0] }),
  ], darkSteel());

  add('gearbox_housing', [
    roundedBox(0.32, 0.36, 0.34, 0.055, 3, { pos: [0, 2.32, -0.10] }),
    ...[-1, 1].map((s) => cylinder(0.09, 0.09, 0.03, 24, { pos: [s * 0.17, 2.32, -0.10], rot: [0, 0, Math.PI / 2] })),
    ...Array.from({ length: 5 }, (_, i) => box(0.30, 0.012, 0.30, { pos: [0, 2.16 + i * 0.045, -0.10] })),
  ], orange());

  add('planetary_stage', [
    cylinder(0.052, 0.052, 0.22, 24, { pos: [0, 2.32, 0.02], rot: [Math.PI / 2, 0, 0] }),
    ...[0, 2.094, 4.188].map((a) => cylinder(0.065, 0.065, 0.11, 20, {
      pos: [Math.sin(a) * 0.12, 2.32 + Math.cos(a) * 0.12, 0.02],
      rot: [Math.PI / 2, 0, 0],
    })),
    tube(0.17, 0.145, 0.10, 32, { pos: [0, 2.32, 0.02], rot: [Math.PI / 2, 0, 0] }),
  ], copper());

  add('high_speed_shaft', [
    cylinder(0.027, 0.027, 0.48, 18, { pos: [0, 2.32, -0.47], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.045, 0.045, 0.03, 18, { pos: [0, 2.32, -0.66], rot: [Math.PI / 2, 0, 0] }),
  ], steel());

  add('brake', [
    cylinder(0.095, 0.095, 0.025, 28, { pos: [0, 2.32, -0.59], rot: [Math.PI / 2, 0, 0] }),
    torus(0.10, 0.012, 28, 8, { pos: [0, 2.32, -0.59] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return box(0.035, 0.08, 0.012, { pos: [Math.sin(a) * 0.06, 2.32 + Math.cos(a) * 0.06, -0.59], rot: [0, 0, -a] });
    }),
  ], darkSteel());

  // --------------------------------------------------------------- generator
  add('generator_stator', [
    tube(0.17, 0.135, 0.40, 32, { pos: [0, 2.32, -0.92], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 9 }, (_, i) => torus(0.175, 0.008, 32, 6, {
      pos: [0, 2.32, -1.10 + i * 0.045], rot: [Math.PI / 2, 0, 0],
    })),
  ], steel());

  add('generator_rotor', [
    cylinder(0.12, 0.12, 0.42, 28, { pos: [0, 2.32, -0.92], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * TAU;
      return box(0.035, 0.035, 0.38, { pos: [Math.sin(a) * 0.12, 2.32 + Math.cos(a) * 0.12, -0.92] });
    }),
    cylinder(0.045, 0.045, 0.06, 18, { pos: [0, 2.32, -1.13], rot: [Math.PI / 2, 0, 0] }),
  ], copper());

  add('converter', [
    roundedBox(0.20, 0.24, 0.18, 0.012, 2, { pos: [0.13, 2.12, -0.52] }),
    ...Array.from({ length: 6 }, (_, i) => box(0.012, 0.16, 0.012, { pos: [0.065 + i * 0.026, 2.12, -0.43] })),
    roundedBox(0.11, 0.05, 0.11, 0.006, 1, { pos: [0.13, 2.12, -0.42] }),
  ], darkSteel());

  add('transformer', [
    roundedBox(0.18, 0.18, 0.16, 0.01, 2, { pos: [-0.12, 2.12, -0.58] }),
    ...Array.from({ length: 8 }, (_, i) => box(0.012, 0.16, 0.14, { pos: [-0.20 + i * 0.023, 2.12, -0.58] })),
    ...[-1, 1].map((s) => cylinder(0.018, 0.018, 0.06, 12, { pos: [-0.12 + s * 0.06, 2.24, -0.58] })),
  ], steel());

  add('radiator', [
    roundedBox(0.26, 0.14, 0.05, 0.012, 2, { pos: [0, 2.50, -0.55] }),
    ...Array.from({ length: 10 }, (_, i) => box(0.22, 0.006, 0.045, { pos: [0, 2.445 + i * 0.012, -0.55] })),
    cylinder(0.012, 0.012, 0.22, 10, { pos: [0.15, 2.50, -0.50], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('service_crane', [
    box(0.035, 0.035, 0.62, { pos: [0.15, 2.55, -0.22] }),
    cylinder(0.035, 0.035, 0.035, 16, { pos: [0.15, 2.51, -0.27] }),
    curve([[0.15, 2.50, -0.27], [0.15, 2.42, -0.30], [0.15, 2.40, -0.34]], 0.006, { segments: 10, radial: 6 }),
    box(0.045, 0.012, 0.08, { pos: [0.15, 2.585, -0.50] }),
  ], orange());

  add('anemometer', [
    cylinder(0.010, 0.012, 0.22, 10, { pos: [0, 2.68, -0.42] }),
    cylinder(0.022, 0.022, 0.035, 14, { pos: [0, 2.79, -0.42] }),
    ...[0, 2.094, 4.188].map((a) => {
      const x = Math.sin(a) * 0.075;
      const z = -0.42 + Math.cos(a) * 0.075;
      return merge([
        cylinder(0.004, 0.004, 0.09, 8, { pos: [x * 0.55, 2.80, -0.42 + (z + 0.42) * 0.55], rot: [Math.PI / 2, 0, -a] }),
        cylinder(0.018, 0.018, 0.022, 14, { pos: [x, 2.80, z], rot: [Math.PI / 2, 0, 0] }),
      ]);
    }),
  ], steel());

  // ------------------------------------------------------------------- rotor
  add('blades', [0, 2.094, 4.188].map(bladeAt), bladeSkin());
  add('blade_tips', [0, 2.094, 4.188].map((a) => {
    const r = 0.16 + BLADE_LENGTH * 0.97;
    return roundedBox(0.05, 0.07, 0.052, 0.012, 2, {
      pos: [Math.sin(a) * r, HUB_Y + Math.cos(a) * r, HUB_Z],
      rot: [0, 0, -a],
    });
  }), orange());

  add('hub', [
    cylinder(0.20, 0.20, 0.20, 32, { pos: [0, HUB_Y, HUB_Z], rot: [Math.PI / 2, 0, 0] }),
    torus(0.19, 0.018, 32, 8, { pos: [0, HUB_Y, HUB_Z + 0.10] }),
    ...Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU;
      return cylinder(0.008, 0.008, 0.02, 8, { pos: [Math.sin(a) * 0.16, HUB_Y + Math.cos(a) * 0.16, HUB_Z + 0.10], rot: [Math.PI / 2, 0, 0] });
    }),
  ], shellDark());

  add('spinner', [
    cylinder(0.018, 0.20, 0.30, 32, { pos: [0, HUB_Y, HUB_Z + 0.22], rot: [Math.PI / 2, 0, 0] }),
    torus(0.055, 0.008, 24, 6, { pos: [0, HUB_Y, HUB_Z + 0.36] }),
  ], shell());

  add('pitch_bearings', [0, 2.094, 4.188].map(bladeRoot), darkSteel());

  add('pitch_actuators', [0, 2.094, 4.188].map((a) => {
    const r = 0.11;
    return merge([
      cylinder(0.026, 0.026, 0.16, 14, {
        pos: [Math.sin(a) * r, HUB_Y + Math.cos(a) * r, HUB_Z - 0.02],
        rot: [Math.PI / 2, 0, -a],
      }),
      cylinder(0.012, 0.012, 0.10, 10, {
        pos: [Math.sin(a) * (r + 0.05), HUB_Y + Math.cos(a) * (r + 0.05), HUB_Z + 0.03],
        rot: [Math.PI / 2, 0, -a],
      }),
    ]);
  }), orange());

  add('rotor_lock', [
    cylinder(0.075, 0.075, 0.025, 24, { pos: [0, 2.32, -0.71], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU;
      return cylinder(0.010, 0.010, 0.05, 8, { pos: [Math.sin(a) * 0.05, 2.32 + Math.cos(a) * 0.05, -0.71], rot: [Math.PI / 2, 0, 0] });
    }),
  ], steel());

  add('nameplate', roundedBox(0.12, 0.035, 0.004, 0.003, 1, { pos: [0.13, 2.05, 0.34] }), orange());

  return g;
}
