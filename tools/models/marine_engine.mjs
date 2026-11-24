// A medium-speed inline-six marine diesel, sectioned through the crankcase.
// The crankshaft runs along X and the six cylinders stand on Y; the turbocharger,
// exhaust manifold and charge-air cooler sit on the service side so a cutaway
// can follow the whole air path from filter to cylinder head.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const blockPaint = () => pbr('#31514c', { roughness: 0.56, metalness: 0.18 });
const headPaint = () => pbr('#263d3a', { roughness: 0.5, metalness: 0.22 });
const steel = () => pbr('#b4bcc0', { metalness: 0.78, roughness: 0.3 });
const darkSteel = () => pbr('#4a5257', { metalness: 0.66, roughness: 0.4 });
const copper = () => pbr('#b26d3f', { metalness: 0.8, roughness: 0.34 });
const brass = () => pbr('#c6a15a', { metalness: 0.86, roughness: 0.26 });
const orange = () => pbr('#d4872f', { roughness: 0.46, metalness: 0.1 });
const rubber = () => pbr('#22272a', { roughness: 0.9 });
const hot = () => pbr('#8a5a45', { metalness: 0.55, roughness: 0.62 });

const X = [-0.85, -0.51, -0.17, 0.17, 0.51, 0.85];
const PIN_Y = 0.30;
const PIN_Z = -0.06;

function gearDisc(radius, thickness, teeth, x, y, z, axis = 'x') {
  const bits = [cylinder(radius, radius, thickness, 36)];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * TAU;
    bits.push(box(radius * 0.06, radius * 0.08, thickness * 0.92, {
      pos: [Math.cos(a) * radius, Math.sin(a) * radius, 0],
      rot: [0, 0, a],
    }));
  }
  return place(merge(bits), {
    rot: axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0],
    pos: [x, y, z],
  });
}

function cam(x, phase) {
  return merge([
    cylinder(0.045, 0.045, 0.045, 20, { pos: [x, 1.30, -0.20], rot: [0, 0, Math.PI / 2] }),
    box(0.045, 0.085, 0.065, { pos: [x, 1.32, -0.20], rot: [phase, 0, 0] }),
  ]);
}

function fuelLine(x) {
  return curve([
    [-0.70, 1.02, 0.30],
    [-0.52, 1.12, 0.26],
    [x - 0.05, 1.22, 0.18],
    [x, 1.30, 0.10],
    [x, 1.33, 0.10],
  ], 0.006, { segments: 26, radial: 6 });
}

