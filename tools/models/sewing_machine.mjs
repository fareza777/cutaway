// A domestic lockstitch sewing machine, side elevation correct: bed, a pillar
// on the right, an arm across the top and a head on the left that carries the
// needle. +Z faces the operator, +X is the handwheel side.
//
// The two mechanisms that make a lockstitch are modelled rather than implied:
// the needle/loop-taker timing (one hook revolution per stitch) and the
// four-motion feed (lift, advance, drop, return).
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, tube, torus,
  lathe, curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const enamel = () => pbr('#e9e4d8', { roughness: 0.34, metalness: 0.04 });
const enamelDark = () => pbr('#20262c', { roughness: 0.4, metalness: 0.12 });
const chrome = () => pbr('#dde2e6', { metalness: 0.66, roughness: 0.26 });
const steel = () => pbr('#c3cacf', { metalness: 0.56, roughness: 0.34 });
const darkSteel = () => pbr('#4c545b', { metalness: 0.66, roughness: 0.40 });
const brass = () => pbr('#c3a25c', { metalness: 0.86, roughness: 0.28 });
const rubber = () => pbr('#24282b', { roughness: 0.9 });
const cream = () => pbr('#f1e8d2', { roughness: 0.8 });
const threadColour = () => pbr('#ffffff', { roughness: 0.85, vertexColors: true });

const BED_TOP = 0.062;
const NEEDLE_X = -0.186;
const NEEDLE_Z = 0.014;

function extrudeX(shape, depth, z, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 2, curveSegments: 8,
  });
  geometry.translate(0, 0, z - depth / 2);
  return geometry;
}

function flat(shape, height, y, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: bevel > 0, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 1, curveSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height + y, 0);
  return geometry;
}

/** Knurled wheel, axis along X, teeth cut as small radial blocks. */
function knurled(r, width, count, x, y, z) {
  const bits = [cylinder(r, r, width, 28, { pos: [x, y, z], rot: [0, 0, Math.PI / 2] })];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TAU;
    bits.push(box(0.004, 0.0042, 0.010, {
      pos: [x, y + Math.sin(a) * (r + 0.001), z + Math.cos(a) * (r + 0.001)],
      rot: [a, 0, 0],
    }));
  }
  return merge(bits);
}

function gear(r, teeth, width, x, y, z, axis = 'x') {
  const bits = [cylinder(r, r, width, 20)];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * TAU;
    bits.push(box(r * 0.16, r * 0.16, width * 0.9, {
      pos: [Math.sin(a) * r, Math.cos(a) * r, 0],
      rot: [0, 0, -a],
    }));
  }
  return place(merge(bits), {
    rot: axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0],
    pos: [x, y, z],
  });
}

function screw(x, y, z, r = 0.006, axis = 'y') {
  return place(merge([
    cylinder(r, r, 0.005, 10),
    box(r * 1.4, 0.0018, r * 0.3, { pos: [0, 0.0026, 0] }),
  ]), { rot: axis === 'z' ? [Math.PI / 2, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0], pos: [x, y, z] });
}

