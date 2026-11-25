import path from "node:path";
import { fileURLToPath } from "node:url";
import { BEATING_HEART } from "@sb/asset";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Real-browser tests of the standalone <daos-asset> bundle. */

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "bundle-entry.ts");
  const res = await build({ entryPoints: [entry], bundle: true, format: "iife", write: false, platform: "browser" });
  bundle = res.outputFiles[0]!.text;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
afterAll(async () => {
  await browser?.close();
});

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

async function open(definition: unknown, attrs = "autoplay", opts: { reducedMotion?: boolean } = {}): Promise<Page> {
  const page = await browser.newPage({ reducedMotion: opts.reducedMotion ? "reduce" : "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  (page as any).__errors = errors;
  await page.setContent(
    // The first inline script records audio scheduling (AudioBufferSourceNode.start calls).
    `<!doctype html><html><head><script>window.__pans=[];const sp=AudioContext.prototype.createStereoPanner;AudioContext.prototype.createStereoPanner=function(){const n=sp.call(this);const pr=n.pan;const d=Object.getOwnPropertyDescriptor(AudioParam.prototype,"value");Object.defineProperty(pr,"value",{set(v){window.__pans.push(v);d.set.call(pr,v)},get(){return d.get.call(pr)}});return n};window.__starts=[];const o=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(w,...r){window.__starts.push({when:w,now:this.context.currentTime});return o.call(this,w,...r)}</script></head><body><daos-asset id="a" ${attrs}><script type="application/json">${json(definition)}</script></daos-asset><button id="b">sound</button><script>${bundle}</script></body></html>`,
  );
  return page;
}

const shadow = (page: Page, js: string) => page.evaluate(`(() => { const r = document.getElementById("a").shadowRoot; ${js} })()`);

describe("<daos-asset>", () => {
  it("renders the asset into shadow DOM and animates it", async () => {
    const page = await open(BEATING_HEART);
    await page.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    const samples = new Set<string>();
    for (let i = 0; i < 6; i++) {
      samples.add(String(await shadow(page, 'return r.querySelector("[data-layer=heart]").getAttribute("transform")')));
      await page.waitForTimeout(60);
    }
    expect(samples.size).toBeGreaterThan(2);
    expect(await shadow(page, 'return r.querySelector("title").textContent')).toBe("Beating red heart");
    expect((page as any).__errors).toEqual([]);
    await page.close();
  });

  it("refuses invalid or malicious definitions without rendering anything", async () => {
    const evil = structuredClone(BEATING_HEART) as any;
    evil.layers[0].children[0].shape.d = 'M0 0"/><script>window.pwned=1</script>';
    for (const def of [evil, { nope: 1 }, "not json"]) {
      const page = await open(def);
      await page.waitForTimeout(100);
      expect(await page.getAttribute("#a", "data-error")).toBe("invalid-asset");
      expect(await shadow(page, 'return r.querySelector("svg")')).toBeNull();
      expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
      await page.close();
    }
  });

  it("shows the still frame and does not animate under prefers-reduced-motion", async () => {
    const page = await open(BEATING_HEART, "autoplay", { reducedMotion: true });
    await page.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    const a = await shadow(page, 'return r.querySelector("[data-layer=heart]").getAttribute("transform")');
    await page.waitForTimeout(250);
    const b = await shadow(page, 'return r.querySelector("[data-layer=heart]").getAttribute("transform")');
    expect(a).toBe(b);
    await page.close();
  });

  it("applies color token overrides from the tokens attribute", async () => {
    const page = await open(BEATING_HEART, `tokens='{"primary":"#00AA00"}'`);
    await page.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    expect(await shadow(page, 'return r.querySelector("[data-layer=heart-body] path").getAttribute("fill")')).toBe("#00AA00");
    await page.evaluate(() => document.getElementById("a")!.setAttribute("tokens", '{"primary":"#123456"}'));
    expect(await shadow(page, 'return r.querySelector("[data-layer=heart-body] path").getAttribute("fill")')).toBe("#123456");
    await page.close();
  });

  it("is silent until unmuted by a user gesture, then schedules cues on loop boundaries", async () => {
    // Timeline-driven cue (no playSound interaction) so it repeats each loop.
    const def = structuredClone(BEATING_HEART) as any;
    def.interactions = [{ on: "load", action: "play" }];
    const page = await open(def);
    await page.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__starts.length)).toBe(0);
    await page.evaluate(() => {
      document.getElementById("b")!.addEventListener("click", () => (document.getElementById("a") as any).unmute());
    });
    await page.click("#b");
    await page.waitForTimeout(2300);
    const starts: { when: number; now: number }[] = await page.evaluate(() => (window as any).__starts);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    // Consecutive cue start times are one timeline duration (1 s) apart.
    const gaps = starts.slice(1).map((s, i) => s.when - starts[i]!.when);
    for (const g of gaps) expect(g).toBeCloseTo(1, 1);
    await page.close();
  });

  it("places panned cues left/right with a stereo panner; centred cues need none", async () => {
    const def = structuredClone(BEATING_HEART) as any;
    def.interactions = [{ on: "load", action: "play" }];
    def.sounds = def.sounds.map((c: any) => ({ ...c, pan: -0.6 }));
    const page = await open(def);
    await page.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    await page.evaluate(() => document.getElementById("b")!.addEventListener("click", () => (document.getElementById("a") as any).unmute()));
    await page.click("#b");
    await page.waitForTimeout(1300);
    const pans: number[] = await page.evaluate(() => (window as any).__pans);
    expect(pans.length).toBeGreaterThanOrEqual(1);
    expect(pans.every((p) => Math.abs(p + 0.6) < 1e-6)).toBe(true);
    await page.close();
    const centred = await open({ ...def, sounds: def.sounds.map((c: any) => ({ ...c, pan: undefined })) });
    await centred.waitForFunction(() => document.getElementById("a")?.shadowRoot?.querySelector("svg"));
    await centred.evaluate(() => document.getElementById("b")!.addEventListener("click", () => (document.getElementById("a") as any).unmute()));
    await centred.click("#b");
    await centred.waitForTimeout(1300);
    expect(await centred.evaluate(() => (window as any).__pans.length)).toBe(0);
    expect(await centred.evaluate(() => (window as any).__starts.length)).toBeGreaterThanOrEqual(1);
    await centred.close();
  });
});
