// Human heart. Apex points down (-Y), anterior faces +Z, and the model is in
// anatomical orientation — so "left ventricle" sits on the viewer's right, the
// way it does in every textbook plate and every echo.
//
// Twenty-five named parts. The conduction system and the coronary arteries are
// modelled separately from the muscle they run through, because they are the
// two things people are most often surprised to learn are there at all.
//
// What makes this read as a heart rather than as a red egg is not the part
// count. It is the grooves: the ring between atria and ventricles, and the two
// furrows running down to the apex — each sunk into the surface, filled with
// yellow fat, and carrying a vessel along the bottom. All three come from one
// description of the outer surface (SURFACE, below), so the trench, the fat and
// the artery cannot drift apart. The first version authored them by hand at the
// radius of the chambers rather than the radius of the skin, which buried every
// one of them inside the muscle where none of it was visible.

import {
  THREE, TAU, part, pbr, blob, dome, curve, torus, lathe, merge, ring, place, sphere,
  displace, paint, fbm, nearestOnCurves, srgb, smoothProfile, smoothSeams,
} from '../lib/geo.mjs';

// Deoxygenated side reads blue, oxygenated red — the convention every diagram
// uses. It is not what blood looks like, but fighting it would only confuse.
//
// The muscle is the exception. Its colour does not live in the material at all:
// the material is white and every muscular part carries a per-vertex colour, so
// one surface can be dark in the grooves, mottled across the free wall and
// yellow where the fat sits. Roughness is low because a heart out of a chest is
// wet, and that reads as a broad soft highlight against the studio environment.
const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.34, vertexColors: true });
const BLUE = () => pbr('#4a6f9c', { metalness: 0.04, roughness: 0.42 });
const RED = () => pbr('#a83038', { metalness: 0.04, roughness: 0.4 });
const VEIN = () => pbr('#5c6f96', { metalness: 0.04, roughness: 0.44 });
const VALVE = () => pbr('#e8dcc8', { metalness: 0, roughness: 0.34 });
const TENDON = () => pbr('#d8cfc0', { metalness: 0, roughness: 0.45 });
const CORONARY = () => pbr('#a32f34', { metalness: 0.06, roughness: 0.38 });
const NODE = () => pbr('#e0c452', { metalness: 0.1, roughness: 0.4, emissive: '#ffcc33', emissiveIntensity: 0.25 });
// Fibrous tissue, not metal: warm, dull, and dim enough to sit behind.
const SAC_TINT = srgb('#b9b2a8');

// -------------------------------------------------------------- the surface

const SURFACE = {
  // Radius against height, apex to base. Not a sphere and not a cone: a heart
  // is widest a third of the way up and tucks in sharply below that.
  profile: [
    [0, -1.34], [0.26, -1.25], [0.45, -1.04], [0.61, -0.72],
    [0.71, -0.34], [0.76, 0.02], [0.77, 0.2], [0.72, 0.34],
    [0.62, 0.42], [0.4, 0.46], [0, 0.47],
  ],
  centre: [-0.04, 0.02],
  /** Rings and radial segments of the built mesh. Dense, so the paint reads. */
  rings: 54,
  segments: 76,
  // Flattened front to back. A heart lies pressed between sternum and spine and
  // is not a solid of revolution; the squash is most of why the silhouette works.
  squash: 0.84,
};

const SMOOTH = smoothProfile(SURFACE.profile, SURFACE.rings);

function surfaceRadius(y) {
  const p = SMOOTH;
  if (y <= p[0][1]) return p[0][0];
  if (y >= p[p.length - 1][1]) return p[p.length - 1][0];
  for (let i = 1; i < p.length; i += 1) {
    if (y <= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return 0;
}

/** A point on the outer muscle. `angle` runs from +Z (anterior) toward +X. */
function onSurface(y, angle, out = 0) {
  const r = surfaceRadius(y) + out;
  return [SURFACE.centre[0] + r * Math.sin(angle), y, SURFACE.centre[1] + r * Math.cos(angle) * SURFACE.squash];
}

/** A path that descends the surface while swinging round it. */
function descend(fromY, toY, fromAngle, toAngle, steps = 8, out = 0) {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return onSurface(fromY + (toY - fromY) * t, fromAngle + (toAngle - fromAngle) * t, out);
  });
}

