import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipeFile = resolve(ROOT, 'tools/models/cordless_drill.mjs');
const modelFile = resolve(ROOT, 'assets/models/cordless_drill.glb');
const contentFile = resolve(ROOT, 'content/cordless-drill.json');
const translationFile = resolve(ROOT, 'content/id/cordless-drill.json');

const expectedMeshes = [
  'left_housing', 'right_housing', 'rubber_grip', 'trigger', 'direction_switch',
  'speed_selector', 'motor_stator', 'motor_rotor', 'cooling_fan',
  'planetary_gearbox', 'torque_clutch', 'output_spindle', 'chuck_body',
  'chuck_jaws', 'work_light', 'battery_shell', 'battery_cells',
  'battery_management_board', 'contacts',
].sort();

let failures = 0;
const check = (label: string, condition: boolean, detail = '') => {
  if (condition) return console.log(`  ✓ ${label}`);
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);
const centre = (object: THREE.Object3D) => bounds(object).getCenter(new THREE.Vector3());
const size = (object: THREE.Object3D) => bounds(object).getSize(new THREE.Vector3());
const triangleCount = (meshes: THREE.Mesh[]) => meshes.reduce((sum, mesh) => {
  const index = mesh.geometry.getIndex();
  return sum + (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
}, 0);

const fingerprint = (mesh: THREE.Mesh) => {
  const hash = createHash('sha256');
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const material = mesh.material as THREE.MeshStandardMaterial;
  hash.update(mesh.name);
  hash.update(Array.from(position.array as ArrayLike<number>, (value) => Number(value).toFixed(6)).join(','));
  hash.update(index ? Array.from(index.array as ArrayLike<number>, Number).join(',') : 'non-indexed');
  hash.update([
    material.name,
    material.color.getHexString(),
    material.metalness.toFixed(4),
    material.roughness.toFixed(4),
    material.opacity.toFixed(4),
    material.transparent ? 'transparent' : 'opaque',
    material.vertexColors ? 'vertex-colours' : 'uniform-colour',
  ].join(':'));
  return hash.digest('hex');
};

function collectMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

function intervalOverlap(a: THREE.Box3, b: THREE.Box3, axis: 'x' | 'y' | 'z') {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function radialExtentInSlab(mesh: THREE.Mesh, sampleX: number, halfWidth: number, cy: number, cz: number) {
  const position = mesh.geometry.getAttribute('position');
  let extent = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getX(index) - sampleX) > halfWidth) continue;
    extent = Math.max(extent, Math.hypot(position.getY(index) - cy, position.getZ(index) - cz));
  }
  return extent;
}

const angleDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

type ComponentStats = {
  box: THREE.Box3;
  vertexCount: number;
  points: THREE.Vector3[];
};

function geometryComponents(mesh: THREE.Mesh): ComponentStats[] {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const parent = Array.from({ length: position.count }, (_, value) => value);
  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ar = find(a);
    const br = find(b);
    if (ar !== br) parent[br] = ar;
  };
  const indices = index ? Array.from(index.array as ArrayLike<number>, Number) : Array.from({ length: position.count }, (_, value) => value);
  for (let offset = 0; offset < indices.length; offset += 3) {
    union(indices[offset], indices[offset + 1]);
    union(indices[offset], indices[offset + 2]);
  }
  // glTF preserves hard-edge vertices separately because their normals differ.
  // Connectivity is geometric, so weld coincident positions for this analysis
  // without mutating the production geometry under test.
  const coincident = new Map<string, number>();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const key = `${position.getX(vertex).toFixed(4)},${position.getY(vertex).toFixed(4)},${position.getZ(vertex).toFixed(4)}`;
    const existing = coincident.get(key);
    if (existing === undefined) coincident.set(key, vertex);
    else union(existing, vertex);
  }
  const components = new Map<number, ComponentStats>();
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const root = find(vertex);
    let stats = components.get(root);
    if (!stats) {
      stats = { box: new THREE.Box3(), vertexCount: 0, points: [] };
      components.set(root, stats);
    }
    point.fromBufferAttribute(position, vertex);
    stats.box.expandByPoint(point);
    stats.vertexCount += 1;
    stats.points.push(point.clone());
  }
  return [...components.values()].filter((component) => component.vertexCount >= 4);
}

const componentSize = (component: ComponentStats) => component.box.getSize(new THREE.Vector3());
const componentCentre = (component: ComponentStats) => component.box.getCenter(new THREE.Vector3());

function boxesOverlap3D(a: THREE.Box3, b: THREE.Box3, tolerance = 0) {
  return intervalOverlap(a, b, 'x') >= -tolerance
    && intervalOverlap(a, b, 'y') >= -tolerance
    && intervalOverlap(a, b, 'z') >= -tolerance;
}

function minimumRadialVertexDistance(a: ComponentStats, b: ComponentStats, limit: number) {
  let closest = Number.POSITIVE_INFINITY;
  for (const ap of a.points) {
    for (const bp of b.points) {
      const distance = Math.hypot(ap.y - bp.y, ap.z - bp.z);
      if (distance < closest) closest = distance;
      if (closest <= limit) return closest;
    }
  }
  return closest;
}

