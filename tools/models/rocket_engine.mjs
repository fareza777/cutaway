// Gas-generator liquid rocket. Built along +Y (nozzle pointing −Y) and laid
// onto +Z by the group transform, same as the turbofan, so the bell profile
// stays a readable [radius, height] list.
//
// What makes this read as a rocket rather than a vase is not the part count.
// It is the bell — a Rao-ish parabola from a tight throat — with regenerative
// cooling tubes derived from that same profile, and the turbopump hanging off
// the side so the silhouette is not a solid of revolution. Those three come
// from one description of the nozzle (onBell, below), so the tubes, the dump
// pipe and the wall they sit on cannot drift apart.

import {
  THREE, TAU, part, pbr, box, cylinder, tube, torus, lathe, merge, ring, place,
  sphere, curve, paint, srgb, smoothProfile, roundedBox,
} from '../lib/geo.mjs';

const COPPER = () => pbr('#ffffff', { metalness: 0.86, roughness: 0.36, vertexColors: true });
const INCONEL = () => pbr('#8a7360', { metalness: 0.92, roughness: 0.38 });
const STEEL = () => pbr('#9aa3ad', { metalness: 0.88, roughness: 0.32 });
const DARK = () => pbr('#5c636c', { metalness: 0.9, roughness: 0.42 });
const HOT = () => pbr('#8a5a48', { metalness: 0.85, roughness: 0.5, emissive: '#ff5a1e', emissiveIntensity: 0.18 });
const PIPE = () => pbr('#c4a882', { metalness: 0.9, roughness: 0.28 });
const HYD = () => pbr('#4a5550', { metalness: 0.45, roughness: 0.48 });

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const COPPER_TINT = srgb('#c47848');
const SOOT = srgb('#2e2a26');
const HEAT = srgb('#a85a38');

/** Outer wall of the expanding bell, throat at the top, exit at the bottom. */
const BELL = smoothProfile(
  [
    [0.18, 0.14],
    [0.22, 0.0],
    [0.34, -0.26],
    [0.5, -0.56],
    [0.66, -0.88],
    [0.8, -1.18],
    [0.9, -1.48],
  ],
  48,
);

function sampleProfile(profile, t) {
  const i = t * (profile.length - 1);
  const i0 = Math.min(Math.floor(i), profile.length - 2);
  const f = i - i0;
  return [
    profile[i0][0] + (profile[i0 + 1][0] - profile[i0][0]) * f,
    profile[i0][1] + (profile[i0 + 1][1] - profile[i0][1]) * f,
  ];
}

/** Point on the bell. `t` is 0 at the throat, 1 at the exit. `phi` from +Z. */
function onBell(t, phi, out = 0) {
  const [r0, y] = sampleProfile(BELL, t);
  const r = r0 + out;
  return [r * Math.sin(phi), y, r * Math.cos(phi)];
}

function cylinderAlong(from, to, rTop, rBot = rTop, radial = 12) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const geom = new THREE.CylinderGeometry(rTop, rBot, a.distanceTo(b), radial, 1);
  const mid = a.clone().lerp(b, 0.5);
  const dir = b.clone().sub(a).normalize();
  geom.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  geom.translate(mid.x, mid.y, mid.z);
  return geom;
}

function bellows(from, to, count = 7, radius = 0.072) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return merge(
    Array.from({ length: count }, (_, i) => {
      const t = (i + 0.5) / count;
      const p = a.clone().lerp(b, t);
      const ring = new THREE.TorusGeometry(radius, 0.011, 8, 16);
      ring.rotateX(Math.PI / 2);
      ring.applyQuaternion(quat);
      ring.translate(p.x, p.y, p.z);
      return ring;
    }),
  );
}

function coolingTubes() {
  const n = 96;
  return merge(
    Array.from({ length: n }, (_, i) => {
      const phi = (i / n) * TAU;
      const pts = Array.from({ length: 16 }, (_, k) => onBell(0.04 + (k / 15) * 0.88, phi, 0.011));
      return curve(pts, i % 8 === 0 ? 0.012 : 0.009, { segments: 24, radial: 5 });
    }),
  );
}

function impeller(hub, tip, count, twist) {
  const len = tip - hub;
  const blades = ring(count, () =>
    place(box(len, 0.01, 0.045), { rot: [twist, 0, 0], pos: [hub + len / 2, 0, 0] }),
  );
  return merge([cylinder(hub, hub, 0.05, 20), blades]);
}