/**
 * The atrioventricular groove — the ring separating the atria above from the
 * ventricles below, and the single feature that most says "heart". It is not
 * level: it rides higher at the back than at the front.
 */
function sulcus(out = 0) {
  return Array.from({ length: 13 }, (_, i) => {
    const angle = (i / 12) * TAU;
    return onSurface(0.3 - 0.055 * Math.cos(angle), angle, out);
  });
}

const SULCUS = sulcus();
const ANTERIOR_GROOVE = descend(0.29, -1.22, 0.42, -0.06, 9);
const POSTERIOR_GROOVE = descend(0.27, -1.14, Math.PI - 0.3, Math.PI + 0.12, 8);

const nearGroove = nearestOnCurves([SULCUS, ANTERIOR_GROOVE, POSTERIOR_GROOVE], 110);

// ------------------------------------------------------------------ surfaces

const FAT = srgb('#e8d69e');
// Authored in sRGB, stored linear. A heart out of a chest is far darker and
// browner than the pink of a diagram — closer to raw liver than to a balloon.
const VENTRICLE = srgb('#8f3a33');
const VENTRICLE_L = srgb('#7d2e2b');
const ATRIUM = srgb('#7e3b40');
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Roughens a surface and sinks the grooves into it. The bumps are two octaves
 * of noise at roughly the scale of the vessels on a real epicardium — enough
 * that the silhouette stops being a clean revolve.
 */
function epicardium({ bump = 0.022, trench = 0.055 } = {}) {
  return (x, y, z) => {
    const noise = fbm(x * 4.2, y * 4.2, z * 4.2, 3) * bump + fbm(x * 9, y * 9, z * 9, 2) * bump * 0.4;
    if (!trench) return noise;
    return noise - trench * Math.exp(-((nearGroove(x, y, z) / 0.07) ** 2));
  };
}

/**
 * The colour of muscle: mottled at two scales, darkened down in the trench
 * where light does not reach, and blending into fat within a centimetre or so
 * of the groove — which on a real heart is a broad yellow ribbon, not a line.
 */
function flesh(base, { fat = 1 } = {}) {
  return (x, y, z) => {
    const broad = fbm(x * 3.2, y * 3.2, z * 3.2, 2);
    const fine = fbm(x * 13, y * 13, z * 13, 2);
    // Strong, because this is linear data: a swing that looks violent as a
    // number is a moderate change once it has been through the tone map.
    const shade = 1 + broad * 0.5 + fine * 0.22;
    const d = fat ? nearGroove(x, y, z) : 1;
    // Narrow, and never all the way to pure fat. A wider band swallowed the
    // whole upper half of the ventricles in yellow.
    const t = fat * 0.85 * Math.max(0, 1 - d / 0.075) ** 1.3;
    const dark = 1 - 0.45 * Math.max(0, 1 - d / 0.06) ** 2;
    return [
      mix(base[0] * shade * dark, FAT[0], t),
      mix(base[1] * shade * dark, FAT[1], t),
      mix(base[2] * shade * dark, FAT[2], t),
    ];
  };
}

/** Roughen, then paint. Applied to the merged part so no piece is left white. */
function skin(geometry, base, options = {}) {
  return paint(smoothSeams(displace(geometry, epicardium(options))), flesh(base, options));
}

/** Inside the chambers there are no grooves and no fat — only muscle. */
const INSIDE = { bump: 0.012, trench: 0, fat: 0 };

/** Three cusps in a ring — the shape shared by every heart valve. */
function cusps(radius, count, height, tilt = 0.5) {
  return ring(count, () =>
    place(dome(radius * 0.62, height, radius * 0.42, 18), {
      rot: [Math.PI, 0, tilt],
      pos: [radius * 0.5, 0, 0],
    }),
  );
}

