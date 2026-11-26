import { parseAssetDefinition, walkLayers, type AssetDefinition, type AssetDefinitionInput, type Easing, type Gradient, type Keyframe, type Layer, type Track } from "@sb/asset";

export const r = (n: number) => Math.round(n * 100) / 100;

/** Classic heart outline mapped into a box centred on (cx, cy) with width w. */
export function heartPath(cx: number, cy: number, w: number): string {
  const s = w / 52; // base heart spans x 6..58 (52 wide), y 9..54
  const X = (x: number) => r(cx + (x - 32) * s);
  const Y = (y: number) => r(cy + (y - 32) * s);
  return `M${X(32)} ${Y(54)} C${X(14)} ${Y(42)} ${X(6)} ${Y(32)} ${X(6)} ${Y(21)} A${r(12 * s)} ${r(12 * s)} 0 0 1 ${X(32)} ${Y(15)} A${r(12 * s)} ${r(12 * s)} 0 0 1 ${X(58)} ${Y(21)} C${X(58)} ${Y(32)} ${X(50)} ${Y(42)} ${X(32)} ${Y(54)} Z`;
}

export const SPRING_SOFT: Easing = { spring: { stiffness: 260, damping: 16, mass: 1 } };
export const SPRING_SNAPPY: Easing = { spring: { stiffness: 520, damping: 26, mass: 1 } };

export function track(target: string, property: Track["property"], keyframes: [number, number, Easing?][]): Track {
  return {
    target,
    property,
    keyframes: keyframes.map(([at, value, ease]): Keyframe => (ease ? { at, value, ease } : { at, value })),
  };
}

/** Removes tokens no layer references (keeps QA clean and the customizer focused). */
export function pruneTokens(layers: Layer[], tokens: Record<string, string>, gradients: Gradient[] = []): Record<string, string> {
  const used = new Set<string>();
  const usedGradients = new Set<string>();
  for (const l of walkLayers(layers)) {
    if (l.kind !== "shape") continue;
    for (const p of [l.fill, l.stroke]) {
      if (p && typeof p === "object") "gradient" in p ? usedGradients.add(p.gradient) : used.add(p.token);
    }
  }
  for (const g of gradients) if (usedGradients.has(g.id)) for (const st of g.stops) if (typeof st.color === "object") used.add(st.color.token);
  return Object.fromEntries(Object.entries(tokens).filter(([k]) => used.has(k)));
}

export function finalize(input: AssetDefinitionInput): AssetDefinition {
  const gradients = (input.gradients ?? []) as Gradient[];
  const layers = input.layers as Layer[];
  // Unused gradients are dropped too, like unused tokens.
  const used = new Set([...walkLayers(layers)].flatMap((l) => (l.kind === "shape" && l.fill && typeof l.fill === "object" && "gradient" in l.fill ? [l.fill.gradient] : [])));
  const kept = gradients.filter((g) => used.has(g.id));
  return parseAssetDefinition({ ...input, gradients: kept, tokens: pruneTokens(layers, input.tokens, kept) });
}
