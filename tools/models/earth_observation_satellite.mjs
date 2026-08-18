// Compact three-axis-stabilized Earth-observation spacecraft.
// +Y is up, the solar wings deploy along X, and the telescope looks nadir (-Y).

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, sphere,
  curve, merge, place, paint, srgb, lathe,
} from '../lib/geo.mjs';

function named(material, name) {
  material.name = name;
  return material;
}

const BUS = () => named(pbr('#2a343d', { metalness: 0.22, roughness: 0.5 }), 'graphite composite spacecraft structure');
const MLI = () => named(pbr('#ffffff', { metalness: 0.68, roughness: 0.4, vertexColors: true }), 'gold multi-layer insulation');
const ALUMINIUM = () => named(pbr('#aeb8c0', { metalness: 0.88, roughness: 0.3 }), 'structural aluminium');
const SOLAR = () => named(pbr('#ffffff', { metalness: 0.24, roughness: 0.3, vertexColors: true }), 'blue solar cell laminate');
const SUN_SENSOR = () => named(pbr('#205c8f', { metalness: 0.2, roughness: 0.28 }), 'blue solar sensor glass');
const ELECTRONICS = () => named(pbr('#24665e', { metalness: 0.12, roughness: 0.5 }), 'spacecraft electronics');
const OPTICAL_BLACK = () => named(pbr('#11171d', { metalness: 0.06, roughness: 0.78 }), 'optical black baffling');
const MIRROR = () => {
  const material = named(pbr('#dce8f0', { metalness: 0.94, roughness: 0.08 }), 'protected silver optical mirror');
  material.side = THREE.DoubleSide;
  return material;
};
const WHEEL = () => named(pbr('#5c6873', { metalness: 0.9, roughness: 0.25 }), 'reaction wheel steel');
const PROPELLANT = () => named(pbr('#b6aa85', { metalness: 0.82, roughness: 0.32 }), 'propellant titanium');
const THRUSTER = () => named(pbr('#715d52', { metalness: 0.72, roughness: 0.46 }), 'ceramic thruster and refractory alloy');
const ANTENNA = () => named(pbr('#d9dde0', { metalness: 0.18, roughness: 0.42 }), 'white antenna composite');
const RADIATOR = () => named(pbr('#d7dde2', { metalness: 0.12, roughness: 0.72 }), 'white radiator coating');
const DETECTOR = () => named(pbr('#333b67', { metalness: 0.18, roughness: 0.34, emissive: '#23346b', emissiveIntensity: 0.16 }), 'focal-plane electronics');

function cylinderX(rTop, rBottom, length, radial, pos, openEnded = false) {
  return cylinder(rTop, rBottom, length, radial, { pos, rot: [0, 0, Math.PI / 2] }, openEnded);
}

function cylinderZ(rTop, rBottom, length, radial, pos, openEnded = false) {
  return cylinder(rTop, rBottom, length, radial, { pos, rot: [Math.PI / 2, 0, 0] }, openEnded);
}

function tint(geometry, colour) {
  const rgb = srgb(colour);
  return paint(geometry, () => rgb);
}

function frameBar(from, to, radius = 0.022, radial = 10) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const geometry = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), radial, 1);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  ));
  geometry.translate(...a.clone().lerp(b, 0.5).toArray());
  return geometry;
}

