/**
 * Bridges expo-gl to three.js.
 *
 * three only ever asks a canvas for its dimensions, its context, and permission
 * to attach listeners it will never receive. Supplying that shape directly is a
 * dozen lines and leaves the renderer entirely under our control, which matters
 * because the whole performance story here is "decide when to draw".
 */

import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

export type GLContext = ExpoWebGLRenderingContext;

/**
 * Above this many pixels, multisampling is switched off.
 *
 * Set deliberately low. A screen under this budget is also small enough that
 * RenderScale draws the scene at 1:1, so the two thresholds describe the same
 * decision: this device has pixels to spare, spend some on smoother edges.
 * Above it, the scene is already being downscaled and MSAA on the final blit
 * would buy nothing.
 *
 * expo-gl hands over a buffer at the screen's full device resolution — on a
 * 1440p phone that is 4.5 million pixels, and MSAA multiplies both the memory
 * for it and the bandwidth to resolve it. That is the most expensive thing this
 * renderer asks of a mobile driver, and it is the kind of demand that a desktop
 * GPU and an emulator satisfy without complaint while a phone does not. The
 * geometry here is smooth and mostly curved, so the aliasing MSAA would have
 * removed is a fair trade for not asking.
 */
const MSAA_PIXEL_BUDGET = 1_200_000;

export function createRenderer(gl: GLContext, pixelRatio: number) {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const antialias = width * height <= MSAA_PIXEL_BUDGET;

  const canvas = {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => gl,
    getBoundingClientRect: () => ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height }),
  } as unknown as HTMLCanvasElement;

  // three r163 dropped WebGL 1, and guards it with
  //   `context instanceof WebGLRenderingContext` → throw.
  // expo-gl's context is GLES3-backed and does expose the WebGL 2 API, but its
  // class descends from the global WebGLRenderingContext that expo-gl installs,
  // so that guard misfires and the renderer refuses to start. Hiding the global
  // for the duration of the constructor is the whole fix.
  //
  // The bypass is gated on the context actually having WebGL 2 entry points —
  // if it genuinely were WebGL 1, three's complaint would be correct and
  // silencing it would only move the failure somewhere less legible.
  if (typeof (gl as unknown as WebGL2RenderingContext).createVertexArray !== 'function') {
    throw new Error('This device does not support WebGL 2, which the 3D viewer requires.');
  }

  // three reads `context.getContextAttributes().alpha` unconditionally. Native
  // expo-gl contexts do not always carry that DOM method.
  const context = gl as unknown as WebGL2RenderingContext;
  if (typeof context.getContextAttributes !== 'function') {
    context.getContextAttributes = () => ({ alpha: false, depth: true, stencil: false, antialias });
  }

  const scope = globalThis as { WebGLRenderingContext?: unknown };
  const guard = scope.WebGLRenderingContext;
  let renderer: THREE.WebGLRenderer;
  try {
    scope.WebGLRenderingContext = undefined;
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGL2RenderingContext,
      antialias,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
  } finally {
    scope.WebGLRenderingContext = guard;
  }

  // expo-gl hands over a buffer already sized in device pixels, so the drawing
  // buffer must not be scaled again — setSize is told the physical size and the
  // pixel ratio is left at 1.
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x07090d, 1);

  return { renderer, width, height, pixelRatio, antialias };
}

/** Presents the frame. expo-gl needs this instead of an implicit swap. */
export function present(gl: GLContext) {
  gl.endFrameEXP();
}
