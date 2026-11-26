import { describe, expect, it } from "vitest";
import { BEATING_HEART, parseAssetDefinition, runQa, renderFrameSvg, renderAnimatedSvgString, renderStructure } from "./index";
import { AssetDefinition } from "./schema";

const withGradient = (extra: Record<string, unknown> = {}) => {
  const ad = structuredClone(BEATING_HEART) as any;
  ad.gradients = [
    { id: "glow", type: "radial", cx: 26, cy: 22, r: 30, stops: [{ offset: 0, color: "#FFFFFF", opacity: 0.6 }, { offset: 1, color: { token: Object.keys(ad.tokens)[0] }, opacity: 0 }] },
  ];
  ad.layers = [...ad.layers, { id: "light", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 20 }, fill: { gradient: "glow" } }];
  return { ...ad, ...extra };
};

describe("gradients", () => {
  it("render as user-space <defs> referenced by fill, with a per-render id prefix", () => {
    const ad = parseAssetDefinition(withGradient());
    const svg = renderFrameSvg(ad, 0);
    expect(svg).toContain('<radialGradient id="g-beating-heart-glow" gradientUnits="userSpaceOnUse" cx="26" cy="22" r="30">');
    expect(svg).toContain('stop-opacity="0.6"');
    expect(svg).toContain('fill="url(#g-beating-heart-glow)"');
    expect(renderFrameSvg(ad, 0, { idPrefix: "p7" })).toContain('fill="url(#p7-glow)"');
    expect(renderAnimatedSvgString(ad)).toContain("<radialGradient");
    expect(JSON.stringify(renderStructure(ad))).toContain("radialGradient");
  });

  it("stop colours follow token overrides", () => {
    const ad = parseAssetDefinition(withGradient());
    const token = Object.keys(ad.tokens)[0]!;
    expect(renderFrameSvg(ad, 0, { tokens: { [token]: "#123456" } })).toContain('stop-color="#123456"');
  });

  it("are fills only, need unique ids and non-decreasing stops", () => {
    const bad = withGradient();
    bad.layers[bad.layers.length - 1].stroke = { gradient: "glow" };
    expect(AssetDefinition.safeParse(bad).success).toBe(false);
    expect(AssetDefinition.safeParse(withGradient({ gradients: [...withGradient().gradients, withGradient().gradients[0]] })).success).toBe(false);
    const order = withGradient();
    order.gradients[0].stops = [{ offset: 0.8, color: "#FFFFFF" }, { offset: 0.2, color: "#000000" }];
    expect(AssetDefinition.safeParse(order).success).toBe(false);
  });

  it("QA flags unknown and unused gradients, and counts tokens used by stops", () => {
    expect(runQa(withGradient()).errors).toEqual([]);
    const unknown = withGradient();
    unknown.layers[unknown.layers.length - 1].fill = { gradient: "nope" };
    expect(runQa(unknown).errors.map((e) => e.code)).toContain("unknown-gradient");
    const unused = withGradient();
    unused.layers.pop();
    expect(runQa(unused).warnings.map((w) => w.code)).toContain("unused-gradient");
  });
});