export default function heart() {
  const group = new THREE.Group();

  group.add(
    // ------------------------------------------------------------- chambers
    part(
      'left_ventricle',
      skin(
        // A thick-walled cone: the chamber that does nearly all the work.
        lathe(
          [
            [0, -1.2], [0.24, -1.1], [0.42, -0.86], [0.52, -0.52],
            [0.56, -0.12], [0.55, 0.16], [0.5, 0.32], [0.44, 0.36],
            [0.34, 0.3], [0.36, 0.0], [0.34, -0.48], [0.24, -0.86], [0, -1.0],
          ],
          44,
          { pos: [0.14, 0, -0.02] },
        ),
        VENTRICLE_L,
        INSIDE,
      ),
      FLESH(),
    ),
    part(
      'right_ventricle',
      skin(
        merge([
          // Wraps around the front of the left ventricle as a crescent, which
          // is why a cross-section shows it as a thin sail rather than a circle.
          blob(0.44, 0.6, 0.4, 28, { pos: [-0.34, -0.3, 0.14] }),
          blob(0.29, 0.42, 0.28, 24, { pos: [-0.26, -0.68, 0.12] }),
          blob(0.33, 0.29, 0.29, 24, { pos: [-0.32, 0.16, 0.16] }),
        ]),
        VENTRICLE,
        INSIDE,
      ),
      FLESH(),
    ),
    part(
      'interventricular_septum',
      skin(
        merge([
          place(blob(0.09, 0.6, 0.4, 22), { rot: [0, 0, 0.12], pos: [-0.02, -0.28, 0.02] }),
          place(blob(0.07, 0.2, 0.28, 18), { pos: [-0.01, 0.28, 0.02] }),
        ]),
        VENTRICLE_L,
        INSIDE,
      ),
      FLESH(),
    ),
    part(
      'left_atrium',
      skin(
        merge([
          // Sunk into the ring so atria and ventricles read as one organ with a
          // waist, rather than as two lumps stacked on each other.
          blob(0.42, 0.32, 0.34, 44, { pos: [0.18, 0.58, -0.14] }),
          // The auricle — the little ear-shaped appendage where clots form in AF.
          place(blob(0.15, 0.11, 0.2, 20), { rot: [0, 0, -0.4], pos: [0.5, 0.52, 0.1] }),
        ]),
        ATRIUM,
        { bump: 0.026 },
      ),
      FLESH(),
    ),
    part(
      'right_atrium',
      skin(
        merge([
          blob(0.4, 0.33, 0.34, 44, { pos: [-0.4, 0.54, 0.02] }),
          place(blob(0.17, 0.13, 0.2, 20), { rot: [0, 0, 0.4], pos: [-0.66, 0.48, 0.14] }),
        ]),
        ATRIUM,
        { bump: 0.026 },
      ),
      FLESH(),
    ),
    part(
      'myocardium',
      skin(
        // The outer muscle — the surface you actually see, and so the one that
        // carries the grooves and nearly all the fat.
        lathe(SMOOTH, SURFACE.segments, {
          pos: [SURFACE.centre[0], 0, SURFACE.centre[1]],
          scale: [1, 1, SURFACE.squash],
        }),
        VENTRICLE,
        { bump: 0.036, trench: 0.055 },
      ),
      FLESH(),
    ),
    part(
      'pericardium',
      // The sac, whole — which is what a pericardium is. It encloses the heart
      // completely, and the honest way to show that is to let you see through
      // it rather than to cut it down until it stops being in the way.
      //
      // Three earlier attempts all traded anatomy for visibility and all of
      // them were wrong. Closed and opaque, it turned the heart into a smooth
      // white egg. Opened at the front, it still covered the whole back and
      // became a dark blanket the moment auto-rotate came round. Reduced to a
      // collar, it read as a helmet sitting on top of the organ — the worst of
      // the three, because by then it was also teaching something false.
      //
      // Its `opacity` in the content is what fixes it. Selecting or focusing
      // the part brings it up to where it can be read; the rest of the time it
      // is a film you look straight through.
      skin(
        lathe(
          smoothProfile(
            [
              [0.02, -1.5], [0.4, -1.4], [0.68, -1.02], [0.85, -0.5], [0.9, 0.02],
              [0.9, 0.34], [0.86, 0.62], [0.74, 0.85], [0.52, 1.0], [0.24, 1.06], [0.02, 1.08],
            ],
            40,
          ),
          64,
          { pos: [-0.05, 0.02, 0.02], scale: [1, 1, 0.88] },
        ),
        SAC_TINT,
        { bump: 0.008, trench: 0, fat: 0 },
      ),
      FLESH(),
    ),

    // --------------------------------------------------------------- valves
    part(
      'tricuspid_valve',
      merge([
        torus(0.22, 0.026, 26, 8, { rot: [Math.PI / 2, 0, 0], pos: [-0.38, 0.24, 0.06] }),
        cusps(0.22, 3, 0.18).translate(-0.38, 0.16, 0.06),
      ]),
      VALVE(),
    ),
    part(
      'mitral_valve',
      merge([
        torus(0.2, 0.026, 26, 8, { rot: [Math.PI / 2, 0, 0], pos: [0.24, 0.3, -0.06] }),
        cusps(0.2, 2, 0.2).translate(0.24, 0.22, -0.06),
      ]),
      VALVE(),
    ),
    part(
      'pulmonary_valve',
      merge([
        torus(0.15, 0.022, 22, 8, { rot: [Math.PI / 2, 0, 0], pos: [-0.3, 0.5, 0.28] }),
        cusps(0.15, 3, 0.11, -0.4).translate(-0.3, 0.54, 0.28),
      ]),
      VALVE(),
    ),
    part(
      'aortic_valve',
      merge([
        torus(0.15, 0.022, 22, 8, { rot: [Math.PI / 2, 0, 0], pos: [0.08, 0.46, 0.02] }),
        cusps(0.15, 3, 0.11, -0.4).translate(0.08, 0.5, 0.02),
      ]),
      VALVE(),
    ),
    part(
      'papillary_muscles',
      skin(
        merge([
          ...[[0.3, -0.45, 0.08], [0.06, -0.5, -0.16]].map(([x, y, z]) =>
            place(lathe([[0, 0.22], [0.07, 0.1], [0.09, -0.05], [0.05, -0.18], [0, -0.2]], 16), { pos: [x, y, z] }),
          ),
          ...[[-0.42, -0.4, 0.2], [-0.24, -0.46, 0.05]].map(([x, y, z]) =>
            place(lathe([[0, 0.18], [0.06, 0.08], [0.075, -0.04], [0.04, -0.15], [0, -0.17]], 16), { pos: [x, y, z] }),
          ),
        ]),
        VENTRICLE_L,
        INSIDE,
      ),
      FLESH(),
    ),
    part(
      'chordae_tendineae',
      merge([
        ...[[0.3, -0.25, 0.08], [0.06, -0.3, -0.16]].flatMap(([x, y, z]) =>
          [-0.09, 0, 0.09].map((dx) => curve([[x, y, z], [x + dx * 1.4, y + 0.24, z + dx * 0.6], [0.24 + dx, 0.2, -0.06 + dx * 0.4]], 0.011, { segments: 12, radial: 5 })),
        ),
        ...[[-0.42, -0.22, 0.2], [-0.24, -0.28, 0.05]].flatMap(([x, y, z]) =>
          [-0.08, 0.02, 0.1].map((dx) => curve([[x, y, z], [x + dx * 1.3, y + 0.2, z + dx * 0.5], [-0.38 + dx, 0.14, 0.06 + dx * 0.3]], 0.01, { segments: 12, radial: 5 })),
        ),
      ]),
      TENDON(),
    ),

    // ------------------------------------------------------- great vessels
    part(
      'aorta',
      merge([
        curve(
          [[0.08, 0.42, 0.02], [0.1, 0.76, 0.0], [0.02, 1.06, -0.06], [-0.28, 1.24, -0.14], [-0.56, 1.06, -0.2], [-0.6, 0.6, -0.24], [-0.58, 0.2, -0.26]],
          0.15,
          { segments: 60, radial: 18 },
        ),
        // The three branches to head and arms, off the top of the arch.
        curve([[-0.02, 1.2, -0.08], [-0.02, 1.5, -0.06]], 0.055, { segments: 10, radial: 8 }),
        curve([[-0.18, 1.26, -0.11], [-0.2, 1.54, -0.1]], 0.045, { segments: 10, radial: 8 }),
        curve([[-0.34, 1.24, -0.14], [-0.4, 1.52, -0.14]], 0.045, { segments: 10, radial: 8 }),
        // The sinuses just above the valve, where the coronaries begin.
        lathe([[0.15, 0], [0.2, 0.06], [0.2, 0.15], [0.15, 0.22]], 24, { pos: [0.08, 0.46, 0.02] }),
      ]),
      RED(),
    ),
    part(
      'pulmonary_artery',
      merge([
        curve([[-0.3, 0.46, 0.28], [-0.3, 0.82, 0.22], [-0.34, 1.06, 0.08]], 0.14, { segments: 26, radial: 16 }),
        curve([[-0.34, 1.06, 0.08], [-0.62, 1.1, 0.0], [-0.88, 1.0, -0.06]], 0.075, { segments: 22, radial: 10 }),
        curve([[-0.34, 1.06, 0.08], [-0.06, 1.12, -0.02], [0.2, 1.04, -0.12]], 0.07, { segments: 22, radial: 10 }),
      ]),
      BLUE(),
    ),
    part(
      'superior_vena_cava',
      curve([[-0.5, 0.74, 0.02], [-0.56, 1.12, 0.0], [-0.58, 1.54, -0.02]], 0.12, { segments: 22, radial: 14 }),
      BLUE(),
    ),
    part(
      'inferior_vena_cava',
      curve([[-0.44, 0.28, 0.0], [-0.5, -0.12, -0.04], [-0.52, -0.52, -0.06]], 0.12, { segments: 22, radial: 14 }),
      BLUE(),
    ),
    part(
      'pulmonary_veins',
      merge([
        ...[
          [[0.5, 0.7, -0.3], [0.86, 0.84, -0.5]],
          [[0.48, 0.54, -0.38], [0.84, 0.48, -0.6]],
          [[0.0, 0.68, -0.4], [-0.2, 0.84, -0.64]],
          [[0.02, 0.5, -0.42], [-0.22, 0.4, -0.66]],
        ].map(([a, b]) => curve([a, b], 0.055, { segments: 12, radial: 9 })),
      ]),
      RED(),
    ),
    part(
      'coronary_sinus',
      merge([
        // The great cardiac vein climbs the front groove beside the artery,
        // turns at the ring and thickens into the sinus across the back.
        curve(descend(-0.95, 0.28, 0.06, 0.56, 7, 0.03), 0.026, { segments: 30, radial: 12, taper: 1.8 }),
        curve(sulcus(0.032).slice(3, 9), 0.05, { segments: 30, radial: 14 }),
      ]),
      VEIN(),
    ),

    // --------------------------------------------------- coronary arteries
    part(
      'left_coronary_artery',
      merge([
        // Out of the left aortic sinus and straight into the ring.
        curve([[0.12, 0.44, 0.08], onSurface(0.34, 0.34, 0.03), onSurface(0.29, 0.42, 0.03)], 0.036, { segments: 16, radial: 8 }),
        // Left anterior descending — down the front groove toward the apex.
        curve(descend(0.29, -1.22, 0.42, -0.06, 9, 0.028), 0.032, { segments: 40, radial: 12, taper: 0.45 }),
        // Circumflex — round the left side of the ring into the back.
        curve(sulcus(0.028).slice(0, 7), 0.03, { segments: 34, radial: 12, taper: 0.6 }),
        // Diagonal branches, out onto the free wall of the left ventricle.
        ...[[-0.15, 0.62], [-0.5, 0.82], [-0.85, 1.0]].map(([y, spread]) =>
          curve([onSurface(y, 0.28, 0.028), onSurface(y - 0.1, spread, 0.026), onSurface(y - 0.26, spread + 0.35, 0.024)], 0.016, {
            segments: 14,
            radial: 8,
            taper: 0.4,
          }),
        ),
      ]),
      CORONARY(),
    ),
    part(
      'right_coronary_artery',
      merge([
        curve([[-0.06, 0.44, 0.1], onSurface(0.34, -0.4, 0.03), onSurface(0.27, -0.72, 0.03)], 0.034, { segments: 16, radial: 8 }),
        // Round the right side of the ring to the back.
        curve(sulcus(0.028).slice(6).reverse(), 0.03, { segments: 34, radial: 12 }),
        // Posterior descending, down the back groove.
        curve(descend(0.27, -1.14, Math.PI - 0.3, Math.PI + 0.12, 8, 0.026), 0.026, { segments: 30, radial: 10, taper: 0.5 }),
        // Marginal branches, down the right border.
        ...[[-0.1, -1.2], [-0.45, -1.35]].map(([y, spread]) =>
          curve([onSurface(y, -0.95, 0.026), onSurface(y - 0.16, spread, 0.024), onSurface(y - 0.36, spread - 0.2, 0.022)], 0.015, {
            segments: 14,
            radial: 8,
            taper: 0.4,
          }),
        ),
      ]),
      CORONARY(),
    ),

    // -------------------------------------------------- conduction system
    part(
      'sa_node',
      merge([
        place(blob(0.07, 0.05, 0.05, 16), { pos: [-0.5, 0.68, 0.06] }),
        ...[0, 1, 2].map((i) =>
          curve(
            [[-0.5, 0.66, 0.06], [-0.48 + i * 0.06, 0.54 - i * 0.04, 0.1 - i * 0.05], [-0.42 + i * 0.08, 0.4, 0.04 - i * 0.06]],
            0.012,
            { segments: 12, radial: 5 },
          ),
        ),
      ]),
      NODE(),
    ),
    part(
      'av_node',
      merge([
        place(blob(0.055, 0.045, 0.045, 16), { pos: [-0.14, 0.3, -0.06] }),
        curve([[-0.14, 0.3, -0.06], [-0.1, 0.2, -0.04], [-0.05, 0.12, -0.02]], 0.016, { segments: 10, radial: 6 }),
      ]),
      NODE(),
    ),
    part(
      'bundle_of_his',
      merge([
        curve([[-0.05, 0.12, -0.02], [-0.02, 0.02, 0.0], [-0.01, -0.08, 0.02]], 0.018, { segments: 10, radial: 6 }),
        // Left and right bundle branches, running down either face of the
        // septum and fraying into Purkinje fibres near the apex.
        curve([[-0.01, -0.08, 0.02], [0.06, -0.5, 0.02], [0.04, -0.92, 0.0]], 0.013, { segments: 22, radial: 6, taper: 0.6 }),
        curve([[-0.01, -0.08, 0.02], [-0.09, -0.5, 0.04], [-0.07, -0.9, 0.02]], 0.013, { segments: 22, radial: 6, taper: 0.6 }),
        ...[-0.16, -0.06, 0.06, 0.16].map((dx) =>
          curve([[dx > 0 ? 0.04 : -0.07, -0.9, 0.01], [dx, -1.02, 0.06], [dx * 1.5, -1.12, 0.04]], 0.008, { segments: 12, radial: 5 }),
        ),
      ]),
      NODE(),
    ),
    part(
      'apex',
      skin(
        merge([
          place(blob(0.17, 0.14, 0.15, 22), { pos: [-0.02, -1.22, 0.02] }),
          sphere(0.03, 10, { pos: [-0.02, -1.34, 0.02] }),
        ]),
        VENTRICLE_L,
        { bump: 0.014, trench: 0.03 },
      ),
      FLESH(),
    ),
  );

  // The long axis of a real heart runs down and to the left, not straight down.
  // Tilting the whole organ is what turns a symmetrical lump into something
  // that looks like it came out of a chest.
  group.rotation.z = 0.15;

  return group;
}
