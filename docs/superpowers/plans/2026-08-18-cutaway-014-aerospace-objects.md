# Cutaway Aerospace Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-quality turboshaft helicopter and Earth-observation satellite as fully animated, bilingual, icon-backed Cutaway objects while expanding every catalog contract from 26 to 28.

**Architecture:** Each object is an independent deterministic Three.js procedural recipe with a focused production-GLB contract, English source document, and Indonesian prose-only overlay. A final integration task statically registers both objects, generates their model-derived icons, changes exact catalog/release cardinalities to 28, and performs visual/runtime verification without touching pre-existing user changes.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, Three.js 0.185, Node.js `.mjs`/`.mts` tooling, Playwright/Chromium visual capture, deterministic GLB/PNG generation.

**Spec:** `docs/superpowers/specs/2026-08-18-aerospace-objects-design.md`

## Global Constraints

- The exact object identities are `turboshaft-helicopter`/`turboshaft_helicopter` and `earth-observation-satellite`/`earth_observation_satellite` in category `Aerospace`.
- The helicopter GLB has exactly the 26 stable meshes listed in the spec and 55,000–120,000 triangles.
- The satellite GLB has exactly the 26 stable meshes listed in the spec and 45,000–100,000 triangles.
- Recipes are deterministic; shipped GLB geometry and material fingerprints match their recipes; production materials have no texture dependencies.
- Every rotating/swinging part has a real authored pivot whose runtime world position stays invariant.
- Each English document and Indonesian overlay has complete part parity, at least 7 walkthrough steps, and at least 8 quiz questions with aligned choices/answers.
- Normal and peeled renders must be visually inspected; recognizable silhouette, supported topology, cutaway legibility, and professional materials are release gates.
- Icons are unique 256×256 transparent model renders with 62–88% decoded alpha coverage on both axes and no edge alpha.
- Every catalog/release contract agrees on exactly 28 objects, 28 icons, and 56 packaged GLB entries.
- Do not change `app.json`, build an APK, publish, push, or modify any protected pre-existing dirty path except the two additive manifest entries.
- Use strict RED→GREEN TDD: observe each focused contract fail because its object/integration is absent before production changes.
- Subagents never dispatch subagents. Stage and commit only the exact paths owned by their task.

---

### Task 1: Production Turboshaft Helicopter

**Files:**
- Create: `tools/turboshaft-helicopter-test.mts`
- Create: `tools/models/turboshaft_helicopter.mjs`
- Create: `assets/models/turboshaft_helicopter.glb`
- Create: `content/turboshaft-helicopter.json`
- Create: `content/id/turboshaft-helicopter.json`
- Create: `tools/shots/turboshafthelicopter-dark-app.png`
- Create: `tools/shots/turboshafthelicopter-dark-front.png`
- Create: `tools/shots/turboshafthelicopter-dark-close.png`
- Create: `tools/shots/turboshafthelicopter-dark-left.png`
- Create: `tools/shots/turboshafthelicopter-dark-behind.png`
- Modify: `tools/build-models.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tools/lib/geo.mjs` geometry/material helpers, `src/engine/Assembly.ts` runtime motion, and the `ObjectDoc`/translation contracts.
- Produces: recipe export `default function turboshaftHelicopter(): THREE.Group`, build key `turboshaft_helicopter`, focused command `npm run test:turboshaft-helicopter`, English ID `turboshaft-helicopter`, and the exact 26-mesh production GLB required by Task 3.

- [ ] **Step 1: Write the focused contract before any production artifact**

Create `tools/turboshaft-helicopter-test.mts` with literal expectations for the spec's exact mesh list, material families, triangle range, mechanical adjacency, rotor clearance, ground contact, content parity, motion ratios, pivot invariance through `Assembly`, deterministic recipe fingerprint, and Indonesian terminology. Begin the contract with artifact-existence checks so the initial run fails cleanly rather than throwing.

The exact first boundary is:

```ts
const EXPECTED_MESHES = [
  'airframe_shell', 'cockpit_glazing', 'cabin_and_seats', 'landing_skids',
  'fuel_system', 'avionics', 'engine_air_intake', 'compressor', 'combustor',
  'gas_generator_turbine', 'power_turbine', 'exhaust', 'engine_output_shaft',
  'main_transmission', 'rotor_mast', 'swashplate', 'pitch_links', 'rotor_hub',
  'main_rotor_blades', 'tail_drive_shaft', 'tail_gearbox', 'tail_rotor_hub',
  'tail_rotor_blades', 'cyclic_control', 'collective_control', 'control_linkages',
].sort();

check('procedural recipe exists', existsSync(RECIPE));
check('production GLB exists', existsSync(GLB));
check('English content exists', existsSync(ENGLISH));
check('Indonesian translation exists', existsSync(INDONESIAN));
```

