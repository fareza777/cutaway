/**
 * The viewer.
 *
 * Owns the scene, the loop and every tool. React never touches three.js
 * directly — it calls methods here and receives selection changes back through
 * callbacks. That boundary is deliberate: a spinning model must not cause a
 * React render, and a React render must not cost a frame.
 *
 * The loop draws only when something has actually changed. A still, unselected
 * object costs nothing, which on a phone is the difference between an app you
 * can browse for twenty minutes and one that gets warm in two.
 */

import * as THREE from 'three';
import type { ObjectDoc } from '@/content/types';

import { Assembly, FIT_SIZE } from './Assembly';
import { AssetManager } from './AssetManager';
import { Hotspots } from './Hotspots';
import { OrbitCamera } from './OrbitCamera';
import { RenderScale } from './RenderScale';
import { createRenderer, present, type GLContext } from './renderer';
import { contactShadowTexture, studioEnvironment } from './textures';
import { partOpacity, type VisibilityState } from './visibility';

const FOV = 38;
/**
 * Hotspot diameter in layout points, scaled to device pixels at runtime. A
 * fixed pixel size looks right on a low-density screen and turns into a speck
 * on a 3× phone, which is exactly what it did.
 */
const DOT_POINTS = 26;
/** Opacity for a part that is present but not the subject. */
const AUTO_ROTATE_IDLE = 3.5;
/** Crank revolutions per second at full speed. */
const CYCLE_RATE = 1.15;

export type SceneMode = 'dark' | 'light';

/**
 * The stage, per theme.
 *
 * A light stage is not a dark one with the background swapped: with a bright
 * surround, bounced light does most of the work, so the directional rig has to
 * come down or every surface blows out. The contact shadow has to get stronger
 * too — it is the only thing keeping the object from floating on the page.
 */
const STAGE: Record<SceneMode, {
  background: number;
  ambient: number;
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
  shadow: number;
}> = {
  dark: { background: 0x07090d, ambient: 0.16, hemisphere: 0.42, key: 1.5, fill: 0.5, rim: 0.9, shadow: 0.75 },
  light: { background: 0xf4f5f8, ambient: 0.5, hemisphere: 0.75, key: 1.15, fill: 0.4, rim: 0.55, shadow: 0.5 },
};

export type ViewerEvents = {
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
  onSelect?: (partId: string | null) => void;
  /** Quiz mode only: every tap on a part is reported, with no selection. */
  onAnswer?: (partId: string | null) => void;
};

type ToolState = {
  explode: number;
  peel: number;
  cut: number;
  xray: boolean;
  isolate: boolean;
  running: boolean;
  focus: Set<string> | null;
  /**
   * The shallowest layer in `focus`. Layers above it are removed rather than
   * ghosted, because a ghost still veils what is behind it.
   */
  focusFloor: number;
};

export class CutawayViewer {
  private gl: GLContext;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private orbit: OrbitCamera;
  private hotspots = new Hotspots();
  private assets = new AssetManager();
  private renderScale = new RenderScale();
  private events: ViewerEvents;

