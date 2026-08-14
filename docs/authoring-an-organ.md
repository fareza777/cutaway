# Authoring an organ

How to add a body part to Cutaway at the quality of `tools/models/heart.mjs`.
Read this before writing geometry; every trap below cost a rebuild to find.

Machines follow a different visual logic — see
[authoring-a-machine.md](./authoring-a-machine.md), which extends this file.

---

## The loop

The single most important thing on this page: **look at the model every round.**

```bash
npm run build:models          # writes assets/models/<name>.glb
npm run preview               # serves the repo on :5179
```

Then open `http://localhost:5179/?model=kidney`. It renders with the app's exact
stage — same environment bake, same five lights, same intensities — so what you
see is what the phone shows. `window.capture()` from the console renders each
view and writes PNGs into `tools/shots/` if you would rather look at files.

The heart took six rounds of look-and-fix. Its three worst defects — the grooves
buried inside the muscle, a hard crease down the front, the outer sac hiding the
whole organ — were all invisible in the source and obvious in the first render.

**`npm run check` cannot see.** It proves every part resolves to a mesh, that
mesh names match the JSON, that a ray through each part's centre hits geometry,
and that exploding and collapsing are exact. All structural. Nothing in it knows
whether your object looks like a kidney. A model can pass every gate and still
be a smooth pink blob.

---

## Eight traps

### 1. Derive surface features from the surface

Never hand-write coordinates for a groove, a vessel or a ridge. Describe the
outer shape once, then ask it where things go:

```js
const SURFACE = {
  profile: [[0, -1.34], [0.45, -1.04], [0.76, 0.02], [0.62, 0.42], [0, 0.47]],
  centre: [-0.04, 0.02],
  squash: 0.84,          // flattened front to back
  rings: 54,
};
const SMOOTH = smoothProfile(SURFACE.profile, SURFACE.rings);

function onSurface(y, angle, out = 0) {
  const r = surfaceRadius(y) + out;
  return [
    SURFACE.centre[0] + r * Math.sin(angle),
    y,
    SURFACE.centre[1] + r * Math.cos(angle) * SURFACE.squash,
  ];
}
```

The heart's first version authored its grooves by hand at the radius of the
chambers instead of the radius of the skin. Every furrow, every patch of fat and
every coronary artery ended up a couple of centimetres under the surface, where
none of it was visible. Deriving them means the trench, the fat and the vessel
that lies in it cannot drift apart.

### 2. `COLOR_0` is linear data

There are no image textures anywhere in this app — React Native has no
`createImageBitmap`, so a `.glb` referencing one will not load at all. Surface
variation comes from per-vertex colour, which does survive glTF intact.

But glTF vertex colour is *linear*, and every colour a person picks is sRGB.
Write the sRGB numbers straight in and `#8f3a33` arrives on screen as a pale
salmon. Always go through `srgb()`:

```js
const VENTRICLE = srgb('#8f3a33');   // -> [0.27, 0.044, 0.034]
```

The material that carries painted geometry should be white, with
`vertexColors: true` — the colour lives entirely in the attribute:

```js
const FLESH = () => pbr('#ffffff', { metalness: 0, roughness: 0.34, vertexColors: true });
```

### 3. Vertex density is what resolves the detail

Per-vertex colour and per-vertex displacement can only show what the mesh has
vertices for. A groove carved into a ten-ring lathe comes out as a thin dark
line rather than a furrow, and mottling averages away to nothing.

A painted surface wants an order of magnitude more rings than it needs to look
round — the heart uses `smoothProfile(profile, 54)` and 76 radial segments.
Cheap: the heart is 50k triangles and the render budget is fill-rate bound, not
vertex bound.

### 4. Call `smoothSeams()` on organic surfaces

`part()` recomputes normals on a non-indexed mesh, which throws away the seam
normals `LatheGeometry` had already got right: two coincident vertices with no
index in common each average only their own side's faces. On a machined part
that is invisible. On an organ it draws a hard crease straight down the front
and the two halves read as flat panels hinged together.

```js
function skin(geometry, base, options = {}) {
  return paint(smoothSeams(displace(geometry, epicardium(options))), flesh(base, options));
}
```

Opt-in, because welding also rounds off every deliberate hard edge — do not do
this to a box.

### 5. An enclosing membrane needs a resting opacity, not surgery

The outermost layer is the first thing anyone sees, and a membrane or capsule is
almost always the outermost layer. The heart's pericardium took four goes, and
the first three were all the same mistake — trading anatomy for visibility:

1. **Closed and opaque.** The whole organ opened as a smooth white egg.
2. **Opened at the front.** Fixed the opening view and only that view. It still
   covered the entire back, so the moment auto-rotate turned the heart round it
   became a dark blanket with the organ hidden behind it.
3. **Cut down to a collar.** Read as a helmet sitting on top of the heart — the
   worst of the three, because by then it was also teaching something false. A
   pericardium encloses the heart completely; a cap on top is not a simplification
   of that, it is a different thing.
4. **Whole, with `opacity: 0.15` in the content.** Correct anatomy, hides
   nothing, and tapping it brings it up to `ATTENTION` so it can still be read.

