// Contemporary 18 V brushless cordless drill. The mechanical axis runs along
// X, with the chuck toward -X, the motor behind it, and the grip dropping -Y.
// The two housing halves meet at Z=0 so a peel view exposes a complete, aligned
// power train rather than decorative mechanisms floating inside the shell.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, sphere, curve, lathe, merge,
  paint, srgb,
} from '../lib/geo.mjs';

function named(material, name) {
  material.name = name;
  return material;
}

const HOUSING = () => named(pbr('#ffffff', { metalness: 0.04, roughness: 0.58, vertexColors: true }), 'glass-filled nylon plastic');
const RUBBER = () => named(pbr('#171b1e', { metalness: 0.01, roughness: 0.84 }), 'molded rubber overgrip');
const CONTROL = () => named(pbr('#20272c', { metalness: 0.03, roughness: 0.68 }), 'control plastic');
const STATOR = () => named(pbr('#ffffff', { metalness: 0.72, roughness: 0.34, vertexColors: true }), 'copper windings and electrical steel');
const ROTOR = () => named(pbr('#879197', { metalness: 0.86, roughness: 0.3 }), 'permanent-magnet rotor steel');
const FAN = () => named(pbr('#c7d0d5', { metalness: 0.08, roughness: 0.5 }), 'glass-filled fan plastic');
const GEARBOX = () => named(pbr('#ffffff', { metalness: 0.9, roughness: 0.31, vertexColors: true }), 'hardened gearbox steel');
const CLUTCH = () => named(pbr('#748087', { metalness: 0.72, roughness: 0.34 }), 'clutch steel and selector');
const SPINDLE = () => named(pbr('#c9d0d5', { metalness: 0.96, roughness: 0.2 }), 'ground spindle steel');
const CHUCK = () => named(pbr('#929da3', { metalness: 0.88, roughness: 0.3 }), 'machined chuck steel');
const JAWS = () => named(pbr('#d1d7da', { metalness: 0.94, roughness: 0.24 }), 'hardened jaw steel');
const LIGHT = () => named(pbr('#fff2c4', { metalness: 0, roughness: 0.18, emissive: '#ffd889', emissiveIntensity: 1.4 }), 'LED work light');
const BATTERY = () => named(pbr('#343b3f', { metalness: 0.03, roughness: 0.66 }), 'impact-resistant battery plastic');
const CELLS = () => named(pbr('#6b7d83', { metalness: 0.64, roughness: 0.38 }), 'lithium-ion cell cans');
const BOARD = () => named(pbr('#ffffff', { metalness: 0.1, roughness: 0.55, vertexColors: true }), 'battery electronics board');
const CONTACTS = () => named(pbr('#c78b45', { metalness: 0.9, roughness: 0.28 }), 'copper alloy contacts');

const coloured = (geometry, hex) => paint(geometry, () => srgb(hex));

function housingProfile() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.02, 0.62);
  shape.quadraticCurveTo(-1.08, 0.88, -0.82, 1.12);
  shape.quadraticCurveTo(-0.6, 1.31, -0.22, 1.32);
  shape.lineTo(0.93, 1.32);
  shape.quadraticCurveTo(1.31, 1.28, 1.42, 1.02);
  shape.quadraticCurveTo(1.49, 0.77, 1.27, 0.61);
  shape.quadraticCurveTo(1.1, 0.49, 0.82, 0.48);
  shape.lineTo(0.88, 0.22);
  shape.lineTo(1.18, -0.93);
  shape.quadraticCurveTo(1.21, -1.14, 1.01, -1.24);
  shape.lineTo(0.51, -1.24);
  shape.quadraticCurveTo(0.31, -1.2, 0.28, -1.02);
  shape.lineTo(0.42, -0.23);
  shape.quadraticCurveTo(0.47, 0.08, 0.28, 0.35);
  shape.quadraticCurveTo(0.12, 0.55, -0.18, 0.56);
  shape.lineTo(-0.83, 0.56);
  shape.quadraticCurveTo(-0.98, 0.56, -1.02, 0.62);
  shape.closePath();
  return shape;
}

