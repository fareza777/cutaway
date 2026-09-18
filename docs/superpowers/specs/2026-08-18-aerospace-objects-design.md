# Aerospace Objects AAA Design

## Intent

Add two visually distinct, mechanically credible aerospace objects to Cutaway:

1. A complete light turboshaft helicopter that teaches the power path from intake to both rotors and the pilot-control path from the cockpit to the swashplate.
2. A compact Earth-observation satellite that teaches optical imaging, electrical power, attitude control, propulsion, and downlink as one connected spacecraft.

The objects must look like professional equipment at rest, remain legible in cutaway and exploded views, animate around real pivots, and ship with complete English and Indonesian teaching content plus unique catalog icons.

## Approved Product Direction

The helicopter and satellite are complete systems, not isolated parts. This avoids duplicating the existing `turbofan` and `rocket-engine` objects and gives the Aerospace category two silhouettes that remain recognizable at the 100 px catalog-card size.

The helicopter follows the component relationships described by the FAA Helicopter Flying Handbook: a turboshaft gas generator drives a free power turbine, reduction transmission, main rotor, and tail-rotor drive. The satellite follows NASA spacecraft-system descriptions: solar arrays and batteries power the bus and payload; star trackers sense attitude; reaction wheels point the observatory; thrusters unload momentum and trim the orbit; an antenna returns science data.

Primary references:

- FAA Helicopter Flying Handbook, Chapters 3 and 4: <https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook>
- NASA Basic Space Flight, Onboard Systems: <https://science.nasa.gov/learn/basics-of-space-flight/chapter11-2/>
- NASA OCO-2 Spacecraft: <https://ocov2.jpl.nasa.gov/observatory/spacecraft/>

## Object 1: Turboshaft Helicopter

### Catalog identity

- Content ID: `turboshaft-helicopter`
- Model ID/file stem: `turboshaft_helicopter`
- English title: `Turboshaft Helicopter`
- English subtitle: `Engine, transmission & rotor controls`
- Indonesian title: `Helikopter Turboshaft`
- Indonesian subtitle: `Mesin, transmisi, dan kendali rotor`
- Category: `Aerospace`
- Accent: `#FFB45E`
- Cut axis: `z`
- Presentation: nose toward the lower-left of the default camera, main disc readable, tail rotor visible

### Silhouette and scale

The closed object is a believable four-seat light utility helicopter: faceted teardrop cockpit, compact cabin, engine deck, tapering tail boom, skid gear, three-blade main rotor, and two-blade tail rotor. Use a consistent authored scale approximating an 11 m main-rotor diameter. The body must not resemble a toy, drone, balloon, or collection of floating primitives.

The main rotor dominates plan view without overwhelming catalog framing. The tail boom must taper continuously into a supported tail gearbox. Skids must contact a common ground plane and connect through visible cross tubes. Glazing follows the cockpit opening and remains translucent without hiding the interior.

### Stable production meshes

The production GLB contains exactly these 26 unique named meshes, each claimed exactly once by content:

1. `airframe_shell`
2. `cockpit_glazing`
3. `cabin_and_seats`
4. `landing_skids`
5. `fuel_system`
6. `avionics`
7. `engine_air_intake`
8. `compressor`
9. `combustor`
10. `gas_generator_turbine`
11. `power_turbine`
12. `exhaust`
13. `engine_output_shaft`
14. `main_transmission`
15. `rotor_mast`
16. `swashplate`
17. `pitch_links`
18. `rotor_hub`
19. `main_rotor_blades`
20. `tail_drive_shaft`
21. `tail_gearbox`
22. `tail_rotor_hub`
23. `tail_rotor_blades`
24. `cyclic_control`
25. `collective_control`
26. `control_linkages`

### Mechanical topology