The rule: **if a part genuinely encloses everything else, give it a resting
opacity. Do not reshape it until it is out of the way.** Cutting geometry to
solve a rendering problem produces a model that is wrong about the body, and
that is a worse failure than one that is merely ugly.

`opacity` scales every other visibility rule rather than replacing them, so a
see-through part still ghosts, still peels and still vanishes under isolate. The
kidney's capsule takes the same treatment for the same reason.

### 6. A vertex-colour material with no colour attribute renders white

`FLESH()` is `pbr('#ffffff', { vertexColors: true })` — the colour lives
entirely in the mesh's `COLOR_0`. Hand a part that material without running it
through `skin()` and it comes out pure white. On the lungs this turned the
apices into two golf balls sitting on top of the organ, and nothing in the
build or in `npm run check` noticed.

**If a part uses the painted material, it must be painted.** No exceptions.

### 7. Grown structures have to be grown *inside* something

A bronchial tree authored by recursion looks far better than one placed tube by
tube — the rule that built it is the same rule at every scale, which is what a
real tree looks like. But recursion in world space wanders wherever the maths
takes it, and the first lung had branches and vessels sticking out through the
front of the organ.

This is trap 1 wearing different clothes. Anything grown or swept has to be
clamped to the body it belongs in — push each sample back inside the surface
before building geometry from it, the way `inside()` does for the kidney.

### 8. Check the view the app actually opens on

Two things move a model between the `.glb` and the phone: `restRotation` from
the content JSON, and the explorer's default orbit (`theta -0.6, phi 1.32`).
`tools/preview.html` applies both, and its `app` view is that camera. Its other
views are for inspection.

This was not always true, and the cost was exactly the trap above: the
pericardium looked like a thin rim in the preview and covered the whole front on
the phone, because the preview was rendering an untransformed model from a
camera angle that existed nowhere in the app. **Check the `app` view and the
`behind` view before believing anything.**

---

## The surfacing pair

Two functions do nearly all the work. Both take a position and return a number
or a colour; `displace()` and `paint()` apply them.

```js
/** Roughen, and sink the grooves in. */
function epicardium({ bump = 0.022, trench = 0.055 } = {}) {
  return (x, y, z) => {
    const noise = fbm(x * 4.2, y * 4.2, z * 4.2, 3) * bump
                + fbm(x * 9, y * 9, z * 9, 2) * bump * 0.4;
    if (!trench) return noise;
    return noise - trench * Math.exp(-((nearGroove(x, y, z) / 0.07) ** 2));
  };
}

/** Mottle at two scales, darken in the trench, blend to fat beside it. */
function flesh(base, { fat = 1 } = {}) {
  return (x, y, z) => {
    const shade = 1 + fbm(x * 3.2, y * 3.2, z * 3.2, 2) * 0.5
                    + fbm(x * 13, y * 13, z * 13, 2) * 0.22;
    const d = fat ? nearGroove(x, y, z) : 1;
    const t = fat * 0.85 * Math.max(0, 1 - d / 0.075) ** 1.3;
    const dark = 1 - 0.45 * Math.max(0, 1 - d / 0.06) ** 2;
    return [/* mix(base * shade * dark, FAT, t) per channel */];
  };
}
```

`nearGroove` comes from `nearestOnCurves(curves, samples)` — brute force, a few
hundred milliseconds at build time, and worth not writing a spatial index for.

Numbers that took tuning on the heart, as starting points:

| what | value | what happens if you overshoot |
| --- | --- | --- |
| `bump` | 0.026–0.036 | silhouette turns lumpy and noisy |
| `trench` depth | 0.05 | the furrow becomes a gash |
| trench falloff | 0.07 | a wide soft dent instead of a groove |
| fat falloff | 0.075 | yellow swallows the whole upper half |
| broad mottle | 0.5 | looks like camouflage |

Mottle strengths look violent as numbers because this is linear data — a swing
that reads as 50% becomes a moderate change once it is through the tone map.

---

## Order of work

1. **Silhouette first.** Profile, squash, tilt. Build only the outer surface and
   look at it. If it does not read as the organ in grey, no amount of colour
   will save it.
2. **The one feature that names it.** A heart is grooves; a kidney is the hilum
   notch and the cortex/medulla layering; a lung is the fissures and the
   branching. Get it in before any detail.
3. **Inner parts**, coarse. They are only seen peeled or cut, so they can be
   cheaper — `INSIDE = { bump: 0.012, trench: 0, fat: 0 }`.
4. **Vessels and fine structure**, on curves derived from the surface.
5. **Colour**, last. Tune with the render open.
6. **Content** — `content/<id>.json`. Mesh names are the contract; `npm run
   validate` reads them straight out of the GLB's JSON chunk and will tell you
   about a typo.

---

## What a part costs

Roughly, per organ: a 250–400 line recipe, three to six look-and-fix rounds, and
about 3,000 words of prose for 20–25 parts, five steps and six to eight quiz
questions. The prose is the bottleneck, not the geometry.

## Accuracy, honestly

The heart is structurally correct — what exists, where it sits, what connects to
what, which way blood moves, where the conduction system runs. Its proportions
are eyeballed. There is no scan data behind any of it and no medical review.
Hold new organs to the same standard and describe the app as a visual learning
tool rather than a medical reference.
