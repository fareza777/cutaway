// Low, wheeled bagless canister vacuum. Dirty air enters tangentially at the
// clear front bin, spirals down the vertical cyclone, then turns rearward along
// +X through the pre-filter, impeller, compact motor, exhaust filter, and rear
// vent. The main wheel axle is Z; the motor and impeller shaft is X.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, lathe, merge,
  curve, paint, srgb,
} from '../lib/geo.mjs';

function named(material, name) {
  material.name = name;
  return material;
}

const BODY = () => named(pbr('#ffffff', { metalness: 0.03, roughness: 0.55, vertexColors: true }), 'impact-resistant canister plastic');
const HANDLE = () => named(pbr('#26343b', { metalness: 0.04, roughness: 0.7 }), 'grip plastic');
const INLET = () => named(pbr('#38454b', { metalness: 0.04, roughness: 0.66 }), 'hose socket plastic');
const CLEAR = () => {
  const material = named(pbr('#b9e5eb', { metalness: 0, roughness: 0.22 }), 'clear polycarbonate bin');
  material.transparent = true;
  material.opacity = 0.27;
  material.depthWrite = true;
  material.side = THREE.DoubleSide;
  return material;
};
const CYCLONE = () => named(pbr('#b8c2c7', { metalness: 0.48, roughness: 0.38 }), 'cyclone steel');
const SHROUD = () => named(pbr('#707f86', { metalness: 0.32, roughness: 0.46 }), 'perforated separator steel');
const RUBBER = () => named(pbr('#151b1e', { metalness: 0.01, roughness: 0.86 }), 'molded rubber seal');
const FILTER = () => named(pbr('#e8d9b5', { metalness: 0.01, roughness: 0.9 }), 'pleated filter medium');
const STATOR = () => named(pbr('#ffffff', { metalness: 0.7, roughness: 0.36, vertexColors: true }), 'copper windings and electrical steel');
const ROTOR = () => named(pbr('#76838a', { metalness: 0.86, roughness: 0.3 }), 'permanent-magnet rotor steel');
const IMPELLER = () => named(pbr('#cfd9dc', { metalness: 0.09, roughness: 0.46 }), 'glass-filled impeller plastic');
const MOUNT = () => named(pbr('#3f4a50', { metalness: 0.32, roughness: 0.58 }), 'motor mount steel and rubber');
const VENT = () => named(pbr('#273137', { metalness: 0.16, roughness: 0.62 }), 'exhaust vent plastic');
const REEL = () => named(pbr('#78848a', { metalness: 0.62, roughness: 0.42 }), 'cord reel steel and plastic');
const CONTROL = () => named(pbr('#20292e', { metalness: 0.02, roughness: 0.72 }), 'control plastic');
const WHEEL = () => named(pbr('#171c1f', { metalness: 0.02, roughness: 0.84, vertexColors: true }), 'molded rubber and steel wheel');

const coloured = (geometry, hex) => paint(geometry, () => srgb(hex));

