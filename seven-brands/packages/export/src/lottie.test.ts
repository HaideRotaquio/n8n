import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseAssetDefinition, renderFrameSvg, type AssetDefinition } from "@sb/asset";
import { RIGS } from "@sb/rigs";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportLottie, LOTTIE_FPS, svgPathToSubpaths } from "./index";

/**
 * Lottie export is checked with the real lottie-web player in Chromium: for several frames of every rig asset,
 * the Lottie render must match our own SVG renderer pixel for pixel (within anti-aliasing tolerance).
 */

const require = createRequire(import.meta.url);
let browser: Browser;
let page: Page;
const SIZE = 128;

beforeAll(async () => {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  page = await browser.newPage();
  await page.setContent(`<html><body style="margin:0"><div id="l" style="width:${SIZE}px;height:${SIZE}px"></div></body></html>`);
  await page.addScriptTag({ content: await readFile(require.resolve("lottie-web/build/player/lottie_svg.min.js"), "utf8") });
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

/** Mean per-channel difference (0–255) between our SVG frame and lottie-web's frame, both drawn at SIZE×SIZE. */
async function diff(ad: AssetDefinition, frame: number, lottie = exportLottie(ad)): Promise<{ mean: number; inked: number }> {
  const ours = renderFrameSvg(ad, Math.min((frame / LOTTIE_FPS) * 1000, ad.timeline.duration), { title: false });
  return page.evaluate(
    async ({ data, frame, ours, size }) => {
      const host = document.getElementById("l")!;
      host.innerHTML = "";
      const anim = (window as any).lottie.loadAnimation({ container: host, renderer: "svg", loop: false, autoplay: false, animationData: data });
      anim.goToAndStop(frame, true);
      const lottieSvg = new XMLSerializer().serializeToString(host.querySelector("svg")!);
      anim.destroy();
      const draw = async (svg: string) => {
        const img = new Image(size, size);
        const root = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height|style)="[^"]*"/g, "").replace("<svg", `<svg width="${size}" height="${size}"`));
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(root);
        await img.decode();
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        return ctx.getImageData(0, 0, size, size).data;
      };
      const a = await draw(ours);
      const b = await draw(lottieSvg);
      let sum = 0;
      let inked = 0;
      for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
      for (let i = 3; i < a.length; i += 4) if (a[i]! > 0) inked++;
      return { mean: sum / a.length, inked };
    },
    { data: lottie, frame, ours, size: SIZE },
  );
}

const assets = Object.values(RIGS).flatMap((rig) => rig.variants.map((v) => rig.build(v)));

describe("Lottie export", () => {
  it("parses every SVG path command, including arcs and packed flags", () => {
    const sp = svgPathToSubpaths("M10 10 h10 v10 H10 Z m30 0 c5 0 5 10 0 10 s-5 -10 0 -10 q5 5 10 0 t10 0 a5 5 0 011 10 L60 60");
    expect(sp).toHaveLength(2);
    expect(sp[0]!.closed).toBe(true);
    expect(sp[0]!.vertices).toHaveLength(4);
    expect(sp[1]!.vertices.at(-1)!.v).toEqual([60, 60]);
  });

  it("produces a valid structure: size, frame rate, markers, no sound fields", () => {
    const ad = RIGS["sonicglyphs-line@1"]!.build("drum");
    const l = exportLottie(ad) as any;
    expect(l).toMatchObject({ w: 512, h: 512, fr: 60, ip: 0, op: 60 });
    expect(l.markers.map((m: any) => m.cm)).toEqual(["hit-1", "hit-2"]);
    expect(JSON.stringify(l)).not.toContain("synth:");
  });

  it("the comparison catches a wrong render", async () => {
    const ad = RIGS["moodicons-face@1"]!.build("happy");
    const wrong = exportLottie(ad, { tokens: { face: "#3355FF" } });
    expect((await diff(ad, 0, wrong)).mean).toBeGreaterThan(10);
    const shifted = exportLottie({ ...ad, viewBox: [6, 0, 64, 64] });
    expect((await diff(ad, 0, shifted)).mean).toBeGreaterThan(5);
  });

  it("gradient fills (linear and radial, with transparent stops) match on a moving layer", async () => {
    const ad = parseAssetDefinition({
      schema: "daos.asset/1",
      brand: "moodicons",
      slug: "gradient-check",
      name: "Gradient check",
      viewBox: [0, 0, 64, 64],
      tokens: { base: "#3A6FD8" },
      gradients: [
        { id: "sky", type: "linear", x1: 8, y1: 8, x2: 56, y2: 56, stops: [{ offset: 0, color: "#FFD54A" }, { offset: 1, color: { token: "base" } }] },
        { id: "clay", type: "radial", cx: 24, cy: 22, r: 30, stops: [{ offset: 0, color: "#FFFFFF", opacity: 0.7 }, { offset: 0.45, color: "#FFFFFF", opacity: 0 }, { offset: 0.75, color: "#000000", opacity: 0 }, { offset: 1, color: "#000000", opacity: 0.35 }] },
      ],
      layers: [
        { id: "card", kind: "shape", shape: { type: "rect", x: 6, y: 6, width: 52, height: 52, rx: 10 }, fill: { gradient: "sky" } },
        {
          id: "ball",
          kind: "group",
          origin: [32, 32],
          children: [
            { id: "ball-base", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 18 }, fill: "#E8336D", stroke: "#2B1B12", strokeWidth: 2 },
            { id: "ball-light", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 17 }, fill: { gradient: "clay" } },
          ],
        },
      ],
      timeline: { duration: 1000, loop: true, tracks: [{ target: "ball", property: "translateY", keyframes: [{ at: 0, value: 0 }, { at: 500, value: -6 }, { at: 1000, value: 0 }] }, { target: "ball", property: "rotate", keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 40 }] }] },
      a11y: { label: "Gradient check", reducedMotionFrame: 0 },
      provenance: { method: "manual" },
    });
    const l = exportLottie(ad) as any;
    expect(JSON.stringify(l)).toContain('"ty":"gf"');
    for (const f of [0, 20, 45]) {
      const d = await diff(ad, f);
      expect(d.inked).toBeGreaterThan(500);
      expect(d.mean, `frame ${f}`).toBeLessThan(2.5);
    }
  });

  it.each(assets.map((a) => [`${a.brand}/${a.slug}`, a] as const))("%s renders in lottie-web like our player", async (_, ad) => {
    const frames = Math.round((ad.timeline.duration / 1000) * LOTTIE_FPS);
    for (const f of [0, Math.round(frames / 3), Math.round((2 * frames) / 3)]) {
      const d = await diff(ad, f);
      expect(d.inked).toBeGreaterThan(500); // something was actually drawn
      expect(d.mean, `frame ${f}`).toBeLessThan(2.5);
    }
  }, 30_000);
});
