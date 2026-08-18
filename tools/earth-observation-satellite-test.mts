import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RECIPE = resolve(ROOT, 'tools/models/earth_observation_satellite.mjs');
const GLB = resolve(ROOT, 'assets/models/earth_observation_satellite.glb');
const ENGLISH = resolve(ROOT, 'content/earth-observation-satellite.json');
const INDONESIAN = resolve(ROOT, 'content/id/earth-observation-satellite.json');

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

let failures = 0;
const check = (label: string, condition: boolean, detail = '') => {
  if (condition) return console.log(`  ✓ ${label}`);
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);
const centre = (object: THREE.Object3D) => bounds(object).getCenter(new THREE.Vector3());
const size = (object: THREE.Object3D) => bounds(object).getSize(new THREE.Vector3());

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
  mesh.updateWorldMatrix(true, false);
  hash.update(`mesh:${mesh.name}:matrix:${mesh.matrix.elements.map(number).join(',')}:matrixWorld:${mesh.matrixWorld.elements.map(number).join(',')}:visible:${mesh.visible}:renderOrder:${mesh.renderOrder}:`);
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

type GeometryComponent = { box: THREE.Box3; vertexCount: number };

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

function rotatedBounds(mesh: THREE.Mesh, pivot: THREE.Vector3, axis: THREE.Vector3, angle: number) {
  const result = new THREE.Box3();
  const point = new THREE.Vector3();
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const position = mesh.geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
      .sub(pivot).applyQuaternion(rotation).add(pivot);
    result.expandByPoint(point);
  }
  return result;
}

