// Small geometry helpers shared by every model recipe.
//
// Every part in a Cutaway model is exported as exactly one mesh with one
// material and a stable node name. That keeps draw calls low on mobile and lets
// the runtime address parts by name instead of by hand-authored coordinates.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

/** Applies a transform to a geometry and returns it, so recipes read as data. */
export function place(geometry, { pos = [0, 0, 0], rot = [0, 0, 0], scale } = {}) {
  if (scale) geometry.scale(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  if (rot[0]) geometry.rotateX(rot[0]);
  if (rot[1]) geometry.rotateY(rot[1]);
  if (rot[2]) geometry.rotateZ(rot[2]);
  geometry.translate(...pos);
  return geometry;
}

export function roundedBox(w, h, d, radius = 0.02, segments = 3, transform) {
  const r = Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  return place(new RoundedBoxGeometry(w, h, d, segments, Math.max(r, 1e-4)), transform);
}

export function box(w, h, d, transform) {
  return place(new THREE.BoxGeometry(w, h, d), transform);
}

export function cylinder(rTop, rBottom, height, radial = 32, transform, openEnded = false) {
  return place(new THREE.CylinderGeometry(rTop, rBottom, height, radial, 1, openEnded), transform);
}

export function tube(rOuter, rInner, height, radial = 40, transform) {
  // A wall rather than a solid — the shape most machine housings actually are,
  // and it means a cross-section cut reveals something instead of a flat disc.
  const shape = new THREE.Shape().absarc(0, 0, rOuter, 0, TAU, false);
  shape.holes.push(new THREE.Path().absarc(0, 0, rInner, 0, TAU, true));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: radial,
  });
  geometry.translate(0, 0, -height / 2);
  geometry.rotateX(-Math.PI / 2);
  return place(geometry, transform);
}

export function torus(radius, thickness, radial = 32, tubular = 16, transform) {
  return place(new THREE.TorusGeometry(radius, thickness, tubular, radial), transform);
}

export function sphere(radius, segments = 24, transform) {
  return place(new THREE.SphereGeometry(radius, segments, Math.max(8, segments / 2)), transform);
}

/**
 * Resamples a lathe profile into a smooth, dense one.
 *
 * Density is not only about the silhouette. Per-vertex colour and per-vertex
 * displacement can only resolve what the mesh has vertices for: a groove
 * carved into a ten-ring lathe comes out as a thin dark line rather than a
 * furrow, and mottling averages away to nothing. Where a surface is painted,
 * it needs an order of magnitude more rings than it needs to look round.
 */
export function smoothProfile(profile, count) {
  const path = new THREE.CatmullRomCurve3(profile.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  return path.getPoints(count - 1).map((p) => [Math.max(0, p.x), p.y]);
}

/**
 * Revolves a 2D profile (array of [x, y]) around the Y axis.
 *
 * `phi` sweeps less than the full turn, which is how you get an opened shell —
 * a pericardial sac cut away at the front, say. Phi runs from +Z, so leaving
 * the front open means starting a little past it and stopping a little before.
 */
export function lathe(profile, segments = 40, transform, { phiStart = 0, phiLength = TAU } = {}) {
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return place(new THREE.LatheGeometry(points, segments, phiStart, phiLength), transform);
}

/** Radially repeats a geometry factory — blades, fins, bolts, cooling ribs. */
export function ring(count, factory) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const geometry = factory(i, (i / count) * TAU);
    if (geometry) parts.push(geometry.rotateY((i / count) * TAU));
  }
  return merge(parts);
}

/**
 * A tube swept along a smooth curve through the given points.
 *
 * Anatomy is mostly bent tubes — vessels, nerves, tendons — and stacking
 * cylinders to approximate them leaves visible kinks at every joint. A
 * Catmull-Rom curve through a handful of control points reads as a real vessel
 * for a fraction of the authoring effort.
 */
export function curve(points, radius, { segments = 40, radial = 12, closed = false, taper } = {}) {
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    closed,
  );
  if (!taper) return new THREE.TubeGeometry(path, segments, radius, radial, closed);

  // A vessel that narrows along its length: sample the curve and lathe a
  // varying radius by hand, since TubeGeometry only takes a constant one.
  const parts = [];
  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const a = path.getPointAt(t0);
    const b = path.getPointAt(t1);
    const r0 = radius * (1 + (taper - 1) * t0);
    const r1 = radius * (1 + (taper - 1) * t1);
    const segment = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b) * 1.02, radial, 1);
    const mid = a.clone().lerp(b, 0.5);
    const dir = b.clone().sub(a).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    segment.applyQuaternion(quaternion);
    segment.translate(mid.x, mid.y, mid.z);
    parts.push(segment);
  }
  return merge(parts);
}

/** An ellipsoid — the workhorse for anything organic. */
export function blob(rx, ry, rz, segments = 24, transform) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.max(10, segments / 2));
  geometry.scale(rx, ry, rz);
  return place(geometry, transform);
}

/** Half an ellipsoid, cut on the equator — chamber caps and valve cusps. */
export function dome(rx, ry, rz, segments = 24, transform, phiLength = Math.PI / 2) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.max(8, segments / 2), 0, Math.PI * 2, 0, phiLength);
  geometry.scale(rx, ry, rz);
  return place(geometry, transform);
}

// ---------------------------------------------------------------- surfacing
//
// Organs are not ellipsoids. The shapes below start as ellipsoids anyway —
// nothing else is this cheap to author — and are then roughened and painted,
// which is where they stop reading as balloons. There are no image textures
// anywhere in this app: React Native has no `createImageBitmap`, so a .glb that
// references one will not load at all. Per-vertex colour is the way round that,
// and it survives the round trip through glTF untouched.

