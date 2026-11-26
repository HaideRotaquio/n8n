import type { Gradient, Layer } from "@sb/asset";

/**
 * "Clay 3D" lighting from a single top-left light, built on gradient fills:
 * - `clayGradients` defines the shared gradients for one asset;
 * - `sphereLight` lays a clay highlight-to-shade gradient over a round volume (head, face);
 * - `litCopies` adds a lit overlay on top of every filled shape in a list (hair, hats, accessories), all using one
 *   scene-wide light so the whole character is lit from the same direction;
 * - `contactShadow` is a soft-edged shadow where two volumes meet.
 * Overlays are white/black with opacity ramps, so they work over any colour, including customers' own.
 */

const WHITE = "#FFFFFF";
const BLACK = "#000000";
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Sphere {
  cx: number;
  cy: number;
  r: number;
}

/** Gradients for one asset: per-sphere clay light, the torso light, the scene light and contact shadows. */
export function clayGradients(spheres: Record<string, Sphere>, extra: Gradient[] = []): Gradient[] {
  const out: Gradient[] = Object.entries(spheres).map(([id, s]) => ({
    id: `clay-${id}`,
    type: "radial",
    cx: r2(s.cx - s.r * 0.4),
    cy: r2(s.cy - s.r * 0.46),
    r: r2(s.r * 1.55),
    stops: [
      { offset: 0, color: WHITE, opacity: 0.6 },
      { offset: 0.12, color: WHITE, opacity: 0.28 },
      { offset: 0.42, color: WHITE, opacity: 0 },
      { offset: 0.66, color: BLACK, opacity: 0 },
      { offset: 0.9, color: BLACK, opacity: 0.26 },
      { offset: 1, color: BLACK, opacity: 0.34 },
    ],
  }));
  out.push({
    id: "clay-scene",
    type: "radial",
    cx: 12,
    cy: 2,
    r: 66,
    stops: [
      { offset: 0, color: WHITE, opacity: 0.34 },
      { offset: 0.35, color: WHITE, opacity: 0.08 },
      { offset: 0.55, color: BLACK, opacity: 0 },
      { offset: 1, color: BLACK, opacity: 0.34 },
    ],
  });
  return [...out, ...extra];
}

/** Clay light over a circle (drawn just inside its outline). */
export function sphereLight(id: string, sphereId: string, s: Sphere): Layer {
  return { id, kind: "shape", shape: { type: "circle", cx: s.cx, cy: s.cy, r: r2(s.r - 0.9) }, fill: { gradient: `clay-${sphereId}` } };
}

/** A small soft specular spot, the "glossy toy" cue. */
export function specular(id: string, s: Sphere): Gradient & { layer: Layer } {
  const cx = r2(s.cx - s.r * 0.42);
  const cy = r2(s.cy - s.r * 0.5);
  const r = r2(s.r * 0.2);
  return {
    id: `spec-${id}`,
    type: "radial",
    cx,
    cy,
    r,
    stops: [
      { offset: 0, color: WHITE, opacity: 0.85 },
      { offset: 0.5, color: WHITE, opacity: 0.35 },
      { offset: 1, color: WHITE, opacity: 0 },
    ],
    layer: { id, kind: "shape", shape: { type: "ellipse", cx, cy, rx: r, ry: r2(r * 0.8) }, fill: { gradient: `spec-${id}` } },
  };
}

/** Soft-edged contact shadow (an ellipse filled with a fading radial gradient). */
export function contactShadow(id: string, cx: number, cy: number, rx: number, ry: number): { gradient: Gradient; layer: Layer } {
  return {
    gradient: { id: `shadow-${id}`, type: "radial", cx, cy, r: rx, stops: [{ offset: 0, color: BLACK, opacity: 0.32 }, { offset: 0.6, color: BLACK, opacity: 0.18 }, { offset: 1, color: BLACK, opacity: 0 }] },
    layer: { id, kind: "shape", shape: { type: "ellipse", cx, cy, rx, ry }, fill: { gradient: `shadow-${id}` } },
  };
}

/**
 * Returns `layers` with a lit overlay right after every filled shape (recursively inside groups). The overlay keeps the
 * shape's geometry and placement, drops its stroke, and uses `gradient`. Unfilled (line-only) shapes are left alone.
 */
export function litCopies(layers: Layer[], gradient = "clay-scene", skip: ReadonlySet<string> = new Set()): Layer[] {
  return layers.flatMap((l): Layer[] => {
    if (l.kind === "group") return [{ ...l, children: litCopies(l.children, gradient, skip) }];
    if (skip.has(l.id) || l.fill === undefined || l.fill === "none") return [l];
    const { stroke: _s, strokeWidth: _w, lineCap: _c, lineJoin: _j, fill: _f, ...rest } = l;
    return [l, { ...rest, id: `${l.id}-lit`.slice(0, 40), fill: { gradient } }];
  });
}
