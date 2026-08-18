import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECIPE = resolve(ROOT, 'tools/models/turboshaft_helicopter.mjs');
const GLB = resolve(ROOT, 'assets/models/turboshaft_helicopter.glb');
const ENGLISH = resolve(ROOT, 'content/turboshaft-helicopter.json');
const INDONESIAN = resolve(ROOT, 'content/id/turboshaft-helicopter.json');

const EXPECTED_MESHES = [
  'airframe_shell', 'cockpit_glazing', 'cabin_and_seats', 'landing_skids',
  'fuel_system', 'avionics', 'engine_air_intake', 'compressor', 'combustor',
  'gas_generator_turbine', 'power_turbine', 'exhaust', 'engine_output_shaft',
  'main_transmission', 'rotor_mast', 'swashplate', 'pitch_links', 'rotor_hub',
  'main_rotor_blades', 'tail_drive_shaft', 'tail_gearbox', 'tail_rotor_hub',
  'tail_rotor_blades', 'cyclic_control', 'collective_control', 'control_linkages',
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
const intervalOverlap = (a: THREE.Box3, b: THREE.Box3, axis: 'x' | 'y' | 'z') =>
  Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);

function boxClearance(a: THREE.Box3, b: THREE.Box3) {
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y, 0);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.hypot(dx, dy, dz);
}

function collectMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  return meshes;
}

function triangleCount(meshes: THREE.Mesh[]) {
  return meshes.reduce((sum, mesh) => {
    const index = mesh.geometry.getIndex();
    return sum + (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
  }, 0);
}

function fingerprint(mesh: THREE.Mesh) {
  const hash = createHash('sha256');
  const material = mesh.material as THREE.MeshStandardMaterial;
  const geometry = mesh.geometry;
  const number = (value: number) => Number.isFinite(value) ? value.toFixed(6) : String(value);
  const attribute = (name: string, value: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
    hash.update(`attribute:${name}:${value.itemSize}:${value.normalized}:${value.count}:${value.usage}:${value.gpuType ?? 'default'}:`);
    for (let index = 0; index < value.count; index += 1) {
      for (let component = 0; component < value.itemSize; component += 1) hash.update(`${number(value.getComponent(index, component))},`);
    }
  };

  mesh.updateMatrix();
  hash.update(`mesh:${mesh.name}:matrix:${mesh.matrix.elements.map(number).join(',')}:visible:${mesh.visible}:renderOrder:${mesh.renderOrder}:`);
  for (const name of Object.keys(geometry.attributes).sort()) attribute(name, geometry.getAttribute(name));
  const index = geometry.getIndex();
  if (index) attribute('index', index);
  else hash.update('non-indexed:');
  for (const name of Object.keys(geometry.morphAttributes).sort()) {
    geometry.morphAttributes[name].forEach((value, index) => attribute(`morph:${name}:${index}`, value));
  }
  hash.update(`morphRelative:${geometry.morphTargetsRelative}:drawRange:${geometry.drawRange.start}:${geometry.drawRange.count}:`);
  geometry.groups.forEach((group, index) => hash.update(`group:${index}:${group.start}:${group.count}:${group.materialIndex}:`));
  hash.update([
    material.name,
    material.type,
    material.color.getHexString(),
    material.emissive.getHexString(),
    material.emissiveIntensity.toFixed(6),
    material.metalness.toFixed(4),
    material.roughness.toFixed(4),
    material.opacity.toFixed(4),
    material.transparent ? 'transparent' : 'opaque',
    material.vertexColors ? 'vertex-colours' : 'uniform-colour',
    `side:${material.side}`,
    `depthWrite:${material.depthWrite}`,
    `depthTest:${material.depthTest}`,
    `depthFunc:${material.depthFunc}`,
    `colorWrite:${material.colorWrite}`,
    `alphaTest:${material.alphaTest.toFixed(6)}`,
    `alphaHash:${material.alphaHash}`,
    `blending:${material.blending}`,
    `blendSrc:${material.blendSrc}`,
    `blendDst:${material.blendDst}`,
    `blendEquation:${material.blendEquation}`,
    `premultipliedAlpha:${material.premultipliedAlpha}`,
    `dithering:${material.dithering}`,
    `flatShading:${material.flatShading}`,
    `wireframe:${material.wireframe}`,
    `fog:${material.fog}`,
    `toneMapped:${material.toneMapped}`,
    `polygonOffset:${material.polygonOffset}:${material.polygonOffsetFactor}:${material.polygonOffsetUnits}`,
  ].join(':'));
  return hash.digest('hex');
}

type GeometryComponent = {
  box: THREE.Box3;
  vertexCount: number;
};

function geometryComponents(mesh: THREE.Mesh): GeometryComponent[] {
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
  const components = new Map<number, GeometryComponent>();
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const root = find(vertex);
    let component = components.get(root);
    if (!component) {
      component = { box: new THREE.Box3(), vertexCount: 0 };
      components.set(root, component);
    }
    point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
    component.box.expandByPoint(point);
    component.vertexCount += 1;
  }
  return [...components.values()].filter((component) => component.vertexCount >= 4);
}

