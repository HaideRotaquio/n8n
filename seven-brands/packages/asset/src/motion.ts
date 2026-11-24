import type { AnimatableProperty, AssetDefinition, Easing, Keyframe, Layer, Timeline, Track } from "./schema";
import { walkLayers } from "./helpers";

/**
 * Motion evaluation shared by every target: the browser player, CSS keyframe export,
 * frame rendering for PNG/GIF/MP4 and (later) Lottie. One implementation means every
 * format moves identically.
 */

// ─── Easing ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, [number, number, number, number]> = {
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
};

/** Standard cubic-bezier timing function (same curve as CSS). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - p;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      const x = sx(t);
      if (Math.abs(x - p) < 1e-6) break;
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/**
 * Damped spring step response from 0 to 1 after `ms` milliseconds (analytic solution).
 * Physical time, so a spring behaves the same regardless of segment length.
 */
export function springAt(ms: number, s: { stiffness: number; damping: number; mass?: number }): number {
  const t = ms / 1000;
  if (t <= 0) return 0;
  const m = s.mass ?? 1;
  const w0 = Math.sqrt(s.stiffness / m);
  const zeta = s.damping / (2 * Math.sqrt(s.stiffness * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const r = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - r);
  const r2 = -w0 * (zeta + r);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** Progress (0..1, may overshoot for springs/bezier) for a segment of length `segMs` at `elapsedMs`. */
export function easeProgress(ease: Easing | undefined, elapsedMs: number, segMs: number): number {
  if (segMs <= 0) return 1;
  const p = Math.min(Math.max(elapsedMs / segMs, 0), 1);
  if (ease === undefined || ease === "linear") return p;
  if (ease === "step") return p < 1 ? 0 : 1;
  if (typeof ease === "string") return cubicBezier(...PRESETS[ease]!)(p);
  if ("cubicBezier" in ease) return cubicBezier(...ease.cubicBezier)(p);
  return elapsedMs >= segMs ? 1 : springAt(elapsedMs, ease.spring);
}

// ─── Tracks & layer state ────────────────────────────────────────────────────

export const DEFAULTS: Record<AnimatableProperty, number> = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
};

export function sortedKeyframes(track: Track): Keyframe[] {
  return [...track.keyframes].sort((a, b) => a.at - b.at);
}

export function evaluateTrack(keyframes: readonly Keyframe[], t: number): number {
  const first = keyframes[0]!;
  if (t <= first.at || keyframes.length === 1) return first.value;
  const last = keyframes[keyframes.length - 1]!;
  if (t >= last.at) return last.value;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (t >= a.at && t <= b.at) {
      const p = easeProgress(a.ease, t - a.at, b.at - a.at);
      return a.value + (b.value - a.value) * p;
    }
  }
  return last.value;
}

export interface LayerState {
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}

export type TrackIndex = Map<string, Map<AnimatableProperty, Keyframe[]>>;

export function indexTracks(timeline: Timeline): TrackIndex {
  const idx: TrackIndex = new Map();
  for (const tr of timeline.tracks) {
    const m = idx.get(tr.target) ?? new Map();
    m.set(tr.property, sortedKeyframes(tr));
    idx.set(tr.target, m);
  }
  return idx;
}

export function layerState(layer: Layer, idx: TrackIndex, t: number): LayerState {
  const props = idx.get(layer.id);
  const v = (p: AnimatableProperty) => {
    const k = props?.get(p);
    return k ? evaluateTrack(k, t) : DEFAULTS[p];
  };
  const st = layer.transform ?? {};
  const s = v("scale") * (st.scale ?? 1);
  return {
    translateX: v("translateX") + (st.translateX ?? 0),
    translateY: v("translateY") + (st.translateY ?? 0),
    rotate: v("rotate") + (st.rotate ?? 0),
    scaleX: s * v("scaleX"),
    scaleY: s * v("scaleY"),
    opacity: Math.min(1, Math.max(0, v("opacity") * (layer.opacity ?? 1))),
  };
}

export function isIdentity(s: LayerState): boolean {
  return s.translateX === 0 && s.translateY === 0 && s.rotate === 0 && s.scaleX === 1 && s.scaleY === 1;
}

/** Ids of layers that have at least one track. */
export function animatedLayerIds(ad: AssetDefinition): Set<string> {
  return new Set(ad.timeline.tracks.map((t) => t.target));
}

export function layerOrigin(layer: Layer, ad: AssetDefinition): [number, number] {
  if (layer.origin) return layer.origin;
  const [x, y, w, h] = ad.viewBox;
  return [x + w / 2, y + h / 2];
}

// ─── Playback time ───────────────────────────────────────────────────────────

/** Total play length in ms; Infinity for endless loops. */
export function totalDuration(timeline: Timeline): number {
  if (timeline.loop === true) return Infinity;
  if (timeline.loop === false) return timeline.duration;
  return timeline.duration * timeline.loop;
}

/** Maps elapsed playback time to timeline time, honoring loop settings. */
export function localTime(timeline: Timeline, elapsedMs: number): number {
  const d = timeline.duration;
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= totalDuration(timeline)) return d;
  return elapsedMs % d;
}

export function hasLayer(ad: AssetDefinition, id: string): boolean {
  for (const l of walkLayers(ad.layers)) if (l.id === id) return true;
  return false;
}
