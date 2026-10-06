// A conventional 5 L digital rice cooker. The silhouette follows the familiar
// low oval body used across Southeast Asian and Japanese countertop cookers;
// the cutaway then reveals the simple thermal stack beneath the removable pot.

import {
  THREE,
  part,
  pbr,
  roundedBox,
  box,
  cylinder,
  tube,
  torus,
  lathe,
  curve,
  merge,
  ring,
  paint,
  srgb,
} from '../lib/geo.mjs';

const W = 1.62;
const H = 1.18;
const D = 1.38;
const OVAL = D / W;

const PAINTED_STEEL = () => pbr('#d7d9dc', { metalness: 0, roughness: 0.45 });
const LID_ABS = () => pbr('#353941', { metalness: 0.08, roughness: 0.52 });
const BLACK_ABS = () => pbr('#171a1f', { metalness: 0.04, roughness: 0.68 });
const HANDLE = () => pbr('#4a4f58', { metalness: 0.18, roughness: 0.48 });
const CHROME = () => pbr('#d9dee5', { metalness: 1, roughness: 0.16 });
const RUBBER = () => pbr('#24272c', { metalness: 0, roughness: 0.9 });
const POT = () => pbr('#2b2e33', { metalness: 0.48, roughness: 0.35 });
const STAINLESS = () => pbr('#c5cbd1', { metalness: 1, roughness: 0.24 });
const HEATER = () => pbr('#9c8b72', { metalness: 0.86, roughness: 0.4 });
const SENSOR = () => pbr('#d8c9a7', { metalness: 0.72, roughness: 0.34 });
const PCB = () => pbr('#175d43', { metalness: 0.08, roughness: 0.62 });
const WIRE_INSULATION = () => pbr('#7f3032', { metalness: 0, roughness: 0.72 });
const CERAMIC = () => pbr('#e7d6b8', { metalness: 0.02, roughness: 0.7 });
const DISPLAY = () => pbr('#ffffff', { metalness: 0.12, roughness: 0.08, vertexColors: true });

/** Elliptical rings keep the appliance broad from the front without becoming a barrel. */
function ovalRing(radius, thickness, y, radial = 64, tubular = 12) {
  return torus(radius, thickness, radial, tubular, { rot: [Math.PI / 2, 0, 0], pos: [0, y, 0] }).scale(1, 1, OVAL);
}

function outerShell() {
  const wall = tube(W / 2 - 0.035, W / 2 - 0.105, 0.82, 72, { pos: [0, -0.08, 0], scale: [1, 1, OVAL] });
  const shoulder = ovalRing(W / 2 - 0.07, 0.035, 0.32);
  const lowerShutLine = ovalRing(W / 2 - 0.065, 0.026, -0.47);
  return merge([wall, shoulder, lowerShutLine]);
}

function outerLid() {
  const profile = [
    [0, 0.13],
    [0.24, 0.13],
    [0.55, 0.105],
    [0.72, 0.055],
    [0.78, 0.005],
    [0.755, -0.07],
    [0.68, -0.095],
    [0, -0.095],
  ];
  const cap = lathe(profile, 72, { pos: [0, 0.47, 0], scale: [1, 1, OVAL] });
  const perimeter = ovalRing(0.75, 0.024, 0.405);
  return merge([cap, perimeter]);
}

function carryHandle() {
  const arch = curve(
    [
      [-0.57, 0.49, -0.05],
      [-0.59, 0.61, -0.035],
      [-0.45, 0.72, -0.01],
      [-0.22, 0.77, 0.015],
      [0, 0.78, 0.025],
      [0.22, 0.77, 0.015],
      [0.45, 0.72, -0.01],
      [0.59, 0.61, -0.035],
      [0.57, 0.49, -0.05],
    ],
    0.037,
    { segments: 56, radial: 10 },
  );
  const pivots = [-1, 1].flatMap((side) => [
    cylinder(0.068, 0.068, 0.066, 24, { pos: [side * 0.57, 0.49, -0.05], rot: [Math.PI / 2, 0, 0] }),
    torus(0.068, 0.014, 24, 8, { pos: [side * 0.57, 0.49, -0.087] }),
  ]);
  return merge([arch, pivots]);
}

function steamVent() {
  const slits = Array.from({ length: 5 }, (_, index) =>
    roundedBox(0.026, 0.018, 0.13, 0.006, 2, { pos: [0.31 + (index - 2) * 0.052, 0.63, -0.21] }),
  );
  return merge([
    cylinder(0.16, 0.17, 0.055, 40, { pos: [0.31, 0.61, -0.21] }),
    torus(0.135, 0.018, 40, 8, { rot: [Math.PI / 2, 0, 0], pos: [0.31, 0.642, -0.21] }),
    slits,
  ]);
}