- [ ] **Step 2: Run the focused test and record expected RED**

Run:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/turboshaft-helicopter-test.mts
```

Expected: exit 1 with exactly the missing recipe/GLB/English/Indonesian artifacts reported. Fix test-loader errors until the failures represent missing production behavior.

- [ ] **Step 3: Build the deterministic helicopter recipe and wire its focused builder**

Implement the full geometry under the coordinate convention `+Y up`, longitudinal power/tail axis along `X`, lateral axis `Z`. Reuse focused helpers rather than duplicating large geometry blocks. Name PBR materials so the test can identify painted composite, glazing, upholstery, rubber, titanium, steel, hot-section alloy, and electronics.

Add the builder import and key:

```js
import turboshaftHelicopter from './models/turboshaft_helicopter.mjs';

// in RECIPES
turboshaft_helicopter: turboshaftHelicopter,
```

Generate only this GLB:

```powershell
npm run build:models -- turboshaft_helicopter
```

- [ ] **Step 4: Add complete English and Indonesian documents**

Write the object metadata verbatim from the spec. Claim every production mesh exactly once. Declare the exact motion relationships from the spec and authored pivots measured from the recipe. Provide at least 7 complete walkthrough steps and 8 mechanism questions. The Indonesian file is a prose-only overlay with exact metadata/part/step/quiz parity and no structural fields.

- [ ] **Step 5: Drive the focused contract GREEN and iterate defects test-first**

Run the focused command after each change. If a render reveals a floating blade, unsupported gearbox, hidden power path, toy silhouette, or pivot drift, first add a geometry-derived regression that fails on the shipped GLB, then fix the recipe and rebuild.

Final focused gate:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/turboshaft-helicopter-test.mts
node tools/validate-content.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/smoke-test.mts
```

Expected: all helicopter checks pass; validator and smoke pass with 27 objects. Catalog may remain RED only for the intentionally deferred registry/icon/cardinality work in Task 3.

- [ ] **Step 6: Capture and inspect five standard views plus peeled diagnostics**

Start `tools/preview-server.mjs` on an available loopback port using an exact owned PID. Capture the five standard views at normal app exposure. Create temporary peeled/cut diagnostics in the task workspace, inspect them, and remove only those exact diagnostics after review. Stop the exact preview PID and verify the port is free.

Acceptance: normal views immediately read as a professional light helicopter; glazing and cabin are coherent; rotor roots seat in the hub; tail boom/gearbox/skids are supported; peeled view exposes the complete engine→transmission→main/tail rotor and control→swashplate paths.

- [ ] **Step 7: Register the focused script, verify the protected diff, and commit**

Add only:

```json
"test:turboshaft-helicopter": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/turboshaft-helicopter-test.mts"
```

Do not add it to the aggregate `check` command until Task 3. Compare protected-path hashes/status with the baseline. Stage only the files named in this task and commit:

```powershell
git commit -m "Add AAA turboshaft helicopter"
```

---

### Task 2: Production Earth Observation Satellite

