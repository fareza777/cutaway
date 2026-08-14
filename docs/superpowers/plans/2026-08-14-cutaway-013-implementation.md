# Cutaway 0.13 Catalog, Localization, and Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Cutaway 0.13.0 with three realistic new objects, complete natural Indonesian localization for all 26 objects, unique model-derived catalog icons, and a new production-ready app icon.

**Architecture:** Keep English JSON as structural truth and require complete Indonesian prose overlays at the static registry boundary. Generate each catalog icon from its shipped GLB through an icon mode in the existing browser preview, while keeping app branding in the deterministic brand builder after a generated concept is selected. New objects follow the existing procedural recipe → GLB → content → registry pipeline and each adds a production-GLB quality contract.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, Three.js 0.185, Zustand, Node.js build tools, Playwright/Chrome capture, PNG assets, Android Gradle.

**Spec:** `docs/superpowers/specs/2026-08-14-catalog-localization-branding-design.md`

## Global Constraints

- Release version is `0.13.0`; Android version code is `17`.
- Final catalog contains exactly 26 registered objects.
- Every object requires an English document, production GLB, unique PNG icon, and complete Indonesian overlay.
- Translation files contain prose only and never alter IDs, mesh names, focus arrays, motion, or quiz answer indices.
- Catalog icons are derived from shipped GLBs, contain no text, and are `256×256` PNGs with alpha.
- New GLBs must be deterministic, texture-free, Android-safe, and remain within 100,000 triangles per object.
- Final APK targets `arm64-v8a`, includes all 26 current GLBs/icons, and must pass signature and embedded-asset verification.

---

### Task 1: Enforce Complete Localization and Icon Contracts