function quiltPillow(pos, width = 0.18, height = 0.18, depth = 0.026) {
  const [x, y, z] = pos;
  const backX = width / 2;
  const backY = height / 2;
  const faceX = backX * 0.74;
  const faceY = backY * 0.74;
  const halfDepth = depth / 2;
  const positions = [
    x - faceX, y - faceY, z + halfDepth, x + faceX, y - faceY, z + halfDepth,
    x + faceX, y + faceY, z + halfDepth, x - faceX, y + faceY, z + halfDepth,
    x - backX, y - backY, z - halfDepth, x + backX, y - backY, z - halfDepth,
    x + backX, y + backY, z - halfDepth, x - backX, y + backY, z - halfDepth,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function solarWing(sign) {
  const geometry = [];
  const inner = sign * 0.84;
  const outer = sign * 2.5;
  const centreX = (inner + outer) / 2;
  const span = Math.abs(outer - inner);

  // Twenty-eight real, separated photovoltaic tiles keep the cell segmentation
  // readable at mobile scale instead of relying on a painted grid texture.
  const columns = 7;
  const rows = 4;
  const cellSpan = span / columns;
  const cellChord = 1.02 / rows;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = sign * (0.88 + column * cellSpan + cellSpan * 0.46);
      const z = -0.51 + row * cellChord + cellChord * 0.5;
      const blue = (column + row) % 2 ? '#1b5792' : '#216cae';
      geometry.push(tint(box(cellSpan * 0.95, 0.035, cellChord * 0.94, {
        pos: [x, 0.28, z],
      }), blue));
    }
  }

  const frameColour = '#c6a86a';
  geometry.push(
    tint(box(span + 0.04, 0.046, 0.035, { pos: [centreX, 0.28, -0.56] }), frameColour),
    tint(box(span + 0.04, 0.046, 0.035, { pos: [centreX, 0.28, 0.56] }), frameColour),
    ...Array.from({ length: 8 }, (_, index) => tint(box(0.025, 0.046, 1.12, {
      pos: [sign * (0.84 + index * (span / 7)), 0.28, 0],
    }), frameColour)),
    tint(box(span + 0.02, 0.025, 0.025, { pos: [centreX, 0.24, 0] }), '#6d7a83'),
    tint(frameBar([sign * 0.86, 0.235, -0.52], [sign * 2.46, 0.235, 0.52], 0.012, 8), frameColour),
    tint(frameBar([sign * 0.86, 0.235, 0.52], [sign * 2.46, 0.235, -0.52], 0.012, 8), frameColour),
  );
  return merge(geometry);
}

function busFrame() {
  const bars = [];
  // A broad lower service cage and a narrower, port-offset instrument cage
  // give the blanket volumes real load paths instead of hiding one cuboid.
  for (const x of [-0.6, 0.6]) {
    for (const z of [-0.56, 0.56]) bars.push(box(0.085, 1.08, 0.085, { pos: [x, -0.27, z] }));
  }
  for (const y of [-0.81, 0.27]) {
    for (const z of [-0.56, 0.56]) bars.push(box(1.2, 0.085, 0.085, { pos: [0, y, z] }));
    for (const x of [-0.6, 0.6]) bars.push(box(0.085, 0.085, 1.12, { pos: [x, y, 0] }));
  }
  for (const x of [-0.48, 0.36]) {
    for (const z of [-0.44, 0.44]) bars.push(box(0.075, 0.66, 0.075, { pos: [x, 0.6, z] }));
  }
  for (const y of [0.27, 0.93]) {
    for (const z of [-0.44, 0.44]) bars.push(box(0.84, 0.075, 0.075, { pos: [-0.06, y, z] }));
    for (const x of [-0.48, 0.36]) bars.push(box(0.075, 0.075, 0.88, { pos: [x, y, 0] }));
  }
  bars.push(
    box(1.12, 0.07, 0.07, { pos: [0, 0.28, -0.56] }),
    box(1.12, 0.07, 0.07, { pos: [0, 0.28, 0.56] }),
    box(0.07, 0.07, 1.08, { pos: [0, 0.28, 0] }),
    frameBar([-0.6, 0.27, -0.56], [-0.48, 0.93, -0.44], 0.035, 10),
    frameBar([0.6, 0.27, -0.56], [0.36, 0.93, -0.44], 0.035, 10),
    frameBar([-0.6, 0.27, 0.56], [-0.48, 0.93, 0.44], 0.035, 10),
    frameBar([0.6, 0.27, 0.56], [0.36, 0.93, 0.44], 0.035, 10),
  );
  return merge(bars);
}

