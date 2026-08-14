/**
 * An object, indexed by part.
 *
 * The whole design turns on one decision: parts are identified by mesh name in
 * the .glb, not by coordinates in the content file. Everything an interaction
 * needs — where a hotspot floats, which way a part explodes, what the camera
 * should frame, what a tap hit — is derived from the geometry itself. Authoring
 * a new object is therefore naming meshes and writing prose, with no numbers to
 * tune by hand.
 *
 * Each part is re-parented into its own group. The default origin is its
 * bounding-box centre; mechanisms may author an explicit pivot where a real
 * arbor or hinge is offset from that box centre.
 */

import * as THREE from 'three';
import type { ObjectDoc, Part, Vec3 } from '@/content/types';

/** Edge length every object is normalised into, so tuning is object-independent. */
export const FIT_SIZE = 3.4;

const AXES: Record<'x' | 'y' | 'z', THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export type PartHandle = {
  def: Part;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  materials: THREE.MeshStandardMaterial[];
  /** Rest position of the group, in model space. */
  base: THREE.Vector3;
  /** Bounding-sphere radius in world units after normalisation. */
  radius: number;
  /** Explode offset at full strength, in model space. Solved, not authored. */
  explode: THREE.Vector3;
  /** The part's bounding box at rest, in the assembly's own space. */
  restBox: THREE.Box3;
  /**
   * A point on the part's own surface, in group space, used to place the
   * hotspot and to aim the camera when the part is selected.
   *
   * Not the bounding-box centre. That centre falls in empty space for anything
   * hollow, ring-shaped or paired: the lungs' alveoli are one part covering both
   * sides, so its box centre sat in the middle of the chest between them, and
   * the dot floated in mid-air where there was nothing to tap.
   */
  anchor: THREE.Vector3;
  /** Live world-space anchor, refreshed each frame the assembly moves. */
  world: THREE.Vector3;
};

/**
 * The vertex closest to the group's origin — i.e. the point of the part's own
 * geometry nearest its bounding-box centre. Runs once per part at load.
 */
function nearestVertex(meshes: THREE.Mesh[]): THREE.Vector3 {
  const best = new THREE.Vector3();
  const point = new THREE.Vector3();
  let closest = Infinity;
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position');
    // Sampling rather than scanning: a few hundred candidates is plenty to land
    // on the surface, and some of these meshes carry tens of thousands.
    const step = Math.max(1, Math.floor(position.count / 400));
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
      const d = point.lengthSq();
      if (d < closest) {
        closest = d;
        best.copy(point);
      }
    }
  }
  return best;
}

export class Assembly {
  readonly root = new THREE.Group();
  readonly parts: PartHandle[] = [];
  readonly byId = new Map<string, PartHandle>();
  readonly maxLayer: number;
  readonly hasMotion: boolean;

  private scale: number;
  private clipPlanes: THREE.Plane[] | null = null;
  /** Furthest any part travels at full explode, in normalised units. */
  explodeSpread = 0;

