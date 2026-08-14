/**
 * The dots that label parts.
 *
 * Two ideas do the heavy lifting, both borrowed from how good desktop anatomy
 * viewers behave and adapted for touch:
 *
 *  1. A dot is anchored to its part's centre but drawn floated towards the
 *     camera by the part's own radius. Its screen position never moves, so it
 *     stays on the part; but it clears the surface, so the part cannot nibble
 *     the billboard — while anything genuinely in front still occludes it.
 *  2. Picking projects each dot to screen space rather than raycasting. Six
 *     multiplies per dot beats a mesh intersection, and it lets the hit target
 *     be a comfortable thumb radius rather than the literal sprite.
 */

import * as THREE from 'three';
import type { PartHandle } from './Assembly';
import { dotTexture, ringTexture } from './textures';

const PULSE_SECONDS = 4;
const FLASH_SECONDS = 1.6;
const FLASH_CORRECT = '#3ED598';
const FLASH_WRONG = '#FF5B5B';

type Marker = {
  id: string;
  part: PartHandle;
  dot: THREE.Sprite;
  ring: THREE.Sprite;
  /** Facing/occlusion fade, 0–1. */
  opacity: number;
  /** Selection or hover emphasis, 0–1. */
  emphasis: number;
};

export class Hotspots {
  readonly group = new THREE.Group();

  private markers: Marker[] = [];
  private ringMap = ringTexture();
  private pixelScale = 0.02;
  private time = 0;
  private selectedAt = -PULSE_SECONDS;
  private lastSelected: string | null = null;
  private flashes = new Map<string, { correct: boolean; until: number }>();
  private visible = true;
  private accent = new THREE.Color('#ffffff');

  private readonly toCamera = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3();

  constructor() {
    this.group.name = 'hotspots';
    this.group.renderOrder = 20;
  }

  build(parts: PartHandle[], accent: string) {
    this.clear();
    this.accent.set(accent);
    for (const part of parts) {
      if (part.def.hidden) continue;
      const map = dotTexture(accent);
      const dot = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: false,
          toneMapped: false,
        }),
      );
      dot.renderOrder = 21;

      const ring = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.ringMap,
          color: new THREE.Color(accent),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          sizeAttenuation: false,
          toneMapped: false,
        }),
      );
      ring.renderOrder = 20;
      ring.visible = false;

      this.group.add(ring, dot);
      this.markers.push({ id: part.def.id, part, dot, ring, opacity: 0, emphasis: 0 });
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.group.visible = visible;
  }

  /** Keeps dots a constant number of screen pixels across, at any zoom. */
  setPixelSize(pixels: number, viewportHeight: number, fovDegrees: number) {
    const fov = THREE.MathUtils.degToRad(fovDegrees);
    this.pixelScale = 2 * (pixels / Math.max(viewportHeight, 1)) * Math.tan(fov / 2);
  }

  flash(id: string, correct: boolean) {
    this.flashes.set(id, { correct, until: this.time + FLASH_SECONDS });
  }

  clearFlashes() {
    this.flashes.clear();
  }

  /**
   * Returns false while anything is still easing, which is the signal the
   * render loop uses to keep drawing.
   */
  update(camera: THREE.PerspectiveCamera, delta: number, selected: string | null): boolean {
    if (!this.visible || !this.markers.length) return true;
    this.time += delta;

    if (selected !== this.lastSelected) {
      this.lastSelected = selected;
      this.selectedAt = this.time;
    }
    const beating = this.time - this.selectedAt < PULSE_SECONDS;
    const ease = 1 - Math.exp(-delta * 12);
    let settled = true;

    for (const marker of this.markers) {
      const centre = marker.part.world;
      this.toCamera.copy(camera.position).sub(centre);
      const distance = this.toCamera.length();
      if (distance > 1e-4) this.toCamera.divideScalar(distance);

      // Float clear of the part's own surface without moving on screen.
      const lift = Math.min(marker.part.radius * 0.98, distance * 0.5);
      marker.dot.position.copy(centre).addScaledVector(this.toCamera, lift);
      marker.ring.position.copy(marker.dot.position);

      // Fade towards the silhouette: a dot edge-on to the viewer is ambiguous
      // about which part it belongs to, so let it recede.
      this.worldUp.copy(centre).sub(camera.position).normalize();
      const facing = Math.abs(this.worldUp.dot(this.toCamera));
      const hidden = marker.part.meshes.every((mesh) => !mesh.visible);
      const target = hidden ? 0 : THREE.MathUtils.smoothstep(facing, 0.1, 0.45);

      const emphasisTarget = marker.id === selected ? 1 : 0;
      if (Math.abs(target - marker.opacity) > 0.003) settled = false;
      if (Math.abs(emphasisTarget - marker.emphasis) > 0.003) settled = false;
      marker.opacity += (target - marker.opacity) * ease;
      marker.emphasis += (emphasisTarget - marker.emphasis) * ease;

      marker.dot.material.opacity = marker.opacity;
      marker.dot.visible = marker.opacity > 0.01;
      marker.dot.scale.setScalar(this.pixelScale * (1 + marker.emphasis * 0.35) * (0.76 + 0.24 * marker.opacity));

      const flash = this.flashes.get(marker.id);
      if (flash && this.time < flash.until) {
        const life = (flash.until - this.time) / FLASH_SECONDS;
        marker.ring.visible = true;
        marker.ring.material.color.set(flash.correct ? FLASH_CORRECT : FLASH_WRONG);
        marker.ring.material.opacity = Math.min(1, life * 2.4);
        marker.ring.scale.setScalar(this.pixelScale * (1.5 + (1 - life) * 2.4));
        settled = false;
      } else if (marker.emphasis > 0.01) {
        marker.ring.visible = true;
        marker.ring.material.color.copy(this.accent);
        if (beating) {
          const beat = (this.time * 0.8) % 1;
          marker.ring.material.opacity = marker.emphasis * marker.opacity * (1 - beat) * 0.8;
          marker.ring.scale.setScalar(this.pixelScale * (1.3 + beat * 1.7));
          settled = false;
        } else {
          marker.ring.material.opacity = marker.emphasis * marker.opacity * 0.45;
          marker.ring.scale.setScalar(this.pixelScale * 1.7);
        }
      } else if (marker.ring.visible) {
        marker.ring.visible = false;
      }
    }
    return settled;
  }

  /** Screen-space pick with a thumb-sized radius. Returns the closest hit. */
  pick(x: number, y: number, camera: THREE.PerspectiveCamera, width: number, height: number, radius = 30) {
    if (!this.visible) return null;
    let best: Marker | null = null;
    let bestDistance = radius;
    for (const marker of this.markers) {
      if (marker.opacity < 0.3) continue;
      this.projected.copy(marker.dot.position).project(camera);
      if (this.projected.z > 1) continue;
      const px = (this.projected.x * 0.5 + 0.5) * width;
      const py = (-this.projected.y * 0.5 + 0.5) * height;
      const distance = Math.hypot(px - x, py - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = marker;
      }
    }
    return best?.id ?? null;
  }


  clear() {
    for (const marker of this.markers) {
      marker.dot.material.map?.dispose();
      marker.dot.material.dispose();
      marker.ring.material.dispose();
    }
    this.markers = [];
    this.group.clear();
    this.flashes.clear();
    this.lastSelected = null;
  }

  dispose() {
    this.clear();
    this.ringMap.dispose();
    this.group.removeFromParent();
  }
}