function hinge() {
  return merge([
    cylinder(0.075, 0.075, 0.62, 28, { pos: [0, 0.36, -0.66], rot: [0, 0, Math.PI / 2] }),
    roundedBox(0.18, 0.18, 0.11, 0.035, 3, { pos: [-0.31, 0.36, -0.64] }),
    roundedBox(0.18, 0.18, 0.11, 0.035, 3, { pos: [0.31, 0.36, -0.64] }),
  ]);
}

function controlPanel() {
  const buttons = [
    [-0.25, -0.035, 0.05],
    [-0.11, -0.035, 0.04],
    [0.11, -0.035, 0.04],
    [0.25, -0.035, 0.05],
  ].map(([x, y, radius]) =>
    cylinder(radius, radius, 0.022, 24, { pos: [x, y + 0.02, 0.716], rot: [Math.PI / 2, 0, 0] }),
  );
  const legends = [-0.25, -0.11, 0.11, 0.25].map((x) =>
    roundedBox(0.07, 0.009, 0.009, 0.003, 1, { pos: [x, -0.082, 0.724] }),
  );
  return merge([
    roundedBox(0.68, 0.235, 0.045, 0.05, 4, { pos: [0, 0.02, 0.68], rot: [-0.08, 0, 0] }),
    buttons,
    legends,
  ]);
}

function displayWindow() {
  const dark = srgb('#07131a');
  const cyan = srgb('#35d6e5');
  const coloured = (geometry, colour) => paint(geometry, () => colour);
  const window = coloured(
    roundedBox(0.32, 0.082, 0.012, 0.018, 3, { pos: [0, 0.105, 0.719], rot: [-0.08, 0, 0] }),
    dark,
  );
  const segment = (w, h, x, y) =>
    coloured(roundedBox(w, h, 0.006, 0.002, 1, { pos: [x, y, 0.728], rot: [-0.08, 0, 0] }), cyan);
  const digit = (centre) => [
    segment(0.028, 0.005, centre, 0.13),
    segment(0.028, 0.005, centre, 0.105),
    segment(0.028, 0.005, centre, 0.08),
    segment(0.005, 0.022, centre - 0.014, 0.118),
    segment(0.005, 0.022, centre + 0.014, 0.118),
    segment(0.005, 0.022, centre - 0.014, 0.092),
    segment(0.005, 0.022, centre + 0.014, 0.092),
  ];
  return merge([
    window,
    digit(-0.055),
    digit(0.055),
    segment(0.005, 0.005, 0, 0.115),
    segment(0.005, 0.005, 0, 0.095),
  ]);
}

function innerPot() {
  // Closed cross-section with separate inner and outer walls. The thicker base
  // is intentional: real rice-cooker pans spread heat before it reaches rice.
  const profile = [
    [0, -0.31],
    [0.37, -0.31],
    [0.47, -0.25],
    [0.53, 0.23],
    [0.575, 0.31],
    [0.56, 0.355],
    [0.49, 0.36],
    [0.465, 0.285],
    [0.405, -0.22],
    [0, -0.255],
  ];
  return lathe(profile, 80, { pos: [0, -0.005, 0] });
}

function innerLid() {
  return merge([
    lathe(
      [
        [0, 0.026],
        [0.38, 0.026],
        [0.5, 0.005],
        [0.52, -0.02],
        [0.48, -0.045],
        [0, -0.045],
      ],
      64,
      { pos: [0, 0.36, 0] },
    ),
    cylinder(0.075, 0.075, 0.026, 28, { pos: [0, 0.325, 0] }),
    ring(10, () => box(0.04, 0.018, 0.12, { pos: [0, 0.327, 0.28] })),
  ]);
}

function lidGasket() {
  return merge([
    torus(0.505, 0.032, 64, 12, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.315, 0] }),
    torus(0.095, 0.018, 36, 10, { rot: [Math.PI / 2, 0, 0], pos: [0.31, 0.325, -0.2] }),
  ]);
}

function heatingPlate() {
  return merge([
    cylinder(0.49, 0.47, 0.075, 64, { pos: [0, -0.365, 0] }),
    torus(0.38, 0.023, 64, 10, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.321, 0] }),
    torus(0.25, 0.018, 56, 10, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.319, 0] }),
    torus(0.13, 0.015, 48, 8, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.317, 0] }),
  ]);
}

function temperatureSensor() {
  const spring = Array.from({ length: 5 }, (_, index) =>
    torus(0.06, 0.009, 28, 7, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.38 + index * 0.022, 0] }),
  );
  return merge([
    cylinder(0.074, 0.068, 0.11, 32, { pos: [0, -0.285, 0] }),
    cylinder(0.092, 0.092, 0.022, 32, { pos: [0, -0.225, 0] }),
    spring,
  ]);
}