async function run() {
  console.log('\nEarth observation satellite quality contract');

  const hasRecipe = existsSync(RECIPE);
  const hasGlb = existsSync(GLB);
  const hasEnglish = existsSync(ENGLISH);
  const hasIndonesian = existsSync(INDONESIAN);
  check('procedural recipe exists', hasRecipe);
  check('production GLB exists', hasGlb);
  check('English content exists', hasEnglish);
  check('Indonesian translation exists', hasIndonesian);
  if (!hasRecipe || !hasGlb || !hasEnglish || !hasIndonesian) {
    console.error('\nEarth observation satellite feature is incomplete.');
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

  const byName = new Map(productionMeshes.map((mesh) => [mesh.name, mesh]));
  check('all production geometry has finite non-zero bounds', productionMeshes.every((mesh) => {
    const meshSize = size(mesh);
    return [meshSize.x, meshSize.y, meshSize.z].every(Number.isFinite) && meshSize.lengthSq() > 1e-8;
  }));

  const totalBox = bounds(productionRoot);
  const totalSize = totalBox.getSize(new THREE.Vector3());
  const totalCentre = totalBox.getCenter(new THREE.Vector3());
  const bus = byName.get('spacecraft_bus')!;
  const busBox = bounds(bus);
  const blanketBox = bounds(byName.get('thermal_blankets')!);
  check('deployed spacecraft spans approximately five metres across X', totalSize.x >= 4.75 && totalSize.x <= 5.35 && totalSize.x > totalSize.y * 1.65, `${totalSize.x.toFixed(2)} x ${totalSize.y.toFixed(2)} x ${totalSize.z.toFixed(2)}`);
  check('authored bounds stay centred on the model origin for app framing', totalCentre.length() <= 0.06, totalCentre.toArray().map((value) => value.toFixed(3)).join(', '));
  check('spacecraft bus is a compact three-axis-stabilized load frame', size(bus).x >= 1.2 && size(bus).x <= 1.55 && size(bus).y >= 1.45 && size(bus).y <= 1.85 && size(bus).z >= 1.2 && size(bus).z <= 1.55);
  check('MLI blankets wrap the bus without swallowing its deployed silhouette', blanketBox.containsBox(busBox) && size(byName.get('thermal_blankets')!).x <= 1.55);
  const forwardMliArea = geometryComponents(byName.get('thermal_blankets')!)
    .filter((component) => component.box.min.z >= 0.68 && component.box.getSize(new THREE.Vector3()).z <= 0.08)
    .reduce((area, component) => {
      const componentSize = component.box.getSize(new THREE.Vector3());
      return area + componentSize.x * componentSize.y;
    }, 0);
  check('camera-facing MLI wall closes the flight-ready bus around service penetrations', forwardMliArea >= 1.9, `${forwardMliArea.toFixed(2)} m² projected coverage`);
  const blanketComponents = geometryComponents(byName.get('thermal_blankets')!);
  const upperShoulders = blanketComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    const componentCentre = component.box.getCenter(new THREE.Vector3());
    return componentCentre.y >= 0.94 && componentSize.y >= 0.18
      && componentSize.x >= 0.7 && componentSize.x <= 1.3
      && componentSize.z >= 0.7 && componentSize.z <= 1.3;
  });
  check('MLI silhouette includes a tapered upper equipment shoulder instead of one plain cuboid', upperShoulders.length >= 1, `${upperShoulders.length} shoulder components`);
  const forwardQuiltPads = blanketComponents.filter((component) => {
    const componentSize = component.box.getSize(new THREE.Vector3());
    return component.box.min.z >= 0.73
      && componentSize.x >= 0.12 && componentSize.x <= 0.24
      && componentSize.y >= 0.12 && componentSize.y <= 0.24
      && componentSize.z >= 0.025 && componentSize.z <= 0.09;
  });
  check('forward MLI uses restrained geometric quilt relief rather than a planar painted wall', forwardQuiltPads.length >= 24, `${forwardQuiltPads.length} quilt pads`);
  const deepestQuiltRelief = Math.max(0, ...forwardQuiltPads.map((component) => component.box.getSize(new THREE.Vector3()).z));
  check('MLI quilt relief stays shallow enough to avoid a bulbous toy surface', deepestQuiltRelief <= 0.032, `${deepestQuiltRelief.toFixed(3)} m maximum relief`);

  const portArray = byName.get('solar_array_port')!;
  const starboardArray = byName.get('solar_array_starboard')!;
  const portGimbal = byName.get('solar_gimbal_port')!;
  const starboardGimbal = byName.get('solar_gimbal_starboard')!;
  const portSize = size(portArray);
  const starboardSize = size(starboardArray);
  check('port solar wing is deployed primarily along negative X', bounds(portArray).max.x <= -0.67 && bounds(portArray).min.x <= -2.35 && portSize.z >= 1.0 && portSize.y <= 0.16);
  check('starboard solar wing is deployed primarily along positive X', bounds(starboardArray).min.x >= 0.67 && bounds(starboardArray).max.x >= 2.35 && starboardSize.z >= 1.0 && starboardSize.y <= 0.16);
  for (const [side, panel, gimbal] of [['port', portArray, portGimbal], ['starboard', starboardArray, starboardGimbal]] as const) {
    const cells = geometryComponents(panel).filter((component) => {
      const componentSize = component.box.getSize(new THREE.Vector3());
      return componentSize.x >= 0.14 && componentSize.z >= 0.14 && componentSize.y <= 0.09;
    });
    check(`${side} solar wing uses at least twelve separately segmented cells`, cells.length >= 12, `${cells.length} cells`);
    const cellArea = cells.reduce((area, component) => {
      const componentSize = component.box.getSize(new THREE.Vector3());
      return area + componentSize.x * componentSize.z;
    }, 0);
    const wingSize = size(panel);
    const photovoltaicFill = cellArea / (wingSize.x * wingSize.z);
    check(`${side} photovoltaic tiles densely fill the supported wing instead of reading as an empty frame`, photovoltaicFill >= 0.74, `${(photovoltaicFill * 100).toFixed(1)}% projected fill`);
    check(`${side} solar wing seats against its gimbal journal`, boxClearance(bounds(panel), bounds(gimbal)) <= 0.035, `${boxClearance(bounds(panel), bounds(gimbal)).toFixed(3)} clearance`);
    check(`${side} solar gimbal seats against the bus load frame`, boxClearance(bounds(gimbal), busBox) <= 0.035, `${boxClearance(bounds(gimbal), busBox).toFixed(3)} clearance`);
  }
  check('deployed solar wings clear the insulated bus outside their hinge contacts', bounds(portArray).max.x <= blanketBox.min.x + 0.08 && bounds(starboardArray).min.x >= blanketBox.max.x - 0.08);

  const deck = bounds(byName.get('structural_deck')!);
  for (const moduleName of ['battery_module', 'power_distribution_unit', 'flight_computer', 'focal_plane'] as const) {
    const moduleBox = bounds(byName.get(moduleName)!);
    check(`${moduleName} is supported by an internal structural deck`, boxClearance(moduleBox, deck) <= 0.035 && blanketBox.containsBox(moduleBox), `${boxClearance(moduleBox, deck).toFixed(3)} clearance`);
  }
  const pduBox = bounds(byName.get('power_distribution_unit')!);
  check('visible power harnesses connect both solar gimbals to the PDU', boxClearance(pduBox, bounds(portGimbal)) <= 0.05 && boxClearance(pduBox, bounds(starboardGimbal)) <= 0.05 && size(byName.get('power_distribution_unit')!).x >= 1.4);

  const baffle = byName.get('telescope_baffle')!;
  const primary = byName.get('primary_mirror')!;
  const secondary = byName.get('secondary_mirror')!;
  const scan = byName.get('scan_mirror')!;
  const focal = byName.get('focal_plane')!;
  const optical = [baffle, primary, secondary, scan, focal].map(centre);
  check('nadir telescope extends below the bus on the -Y axis', bounds(baffle).min.y <= blanketBox.min.y - 0.42 && Math.abs(optical[0].x) <= 0.08 && Math.abs(optical[0].z) <= 0.08);
  check('nadir telescope terminates in a substantial flared aperture collar', size(baffle).x >= 0.82 && size(baffle).z >= 0.82, `${size(baffle).x.toFixed(2)} x ${size(baffle).z.toFixed(2)} m aperture envelope`);
  check('primary, secondary, scan mirror, and focal plane share one optical axis', optical.slice(1).every((point) => Math.abs(point.x) <= 0.08 && Math.abs(point.z) <= 0.08));
  check('Cassegrain optical path advances from aperture to secondary, primary, scan, and focal plane', optical[2].y < optical[1].y && optical[1].y < optical[3].y && optical[3].y < optical[4].y, optical.slice(1).map((point) => point.y.toFixed(2)).join(' < '));
  check('mirrors are mounted inside a connected telescope barrel', boxClearance(bounds(baffle), bounds(primary)) <= 0.04 && boxClearance(bounds(baffle), bounds(secondary)) <= 0.04 && boxClearance(bounds(baffle), busBox) <= 0.04);
  check('scan mirror feeds the supported focal-plane electronics', boxClearance(bounds(scan), bounds(focal)) <= 0.08);

  const reactionIds = ['reaction_wheel_roll', 'reaction_wheel_pitch', 'reaction_wheel_yaw'] as const;
  const reactionSizes = reactionIds.map((id) => size(byName.get(id)!));
  const busCentre = centre(bus);
  check('roll wheel is mounted on the spacecraft X axis', reactionSizes[0].x < reactionSizes[0].y * 0.72 && reactionSizes[0].x < reactionSizes[0].z * 0.72);
  check('pitch wheel is mounted on the spacecraft Y axis', reactionSizes[1].y < reactionSizes[1].x * 0.72 && reactionSizes[1].y < reactionSizes[1].z * 0.72);
  check('yaw wheel is mounted on the spacecraft Z axis', reactionSizes[2].z < reactionSizes[2].x * 0.72 && reactionSizes[2].z < reactionSizes[2].y * 0.72);
  check('all three reaction wheels sit near the spacecraft centre of mass', reactionIds.every((id) => centre(byName.get(id)!).distanceTo(busCentre) <= 0.52));

  const starTrackers = byName.get('star_trackers')!;
  const sunSensors = byName.get('sun_sensors')!;
  check('star trackers have two unobstructed outward sight lines', bounds(starTrackers).max.y >= blanketBox.max.y + 0.16 && bounds(starTrackers).min.z <= blanketBox.min.z - 0.16);
  check('sun sensors occupy multiple external spacecraft faces', bounds(sunSensors).max.y >= blanketBox.max.y - 0.03 && bounds(sunSensors).min.x <= blanketBox.min.x + 0.03 && bounds(sunSensors).max.x >= blanketBox.max.x - 0.03);

  const tank = byName.get('propellant_tank')!;
  const lines = byName.get('propellant_lines')!;
  const thrusters = byName.get('thruster_cluster')!;
  check('propellant tank is seated near the bus centre', centre(tank).distanceTo(busCentre) <= 0.45 && blanketBox.containsBox(bounds(tank)));
  check('propellant plumbing is continuous from tank to thrusters', boxClearance(bounds(tank), bounds(lines)) <= 0.035 && boxClearance(bounds(lines), bounds(thrusters)) <= 0.035 && size(lines).z >= 1.3);
  const thrusterComponents = geometryComponents(thrusters);
  check('thruster cluster is symmetric across both lateral faces', thrusterComponents.filter((component) => component.box.max.z <= -0.67).length >= 4 && thrusterComponents.filter((component) => component.box.min.z >= 0.67).length >= 4);
  check('nozzle throats remain open rather than solid decorative cones', thrusterComponents.length >= 16, `${thrusterComponents.length} nozzle components`);

  const dish = byName.get('high_gain_antenna')!;
  const antennaGimbal = byName.get('antenna_gimbal')!;
  const antennaPivot = new THREE.Vector3(0.32, 0.62, 0.7);
  const dishCentre = centre(dish);
  const frontThrusterSeparation = Math.min(...thrusterComponents
    .filter((component) => component.box.min.z >= 0.67)
    .map((component) => {
      const componentCentre = component.box.getCenter(new THREE.Vector3());
      return Math.hypot(componentCentre.x - dishCentre.x, componentCentre.y - dishCentre.y);
    }));
  check('front thrusters remain clear of the projected high-gain reflector aperture', frontThrusterSeparation >= 0.48, `${frontThrusterSeparation.toFixed(3)} m projected centre separation`);
  check('high-gain dish is supported by a two-piece gimbal at the bus', boxClearance(bounds(antennaGimbal), busBox) <= 0.035 && boxClearance(bounds(antennaGimbal), bounds(dish)) <= 0.05 && geometryComponents(antennaGimbal).length >= 4);
  check('high-gain dish carries a detailed feed and rear stiffening structure', geometryComponents(dish).length >= 9, `${geometryComponents(dish).length} reflector/feed components`);
  check('antenna gimbal includes paired bearings, yoke arms, cross shaft, and drive hardware', geometryComponents(antennaGimbal).length >= 9, `${geometryComponents(antennaGimbal).length} gimbal components`);
  check('high-gain dish projects beyond the insulated bus', bounds(dish).max.z >= blanketBox.max.z + 0.34);
  const dishClearances = [-0.22, 0, 0.22].map((angle) => boxClearance(rotatedBounds(dish, antennaPivot, new THREE.Vector3(0, 1, 0), angle), busBox));
  check('high-gain antenna clears the bus through its authored swing', dishClearances.every((value) => value >= 0.055), dishClearances.map((value) => value.toFixed(3)).join(', '));

  const radiators = byName.get('radiator_panels')!;
  const radiatorComponents = geometryComponents(radiators);
  check('paired radiator faces remain external and unobstructed', bounds(radiators).min.z <= blanketBox.min.z - 0.34 && radiatorComponents.length >= 2 && boxClearance(bounds(radiators), bounds(dish)) >= 0.08);
  check('radiators include visible capillary channels, manifolds, and supported panels', radiatorComponents.length >= 24, `${radiatorComponents.length} radiator components`);

  const triangles = triangleCount(productionMeshes);
  const recipeTriangles = triangleCount(recipeMeshes);
  check('detail meets the 45k–100k production triangle budget', triangles >= 45_000 && triangles <= 100_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB triangle count matches the recipe', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);
  const materialNames = new Set(productionMeshes.map((mesh) => (mesh.material as THREE.Material).name.toLowerCase()));
  for (const family of ['graphite composite', 'multi-layer insulation', 'structural aluminium', 'solar cell laminate', 'electronics', 'optical black', 'protected silver', 'reaction wheel steel', 'propellant titanium', 'ceramic thruster', 'antenna composite', 'radiator coating']) {
    check(`${family} material family is present`, [...materialNames].some((name) => name.includes(family)), [...materialNames].join(', '));
  }
  const blanketMaterial = byName.get('thermal_blankets')!.material as THREE.MeshStandardMaterial;
  const cellMaterial = portArray.material as THREE.MeshStandardMaterial;
  const mirrorMaterial = primary.material as THREE.MeshStandardMaterial;
  check('MLI reads as restrained gold insulation', blanketMaterial.name.toLowerCase().includes('multi-layer insulation') && blanketMaterial.metalness >= 0.55 && blanketMaterial.roughness >= 0.32);
  check('solar arrays read as blue photovoltaic laminate', cellMaterial.name.toLowerCase().includes('solar cell laminate') && cellMaterial.metalness <= 0.38 && cellMaterial.roughness <= 0.42);
  check('mirrors read as protected reflective optics', mirrorMaterial.name.toLowerCase().includes('protected silver') && mirrorMaterial.metalness >= 0.8 && mirrorMaterial.roughness <= 0.18);
  check('production GLB has no texture dependencies', productionMeshes.every((mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    return !material.map && !material.alphaMap && !material.normalMap && !material.roughnessMap && !material.metalnessMap && !material.emissiveMap;
  }));

  const claimed = doc.parts.flatMap((part: { nodes: string[] }) => part.nodes).sort();
  check('content metadata matches the approved catalog identity', doc.schema === 1 && doc.id === 'earth-observation-satellite' && doc.model === 'earth_observation_satellite' && doc.title === 'Earth Observation Satellite' && doc.subtitle === 'Optics, power & attitude control' && doc.category === 'Aerospace' && doc.accent === '#66D9FF' && doc.cutAxis === 'z');
  check('content claims every production mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('each stable teaching mesh has its own content part', doc.parts.length === 26 && doc.parts.every((part: { id: string; nodes: string[] }) => part.nodes.length === 1 && part.nodes[0] === part.id));
  check('walkthrough teaches all eight spacecraft-system stages', doc.steps.length === 8);
  check('quiz contains at least eight mechanism questions', doc.quiz.length >= 8);
  const focusIds = doc.steps.flatMap((step: { focus?: string[] }) => step.focus ?? []);
  check('every walkthrough focus resolves to a teaching part', focusIds.every((id: string) => doc.parts.some((part: { id: string }) => part.id === id)));
  const englishText = JSON.stringify(doc).toLowerCase();
  for (const concept of ['sunlight', 'eclipse', 'optical', 'focal plane', 'attitude determination', 'reaction wheel', 'momentum unloading', 'orbit trim', 'downlink']) {
    check(`English walkthrough teaches ${concept}`, englishText.includes(concept));
  }

  const expectedMotion: Record<string, { pivot: [number, number, number]; kind: 'spin' | 'swing'; axis: string; value: number }> = {
    solar_array_port: { pivot: [-0.72, 0.28, 0], kind: 'spin', axis: 'z', value: 0.12 },
    solar_gimbal_port: { pivot: [-0.72, 0.28, 0], kind: 'spin', axis: 'z', value: 0.12 },
    solar_array_starboard: { pivot: [0.72, 0.28, 0], kind: 'spin', axis: 'z', value: -0.12 },
    solar_gimbal_starboard: { pivot: [0.72, 0.28, 0], kind: 'spin', axis: 'z', value: -0.12 },
    reaction_wheel_roll: { pivot: [-0.22, 0.18, 0.22], kind: 'spin', axis: 'x', value: 6 },
    reaction_wheel_pitch: { pivot: [0.22, 0.18, 0.22], kind: 'spin', axis: 'y', value: -7 },
    reaction_wheel_yaw: { pivot: [0, -0.18, -0.25], kind: 'spin', axis: 'z', value: 8 },
    scan_mirror: { pivot: [0, -0.04, 0], kind: 'swing', axis: 'x', value: 0.12 },
    high_gain_antenna: { pivot: [0.32, 0.62, 0.7], kind: 'swing', axis: 'y', value: 0.22 },
    antenna_gimbal: { pivot: [0.32, 0.62, 0.7], kind: 'swing', axis: 'y', value: 0.22 },
  };
  for (const [id, expected] of Object.entries(expectedMotion)) {
    const motion = doc.parts.find((part: { id: string }) => part.id === id)?.motion;
    check(`${id} declares its authored mechanical pivot`, JSON.stringify(motion?.pivot) === JSON.stringify(expected.pivot));
    const driver = motion?.[expected.kind];
    check(`${id} declares its exact finite ${expected.kind} relationship`, driver?.axis === expected.axis && (expected.kind === 'spin' ? driver?.ratio : driver?.amplitude) === expected.value);
  }
  check('solar-array pairs counter-rotate at the exact restrained ratios', doc.parts.find((part: { id: string }) => part.id === 'solar_array_port').motion.spin.ratio === 0.12 && doc.parts.find((part: { id: string }) => part.id === 'solar_array_starboard').motion.spin.ratio === -0.12);
  check('orthogonal reaction wheels retain independent 6, -7, and 8 ratios', doc.parts.find((part: { id: string }) => part.id === 'reaction_wheel_roll').motion.spin.ratio === 6 && doc.parts.find((part: { id: string }) => part.id === 'reaction_wheel_pitch').motion.spin.ratio === -7 && doc.parts.find((part: { id: string }) => part.id === 'reaction_wheel_yaw').motion.spin.ratio === 8);

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

  check('Indonesian overlay translates exact approved metadata', overlay.title === 'Satelit Observasi Bumi' && overlay.subtitle === 'Optik, daya, dan kendali sikap' && Boolean(overlay.summary && overlay.scale));
  check('Indonesian overlay covers every teaching part', doc.parts.every((part: { id: string }) => {
    const translated = overlay.parts?.[part.id];
    return Boolean(translated?.name && translated?.short && translated?.detail);
  }));
  check('Indonesian walkthrough parity is complete', overlay.steps?.length === doc.steps.length && overlay.steps.every((step: { title?: string; body?: string }) => step.title && step.body));
  check('Indonesian quiz parity is complete', overlay.quiz?.length === doc.quiz.length && overlay.quiz.every((item: { prompt?: string; choices?: string[]; explain?: string }, index: number) => {
    const original = doc.quiz[index];
    return Boolean(item.prompt) && (!original.choices || item.choices?.length === original.choices.length) && (!original.explain || Boolean(item.explain));
  }));
  check('Indonesian answer indexes remain inherited exactly from English', overlay.quiz.every((item: Record<string, unknown>) => !('answer' in item)));
  check('translation overlay contains prose only', !('schema' in overlay) && !('id' in overlay) && !('model' in overlay) && !('category' in overlay) && !('accent' in overlay) && !('cutAxis' in overlay) && !('restRotation' in overlay) && Object.values(overlay.parts ?? {}).every((item: unknown) => {
    const value = item as Record<string, unknown>;
    return !('id' in value) && !('nodes' in value) && !('layer' in value) && !('explode' in value) && !('motion' in value);
  }));
  const indonesianText = JSON.stringify(overlay).toLowerCase();
  for (const term of ['satelit observasi bumi', 'panel surya', 'baterai', 'roda reaksi', 'pelacak bintang', 'tangki propelan', 'pendorong', 'bidang fokus', 'antena berpenguatan tinggi']) {
    check(`Indonesian terminology includes "${term}"`, indonesianText.includes(term));
  }

  if (failures) {
    console.error(`\n${failures} earth observation satellite quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nEarth observation satellite quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
