import { indexTracks, layerOrigin, layerState, resolvePaint, type AssetDefinition, type Layer, type ShapeLayer, resolveStopColor, type Gradient } from "@sb/asset";

/**
 * Asset Definition → Lottie (Bodymovin JSON, v5).
 *
 * - Geometry: every SVG path command (including arcs) becomes cubic Béziers; circles/ellipses/rects use Lottie's
 *   native shapes; lines and polygons become paths.
 * - Motion is baked frame by frame from our own motion engine, so springs and custom easings match the player exactly.
 * - Colors are the asset's default tokens (Lottie has no token system; editors such as LottieFiles can recolor).
 * - Lottie has no sound and no interactions: those stay in the Web Component, React and video exports.
 */

export const LOTTIE_FPS = 60;
/** Output size: viewBox units × this factor (64-unit icons → 512 px). */
const SCALE = 8;

type Vec = [number, number];
interface Vertex {
  v: Vec;
  i: Vec; // in-tangent, relative to v
  o: Vec; // out-tangent, relative to v
}
interface SubPath {
  vertices: Vertex[];
  closed: boolean;
}

// ─── SVG path → cubic Béziers ────────────────────────────────────────────────

/** Commands as { cmd }, numbers kept as their source text (arc flags may be packed, e.g. "a1 1 0 011 1"). */
type Tok = { cmd: string } | { n: string };
function tokenize(d: string): Tok[] {
  const out: Tok[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push(m[1] ? { cmd: m[1] } : { n: m[2]! });
  return out;
}

/** Arc (SVG endpoint parameterization) → cubic segments [c1, c2, end][]. */
function arcToCubics(p0: Vec, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p1: Vec): [Vec, Vec, Vec][] {
  if (rx === 0 || ry === 0 || (p0[0] === p1[0] && p0[1] === p1[1])) return [[p0, p1, p1]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const delta = dt / segs;
  const k = (4 / 3) * Math.tan(delta / 4);
  const point = (t: number): Vec => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const deriv = (t: number): Vec => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const out: [Vec, Vec, Vec][] = [];
  for (let s = 0; s < segs; s++) {
    const a = t1 + s * delta;
    const b = a + delta;
    const pa = point(a);
    const pb = s === segs - 1 ? p1 : point(b);
    const da = deriv(a);
    const db = deriv(b);
    out.push([
      [pa[0] + k * da[0], pa[1] + k * da[1]],
      [pb[0] - k * db[0], pb[1] - k * db[1]],
      pb,
    ]);
  }
  return out;
}

export function svgPathToSubpaths(d: string): SubPath[] {
  const tokens = tokenize(d);
  const subs: SubPath[] = [];
  let cur: SubPath | null = null;
  let pt: Vec = [0, 0];
  let start: Vec = [0, 0];
  let lastCubicCtrl: Vec | null = null;
  let lastQuadCtrl: Vec | null = null;
  let i = 0;
  let cmd = "";
  const num = () => {
    const v = tokens[i++];
    if (!v || !("n" in v)) throw new Error(`Bad path data near token ${i}`);
    return Number(v.n);
  };
  const flag = () => {
    const v = tokens[i];
    if (!v || !("n" in v) || (v.n[0] !== "0" && v.n[0] !== "1")) throw new Error("Bad arc flag");
    // Packed flags: take one digit and leave the rest of the number for the next read.
    if (v.n.length > 1) tokens[i] = { n: v.n.slice(1) };
    else i++;
    return v.n[0] === "1";
  };
  const begin = (p: Vec) => {
    cur = { vertices: [{ v: p, i: [0, 0], o: [0, 0] }], closed: false };
    subs.push(cur);
    start = p;
  };
  const cubic = (c1: Vec, c2: Vec, p: Vec) => {
    if (!cur) begin(pt);
    const verts = cur!.vertices;
    const last = verts[verts.length - 1]!;
    last.o = [c1[0] - last.v[0], c1[1] - last.v[1]];
    verts.push({ v: p, i: [c2[0] - p[0], c2[1] - p[1]], o: [0, 0] });
    pt = p;
  };
  const line = (p: Vec) => cubic(pt, p, p);
  while (i < tokens.length) {
    const t = tokens[i]!;
    if ("cmd" in t) {
      cmd = t.cmd;
      i++;
    } else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase();
    const R = (x: number, y: number): Vec => (rel ? [pt[0] + x, pt[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case "M": {
        const p = R(num(), num());
        pt = p;
        begin(p);
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case "L":
        line(R(num(), num()));
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      case "H": {
        const x = num();
        line([rel ? pt[0] + x : x, pt[1]]);
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case "V": {
        const y = num();
        line([pt[0], rel ? pt[1] + y : y]);
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case "C": {
        const c1 = R(num(), num());
        const c2 = R(num(), num());
        const p = R(num(), num());
        cubic(c1, c2, p);
        lastCubicCtrl = c2;
        lastQuadCtrl = null;
        break;
      }
      case "S": {
        const c1: Vec = lastCubicCtrl ? [2 * pt[0] - lastCubicCtrl[0], 2 * pt[1] - lastCubicCtrl[1]] : pt;
        const c2 = R(num(), num());
        const p = R(num(), num());
        cubic(c1, c2, p);
        lastCubicCtrl = c2;
        lastQuadCtrl = null;
        break;
      }
      case "Q": {
        const q = R(num(), num());
        const p = R(num(), num());
        cubic([pt[0] + (2 / 3) * (q[0] - pt[0]), pt[1] + (2 / 3) * (q[1] - pt[1])], [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])], p);
        lastQuadCtrl = q;
        lastCubicCtrl = null;
        break;
      }
      case "T": {
        const q: Vec = lastQuadCtrl ? [2 * pt[0] - lastQuadCtrl[0], 2 * pt[1] - lastQuadCtrl[1]] : pt;
        const p = R(num(), num());
        cubic([pt[0] + (2 / 3) * (q[0] - pt[0]), pt[1] + (2 / 3) * (q[1] - pt[1])], [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])], p);
        lastQuadCtrl = q;
        lastCubicCtrl = null;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = flag();
        const sweep = flag();
        const p = R(num(), num());
        for (const [c1, c2, e] of arcToCubics(pt, rx, ry, rot, large, sweep, p)) cubic(c1, c2, e);
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      case "Z": {
        if (cur) {
          const c = cur as SubPath;
          const verts = c.vertices;
          const last = verts[verts.length - 1]!;
          // A path that returns to its start: merge the duplicate end vertex into the first.
          if (verts.length > 1 && Math.abs(last.v[0] - start[0]) < 1e-6 && Math.abs(last.v[1] - start[1]) < 1e-6) {
            verts[0]!.i = last.i;
            verts.pop();
          }
          c.closed = true;
        }
        pt = start;
        cur = null;
        lastCubicCtrl = lastQuadCtrl = null;
        break;
      }
      default:
        throw new Error(`Unsupported path command "${cmd}"`);
    }
  }
  return subs;
}

// ─── Lottie building blocks ──────────────────────────────────────────────────

const stat = (k: unknown) => ({ a: 0, k });
const hexToRgb = (hex: string): [number, number, number, number] => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255, 1];

function pathItem(sp: SubPath, map: (p: Vec) => Vec, nm: string) {
  return {
    ty: "sh",
    nm,
    ks: stat({
      i: sp.vertices.map((x) => [x.i[0] * SCALE, x.i[1] * SCALE]),
      o: sp.vertices.map((x) => [x.o[0] * SCALE, x.o[1] * SCALE]),
      v: sp.vertices.map((x) => map(x.v)),
      c: sp.closed,
    }),
  };
}

function geometry(layer: ShapeLayer, map: (p: Vec) => Vec): unknown[] {
  const s = layer.shape;
  const id = layer.id;
  switch (s.type) {
    case "path":
      return svgPathToSubpaths(s.d).map((sp, k) => pathItem(sp, map, `${id}-${k}`));
    case "circle":
      return [{ ty: "el", nm: id, p: stat(map([s.cx, s.cy])), s: stat([s.r * 2 * SCALE, s.r * 2 * SCALE]) }];
    case "ellipse":
      return [{ ty: "el", nm: id, p: stat(map([s.cx, s.cy])), s: stat([s.rx * 2 * SCALE, s.ry * 2 * SCALE]) }];
    case "rect":
      return [{ ty: "rc", nm: id, p: stat(map([s.x + s.width / 2, s.y + s.height / 2])), s: stat([s.width * SCALE, s.height * SCALE]), r: stat((s.rx ?? 0) * SCALE) }];
    case "line":
      return [pathItem({ closed: false, vertices: [{ v: [s.x1, s.y1], i: [0, 0], o: [0, 0] }, { v: [s.x2, s.y2], i: [0, 0], o: [0, 0] }] }, map, id)];
    case "polygon":
    case "polyline": {
      const n = s.points.trim().split(/[\s,]+/).map(Number);
      const vertices: Vertex[] = [];
      for (let k = 0; k + 1 < n.length; k += 2) vertices.push({ v: [n[k]!, n[k + 1]!], i: [0, 0], o: [0, 0] });
      return [pathItem({ closed: s.type === "polygon", vertices }, map, id)];
    }
  }
}

/**
 * Lottie gradient fill ("gf"). Colour stops come first as [offset, r, g, b]…, then opacity stops as [offset, alpha]…,
 * which lottie-web and the native Lottie players read as an opacity ramp. Points use the shape's own coordinates,
 * like SVG's userSpaceOnUse; a radial gradient's end point sits one radius to the right of its centre.
 */
function gradientFill(g: Gradient, tokens: Record<string, string>, map: (p: Vec) => Vec, evenodd: boolean): unknown {
  const colors = g.stops.flatMap((st) => [st.offset, ...hexToRgb(resolveStopColor(st.color, tokens)).slice(0, 3)]);
  const alphas = g.stops.flatMap((st) => [st.offset, st.opacity ?? 1]);
  const [s, e]: [Vec, Vec] = g.type === "linear" ? [[g.x1, g.y1], [g.x2, g.y2]] : [[g.cx, g.cy], [g.cx + g.r, g.cy]];
  return {
    ty: "gf",
    nm: "fill",
    o: stat(100),
    r: evenodd ? 2 : 1,
    t: g.type === "linear" ? 1 : 2,
    s: stat(map(s)),
    e: stat(map(e)),
    g: { p: g.stops.length, k: stat([...colors, ...alphas]) },
    ...(g.type === "radial" ? { h: stat(0), a: stat(0) } : {}),
  };
}

function paintItems(layer: ShapeLayer, tokens: Record<string, string>, gradients: Map<string, Gradient>, map: (p: Vec) => Vec): unknown[] {
  const out: unknown[] = [];
  const stroke = resolvePaint(layer.stroke, tokens);
  const gradient = layer.fill && typeof layer.fill === "object" && "gradient" in layer.fill ? gradients.get(layer.fill.gradient) : undefined;
  // SVG default fill is black when unspecified (except lines/polylines, which our renderer leaves unfilled).
  const fill = gradient ? undefined : (resolvePaint(layer.fill, tokens) ?? (layer.shape.type === "line" || layer.shape.type === "polyline" ? undefined : "#000000"));
  if (stroke && stroke !== "none") {
    out.push({
      ty: "st",
      nm: "stroke",
      c: stat(hexToRgb(stroke)),
      o: stat(100),
      w: stat((layer.strokeWidth ?? 1) * SCALE),
      lc: { butt: 1, round: 2, square: 3 }[layer.lineCap ?? "butt"],
      lj: { miter: 1, round: 2, bevel: 3 }[layer.lineJoin ?? "miter"],
      ml: 4,
    });
  }
  if (gradient) out.push(gradientFill(gradient, tokens, map, layer.fillRule === "evenodd"));
  if (fill && fill !== "none") out.push({ ty: "fl", nm: "fill", c: stat(hexToRgb(fill)), o: stat(100), r: layer.fillRule === "evenodd" ? 2 : 1 });
  return out;
}

// ─── Transforms (baked per frame) ────────────────────────────────────────────

type Track = { t: number; s: number[] }[];

function bake(ad: AssetDefinition, layer: Layer, frames: number, map: (p: Vec) => Vec) {
  const idx = indexTracks(ad.timeline);
  const origin = layerOrigin(layer, ad);
  const anchor = map(origin);
  const sample = (f: number) => {
    const st = layerState(layer, idx, Math.min((f / LOTTIE_FPS) * 1000, ad.timeline.duration));
    return {
      p: [anchor[0] + st.translateX * SCALE, anchor[1] + st.translateY * SCALE],
      s: [st.scaleX * 100, st.scaleY * 100],
      r: [st.rotate],
      o: [st.opacity * 100],
    };
  };
  const animated = idx.has(layer.id);
  const first = sample(0);
  const prop = (key: "p" | "s" | "r" | "o") => {
    if (!animated) return stat(key === "r" || key === "o" ? first[key][0] : first[key]);
    const keys: Track = [];
    for (let f = 0; f <= frames; f++) keys.push({ t: f, s: sample(f)[key] });
    const same = (a: number[], b: number[]) => a.every((v, k) => Math.abs(v - b[k]!) < 1e-4);
    if (keys.every((k) => same(k.s, keys[0]!.s))) return stat(key === "r" || key === "o" ? keys[0]!.s[0] : keys[0]!.s);
    // Drop keyframes in the middle of runs of equal values (linear interpolation keeps the result identical).
    const kept = keys.filter((k, n) => n === 0 || n === keys.length - 1 || !(same(keys[n - 1]!.s, k.s) && same(keys[n + 1]!.s, k.s)));
    const dims = kept[0]!.s.length;
    const ease = { i: { x: Array(dims).fill(1), y: Array(dims).fill(1) }, o: { x: Array(dims).fill(0), y: Array(dims).fill(0) } };
    return { a: 1, k: kept.map((k, n) => (n === kept.length - 1 ? { t: k.t, s: k.s } : { t: k.t, s: k.s, ...ease })) };
  };
  return { a: stat(anchor), p: prop("p"), s: prop("s"), r: prop("r"), o: prop("o") };
}

function groupItem(ad: AssetDefinition, layer: Layer, frames: number, tokens: Record<string, string>, map: (p: Vec) => Vec, gradients = new Map((ad.gradients ?? []).map((g) => [g.id, g]))): unknown {
  const items =
    layer.kind === "group"
      ? [...layer.children].reverse().map((c) => groupItem(ad, c, frames, tokens, map, gradients))
      : [...geometry(layer, map), ...paintItems(layer, tokens, gradients, map)];
  const tr = bake(ad, layer, frames, map);
  return { ty: "gr", nm: layer.id, it: [...items, { ty: "tr", ...tr, sk: stat(0), sa: stat(0) }] };
}

export interface LottieOptions {
  /** Token overrides, same as the player's customization. */
  tokens?: Record<string, string>;
}

export function exportLottie(ad: AssetDefinition, opts: LottieOptions = {}): Record<string, unknown> {
  const [vx, vy, vw, vh] = ad.viewBox;
  const map = (p: Vec): Vec => [(p[0] - vx) * SCALE, (p[1] - vy) * SCALE];
  const tokens = { ...ad.tokens, ...(opts.tokens ?? {}) };
  const frames = Math.max(1, Math.round((ad.timeline.duration / 1000) * LOTTIE_FPS));
  // Lottie draws the first layer on top; SVG draws the last element on top.
  const layers = [...ad.layers].reverse().map((layer, n) => {
    const g = groupItem(ad, layer, frames, tokens, map) as { it: unknown[] };
    return { ddd: 0, ind: n + 1, ty: 4, nm: layer.id, sr: 1, ks: { o: stat(100), r: stat(0), p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]) }, ao: 0, shapes: [g], ip: 0, op: frames, st: 0, bm: 0 };
  });
  return {
    v: "5.7.4",
    fr: LOTTIE_FPS,
    ip: 0,
    op: frames,
    w: Math.round(vw * SCALE),
    h: Math.round(vh * SCALE),
    nm: ad.name,
    ddd: 0,
    assets: [],
    layers,
    markers: ad.timeline.markers.map((m) => ({ tm: Math.round((m.at / 1000) * LOTTIE_FPS), cm: m.id, dr: 0 })),
    meta: { g: "DAOS Lottie exporter", a: ad.brand, d: ad.a11y.label },
  };
}
