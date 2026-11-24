import { applyBiquad, biquad, DEFAULT_SAMPLE_RATE, fadeEdges, prng, samples } from "./dsp";

/**
 * Procedural sound presets. Every sound is generated from code, so we own it outright
 * (no third-party sample licenses) and it is reproducible bit-for-bit.
 *
 * Common params: pitch (multiplier, default 1), decay (multiplier, default 1), seed (noise seed).
 */

export interface SynthParams {
  pitch?: number;
  decay?: number;
  seed?: number;
}

export interface SynthPreset {
  id: string;
  label: string;
  description: string;
  /** Nominal length in seconds at decay = 1. */
  length: number;
  render(p: Required<SynthParams>, sr: number): Float32Array;
}

const TAU = Math.PI * 2;
const expEnv = (t: number, tau: number) => Math.exp(-t / tau);

/** Sine with an exponential pitch glide from f0 to f1 (phase-continuous). */
function glide(n: number, sr: number, f0: number, f1: number, glideTau: number, ampTau: number, attack = 0.002): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / glideTau);
    phase += (TAU * f) / sr;
    const a = Math.min(1, t / attack) * expEnv(t, ampTau);
    out[i] = Math.sin(phase) * a;
  }
  return out;
}

function noise(n: number, seed: number): Float32Array {
  const r = prng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}

function add(a: Float32Array, b: Float32Array, at = 0, gain = 1): Float32Array {
  for (let i = 0; i < b.length && i + at < a.length; i++) a[i + at]! += b[i]! * gain;
  return a;
}

