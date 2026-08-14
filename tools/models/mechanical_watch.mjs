// Conventional 40 mm automatic wristwatch. The movement is built around the
// local Y axis: dial and train lie in XZ planes, with +Y toward the crystal.
// The shot manifest turns that axis toward the app camera so the strap is
// vertical and the dial opens like a familiar wristwatch rather than a stack.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, lathe, merge,
  ring, sphere, curve, place,
} from '../lib/geo.mjs';

function named(material, name) {
  material.name = name;
  return material;
}

const STEEL = () => named(pbr('#bfc7ce', { metalness: 0.92, roughness: 0.28 }), 'brushed steel');
const POLISHED_STEEL = () => named(pbr('#dce2e6', { metalness: 0.98, roughness: 0.14 }), 'polished steel');
const DARK_STEEL = () => named(pbr('#26313a', { metalness: 0.82, roughness: 0.3 }), 'blued steel');
const BRASS = () => named(pbr('#d2a84f', { metalness: 0.88, roughness: 0.3 }), 'machined brass');
const RUBY = () => {
  const material = named(pbr('#a80f3e', { metalness: 0.04, roughness: 0.18 }), 'synthetic ruby');
  material.transparent = true;
  material.opacity = 0.9;
  return material;
};
const DIAL = () => named(pbr('#e9e5d8', { metalness: 0.02, roughness: 0.34 }), 'warm enamel dial');
const RUBBER = () => named(pbr('#171a1c', { metalness: 0.02, roughness: 0.82 }), 'black rubber strap');
const GLASS = () => {
  const material = named(pbr('#d9f0f5', { metalness: 0, roughness: 0.08 }), 'sapphire glass');
  material.transparent = true;
  material.opacity = 0.24;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  return material;
};

// Each engaged pair shares a tooth module: pitch-radius ratio equals tooth-
// count ratio. The centre wheel is the 1/60 reference and the fourth wheel is
// 1:1 with seconds, so the two compound stages multiply speed by 8 × 7.5 = 60.
const TRAIN = {
  barrelWheel: { radius: 0.309063, teeth: 54 },
  centrePinion: { radius: 0.103021, teeth: 18 },
  centreWheel: { radius: 0.239759, teeth: 64 },
  thirdPinion: { radius: 0.02997, teeth: 8 },
  thirdWheel: { radius: 0.194378, teeth: 60 },
  fourthPinion: { radius: 0.025917, teeth: 8 },
  fourthWheel: { radius: 0.15836, teeth: 36 },
  escapePinion: { radius: 0.035191, teeth: 8 },
};

function toothedGear(radius, teeth, thickness, x, y, z, { hub = 0.09, spokes = 5 } = {}) {
  const toothWidth = Math.max(0.025, (TAU * radius / teeth) * 0.55);
  const geometry = [
    cylinder(radius * 0.78, radius * 0.78, thickness, Math.max(36, teeth * 2), { pos: [x, y, z] }),
    cylinder(hub, hub, thickness * 1.3, 24, { pos: [x, y, z] }),
    // Plain tooth blocks keep the dense outline crisp without spending the
    // mobile triangle budget rounding details smaller than a watch tooth.
    place(ring(teeth, () => box(radius * 0.18, thickness, toothWidth, {
      pos: [radius * 0.88, 0, 0],
    })), { pos: [x, y, z] }),
  ];
  if (spokes) {
    geometry.push(place(ring(spokes, () => roundedBox(radius * 0.64, thickness * 0.72, 0.045, 0.01, 2, {
      pos: [radius * 0.36, 0, 0],
    })), { pos: [x, y + thickness * 0.04, z] }));
  }
  return merge(geometry);
}

function spiral(cx, y, cz, startRadius, endRadius, turns, radius, segments = 150) {
  const points = Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const angle = t * turns * TAU;
    const r = startRadius + (endRadius - startRadius) * t;
    return [cx + Math.cos(angle) * r, y, cz + Math.sin(angle) * r];
  });
  return curve(points, radius, { segments, radial: 7 });
}

