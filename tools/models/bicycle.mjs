// A lugged steel road bicycle, sized like a 54 cm frame: 700c wheels, a
// 1.04 m wheelbase, 170 mm cranks, a 2x8 drivetrain and rim brakes.
//
// +Z is forward, +X the drive side, +Y up. The frame is built from the four
// points that define any bicycle — rear axle, bottom bracket, seat cluster and
// head tube — so the tubes, the chain line and the wheel clearances all follow
// from them instead of being tuned by hand.
import {
  THREE, TAU, part, pbr, place, roundedBox, box, cylinder, torus,
  curve, merge, paint, srgb,
} from '../lib/geo.mjs';

const red = () => pbr('#9c302c', { roughness: 0.3, metalness: 0.15 });
const chrome = () => pbr('#d8dde1', { metalness: 0.92, roughness: 0.16 });
const alloy = () => pbr('#b9c1c7', { metalness: 0.85, roughness: 0.3 });
const darkAlloy = () => pbr('#5c646b', { metalness: 0.8, roughness: 0.38 });
const rubber = () => pbr('#24272a', { roughness: 0.86 });
const leather = () => pbr('#ffffff', { roughness: 0.62, vertexColors: true });
const tyreSkin = () => pbr('#ffffff', { roughness: 0.82, vertexColors: true });
const barSkin = () => pbr('#ffffff', { metalness: 0.55, roughness: 0.4, vertexColors: true });
const chainMetal = () => pbr('#8d949a', { metalness: 0.88, roughness: 0.3 });

const REAR = [0, 0.340, -0.510];
const FRONT = [0, 0.340, 0.530];
const BB = [0, 0.275, -0.075];
const SEAT = [0, 0.790, -0.176];
const HEAD_TOP = [0, 0.884, 0.372];
const HEAD_BOT = [0, 0.744, 0.420];
const HEAD_TILT = -0.331;
const BAR = [0, 0.952, 0.452];
const RIM_R = 0.292;
const TYRE_C = 0.326;
const TYRE_T = 0.0165;
const DRIVE_X = 0.062;

function tube(a, b, radius, radial = 10) {
  return curve([a, b], radius, { segments: 2, radial });
}

function aroundX(shape, depth, x, y, z) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 44 });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x, y, z);
  return geometry;
}

function spoke(a, b) {
  const direction = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const geometry = new THREE.CylinderGeometry(0.0012, 0.0012, direction.length(), 3, 1);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
  geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return geometry;
}

/** A real chainring: a flat ring, a five-arm spider and cut teeth — not a disc. */
function chainring(radius, teeth, x, y, z) {
  const rimShape = new THREE.Shape();
  rimShape.absarc(0, 0, radius, 0, TAU, false);
  rimShape.holes.push(new THREE.Path().absarc(0, 0, radius - 0.011, 0, TAU, true));
  const ring = new THREE.ExtrudeGeometry(rimShape, { depth: 0.004, bevelEnabled: false, curveSegments: 40 });
  ring.translate(0, 0, -0.002);
  ring.rotateY(Math.PI / 2);
  ring.translate(x, y, z);
  const bits = [ring];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * TAU;
    bits.push(box(0.0042, 0.0064, 0.0042, {
      pos: [x, y + Math.sin(a) * (radius + 0.0022), z + Math.cos(a) * (radius + 0.0022)],
      rot: [a, 0, 0],
    }));
  }
  const armLength = radius - 0.026;
  const armCentre = (radius + 0.026) / 2;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU;
    bits.push(box(0.0042, armLength, 0.018, {
      pos: [x, y + Math.sin(a) * armCentre, z + Math.cos(a) * armCentre],
      rot: [a, 0, 0],
    }));
  }
  bits.push(cylinder(0.024, 0.024, 0.006, 20, { pos: [x, y, z], rot: [0, 0, Math.PI / 2] }));
  bits.push(...[1, -1].flatMap((s) => [0.019, 0.030].map((r) => box(0.0035, 0.0045, r * 2, { pos: [x + s * 0.002, y, z - r], rot: [0, 0, 0] }))));
  return merge(bits);
}

