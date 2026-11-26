import {
  animatedLayerIds,
  indexTracks,
  isIdentity,
  layerOrigin,
  layerState,
  type LayerState,
  type TrackIndex,
} from "./motion";
import { resolvePaint, resolveStopColor } from "./helpers";
import type { AssetDefinition, Layer, ShapeLayer } from "./schema";

/**
 * Renders an Asset Definition to a small virtual tree. The tree only ever contains
 * allowlisted SVG elements and attributes built from validated numbers, colors and
 * path data — never raw markup — so it is safe to serialize (server) or to build with
 * createElementNS (browser).
 */

export type SvgTag =
  | "svg"
  | "g"
  | "path"
  | "circle"
  | "ellipse"
  | "rect"
  | "line"
  | "polygon"
  | "polyline"
  | "title"
  | "style"
  | "defs"
  | "linearGradient"
  | "radialGradient"
  | "stop";

export interface VNode {
  tag: SvgTag;
  attrs: Record<string, string>;
  children: (VNode | string)[];
}

export const SVG_NS = "http://www.w3.org/2000/svg";

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** SVG `transform` attribute for a layer state around an origin. */
export function svgTransform(s: LayerState, origin: [number, number]): string | undefined {
  if (isIdentity(s)) return undefined;
  const [ox, oy] = origin;
  const parts: string[] = [];
  if (s.translateX !== 0 || s.translateY !== 0) parts.push(`translate(${fmt(s.translateX)} ${fmt(s.translateY)})`);
  if (s.rotate !== 0) parts.push(`rotate(${fmt(s.rotate)} ${fmt(ox)} ${fmt(oy)})`);
  if (s.scaleX !== 1 || s.scaleY !== 1) {
    parts.push(`translate(${fmt(ox)} ${fmt(oy)}) scale(${fmt(s.scaleX)} ${fmt(s.scaleY)}) translate(${fmt(-ox)} ${fmt(-oy)})`);
  }
  return parts.join(" ");
}

/** CSS `transform` value (used with transform-box: view-box; transform-origin: 0 0). */
export function cssTransform(s: LayerState, origin: [number, number]): string {
  const [ox, oy] = origin;
  return (
    `translate(${fmt(s.translateX)}px,${fmt(s.translateY)}px) ` +
    `translate(${fmt(ox)}px,${fmt(oy)}px) rotate(${fmt(s.rotate)}deg) scale(${fmt(s.scaleX)},${fmt(s.scaleY)}) ` +
    `translate(${fmt(-ox)}px,${fmt(-oy)}px)`
  );
}

function shapeNode(layer: ShapeLayer, tokens: Record<string, string>, gradientPrefix = ""): VNode {
  const s = layer.shape;
  const attrs: Record<string, string> = {};
  switch (s.type) {
    case "path":
      attrs.d = s.d;
      break;
    case "circle":
      Object.assign(attrs, { cx: fmt(s.cx), cy: fmt(s.cy), r: fmt(s.r) });
      break;
    case "ellipse":
      Object.assign(attrs, { cx: fmt(s.cx), cy: fmt(s.cy), rx: fmt(s.rx), ry: fmt(s.ry) });
      break;
    case "rect":
      Object.assign(attrs, { x: fmt(s.x), y: fmt(s.y), width: fmt(s.width), height: fmt(s.height) });
      if (s.rx !== undefined) attrs.rx = fmt(s.rx);
      break;
    case "line":
      Object.assign(attrs, { x1: fmt(s.x1), y1: fmt(s.y1), x2: fmt(s.x2), y2: fmt(s.y2) });
      break;
    case "polygon":
    case "polyline":
      attrs.points = s.points;
      break;
  }
  const fill = resolvePaint(layer.fill, tokens, gradientPrefix);
  const stroke = resolvePaint(layer.stroke, tokens);
  // SVG default fill is black; make "no fill specified" explicit only for lines (which can't be filled).
  if (fill !== undefined) attrs.fill = fill;
  else if (s.type === "line" || s.type === "polyline") attrs.fill = "none";
  if (stroke !== undefined) attrs.stroke = stroke;
  if (layer.strokeWidth !== undefined) attrs["stroke-width"] = fmt(layer.strokeWidth);
  if (layer.lineCap) attrs["stroke-linecap"] = layer.lineCap;
  if (layer.lineJoin) attrs["stroke-linejoin"] = layer.lineJoin;
  if (layer.fillRule) attrs["fill-rule"] = layer.fillRule;
  return { tag: s.type, attrs, children: [] };
}

export interface RenderOptions {
  /** Token overrides (customer customization). Unknown tokens are ignored. */
  tokens?: Record<string, string>;
  /** Output width/height attributes (px). Defaults to the viewBox size. */
  size?: number;
  /** Include a <title> for accessibility (default true). */
  title?: boolean;
  /** Background color painted behind the artwork (exports like MP4 need one). */
  background?: string;
  /** Prefix for gradient element ids. Defaults to the asset slug; give each copy on one page its own prefix. */
  idPrefix?: string;
}

