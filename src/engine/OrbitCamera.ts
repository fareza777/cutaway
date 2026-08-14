/**
 * Camera controller.
 *
 * OrbitControls is not usable here — it binds DOM pointer events. Driving a
 * spherical camera from gesture deltas instead is both smaller and better
 * suited: the gesture layer already knows the difference between a drag and a
 * tap, and this stays a pure function of state so the render-on-demand loop can
 * ask "did anything move?" and get an honest answer.
 */

import * as THREE from 'three';

const EPSILON = 0.0006;
const MIN_PHI = 0.18;
const MAX_PHI = Math.PI - 0.18;

export type OrbitLimits = { min: number; max: number };

export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;

  private theta = -0.6;
  private phi = 1.32;
  private radius = 8.4;
  private target = new THREE.Vector3(0, 0, 0);

  private goalTheta = this.theta;
  private goalPhi = this.phi;
  private goalRadius = this.radius;
  private goalTarget = new THREE.Vector3();

  private limits: OrbitLimits = { min: 3.4, max: 15 };
  private autoRotate = true;
  private idleFor = 0;

  private home = { theta: -0.6, phi: 1.32, radius: 8.4 };
  /** Screen-space lift, in world units, applied on top of the look-at target. */
  private lift = 0;
  private goalLift = 0;

  constructor(fov: number, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 80);
    this.apply();
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setLimits(limits: OrbitLimits) {
    this.limits = limits;
    this.goalRadius = THREE.MathUtils.clamp(this.goalRadius, limits.min, limits.max);
  }

  /**
   * Updates the resting distance without moving the camera. Framing is
   * recomputed when the object changes and when the viewport resizes; only the
   * first of those should reposition the camera, and it does so by calling
   * reset(). A rotation of the device must not yank the user's view.
   */
  setDistance(radius: number) {
    this.home.radius = THREE.MathUtils.clamp(radius, this.limits.min, this.limits.max);
    this.goalRadius = THREE.MathUtils.clamp(this.goalRadius, this.limits.min, this.limits.max);
  }

  /** Pixel deltas from a one-finger drag. */
  orbit(dx: number, dy: number, viewportHeight: number) {
    const scale = (Math.PI * 1.1) / Math.max(viewportHeight, 1);
    this.goalTheta -= dx * scale;
    this.goalPhi = THREE.MathUtils.clamp(this.goalPhi - dy * scale, MIN_PHI, MAX_PHI);
    this.idleFor = 0;
  }

  /** `factor` > 1 moves the camera away. */
  zoomBy(factor: number) {
    this.goalRadius = THREE.MathUtils.clamp(this.goalRadius * factor, this.limits.min, this.limits.max);
    this.idleFor = 0;
  }

  /**
   * Pulls the camera back to at least `radius`, never closer. Used when a tool
   * makes the object bigger than it was framed for; it must not undo a zoom the
   * user chose themselves, so it only ever retreats.
   */
  ensureDistance(radius: number) {
    const wanted = THREE.MathUtils.clamp(radius, this.limits.min, this.limits.max);
    if (wanted > this.goalRadius) this.goalRadius = wanted;
  }

  /** Where the camera actually is, as opposed to where it is heading. */
  get currentDistance() {
    return this.radius;
  }

  setClipRange(near: number, far: number) {
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  lookAtPoint(point: THREE.Vector3 | null) {
    this.goalTarget.copy(point ?? new THREE.Vector3(0, 0, 0));
    this.idleFor = 0;
  }

  /**
   * Slides the subject UP the screen by `amount` world units, without turning
   * the camera.
   *
   * A sheet covering the bottom third of the display was hiding the very part
   * it described. Note the direction: to make the subject rise on screen the
   * look-at point has to move *down*, because whatever the camera looks at is
   * what sits at the centre. The first version of this raised the look-at point
   * instead and pushed the model further behind the sheet; the sign is now
   * asserted in the smoke test.
   */
  setLift(amount: number) {
    this.goalLift = amount;
    this.idleFor = 0;
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled;
    this.idleFor = 0;
  }

  reset() {
    this.goalLift = 0;
    this.goalTheta = this.home.theta;
    this.goalPhi = this.home.phi;
    this.goalRadius = this.home.radius;
    this.goalTarget.set(0, 0, 0);
    this.idleFor = 0;
  }

  /** Marks deliberate interaction, which suspends auto-rotation for a while. */
  interact() {
    this.idleFor = 0;
  }

  /**
   * Advances the easing. Returns true when something actually changed, which is
   * what tells the viewer another frame is needed.
   */
  update(delta: number, idleThreshold: number): boolean {
    let moved = false;
    this.idleFor += delta;

    if (this.autoRotate && this.idleFor > idleThreshold) {
      this.goalTheta -= delta * 0.14;
      moved = true;
    }

    // Frame-rate independent exponential easing: the same feel at 60 and 120 Hz.
    const ease = 1 - Math.exp(-delta * 11);
    const dTheta = this.goalTheta - this.theta;
    const dPhi = this.goalPhi - this.phi;
    const dRadius = this.goalRadius - this.radius;
    const dTarget = this.goalTarget.distanceTo(this.target);
    const dLift = this.goalLift - this.lift;

    if (
      Math.abs(dTheta) > EPSILON ||
      Math.abs(dPhi) > EPSILON ||
      Math.abs(dRadius) > EPSILON ||
      dTarget > EPSILON ||
      Math.abs(dLift) > EPSILON
    ) {
      this.theta += dTheta * ease;
      this.phi += dPhi * ease;
      this.radius += dRadius * ease;
      this.lift += dLift * ease;
      this.target.lerp(this.goalTarget, ease);
      moved = true;
    }

    if (moved) this.apply();
    return moved;
  }

  private apply() {
    const sinPhi = Math.sin(this.phi);
    // Subtracted from both the eye and the target, so the camera slides rather
    // than tilts — the object keeps the same face turned toward you — and a
    // positive lift raises the subject on screen.
    const y = this.target.y - this.lift;
    this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta),
    );
    this.camera.lookAt(this.target.x, y, this.target.z);
    this.camera.updateMatrixWorld();
  }
}