function toothedDisc(radius, teeth, thickness, x, y, z) {
  const bits = [cylinder(radius, radius, thickness, 30, { pos: [x, y, z], rot: [0, 0, Math.PI / 2] })];
  for (let i = 0; i < teeth; i += 1) {
    const a = (i / teeth) * TAU;
    bits.push(box(thickness * 0.85, 0.0062, 0.0048, {
      pos: [x, y + Math.sin(a) * (radius + 0.0022), z + Math.cos(a) * (radius + 0.0022)],
      rot: [a, 0, 0],
    }));
  }
  return merge(bits);
}

function bolt(x, y, z, r = 0.006, axis = 'x') {
  return place(merge([
    cylinder(r, r, 0.010, 6),
    cylinder(r * 0.55, r * 0.55, 0.014, 6),
  ]), { rot: axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0], pos: [x, y, z] });
}

export default function bicycle() {
  const g = new THREE.Group();
  const add = (name, geometry, material) => g.add(part(name, geometry, material));

  // ------------------------------------------------------------------ frame
  add('frame', [
    tube([0, 0.786, -0.176], [0, 0.872, 0.366], 0.0175, 12),
    tube([0, 0.282, -0.066], [0, 0.740, 0.414], 0.0215, 12),
    tube([0, 0.282, -0.062], [0, 0.800, -0.186], 0.0160, 12),
    cylinder(0.0225, 0.0225, 0.150, 16, { pos: [0, 0.814, 0.396], rot: [HEAD_TILT, 0, 0] }),
    cylinder(0.030, 0.030, 0.056, 18, { pos: [0, 0.275, -0.075] }),
    ...[1, -1].flatMap((s) => [
      curve([[s * 0.028, 0.278, -0.094], [s * 0.038, 0.292, -0.280], [s * 0.047, 0.322, -0.460], [s * 0.050, 0.340, -0.508]], 0.0095, { segments: 20, radial: 8 }),
      curve([[s * 0.020, 0.772, -0.188], [s * 0.032, 0.650, -0.290], [s * 0.044, 0.480, -0.420], [s * 0.050, 0.348, -0.500]], 0.0085, { segments: 20, radial: 8 }),
      roundedBox(0.030, 0.026, 0.030, 0.006, 1, { pos: [s * 0.022, 0.788, -0.180] }),
      roundedBox(0.016, 0.042, 0.032, 0.006, 1, { pos: [s * 0.050, 0.342, -0.508] }),
      // brake bridge and the pump peg, both real small brazings
      roundedBox(0.052, 0.014, 0.012, 0.005, 1, { pos: [s * 0.028, 0.700, -0.300] }),
    ]),
    roundedBox(0.056, 0.014, 0.012, 0.005, 1, { pos: [0, 0.700, -0.300] }),
    roundedBox(0.058, 0.016, 0.014, 0.005, 1, { pos: [0, 0.738, 0.392] }),
  ], red());

  add('head_badge', [
    paint(roundedBox(0.030, 0.046, 0.004, 0.002, 1, { pos: [0, 0.816, 0.418], rot: [HEAD_TILT, 0, 0] }), () => srgb('#c9a94e')),
  ], pbr('#ffffff', { metalness: 0.7, roughness: 0.3, vertexColors: true }));

  // ------------------------------------------------------------------- fork
  add('fork', [
    cylinder(0.028, 0.026, 0.036, 16, { pos: [0, 0.728, 0.422], rot: [HEAD_TILT, 0, 0] }),
    ...[1, -1].map((s) => curve([
      [s * 0.012, 0.722, 0.424], [s * 0.038, 0.600, 0.468], [s * 0.048, 0.450, 0.512], [s * 0.050, 0.342, 0.528],
    ], 0.0115, { segments: 22, radial: 9 })),
    ...[1, -1].map((s) => roundedBox(0.016, 0.040, 0.030, 0.005, 1, { pos: [s * 0.050, 0.342, 0.528] })),
    roundedBox(0.062, 0.018, 0.020, 0.006, 1, { pos: [0, 0.712, 0.430], rot: [HEAD_TILT, 0, 0] }),
  ], red());

  // -------------------------------------------------------------- headset
  add('headset', [
    ...[-1, 1].map((s) => cylinder(0.0255, 0.0255, 0.010, 18, { pos: [0, 0.812 + s * 0.070, 0.400 - s * 0.022], rot: [HEAD_TILT, 0, 0] })),
    cylinder(0.012, 0.012, 0.080, 10, { pos: [0, 0.838, 0.404], rot: [HEAD_TILT, 0, 0] }),
    bolt(0, 0.884, 0.372, 0.008, 'y'),
  ], alloy());

  add('stem', [
    tube([0, 0.876, 0.378], [0, 0.946, 0.436], 0.0165, 12),
    roundedBox(0.046, 0.036, 0.042, 0.008, 2, { pos: [0, 0.953, 0.452] }),
    ...[-1, 1].map((s) => bolt(s * 0.015, 0.966, 0.438, 0.0045, 'y')),
  ], darkAlloy());

  // ------------------------------------------------------------- handlebar
  const barPoints = (s) => ([
    [s * 0.020, 0.952, 0.452],
    [s * 0.100, 0.955, 0.454],
    [s * 0.166, 0.953, 0.466],
    [s * 0.194, 0.944, 0.486],
    [s * 0.202, 0.918, 0.510],
    [s * 0.197, 0.891, 0.505],
    [s * 0.187, 0.868, 0.482],
    [s * 0.178, 0.857, 0.450],
    [s * 0.170, 0.859, 0.418],
  ]);
  add('handlebar', [
    paint(cylinder(0.0125, 0.0125, 0.054, 12, { pos: [0, 0.952, 0.452], rot: [0, 0, Math.PI / 2] }), () => srgb('#c8ccd0')),
    ...[1, -1].map((s) => paint(curve(barPoints(s), 0.0125, { segments: 44, radial: 10 }), (x, y, z) => (
      Math.abs(x) > 0.145 && y < 0.948 ? srgb('#3a2c25') : srgb('#c8ccd0')
    ))),
  ], barSkin());

  add('brake_levers', [1, -1].map((s) => merge([
    paint(roundedBox(0.026, 0.030, 0.052, 0.010, 2, { pos: [s * 0.187, 0.948, 0.478] }), () => srgb('#2f3236')),
    paint(curve([[s * 0.192, 0.940, 0.486], [s * 0.198, 0.916, 0.508], [s * 0.200, 0.892, 0.512], [s * 0.197, 0.880, 0.502]], 0.008, { segments: 14, radial: 6 }), () => srgb('#c8ccd0')),
    paint(box(0.005, 0.020, 0.008, { pos: [s * 0.187, 0.932, 0.496] }), () => srgb('#b6b0a4')),
    paint(curve([[s * 0.180, 0.960, 0.474], [s * 0.176, 0.968, 0.462], [s * 0.170, 0.968, 0.452]], 0.0022, { segments: 8, radial: 4 }), () => srgb('#1f2225')),
  ])), barSkin());

  // ---------------------------------------------------------------- wheels
  const wheel = (label, axleZ, hubWidth) => {
    const rim = new THREE.Shape();
    rim.absarc(0, 0, 0.310, 0, TAU, false);
    rim.holes.push(new THREE.Path().absarc(0, 0, 0.278, 0, TAU, true));
    add(`${label}_rim`, aroundX(rim, 0.024, 0, 0.340, axleZ), alloy());

    add(`${label}_tyre`, paint(torus(TYRE_C, TYRE_T, 60, 12, { pos: [0, 0.340, axleZ], rot: [0, Math.PI / 2, 0] }), (x, y, z) => {
      const sideways = Math.abs(x);
      const tan = srgb('#b9a077');
      const black = srgb('#24272a');
      const tread = sideways < 0.0105;
      const speck = 0.93 + 0.07 * Math.sin(x * 520) * Math.cos(z * 380);
      return (tread ? black : tan).map((c) => c * speck);
    }), tyreSkin());

    const spokes = [];
    const perSide = 14;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < perSide; i += 1) {
        const a = (i / perSide) * TAU + (side > 0 ? 0.19 : 0);
        const hubA = a + side * 0.24;
        spokes.push(spoke(
          [side * (hubWidth / 2 - 0.006), 0.340 + Math.sin(hubA) * 0.023, axleZ + Math.cos(hubA) * 0.023],
          [0, 0.340 + Math.sin(a) * 0.289, axleZ + Math.cos(a) * 0.289],
        ));
        spokes.push(cylinder(0.0032, 0.0032, 0.011, 6, {
          pos: [0, 0.340 + Math.sin(a) * 0.287, axleZ + Math.cos(a) * 0.287],
          rot: [a, 0, 0],
        }));
      }
    }
    add(`${label}_spokes`, spokes, alloy());

    add(`${label}_hub`, [
      cylinder(0.019, 0.019, hubWidth, 18, { pos: [0, 0.340, axleZ], rot: [0, 0, Math.PI / 2] }),
      ...[-1, 1].map((s) => cylinder(0.030, 0.030, 0.004, 24, { pos: [s * (hubWidth / 2 - 0.008), 0.340, axleZ], rot: [0, 0, Math.PI / 2] })),
      cylinder(0.0045, 0.0045, hubWidth + 0.055, 8, { pos: [0, 0.340, axleZ], rot: [0, 0, Math.PI / 2] }),
      ...[-1, 1].map((s) => cylinder(0.008, 0.008, 0.014, 10, { pos: [s * (hubWidth / 2 + 0.026), 0.340, axleZ], rot: [0, 0, Math.PI / 2] })),
    ], chrome());

    add(`${label}_valve`, [
      cylinder(0.0035, 0.0035, 0.032, 6, { pos: [0, 0.340 + 0.294, axleZ] }),
      cylinder(0.0055, 0.0055, 0.010, 8, { pos: [0, 0.340 + 0.312, axleZ] }),
    ], chrome());
  };
  wheel('front', FRONT[2], 0.100);
  wheel('rear', REAR[2], 0.130);

  // -------------------------------------------------------------- drivetrain
  add('bottom_bracket', [
    cylinder(0.016, 0.016, 0.148, 14, { pos: [0, 0.275, -0.075], rot: [0, 0, Math.PI / 2] }),
    ...[-1, 1].map((s) => cylinder(0.024, 0.024, 0.012, 18, { pos: [s * 0.064, 0.275, -0.075], rot: [0, 0, Math.PI / 2] })),
    cylinder(0.030, 0.030, 0.024, 18, { pos: [0.052, 0.275, -0.075], rot: [0, 0, Math.PI / 2] }),
  ], darkAlloy());

  add('crankset', [
    chainring(0.100, 52, 0.058, 0.275, -0.075),
    chainring(0.076, 39, 0.050, 0.275, -0.075),
    curve([[0.070, 0.275, -0.075], [0.078, 0.330, -0.098], [0.079, 0.420, -0.098]], 0.0115, { segments: 12, radial: 8 }),
    curve([[-0.070, 0.275, -0.075], [-0.078, 0.218, -0.058], [-0.079, 0.128, -0.056]], 0.0115, { segments: 12, radial: 8 }),
    ...[-1, 1].map((s) => cylinder(0.012, 0.012, 0.020, 10, {
      pos: [s * 0.079, s > 0 ? 0.422 : 0.128, s > 0 ? -0.098 : -0.056],
      rot: [0, 0, Math.PI / 2],
    })),
  ], alloy());

  add('pedals', [
    ...[1, -1].map((s) => merge([
      cylinder(0.0055, 0.0055, 0.056, 8, {
        pos: [s * 0.100, s > 0 ? 0.422 : 0.128, s > 0 ? -0.098 : -0.056],
        rot: [0, 0, Math.PI / 2],
      }),
      paint(roundedBox(0.058, 0.016, 0.076, 0.007, 2, {
        pos: [s * 0.116, s > 0 ? 0.422 : 0.128, s > 0 ? -0.098 : -0.056],
      }), () => srgb('#7c8288')),
      ...[-1, 1].map((e) => paint(box(0.052, 0.012, 0.018, {
        pos: [s * 0.118, s > 0 ? 0.422 : 0.128, (s > 0 ? -0.098 : -0.056) + e * 0.039],
        rot: [e * 0.18, 0, 0],
      }), () => srgb('#c9a02f'))),
      paint(box(0.046, 0.007, 0.010, { pos: [s * 0.116, (s > 0 ? 0.428 : 0.134), s > 0 ? -0.098 : -0.056] }), () => srgb('#2a2c2e')),
    ])),
  ], barSkin());

  add('cassette', [
    ...Array.from({ length: 8 }, (_, i) => toothedDisc(0.050 - i * 0.0032, 20 + i * 2, 0.0032, 0.030 + i * 0.0062, 0.340, -0.510)),
    cylinder(0.028, 0.028, 0.052, 18, { pos: [0.054, 0.340, -0.510], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.012, 0.012, 0.072, 10, { pos: [0.088, 0.340, -0.510], rot: [0, 0, Math.PI / 2] }),
  ], alloy());

  const chainPath = [];
  for (let i = 0; i <= 26; i += 1) {
    const t = Math.PI / 2 - (i / 26) * Math.PI;
    chainPath.push([DRIVE_X, 0.275 + Math.sin(t) * 0.100, -0.075 + Math.cos(t) * 0.100]);
  }
  chainPath.push([DRIVE_X, 0.292, -0.510]);
  for (let i = 0; i <= 20; i += 1) {
    const t = Math.PI + (i / 20) * Math.PI;
    chainPath.push([DRIVE_X, 0.340 + Math.sin(t) * 0.048, -0.510 + Math.cos(t) * 0.048]);
  }
  const chain = [curve(chainPath, 0.0038, { segments: 130, radial: 4, closed: true })];
  for (let i = 0; i < 92; i += 1) {
    const a = chainPath[Math.floor((i / 92) * chainPath.length) % chainPath.length];
    const b = chainPath[(Math.floor((i / 92) * chainPath.length) + 1) % chainPath.length];
    if (!a || !b) continue;
    chain.push(box(0.010, 0.011, 0.012, {
      pos: [DRIVE_X + 0.002, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
      rot: [Math.atan2(-(b[1] - a[1]), b[2] - a[2]), 0, 0],
    }));
  }
  // A bicycle chain is far thinner across than it is tall. Flattening the loop
  // laterally is both truer to the real part and keeps the hotspot off the
  // inner equator, where the surface is tangent to the camera ray.
  chain.forEach((geometry) => geometry.translate(-DRIVE_X, 0, 0).scale(0.72, 1, 1).translate(DRIVE_X, 0, 0));
  add('chain', chain, chainMetal());

  add('rear_derailleur', [
    roundedBox(0.030, 0.050, 0.024, 0.008, 2, { pos: [0.079, 0.315, -0.505] }),
    bolt(0.062, 0.340, -0.500, 0.010, 'x'),
    curve([[0.084, 0.300, -0.512], [0.090, 0.262, -0.532], [0.092, 0.222, -0.520]], 0.0075, { segments: 12, radial: 6 }),
    ...[[0.087, 0.258, -0.552], [0.090, 0.212, -0.502]].map(([x, y, z]) => merge([
      cylinder(0.014, 0.014, 0.008, 16, { pos: [x, y, z], rot: [0, 0, Math.PI / 2] }),
      ...Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * TAU;
        return box(0.007, 0.0022, 0.0022, { pos: [x + 0.004, y + Math.sin(a) * 0.0155, z + Math.cos(a) * 0.0155], rot: [a, 0, 0] });
      }),
    ])),
    box(0.010, 0.058, 0.008, { pos: [0.104, 0.238, -0.527], rot: [0.5, 0, 0] }),
    box(0.016, 0.034, 0.014, { pos: [0.079, 0.298, -0.478], rot: [0.4, 0, 0] }),
  ], darkAlloy());

  add('front_derailleur', [
    cylinder(0.021, 0.021, 0.020, 16, { pos: [0.014, 0.330, -0.128], rot: [0, 0, Math.PI / 2] }),
    curve([[0.030, 0.330, -0.128], [0.046, 0.330, -0.100], [0.046, 0.318, -0.060]], 0.0055, { segments: 10, radial: 6 }),
    box(0.006, 0.058, 0.062, { pos: [0.046, 0.298, -0.052] }),
    box(0.026, 0.006, 0.052, { pos: [0.046, 0.322, -0.045] }),
  ], darkAlloy());

  // ----------------------------------------------------------------- brakes
  add('front_brake', [
    cylinder(0.010, 0.010, 0.040, 12, { pos: [0, 0.706, 0.438], rot: [0, 0, Math.PI / 2] }),
    ...[1, -1].map((s) => curve([
      [s * 0.020, 0.702, 0.440], [s * 0.040, 0.680, 0.458], [s * 0.044, 0.650, 0.478],
    ], 0.0062, { segments: 10, radial: 6 })),
    ...[1, -1].map((s) => merge([
      roundedBox(0.014, 0.034, 0.014, 0.003, 1, { pos: [s * 0.044, 0.642, 0.482] }),
      box(0.006, 0.030, 0.012, { pos: [s * 0.051, 0.642, 0.482] }),
    ])),
    curve([[0, 0.716, 0.448], [0, 0.734, 0.430], [0, 0.790, 0.412], [0, 0.850, 0.396]], 0.0022, { segments: 16, radial: 5 }),
  ], darkAlloy());

  add('rear_brake', [
    cylinder(0.009, 0.009, 0.034, 12, { pos: [0, 0.696, -0.300], rot: [0, 0, Math.PI / 2] }),
    ...[1, -1].map((s) => curve([
      [s * 0.017, 0.692, -0.304], [s * 0.035, 0.660, -0.330], [s * 0.040, 0.628, -0.352],
    ], 0.0060, { segments: 10, radial: 6 })),
    ...[1, -1].map((s) => merge([
      roundedBox(0.014, 0.032, 0.014, 0.003, 1, { pos: [s * 0.040, 0.622, -0.360] }),
      box(0.006, 0.028, 0.012, { pos: [s * 0.047, 0.622, -0.360] }),
    ])),
  ], darkAlloy());

  add('cables', [
    paint(curve([[-0.180, 0.955, 0.474], [-0.184, 0.968, 0.444], [-0.150, 0.972, 0.416], [-0.070, 0.958, 0.424], [-0.020, 0.918, 0.444], [-0.006, 0.860, 0.438], [-0.004, 0.760, 0.432], [-0.002, 0.722, 0.432]], 0.0021, { segments: 40, radial: 5 }), () => srgb('#1f2225')),
    paint(curve([[0.184, 0.955, 0.474], [0.188, 0.968, 0.444], [0.152, 0.972, 0.416], [0.090, 0.960, 0.404], [0.030, 0.926, 0.408], [0.012, 0.888, 0.380], [0.012, 0.856, 0.300], [0.014, 0.828, 0.160], [0.014, 0.800, -0.050], [0.012, 0.786, -0.186], [0.008, 0.740, -0.270], [0.004, 0.706, -0.298]], 0.0021, { segments: 52, radial: 5 }), () => srgb('#1f2225')),
    paint(curve([[0.194, 0.938, 0.486], [0.198, 0.916, 0.474], [0.172, 0.878, 0.446], [0.120, 0.838, 0.426], [0.050, 0.760, 0.436], [0.020, 0.600, 0.404], [0.016, 0.430, 0.340], [0.018, 0.330, 0.220], [0.020, 0.300, 0.060], [0.040, 0.300, -0.300], [0.076, 0.310, -0.476]], 0.0020, { segments: 52, radial: 5 }), () => srgb('#1f2225')),
    paint(curve([[-0.194, 0.938, 0.486], [-0.198, 0.914, 0.472], [-0.170, 0.876, 0.442], [-0.100, 0.818, 0.404], [-0.030, 0.700, 0.382], [0.000, 0.520, 0.322], [0.014, 0.360, 0.180], [0.030, 0.336, -0.020], [0.044, 0.328, -0.062]], 0.0020, { segments: 46, radial: 5 }), () => srgb('#1f2225')),
  ], pbr('#ffffff', { roughness: 0.5, vertexColors: true }));

  // ----------------------------------------------------------------- saddle
  add('saddle', [
    paint(merge([
      place(new THREE.SphereGeometry(1, 26, 14), { scale: [0.070, 0.020, 0.088], pos: [0, 0.930, -0.272] }),
      place(new THREE.SphereGeometry(1, 22, 12), { scale: [0.052, 0.018, 0.070], pos: [0, 0.928, -0.196] }),
      place(new THREE.SphereGeometry(1, 20, 12), { scale: [0.026, 0.016, 0.075], pos: [0, 0.926, -0.104] }),
      place(new THREE.SphereGeometry(1, 18, 10), { scale: [0.017, 0.012, 0.045], pos: [0, 0.923, -0.040] }),
    ]), (x, y, z) => {
      const seam = Math.abs(Math.sin((z + 0.30) * 120)) * 0.08;
      return srgb('#6b4a33').map((c) => c * (0.94 + seam));
    }),
    paint(box(0.088, 0.006, 0.012, { pos: [0, 0.916, -0.268] }), () => srgb('#4a3222')),
  ], leather());

  add('seatpost', [
    cylinder(0.0135, 0.0135, 0.150, 14, { pos: [0, 0.855, -0.214], rot: [0.22, 0, 0] }),
    roundedBox(0.036, 0.034, 0.050, 0.008, 2, { pos: [0, 0.792, -0.178], rot: [0.16, 0, 0] }),
    bolt(0.018, 0.800, -0.150, 0.006, 'x'),
    cylinder(0.005, 0.005, 0.070, 8, { pos: [0, 0.918, -0.270], rot: [Math.PI / 2, 0, 0] }),
    ...[-1, 1].map((s) => box(0.010, 0.028, 0.012, { pos: [s * 0.040, 0.906, -0.296] })),
  ], chrome());

  add('bell', [
    place(new THREE.SphereGeometry(0.026, 18, 12, 0, TAU, 0, Math.PI / 2), { pos: [-0.090, 0.966, 0.436] }),
    cylinder(0.026, 0.030, 0.006, 20, { pos: [-0.090, 0.964, 0.436] }),
    cylinder(0.010, 0.010, 0.014, 10, { pos: [-0.090, 0.950, 0.436] }),
    curve([[-0.090, 0.964, 0.448], [-0.086, 0.956, 0.470], [-0.070, 0.950, 0.474]], 0.0028, { segments: 10, radial: 5 }),
  ], chrome());

  return g;
}

export const meta = { width: 0.46, height: 1.02, depth: 1.79 };