function blanketGeometry() {
  const pieces = [
    // Five overlapping flight volumes: propulsion/service, avionics,
    // starboard utility pod, payload shoulder, and sensor crown. Their differing
    // centres, widths and depths create purposeful steps in every closed view.
    tint(cylinder(0.65, 0.825, 0.72, 8, { pos: [0, -0.49, 0], rot: [0, Math.PI / 8, 0] }), '#a9792b'),
    tint(roundedBox(1.02, 0.52, 1.24, 0.11, 4, { pos: [-0.18, 0.1, 0.02] }), '#bd9038'),
    tint(roundedBox(0.42, 0.68, 1.16, 0.085, 4, { pos: [0.48, 0.14, 0.08] }), '#8f6724'),
    tint(cylinder(0.39, 0.52, 0.48, 6, { pos: [0.06, 0.62, -0.04], rot: [0, Math.PI / 6, 0], scale: [1, 1, 0.9] }), '#c99b40'),
    tint(cylinder(0.34, 0.41, 0.28, 6, { pos: [0.16, 0.98, -0.05], rot: [0, Math.PI / 6, 0], scale: [1, 1, 1.05] }), '#d4ae5a'),

    // Separate forward access blankets close each bay, but no single panel
    // recreates the old full-height rectangular facade.
    tint(roundedBox(1.18, 0.62, 0.045, 0.065, 3, { pos: [-0.06, -0.5, 0.71] }), '#b98632'),
    tint(roundedBox(0.78, 0.5, 0.045, 0.06, 3, { pos: [-0.25, 0.08, 0.73] }), '#c69a42'),
    tint(roundedBox(0.42, 0.66, 0.045, 0.055, 3, { pos: [0.48, 0.13, 0.79] }), '#9d7029'),
    tint(roundedBox(0.84, 0.42, 0.045, 0.06, 3, { pos: [0.08, 0.64, 0.72] }), '#d1a64d'),
  ];
  const seamTapes = [
    [-0.06, -0.2, 1.08, 0.024], [-0.06, -0.8, 1.08, 0.022],
    [-0.44, 0.08, 0.024, 0.38], [0.14, 0.08, 0.024, 0.38],
    [0.48, -0.12, 0.34, 0.022], [0.48, 0.37, 0.34, 0.022],
    [0.08, 0.46, 0.68, 0.022], [0.08, 0.82, 0.56, 0.022],
  ];
  for (const [x, y, width, height] of seamTapes) {
    pieces.push(tint(roundedBox(width, height, 0.022, 0.008, 2, { pos: [x, y, 0.818] }), '#e0bb68'));
  }
  const quiltPads = [
    [-0.45, -0.64, 0.75, 0.18, 0.13], [-0.16, -0.59, 0.76, 0.13, 0.17],
    [0.12, -0.54, 0.76, 0.22, 0.14], [0.36, -0.43, 0.78, 0.16, 0.2],
    [-0.48, -0.09, 0.77, 0.14, 0.18], [-0.2, 0.08, 0.78, 0.2, 0.14],
    [0.1, 0.16, 0.78, 0.16, 0.18], [0.5, 0.2, 0.83, 0.13, 0.21],
    [-0.17, 0.56, 0.77, 0.22, 0.14], [0.2, 0.68, 0.78, 0.15, 0.18],
  ];
  for (const [x, y, z, width, height] of quiltPads) {
    pieces.push(tint(quiltPillow([x, y, z], width, height), '#d6ad58'));
  }
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * TAU;
    pieces.push(tint(sphere(0.016, 10, {
      pos: [-0.04 + Math.cos(angle) * 0.6, -0.84 + Math.sin(angle) * 0.02, Math.sin(angle) * 0.54],
      scale: [1, 0.42, 1],
    }), '#e3c278'));
  }
  return merge(pieces);
}

