// Zod-free helpers shared by the browser runtime.
import type { Layer, Paint, SoundCue, Timeline, FillPaint, GradientStop } from "./schema";

/** Iterate every layer depth-first. */
export function* walkLayers(layers: readonly Layer[]): Generator<Layer> {
  for (const l of layers) {
    yield l;
    if (l.kind === "group") yield* walkLayers(l.children);
  }
}

/**
 * Resolves a paint to an SVG paint value. Gradient fills become `url(#<prefix><id>)`; the renderer emits matching
 * <defs>. Exporters without SVG paint servers (Lottie) handle gradients themselves and never reach that branch.
 */
export function resolvePaint(paint: FillPaint | undefined, tokens: Record<string, string>, gradientPrefix = ""): string | undefined {
  if (paint === undefined) return undefined;
  if (paint === "none") return "none";
  if (typeof paint === "string") return paint;
  if ("gradient" in paint) return `url(#${gradientPrefix}${paint.gradient})`;
  const c = tokens[paint.token];
  if (!c) throw new Error(`Unknown color token: ${paint.token}`);
  return c;
}

/** A gradient stop's colour as #RRGGBB. */
export function resolveStopColor(color: GradientStop["color"], tokens: Record<string, string>): string {
  if (typeof color === "string") return color;
  const c = tokens[color.token];
  if (!c) throw new Error(`Unknown color token: ${color.token}`);
  return c;
}

/** Absolute time (ms) of a cue, resolving markers. */
export function cueTime(cue: SoundCue, timeline: Timeline): number {
  if (cue.at !== undefined) return cue.at;
  const m = timeline.markers.find((x) => x.id === cue.marker);
  if (!m) throw new Error(`Unknown marker: ${cue.marker}`);
  return Math.max(0, m.at + (cue.offset ?? 0));
}

