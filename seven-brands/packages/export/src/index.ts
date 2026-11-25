import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cueTime,
  cuePan,
  localTime,
  renderAnimatedSvgString,
  renderFrameSvg,
  type AssetDefinition,
} from "@sb/asset";
import { DEFAULT_SAMPLE_RATE, encodeWav, mix, mixStereo, normalize, normalizeChannels, parseSynthRef, renderPreset, type NormalizeResult } from "@sb/audio";
import { Resvg } from "@resvg/resvg-js";
import { build } from "esbuild";
import { strToU8, zipSync } from "fflate";
import { exportLottie } from "./lottie";

/**
 * Export engine: compiles an Asset Definition into customer-facing files.
 * Every format is generated from the same motion evaluator, so all outputs match.
 */

import { FORMAT_CAPABILITIES, type ExportFormat } from "@sb/asset";
export { FORMAT_CAPABILITIES, type ExportFormat };

export interface ExportOptions {
  tokens?: Record<string, string>;
  /** Pixel width for raster/video outputs (default 512; GIF 256). */
  size?: number;
  fps?: number;
  /** Background for formats without transparency (MP4). Default white. */
  background?: string;
  /** Number of loops rendered into GIF/MP4/WebM (default: enough for ~3 s, max 10). */
  loops?: number;
}

// ─── Vector ──────────────────────────────────────────────────────────────────

export function exportStaticSvg(ad: AssetDefinition, opts: ExportOptions = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderFrameSvg(ad, ad.a11y.reducedMotionFrame, { tokens: opts.tokens })}\n`;
}

export function exportAnimatedSvg(ad: AssetDefinition, opts: ExportOptions & { playOn?: "load" | "hover" } = {}): string {
  return renderAnimatedSvgString(ad, { tokens: opts.tokens, fps: opts.fps, playOn: opts.playOn });
}

// ─── Raster frames ───────────────────────────────────────────────────────────

export function renderPng(ad: AssetDefinition, t: number, opts: ExportOptions = {}): Uint8Array {
  const size = evenSize(opts.size ?? 512);
  const svg = renderFrameSvg(ad, t, { tokens: opts.tokens, size, background: opts.background, title: false });
  return new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng();
}

function evenSize(n: number) {
  const s = Math.max(16, Math.min(2048, Math.round(n)));
  return s % 2 === 0 ? s : s + 1;
}

export function loopsFor(ad: AssetDefinition, requested?: number): number {
  if (requested) return Math.min(10, Math.max(1, Math.floor(requested)));
  if (ad.timeline.loop === false) return 1;
  const max = ad.timeline.loop === true ? 10 : ad.timeline.loop;
  return Math.min(max, Math.max(1, Math.ceil(3000 / ad.timeline.duration)));
}

export function renderFrames(ad: AssetDefinition, opts: ExportOptions = {}): { frames: Uint8Array[]; fps: number; durationMs: number } {
  const fps = Math.min(60, Math.max(5, opts.fps ?? 30));
  const loops = loopsFor(ad, opts.loops);
  const durationMs = ad.timeline.duration * loops;
  const count = Math.max(1, Math.round((durationMs / 1000) * fps));
  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const elapsed = (i / fps) * 1000;
    frames.push(renderPng(ad, localTime({ ...ad.timeline, loop: loops === 1 ? false : loops }, elapsed), opts));
  }
  return { frames, fps, durationMs };
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export interface SoundTrack {
  /** One channel (mono) or two (stereo: left, right). Stereo only when at least one cue is panned. */
  channels: Float32Array[];
  /** Mono mix-down (same as channels[0] for mono tracks). */
  samples: Float32Array;
  sampleRate: number;
  normalization: NormalizeResult;
  cues: { id: string; sound: string; atMs: number; gain: number; pan: number }[];
}

/** Stored sounds (`snd_…`) are passed in already decoded; synth sounds are rendered here. */
export function renderSoundTrack(
  ad: AssetDefinition,
  loops = 1,
  stored: Record<string, Float32Array> = {},
  sampleRate = DEFAULT_SAMPLE_RATE,
): SoundTrack | null {
  if (ad.sounds.length === 0) return null;
  const timelineCues = ad.sounds.filter(
    (c) => !ad.interactions.some((i) => i.action === "playSound" && i.cue === c.id && i.on !== "load"),
  );
  const cueList = (timelineCues.length ? timelineCues : ad.sounds).map((c) => ({ c, at: cueTime(c, ad.timeline), pan: cuePan(c, ad) }));
  const mixCues = [];
  const cues = [];
  for (let l = 0; l < loops; l++) {
    for (const { c, at, pan } of cueList) {
      const preset = parseSynthRef(c.sound);
      const buffer = preset ? renderPreset(preset, c.params ?? {}, sampleRate) : stored[c.sound];
      if (!buffer) throw new Error(`Sound ${c.sound} is not available for export`);
      const atMs = l * ad.timeline.duration + at;
      mixCues.push({ buffer, at: atMs / 1000, gain: c.gain, pan });
      if (l === 0) cues.push({ id: c.id, sound: c.sound, atMs, gain: c.gain, pan });
    }
  }
  const seconds = (ad.timeline.duration * loops) / 1000;
  if (cueList.some((c) => c.pan !== 0)) {
    const channels = mixStereo(mixCues, seconds, sampleRate);
    const normalization = normalizeChannels(channels, sampleRate);
    const samples = channels[0].map((v, i) => (v + channels[1][i]!) / 2);
    return { channels, samples, sampleRate, normalization, cues };
  }
  const samples = mix(mixCues, seconds, sampleRate);
  const normalization = normalize(samples, sampleRate);
  return { channels: [samples], samples, sampleRate, normalization, cues };
}

// ─── Video via ffmpeg ────────────────────────────────────────────────────────

function ffmpeg(args: string[], stdin?: Uint8Array[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFMPEG_PATH ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`))));
    if (stdin) {
      (async () => {
        for (const chunk of stdin) {
          if (!p.stdin.write(chunk)) await new Promise((r) => p.stdin.once("drain", r));
        }
        p.stdin.end();
      })().catch(reject);
    } else p.stdin.end();
  });
}

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "daos-export-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function exportGif(ad: AssetDefinition, opts: ExportOptions = {}): Promise<Uint8Array> {
  const { frames, fps } = renderFrames(ad, { ...opts, size: opts.size ?? 256, fps: Math.min(opts.fps ?? 25, 30) });
  return withTemp(async (dir) => {
    const out = path.join(dir, "out.gif");
    await ffmpeg(
      [
        "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
        "-filter_complex", "split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:alpha_threshold=128",
        "-loop", ad.timeline.loop === false ? "-1" : "0",
        out,
      ],
      frames,
    );
    return new Uint8Array(await readFile(out));
  });
}

