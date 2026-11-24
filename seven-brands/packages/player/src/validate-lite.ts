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

function paintOk(p: unknown, tokens: Record<string, unknown>): boolean {
  if (p === undefined || p === "none") return true;
  if (typeof p === "string") return HEX.test(p);
  return isObj(p) && typeof p.token === "string" && p.token in tokens;
}

function layerOk(l: unknown, tokens: Record<string, unknown>, depth: number, budget: { n: number }): boolean {
  if (!isObj(l) || depth > 20 || --budget.n < 0) return false;
  if (typeof l.id !== "string" || !ID.test(l.id)) return false;
  if (l.opacity !== undefined && !isNum(l.opacity)) return false;
  if (l.origin !== undefined && !(Array.isArray(l.origin) && l.origin.length === 2 && l.origin.every(isNum))) return false;
  if (l.transform !== undefined && !(isObj(l.transform) && Object.values(l.transform).every(isNum))) return false;
  if (l.kind === "group") return Array.isArray(l.children) && l.children.every((c) => layerOk(c, tokens, depth + 1, budget));
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
  return paintOk(l.fill, tokens) && paintOk(l.stroke, tokens);
}

export function isAssetDefinition(v: unknown): v is AssetDefinition {
  if (!isObj(v) || v.schema !== "daos.asset/1") return false;
  if (!Array.isArray(v.viewBox) || v.viewBox.length !== 4 || !v.viewBox.every(isNum)) return false;
  if (!isObj(v.tokens) || !Object.values(v.tokens).every((c) => typeof c === "string" && HEX.test(c))) return false;
  const budget = { n: 1000 };
  if (!Array.isArray(v.layers) || !v.layers.every((l) => layerOk(l, v.tokens as Record<string, unknown>, 0, budget))) return false;
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
  };
}
