import { Layer, PathData, PointList, type FillPaint, type Paint, type ShapeLayer } from "@sb/asset";
import type { ChildNode, Element } from "domhandler";
import { parseDocument } from "htmlparser2";

/**
 * Imports untrusted SVG (AI output, designer uploads) into Asset Definition layers.
 *
 * Security model: the SVG is never rendered or re-emitted as-is. It is parsed into a tree,
 * and only allowlisted elements/attributes with validated values are converted into AD
 * layers; the AD renderer then produces fresh markup. Active content (scripts, event
 * handlers, foreignObject, external references) causes a hard rejection so it can be
 * flagged for review rather than silently "cleaned".
 */

export interface ImportIssue {
  code: string;
  message: string;
}

export interface ImportResult {
  ok: boolean;
  viewBox?: [number, number, number, number];
  layers: Layer[];
  tokens: Record<string, string>;
  errors: ImportIssue[];
  /** Things that were dropped or approximated. The reviewer sees these. */
  warnings: ImportIssue[];
}

export interface ImportOptions {
  /** Replace literal colors with tokens (primary, secondary, accent, color4…) ordered by usage. Default true. */
  tokenizeColors?: boolean;
  /** Max input size in bytes (default 500 KB). */
  maxBytes?: number;
  /** Max elements (default 1,000). */
  maxElements?: number;
}

const SHAPES = new Set(["path", "circle", "ellipse", "rect", "line", "polygon", "polyline"]);
const DANGEROUS = new Set(["script", "foreignobject", "iframe", "object", "embed", "handler", "listener"]);
const IGNORED_SILENTLY = new Set(["title", "desc", "metadata"]);

const NAMED: Record<string, string> = {
  black: "#000000", white: "#FFFFFF", red: "#FF0000", green: "#008000", blue: "#0000FF",
  yellow: "#FFFF00", orange: "#FFA500", purple: "#800080", pink: "#FFC0CB", gray: "#808080",
  grey: "#808080", brown: "#A52A2A", gold: "#FFD700", silver: "#C0C0C0", navy: "#000080",
  teal: "#008080", cyan: "#00FFFF", magenta: "#FF00FF", lime: "#00FF00", maroon: "#800000",
};

export function parseColor(raw: string | undefined): string | "none" | undefined | null {
  if (raw === undefined) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "" ) return undefined;
  if (v === "none" || v === "transparent") return "none";
  if (/^#[0-9a-f]{6}$/.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(v);
  if (rgb) {
    const hex = rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("");
    return `#${hex}`.toUpperCase();
  }
  if (NAMED[v]) return NAMED[v];
  return null; // unsupported (gradients via url(#…), currentColor, hsl…)
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const m = /^\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)(px)?\s*$/i.exec(v);
  return m ? Number(m[1]) : undefined;
}

function parseStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of (style ?? "").split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return out;
}

interface ParsedTransform {
  translateX?: number;
  translateY?: number;
  rotate?: number;
  scale?: number;
  origin?: [number, number];
}

/** Supports translate(), rotate(a [cx cy]) and uniform scale(). Anything else is unsupported. */
export function parseTransform(raw: string | undefined): ParsedTransform | null | undefined {
  if (!raw || !raw.trim()) return undefined;
  const out: ParsedTransform = {};
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let rest = raw;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    rest = rest.replace(m[0], "");
    const args = m[2]!.split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some((a) => !Number.isFinite(a))) return null;
    switch (m[1]) {
      case "translate":
        out.translateX = (out.translateX ?? 0) + (args[0] ?? 0);
        out.translateY = (out.translateY ?? 0) + (args[1] ?? 0);
        break;
      case "rotate":
        out.rotate = (out.rotate ?? 0) + (args[0] ?? 0);
        if (args.length === 3) out.origin = [args[1]!, args[2]!];
        break;
      case "scale":
        if (args.length === 2 && args[0] !== args[1]) return null;
        out.scale = (out.scale ?? 1) * (args[0] ?? 1);
        break;
      default:
        return null;
    }
  }
  return rest.trim() === "" ? out : null;
}

