// Regression contract: catches an unbundled item, floating brew-stack parts,
// a heater outside its boiler, stale export, or incomplete Indonesian content.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  recipe: resolve(ROOT, 'tools/models/espresso_machine.mjs'),
  model: resolve(ROOT, 'assets/models/espresso_machine.glb'),
  content: resolve(ROOT, 'content/espresso-machine.json'),
  translation: resolve(ROOT, 'content/id/espresso-machine.json'),
};
let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console[ok ? 'log' : 'error'](`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
console.log('\nEspresso machine quality contract');
for (const [kind, path] of Object.entries(files)) check(`${kind} is present`, existsSync(path));
if (failures) process.exit(1);

const recipe = (await import(pathToFileURL(files.recipe).href)).default();
const bytes = readFileSync(files.model);
const root = (await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '',
)).scene;
root.updateMatrixWorld(true);
const meshes: THREE.Mesh[] = [];
root.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh); });
const byName = new Map(meshes.map((mesh) => [mesh.name, mesh]));
const required = [
  'outer_shell', 'front_panel', 'water_tank', 'boiler_body', 'boiler_lid',
  'heating_element', 'pump_coil', 'pump_plunger', 'overpressure_valve',
  'pressure_hose', 'suction_return_hoses', 'three_way_valve', 'drain_tube',
  'group_head', 'shower_screen', 'group_gasket', 'filter_basket', 'coffee_puck',
  'portafilter_body', 'portafilter_handle', 'steam_valve', 'steam_wand',
  'drip_tray', 'tray_grille', 'brew_bay_panel',
];
check('all working systems are represented', required.every((name) => byName.has(name)), required.filter((name) => !byName.has(name)).join(', '));
check('each teaching mesh has a unique name', byName.size === meshes.length);
if (failures) process.exit(1);
const bounds = (name: string) => new THREE.Box3().setFromObject(byName.get(name)!);
const centre = (name: string) => bounds(name).getCenter(new THREE.Vector3());
const size = (name: string) => bounds(name).getSize(new THREE.Vector3());
const boiler = bounds('boiler_body');
const heater = bounds('heating_element');
check('the heater fits radially inside the boiler', heater.min.x > boiler.min.x && heater.max.x < boiler.max.x && heater.min.z > boiler.min.z && heater.max.z < boiler.max.z);
check('the heater reaches into the water chamber, not below its floor', heater.min.y > boiler.min.y && heater.min.y < centre('boiler_body').y);
check('the reservoir is behind the boiler', centre('water_tank').z < boiler.min.z);
check('the vibration pump is below the boiler', centre('pump_coil').y < boiler.min.y);
check('the pump plunger is enclosed by its electromagnetic coil', bounds('pump_coil').containsBox(bounds('pump_plunger')));
check('the boiler feeds a group directly beneath it', centre('group_head').y < boiler.min.y && Math.abs(centre('group_head').x - centre('boiler_body').x) < 0.06);
check('water passes downward through screen, coffee and basket', centre('shower_screen').y > centre('coffee_puck').y && centre('coffee_puck').y > bounds('filter_basket').min.y);
check('the basket fits within the portafilter', size('filter_basket').x < size('portafilter_body').x && bounds('filter_basket').min.y >= bounds('portafilter_body').min.y);
check('the portafilter handle projects toward the user', centre('portafilter_handle').z > bounds('portafilter_body').max.z);
check('the steam wand reaches the cup area without piercing the tray', bounds('steam_wand').min.y < centre('group_head').y && bounds('steam_wand').min.y > bounds('tray_grille').max.y);
check('the drain ends inside the drip-tray region', Math.abs(bounds('drain_tube').min.y - bounds('tray_grille').max.y) < 0.12);
check('the grille covers the tray from above', centre('tray_grille').y > centre('drip_tray').y && size('tray_grille').x < size('drip_tray').x);
check('a splash panel shields the lower plumbing behind the cup', bounds('brew_bay_panel').max.z < centre('group_head').z && bounds('brew_bay_panel').min.y < centre('demitasse').y && bounds('brew_bay_panel').max.y > bounds('pump_coil').max.y);
const groupCentre = centre('group_head');
const splashRay = new THREE.Raycaster(new THREE.Vector3(groupCentre.x, 0.055, 0.85), new THREE.Vector3(0, 0, -1));
check('the splash panel has clearance for the back of the group', splashRay.intersectObject(byName.get('brew_bay_panel')!).length === 0);
const supportRay = new THREE.Raycaster(new THREE.Vector3(groupCentre.x, 0.30, groupCentre.z), new THREE.Vector3(0, -1, 0), 0, 0.40);
check('the supporting frame has a real aperture for the group', supportRay.intersectObject(byName.get('chassis')!).length === 0);
const bodySize = size('outer_shell');
check('the silhouette is a compact countertop machine', bodySize.y / bodySize.x > 1.15 && bodySize.y / bodySize.x < 1.8 && bodySize.z / bodySize.x > 0.75 && bodySize.z / bodySize.x < 1.2);

const triangleCount = (object: THREE.Object3D) => {
  let total = 0;
  object.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const g = (node as THREE.Mesh).geometry;
    total += (g.index?.count ?? g.getAttribute('position').count) / 3;
  });
  return Math.round(total);
};
const triangles = triangleCount(root);
const invalidNormals: string[] = [];
recipe.traverse((node: THREE.Object3D) => {
  if (!(node as THREE.Mesh).isMesh) return;
  const n = (node as THREE.Mesh).geometry.getAttribute('normal');
  for (let i = 0; i < n.count; i++) {
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (!Number.isFinite(length) || Math.abs(length - 1) > 0.0005) { invalidNormals.push(node.name); break; }
  }
});
check('source geometry has no zero-area shading normals', invalidNormals.length === 0, invalidNormals.join(', '));
check('geometry remains within the mobile detail budget', triangles >= 10_000 && triangles <= 40_000, `${triangles} triangles`);
check('the production export matches the recipe', triangles === triangleCount(recipe));
check('the steel shell is metallic but hoses are not', (byName.get('outer_shell')!.material as THREE.MeshStandardMaterial).metalness > 0.7 && (byName.get('pressure_hose')!.material as THREE.MeshStandardMaterial).metalness < 0.2);
const signatures = new Set(meshes.map((mesh) => {
  const m = mesh.material as THREE.MeshStandardMaterial;
  return `${m.color.getHexString()}:${m.metalness}:${m.roughness}`;
}));
check('brass, stainless steel, polymer, rubber and coffee are distinguishable', signatures.size >= 8);
check('native rendering does not require image textures', meshes.every((mesh) => !(mesh.material as THREE.MeshStandardMaterial).map));
check('the export stays small enough for offline loading', bytes.length < 3_000_000, `${(bytes.length / 1024).toFixed(0)} KiB`);

const doc = JSON.parse(readFileSync(files.content, 'utf8'));
const id = JSON.parse(readFileSync(files.translation, 'utf8'));
const claimed = doc.parts.flatMap((part: { nodes: string[] }) => part.nodes);
check('every selectable part addresses real geometry exactly once', claimed.length === meshes.length && new Set(claimed).size === claimed.length && claimed.every((name: string) => byName.has(name)));
check('the item is registered under the appliance category', doc.category === 'Appliances' && doc.model === 'espresso_machine');
check('every component has meaningful bilingual explanations', doc.parts.every((part: { id: string; short: string; detail: string }) => part.short.length > 15 && part.detail.length > 100 && id.parts[part.id]?.short?.length > 15 && id.parts[part.id]?.detail?.length > 100));
check('the guide covers a complete brewing cycle', doc.steps.length >= 7 && id.steps.length === doc.steps.length && doc.steps.every((step: { focus: string[] }) => step.focus?.length && step.focus.every((partId: string) => doc.parts.some((part: { id: string }) => part.id === partId))));
check('the quiz has full Indonesian coverage', doc.quiz.length >= 8 && id.quiz.length === doc.quiz.length && id.quiz.every((q: { prompt: string }) => q.prompt.length > 10));
check('the moving plunger represents reciprocal, not rotating, pumping', doc.parts.some((part: { nodes: string[]; motion?: { slide?: { axis: string }; spin?: unknown } }) => part.nodes.includes('pump_plunger') && part.motion?.slide?.axis === 'y' && !part.motion.spin));
if (failures) { console.error(`\n${failures} espresso machine checks failed.`); process.exit(1); }
console.log(`\nEspresso machine verified: ${meshes.length} teaching parts, ${triangles} triangles.`);
