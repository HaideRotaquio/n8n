import { renderFrameSvg, type AssetDefinitionInput, parseAssetDefinition } from "@sb/asset";
import { describe, expect, it } from "vitest";
import { importSvg, parseColor, parseTransform } from "./index";

const GOOD = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Smile</title>
  <circle id="Face" cx="32" cy="32" r="28" fill="#ffc83d" stroke="#2b1b12" stroke-width="2"/>
  <g id="eyes" fill="#2B1B12">
    <circle cx="22" cy="26" r="4"/>
    <circle cx="42" cy="26" r="4"/>
  </g>
  <path id="mouth" d="M18 38 Q32 52 46 38" fill="none" stroke="#2b1b12" stroke-width="3" stroke-linecap="round"/>
  <rect x="0" y="0" width="0" height="10"/>
</svg>`;

describe("importSvg", () => {
  it("converts allowlisted shapes, inherits group paint and tokenizes colors", () => {
    const r = importSvg(GOOD);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.viewBox).toEqual([0, 0, 64, 64]);
    expect(r.layers.map((l) => l.id)).toEqual(["face", "eyes", "mouth"]);
    expect(r.tokens.primary).toBe("#2B1B12"); // most used color
    expect(r.tokens.secondary).toBe("#FFC83D");
    const eyes = r.layers[1]!;
    expect(eyes.kind === "group" && eyes.children.length).toBe(2);
    expect(r.warnings.some((w) => w.code === "invalid-shape")).toBe(true); // zero-width rect dropped
  });

  it("produces layers that build a valid, renderable asset", () => {
    const r = importSvg(GOOD);
    const ad: AssetDefinitionInput = {
      schema: "daos.asset/1",
      brand: "moodicons",
      slug: "smile",
      name: "Smile",
      viewBox: r.viewBox!,
      tokens: r.tokens,
      layers: r.layers,
      timeline: { duration: 1000, loop: true, tracks: [] },
      a11y: { label: "Smiling face", reducedMotionFrame: 0 },
      provenance: { method: "manual" },
    };
    const svg = renderFrameSvg(parseAssetDefinition(ad), 0);
    expect(svg).toContain('d="M18 38 Q32 52 46 38"');
    expect(svg).toContain('stroke-linecap="round"');
  });

  it.each([
    ['<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>', "script"],
    ['<svg viewBox="0 0 1 1"><circle r="1" onclick="alert(1)"/></svg>', "handler"],
    ['<svg viewBox="0 0 1 1"><foreignObject><div/></foreignObject></svg>', "foreignObject"],
    ['<svg viewBox="0 0 1 1"><use href="https://evil.example/x.svg#a"/></svg>', "external href"],
    ['<svg viewBox="0 0 1 1"><a xlink:href="javascript:alert(1)"><circle r="1"/></a></svg>', "javascript url"],
    ['<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"/>', "entity"],
    ['<svg viewBox="0 0 1 1"><SCRIPT>alert(1)</SCRIPT></svg>', "uppercase script"],
  ])("rejects active content: %s (%s)", (src) => {
    const r = importSvg(src);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "security")).toBe(true);
    expect(r.layers).toEqual([]);
  });

  it("drops unsupported elements with warnings, not silently", () => {
    const r = importSvg(
      '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><text>hi</text><circle cx="5" cy="5" r="4" fill="url(#g)"/></svg>',
    );
    expect(r.ok).toBe(true);
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["dropped-element", "unsupported-paint"]));
  });

  it("errors on unsupported transforms instead of rendering them wrong", () => {
    const r = importSvg('<svg viewBox="0 0 10 10"><rect width="2" height="2" transform="skewX(30)"/></svg>');
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.code).toBe("unsupported-transform");
  });

  it("derives a viewBox from width/height, rejects non-svg and oversize input", () => {
    expect(importSvg('<svg width="24px" height="24"><circle cx="1" cy="1" r="1"/></svg>').viewBox).toEqual([0, 0, 24, 24]);
    expect(importSvg("<html/>").errors[0]!.code).toBe("not-svg");
    expect(importSvg(`<svg viewBox="0 0 1 1">${" ".repeat(600_000)}</svg>`).errors[0]!.code).toBe("too-large");
  });
});

describe("helpers", () => {
  it("parses colors", () => {
    expect(parseColor("#abc")).toBe("#AABBCC");
    expect(parseColor("rgb(255, 0, 10)")).toBe("#FF000A");
    expect(parseColor("White")).toBe("#FFFFFF");
    expect(parseColor("none")).toBe("none");
    expect(parseColor("url(#g)")).toBeNull();
    expect(parseColor("currentColor")).toBeNull();
  });
  it("parses simple transforms only", () => {
    expect(parseTransform("translate(2 3) rotate(45 10 10) scale(2)")).toEqual({ translateX: 2, translateY: 3, rotate: 45, origin: [10, 10], scale: 2 });
    expect(parseTransform("matrix(1 0 0 1 0 0)")).toBeNull();
    expect(parseTransform("scale(1 2)")).toBeNull();
    expect(parseTransform(undefined)).toBeUndefined();
  });
});