function crescentRotor() {
  const start = -2.58;
  const end = 0.58;
  const outer = 0.83;
  const inner = 0.48;
  const shape = new THREE.Shape();
  shape.moveTo(Math.cos(start) * outer, Math.sin(start) * outer);
  shape.absarc(0, 0, outer, start, end, false);
  shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  shape.absarc(0, 0, inner, end, start, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.012,
    curveSegments: 56,
  });
  geometry.translate(0, 0, -0.0275);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.17, 0);
  return merge([
    geometry,
    cylinder(0.15, 0.15, 0.06, 40, { pos: [0, -0.17, 0] }),
    torus(0.15, 0.014, 32, 10, { pos: [0, -0.2, 0], rot: [Math.PI / 2, 0, 0] }),
    // The small pickup turns with the rotor but stops short of the fixed train:
    // the visible gap represents the one-way clutch that is abstracted here.
    toothedGear(0.035, 10, 0.032, 0, -0.13, 0, { hub: 0.014, spokes: 0 }),
  ]);
}

function crownGeometry() {
  const flutes = Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * TAU;
    return roundedBox(0.16, 0.018, 0.035, 0.005, 2, {
      pos: [1.18, Math.cos(angle) * 0.125, Math.sin(angle) * 0.125],
      rot: [angle, 0, 0],
    });
  });
  return merge([
    cylinder(0.125, 0.125, 0.18, 40, { pos: [1.18, 0, 0], rot: [0, 0, Math.PI / 2] }),
    torus(0.116, 0.015, 36, 10, { pos: [1.095, 0, 0], rot: [0, Math.PI / 2, 0] }),
    torus(0.116, 0.015, 36, 10, { pos: [1.265, 0, 0], rot: [0, Math.PI / 2, 0] }),
    flutes,
  ]);
}