export function importSvg(source: string, opts: ImportOptions = {}): ImportResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const result = (extra: Partial<ImportResult> = {}): ImportResult => ({
    ok: errors.length === 0,
    layers: [],
    tokens: {},
    errors,
    warnings,
    ...extra,
  });

  const maxBytes = opts.maxBytes ?? 500_000;
  if (new TextEncoder().encode(source).length > maxBytes) {
    errors.push({ code: "too-large", message: `SVG is larger than ${maxBytes} bytes` });
    return result();
  }
  if (/<!ENTITY/i.test(source)) {
    errors.push({ code: "security", message: "DOCTYPE entity declarations are not allowed" });
    return result();
  }

  const doc = parseDocument(source, { xmlMode: true, recognizeCDATA: true });
  const root = doc.children.find((n): n is Element => n.type === "tag") as Element | undefined;
  if (!root || root.name.toLowerCase() !== "svg") {
    errors.push({ code: "not-svg", message: "Root element is not <svg>" });
    return result();
  }

  // Pass 1: security scan over the whole tree.
  let count = 0;
  const scan = (n: ChildNode) => {
    if (n.type !== "tag" && n.type !== "script" && n.type !== "style") return;
    const el = n as Element;
    count++;
    const name = el.name.toLowerCase();
    if (DANGEROUS.has(name)) errors.push({ code: "security", message: `<${el.name}> is not allowed` });
    for (const [k, v] of Object.entries(el.attribs)) {
      const key = k.toLowerCase();
      if (key.startsWith("on")) errors.push({ code: "security", message: `Event handler attribute "${k}" is not allowed` });
      if ((key === "href" || key === "xlink:href") && !v.trim().startsWith("#")) {
        errors.push({ code: "security", message: `External reference in ${k} is not allowed` });
      }
      if (/javascript:|data:text\/html|expression\s*\(/i.test(v)) {
        errors.push({ code: "security", message: `Suspicious value in attribute "${k}"` });
      }
    }
    el.children.forEach(scan);
  };
  scan(root);
  if (count > (opts.maxElements ?? 1000)) errors.push({ code: "too-complex", message: `More than ${opts.maxElements ?? 1000} elements` });
  if (errors.length) return result();

  // viewBox
  let viewBox: [number, number, number, number] | undefined;
  const vb = root.attribs.viewBox ?? root.attribs.viewbox;
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2]! > 0 && parts[3]! > 0) {
      viewBox = parts as [number, number, number, number];
    }
  }
  if (!viewBox) {
    const w = num(root.attribs.width);
    const h = num(root.attribs.height);
    if (w && h) {
      viewBox = [0, 0, w, h];
      warnings.push({ code: "no-viewbox", message: "No viewBox; derived from width/height" });
    } else {
      errors.push({ code: "no-viewbox", message: "SVG needs a viewBox (or numeric width and height)" });
      return result();
    }
  }

  // Pass 2: convert.
  const usedIds = new Set<string>();
  const makeId = (raw: string | undefined, fallback: string) => {
    let base = (raw ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^[^a-z]+/, "").slice(0, 32) || fallback;
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`.slice(0, 40);
    usedIds.add(id);
    return id;
  };
  let auto = 0;
  const colorUse = new Map<string, number>();
  const noteColor = (c: string | undefined) => {
    if (c && c !== "none") colorUse.set(c, (colorUse.get(c) ?? 0) + 1);
  };

  interface Inherited {
    fill?: string | "none";
    stroke?: string | "none";
    strokeWidth?: number;
  }

  const attr = (el: Element, style: Record<string, string>, name: string) => style[name] ?? el.attribs[name];

  const convert = (el: Element, inh: Inherited): Layer | null => {
    const name = el.name.toLowerCase();
    if (IGNORED_SILENTLY.has(name)) return null;
    if (name !== "g" && !SHAPES.has(name)) {
      warnings.push({ code: "dropped-element", message: `<${el.name}> is not supported and was dropped` });
      return null;
    }
    const style = parseStyle(el.attribs.style);
    if (el.attribs.class) warnings.push({ code: "ignored-class", message: `class="${el.attribs.class}" ignored (stylesheets are not supported)` });

    const color = (key: "fill" | "stroke"): string | "none" | undefined => {
      const raw = attr(el, style, key);
      const c = parseColor(raw);
      if (c === null) {
        warnings.push({ code: "unsupported-paint", message: `${key}="${raw}" is not supported; inherited value used` });
        return inh[key];
      }
      return c ?? inh[key];
    };
    const fill = color("fill");
    const stroke = color("stroke");
    const sw = num(attr(el, style, "stroke-width")) ?? inh.strokeWidth;
    const opacity = num(attr(el, style, "opacity"));
    for (const k of ["fill-opacity", "stroke-opacity", "filter", "mask", "clip-path", "marker-start", "marker-end"]) {
      if (attr(el, style, k) !== undefined) warnings.push({ code: "ignored-attribute", message: `${k} is not supported and was ignored` });
    }
    const tf = parseTransform(el.attribs.transform);
    if (tf === null) {
      errors.push({ code: "unsupported-transform", message: `transform="${el.attribs.transform}" uses skew/matrix/non-uniform scale (not supported)` });
      return null;
    }
    const id = makeId(el.attribs.id, `${name}-${++auto}`);
    const base: { id: string; opacity?: number; transform?: ShapeLayer["transform"]; origin?: [number, number] } = { id };
    if (opacity !== undefined && opacity < 1) base.opacity = Math.max(0, opacity);
    if (tf) {
      const { origin, ...rest } = tf;
      if (Object.keys(rest).length) base.transform = rest;
      if (origin) base.origin = origin;
    }

    if (name === "g") {
      const children = el.children.filter((c): c is Element => c.type === "tag").map((c) => convert(c, { fill, stroke, strokeWidth: sw })).filter((x): x is Layer => x !== null);
      if (children.length === 0) return null;
      return { ...base, kind: "group", children };
    }

    const a = (k: string) => num(el.attribs[k]);
    let shape: ShapeLayer["shape"] | null = null;
    switch (name) {
      case "path": {
        const d = PathData.safeParse(el.attribs.d ?? "");
        shape = d.success ? { type: "path", d: d.data.trim().replace(/\s+/g, " ") } : null;
        break;
      }
      case "circle":
        shape = (a("r") ?? 0) > 0 ? { type: "circle", cx: a("cx") ?? 0, cy: a("cy") ?? 0, r: a("r")! } : null;
        break;
      case "ellipse":
        shape = (a("rx") ?? 0) > 0 && (a("ry") ?? 0) > 0 ? { type: "ellipse", cx: a("cx") ?? 0, cy: a("cy") ?? 0, rx: a("rx")!, ry: a("ry")! } : null;
        break;
      case "rect":
        if ((a("width") ?? 0) > 0 && (a("height") ?? 0) > 0) {
          shape = { type: "rect", x: a("x") ?? 0, y: a("y") ?? 0, width: a("width")!, height: a("height")! };
          const rx = a("rx") ?? a("ry");
          if (rx) shape.rx = rx;
        }
        break;
      case "line":
        shape = { type: "line", x1: a("x1") ?? 0, y1: a("y1") ?? 0, x2: a("x2") ?? 0, y2: a("y2") ?? 0 };
        break;
      case "polygon":
      case "polyline": {
        const p = PointList.safeParse((el.attribs.points ?? "").trim());
        shape = p.success ? { type: name, points: p.data } : null;
        break;
      }
    }
    if (!shape) {
      warnings.push({ code: "invalid-shape", message: `<${el.name} id="${el.attribs.id ?? ""}"> has invalid geometry and was dropped` });
      return null;
    }
    // SVG default fill is black when nothing is specified.
    const effFill = fill ?? (name === "line" || name === "polyline" ? "none" : "#000000");
    noteColor(effFill);
    noteColor(stroke);
    const layer: ShapeLayer = { ...base, kind: "shape", shape, fill: effFill as Paint };
    if (stroke !== undefined) layer.stroke = stroke as Paint;
    if (sw !== undefined && stroke !== undefined && stroke !== "none") layer.strokeWidth = sw;
    const cap = attr(el, style, "stroke-linecap");
    if (cap === "round" || cap === "square" || cap === "butt") layer.lineCap = cap;
    const join = attr(el, style, "stroke-linejoin");
    if (join === "round" || join === "bevel" || join === "miter") layer.lineJoin = join;
    const rule = attr(el, style, "fill-rule");
    if (rule === "evenodd" || rule === "nonzero") layer.fillRule = rule;
    return layer;
  };

  const rootStyle = parseStyle(root.attribs.style);
  const rootInh: Inherited = {
    fill: parseColor(rootStyle.fill ?? root.attribs.fill) ?? undefined,
    stroke: parseColor(rootStyle.stroke ?? root.attribs.stroke) ?? undefined,
    strokeWidth: num(rootStyle["stroke-width"] ?? root.attribs["stroke-width"]),
  };
  let layers = root.children
    .filter((c): c is Element => c.type === "tag")
    .map((c) => convert(c, rootInh))
    .filter((x): x is Layer => x !== null);

  if (layers.length === 0) errors.push({ code: "empty", message: "No drawable shapes found" });

  // Tokenize colors by usage frequency.
  const tokens: Record<string, string> = {};
  if (opts.tokenizeColors !== false && colorUse.size) {
    const names = ["primary", "secondary", "accent"];
    const ordered = [...colorUse.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
    const byColor = new Map<string, string>();
    ordered.forEach((c, i) => {
      const t = names[i] ?? `color${i + 1}`;
      tokens[t] = c;
      byColor.set(c, t);
    });
    // Imported SVGs never carry gradient fills (the importer flattens paint to solid colours).
    const tokenize = <P extends FillPaint>(p: P | undefined): P | Paint | undefined =>
      typeof p === "string" && p !== "none" && byColor.has(p) ? { token: byColor.get(p)! } : p;
    const walk = (ls: Layer[]): Layer[] =>
      ls.map((l) => (l.kind === "group" ? { ...l, children: walk(l.children) } : { ...l, fill: tokenize(l.fill), stroke: tokenize(l.stroke) as Paint | undefined }));
    layers = walk(layers);
  }

  // Final guard: every produced layer must pass the AD schema.
  for (const l of layers) {
    const r = Layer.safeParse(l);
    if (!r.success) errors.push({ code: "schema", message: `Layer ${l.id}: ${r.error.issues[0]?.message}` });
  }
  return result({ viewBox, layers, tokens });
}