function volute(rPath, rTube, pos) {
  return merge([
    place(torus(rPath, rTube, 22, 28), { rot: [0, Math.PI / 2, 0], pos }),
    cylinder(rPath - rTube * 0.15, rPath - rTube * 0.15, rTube * 1.5, 24, {
      pos,
      rot: [0, 0, Math.PI / 2],
    }),
    // Discharge tongue — the one feature that names a centrifugal pump.
    cylinder(rTube * 0.7, rTube * 0.55, rTube * 1.4, 12, {
      pos: [pos[0], pos[1] - rPath - rTube * 0.4, pos[2]],
    }),
  ]);
}

function flange(radius, y, bolts = 12, boltR = 0.016) {
  return merge([
    cylinder(radius, radius, 0.042, 40, { pos: [0, y, 0] }),
    cylinder(radius - 0.048, radius - 0.048, 0.018, 32, { pos: [0, y + 0.026, 0] }),
    ring(bolts, () => cylinder(boltR, boltR, 0.052, 8, { pos: [radius - 0.026, y, 0] })),
  ]);
}

function ram(from, to) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const barrelEnd = a.clone().addScaledVector(dir, len * 0.58);
  const rodStart = a.clone().addScaledVector(dir, len * 0.48);
  return merge([
    cylinderAlong(from, barrelEnd.toArray(), 0.034, 0.034, 14),
    cylinderAlong(from, a.clone().addScaledVector(dir, 0.05).toArray(), 0.04, 0.04, 12),
    cylinderAlong(rodStart.toArray(), to, 0.015, 0.015, 10),
    sphere(0.04, 10, { pos: from }),
    sphere(0.034, 8, { pos: to }),
  ]);
}