function fingerprintFixture() {
  const geometry = new THREE.BoxGeometry(1, 0.8, 0.6, 2, 2, 2);
  const position = geometry.getAttribute('position');
  const tangents = new Float32Array(position.count * 4);
  for (let index = 0; index < position.count; index += 1) tangents[index * 4 + 3] = 1;
  geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
  const indexCount = geometry.getIndex()!.count;
  geometry.clearGroups();
  geometry.addGroup(0, indexCount / 2, 0);
  geometry.addGroup(indexCount / 2, indexCount / 2, 0);
  const material = new THREE.MeshStandardMaterial({
    color: '#7695ad',
    emissive: '#171f29',
    emissiveIntensity: 0.35,
    metalness: 0.42,
    roughness: 0.57,
    opacity: 0.86,
    transparent: true,
  });
  material.name = 'fingerprint fixture material';
  material.side = THREE.FrontSide;
  material.depthWrite = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'fingerprint_fixture';
  mesh.position.set(0.2, -0.3, 0.4);
  mesh.rotation.set(0.1, -0.2, 0.3);
  mesh.scale.set(0.9, 1.1, 1.05);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function fingerprintMutation(label: string, mutate: (mesh: THREE.Mesh) => void) {
  const baseline = fingerprintFixture();
  const changed = fingerprintFixture();
  mutate(changed);
  changed.updateMatrixWorld(true);
  check(`fingerprint rejects ${label} mutation`, fingerprint(baseline) !== fingerprint(changed));
}

function verticesIn(mesh: THREE.Mesh, predicate: (point: THREE.Vector3) => boolean) {
  const position = mesh.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  let count = 0;
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    if (predicate(point)) count += 1;
  }
  return count;
}

