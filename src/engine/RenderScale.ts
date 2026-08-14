/**
 * Renders the scene into an offscreen buffer smaller than the screen, then
 * stretches that buffer over the screen.
 *
 * This exists because of a specific, measured failure. On a Redmi Note 11
 * (Adreno 610) at the panel's native 1080×2400, the GPU was taking over a
 * second per frame; frames queued up until the Adreno driver refused further
 * command submissions with `IOCTL_KGSL_GPU_COMMAND failed: errno 35 Resource
 * deadlock would occur`, and the process was killed. Physically-based shading
 * with an environment map is expensive per pixel, and expo-gl hands over a
 * buffer at full device resolution — 2.6 million pixels of it.
 *
 * Fragment cost falls with the square of the linear scale, so rendering at 65%
 * costs 42% as much. The upscale is one textured quad, and on a display this
 * dense the softening is hard to see; a crash is not.
 */

import * as THREE from 'three';

/**
 * Pixels the scene pass is allowed. Chosen to sit comfortably inside what an
 * entry-level mobile GPU can shade at an interactive rate, not to look good on
 * a flagship — a phone that can afford more simply renders at 1:1 because its
 * screen is already under the budget.
 */
const PIXEL_BUDGET = 1_150_000;

export class RenderScale {
  private target: THREE.WebGLRenderTarget | null = null;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private scale = 1;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      // Tone mapping is applied by the scene pass's own materials, so it must
      // not be applied again here. Colour space is left untagged on both the
      // target and this material, which keeps exactly one linear→sRGB encode in
      // the chain — at the final draw to the screen. Verified on device.
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Linear scale currently in use, for diagnostics. */
  get factor() {
    return this.scale;
  }

  resize(width: number, height: number) {
    const pixels = width * height;
    this.scale = pixels <= PIXEL_BUDGET ? 1 : Math.sqrt(PIXEL_BUDGET / pixels);
    const w = Math.max(1, Math.round(width * this.scale));
    const h = Math.max(1, Math.round(height * this.scale));

    if (this.scale >= 1) {
      // No downscale needed — drop the buffer and let the caller draw direct.
      this.target?.dispose();
      this.target = null;
      return;
    }

    if (this.target) {
      this.target.setSize(w, h);
      return;
    }

    this.target = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.colorSpace = THREE.NoColorSpace;
    this.material.map = this.target.texture;
    this.material.needsUpdate = true;
  }

  /** Draws the scene, downscaled if the screen is bigger than the budget. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.target) {
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.target?.dispose();
    this.target = null;
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