async function exportVideo(
  ad: AssetDefinition,
  kind: "mp4" | "webm",
  opts: ExportOptions,
  stored: Record<string, Float32Array>,
): Promise<Uint8Array> {
  const loops = loopsFor(ad, opts.loops);
  const background = kind === "mp4" ? (opts.background ?? "#FFFFFF") : opts.background;
  const { frames, fps } = renderFrames(ad, { ...opts, loops, background });
  const track = renderSoundTrack(ad, loops, stored);
  return withTemp(async (dir) => {
    const out = path.join(dir, `out.${kind}`);
    const args = ["-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-"];
    if (track) {
      const wav = path.join(dir, "audio.wav");
      await writeFile(wav, encodeWav(track.channels, track.sampleRate));
      args.push("-i", wav);
    }
    if (kind === "mp4") {
      args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart");
      if (track) args.push("-c:a", "aac", "-b:a", "160k");
    } else {
      args.push("-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32", "-row-mt", "1");
      if (track) args.push("-c:a", "libopus", "-b:a", "128k");
    }
    if (track) args.push("-shortest");
    args.push(out);
    await ffmpeg(args, frames);
    return new Uint8Array(await readFile(out));
  });
}

export const exportMp4 = (ad: AssetDefinition, opts: ExportOptions = {}, stored: Record<string, Float32Array> = {}) =>
  exportVideo(ad, "mp4", opts, stored);
export const exportWebm = (ad: AssetDefinition, opts: ExportOptions = {}, stored: Record<string, Float32Array> = {}) =>
  exportVideo(ad, "webm", opts, stored);

// ─── Web Component & React ───────────────────────────────────────────────────

let bundleCache: string | undefined;