function bodyGeometry() {
  return merge([
    coloured(roundedBox(2.72, 1.38, 1.78, 0.32, 4, { pos: [0.88, -0.05, 0] }), '#345b68'),
    coloured(roundedBox(0.92, 1.2, 1.66, 0.28, 4, { pos: [1.92, -0.09, 0] }), '#2b4d59'),
    coloured(roundedBox(2.8, 0.34, 1.66, 0.14, 3, { pos: [0.88, -0.72, 0] }), '#203943'),
    // The front saddle receives the removable bin and leaves its clear wall visible.
    coloured(torus(0.68, 0.075, 64, 14, { pos: [-0.43, -0.08, 0], rot: [0, Math.PI / 2, 0] }), '#466e79'),
    coloured(roundedBox(0.48, 0.54, 1.5, 0.12, 3, { pos: [-0.35, -0.47, 0] }), '#315560'),
    // Side wheel arches and lower bumper make one visually planted chassis.
    ...[-1, 1].map((side) => coloured(torus(0.38, 0.04, 44, 8, {
      pos: [0.86, -0.76, side * 0.895],
    }), '#284852')),
    coloured(roundedBox(0.42, 0.18, 1.76, 0.07, 3, { pos: [-1.27, -0.72, 0] }), '#284852'),
    // Authored attachment hardware remains in the GLB so tests and peeled views
    // can distinguish supported parts from components merely placed nearby.
    coloured(cylinder(0.08, 0.08, 0.24, 20, { pos: [0.18, 0.58, 0] }), '#263f48'),
    coloured(cylinder(0.08, 0.08, 0.24, 20, { pos: [1.48, 0.58, 0] }), '#263f48'),
    coloured(cylinder(0.09, 0.09, 0.28, 24, { pos: [-1.42, -0.5, 0] }), '#263f48'),
    ...[0.42, 1.03].flatMap((x) => [-0.29, 0.29].map((z) => coloured(roundedBox(0.2, 0.18, 0.18, 0.035, 2, {
      pos: [x, -0.69, z],
    }), '#263f48'))),
    // Two long shoulder highlights break up the mass without branding or texture.
    ...[-1, 1].map((side) => coloured(roundedBox(1.58, 0.055, 0.025, 0.012, 2, {
      pos: [0.9, 0.54, side * 0.895],
      rot: [0, 0, -0.035],
    }), '#4f7984')),
  ]);
}

function handleGeometry() {
  return merge([
    roundedBox(1.34, 0.2, 0.34, 0.09, 3, { pos: [0.83, 1.05, 0] }),
    roundedBox(0.22, 0.55, 0.34, 0.08, 3, { pos: [0.23, 0.83, 0], rot: [0, 0, -0.18] }),
    roundedBox(0.22, 0.55, 0.34, 0.08, 3, { pos: [1.43, 0.83, 0], rot: [0, 0, 0.18] }),
    roundedBox(0.32, 0.12, 0.46, 0.05, 3, { pos: [0.18, 0.62, 0] }),
    roundedBox(0.32, 0.12, 0.46, 0.05, 3, { pos: [1.48, 0.62, 0] }),
    cylinder(0.07, 0.07, 0.22, 20, { pos: [0.18, 0.58, 0] }),
    cylinder(0.07, 0.07, 0.22, 20, { pos: [1.48, 0.58, 0] }),
    ...Array.from({ length: 6 }, (_, index) => roundedBox(0.035, 0.025, 0.36, 0.009, 2, {
      pos: [0.53 + index * 0.12, 1.155, 0],
    })),
  ]);
}

function inletGeometry() {
  return merge([
    curve([
      [-2.42, 0.37, 0.53],
      [-2.08, 0.37, 0.53],
      [-1.72, 0.39, 0.53],
      [-1.35, 0.42, 0.52],
      [-1.05, 0.43, 0.48],
      [-0.84, 0.43, 0.31],
    ], 0.17, { segments: 44, radial: 14 }),
    torus(0.205, 0.045, 40, 10, { pos: [-2.38, 0.37, 0.53], rot: [0, Math.PI / 2, 0] }),
    ...[0, 1, 2].map((index) => torus(0.178, 0.018, 30, 6, {
      pos: [-2.2 + index * 0.13, 0.37, 0.53],
      rot: [0, Math.PI / 2, 0],
    })),
  ]);
}

function binGeometry() {
  const profile = [
    [0.58, -0.67], [0.67, -0.59], [0.71, -0.42], [0.71, 0.42],
    [0.64, 0.68], [0.58, 0.7], [0.58, 0.61], [0.62, 0.39],
    [0.62, -0.42], [0.57, -0.56], [0.52, -0.6], [0.58, -0.67],
  ];
  return merge([
    lathe(profile, 72, { pos: [-0.95, -0.03, 0] }),
    cylinder(0.57, 0.57, 0.045, 64, { pos: [-0.95, -0.65, 0] }),
    torus(0.64, 0.032, 64, 10, { pos: [-0.95, -0.58, 0], rot: [Math.PI / 2, 0, 0] }),
    roundedBox(0.3, 0.11, 0.2, 0.035, 4, { pos: [-0.95, 0.69, -0.47] }),
  ]);
}