function shellHalf(side) {
  const depth = side < 0 ? 0.43 : 0.439;
  const geometry = new THREE.ExtrudeGeometry(housingProfile(), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 18,
  });
  geometry.translate(0, 0, side < 0 ? -depth - 0.025 : 0.025);

  const outerZ = side * (depth + 0.042);
  const panelZ = side * (depth + 0.039);
  const primary = side < 0 ? '#31576b' : '#355d70';
  const parts = [coloured(geometry, primary)];

  // A real molded boss supports the work light below the transmission nose.
  // Keeping one half in each shell preserves the functional centre seam.
  parts.push(coloured(roundedBox(0.44, 0.18, depth * 0.86, 0.05, 4, {
    pos: [-0.42, 0.49, side * (depth * 0.5 + 0.025)],
    rot: [0, 0, 0.03],
  }), primary));

  // Shallow side relief stiffens the motor barrel without fake mechanisms.
  parts.push(coloured(roundedBox(1.18, 0.055, 0.025, 0.012, 2, {
    pos: [0.48, 1.16, panelZ],
    rot: [0, 0, -0.015],
  }), side < 0 ? '#3e6b7d' : '#426f80'));
  parts.push(coloured(roundedBox(0.58, 0.045, 0.025, 0.01, 2, {
    pos: [-0.57, 0.68, panelZ],
    rot: [0, 0, 0.06],
  }), '#294957'));

  // Vents are located immediately around the real rear cooling fan.
  for (let index = 0; index < 6; index += 1) {
    parts.push(coloured(roundedBox(0.055, 0.22, 0.024, 0.012, 2, {
      pos: [1.08 + index * 0.05, 0.83 + index * 0.025, outerZ],
      rot: [0, 0, -0.3],
    }), '#11191d'));
  }

  // Six plausible clamping screws follow structural bosses and the grip foot.
  const screws = [[-0.7, 0.73], [-0.28, 1.16], [0.75, 1.14], [1.23, 0.82], [0.53, -0.12], [0.78, -1.05]];
  for (const [x, y] of screws) {
    parts.push(coloured(cylinder(0.038, 0.038, 0.022, 20, {
      pos: [x, y, outerZ],
      rot: [Math.PI / 2, 0, 0],
    }), '#88939a'));
    parts.push(coloured(roundedBox(0.045, 0.009, 0.008, 0.002, 1, {
      pos: [x, y, outerZ + side * 0.013],
      rot: [0, 0, side * 0.3],
    }), '#293238'));
  }
  return merge(parts);
}

function overgrip() {
  const parts = [];
  for (const side of [-1, 1]) {
    parts.push(roundedBox(0.5, 1.02, 0.038, 0.016, 3, {
      pos: [0.72, -0.59, side * 0.46],
      rot: [0, 0, -0.22],
    }));
    for (let index = 0; index < 7; index += 1) {
      parts.push(roundedBox(0.4, 0.018, 0.022, 0.006, 2, {
        pos: [0.72 + (index - 3) * 0.035, -0.61 + (index - 3) * 0.12, side * 0.487],
        rot: [0, 0, -0.22],
      }));
    }
  }
  parts.push(roundedBox(0.19, 0.98, 0.32, 0.055, 4, {
    pos: [0.94, -0.59, 0],
    rot: [0, 0, -0.22],
  }));
  return merge(parts);
}

function statorGeometry() {
  const parts = [
    coloured(tube(0.33, 0.285, 0.86, 48, { pos: [0.68, 0.88, 0], rot: [0, 0, Math.PI / 2] }), '#78838a'),
  ];
  for (let pole = 0; pole < 6; pole += 1) {
    const angle = (pole / 6) * TAU;
    const radialY = Math.cos(angle);
    const radialZ = Math.sin(angle);
    parts.push(coloured(roundedBox(0.72, 0.06, 0.1, 0.012, 2, {
      pos: [0.68, 0.88 + radialY * 0.235, radialZ * 0.235],
      rot: [angle, 0, 0],
    }), '#596269'));
    for (const offset of [-0.018, 0.018]) {
      const radius = 0.285 + offset;
      parts.push(coloured(curve([
        [0.39, 0.88 + radialY * radius, radialZ * radius],
        [0.34, 0.88 + radialY * (radius + 0.025), radialZ * (radius + 0.025)],
        [1.02, 0.88 + radialY * (radius + 0.025), radialZ * (radius + 0.025)],
        [0.97, 0.88 + radialY * radius, radialZ * radius],
      ], 0.014, { segments: 18, radial: 7 }), '#ca793d'));
    }
  }
  return merge(parts);
}