const gradientPrefixFor = (ad: AssetDefinition, opts: RenderOptions) => `${opts.idPrefix ?? `g-${ad.slug}`}-`;

/** <defs> with the asset's gradients (user-space coordinates), or null when it has none. */
function defsNode(ad: AssetDefinition, tokens: Record<string, string>, prefix: string): VNode | null {
  const gradients = ad.gradients ?? []; // definitions saved before gradients existed have no list
  if (!gradients.length) return null;
  return {
    tag: "defs",
    attrs: {},
    children: gradients.map((g): VNode => {
      const stopNodes: VNode[] = g.stops.map((st) => ({
        tag: "stop",
        attrs: { offset: fmt(st.offset), "stop-color": resolveStopColor(st.color, tokens), ...(st.opacity !== undefined ? { "stop-opacity": fmt(st.opacity) } : {}) },
        children: [],
      }));
      return g.type === "linear"
        ? { tag: "linearGradient", attrs: { id: `${prefix}${g.id}`, gradientUnits: "userSpaceOnUse", x1: fmt(g.x1), y1: fmt(g.y1), x2: fmt(g.x2), y2: fmt(g.y2) }, children: stopNodes }
        : { tag: "radialGradient", attrs: { id: `${prefix}${g.id}`, gradientUnits: "userSpaceOnUse", cx: fmt(g.cx), cy: fmt(g.cy), r: fmt(g.r) }, children: stopNodes };
    }),
  };
}

export function mergeTokens(ad: AssetDefinition, overrides?: Record<string, string>): Record<string, string> {
  const out = { ...ad.tokens };
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k in out && /^#[0-9A-Fa-f]{6}$/.test(v)) out[k] = v;
  }
  return out;
}

function rootAttrs(ad: AssetDefinition, opts: RenderOptions): Record<string, string> {
  const [x, y, w, h] = ad.viewBox;
  const size = opts.size;
  return {
    xmlns: SVG_NS,
    viewBox: `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}`,
    width: fmt(size ?? w),
    height: fmt(size ? (size * h) / w : h),
    role: "img",
    "aria-label": ad.a11y.label,
  };
}

function backgroundNode(ad: AssetDefinition, color: string): VNode {
  const [x, y, w, h] = ad.viewBox;
  return { tag: "rect", attrs: { x: fmt(x), y: fmt(y), width: fmt(w), height: fmt(h), fill: color }, children: [] };
}

/** One static frame at timeline time `t` (ms). */
export function renderFrame(ad: AssetDefinition, t: number, opts: RenderOptions = {}): VNode {
  const tokens = mergeTokens(ad, opts.tokens);
  const gp = gradientPrefixFor(ad, opts);
  const idx = indexTracks(ad.timeline);
  const build = (layer: Layer): VNode => {
    const state = layerState(layer, idx, t);
    const inner = layer.kind === "group" ? { tag: "g" as const, attrs: {}, children: layer.children.map(build) } : shapeNode(layer, tokens, gp);
    const tr = svgTransform(state, layerOrigin(layer, ad));
    const needsWrap = tr !== undefined || state.opacity !== 1;
    if (!needsWrap) return { ...inner, attrs: { ...inner.attrs, "data-layer": layer.id } };
    const attrs: Record<string, string> = { "data-layer": layer.id };
    if (tr) attrs.transform = tr;
    if (state.opacity !== 1) attrs.opacity = fmt(state.opacity);
    return layer.kind === "group" ? { ...inner, attrs: { ...inner.attrs, ...attrs } } : { tag: "g", attrs, children: [inner] };
  };
  const children: VNode[] = [];
  if (opts.title !== false) children.push({ tag: "title", attrs: {}, children: [ad.a11y.label] } as VNode);
  const defs = defsNode(ad, tokens, gp);
  if (defs) children.push(defs);
  if (opts.background) children.push(backgroundNode(ad, opts.background));
  children.push(...ad.layers.map(build));
  return { tag: "svg", attrs: rootAttrs(ad, opts), children };
}

export interface AnimatedSvgOptions extends RenderOptions {
  /** Sampling rate for the CSS keyframes (default 30). Springs and curves are baked in. */
  fps?: number;
  /** "load": plays immediately; "hover": paused until hovered. */
  playOn?: "load" | "hover";
  /** Speed multiplier. */
  speed?: number;
}

/**
 * Self-contained animated SVG using CSS keyframes. Visual animation only — no sound and no
 * click interactions (those need the Web Component). Honors prefers-reduced-motion by
 * falling back to the designated static frame.
 */
