// Exercises the engine's geometry layer against the real .glb files.
//
//   npm run smoke
//
// The Assembly is where every interesting invariant lives — parts resolve from
// mesh names, explode offsets land in the right space, motion turns the right
// things about the right axes, taps hit meshes. None of that needs a GPU, so
// none of it should need an emulator to check. Node strips the TypeScript.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Assembly, FIT_SIZE } from '../src/engine/Assembly.ts';
import { OrbitCamera } from '../src/engine/OrbitCamera.ts';
import { ATTENTION, GHOST, partOpacity, type VisibilityState } from '../src/engine/visibility.ts';
import type { ObjectDoc } from '../src/content/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loader = new GLTFLoader();

let failures = 0;
const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);
const check = (label: string, condition: boolean, detail = '') => {
  if (condition) return;
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

function loadDocs(): ObjectDoc[] {
  const dir = resolve(ROOT, 'content');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(resolve(dir, name), 'utf8')) as ObjectDoc)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function build(doc: ObjectDoc) {
  const file = resolve(ROOT, 'assets/models', `${doc.model}.glb`);
  const bytes = readFileSync(file);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await loader.parseAsync(buffer as ArrayBuffer, '');
  return new Assembly(gltf.scene, doc);
}

function boundsOf(object: THREE.Object3D) {
  return new THREE.Box3().setFromObject(object);
}

/**
 * Rules that hold for every object, checked once. Both of these were shipped
 * backwards at some point: the lift pushed the model further behind the sheet
 * that it existed to escape, and focusing on the core ghosted the shells in
 * front of it rather than removing them, so the core stayed veiled. Neither is
 * visible by reading the code, which is why they are asserted here.
 */
function checkRules() {
  console.log('\nEngine rules');

  const orbit = new OrbitCamera(45, 0.5);
  const settle = (lift: number) => {
    orbit.setLift(lift);
    for (let i = 0; i < 400; i += 1) orbit.update(1 / 60, Number.POSITIVE_INFINITY);
    return new THREE.Vector3(0, 0, 0).project(orbit.camera).y;
  };
  const rest = settle(0);
  const lifted = settle(1);
  check(
    'a positive lift raises the subject on screen',
    lifted > rest + 0.05,
    `centre moved ${rest.toFixed(2)} -> ${lifted.toFixed(2)} (higher is up)`,
  );

  const state = (over: Partial<VisibilityState> = {}): VisibilityState => ({
    peel: 0,
    xray: false,
    isolate: false,
    focus: null,
    focusFloor: 0,
    subject: null,
    ...over,
  });
  const focusCore = state({ focus: new Set(['core']), focusFloor: 2 });
  check('focusing hides the shells in front of the focus', partOpacity({ id: 'shell', layer: 0 }, focusCore) === 0);
  check('focusing keeps the focused part solid', partOpacity({ id: 'core', layer: 2 }, focusCore) === 1);
  check(
    'focusing ghosts what is level with or below the focus',
    partOpacity({ id: 'deeper', layer: 3 }, focusCore) === GHOST,
  );
  const focusOuter = state({ focus: new Set(['shell']), focusFloor: 0 });
  check(
    'focusing the outer layer removes nothing',
    partOpacity({ id: 'core', layer: 2 }, focusOuter) === GHOST && partOpacity({ id: 'shell', layer: 0 }, focusOuter) === 1,
  );
  check('peel still wins over focus', partOpacity({ id: 'shell', layer: 0 }, state({ peel: 1, focus: new Set(['core']), focusFloor: 2 })) === 0);

  // A resting opacity is how a part that encloses everything else — the heart's
  // pericardium — stays anatomically whole without hiding the organ. Cutting
  // such a part down until it is out of the way teaches something false.
  const sac = { id: 'sac', layer: 0, opacity: 0.15 };
  check('a resting opacity is honoured at rest', Math.abs(partOpacity(sac, state()) - 0.15) < 1e-9);
  check('selecting a see-through part brings it up', partOpacity(sac, state({ subject: 'sac' })) === ATTENTION);
  check('focusing a see-through part brings it up', partOpacity(sac, state({ focus: new Set(['sac']), focusFloor: 0 })) === ATTENTION);
  check('a see-through part still ghosts', partOpacity(sac, state({ subject: 'other' })) < GHOST);
  check('a see-through part still peels away', partOpacity(sac, state({ peel: 1 })) === 0);
  check('an ordinary part is unaffected', partOpacity({ id: 'plain', layer: 0 }, state()) === 1);

  if (!failures) console.log('  ✓ camera and visibility rules hold');
}

