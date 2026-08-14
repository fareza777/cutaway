// Builds the prototype .glb assets from the procedural recipes in tools/models.
//
//   npm run build:models
//
// The recipes exist so the whole interaction layer can be finished and tested
// before any artist-made geometry lands. Replacing a prototype later means
// dropping a real .glb into assets/models with the same node names — nothing in
// the app changes.

import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter reads its assembled Blob back through the DOM FileReader API,
// which Node does not provide. Blob itself is global here, so a four-line shim
// is all that stands between us and a .glb.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReaderShim {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      });
    }
  };
}

const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

import smartphone from './models/smartphone.mjs';
import turbofan from './models/turbofan.mjs';
import kidney from './models/kidney.mjs';
import lung from './models/lung.mjs';
import eye from './models/eye.mjs';
import pistonEngine from './models/piston-engine.mjs';
import refrigerator from './models/refrigerator.mjs';
import washingMachine from './models/washing_machine.mjs';
import microwave from './models/microwave.mjs';
import riceCooker from './models/rice_cooker.mjs';
import mechanicalWatch from './models/mechanical_watch.mjs';
import airConditioner from './models/air_conditioner.mjs';
import heart from './models/heart.mjs';
import rocketEngine from './models/rocket_engine.mjs';
import pinTumblerLock from './models/lock.mjs';
import loudspeaker from './models/loudspeaker.mjs';
import hardDisk from './models/hard_disk.mjs';
import electricMotor from './models/electric_motor.mjs';
import differential from './models/differential.mjs';
import camera from './models/camera.mjs';
import violin from './models/violin.mjs';
import brain from './models/brain.mjs';
import innerEar from './models/inner_ear.mjs';
import tooth from './models/tooth.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets/models');

const RECIPES = {
  smartphone,
  turbofan,
  kidney,
  lung,
  eye,
  piston_engine: pistonEngine,
  refrigerator,
  washing_machine: washingMachine,
  microwave,
  rice_cooker: riceCooker,
  mechanical_watch: mechanicalWatch,
  air_conditioner: airConditioner,
  heart,
  rocket_engine: rocketEngine,
  lock: pinTumblerLock,
  loudspeaker,
  hard_disk: hardDisk,
  electric_motor: electricMotor,
  differential,
  camera,
  violin,
  brain,
  inner_ear: innerEar,
  tooth,
};

const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith('-')));

function stats(root) {
  let triangles = 0;
  const names = [];
  root.traverse((node) => {
    if (!node.isMesh) return;
    names.push(node.name);
    const index = node.geometry.getIndex();
    triangles += (index ? index.count : node.geometry.getAttribute('position').count) / 3;
  });
  return { triangles: Math.round(triangles), names };
}

async function exportGlb(name, root) {
  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(root, { binary: true, onlyVisible: false });
  const file = resolve(OUT, `${name}.glb`);
  writeFileSync(file, Buffer.from(buffer));
  return file;
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  let failed = false;
  for (const [name, recipe] of Object.entries(RECIPES)) {
    if (ONLY.size && !ONLY.has(name)) continue;
    try {
      const root = recipe();
      root.name = name;
      root.updateMatrixWorld(true);

      const { triangles, names } = stats(root);
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
      if (duplicates.length) throw new Error(`duplicate node names: ${[...new Set(duplicates)].join(', ')}`);
      if (names.some((n) => !n)) throw new Error('every mesh must be named — it is the key the content JSON binds to');

      const file = await exportGlb(name, root);
      const kb = Math.round(statSync(file).size / 1024);
      console.log(
        `✓ ${name.padEnd(14)} ${String(names.length).padStart(2)} parts  ${String(triangles).padStart(6)} tris  ${String(kb).padStart(4)} KB`,
      );
      console.log(`  ${names.join(', ')}`);
    } catch (error) {
      failed = true;
      console.error(`✗ ${name}: ${error.message}`);
      if (process.env.DEBUG) console.error(error);
    }
  }
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