/** Builds the standalone <daos-asset> player (minified IIFE). */
export async function buildPlayerBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../player/src/bundle-entry.ts");
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020"],
    platform: "browser",
    write: false,
    legalComments: "none",
    // zod is large; the element validates with it, which we keep for safety.
  });
  bundleCache = `/*! DAOS player — Seven Brands. Licensed with the asset you purchased. */\n${res.outputFiles[0]!.text}`;
  return bundleCache;
}

/** JSON safe to embed inside a <script> element. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function exportWebComponentHtml(ad: AssetDefinition, opts: ExportOptions & { soundUrls?: Record<string, string> } = {}): string {
  const tokens = opts.tokens ? ` tokens='${JSON.stringify(opts.tokens).replace(/'/g, "&#39;")}'` : "";
  const sounds = opts.soundUrls && Object.keys(opts.soundUrls).length ? `\n<script type="application/daos-sounds+json">${scriptSafeJson(opts.soundUrls)}</script>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(ad.name)}</title>
<script src="daos-player.js" defer></script>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;gap:12px}daos-asset{width:240px}</style>
</head>
<body>
<daos-asset id="asset" autoplay${tokens}>
<script type="application/json">${scriptSafeJson(ad)}</script>${sounds}
</daos-asset>
<button type="button" onclick="document.getElementById('asset').unmute()">Turn sound on</button>
</body>
</html>
`;
}

function pascal(slug: string) {
  return slug.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase()).replace(/^[0-9]/, (d) => `A${d}`);
}

export function exportReact(ad: AssetDefinition): { filename: string; source: string } {
  const name = pascal(ad.slug);
  const source = `// ${ad.name} — generated by DAOS. Requires daos-player.js (included) to be loaded once.
import { createElement, useEffect, useRef } from "react";
import "./daos-player.js";

const definition = ${JSON.stringify(ad, null, 2)} as const;

export interface ${name}Props {
  autoplay?: boolean;
  speed?: number;
  /** Color overrides, e.g. { primary: "#FF0066" }. Only the asset's own tokens are applied. */
  tokens?: Partial<Record<${Object.keys(ad.tokens).map((t) => JSON.stringify(t)).join(" | ") || "string"}, string>>;
  className?: string;
  /** Accessible label override. */
  label?: string;
  /** Scroll-driven playback: "scrub" follows the scroll position, "in-view" plays when half visible. */
  scroll?: "scrub" | "in-view";
  /** With scroll="scrub": how many times the animation repeats while the icon crosses the screen. */
  scrollLoops?: number;
}

export function ${name}({ autoplay = true, speed = 1, tokens, className, label, scroll, scrollLoops }: ${name}Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current && tokens) ref.current.setAttribute("tokens", JSON.stringify(tokens));
  }, [tokens]);
  return createElement(
    "daos-asset",
    { ref, class: className, speed: String(speed), autoplay: autoplay ? "" : undefined, "aria-label": label, scroll, "scroll-loops": scrollLoops ? String(scrollLoops) : undefined },
    createElement("script", {
      type: "application/json",
      dangerouslySetInnerHTML: { __html: JSON.stringify(definition).replace(/</g, "\\\\u003c") },
    }),
  );
}