function gimbalGeometry(sign) {
  const x = sign * 0.72;
  return merge([
    cylinderZ(0.14, 0.14, 0.3, 48, [x, 0.28, 0]),
    torus(0.145, 0.025, 48, 10, { pos: [x, 0.28, -0.15] }),
    torus(0.145, 0.025, 48, 10, { pos: [x, 0.28, 0.15] }),
    roundedBox(0.22, 0.2, 0.42, 0.055, 4, { pos: [sign * 0.7, 0.28, 0] }),
    roundedBox(0.2, 0.12, 0.42, 0.04, 3, { pos: [sign * 0.82, 0.28, 0] }),
    ...[-0.16, 0.16].map((z) => cylinderZ(0.022, 0.022, 0.08, 10, [x, 0.4, z])),
  ]);
}

function wheelGeometry(axis, pivot) {
  const [x, y, z] = pivot;
  if (axis === 'x') return merge([
    cylinderX(0.16, 0.16, 0.09, 72, pivot),
    torus(0.13, 0.032, 64, 16, { pos: pivot, rot: [0, Math.PI / 2, 0] }),
    cylinderX(0.045, 0.045, 0.13, 40, pivot),
    roundedBox(0.11, 0.045, 0.36, 0.016, 2, { pos: [x, y - 0.18, z] }),
  ]);
  if (axis === 'y') return merge([
    cylinder(0.16, 0.16, 0.09, 72, { pos: pivot }),
    torus(0.13, 0.032, 64, 16, { pos: pivot, rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.045, 0.045, 0.13, 40, { pos: pivot }),
    roundedBox(0.36, 0.11, 0.045, 0.016, 2, { pos: [x, y, z - 0.18] }),
  ]);
  return merge([
    cylinderZ(0.16, 0.16, 0.09, 72, pivot),
    torus(0.13, 0.032, 64, 16, { pos: pivot }),
    cylinderZ(0.045, 0.045, 0.13, 40, pivot),
    roundedBox(0.36, 0.045, 0.11, 0.016, 2, { pos: [x, y - 0.18, z] }),
  ]);
}

function paraboloid(radius, depth, radial = 96, rings = 20, centre = [0, 0, 0]) {
  const positions = [...centre];
  const indices = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    const r = radius * (ring / rings);
    const z = depth * (r / radius) ** 2;
    for (let segment = 0; segment < radial; segment += 1) {
      const angle = (segment / radial) * TAU;
      positions.push(centre[0] + Math.cos(angle) * r, centre[1] + Math.sin(angle) * r, centre[2] + z);
    }
  }
  for (let segment = 0; segment < radial; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % radial));
  }
  for (let ring = 0; ring < rings - 1; ring += 1) {
    for (let segment = 0; segment < radial; segment += 1) {
      const a = 1 + ring * radial + segment;
      const next = 1 + ring * radial + ((segment + 1) % radial);
      const b = a + radial;
      const bNext = next + radial;
      indices.push(a, b, bNext, a, bNext, next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function highGainDish() {
  return merge([
    paraboloid(0.46, 0.18, 80, 16, [0.55, 0.97, 0.85]),
    torus(0.46, 0.02, 64, 12, { pos: [0.55, 0.97, 1.03] }),
    cylinderZ(0.052, 0.08, 0.2, 40, [0.55, 0.97, 1.3], true),
    torus(0.082, 0.015, 40, 8, { pos: [0.55, 0.97, 1.2] }),
    ...Array.from({ length: 3 }, (_, index) => {
      const angle = (index / 3) * TAU;
      return frameBar([
        0.55 + Math.cos(angle) * 0.44,
        0.97 + Math.sin(angle) * 0.44,
        1.03,
      ], [0.55, 0.97, 1.2], 0.013, 6);
    }),
    ...Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * TAU;
      return frameBar(
        [0.55 + Math.cos(angle) * 0.09, 0.97 + Math.sin(angle) * 0.09, 0.83],
        [0.55 + Math.cos(angle) * 0.43, 0.97 + Math.sin(angle) * 0.43, 0.99],
        0.014,
        6,
      );
    }),
  ]);
}

function antennaGimbalGeometry() {
  return merge([
    roundedBox(0.42, 0.12, 0.18, 0.045, 3, { pos: [0.32, 0.58, 0.67] }),
    cylinder(0.09, 0.09, 0.32, 40, { pos: [0.32, 0.72, 0.7] }),
    torus(0.105, 0.02, 40, 10, { pos: [0.32, 0.72, 0.7], rot: [Math.PI / 2, 0, 0] }),
    frameBar([0.18, 0.68, 0.72], [0.2, 0.9, 0.84], 0.045, 8),
    frameBar([0.46, 0.68, 0.72], [0.88, 0.9, 0.84], 0.045, 8),
    roundedBox(0.11, 0.38, 0.13, 0.035, 3, { pos: [0.2, 0.78, 0.78], rot: [0, 0, -0.08] }),
    roundedBox(0.11, 0.38, 0.13, 0.035, 3, { pos: [0.88, 0.78, 0.78], rot: [0, 0, 0.2] }),
    cylinderX(0.068, 0.068, 0.78, 40, [0.54, 0.91, 0.84]),
    torus(0.08, 0.018, 40, 10, { pos: [0.15, 0.91, 0.84], rot: [0, Math.PI / 2, 0] }),
    torus(0.08, 0.018, 40, 10, { pos: [0.93, 0.91, 0.84], rot: [0, Math.PI / 2, 0] }),
    roundedBox(0.12, 0.16, 0.14, 0.032, 3, { pos: [0.14, 0.8, 0.84] }),
    roundedBox(0.12, 0.16, 0.14, 0.032, 3, { pos: [0.94, 0.8, 0.84] }),
    curve([[0.1, 0.7, 0.72], [0.0, 0.86, 0.78], [0.18, 1.04, 0.85], [0.4, 1.08, 0.88]], 0.012, { segments: 28, radial: 8 }),
  ]);
}

function thrusterGeometry() {
  const pieces = [];
  for (const zSign of [-1, 1]) {
    for (const x of [-0.43, 0.43]) {
      for (const y of [-0.42, 0.42]) {
        const z = zSign * 0.82;
        pieces.push(
          cylinderZ(0.09, 0.038, 0.2, 32, [x, y, z], true),
          torus(0.09, 0.015, 28, 8, { pos: [x, y, z - zSign * 0.1] }),
          torus(0.042, 0.012, 28, 8, { pos: [x, y, z + zSign * 0.1] }),
        );
      }
    }
  }
  return merge(pieces);
}

export default function earthObservationSatellite() {
  const group = new THREE.Group();

  group.add(
    part('spacecraft_bus', busFrame(), BUS()),

    part('thermal_blankets', blanketGeometry(), MLI()),

    part('structural_deck', merge([
      roundedBox(1.18, 0.055, 1.18, 0.018, 2, { pos: [0, -0.42, 0] }),
      roundedBox(1.18, 0.055, 1.18, 0.018, 2, { pos: [0, 0.1, 0] }),
      roundedBox(1.18, 0.055, 1.18, 0.018, 2, { pos: [0, 0.58, 0] }),
      ...[-0.48, 0.48].flatMap((x) => [-0.48, 0.48].map((z) => roundedBox(0.06, 1.02, 0.06, 0.018, 2, { pos: [x, 0.08, z] }))),
      torus(0.5, 0.026, 64, 10, { pos: [0, -1.53, 0], rot: [Math.PI / 2, 0, 0] }),
      frameBar([-0.48, -0.42, 0.42], [-0.36, -1.49, 0.36], 0.018, 8),
      frameBar([-0.48, -0.42, -0.42], [-0.36, -1.49, -0.36], 0.018, 8),
      frameBar([0.48, -0.42, 0.42], [0.36, -1.49, 0.36], 0.018, 8),
      frameBar([0.48, -0.42, -0.42], [0.36, -1.49, -0.36], 0.018, 8),
    ]), ALUMINIUM()),

    part('solar_array_port', solarWing(-1), SOLAR()),
    part('solar_array_starboard', solarWing(1), SOLAR()),
    part('solar_gimbal_port', gimbalGeometry(-1), ALUMINIUM()),
    part('solar_gimbal_starboard', gimbalGeometry(1), ALUMINIUM()),

    part('battery_module', merge([
      roundedBox(0.5, 0.28, 0.42, 0.055, 4, { pos: [-0.31, -0.25, -0.32] }),
      ...[-0.45, -0.35, -0.25, -0.15].map((x) => roundedBox(0.055, 0.19, 0.36, 0.016, 2, { pos: [x, -0.25, -0.32] })),
      ...[-0.5, -0.12].map((x) => roundedBox(0.08, 0.06, 0.48, 0.018, 2, { pos: [x, -0.42, -0.32] })),
    ]), ELECTRONICS()),

    part('power_distribution_unit', merge([
      roundedBox(0.42, 0.3, 0.38, 0.05, 4, { pos: [0.28, -0.24, -0.32] }),
      ...[-0.1, 0.02, 0.14].map((y) => roundedBox(0.32, 0.035, 0.045, 0.012, 2, { pos: [0.28, y - 0.24, -0.52] })),
      curve([[-0.72, 0.28, 0], [-0.58, 0.18, -0.16], [-0.22, -0.03, -0.28], [0.12, -0.2, -0.32]], 0.022, { segments: 56, radial: 10 }),
      curve([[0.72, 0.28, 0], [0.58, 0.18, -0.16], [0.46, -0.03, -0.28], [0.38, -0.2, -0.32]], 0.022, { segments: 56, radial: 10 }),
      ...[-0.72, 0.72].map((x) => sphere(0.038, 14, { pos: [x, 0.28, 0] })),
    ]), ELECTRONICS()),

    part('flight_computer', merge([
      roundedBox(0.52, 0.27, 0.4, 0.045, 4, { pos: [-0.28, 0.24, -0.34] }),
      ...Array.from({ length: 8 }, (_, index) => roundedBox(0.035, 0.16, 0.035, 0.01, 2, {
        pos: [-0.47 + index * 0.055, 0.24, -0.56],
      })),
      roundedBox(0.38, 0.035, 0.04, 0.012, 2, { pos: [-0.28, 0.38, -0.34] }),
    ]), ELECTRONICS()),

    part('telescope_baffle', merge([
      tube(0.35, 0.29, 1.1, 48, { pos: [0, -0.84, 0] }),
      torus(0.35, 0.025, 48, 10, { pos: [0, -1.39, 0], rot: [Math.PI / 2, 0, 0] }),
      torus(0.35, 0.025, 48, 10, { pos: [0, -0.29, 0], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.4, 0.48, 0.2, 48, { pos: [0, -1.3, 0] }, true),
      torus(0.48, 0.022, 48, 10, { pos: [0, -1.4, 0], rot: [Math.PI / 2, 0, 0] }),
      ...Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * TAU;
        return roundedBox(0.14, 0.18, 0.035, 0.012, 1, {
          pos: [Math.cos(angle) * 0.45, -1.3, Math.sin(angle) * 0.45],
          rot: [0, -angle, 0],
        });
      }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return frameBar([Math.cos(angle) * 0.36, -1.36, Math.sin(angle) * 0.36], [Math.cos(angle) * 0.34, -0.32, Math.sin(angle) * 0.34], 0.014, 6);
      }),
      // An offset rectangular pushbroom sunshade gives the nadir instrument a
      // distinct lower-left silhouette while leaving the optical axis centred.
      roundedBox(0.92, 0.18, 0.11, 0.025, 2, { pos: [-0.32, -1.43, 0.37] }),
      roundedBox(0.92, 0.18, 0.11, 0.025, 2, { pos: [-0.32, -1.43, -0.37] }),
      roundedBox(0.11, 0.18, 0.74, 0.025, 2, { pos: [-0.8, -1.43, 0] }),
      roundedBox(0.11, 0.18, 0.74, 0.025, 2, { pos: [0.14, -1.43, 0] }),
      frameBar([-0.42, -1.37, 0.34], [-0.18, -1.18, 0.28], 0.018, 6),
      frameBar([-0.42, -1.37, -0.34], [-0.18, -1.18, -0.28], 0.018, 6),
    ]), OPTICAL_BLACK()),

    part('primary_mirror', merge([
      lathe([[0.03, 0], [0.1, 0.006], [0.18, 0.023], [0.25, 0.052], [0.29, 0.076]], 80, { pos: [0, -0.49, 0] }),
      torus(0.29, 0.015, 80, 12, { pos: [0, -0.414, 0], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.045, 0.045, 0.1, 40, { pos: [0, -0.45, 0], openEnded: true }),
    ]), MIRROR()),

    part('secondary_mirror', merge([
      cylinder(0.085, 0.085, 0.025, 64, { pos: [0, -0.89, 0] }),
      torus(0.085, 0.012, 64, 12, { pos: [0, -0.89, 0], rot: [Math.PI / 2, 0, 0] }),
      ...Array.from({ length: 3 }, (_, index) => {
        const angle = (index / 3) * TAU;
        return frameBar([Math.cos(angle) * 0.3, -0.76, Math.sin(angle) * 0.3], [0, -0.89, 0], 0.012, 8);
      }),
    ]), MIRROR()),

    part('focal_plane', merge([
      roundedBox(0.28, 0.12, 0.28, 0.035, 4, { pos: [0, -0.04, 0] }),
      roundedBox(0.17, 0.024, 0.17, 0.014, 2, { pos: [0, -0.108, 0] }),
      ...[-0.1, 0.1].flatMap((x) => [-0.1, 0.1].map((z) => roundedBox(0.035, 0.2, 0.035, 0.01, 2, { pos: [x, 0.02, z] }))),
    ]), DETECTOR()),

    part('scan_mirror', merge([
      roundedBox(0.25, 0.032, 0.18, 0.012, 3, { pos: [0, -0.16, 0], rot: [0.12, 0, 0] }),
      cylinderX(0.035, 0.035, 0.35, 32, [0, -0.16, 0]),
      ...[-0.16, 0.16].map((x) => torus(0.037, 0.01, 32, 10, { pos: [x, -0.16, 0], rot: [0, Math.PI / 2, 0] })),
    ]), MIRROR()),

    part('reaction_wheel_roll', wheelGeometry('x', [-0.22, 0.18, 0.22]), WHEEL()),
    part('reaction_wheel_pitch', wheelGeometry('y', [0.22, 0.18, 0.22]), WHEEL()),
    part('reaction_wheel_yaw', wheelGeometry('z', [0, -0.18, -0.25]), WHEEL()),

    part('star_trackers', merge([
      tube(0.1, 0.075, 0.48, 48, { pos: [0.42, 1.03, -0.36] }),
      torus(0.1, 0.015, 48, 10, { pos: [0.42, 1.27, -0.36], rot: [Math.PI / 2, 0, 0] }),
      roundedBox(0.28, 0.16, 0.24, 0.045, 4, { pos: [0.42, 0.78, -0.36] }),
      tube(0.1, 0.075, 0.48, 48, { pos: [-0.4, 0.18, -1.0], rot: [Math.PI / 2, 0, 0] }),
      torus(0.1, 0.015, 48, 10, { pos: [-0.4, 0.18, -1.24] }),
      roundedBox(0.28, 0.24, 0.16, 0.045, 4, { pos: [-0.4, 0.18, -0.74] }),
    ]), OPTICAL_BLACK()),

    part('sun_sensors', merge([
      roundedBox(0.28, 0.035, 0.2, 0.015, 2, { pos: [-0.28, 1.125, 0.18] }),
      roundedBox(0.28, 0.035, 0.2, 0.015, 2, { pos: [0.28, 1.125, -0.18] }),
      roundedBox(0.035, 0.24, 0.2, 0.015, 2, { pos: [-0.75, 0.35, 0.25] }),
      roundedBox(0.035, 0.24, 0.2, 0.015, 2, { pos: [0.75, -0.35, -0.25] }),
      ...[[-0.28, 1.145, 0.18], [0.28, 1.145, -0.18]].flatMap(([x, y, z]) => [-0.08, 0.08].map((offset) => sphere(0.025, 12, { pos: [x + offset, y, z] }))),
    ]), SUN_SENSOR()),

    part('propellant_tank', merge([
      sphere(0.32, 48, { pos: [0, 0.42, 0], scale: [1, 1.08, 1] }),
      torus(0.32, 0.022, 56, 12, { pos: [0, 0.42, 0], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.055, 0.055, 0.14, 28, { pos: [0, 0.78, 0] }),
      cylinder(0.055, 0.055, 0.14, 28, { pos: [0, 0.06, 0] }),
    ]), PROPELLANT()),

    part('propellant_lines', merge([
      ...[-1, 1].flatMap((zSign) => [-1, 1].flatMap((xSign) => [
        curve([[0, 0.42, zSign * 0.3], [xSign * 0.2, 0.2, zSign * 0.46], [xSign * 0.43, -0.42, zSign * 0.72]], 0.022, { segments: 42, radial: 8 }),
        curve([[0, 0.42, zSign * 0.3], [xSign * 0.24, 0.46, zSign * 0.5], [xSign * 0.43, 0.42, zSign * 0.72]], 0.022, { segments: 42, radial: 8 }),
      ])),
      ...[-1, 1].flatMap((zSign) => [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => sphere(0.032, 12, {
        pos: [xSign * 0.43, ySign * 0.42, zSign * 0.72],
      })))),
    ]), PROPELLANT()),

    part('thruster_cluster', thrusterGeometry(), THRUSTER()),

    part('high_gain_antenna', highGainDish(), ANTENNA()),
    part('antenna_gimbal', antennaGimbalGeometry(), ALUMINIUM()),

    part('radiator_panels', merge([
      roundedBox(0.5, 0.82, 0.045, 0.014, 2, { pos: [-1.12, -0.28, -1.3] }),
      roundedBox(0.5, 0.82, 0.045, 0.014, 2, { pos: [1.12, -0.28, -1.3] }),
      ...[-1.12, 1.12].flatMap((x) => [-0.58, -0.38, -0.18, 0.02].map((y) => roundedBox(0.44, 0.018, 0.012, 0.006, 2, { pos: [x, y, -1.326] }))),
      ...[-1.12, 1.12].flatMap((panelX) => [-0.18, -0.1, -0.02, 0.06, 0.14, 0.22].map((offset) => box(0.016, 0.72, 0.014, {
        pos: [panelX + offset, -0.28, -1.33],
      }))),
      ...[-1.12, 1.12].flatMap((panelX) => [-0.64, 0.08].map((y) => cylinderX(0.024, 0.024, 0.44, 24, [panelX, y, -1.342]))),
      frameBar([-0.54, -0.08, -0.5], [-0.87, -0.12, -1.27], 0.02, 8),
      frameBar([-0.54, -0.48, -0.5], [-0.87, -0.5, -1.27], 0.02, 8),
      frameBar([0.54, -0.08, -0.5], [0.87, -0.12, -1.27], 0.02, 8),
      frameBar([0.54, -0.48, -0.5], [0.87, -0.5, -1.27], 0.02, 8),
    ]), RADIATOR()),
  );

  // GLTFExporter normalizes malformed normals defensively. Normalize them in
  // the deterministic recipe first so the shipped binary remains an exact
  // geometry/material fingerprint match rather than being silently repaired.
  const normal = new THREE.Vector3();
  group.traverse((node) => {
    if (!node.isMesh) return;
    const attribute = node.geometry.getAttribute('normal');
    for (let index = 0; index < attribute.count; index += 1) {
      normal.fromBufferAttribute(attribute, index).normalize();
      attribute.setXYZ(index, normal.x, normal.y, normal.z);
    }
    attribute.needsUpdate = true;
  });

  return group;
}
