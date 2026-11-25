/**
 * Small, dependency-free DSP toolkit. Pure functions over Float32Array so the same code
 * runs in Node (exports, QA) and in the browser (previews).
 */

export const DEFAULT_SAMPLE_RATE = 48_000;

/** Deterministic PRNG (mulberry32) so renders are reproducible and checksummable. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function samples(seconds: number, sampleRate: number): number {
  return Math.max(1, Math.round(seconds * sampleRate));
}

/** Biquad filter (RBJ cookbook). Processes in place and returns the buffer. */
export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function biquad(type: "lowpass" | "highpass" | "bandpass" | "highshelf", f0: number, q: number, sampleRate: number, gainDb = 0): BiquadCoeffs {
  const w0 = (2 * Math.PI * Math.min(f0, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  switch (type) {
    case "lowpass":
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "highpass":
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "bandpass":
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
      break;
    case "highshelf": {
      const A = 10 ** (gainDb / 40);
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cos + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - s;
      break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function applyBiquad(x: Float32Array, c: BiquadCoeffs, out = new Float32Array(x.length)): Float32Array {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const y = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

export function peak(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]!));
  return p;
}

export function dbfs(linear: number): number {
  return linear <= 0 ? -Infinity : 20 * Math.log10(linear);
}

export function scale(x: Float32Array, g: number): Float32Array {
  for (let i = 0; i < x.length; i++) x[i]! *= g;
  return x;
}

/** Short linear fades to avoid clicks at the start/end of a buffer. */
export function fadeEdges(x: Float32Array, sampleRate: number, ms = 3): Float32Array {
  const n = Math.min(Math.floor((ms / 1000) * sampleRate), Math.floor(x.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    x[i]! *= g;
    x[x.length - 1 - i]! *= g;
  }
  return x;
}

/**
 * Integrated loudness (LUFS) per ITU-R BS.1770-4 for a mono signal:
 * K-weighting, 400 ms blocks with 75% overlap, absolute (−70 LUFS) and relative (−10 LU) gates.
 * Signals shorter than one block are measured as a single block.
 */
export function integratedLoudness(x: Float32Array, sampleRate: number): number {
  return integratedLoudnessChannels([x], sampleRate);
}

/**
 * Multi-channel form (BS.1770-4, front channels weighted 1.0): per 400 ms block, the K-weighted mean squares of all
 * channels are summed, then gated as for mono. A centred sound split equally to L/R measures the same as mono.
 */
export function integratedLoudnessChannels(channels: readonly Float32Array[], sampleRate: number): number {
  // K-weighting stage parameters as used by pyloudnorm (RBJ shelf/high-pass forms).
  const pre = biquad("highshelf", 1500, Math.SQRT1_2, sampleRate, 4.0);
  const rlb = biquad("highpass", 38, 0.5, sampleRate);
  const ks = channels.map((x) => applyBiquad(applyBiquad(x, pre), rlb));
  const len = ks[0]?.length ?? 0;
  const block = Math.floor(0.4 * sampleRate);
  const ms: number[] = [];
  const blockPower = (start: number, n: number) => {
    let total = 0;
    for (const k of ks) {
      let sum = 0;
      for (let i = start; i < start + n; i++) sum += k[i]! * k[i]!;
      total += sum / n;
    }
    return total;
  };
  if (len === 0) return -Infinity;
  if (len < block) ms.push(blockPower(0, len));
  else {
    const hop = Math.floor(block / 4);
    for (let start = 0; start + block <= len; start += hop) ms.push(blockPower(start, block));
  }
  const lufs = (m: number) => -0.691 + 10 * Math.log10(m);
  const abs = ms.filter((m) => m > 0 && lufs(m) > -70);
  if (abs.length === 0) return -Infinity;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const relGate = lufs(mean(abs)) - 10;
  const rel = abs.filter((m) => lufs(m) > relGate);
  return lufs(mean(rel.length ? rel : abs));
}

export interface NormalizeResult {
  gainDb: number;
  loudness: number;
  peakDbfs: number;
  limitedByPeak: boolean;
}

/**
 * Normalizes in place to `targetLufs`, but never above `peakCeilingDbfs` (sample peak).
 * Defaults: −16 LUFS (common for web/mobile), −1 dBFS ceiling.
 */
export function normalize(x: Float32Array, sampleRate: number, targetLufs = -16, peakCeilingDbfs = -1): NormalizeResult {
  const current = integratedLoudness(x, sampleRate);
  const p = peak(x);
  if (!Number.isFinite(current) || p === 0) return { gainDb: 0, loudness: current, peakDbfs: dbfs(p), limitedByPeak: false };
  let gainDb = targetLufs - current;
  const maxGainDb = peakCeilingDbfs - dbfs(p);
  const limitedByPeak = gainDb > maxGainDb;
  if (limitedByPeak) gainDb = maxGainDb;
  scale(x, 10 ** (gainDb / 20));
  return { gainDb, loudness: integratedLoudness(x, sampleRate), peakDbfs: dbfs(peak(x)), limitedByPeak };
}

export interface MixCue {
  buffer: Float32Array;
  /** Start time in seconds. */
  at: number;
  gain: number;
}

/** Mixes mono cues into a buffer of `durationSec`. Sounds running past the end are cut with a short fade. */
export function mix(cues: readonly MixCue[], durationSec: number, sampleRate: number): Float32Array {
  const out = new Float32Array(samples(durationSec, sampleRate));
  for (const c of cues) {
    const start = Math.round(c.at * sampleRate);
    for (let i = 0; i < c.buffer.length; i++) {
      const j = start + i;
      if (j < 0) continue;
      if (j >= out.length) break;
      out[j]! += c.buffer[i]! * c.gain;
    }
  }
  return fadeEdges(out, sampleRate, 2);
}


/** Normalizes several channels together (same gain on each), like `normalize` for mono. */
export function normalizeChannels(channels: Float32Array[], sampleRate: number, targetLufs = -16, peakCeilingDbfs = -1): NormalizeResult {
  const current = integratedLoudnessChannels(channels, sampleRate);
  const p = Math.max(...channels.map(peak));
  if (!Number.isFinite(current) || p === 0) return { gainDb: 0, loudness: current, peakDbfs: dbfs(p), limitedByPeak: false };
  let gainDb = targetLufs - current;
  const maxGainDb = peakCeilingDbfs - dbfs(p);
  const limitedByPeak = gainDb > maxGainDb;
  if (limitedByPeak) gainDb = maxGainDb;
  for (const c of channels) scale(c, 10 ** (gainDb / 20));
  return { gainDb, loudness: integratedLoudnessChannels(channels, sampleRate), peakDbfs: dbfs(Math.max(...channels.map(peak))), limitedByPeak };
}

/** Equal-power pan law: −1 left, 0 centre (−3 dB each side), 1 right. Total power stays constant. */
export function panGains(pan: number): [number, number] {
  const p = Math.max(-1, Math.min(1, pan));
  const a = ((p + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Mixes mono cues into a stereo pair, placing each cue with `panGains`. */
export function mixStereo(cues: readonly (MixCue & { pan: number })[], durationSec: number, sampleRate: number): [Float32Array, Float32Array] {
  const left = cues.map((c) => ({ ...c, gain: c.gain * panGains(c.pan)[0] }));
  const right = cues.map((c) => ({ ...c, gain: c.gain * panGains(c.pan)[1] }));
  return [mix(left, durationSec, sampleRate), mix(right, durationSec, sampleRate)];
}