export default function marineEngine() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  // --------------------------------------------------------------- structure
  add('bedplate', [
    roundedBox(2.30, 0.16, 0.94, 0.035, 3, { pos: [0, 0.08, 0] }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => roundedBox(0.22, 0.10, 0.16, 0.03, 2, { pos: [sx * 0.92, 0.05, sz * 0.40] }))),
    ...[-1, 1].map((s) => box(2.18, 0.035, 0.06, { pos: [0, 0.18, s * 0.42] })),
  ], darkSteel());

  add('crankcase', [
    roundedBox(2.02, 0.40, 0.82, 0.03, 3, { pos: [0, 0.40, 0] }),
    ...[-1, 1].flatMap((s) => X.map((x) => roundedBox(0.24, 0.22, 0.028, 0.015, 1, {
      pos: [x, 0.40, s * 0.42],
    }))),
    ...[-1, 1].map((s) => box(1.9, 0.035, 0.83, { pos: [0, 0.21, s * 0.0] })),
  ], blockPaint());

  add('cylinder_block', [
    roundedBox(2.02, 0.42, 0.78, 0.03, 3, { pos: [0, 0.79, 0] }),
    ...X.map((x) => roundedBox(0.30, 0.10, 0.70, 0.02, 2, { pos: [x, 1.02, 0] })),
    ...[-1, 1].flatMap((s) => X.map((x) => box(0.26, 0.30, 0.02, { pos: [x, 0.78, s * 0.40] }))),
  ], blockPaint());

  add('cylinder_liners', X.map((x) => tube(0.135, 0.108, 0.54, 32, { pos: [x, 0.86, 0] })), steel());

  add('pistons_a', [0, 2, 4].map((i) => {
    const x = X[i];
    return merge([
      cylinder(0.103, 0.103, 0.13, 28, { pos: [x, 0.82, 0] }),
      ...Array.from({ length: 3 }, (_, r) => torus(0.104, 0.0045, 28, 6, { pos: [x, 0.775 + r * 0.035, 0], rot: [Math.PI / 2, 0, 0] })),
    ]);
  }), steel());

  add('pistons_b', [1, 3, 5].map((i) => {
    const x = X[i];
    return merge([
      cylinder(0.103, 0.103, 0.13, 28, { pos: [x, 0.70, 0] }),
      ...Array.from({ length: 3 }, (_, r) => torus(0.104, 0.0045, 28, 6, { pos: [x, 0.655 + r * 0.035, 0], rot: [Math.PI / 2, 0, 0] })),
    ]);
  }), steel());

  add('connecting_rods', X.map((x, i) => {
    const top = i % 2 === 0 ? 0.77 : 0.65;
    const bits = [
      box(0.038, top - PIN_Y - 0.08, 0.055, { pos: [x, (top + PIN_Y) / 2, -0.015], rot: [0.16, 0, 0] }),
      torus(0.055, 0.016, 24, 8, { pos: [x, PIN_Y, PIN_Z], rot: [0, Math.PI / 2, 0] }),
      torus(0.035, 0.012, 20, 8, { pos: [x, top - 0.04, 0], rot: [0, Math.PI / 2, 0] }),
    ];
    return merge(bits);
  }), darkSteel());

  add('crankshaft', [
    cylinder(0.055, 0.055, 2.18, 24, { pos: [0, PIN_Y, 0], rot: [0, 0, Math.PI / 2] }),
    ...X.flatMap((x, i) => {
      const offset = (i % 2 === 0 ? 1 : -1) * 0.075;
      return [
        cylinder(0.135, 0.135, 0.035, 28, { pos: [x - 0.075, PIN_Y, 0], rot: [0, 0, Math.PI / 2] }),
        cylinder(0.135, 0.135, 0.035, 28, { pos: [x + 0.075, PIN_Y, 0], rot: [0, 0, Math.PI / 2] }),
        cylinder(0.042, 0.042, 0.10, 20, { pos: [x, PIN_Y + offset, 0], rot: [0, 0, Math.PI / 2] }),
        box(0.10, 0.16, 0.12, { pos: [x, PIN_Y + offset / 2, 0], rot: [0, 0, 0] }),
      ];
    }),
  ], steel());

  add('flywheel', [
    gearDisc(0.34, 0.075, 48, -1.10, PIN_Y, 0),
    cylinder(0.19, 0.19, 0.09, 32, { pos: [-1.10, PIN_Y, 0], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * TAU;
      return cylinder(0.018, 0.018, 0.10, 10, { pos: [-1.12, PIN_Y + Math.sin(a) * 0.13, Math.cos(a) * 0.13], rot: [0, 0, Math.PI / 2] });
    }),
  ], darkSteel());

  add('front_pulley', [
    gearDisc(0.10, 0.045, 24, 1.10, PIN_Y, 0),
    cylinder(0.035, 0.035, 0.08, 18, { pos: [1.15, PIN_Y, 0], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  // ------------------------------------------------------------------- heads
  add('cylinder_heads', X.map((x) => roundedBox(0.30, 0.16, 0.66, 0.025, 2, { pos: [x, 1.12, 0] })), headPaint());

  add('valve_covers', X.map((x) => merge([
    roundedBox(0.26, 0.075, 0.58, 0.02, 2, { pos: [x, 1.23, 0] }),
    ...Array.from({ length: 4 }, (_, i) => cylinder(0.012, 0.012, 0.02, 8, { pos: [x - 0.10 + (i % 2) * 0.20, 1.275, -0.20 + Math.floor(i / 2) * 0.40] })),
  ])), blockPaint());

  add('valve_springs', X.flatMap((x) => [-0.14, 0.14].map((z) => merge([
    cylinder(0.018, 0.018, 0.09, 12, { pos: [x, 1.30, z] }),
    ...Array.from({ length: 4 }, (_, i) => torus(0.022, 0.0035, 16, 6, { pos: [x, 1.265 + i * 0.020, z], rot: [Math.PI / 2, 0, 0] })),
  ]))), steel());

  add('camshaft', [
    cylinder(0.035, 0.035, 2.02, 20, { pos: [0, 1.30, -0.20], rot: [0, 0, Math.PI / 2] }),
    ...X.map((x, i) => cam(x, i * 0.9)),
    gearDisc(0.09, 0.04, 24, -1.02, 1.30, -0.20),
  ], steel());

  add('camshaft_bearings', X.map((x) => merge([
    roundedBox(0.09, 0.10, 0.10, 0.015, 2, { pos: [x, 1.30, -0.20] }),
    cylinder(0.048, 0.048, 0.055, 18, { pos: [x, 1.30, -0.20], rot: [0, 0, Math.PI / 2] }),
  ])), darkSteel());

  add('rockers', X.flatMap((x) => [-1, 1].map((s) => merge([
    box(0.09, 0.018, 0.032, { pos: [x + s * 0.035, 1.35, -0.03], rot: [0, 0, s * 0.20] }),
    cylinder(0.012, 0.012, 0.045, 10, { pos: [x, 1.35, -0.03], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.008, 0.008, 0.075, 8, { pos: [x + s * 0.075, 1.32, -0.03] }),
  ]))), steel());

  add('pushrods', X.flatMap((x) => [-1, 1].map((s) => cylinder(0.007, 0.007, 0.24, 8, {
    pos: [x + s * 0.08, 1.18, -0.18],
    rot: [0.10, 0, s * 0.04],
  }))), darkSteel());

  add('injectors', X.map((x) => merge([
    cylinder(0.020, 0.020, 0.12, 14, { pos: [x, 1.35, 0.10] }),
    cylinder(0.012, 0.012, 0.06, 10, { pos: [x, 1.42, 0.10] }),
    box(0.045, 0.025, 0.045, { pos: [x, 1.385, 0.10] }),
  ])), brass());

  add('fuel_lines', X.map((x) => fuelLine(x)), copper());

  add('fuel_pump', [
    roundedBox(0.26, 0.22, 0.24, 0.02, 2, { pos: [-0.72, 1.02, 0.30] }),
    ...Array.from({ length: 6 }, (_, i) => cylinder(0.018, 0.018, 0.10, 10, { pos: [-0.82 + i * 0.04, 1.15, 0.30] })),
    cylinder(0.035, 0.035, 0.16, 16, { pos: [-0.88, 1.02, 0.30], rot: [0, 0, Math.PI / 2] }),
    gearDisc(0.055, 0.03, 18, -0.86, 1.02, 0.30),
  ], brass());

  add('governor', [
    cylinder(0.070, 0.070, 0.12, 24, { pos: [-0.98, 1.16, 0.30], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.030, 0.030, 0.20, 14, { pos: [-1.06, 1.16, 0.30], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 4 }, (_, i) => box(0.05, 0.012, 0.012, { pos: [-0.98, 1.16 + Math.sin(i * 1.57) * 0.05, 0.30 + Math.cos(i * 1.57) * 0.05] })),
  ], darkSteel());

  // ------------------------------------------------------------- air and exhaust
  add('intake_manifold', [
    cylinder(0.065, 0.065, 1.94, 24, { pos: [0, 1.06, 0.34], rot: [0, 0, Math.PI / 2] }),
    ...X.map((x) => cylinder(0.035, 0.035, 0.16, 14, { pos: [x, 1.12, 0.34], rot: [0, 0, Math.PI / 2] })),
  ], orange());

  add('exhaust_manifold', [
    cylinder(0.075, 0.075, 1.94, 24, { pos: [0, 1.16, -0.34], rot: [0, 0, Math.PI / 2] }),
    ...X.map((x) => cylinder(0.042, 0.042, 0.18, 16, { pos: [x, 1.20, -0.34], rot: [0, 0, Math.PI / 2] })),
    ...Array.from({ length: 6 }, (_, i) => torus(0.082, 0.010, 24, 8, { pos: [-0.85 + i * 0.34, 1.16, -0.34], rot: [0, Math.PI / 2, 0] })),
  ], hot());

  add('turbocharger', [
    torus(0.15, 0.055, 32, 14, { pos: [1.14, 1.22, -0.34], rot: [0, Math.PI / 2, 0] }),
    cylinder(0.13, 0.13, 0.10, 28, { pos: [1.14, 1.22, -0.34], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.09, 0.09, 0.18, 24, { pos: [1.14, 1.22, -0.18], rot: [0, 0, Math.PI / 2] }),
    torus(0.09, 0.030, 28, 10, { pos: [1.14, 1.22, -0.06], rot: [0, Math.PI / 2, 0] }),
    cylinder(0.055, 0.055, 0.05, 20, { pos: [1.14, 1.22, -0.02], rot: [0, 0, Math.PI / 2] }),
    curve([[1.14, 1.34, -0.34], [1.14, 1.46, -0.34], [1.16, 1.52, -0.28], [1.24, 1.52, -0.22]], 0.055, { segments: 18, radial: 14 }),
  ], darkSteel());

  add('turbo_wheels', [
    ...Array.from({ length: 10 }, (_, i) => box(0.08, 0.012, 0.055, {
      pos: [1.14, 1.22 + Math.sin((i / 10) * TAU) * 0.065, -0.34 + Math.cos((i / 10) * TAU) * 0.065],
      rot: [(i / 10) * TAU, 0, 0],
    })),
    ...Array.from({ length: 10 }, (_, i) => box(0.055, 0.010, 0.042, {
      pos: [1.14, 1.22 + Math.sin((i / 10) * TAU) * 0.045, -0.18 + Math.cos((i / 10) * TAU) * 0.045],
      rot: [(i / 10) * TAU, 0, 0],
    })),
    cylinder(0.020, 0.020, 0.34, 14, { pos: [1.14, 1.22, -0.18], rot: [0, 0, Math.PI / 2] }),
  ], copper());

  add('air_filter', [
    cylinder(0.10, 0.10, 0.22, 28, { pos: [1.14, 1.46, 0.04], rot: [Math.PI / 2, 0, 0] }),
    ...Array.from({ length: 7 }, (_, i) => torus(0.103, 0.005, 28, 6, { pos: [1.14, 1.46, -0.05 + i * 0.03], rot: [Math.PI / 2, 0, 0] })),
    cylinder(0.035, 0.035, 0.10, 16, { pos: [1.14, 1.36, 0.10], rot: [Math.PI / 2, 0, 0] }),
  ], orange());

  add('intercooler', [
    roundedBox(0.42, 0.20, 0.30, 0.02, 2, { pos: [-0.30, 1.40, 0.28] }),
    ...Array.from({ length: 9 }, (_, i) => box(0.38, 0.16, 0.008, { pos: [-0.30, 1.40, 0.15 + i * 0.032] })),
    cylinder(0.055, 0.055, 0.30, 20, { pos: [-0.06, 1.40, 0.28], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.055, 0.055, 0.30, 20, { pos: [-0.54, 1.40, 0.28], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('charge_pipe', curve([
    [1.14, 1.46, 0.04], [0.90, 1.46, 0.18], [0.40, 1.44, 0.28], [-0.06, 1.40, 0.28],
  ], 0.035, { segments: 30, radial: 12 }), orange());

  // ------------------------------------------------------------ auxiliary sets
  add('starter_motor', [
    cylinder(0.085, 0.085, 0.26, 24, { pos: [0.98, 0.42, -0.44], rot: [0, 0, Math.PI / 2] }),
    gearDisc(0.10, 0.035, 20, 1.08, 0.42, -0.44),
    cylinder(0.025, 0.025, 0.10, 12, { pos: [0.84, 0.42, -0.44], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('lube_oil_pump', [
    cylinder(0.075, 0.075, 0.14, 22, { pos: [-0.55, 0.30, 0.46], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.045, 0.045, 0.20, 16, { pos: [-0.44, 0.30, 0.46], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 5 }, (_, i) => torus(0.08, 0.006, 22, 6, { pos: [-0.59 + i * 0.02, 0.30, 0.46], rot: [0, Math.PI / 2, 0] })),
  ], orange());

  add('seawater_pump', [
    cylinder(0.070, 0.070, 0.16, 22, { pos: [-0.20, 0.28, 0.46], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.035, 0.035, 0.22, 14, { pos: [-0.06, 0.28, 0.46], rot: [0, 0, Math.PI / 2] }),
    torus(0.085, 0.012, 24, 8, { pos: [-0.20, 0.28, 0.46], rot: [0, Math.PI / 2, 0] }),
  ], brass());

  add('heat_exchanger', [
    roundedBox(0.30, 0.24, 0.22, 0.02, 2, { pos: [-0.92, 0.62, 0.28] }),
    ...Array.from({ length: 12 }, (_, i) => cylinder(0.010, 0.010, 0.26, 8, { pos: [-1.04 + i * 0.020, 0.62, 0.28], rot: [0, 0, Math.PI / 2] })),
    ...[-1, 1].map((s) => cylinder(0.045, 0.045, 0.08, 14, { pos: [-0.92, 0.62 + s * 0.14, 0.28] })),
  ], copper());

  add('coolant_hoses', [
    curve([[-0.92, 0.48, 0.28], [-0.80, 0.38, 0.34], [-0.55, 0.34, 0.40], [-0.20, 0.28, 0.46]], 0.024, { segments: 24, radial: 10 }),
    curve([[-0.20, 0.28, 0.46], [0.20, 0.24, 0.44], [0.62, 0.26, 0.40], [1.00, 0.38, 0.30]], 0.024, { segments: 24, radial: 10 }),
  ], rubber());

  add('engine_mounts', [-1, 1].flatMap((sx) => [-1, 1].map((sz) => merge([
    roundedBox(0.18, 0.12, 0.14, 0.03, 2, { pos: [sx * 0.98, 0.12, sz * 0.38] }),
    cylinder(0.028, 0.028, 0.10, 12, { pos: [sx * 0.98, 0.04, sz * 0.38] }),
  ]))), darkSteel());

  add('turning_gear', [
    gearDisc(0.075, 0.03, 18, -0.95, 0.45, 0.44),
    cylinder(0.025, 0.025, 0.12, 12, { pos: [-0.95, 0.45, 0.52], rot: [Math.PI / 2, 0, 0] }),
    box(0.055, 0.012, 0.12, { pos: [-0.86, 0.45, 0.44], rot: [0, 0.6, 0] }),
  ], brass());

  add('nameplate', roundedBox(0.20, 0.05, 0.004, 0.003, 1, { pos: [0.42, 0.24, 0.425] }), brass());

  add('exhaust_silencer', [
    cylinder(0.12, 0.12, 0.34, 26, { pos: [1.14, 1.62, -0.16], rot: [Math.PI / 2, 0, 0] }),
    torus(0.125, 0.012, 26, 8, { pos: [1.14, 1.62, -0.32], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.075, 0.075, 0.18, 20, { pos: [1.14, 1.62, 0.08], rot: [Math.PI / 2, 0, 0] }),
  ], hot());

  return g;
}
