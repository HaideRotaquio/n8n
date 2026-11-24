// Zod-free helpers shared by the browser runtime.
import type { Layer, Paint, SoundCue, Timeline } from "./schema";

/** Iterate every layer depth-first. */
export function* walkLayers(layers: readonly Layer[]): Generator<Layer> {
  for (const l of layers) {
    yield l;
    if (l.kind === "group") yield* walkLayers(l.children);
  }
}

export function resolvePaint(paint: Paint | undefined, tokens: Record<string, string>): string | undefined {
  if (paint === undefined) return undefined;
  if (paint === "none") return "none";
  if (typeof paint === "string") return paint;
  const c = tokens[paint.token];
  if (!c) throw new Error(`Unknown color token: ${paint.token}`);
  return c;
}

/** Absolute time (ms) of a cue, resolving markers. */
export function cueTime(cue: SoundCue, timeline: Timeline): number {
  if (cue.at !== undefined) return cue.at;
  const m = timeline.markers.find((x) => x.id === cue.marker);
  if (!m) throw new Error(`Unknown marker: ${cue.marker}`);
  return Math.max(0, m.at + (cue.offset ?? 0));
}

