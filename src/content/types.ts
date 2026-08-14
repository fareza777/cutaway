/**
 * The content contract.
 *
 * Adding an object to Cutaway is two files: a `.glb` whose meshes are named,
 * and one JSON describing what those names mean. Nothing here carries 3D
 * coordinates — hotspot anchors, explode directions and framing are all derived
 * from the geometry at load time, because hand-authored positions are the thing
 * that stops a library scaling past a dozen objects.
 */

export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';

/** Composable rigid motion, evaluated against a shared cycle angle. */
export type Motion = {
  /** Continuous rotation about `axis`, in cycles per crank revolution. */
  spin?: { axis: Axis; ratio: number };
  /** Sinusoidal travel along `axis`, in normalised model units. */
  slide?: { axis: Axis; amplitude: number; phase?: number };
  /** Sinusoidal rotation about `axis`, in radians. */
  swing?: { axis: Axis; amplitude: number; phase?: number };
};

export type Part = {
  id: string;
  /** Mesh names in the .glb. One part may own several meshes. */
  nodes: string[];
  name: string;
  /** One line, shown on the hotspot callout. */
  short: string;
  /** Full explanation, shown in the part sheet. */
  detail: string;
  /**
   * Assembly depth: 0 is the outer shell, higher numbers sit further inside.
   * Drives the peel slider and the default explode ordering.
   */
  layer: number;
  /** Optional explode direction override; defaults to radial from the centre. */
  explode?: Vec3;
  motion?: Motion;
  /** Suppresses the hotspot dot for parts that are structure, not content. */
  hidden?: boolean;
  /**
   * Resting opacity, 0–1. Defaults to 1.
   *
   * For the handful of parts that genuinely enclose everything else — a
   * pericardium, a serous membrane, a glass lid. Cutting such a part down until
   * it stops hiding the object is a lie about the anatomy; letting you see
   * through it is not. Selecting or focusing one still brings it up to where it
   * can be read.
   */
  opacity?: number;
};

/** One beat of the "how it works" walkthrough. */
export type Step = {
  title: string;
  body: string;
  /** Parts to isolate while this step is on screen. */
  focus?: string[];
};

export type Question =
  | { type: 'identify'; prompt: string; partId: string }
  | { type: 'choice'; prompt: string; choices: string[]; answer: number; explain?: string };

export type ObjectDoc = {
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  category: string;
  /** Accent colour; drives hotspots, highlights and the library card. */
  accent: string;
  summary: string;
  /** Rough real-world size, shown as context. */
  scale?: string;
  model: string;
  /** Default cross-section plane normal. */
  cutAxis: Axis;
  /** Radians applied to the model at rest, so it presents its readable face. */
  restRotation?: Vec3;
  parts: Part[];
  steps: Step[];
  quiz: Question[];
};

export type ObjectSummary = Pick<
  ObjectDoc,
  'id' | 'title' | 'subtitle' | 'category' | 'accent' | 'summary' | 'scale'
> & { partCount: number };

export function summarise(doc: ObjectDoc): ObjectSummary {
  return {
    id: doc.id,
    title: doc.title,
    subtitle: doc.subtitle,
    category: doc.category,
    accent: doc.accent,
    summary: doc.summary,
    scale: doc.scale,
    partCount: doc.parts.filter((part) => !part.hidden).length,
  };
}
