import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipeFile = resolve(ROOT, 'tools/models/mechanical_watch.mjs');
const modelFile = resolve(ROOT, 'assets/models/mechanical_watch.glb');
const contentFile = resolve(ROOT, 'content/mechanical-watch.json');
const translationFile = resolve(ROOT, 'content/id/mechanical-watch.json');

const expectedMeshes = [
  'case', 'bezel', 'crystal', 'caseback', 'crown', 'winding_stem',
  'dial', 'hour_hand', 'minute_hand', 'seconds_hand', 'automatic_rotor',
  'mainspring_barrel', 'centre_wheel', 'third_wheel', 'fourth_wheel',
  'escape_wheel', 'pallet_fork', 'balance_wheel', 'hairspring',
  'movement_bridges', 'jewels', 'strap_lugs',
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
const triangleCount = (meshes: THREE.Mesh[]) => meshes.reduce((sum, mesh) => {
  const index = mesh.geometry.getIndex();
  return sum + (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
}, 0);

async function run() {
  console.log('\nAutomatic mechanical watch quality contract');

  const hasRecipe = existsSync(recipeFile);
  const hasModel = existsSync(modelFile);
  const hasContent = existsSync(contentFile);
  const hasTranslation = existsSync(translationFile);
  check('procedural recipe exists', hasRecipe);
  check('production GLB exists', hasModel);
  check('English content exists', hasContent);
  check('Indonesian translation exists', hasTranslation);

  if (!hasRecipe || !hasModel || !hasContent || !hasTranslation) {
    console.error('\nAutomatic mechanical watch feature is incomplete.');
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
  const recipeMeshes: THREE.Mesh[] = [];
  recipeRoot.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) recipeMeshes.push(node as THREE.Mesh);
  });
  const recipeNames = recipeMeshes.map((mesh) => mesh.name).sort();
  check('production GLB has the exact stable teaching mesh list', JSON.stringify(names) === JSON.stringify(expectedMeshes), names.join(', '));
  check('mesh names are unique', new Set(names).size === names.length);
  check('shipped GLB matches the current procedural recipe', JSON.stringify(names) === JSON.stringify(recipeNames));

  const byName = new Map(meshes.map((mesh) => [mesh.name, mesh]));
  const caseSize = bounds(byName.get('case')!).getSize(new THREE.Vector3());
  check('40 mm case is round in plan', Math.abs(caseSize.x - caseSize.z) / Math.max(caseSize.x, caseSize.z) <= 0.08, `x/z ${(caseSize.x / caseSize.z).toFixed(2)}`);
  check('case is shallow rather than cylindrical', caseSize.y / caseSize.x >= 0.14 && caseSize.y / caseSize.x <= 0.38, `depth/diameter ${(caseSize.y / caseSize.x).toFixed(2)}`);

  const dialY = centre(byName.get('dial')!).y;
  const crystalY = centre(byName.get('crystal')!).y;
  const bridgeY = centre(byName.get('movement_bridges')!).y;
  const rotorY = centre(byName.get('automatic_rotor')!).y;
  check('dial sits above the movement', dialY > bridgeY + 0.08, `dial ${dialY.toFixed(2)}, bridges ${bridgeY.toFixed(2)}`);
  check('crystal protects the dial from above', crystalY > dialY + 0.08, `crystal ${crystalY.toFixed(2)}, dial ${dialY.toFixed(2)}`);
  check('automatic rotor sits behind the movement', rotorY < bridgeY - 0.06, `rotor ${rotorY.toFixed(2)}, bridges ${bridgeY.toFixed(2)}`);

  const balance = centre(byName.get('balance_wheel')!);
  const escape = centre(byName.get('escape_wheel')!);
  const escapementDistance = Math.hypot(balance.x - escape.x, balance.z - escape.z);
  check('balance wheel and escape wheel form an adjacent escapement', escapementDistance >= 0.25 && escapementDistance <= 0.72, `${escapementDistance.toFixed(2)} radii`);

  const triangles = triangleCount(meshes);
  const recipeTriangles = triangleCount(recipeMeshes);
  check('detail is substantial without exceeding the mobile budget', triangles >= 18_000 && triangles <= 100_000, `${Math.round(triangles)} triangles`);
  check('shipped GLB geometry is not stale', Math.round(triangles) === Math.round(recipeTriangles), `GLB ${Math.round(triangles)} vs recipe ${Math.round(recipeTriangles)}`);

  const materialNames = new Set(meshes.map((mesh) => (mesh.material as THREE.Material).name.toLowerCase()));
  for (const family of ['glass', 'steel', 'brass', 'ruby']) {
    check(`${family} material family is present`, [...materialNames].some((name) => name.includes(family)), [...materialNames].join(', '));
  }
  check('a wearable strap material is present', [...materialNames].some((name) => name.includes('leather') || name.includes('rubber')), [...materialNames].join(', '));
  const glass = byName.get('crystal')!.material as THREE.MeshStandardMaterial;
  const steel = byName.get('case')!.material as THREE.MeshStandardMaterial;
  const brass = byName.get('centre_wheel')!.material as THREE.MeshStandardMaterial;
  const ruby = byName.get('jewels')!.material as THREE.MeshStandardMaterial;
  check('crystal behaves as transparent glass', glass.transparent && glass.opacity >= 0.12 && glass.opacity <= 0.4 && glass.metalness <= 0.05);
  check('case behaves as brushed steel', steel.metalness >= 0.75 && steel.roughness >= 0.18 && steel.roughness <= 0.48);
  check('gear train behaves as brass', brass.metalness >= 0.75 && brass.roughness >= 0.18 && brass.roughness <= 0.5);
  check('jewels read as polished ruby', ruby.metalness <= 0.15 && ruby.roughness <= 0.3);
  check('production GLB has no texture dependencies', meshes.every((mesh) => {
    const material = mesh.material as THREE.MeshStandardMaterial;
    return !material.map && !material.normalMap && !material.roughnessMap && !material.metalnessMap;
  }));

  const doc = JSON.parse(readFileSync(contentFile, 'utf8'));
  const claimed = doc.parts.flatMap((item: { nodes: string[] }) => item.nodes).sort();
  check('content id and Android-safe model name agree', doc.id === 'mechanical-watch' && doc.model === 'mechanical_watch');
  check('content claims every mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('walkthrough explains a complete automatic movement', doc.steps.length >= 6);
  check('quiz covers enough of the mechanism', doc.quiz.length >= 8);

  const overlay = JSON.parse(readFileSync(translationFile, 'utf8'));
  check('Indonesian overlay covers every teaching part', doc.parts.every((item: { id: string }) => {
    const translated = overlay.parts?.[item.id];
    return Boolean(translated?.name && translated?.short && translated?.detail);
  }));
  check('Indonesian walkthrough and quiz coverage is complete', overlay.steps?.length === doc.steps.length && overlay.quiz?.length === doc.quiz.length);
  const indonesianText = JSON.stringify(overlay).toLowerCase();
  for (const term of ['pegas utama', 'roda pelepas', 'garpu palet', 'roda keseimbangan', 'roda gigi']) {
    check(`Indonesian terminology includes "${term}"`, indonesianText.includes(term));
  }

  if (failures) {
    console.error(`\n${failures} automatic mechanical watch quality check(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAutomatic mechanical watch quality contract passed (${Math.round(triangles)} triangles).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
