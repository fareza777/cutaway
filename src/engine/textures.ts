/**
 * Every texture in the app is generated from arithmetic at startup.
 *
 * React Native has no canvas, so the usual "draw it into a 2D context" trick is
 * unavailable — but it is also unnecessary. Writing pixels straight into a typed
 * array costs under a millisecond, ships zero bytes in the APK, and scales to
 * any accent colour a new object cares to define.
 */

import * as THREE from 'three';

const DOT_SIZE = 128;
const SHADOW_SIZE = 128;

function texture(data: Uint8Array, width: number, height: number, srgb = true) {
  const result = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (srgb) result.colorSpace = THREE.SRGBColorSpace;
  result.magFilter = THREE.LinearFilter;
  result.minFilter = THREE.LinearFilter;
  result.needsUpdate = true;
  return result;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * A hotspot dot: accent halo, white collar, accent core. The collar is what
 * keeps it legible against both a pale nacelle and a black display.
 */
export function dotTexture(hex: string) {
  const size = DOT_SIZE;
  const data = new Uint8Array(size * size * 4);
  const color = new THREE.Color(hex);
  const cr = Math.round(color.r * 255);
  const cg = Math.round(color.g * 255);
  const cb = Math.round(color.b * 255);
  const centre = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - centre, y - centre) / centre; // 0 at centre, 1 at edge
      const i = (y * size + x) * 4;

      const halo = (1 - smoothstep(0.42, 1.0, d)) * 0.34;
      const collar = 1 - smoothstep(0.32, 0.38, d);
      const core = 1 - smoothstep(0.16, 0.22, d);

      // Composite core over collar over halo, straight alpha.
      const collarOnly = Math.max(0, collar - core);
      const alpha = Math.min(1, core + collarOnly + halo * (1 - collar));
      if (alpha <= 0.002) continue;

      const r = (core * cr + collarOnly * 255 + halo * (1 - collar) * cr) / alpha;
      const g = (core * cg + collarOnly * 253 + halo * (1 - collar) * cg) / alpha;
      const b = (core * cb + collarOnly * 249 + halo * (1 - collar) * cb) / alpha;

      data[i] = Math.min(255, r);
      data[i + 1] = Math.min(255, g);
      data[i + 2] = Math.min(255, b);
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return texture(data, size, size);
}

/** The selection / quiz-feedback ring. Tinted per use via material.color. */
export function ringTexture() {
  const size = DOT_SIZE;
  const data = new Uint8Array(size * size * 4);
  const centre = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - centre, y - centre) / centre;
      const band = smoothstep(0.72, 0.78, d) * (1 - smoothstep(0.86, 0.92, d));
      if (band <= 0.002) continue;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(band * 255);
    }
  }
  return texture(data, size, size);
}

/**
 * A soft blob under the object. A real shadow map would mean drawing every part
 * a second time each frame; this reads the same and costs one quad.
 */
export function contactShadowTexture() {
  const size = SHADOW_SIZE;
  const data = new Uint8Array(size * size * 4);
  const centre = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - centre, y - centre) / centre;
      const alpha = Math.pow(1 - Math.min(1, d), 2.6);
      const i = (y * size + x) * 4;
      data[i] = 2;
      data[i + 1] = 4;
      data[i + 2] = 8;
      data[i + 3] = Math.round(alpha * 235);
    }
  }
  return texture(data, size, size, false);
}

/**
 * A studio in 32×16 pixels: bright above, a darker bounce below, and one
 * brighter panel to the side. Run through PMREM it gives metals something to
 * reflect, which is most of what separates a premium-looking render from a
 * plastic one — and it replaces an HDR file that would otherwise have been the
 * single largest asset in the app.
 *
 * Baked once per theme and reused for every object; the bake is a real GPU cost
 * and does not belong on the path the user takes when opening something.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer, mode: 'dark' | 'light' = 'dark') {
  const width = 32;
  const height = 16;
  const data = new Uint8Array(width * height * 4);

  // What a metal object reflects is the room it is in. On the dark theme that
  // is a lit ceiling over a black floor, which is what gives the models their
  // deep contrast; on the light theme it has to become an actual bright room,
  // or the same metal reads as dirty grey against a white page.
  const sky = new THREE.Color(mode === 'dark' ? '#dfe7f2' : '#ffffff');
  const floor = new THREE.Color(mode === 'dark' ? '#0a0d12' : '#b9c0cb');
  // A brighter panel on one side, so a highlight travels across metal as the
  // object turns. Neutral: the object's accent reaches the model through the
  // rim light, and putting it in the reflections too simply repainted the whole
  // body in that colour — a grey nacelle came out looking like polished copper.
  const panelColour = new THREE.Color('#ffffff');
  const mixed = new THREE.Color();

  for (let y = 0; y < height; y += 1) {
    const t = 1 - y / (height - 1); // 1 at the top
    for (let x = 0; x < width; x += 1) {
      mixed.copy(floor).lerp(sky, Math.pow(t, 0.55));
      const around = x / width;
      const panel = Math.max(0, 1 - Math.abs(around - 0.28) * 7) * Math.max(0, t - 0.25);
      mixed.lerp(panelColour, panel * 0.35);

      const i = (y * width + x) * 4;
      data[i] = mixed.r * 255;
      data[i + 1] = mixed.g * 255;
      data[i + 2] = mixed.b * 255;
      data[i + 3] = 255;
    }
  }

  const source = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  source.mapping = THREE.EquirectangularReflectionMapping;
  source.colorSpace = THREE.SRGBColorSpace;
  source.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(source).texture;
  pmrem.dispose();
  source.dispose();
  return environment;
}