export default function sewingMachine() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  // ------------------------------------------------------------------- bed
  add('bed', [
    roundedBox(0.446, 0.050, 0.202, 0.016, 3, { pos: [0, 0.027, 0] }),
    roundedBox(0.438, 0.010, 0.196, 0.005, 2, { pos: [0, 0.055, 0] }),
    // moulded seam for the accessory tray, and the front nameplate
    box(0.30, 0.0018, 0.12, { pos: [0.02, 0.0602, 0.040] }),
    paint(roundedBox(0.15, 0.010, 0.0035, 0.002, 1, { pos: [0.02, 0.040, 0.1015] }), () => srgb('#b9a477')),
  ], enamel());

  // ------------------------------------------------------------ body shell
  // One "n" profile: bed line, pillar, arm, head. The arch is open downward,
  // exactly like the casting, rather than a hole punched in a slab.
  const body = new THREE.Shape();
  body.moveTo(-0.201, 0.112);
  body.lineTo(-0.201, 0.248);
  body.quadraticCurveTo(-0.201, 0.300, -0.146, 0.300);
  body.lineTo(0.148, 0.300);
  body.quadraticCurveTo(0.201, 0.300, 0.201, 0.250);
  body.lineTo(0.201, 0.074);
  body.quadraticCurveTo(0.201, 0.062, 0.188, 0.062);
  body.lineTo(0.112, 0.062);
  body.lineTo(0.112, 0.188);
  body.quadraticCurveTo(0.112, 0.216, 0.082, 0.216);
  body.lineTo(-0.126, 0.216);
  body.quadraticCurveTo(-0.152, 0.216, -0.152, 0.188);
  body.lineTo(-0.152, 0.122);
  body.quadraticCurveTo(-0.152, 0.112, -0.164, 0.112);
  body.lineTo(-0.201, 0.112);

  add('body_shell', [
    extrudeX(body, 0.128, -0.002, 0.009),
    // side panel seam and the moulded rib that stiffens the arch
    ...[-0.066, 0.062].map((z) => box(0.004, 0.026, 0.004, { pos: [0.196, 0.235, z] })),
    ...[-1, 1].map((s) => roundedBox(0.006, 0.052, 0.062, 0.003, 1, { pos: [s * 0.203, 0.18, 0.0] })),
  ], enamel());

  add('top_cover', [
    roundedBox(0.318, 0.014, 0.118, 0.006, 2, { pos: [0.022, 0.307, -0.008] }),
    roundedBox(0.322, 0.004, 0.124, 0.002, 1, { pos: [0.022, 0.299, -0.008] }),
    ...[-0.11, 0.03, 0.13].map((x) => box(0.006, 0.004, 0.10, { pos: [x, 0.315, -0.008] })),
  ], enamelDark());

  add('faceplate', [
    extrudeX((() => {
      const s = new THREE.Shape();
      s.moveTo(-0.200, 0.118);
      s.lineTo(-0.200, 0.292);
      s.quadraticCurveTo(-0.200, 0.298, -0.194, 0.298);
      s.lineTo(-0.158, 0.298);
      s.quadraticCurveTo(-0.153, 0.298, -0.153, 0.292);
      s.lineTo(-0.153, 0.118);
      s.closePath();
      return s;
    })(), 0.004, 0.0665, 0.002),
    screw(-0.176, 0.285, 0.069, 0.005, 'z'),
    screw(-0.176, 0.128, 0.069, 0.005, 'z'),
    // the finger guard that follows the needle bar
    roundedBox(0.036, 0.030, 0.004, 0.008, 1, { pos: [-0.176, 0.145, 0.069] }),
  ], chrome());

  // ------------------------------------------------------------- handwheel
  add('handwheel', [
    torus(0.047, 0.0085, 34, 10, { pos: [0.222, 0.220, 0], rot: [0, Math.PI / 2, 0] }),
    cylinder(0.028, 0.028, 0.006, 28, { pos: [0.213, 0.220, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.012, 0.012, 0.030, 16, { pos: [0.222, 0.220, 0], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * TAU;
      return box(0.005, 0.040, 0.006, { pos: [0.222, 0.220 + Math.sin(a) * 0.024, Math.cos(a) * 0.024], rot: [a, 0, 0] });
    }),
  ], chrome());
  add('stop_motion_knob', [
    knurled(0.020, 0.014, 14, 0.244, 0.220, 0),
    cylinder(0.008, 0.008, 0.020, 12, { pos: [0.229, 0.220, 0], rot: [0, 0, Math.PI / 2] }),
  ], darkSteel());

  add('bobbin_winder', [
    roundedBox(0.014, 0.012, 0.070, 0.005, 1, { pos: [0.176, 0.286, -0.070] }),
    cylinder(0.017, 0.017, 0.012, 20, { pos: [0.188, 0.266, -0.098], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.005, 0.005, 0.045, 10, { pos: [0.176, 0.266, -0.046], rot: [Math.PI / 2, 0, 0] }),
    box(0.020, 0.006, 0.008, { pos: [0.166, 0.286, -0.030] }),
  ], steel());

  // --------------------------------------------------------------- controls
  add('stitch_length_dial', [
    knurled(0.021, 0.014, 18, 0.126, 0.208, 0.070),
    cylinder(0.006, 0.006, 0.020, 10, { pos: [0.126, 0.208, 0.078], rot: [Math.PI / 2, 0, 0] }),
    paint(box(0.004, 0.014, 0.004, { pos: [0.108, 0.218, 0.078] }), () => srgb('#c8a250')),
  ], pbr('#ffffff', { vertexColors: true, metalness: 0.4, roughness: 0.34 }));

  add('reverse_lever', [
    roundedBox(0.032, 0.010, 0.012, 0.004, 1, { pos: [0.118, 0.160, 0.070] }),
    roundedBox(0.016, 0.014, 0.014, 0.005, 2, { pos: [0.101, 0.160, 0.073] }),
    cylinder(0.008, 0.008, 0.020, 10, { pos: [0.136, 0.160, 0.060], rot: [Math.PI / 2, 0, 0] }),
  ], darkSteel());

  add('pressure_dial', [
    knurled(0.019, 0.012, 16, -0.050, 0.318, -0.004),
    cylinder(0.006, 0.006, 0.020, 10, { pos: [-0.050, 0.310, -0.004] }),
    torus(0.022, 0.0035, 20, 6, { pos: [-0.050, 0.302, -0.004], rot: [Math.PI / 2, 0, 0] }),
  ], darkSteel());

  add('work_light', [
    roundedBox(0.044, 0.018, 0.040, 0.008, 2, { pos: [-0.108, 0.205, 0.050] }),
    cylinder(0.013, 0.013, 0.006, 16, { pos: [-0.108, 0.196, 0.050] }),
    cylinder(0.011, 0.011, 0.004, 16, { pos: [-0.108, 0.197, 0.071], rot: [Math.PI / 2, 0, 0] }),
  ], pbr('#f6efd8', { roughness: 0.24, emissive: '#ffe9b0', emissiveIntensity: 0.9 }));

  add('rubber_feet', [[-0.185, -0.073], [0.185, -0.073], [-0.185, 0.073], [0.185, 0.073]].map(([x, z]) => (
    lathe([[0, 0], [0.019, 0], [0.021, 0.004], [0.020, 0.009], [0.014, 0.010], [0, 0.010]], 20, { pos: [x, -0.010, z] })
  )), rubber());

  // ------------------------------------------------------------ needle plate
  const plateShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.221, -0.050); s.lineTo(-0.139, -0.050);
    s.lineTo(-0.139, 0.050); s.lineTo(-0.221, 0.050); s.closePath();
    const hole = new THREE.Path();
    hole.absarc(NEEDLE_X, NEEDLE_Z, 0.006, 0, TAU, true);
    s.holes.push(hole);
    const slot = new THREE.Path();
    slot.moveTo(-0.194, -0.004); slot.lineTo(-0.194, 0.032);
    slot.lineTo(-0.178, 0.032); slot.lineTo(-0.178, -0.004); slot.closePath();
    s.holes.push(slot);
    return s;
  })();
  add('needle_plate', [
    flat(plateShape, 0.008, 0.0602, 0.0015),
    ...[-0.212, -0.148].flatMap((x) => [-0.040, 0.040].map((z) => screw(x, 0.0682, z, 0.0045))),
  ], steel());

  add('slide_plate', [
    roundedBox(0.115, 0.006, 0.100, 0.004, 2, { pos: [-0.070, 0.0642, 0] }),
    roundedBox(0.014, 0.008, 0.086, 0.004, 1, { pos: [-0.124, 0.0652, 0] }),
    cylinder(0.007, 0.007, 0.002, 12, { pos: [-0.108, 0.0672, 0] }),
  ], steel());

  // ----------------------------------------------------------- needle drive
  add('needle_bar', [
    cylinder(0.0062, 0.0062, 0.150, 12, { pos: [NEEDLE_X, 0.205, NEEDLE_Z] }),
    roundedBox(0.026, 0.020, 0.018, 0.004, 1, { pos: [NEEDLE_X, 0.128, NEEDLE_Z] }),
    cylinder(0.0038, 0.0038, 0.030, 8, { pos: [NEEDLE_X, 0.118, NEEDLE_Z] }),
    cylinder(0.0018, 0.0012, 0.056, 6, { pos: [NEEDLE_X, 0.088, NEEDLE_Z] }),
    lathe([[0, 0], [0.0018, 0.002], [0.0018, 0.009], [0, 0.011]], 8, { pos: [NEEDLE_X, 0.060, NEEDLE_Z] }),
    // thread take-up spring and the needle clamp screw
    curve([[NEEDLE_X, 0.130, NEEDLE_Z + 0.012], [NEEDLE_X + 0.004, 0.140, NEEDLE_Z + 0.020], [NEEDLE_X, 0.150, NEEDLE_Z + 0.024]], 0.0016, { segments: 8, radial: 4 }),
    screw(NEEDLE_X + 0.014, 0.128, NEEDLE_Z, 0.004, 'x'),
  ], chrome());

  add('presser_bar', [
    cylinder(0.0048, 0.0048, 0.175, 10, { pos: [-0.158, 0.200, -0.006] }),
    roundedBox(0.034, 0.012, 0.040, 0.004, 1, { pos: [-0.166, 0.116, 0.004] }),
    roundedBox(0.030, 0.010, 0.030, 0.004, 1, { pos: [-0.168, 0.098, 0.010] }),
    ...[-1, 1].map((s) => box(0.003, 0.010, 0.024, { pos: [-0.174 + s * 0.008, 0.088, 0.012] })),
    box(0.048, 0.004, 0.020, { pos: [-0.166, 0.083, 0.010] }),
    curve([[-0.166, 0.083, 0.020], [-0.166, 0.074, 0.026], [-0.180, 0.070, 0.022]], 0.0026, { segments: 8, radial: 5 }),
  ], chrome());

  add('feed_dogs', [
    ...[-0.010, 0.000, 0.010].map((z) => merge([
      box(0.016, 0.006, 0.006, { pos: [NEEDLE_X, 0.0702, NEEDLE_Z + z] }),
      ...Array.from({ length: 4 }, (_, i) => box(0.016, 0.003, 0.0012, { pos: [NEEDLE_X, 0.0739, NEEDLE_Z + z - 0.0021 + i * 0.0014] })),
    ])),
    box(0.058, 0.006, 0.032, { pos: [NEEDLE_X - 0.004, 0.0620, NEEDLE_Z] }),
    cylinder(0.004, 0.004, 0.030, 8, { pos: [NEEDLE_X - 0.010, 0.040, NEEDLE_Z] }),
  ], steel());

  // -------------------------------------------------------------- hook race
  add('rotary_hook', [
    lathe([[0, 0.012], [0.016, 0.011], [0.026, 0.004], [0.029, -0.008], [0.026, -0.016], [0.017, -0.020], [0, -0.020]], 30, { pos: [NEEDLE_X, 0.028, -0.004] }),
    box(0.008, 0.012, 0.020, { pos: [NEEDLE_X - 0.026, 0.036, -0.016], rot: [0, 0.5, 0.3] }),
    torus(0.029, 0.0035, 30, 7, { pos: [NEEDLE_X, 0.028, -0.004], rot: [Math.PI / 2, 0, 0] }),
    gear(0.020, 18, 0.008, NEEDLE_X, 0.014, -0.004, 'y'),
  ], steel());
  add('bobbin_case', [
    cylinder(0.020, 0.020, 0.016, 24, { pos: [NEEDLE_X, 0.032, -0.004] }),
    torus(0.020, 0.0028, 24, 6, { pos: [NEEDLE_X, 0.041, -0.004], rot: [Math.PI / 2, 0, 0] }),
    box(0.012, 0.012, 0.026, { pos: [NEEDLE_X + 0.017, 0.030, -0.004] }),
    box(0.030, 0.003, 0.012, { pos: [NEEDLE_X + 0.010, 0.042, -0.004], rot: [0, 0.4, 0] }),
  ], darkSteel());
  add('bobbin', [
    cylinder(0.0145, 0.0145, 0.017, 20, { pos: [NEEDLE_X, 0.032, -0.004] }),
    ...[-1, 1].map((s) => cylinder(0.0175, 0.0175, 0.0022, 20, { pos: [NEEDLE_X, 0.032 + s * 0.0095, -0.004] })),
  ], pbr('#c9b389', { roughness: 0.6 }));

  add('hook_shaft', [
    cylinder(0.0048, 0.0048, 0.140, 10, { pos: [NEEDLE_X, 0.028, -0.078], rot: [Math.PI / 2, 0, 0] }),
    gear(0.014, 14, 0.008, NEEDLE_X, 0.028, -0.140, 'z'),
  ], steel());

  // ------------------------------------------------------------ take-up arm
  add('take_up_lever', [
    box(0.010, 0.056, 0.006, { pos: [-0.150, 0.250, 0.076], rot: [0, 0, 0.42] }),
    torus(0.0065, 0.0025, 14, 6, { pos: [-0.139, 0.226, 0.079] }),
    cylinder(0.010, 0.010, 0.010, 14, { pos: [-0.158, 0.272, 0.076], rot: [Math.PI / 2, 0, 0] }),
    box(0.012, 0.020, 0.005, { pos: [-0.170, 0.258, 0.076], rot: [0, 0, 0.4] }),
  ], chrome());

  add('tension_unit', [
    cylinder(0.019, 0.019, 0.006, 24, { pos: [-0.176, 0.212, 0.071], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.015, 0.015, 0.004, 24, { pos: [-0.176, 0.212, 0.076], rot: [Math.PI / 2, 0, 0] }),
    knurled(0.016, 0.014, 16, -0.176, 0.212, 0.090),
    cylinder(0.004, 0.004, 0.030, 10, { pos: [-0.176, 0.212, 0.098], rot: [Math.PI / 2, 0, 0] }),
    curve(Array.from({ length: 26 }, (_, i) => {
      const a = i / 25 * TAU * 3.5;
      return [-0.176, 0.212 + Math.sin(a) * 0.0055, 0.082 + i * 0.00055];
    }), 0.0011, { segments: 26, radial: 4 }),
    box(0.020, 0.006, 0.004, { pos: [-0.176, 0.198, 0.073] }),
    // the take-up spring that pulls slack thread tight
    curve([[-0.190, 0.196, 0.074], [-0.200, 0.186, 0.078], [-0.196, 0.172, 0.080], [-0.184, 0.170, 0.078]], 0.0018, { segments: 14, radial: 5 }),
    screw(-0.176, 0.232, 0.073, 0.004, 'z'),
  ], chrome());

  // ----------------------------------------------------------------- thread
  add('spool_pin', [
    cylinder(0.0032, 0.0032, 0.088, 8, { pos: [0.122, 0.340, -0.030] }),
    cylinder(0.0075, 0.0075, 0.006, 12, { pos: [0.122, 0.384, -0.030] }),
    cylinder(0.006, 0.006, 0.008, 10, { pos: [0.122, 0.298, -0.030] }),
  ], chrome());

  add('spool', [
    ...[-1, 1].map((s) => cylinder(0.021, 0.021, 0.0028, 24, { pos: [0.122, 0.340 + s * 0.026, -0.030] })),
    paint(cylinder(0.0175, 0.0175, 0.050, 24, { pos: [0.122, 0.340, -0.030] }), (x, y, z) => {
      const weave = 0.8 + 0.2 * Math.abs(Math.sin(y * 900 + Math.atan2(z + 0.030, x - 0.122) * 24));
      return srgb('#e7dcc4').map((c) => c * weave);
    }),
  ], threadColour());

  add('thread_guides', [
    torus(0.0055, 0.0013, 14, 5, { pos: [0.020, 0.302, 0.010], rot: [0, 0, 0] }),
    torus(0.0055, 0.0013, 14, 5, { pos: [-0.132, 0.290, 0.064], rot: [0, Math.PI / 2, 0] }),
    torus(0.0050, 0.0013, 14, 5, { pos: [-0.196, 0.176, 0.050], rot: [0, Math.PI / 2, 0] }),
    cylinder(0.0026, 0.0026, 0.014, 8, { pos: [-0.196, 0.182, 0.058], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('thread', paint(curve([
    [0.122, 0.368, -0.030],
    [0.100, 0.320, -0.014],
    [0.058, 0.306, 0.004],
    [0.020, 0.302, 0.010],
    [-0.052, 0.302, 0.016],
    [-0.120, 0.294, 0.030],
    [-0.132, 0.290, 0.064],
    [-0.146, 0.274, 0.076],
    [-0.160, 0.246, 0.076],
    [-0.150, 0.230, 0.078],
    [-0.139, 0.226, 0.079],
    [-0.152, 0.212, 0.080],
    [-0.176, 0.208, 0.090],
    [-0.182, 0.196, 0.074],
    [-0.196, 0.176, 0.058],
    [-0.198, 0.168, 0.040],
    [-0.194, 0.150, 0.026],
    [-0.190, 0.126, 0.018],
    [NEEDLE_X, 0.104, NEEDLE_Z],
    [NEEDLE_X, 0.086, NEEDLE_Z],
  ], 0.00135, { segments: 90, radial: 5 }), () => srgb('#e9dfc8')), threadColour());

  // --------------------------------------------------------- inside the arm
  add('upper_shaft', [
    cylinder(0.0068, 0.0068, 0.330, 10, { pos: [0.010, 0.250, 0.006], rot: [0, 0, Math.PI / 2] }),
    gear(0.028, 26, 0.010, 0.150, 0.250, 0.006, 'x'),
    lathe([[0, 0.010], [0.014, 0.010], [0.018, 0.004], [0.018, -0.004], [0.010, -0.008], [0, -0.008]], 20, { pos: [0.062, 0.250, 0.006], rot: [0, 0, Math.PI / 2] }),
    lathe([[0, 0.006], [0.020, 0.006], [0.024, 0.0], [0.020, -0.006], [0, -0.006]], 20, { pos: [-0.020, 0.250, 0.006], rot: [0, Math.PI / 2, 0] }),
    cylinder(0.004, 0.004, 0.044, 8, { pos: [-0.070, 0.250, 0.006], rot: [0, 0, Math.PI / 2] }),
  ], steel());

  add('bevel_gears', [
    gear(0.016, 18, 0.007, -0.158, 0.250, 0.006, 'x'),
    gear(0.013, 14, 0.007, -0.158, 0.232, 0.006, 'y'),
    cylinder(0.004, 0.004, 0.090, 8, { pos: [-0.158, 0.188, 0.006] }),
    cylinder(0.004, 0.004, 0.020, 8, { pos: [-0.158, 0.250, 0.006], rot: [0, 0, Math.PI / 2] }),
  ], brass());

  add('feed_regulator', [
    cylinder(0.010, 0.010, 0.070, 12, { pos: [0.070, 0.100, -0.020], rot: [0, 0, Math.PI / 2] }),
    ...Array.from({ length: 5 }, (_, i) => gear(0.014 + i * 0.001, 16, 0.004, 0.106, 0.100, -0.020, 'x')),
    roundedBox(0.060, 0.012, 0.014, 0.004, 1, { pos: [0.030, 0.090, -0.020], rot: [0, 0.5, 0] }),
    cylinder(0.004, 0.004, 0.090, 8, { pos: [0.000, 0.090, -0.008], rot: [Math.PI / 2, 0, 0] }),
    box(0.006, 0.038, 0.008, { pos: [-0.020, 0.072, -0.008] }),
  ], steel());

  add('motor', [
    cylinder(0.034, 0.034, 0.086, 22, { pos: [0.150, 0.115, 0.000], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.036, 0.036, 0.010, 22, { pos: [0.196, 0.115, 0.000], rot: [0, 0, Math.PI / 2] }),
    gear(0.012, 12, 0.012, 0.104, 0.115, 0.000, 'x'),
    roundedBox(0.020, 0.014, 0.020, 0.004, 1, { pos: [0.150, 0.152, 0.000] }),
  ], darkSteel());

  add('drive_belt', [
    curve(Array.from({ length: 48 }, (_, i) => {
      const a = (i / 47) * TAU;
      return [0.150 + Math.sin(a) * 0.000, 0.162 + Math.sin(a) * 0.061, -0.020 + Math.cos(a) * 0.020];
    }), 0.0022, { segments: 48, radial: 4 }),
  ], rubber());

  add('wiring', [
    paint(curve([[0.170, 0.090, 0.030], [0.180, 0.070, 0.050], [0.170, 0.055, 0.070], [0.120, 0.052, 0.086], [0.060, 0.058, 0.078]], 0.0018, { segments: 20, radial: 4 }), () => srgb('#7a3b2c')),
    paint(curve([[0.170, 0.086, 0.034], [0.176, 0.062, 0.056], [0.150, 0.050, 0.078], [0.100, 0.050, 0.090], [0.060, 0.056, 0.082]], 0.0018, { segments: 20, radial: 4 }), () => srgb('#2e5f8a')),
    paint(curve([[0.170, 0.128, 0.034], [0.190, 0.150, 0.055], [0.190, 0.230, 0.060], [0.160, 0.262, 0.070], [0.126, 0.260, 0.072]], 0.0018, { segments: 20, radial: 4 }), () => srgb('#b8a23c')),
  ], pbr('#ffffff', { roughness: 0.6, vertexColors: true }));

  return g;
}

export const meta = { width: 0.50, height: 0.40, depth: 0.22 };