function pinContactsPlanet(pin: ComponentStats, planet: ComponentStats) {
  const pinPoint = componentCentre(pin);
  const planetPoint = componentCentre(planet);
  return Math.hypot(pinPoint.y - planetPoint.y, pinPoint.z - planetPoint.z) <= 0.012
    && intervalOverlap(pin.box, planet.box, 'x') >= 0.04
    && intervalOverlap(pin.box, planet.box, 'y') >= 0.03
    && intervalOverlap(pin.box, planet.box, 'z') >= 0.03;
}

function pinContactsCarrier(pin: ComponentStats, carrier: ComponentStats) {
  return intervalOverlap(pin.box, carrier.box, 'x') >= 0.008
    && minimumRadialVertexDistance(pin, carrier, 0.012) <= 0.012;
}

function linkContactsCarrier(link: ComponentStats, carrier: ComponentStats, cy: number, cz: number) {
  const linkPoint = componentCentre(link);
  return intervalOverlap(link.box, carrier.box, 'x') >= 0.008
    && Math.hypot(linkPoint.y - cy, linkPoint.z - cz) <= 0.015
    && carrier.box.min.y < cy && carrier.box.max.y > cy
    && carrier.box.min.z < cz && carrier.box.max.z > cz;
}

function translatedComponent(component: ComponentStats, translation: THREE.Vector3): ComponentStats {
  return {
    box: component.box.clone().translate(translation),
    vertexCount: component.vertexCount,
    points: component.points.map((point) => point.clone().add(translation)),
  };
}