export default function rocketEngine() {
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;

  const rim = BELL[BELL.length - 1];
  const throat = BELL[0];
  const bellInner = BELL.slice()
    .reverse()
    .map(([r, y]) => [Math.max(0.04, r - 0.028), y]);
  const nozzleProfile = [
    ...BELL,
    [rim[0] + 0.012, rim[1]],
    [rim[0] + 0.012, rim[1] - 0.02],
    [rim[0] - 0.028, rim[1] - 0.02],
    [rim[0] - 0.028, rim[1]],
    ...bellInner.slice(1, -1),
    [throat[0] - 0.028, throat[1]],
    [throat[0], throat[1]],
  ];

  const PUMP_Y = 1.14;
  const PUMP_X = 0.62;
  const DUMP_PHI = Math.PI / 2;

  group.add(
    part(
      'nozzle',
      paint(
        merge([
          lathe(nozzleProfile, 128),
          torus(0.91, 0.02, 10, 56, { pos: [0, -1.48, 0], rot: [Math.PI / 2, 0, 0] }),
          // Stiffening band just below the throat, where the wall is hottest.
          torus(0.26, 0.016, 10, 40, { pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0] }),
        ]),
        (x, y, z) => {
          const t = Math.max(0, Math.min(1, (0.14 - y) / 1.62));
          const phi = Math.atan2(x, z);
          const dump = Math.max(0, Math.cos(phi - DUMP_PHI)) ** 6;
          const sootStreak = dump * Math.max(0, t - 0.18);
          const c = mix3(COPPER_TINT, mix3(HEAT, SOOT, t), t * 0.72);
          const sooted = mix3(c, SOOT, sootStreak * 0.92);
          const shade = 0.93 + 0.07 * Math.max(0, z);
          return [sooted[0] * shade, sooted[1] * shade, sooted[2] * shade];
        },
      ),
      COPPER(),
    ),
    part(
      'cooling_tubes',
      merge([
        coolingTubes(),
        torus(0.2, 0.03, 12, 40, { pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.52, 0.018, 10, 40, { pos: [0, -0.58, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.84, 0.018, 10, 48, { pos: [0, -1.22, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.9, 0.02, 10, 48, { pos: [0, -1.46, 0], rot: [Math.PI / 2, 0, 0] }),
      ]),
      PIPE(),
    ),
    part(
      'combustion_chamber',
      merge([
        tube(0.3, 0.255, 0.7, 48, { pos: [0, 0.5, 0] }),
        flange(0.35, 0.84, 16, 0.014),
        flange(0.33, 0.16, 14, 0.013),
        torus(0.31, 0.014, 10, 36, { pos: [0, 0.5, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.31, 0.014, 10, 36, { pos: [0, 0.68, 0], rot: [Math.PI / 2, 0, 0] }),
        ring(4, () => cylinder(0.03, 0.022, 0.1, 10, { pos: [0.3, 0.72, 0], rot: [0, 0, Math.PI / 2] })),
      ]),
      INCONEL(),
    ),
    part(
      'injector',
      merge([
        cylinder(0.255, 0.255, 0.05, 40, { pos: [0, 0.86, 0] }),
        cylinder(0.055, 0.04, 0.3, 24, { pos: [0, 0.68, 0] }),
        cylinder(0.072, 0.072, 0.028, 20, { pos: [0, 0.54, 0] }),
        ...[0.1, 0.155, 0.205].flatMap((r, ringI) =>
          Array.from({ length: 8 + ringI * 8 }, (_, i) => {
            const a = (i / (8 + ringI * 8)) * TAU;
            return cylinder(0.011, 0.009, 0.045, 8, {
              pos: [r * Math.sin(a), 0.82, r * Math.cos(a)],
            });
          }),
        ),
      ]),
      DARK(),
    ),
    part(
      'igniter',
      merge([
        cylinderAlong([0.1, 0.96, 0.14], [0.16, 1.12, 0.24], 0.02, 0.02, 10),
        sphere(0.028, 10, { pos: [0.16, 1.12, 0.24] }),
        cylinder(0.032, 0.032, 0.04, 10, { pos: [0.1, 0.95, 0.14] }),
      ]),
      STEEL(),
    ),
    part(
      'fuel_pump',
      merge([
        volute(0.19, 0.1, [PUMP_X, PUMP_Y, 0]),
        place(impeller(0.048, 0.155, 12, 0.45), {
          rot: [0, 0, Math.PI / 2],
          pos: [PUMP_X, PUMP_Y, 0],
        }),
        cylinder(0.055, 0.055, 0.18, 16, {
          pos: [PUMP_X + 0.16, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
        torus(0.09, 0.016, 10, 20, {
          pos: [PUMP_X + 0.08, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
      ]),
      STEEL(),
    ),
    part(
      'ox_pump',
      merge([
        volute(0.23, 0.125, [PUMP_X - 0.34, PUMP_Y, 0]),
        place(impeller(0.055, 0.185, 10, 0.4), {
          rot: [0, 0, Math.PI / 2],
          pos: [PUMP_X - 0.34, PUMP_Y, 0],
        }),
        cylinder(0.09, 0.068, 0.16, 18, {
          pos: [PUMP_X - 0.55, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
        torus(0.11, 0.018, 10, 20, {
          pos: [PUMP_X - 0.46, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
      ]),
      STEEL(),
    ),
    part(
      'turbine',
      merge([
        // Housing first — an exposed impeller reads as a fan, not a turbine.
        cylinder(0.24, 0.24, 0.16, 32, {
          pos: [PUMP_X + 0.44, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
        cylinder(0.26, 0.26, 0.04, 28, {
          pos: [PUMP_X + 0.36, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
        cylinder(0.26, 0.26, 0.04, 28, {
          pos: [PUMP_X + 0.52, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
        place(impeller(0.07, 0.2, 28, -0.55), {
          rot: [0, 0, Math.PI / 2],
          pos: [PUMP_X + 0.44, PUMP_Y, 0],
        }),
        cylinder(0.045, 0.045, 0.92, 16, {
          pos: [PUMP_X + 0.04, PUMP_Y, 0],
          rot: [0, 0, Math.PI / 2],
        }),
      ]),
      INCONEL(),
    ),
    part(
      'gas_generator',
      merge([
        tube(0.13, 0.085, 0.26, 28, { pos: [PUMP_X + 0.44, PUMP_Y + 0.3, 0] }),
        cylinder(0.09, 0.055, 0.08, 20, { pos: [PUMP_X + 0.44, PUMP_Y + 0.14, 0] }),
        cylinder(0.1, 0.1, 0.05, 20, { pos: [PUMP_X + 0.44, PUMP_Y + 0.44, 0] }),
        ring(8, () => cylinder(0.012, 0.016, 0.045, 8, { pos: [0.1, PUMP_Y + 0.42, 0] })).translate(
          PUMP_X + 0.44,
          0,
          0,
        ),
      ]),
      HOT(),
    ),
    part(
      'turbine_exhaust',
      merge([
        cylinder(0.055, 0.048, 0.1, 14, {
          pos: [PUMP_X + 0.56, PUMP_Y - 0.04, 0],
          rot: [0, 0, 0.9],
        }),
        curve(
          [
            [PUMP_X + 0.58, PUMP_Y - 0.1, 0],
            [PUMP_X + 0.52, 0.68, 0],
            [PUMP_X + 0.24, 0.2, 0],
            onBell(0.38, DUMP_PHI, 0.05),
            onBell(0.64, DUMP_PHI, 0.032),
          ],
          0.04,
          { segments: 28, radial: 8 },
        ),
        sphere(0.048, 10, { pos: onBell(0.66, DUMP_PHI, 0.018) }),
      ]),
      DARK(),
    ),
    part(
      'fuel_valve',
      merge([
        sphere(0.07, 14, { pos: [0.22, 1.02, 0.16] }),
        cylinder(0.045, 0.045, 0.1, 12, { pos: [0.22, 0.94, 0.16] }),
        roundedBox(0.045, 0.085, 0.045, 0.008, 2, { pos: [0.22, 1.1, 0.16] }),
      ]),
      DARK(),
    ),
    part(
      'ox_valve',
      merge([
        sphere(0.08, 14, { pos: [-0.02, 1.02, -0.2] }),
        cylinder(0.05, 0.05, 0.12, 12, { pos: [-0.02, 0.93, -0.2] }),
        roundedBox(0.05, 0.09, 0.05, 0.008, 2, { pos: [-0.02, 1.12, -0.2] }),
      ]),
      DARK(),
    ),
    part(
      'gimbal',
      merge([
        torus(0.19, 0.032, 16, 32, { pos: [0, 1.42, 0], rot: [Math.PI / 2, 0, 0] }),
        torus(0.155, 0.028, 14, 28, { pos: [0, 1.42, 0], rot: [0, 0, 0] }),
        cylinder(0.12, 0.12, 0.09, 24, { pos: [0, 1.5, 0] }),
        cylinder(0.08, 0.08, 0.2, 20, { pos: [0, 1.64, 0] }),
        roundedBox(0.38, 0.055, 0.12, 0.012, 2, { pos: [0, 1.76, 0] }),
        flange(0.2, 1.34, 10, 0.012),
        box(0.08, 0.06, 0.04, { pos: [0.18, 1.42, 0] }),
        box(0.08, 0.06, 0.04, { pos: [-0.18, 1.42, 0] }),
      ]),
      STEEL(),
    ),
    part(
      'actuators',
      merge([
        ram([0.14, 1.56, 0.22], [0.3, 0.58, 0.3]),
        ram([-0.04, 1.56, -0.24], [-0.28, 0.58, -0.28]),
      ]),
      HYD(),
    ),
    part(
      'fuel_feed',
      merge([
        curve(
          [
            [0.55, 1.92, 0.12],
            [0.58, 1.7, 0.12],
            [0.58, 1.45, 0.1],
            [PUMP_X + 0.05, PUMP_Y + 0.22, 0.05],
          ],
          0.052,
          { segments: 16, radial: 8 },
        ),
        bellows([0.55, 1.9, 0.12], [0.57, 1.78, 0.12], 4, 0.054),
        curve(
          [
            [PUMP_X, PUMP_Y - 0.22, 0],
            [0.4, 0.92, 0.14],
            [0.22, 0.98, 0.16],
          ],
          0.038,
          { segments: 12, radial: 7 },
        ),
        cylinder(0.07, 0.07, 0.055, 16, { pos: [0.55, 1.96, 0.12] }),
      ]),
      PIPE(),
    ),
    part(
      'ox_feed',
      merge([
        curve(
          [
            [-0.15, 1.96, -0.18],
            [-0.14, 1.72, -0.18],
            [-0.12, 1.4, -0.16],
            [PUMP_X - 0.56, PUMP_Y, -0.05],
          ],
          0.068,
          { segments: 16, radial: 8 },
        ),
        bellows([-0.15, 1.94, -0.18], [-0.145, 1.82, -0.18], 4, 0.07),
        curve(
          [
            [PUMP_X - 0.34, PUMP_Y - 0.26, 0],
            [0.08, 0.9, -0.18],
            [-0.02, 0.98, -0.2],
          ],
          0.042,
          { segments: 12, radial: 7 },
        ),
        cylinder(0.085, 0.085, 0.055, 16, { pos: [-0.15, 2.0, -0.18] }),
      ]),
      PIPE(),
    ),
  );

  return group;
}