function coneGeometry() {
  return merge([
    lathe([[0.39, 0.25], [0.36, 0.16], [0.14, -0.52], [0.075, -0.61], [0.04, -0.57]], 64, { pos: [-0.95, -0.02, 0] }),
    cylinder(0.075, 0.075, 0.12, 32, { pos: [-0.95, -0.62, 0] }),
    torus(0.38, 0.025, 56, 10, { pos: [-0.95, 0.21, 0], rot: [Math.PI / 2, 0, 0] }),
  ]);
}

function shroudGeometry() {
  const parts = [
    cylinder(0.4, 0.4, 0.09, 64, { pos: [-0.95, 0.56, 0] }),
    tube(0.19, 0.13, 0.43, 40, { pos: [-0.95, 0.36, 0] }),
    torus(0.57, 0.035, 48, 8, { pos: [-0.95, 0.61, 0], rot: [Math.PI / 2, 0, 0] }),
    // The clean-air outlet bends rearward into the filter housing.
    curve([
      [-0.95, 0.56, 0],
      [-0.77, 0.56, 0],
      [-0.55, 0.45, 0],
      [-0.34, 0.25, 0],
      [-0.14, 0.08, 0],
    ], 0.14, { segments: 36, radial: 12 }),
  ];
  // Open cage rings and narrow uprights make the perforations actual voids.
  for (let index = 0; index < 7; index += 1) {
    parts.push(torus(0.31, 0.018, 40, 6, {
      pos: [-0.95, 0.2 + index * 0.055, 0],
      rot: [Math.PI / 2, 0, 0],
    }));
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = index * TAU / 12;
    parts.push(cylinder(0.014, 0.014, 0.36, 8, {
      pos: [-0.95 + Math.cos(angle) * 0.31, 0.365, Math.sin(angle) * 0.31],
    }));
  }
  return merge(parts);
}

function pleatedFilter(x, height, depth, count, along = 'y') {
  const parts = [
    roundedBox(0.1, height + 0.08, 0.055, 0.015, 2, { pos: [x, 0.02, -depth / 2] }),
    roundedBox(0.1, height + 0.08, 0.055, 0.015, 2, { pos: [x, 0.02, depth / 2] }),
    roundedBox(0.1, 0.055, depth, 0.015, 2, { pos: [x, 0.02 - height / 2, 0] }),
    roundedBox(0.1, 0.055, depth, 0.015, 2, { pos: [x, 0.02 + height / 2, 0] }),
  ];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1) - 0.5;
    if (along === 'y') {
      parts.push(box(0.055, height * 0.94, 0.035, {
        pos: [x, 0.02, t * depth * 0.9],
        rot: [index % 2 ? 0.28 : -0.28, 0, 0],
      }));
    } else {
      parts.push(box(0.055, 0.035, depth * 0.94, {
        pos: [x, 0.02 + t * height * 0.9, 0],
        rot: [0, 0, index % 2 ? 0.28 : -0.28],
      }));
    }
  }
  return merge(parts);
}

function statorGeometry() {
  const parts = [coloured(tube(0.43, 0.31, 0.76, 48, { pos: [0.72, 0.02, 0], rot: [0, 0, Math.PI / 2] }), '#68747a')];
  for (let pole = 0; pole < 8; pole += 1) {
    const angle = pole * TAU / 8;
    const y = 0.02 + Math.cos(angle) * 0.33;
    const z = Math.sin(angle) * 0.33;
    parts.push(coloured(roundedBox(0.61, 0.065, 0.11, 0.014, 2, {
      pos: [0.72, y, z], rot: [angle, 0, 0],
    }), '#59636a'));
    parts.push(coloured(curve([
      [0.43, 0.02 + Math.cos(angle) * 0.36, Math.sin(angle) * 0.36],
      [0.38, 0.02 + Math.cos(angle) * 0.39, Math.sin(angle) * 0.39],
      [1.06, 0.02 + Math.cos(angle) * 0.39, Math.sin(angle) * 0.39],
      [1.01, 0.02 + Math.cos(angle) * 0.36, Math.sin(angle) * 0.36],
    ], 0.018, { segments: 18, radial: 6 }), '#c77a3d'));
  }
  return merge(parts);
}

