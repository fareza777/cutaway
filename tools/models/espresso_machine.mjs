// Generic single-boiler, vibration-pump espresso machine. No brand likeness,
// textures or decorative internals: the plumbing follows an actual brew path.
// +Z is the working front; source dimensions are metres scaled for authoring.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const steel = () => pbr('#c9d1d8', { metalness: 0.78, roughness: 0.29 });
const chrome = () => pbr('#e2e8ec', { metalness: 0.86, roughness: 0.20 });
const brass = () => pbr('#bd914b', { metalness: 0.82, roughness: 0.34 });
const dark = () => pbr('#192128', { roughness: 0.39 });
const rubber = () => pbr('#252b2d', { roughness: 0.86 });
const HEX = Math.PI / 6;
const B = [-0.18, 0, 0.36];
const at = (x, y, z, rot) => ({ pos: [x, y, z], ...(rot ? { rot } : {}) });
const Y_RING = [Math.PI / 2, 0, 0];

function rectShape(w, h, r = 0.01) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}
function rectangularHole(w, h, x = 0, y = 0) {
  const path = new THREE.Path();
  path.moveTo(x - w / 2, y - h / 2);
  path.lineTo(x - w / 2, y + h / 2);
  path.lineTo(x + w / 2, y + h / 2);
  path.lineTo(x + w / 2, y - h / 2);
  path.closePath();
  return path;
}
function extrude(shape, depth, transform, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 4, bevelEnabled: bevel > 0,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  return place(g, transform);
}
function horizontalPlate(shape, depth, pos) {
  return extrude(shape, depth, { rot: [-Math.PI / 2, 0, 0], pos });
}
function screw(x, y, z, axis = 'z', radius = 0.025) {
  const head = cylinder(radius, radius, 0.012, 12);
  const recess = box(radius * 0.9, 0.003, radius * 0.16, at(0, 0.008, 0));
  return place(merge([head, recess]), {
    rot: axis === 'z' ? [Math.PI / 2, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0],
    pos: [x, y, z],
  });
}
function hexNut(x, y, z, axis = 'y', r = 0.047, h = 0.05) {
  return cylinder(r, r, h, 6, {
    rot: axis === 'x' ? [0, HEX, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, HEX, 0] : [0, HEX, 0],
    pos: [x, y, z],
  });
}
function perforatedDisc(r, y, holes, holeR, x, z) {
  const s = new THREE.Shape().absarc(0, 0, r, 0, TAU, false);
  for (const [hx, hz] of holes) s.holes.push(new THREE.Path().absarc(hx, hz, holeR, 0, TAU, true));
  return horizontalPlate(s, 0.012, [x, y, z]);
}
function discHoles(radius, pitch) {
  const holes = [];
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = (col + (Math.abs(row) % 2) * 0.5) * pitch;
      const z = row * pitch * Math.sqrt(3) / 2;
      if (Math.hypot(x, z) < radius) holes.push([x, z]);
    }
  }
  return holes;
}

// Lathe end caps contain collapsed triangles at radius zero. Discard those
// faces before welding so every shipped normal is valid without exporter fixes.
function withoutCollapsedFaces(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = flat.getAttribute('position');
  const keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1).sub(a);
    c.fromBufferAttribute(positions, i + 2).sub(a);
    if (b.cross(c).lengthSq() > 1e-16) keep.push(i, i + 1, i + 2);
  }
  if (keep.length === positions.count) return flat;
  const clean = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(flat.attributes)) {
    const values = new Float32Array(keep.length * attr.itemSize);
    keep.forEach((source, index) => {
      for (let component = 0; component < attr.itemSize; component++) values[index * attr.itemSize + component] = attr.array[source * attr.itemSize + component];
    });
    clean.setAttribute(name, new THREE.BufferAttribute(values, attr.itemSize));
  }
  return clean;
}

