// Smartphone — a layered stack. The interesting axis is depth, so this model is
// built back-to-front along Z and explodes the same way.

import { THREE, TAU, part, pbr, box, roundedBox, cylinder, merge, ring, place } from '../lib/geo.mjs';

const W = 0.72;
const H = 1.52;
const D = 0.082;

const ALUMINIUM = () => pbr('#c9ced6', { metalness: 1, roughness: 0.32 });
const GLASS_BACK = () => pbr('#1b2028', { metalness: 0.55, roughness: 0.12 });
const PCB = () => pbr('#12503a', { metalness: 0.1, roughness: 0.62 });
const CELL = () => pbr('#2c3540', { metalness: 0.35, roughness: 0.45 });
const DARK = () => pbr('#14171c', { metalness: 0.2, roughness: 0.55 });
const COPPER = () => pbr('#c9834a', { metalness: 1, roughness: 0.34 });
const SCREEN = () => pbr('#05070c', { metalness: 0.1, roughness: 0.08, emissive: '#0d3f6e', emissiveIntensity: 0.55 });

/** Four rails plus rounded corners — a band, not a solid slab. */
function frameBand() {
  const t = 0.026;
  const r = 0.1;
  const rails = [
    roundedBox(W - r * 2, t, D, 0.01, 2, { pos: [0, H / 2 - t / 2, 0] }),
    roundedBox(W - r * 2, t, D, 0.01, 2, { pos: [0, -H / 2 + t / 2, 0] }),
    roundedBox(t, H - r * 2, D, 0.01, 2, { pos: [W / 2 - t / 2, 0, 0] }),
    roundedBox(t, H - r * 2, D, 0.01, 2, { pos: [-W / 2 + t / 2, 0, 0] }),
  ];
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].map(([sx, sy]) =>
    place(new THREE.TorusGeometry(r - t / 2, t / 2, 8, 14, Math.PI / 2), {
      pos: [sx * (W / 2 - r), sy * (H / 2 - r), 0],
      rot: [0, 0, sx > 0 ? (sy > 0 ? 0 : -Math.PI / 2) : sy > 0 ? Math.PI / 2 : Math.PI],
    }).scale(1, 1, D / t),
  );
  return merge([...rails, ...corners]);
}

function logicBoard() {
  const board = roundedBox(0.52, 0.36, 0.012, 0.02, 2);
  const chips = [
    roundedBox(0.14, 0.14, 0.016, 0.005, 1, { pos: [-0.11, 0.06, 0.014] }),
    roundedBox(0.11, 0.09, 0.014, 0.005, 1, { pos: [0.1, 0.09, 0.013] }),
    roundedBox(0.09, 0.07, 0.012, 0.004, 1, { pos: [0.12, -0.06, 0.012] }),
    roundedBox(0.07, 0.16, 0.01, 0.004, 1, { pos: [-0.16, -0.08, 0.011] }),
  ];
  // Connector fingers along the bottom edge read as a board even at thumbnail size.
  const pins = ring(1, () =>
    merge(
      Array.from({ length: 14 }, (_, i) =>
        box(0.012, 0.02, 0.006, { pos: [-0.16 + i * 0.025, -0.185, 0.008] }),
      ),
    ),
  );
  return { board: merge([board, ...chips]), pins };
}

export default function smartphone() {
  const group = new THREE.Group();
  const { board, pins } = logicBoard();

  group.add(
    part('frame', frameBand(), ALUMINIUM()),
    part('back_glass', roundedBox(W - 0.03, H - 0.03, 0.008, 0.09, 4, { pos: [0, 0, -D / 2 + 0.008] }), GLASS_BACK()),
    part(
      'camera_module',
      merge([
        roundedBox(0.28, 0.28, 0.02, 0.06, 3, { pos: [-0.17, 0.52, -D / 2 - 0.004] }),
        ...[
          [-0.24, 0.585],
          [-0.1, 0.585],
          [-0.17, 0.455],
        ].flatMap(([x, y]) => [
          cylinder(0.055, 0.055, 0.03, 24, { pos: [x, y, -D / 2 - 0.012], rot: [Math.PI / 2, 0, 0] }),
          cylinder(0.04, 0.04, 0.034, 20, { pos: [x, y, -D / 2 - 0.016], rot: [Math.PI / 2, 0, 0] }),
        ]),
      ]),
      pbr('#2a2f38', { metalness: 0.85, roughness: 0.18 }),
    ),
    part('battery', roundedBox(0.56, 0.62, 0.036, 0.02, 2, { pos: [0, -0.32, -0.008] }), CELL()),
    part('logic_board', board.clone().translate(0, 0.42, -0.006), PCB()),
    part('shield_can', roundedBox(0.3, 0.2, 0.018, 0.008, 2, { pos: [-0.02, 0.44, 0.012] }), pbr('#9aa3ad', { metalness: 1, roughness: 0.28 })),
    part('battery_connector', pins.clone().translate(0, 0.42, -0.006), COPPER()),
    part(
      'speaker',
      merge([
        roundedBox(0.2, 0.1, 0.026, 0.01, 2, { pos: [0.14, -0.66, -0.006] }),
        cylinder(0.036, 0.036, 0.03, 20, { pos: [0.14, -0.66, -0.006], rot: [Math.PI / 2, 0, 0] }),
      ]),
      DARK(),
    ),
    part(
      'haptic_engine',
      merge([
        roundedBox(0.16, 0.09, 0.024, 0.01, 2, { pos: [-0.16, -0.66, -0.006] }),
        box(0.1, 0.04, 0.026, { pos: [-0.16, -0.66, -0.006] }),
      ]),
      pbr('#6d7480', { metalness: 0.9, roughness: 0.4 }),
    ),
    part(
      'display',
      merge([
        roundedBox(W - 0.05, H - 0.05, 0.005, 0.085, 4, { pos: [0, 0, D / 2 - 0.012] }),
        roundedBox(W - 0.036, H - 0.036, 0.004, 0.09, 4, { pos: [0, 0, D / 2 - 0.007] }),
      ]),
      SCREEN(),
    ),
    part(
      'display_flex',
      merge([
        box(0.22, 0.09, 0.004, { pos: [0, -H / 2 + 0.12, D / 2 - 0.02] }),
        box(0.1, 0.3, 0.003, { pos: [0, -H / 2 + 0.3, D / 2 - 0.022] }),
      ]),
      pbr('#c58a3d', { metalness: 0.4, roughness: 0.5 }),
    ),
  );

  return group;
}

export const meta = { TAU };