async function run() {
  checkRules();

  for (const doc of loadDocs()) {
    console.log(`\n${doc.title} (${doc.id})`);
    const assembly = await build(doc);

    // --- indexing -------------------------------------------------------
    check('every part resolves to geometry', assembly.parts.length === doc.parts.length, `${assembly.parts.length}/${doc.parts.length}`);
    check('parts own at least one mesh', assembly.parts.every((part) => part.meshes.length > 0));
    check('materials are cloned per part', new Set(assembly.parts.flatMap((p) => p.materials)).size === assembly.parts.flatMap((p) => p.materials).length);

    // --- normalisation --------------------------------------------------
    // The rest rotation inflates a world-space box, so undo it for the
    // measurement: what is being checked is the scale the Assembly applied,
    // not how the object happens to be posed.
    const posed = assembly.root.rotation.clone();
    assembly.root.rotation.set(0, 0, 0);
    assembly.root.updateMatrixWorld(true);
    const size = boundsOf(assembly.root).getSize(new THREE.Vector3());
    assembly.root.rotation.copy(posed);
    assembly.root.updateMatrixWorld(true);

    const longest = Math.max(size.x, size.y, size.z);
    check('normalised into the fit cube', Math.abs(longest - FIT_SIZE) < 0.2, `longest edge ${longest.toFixed(2)} vs ${FIT_SIZE}`);

    // --- explode --------------------------------------------------------
    const assembled = boundsOf(assembly.root).getSize(new THREE.Vector3()).length();
    assembly.setExplode(1);
    assembly.refreshWorld();
    const exploded = boundsOf(assembly.root).getSize(new THREE.Vector3()).length();
    check('exploding grows the object', exploded > assembled * 1.15, `${assembled.toFixed(2)} → ${exploded.toFixed(2)}`);

    const moved = assembly.parts.filter((part) => part.group.position.distanceTo(part.base) > 1e-4);
    check('every part moves when exploded', moved.length === assembly.parts.length, `${moved.length}/${assembly.parts.length}`);

    // Fully exploded, no two parts should still be inside one another — the
    // whole point of the tool is that every piece becomes separately visible.
    assembly.setExplode(1);
    assembly.refreshWorld();
    const boxes = assembly.parts.map((part) => {
      const b = new THREE.Box3();
      part.meshes.forEach((mesh) => {
        mesh.updateWorldMatrix(true, false);
        b.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
      });
      return { id: part.def.id, box: b };
    });
    const collisions: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (boxes[i].box.intersectsBox(boxes[j].box)) collisions.push(`${boxes[i].id}/${boxes[j].id}`);
      }
    }
    // Bounding boxes are a blunt instrument here: a hollow shell's box encloses
    // the space inside it, and a ring's box encloses its hole, so a part that
    // is plainly visible can still register as "overlapping". A handful of such
    // pairs is expected and is reported rather than failed; a pile of them
    // means the solver has stopped working, which is what this is guarding.
    if (collisions.length) {
      warn(`${doc.id}: ${collisions.length} exploded pair(s) still box-overlap — ${collisions.slice(0, 4).join(' ')}`);
    }
    check('explode separates the object', collisions.length <= assembly.parts.length / 4, `${collisions.length} pairs`);

    assembly.setExplode(0);
    assembly.refreshWorld();
    const back = assembly.parts.every((part) => part.group.position.distanceTo(part.base) < 1e-6);
    check('collapsing returns parts to rest', back);

    // --- motion ---------------------------------------------------------
    const movers = assembly.parts.filter((part) => part.def.motion && Object.keys(part.def.motion).length);
    check('hasMotion agrees with the content', assembly.hasMotion === movers.length > 0);

    if (movers.length) {
      const rest = movers.map((part) => ({
        pos: part.group.position.clone(),
        quat: part.group.quaternion.clone(),
      }));

      // Pressing play must not snap the model: angle 0 has to be the pose the
      // model was authored in.
      assembly.setExplode(0);
      assembly.setCycle(0);
      assembly.refreshWorld();
      const still = movers.every(
        (part, index) =>
          part.group.position.distanceTo(rest[index].pos) < 1e-6 &&
          part.group.quaternion.angleTo(rest[index].quat) < 1e-6,
      );
      check('cycle 0 is the rest pose', still);

      // Sample a whole revolution — testing one angle can land on a zero
      // crossing and report a moving part as stationary.
      const travel = movers.map(() => ({ shift: 0, turn: 0 }));
      for (let step = 1; step <= 12; step += 1) {
        assembly.setExplode(0);
        assembly.setCycle((step / 12) * Math.PI * 2);
        assembly.refreshWorld();
        movers.forEach((part, index) => {
          travel[index].shift = Math.max(travel[index].shift, part.group.position.distanceTo(rest[index].pos));
          travel[index].turn = Math.max(travel[index].turn, part.group.quaternion.angleTo(rest[index].quat));
        });
      }

      movers.forEach((part, index) => {
        const spec = part.def.motion!;
        if (spec.spin || spec.swing) check(`${part.def.id} rotates`, travel[index].turn > 1e-3, `max ${travel[index].turn.toFixed(4)} rad`);
        if (spec.slide) check(`${part.def.id} slides`, travel[index].shift > 1e-3, `max ${travel[index].shift.toFixed(4)}`);
      });

      // A full turn of the crank must bring a 1:1 spinner back to where it began.
      assembly.setExplode(0);
      assembly.setCycle(Math.PI * 2);
      assembly.refreshWorld();
      const unity = movers.find((part) => part.def.motion?.spin?.ratio === 1);
      if (unity) {
        const angle = unity.group.quaternion.angleTo(new THREE.Quaternion());
        check('a 1:1 spinner returns to zero after one revolution', angle < 1e-3, `${angle.toFixed(4)} rad`);
      }
      assembly.clearMotion();
      assembly.setExplode(0);
      assembly.refreshWorld();
    }

    // --- visibility -----------------------------------------------------
    const first = assembly.parts[0];
    assembly.setOpacity(first, 0);
    check('a zero-opacity part is hidden', first.meshes.every((mesh) => !mesh.visible));
    assembly.setOpacity(first, 0.14);
    check('a ghosted part stays drawn but does not write depth', first.meshes.every((m) => m.visible) && first.materials.every((m) => m.transparent && !m.depthWrite));
    assembly.setOpacity(first, 1);
    check('a solid part writes depth again', first.materials.every((m) => !m.transparent && m.depthWrite));

    // --- clipping -------------------------------------------------------
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    assembly.setClipping([plane]);
    check('clipping reaches every material', assembly.parts.every((p) => p.materials.every((m) => m.clippingPlanes?.length === 1)));
    assembly.setClipping(null);
    check('clipping clears', assembly.parts.every((p) => p.materials.every((m) => m.clippingPlanes === null)));

    // --- picking --------------------------------------------------------
    // Fire a ray at each part's centre from far outside the object; something
    // must be hit every time, or tapping the model would feel dead.
    const raycaster = new THREE.Raycaster();
    const missed: string[] = [];
    for (const part of assembly.parts) {
      const from = part.world.clone().add(new THREE.Vector3(0, 0, FIT_SIZE * 4));
      raycaster.set(from, new THREE.Vector3(0, 0, -1));
      if (!assembly.raycast(raycaster)) missed.push(part.def.id);
    }
    // Naming the offender matters: a part whose centre sits in empty space puts
    // its hotspot dot in mid-air, and the only way to know which one is to say.
    check(
      'a ray through each part centre hits geometry',
      missed.length === 0,
      missed.length ? `missed: ${missed.join(', ')}` : '',
    );

    // --- layers ---------------------------------------------------------
    check('layers start at 0', assembly.parts.some((part) => part.def.layer === 0));
    check('maxLayer matches the content', assembly.maxLayer === Math.max(...doc.parts.map((p) => p.layer)));

    // --- teardown -------------------------------------------------------
    assembly.dispose();
    check('dispose empties the index', assembly.parts.length === 0 && assembly.byId.size === 0);

    if (!failures) console.log(`  ✓ ${assembly ? doc.parts.length : 0} parts, all checks passed`);
  }

  console.log('');
  warnings.forEach((message) => console.warn(`⚠ ${message}`));
  if (failures) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('Engine smoke test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
