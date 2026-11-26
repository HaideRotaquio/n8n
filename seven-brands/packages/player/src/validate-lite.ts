import type { AssetDefinition } from "@sb/asset/runtime";

/**
 * Dependency-free structural check used by the standalone <daos-asset> bundle (keeps it small).
 * The full Zod schema validates every asset on the server before it is published; this guard
 * protects customers' pages from malformed or tampered JSON. The player itself only sets
 * fixed attribute names via setAttribute, so even unexpected values cannot inject markup.
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;
const POINTS = /^[0-9eE.,+\-\s]+$/;
const SHAPES = new Set(["path", "circle", "ellipse", "rect", "line", "polygon", "polyline"]);
const PROPS = new Set(["translateX", "translateY", "rotate", "scale", "scaleX", "scaleY", "opacity"]);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100_000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function paintOk(p: unknown, tokens: Record<string, unknown>, gradients?: Set<string>): boolean {
  if (p === undefined || p === "none") return true;
  if (typeof p === "string") return HEX.test(p);
  if (gradients && isObj(p) && typeof p.gradient === "string") return gradients.has(p.gradient);
  return isObj(p) && typeof p.token === "string" && p.token in tokens;
}

/** Gradients: known ids, finite coordinates, 2–8 stops with valid colours. Returns the ids, or null if invalid. */
function gradientIds(v: unknown, tokens: Record<string, unknown>): Set<string> | null {
  if (v === undefined) return new Set();
  if (!Array.isArray(v) || v.length > 32) return null;
  const ids = new Set<string>();
  for (const g of v) {
    if (!isObj(g) || typeof g.id !== "string" || !ID.test(g.id) || ids.has(g.id)) return null;
    const coords = g.type === "linear" ? [g.x1, g.y1, g.x2, g.y2] : g.type === "radial" ? [g.cx, g.cy, g.r] : null;
    if (!coords || !coords.every(isNum)) return null;
    if (!Array.isArray(g.stops) || g.stops.length < 2 || g.stops.length > 8) return null;
    for (const st of g.stops) {
      if (!isObj(st) || !isNum(st.offset) || (st.opacity !== undefined && !isNum(st.opacity))) return null;
      if (!(typeof st.color === "string" ? HEX.test(st.color) : isObj(st.color) && typeof st.color.token === "string" && st.color.token in tokens)) return null;
    }
    ids.add(g.id);
  }
  return ids;
}

function layerOk(l: unknown, tokens: Record<string, unknown>, depth: number, budget: { n: number }, gradients: Set<string>): boolean {
  if (!isObj(l) || depth > 20 || --budget.n < 0) return false;
  if (typeof l.id !== "string" || !ID.test(l.id)) return false;
  if (l.opacity !== undefined && !isNum(l.opacity)) return false;
  if (l.origin !== undefined && !(Array.isArray(l.origin) && l.origin.length === 2 && l.origin.every(isNum))) return false;
  if (l.transform !== undefined && !(isObj(l.transform) && Object.values(l.transform).every(isNum))) return false;
  if (l.kind === "group") return Array.isArray(l.children) && l.children.every((c) => layerOk(c, tokens, depth + 1, budget, gradients));
  if (l.kind !== "shape" || !isObj(l.shape) || !SHAPES.has(l.shape.type as string)) return false;
  const s = l.shape;
  for (const [k, v] of Object.entries(s)) {
    if (k === "type") continue;
    if (k === "d") {
      if (typeof v !== "string" || v.length > 50_000 || !PATH.test(v)) return false;
    } else if (k === "points") {
      if (typeof v !== "string" || v.length > 20_000 || !POINTS.test(v)) return false;
    } else if (!isNum(v)) return false;
  }
  if (l.strokeWidth !== undefined && !isNum(l.strokeWidth)) return false;
  return paintOk(l.fill, tokens, gradients) && paintOk(l.stroke, tokens);
}

export function isAssetDefinition(v: unknown): v is AssetDefinition {
  if (!isObj(v) || v.schema !== "daos.asset/1") return false;
  if (!Array.isArray(v.viewBox) || v.viewBox.length !== 4 || !v.viewBox.every(isNum)) return false;
  if (!isObj(v.tokens) || !Object.values(v.tokens).every((c) => typeof c === "string" && HEX.test(c))) return false;
  const budget = { n: 1000 };
  const gradients = gradientIds(v.gradients, v.tokens as Record<string, unknown>);
  if (!gradients) return false;
  if (!Array.isArray(v.layers) || !v.layers.every((l) => layerOk(l, v.tokens as Record<string, unknown>, 0, budget, gradients))) return false;
  const tl = v.timeline;
  if (!isObj(tl) || !isNum(tl.duration) || tl.duration < 100 || !Array.isArray(tl.tracks)) return false;
  if (!(typeof tl.loop === "boolean" || isNum(tl.loop))) return false;
  if (tl.markers !== undefined && !(Array.isArray(tl.markers) && tl.markers.every((m) => isObj(m) && isNum(m.at)))) return false;
  for (const tr of tl.tracks) {
    if (!isObj(tr) || typeof tr.target !== "string" || !PROPS.has(tr.property as string) || !Array.isArray(tr.keyframes) || tr.keyframes.length === 0) return false;
    if (!tr.keyframes.every((k) => isObj(k) && isNum(k.at) && isNum(k.value))) return false;
  }
  if (!Array.isArray(v.sounds ?? []) || !Array.isArray(v.interactions ?? [])) return false;
  for (const c of (v.sounds ?? []) as unknown[]) {
    if (!isObj(c) || typeof c.sound !== "string" || typeof c.id !== "string") return false;
    if (c.at !== undefined && !isNum(c.at)) return false;
    if (c.gain !== undefined && !isNum(c.gain)) return false;
    if (c.pan !== undefined && !(isNum(c.pan) && (c.pan as number) >= -1 && (c.pan as number) <= 1)) return false;
    if (c.panFrom !== undefined && typeof c.panFrom !== "string") return false;
  }
  if (!isObj(v.a11y) || typeof v.a11y.label !== "string" || !isNum(v.a11y.reducedMotionFrame)) return false;
  return true;
}

/** Fills defaults the Zod schema would add (markers, sounds, interactions, gains). */
export function withDefaults(ad: AssetDefinition): AssetDefinition {
  return {
    ...ad,
    timeline: { ...ad.timeline, markers: ad.timeline.markers ?? [] },
    sounds: (ad.sounds ?? []).map((s) => ({ ...s, gain: s.gain ?? 1 })),
    interactions: ad.interactions ?? [],
    gradients: ad.gradients ?? [],
  };
}
