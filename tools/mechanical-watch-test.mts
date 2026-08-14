import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';

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

const fingerprint = (mesh: THREE.Mesh) => {
  const hash = createHash('sha256');
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  hash.update(mesh.name);
  hash.update(Array.from(position.array as ArrayLike<number>, (value) => Number(value).toFixed(6)).join(','));
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
};

const radialExtentAt = (mesh: THREE.Mesh, cx: number, cz: number, sampleY: number) => {
  const position = mesh.geometry.getAttribute('position');
  let radius = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getY(index) - sampleY) > 0.004) continue;
    radius = Math.max(radius, Math.hypot(position.getX(index) - cx, position.getZ(index) - cz));
  }
  return radius;
};

const localRadialEnvelopeAt = (mesh: THREE.Mesh, cx: number, cz: number, sampleY: number, limit: number) => {
  const position = mesh.geometry.getAttribute('position');
  const radii: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getY(index) - sampleY) > 0.004) continue;
    const distance = Math.hypot(position.getX(index) - cx, position.getZ(index) - cz);
    if (distance <= limit) radii.push(distance);
  }
  radii.sort((a, b) => a - b);
  return radii[Math.floor((radii.length - 1) * 0.75)] ?? Number.NEGATIVE_INFINITY;
};

const annularVertexCountAt = (mesh: THREE.Mesh, cx: number, cz: number, sampleY: number, radius: number) => {
  const position = mesh.geometry.getAttribute('position');
  let count = 0;
  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getY(index) - sampleY) > 0.004) continue;
    const distance = Math.hypot(position.getX(index) - cx, position.getZ(index) - cz);
    if (distance >= radius * 0.7 && distance <= radius * 1.15) count += 1;
  }
  return count;
};

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

  const doc = JSON.parse(readFileSync(contentFile, 'utf8'));

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
  const productionFingerprints = new Map(meshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const recipeFingerprints = new Map(recipeMeshes.map((mesh) => [mesh.name, fingerprint(mesh)]));
  const fingerprintMismatches = names.filter((name) => productionFingerprints.get(name) !== recipeFingerprints.get(name));
  check('production geometry and materials fingerprint-match the recipe', fingerprintMismatches.length === 0, fingerprintMismatches.join(', '));

  const byName = new Map(meshes.map((mesh) => [mesh.name, mesh]));
  const caseSize = bounds(byName.get('case')!).getSize(new THREE.Vector3());
  check('40 mm case is round in plan', Math.abs(caseSize.x - caseSize.z) / Math.max(caseSize.x, caseSize.z) <= 0.08, `x/z ${(caseSize.x / caseSize.z).toFixed(2)}`);
  check('case is shallow rather than cylindrical', caseSize.y / caseSize.x >= 0.14 && caseSize.y / caseSize.x <= 0.38, `depth/diameter ${(caseSize.y / caseSize.x).toFixed(2)}`);
  const shellBox = new THREE.Box3();
  for (const name of ['case', 'bezel', 'crystal', 'caseback']) shellBox.union(bounds(byName.get(name)!));
  const shellSize = shellBox.getSize(new THREE.Vector3());
  const physicalThickness = (shellSize.y / caseSize.x) * 40;
  check('closed 40 mm shell is realistically about 11 mm thick', physicalThickness >= 10.4 && physicalThickness <= 11.6, `${physicalThickness.toFixed(1)} mm`);

  const dialY = centre(byName.get('dial')!).y;
  const crystalY = centre(byName.get('crystal')!).y;
  const bridgeY = centre(byName.get('movement_bridges')!).y;
  const rotorY = centre(byName.get('automatic_rotor')!).y;
  check('dial sits above the movement', dialY > bridgeY + 0.08, `dial ${dialY.toFixed(2)}, bridges ${bridgeY.toFixed(2)}`);
  check('crystal protects the dial from above', crystalY > dialY + 0.08, `crystal ${crystalY.toFixed(2)}, dial ${dialY.toFixed(2)}`);
  check('automatic rotor sits behind the movement', rotorY < bridgeY - 0.06, `rotor ${rotorY.toFixed(2)}, bridges ${bridgeY.toFixed(2)}`);
  const rotorBox = bounds(byName.get('automatic_rotor')!);
  const casebackBox = bounds(byName.get('caseback')!);
  const rotorClearance = rotorBox.min.y - casebackBox.max.y;
  check('automatic rotor clears the inside of the caseback', rotorClearance >= 0.012, `${rotorClearance.toFixed(3)} model units`);

  const balance = centre(byName.get('balance_wheel')!);
  const escape = centre(byName.get('escape_wheel')!);
  const escapementDistance = Math.hypot(balance.x - escape.x, balance.z - escape.z);
  check('balance wheel and escape wheel form an adjacent escapement', escapementDistance >= 0.25 && escapementDistance <= 0.72, `${escapementDistance.toFixed(2)} radii`);
  const expectedBalancePivot = new THREE.Vector3(0.46, 0.105, -0.4);
  const balanceBox = bounds(byName.get('balance_wheel')!);
  const balanceCentre = balanceBox.getCenter(new THREE.Vector3());
  const balanceSize = balanceBox.getSize(new THREE.Vector3());
  check(
    'balance rim and weights are concentric with the balance arbor',
    Math.hypot(balanceCentre.x - expectedBalancePivot.x, balanceCentre.z - expectedBalancePivot.z) <= 0.012,
    `centre ${balanceCentre.x.toFixed(3)}, ${balanceCentre.z.toFixed(3)}`,
  );
  check(
    'balance wheel has one coherent roughly 0.54-diameter rim',
    balanceSize.x >= 0.5 && balanceSize.x <= 0.57 && balanceSize.z >= 0.5 && balanceSize.z <= 0.57 && Math.abs(balanceSize.x - balanceSize.z) <= 0.015,
    `x ${balanceSize.x.toFixed(3)}, z ${balanceSize.z.toFixed(3)}`,
  );

  const gearStages = [
    { label: 'barrel to centre pinion', a: 'mainspring_barrel', ac: [-0.42, 0.24], aPitch: 0.309063, aTeeth: 54, b: 'centre_wheel', bc: [-0.05, 0.1], bPitch: 0.103021, bTeeth: 18, y: -0.054 },
    { label: 'centre wheel to third pinion', a: 'centre_wheel', ac: [-0.05, 0.1], aPitch: 0.239759, aTeeth: 64, b: 'third_wheel', bc: [0.205, 0.055], bPitch: 0.02997, bTeeth: 8, y: -0.009 },
    { label: 'third wheel to fourth pinion', a: 'third_wheel', ac: [0.205, 0.055], aPitch: 0.194378, aTeeth: 60, b: 'fourth_wheel', bc: [0.18, -0.155], bPitch: 0.025917, bTeeth: 8, y: 0.031 },
    { label: 'fourth wheel to escape pinion', a: 'fourth_wheel', ac: [0.18, -0.155], aPitch: 0.15836, aTeeth: 36, b: 'escape_wheel', bc: [0.01, -0.23], bPitch: 0.035191, bTeeth: 8, y: 0.071 },
  ];
  for (const stage of gearStages) {
    const [ax, az] = stage.ac;
    const [bx, bz] = stage.bc;
    const aRadius = radialExtentAt(byName.get(stage.a)!, ax, az, stage.y);
    const bRadius = radialExtentAt(byName.get(stage.b)!, bx, bz, stage.y);
    const centreDistance = Math.hypot(ax - bx, az - bz);
    const meshDepth = aRadius + bRadius - centreDistance;
    check(
      `${stage.label} teeth visibly engage on a shared plane`,
      Number.isFinite(meshDepth) && meshDepth >= -0.012 && meshDepth <= 0.025,
      `engagement ${meshDepth.toFixed(3)}`,
    );
    check(
      `${stage.label} uses the authored external pitch radii`,
      Math.abs(aRadius / 0.97 - stage.aPitch) <= 0.008 && Math.abs(bRadius / 0.97 - stage.bPitch) <= 0.008,
      `pitch ${(aRadius / 0.97).toFixed(4)} / ${(bRadius / 0.97).toFixed(4)}`,
    );
    check(
      `${stage.label} pitch radii agree with tooth-count ratio`,
      Math.abs(stage.aPitch / stage.aTeeth - stage.bPitch / stage.bTeeth) <= 0.00008,
      `module ${(stage.aPitch / stage.aTeeth).toFixed(6)} / ${(stage.bPitch / stage.bTeeth).toFixed(6)}`,
    );
    const aRatio = doc.parts.find((part: { id: string }) => part.id === stage.a)?.motion?.spin?.ratio;
    const bRatio = doc.parts.find((part: { id: string }) => part.id === stage.b)?.motion?.spin?.ratio;
    check(
      `${stage.label} counter-rotates at runtime`,
      typeof aRatio === 'number' && typeof bRatio === 'number' && Math.sign(aRatio) === -Math.sign(bRatio),
      `ratios ${aRatio} / ${bRatio}`,
    );
    const tangentialMismatch = Math.abs(Math.abs(aRatio ?? 0) * stage.aPitch - Math.abs(bRatio ?? 0) * stage.bPitch);
    check(
      `${stage.label} has equal pitch-line speed`,
      tangentialMismatch <= 0.000002,
      `mismatch ${tangentialMismatch.toFixed(7)}`,
    );
  }
  const centreRatio = doc.parts.find((part: { id: string }) => part.id === 'centre_wheel')?.motion?.spin?.ratio;
  const fourthRatio = doc.parts.find((part: { id: string }) => part.id === 'fourth_wheel')?.motion?.spin?.ratio;
  check('centre wheel remains the one-per-hour train reference', Math.abs(centreRatio - 1 / 60) <= 0.000001, `${centreRatio}`);
  check('fourth wheel remains directly synchronized with seconds', Math.abs(fourthRatio - 1) <= 0.000001, `${fourthRatio}`);

  const rotorPinionExtent = localRadialEnvelopeAt(byName.get('automatic_rotor')!, 0, 0, -0.146, 0.08);
  const reversingWheelExtent = localRadialEnvelopeAt(byName.get('movement_bridges')!, -0.13, -0.02, -0.146, 0.1);
  const clutchGap = Math.hypot(0.13, 0.02) - rotorPinionExtent - reversingWheelExtent;
  check(
    'swinging rotor pickup has a visible clutch gap from the stationary reversing train',
    clutchGap >= 0.025,
    `${clutchGap.toFixed(3)} model units`,
  );

  const transmissionChecks = [
    { mesh: 'automatic_rotor', x: 0, z: 0, radius: 0.035 },
    { mesh: 'movement_bridges', x: -0.13, z: -0.02, radius: 0.065 },
    { mesh: 'movement_bridges', x: -0.255, z: 0.035, radius: 0.075 },
    { mesh: 'movement_bridges', x: -0.36, z: 0.13, radius: 0.07 },
    { mesh: 'winding_stem', x: 0.3, z: 0.1, radius: 0.11 },
    { mesh: 'winding_stem', x: 0.12, z: 0.19, radius: 0.1 },
    { mesh: 'winding_stem', x: -0.06, z: 0.27, radius: 0.1 },
    { mesh: 'winding_stem', x: -0.25, z: 0.29, radius: 0.1 },
    { mesh: 'mainspring_barrel', x: -0.42, z: 0.24, radius: 0.075 },
  ];
  for (const transmission of transmissionChecks) {
    const annularVertices = annularVertexCountAt(byName.get(transmission.mesh)!, transmission.x, transmission.z, -0.114, transmission.radius);
    check(
      `${transmission.mesh} carries visible winding transmission at ${transmission.x}, ${transmission.z}`,
      annularVertices >= 12,
      `${annularVertices} annular vertices`,
    );
  }

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

  const claimed = doc.parts.flatMap((item: { nodes: string[] }) => item.nodes).sort();
  check('content id and Android-safe model name agree', doc.id === 'mechanical-watch' && doc.model === 'mechanical_watch');
  check('content claims every mesh exactly once', JSON.stringify(claimed) === JSON.stringify(names));
  check('walkthrough explains a complete automatic movement', doc.steps.length >= 6);
  check('quiz covers enough of the mechanism', doc.quiz.length >= 8);

  const validatorFixture = mkdtempSync(resolve(tmpdir(), 'cutaway-pivot-only-'));
  try {
    mkdirSync(resolve(validatorFixture, 'tools'));
    mkdirSync(resolve(validatorFixture, 'content'));
    mkdirSync(resolve(validatorFixture, 'assets/models'), { recursive: true });
    cpSync(resolve(ROOT, 'tools/validate-content.mjs'), resolve(validatorFixture, 'tools/validate-content.mjs'));
    cpSync(modelFile, resolve(validatorFixture, 'assets/models/mechanical_watch.glb'));
    writeFileSync(resolve(validatorFixture, 'content/pivot-only.json'), JSON.stringify({
      schema: 1,
      id: 'pivot-only',
      title: 'Pivot only',
      subtitle: 'Invalid motion fixture',
      category: 'Test',
      accent: '#ffffff',
      summary: 'A validator fixture.',
      model: 'mechanical_watch',
      cutAxis: 'y',
      parts: [{
        id: 'case', nodes: ['case'], name: 'Case', short: 'Case', detail: 'Case', layer: 0,
        motion: { pivot: [0, 0, 0] },
      }],
      steps: [],
      quiz: [],
    }));
    const validation = spawnSync(process.execPath, ['tools/validate-content.mjs'], {
      cwd: validatorFixture,
      encoding: 'utf8',
    });
    check(
      'content validator rejects a pivot without a motion driver',
      validation.status === 1 && validation.stderr.includes('motion pivot requires spin, swing, or slide'),
      `exit ${validation.status}`,
    );
  } finally {
    rmSync(validatorFixture, { recursive: true, force: true });
  }

  const expectedPivots: Record<string, [number, number, number]> = {
    hour_hand: [0, 0.208, 0],
    minute_hand: [0, 0.22, 0],
    seconds_hand: [0, 0.232, 0],
    automatic_rotor: [0, -0.17, 0],
    mainspring_barrel: [-0.42, -0.07, 0.24],
    centre_wheel: [-0.05, -0.025, 0.1],
    third_wheel: [0.205, 0.015, 0.055],
    fourth_wheel: [0.18, 0.055, -0.155],
    escape_wheel: [0.01, 0.095, -0.23],
    pallet_fork: [0.28, 0.11, -0.31],
    balance_wheel: [0.46, 0.105, -0.4],
    hairspring: [0.46, 0.14, -0.4],
  };
  for (const [id, pivot] of Object.entries(expectedPivots)) {
    check(`${id} declares its real arbor as the motion pivot`, JSON.stringify(doc.parts.find((item: { id: string }) => item.id === id)?.motion?.pivot) === JSON.stringify(pivot));
  }

  const runtimeRoot = (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene;
  const rawBox = new THREE.Box3().setFromObject(runtimeRoot);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const rawCentre = rawBox.getCenter(new THREE.Vector3());
  const runtimeScale = FIT_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z, 1e-4);
  const assembly = new Assembly(runtimeRoot, doc);
  for (const [id, authored] of Object.entries(expectedPivots)) {
    const handle = assembly.byId.get(id)!;
    const expectedBase = new THREE.Vector3(...authored).sub(rawCentre).multiplyScalar(runtimeScale);
    check(`${id} runtime group is centred on its authored arbor`, handle.base.distanceTo(expectedBase) <= 1e-5, `${handle.base.distanceTo(expectedBase).toFixed(6)} units`);
    assembly.setExplode(0);
    assembly.setCycle(0);
    assembly.refreshWorld();
    const restArbor = handle.group.getWorldPosition(new THREE.Vector3());
    let maxDrift = 0;
    for (const angle of [0.37, 1.23, 2.61, 4.4]) {
      assembly.setExplode(0);
      assembly.setCycle(angle);
      assembly.refreshWorld();
      maxDrift = Math.max(maxDrift, handle.group.getWorldPosition(new THREE.Vector3()).distanceTo(restArbor));
    }
    check(`${id} arbor world position stays invariant through motion`, maxDrift <= 1e-6, `${maxDrift.toFixed(6)} units`);
  }
  assembly.dispose();

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