**Files:**
- Create: `tools/earth-observation-satellite-test.mts`
- Create: `tools/models/earth_observation_satellite.mjs`
- Create: `assets/models/earth_observation_satellite.glb`
- Create: `content/earth-observation-satellite.json`
- Create: `content/id/earth-observation-satellite.json`
- Create: `tools/shots/earthobservationsatellite-dark-app.png`
- Create: `tools/shots/earthobservationsatellite-dark-front.png`
- Create: `tools/shots/earthobservationsatellite-dark-close.png`
- Create: `tools/shots/earthobservationsatellite-dark-left.png`
- Create: `tools/shots/earthobservationsatellite-dark-behind.png`
- Modify: `tools/build-models.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1's builder/script pattern plus the existing geometry, content, translation, and runtime-motion contracts.
- Produces: recipe export `default function earthObservationSatellite(): THREE.Group`, build key `earth_observation_satellite`, focused command `npm run test:earth-observation-satellite`, English ID `earth-observation-satellite`, and the exact 26-mesh production GLB required by Task 3.

- [ ] **Step 1: Write the focused contract before production artifacts**

Create `tools/earth-observation-satellite-test.mts` with the same real-GLB/deterministic/runtime structure as Task 1 but satellite-specific literal expectations: exact mesh list, 45,000–100,000 triangles, supported/deployed array geometry, hinge contact and clearance, connected optical path, orthogonal reaction wheels near the bus center, propellant-line continuity, external sensor sight lines, antenna clearance, material families, content parity, motion ratios, and Indonesian terminology.

The exact mesh boundary is:

```ts
const EXPECTED_MESHES = [
  'spacecraft_bus', 'thermal_blankets', 'structural_deck', 'solar_array_port',
  'solar_array_starboard', 'solar_gimbal_port', 'solar_gimbal_starboard',
  'battery_module', 'power_distribution_unit', 'flight_computer',
  'telescope_baffle', 'primary_mirror', 'secondary_mirror', 'focal_plane',
  'scan_mirror', 'reaction_wheel_roll', 'reaction_wheel_pitch',
  'reaction_wheel_yaw', 'star_trackers', 'sun_sensors', 'propellant_tank',
  'propellant_lines', 'thruster_cluster', 'high_gain_antenna',
  'antenna_gimbal', 'radiator_panels',
].sort();
```

- [ ] **Step 2: Run the focused test and record expected RED**

Run:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/earth-observation-satellite-test.mts
```

Expected: exit 1 for the four absent artifacts, without unrelated loader errors.

- [ ] **Step 3: Build the deterministic satellite recipe and wire the builder**

Use `+Y up`, solar wings primarily along `X`, and a nadir telescope readable in the default three-quarter pose. Construct segmented solar cells geometrically, restrained MLI folds/ridges, supported internal decks, real gimbal journals, mirror mounts, propellant plumbing, and nozzle throats. Avoid surface noise that aliases at mobile scale.

Add:

```js
import earthObservationSatellite from './models/earth_observation_satellite.mjs';

// in RECIPES
earth_observation_satellite: earthObservationSatellite,
```

Generate only this GLB:

```powershell
npm run build:models -- earth_observation_satellite
```

- [ ] **Step 4: Add complete English and Indonesian documents**

Use the spec's exact identity and motion ratios. Group each solar panel with its gimbal only when one authored pivot correctly drives both nodes; keep each reaction wheel independently animated on its own axis. Provide at least 7 walkthrough steps and 8 questions. Preserve answer indexes exactly in the Indonesian overlay.

- [ ] **Step 5: Drive focused tests GREEN and iterate visual defects test-first**