function rotorGeometry() {
  const parts = [
    cylinder(0.18, 0.18, 0.78, 48, { pos: [0.68, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.045, 0.045, 1.35, 24, { pos: [0.45, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
  ];
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * TAU;
    parts.push(roundedBox(0.58, 0.04, 0.09, 0.008, 2, {
      pos: [0.68, 0.88 + Math.cos(angle) * 0.17, Math.sin(angle) * 0.17],
      rot: [angle, 0, 0],
    }));
  }
  return merge(parts);
}

function fanGeometry() {
  const parts = [cylinder(0.09, 0.09, 0.1, 24, { pos: [1.18, 0.88, 0], rot: [0, 0, Math.PI / 2] })];
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * TAU;
    parts.push(roundedBox(0.045, 0.22, 0.08, 0.018, 3, {
      pos: [1.18, 0.88 + Math.cos(angle) * 0.17, Math.sin(angle) * 0.17],
      rot: [angle + 0.48, 0, 0],
    }));
  }
  return merge(parts);
}

function planetaryStage(x, ringRadius, planetRadius, colour) {
  const ringProfile = [
    [ringRadius - 0.055, -0.11],
    [ringRadius, -0.11],
    [ringRadius, 0.11],
    [ringRadius - 0.055, 0.11],
    [ringRadius - 0.055, -0.11],
  ];
  const parts = [
    coloured(merge(Array.from({ length: 3 }, (_, index) => lathe(
      ringProfile,
      16,
      { pos: [x, 0.88, 0], rot: [0, 0, Math.PI / 2] },
      { phiStart: index * TAU / 3 + 0.18, phiLength: 1.6 },
    ))), colour),
    coloured(cylinder(planetRadius * 0.78, planetRadius * 0.78, 0.1, 28, { pos: [x, 0.88, 0], rot: [0, 0, Math.PI / 2] }), '#d5b458'),
  ];
  const orbit = ringRadius - planetRadius - 0.06;
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * TAU;
    parts.push(coloured(cylinder(planetRadius, planetRadius, 0.105, 28, {
      pos: [x, 0.88 + Math.cos(angle) * orbit, Math.sin(angle) * orbit],
      rot: [0, 0, Math.PI / 2],
    }), '#9da7ad'));
    parts.push(coloured(cylinder(0.022, 0.022, 0.15, 14, {
      pos: [x, 0.88 + Math.cos(angle) * orbit, Math.sin(angle) * orbit],
      rot: [0, 0, Math.PI / 2],
    }), '#2e373c'));
  }
  return parts;
}

function gearboxGeometry() {
  return merge([
    ...planetaryStage(0.08, 0.29, 0.078, '#9ba7ad'),
    ...planetaryStage(-0.2, 0.255, 0.062, '#7f8c93'),
    coloured(cylinder(0.19, 0.19, 0.045, 36, { pos: [-0.34, 0.88, 0], rot: [0, 0, Math.PI / 2] }), '#89949a'),
    coloured(cylinder(0.055, 0.055, 0.72, 20, { pos: [-0.02, 0.88, 0], rot: [0, 0, Math.PI / 2] }), '#c1c9cd'),
  ]);
}

function clutchGeometry() {
  const parts = [
    cylinder(0.31, 0.31, 0.4, 56, { pos: [-0.69, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
    torus(0.285, 0.018, 56, 10, { pos: [-0.52, 0.88, 0], rot: [0, Math.PI / 2, 0] }),
    torus(0.285, 0.018, 56, 10, { pos: [-0.86, 0.88, 0], rot: [0, Math.PI / 2, 0] }),
  ];
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * TAU;
    parts.push(box(0.24, 0.035, 0.055, {
      pos: [-0.69, 0.88 + Math.cos(angle) * 0.295, Math.sin(angle) * 0.295],
      rot: [angle, 0, 0],
    }));
  }
  return merge(parts);
}

function chuckGeometry() {
  const parts = [
    cylinder(0.27, 0.29, 0.3, 56, { pos: [-1.23, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.21, 0.27, 0.36, 56, { pos: [-1.56, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
    torus(0.272, 0.018, 56, 10, { pos: [-1.38, 0.88, 0], rot: [0, Math.PI / 2, 0] }),
  ];
  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * TAU;
    parts.push(box(0.42, 0.025, 0.035, {
      pos: [-1.42, 0.88 + Math.cos(angle) * 0.275, Math.sin(angle) * 0.275],
      rot: [angle, 0, 0],
    }));
  }
  return merge(parts);
}

function jawGeometry() {
  const parts = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * TAU;
    parts.push(roundedBox(0.32, 0.075, 0.11, 0.012, 2, {
      pos: [-1.79, 0.88 + Math.cos(angle) * 0.1, Math.sin(angle) * 0.1],
      rot: [angle, 0, 0],
    }));
    parts.push(roundedBox(0.16, 0.05, 0.075, 0.008, 2, {
      pos: [-2.08, 0.88 + Math.cos(angle) * 0.06, Math.sin(angle) * 0.06],
      rot: [angle, 0, 0],
    }));
  }
  return merge(parts);
}

function batteryShellGeometry() {
  return merge([
    roundedBox(1.36, 0.49, 0.84, 0.09, 5, { pos: [0.82, -1.49, 0] }),
    roundedBox(0.78, 0.16, 0.62, 0.04, 3, { pos: [0.77, -1.2, 0] }),
    roundedBox(0.82, 0.05, 0.08, 0.012, 2, { pos: [0.77, -1.105, -0.24] }),
    roundedBox(0.82, 0.05, 0.08, 0.012, 2, { pos: [0.77, -1.105, 0.24] }),
    ...Array.from({ length: 7 }, (_, index) => roundedBox(0.08, 0.025, 0.28, 0.008, 2, {
      pos: [0.5 + index * 0.095, -1.745, 0],
    })),
  ]);
}

function batteryCellsGeometry() {
  const parts = [];
  for (let column = 0; column < 5; column += 1) {
    for (const row of [-1, 1]) {
      parts.push(cylinder(0.085, 0.085, 0.27, 28, {
        pos: [0.45 + column * 0.19, -1.51, row * 0.18],
      }));
      parts.push(torus(0.065, 0.008, 24, 7, {
        pos: [0.45 + column * 0.19, -1.37, row * 0.18],
        rot: [Math.PI / 2, 0, 0],
      }));
    }
  }
  return merge(parts);
}

function bmsGeometry() {
  const parts = [coloured(roundedBox(1.02, 0.035, 0.52, 0.018, 2, { pos: [0.82, -1.31, 0] }), '#176341')];
  parts.push(coloured(roundedBox(0.22, 0.045, 0.18, 0.012, 2, { pos: [0.68, -1.275, 0] }), '#20282c'));
  parts.push(coloured(roundedBox(0.16, 0.05, 0.11, 0.01, 2, { pos: [1.02, -1.27, 0.1] }), '#20282c'));
  for (let index = 0; index < 8; index += 1) {
    parts.push(coloured(box(0.035, 0.045, 0.04, { pos: [0.4 + index * 0.12, -1.275, -0.19] }), '#c6d0d5'));
  }
  return merge(parts);
}

export default function cordlessDrill() {
  const group = new THREE.Group();
  group.add(
    part('left_housing', shellHalf(-1), HOUSING()),
    part('right_housing', shellHalf(1), HOUSING()),
    part('rubber_grip', overgrip(), RUBBER()),
    part('trigger', roundedBox(0.18, 0.31, 0.34, 0.06, 4, { pos: [0.17, 0.24, 0], rot: [0, 0, -0.22] }), CONTROL()),
    part('direction_switch', roundedBox(0.3, 0.095, 0.58, 0.035, 4, { pos: [0.17, 0.5, 0] }), CONTROL()),
    part('speed_selector', merge([
      roundedBox(0.36, 0.1, 0.28, 0.035, 4, { pos: [-0.05, 1.34, 0] }),
      ...[-0.1, 0, 0.1].map((z) => roundedBox(0.2, 0.022, 0.025, 0.007, 2, { pos: [-0.05, 1.397, z] })),
    ]), CONTROL()),
    part('motor_stator', statorGeometry(), STATOR()),
    part('motor_rotor', rotorGeometry(), ROTOR()),
    part('cooling_fan', fanGeometry(), FAN()),
    part('planetary_gearbox', gearboxGeometry(), GEARBOX()),
    part('torque_clutch', clutchGeometry(), CLUTCH()),
    part('output_spindle', merge([
      cylinder(0.07, 0.07, 0.52, 28, { pos: [-1.05, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
      cylinder(0.12, 0.12, 0.12, 32, { pos: [-1.22, 0.88, 0], rot: [0, 0, Math.PI / 2] }),
    ]), SPINDLE()),
    part('chuck_body', chuckGeometry(), CHUCK()),
    part('chuck_jaws', jawGeometry(), JAWS()),
    part('work_light', merge([
      cylinder(0.1, 0.12, 0.08, 32, { pos: [-0.62, 0.43, 0], rot: [0, 0, Math.PI / 2] }),
      sphere(0.075, 24, { pos: [-0.675, 0.43, 0], scale: [0.22, 1, 1] }),
    ]), LIGHT()),
    part('battery_shell', batteryShellGeometry(), BATTERY()),
    part('battery_cells', batteryCellsGeometry(), CELLS()),
    part('battery_management_board', bmsGeometry(), BOARD()),
    part('contacts', merge(Array.from({ length: 5 }, (_, index) => roundedBox(0.045, 0.16, 0.22, 0.008, 2, {
      pos: [0.58 + index * 0.1, -1.14, -0.03 + (index % 2) * 0.06],
    }))), CONTACTS()),
  );
  return group;
}

export const meta = { width: 3.52, height: 3.2, depth: 0.98 };
