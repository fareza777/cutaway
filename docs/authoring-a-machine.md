# Authoring a machine

Extends [authoring-an-organ.md](./authoring-an-organ.md). The loop, the gates and
traps 1, 2, 3, 5, 6, 7 and 8 on that page apply here unchanged. This file covers what is
different, and it is quite a lot: a machine and an organ fail in opposite ways.

---

## Do not skin a machine

Trap 4 on the organ page — `smoothSeams()` — is the one rule that inverts. A
machine is *made of* hard edges: a stamped panel, a machined boss, a chamfer.
Welding vertices before shading rounds all of them off and a crankcase turns to
putty. Leave `part()` to do exactly what it already does.

The same goes for the noise displacement. Mottling a compressor housing does not
make it look real, it makes it look corroded. A compressor shell genuinely is a
smooth drawn-steel cylinder, and the smoothness is correct.

---

## Where machines actually fall down

Look at the two extremes already in the library, both rendered from the same
stage:

- **Turbofan** reads as a jet engine. Its identity is in its *form* — the
  nacelle profile, the fan blades, the stages behind. Smooth is fine, because a
  real nacelle is smooth.
- **Refrigerator** reads as a placeholder. Two flat dark slabs with handles. Its
  identity is not in its form at all — every fridge is a box — it is in the
  surface: the shut line between the doors, the plinth, the vent grille, the
  brand plate, the way a chamfered edge catches light along its whole length.

That is the rule. **Objects whose identity lives in their silhouette survive
being smooth. Objects whose identity lives in their surface do not.** Appliances,
consumer electronics and anything else that is fundamentally a box need surface
work before they stop looking like blocking-out geometry.

---

## The four things that sell a machine

### 1. Shut lines and panel seams

Exactly the trench technique from the organ page, with the noise term dropped.
A door gap, a seam between two pressings, a groove round a bezel — all the same
narrow recessed line, and `nearestOnCurves()` already gives you the distance
field for it:

```js
const seams = nearestOnCurves([DOOR_GAP, PLINTH_LINE], 80);
displace(panel, (x, y, z) => -0.006 * Math.exp(-((seams(x, y, z) / 0.012) ** 2)));
```

Tighter and shallower than an organ's groove: a shut line is a millimetre wide,
not a centimetre. Keep the falloff small or it reads as a dent.

### 2. Chamfered edges

A perfectly sharp edge catches no light and disappears. `roundedBox()` already
exists for this and is the single cheapest upgrade available to any appliance —
a radius of 0.01–0.02 puts a bright line along every edge under the key light.

### 3. Material differentiation

Right now most parts sit near the same roughness and read as one material. Real
appliances are three or four in one object, and the difference is legible at a
glance:

| surface | metalness | roughness |
| --- | --- | --- |
| painted steel panel | 0 | 0.45 |
| brushed stainless | 0.85 | 0.35 |
| chrome trim, handle | 1 | 0.12 |
| moulded ABS plastic | 0 | 0.6 |
| rubber gasket, belt | 0 | 0.9 |
| glass, screen | 0 | 0.05 |

### 4. Functional detail

Small repeated geometry is what reads as manufactured, and `ring()` makes it
almost free: condenser fins, vent louvres, screw bosses, stamped stiffening ribs
in a back panel, feet, a plinth. Twenty extra triangles of grille beats any
amount of shader work.

Per-vertex colour still helps here, but for a different reason than on an organ:
a very slight darkening toward the bottom of a large flat panel, or a faint
gradient across a painted door, stops a big uniform surface from looking like
untextured plastic. Keep it subtle — a few percent, not the ±50% an organ uses.

---

## Order of work

1. **Proportions and the parts breakdown first.** For a machine the teaching
   value is in what the parts are and how they fit, and that has to be right
   before anything is made to look nice.
2. **Layers.** `layer: 0` is the outer casing, and for a machine that is
   correct — peeling it is the reveal. Unlike an organ, do not open it.
3. **Chamfers**, everywhere, early. It changes the whole read.
4. **Shut lines and grilles.**
5. **Materials**, differentiated per part.
6. **Content.**

---

## Should the existing seven be redone?

They work and they are legible; nothing here is a bug. In priority order if you
want to spend the time:

1. **Refrigerator, washing machine, microwave, air conditioner** — the flat-box
   appliances, and the biggest gap between what they are and what they look
   like. Additive work, not a rebuild: chamfers, shut lines, a plinth, a grille,
   material split.
2. **Smartphone** — small, mostly a glass slab, benefits from bezel and camera
   detail.
3. **Piston engine** — decent already; would gain from bolt circles and cast
   surface roughness on the block.
4. **Turbofan** — leave it. It is the best-looking object in the library.

None of this is a rewrite. The heart needed one because its whole surface
approach was wrong; these need detail added on top of geometry that is already
correct.
