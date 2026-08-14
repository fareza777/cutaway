import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipeFile = resolve(ROOT, 'tools/models/cyclonic_vacuum.mjs');
const modelFile = resolve(ROOT, 'assets/models/cyclonic_vacuum.glb');
const contentFile = resolve(ROOT, 'content/cyclonic-vacuum.json');
const translationFile = resolve(ROOT, 'content/id/cyclonic-vacuum.json');

const expectedMeshes = [
  'outer_body', 'carry_handle', 'hose_inlet', 'dust_bin', 'cyclone_cone',
  'cyclone_shroud', 'bin_seal', 'pre_motor_filter', 'motor_stator',
  'motor_rotor', 'impeller', 'motor_mount', 'exhaust_filter', 'exhaust_vent',
  'cord_reel', 'power_control', 'main_wheels', 'caster_wheel',
].sort();

let failures = 0;
const check = (label: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);
const centre = (object: THREE.Object3D) => bounds(object).getCenter(new THREE.Vector3());
const size = (object: THREE.Object3D) => bounds(object).getSize(new THREE.Vector3());

function collectMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

const triangleCount = (meshes: THREE.Mesh[]) => meshes.reduce((sum, mesh) => {
  const index = mesh.geometry.getIndex();
  return sum + (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
}, 0);

function fingerprint(mesh: THREE.Mesh) {
  const hash = createHash('sha256');
  hash.update(mesh.name);
  for (const attributeName of ['position', 'normal', 'color']) {
    const attribute = mesh.geometry.getAttribute(attributeName);
    hash.update(attributeName);
    hash.update(attribute
      ? Array.from(attribute.array as ArrayLike<number>, (value) => Number(value).toFixed(6)).join(',')
      : 'absent');
  }
  const index = mesh.geometry.getIndex();
  hash.update(index ? Array.from(index.array as ArrayLike<number>, Number).join(',') : 'non-indexed');
  const material = mesh.material as THREE.MeshStandardMaterial;
  hash.update([
    material.name,
    material.color.getHexString(),
    material.metalness.toFixed(4),
    material.roughness.toFixed(4),
    material.opacity.toFixed(4),
    material.transparent ? 'transparent' : 'opaque',
  ].join(':'));
  return hash.digest('hex');
}

function worldVertices(mesh: THREE.Mesh, limit = Number.POSITIVE_INFINITY) {
  mesh.updateMatrixWorld(true);
  const position = mesh.geometry.getAttribute('position');
  const stride = Math.max(1, Math.ceil(position.count / limit));
  const vertices: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index += stride) {
    vertices.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
  }
  return vertices;
}

function nearestVertexDistance(a: THREE.Mesh, b: THREE.Mesh) {
  const av = worldVertices(a, 2600);
  const bv = worldVertices(b, 2600);
  let best = Number.POSITIVE_INFINITY;
  for (const va of av) {
    for (const vb of bv) {
      const dx = va.x - vb.x;
      const dy = va.y - vb.y;
      const dz = va.z - vb.z;
      const squared = dx * dx + dy * dy + dz * dz;
      if (squared < best) best = squared;
    }
  }
  return Math.sqrt(best);
}

function verticesIn(mesh: THREE.Mesh, predicate: (point: THREE.Vector3) => boolean) {
  return worldVertices(mesh).filter(predicate).length;
}

function intervalOverlap(a: THREE.Box3, b: THREE.Box3, axis: 'x' | 'y' | 'z') {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function raysThrough(mesh: THREE.Mesh, origins: THREE.Vector3[], direction: THREE.Vector3) {
  return origins.map((origin) => new THREE.Raycaster(origin, direction, 0, 4).intersectObject(mesh, false).length);
}

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
  const indices = index
    ? Array.from(index.array as ArrayLike<number>, Number)
    : Array.from({ length: position.count }, (_, value) => value);
  for (let offset = 0; offset < indices.length; offset += 3) {
    union(indices[offset], indices[offset + 1]);
    union(indices[offset], indices[offset + 2]);
  }
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
    let component = components.get(root);
    if (!component) {
      component = { box: new THREE.Box3(), vertexCount: 0, points: [] };
      components.set(root, component);
    }
    point.fromBufferAttribute(position, vertex);
    component.box.expandByPoint(point);
    component.vertexCount += 1;
    component.points.push(point.clone());
  }
  return [...components.values()].filter((component) => component.vertexCount >= 4);
}

const componentSize = (component: ComponentStats) => component.box.getSize(new THREE.Vector3());
const componentCentre = (component: ComponentStats) => component.box.getCenter(new THREE.Vector3());

