// Human right eye, looking toward the viewer. Built with the optical axis along
// +Y — everything here is a solid of revolution about that axis, which is what
// an eye almost entirely is — and the whole group is tipped forward at the end
// so the pupil faces +Z.
//
// Twenty-one named parts. Two things carry the front of this model: a cornea
// you can see through, and an iris with 240 angular divisions. The body behind
// them — straps instead of hoses, a membrane instead of a wire cage, episclera
// painted on the sclera — is what stops it reading as a ping-pong ball with
// four red pipes bolted to it.
//
// The first is transparency. A cornea that is not see-through is a white cap
// over the interesting part, and no amount of shaping fixes that; the content
// gives the cornea, the lens and both humours a resting `opacity`, so you look
// straight through them at the iris and the retina behind it. This is the same
// mechanism the heart's pericardium uses, and this is the object it was really
// waiting for.
//
// The second is the iris. It is the only part of a person's anatomy they look
// at every day, so it has to be right or the whole thing reads as a toy. What
// makes a real iris is not its colour but its structure: fibres running
// radially, a raised ring about a third of the way out — the collarette —
// crypts opening between the fibres, a dark ruff at the pupil edge and a dark
// limbal ring at the outer edge. All of it is per-vertex colour and
// displacement over a disc with 240 angular divisions.

import {
  THREE, TAU, part, pbr, blob, curve, lathe, merge, place, sphere,
  displace, paint, fbm, nearestOnCurves, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

// The eyeball is a sphere of radius 1 with a smaller, steeper cornea bulging
// out of the front — the real relationship, and the reason an eye in profile
// has that slight point to it rather than being round.
const R = 1.0;
const LIMBUS_R = 0.55;
const LIMBUS_Y = Math.sqrt(R * R - LIMBUS_R * LIMBUS_R);
const CORNEA_R = 0.78;
const CORNEA_C = LIMBUS_Y - Math.sqrt(CORNEA_R * CORNEA_R - LIMBUS_R * LIMBUS_R);

const IRIS_Y = 0.64;
const IRIS_OUTER = 0.56;
const PUPIL_R = 0.17;

const SCLERA = srgb('#efe9e2');
const IRIS_INNER = srgb('#8a5216');
const IRIS_MID = srgb('#b8801f');
const IRIS_OUTER_C = srgb('#6a3f14');
const IRIS_RIM = srgb('#241708');
const CHOROID_C = srgb('#5a2f38');
const RETINA_C = srgb('#c9757a');
const MACULA_C = srgb('#a3562f');

const CLEAR = () => pbr('#f2f6f8', { metalness: 0, roughness: 0.06 });
const HUMOUR = () => pbr('#eaf2f6', { metalness: 0, roughness: 0.1 });
const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.38, vertexColors: true });
const SCLERA_MAT = () => pbr('#ffffff', { metalness: 0.02, roughness: 0.5, vertexColors: true });
const IRIS_MAT = () => pbr('#ffffff', { metalness: 0, roughness: 0.78, vertexColors: true });
const MUSCLE = () => pbr('#ffffff', { metalness: 0, roughness: 0.58, vertexColors: true });
const NERVE = () => pbr('#e6ddc9', { metalness: 0, roughness: 0.45 });
const LIMBAL = () => pbr('#3a322c', { metalness: 0, roughness: 0.45 });
const VESSEL = () => pbr('#a5313a', { metalness: 0.04, roughness: 0.4 });
const BLACK = () => pbr('#0a0708', { metalness: 0, roughness: 0.22 });

/**
 * A spherical shell between two heights, with a wall.
 *
 * Every coat of the eye — sclera, choroid, retina — is one of these. They are
 * given real thickness rather than being single-sided sheets: a sheet is
 * invisible from behind, and a tap aimed at it passes straight through, which
 * the smoke test's ray check catches.
 */
