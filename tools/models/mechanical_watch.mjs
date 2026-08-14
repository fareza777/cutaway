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
  geometry.translate(0, -0.235, 0);
  return merge([
    geometry,
    cylinder(0.15, 0.15, 0.075, 40, { pos: [0, -0.235, 0] }),
    torus(0.15, 0.018, 32, 10, { pos: [0, -0.275, 0], rot: [Math.PI / 2, 0, 0] }),
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
    [0.9, -0.21], [0.985, -0.2], [1.035, -0.13], [1.05, -0.02],
    [1.045, 0.1], [1.005, 0.17], [0.91, 0.2], [0.9, -0.21],
  ];
  const bezelProfile = [
    [0.875, 0.19], [0.99, 0.18], [1.035, 0.215], [1.01, 0.27],
    [0.91, 0.305], [0.875, 0.28], [0.875, 0.19],
  ];

  group.add(
    part('case', merge([
      lathe(caseProfile, 96),
      torus(0.995, 0.035, 96, 12, { pos: [0, -0.13, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), STEEL()),

    part('bezel', merge([
      lathe(bezelProfile, 96),
      torus(0.91, 0.018, 96, 10, { pos: [0, 0.285, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), POLISHED_STEEL()),

    part('crystal', merge([
      cylinder(0.89, 0.89, 0.052, 96, { pos: [0, 0.315, 0] }),
      torus(0.86, 0.025, 96, 12, { pos: [0, 0.335, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), GLASS()),

    part('caseback', merge([
      cylinder(0.91, 0.91, 0.065, 96, { pos: [0, -0.305, 0] }),
      torus(0.83, 0.045, 96, 12, { pos: [0, -0.34, 0], rot: [Math.PI / 2, 0, 0] }),
      ring(8, () => roundedBox(0.08, 0.018, 0.025, 0.004, 2, { pos: [0.84, -0.342, 0] })),
    ]), STEEL()),

    part('crown', crownGeometry(), POLISHED_STEEL()),

    part('winding_stem', merge([
      cylinder(0.028, 0.028, 0.72, 20, { pos: [0.82, -0.04, 0], rot: [0, 0, Math.PI / 2] }),
      toothedGear(0.12, 18, 0.045, 0.48, -0.04, 0, { hub: 0.035, spokes: 0 }),
    ]), STEEL()),

    part('dial', merge([
      cylinder(0.855, 0.855, 0.034, 96, { pos: [0, 0.205, 0] }),
      ring(12, (_, angle) => roundedBox(angle % (Math.PI / 2) < 0.01 ? 0.075 : 0.05, 0.026, 0.135, 0.012, 2, {
        pos: [0, 0.231, 0.7],
      })),
      ring(60, (index) => index % 5 ? cylinder(0.008, 0.008, 0.02, 8, { pos: [0, 0.23, 0.785] }) : null),
      torus(0.08, 0.012, 36, 8, { pos: [0, 0.234, 0], rot: [Math.PI / 2, 0, 0] }),
    ]), DIAL()),

    part('hour_hand', place(merge([
      roundedBox(0.075, 0.022, 0.47, 0.018, 3, { pos: [0, 0.258, 0.22] }),
      cylinder(0.075, 0.075, 0.024, 28, { pos: [0, 0.258, 0] }),
    ]), { rot: [0, -0.92, 0] }), DARK_STEEL()),

    part('minute_hand', place(merge([
      roundedBox(0.05, 0.018, 0.67, 0.012, 3, { pos: [0, 0.272, 0.31] }),
      cylinder(0.055, 0.055, 0.02, 24, { pos: [0, 0.272, 0] }),
    ]), { rot: [0, 0.88, 0] }), DARK_STEEL()),

    part('seconds_hand', place(merge([
      roundedBox(0.014, 0.012, 0.79, 0.004, 2, { pos: [0, 0.287, 0.29] }),
      cylinder(0.035, 0.035, 0.016, 20, { pos: [0, 0.287, 0] }),
      sphere(0.035, 18, { pos: [0, 0.287, -0.24], scale: [1, 0.25, 1] }),
    ]), { rot: [0, Math.PI, 0] }), named(pbr('#a33b35', { metalness: 0.72, roughness: 0.25 }), 'lacquered steel')),

    part('automatic_rotor', crescentRotor(), named(pbr('#b6bec5', { metalness: 0.94, roughness: 0.24 }), 'rotor steel')),

    part('mainspring_barrel', merge([
      toothedGear(0.3, 54, 0.075, -0.4, -0.035, 0.25, { hub: 0.065, spokes: 0 }),
      cylinder(0.235, 0.235, 0.085, 56, { pos: [-0.4, -0.045, 0.25] }),
      spiral(-0.4, 0.008, 0.25, 0.045, 0.195, 4.2, 0.008, 140),
    ]), BRASS()),

    part('centre_wheel', toothedGear(0.18, 48, 0.048, 0, 0.005, 0.08, { hub: 0.045, spokes: 5 }), BRASS()),
    part('third_wheel', toothedGear(0.135, 40, 0.043, 0.31, -0.012, 0.04, { hub: 0.036, spokes: 5 }), BRASS()),
    part('fourth_wheel', toothedGear(0.13, 36, 0.038, 0.27, 0.005, -0.24, { hub: 0.034, spokes: 5 }), BRASS()),
    part('escape_wheel', toothedGear(0.105, 18, 0.032, 0.04, -0.005, -0.32, { hub: 0.028, spokes: 6 }), BRASS()),

    part('pallet_fork', merge([
      roundedBox(0.31, 0.035, 0.045, 0.012, 3, { pos: [0.22, 0.02, -0.34], rot: [0, -0.12, 0] }),
      roundedBox(0.12, 0.038, 0.045, 0.01, 2, { pos: [0.09, 0.02, -0.25], rot: [0, 0.78, 0] }),
      roundedBox(0.12, 0.038, 0.045, 0.01, 2, { pos: [0.1, 0.02, -0.43], rot: [0, -0.78, 0] }),
      cylinder(0.035, 0.035, 0.05, 20, { pos: [0.34, 0.02, -0.35] }),
    ]), STEEL()),

    part('balance_wheel', merge([
      torus(0.245, 0.025, 72, 10, { pos: [0.48, 0.002, -0.44], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.045, 0.045, 0.05, 24, { pos: [0.48, 0.002, -0.44] }),
      place(ring(4, () => roundedBox(0.39, 0.03, 0.025, 0.008, 2, { pos: [0.195, 0, 0] })), { pos: [0.48, 0.002, -0.44] }),
      ring(12, (_, angle) => sphere(0.018, 12, { pos: [0.48 + Math.cos(angle) * 0.245, 0.002, -0.44 + Math.sin(angle) * 0.245], scale: [1, 0.65, 1] })),
    ]), POLISHED_STEEL()),

    part('hairspring', merge([
      spiral(0.48, 0.035, -0.44, 0.035, 0.205, 5.2, 0.0065, 180),
      cylinder(0.018, 0.018, 0.045, 16, { pos: [0.48, 0.035, -0.44] }),
    ]), DARK_STEEL()),

    part('movement_bridges', merge([
      roundedBox(0.72, 0.045, 0.16, 0.055, 4, { pos: [-0.2, -0.105, 0.47], rot: [0, -0.12, 0] }),
      roundedBox(0.54, 0.045, 0.14, 0.05, 4, { pos: [0.13, -0.105, 0.23], rot: [0, 0.55, 0] }),
      roundedBox(0.45, 0.045, 0.13, 0.045, 4, { pos: [0.04, -0.105, -0.08], rot: [0, -0.48, 0] }),
      torus(0.29, 0.045, 64, 10, { pos: [0.48, -0.105, -0.44], rot: [Math.PI / 2, 0, 0] }),
      tube(0.88, 0.82, 0.04, 96, { pos: [0, -0.13, 0] }),
      ...[[-0.55, 0.48], [-0.04, 0.35], [0.15, -0.02], [0.67, -0.48], [-0.62, -0.37]].map(([x, z]) =>
        cylinder(0.035, 0.035, 0.055, 18, { pos: [x, -0.105, z] })),
    ]), named(pbr('#c7c2b4', { metalness: 0.86, roughness: 0.4 }), 'satin steel bridges')),

    part('jewels', merge([
      ...[[-0.4, 0.25], [0, 0.08], [0.31, 0.04], [0.27, -0.24], [0.04, -0.32], [0.48, -0.44]].map(([x, z]) =>
        sphere(0.045, 22, { pos: [x, 0.047, z], scale: [1, 0.32, 1] })),
      sphere(0.025, 18, { pos: [0.2, 0.045, -0.35], scale: [1, 0.36, 1] }),
      sphere(0.025, 18, { pos: [0.12, 0.045, -0.26], scale: [1, 0.36, 1] }),
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