export const PRESETS: Record<string, SynthPreset> = {
  pop: {
    id: "pop",
    label: "Pop",
    description: "Bubbly pop for appear/tap moments",
    length: 0.15,
    render: ({ pitch, decay }, sr) => glide(samples(0.15 * decay, sr), sr, 900 * pitch, 280 * pitch, 0.02, 0.035 * decay),
  },
  click: {
    id: "click",
    label: "Click",
    description: "Crisp UI click",
    length: 0.04,
    render: ({ pitch, decay, seed }, sr) => {
      const n = samples(0.04 * decay, sr);
      const out = glide(n, sr, 2200 * pitch, 1800 * pitch, 0.01, 0.006 * decay, 0.0005);
      const nz = noise(n, seed);
      for (let i = 0; i < n; i++) nz[i]! *= expEnv(i / sr, 0.003 * decay);
      return add(out, applyBiquad(nz, biquad("highpass", 3000, 0.7, sr)), 0, 0.6);
    },
  },
  chime: {
    id: "chime",
    label: "Chime",
    description: "Bright bell-like chime (success, sparkle)",
    length: 1.2,
    render: ({ pitch, decay }, sr) => {
      const n = samples(1.2 * decay, sr);
      const out = new Float32Array(n);
      const f = 880 * pitch;
      const partials: [number, number, number][] = [[1, 1, 0.5], [2.76, 0.45, 0.25], [5.4, 0.2, 0.12], [8.93, 0.08, 0.06]];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (const [ratio, amp, tau] of partials) v += amp * Math.sin(TAU * f * ratio * t) * expEnv(t, tau * decay);
        out[i] = v * Math.min(1, t / 0.002);
      }
      return out;
    },
  },
  bell: {
    id: "bell",
    label: "Bell",
    description: "FM bell for notifications",
    length: 1.6,
    render: ({ pitch, decay }, sr) => {
      const n = samples(1.6 * decay, sr);
      const out = new Float32Array(n);
      const fc = 660 * pitch;
      const fm = fc * 1.4;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const index = 4 * expEnv(t, 0.25 * decay);
        out[i] = Math.sin(TAU * fc * t + index * Math.sin(TAU * fm * t)) * expEnv(t, 0.5 * decay) * Math.min(1, t / 0.002);
      }
      return out;
    },
  },
  heartbeat: {
    id: "heartbeat",
    label: "Heartbeat",
    description: "Two soft low thumps (lub-dub)",
    length: 0.5,
    render: ({ pitch, decay }, sr) => {
      const n = samples(0.5 * decay, sr);
      const out = new Float32Array(n);
      add(out, glide(samples(0.2, sr), sr, 90 * pitch, 45 * pitch, 0.03, 0.05 * decay, 0.004), 0, 1);
      add(out, glide(samples(0.2, sr), sr, 80 * pitch, 40 * pitch, 0.03, 0.045 * decay, 0.004), Math.round(0.18 * sr), 0.75);
      return out;
    },
  },
  whoosh: {
    id: "whoosh",
    label: "Whoosh",
    description: "Air sweep for fast movement",
    length: 0.5,
    render: ({ pitch, decay, seed }, sr) => {
      const n = samples(0.5 * decay, sr);
      const nz = noise(n, seed);
      const out = new Float32Array(n);
      // Sweep a band-pass filter upward; recompute coefficients every 64 samples.
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let c = biquad("bandpass", 300, 1.2, sr);
      for (let i = 0; i < n; i++) {
        const p = i / n;
        if (i % 64 === 0) c = biquad("bandpass", (300 + 3500 * p * p) * pitch, 1.2, sr);
        const xi = nz[i]!;
        const y = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = y;
        out[i] = y * Math.sin(Math.PI * p) ** 2 * 2.5;
      }
      return out;
    },
  },
  pluck: {
    id: "pluck",
    label: "Pluck",
    description: "Plucked string (Karplus–Strong)",
    length: 0.9,
    render: ({ pitch, decay, seed }, sr) => {
      const n = samples(0.9 * decay, sr);
      const period = Math.max(2, Math.round(sr / (330 * pitch)));
      const buf = noise(period, seed);
      const out = new Float32Array(n);
      const damp = 0.5 * (0.994 + 0.005 * Math.min(1, decay));
      for (let i = 0; i < n; i++) {
        const j = i % period;
        const next = buf[(j + 1) % period]!;
        out[i] = buf[j]!;
        buf[j] = damp * (buf[j]! + next);
      }
      return out;
    },
  },
  notify: {
    id: "notify",
    label: "Notify",
    description: "Two-tone rising notification",
    length: 0.32,
    render: ({ pitch, decay }, sr) => {
      const out = new Float32Array(samples(0.32 * decay, sr));
      add(out, glide(samples(0.14, sr), sr, 880 * pitch, 880 * pitch, 1, 0.06 * decay), 0, 0.8);
      add(out, glide(samples(0.18, sr), sr, 1320 * pitch, 1320 * pitch, 1, 0.08 * decay), Math.round(0.12 * sr), 0.8);
      return out;
    },
  },
  kick: {
    id: "kick",
    label: "Kick",
    description: "Punchy kick drum",
    length: 0.35,
    render: ({ pitch, decay }, sr) => glide(samples(0.35 * decay, sr), sr, 150 * pitch, 45 * pitch, 0.04, 0.09 * decay, 0.001),
  },
  shutter: {
    id: "shutter",
    label: "Shutter",
    description: "Camera shutter (two mechanical clicks)",
    length: 0.16,
    render: ({ pitch, decay, seed }, sr) => {
      const out = new Float32Array(samples(0.16 * decay, sr));
      const clickAt = (at: number, s: number) => {
        const m = samples(0.03, sr);
        const nz = noise(m, s);
        for (let i = 0; i < m; i++) nz[i]! *= expEnv(i / sr, 0.004 * decay);
        add(out, applyBiquad(nz, biquad("bandpass", 2500 * pitch, 0.9, sr)), Math.round(at * sr), 1.5);
      };
      clickAt(0, seed);
      clickAt(0.07, seed + 1);
      return out;
    },
  },
};

export const PRESET_IDS = Object.keys(PRESETS);

export function renderPreset(id: string, params: SynthParams = {}, sampleRate = DEFAULT_SAMPLE_RATE): Float32Array {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Unknown synth preset: ${id}`);
  const p = {
    pitch: clamp(params.pitch ?? 1, 0.25, 4),
    decay: clamp(params.decay ?? 1, 0.25, 4),
    seed: Math.floor(params.seed ?? 1),
  };
  return fadeEdges(preset.render(p, sampleRate), sampleRate, 1.5);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Parses a `synth:<preset>` sound reference. */
export function parseSynthRef(ref: string): string | null {
  const m = /^synth:([a-z][a-z0-9-]{0,39})$/.exec(ref);
  return m && PRESETS[m[1]!] ? m[1]! : null;
}
