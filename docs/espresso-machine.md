# Espresso machine authoring notes

This is a generic, semi-automatic, single-boiler countertop machine, not a
branded product replica or a servicing diagram. Body proportions take their
reference from compact domestic machines. The portafilter handle, steam wand
and knob project beyond the approximate body dimensions shown in the catalog.

## Item contract

- ID: `espresso-machine`; Android-safe model: `espresso_machine`.
- 37 separately selectable teaching parts, each with one mesh and one material.
- Eight guided steps; ten questions, including three part-identification tasks.
- Complete English document and Indonesian prose overlay. English-only quiz
  answer indices and structural fields remain in the source document.
- 38,458 triangles; approximately 2.3 MiB; no image textures or remote assets.
- Transparent, hollow water tank; intact folded outer panels; a separate cup-bay
  splash panel. Use peel to reveal the pump rather than exposing electrics in
  the assembled silhouette.
- Boiler heater inside its chamber; a perforated group support, shower screen
  and basket; locking ears, sealing ring, two spouts and hollow ceramic cup.
- The sole animated mechanism is the pump's reciprocal plunger. Its small
  displacement is intentionally slowed, not a fluid or mains-frequency model.
- The 256 × 256 transparent icon is rendered from this same GLB. Its icon-only
  camera shows the handle and steam knob at a wider angle than the home view.

The pressure feed connects the pump to the bypass and boiler. The reservoir
hoses represent pickup and bypass return. The three-way brew valve has a
separate drain over the drip tray. Those routes must not be interchanged when
editing the model or translations.

## Reproduce and verify

```text
node tools/build-models.mjs espresso_machine
npm run test:espresso-machine
npm run check
node tools/review-espresso-machine.mjs
```

To regenerate only this icon, set `CUTAWAY_ICON_IDS=espresso-machine` and run
`node tools/capture-icons.mjs`. The script updates its recorded alpha bounds and
closes its own preview server and browser.

For real application UI verification:

```text
node node_modules/expo/bin/cli export --platform web --output-dir dist/espresso-web
node tools/espresso-ui-test.mjs
```

The UI test uses an isolated headless profile and localhost. It checks the new
card, model loading, run control, peel, boiler explanation, guide, quiz, and
an actual Settings language switch followed by navigation. Evidence stays in
`.shots/espresso-machine/`, which is intentionally not shipped. The baseline
0.18.0 export lacks this object and was confirmed to fail the new-card check.

Both English and Indonesian acceptance runs passed, including the actual
Settings language switch, with twelve UI screenshots and no uncaught app
errors. The source-wide `npm run check` also passed for all 29 catalog items.
These are source, engine and browser checks, not a claim of physical Android
device testing or a new signed store artifact.

The model-specific checks also protect the physical brew-stack order, heater
clearance, pump enclosure, splash-panel clearance, group-support aperture,
native texture-free rendering and valid source normals. General engine checks
cover selection, explode separation, motion, clipping and material ownership.

## Technical references

- [Gaggia Classic E24 official product information](https://www.gaggia.com/manual-machines/new-classic-e24/)
  provides a representative single-boiler control layout and explains the
  distinction between brewing, steaming and three-way pressure release.
- [Official Classic E24 manual](https://www.gaggia.com/app/uploads/2023/11/6420-010-18421-MANUAL-GAG.-CLASSIC-E24-EU-Rev-00.pdf)
  informed the familiar reservoir, cup bay, portafilter and steam-wand arrangement.

This model uses its own geometry and generic brass-boiler construction; it is
not a claim that every espresso machine has these exact internals. Real devices
contain mains electricity, hot surfaces and pressurised water. The learning
content intentionally does not give electrical connection or repair advice.

## Release scope

This change adds catalog source and assets. It does not alter app version or
versionCode, ad units, consent, billing or store listings. Android release
verifiers now expect 29 model/icon entries (58 model copies across the two
packaged resource families). An existing 28-object APK/AAB is not evidence that
this new item has been packaged; build and verify a new release when requested.