async function run() {
  console.log('\nTurboshaft helicopter quality contract');

  const hasRecipe = existsSync(RECIPE);
  const hasGlb = existsSync(GLB);
  const hasEnglish = existsSync(ENGLISH);
  const hasIndonesian = existsSync(INDONESIAN);
  check('procedural recipe exists', existsSync(RECIPE));
  check('production GLB exists', existsSync(GLB));
  check('English content exists', existsSync(ENGLISH));
  check('Indonesian translation exists', existsSync(INDONESIAN));
  if (!hasRecipe || !hasGlb || !hasEnglish || !hasIndonesian) {
    console.error('\nTurboshaft helicopter feature is incomplete.');
    process.exit(1);
  }

  const doc = JSON.parse(readFileSync(ENGLISH, 'utf8'));
  const overlay = JSON.parse(readFileSync(INDONESIAN, 'utf8'));
  const recipeModule = await import(`${pathToFileURL(RECIPE).href}?quality=${Date.now()}`);
  const recipeRoot = recipeModule.default();
  recipeRoot.updateMatrixWorld(true);

  const bytes = readFileSync(GLB);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const productionRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  productionRoot.updateMatrixWorld(true);

  const productionMeshes = collectMeshes(productionRoot);
  const recipeMeshes = collectMeshes(recipeRoot);
  const names = productionMeshes.map((mesh) => mesh.name).sort();
  const recipeNames = recipeMeshes.map((mesh) => mesh.name).sort();
  check('production GLB has the exact 26 stable teaching meshes', JSON.stringify(names) === JSON.stringify(EXPECTED_MESHES), names.join(', '));
  check('production mesh names are unique', new Set(names).size === names.length);
  check('production and recipe mesh lists match', JSON.stringify(names) === JSON.stringify(recipeNames));

  const productionFingerprints = new Map(productionMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const recipeFingerprints = new Map(recipeMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const fingerprintMismatches = names.filter((name) => productionFingerprints.get(name) !== recipeFingerprints.get(name));
  check('production geometry and materials fingerprint-match the recipe', fingerprintMismatches.length === 0, fingerprintMismatches.join(', '));
  const secondRoot = recipeModule.default();
  secondRoot.updateMatrixWorld(true);
  const secondFingerprints = new Map(collectMeshes(secondRoot).map((mesh) => [mesh.name, fingerprint(mesh)]));
  check('procedural recipe is deterministic', recipeNames.every((name) => recipeFingerprints.get(name) === secondFingerprints.get(name)));

  fingerprintMutation('position attribute', (mesh) => {
    const attribute = mesh.geometry.getAttribute('position');
    attribute.setX(0, attribute.getX(0) + 0.125);
  });
  fingerprintMutation('index', (mesh) => {
    const index = mesh.geometry.getIndex()!;
    const first = index.getX(0);
    index.setX(0, index.getX(1));
    index.setX(1, first);
  });
  fingerprintMutation('normal attribute', (mesh) => {
    const attribute = mesh.geometry.getAttribute('normal');
    attribute.setX(0, attribute.getX(0) + 0.125);
  });
  fingerprintMutation('tangent attribute', (mesh) => {
    const attribute = mesh.geometry.getAttribute('tangent');
    attribute.setY(0, attribute.getY(0) + 0.25);
  });
  fingerprintMutation('UV attribute', (mesh) => {
    const attribute = mesh.geometry.getAttribute('uv');
    attribute.setX(0, attribute.getX(0) + 0.125);
  });
  fingerprintMutation('geometry group', (mesh) => {
    mesh.geometry.groups[0].count -= 3;
  });
  fingerprintMutation('node transform', (mesh) => {
    mesh.position.x += 0.25;
  });
  fingerprintMutation('emissive colour', (mesh) => {
    (mesh.material as THREE.MeshStandardMaterial).emissive.offsetHSL(0.1, 0, 0);
  });
  fingerprintMutation('emissive intensity', (mesh) => {
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity += 0.2;
  });
  fingerprintMutation('material side', (mesh) => {
    (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  });
  fingerprintMutation('depth-write state', (mesh) => {
    (mesh.material as THREE.MeshStandardMaterial).depthWrite = false;
  });

  const byName = new Map(productionMeshes.map((mesh) => [mesh.name, mesh]));
  check('all production geometry has finite non-zero bounds', productionMeshes.every((mesh) => {
    const meshSize = size(mesh);
    return [meshSize.x, meshSize.y, meshSize.z].every(Number.isFinite) && meshSize.lengthSq() > 1e-8;
  }));

  const totalBox = bounds(productionRoot);
  const totalSize = totalBox.getSize(new THREE.Vector3());
  const totalCentre = totalBox.getCenter(new THREE.Vector3());
  const shell = byName.get('airframe_shell')!;
  const shellBox = bounds(shell);
  const shellSize = shellBox.getSize(new THREE.Vector3());
  const mainBlades = byName.get('main_rotor_blades')!;
  const mainBladeBox = bounds(mainBlades);
  const mainBladeSize = mainBladeBox.getSize(new THREE.Vector3());
  const mainBladePositions = mainBlades.geometry.getAttribute('position');
  let mainRotorRadius = 0;
  for (let index = 0; index < mainBladePositions.count; index += 1) {
    mainRotorRadius = Math.max(mainRotorRadius, Math.hypot(mainBladePositions.getX(index) + 1.286, mainBladePositions.getZ(index) - 0.0107));
  }
  check('airframe has a long, compact light-helicopter silhouette', shellSize.x >= 7.0 && shellSize.x <= 8.2 && shellSize.y >= 1.8 && shellSize.y <= 2.8 && shellSize.x / shellSize.z >= 2.7, `${shellSize.x.toFixed(2)} x ${shellSize.y.toFixed(2)} x ${shellSize.z.toFixed(2)}`);
  const shellComponents = geometryComponents(shell);
  const substantialSkinStages = shellComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return componentSize.x >= 0.65 && componentSize.y >= 0.25 && componentSize.z >= 0.45;
  });
  check('airframe uses at least five coherent exterior skin stages instead of a blob-box-tube stack', substantialSkinStages.length >= 5, `${substantialSkinStages.length} substantial stages`);
  const primaryCabinSkins = substantialSkinStages.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return componentSize.x >= 2.5 && componentSize.y >= 1.0 && componentSize.z >= 1.5;
  });
  const cabinCurvatureSamples = Math.max(0, ...primaryCabinSkins.map((component) => component.vertexCount));
  check('primary cabin skin has production curvature resolution rather than a faceted low-poly ring', cabinCurvatureSamples >= 480, `${cabinCurvatureSamples} connected vertices`);
  const fuelCell = geometryComponents(byName.get('fuel_system')!).find((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return componentSize.x >= 0.65 && componentSize.y >= 0.65 && componentSize.z >= 1.1;
  });
  const fuelEnclosure = fuelCell && primaryCabinSkins.find((component) => component.box.min.x <= fuelCell.box.min.x - 0.05
    && component.box.max.x >= fuelCell.box.max.x + 0.08
    && component.box.min.y <= fuelCell.box.min.y - 0.05
    && component.box.max.y >= fuelCell.box.max.y + 0.05
    && component.box.min.z <= fuelCell.box.min.z - 0.05
    && component.box.max.z >= fuelCell.box.max.z + 0.05);
  check('closed aft cabin skin encloses the fuel-cell end cap', !!fuelEnclosure);
  const aftBellyFairing = fuelCell && substantialSkinStages.find((component) => component.box.min.x <= fuelCell.box.min.x - 0.2
    && component.box.max.x >= fuelCell.box.max.x + 0.5
    && component.box.min.y <= fuelCell.box.min.y - 0.08
    && component.box.max.y >= fuelCell.box.max.y + 0.08
    && component.box.min.z <= fuelCell.box.min.z - 0.08
    && component.box.max.z >= fuelCell.box.max.z + 0.08);
  check('aft belly fairing carries the enclosed fuel cell into the boom transition', !!aftBellyFairing);
  check('aft belly fairing uses enough longitudinal sections for a production surface', !!aftBellyFairing && aftBellyFairing.vertexCount >= 750, `${aftBellyFairing?.vertexCount ?? 0} connected vertices`);
  check('authored bounds stay centred on the model origin for app framing', totalCentre.length() <= 0.05, `${totalCentre.toArray().map((value) => value.toFixed(3)).join(', ')}`);
  check('three-blade main rotor establishes an approximately 11 m tip diameter', mainRotorRadius >= 5.35 && mainRotorRadius <= 5.7, `${(mainRotorRadius * 2).toFixed(2)} m tip diameter`);
  check('main disc dominates plan view without flattening the aircraft', mainBladeSize.x >= 8.1 && mainBladeSize.z >= 8.1 && totalSize.x >= mainBladeSize.x && totalSize.z >= mainBladeSize.z && totalSize.y >= 3.0 && totalSize.y <= 5.2);

  const glazing = byName.get('cockpit_glazing')!;
  const cabin = byName.get('cabin_and_seats')!;
  const glazingComponents = geometryComponents(glazing);
  check('cockpit glazing uses at least eight separately shaped panes', glazingComponents.length >= 8, `${glazingComponents.length} panes`);
  const fullWidthWindshieldSlabs = glazingComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    const componentCentre = component.box.getCenter(new THREE.Vector3());
    return componentSize.z >= 1.1 && componentSize.x <= 0.25 && Math.abs(componentCentre.z - 0.0107) <= 0.12;
  });
  check('windshield is split around a real centre mullion rather than one full-width slab', fullWidthWindshieldSlabs.length === 0, `${fullWidthWindshieldSlabs.length} full-width slabs`);
  const cockpitPillars = shellComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    const componentCentre = component.box.getCenter(new THREE.Vector3());
    return componentCentre.x >= -4.25 && componentCentre.x <= -1.55
      && componentCentre.y >= -0.35 && componentCentre.y <= 0.45
      && Math.abs(componentCentre.z - 0.0107) >= 0.68
      && componentSize.y >= 0.5 && componentSize.x <= 0.28 && componentSize.z <= 0.32;
  });
  check('A/B/C pillars frame both cockpit sides as load-bearing structure', cockpitPillars.length >= 6, `${cockpitPillars.length} pillar components`);
  check('cockpit glazing follows and overlaps the forward cabin opening', centre(glazing).x < centre(cabin).x - 0.25 && boxClearance(bounds(glazing), bounds(cabin)) <= 0.08);
  check('four-seat cabin has substantial supported interior volume', size(cabin).x >= 1.35 && size(cabin).y >= 0.9 && size(cabin).z >= 1.25 && bounds(cabin).min.y > shellBox.min.y);

  const skids = byName.get('landing_skids')!;
  const skidBox = bounds(skids);
  const ground = skidBox.min.y;
  check('landing skids establish a finite common ground plane below the airframe', Number.isFinite(ground) && shellBox.min.y >= ground + 0.35);
  check('both skid tubes contact the same ground plane', verticesIn(skids, (point) => point.y <= ground + 0.025 && point.z <= -0.45) >= 10 && verticesIn(skids, (point) => point.y <= ground + 0.025 && point.z >= 0.45) >= 10);
  check('cross tubes visibly support both skids from the cabin floor', boxClearance(skidBox, shellBox) <= 0.08 && skidBox.max.y >= shellBox.min.y - 0.05);

  const flowPath = ['engine_air_intake', 'compressor', 'combustor', 'gas_generator_turbine', 'power_turbine'] as const;
  const flowCentres = flowPath.map((name) => centre(byName.get(name)!));
  check('turboshaft gas path is coaxial along the longitudinal X axis', flowCentres.every((point) => Math.abs(point.y - 0.1595) <= 0.08 && Math.abs(point.z - 0.0107) <= 0.05));
  check('intake-to-free-turbine path advances in strict axial order', flowCentres.every((point, index) => index === 0 || point.x > flowCentres[index - 1].x + 0.12), flowCentres.map((point) => point.x.toFixed(2)).join(' < '));
  for (let index = 1; index < flowPath.length; index += 1) {
    const previous = bounds(byName.get(flowPath[index - 1])!);
    const current = bounds(byName.get(flowPath[index])!);
    check(`${flowPath[index - 1]} seats against ${flowPath[index]}`, boxClearance(previous, current) <= 0.09, `${boxClearance(previous, current).toFixed(3)} clearance`);
  }

  const outputShaft = bounds(byName.get('engine_output_shaft')!);
  const transmission = bounds(byName.get('main_transmission')!);
  check('free power turbine couples through the output shaft', boxClearance(bounds(byName.get('power_turbine')!), outputShaft) <= 0.06);
  check('engine output shaft enters the main transmission', boxClearance(outputShaft, transmission) <= 0.06);

  const mast = bounds(byName.get('rotor_mast')!);
  const swashplate = bounds(byName.get('swashplate')!);
  const links = bounds(byName.get('pitch_links')!);
  const hub = bounds(byName.get('rotor_hub')!);
  check('main transmission supports the vertical rotor mast', boxClearance(transmission, mast) <= 0.06 && mast.getCenter(new THREE.Vector3()).y > centre(byName.get('main_transmission')!).y);
  check('swashplate sits below the main rotor hub on the mast', centre(byName.get('swashplate')!).y < centre(byName.get('rotor_hub')!).y - 0.12 && boxClearance(swashplate, mast) <= 0.06);
  check('pitch links bridge swashplate and blade-root controls', boxClearance(links, swashplate) <= 0.06 && boxClearance(links, hub) <= 0.09);
  check('all three main blade roots are seated inside the hub region', verticesIn(mainBlades, (point) => Math.hypot(point.x + 1.286, point.z - 0.0107) <= 0.48 && Math.abs(point.y - 1.4595) <= 0.1) >= 40);
  check('main blades clear the engine deck outside the seated roots', mainBladeBox.min.y >= shellBox.max.y + 0.12);

  const tailShaft = bounds(byName.get('tail_drive_shaft')!);
  const tailGearbox = bounds(byName.get('tail_gearbox')!);
  const tailHub = bounds(byName.get('tail_rotor_hub')!);
  const tailBlades = bounds(byName.get('tail_rotor_blades')!);
  check('continuous tail drive runs from the main transmission through the boom', boxClearance(transmission, tailShaft) <= 0.08 && boxClearance(tailShaft, tailGearbox) <= 0.08 && size(byName.get('tail_drive_shaft')!).x >= 3.6);
  check('tail gearbox is supported at the tapered boom end', boxClearance(tailGearbox, shellBox) <= 0.08 && centre(byName.get('tail_gearbox')!).x >= shellBox.max.x - 0.32);
  check('tail empennage includes a substantial lateral stabilizer', verticesIn(shell, (point) => point.x >= 2.65 && Math.abs(point.z - 0.0107) >= 0.65) >= 40);
  check('tail hub and blades seat on the gearbox output', boxClearance(tailGearbox, tailHub) <= 0.06 && boxClearance(tailHub, tailBlades) <= 0.06);
  check('tail rotor has a substantial anti-torque disc clear of the boom centreline', size(byName.get('tail_rotor_blades')!).y >= 1.55 && size(byName.get('tail_rotor_blades')!).x >= 1.55 && centre(byName.get('tail_rotor_blades')!).z >= 0.38);

  const controlLinks = bounds(byName.get('control_linkages')!);
  check('cyclic control is seated in the cockpit and enters the linkage run', boxClearance(bounds(byName.get('cyclic_control')!), bounds(cabin)) <= 0.08 && boxClearance(bounds(byName.get('cyclic_control')!), controlLinks) <= 0.08);
  check('collective control is seated in the cockpit and enters the linkage run', boxClearance(bounds(byName.get('collective_control')!), bounds(cabin)) <= 0.08 && boxClearance(bounds(byName.get('collective_control')!), controlLinks) <= 0.08);
  check('control linkages reach the swashplate region without a floating gap', boxClearance(controlLinks, swashplate) <= 0.1);

  const triangles = triangleCount(productionMeshes);
  const recipeTriangles = triangleCount(recipeMeshes);
  check('detail meets the 55k–120k production triangle budget', triangles >= 55_000 && triangles <= 120_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB triangle count matches the recipe', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);
  const materialNames = new Set(productionMeshes.map((mesh) => (mesh.material as THREE.Material).name.toLowerCase()));
  for (const family of ['painted composite', 'glazing', 'upholstery', 'rubber', 'titanium', 'steel', 'hot-section alloy', 'electronics']) {
    check(`${family} material family is present`, [...materialNames].some((name) => name.includes(family)), [...materialNames].join(', '));
  }
  const shellMaterial = shell.material as THREE.MeshStandardMaterial;
  const glazingMaterial = glazing.material as THREE.MeshStandardMaterial;
  const hotMaterial = byName.get('combustor')!.material as THREE.MeshStandardMaterial;
  const electronicsMaterial = byName.get('avionics')!.material as THREE.MeshStandardMaterial;
  check('airframe reads as painted composite rather than bare metal', shellMaterial.name.toLowerCase().includes('painted composite') && shellMaterial.metalness <= 0.18 && shellMaterial.roughness >= 0.32 && shellMaterial.roughness <= 0.62);
  check('cockpit glazing is transparent but still legible', glazingMaterial.transparent && glazingMaterial.opacity >= 0.2 && glazingMaterial.opacity <= 0.45 && glazingMaterial.metalness === 0 && glazingMaterial.roughness <= 0.18);
  check('combustor reads as a metallic hot-section alloy', hotMaterial.name.toLowerCase().includes('hot-section alloy') && hotMaterial.metalness >= 0.7 && hotMaterial.roughness >= 0.3);
  check('avionics reads as electronics rather than solid metal', electronicsMaterial.name.toLowerCase().includes('electronics') && electronicsMaterial.metalness <= 0.25 && electronicsMaterial.roughness >= 0.38);
  check('production GLB has no texture dependencies', productionMeshes.every((mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    return !material.map && !material.alphaMap && !material.normalMap && !material.roughnessMap && !material.metalnessMap && !material.emissiveMap;
  }));

  const claimed = doc.parts.flatMap((part: { nodes: string[] }) => part.nodes).sort();
  check('content metadata matches the approved catalog identity', doc.schema === 1 && doc.id === 'turboshaft-helicopter' && doc.model === 'turboshaft_helicopter' && doc.title === 'Turboshaft Helicopter' && doc.subtitle === 'Engine, transmission & rotor controls' && doc.category === 'Aerospace' && doc.accent === '#FFB45E' && doc.cutAxis === 'z');
  check('content claims every production mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('each stable teaching mesh has its own content part', doc.parts.length === 26 && doc.parts.every((part: { id: string; nodes: string[] }) => part.nodes.length === 1 && part.nodes[0] === part.id));
  check('walkthrough teaches the complete helicopter mechanism', doc.steps.length >= 7 && doc.steps.length <= 8);
  check('quiz contains at least eight mechanism questions', doc.quiz.length >= 8);
  const focusIds = doc.steps.flatMap((step: { focus?: string[] }) => step.focus ?? []);
  check('every walkthrough focus resolves to a teaching part', focusIds.every((id: string) => doc.parts.some((part: { id: string }) => part.id === id)));
  const englishText = JSON.stringify(doc).toLowerCase();
  for (const concept of ['pilot input', 'compress', 'continuous combustion', 'free power turbine', 'reduction', 'cyclic', 'collective', 'anti-torque']) {
    check(`English walkthrough teaches ${concept}`, englishText.includes(concept));
  }

  const expectedMotion: Record<string, { pivot: [number, number, number]; kind: 'spin' | 'swing'; axis: string; value: number }> = {
    compressor: { pivot: [-1.106, 0.1595, 0.0107], kind: 'spin', axis: 'x', value: 12 },
    gas_generator_turbine: { pivot: [-0.376, 0.1595, 0.0107], kind: 'spin', axis: 'x', value: 12 },
    power_turbine: { pivot: [-0.086, 0.1595, 0.0107], kind: 'spin', axis: 'x', value: -8 },
    engine_output_shaft: { pivot: [-0.606, 0.1595, 0.0107], kind: 'spin', axis: 'x', value: -8 },
    rotor_mast: { pivot: [-1.286, 0.8595, 0.0107], kind: 'spin', axis: 'y', value: 1 },
    rotor_hub: { pivot: [-1.286, 1.4595, 0.0107], kind: 'spin', axis: 'y', value: 1 },
    main_rotor_blades: { pivot: [-1.286, 1.4595, 0.0107], kind: 'spin', axis: 'y', value: 1 },
    tail_drive_shaft: { pivot: [1.014, 0.3295, 0.0107], kind: 'spin', axis: 'x', value: -5 },
    tail_rotor_hub: { pivot: [3.194, 0.5895, 0.4907], kind: 'spin', axis: 'z', value: 5 },
    tail_rotor_blades: { pivot: [3.194, 0.5895, 0.4907], kind: 'spin', axis: 'z', value: 5 },
    swashplate: { pivot: [-1.286, 1.1695, 0.0107], kind: 'swing', axis: 'z', value: 0.08 },
    pitch_links: { pivot: [-1.286, 1.1695, 0.0107], kind: 'swing', axis: 'z', value: 0.08 },
    cyclic_control: { pivot: [-2.766, -0.9105, 0.1907], kind: 'swing', axis: 'z', value: 0.22 },
    collective_control: { pivot: [-2.466, -0.9105, -0.4893], kind: 'swing', axis: 'z', value: 0.18 },
    control_linkages: { pivot: [-1.286, 1.0295, 0.0107], kind: 'swing', axis: 'z', value: 0.06 },
  };
  for (const [id, expected] of Object.entries(expectedMotion)) {
    const motion = doc.parts.find((part: { id: string }) => part.id === id)?.motion;
    check(`${id} declares its authored mechanical pivot`, JSON.stringify(motion?.pivot) === JSON.stringify(expected.pivot));
    const driver = motion?.[expected.kind];
    check(`${id} declares its exact finite ${expected.kind} relationship`, driver?.axis === expected.axis && (expected.kind === 'spin' ? driver?.ratio : driver?.amplitude) === expected.value);
  }
  check('compressor and gas-generator turbine remain phase-locked at 12:1', doc.parts.find((part: { id: string }) => part.id === 'compressor').motion.spin.ratio === 12 && doc.parts.find((part: { id: string }) => part.id === 'gas_generator_turbine').motion.spin.ratio === 12);
  check('free turbine and output shaft counter-rotate together at -8:1', doc.parts.find((part: { id: string }) => part.id === 'power_turbine').motion.spin.ratio === -8 && doc.parts.find((part: { id: string }) => part.id === 'engine_output_shaft').motion.spin.ratio === -8);
  check('main and tail rotor ratios teach reduction and anti-torque drive', doc.parts.find((part: { id: string }) => part.id === 'main_rotor_blades').motion.spin.ratio === 1 && doc.parts.find((part: { id: string }) => part.id === 'tail_drive_shaft').motion.spin.ratio === -5 && doc.parts.find((part: { id: string }) => part.id === 'tail_rotor_blades').motion.spin.ratio === 5);

  const runtimeRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  const rawBox = bounds(runtimeRoot);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCentre = rawBox.getCenter(new THREE.Vector3());
  const runtimeScale = FIT_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-4);
  const assembly = new Assembly(runtimeRoot, doc);
  for (const [id, expected] of Object.entries(expectedMotion)) {
    const handle = assembly.byId.get(id)!;
    const expectedBase = new THREE.Vector3(...expected.pivot).sub(rawCentre).multiplyScalar(runtimeScale);
    check(`${id} runtime group is centred on its authored pivot`, handle.base.distanceTo(expectedBase) <= 1e-5, `${handle.base.distanceTo(expectedBase).toFixed(6)} units`);
    assembly.setExplode(0);
    assembly.setCycle(0);
    assembly.refreshWorld();
    const restPivot = handle.group.getWorldPosition(new THREE.Vector3());
    let maxDrift = 0;
    for (const cycle of [0.27, 1.11, 2.39, 4.73]) {
      assembly.setExplode(0);
      assembly.setCycle(cycle);
      assembly.refreshWorld();
      maxDrift = Math.max(maxDrift, handle.group.getWorldPosition(new THREE.Vector3()).distanceTo(restPivot));
    }
    check(`${id} authored pivot remains invariant through runtime motion`, maxDrift <= 1e-6, `${maxDrift.toFixed(6)} units`);
    assembly.setExplode(0);
    assembly.setCycle(0.73);
    check(`${id} produces observable finite runtime motion`, handle.group.quaternion.angleTo(new THREE.Quaternion()) > 1e-3 && handle.group.quaternion.toArray().every(Number.isFinite));
  }
  assembly.dispose();

  check('Indonesian overlay translates exact approved metadata', overlay.title === 'Helikopter Turboshaft' && overlay.subtitle === 'Mesin, transmisi, dan kendali rotor' && Boolean(overlay.summary && overlay.scale));
  check('Indonesian overlay covers every teaching part', doc.parts.every((part: { id: string }) => {
    const translated = overlay.parts?.[part.id];
    return Boolean(translated?.name && translated?.short && translated?.detail);
  }));
  check('Indonesian walkthrough parity is complete', overlay.steps?.length === doc.steps.length && overlay.steps.every((step: { title?: string; body?: string }) => step.title && step.body));
  check('Indonesian quiz parity is complete', overlay.quiz?.length === doc.quiz.length && overlay.quiz.every((item: { prompt?: string; choices?: string[]; explain?: string }, index: number) => {
    const original = doc.quiz[index];
    return Boolean(item.prompt) && (!original.choices || item.choices?.length === original.choices.length) && (!original.explain || Boolean(item.explain));
  }));
  check('translation overlay contains prose only', !('schema' in overlay) && !('id' in overlay) && !('model' in overlay) && !('category' in overlay) && !('accent' in overlay) && !('cutAxis' in overlay) && !('restRotation' in overlay) && Object.values(overlay.parts ?? {}).every((item: unknown) => {
    const value = item as Record<string, unknown>;
    return !('id' in value) && !('nodes' in value) && !('layer' in value) && !('explode' in value) && !('motion' in value);
  }));
  const indonesianText = JSON.stringify(overlay).toLowerCase();
  for (const term of ['mesin turboshaft', 'turbin daya bebas', 'transmisi utama', 'pelat oleng', 'langkah kolektif', 'langkah siklik', 'poros penggerak ekor', 'rotor ekor']) {
    check(`Indonesian terminology includes "${term}"`, indonesianText.includes(term));
  }

  if (failures) {
    console.error(`\n${failures} turboshaft helicopter quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nTurboshaft helicopter quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
