/**
 * How opaque each part should be, given the tools that are switched on.
 *
 * Pulled out of the viewer because it is the one piece of the render path that
 * is pure arithmetic — no GL, no scene graph — and it is also the piece that
 * decides whether the user can actually see what they asked to see. Keeping it
 * here means the smoke test can check the rules on a machine with no GPU.
 */

export const GHOST = 0.14;
export const XRAY_SHELL = 0.1;
export const XRAY_MID = 0.3;

export type VisibilityState = {
  /** Layers shallower than this are removed entirely. */
  peel: number;
  xray: boolean;
  isolate: boolean;
  focus: Set<string> | null;
  /** The shallowest layer present in `focus`. */
  focusFloor: number;
  /** The selected part, or null — including when a quiz is suppressing it. */
  subject: string | null;
};

/** What a part that is normally see-through comes up to when you ask for it. */
export const ATTENTION = 0.62;

export function partOpacity(
  part: { id: string; layer: number; opacity?: number },
  state: VisibilityState,
): number {
  const { peel, xray, isolate, focus, focusFloor, subject } = state;
  // A resting opacity below 1 belongs to parts that enclose everything else.
  // It scales every rule below rather than replacing them, so a translucent
  // shell still ghosts, still peels and still disappears under isolate.
  const base = part.opacity ?? 1;

  if (part.layer < peel) return 0;

  if (focus) {
    // A ghost still veils whatever is behind it, so ghosting the shell does not
    // reveal the core — it just puts a grey film over it. Anything shallower
    // than the focused set is removed; anything at or below it stays as a
    // ghost, where it provides context without getting in the way.
    if (!focus.has(part.id)) return part.layer < focusFloor ? 0 : GHOST * base;
    return Math.max(base, ATTENTION);
  }

  if (subject) {
    // Selecting a see-through part is a request to look at it.
    if (part.id === subject) return Math.max(base, ATTENTION);
    return isolate ? 0 : GHOST * base;
  }

  if (xray) {
    if (part.layer === 0) return XRAY_SHELL * base;
    if (part.layer === 1) return XRAY_MID * base;
  }

  return base;
}