For every discovered mechanical/visual defect, add a production-GLB regression before correcting the recipe. Final focused gate:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/earth-observation-satellite-test.mts
node tools/validate-content.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/smoke-test.mts
```

Expected: all satellite checks pass; validator and smoke pass with 28 objects. Catalog may remain RED only for Task 3's deferred registration/icons/cardinality.

- [ ] **Step 6: Capture and inspect five standard views plus peeled diagnostics**

Use an exact owned preview PID and bounded capture. Acceptance: closed views read as one flight-ready observatory with supported wings, clear aperture, dish, MLI bus, and thrusters; peeled views expose sunlight→PDU→battery/payload, telescope→focal plane, sensor→computer→reaction wheels, and tank→lines→thrusters. Inspect icon-scale silhouette before freezing geometry.

- [ ] **Step 7: Register the focused script, verify protected paths, and commit**

Add only:

```json
"test:earth-observation-satellite": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/earth-observation-satellite-test.mts"
```

Do not modify the aggregate check yet. Stage only Task 2 paths and commit:

```powershell
git commit -m "Add AAA Earth observation satellite"
```

---

### Task 3: Catalog, Icons, Runtime, and Release Contract Integration

**Files:**
- Create: `assets/object-icons/turboshaft-helicopter.png`
- Create: `assets/object-icons/earth-observation-satellite.png`
- Modify: `src/content/registry.ts`
- Modify: `tools/shots/manifest.json` (two additive entries only in the staged commit)
- Modify: `tools/object-icon-metrics.json`
- Modify: `tools/capture-icons.mjs`
- Modify: `tools/catalog-quality-test.mts`
- Modify: `tools/verify-apk.mjs`
- Modify: `tools/verify-apk-test.mjs`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: both reviewed GLBs/docs/tests from Tasks 1–2.
- Produces: exact 28-entry EN/ID runtime libraries, exact 28-icon and metrics sets, exact 28/28 packaged-model verifier expectations, aggregate source gates, 390 px visual evidence, and a clean integration commit.

- [ ] **Step 1: Strengthen exact-28 contracts and observe RED**

Change only test expectations first. Replace catalog/runtime/icon uniqueness cardinalities from 26 to 28 and add verifier mutation fixtures that require 28+28/56 rather than 26+26/52. Keep expectations literal so an accidentally omitted object fails. Add per-object assertions through the existing tuple-bound static and runtime checks.

Run:

```powershell
npm run test:catalog
npm run test:verify-apk
```

Expected: catalog exits 1 for absent registry/icon/metrics entries; the new verifier fixture fails against production code that still accepts the prior 26-object cardinality. Fix fixture/setup errors until both failures represent missing exact-28 behavior.

- [ ] **Step 2: Register both object tuples and model presentation settings**

Add static `require` rows to `src/content/registry.ts` for each English doc, GLB, PNG, and Indonesian overlay. Add shot-manifest entries:

```json
"turboshaft_helicopter": {
  "restRotation": [0.08, -0.5, 0],
  "opacity": { "cockpit_glazing": 0.24 }
},
"earth_observation_satellite": {
  "restRotation": [0.2, -0.62, 0.04],
  "opacity": {}
}
```

Tune rotations only through reviewed captures. Preserve the working manifest's pre-existing tooth entry. For the commit, stage only the two additive manifest objects relative to the committed base; do not capture its unrelated format/tooth diff.

- [ ] **Step 3: Update capture/release tooling and aggregate checks**

Set icon capture to exact 28 inputs and place this task's contact sheet under its SDD workspace. Update `verify-apk.mjs` messages/cardinality so it requires 28 source models, 28 source icons, 28 exact Metro model files, 28 exact AAPT model resources, 56 total GLB entries, and 28 unique decoded icons. Update README numeric claims.

Add both focused tests to `npm run check` after the existing four model contracts:

```json
"check": "npm run typecheck && npm run validate && npm run smoke && npm run test:rice-cooker && npm run test:mechanical-watch && npm run test:cordless-drill && npm run test:cyclonic-vacuum && npm run test:turboshaft-helicopter && npm run test:earth-observation-satellite && npm run test:catalog && npm run test:build-apk"
```

- [ ] **Step 4: Generate deterministic icons and inspect the 28-object contact sheet**

Run the real capture pipeline. It must own and stop its preview PID. Confirm the existing 26 decoded PNG payloads remain byte-identical unless a reviewed framing change is explicitly required. Iterate only the two new manifest rotations/rolls until both new icons occupy 62–88% on each axis, contain no edge alpha, read correctly at 100 px, and remain visually distinct from turbofan/rocket-engine.

- [ ] **Step 5: Drive catalog and focused localization GREEN**

Run:

```powershell
npm run test:catalog
npm run test:localization
npm run validate
npm run typecheck
```

Expected: exact 28 documents/models/translations/icons/metrics, unique decoded pixels, clean tuple-bound runtime EN/ID mappings, and no unexpected English leakage.

- [ ] **Step 6: Perform 390×844 EN/ID runtime and motion review**

Run the app web preview on an exact owned loopback PID. At 390×844 verify 28 cards, 28 correct images, no title/subtitle/scale clipping, and natural Indonesian wrapping. Open both new objects, set explode near 78%, use a flipped `z` cut near 63%, disable auto-rotate, and confirm Run/Pause yields distinct canvas hashes for each object's motion. Save evidence in the ignored task workspace, visually inspect it, stop the exact PID, and verify the port is empty.

- [ ] **Step 7: Run the complete source matrix and protected-path audit**

Run:

```powershell
npm run build:models -- turboshaft_helicopter earth_observation_satellite
npm run check
git diff --check
```

Then verify: both focused GLB fingerprints still match; exactly 28 source GLBs/icons/content/ID overlays exist; exact new files are present; protected baseline paths other than the working manifest are byte/status identical to the initial snapshot; no preview listeners or scoped Node processes remain.

- [ ] **Step 8: Commit only integration paths**

Inspect the staged diff and use `git diff --cached --check`. Commit:

```powershell
git commit -m "Integrate aerospace objects into the catalog"
```

Do not stage `app.json`, legacy content, tooth assets/recipe/renders, or unrelated manifest changes.