function controlBoard() {
  const chips = [
    roundedBox(0.14, 0.1, 0.035, 0.008, 2, { pos: [-0.13, 0.065, 0.535] }),
    roundedBox(0.1, 0.08, 0.03, 0.006, 2, { pos: [0.11, 0.08, 0.534] }),
    ...[-0.23, 0.23].map((x) => cylinder(0.035, 0.035, 0.07, 18, { pos: [x, -0.03, 0.535], rot: [Math.PI / 2, 0, 0] })),
    ...Array.from({ length: 8 }, (_, index) =>
      box(0.018, 0.045, 0.025, { pos: [-0.21 + index * 0.06, -0.095, 0.535] }),
    ),
  ];
  return merge([
    roundedBox(0.62, 0.27, 0.025, 0.025, 2, { pos: [0, 0.015, 0.51] }),
    chips,
  ]);
}

function wiringHarness() {
  return merge([
    curve([[-0.24, -0.05, 0.49], [-0.34, -0.16, 0.37], [-0.35, -0.3, 0.18]], 0.017, { segments: 28, radial: 8 }),
    curve([[0.21, -0.04, 0.49], [0.3, -0.16, 0.34], [0.28, -0.34, 0.1]], 0.017, { segments: 28, radial: 8 }),
    curve([[0.06, -0.09, 0.49], [0.08, -0.2, 0.25], [0, -0.31, 0.04]], 0.014, { segments: 28, radial: 8 }),
    curve([[-0.28, -0.1, 0.48], [-0.42, -0.23, 0.1], [-0.34, -0.31, -0.5]], 0.015, { segments: 34, radial: 8 }),
  ]);
}

function powerSocket() {
  return merge([
    roundedBox(0.3, 0.18, 0.075, 0.035, 3, { pos: [-0.33, -0.27, -0.66] }),
    roundedBox(0.18, 0.09, 0.025, 0.018, 2, { pos: [-0.33, -0.27, -0.708] }),
    cylinder(0.018, 0.018, 0.07, 12, { pos: [-0.38, -0.27, -0.72], rot: [Math.PI / 2, 0, 0] }),
    cylinder(0.018, 0.018, 0.07, 12, { pos: [-0.28, -0.27, -0.72], rot: [Math.PI / 2, 0, 0] }),
  ]);
}

function basePlate() {
  const plate = cylinder(W / 2 - 0.055, W / 2 - 0.075, 0.13, 72, { pos: [0, -0.55, 0], scale: [1, 1, OVAL] });
  const feet = [
    [-0.51, -0.59, 0.39],
    [0.51, -0.59, 0.39],
    [-0.51, -0.59, -0.39],
    [0.51, -0.59, -0.39],
  ].map(([x, y, z]) => roundedBox(0.2, 0.09, 0.16, 0.035, 3, { pos: [x, y, z] }));
  const vents = ring(14, () => roundedBox(0.14, 0.025, 0.045, 0.01, 2, { pos: [0, -0.622, 0.48] }));
  return merge([plate, feet, vents]);
}

export default function riceCooker() {
  const group = new THREE.Group();

  group.add(
    part('outer_shell', outerShell(), PAINTED_STEEL()),
    part('outer_lid', outerLid(), LID_ABS()),
    part('carry_handle', carryHandle(), HANDLE()),
    part('lid_release', roundedBox(0.25, 0.085, 0.055, 0.028, 3, { pos: [0, 0.35, 0.695] }), CHROME()),
    part('steam_vent', steamVent(), BLACK_ABS()),
    part('hinge', hinge(), HANDLE()),
    part('control_panel', controlPanel(), BLACK_ABS()),
    part('display', displayWindow(), DISPLAY()),
    part('inner_pot', innerPot(), POT()),
    part('inner_lid', innerLid(), STAINLESS()),
    part('lid_gasket', lidGasket(), RUBBER()),
    part('heating_plate', heatingPlate(), HEATER()),
    part('temperature_sensor', temperatureSensor(), SENSOR()),
    part('control_board', controlBoard(), PCB()),
    part('thermal_fuse', cylinder(0.038, 0.038, 0.3, 18, { pos: [-0.34, -0.31, 0.17], rot: [0, 0, Math.PI / 2] }), CERAMIC()),
    part('wiring_harness', wiringHarness(), WIRE_INSULATION()),
    part('power_socket', powerSocket(), BLACK_ABS()),
    part('base_plate', basePlate(), BLACK_ABS()),
  );

  return group;
}

export const meta = { width: W, height: H, depth: D };
