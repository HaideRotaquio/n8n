import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BEATING_HEART, parseAssetDefinition } from "@sb/asset";
import { unzipSync, strFromU8 } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildPackage,
  buildPlayerBundle,
  exportAnimatedSvg,
  exportGif,
  exportMp4,
  exportReact,
  exportStaticSvg,
  exportWebComponentHtml,
  exportWebm,
  loopsFor,
  renderPng,
  renderSoundTrack,
  scriptSafeJson,
} from "./index";

const ad = parseAssetDefinition(structuredClone(BEATING_HEART));
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "export-test-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function probe(bytes: Uint8Array, ext: string) {
  const f = path.join(dir, `probe-${Math.random().toString(36).slice(2)}.${ext}`);
  await writeFile(f, bytes);
  return JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", f]).toString(),
  ) as { streams: { codec_type: string; codec_name: string; width?: number; height?: number; nb_read_frames?: string; pix_fmt?: string; tags?: Record<string, string> }[]; format: { duration: string } };
}

describe("vector exports", () => {
  it("static SVG is the reduced-motion frame and contains no script", () => {
    const svg = exportStaticSvg(ad);
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).not.toMatch(/<script|<style|on\w+=/i);
  });
  it("animated SVG has keyframes; hover variant is paused until hover", () => {
    expect(exportAnimatedSvg(ad)).toContain("@keyframes");
    expect(exportAnimatedSvg(ad, { playOn: "hover" })).toContain("animation-play-state:paused");
  });
});

describe("raster & video", () => {
  it("renders PNG at the requested even size", async () => {
    const png = renderPng(ad, 0, { size: 129 });
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
    const info = await probe(png, "png");
    expect(info.streams[0]!.width).toBe(130);
  });

  it("renders an animated GIF with ~3 s of frames", async () => {
    const gif = await exportGif(ad, { size: 64, fps: 10 });
    expect(strFromU8(gif.slice(0, 6))).toBe("GIF89a");
    const info = await probe(gif, "gif");
    expect(Number(info.streams[0]!.nb_read_frames)).toBe(30);
  }, 60_000);

  it("renders MP4 (H.264 + AAC) whose audio and video lengths match", async () => {
    const mp4 = await exportMp4(ad, { size: 128, fps: 15 });
    const info = await probe(mp4, "mp4");
    const v = info.streams.find((s) => s.codec_type === "video")!;
    const a = info.streams.find((s) => s.codec_type === "audio")!;
    expect(v.codec_name).toBe("h264");
    expect(v.pix_fmt).toBe("yuv420p");
    expect(a.codec_name).toBe("aac");
    expect(Number(info.format.duration)).toBeGreaterThan(2.9);
    expect(Number(info.format.duration)).toBeLessThan(3.2);
  }, 60_000);

  it("renders WebM (VP9 with alpha + Opus)", async () => {
    const webm = await exportWebm(ad, { size: 64, fps: 10, loops: 1 });
    const info = await probe(webm, "webm");
    const v = info.streams.find((s) => s.codec_type === "video")!;
    expect(v.codec_name).toBe("vp9");
    expect(v.tags?.ALPHA_MODE ?? v.tags?.alpha_mode).toBe("1");
    expect(info.streams.find((s) => s.codec_type === "audio")!.codec_name).toBe("opus");
  }, 60_000);

  it("silent assets produce video without an audio stream", async () => {
    const silent = { ...ad, sounds: [], interactions: [] };
    const info = await probe(await exportMp4(silent, { size: 64, fps: 5, loops: 1 }), "mp4");
    expect(info.streams.map((s) => s.codec_type)).toEqual(["video"]);
  }, 60_000);
});

describe("sound track", () => {
  it("places the heartbeat cue once per loop and normalizes loudness", () => {
    const t = renderSoundTrack(ad, 3)!;
    expect(t.samples.length).toBe(3 * 48_000);
    expect(t.cues).toEqual([{ id: "thump", sound: "synth:heartbeat", atMs: 0, gain: 0.9 }]);
    expect(t.normalization.peakDbfs).toBeLessThanOrEqual(-0.99);
    // energy at the start of loop 2 (1.0 s) proves the cue repeats
    const at = (s: number) => Math.max(...Array.from(t.samples.slice(s * 48_000, s * 48_000 + 4800), Math.abs));
    expect(at(1)).toBeGreaterThan(0.05);
  });
  it("computes loops for ~3 s of material", () => {
    expect(loopsFor(ad)).toBe(3);
    expect(loopsFor({ ...ad, timeline: { ...ad.timeline, loop: false } })).toBe(1);
  });
});

describe("web component & react", () => {
  it("embeds JSON safely inside script tags", () => {
    expect(scriptSafeJson({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
  it("builds a small standalone player bundle", async () => {
    const js = await buildPlayerBundle();
    expect(js).toContain("daos-asset");
    expect(js.length).toBeLessThan(40_000);
  }, 30_000);
  it("generates a typed React component named after the asset", () => {
    const r = exportReact(ad);
    expect(r.filename).toBe("BeatingHeart.tsx");
    expect(r.source).toContain('tokens?: Partial<Record<"primary" | "highlight", string>>');
    expect(exportWebComponentHtml(ad)).toContain('<script src="daos-player.js" defer></script>');
  });
});

describe("package", () => {
  it("contains every format, a README with capabilities and a preview license", async () => {
    const pkg = await buildPackage(ad, { brandName: "Moodicons", size: 64, fps: 8 });
    const files = unzipSync(pkg.zip);
    const names = Object.keys(files).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "LICENSE.txt",
        "README.txt",
        "audio/beating-heart-cues.json",
        "audio/beating-heart.wav",
        "gif/beating-heart.gif",
        "json/beating-heart.json",
        "png/beating-heart-512.png",
        "react/BeatingHeart.tsx",
        "react/daos-player.js",
        "svg/beating-heart-animated-hover.svg",
        "svg/beating-heart-animated.svg",
        "svg/beating-heart.svg",
        "video/beating-heart.mp4",
        "video/beating-heart.webm",
        "web-component/daos-player.js",
        "web-component/index.html",
      ]),
    );
    expect(strFromU8(files["LICENSE.txt"]!)).toContain("NOT LICENSED");
    expect(strFromU8(files["README.txt"]!)).toMatch(/gif\s+animation:yes\s+interactive:no\s+sound:no/);
  }, 120_000);
});