- Intake, compressor, combustor, gas-generator turbine, and power turbine form one coaxial turboshaft flow path.
- The free power turbine connects through an output shaft into the main transmission.
- The transmission supports the vertical mast; the swashplate sits below the rotor hub; pitch links touch both swashplate and blade-root controls.
- Each main blade has a substantial seated root inside the hub, not a floating tip-to-tip slab.
- A continuous tail drive runs inside the boom from the main transmission to the tail gearbox.
- Tail hub and blades sit on the gearbox output at the supported end of the boom.
- Cyclic and collective controls connect to control linkages that reach the swashplate region.

### Runtime motion

Every rotating or swinging part declares an authored pivot in source-model coordinates. Motions must be finite and observable, and their pivot world position must remain invariant through the cycle.

- Compressor and gas-generator turbine share one engine axis and spin together at ratio `12`.
- Power turbine and engine output shaft share the engine axis at ratio `-8`.
- Rotor mast, rotor hub, and main rotor blades share the mast axis at ratio `1`.
- Tail drive shaft spins at ratio `-5`; tail rotor hub and blades spin on the tail gearbox axis at ratio `5`.
- Swashplate and pitch links use restrained cyclic swings rather than detaching from the mast.
- Cyclic and collective controls use finite swings that remain seated in the cockpit.

The signs teach counter-rotation/reduction relationships; they are not claims about a specific certified helicopter model.

### Content

English and Indonesian documents provide at least 7 walkthrough steps and at least 8 quiz questions. The walkthrough covers: pilot input, air compression, continuous combustion, free-turbine power extraction, reduction/main rotor, cyclic/collective pitch control, and anti-torque/tail rotor. Indonesian prose must be natural and use `mesin turboshaft`, `turbin daya bebas`, `transmisi utama`, `pelat oleng`, `langkah kolektif`, `langkah siklik`, `poros penggerak ekor`, and `rotor ekor` consistently.

## Object 2: Earth Observation Satellite

### Catalog identity

- Content ID: `earth-observation-satellite`
- Model ID/file stem: `earth_observation_satellite`
- English title: `Earth Observation Satellite`
- English subtitle: `Optics, power & attitude control`
- Indonesian title: `Satelit Observasi Bumi`
- Indonesian subtitle: `Optik, daya, dan kendali sikap`
- Category: `Aerospace`
- Accent: `#66D9FF`
- Cut axis: `z`
- Presentation: bus in three-quarter view, telescope aperture, both solar wings, and antenna readable

### Silhouette and scale

The closed object is a compact three-axis-stabilized observatory about 5 m across its deployed solar arrays. It has a rigid rectangular bus, gold-toned multi-layer insulation, two segmented blue solar wings, a nadir-pointing telescope, a high-gain dish, radiator faces, and small thruster nozzles. It must not resemble a generic cube, toy, space station, or fantasy craft.

### Stable production meshes

The production GLB contains exactly these 26 unique named meshes, each claimed exactly once by content:

1. `spacecraft_bus`
2. `thermal_blankets`
3. `structural_deck`
4. `solar_array_port`
5. `solar_array_starboard`
6. `solar_gimbal_port`
7. `solar_gimbal_starboard`
8. `battery_module`
9. `power_distribution_unit`
10. `flight_computer`
11. `telescope_baffle`
12. `primary_mirror`
13. `secondary_mirror`
14. `focal_plane`
15. `scan_mirror`
16. `reaction_wheel_roll`
17. `reaction_wheel_pitch`
18. `reaction_wheel_yaw`
19. `star_trackers`
20. `sun_sensors`
21. `propellant_tank`
22. `propellant_lines`
23. `thruster_cluster`
24. `high_gain_antenna`
25. `antenna_gimbal`
26. `radiator_panels`

### Functional topology