  constructor(scene: THREE.Object3D, doc: ObjectDoc) {
    // Normalise into a fixed cube so camera limits, explode distances and
    // hotspot sizes mean the same thing for a phone and a jet engine.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    this.scale = FIT_SIZE / Math.max(size.x, size.y, size.z, 1e-4);
    scene.scale.setScalar(this.scale);
    scene.position.copy(centre).multiplyScalar(-this.scale);

    this.root.name = `assembly:${doc.id}`;
    this.root.add(scene);
    if (doc.restRotation) this.root.rotation.set(...doc.restRotation);
    this.root.updateMatrixWorld(true);

    const meshesByName = new Map<string, THREE.Mesh>();
    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) meshesByName.set(node.name, node as THREE.Mesh);
    });

    for (const def of doc.parts) {
      const meshes = def.nodes.map((name) => meshesByName.get(name)).filter(Boolean) as THREE.Mesh[];
      if (!meshes.length) continue; // validate-content guards this; skip rather than crash a release build.
      const motionPivot = def.motion?.pivot
        ? this.root.worldToLocal(scene.localToWorld(new THREE.Vector3(...def.motion.pivot)))
        : undefined;
      this.parts.push(this.buildPart(def, meshes, motionPivot));
    }

    this.solveExplode();
    this.maxLayer = this.parts.reduce((max, part) => Math.max(max, part.def.layer), 0);
    this.hasMotion = this.parts.some((part) => part.def.motion && Object.keys(part.def.motion).length > 0);
    this.parts.forEach((part) => this.byId.set(part.def.id, part));
    this.refreshWorld();
  }

  private buildPart(def: Part, meshes: THREE.Mesh[], motionPivot?: THREE.Vector3): PartHandle {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    }
    // Bounds are in world space; the assembly may already be rotated, so bring
    // the centre back into the space the group will live in.
    const centre = this.root.worldToLocal(bounds.getCenter(new THREE.Vector3()));
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;

    const origin = motionPivot ?? centre;
    const group = new THREE.Group();
    group.name = `part:${def.id}`;
    group.position.copy(origin);
    this.root.add(group);
    group.updateMatrixWorld(true);
    // attach() preserves each mesh's world transform while re-parenting, so
    // this works for artist models with arbitrary node hierarchies too.
    meshes.forEach((mesh) => group.attach(mesh));

    const materials: THREE.MeshStandardMaterial[] = [];
    for (const mesh of meshes) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // Cloning guarantees a part owns its material even when the source file
      // shares one between parts — isolate and x-ray depend on that.
      const cloned = list.map((material) => {
        const copy = (material as THREE.MeshStandardMaterial).clone();
        // Front faces only until a cut is actually made. DoubleSide disables
        // backface culling, so every closed part costs twice the fragments for
        // surfaces nobody can see — on a full-resolution phone screen that is
        // the cheapest waste there is to remove. setClipping turns it back on
        // for the one tool that genuinely needs to see inside a wall.
        copy.side = THREE.FrontSide;
        copy.envMapIntensity = 0.5;
        copy.roughness = THREE.MathUtils.clamp(copy.roughness, 0.12, 0.92);
        materials.push(copy);
        return copy;
      });
      mesh.material = cloned.length === 1 ? cloned[0] : cloned;
    }

    // The box in the assembly's own frame, which is where explode maths runs.
    const restBox = new THREE.Box3();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      restBox.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    }
    const inverse = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    restBox.applyMatrix4(inverse);

    return {
      def,
      group,
      meshes,
      materials,
      base: origin.clone(),
      radius,
      explode: this.explodeVector(def, centre),
      restBox,
      anchor: nearestVertex(meshes),
      world: new THREE.Vector3(),
    };
  }

  /**
   * Works out how far each part has to travel so that nothing overlaps.
   *
   * The content file says which *way* a part should go — that is art direction
   * and worth authoring. How *far* is not: it depends on the size of the part,
   * the size of its neighbours and how crowded the object is, and getting it
   * right by hand across ninety parts is exactly the kind of tuning this
   * project set out to avoid. Measured, every object still had parts buried
   * inside each other at full explode; the washing machine had thirty-seven
   * overlapping pairs.
   *
   * So: keep the authored direction, then push each part out until the boxes
   * come apart. A few dozen iterations over a dozen parts, once per load.
   */
  private solveExplode() {
    const step = (FIT_SIZE * 0.05) / this.scale;
    const ceiling = (FIT_SIZE * 3) / this.scale;

    const dirs = this.parts.map((part) => {
      const d = part.explode.clone();
      if (d.lengthSq() < 1e-9) d.set(0, 1, 0);
      return d.normalize();
    });
    // Start from whatever the author asked for; never retreat below it.
    const distances = this.parts.map((part) => part.explode.length());
    const boxes = this.parts.map(() => new THREE.Box3());

    // How far a part reaches along its own direction — half its box, projected.
    const reach = this.parts.map((part, i) => {
      const size = part.restBox.getSize(new THREE.Vector3());
      const d = dirs[i];
      return (Math.abs(d.x) * size.x + Math.abs(d.y) * size.y + Math.abs(d.z) * size.z) / 2;
    });

    // Lay out parts that share a direction as a queue along it, before any
    // relaxation. Nudging them apart iteratively cannot work — they travel in
    // convoy, and once they reach the distance cap they are stuck level with
    // each other forever. Spacing them by their own extents is exact and needs
    // no iteration at all.
    // Cluster by how close the directions actually are, not by an exact key.
    // Two parts heading out at four degrees to each other are still a convoy,
    // and quantising their vectors filed them under different keys.
    const groups: { dir: THREE.Vector3; members: number[] }[] = [];
    dirs.forEach((d, i) => {
      const found = groups.find((g) => g.dir.dot(d) > 0.93);
      if (found) found.members.push(i);
      else groups.push({ dir: d.clone(), members: [i] });
    });

    const gap = (FIT_SIZE * 0.08) / this.scale;
    for (const { members: indices } of groups) {
      if (indices.length < 2) continue;
      // Preserve the order they already sit in along that axis, so a stack
      // comes apart in the order it was assembled.
      indices.sort(
        (a, b) =>
          this.parts[a].restBox.getCenter(new THREE.Vector3()).dot(dirs[a]) -
          this.parts[b].restBox.getCenter(new THREE.Vector3()).dot(dirs[b]),
      );
      let running = 0;
      for (const i of indices) {
        distances[i] = Math.max(distances[i], running + reach[i] + gap);
        running = distances[i] + reach[i] + gap;
      }
    }

    // Volume breaks ties: given two parts that want to go the same way, it is
    // the smaller one that should travel further, which reads as the inner
    // component being drawn out of its housing.
    const volume = this.parts.map((part) => {
      const size = part.restBox.getSize(new THREE.Vector3());
      return size.x * size.y * size.z;
    });

    const offset = new THREE.Vector3();
    for (let iteration = 0; iteration < 900; iteration += 1) {
      this.parts.forEach((part, i) => {
        offset.copy(dirs[i]).multiplyScalar(distances[i]);
        boxes[i].copy(part.restBox).translate(offset);
      });

      let clashed = false;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (!boxes[i].intersectsBox(boxes[j])) continue;
          clashed = true;
          // Move only one of the pair. Pushing both keeps parts that share a
          // direction — a drum inside its tub, a fan behind its spinner —
          // travelling in convoy, never actually coming apart.
          let pick =
            distances[i] !== distances[j]
              ? distances[i] > distances[j]
                ? i
                : j
              : volume[i] <= volume[j]
                ? i
                : j;
          if (distances[pick] >= ceiling) pick = pick === i ? j : i;
          if (distances[pick] < ceiling) distances[pick] += step;
        }
      }
      if (!clashed) break;
    }

    this.parts.forEach((part, i) => {
      part.explode.copy(dirs[i]).multiplyScalar(distances[i]);
    });
    this.explodeSpread = Math.max(...distances) * this.scale;
  }

  /**
   * Content authors give explode offsets in normalised units — the same space
   * FIT_SIZE defines — so a value reads the same for any object. Undo the model
   * scale to express that inside the model's own coordinate system.
   */
  private explodeVector(def: Part, centre: THREE.Vector3): THREE.Vector3 {
    if (def.explode) {
      return new THREE.Vector3(...(def.explode as Vec3)).multiplyScalar(1 / this.scale);
    }
    const radial = centre.clone();
    if (radial.lengthSq() < 1e-6) radial.set(0, 1, 0);
    return radial.normalize().multiplyScalar(1.1 / this.scale);
  }

  // ------------------------------------------------------------------ tools

  /**
   * `t` runs 0 (assembled) to 1 (fully exploded). This resets each part's
   * position, so it must be called before setCycle, which adds to it.
   */
  setExplode(t: number) {
    for (const part of this.parts) {
      part.group.position.copy(part.base).addScaledVector(part.explode, t);
    }
  }

  /**
   * Drives every part's motion from one shared crank angle, so a compressor and
   * the turbine that drives it stay in step by construction.
   *
   * Every term is zero at angle 0, which makes the authored pose the rest pose:
   * pressing play starts from exactly where the model was sitting instead of
   * snapping to some point mid-cycle.
   */
  setCycle(angle: number) {
    for (const part of this.parts) {
      const motion = part.def.motion;
      if (!motion) continue;

      if (motion.spin) {
        part.group.quaternion.setFromAxisAngle(AXES[motion.spin.axis], angle * motion.spin.ratio);
      } else if (motion.swing) {
        const value = Math.sin(angle + (motion.swing.phase ?? 0)) * motion.swing.amplitude;
        part.group.quaternion.setFromAxisAngle(AXES[motion.swing.axis], value);
      }

      if (motion.slide) {
        const value = Math.sin(angle + (motion.slide.phase ?? 0)) * motion.slide.amplitude;
        part.group.position.addScaledVector(AXES[motion.slide.axis], value / this.scale);
      }
    }
  }

  clearMotion() {
    for (const part of this.parts) {
      if (part.def.motion) part.group.quaternion.identity();
    }
  }

  setOpacity(part: PartHandle, opacity: number) {
    const solid = opacity >= 0.999;
    for (const material of part.materials) {
      material.transparent = !solid;
      material.opacity = opacity;
      // Ghosted parts must not occlude what they are revealing.
      material.depthWrite = solid;
    }
    part.meshes.forEach((mesh) => {
      mesh.visible = opacity > 0.004;
      mesh.renderOrder = solid ? 0 : 2;
    });
  }

  setClipping(planes: THREE.Plane[] | null) {
    if (this.clipPlanes === planes) return;
    this.clipPlanes = planes;
    // A cut exposes the inside of a wall, which only exists if back faces are
    // drawn — so the two settings travel together.
    const side = planes ? THREE.DoubleSide : THREE.FrontSide;
    for (const part of this.parts) {
      for (const material of part.materials) {
        material.clippingPlanes = planes;
        material.side = side;
        material.needsUpdate = true;
      }
    }
  }

  /** Keeps each part's world centre current for hotspot and camera maths. */
  refreshWorld() {
    this.root.updateMatrixWorld(true);
    for (const part of this.parts) {
      // The anchor rather than the group origin: a hotspot has to sit on the
      // part it labels.
      part.world.copy(part.anchor).applyMatrix4(part.group.matrixWorld);
    }
  }

  /** Returns the nearest part under the ray, ignoring anything not visible. */
  raycast(raycaster: THREE.Raycaster): PartHandle | null {
    const candidates: THREE.Mesh[] = [];
    for (const part of this.parts) {
      for (const mesh of part.meshes) if (mesh.visible) candidates.push(mesh);
    }
    const hit = raycaster.intersectObjects(candidates, false)[0];
    if (!hit) return null;
    return this.parts.find((part) => part.meshes.includes(hit.object as THREE.Mesh)) ?? null;
  }

  dispose() {
    this.root.removeFromParent();
    // Meshes were re-parented out of `model` into part groups, so walk the root.
    this.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const part of this.parts) {
      part.materials.forEach((material) => material.dispose());
    }
    this.parts.length = 0;
    this.byId.clear();
  }
}
