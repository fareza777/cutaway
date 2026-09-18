import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipeFile = resolve(ROOT, 'tools/models/rice_cooker.mjs');
const modelFile = resolve(ROOT, 'assets/models/rice_cooker.glb');
const contentFile = resolve(ROOT, 'content/rice-cooker.json');
const translationFile = resolve(ROOT, 'content/id/rice-cooker.json');

const expectedMeshes = [
  'outer_shell',
  'outer_lid',
  'carry_handle',
  'lid_release',
  'steam_vent',
  'hinge',
  'control_panel',
  'display',
  'inner_pot',
  'inner_lid',
  'lid_gasket',
  'heating_plate',
  'temperature_sensor',
  'control_board',
  'thermal_fuse',
  'wiring_harness',
  'power_socket',
  'base_plate',
];

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

async function run() {
  console.log('\nRice cooker quality contract');

  const hasRecipe = existsSync(recipeFile);
  const hasModel = existsSync(modelFile);
  const hasContent = existsSync(contentFile);
  const hasTranslation = existsSync(translationFile);
  check('procedural recipe exists', hasRecipe);
  check('production GLB exists', hasModel);
  check('English content exists', hasContent);
  check('Indonesian translation exists', hasTranslation);

  if (!hasRecipe || !hasModel || !hasContent || !hasTranslation) {
    console.error('\nRice cooker feature is incomplete.');
    process.exit(1);
  }

  const module = await import(`${pathToFileURL(recipeFile).href}?quality=${Date.now()}`);
  const recipeRoot = module.default();
  recipeRoot.updateMatrixWorld(true);
  const bytes = readFileSync(modelFile);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const root = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  root.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  root.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh);
  });
  const names = meshes.map((mesh) => mesh.name).sort();
  const recipeNames: string[] = [];
  recipeRoot.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) recipeNames.push(node.name);
  });
  recipeNames.sort();
  const missing = expectedMeshes.filter((name) => !names.includes(name));
  const unexpected = names.filter((name) => !expectedMeshes.includes(name));
  check('all teaching parts have stable mesh names', missing.length === 0, missing.join(', '));
  check('recipe has no unclaimed detail meshes', unexpected.length === 0, unexpected.join(', '));
  check('mesh names are unique', new Set(names).size === names.length);
  check('shipped GLB matches the current recipe mesh contract', JSON.stringify(names) === JSON.stringify(recipeNames));

  const modelBox = bounds(root);
  const size = modelBox.getSize(new THREE.Vector3());
  const widthHeight = size.x / size.y;
  const depthWidth = size.z / size.x;
  check('body has a familiar low, wide appliance silhouette', widthHeight >= 1.0 && widthHeight <= 1.55, `w/h ${widthHeight.toFixed(2)}`);
  check('body depth stays proportional to its width', depthWidth >= 0.72 && depthWidth <= 1.05, `d/w ${depthWidth.toFixed(2)}`);

  const byName = new Map(meshes.map((mesh) => [mesh.name, mesh]));
  const shellBox = bounds(byName.get('outer_shell')!);
  const lidBox = bounds(byName.get('outer_lid')!);
  const potBox = bounds(byName.get('inner_pot')!);
  const heaterBox = bounds(byName.get('heating_plate')!);
  const panelBox = bounds(byName.get('control_panel')!);
  const ventBox = bounds(byName.get('steam_vent')!);
  check('lid sits above the main shell', lidBox.getCenter(new THREE.Vector3()).y > shellBox.getCenter(new THREE.Vector3()).y);
  check('inner pot sits directly above the heating plate', potBox.min.y > heaterBox.getCenter(new THREE.Vector3()).y);
  check('inner pot fits inside the housing', potBox.getSize(new THREE.Vector3()).x < shellBox.getSize(new THREE.Vector3()).x);
  check('control panel is on the readable front face', panelBox.getCenter(new THREE.Vector3()).z > modelBox.getCenter(new THREE.Vector3()).z);
  check('steam vent is visibly mounted on the lid', ventBox.getCenter(new THREE.Vector3()).y > lidBox.min.y);

  const triangles = meshes.reduce((sum, mesh) => {
    const index = mesh.geometry.getIndex();
    return sum + (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
  }, 0);
  let recipeTriangles = 0;
  recipeRoot.traverse((node: THREE.Object3D) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const geometry = (node as THREE.Mesh).geometry;
    const index = geometry.getIndex();
    recipeTriangles += (index ? index.count : geometry.getAttribute('position').count) / 3;
  });
  check('detail is substantial without exceeding the mobile budget', triangles >= 6_000 && triangles <= 40_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB geometry is not stale', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);

  const materialSignatures = new Set(
    meshes.map((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      return `${material.color.getHexString()}:${material.metalness.toFixed(2)}:${material.roughness.toFixed(2)}`;
    }),
  );
  check('materials visibly distinguish metal, plastic, rubber, glass, and electronics', materialSignatures.size >= 7, `${materialSignatures.size} material signatures`);
  const shellMaterial = byName.get('outer_shell')!.material as THREE.MeshStandardMaterial;
  const wiringMaterial = byName.get('wiring_harness')!.material as THREE.MeshStandardMaterial;
  check('painted shell behaves as a dielectric coating', shellMaterial.metalness <= 0.1, `metalness ${shellMaterial.metalness.toFixed(2)}`);
  check('wiring harness reads as insulated cable, not exposed copper', wiringMaterial.metalness <= 0.1, `metalness ${wiringMaterial.metalness.toFixed(2)}`);

  const doc = JSON.parse(readFileSync(contentFile, 'utf8'));
  const claimed = doc.parts.flatMap((part: { nodes: string[] }) => part.nodes).sort();
  check('content id and Android-safe model name agree', doc.id === 'rice-cooker' && doc.model === 'rice_cooker');
  check('content claims every mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('walkthrough teaches the complete cook-and-keep-warm cycle', doc.steps.length >= 5);
  check('quiz covers enough of the mechanism', doc.quiz.length >= 6);

  if (failures) {
    console.error(`\n${failures} rice cooker quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nRice cooker quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
