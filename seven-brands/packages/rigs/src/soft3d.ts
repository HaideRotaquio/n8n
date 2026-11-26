import type { Layer } from "@sb/asset";

/**
 * "Soft 3D" shading built only from what every export format already supports (shapes, opacity, transforms):
 * a shade crescent on the side away from a top-left light, a glossy highlight, and contact shadows.
 * Neutral literal colours on purpose, so customers' colour overrides keep working and shading stays consistent.
 */

export const SHADE = "#1A0F08";
export const LIGHT = "#FFFFFF";

const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.round((cx + r * Math.cos(a)) * 100) / 100, Math.round((cy + r * Math.sin(a)) * 100) / 100];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The part of a circle not covered by the same circle shifted `d` toward the light (top left): a crescent along
 *  the lower-right rim, thickest opposite the light. */
function crescent(cx: number, cy: number, r: number, d: number): string {
  const k = Math.SQRT1_2;
  const [mx, my] = [cx - (d / 2) * k, cy - (d / 2) * k];
  const h = Math.sqrt(r * r - (d / 2) * (d / 2));
  const p1: [number, number] = [r2(mx + h * k), r2(my - h * k)]; // upper right
  const p2: [number, number] = [r2(mx - h * k), r2(my + h * k)]; // lower left
  return `M${p1[0]} ${p1[1]} A${r2(r)} ${r2(r)} 0 1 1 ${p2[0]} ${p2[1]} A${r2(r)} ${r2(r)} 0 0 0 ${p1[0]} ${p1[1]} Z`;
}

/** Soft shading on a circle: three stacked crescents, darkest at the rim, fading toward the light. */
export function sphereShade(id: string, cx: number, cy: number, r: number, strength = 1): Layer {
  const rr = r - 1; // stays inside the outline
  return {
    id,
    kind: "group",
    children: [
      { id: `${id}-1`, kind: "shape", shape: { type: "path", d: crescent(cx, cy, rr, rr * 0.42) }, fill: SHADE, opacity: r2(0.06 * strength) },
      { id: `${id}-2`, kind: "shape", shape: { type: "path", d: crescent(cx, cy, rr, rr * 0.27) }, fill: SHADE, opacity: r2(0.07 * strength) },
      { id: `${id}-3`, kind: "shape", shape: { type: "path", d: crescent(cx, cy, rr, rr * 0.14) }, fill: SHADE, opacity: r2(0.08 * strength) },
    ],
  };
}

/** Soft highlight on the upper left of a circle: a wide faint glow and a small bright spot. */
export function sphereGloss(id: string, cx: number, cy: number, r: number, strength = 1): Layer {
  const gx = r2(cx - r * 0.38);
  const gy = r2(cy - r * 0.44);
  return {
    id,
    kind: "group",
    origin: [gx, gy],
    transform: { rotate: -35 },
    children: [
      { id: `${id}-glow`, kind: "shape", shape: { type: "ellipse", cx: gx, cy: gy, rx: r2(r * 0.36), ry: r2(r * 0.2) }, fill: LIGHT, opacity: r2(0.16 * strength) },
      { id: `${id}-spot`, kind: "shape", shape: { type: "ellipse", cx: r2(gx - r * 0.04), cy: gy, rx: r2(r * 0.16), ry: r2(r * 0.08) }, fill: LIGHT, opacity: r2(0.55 * strength) },
    ],
  };
}

/** Soft dark oval, e.g. where a head sits on a body. */
export function contactShadow(id: string, cx: number, cy: number, rx: number, ry: number, opacity = 0.22): Layer {
  return { id, kind: "shape", shape: { type: "ellipse", cx, cy, rx, ry }, fill: SHADE, opacity };
}