function boxClearance(a: THREE.Box3, b: THREE.Box3) {
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y, 0);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.hypot(dx, dy, dz);
}

function componentsFormConnectedAssembly(components: ComponentStats[], tolerance = 0.015) {
  if (!components.length) return false;
  const reached = new Set([0]);
  const pending = [0];
  while (pending.length) {
    const current = pending.pop()!;
    for (let candidate = 0; candidate < components.length; candidate += 1) {
      if (reached.has(candidate)) continue;
      if (boxClearance(components[current].box, components[candidate].box) <= tolerance) {
        reached.add(candidate);
        pending.push(candidate);
      }
    }
  }
  return reached.size === components.length;
}

async function run() {
  console.log('\nCyclonic vacuum cleaner quality contract');

  const hasRecipe = existsSync(recipeFile);
  const hasModel = existsSync(modelFile);
  const hasContent = existsSync(contentFile);
  const hasTranslation = existsSync(translationFile);
  check('procedural recipe exists', hasRecipe);
  check('production GLB exists', hasModel);
  check('English content exists', hasContent);
  check('Indonesian translation exists', hasTranslation);

  if (!hasRecipe || !hasModel || !hasContent || !hasTranslation) {
    console.error('\nCyclonic vacuum cleaner feature is incomplete.');
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(contentFile, 'utf8'));
  const overlay = JSON.parse(readFileSync(translationFile, 'utf8'));
  const recipeModule = await import(`${pathToFileURL(recipeFile).href}?quality=${Date.now()}`);
  const recipeRoot = recipeModule.default();
  const secondRecipeRoot = recipeModule.default();
  recipeRoot.updateMatrixWorld(true);
  secondRecipeRoot.updateMatrixWorld(true);

  const bytes = readFileSync(modelFile);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const root = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  root.updateMatrixWorld(true);

  const productionMeshes = collectMeshes(root);
  const recipeMeshes = collectMeshes(recipeRoot);
  const secondRecipeMeshes = collectMeshes(secondRecipeRoot);
  const names = productionMeshes.map((mesh) => mesh.name).sort();
  const recipeNames = recipeMeshes.map((mesh) => mesh.name).sort();
  const byName = new Map(productionMeshes.map((mesh) => [mesh.name, mesh]));
  const recipeFingerprints = new Map(recipeMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const productionFingerprints = new Map(productionMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const secondFingerprints = new Map(secondRecipeMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));

  check('production GLB has the exact 18 stable teaching meshes', JSON.stringify(names) === JSON.stringify(expectedMeshes), names.join(', '));
  check('mesh names are unique', new Set(names).size === names.length);
  check('production and recipe mesh lists match', JSON.stringify(names) === JSON.stringify(recipeNames));
  const mismatches = names.filter((name) => productionFingerprints.get(name) !== recipeFingerprints.get(name));
  check('production geometry and material fingerprints match the recipe', mismatches.length === 0, mismatches.join(', '));
  check('procedural recipe is deterministic', recipeNames.every((name) => recipeFingerprints.get(name) === secondFingerprints.get(name)));

  const totalBox = bounds(root);
  const totalSize = totalBox.getSize(new THREE.Vector3());
  const bodyBox = bounds(byName.get('outer_body')!);
  const bodySize = bodyBox.getSize(new THREE.Vector3());
  check('closed machine is a low horizontal canister, not an upright or kettle', totalSize.x / totalSize.y >= 1.65 && totalSize.x / totalSize.y <= 2.65 && totalSize.y / totalSize.z <= 1.12, `${totalSize.x.toFixed(2)} x ${totalSize.y.toFixed(2)} x ${totalSize.z.toFixed(2)}`);
  check('body shell has broad low canister proportions', bodySize.x / bodySize.y >= 1.7 && bodySize.x / bodySize.y <= 2.65 && bodySize.z / bodySize.y >= 0.9, `${bodySize.x.toFixed(2)} x ${bodySize.y.toFixed(2)} x ${bodySize.z.toFixed(2)}`);
  const shellRays = [-0.05, 0.9, 1.85].map((x) => {
    const front = new THREE.Raycaster(new THREE.Vector3(x, 0, 1.6), new THREE.Vector3(0, 0, -1), 0, 3.2)
      .intersectObject(byName.get('outer_body')!, false).length;
    const back = new THREE.Raycaster(new THREE.Vector3(x, 0, -1.6), new THREE.Vector3(0, 0, 1), 0, 3.2)
      .intersectObject(byName.get('outer_body')!, false).length;
    return [front, back];
  });
  check('closed outer shell has opposing front and rear boundaries at three stations', shellRays.every(([front, back]) => front >= 1 && back >= 1), shellRays.map((pair) => pair.join('/')).join(', '));

  const bin = byName.get('dust_bin')!;
  const binBox = bounds(bin);
  const binSize = size(bin);
  const binCentre = centre(bin);
  check('clear removable bin occupies the front half and remains substantial', binCentre.x < centre(byName.get('outer_body')!).x - 0.45 && binSize.y >= bodySize.y * 0.62 && binSize.x >= 0.9, `${binCentre.x.toFixed(2)}, ${binSize.x.toFixed(2)} x ${binSize.y.toFixed(2)}`);
  const binMaterial = bin.material as THREE.MeshStandardMaterial;
  check('dust bin uses physically sensible transparent polymer', binMaterial.name.toLowerCase().includes('clear') && binMaterial.transparent && binMaterial.opacity >= 0.16 && binMaterial.opacity <= 0.38 && binMaterial.metalness <= 0.05 && binMaterial.roughness >= 0.12 && binMaterial.roughness <= 0.34);
  check('transparent bin remains texture-free and renders both wall faces', !binMaterial.map && !binMaterial.alphaMap && !binMaterial.normalMap && !binMaterial.roughnessMap && binMaterial.side === THREE.DoubleSide);

  const inlet = byName.get('hose_inlet')!;
  const inletBox = bounds(inlet);
  const inletCentre = centre(inlet);
  const shroud = byName.get('cyclone_shroud')!;
  const shroudCentre = centre(shroud);
  const shroudSize = size(shroud);
  const cone = byName.get('cyclone_cone')!;
  check('hose socket enters high on the bin instead of floating at the body rear', inletCentre.x < binCentre.x + 0.15 && inletCentre.y > binCentre.y + binSize.y * 0.16 && nearestVertexDistance(inlet, bin) <= 0.09, `contact ${nearestVertexDistance(inlet, bin).toFixed(3)}`);
  const tangentialOffset = Math.abs(inletCentre.z - shroudCentre.z);
  check('hose inlet approaches the cyclone tangentially rather than through its centre', tangentialOffset >= shroudSize.z * 0.32 && tangentialOffset <= shroudSize.z * 0.82 && inletBox.min.x < binBox.min.x - 0.2, `offset ${tangentialOffset.toFixed(2)}`);
  check('inlet physically reaches the cyclone entry region', nearestVertexDistance(inlet, shroud) <= 0.16, `gap ${nearestVertexDistance(inlet, shroud).toFixed(3)}`);
  const coneBox = bounds(cone);
  check('sealed cyclone cone hangs inside the clear bin', coneBox.min.x > binBox.min.x && coneBox.max.x < binBox.max.x && coneBox.min.z > binBox.min.z && coneBox.max.z < binBox.max.z && centre(cone).y < shroudCentre.y);
  check('shroud and cone form one continuous separator', nearestVertexDistance(shroud, cone) <= 0.07, `gap ${nearestVertexDistance(shroud, cone).toFixed(3)}`);
  const perforationSampleX = centre(cone).x + 0.22;
  const shroudRays = raysThrough(shroud, [
    new THREE.Vector3(perforationSampleX, 0.42, shroudCentre.z + 1),
    new THREE.Vector3(perforationSampleX, 0.447, shroudCentre.z + 1),
    new THREE.Vector3(perforationSampleX, 0.31, shroudCentre.z + 1),
    new THREE.Vector3(perforationSampleX, 0.337, shroudCentre.z + 1),
  ], new THREE.Vector3(0, 0, -1));
  check('cyclone shroud is visibly perforated with alternating open passages', shroudRays.some((hits) => hits === 0) && shroudRays.some((hits) => hits >= 2), shroudRays.join(', '));

  const seal = byName.get('bin_seal')!;
  check('rubber bin seal closes the separator joint', nearestVertexDistance(seal, bin) <= 0.07 && nearestVertexDistance(seal, shroud) <= 0.09);

  const prefilter = byName.get('pre_motor_filter')!;
  const impeller = byName.get('impeller')!;
  const stator = byName.get('motor_stator')!;
  const rotor = byName.get('motor_rotor')!;
  const exhaustFilter = byName.get('exhaust_filter')!;
  const vent = byName.get('exhaust_vent')!;
  const airflowX = [shroud, prefilter, impeller, rotor, exhaustFilter, vent].map((mesh) => centre(mesh).x);
  check('clean-air path proceeds shroud to prefilter to fan/motor to exhaust', airflowX.every((value, index) => index === 0 || value > airflowX[index - 1] + 0.05), airflowX.map((value) => value.toFixed(2)).join(' < '));
  const flowGaps = [
    nearestVertexDistance(shroud, prefilter),
    nearestVertexDistance(prefilter, impeller),
    nearestVertexDistance(impeller, rotor),
    nearestVertexDistance(rotor, stator),
    nearestVertexDistance(stator, exhaustFilter),
    nearestVertexDistance(exhaustFilter, vent),
  ];
  check('every named airflow stage physically meets or closely seals to the next', flowGaps.every((gap) => gap <= 0.16), flowGaps.map((gap) => gap.toFixed(3)).join(', '));
  check('pre-motor filter spans the full inlet duct rather than decorating its edge', size(prefilter).y >= size(impeller).y * 0.88 && size(prefilter).z >= size(impeller).z * 0.88 && intervalOverlap(bounds(prefilter), bounds(impeller), 'y') > 0.3 && intervalOverlap(bounds(prefilter), bounds(impeller), 'z') > 0.3);
  check('exhaust filter spans the motor discharge before the vent', size(exhaustFilter).y >= size(stator).y * 0.72 && size(exhaustFilter).z >= size(stator).z * 0.72 && centre(exhaustFilter).x > bounds(stator).max.x - 0.08);
  check('both filters have real repeated pleat geometry', verticesIn(prefilter, (point) => Math.abs(point.y - centre(prefilter).y) > size(prefilter).y * 0.35) >= 120 && verticesIn(exhaustFilter, (point) => Math.abs(point.z - centre(exhaustFilter).z) > size(exhaustFilter).z * 0.35) >= 120);

  const filterStreamOffsets = [-0.22, 0, 0.22].flatMap((y) => [-0.22, 0, 0.22].map((z) => [y, z]));
  const prefilterStreamHits = filterStreamOffsets.map(([y, z]) => new THREE.Raycaster(
    new THREE.Vector3(-0.28, 0.02 + y, z), new THREE.Vector3(1, 0, 0), 0, 0.5,
  ).intersectObject(prefilter, false).length);
  const exhaustStreamHits = filterStreamOffsets.map(([y, z]) => new THREE.Raycaster(
    new THREE.Vector3(1.02, 0.02 + y, z), new THREE.Vector3(1, 0, 0), 0, 0.5,
  ).intersectObject(exhaustFilter, false).length);
  check('every sampled inlet-duct stream crosses pre-motor filter medium', prefilterStreamHits.every((hits) => hits >= 1), prefilterStreamHits.join(', '));
  check('every sampled motor-discharge stream crosses exhaust filter medium', exhaustStreamHits.every((hits) => hits >= 1), exhaustStreamHits.join(', '));

  const prefilterSealPoints = [
    ...[-0.28, 0, 0.28].flatMap((z) => [[0.405, z], [-0.365, z]]),
    ...[-0.24, 0.02, 0.28].flatMap((y) => [[y, 0.405], [y, -0.405]]),
  ];
  const exhaustSealPoints = [
    ...[-0.32, 0, 0.32].flatMap((z) => [[0.445, z], [-0.405, z]]),
    ...[-0.26, 0.02, 0.3].flatMap((y) => [[y, 0.45], [y, -0.45]]),
  ];
  const prefilterSealHits = prefilterSealPoints.map(([y, z]) => new THREE.Raycaster(
    new THREE.Vector3(-0.25, y, z), new THREE.Vector3(1, 0, 0), 0, 0.42,
  ).intersectObject(seal, false).length);
  const exhaustSealHits = exhaustSealPoints.map(([y, z]) => new THREE.Raycaster(
    new THREE.Vector3(1.02, y, z), new THREE.Vector3(1, 0, 0), 0, 0.46,
  ).intersectObject(seal, false).length);
  check('pre-motor filter has a four-sided compressible perimeter seal', prefilterSealHits.every((hits) => hits >= 1), prefilterSealHits.join(', '));
  check('exhaust filter has a four-sided compressible perimeter seal', exhaustSealHits.every((hits) => hits >= 1), exhaustSealHits.join(', '));

  const mount = byName.get('motor_mount')!;
  const shroudSealDistance = nearestVertexDistance(shroud, seal);
  const mountSealDistance = nearestVertexDistance(mount, seal);
  check('cyclone neck and motor duct walls close onto the prefilter seal', shroudSealDistance <= 0.04 && mountSealDistance <= 0.04, `neck ${shroudSealDistance.toFixed(3)}, motor duct ${mountSealDistance.toFixed(3)}`);
  const mountFilterDistance = nearestVertexDistance(mount, exhaustFilter);
  const ventSealDistance = nearestVertexDistance(vent, seal);
  check('motor discharge housing and exhaust plenum close onto the final seal', mountFilterDistance <= 0.04 && ventSealDistance <= 0.04, `motor duct ${mountFilterDistance.toFixed(3)}, plenum ${ventSealDistance.toFixed(3)}`);

  const openVentY = [-0.24, -0.12, 0, 0.12, 0.24];
  const openVentRays = openVentY.map((y) => new THREE.Raycaster(
    new THREE.Vector3(2.58, y, 0), new THREE.Vector3(-1, 0, 0), 0, 1.45,
  ).intersectObject(vent, false).length);
  const louverRays = [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((y) => new THREE.Raycaster(
    new THREE.Vector3(2.58, y, 0), new THREE.Vector3(-1, 0, 0), 0, 0.35,
  ).intersectObject(vent, false).length);
  check('rear exhaust has multiple true through-slots into the hollow plenum', openVentRays.every((hits) => hits === 0), openVentRays.join(', '));
  check('solid louvers alternate with the real exhaust openings', louverRays.every((hits) => hits >= 1), louverRays.join(', '));
  const nonPorousOutletMeshes = productionMeshes.filter((mesh) => ![
    'pre_motor_filter', 'exhaust_filter', 'cyclone_shroud',
  ].includes(mesh.name));
  const outletBlockers = openVentY.flatMap((y) => [-0.25, 0, 0.25].map((z) => new THREE.Raycaster(
    new THREE.Vector3(2.58, y, z), new THREE.Vector3(-1, 0, 0), 0, 1.2,
  ).intersectObjects(nonPorousOutletMeshes, false).map((hit) => hit.object.name)));
  check('every rear slot opens from the plenum through the complete closed assembly', outletBlockers.every((names) => names.length === 0), outletBlockers.map((names) => names.join('+') || 'open').join(', '));
  const plenumBoundaryHits = [1.35, 1.8, 2.25].flatMap((x) => [
    new THREE.Raycaster(new THREE.Vector3(x, 0.02, 0), new THREE.Vector3(0, 1, 0), 0, 0.7).intersectObject(vent, false).length,
    new THREE.Raycaster(new THREE.Vector3(x, 0.02, 0), new THREE.Vector3(0, -1, 0), 0, 0.7).intersectObject(vent, false).length,
    new THREE.Raycaster(new THREE.Vector3(x, 0.02, 0), new THREE.Vector3(0, 0, 1), 0, 0.7).intersectObject(vent, false).length,
    new THREE.Raycaster(new THREE.Vector3(x, 0.02, 0), new THREE.Vector3(0, 0, -1), 0, 0.7).intersectObject(vent, false).length,
  ]);
  check('exhaust plenum has four sealed duct walls along its full length', plenumBoundaryHits.every((hits) => hits >= 1), plenumBoundaryHits.join(', '));
  const ventComponents = geometryComponents(vent);
  check('plenum walls and louvers form one physically connected vent assembly', ventComponents.length >= 7 && componentsFormConnectedAssembly(ventComponents), `${ventComponents.length} components`);

  const motorAxis = centre(rotor);
  const impellerCentre = centre(impeller);
  const statorCentre = centre(stator);
  check('rotor, stator, and impeller are coaxial on the longitudinal shaft', Math.hypot(motorAxis.y - impellerCentre.y, motorAxis.z - impellerCentre.z) <= 0.012 && Math.hypot(motorAxis.y - statorCentre.y, motorAxis.z - statorCentre.z) <= 0.012);
  check('rotor is contained by the stator with running clearance', size(rotor).y < size(stator).y && size(rotor).z < size(stator).z && size(stator).y - size(rotor).y >= 0.1 && size(stator).y - size(rotor).y <= 0.42);
  check('impeller is broad and thin on the motor shaft', size(impeller).x <= size(impeller).y * 0.42 && Math.abs(size(impeller).y - size(impeller).z) <= 0.03);

  check('motor mount supports the stator and ties it to the body', nearestVertexDistance(mount, stator) <= 0.08 && nearestVertexDistance(mount, byName.get('outer_body')!) <= 0.16);
  const reel = byName.get('cord_reel')!;
  const reelBox = bounds(reel);
  check('cord reel is enclosed low in the rear body without colliding with the motor', reelBox.min.x > bodyBox.min.x && reelBox.max.x < bodyBox.max.x && reelBox.min.y > bodyBox.min.y && reelBox.max.y < bodyBox.max.y && nearestVertexDistance(reel, stator) >= 0.09);
  const reelPlenumClearance = boxClearance(reelBox, bounds(vent));
  check('cord reel has explicit noncollision clearance below the exhaust plenum', reelPlenumClearance >= 0.075, `${reelPlenumClearance.toFixed(3)} units`);
  const reelCentre = centre(reel);
  const reelSize = size(reel);
  check('animated cord reel contains only a balanced coaxial rotating drum', Math.hypot(reelCentre.x - 1.55, reelCentre.y + 0.69) <= 0.012 && Math.abs(reelSize.x - reelSize.y) <= 0.025 && reelSize.x <= 0.34 && reelSize.z <= 0.72, `centre ${reelCentre.x.toFixed(3)}, ${reelCentre.y.toFixed(3)}; size ${reelSize.x.toFixed(3)} x ${reelSize.y.toFixed(3)} x ${reelSize.z.toFixed(3)}`);
  const body = byName.get('outer_body')!;
  const bodyMaterial = body.material as THREE.Material;
  const originalBodySide = bodyMaterial.side;
  bodyMaterial.side = THREE.DoubleSide;
  const reelRadii = [
    reelBox.max.x - reelCentre.x, reelCentre.x - reelBox.min.x,
    reelBox.max.y - reelCentre.y, reelCentre.y - reelBox.min.y,
    reelBox.max.z - reelCentre.z, reelCentre.z - reelBox.min.z,
  ];
  const enclosureDirections = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ];
  const enclosureOrigins = enclosureDirections.map((_, index) => index >= 4
    ? new THREE.Vector3(reelCentre.x - 0.12, reelCentre.y, reelCentre.z)
    : reelCentre);
  const localBayClearances = enclosureDirections.map((direction, index) => {
    const hit = new THREE.Raycaster(enclosureOrigins[index], direction, 0.001, 0.55).intersectObject(body, false)[0];
    return hit ? hit.distance - reelRadii[index] : Number.POSITIVE_INFINITY;
  });
  bodyMaterial.side = originalBodySide;
  check('a local six-sided stationary cord bay encloses the reel with running clearance', localBayClearances.every((clearance) => clearance >= 0.012 && clearance <= 0.12), localBayClearances.map((clearance) => Number.isFinite(clearance) ? clearance.toFixed(3) : 'open').join(', '));

  const handle = byName.get('carry_handle')!;
  const handleBox = bounds(handle);
  check('carry handle is integrated above the body with two attached feet', handleBox.max.y > bodyBox.max.y + 0.12 && nearestVertexDistance(handle, byName.get('outer_body')!) <= 0.06 && verticesIn(handle, (point) => point.x < centre(handle).x - size(handle).x * 0.38 && point.y < handleBox.min.y + 0.25) >= 20 && verticesIn(handle, (point) => point.x > centre(handle).x + size(handle).x * 0.38 && point.y < handleBox.min.y + 0.25) >= 20);
  const controls = byName.get('power_control')!;
  check('power and rewind controls sit on the upper rear deck', centre(controls).y > centre(byName.get('outer_body')!).y + bodySize.y * 0.28 && centre(controls).x > centre(byName.get('outer_body')!).x);

  const mainWheels = byName.get('main_wheels')!;
  const caster = byName.get('caster_wheel')!;
  const mainBox = bounds(mainWheels);
  const casterBox = bounds(caster);
  const ground = Math.min(totalBox.min.y, mainBox.min.y, casterBox.min.y);
  check('substantial main wheels touch the same ground plane', size(mainWheels).y >= bodySize.y * 0.42 && Math.abs(mainBox.min.y - ground) <= 0.025 && verticesIn(mainWheels, (point) => point.y <= ground + 0.035) >= 12);
  check('front caster shares ground contact and sits ahead of the main axle', Math.abs(casterBox.min.y - ground) <= 0.025 && centre(caster).x < centre(mainWheels).x - 1.2 && verticesIn(caster, (point) => point.y <= ground + 0.035) >= 6);
  check('main wheels and caster are attached beneath the closed shell', nearestVertexDistance(mainWheels, byName.get('outer_body')!) <= 0.09 && nearestVertexDistance(caster, byName.get('outer_body')!) <= 0.09);
  check('animated caster mesh contains rolling wheel and hub only', Math.abs(size(caster).x - size(caster).y) <= 0.025 && size(caster).z <= 0.2 && centre(caster).distanceTo(new THREE.Vector3(-1.42, -0.94, 0)) <= 0.01, `${size(caster).x.toFixed(3)} x ${size(caster).y.toFixed(3)} x ${size(caster).z.toFixed(3)}`);

  const bodyComponents = geometryComponents(byName.get('outer_body')!);
  const stationaryForks = bodyComponents.filter((component) => {
    const componentBox = component.box;
    const componentPartSize = componentSize(component);
    const componentPartCentre = componentCentre(component);
    return Math.abs(componentPartCentre.x + 1.42) <= 0.08
      && componentPartCentre.y >= -0.72 && componentPartCentre.y <= -0.58
      && Math.abs(Math.abs(componentPartCentre.z) - 0.13) <= 0.06
      && componentPartSize.y >= 0.28 && componentPartSize.y <= 0.42
      && componentPartSize.z >= 0.09 && componentPartSize.z <= 0.17
      && componentBox.min.y < -0.8;
  });
  check('stationary body owns two caster fork legs attached around the axle', stationaryForks.length === 2 && stationaryForks.every((component) => boxClearance(component.box, casterBox) <= 0.03), `${stationaryForks.length} fork components`);
  const fixedCableComponents = bodyComponents.filter((component) => {
    const componentPartSize = componentSize(component);
    const componentPartCentre = componentCentre(component);
    return componentPartCentre.x > 1.65 && componentPartCentre.y < -0.58
      && componentPartSize.x >= 0.42 && componentPartSize.x <= 0.85
      && componentPartSize.y <= 0.22 && componentPartSize.z <= 0.12;
  });
  check('fixed cable tail and anchor live in stationary body geometry', fixedCableComponents.length === 1 && boxClearance(fixedCableComponents[0].box, bounds(reel)) <= 0.04, `${fixedCableComponents.length} fixed cable components`);

  const triangles = triangleCount(productionMeshes);
  const recipeTriangles = triangleCount(recipeMeshes);
  check('detail is substantial without exceeding the mobile budget', triangles >= 12_000 && triangles <= 80_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB triangle count matches the recipe', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);
  check('production GLB has no texture dependencies', productionMeshes.every((mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    return !material.map && !material.alphaMap && !material.normalMap && !material.roughnessMap && !material.metalnessMap && !material.emissiveMap;
  }));
  const materialNames = new Set(productionMeshes.map((mesh) => (mesh.material as THREE.Material).name.toLowerCase()));
  for (const family of ['plastic', 'clear', 'rubber', 'steel', 'filter']) {
    check(`${family} material family is present`, [...materialNames].some((name) => name.includes(family)), [...materialNames].join(', '));
  }

  const claimed = doc.parts.flatMap((part: { nodes: string[] }) => part.nodes).sort();
  check('content id and Android-safe model name agree', doc.id === 'cyclonic-vacuum' && doc.model === 'cyclonic_vacuum');
  check('content claims every production mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('walkthrough explains one complete separation and exhaust cycle', doc.steps.length >= 6 && doc.steps.length <= 7);
  check('quiz covers at least eight mechanism questions', doc.quiz.length >= 8);
  const englishText = JSON.stringify(doc).toLowerCase();
  check('pressure explanation is physically accurate', englishText.includes('fan accelerates air') && englishText.includes('lower static pressure') && englishText.includes('pressure difference') && englishText.includes('not a material'));
  check('airflow teaching names both filters in their real order', englishText.indexOf('pre-motor filter') < englishText.indexOf('impeller') && englishText.lastIndexOf('exhaust filter') > englishText.indexOf('motor'));

  const expectedPivots: Record<string, { pivot: [number, number, number]; axis: string; ratio: number }> = {
    motor_rotor: { pivot: [0.72, 0.02, 0], axis: 'x', ratio: 10 },
    impeller: { pivot: [0.24, 0.02, 0], axis: 'x', ratio: 10 },
    cord_reel: { pivot: [1.55, -0.69, 0], axis: 'z', ratio: 0.55 },
    main_wheels: { pivot: [0.86, -0.76, 0], axis: 'z', ratio: 0.8 },
    caster_wheel: { pivot: [-1.42, -0.94, 0], axis: 'z', ratio: 1.2 },
  };
  for (const [id, expected] of Object.entries(expectedPivots)) {
    const motion = doc.parts.find((part: { id: string }) => part.id === id)?.motion;
    check(`${id} declares its authored mechanical pivot`, JSON.stringify(motion?.pivot) === JSON.stringify(expected.pivot));
    check(`${id} declares coherent axis and speed`, motion?.spin?.axis === expected.axis && motion?.spin?.ratio === expected.ratio);
  }
  const rotorMotion = doc.parts.find((part: { id: string }) => part.id === 'motor_rotor')?.motion;
  const impellerMotion = doc.parts.find((part: { id: string }) => part.id === 'impeller')?.motion;
  check('rotor and impeller are mechanically locked in direction and speed', rotorMotion.spin.axis === impellerMotion.spin.axis && rotorMotion.spin.ratio === impellerMotion.spin.ratio);

  const runtimeRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  const rawBox = bounds(runtimeRoot);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCentre = rawBox.getCenter(new THREE.Vector3());
  const runtimeScale = FIT_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-4);
  const assembly = new Assembly(runtimeRoot, doc);
  for (const [id, expected] of Object.entries(expectedPivots)) {
    const handle = assembly.byId.get(id)!;
    const expectedBase = new THREE.Vector3(...expected.pivot).sub(rawCentre).multiplyScalar(runtimeScale);
    check(`${id} runtime group is centred on its authored pivot`, handle.base.distanceTo(expectedBase) <= 1e-5, `${handle.base.distanceTo(expectedBase).toFixed(6)} units`);
    assembly.setExplode(0);
    assembly.setCycle(0);
    assembly.refreshWorld();
    const restPivot = handle.group.getWorldPosition(new THREE.Vector3());
    let maxDrift = 0;
    for (const cycle of [0.29, 1.07, 2.43, 4.61]) {
      assembly.setExplode(0);
      assembly.setCycle(cycle);
      assembly.refreshWorld();
      maxDrift = Math.max(maxDrift, handle.group.getWorldPosition(new THREE.Vector3()).distanceTo(restPivot));
    }
    check(`${id} pivot remains invariant through runtime rotation`, maxDrift <= 1e-6, `${maxDrift.toFixed(6)} units`);
  }
  assembly.setExplode(0);
  assembly.setCycle(0.37);
  const rotorQuaternion = assembly.byId.get('motor_rotor')!.group.quaternion;
  const impellerQuaternion = assembly.byId.get('impeller')!.group.quaternion;
  check('runtime rotor and impeller remain phase-locked', rotorQuaternion.angleTo(impellerQuaternion) <= 1e-6);
  const stationaryBody = assembly.byId.get('outer_body')!;
  assembly.setCycle(0);
  assembly.refreshWorld();
  const bodyMatrixAtRest = stationaryBody.group.matrixWorld.clone();
  let stationaryMatrixDrift = 0;
  for (const cycle of [0.41, 1.37, 2.79]) {
    assembly.setCycle(cycle);
    assembly.refreshWorld();
    stationaryMatrixDrift = Math.max(stationaryMatrixDrift, ...stationaryBody.group.matrixWorld.elements.map((value, index) => Math.abs(value - bodyMatrixAtRest.elements[index])));
  }
  check('caster fork and cable anchor remain stationary while wheel and drum rotate', stationaryMatrixDrift <= 1e-8, `${stationaryMatrixDrift.toFixed(9)} matrix drift`);
  assembly.dispose();

  check('Indonesian overlay translates all top-level prose', Boolean(overlay.title && overlay.subtitle && overlay.summary && overlay.scale));
  check('Indonesian overlay covers every teaching part', doc.parts.every((part: { id: string }) => {
    const translated = overlay.parts?.[part.id];
    return Boolean(translated?.name && translated?.short && translated?.detail);
  }));
  check('Indonesian walkthrough coverage is complete', overlay.steps?.length === doc.steps.length && overlay.steps.every((step: { title?: string; body?: string }) => step.title && step.body));
  check('Indonesian quiz coverage is complete', overlay.quiz?.length === doc.quiz.length && overlay.quiz.every((item: { prompt?: string; choices?: string[]; explain?: string }, index: number) => {
    const original = doc.quiz[index];
    return Boolean(item.prompt) && (!original.choices || item.choices?.length === original.choices.length) && (!original.explain || Boolean(item.explain));
  }));
  check('translation overlay contains prose only', !('id' in overlay) && !('model' in overlay) && !('restRotation' in overlay) && Object.values(overlay.parts ?? {}).every((item: unknown) => {
    const value = item as Record<string, unknown>;
    return !('nodes' in value) && !('layer' in value) && !('motion' in value) && !('correct' in value);
  }));
  const indonesianText = JSON.stringify(overlay).toLowerCase();
  for (const term of ['penyedot debu siklon', 'aliran udara', 'tekanan statis', 'perbedaan tekanan', 'filter pra-motor', 'filter pembuangan', 'impeler', 'motor', 'bukan zat']) {
    check(`Indonesian terminology includes "${term}"`, indonesianText.includes(term));
  }
  check('Indonesian copy avoids awkward literal suction hybrids', !indonesianText.includes('menciptakan sedotan') && !indonesianText.includes('material hisap') && !indonesianText.includes('daya sedotan adalah'));

  if (failures) {
    console.error(`\n${failures} cyclonic vacuum cleaner quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nCyclonic vacuum cleaner quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