function coat(outer, thickness, fromY, toY, steps = 34) {
  const points = [];
  const at = (radius, y) => [Math.sqrt(Math.max(0, radius * radius - y * y)), y];
  for (let i = 0; i <= steps; i += 1) points.push(at(outer, fromY + ((toY - fromY) * i) / steps));
  for (let i = steps; i >= 0; i -= 1) points.push(at(outer - thickness, fromY + ((toY - fromY) * i) / steps));
  return smoothProfile(points, 60);
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const BELLY = srgb('#a8514a');
const TENDON = srgb('#d9cbb0');
const VESSEL_C = srgb('#b24a48');
const CONJ_C = srgb('#f2d8d4');

/** Point on the globe. Built looking up +Y; `a` from +X toward +Z. */
function onGlobe(y, a, out = 0) {
  const r = Math.sqrt(Math.max(0, R * R - y * y)) + out;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

/**
 * A rectus strap hugging the globe. TubeGeometry, then vertices pulled toward
 * the sphere so it reads as a flat tendon, not a hose. Never pass `taper` —
 * that stacks cylinders and they read as a ribbed garden hose.
 */
function strap(points, radius = 0.052) {
  const geometry = curve(points, radius, { segments: 36, radial: 14 });
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (y < -0.95) continue;
    const r = Math.hypot(x, y, z) || 1;
    const target = R + 0.055;
    const flattened = target + (r - target) * 0.28;
    const s = flattened / r;
    position.setXYZ(i, x * s, y * s, z * s);
  }
  position.needsUpdate = true;
  return geometry;
}

function muscleColour(x, y, z) {
  const t = THREE.MathUtils.clamp((y - 0.06) / 0.36, 0, 1);
  const shade = 1 + fbm(x * 8, y * 8, z * 8, 2) * 0.14;
  const c = mix3(BELLY, TENDON, t ** 1.4);
  return [c[0] * shade, c[1] * shade, c[2] * shade];
}

/** Episcleral trees in the palpebral fissure, derived from the globe. */
function episcleralTrees() {
  const trees = [];
  for (let i = 0; i < 8; i += 1) {
    const a0 = (i / 8) * TAU + 0.07;
    trees.push(Array.from({ length: 8 }, (_, k) => {
      const y = LIMBUS_Y - 0.05 - k * 0.11;
      return onGlobe(y, a0 + 0.14 * Math.sin(k * 0.9 + i), 0.008);
    }));
    for (const side of [-1, 1]) {
      trees.push(Array.from({ length: 5 }, (_, k) => {
        const t = k / 4;
        const y = LIMBUS_Y - 0.1 - t * 0.36;
        const a = a0 + side * (0.12 + t * 0.2) + 0.08 * Math.sin(t * 5 + i);
        return onGlobe(y, a, 0.008);
      }));
    }
  }
  return trees;
}

const EPISCLERA = episcleralTrees();
const nearEpisclera = nearestOnCurves(EPISCLERA, 24);

function scleraColour(x, y, z) {
  const grain = 1 + fbm(x * 6, y * 6, z * 6, 2) * 0.08 + fbm(x * 18, y * 18, z * 18, 2) * 0.04;
  const vessel = Math.max(0, 1 - nearEpisclera(x, y, z) / 0.034) ** 1.35;
  const base = [SCLERA[0] * grain, SCLERA[1] * grain, SCLERA[2] * grain];
  return mix3(base, VESSEL_C, Math.min(0.82, vessel));
}

function conjColour(x, y, z) {
  const vessel = Math.max(0, 1 - nearEpisclera(x, y, z) / 0.02) ** 2;
  return mix3(CONJ_C, VESSEL_C, vessel * 0.4);
}

/** Wet, faintly veined tissue. Used for every coat but the iris. */
function tissue(base, grain = 0.16) {
  return (x, y, z) => {
    const shade = 1 + fbm(x * 6, y * 6, z * 6, 2) * grain + fbm(x * 18, y * 18, z * 18, 2) * grain * 0.5;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  };
}

function skin(geometry, base, { bump = 0.006, grain = 0.16 } = {}) {
  const rough = displace(geometry, (x, y, z) => fbm(x * 7, y * 7, z * 7, 3) * bump);
  return paint(smoothSeams(rough), tissue(base, grain));
}

// -------------------------------------------------------------------- iris
//
// Angle and radius do all the work. Fibre noise is deliberately fast around the
// circle and slow along the radius, which is what makes the grain run outward
// from the pupil instead of looking like ordinary mottling.

function irisAt(x, z) {
  const r = Math.hypot(x, z);
  const a = Math.atan2(x, z);
  const t = THREE.MathUtils.clamp((r - PUPIL_R) / (IRIS_OUTER - PUPIL_R), 0, 1);
  return { r, a, t };
}

/** Radial ridges, a raised collarette, and crypts sunk between the fibres. */
function irisRelief(x, y, z) {
  const { a, t } = irisAt(x, z);
  const fibre = fbm(Math.cos(a) * 16, Math.sin(a) * 16, t * 1.6, 2);
  const crypt = fbm(Math.cos(a) * 5, Math.sin(a) * 5, t * 3.4, 2);
  const collarette = Math.exp(-(((t - 0.36) / 0.1) ** 2)) * 0.012;
  return fibre * 0.006 * (0.4 + t) + Math.min(0, crypt) * 0.014 * t + collarette;
}

function irisColour(x, y, z) {
  const { a, t } = irisAt(x, z);
  const fibre = fbm(Math.cos(a) * 15, Math.sin(a) * 15, t * 1.4, 3);
  const crypt = Math.min(0, fbm(Math.cos(a) * 5, Math.sin(a) * 5, t * 3.2, 2));

  // Amber close in, browner further out, and near-black at both edges: the
  // pupillary ruff and the limbal ring are what stop a painted disc from
  // looking like a printed sticker.
  let colour = t < 0.36 ? mix3(IRIS_INNER, IRIS_MID, t / 0.36) : mix3(IRIS_MID, IRIS_OUTER_C, (t - 0.36) / 0.64);
  const ruff = Math.max(0, 1 - t / 0.13) ** 1.4;
  const rim = Math.max(0, (t - 0.86) / 0.14) ** 1.2;
  colour = mix3(colour, IRIS_RIM, Math.min(0.95, ruff * 0.85 + rim * 0.9));

  const shade = 1 + fibre * 0.34 + crypt * 0.5;
  return [colour[0] * shade, colour[1] * shade, colour[2] * shade];
}

export default function eye() {
  const group = new THREE.Group();

  group.add(
    // ------------------------------------------------------------ the coats
    part(
      'sclera',
      // The white of the eye: dense crossed collagen, and the reason a football
      // to the face does not burst it. Episcleral trees are painted on, then a
      // few of the trunks sit proud as thin tubes so they catch light.
      paint(
        smoothSeams(
          displace(lathe(coat(R, 0.045, LIMBUS_Y, -R, 40), 96), (x, y, z) => fbm(x * 7, y * 7, z * 7, 3) * 0.003),
        ),
        scleraColour,
      ),
      SCLERA_MAT(),
    ),
    part(
      'cornea',
      // Transparent because its collagen is stacked in a lattice regular enough
      // to stop scattering light — the only tissue in the body that manages it.
      // It also does two thirds of the eye's focusing, which is why reshaping it
      // by a fraction of a millimetre corrects a lifetime of short sight.
      lathe(
        smoothProfile(
          [
            ...Array.from({ length: 24 }, (_, i) => {
              const y = LIMBUS_Y + ((CORNEA_C + CORNEA_R - LIMBUS_Y) * i) / 23;
              return [Math.sqrt(Math.max(0, CORNEA_R * CORNEA_R - (y - CORNEA_C) ** 2)), y];
            }),
            ...Array.from({ length: 24 }, (_, i) => {
              const y = CORNEA_C + CORNEA_R - 0.02 - ((CORNEA_C + CORNEA_R - 0.02 - LIMBUS_Y) * i) / 23;
              return [Math.sqrt(Math.max(0, (CORNEA_R - 0.035) ** 2 - (y - CORNEA_C) ** 2)), y];
            }),
          ],
          54,
        ),
        72,
      ),
      CLEAR(),
    ),
    part(
      'limbus',
      // The join. Also where the eye's stem cells live: burn this narrow ring
      // and the cornea loses its ability to resurface itself at all.
      place(
        new THREE.TorusGeometry(LIMBUS_R + 0.004, 0.011, 10, 80),
        { rot: [Math.PI / 2, 0, 0], pos: [0, LIMBUS_Y - 0.004, 0] },
      ),
      LIMBAL(),
    ),
    part(
      'choroid',
      // A dark, blood-rich layer between retina and sclera. It feeds the outer
      // retina and its pigment soaks up stray light, the way the inside of a
      // camera is painted matte black.
      skin(lathe(coat(R - 0.05, 0.03, 0.42, -R + 0.05), 64), CHOROID_C, { bump: 0.004, grain: 0.2 }),
      FLESH(),
    ),
    part(
      'retina',
      // The film. It is also, unexpectedly, installed backwards: light passes
      // through the wiring and the blood vessels before reaching the cells that
      // detect it. Evolution had no way to flip it later.
      skin(lathe(coat(R - 0.082, 0.026, 0.4, -R + 0.09), 64), RETINA_C, { bump: 0.004, grain: 0.18 }),
      FLESH(),
    ),

    // ------------------------------------------------------------- the iris
    part(
      'iris',
      // 240 angular divisions, because the fibres have to be resolved rather
      // than suggested.
      paint(
        smoothSeams(
          displace(
            lathe(
              smoothProfile(
                [
                  [PUPIL_R, IRIS_Y + 0.012], [0.26, IRIS_Y + 0.028], [0.4, IRIS_Y + 0.022],
                  [IRIS_OUTER, IRIS_Y], [IRIS_OUTER, IRIS_Y - 0.03],
                  [0.4, IRIS_Y - 0.012], [0.26, IRIS_Y - 0.004], [PUPIL_R, IRIS_Y - 0.014],
                ],
                26,
              ),
              240,
            ),
            irisRelief,
          ),
        ),
        irisColour,
      ),
      IRIS_MAT(),
    ),
    part(
      'pupil',
      // Not a thing but a hole. A deep well so the fundus cannot shine through
      // the aperture — the same reason a window across the street looks black
      // on a bright day.
      lathe(
        [
          [0, IRIS_Y - 0.018],
          [PUPIL_R + 0.004, IRIS_Y - 0.018],
          [PUPIL_R + 0.004, IRIS_Y - 0.12],
          [0.05, IRIS_Y - 0.2],
          [0, IRIS_Y - 0.2],
        ],
        72,
      ),
      BLACK(),
    ),

    // ------------------------------------------------- focusing and filling
    part(
      'lens',
      // Layered like an onion and completely transparent, with no blood supply
      // at all. It hardens through life, which is why reading glasses arrive in
      // everyone's forties regardless of how good their eyes ever were.
      lathe(
        smoothProfile(
          [
            [0, 0.62], [0.16, 0.605], [0.3, 0.565], [0.4, 0.5],
            [0.42, 0.44], [0.4, 0.39], [0.3, 0.33], [0.16, 0.295], [0, 0.285],
          ],
          40,
        ),
        56,
      ),
      CLEAR(),
    ),
    part(
      'ciliary_body',
      // A ring of muscle. Relaxed, it pulls the lens flat for distance; tensed,
      // it lets the lens round up for close work — the opposite way round from
      // how nearly everyone guesses.
      skin(
        lathe(
          smoothProfile([[0.62, 0.6], [0.66, 0.52], [0.64, 0.42], [0.58, 0.38], [0.56, 0.44], [0.6, 0.53]], 24),
          64,
        ),
        srgb('#8e4a42'),
        { bump: 0.006, grain: 0.2 },
      ),
      FLESH(),
    ),
    part(
      'zonules',
      // Hundreds of fine threads slung from the ciliary body to the rim of the
      // lens. They are what the muscle actually pulls on.
      merge(
        Array.from({ length: 44 }, (_, i) => {
          const a = (i / 44) * TAU;
          return curve(
            [
              [Math.cos(a) * 0.6, 0.52, Math.sin(a) * 0.6],
              [Math.cos(a) * 0.51, 0.48, Math.sin(a) * 0.51],
              [Math.cos(a) * 0.41, 0.45, Math.sin(a) * 0.41],
            ],
            0.006,
            { segments: 6, radial: 4 },
          );
        }),
      ),
      NERVE(),
    ),
    part(
      'aqueous_humour',
      // Watery fluid, made and drained continuously. Block the drain and the
      // pressure climbs — that is glaucoma, and it is painless until the damage
      // is done.
      lathe(
        smoothProfile(
          [
            [0, IRIS_Y + 0.015],
            ...Array.from({ length: 18 }, (_, i) => {
              const y = IRIS_Y + 0.015 + ((CORNEA_C + CORNEA_R - 0.05 - IRIS_Y - 0.015) * i) / 17;
              return [Math.min(LIMBUS_R - 0.02, Math.sqrt(Math.max(0, (CORNEA_R - 0.05) ** 2 - (y - CORNEA_C) ** 2))), y];
            }),
          ],
          30,
        ),
        56,
      ),
      HUMOUR(),
    ),
    part(
      'vitreous',
      // A clear gel filling four fifths of the eye, and mostly water held in a
      // mesh of collagen. It shrinks with age and peels away from the retina —
      // the floaters drifting across your vision are its debris.
      lathe(
        smoothProfile(
          Array.from({ length: 40 }, (_, i) => {
            const y = 0.36 - (1.28 * i) / 39;
            return [Math.sqrt(Math.max(0, (R - 0.12) ** 2 - y * y)), y];
          }),
          48,
        ),
        56,
      ),
      HUMOUR(),
    ),

    part(
      'sphincter_pupillae',
      // A ring of muscle right at the pupil margin. It is the one that closes
      // the pupil, and it works by simply tightening like a drawstring.
      skin(
        place(new THREE.TorusGeometry(PUPIL_R + 0.016, 0.016, 10, 90), {
          rot: [Math.PI / 2, 0, 0],
          pos: [0, IRIS_Y + 0.006, 0],
        }),
        srgb('#3a2410'),
        { bump: 0.002, grain: 0.12 },
      ),
      FLESH(),
    ),
    part(
      'canal_of_schlemm',
      // The drain, running as a ring inside the limbus. Pushed posterior and
      // painted dark so it does not flash through the cornea as a coloured gasket.
      paint(
        place(new THREE.TorusGeometry(LIMBUS_R - 0.04, 0.011, 10, 80), {
          rot: [Math.PI / 2, 0, 0],
          pos: [0, LIMBUS_Y - 0.055, 0],
        }),
        () => srgb('#3a2a28'),
      ),
      FLESH(),
    ),

    // ------------------------------------------------------ the back of it
    part(
      'macula',
      // The small patch, a couple of millimetres across, that does all your
      // detailed seeing. Everything you have ever read has passed through it.
      skin(
        place(blob(0.17, 0.05, 0.17, 30), { pos: [0.16, -0.9, 0.0] }),
        MACULA_C,
        { bump: 0.004, grain: 0.14 },
      ),
      FLESH(),
    ),
    part(
      'fovea',
      // A pit at the centre of the macula where the wiring is pushed aside so
      // light reaches the cones directly. It has no rods at all, which is why a
      // faint star vanishes when you look straight at it and returns when you
      // look slightly to one side.
      skin(place(blob(0.055, 0.03, 0.055, 22), { pos: [0.16, -0.93, 0] }), srgb('#7d3a24'), { bump: 0.002, grain: 0.1 }),
      FLESH(),
    ),
    part(
      'optic_disc',
      // Where a million nerve fibres leave together. There are no receptors
      // here at all, so there is a real hole in your visual field — you never
      // notice it because the brain fills it in with whatever is around it.
      skin(place(blob(0.11, 0.04, 0.11, 26), { pos: [-0.2, -0.9, 0] }), srgb('#e8d7a8'), { bump: 0.002, grain: 0.08 }),
      FLESH(),
    ),
    part(
      'retinal_vessels',
      // They fan out from the disc across the inner surface of the retina —
      // in front of the photoreceptors, not behind them. Constant radius: taper
      // on these would rib them into hoses.
      merge(
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU;
          const sweep = i % 2 ? 0.42 : 0.3;
          return curve(
            [
              [-0.2, -0.88, 0],
              [-0.2 + Math.cos(a) * 0.26, -0.84 + Math.sin(a) * 0.06, Math.sin(a) * 0.26],
              [-0.14 + Math.cos(a) * 0.52, -0.66 + Math.sin(a) * 0.12, Math.sin(a) * 0.52],
              [-0.1 + Math.cos(a) * (0.6 + sweep * 0.2), -0.4 + Math.sin(a) * 0.16, Math.sin(a) * (0.6 + sweep * 0.2)],
            ],
            i % 2 ? 0.01 : 0.013,
            { segments: 22, radial: 6 },
          );
        }),
      ),
      VESSEL(),
    ),
    part(
      'optic_nerve',
      // Not really a nerve but a tract of brain that grew out to meet the
      // light. It leaves at the back slightly toward the nose, which is why the
      // blind spot in your right eye sits to the right of centre.
      merge([
        curve([[-0.2, -0.94, 0], [-0.26, -1.16, 0], [-0.34, -1.52, 0]], 0.145, { segments: 16, radial: 16 }),
        place(blob(0.15, 0.06, 0.15, 24), { pos: [-0.21, -0.95, 0] }),
        sphere(0.145, 14, { pos: [-0.34, -1.52, 0] }),
      ]),
      NERVE(),
    ),
    part(
      'extraocular_muscles',
      // Six of them. Four rectus straps from the annulus of Zinn, plus the two
      // obliques — superior looping through a trochlea, inferior wrapping under.
      paint(
        merge([
          ...[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * TAU;
            return strap(
              [
                [Math.cos(a) * 0.22 - 0.06, -1.42, Math.sin(a) * 0.22],
                onGlobe(-0.9, a, 0.09),
                onGlobe(-0.38, a, 0.085),
                onGlobe(0.1, a, 0.078),
                onGlobe(0.44, a, 0.068),
              ],
              0.052,
            );
          }),
          // Superior oblique: nasal-superior to the trochlea, then posterior-temporal.
          strap(
            [
              [-0.2, -1.38, -0.18],
              onGlobe(-0.45, Math.PI + 0.25, 0.09),
              onGlobe(0.22, (5 * Math.PI) / 4, 0.11),
              onGlobe(0.52, (5 * Math.PI) / 4, 0.13),
            ],
            0.036,
          ),
          strap(
            [
              onGlobe(0.52, (5 * Math.PI) / 4, 0.13),
              onGlobe(0.12, (3 * Math.PI) / 2 + 0.35, 0.09),
              onGlobe(-0.4, 0.35, 0.08),
              onGlobe(-0.58, 0.15, 0.07),
            ],
            0.032,
          ),
          place(new THREE.TorusGeometry(0.042, 0.011, 8, 18), {
            pos: onGlobe(0.52, (5 * Math.PI) / 4, 0.13),
            rot: [0.7, 0.5, 0.2],
          }),
          // Inferior oblique: origin anterior-nasal, inserts posterior-temporal.
          strap(
            [
              onGlobe(0.48, Math.PI + 0.2, 0.08),
              onGlobe(0.12, Math.PI / 2 + 0.45, 0.1),
              onGlobe(-0.32, 0.2, 0.09),
              onGlobe(-0.55, 0.05, 0.08),
            ],
            0.038,
          ),
        ]),
        muscleColour,
      ),
      MUSCLE(),
    ),
    part(
      'conjunctiva',
      // A thin membrane over the white, not a cage of red wires. Opacity in
      // the content lets the episclera show through; tapping it still isolates it.
      paint(
        smoothSeams(lathe(coat(R + 0.026, 0.01, LIMBUS_Y - 0.025, -0.08, 28), 80)),
        conjColour,
      ),
      FLESH(),
    ),
  );

  // Built looking up the +Y axis because that is the axis a lathe turns about.
  // Tipped forward here so the pupil faces the camera.
  group.rotation.x = Math.PI / 2;

  return group;
}