- Each solar wing is segmented, supported by a real hinge/gimbal at the bus, and visibly wired toward the power-distribution unit.
- Battery, power-distribution unit, flight computer, and focal plane occupy supported internal decks rather than floating in an empty box.
- Telescope baffle, primary mirror, secondary mirror, scan mirror, and focal plane share one credible optical path.
- Three reaction wheels sit near the spacecraft center of mass on orthogonal axes.
- Star trackers have unobstructed outward sight lines; sun sensors occupy external faces.
- Propellant tank connects through visible lines to a symmetric thruster cluster.
- High-gain antenna sits on a supported two-piece gimbal and clears the bus through its authored swing.
- Radiators remain external and unobstructed.

### Runtime motion

- Port and starboard solar-array/gimbal pairs rotate about their real hinge axes at ratios `0.12` and `-0.12`.
- Roll, pitch, and yaw reaction wheels spin around their respective local axes at ratios `6`, `-7`, and `8`.
- Scan mirror swings through a restrained optical scan around its physical hinge.
- High-gain antenna and its gimbal swing together through a restrained pointing arc.
- Every authored pivot is verified at runtime for invariance.

### Content

English and Indonesian documents provide at least 7 walkthrough steps and at least 8 quiz questions. The walkthrough covers: sunlight-to-electricity, eclipse battery operation, optical collection/focusing, detector/data processing, attitude determination, reaction-wheel pointing, momentum unloading/orbit trim, and antenna downlink. Indonesian prose must use `satelit observasi Bumi`, `panel surya`, `baterai`, `roda reaksi`, `pelacak bintang`, `tangki propelan`, `pendorong`, `bidang fokus`, and `antena berpenguatan tinggi` naturally.

## Shared AAA Quality Contract

### Geometry and materials

- Procedural recipes are deterministic and export the same geometry/material fingerprint as the shipped GLB.
- Helicopter budget: 55,000–120,000 triangles.
- Satellite budget: 45,000–100,000 triangles.
- No production texture dependencies; materials use PBR colour, metalness, roughness, opacity, and vertex colour where appropriate.
- Each object has at least six distinguishable material families appropriate to its construction.
- No unclaimed detail meshes, duplicate names, zero-area meshes, NaN bounds, detached primary components, gross self-intersections, or fake solid vents/windows where openings are claimed.
- Explode and cutaway states must reveal a legible mechanism without turning the assembly into unrelated floating parts.

### Visual review

For each object, inspect five standard dark renders (`app`, `front`, `close`, `left`, `behind`) plus at least one peeled/cut diagnostic. A normal render must immediately read as the intended object. The peeled view must show the complete power/optical path. Review at app exposure, not only diagnostic brightness.

### Icon and mobile UI

- Generate a unique 256×256 transparent PNG from each shipped GLB.
- Decoded alpha bounds occupy 62–88% of both canvas axes, with no edge alpha or clipping.
- Icons remain recognizable in the existing 100 px library frame.
- At 390×844 in English and Indonesian, all 28 cards have one correct unique image, readable title/subtitle/scale, and no clipping.

### Catalog and release contracts

- Registry, runtime EN/ID libraries, content validator, catalog tests, icon capture, shot manifest, model builder, release verifier, and README all agree on exactly 28 objects.
- The APK verifier expects 28 Metro GLBs plus 28 AAPT GLB resources (56 total model entries) and 28 unique decoded object icons.
- This task does not change `app.json` versioning and does not build or publish an APK unless separately requested.

## Existing Worktree Protection

At task start, 58 tracked files already contain user-owned changes, including `app.json`, all legacy content documents, `tools/models/tooth.mjs`, `assets/models/tooth.glb`, tooth renders, and `tools/shots/manifest.json`. Those bytes are outside this task except for adding the two required manifest entries to the current working manifest.

Before each scoped commit:

- stage only the task's named paths;
- do not normalize, rewrite, restore, or commit pre-existing changes;
- preserve the current working manifest's tooth settings;
- if the manifest cannot be staged without capturing its pre-existing rewrite, construct the staged manifest from the committed base plus only the two new entries while leaving the working-tree version untouched;
- compare the protected-path snapshot before and after each task.