export default ${name};
`;
  return { filename: `${name}.tsx`, source };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Package (ZIP) ───────────────────────────────────────────────────────────

export interface PackageOptions extends ExportOptions {
  formats?: ExportFormat[];
  /** Full license text for a purchased item (Phase 3). Without it the package is marked as a preview. */
  licenseText?: string;
  brandName: string;
  stored?: Record<string, Float32Array>;
}

export interface PackageResult {
  zip: Uint8Array;
  files: { path: string; bytes: number }[];
}

export const ALL_FORMATS: ExportFormat[] = ["svg", "svg-animated", "png", "gif", "mp4", "webm", "wav", "lottie", "web-component", "react", "json"];

export async function buildPackage(ad: AssetDefinition, opts: PackageOptions): Promise<PackageResult> {
  const formats = new Set(opts.formats ?? ALL_FORMATS);
  const slug = ad.slug;
  const files: Record<string, Uint8Array> = {};
  const add = (p: string, data: string | Uint8Array) => (files[p] = typeof data === "string" ? strToU8(data) : data);

  if (formats.has("svg")) add(`svg/${slug}.svg`, exportStaticSvg(ad, opts));
  if (formats.has("svg-animated")) {
    add(`svg/${slug}-animated.svg`, exportAnimatedSvg(ad, opts));
    add(`svg/${slug}-animated-hover.svg`, exportAnimatedSvg(ad, { ...opts, playOn: "hover" }));
  }
  if (formats.has("png")) {
    for (const s of [64, 256, 512]) add(`png/${slug}-${s}.png`, renderPng(ad, ad.a11y.reducedMotionFrame, { ...opts, size: s }));
  }
  if (formats.has("gif")) add(`gif/${slug}.gif`, await exportGif(ad, opts));
  if (formats.has("mp4")) add(`video/${slug}.mp4`, await exportMp4(ad, opts, opts.stored));
  if (formats.has("webm")) add(`video/${slug}.webm`, await exportWebm(ad, opts, opts.stored));
  const track = formats.has("wav") ? renderSoundTrack(ad, 1, opts.stored) : null;
  if (track) {
    add(`audio/${slug}.wav`, encodeWav(track.channels, track.sampleRate));
    add(`audio/${slug}-cues.json`, JSON.stringify({ durationMs: ad.timeline.duration, channels: track.channels.length === 2 ? "stereo" : "mono", cues: track.cues, loudnessLufs: round(track.normalization.loudness), peakDbfs: round(track.normalization.peakDbfs) }, null, 2));
  }
  // Stored (non-synth) sounds travel with the package so components can play them offline.
  const soundUrls: Record<string, string> = {};
  for (const [id, samples] of Object.entries(opts.stored ?? {})) {
    if (!/^snd_[0-9A-Z]{26}$/.test(id)) continue;
    add(`sounds/${id}.wav`, encodeWav([samples], DEFAULT_SAMPLE_RATE));
    soundUrls[id] = `../sounds/${id}.wav`;
  }
  if (formats.has("web-component") || formats.has("react")) {
    const bundle = await buildPlayerBundle();
    if (formats.has("web-component")) {
      add("web-component/daos-player.js", bundle);
      add("web-component/index.html", exportWebComponentHtml(ad, { ...opts, soundUrls }));
    }
    if (formats.has("react")) {
      const r = exportReact(ad);
      add(`react/${r.filename}`, r.source);
      add("react/daos-player.js", bundle);
    }
  }
  if (formats.has("lottie")) add(`lottie/${slug}.json`, JSON.stringify(exportLottie(ad, { tokens: opts.tokens })));
  if (formats.has("json")) add(`json/${slug}.json`, JSON.stringify(ad, null, 2));

  add("README.txt", readme(ad, opts.brandName, [...formats]));
  add(
    "LICENSE.txt",
    opts.licenseText ??
      `PREVIEW — NOT LICENSED FOR USE\n\nThis package was generated for internal review by ${opts.brandName}.\nA license is issued only with a completed purchase; the license text is then included here.\n`,
  );
  const zip = zipSync(files, { level: 6 });
  return { zip, files: Object.entries(files).map(([p, d]) => ({ path: p, bytes: d.length })) };
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function readme(ad: AssetDefinition, brandName: string, formats: ExportFormat[]): string {
  const rows = formats
    .map((f) => {
      const c = FORMAT_CAPABILITIES[f];
      const yn = (b: boolean) => (b ? "yes" : "no ");
      return `  ${f.padEnd(14)} animation:${yn(c.animation)}  interactive:${yn(c.interactive)}  sound:${yn(c.sound)}  — ${c.note}`;
    })
    .join("\n");
  return `${ad.name} — ${brandName}

What each format can do:
${rows}

Sound in browsers starts only after the visitor clicks or taps (autoplay rules).

Scroll-driven playback (Web Component and React):
  <daos-asset scroll="scrub">   the animation follows the page scroll (add scroll-loops="3" to repeat it)
  <daos-asset scroll="in-view"> plays from the start when half the icon is visible
  Once sound is turned on, scrubbing forward plays each sound as you pass it.
Reduced motion: the vector and component formats show a still frame when the
visitor's system asks for reduced motion.

Colors: ${Object.entries(ad.tokens).map(([k, v]) => `${k} ${v}`).join(", ")}
`;
}
export * from "./lottie";