export default function espressoMachine() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, withoutCollapsedFaces(Array.isArray(geometry) ? merge(geometry) : geometry), material));

  // Folded side panels have a real open cup bay, not an arbitrary cutaway.
  const side = new THREE.Shape();
  side.moveTo(-0.77, -1.04); side.lineTo(-0.035, -1.04);
  side.lineTo(-0.035, 0.10); side.lineTo(0.71, 0.10);
  side.lineTo(0.71, 1.18); side.lineTo(-0.77, 1.18); side.closePath();
  const shell = [-0.8, 0.8].map((x) => extrude(side, 0.027, at(x, 0, 0, [0, -Math.PI / 2, 0]), 0.008));
  shell.push(roundedBox(1.62, 2.22, 0.03, 0.01, 1, at(0, 0.07, -0.77)));
  for (const x of [-0.80, 0.80]) {
    for (const [y, z] of [[1.04, -0.62], [0.25, 0.57], [-0.87, -0.60]]) shell.push(screw(x * 1.022, y, z, 'x', 0.021));
  }
  // Rear ventilation slots are stamped shallow louvres, not painted stripes.
  for (let row = 0; row < 5; row++) shell.push(roundedBox(1.18, 0.018, 0.023, 0.005, 1, at(0, 0.10 + row * 0.095, -0.796)));
  add('outer_shell', shell, steel());

  const front = rectShape(1.56, 1.045, 0.026);
  for (const x of [-0.44, -0.12, 0.20]) front.holes.push(rectangularHole(0.184, 0.29, x, 0.115));
  add('front_panel', [
    extrude(front, 0.026, at(0, 0.65, 0.724), 0.004),
    roundedBox(1.48, 0.023, 0.02, 0.006, 1, at(0, 0.22, 0.745)),
    ...[-0.7, 0.7].flatMap((x) => [screw(x, 1.08, 0.745), screw(x, 0.20, 0.745)]),
  ], pbr('#e5e3dc', { metalness: 0.08, roughness: 0.36 }));

  // A real cup-bay splash panel covers the pump and low-pressure hoses.
  // The narrow pressure-release drain remains on its user-facing side.
  const splash = new THREE.Shape();
  splash.moveTo(-0.745, -0.55); splash.lineTo(0.745, -0.55);
  splash.lineTo(0.745, 0.55); splash.lineTo(-0.03, 0.55);
  splash.lineTo(-0.03, 0.38); splash.lineTo(-0.33, 0.38);
  splash.lineTo(-0.33, 0.55); splash.lineTo(-0.745, 0.55); splash.closePath();
  add('brew_bay_panel', [
    extrude(splash, 0.029, at(0, -0.425, 0.119), 0.004),
    ...[-0.69, 0.69].map((x) => screw(x, -0.82, 0.146, 'z', 0.020)),
  ], steel());

  const warmer = rectShape(1.54, 0.94, 0.028);
  for (let i = -4; i <= 4; i++) warmer.holes.push(rectangularHole(0.032, 0.63, i * 0.145));
  add('cup_warmer', [
    horizontalPlate(warmer, 0.035, [0, 1.208, 0.24]),
    curve([[-0.72, 1.23, -0.17], [-0.72, 1.30, -0.15], [-0.65, 1.32, -0.15], [0.65, 1.32, -0.15], [0.72, 1.30, -0.15], [0.72, 1.23, -0.17]], 0.013, { segments: 24, radial: 8 }),
  ], steel());

  const groupSupport = rectShape(1.32, 1.05, 0.016);
  groupSupport.holes.push(new THREE.Path().absarc(-0.18, -0.20, 0.292, 0, TAU, true));
  add('chassis', [
    roundedBox(1.55, 0.065, 1.55, 0.017, 1, at(0, -1.10, -0.01)),
    ...[-0.67, 0.67].map((x) => roundedBox(0.055, 2.10, 0.045, 0.004, 1, at(x, 0.00, -0.20))),
    horizontalPlate(groupSupport, 0.030, [0, 0.102, 0.23]),
    ...[-0.61, 0.61].map((x) => hexNut(x, 0.14, 0.14, 'y', 0.037, 0.03)),
  ], pbr('#788591', { metalness: 0.86, roughness: 0.42 }));
  add('rubber_feet', [-0.59, 0.59].flatMap((x) => [-0.55, 0.54].map((z) => lathe([[0, -0.060], [0.089, -0.060], [0.110, -0.043], [0.112, 0], [0.096, 0.043], [0.078, 0.060], [0, 0.060]], 24, at(x, -1.19, z)))), rubber());

  const tankWall = rectShape(1.13, 0.395, 0.05);
  tankWall.holes.push(rectangularHole(1.065, 0.33));
  add('water_tank', [
    horizontalPlate(tankWall, 2.00, [0, 0.03, -0.535]),
    roundedBox(1.11, 0.032, 0.38, 0.012, 1, at(0, -0.986, -0.535)),
    ...Array.from({ length: 6 }, (_, i) => box(i % 2 ? 0.045 : 0.080, 0.009, 0.008, at(0.45, -0.57 + i * 0.20, -0.33))),
  ], pbr('#c6e8ed', { roughness: 0.18 }));
  add('tank_lid', [
    roundedBox(1.54, 0.050, 0.51, 0.025, 2, at(0, 1.202, -0.505)),
    roundedBox(0.25, 0.043, 0.10, 0.023, 2, at(0, 1.243, -0.51)),
    roundedBox(1.07, 0.033, 0.32, 0.016, 1, at(0, 1.162, -0.535)),
  ], dark());

  const trayWall = rectShape(1.60, 1.00, 0.05);
  trayWall.holes.push(rectangularHole(1.50, 0.90));
  add('drip_tray', [
    horizontalPlate(trayWall, 0.16, [0, -1.018, 0.55]),
    roundedBox(1.56, 0.025, 0.96, 0.017, 1, at(0, -1.087, 0.55)),
    roundedBox(0.48, 0.056, 0.019, 0.012, 1, at(0, -1.012, 1.064)),
  ], dark());
  const grille = rectShape(1.49, 0.89, 0.034);
  grille.holes.push(rectangularHole(1.37, 0.76));
  add('tray_grille', [
    horizontalPlate(grille, 0.022, [0, -0.928, 0.55]),
    ...Array.from({ length: 18 }, (_, i) => roundedBox(0.035, 0.023, 0.77, 0.008, 1, at(-0.645 + i * 0.076, -0.928, 0.55))),
    roundedBox(1.40, 0.027, 0.026, 0.007, 1, at(0, -0.948, 0.31)),
  ], chrome());

  const switchBits = [];
  for (const [i, x] of [-0.44, -0.12, 0.20].entries()) {
    switchBits.push(roundedBox(0.181, 0.278, 0.035, 0.014, 2, at(x, 0.765, 0.747)));
    switchBits.push(roundedBox(0.153, 0.220, 0.045, 0.014, 2, at(x, 0.761, 0.78, [-0.13, 0, 0])));
    switchBits.push(paint(roundedBox(0.057, 0.015, 0.008, 0.006, 1, at(x, 0.837, 0.811)), () => srgb(i === 0 ? '#f0ad52' : '#e7e5cf')));
    const glyph = i === 0 ? [
      torus(0.034, 0.0038, 18, 6, at(x, 0.993, 0.748)),
      box(0.004, 0.034, 0.004, at(x, 1.025, 0.748)),
    ] : i === 1 ? [
      curve([[x - 0.031, 1.017, 0.748], [x - 0.023, 0.979, 0.748], [x, 0.973, 0.748], [x + 0.023, 0.979, 0.748], [x + 0.031, 1.017, 0.748]], 0.0035, { segments: 16, radial: 5 }),
      curve([[x + 0.031, 1.011, 0.748], [x + 0.052, 1.009, 0.748], [x + 0.048, 0.987, 0.748], [x + 0.026, 0.989, 0.748]], 0.0035, { segments: 12, radial: 5 }),
      box(0.085, 0.004, 0.004, at(x, 0.962, 0.748)),
    ] : [-0.022, 0, 0.022].map((offset) => curve([[x + offset, 0.972, 0.748], [x + offset - 0.007, 0.990, 0.748], [x + offset + 0.007, 1.008, 0.748], [x + offset, 1.026, 0.748]], 0.0035, { segments: 12, radial: 5 }));
    switchBits.push(...glyph.map((geometry) => paint(geometry, () => srgb('#293139'))));
    switchBits.push(roundedBox(0.12, 0.24, 0.11, 0.008, 1, at(x, 0.765, 0.636)));
  }
  add('control_switches', merge(switchBits), pbr('#ffffff', { roughness: 0.4, vertexColors: true }));
  // Black controls must not turn white when using vertex colours.
  const switches = g.getObjectByName('control_switches');
  const switchColours = switches.geometry.getAttribute('color');
  const black = srgb('#182229');
  for (let i = 0; i < switchColours.count; i++) {
    if (switchColours.getX(i) > 0.99 && switchColours.getY(i) > 0.99 && switchColours.getZ(i) > 0.99) switchColours.setXYZ(i, ...black);
  }
  switchColours.needsUpdate = true;

  const knob = [cylinder(0.142, 0.137, 0.125, 32, at(0.898, 0.883, 0.31, [0, 0, Math.PI / 2]))];
  for (let i = 0; i < 32; i++) {
    const a = TAU * i / 32;
    knob.push(cylinder(0.005, 0.005, 0.080, 5, at(0.902, 0.883 + Math.sin(a) * 0.143, 0.31 + Math.cos(a) * 0.143, [0, 0, Math.PI / 2])));
  }
  knob.push(roundedBox(0.004, 0.015, 0.085, 0.002, 1, at(0.964, 0.883, 0.335)));
  add('steam_knob', knob, dark());
  add('steam_valve', [
    hexNut(0.535, 0.883, 0.31, 'x', 0.088, 0.145),
    cylinder(0.036, 0.036, 0.30, 16, at(0.718, 0.883, 0.31, [0, 0, Math.PI / 2])),
    curve([[-0.10, 0.952, 0.43], [0.20, 1.015, 0.44], [0.40, 1.01, 0.31], [0.50, 0.883, 0.31]], 0.028, { segments: 22, radial: 10 }),
    curve([[0.55, 0.85, 0.31], [0.55, 0.52, 0.36], [0.58, 0.21, 0.52], [0.59, 0.09, 0.55]], 0.027, { segments: 18, radial: 10 }),
    hexNut(-0.10, 0.977, 0.43, 'y', 0.050, 0.046),
    hexNut(0.59, 0.09, 0.55, 'y', 0.052, 0.04),
  ], brass());
  add('steam_wand', [
    cylinder(0.063, 0.063, 0.09, 20, at(0.59, 0.023, 0.55)),
    curve([[0.59, 0.06, 0.55], [0.59, -0.12, 0.55], [0.68, -0.24, 0.61], [0.72, -0.43, 0.72], [0.72, -0.62, 0.82]], 0.027, { segments: 24, radial: 10 }),
    cylinder(0.038, 0.031, 0.079, 20, at(0.72, -0.653, 0.839, [-0.47, 0, 0])),
    tube(0.020, 0.011, 0.019, 12, at(0.72, -0.693, 0.855, [-0.47, 0, 0])),
  ], chrome());

  add('boiler_body', [
    lathe([[0, 0.28], [0.245, 0.28], [0.286, 0.30], [0.309, 0.34], [0.315, 0.85], [0.310, 0.91], [0.268, 0.91], [0.266, 0.35], [0.225, 0.327], [0, 0.327]], 48, at(B[0], 0, B[2])),
    torus(0.318, 0.008, 48, 6, at(B[0], 0.365, B[2], Y_RING)),
    torus(0.318, 0.008, 48, 6, at(B[0], 0.827, B[2], Y_RING)),
    hexNut(-0.48, 0.42, 0.36, 'x', 0.061, 0.072),
    cylinder(0.035, 0.043, 0.094, 16, at(-0.18, 0.265, 0.43)),
  ], brass());
  const lid = [cylinder(0.345, 0.345, 0.051, 48, at(B[0], 0.938, B[2]))];
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6;
    lid.push(hexNut(B[0] + Math.sin(a) * 0.292, 0.979, B[2] + Math.cos(a) * 0.292, 'y', 0.031, 0.037));
  }
  add('boiler_lid', lid, brass());
  add('heating_element', [
    curve([[-0.29, 0.974, 0.28], [-0.29, 0.73, 0.28], [-0.29, 0.39, 0.32], [-0.18, 0.363, 0.45], [-0.07, 0.39, 0.46], [-0.07, 0.73, 0.46], [-0.07, 0.974, 0.46]], 0.027, { segments: 30, radial: 10 }),
    cylinder(0.041, 0.041, 0.032, 16, at(-0.29, 0.961, 0.28)),
    cylinder(0.041, 0.041, 0.032, 16, at(-0.07, 0.961, 0.46)),
    box(0.018, 0.053, 0.027, at(-0.29, 1.006, 0.28)),
    box(0.018, 0.053, 0.027, at(-0.07, 1.006, 0.46)),
  ], pbr('#757d82', { metalness: 0.87, roughness: 0.39 }));
  add('thermostats', [-0.30, -0.03].flatMap((x) => [
    cylinder(0.056, 0.056, 0.023, 16, at(x, 0.979, 0.57)),
    cylinder(0.040, 0.040, 0.039, 12, at(x, 1.008, 0.57)),
    box(0.012, 0.030, 0.050, at(x - 0.025, 1.042, 0.57)),
    box(0.012, 0.030, 0.050, at(x + 0.025, 1.042, 0.57)),
  ]), pbr('#ece8d8', { roughness: 0.53 }));

  add('pump_coil', [
    cylinder(0.125, 0.125, 0.37, 32, at(-0.52, -0.56, -0.08)),
    cylinder(0.143, 0.143, 0.047, 24, at(-0.52, -0.36, -0.08)),
    cylinder(0.143, 0.143, 0.047, 24, at(-0.52, -0.76, -0.08)),
    roundedBox(0.20, 0.11, 0.09, 0.013, 1, at(-0.52, -0.53, 0.055)),
    ...Array.from({ length: 6 }, (_, i) => torus(0.127, 0.005, 24, 5, at(-0.52, -0.71 + i * 0.06, -0.08, Y_RING))),
  ], pbr('#983d32', { roughness: 0.49 }));
  add('pump_plunger', [
    cylinder(0.035, 0.035, 0.23, 20, at(-0.52, -0.56, -0.08)),
    cylinder(0.055, 0.055, 0.042, 20, at(-0.52, -0.47, -0.08)),
    curve(Array.from({ length: 91 }, (_, i) => {
      const a = i / 90 * TAU * 5;
      return [-0.52 + Math.sin(a) * 0.050, -0.699 + i / 90 * 0.101, -0.08 + Math.cos(a) * 0.050];
    }), 0.005, { segments: 90, radial: 5 }),
  ], steel());
  add('pump_mount', [
    ...[-0.80, -0.32].map((y) => torus(0.119, 0.030, 24, 8, at(-0.52, y, -0.08, Y_RING))),
    ...[-0.80, -0.32].map((y) => roundedBox(0.31, 0.053, 0.14, 0.015, 1, at(-0.52, y, -0.19))),
  ], rubber());
  add('overpressure_valve', [
    hexNut(-0.57, 0.37, 0.09, 'y', 0.069, 0.17),
    cylinder(0.047, 0.047, 0.066, 16, at(-0.57, 0.475, 0.09)),
    hexNut(-0.57, 0.506, 0.09, 'y', 0.046, 0.025),
    hexNut(-0.63, 0.405, 0.09, 'x', 0.045, 0.065),
    hexNut(-0.51, 0.370, 0.09, 'x', 0.046, 0.065),
    hexNut(-0.52, -0.288, -0.08, 'y', 0.044, 0.070),
    cylinder(0.030, 0.035, 0.062, 16, at(-0.52, -0.246, -0.08)),
  ], brass());
  add('pressure_hose', [
    curve([[-0.52, -0.246, -0.08], [-0.57, -0.08, -0.01], [-0.57, 0.16, 0.09], [-0.57, 0.29, 0.09]], 0.023, { segments: 21, radial: 10 }),
    curve([[-0.48, 0.37, 0.09], [-0.43, 0.36, 0.14], [-0.47, 0.42, 0.29], [-0.51, 0.42, 0.36]], 0.022, { segments: 16, radial: 10 }),
  ], pbr('#e8e0ca', { roughness: 0.43 }));
  add('suction_return_hoses', [
    curve([[0.30, -0.80, -0.54], [0.30, 0.18, -0.54], [0.30, 0.88, -0.54], [0.50, 0.89, -0.34], [0.48, 0.08, -0.18], [0.28, -0.86, -0.11], [-0.31, -0.89, -0.08], [-0.52, -0.818, -0.08]], 0.022, { segments: 45, radial: 8 }),
    curve([[-0.66, 0.405, 0.09], [-0.69, 0.59, -0.06], [-0.54, 0.90, -0.31], [-0.38, 0.89, -0.54], [-0.38, 0.17, -0.54], [-0.38, -0.69, -0.54]], 0.020, { segments: 36, radial: 8 }),
  ], pbr('#acd2d0', { roughness: 0.28 }));

  add('three_way_valve', [
    hexNut(-0.52, 0.06, 0.365, 'y', 0.065, 0.13),
    box(0.12, 0.08, 0.10, at(-0.52, 0.04, 0.365)),
    curve([[-0.31, 0.14, 0.43], [-0.43, 0.15, 0.43], [-0.52, 0.10, 0.40], [-0.52, 0.06, 0.365]], 0.028, { segments: 14, radial: 10 }),
    hexNut(-0.52, -0.03, 0.365, 'y', 0.047, 0.039),
  ], brass());
  add('solenoid_coil', [
    roundedBox(0.143, 0.154, 0.147, 0.010, 1, at(-0.52, 0.218, 0.365)),
    cylinder(0.028, 0.028, 0.049, 12, at(-0.52, 0.318, 0.365)),
    roundedBox(0.064, 0.042, 0.088, 0.006, 1, at(-0.52, 0.249, 0.470)),
  ], dark());
  add('drain_tube', [
    curve([[-0.52, -0.045, 0.365], [-0.55, -0.11, 0.48], [-0.55, -0.24, 0.58], [-0.55, -0.75, 0.58], [-0.55, -0.920, 0.58]], 0.021, { segments: 25, radial: 10 }),
    tube(0.021, 0.014, 0.025, 12, at(-0.55, -0.927, 0.58)),
  ], chrome());

  add('group_head', [
    lathe([[0, 0.255], [0.23, 0.255], [0.265, 0.22], [0.282, 0.08], [0.324, 0.065], [0.324, 0.004], [0.286, -0.030], [0.249, -0.030], [0.247, 0.06], [0, 0.085]], 48, at(-0.18, 0, 0.43)),
    torus(0.309, 0.018, 48, 8, at(-0.18, 0.025, 0.43, Y_RING)),
    ...[-1, 1].map((sign) => roundedBox(0.15, 0.068, 0.085, 0.011, 1, at(-0.18 + sign * 0.29, 0.066, 0.43))),
  ], chrome());
  add('shower_screen', [
    perforatedDisc(0.240, -0.067, discHoles(0.205, 0.055), 0.008, -0.18, 0.43),
    torus(0.237, 0.006, 48, 6, at(-0.18, -0.067, 0.43, Y_RING)),
    screw(-0.18, -0.079, 0.43, 'y', 0.022),
  ], steel());
  add('group_gasket', torus(0.272, 0.019, 48, 10, at(-0.18, -0.049, 0.43, Y_RING)), rubber());
  add('filter_basket', [
    lathe([[0.225, -0.227], [0.240, -0.219], [0.263, -0.096], [0.280, -0.092], [0.280, -0.078], [0.253, -0.078], [0.230, -0.207], [0.220, -0.215]], 48, at(-0.18, 0, 0.43)),
    perforatedDisc(0.225, -0.221, discHoles(0.19, 0.054), 0.0065, -0.18, 0.43),
  ], steel());
  add('portafilter_body', [
    lathe([[0, -0.294], [0.227, -0.294], [0.280, -0.275], [0.306, -0.227], [0.309, -0.086], [0.282, -0.086], [0.279, -0.225], [0.219, -0.259], [0, -0.259]], 48, at(-0.18, 0, 0.43)),
    ...[-1, 1].map((sign) => roundedBox(0.16, 0.036, 0.075, 0.009, 1, at(-0.18 + sign * 0.30, -0.108, 0.43))),
    cylinder(0.073, 0.057, 0.10, 20, at(-0.18, -0.331, 0.43)),
    curve([[-0.18, -0.343, 0.43], [-0.28, -0.385, 0.44], [-0.28, -0.432, 0.50]], 0.035, { segments: 10, radial: 10 }),
    curve([[-0.18, -0.343, 0.43], [-0.08, -0.385, 0.44], [-0.08, -0.432, 0.50]], 0.035, { segments: 10, radial: 10 }),
    cylinder(0.053, 0.053, 0.125, 20, at(-0.224, -0.17, 0.764, [Math.PI / 2, 0, 0.14])),
  ], chrome());
  add('portafilter_handle', [
    roundedBox(0.145, 0.157, 0.675, 0.047, 3, at(-0.36, -0.18, 1.138, [0, -0.33, 0])),
    roundedBox(0.156, 0.166, 0.035, 0.026, 2, at(-0.256, -0.18, 0.832, [0, -0.33, 0])),
    ...Array.from({ length: 3 }, (_, i) => roundedBox(0.146, 0.018, 0.042, 0.007, 1, at(-0.425 - i * 0.018, -0.250, 1.32 + i * 0.05, [0, -0.33, 0]))),
  ], dark());
  const coffee = cylinder(0.233, 0.225, 0.065, 48, at(-0.18, -0.133, 0.43));
  paint(coffee, (x, y, z) => {
    const a = 0.87 + 0.13 * Math.sin(x * 367 + z * 289) * Math.cos(y * 127 + x * 171);
    return srgb('#563521').map((c) => c * a);
  });
  add('coffee_puck', coffee, pbr('#ffffff', { roughness: 0.98, vertexColors: true }));

  add('power_inlet', [
    roundedBox(0.24, 0.18, 0.049, 0.019, 1, at(0.47, -0.83, -0.800)),
    roundedBox(0.12, 0.075, 0.037, 0.007, 1, at(0.47, -0.83, -0.832)),
    ...[-1, 0, 1].map((i) => box(0.01, 0.034, 0.015, at(0.47 + i * 0.035, -0.83 + (i === 0 ? 0.025 : 0), -0.853))),
  ], dark());
  const wire = (points, color, radius = 0.010) => paint(curve(points, radius, { segments: 24, radial: 6 }), () => srgb(color));
  add('wiring_harness', [
    wire([[0.46, -0.81, -0.74], [0.59, -0.66, -0.30], [0.61, 0.35, -0.22], [0.45, 1.06, 0.1], [-0.29, 1.07, 0.28], [-0.29, 1.025, 0.28]], '#824b30'),
    wire([[0.43, -0.81, -0.74], [0.55, -0.60, -0.24], [0.57, 0.30, -0.18], [0.34, 1.03, 0.17], [-0.07, 1.075, 0.46], [-0.07, 1.025, 0.46]], '#327bbb'),
    wire([[0.50, -0.81, -0.74], [0.62, -0.55, -0.36], [0.67, -0.35, -0.20]], '#bfbe43'),
    wire([[-0.44, 0.765, 0.58], [-0.60, 0.68, 0.27], [-0.70, -0.13, 0.22], [-0.52, -0.52, 0.08]], '#b84130'),
    wire([[-0.12, 0.765, 0.58], [-0.16, 0.59, 0.63], [-0.45, 0.48, 0.59], [-0.52, 0.25, 0.50]], '#586987'),
    wire([[0.20, 0.765, 0.58], [0.35, 0.90, 0.59], [0.27, 1.075, 0.65], [-0.03, 1.06, 0.57]], '#c05237'),
  ], pbr('#ffffff', { roughness: 0.57, vertexColors: true }));

  const cup = [
    lathe([[0, -0.906], [0.137, -0.906], [0.155, -0.875], [0.188, -0.56], [0.183, -0.529], [0.161, -0.529], [0.145, -0.859], [0, -0.867]], 48, at(-0.18, 0, 0.57)),
    curve([[0.00, -0.579, 0.57], [0.13, -0.579, 0.57], [0.15, -0.723, 0.57], [0.08, -0.812, 0.57], [-0.025, -0.801, 0.57]], 0.025, { segments: 22, radial: 10 }),
    torus(0.14, 0.013, 40, 8, at(-0.18, -0.912, 0.57, Y_RING)),
  ];
  cup.push(paint(cylinder(0.157, 0.157, 0.008, 40, at(-0.18, -0.60, 0.57)), () => srgb('#b97835')));
  add('demitasse', cup, pbr('#ffffff', { roughness: 0.22, vertexColors: true }));
  return g;
}

export const meta = { width: 1.95, height: 2.57, depth: 2.30 };
