// Lower molar, in its socket. Crown up (+Y), two roots down, and the whole
// thing built as nested shells about that axis — which is what a tooth is.
//
// Nine named parts. Three things had to be true for this to read as a tooth
// rather than as a mushroom, and the first version got all three wrong.
//
// The crown has to be a solid cap with cusps. Enamel modelled as an open shell
// let you see straight down into the hollow, and a crown with no cusps and no
// fissures is not a molar, it is a thimble. The cusps here are displacement on
// a lathe: four lobes raised, the grooves between them sunk, which is the same
// trench technique the heart uses for its coronary sulcus.
//
// The gum has to hug the neck. A ring floating around the tooth reads as a
// lifebuoy; real gingiva grips the enamel a millimetre or so above the cervical
// line and tapers away into the bone.
//
// And the bone has to be see-through. It encloses the roots completely, so
// opaque bone hides the half of the tooth nobody has ever seen — the same rule
// the heart's pericardium taught, and the reason `opacity` exists in the
// content schema.

import {
  THREE, TAU, part, pbr, blob, curve, lathe, merge, place, sphere,
  displace, paint, fbm, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

const ENAMEL_C = srgb('#f4f1e7');
const DENTIN_C = srgb('#e2c98f');
const CEMENTUM_C = srgb('#d8c6a2');
const GUM_C = srgb('#c4676b');
const BONE_C = srgb('#e9e0c8');

const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.34, vertexColors: true });
const ENAMEL_MAT = () => pbr('#ffffff', { metalness: 0.02, roughness: 0.16, vertexColors: true });
const PULP = () => pbr('#c2454e', { metalness: 0, roughness: 0.42 });
const LIGAMENT = () => pbr('#e0a898', { metalness: 0, roughness: 0.55 });
const NERVE = () => pbr('#efe6c8', { metalness: 0, roughness: 0.4 });
const VESSEL = () => pbr('#a5313a', { metalness: 0.04, roughness: 0.4 });

// The cervical line — the neck, where crown becomes root and where the gum
// grips. Every profile here is measured from it.
const NECK = 0.0;
const NECK_R = 0.4;

/** Outer surface of the crown, from the neck up to the biting surface. */
const CROWN = [
  [NECK_R, NECK], [0.47, 0.09], [0.505, 0.21], [0.5, 0.34],
  [0.46, 0.45], [0.37, 0.52], [0.22, 0.555], [0, 0.56],
];

/** Same surface, moved inward — the dentin core under the enamel. */
function inset(profile, amount) {
  return profile.map(([r, y]) => [Math.max(0, r - amount * Math.min(1, Math.max(0, (y - NECK) / 0.18))), y]);
}

/**
 * Four cusps and the fissures between them.
 *
 * Only bites above the widest part of the crown, and squared with the fourth
 * power so the lobes stay distinct instead of turning the top into a gentle
 * wave. Without this the crown is a thimble.
 */