export default function mechanicalWatch() {
  const group = new THREE.Group();

  const caseProfile = [
    [0.9, -0.17], [0.985, -0.17], [1.035, -0.12], [1.05, -0.02],
    [1.045, 0.09], [1.005, 0.15], [0.91, 0.17], [0.9, -0.17],
  ];
  const bezelProfile = [
    [0.875, 0.16], [0.99, 0.155], [1.035, 0.185], [1.01, 0.235],
    [0.91, 0.265], [0.875, 0.245], [0.875, 0.16],
  ];

  group.add(
    part('case', merge([
      lathe(caseProfile, 96),
      torus(0.995, 0.028, 96, 12, { pos: [0, -0.11, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), STEEL()),

    part('bezel', merge([
      lathe(bezelProfile, 96),
      torus(0.91, 0.015, 96, 10, { pos: [0, 0.25, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), POLISHED_STEEL()),

    part('crystal', merge([
      cylinder(0.89, 0.89, 0.036, 96, { pos: [0, 0.268, 0] }),
      torus(0.86, 0.015, 96, 12, { pos: [0, 0.278, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), GLASS()),

    part('caseback', merge([
      cylinder(0.91, 0.91, 0.046, 96, { pos: [0, -0.258, 0] }),
      torus(0.83, 0.027, 96, 12, { pos: [0, -0.268, 0], rot: [Math.PI / 2, 0, 0] }),
      ring(8, () => roundedBox(0.08, 0.014, 0.025, 0.004, 2, { pos: [0.84, -0.282, 0] })),
    ]), STEEL()),

    part('crown', crownGeometry(), POLISHED_STEEL()),

    part('winding_stem', merge([
      cylinder(0.028, 0.028, 0.72, 20, { pos: [0.82, -0.02, 0], rot: [0, 0, Math.PI / 2] }),
      toothedGear(0.1, 16, 0.032, 0.48, -0.13, 0, { hub: 0.03, spokes: 0 }),
      toothedGear(0.11, 18, 0.032, 0.3, -0.13, 0.1, { hub: 0.03, spokes: 0 }),
      toothedGear(0.1, 16, 0.032, 0.12, -0.13, 0.19, { hub: 0.028, spokes: 0 }),
      toothedGear(0.1, 16, 0.032, -0.06, -0.13, 0.27, { hub: 0.028, spokes: 0 }),
      toothedGear(0.1, 16, 0.032, -0.25, -0.13, 0.29, { hub: 0.028, spokes: 0 }),
      cylinder(0.055, 0.035, 0.09, 20, { pos: [0.48, -0.055, 0] }),
    ]), STEEL()),

    part('dial', merge([
      cylinder(0.855, 0.855, 0.028, 96, { pos: [0, 0.175, 0] }),
      ring(12, (_, angle) => roundedBox(angle % (Math.PI / 2) < 0.01 ? 0.075 : 0.05, 0.026, 0.135, 0.012, 2, {
        pos: [0, 0.198, 0.7],
      })),
      ring(60, (index) => index % 5 ? cylinder(0.008, 0.008, 0.016, 8, { pos: [0, 0.197, 0.785] }) : null),
      torus(0.08, 0.012, 36, 8, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), DIAL()),

    part('hour_hand', place(merge([
      roundedBox(0.075, 0.018, 0.47, 0.018, 3, { pos: [0, 0.208, 0.22] }),
      cylinder(0.075, 0.075, 0.02, 28, { pos: [0, 0.208, 0] }),
    ]), { rot: [0, -0.92, 0] }), DARK_STEEL()),

    part('minute_hand', place(merge([
      roundedBox(0.05, 0.016, 0.67, 0.012, 3, { pos: [0, 0.22, 0.31] }),
      cylinder(0.055, 0.055, 0.018, 24, { pos: [0, 0.22, 0] }),
    ]), { rot: [0, 0.88, 0] }), DARK_STEEL()),

    part('seconds_hand', place(merge([
      roundedBox(0.014, 0.01, 0.79, 0.004, 2, { pos: [0, 0.232, 0.29] }),
      cylinder(0.035, 0.035, 0.014, 20, { pos: [0, 0.232, 0] }),
      sphere(0.035, 18, { pos: [0, 0.232, -0.24], scale: [1, 0.22, 1] }),
    ]), { rot: [0, Math.PI, 0] }), named(pbr('#a33b35', { metalness: 0.72, roughness: 0.25 }), 'lacquered steel')),

    part('automatic_rotor', crescentRotor(), named(pbr('#b6bec5', { metalness: 0.94, roughness: 0.24 }), 'rotor steel')),

    part('mainspring_barrel', merge([
      toothedGear(TRAIN.barrelWheel.radius, TRAIN.barrelWheel.teeth, 0.032, -0.42, -0.07, 0.24, { hub: 0.06, spokes: 0 }),
      cylinder(0.235, 0.235, 0.05, 56, { pos: [-0.42, -0.04, 0.24] }),
      spiral(-0.42, -0.005, 0.24, 0.045, 0.195, 4.2, 0.008, 140),
      toothedGear(0.075, 14, 0.032, -0.42, -0.13, 0.24, { hub: 0.025, spokes: 0 }),
    ]), BRASS()),

    part('centre_wheel', merge([
      toothedGear(TRAIN.centrePinion.radius, TRAIN.centrePinion.teeth, 0.032, -0.05, -0.07, 0.1, { hub: 0.03, spokes: 0 }),
      toothedGear(TRAIN.centreWheel.radius, TRAIN.centreWheel.teeth, 0.032, -0.05, -0.025, 0.1, { hub: 0.045, spokes: 5 }),
    ]), BRASS()),
    part('third_wheel', merge([
      toothedGear(TRAIN.thirdPinion.radius, TRAIN.thirdPinion.teeth, 0.032, 0.205, -0.025, 0.055, { hub: 0.012, spokes: 0 }),
      toothedGear(TRAIN.thirdWheel.radius, TRAIN.thirdWheel.teeth, 0.032, 0.205, 0.015, 0.055, { hub: 0.036, spokes: 5 }),
    ]), BRASS()),
    part('fourth_wheel', merge([
      toothedGear(TRAIN.fourthPinion.radius, TRAIN.fourthPinion.teeth, 0.032, 0.18, 0.015, -0.155, { hub: 0.011, spokes: 0 }),
      toothedGear(TRAIN.fourthWheel.radius, TRAIN.fourthWheel.teeth, 0.032, 0.18, 0.055, -0.155, { hub: 0.032, spokes: 5 }),
    ]), BRASS()),
    part('escape_wheel', merge([
      toothedGear(TRAIN.escapePinion.radius, TRAIN.escapePinion.teeth, 0.032, 0.01, 0.055, -0.23, { hub: 0.014, spokes: 0 }),
      toothedGear(0.11, 18, 0.032, 0.01, 0.095, -0.23, { hub: 0.028, spokes: 6 }),
    ]), BRASS()),

    part('pallet_fork', merge([
      roundedBox(0.28, 0.032, 0.045, 0.012, 3, { pos: [0.18, 0.11, -0.28], rot: [0, -0.22, 0] }),
      roundedBox(0.14, 0.034, 0.042, 0.01, 2, { pos: [0.075, 0.11, -0.22], rot: [0, 0.72, 0] }),
      roundedBox(0.16, 0.034, 0.042, 0.01, 2, { pos: [0.39, 0.11, -0.35], rot: [0, -0.52, 0] }),
      cylinder(0.035, 0.035, 0.045, 20, { pos: [0.28, 0.11, -0.31] }),
    ]), STEEL()),

    part('balance_wheel', merge([
      torus(0.245, 0.025, 72, 10, { pos: [0.46, 0.105, -0.4], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.045, 0.045, 0.045, 24, { pos: [0.46, 0.105, -0.4] }),
      place(ring(4, () => roundedBox(0.22, 0.027, 0.025, 0.008, 2, { pos: [0.11, 0, 0] })), { pos: [0.46, 0.105, -0.4] }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return sphere(0.018, 12, {
          pos: [0.46 + Math.cos(angle) * 0.245, 0.105, -0.4 + Math.sin(angle) * 0.245],
          scale: [1, 0.65, 1],
        });
      }),
    ]), POLISHED_STEEL()),

    part('hairspring', merge([
      spiral(0.46, 0.14, -0.4, 0.035, 0.205, 5.2, 0.0065, 180),
      cylinder(0.018, 0.018, 0.04, 16, { pos: [0.46, 0.14, -0.4] }),
    ]), DARK_STEEL()),

    part('movement_bridges', merge([
      roundedBox(0.72, 0.038, 0.16, 0.05, 4, { pos: [-0.2, -0.065, 0.47], rot: [0, -0.12, 0] }),
      roundedBox(0.54, 0.038, 0.14, 0.045, 4, { pos: [0.13, -0.065, 0.23], rot: [0, 0.55, 0] }),
      roundedBox(0.45, 0.038, 0.13, 0.042, 4, { pos: [0.04, -0.065, -0.08], rot: [0, -0.48, 0] }),
      torus(0.29, 0.038, 64, 10, { pos: [0.46, -0.065, -0.4], rot: [Math.PI / 2, 0, 0] }),
      tube(0.88, 0.82, 0.032, 96, { pos: [0, -0.1, 0] }),
      toothedGear(0.065, 12, 0.032, -0.13, -0.13, -0.02, { hub: 0.024, spokes: 0 }),
      toothedGear(0.075, 14, 0.032, -0.255, -0.13, 0.035, { hub: 0.025, spokes: 0 }),
      toothedGear(0.07, 12, 0.032, -0.36, -0.13, 0.13, { hub: 0.024, spokes: 0 }),
      ...[[-0.55, 0.48], [-0.04, 0.35], [0.15, -0.02], [0.67, -0.48], [-0.62, -0.37]].map(([x, z]) =>
        cylinder(0.035, 0.035, 0.045, 18, { pos: [x, -0.065, z] })),
    ]), named(pbr('#c7c2b4', { metalness: 0.86, roughness: 0.4 }), 'satin steel bridges')),

    part('jewels', merge([
      ...[[-0.42, 0.24], [-0.05, 0.1], [0.205, 0.055], [0.18, -0.155], [0.01, -0.23], [0.46, -0.4]].map(([x, z]) =>
        sphere(0.04, 22, { pos: [x, 0.13, z], scale: [1, 0.28, 1] })),
      sphere(0.023, 18, { pos: [0.18, 0.135, -0.28], scale: [1, 0.32, 1] }),
      sphere(0.023, 18, { pos: [0.07, 0.135, -0.22], scale: [1, 0.32, 1] }),
    ]), RUBY()),

    part('strap_lugs', merge([
      roundedBox(0.76, 0.115, 1.18, 0.11, 4, { pos: [0, -0.055, 1.54] }),
      roundedBox(0.76, 0.115, 1.18, 0.11, 4, { pos: [0, -0.055, -1.54] }),
      ...[-0.57, 0.57].flatMap((x) => [-1, 1].map((sign) =>
        roundedBox(0.19, 0.16, 0.42, 0.06, 3, { pos: [x, -0.04, sign * 1.0], rot: [0, sign * x * 0.08, 0] }))),
      ...[-0.2, 0, 0.2].flatMap((x) => [-1, 1].map((sign) =>
        roundedBox(0.055, 0.02, 0.055, 0.012, 2, { pos: [x, 0.012, sign * 1.68] }))),
    ]), RUBBER()),
  );

  return group;
}