**Files:**
- Create: `tools/catalog-quality-test.mts`
- Create: `tools/object-icon-metrics.json` (generated later by Task 6)
- Modify: `tools/validate-content.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: English documents under `content/*.json`, Indonesian overlays under `content/id/*.json`, and registered entries in `src/content/registry.ts`.
- Produces: `npm run test:catalog` and strict validation failures for incomplete Indonesian coverage or missing icons.

- [ ] **Step 1: Write the failing catalog contract**

Create a test that enumerates the English documents and asserts a one-to-one Indonesian file set, then checks every required overlay field:

```ts
const english = readdirSync(CONTENT).filter((name) => name.endsWith('.json')).sort();
const indonesian = readdirSync(resolve(CONTENT, 'id')).filter((name) => name.endsWith('.json')).sort();
check('every object has Indonesian content', JSON.stringify(indonesian) === JSON.stringify(english));

for (const file of english) {
  const base = readJson(resolve(CONTENT, file));
  const overlay = readJson(resolve(CONTENT, 'id', file));
  check(`${base.id} metadata translated`, Boolean(overlay.title && overlay.subtitle && overlay.summary));
  check(`${base.id} scale translated`, !base.scale || Boolean(overlay.scale));
  check(`${base.id} parts complete`, base.parts.every((part) => {
    const value = overlay.parts?.[part.id];
    return Boolean(value?.name && value?.short && value?.detail);
  }));
  check(`${base.id} steps complete`, overlay.steps?.length === base.steps.length && overlay.steps.every((step) => step.title && step.body));
  check(`${base.id} quiz complete`, overlay.quiz?.length === base.quiz.length && overlay.quiz.every((item) => item.prompt));
}
```

Parse `src/content/registry.ts` text and assert each known ID has both an icon require and an Indonesian translation require. Inspect every PNG header and decoded dimensions/alpha using the existing PNG helper or a focused reader.

- [ ] **Step 2: Run the contract and confirm the expected failure**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/catalog-quality-test.mts`

Expected: FAIL listing the eight missing current overlays and all missing `assets/object-icons/*.png` registrations.

- [ ] **Step 3: Tighten the validator and register the script**

Change translation incompleteness in `tools/validate-content.mjs` from warnings to errors. Validate top-level fields, every part field, exact step/quiz length, translated choice counts, and required explanations when the English question has one.

Add:

```json
"test:catalog": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/catalog-quality-test.mts"
```

Append `npm run test:catalog` to `npm run check`.

- [ ] **Step 4: Re-run to preserve the red state for missing deliverables**

Run: `npm run test:catalog`

Expected: FAIL only for content/icons not implemented by later tasks, not for test crashes or false positives.

- [ ] **Step 5: Commit the contract**

```bash
git add package.json tools/catalog-quality-test.mts tools/validate-content.mjs
git commit -m "Enforce complete catalog localization"
```

### Task 2: Add the Automatic Mechanical Watch

**Files:**
- Create: `tools/mechanical-watch-test.mts`
- Create: `tools/models/mechanical_watch.mjs`
- Create: `content/mechanical-watch.json`
- Create: `content/id/mechanical-watch.json`
- Create: `assets/models/mechanical_watch.glb` (generated)
- Modify: `tools/build-models.mjs`
- Modify: `tools/shots/manifest.json`

**Interfaces:**
- Produces model ID `mechanical_watch` and content ID `mechanical-watch` with these stable meshes:

```ts
const expectedMeshes = [
  'case', 'bezel', 'crystal', 'caseback', 'crown', 'winding_stem',
  'dial', 'hour_hand', 'minute_hand', 'seconds_hand', 'automatic_rotor',
  'mainspring_barrel', 'centre_wheel', 'third_wheel', 'fourth_wheel',
  'escape_wheel', 'pallet_fork', 'balance_wheel', 'hairspring',
  'movement_bridges', 'jewels', 'strap_lugs',
];
```

- [ ] **Step 1: Write the failing watch quality contract**

Assert all files exist, the production GLB matches the exact mesh list, the case is round and shallow, the dial/crystal are above the movement, the rotor sits behind it, the balance and escape wheel are adjacent, materials include glass/steel/brass/ruby/leather or rubber, triangle count is 18,000–100,000, and content has at least six steps and eight quiz items.

- [ ] **Step 2: Run the watch contract and confirm failure**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/mechanical-watch-test.mts`

Expected: FAIL because the recipe, GLB, and content do not yet exist.

- [ ] **Step 3: Implement the procedural recipe**

Build a conventional 40 mm round automatic watch around the Y axis. Use shallow tubes for case/bezel/crystal, stacked discs for dial/movement, toothed low-profile gears in the XY plane, a crescent automatic rotor behind the bridges, a coiled mainspring/hairspring made from curves, and paired strap lugs. Use physically plausible metalness/roughness values and keep the outer shell closed at rest.

- [ ] **Step 4: Write English and Indonesian teaching content**

Explain energy storage, automatic winding, gear ratios, escapement impulses, balance regulation, hand ratios, jewels, and setting through the crown. Indonesian terminology uses `pegas utama`, `roda pelepas`, `garpu palet`, `roda keseimbangan`, and `roda gigi` consistently.

- [ ] **Step 5: Generate, validate, and visually review**

Run:

```bash
npm run build:models -- mechanical_watch
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/mechanical-watch-test.mts
npm run preview
node tools/capture.mjs mechanical_watch
```

Inspect app/front/left/behind/close renders. Iterate the recipe until the closed watch is recognizable, the case does not look like stacked toy discs, and the movement reads through peel/cut states.

- [ ] **Step 6: Commit the watch**

```bash
git add assets/models/mechanical_watch.glb content/mechanical-watch.json content/id/mechanical-watch.json tools/mechanical-watch-test.mts tools/models/mechanical_watch.mjs tools/build-models.mjs tools/shots/manifest.json tools/shots/mechanicalwatch-dark-*.png
git commit -m "Add automatic mechanical watch"
```

### Task 3: Add the Cordless Drill

**Files:**
- Create: `tools/cordless-drill-test.mts`
- Create: `tools/models/cordless_drill.mjs`
- Create: `content/cordless-drill.json`
- Create: `content/id/cordless-drill.json`
- Create: `assets/models/cordless_drill.glb` (generated)
- Modify: `tools/build-models.mjs`
- Modify: `tools/shots/manifest.json`

**Interfaces:**
- Produces model ID `cordless_drill` and content ID `cordless-drill` with stable meshes:

```ts
const expectedMeshes = [
  'left_housing', 'right_housing', 'rubber_grip', 'trigger', 'direction_switch',
  'speed_selector', 'motor_stator', 'motor_rotor', 'cooling_fan',
  'planetary_gearbox', 'torque_clutch', 'output_spindle', 'chuck_body',
  'chuck_jaws', 'work_light', 'battery_shell', 'battery_cells',
  'battery_management_board', 'contacts',
];
```

- [ ] **Step 1: Write and run the failing drill quality contract**

Assert a pistol-grip silhouette, chuck aligned with motor and gearbox, battery below the grip, trigger in front of the handle, three distinct material families, production GLB parity, 12,000–80,000 triangles, six walkthrough steps, and at least eight questions.

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/cordless-drill-test.mts`

Expected: FAIL for absent files.

- [ ] **Step 2: Implement recipe and complete bilingual content**

Use rounded housing panels with panel seams and screws, a cylindrical brushless motor, two visibly different planetary stages, an adjustable clutch ring, three-jaw chuck, realistic battery-cell grid, and restrained molded-rubber texture. Animate rotor/fan/spindle spin and make the trigger control explanation distinguish electronic speed control from a simple power switch.

- [ ] **Step 3: Generate, test, and iterate standard renders**

Run `npm run build:models -- cordless_drill`, the drill contract, `npm run validate`, and five-view capture. Fix any toy-like proportions, oversized chuck, implausible grip/battery alignment, shell occlusion, or material ambiguity.

- [ ] **Step 4: Commit the drill**

```bash
git add assets/models/cordless_drill.glb content/cordless-drill.json content/id/cordless-drill.json tools/cordless-drill-test.mts tools/models/cordless_drill.mjs tools/build-models.mjs tools/shots/manifest.json tools/shots/cordlessdrill-dark-*.png
git commit -m "Add realistic cordless drill"
```

### Task 4: Add the Cyclonic Vacuum Cleaner

**Files:**
- Create: `tools/cyclonic-vacuum-test.mts`
- Create: `tools/models/cyclonic_vacuum.mjs`
- Create: `content/cyclonic-vacuum.json`
- Create: `content/id/cyclonic-vacuum.json`
- Create: `assets/models/cyclonic_vacuum.glb` (generated)
- Modify: `tools/build-models.mjs`
- Modify: `tools/shots/manifest.json`

**Interfaces:**
- Produces model ID `cyclonic_vacuum` and content ID `cyclonic-vacuum` with stable meshes:

```ts
const expectedMeshes = [
  'outer_body', 'carry_handle', 'hose_inlet', 'dust_bin', 'cyclone_cone',
  'cyclone_shroud', 'bin_seal', 'pre_motor_filter', 'motor_stator',
  'motor_rotor', 'impeller', 'motor_mount', 'exhaust_filter', 'exhaust_vent',
  'cord_reel', 'power_control', 'main_wheels', 'caster_wheel',
];
```

- [ ] **Step 1: Write and run the failing vacuum quality contract**

Assert a low canister silhouette, hose inlet leading tangentially into the bin/cyclone, filters on both sides of the motor, impeller coaxial with the rotor, grounded wheels, transparent-bin material without texture dependencies, production parity, 12,000–80,000 triangles, and complete bilingual teaching content.

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/cyclonic-vacuum-test.mts`

Expected: FAIL for absent files.

- [ ] **Step 2: Implement recipe and bilingual content**

Model a familiar wheeled bagless canister with a removable clear bin, conical vortex chamber, perforated shroud, pleated filters, motor/impeller, cord reel, controls, and seals. Explain pressure difference accurately: the fan accelerates air and maintains lower static pressure at the inlet; it does not “create suction” as a material.

- [ ] **Step 3: Generate, test, and visually iterate**

Run the model build, vacuum contract, full validator, and five-view capture. Fix any kettle-like silhouette, opaque dust path, floating wheels, filters that do not intersect the airflow path, or hidden motor/impeller relationship.

- [ ] **Step 4: Commit the vacuum**

```bash
git add assets/models/cyclonic_vacuum.glb content/cyclonic-vacuum.json content/id/cyclonic-vacuum.json tools/cyclonic-vacuum-test.mts tools/models/cyclonic_vacuum.mjs tools/build-models.mjs tools/shots/manifest.json tools/shots/cyclonicvacuum-dark-*.png
git commit -m "Add cyclonic vacuum cleaner"
```

### Task 5: Rewrite Indonesian Content for the Existing 23 Objects

**Files:**
- Create missing overlays: `content/id/air-conditioner.json`, `content/id/kidney.json`, `content/id/lung.json`, `content/id/microwave.json`, `content/id/piston-engine.json`, `content/id/smartphone.json`, `content/id/turbofan.json`, `content/id/washing-machine.json`
- Rewrite: all 15 existing files under `content/id/*.json`
- Modify: `src/content/registry.ts`
- Modify: `src/i18n/strings.ts`

**Interfaces:**
- Consumes every field from the 23 existing English documents.
- Produces complete overlays that satisfy Task 1 and a registry where every entry requires its Indonesian file.

- [ ] **Step 1: Rewrite the UI dictionary**

Review every Indonesian value in `src/i18n/strings.ts`. Keep concise established labels such as `Pengaturan`, `Kuis`, `Bagian`, and `Rontgen`; improve awkward onboarding, accessibility, result, and destructive-action sentences. Preserve all placeholders exactly.

- [ ] **Step 2: Rewrite appliances and electronics**

Complete and rewrite: air conditioner, refrigerator, washing machine, microwave, rice cooker, smartphone, camera, hard disk, loudspeaker, and electric motor. Replace literal metaphors and English sentence rhythm with direct explanations while preserving technical meaning.

- [ ] **Step 3: Rewrite mechanical, aerospace, music, and anatomy groups**

Complete and rewrite: piston engine, differential, lock, turbofan, rocket engine, violin, heart, kidney, lung, eye, brain, inner ear, and tooth. Use common Indonesian anatomical terms, retain a parenthetical technical term only when it improves recognition, and keep quiz choice order unchanged.

- [ ] **Step 4: Register every overlay and run strict coverage**

Add `translations: { id: require('../../content/id/<id>.json') }` to every registry entry.

Run:

```bash
npm run validate
npm run test:catalog
npm run typecheck
```

Expected: translation coverage passes; icon checks remain the only catalog failures until Task 6.

- [ ] **Step 5: Audit English leakage and commit**

Search Indonesian files for repeated English sentences, untranslated quiz choices, malformed punctuation, literal `it/its` pronoun patterns, and inconsistent terms. Review the full refrigerator overlay manually.

```bash
git add content/id src/content/registry.ts src/i18n/strings.ts
git commit -m "Complete Indonesian localization"
```

### Task 6: Generate and Integrate 26 Model-Derived Catalog Icons

**Files:**
- Create: `tools/capture-icons.mjs`
- Modify: `tools/preview.html`
- Create: `assets/object-icons/*.png` (26 generated files)
- Modify: `src/content/registry.ts`
- Modify: `src/content/types.ts`
- Modify: `app/index.tsx`
- Delete after replacement: `src/ui/ObjectGlyph.tsx`

**Interfaces:**
- Produces `LibraryItem = ObjectSummary & { icon: number }` from `getLibrary(locale)`.
- Consumes query parameter `icon=1` in the preview page and a browser function `window.captureIcon()`.

- [ ] **Step 1: Add icon mode and capture script**

In icon mode, create an alpha-enabled square renderer, hide the HUD, clear with alpha zero, and keep the same environment/lights and app orbit. `tools/capture-icons.mjs` launches Chrome once, visits every manifest model, and invokes `captureIcon`. The page draws the WebGL canvas into a transparent `256×256` offscreen canvas, measures the alpha bounds, posts the PNG, and returns the bounds. The script writes all measurements to `tools/object-icon-metrics.json` so the catalog contract can enforce 62–88% subject coverage without adding an image-decoder dependency.

- [ ] **Step 2: Generate all 26 icons**

Run:

```bash
npm run preview
node tools/capture-icons.mjs
```

Expected: one non-empty alpha PNG per content ID under `assets/object-icons/`.

- [ ] **Step 3: Integrate static icon modules**

Update the registry entry type:

```ts
type Entry = {
  doc: ObjectDoc;
  model: number;
  icon: number;
  translations: Translations;
};

export type LibraryItem = ObjectSummary & { icon: number };
```

Return `{ ...summarise(resolve(entry, locale)), icon: entry.icon }` from `getLibrary`. Replace `ObjectGlyph` with a React Native `Image` using `resizeMode="contain"`, object-specific accessibility text, and the existing accent frame.

- [ ] **Step 4: Run automated and visual icon review**

Run `npm run test:catalog`, create a contact sheet from all 26 icons, and inspect it. Re-capture individual icons whose subject coverage falls outside 62–88%, clips a protruding part, faces backwards, or is materially darker/brighter than neighbors.

- [ ] **Step 5: Commit the icon system**

```bash
git add app/index.tsx assets/object-icons src/content/registry.ts src/content/types.ts tools/capture-icons.mjs tools/preview.html
git rm src/ui/ObjectGlyph.tsx
git commit -m "Add unique catalog icons"
```

### Task 7: Replace the Application Icon and Brand Variants

**Files:**
- Create: `tools/brand/cutaway-mark-concept.png`
- Modify: `tools/build-brand.mjs`
- Modify generated: `assets/icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `assets/splash-icon.png`, `assets/favicon.png`

**Interfaces:**
- Produces all paths already referenced by `app.json`; no runtime code changes.

- [ ] **Step 1: Generate one focused app-mark concept**

Use built-in image generation with this production prompt:

```text
Use case: logo-brand
Asset type: mobile application icon concept
Primary request: an original compact isometric object with one corner cleanly removed, revealing three nested mechanical layers and a warm glowing core; it must communicate opening an object to understand how it works
Style/medium: minimal vector-friendly brand mark, flat geometric surfaces, strong silhouette
Composition/framing: one centered mark with generous safe margin, no container mockup
Color palette: near-black navy, cool porcelain, restrained steel blue, warm orange, tiny coral core
Constraints: no text, no letters, no circle/pie-chart silhouette, no camera shutter, no gradients, no fine lines, no trademark resemblance, no watermark
```

Inspect at full size and 48 px. Make only single-change iterations if the silhouette reads as a cube logo, pie chart, or random gem rather than a cutaway object.

- [ ] **Step 2: Encode the selected mark deterministically**

Extend the brand builder with filled convex polygons and layered isometric faces. Derive the adaptive foreground and monochrome alpha mask from the same geometry, preserving the safe middle two-thirds. Keep generated concept art as a design reference, not as an unrepeatable production dependency.

- [ ] **Step 3: Build and validate all brand outputs**

Run `npm run build:brand`. Assert exact dimensions, alpha/opacity expectations, transparent adaptive corners, monochrome single-color pixels, and foreground occupancy inside Android's safe zone. Create a contact sheet containing 1024, round mask, squircle mask, and 48 px previews.

- [ ] **Step 4: Commit branding**

```bash
git add assets/icon.png assets/android-icon-background.png assets/android-icon-foreground.png assets/android-icon-monochrome.png assets/splash-icon.png assets/favicon.png tools/brand/cutaway-mark-concept.png tools/build-brand.mjs
git commit -m "Refresh Cutaway app identity"
```

### Task 8: Release Integration and Verification

**Files:**
- Modify: `app.json`
- Modify: `android/app/build.gradle` (local generated native project; set `versionName "0.13.0"` and `versionCode 17`)
- Modify: `package.json` if individual model tests need aggregation
- Create: `dist/cutaway-0.13.0-arm64.apk` (ignored artifact)

**Interfaces:**
- Consumes all prior tasks.
- Produces the verified release APK and final pushed branch/PR update.

- [ ] **Step 1: Wire all quality contracts into `npm run check`**

Ensure the command runs typecheck, validator, engine smoke, catalog contract, rice-cooker contract, watch contract, drill contract, and vacuum contract.

- [ ] **Step 2: Update release metadata**

Set Expo version to `0.13.0` and Android version code to `17`. Keep package ID `com.cutaway.explorer` and the existing icon asset paths.

- [ ] **Step 3: Run complete source verification**

Run:

```bash
npm run build:models
npm run build:brand
npm run check
git diff --check
```

Expected: 26 valid objects, complete Indonesian coverage, 26 valid icons, all production-GLB contracts passing, and no rice-cooker/new-object smoke warnings.

- [ ] **Step 4: Build and verify the ARM64 APK**

Perform the validated native build flow, then run:

```bash
node tools/verify-apk.mjs dist/cutaway-0.13.0-arm64.apk
apksigner verify dist/cutaway-0.13.0-arm64.apk
```

Inspect package/version with `aapt2`, verify the only native ABI is `arm64-v8a`, and confirm all 26 icons are present by archive hash or resource listing.

- [ ] **Step 5: Final app review**

Open the library in English and Indonesian. Verify all 26 titles/subtitles/scales change cleanly, long Indonesian strings do not clip, every icon is unique, the new objects open and animate, and launcher/splash icons render correctly under round and squircle masks.

- [ ] **Step 6: Commit release metadata and publish**

```bash
git add app.json package.json
git commit -m "Prepare Cutaway 0.13.0"
git push
```

Verify the remote branch head equals local HEAD and update the existing pull-request description with the expanded release scope and test evidence.