function cuspRelief(x, y, z) {
  if (y < 0.26) return 0;
  const t = THREE.MathUtils.clamp((y - 0.26) / 0.3, 0, 1);
  const a = Math.atan2(z, x);
  const lobes = Math.cos(4 * a - 0.4);
  const grain = fbm(x * 12, y * 12, z * 12, 2) * 0.004;
  return t * t * lobes * 0.052 + grain;
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/**
 * Enamel is not one flat white. It is thin and slightly grey where it meets the
 * gum, thickest and warmest over the cusps, and stained a little down in the
 * fissures — which is exactly where decay starts.
 */
function enamelColour(x, y, z) {
  const t = THREE.MathUtils.clamp((y - NECK) / 0.5, 0, 1);
  const grain = 1 + fbm(x * 9, y * 9, z * 9, 2) * 0.05 + fbm(x * 26, y * 26, z * 26, 2) * 0.03;
  const a = Math.atan2(z, x);
  const fissure = Math.max(0, -Math.cos(4 * a - 0.4)) * Math.max(0, (y - 0.36) / 0.2);
  const base = mix3(srgb('#dcd9d2'), ENAMEL_C, t ** 0.7);
  return mix3(base, srgb('#b8a785'), Math.min(0.5, fissure * 0.6)).map((c) => c * grain);
}

function tissue(base, grain = 0.14) {
  return (x, y, z) => {
    const shade = 1 + fbm(x * 8, y * 8, z * 8, 2) * grain + fbm(x * 22, y * 22, z * 22, 2) * grain * 0.5;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  };
}

function skin(geometry, base, { bump = 0.004, grain = 0.14 } = {}) {
  const rough = displace(geometry, (x, y, z) => fbm(x * 10, y * 10, z * 10, 3) * bump);
  return paint(smoothSeams(rough), tissue(base, grain));
}

// Two roots, splayed the way a lower molar's are: mesial forward, distal back.
const ROOTS = [
  { at: 0.2, lean: 0.1 },
  { at: -0.2, lean: -0.12 },
];

/** One root as a tapered, slightly curved cone. `scale` fattens it for shells. */
function root({ at, lean }, scale = 1, radius = 0.19) {
  return curve(
    [
      [at, NECK + 0.04, 0],
      [at * 1.2, -0.34, lean * 0.5],
      [at * 1.5, -0.74, lean],
      [at * 1.72, -1.16, lean * 1.3],
    ],
    radius * scale,
    { segments: 22, radial: 26, taper: 0.2 },
  );
}

export default function tooth() {
  const group = new THREE.Group();

  group.add(
    part(
      'enamel',
      // A solid cap, not a shell. It stops at the neck: enamel covers the crown
      // and nothing below it, which is why the join at the gum line is the most
      // vulnerable spot on the whole tooth.
      paint(
        smoothSeams(
          displace(
            lathe(smoothProfile([[NECK_R, NECK - 0.01], ...CROWN], 46), 96, { scale: [1, 1, 0.9] }),
            cuspRelief,
          ),
        ),
        enamelColour,
      ),
      ENAMEL_MAT(),
    ),
    part(
      'dentin',
      // The bulk of the tooth, and unlike enamel it is alive — threaded with
      // microscopic tubes running out from the pulp. That is why a chip that
      // reaches dentin is suddenly sensitive to cold, and why the tooth can lay
      // down more of it as a defence when decay approaches.
      skin(
        merge([
          lathe(smoothProfile(inset(CROWN, 0.1), 44), 72, { scale: [1, 1, 0.9] }),
          ...ROOTS.map((r) => root(r, 1, 0.205)),
        ]),
        DENTIN_C,
        { bump: 0.003, grain: 0.12 },
      ),
      FLESH(),
    ),
    part(
      'pulp',
      // The only soft tissue in the tooth: nerves and vessels in a chamber that
      // sends a horn up under each cusp and a canal down each root. It is
      // sealed in a rigid box, so when it swells it has nowhere to go — which is
      // the whole reason toothache is the kind of pain it is.
      merge([
        place(blob(0.16, 0.13, 0.14, 26), { pos: [0, 0.26, 0] }),
        ...[0.4, 2.0, 3.6, 5.2].map((a) =>
          curve(
            [
              [Math.cos(a) * 0.05, 0.28, Math.sin(a) * 0.05],
              [Math.cos(a) * 0.16, 0.38, Math.sin(a) * 0.14],
              [Math.cos(a) * 0.2, 0.44, Math.sin(a) * 0.17],
            ],
            0.045,
            { segments: 8, radial: 10, taper: 0.35 },
          ),
        ),
        ...ROOTS.map((r) => root(r, 1, 0.05)),
      ]),
      PULP(),
    ),
    part(
      'cementum',
      // A thin bony coat over the root — the surface the ligament actually
      // anchors into. Unlike enamel it is soft enough to be worn away, which is
      // what exposes a root and makes it ache on cold drinks.
      skin(
        merge(
          ROOTS.map((r) =>
            merge([root(r, 1.07, 0.205)]).translate(0, 0, 0),
          ),
        ),
        CEMENTUM_C,
        { bump: 0.003, grain: 0.1 },
      ),
      FLESH(),
    ),
    part(
      'periodontal_ligament',
      // A tooth is not cemented into the jaw. It is slung there on thousands of
      // tiny fibres running from cementum to bone, so it can move a fraction of
      // a millimetre under load — a suspension, not a fixing. Braces work by
      // making the bone remodel around a tooth held under gentle tension.
      merge(ROOTS.map((r) => root(r, 1.15, 0.205))),
      LIGAMENT(),
    ),
    part(
      'alveolar_bone',
      // The socket. It surrounds the roots completely, so it is drawn
      // see-through; tap it and it comes up solid. This bone exists only to
      // hold teeth — lose the tooth and the ridge melts away within a year.
      skin(
        lathe(
          smoothProfile(
            [
              [0.78, 0.04], [0.8, -0.1], [0.82, -0.4], [0.8, -0.8], [0.7, -1.1], [0.5, -1.26], [0, -1.3],
              [0, -1.24], [0.45, -1.2], [0.62, -1.04], [0.7, -0.78], [0.72, -0.4], [0.7, -0.1], [0.68, 0.04],
            ],
            48,
          ),
          64,
          { scale: [1, 1, 0.82] },
        ),
        BONE_C,
        { bump: 0.006, grain: 0.16 },
      ),
      FLESH(),
    ),
    part(
      'gingiva',
      // A tight collar, not a ring floating round the tooth. It grips the
      // enamel just above the cervical line and tapers into the bone below, and
      // the shallow crevice at its edge is where a toothbrush is aimed.
      skin(
        lathe(
          smoothProfile(
            [
              [0.43, 0.14], [0.475, 0.08], [0.515, -0.02], [0.55, -0.16], [0.575, -0.3],
              [0.545, -0.32], [0.5, -0.18], [0.465, -0.04], [0.435, 0.06], [0.415, 0.12],
            ],
            40,
          ),
          64,
          { scale: [1, 1, 0.88] },
        ),
        GUM_C,
        { bump: 0.006, grain: 0.18 },
      ),
      FLESH(),
    ),
    part(
      'nerves',
      // They enter through a hole at the tip of each root barely wider than a
      // pencil lead. Dentine has no way of telling one insult from another, so
      // heat, cold, pressure and decay all arrive as the same signal: pain.
      merge(
        ROOTS.map(({ at, lean }) =>
          curve(
            [
              [at * 1.85, -1.2, lean * 1.5],
              [at * 1.7, -1.0, lean * 1.25],
              [at * 1.3, -0.5, lean * 0.6],
              [at * 0.6, 0.06, 0],
              [0, 0.24, 0],
            ],
            0.026,
            { segments: 26, radial: 8, taper: 0.7 },
          ),
        ),
      ),
      NERVE(),
    ),
    part(
      'vessels',
      // A tooth has its own artery and vein, threaded up the same canals. Cut
      // that supply — a knock to the front teeth will do it — and the tooth
      // slowly darkens from the inside over the following months.
      merge(
        ROOTS.map(({ at, lean }) =>
          curve(
            [
              [at * 1.85 + 0.03, -1.22, lean * 1.5 + 0.03],
              [at * 1.7 + 0.03, -1.02, lean * 1.25 + 0.02],
              [at * 1.3 + 0.02, -0.52, lean * 0.6],
              [at * 0.62 + 0.02, 0.04, 0.02],
              [0.02, 0.22, 0.02],
            ],
            0.02,
            { segments: 26, radial: 8, taper: 0.7 },
          ),
        ),
      ),
      VESSEL(),
    ),
  );

  return group;
}