export function renderAnimatedSvg(ad: AssetDefinition, opts: AnimatedSvgOptions = {}): VNode {
  const fps = opts.fps ?? 30;
  const speed = opts.speed ?? 1;
  const duration = ad.timeline.duration;
  const animated = animatedLayerIds(ad);
  const idx: TrackIndex = indexTracks(ad.timeline);
  const tokens = mergeTokens(ad, opts.tokens);
  const gp = gradientPrefixFor(ad, opts);
  const restT = ad.a11y.reducedMotionFrame;
  const frames = Math.max(2, Math.round((duration / 1000) * fps) + 1);
  const css: string[] = [];
  const iteration =
    ad.timeline.loop === true ? "infinite" : ad.timeline.loop === false ? "1" : String(ad.timeline.loop);

  const build = (layer: Layer): VNode => {
    const inner =
      layer.kind === "group" ? { tag: "g" as const, attrs: {} as Record<string, string>, children: layer.children.map(build) } : shapeNode(layer, tokens, gp);
    const origin = layerOrigin(layer, ad);
    const rest = layerState(layer, idx, restT);
    const attrs: Record<string, string> = { "data-layer": layer.id };
    const restTr = svgTransform(rest, origin);
    if (restTr) attrs.transform = restTr;
    if (rest.opacity !== 1) attrs.opacity = fmt(rest.opacity);
    if (animated.has(layer.id)) {
      const cls = `a-${layer.id}`;
      attrs.class = cls;
      const stops: string[] = [];
      let prev = "";
      for (let i = 0; i < frames; i++) {
        const pct = (i / (frames - 1)) * 100;
        const s = layerState(layer, idx, (i / (frames - 1)) * duration);
        const body = `transform:${cssTransform(s, origin)};opacity:${fmt(s.opacity)}`;
        // Drop interior stops identical to both neighbours' value to keep files small.
        if (body === prev && i !== frames - 1) {
          const next = layerState(layer, idx, ((i + 1) / (frames - 1)) * duration);
          if (`transform:${cssTransform(next, origin)};opacity:${fmt(next.opacity)}` === body) continue;
        }
        prev = body;
        stops.push(`${fmt(pct)}%{${body}}`);
      }
      css.push(`@keyframes k-${layer.id}{${stops.join("")}}`);
      css.push(
        `.${cls}{transform-box:view-box;transform-origin:0 0;animation:k-${layer.id} ${fmt(duration / speed)}ms linear ${iteration} both}`,
      );
    }
    if (Object.keys(attrs).length === 1) return { ...inner, attrs: { ...inner.attrs, ...attrs } };
    return layer.kind === "group" ? { ...inner, attrs: { ...inner.attrs, ...attrs } } : { tag: "g", attrs, children: [inner] };
  };

  const layers = ad.layers.map(build);
  if (opts.playOn === "hover") {
    css.push("svg [class^='a-']{animation-play-state:paused}svg:hover [class^='a-']{animation-play-state:running}");
  }
  css.push("@media (prefers-reduced-motion:reduce){[class^='a-']{animation:none!important}}");
  const children: VNode[] = [];
  if (opts.title !== false) children.push({ tag: "title", attrs: {}, children: [ad.a11y.label] });
  children.push({ tag: "style", attrs: {}, children: [css.join("")] });
  const defs = defsNode(ad, tokens, gp);
  if (defs) children.push(defs);
  if (opts.background) children.push(backgroundNode(ad, opts.background));
  children.push(...layers);
  return { tag: "svg", attrs: rootAttrs(ad, opts), children };
}

// ─── Serialization ───────────────────────────────────────────────────────────

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function serialize(node: VNode | string, parentTag?: SvgTag): string {
  if (typeof node === "string") {
    // <style> content is generated by us from numbers and ids only; still neutralize "</".
    return parentTag === "style" ? node.replace(/<\//g, "<\\/") : escText(node);
  }
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
    .join("");
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map((c) => serialize(c, node.tag)).join("")}</${node.tag}>`;
}

export function renderFrameSvg(ad: AssetDefinition, t: number, opts?: RenderOptions): string {
  return serialize(renderFrame(ad, t, opts));
}

export function renderAnimatedSvgString(ad: AssetDefinition, opts?: AnimatedSvgOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(renderAnimatedSvg(ad, opts))}\n`;
}

/**
 * Stable DOM structure for live playback: every layer is wrapped in its own
 * `<g data-layer="id">` so a player can update transforms/opacity per frame
 * without rebuilding the tree.
 */
export function renderStructure(ad: AssetDefinition, opts: RenderOptions = {}): VNode {
  const tokens = mergeTokens(ad, opts.tokens);
  const gp = gradientPrefixFor(ad, opts);
  const build = (layer: Layer): VNode => ({
    tag: "g",
    attrs: { "data-layer": layer.id },
    children: [layer.kind === "group" ? { tag: "g", attrs: {}, children: layer.children.map(build) } : shapeNode(layer, tokens, gp)],
  });
  const children: VNode[] = [];
  if (opts.title !== false) children.push({ tag: "title", attrs: {}, children: [ad.a11y.label] });
  const defs = defsNode(ad, tokens, gp);
  if (defs) children.push(defs);
  if (opts.background) children.push(backgroundNode(ad, opts.background));
  children.push(...ad.layers.map(build));
  return { tag: "svg", attrs: rootAttrs(ad, opts), children };
}