function rotorGeometry() {
  const parts = [
    cylinder(0.23, 0.23, 0.7, 52, { pos: [0.72, 0.02, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.052, 0.052, 1.1, 28, { pos: [0.67, 0.02, 0], rot: [0, 0, Math.PI / 2] }),
  ];
  for (let index = 0; index < 10; index += 1) {
    const angle = index * TAU / 10;
    parts.push(roundedBox(0.54, 0.035, 0.075, 0.007, 2, {
      pos: [0.72, 0.02 + Math.cos(angle) * 0.21, Math.sin(angle) * 0.21],
      rot: [angle, 0, 0],
    }));
  }
  return merge(parts);
}

function impellerGeometry() {
  const parts = [
    cylinder(0.09, 0.09, 0.17, 32, { pos: [0.24, 0.02, 0], rot: [0, 0, Math.PI / 2] }),
    cylinder(0.37, 0.37, 0.045, 48, { pos: [0.27, 0.02, 0], rot: [0, 0, Math.PI / 2] }),
  ];
  for (let index = 0; index < 11; index += 1) {
    const angle = index * TAU / 11;
    parts.push(roundedBox(0.12, 0.25, 0.055, 0.018, 2, {
      pos: [0.19, 0.02 + Math.cos(angle) * 0.22, Math.sin(angle) * 0.22],
      rot: [angle + 0.48, 0, 0],
    }));
  }
  return merge(parts);
}

function mountGeometry() {
  return merge([
    torus(0.44, 0.035, 42, 8, { pos: [0.42, 0.02, 0], rot: [0, Math.PI / 2, 0] }),
    torus(0.44, 0.035, 42, 8, { pos: [1.03, 0.02, 0], rot: [0, Math.PI / 2, 0] }),
    roundedBox(0.18, 0.47, 0.16, 0.045, 2, { pos: [0.42, -0.51, -0.29] }),
    roundedBox(0.18, 0.47, 0.16, 0.045, 2, { pos: [0.42, -0.51, 0.29] }),
    roundedBox(0.18, 0.47, 0.16, 0.045, 2, { pos: [1.03, -0.51, -0.29] }),
    roundedBox(0.18, 0.47, 0.16, 0.045, 2, { pos: [1.03, -0.51, 0.29] }),
    roundedBox(0.9, 0.13, 0.78, 0.045, 3, { pos: [0.72, -0.71, 0] }),
  ]);
}

function ventGeometry() {
  const parts = [
    roundedBox(0.42, 0.92, 1.18, 0.16, 3, { pos: [2.13, 0.02, 0] }),
    roundedBox(0.28, 0.82, 1.08, 0.12, 3, { pos: [1.48, 0.02, 0] }),
  ];
  for (let index = 0; index < 9; index += 1) {
    parts.push(roundedBox(0.08, 0.045, 0.9, 0.014, 2, {
      pos: [2.37, -0.3 + index * 0.08, 0],
      rot: [0, 0, -0.08],
    }));
  }
  return merge(parts);
}

function reelGeometry() {
  return merge([
    cylinder(0.25, 0.25, 0.58, 48, { pos: [1.55, -0.5, 0], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.12, 0.12, 0.7, 32, { pos: [1.55, -0.5, 0], rot: [Math.PI / 2, 0, 0] }),
    torus(0.23, 0.028, 40, 8, { pos: [1.55, -0.5, -0.3] }),
    torus(0.23, 0.028, 40, 8, { pos: [1.55, -0.5, 0.3] }),
    curve([[1.55, -0.27, 0.25], [1.78, -0.32, 0.25], [2.0, -0.48, 0.25]], 0.025, { segments: 22, radial: 6 }),
  ]);
}

function wheelsGeometry() {
  return merge([-1, 1].flatMap((side) => [
    coloured(torus(0.41, 0.11, 48, 12, { pos: [0.86, -0.76, side * 1.02] }), '#151a1d'),
    coloured(cylinder(0.3, 0.3, 0.13, 36, { pos: [0.86, -0.76, side * 1.02], rot: [Math.PI / 2, 0, 0] }), '#7b898f'),
    coloured(cylinder(0.085, 0.085, 0.25, 20, { pos: [0.86, -0.76, side * 0.92], rot: [Math.PI / 2, 0, 0] }), '#b3bdc1'),
    ...Array.from({ length: 7 }, (_, index) => coloured(roundedBox(0.055, 0.3, 0.05, 0.014, 2, {
      pos: [0.86 + Math.sin(index * TAU / 7) * 0.16, -0.76 + Math.cos(index * TAU / 7) * 0.16, side * 1.091],
      rot: [0, 0, index * TAU / 7],
    }), '#526167')),
  ]));
}

function casterGeometry() {
  return merge([
    torus(0.25, 0.09, 40, 10, { pos: [-1.42, -0.94, 0] }),
    cylinder(0.17, 0.17, 0.13, 32, { pos: [-1.42, -0.94, 0], rot: [Math.PI / 2, 0, 0] }),
    roundedBox(0.12, 0.35, 0.09, 0.03, 2, { pos: [-1.42, -0.66, -0.19], rot: [0.18, 0, 0] }),
    roundedBox(0.12, 0.35, 0.09, 0.03, 2, { pos: [-1.42, -0.66, 0.19], rot: [-0.18, 0, 0] }),
    cylinder(0.08, 0.08, 0.23, 28, { pos: [-1.42, -0.49, 0] }),
  ]);
}

export default function cyclonicVacuum() {
  const group = new THREE.Group();
  group.add(
    part('outer_body', bodyGeometry(), BODY()),
    part('carry_handle', handleGeometry(), HANDLE()),
    part('hose_inlet', inletGeometry(), INLET()),
    part('dust_bin', binGeometry(), CLEAR()),
    part('cyclone_cone', coneGeometry(), CYCLONE()),
    part('cyclone_shroud', shroudGeometry(), SHROUD()),
    part('bin_seal', torus(0.6, 0.045, 64, 12, { pos: [-0.95, 0.61, 0], rot: [Math.PI / 2, 0, 0] }), RUBBER()),
    part('pre_motor_filter', pleatedFilter(-0.04, 0.72, 0.72, 17, 'y'), FILTER()),
    part('motor_stator', statorGeometry(), STATOR()),
    part('motor_rotor', rotorGeometry(), ROTOR()),
    part('impeller', impellerGeometry(), IMPELLER()),
    part('motor_mount', mountGeometry(), MOUNT()),
    part('exhaust_filter', pleatedFilter(1.25, 0.76, 0.86, 19, 'z'), FILTER()),
    part('exhaust_vent', ventGeometry(), VENT()),
    part('cord_reel', reelGeometry(), REEL()),
    part('power_control', merge([
      cylinder(0.16, 0.18, 0.1, 48, { pos: [1.73, 0.67, -0.38] }),
      cylinder(0.15, 0.17, 0.1, 48, { pos: [1.73, 0.67, 0.38] }),
      ...[-1, 1].flatMap((side) => Array.from({ length: 4 }, (_, index) => box(0.025, 0.035, 0.12, {
        pos: [1.73 + (index - 1.5) * 0.045, 0.735, side * 0.38],
        rot: [0, 0, index * 0.18],
      }))),
    ]), CONTROL()),
    part('main_wheels', wheelsGeometry(), WHEEL()),
    part('caster_wheel', casterGeometry(), WHEEL()),
  );
  return group;
}

export const meta = { width: 4.88, height: 2.53, depth: 2.3 };