/** Deterministic value noise. Seeded by position alone, so builds repeat. */
export function noise3(x, y, z) {
  const hash = (xi, yi, zi) => {
    const s = Math.sin(xi * 127.1 + yi * 311.7 + zi * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fade = (t) => t * t * (3 - 2 * t);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const mix = (a, b, t) => a + (b - a) * t;
  const c00 = mix(hash(xi, yi, zi), hash(xi + 1, yi, zi), u);
  const c10 = mix(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u);
  const c01 = mix(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u);
  const c11 = mix(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u);
  return mix(mix(c00, c10, v), mix(c01, c11, v), w);
}

/** Layered noise, in −1..1. Two octaves is plenty at this scale. */
export function fbm(x, y, z, octaves = 3) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    const f = 2 ** i;
    sum += noise3(x * f, y * f, z * f) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return (sum / total) * 2 - 1;
}

/**
 * Moves every vertex along its own normal by `fn(x, y, z)`.
 *
 * Normals have to exist first and are wrong afterwards, so callers rely on
 * `part()` recomputing them. Because `fn` reads only position, vertices that
 * share a position — the seam of a lathe, the poles of a sphere — move
 * together, and the surface cannot split open.
 */
export function displace(geometry, fn) {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const amount = fn(x, y, z);
    if (!amount) continue;
    position.setXYZ(i, x + normal.getX(i) * amount, y + normal.getY(i) * amount, z + normal.getZ(i) * amount);
  }
  position.needsUpdate = true;
  return geometry;
}

/**
 * An sRGB hex as the linear triple a shader actually multiplies by.
 *
 * COLOR_0 is linear data — glTF says so and three reads it that way — while
 * every colour a person picks is sRGB. Writing the sRGB numbers straight into
 * the attribute washes the result out badly: #8e3b34 arrives on screen as a
 * pale salmon. THREE.Color already does this conversion for material colours,
 * so borrowing it keeps painted and unpainted parts in the same space.
 */
export function srgb(hex) {
  const color = new THREE.Color(hex);
  return [color.r, color.g, color.b];
}

/** Writes a COLOR_0 attribute from `fn(x, y, z) -> [r, g, b]` in 0..1. */
export function paint(geometry, fn) {
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const rgb = fn(position.getX(i), position.getY(i), position.getZ(i));
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A signed distance to the nearest point on a set of polylines, used to carve
 * the coronary grooves and to lay fat along them. Sampling the curves once and
 * scanning the samples is brute force and takes a few hundred milliseconds at
 * build time, which is a fine price for not writing a spatial index.
 */
export function nearestOnCurves(curves, samples = 64) {
  const points = curves.flatMap((pts) =>
    new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))).getPoints(samples),
  );
  return (x, y, z) => {
    let best = Infinity;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dz = p.z - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
}

/**
 * Welds coincident vertices and reshades, so a revolved surface has no seam.
 *
 * LatheGeometry closes its own seam correctly, but `part()` recomputes normals
 * on a non-indexed mesh afterwards, and two coincident vertices with no index
 * in common each average only their own side's faces. On a machined part that
 * is invisible; on an organ it draws a hard crease straight down the front, and
 * the two halves read as flat panels hinged together. Welding on position
 * before shading fixes it — but it also rounds off every deliberate hard edge,
 * so this is opt-in rather than something `part()` does to everything.
 */
export function smoothSeams(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute('normal');
  const welded = BufferGeometryUtils.mergeVertices(flat, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

export function merge(geometries) {
  const list = geometries.flat().filter(Boolean);
  if (list.length === 1) return list[0];
  // Inputs are a mix of indexed (Box, Torus, Lathe) and non-indexed (Extrude)
  // geometry, and the attribute sets differ. Flattening to position+normal
  // non-indexed makes every merge succeed; these are prototype-scale meshes, so
  // the duplicated vertices are not worth defending against.
  // Colour is kept when any input carries it, and the ones that do not are
  // filled with white so the attribute sets still match — mergeGeometries
  // refuses to join geometries that disagree about which attributes exist.
  const coloured = list.some((g) => g.getAttribute('color'));
  const normalised = list.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    if (!flat.getAttribute('normal')) flat.computeVertexNormals();
    for (const name of Object.keys(flat.attributes)) {
      if (name !== 'position' && name !== 'normal' && !(coloured && name === 'color')) flat.deleteAttribute(name);
    }
    if (coloured && !flat.getAttribute('color')) {
      flat.setAttribute('color', new THREE.BufferAttribute(new Float32Array(flat.getAttribute('position').count * 3).fill(1), 3));
    }
    return flat;
  });
  const merged = BufferGeometryUtils.mergeGeometries(normalised, false);
  if (!merged) throw new Error('mergeGeometries failed — mismatched attributes');
  return merged;
}

/** A single-material, single-mesh part. `name` is the contract with the JSON. */
export function part(name, geometry, material) {
  const raw = Array.isArray(geometry) ? merge(geometry) : geometry;
  raw.computeVertexNormals();
  // Welding after the normals exist keeps hard edges (mergeVertices only joins
  // vertices whose every attribute matches) while cutting file size roughly in
  // half — the merge step above leaves everything non-indexed.
  const welded = BufferGeometryUtils.mergeVertices(raw, 1e-4);
  const mesh = new THREE.Mesh(welded, material);
  mesh.name = name;
  return mesh;
}

export function pbr(color, { metalness = 0, roughness = 0.5, emissive, emissiveIntensity = 1, vertexColors = false } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness,
    roughness,
    vertexColors,
  });
  if (emissive) {
    material.emissive = new THREE.Color(emissive);
    material.emissiveIntensity = emissiveIntensity;
  }
  return material;
}

export { THREE, TAU };