  private assembly: Assembly | null = null;
  /**
   * One environment per theme, kept for the life of the viewer.
   *
   * The PMREM bake measured 136ms on a desktop-class GPU and it used to run on
   * every object load, tinted by that object's accent. That is a long GPU stall
   * landing exactly when the user has just opened something and started
   * dragging. The accent reaches the model through the rim light anyway, so the
   * environment does not need to know about it, and two bakes serve everything.
   */
  private environments = new Map<SceneMode, THREE.Texture>();
  private shadow: THREE.Mesh;
  private clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), FIT_SIZE);
  private clipPlanes = [this.clipPlane];
  private cutAxis = new THREE.Vector3(1, 0, 0);
  private cutSign = 1;
  private cutChoice: 'x' | 'y' | 'z' = 'x';

  private width: number;
  private height: number;
  /** Half-extents of the loaded object in world space; drives camera framing. */
  private fitExtent = new THREE.Vector3(FIT_SIZE / 2, FIT_SIZE / 2, FIT_SIZE / 2);
  /** Resting camera distance for the current object, set by frameObject. */
  private homeDistance = 10;
  /** Device pixels per layout point; the gesture layer measures it for us. */
  private density = 1;
  private frame = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private loadToken = 0;

  // Render-on-demand bookkeeping.
  private dirty = true;
  private busyUntil = 0;

  /** Cost of the last frame, in ms; drives the pacing guard below. */
  private lastCost = 0;
  private lastRenderAt = 0;
  private mode: SceneMode = 'light';
  private accent = '#ffffff';
  private selected: string | null = null;
  private quizMode = false;
  private cycle = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private tools: ToolState = {
    explode: 0,
    peel: 0,
    cut: 0,
    xray: false,
    isolate: false,
    running: false,
    focus: null,
    focusFloor: 0,
  };

  constructor(gl: GLContext, events: ViewerEvents = {}) {
    this.gl = gl;
    this.events = events;

    const created = createRenderer(gl, 1);
    this.renderer = created.renderer;
    this.width = created.width;
    this.height = created.height;

    this.orbit = new OrbitCamera(FOV, this.width / this.height);
    this.frameObject();
    this.orbit.reset();

    this.renderScale.resize(this.width, this.height);
    this.buildStage();
    this.shadow = this.buildShadow();
    this.scene.add(this.hotspots.group);
    this.hotspots.setPixelSize(DOT_POINTS * this.density, this.height, FOV);

    this.loop();
  }

  // ------------------------------------------------------------------ stage

  private buildStage() {
    // Range is set by updateFog, which keeps it pinned to the camera.
    this.scene.fog = new THREE.Fog(0x07090d, 1, 100);

    // A three-point rig, deliberately restrained. Pale metals — a nacelle, a
    // machined block — clip to flat white long before the eye expects them to,
    // and a blown-out silhouette loses exactly the surface detail the app
    // exists to show. Most of the shaping comes from the environment map.
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    ambient.name = 'ambient';
    this.scene.add(ambient);

    const hemisphere = new THREE.HemisphereLight(0xdce8ff, 0x0a0d14, 1);
    hemisphere.name = 'hemisphere';
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff4e8, 1);
    key.name = 'key';
    key.position.set(4.2, 6.4, 5.2);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc9dcff, 1);
    fill.name = 'fill';
    fill.position.set(-5.2, 1.4, 3.6);
    this.scene.add(fill);

    // The rim takes the object's accent colour, which is what ties the model to
    // its card in the library without tinting the whole scene.
    const rim = new THREE.DirectionalLight(0xffffff, 1);
    rim.name = 'rim';
    rim.position.set(-2.4, 2.8, -6.0);
    this.scene.add(rim);

    this.applyStage();
  }

  /** Pushes the current theme's stage values into the scene. */
  private applyStage() {
    const stage = STAGE[this.mode];
    const light = (name: string) => this.scene.getObjectByName(name) as THREE.Light | undefined;

    this.renderer.setClearColor(stage.background, 1);
    (this.scene.fog as THREE.Fog | null)?.color.setHex(stage.background);

    const set = (name: string, intensity: number) => {
      const found = light(name);
      if (found) found.intensity = intensity;
    };
    set('ambient', stage.ambient);
    set('hemisphere', stage.hemisphere);
    set('key', stage.key);
    set('fill', stage.fill);
    set('rim', stage.rim);
    // The rim carries the object's accent, but only half-strength. At full
    // saturation it stops being a highlight and becomes a coloured floodlight:
    // a curved nacelle survives it, a fridge is flat slabs and comes out
    // uniformly painted in the accent.
    (light('rim') as THREE.DirectionalLight | undefined)?.color
      .set(this.accent)
      .lerp(new THREE.Color(0xffffff), 0.55);

    if (this.shadow) (this.shadow.material as THREE.MeshBasicMaterial).opacity = stage.shadow;
  }

  /** Switches the stage between the light and dark themes. */
  setTheme(mode: SceneMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyStage();
    this.applyEnvironment(this.accent);
    this.markDirty(0.4);
  }

  /**
   * Places the camera so the object fits, whatever the screen shape.
   *
   * Two traps here, both of which this went through. Framing to the vertical
   * field of view alone lets a wide object run off both edges of an upright
   * phone, where the horizontal angle is less than half the vertical one. But
   * fitting a bounding *sphere* over-corrects badly — a jet engine's sphere is
   * far larger than the engine, and the model ends up a speck in the middle of
   * a tall screen. So: fit the real half-extents against each axis's own angle
   * and take whichever is binding.
   */
  private frameObject() {
    const halfVertical = THREE.MathUtils.degToRad(FOV) / 2;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * (this.width / this.height));

    // The user orbits, so the horizontal extent is whichever ground-plane axis
    // is wider — that is what will swing into view.
    const across = Math.max(this.fitExtent.x, this.fitExtent.z);
    const fit = Math.max(across / Math.tan(halfHorizontal), this.fitExtent.y / Math.tan(halfVertical)) * 1.08;

    // Close enough to inspect one part, far enough to hold a fully exploded
    // object — which spreads to roughly twice the assembled size.
    this.homeDistance = fit;
    this.orbit.setLimits({ min: fit * 0.4, max: fit * 2.6 });
    this.orbit.setDistance(fit);
    this.orbit.setClipRange(Math.max(0.05, fit * 0.04), fit * 4);
    this.updateFog();
  }

  /**
   * Fog is a depth cue for the object, not for a world — so it is anchored to
   * wherever the camera currently is rather than to fixed distances. Fixed
   * values silently swallowed the whole model the moment the framing distance
   * changed with the aspect ratio.
   */
  private updateFog() {
    const fog = this.scene.fog as THREE.Fog | null;
    if (!fog) return;
    const distance = this.orbit.currentDistance;
    const depth = this.fitExtent.length();
    fog.near = distance - depth * 0.35;
    fog.far = distance + depth * 2.6;
  }

  private buildShadow() {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(FIT_SIZE * 1.9, FIT_SIZE * 1.9),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: STAGE[this.mode].shadow,
        toneMapped: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -FIT_SIZE * 0.62;
    shadow.renderOrder = -1;
    this.scene.add(shadow);
    return shadow;
  }

  // ------------------------------------------------------------------ load

  async setObject(doc: ObjectDoc, moduleId: number) {
    const token = ++this.loadToken;
    this.events.onLoading?.(true);

    try {
      this.clearObject();
      this.applyEnvironment(doc.accent);

      const gltf = await this.assets.load(doc.id, moduleId);
      if (token !== this.loadToken || this.disposed) return;

      const assembly = new Assembly(gltf.scene, doc);
      this.assembly = assembly;
      this.scene.add(assembly.root);

      this.cutChoice = doc.cutAxis;
      this.cutSign = 1;
      this.applyCutAxis();

      const bounds = new THREE.Box3().setFromObject(assembly.root);
      this.shadow.position.y = bounds.min.y - 0.06;
      bounds.getSize(this.fitExtent).multiplyScalar(0.5);
      this.frameObject();

      this.hotspots.build(assembly.parts, doc.accent);
      this.applyTools();
      this.orbit.reset();

      // Upload the geometry and compile the shaders before the first frame that
      // needs them. Otherwise every part's buffers, every material's program and
      // a dozen textures all land in one frame — and if the user is dragging,
      // that frame is competing with a render on every vsync. Desktop drivers
      // absorb that burst; phone drivers are where it shows up as a stall or
      // worse. compileAsync spreads it out and lets the model appear ready.
      // Compile and upload before the first frame that needs them, so the
      // work does not land in a frame that is already competing with a drag.
      // Deliberately the synchronous call: without KHR_parallel_shader_compile
      // — which this class of GPU does not have — the async variant compiles
      // synchronously anyway and then waits on a GPU fence, which is the last
      // thing to ask of a driver that is close to refusing submissions.
      const compileStart = Date.now();
      this.renderer.compile(this.scene, this.orbit.camera);
      // One line per load, kept deliberately: when a report comes in from a
      // device nobody here owns, this is the difference between a diagnosis and
      // a guess. It costs one string per object opened.
      console.warn(
        `Cutaway ${doc.id}: ${this.width}x${this.height} scale ${this.renderScale.factor.toFixed(2)} ` +
          `compile ${Date.now() - compileStart}ms`,
      );

      this.markDirty(0.6);
      this.events.onLoading?.(false);
    } catch (error) {
      if (token !== this.loadToken || this.disposed) return;
      this.events.onLoading?.(false);
      this.events.onError?.(error instanceof Error ? error.message : 'Could not load this model');
    }
  }

  /**
   * The per-object studio bake. Deliberately non-fatal.
   *
   * PMREM needs half-float render targets, and some GL drivers — the Android
   * emulator's among them — do not provide them. This used to run outside the
   * try block below, so a driver that refused the bake rejected the whole load
   * and left the spinner up forever with nothing in the log. Reflections are a
   * nicety; the object is the point.
   */
  private applyEnvironment(accent: string) {
    this.accent = accent;
    (this.scene.getObjectByName('rim') as THREE.DirectionalLight | undefined)?.color.set(accent);

    const cached = this.environments.get(this.mode);
    if (cached) {
      this.scene.environment = cached;
      return;
    }
    try {
      const built = studioEnvironment(this.renderer, this.mode);
      this.environments.set(this.mode, built);
      this.scene.environment = built;
    } catch (error) {
      this.scene.environment = null;
      console.warn('Cutaway: environment map unavailable on this GPU —', error);
    }
  }

  private clearObject() {
    this.hotspots.clear();
    this.assembly?.dispose();
    this.assembly = null;
    this.selected = null;
    this.cycle = 0;
    this.tools = { explode: 0, peel: 0, cut: 0, xray: false, isolate: false, running: false, focus: null, focusFloor: 0 };
  }

  get ready() {
    return this.assembly !== null;
  }

  get maxLayer() {
    return this.assembly?.maxLayer ?? 0;
  }

  get animatable() {
    return this.assembly?.hasMotion ?? false;
  }

  // ------------------------------------------------------------------ input

  resize(width: number, height: number, density = this.density) {
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.density = density;
    this.renderer.setSize(width, height, false);
    this.renderScale.resize(width, height);
    this.orbit.setAspect(width / height);
    this.frameObject();
    this.hotspots.setPixelSize(DOT_POINTS * this.density, height, FOV);
    this.markDirty();
  }

  rotateBy(dx: number, dy: number) {
    this.orbit.orbit(dx, dy, this.height);
    this.markDirty();
  }

  zoomBy(factor: number) {
    this.orbit.zoomBy(factor);
    this.markDirty();
  }

  /** Screen-space tap, in the same pixel space as the GL buffer. */
  tap(x: number, y: number) {
    if (!this.assembly) return;
    this.orbit.interact();

    // Geometry first. A dot is only pickable by screen distance, which knows
    // nothing about depth — so leading with dots would let a tap on the
    // crankcase select the crankshaft hidden behind it. Hitting the mesh means
    // the user always gets the part they can actually see, and the dot stays as
    // a generous fallback for parts too small or too thin to hit directly.
    this.pointer.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.orbit.camera);
    const part = this.assembly.raycast(this.raycaster);
    let hit = part && !part.def.hidden ? part.def.id : null;
    if (!hit) hit = this.hotspots.pick(x, y, this.orbit.camera, this.width, this.height);

    if (this.quizMode) {
      this.events.onAnswer?.(hit);
      this.markDirty(0.4);
      return;
    }
    this.select(hit === this.selected ? null : hit);
  }

  select(partId: string | null) {
    if (this.selected === partId) return;
    this.selected = partId;
    const part = partId ? this.assembly?.byId.get(partId) : null;
    // Centre on the part outright rather than leaning toward it. A part is
    // selected because the user wants to read about it, and the narration sheet
    // takes the bottom of the screen; a partial move gave no guarantee the
    // subject cleared the sheet. The shift is bounded by the object's own
    // radius, so this cannot fling the view somewhere unrecognisable.
    this.orbit.lookAtPoint(part ? part.world.clone() : null);
    this.applyTools();
    this.markDirty(0.6);
    this.events.onSelect?.(partId);
  }

  // ------------------------------------------------------------------ tools

  setExplode(value: number) {
    this.tools.explode = THREE.MathUtils.clamp(value, 0, 1);
    // A fully separated object is roughly twice the size of the assembled one,
    // so framing that was correct at rest lets parts drift off screen. Retreat
    // to keep them in view — but only retreat, so a user who has zoomed in on
    // one part is not yanked back out.
    // The solver decides how far parts actually travel, so the pull-back has to
    // ask it rather than assume a fixed multiplier.
    const spread = this.assembly?.explodeSpread ?? 0;
    this.orbit.ensureDistance(this.homeDistance * (1 + this.tools.explode * Math.min(1.6, spread / FIT_SIZE)));
    this.applyTools();
    this.markDirty();
  }

  /** Hides every layer shallower than `depth`; 0 shows the whole object. */
  setPeel(depth: number) {
    this.tools.peel = Math.max(0, Math.round(depth));
    this.applyTools();
    this.markDirty(0.4);
  }

  setCut(value: number) {
    this.tools.cut = THREE.MathUtils.clamp(value, 0, 1);
    this.applyTools();
    this.markDirty();
  }

  /** Which way the cross-section slices, and from which side. */
  setCutAxis(axis: 'x' | 'y' | 'z', sign: 1 | -1 = this.cutSign as 1 | -1) {
    this.cutChoice = axis;
    this.cutSign = sign;
    this.applyCutAxis();
    this.applyTools();
    this.markDirty(0.4);
  }

  flipCut() {
    this.setCutAxis(this.cutChoice, this.cutSign === 1 ? -1 : 1);
  }

  get cutState() {
    return { axis: this.cutChoice, sign: this.cutSign };
  }

  /**
   * The plane is in world space but has to follow the axis the author meant,
   * so the model's own axis is carried through its rest rotation. The assembly
   * never turns after load — the camera orbits — so this is resolved once per
   * change rather than per frame.
   */
  private applyCutAxis() {
    const assembly = this.assembly;
    if (!assembly) return;
    this.cutAxis
      .set(this.cutChoice === 'x' ? 1 : 0, this.cutChoice === 'y' ? 1 : 0, this.cutChoice === 'z' ? 1 : 0)
      .applyQuaternion(assembly.root.quaternion)
      .multiplyScalar(this.cutSign)
      .normalize();
    this.clipPlane.normal.copy(this.cutAxis);
  }

  setXray(enabled: boolean) {
    this.tools.xray = enabled;
    this.applyTools();
    this.markDirty(0.4);
  }

  setIsolate(enabled: boolean) {
    this.tools.isolate = enabled;
    this.applyTools();
    this.markDirty(0.4);
  }

  setRunning(enabled: boolean) {
    this.tools.running = enabled && this.animatable;
    if (!this.tools.running) this.assembly?.clearMotion();
    this.applyTools();
    this.markDirty(0.3);
  }

  /** Ghosts everything except one assembly layer. `null` clears it. */
  setLayerFocus(layer: number | null) {
    if (layer === null || !this.assembly) {
      this.setFocus(null);
      return;
    }
    this.setFocus(this.assembly.parts.filter((part) => part.def.layer === layer).map((part) => part.def.id));
  }

  /**
   * Restricts attention to a set of parts — used by the layer chips and by the
   * walkthrough steps.
   *
   * Focusing used to ghost everything else, which reads well for a part near
   * the surface and not at all for one buried inside: half a dozen translucent
   * shells stacked in front of the core still veil it, so "focus the core" left
   * the core no easier to see. Anything shallower than the focused set is now
   * removed outright, and only what is at or below that depth stays as a ghost
   * for context.
   */
  setFocus(partIds: string[] | null) {
    const focus = partIds && partIds.length ? new Set(partIds) : null;
    this.tools.focus = focus;
    this.tools.focusFloor =
      focus && this.assembly
        ? Math.min(...this.assembly.parts.filter((part) => focus.has(part.def.id)).map((part) => part.def.layer))
        : 0;
    this.applyTools();
    this.markDirty(0.5);
  }

  /**
   * Tells the viewer how much of the bottom of the screen is covered by UI, as
   * a fraction of the viewport. The model is slid up into the space that is
   * left so a sheet never hides the part it is describing.
   */
  setObscuredBottom(fraction: number) {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 0.7);
    // Half the covered height, converted from screen fraction to world units
    // at the object's distance.
    const visibleHeight = 2 * this.orbit.currentDistance * Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    this.orbit.setLift((clamped * visibleHeight) / 2);
    this.markDirty(0.5);
  }

  setAutoRotate(enabled: boolean) {
    this.orbit.setAutoRotate(enabled);
    this.markDirty();
  }

  setHotspotsVisible(visible: boolean) {
    this.hotspots.setVisible(visible);
    this.markDirty();
  }

  setQuizMode(enabled: boolean) {
    this.quizMode = enabled;
    this.selected = null;
    this.hotspots.clearFlashes();
    // X-ray during a quiz is not decoration: a question about the crankshaft is
    // unanswerable if the crankcase is opaque. Ghosted parts stop writing
    // depth, so every part — and every dot — becomes visible and reachable.
    this.tools.xray = enabled;
    this.applyTools();
    this.markDirty(0.3);
  }

  flash(partId: string, correct: boolean) {
    this.hotspots.flash(partId, correct);
    this.markDirty(1.8);
  }

  reset() {
    this.tools = { explode: 0, peel: 0, cut: 0, xray: false, isolate: false, running: false, focus: null, focusFloor: 0 };
    this.selected = null;
    this.cycle = 0;
    this.assembly?.clearMotion();
    this.orbit.reset();
    this.applyTools();
    this.markDirty(0.9);
    this.events.onSelect?.(null);
  }

  /**
   * One place decides what every part looks like. Toggles compose here rather
   * than each fighting over the same materials, which is the only way a
   * combination like "exploded, peeled, x-ray, one part selected" stays sane.
   */
  private applyTools() {
    const assembly = this.assembly;
    if (!assembly) return;

    assembly.setExplode(this.tools.explode);
    if (this.tools.running) assembly.setCycle(this.cycle);
    assembly.refreshWorld();

    const state: VisibilityState = {
      peel: this.tools.peel,
      xray: this.tools.xray,
      isolate: this.tools.isolate,
      focus: this.tools.focus,
      focusFloor: this.tools.focusFloor,
      subject: this.quizMode ? null : this.selected,
    };

    for (const part of assembly.parts) {
      assembly.setOpacity(part, partOpacity(part.def, state));
    }

    if (this.tools.cut > 0) {
      // Sweep from fully outside the model to the centre.
      this.clipPlane.constant = FIT_SIZE * 0.75 * (1 - this.tools.cut);
      assembly.setClipping(this.clipPlanes);
    } else {
      assembly.setClipping(null);
    }
  }

  // ------------------------------------------------------------------- loop

  private markDirty(seconds = 0) {
    this.dirty = true;
    if (seconds > 0) this.busyUntil = Math.max(this.busyUntil, Date.now() + seconds * 1000);
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = Date.now();

    if (this.orbit.update(delta, AUTO_ROTATE_IDLE)) {
      this.updateFog();
      this.dirty = true;
    }

    if (this.tools.running && this.assembly) {
      this.cycle += delta * CYCLE_RATE * Math.PI * 2;
      this.assembly.setExplode(this.tools.explode);
      this.assembly.setCycle(this.cycle);
      this.assembly.refreshWorld();
      this.dirty = true;
    }

    const settled = this.assembly ? this.hotspots.update(this.orbit.camera, delta, this.selected) : true;
    if (!settled) this.dirty = true;
    if (now < this.busyUntil) this.dirty = true;
    if (!this.dirty) return;

    // Pacing guard. A device that renders a frame in a couple of milliseconds
    // is never touched by this. One that cannot keep up at 60Hz is held to 30,
    // which halves the GPU load rather than letting frames queue up behind each
    // other — queued frames are what took the Adreno driver down.
    if (this.lastCost > 20 && now - this.lastRenderAt < 32) return;
    this.lastRenderAt = now;

    this.dirty = false;
    const t0 = Date.now();
    this.renderScale.render(this.renderer, this.scene, this.orbit.camera);
    present(this.gl);
    this.lastCost = Date.now() - t0;

  };

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    cancelAnimationFrame(this.frame);
    this.clearObject();
    this.hotspots.dispose();
    this.assets.dispose();
    this.environments.forEach((texture) => texture.dispose());
    this.environments.clear();
    (this.shadow.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.shadow.material as THREE.MeshBasicMaterial).dispose();
    this.shadow.geometry.dispose();
    this.renderScale.dispose();
    this.renderer.dispose();
  }
}