async function run() {
  console.log('\nCordless drill quality contract');

  const hasRecipe = existsSync(recipeFile);
  const hasModel = existsSync(modelFile);
  const hasContent = existsSync(contentFile);
  const hasTranslation = existsSync(translationFile);
  check('procedural recipe exists', hasRecipe);
  check('production GLB exists', hasModel);
  check('English content exists', hasContent);
  check('Indonesian translation exists', hasTranslation);
  if (!hasRecipe || !hasModel || !hasContent || !hasTranslation) {
    console.error('\nCordless drill feature is incomplete.');
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(contentFile, 'utf8'));
  const overlay = JSON.parse(readFileSync(translationFile, 'utf8'));
  const recipeModule = await import(`${pathToFileURL(recipeFile).href}?quality=${Date.now()}`);
  const recipeRoot = recipeModule.default();
  recipeRoot.updateMatrixWorld(true);

  const bytes = readFileSync(modelFile);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const productionRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  productionRoot.updateMatrixWorld(true);

  const productionMeshes = collectMeshes(productionRoot);
  const recipeMeshes = collectMeshes(recipeRoot);
  const names = productionMeshes.map((mesh) => mesh.name).sort();
  const recipeNames = recipeMeshes.map((mesh) => mesh.name).sort();
  check('production GLB has the exact 19 stable teaching meshes', JSON.stringify(names) === JSON.stringify(expectedMeshes), names.join(', '));
  check('mesh names are unique', new Set(names).size === names.length);
  check('production and recipe mesh lists match', JSON.stringify(names) === JSON.stringify(recipeNames));

  const productionFingerprints = new Map(productionMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const recipeFingerprints = new Map(recipeMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const fingerprintMismatches = names.filter((name) => productionFingerprints.get(name) !== recipeFingerprints.get(name));
  check('production geometry and materials fingerprint-match the recipe', fingerprintMismatches.length === 0, fingerprintMismatches.join(', '));
  const secondRecipeRoot = recipeModule.default();
  secondRecipeRoot.updateMatrixWorld(true);
  const secondFingerprints = new Map(collectMeshes(secondRecipeRoot).map((mesh) => [mesh.name, fingerprint(mesh)]));
  check('procedural recipe is deterministic', recipeNames.every((name) => recipeFingerprints.get(name) === secondFingerprints.get(name)));

  const byName = new Map(productionMeshes.map((mesh) => [mesh.name, mesh]));
  const shellBox = bounds(byName.get('left_housing')!).union(bounds(byName.get('right_housing')!));
  const shellSize = shellBox.getSize(new THREE.Vector3());
  const totalBox = bounds(productionRoot);
  const totalSize = totalBox.getSize(new THREE.Vector3());
  check('closed drill has a long, compact motor body', shellSize.x / shellSize.z >= 2.5 && shellSize.x / shellSize.z <= 4.2, `length/width ${(shellSize.x / shellSize.z).toFixed(2)}`);
  check('pistol-grip silhouette is taller than the motor barrel alone', totalSize.y >= shellSize.z * 2.7 && totalSize.y <= shellSize.z * 4.6, `height/width ${(totalSize.y / shellSize.z).toFixed(2)}`);
  check('whole tool remains proportionate rather than stretched', totalSize.x / totalSize.y >= 1.15 && totalSize.x / totalSize.y <= 1.75, `length/height ${(totalSize.x / totalSize.y).toFixed(2)}`);

  const leftBox = bounds(byName.get('left_housing')!);
  const rightBox = bounds(byName.get('right_housing')!);
  const seamGap = rightBox.min.z - leftBox.max.z;
  check('shell halves close at rest along a narrow centre seam', seamGap >= -0.012 && seamGap <= 0.018, `seam ${seamGap.toFixed(3)}`);
  check('shell halves share one coherent side profile', Math.abs(leftBox.min.x - rightBox.min.x) <= 0.035 && Math.abs(leftBox.max.y - rightBox.max.y) <= 0.035);
  check('right shell is subtly asymmetric rather than a mirrored block', Math.abs(size(byName.get('left_housing')!).z - size(byName.get('right_housing')!).z) >= 0.006);

  const aligned = ['cooling_fan', 'motor_stator', 'motor_rotor', 'planetary_gearbox', 'torque_clutch', 'output_spindle', 'chuck_body', 'chuck_jaws'] as const;
  const axis = centre(byName.get('motor_stator')!);
  for (const name of aligned) {
    const point = centre(byName.get(name)!);
    check(`${name} is coaxial with the drill power train`, Math.hypot(point.y - axis.y, point.z - axis.z) <= 0.055, `offset ${Math.hypot(point.y - axis.y, point.z - axis.z).toFixed(3)}`);
  }
  const axialOrder = aligned.map((name) => centre(byName.get(name)!).x);
  check('power train runs continuously from rear motor to front chuck', axialOrder.every((value, index) => index === 0 || value <= axialOrder[index - 1] + 0.025), axialOrder.map((value) => value.toFixed(2)).join(' > '));

  const motorBox = bounds(byName.get('motor_stator')!);
  check('motor is proportionate to its barrel', size(byName.get('motor_stator')!).x >= 0.7 && size(byName.get('motor_stator')!).x <= 1.1 && size(byName.get('motor_stator')!).y >= 0.55);
  check('motor is enclosed by the shell at rest', motorBox.min.x >= shellBox.min.x && motorBox.max.x <= shellBox.max.x && motorBox.min.y >= shellBox.min.y && motorBox.max.y <= shellBox.max.y && motorBox.min.z >= shellBox.min.z && motorBox.max.z <= shellBox.max.z);

  const chuckSize = size(byName.get('chuck_body')!);
  check('chuck is compact rather than oversized', chuckSize.y / shellSize.z >= 0.48 && chuckSize.y / shellSize.z <= 0.78 && chuckSize.x <= 0.75, `diameter/body ${(chuckSize.y / shellSize.z).toFixed(2)}, length ${chuckSize.x.toFixed(2)}`);
  const jawsBox = bounds(byName.get('chuck_jaws')!);
  const chuckBox = bounds(byName.get('chuck_body')!);
  check('three jaws emerge from the chuck nose without floating', jawsBox.max.x <= chuckBox.max.x && jawsBox.min.x < chuckBox.min.x && chuckBox.min.x - jawsBox.max.x <= 0.72);
  const jawComponents = geometryComponents(byName.get('chuck_jaws')!);
  check('each chuck jaw is one continuous production-GLB component', jawComponents.length === 3, `${jawComponents.length} components`);
  check('every continuous jaw is seated through the chuck nose', jawComponents.length === 3 && jawComponents.every((component) => {
    const jawLength = component.box.max.x - component.box.min.x;
    return jawLength >= 0.34 && jawLength <= 0.52
      && component.box.max.x >= chuckBox.min.x + 0.06
      && component.box.min.x <= chuckBox.min.x - 0.12;
  }));
  const jawPositions = byName.get('chuck_jaws')!.geometry.getAttribute('position');
  for (let jaw = 0; jaw < 3; jaw += 1) {
    const expectedAngle = jaw * Math.PI * 2 / 3;
    let vertices = 0;
    for (let index = 0; index < jawPositions.count; index += 1) {
      if (jawPositions.getX(index) > -1.6) continue;
      const angle = Math.atan2(jawPositions.getZ(index), jawPositions.getY(index) - axis.y);
      if (angleDistance(angle, expectedAngle) <= 0.55) vertices += 1;
    }
    check(`chuck has a distinct jaw at ${jaw * 120} degrees`, vertices >= 70, `${vertices} vertices`);
  }
  const chuckSpindleOverlap = intervalOverlap(chuckBox, bounds(byName.get('output_spindle')!), 'x');
  const spindleClutchOverlap = intervalOverlap(bounds(byName.get('output_spindle')!), bounds(byName.get('torque_clutch')!), 'x');
  check('chuck seats on the spindle without floating or gross intersection', chuckSpindleOverlap >= 0.04 && chuckSpindleOverlap <= 0.24, `axial overlap ${chuckSpindleOverlap.toFixed(3)}`);
  check('spindle seats in the clutch without floating or gross intersection', spindleClutchOverlap >= 0.04 && spindleClutchOverlap <= 0.2, `axial overlap ${spindleClutchOverlap.toFixed(3)}`);
  const clutchBox = bounds(byName.get('torque_clutch')!);
  const clutchSize = clutchBox.getSize(new THREE.Vector3());
  const exposedClutchLength = shellBox.min.x - clutchBox.min.x;
  const clutchToChuckGap = clutchBox.min.x - chuckBox.max.x;
  check('substantial clutch collar is exposed ahead of the housing nose', exposedClutchLength >= 0.22 && clutchSize.x >= 0.3 && clutchSize.x <= 0.46 && clutchSize.y / shellSize.z >= 0.62, `exposed ${exposedClutchLength.toFixed(3)}, size ${clutchSize.x.toFixed(3)} x ${clutchSize.y.toFixed(3)}`);
  check('exposed clutch collar sits immediately behind the chuck', clutchToChuckGap >= -0.035 && clutchToChuckGap <= 0.09, `gap ${clutchToChuckGap.toFixed(3)}`);

  const grip = bounds(byName.get('rubber_grip')!);
  const battery = bounds(byName.get('battery_shell')!);
  const trigger = centre(byName.get('trigger')!);
  check('battery sits below and directly supports the grip', battery.max.y <= grip.min.y + 0.09 && battery.max.y >= grip.min.y - 0.14 && intervalOverlap(battery, grip, 'x') >= 0.28);
  const batterySize = battery.getSize(new THREE.Vector3());
  const gripSize = grip.getSize(new THREE.Vector3());
  check('battery pack has enough volume for two realistic cell rows', batterySize.y >= 0.78 && batterySize.y <= 0.98 && batterySize.x / batterySize.y >= 1.8 && batterySize.x / batterySize.y <= 2.7, `${batterySize.x.toFixed(2)} x ${batterySize.y.toFixed(2)} x ${batterySize.z.toFixed(2)}`);
  check('ergonomic grip is materially narrower than the motor barrel', gripSize.z / shellSize.z >= 0.58 && gripSize.z / shellSize.z <= 0.82 && gripSize.x / gripSize.y <= 0.62, `depth ratio ${(gripSize.z / shellSize.z).toFixed(2)}, x/y ${(gripSize.x / gripSize.y).toFixed(2)}`);
  check('trigger is in front of the handle and below the motor barrel', trigger.x < centre(byName.get('rubber_grip')!).x - 0.28 && trigger.y < axis.y - 0.32 && trigger.y > grip.max.y - 0.45);
  check('direction switch is directly above the trigger', centre(byName.get('direction_switch')!).y > trigger.y + 0.12 && Math.abs(centre(byName.get('direction_switch')!).x - trigger.x) <= 0.18);
  check('two-speed selector is on top of the transmission housing', centre(byName.get('speed_selector')!).y > shellBox.max.y - 0.08 && centre(byName.get('speed_selector')!).x < axis.x);
  const light = centre(byName.get('work_light')!);
  check('work light is supported beneath the transmission nose', light.x < trigger.x - 0.4 && light.y > trigger.y + 0.08 && light.y < axis.y - 0.28);

  const cellsBox = bounds(byName.get('battery_cells')!);
  const boardBox = bounds(byName.get('battery_management_board')!);
  check('battery cell grid is contained within the pack', cellsBox.min.x > battery.min.x && cellsBox.max.x < battery.max.x && cellsBox.min.z > battery.min.z && cellsBox.max.z < battery.max.z && cellsBox.min.y > battery.min.y && cellsBox.max.y < battery.max.y);
  check('BMS sits above the cell grid under the contacts', boardBox.min.y >= cellsBox.max.y - 0.03 && centre(byName.get('contacts')!).y > boardBox.max.y - 0.03);
  const cellComponents = geometryComponents(byName.get('battery_cells')!);
  const cylindricalCells = cellComponents.filter((component) => {
    const cellSize = componentSize(component);
    const diameter = Math.max(cellSize.x, cellSize.y);
    return cellSize.z >= 0.45 && cellSize.z / diameter >= 3.2 && cellSize.z / diameter <= 4.4;
  });
  check('5s2p pack contains ten realistically slender cylindrical cells', cylindricalCells.length === 10, `${cylindricalCells.length} slender cell cans`);
  const cellDiameters = cylindricalCells.map((component) => {
    const cellSize = componentSize(component);
    return Math.max(cellSize.x, cellSize.y);
  });
  const cellLengths = cylindricalCells.map((component) => componentSize(component).z);
  check('cell diameter has credible 18 V high-current scale relative to tool length', cylindricalCells.length === 10 && cellDiameters.every((diameter) => diameter / totalSize.x >= 0.078 && diameter / totalSize.x <= 0.105), cellDiameters.map((diameter) => (diameter / totalSize.x).toFixed(3)).join(', '));
  check('cell length has credible 18650-class scale relative to tool length', cylindricalCells.length === 10 && cellLengths.every((length) => length / totalSize.x >= 0.29 && length / totalSize.x <= 0.35), cellLengths.map((length) => (length / totalSize.x).toFixed(3)).join(', '));
  const packClearances = [
    cellsBox.min.x - battery.min.x,
    battery.max.x - cellsBox.max.x,
    cellsBox.min.y - battery.min.y,
    battery.max.y - cellsBox.max.y,
    cellsBox.min.z - battery.min.z,
    battery.max.z - cellsBox.max.z,
  ];
  const transverseCellLength = Math.max(...cellLengths, 0);
  check('battery shell clears every face of the full-size cell envelope', packClearances.every((clearance) => clearance >= 0.035), packClearances.map((clearance) => clearance.toFixed(3)).join(', '));
  const batteryMesh = byName.get('battery_shell')!;
  batteryMesh.updateMatrixWorld(true);
  const localCellClearances: number[] = [];
  for (const component of cylindricalCells) {
    const cellPoint = componentCentre(component);
    for (const sampleY of [component.box.min.y + 0.02, cellPoint.y, component.box.max.y - 0.02]) {
      const positiveRay = new THREE.Raycaster(new THREE.Vector3(cellPoint.x, sampleY, 2), new THREE.Vector3(0, 0, -1), 0, 4);
      const negativeRay = new THREE.Raycaster(new THREE.Vector3(cellPoint.x, sampleY, -2), new THREE.Vector3(0, 0, 1), 0, 4);
      const positiveHit = positiveRay.intersectObject(batteryMesh, false)[0];
      const negativeHit = negativeRay.intersectObject(batteryMesh, false)[0];
      localCellClearances.push(positiveHit ? positiveHit.point.z - component.box.max.z : Number.NEGATIVE_INFINITY);
      localCellClearances.push(negativeHit ? component.box.min.z - negativeHit.point.z : Number.NEGATIVE_INFINITY);
    }
  }
  check('sculpted pack locally encloses both ends of every transverse cell', localCellClearances.length === 60 && localCellClearances.every((clearance) => clearance >= 0.025), `minimum local clearance ${Math.min(...localCellClearances).toFixed(3)}`);
  check('pack depth follows transverse cell length without wafer-thin or hollow proportions', cylindricalCells.length === 10 && batterySize.z - transverseCellLength >= 0.08 && batterySize.z - transverseCellLength <= 0.18, `pack ${batterySize.z.toFixed(3)}, cells ${transverseCellLength.toFixed(3)}`);
  const cellCentres = cylindricalCells.map((component) => component.box.getCenter(new THREE.Vector3()));
  const cluster = (values: number[], tolerance: number) => values.sort((a, b) => a - b).reduce<number[]>((groups, value) => {
    if (!groups.length || Math.abs(value - groups[groups.length - 1]) > tolerance) groups.push(value);
    return groups;
  }, []);
  check('ten cells form five columns and two parallel rows', cluster(cellCentres.map((point) => point.x), 0.08).length === 5 && cluster(cellCentres.map((point) => point.y), 0.08).length === 2 && cellCentres.every((point) => Math.abs(point.z) <= 0.025));

  const gearbox = byName.get('planetary_gearbox')!;
  const firstStageRadius = radialExtentInSlab(gearbox, 0.08, 0.115, axis.y, axis.z);
  const secondStageRadius = radialExtentInSlab(gearbox, -0.2, 0.115, axis.y, axis.z);
  check('first planetary stage has its authored compact ring radius', firstStageRadius >= 0.275 && firstStageRadius <= 0.305, `${firstStageRadius.toFixed(3)}`);
  check('second planetary stage is visibly smaller', secondStageRadius >= 0.24 && secondStageRadius <= 0.27 && firstStageRadius - secondStageRadius >= 0.025, `${secondStageRadius.toFixed(3)}`);
  const gearboxComponents = geometryComponents(gearbox);
  const carrierPlates = gearboxComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return componentSize.x <= 0.065
      && componentSize.y >= 0.28
      && componentSize.z >= 0.28
      && component.box.min.y < axis.y && component.box.max.y > axis.y
      && component.box.min.z < axis.z && component.box.max.z > axis.z;
  });
  check('both planetary stages have physically connected carrier plates', carrierPlates.length >= 2, `${carrierPlates.length} carrier plates`);
  const axialLinks = gearboxComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return componentSize.x >= 0.24 && componentSize.y <= 0.16 && componentSize.z <= 0.16
      && component.box.min.y <= axis.y && component.box.max.y >= axis.y
      && component.box.min.z <= axis.z && component.box.max.z >= axis.z;
  });
  check('gearbox has separate first-carrier and second-carrier output links', axialLinks.length >= 2 && axialLinks.some((link) => link.box.max.x > 0 && link.box.min.x < -0.15) && axialLinks.some((link) => link.box.max.x < -0.12 && link.box.min.x < -0.48), `${axialLinks.length} axial links`);

  // Infer the two real production stages from component proportions and radial
  // placement, not from recipe coordinates. A stage must contain three planet
  // bodies, three coaxial pins, one carrier, and the same physical link must
  // touch both its input carrier and the next member of the power path.
  const radialOffset = (component: ComponentStats) => {
    const point = componentCentre(component);
    return Math.hypot(point.y - axis.y, point.z - axis.z);
  };
  const planetComponents = gearboxComponents.filter((component) => {
    const partSize = componentSize(component);
    return partSize.x >= 0.08 && partSize.x <= 0.13
      && partSize.y >= 0.1 && partSize.y <= 0.18
      && partSize.z >= 0.1 && partSize.z <= 0.18
      && radialOffset(component) >= 0.08 && radialOffset(component) <= 0.25;
  }).sort((a, b) => componentCentre(b).x - componentCentre(a).x);
  const pinComponents = gearboxComponents.filter((component) => {
    const partSize = componentSize(component);
    return partSize.x >= 0.12 && partSize.x <= 0.21
      && partSize.y >= 0.035 && partSize.y <= 0.055
      && partSize.z >= 0.035 && partSize.z <= 0.055
      && radialOffset(component) >= 0.08 && radialOffset(component) <= 0.25;
  }).sort((a, b) => componentCentre(b).x - componentCentre(a).x);
  const sunComponents = gearboxComponents.filter((component) => {
    const partSize = componentSize(component);
    return partSize.x >= 0.08 && partSize.x <= 0.13
      && partSize.y >= 0.075 && partSize.y <= 0.14
      && partSize.z >= 0.075 && partSize.z <= 0.14
      && radialOffset(component) <= 0.015;
  }).sort((a, b) => componentCentre(b).x - componentCentre(a).x);
  const orderedCarriers = [...carrierPlates].sort((a, b) => componentCentre(b).x - componentCentre(a).x);
  const orderedLinks = [...axialLinks].sort((a, b) => b.box.max.x - a.box.max.x);
  const stageContacts = [0, 1].map((stage) => {
    const planets = planetComponents.slice(stage * 3, stage * 3 + 3);
    const pins = pinComponents.slice(stage * 3, stage * 3 + 3);
    const carrier = orderedCarriers[stage];
    if (planets.length !== 3 || pins.length !== 3 || !carrier) return { planets: 0, carriers: 0, both: 0, carrierDistances: [] as number[] };
    const contacts = pins.map((pin) => {
      const planet = planets.reduce((closest, candidate) => {
        const pinPoint = componentCentre(pin);
        const closestPoint = componentCentre(closest);
        const candidatePoint = componentCentre(candidate);
        return Math.hypot(candidatePoint.y - pinPoint.y, candidatePoint.z - pinPoint.z)
          < Math.hypot(closestPoint.y - pinPoint.y, closestPoint.z - pinPoint.z) ? candidate : closest;
      });
      return { planet: pinContactsPlanet(pin, planet), carrier: pinContactsCarrier(pin, carrier) };
    });
    return {
      planets: contacts.filter((contact) => contact.planet).length,
      carriers: contacts.filter((contact) => contact.carrier).length,
      both: contacts.filter((contact) => contact.planet && contact.carrier).length,
      carrierDistances: pins.map((pin) => minimumRadialVertexDistance(pin, carrier, Number.POSITIVE_INFINITY)),
    };
  });
  check('production gearbox classifies exactly three supported planet pins per stage', planetComponents.length === 6 && pinComponents.length === 6 && orderedCarriers.length === 2 && stageContacts.every((contacts) => contacts.both === 3), `${planetComponents.length} planets, ${pinComponents.length} pins, planet/carrier/both ${stageContacts.map((contacts) => `${contacts.planets}/${contacts.carriers}/${contacts.both} @ ${contacts.carrierDistances.map((distance) => distance.toFixed(3)).join(',')}`).join(' | ')}`);

  const firstLink = orderedLinks[0];
  const secondLink = orderedLinks[1];
  const secondSun = sunComponents[1];
  const clutchComponents = geometryComponents(byName.get('torque_clutch')!);
  const spindleComponents = geometryComponents(byName.get('output_spindle')!);
  const firstPathContinuous = !!firstLink && !!orderedCarriers[0] && !!secondSun
    && linkContactsCarrier(firstLink, orderedCarriers[0], axis.y, axis.z)
    && boxesOverlap3D(firstLink.box, secondSun.box);
  const secondPathContinuous = !!secondLink && !!orderedCarriers[1]
    && linkContactsCarrier(secondLink, orderedCarriers[1], axis.y, axis.z)
    && [...clutchComponents, ...spindleComponents].some((component) => boxesOverlap3D(secondLink.box, component.box));
  check('first carrier link physically enters the second-stage sun input', firstPathContinuous, `${sunComponents.length} sun inputs classified`);
  check('second carrier link physically enters the clutch or spindle output', secondPathContinuous);

  const floatingCarrier = orderedCarriers[0] && translatedComponent(orderedCarriers[0], new THREE.Vector3(0.2, 0, 0));
  const floatingLink = secondLink && translatedComponent(secondLink, new THREE.Vector3(0, 0, 0.5));
  const floatingCarrierRejected = !!floatingCarrier && !!firstLink
    && !linkContactsCarrier(firstLink, floatingCarrier, axis.y, axis.z)
    && pinComponents.slice(0, 3).every((pin) => !pinContactsCarrier(pin, floatingCarrier));
  const floatingLinkRejected = !!floatingLink && !!orderedCarriers[1]
    && !linkContactsCarrier(floatingLink, orderedCarriers[1], axis.y, axis.z)
    && ![...clutchComponents, ...spindleComponents].some((component) => boxesOverlap3D(floatingLink.box, component.box));
  check('topology classifier rejects floating carrier and shaft fixtures', floatingCarrierRejected && floatingLinkRejected);

  const ventMeshes = [byName.get('left_housing')!, byName.get('right_housing')!];
  ventMeshes.forEach((mesh) => mesh.updateMatrixWorld(true));
  let openVentRays = 0;
  for (let index = 0; index < 6; index += 1) {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(1.08 + index * 0.05, 0.83 + index * 0.025, 1.2),
      new THREE.Vector3(0, 0, -1),
      0,
      2.4,
    );
    if (raycaster.intersectObjects(ventMeshes, false).length === 0) openVentRays += 1;
  }
  const solidRearRay = new THREE.Raycaster(new THREE.Vector3(1.02, 1.12, 1.2), new THREE.Vector3(0, 0, -1), 0, 2.4);
  check('rear fan vents are true perforations through both shell halves', openVentRays >= 5 && solidRearRay.intersectObjects(ventMeshes, false).length >= 2, `${openVentRays}/6 open rays`);

  const triangles = triangleCount(productionMeshes);
  const recipeTriangles = triangleCount(recipeMeshes);
  check('detail is substantial without exceeding the mobile budget', triangles >= 12_000 && triangles <= 80_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB triangle count matches the recipe', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);

  const materialNames = new Set(productionMeshes.map((mesh) => (mesh.material as THREE.Material).name.toLowerCase()));
  for (const family of ['plastic', 'rubber', 'steel', 'copper', 'cell', 'electronics']) {
    check(`${family} material family is present`, [...materialNames].some((name) => name.includes(family)), [...materialNames].join(', '));
  }
  const housingMaterial = byName.get('left_housing')!.material as THREE.MeshStandardMaterial;
  const gripMaterial = byName.get('rubber_grip')!.material as THREE.MeshStandardMaterial;
  const chuckMaterial = byName.get('chuck_body')!.material as THREE.MeshStandardMaterial;
  const statorMaterial = byName.get('motor_stator')!.material as THREE.MeshStandardMaterial;
  const rotorMaterial = byName.get('motor_rotor')!.material as THREE.MeshStandardMaterial;
  const boardMaterial = byName.get('battery_management_board')!.material as THREE.MeshStandardMaterial;
  check('housing behaves as tough molded plastic', housingMaterial.metalness <= 0.12 && housingMaterial.roughness >= 0.48 && housingMaterial.roughness <= 0.72);
  check('grip behaves as restrained molded rubber', gripMaterial.metalness <= 0.04 && gripMaterial.roughness >= 0.72);
  check('chuck behaves as machined steel', chuckMaterial.metalness >= 0.78 && chuckMaterial.roughness >= 0.18 && chuckMaterial.roughness <= 0.42);
  check('brushless stator carries copper windings in electrical steel', statorMaterial.name.toLowerCase().includes('copper') && statorMaterial.metalness >= 0.55 && statorMaterial.roughness <= 0.5);
  check('brushless rotor reads as permanent-magnet steel', rotorMaterial.name.toLowerCase().includes('steel') && rotorMaterial.metalness >= 0.65 && rotorMaterial.roughness <= 0.45);
  check('BMS reads as an electronics board, not metal', boardMaterial.metalness <= 0.18 && boardMaterial.roughness >= 0.42);
  check('production GLB has no texture dependencies', productionMeshes.every((mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    return !material.map && !material.normalMap && !material.roughnessMap && !material.metalnessMap;
  }));

  const claimed = doc.parts.flatMap((item: { nodes: string[] }) => item.nodes).sort();
  check('content id and Android-safe model name agree', doc.id === 'cordless-drill' && doc.model === 'cordless_drill');
  check('content claims every production mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('walkthrough covers a complete operating cycle', doc.steps.length >= 6 && doc.steps.length <= 7);
  check('quiz covers at least eight mechanism questions', doc.quiz.length >= 8);
  const englishText = JSON.stringify(doc).toLowerCase();
  check('trigger explanation teaches PWM electronic speed control', englishText.includes('pwm') && englishText.includes('electronic speed') && englishText.includes('not a simple on/off switch'));

  const expectedPivots: Record<string, [number, number, number]> = {
    motor_rotor: [0.68, 0.88, 0],
    cooling_fan: [1.18, 0.88, 0],
    output_spindle: [-1.28, 0.88, 0],
    chuck_body: [-1.62, 0.88, 0],
    chuck_jaws: [-1.93, 0.88, 0],
  };
  for (const [id, pivot] of Object.entries(expectedPivots)) {
    check(`${id} declares its real shaft axis as the motion pivot`, JSON.stringify(doc.parts.find((item: { id: string }) => item.id === id)?.motion?.pivot) === JSON.stringify(pivot));
  }
  const ratios = Object.fromEntries(Object.keys(expectedPivots).map((id) => [id, doc.parts.find((item: { id: string }) => item.id === id)?.motion?.spin?.ratio]));
  check('rotor and fan turn together in one mechanically coherent direction', ratios.motor_rotor === 10 && ratios.cooling_fan === 10);
  check('spindle, chuck, and jaws remain locked together after reduction', ratios.output_spindle === 1 && ratios.chuck_body === 1 && ratios.chuck_jaws === 1);
  check('gearbox reduction lowers output speed from motor speed', Math.abs(ratios.motor_rotor / ratios.output_spindle - 10) <= 1e-9);

  const expectedSlides: Record<string, { axis: string; amplitude: number }> = {
    trigger: { axis: 'x', amplitude: 0.06 },
    direction_switch: { axis: 'z', amplitude: 0.08 },
    speed_selector: { axis: 'x', amplitude: 0.1 },
  };
  for (const [id, expected] of Object.entries(expectedSlides)) {
    const slide = doc.parts.find((item: { id: string }) => item.id === id)?.motion?.slide;
    check(`${id} declares a finite runtime slide amplitude`, slide?.axis === expected.axis && slide?.amplitude === expected.amplitude && !('distance' in slide));
  }

  const runtimeRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  const rawBox = bounds(runtimeRoot);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCentre = rawBox.getCenter(new THREE.Vector3());
  const runtimeScale = FIT_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-4);
  const assembly = new Assembly(runtimeRoot, doc);
  for (const [id, authored] of Object.entries(expectedPivots)) {
    const handle = assembly.byId.get(id)!;
    const expectedBase = new THREE.Vector3(...authored).sub(rawCentre).multiplyScalar(runtimeScale);
    check(`${id} runtime group is centred on its authored shaft`, handle.base.distanceTo(expectedBase) <= 1e-5, `${handle.base.distanceTo(expectedBase).toFixed(6)} units`);
    assembly.setExplode(0);
    assembly.setCycle(0);
    assembly.refreshWorld();
    const restPivot = handle.group.getWorldPosition(new THREE.Vector3());
    let maxDrift = 0;
    for (const cycle of [0.21, 0.93, 2.18, 4.71]) {
      assembly.setExplode(0);
      assembly.setCycle(cycle);
      assembly.refreshWorld();
      maxDrift = Math.max(maxDrift, handle.group.getWorldPosition(new THREE.Vector3()).distanceTo(restPivot));
    }
    check(`${id} shaft stays invariant through rotation`, maxDrift <= 1e-6, `${maxDrift.toFixed(6)} units`);
  }
  for (const [id] of Object.entries(expectedSlides)) {
    const handle = assembly.byId.get(id)!;
    assembly.setExplode(0);
    assembly.setCycle(0);
    const atRest = handle.group.position.distanceTo(handle.base);
    assembly.setExplode(0);
    assembly.setCycle(Math.PI / 2);
    const travel = handle.group.position.distanceTo(handle.base);
    check(`${id} runtime slide starts finite at rest and then travels`, Number.isFinite(atRest) && atRest <= 1e-8 && Number.isFinite(travel) && travel > 1e-3, `rest ${atRest}, travel ${travel}`);
  }
  for (const id of Object.keys(expectedPivots)) {
    const handle = assembly.byId.get(id)!;
    assembly.setExplode(0);
    assembly.setCycle(0.17);
    check(`${id} produces observable runtime rotation`, handle.group.quaternion.angleTo(new THREE.Quaternion()) > 1e-3);
  }
  assembly.dispose();

  check('Indonesian overlay translates top-level prose', Boolean(overlay.title && overlay.subtitle && overlay.summary && overlay.scale));
  check('Indonesian overlay covers every teaching part', doc.parts.every((item: { id: string }) => {
    const translated = overlay.parts?.[item.id];
    return Boolean(translated?.name && translated?.short && translated?.detail);
  }));
  check('Indonesian walkthrough coverage is complete', overlay.steps?.length === doc.steps.length && overlay.steps.every((step: { title?: string; body?: string }) => step.title && step.body));
  check('Indonesian quiz coverage is complete', overlay.quiz?.length === doc.quiz.length && overlay.quiz.every((item: { prompt?: string; choices?: string[]; explain?: string }, index: number) => {
    const original = doc.quiz[index];
    return Boolean(item.prompt)
      && (!original.choices || item.choices?.length === original.choices.length)
      && (!original.explain || Boolean(item.explain));
  }));
  check('translation overlay contains prose only', !('id' in overlay) && !('model' in overlay) && !('restRotation' in overlay) && Object.values(overlay.parts ?? {}).every((item: unknown) => {
    const value = item as Record<string, unknown>;
    return !('nodes' in value) && !('layer' in value) && !('motion' in value);
  }));
  const indonesianText = JSON.stringify(overlay).toLowerCase();
  for (const term of ['bor', 'kumparan', 'poros', 'roda gigi planet', 'papan kontrol', 'pengatur kecepatan elektronik', 'pwm', 'bukan sekadar sakelar hidup-mati']) {
    check(`Indonesian terminology includes "${term}"`, indonesianText.includes(term));
  }
  check('Indonesian selector copy uses precise natural damage wording', indonesianText.includes('tersumbing atau rusak') && !indonesianText.includes('terkelupas'));

  if (failures) {
    console.error(`\n${failures} cordless drill quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nCordless drill quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
