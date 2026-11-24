// Smartphone — a layered stack. The interesting axis is depth, so this model is
// built back-to-front along Z and explodes the same way.

import { THREE, TAU, part, pbr, box, roundedBox, cylinder, merge, ring, place, paint, srgb } from '../lib/geo.mjs';

const W = 0.72;
const H = 1.52;
const D = 0.082;

const ALUMINIUM = () => pbr('#c9ced6', { metalness: 1, roughness: 0.32 });
const GLASS_BACK = () => pbr('#1b2028', { metalness: 0.55, roughness: 0.12 });
const PCB = () => pbr('#12503a', { metalness: 0.1, roughness: 0.62 });
const CELL = () => pbr('#2c3540', { metalness: 0.35, roughness: 0.45 });
const DARK = () => pbr('#14171c', { metalness: 0.2, roughness: 0.55 });
const COPPER = () => pbr('#c9834a', { metalness: 1, roughness: 0.34 });
const UI = () => pbr('#ffffff', { vertexColors: true, metalness: 0.08, roughness: 0.2 });

/** Four rails plus rounded corners — a band, not a solid slab. */
function frameBand() {
  const t = 0.026;
  const r = 0.1;
  const rails = [
    roundedBox(W - r * 2, t, D, 0.01, 2, { pos: [0, H / 2 - t / 2, 0] }),
    roundedBox(W - r * 2, t, D, 0.01, 2, { pos: [0, -H / 2 + t / 2, 0] }),
    roundedBox(t, H - r * 2, D, 0.01, 2, { pos: [W / 2 - t / 2, 0, 0] }),
    roundedBox(t, H - r * 2, D, 0.01, 2, { pos: [-W / 2 + t / 2, 0, 0] }),
    // Power and volume buttons sit proud of the band, so the silhouette is a
    // phone rather than a seamless slab.
    box(0.008, 0.14, 0.03, { pos: [W / 2 + 0.002, 0.16, 0] }),
    box(0.008, 0.09, 0.03, { pos: [-W / 2 - 0.002, 0.24, 0] }),
    box(0.008, 0.09, 0.03, { pos: [-W / 2 - 0.002, 0.11, 0] }),
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

/** The home screen is geometry: wallpaper, status bar, app grid and dock. */
function screenUI() {
  const frontZ = D / 2 - 0.012;
  const screenW = W - 0.05;
  const screenH = H - 0.05;
  const layers = [];
  const tint = (geometry, hex) => paint(geometry, () => srgb(hex));

  layers.push(tint(roundedBox(screenW, screenH, 0.005, 0.085, 4, { pos: [0, 0, frontZ] }), '#05070c'));

  const wallpaper = roundedBox(screenW - 0.036, screenH - 0.036, 0.0015, 0.075, 3, {
    pos: [0, 0, frontZ + 0.002],
  });
  const top = new THREE.Color('#2e7cc4');
  const bottom = new THREE.Color('#081633');
  paint(wallpaper, (x, y) => {
    const t = Math.max(0, Math.min(1, (y + screenH / 2) / screenH));
    const colour = bottom.clone().lerp(top, t * t);
    return [colour.r, colour.g, colour.b];
  });
  layers.push(wallpaper);

  // Status bar: time on the left, signal and battery on the right.
  layers.push(tint(box(0.10, 0.016, 0.001, { pos: [-0.20, 0.665, frontZ + 0.004] }), '#eef4ff'));
  layers.push(tint(box(0.012, 0.014, 0.001, { pos: [0.15, 0.665, frontZ + 0.004] }), '#eef4ff'));
  layers.push(tint(box(0.012, 0.020, 0.001, { pos: [0.17, 0.665, frontZ + 0.004] }), '#eef4ff'));
  layers.push(tint(box(0.012, 0.026, 0.001, { pos: [0.19, 0.665, frontZ + 0.004] }), '#eef4ff'));
  layers.push(tint(roundedBox(0.056, 0.026, 0.001, 0.006, 2, { pos: [0.25, 0.665, frontZ + 0.004] }), '#eef4ff'));

  // Punch-hole camera and earpiece, so the bezel reads as the top of a phone.
  layers.push(tint(cylinder(0.016, 0.016, 0.004, 20, { pos: [0, 0.69, frontZ + 0.005], rot: [Math.PI / 2, 0, 0] }), '#02040a'));
  layers.push(tint(box(0.11, 0.006, 0.002, { pos: [0, 0.722, frontZ + 0.003] }), '#10141c'));

  const palette = ['#e45b5b', '#f0a23a', '#4fb06b', '#3f8fd0', '#8b63c7', '#e6e8ec', '#42b8b2', '#d7dce4'];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      layers.push(tint(
        roundedBox(0.105, 0.105, 0.004, 0.022, 2, {
          pos: [-0.225 + column * 0.15, 0.40 - row * 0.145, frontZ + 0.004],
        }),
        palette[(row * 4 + column) % palette.length],
      ));
    }
  }

  layers.push(tint(roundedBox(0.60, 0.15, 0.0018, 0.035, 2, { pos: [0, -0.55, frontZ + 0.003] }), '#c9dcf2'));
  for (let i = 0; i < 4; i += 1) {
    layers.push(tint(
      roundedBox(0.09, 0.09, 0.003, 0.02, 2, { pos: [-0.225 + i * 0.15, -0.55, frontZ + 0.005] }),
      palette[(i + 2) % palette.length],
    ));
  }
  layers.push(tint(box(0.17, 0.007, 0.0015, { pos: [0, -0.705, frontZ + 0.005] }), '#dfe8f7'));

  return layers;
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
    part('display', screenUI(), UI()),
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
