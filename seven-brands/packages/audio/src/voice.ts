import { applyBiquad, biquad, prng, samples } from "./dsp";
import type { SynthPreset } from "./synth";

/**
 * Cute cartoon "voice" sounds — giggles, "mwah!", "hmm?", "waaah" — synthesized from scratch, so we own them outright.
 *
 * How: each syllable is a pitched voice source built additively (harmonics of f0, each weighted by a vowel's formant
 * envelope), with the vowel morphing over time, plus breath ("h"), lip smacks, sniffles and whistles where needed.
 * Formants sit higher than an adult's and pitches are high, which is what reads as small and cute.
 * `pitch` scales a character's voice (0.7 deep … 1.2 tiny); formants follow partly so voices stay natural.
 */

type Vowel = "i" | "e" | "a" | "o" | "u" | "m";
/** [frequency Hz, bandwidth Hz, amplitude] × 3, child/cartoon-like. */
const FORMANTS: Record<Vowel, [number, number, number][]> = {
  i: [[330, 70, 1], [2750, 130, 0.5], [3400, 170, 0.3]],
  e: [[520, 80, 1], [2250, 120, 0.45], [3000, 160, 0.28]],
  a: [[880, 110, 1], [1400, 130, 0.6], [2900, 180, 0.25]],
  o: [[580, 90, 1], [980, 110, 0.55], [2800, 180, 0.18]],
  u: [[380, 70, 1], [920, 100, 0.32], [2600, 180, 0.12]],
  m: [[290, 70, 1], [1300, 220, 0.07], [2650, 300, 0.04]],
};

export interface Syllable {
  /** Start, seconds. */
  at: number;
  dur: number;
  /** Pitch contour (Hz), spread evenly over the syllable. */
  f0: number[];
  /** Vowel path: [position 0–1, vowel] points. */
  vowels: [number, Vowel][];
  amp?: number;
  attack?: number;
  release?: number;
  /** Breathiness 0–1 (an "h" onset and air in the voice). */
  breath?: number;
  /** [rate Hz, depth as a fraction of f0]. */
  vibrato?: [number, number];
}

const TAU = Math.PI * 2;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));

function vowelAt(path: [number, Vowel][], pos: number): [number, number, number][] {
  let k = 0;
  while (k < path.length - 1 && pos > path[k + 1]![0]) k++;
  const [p0, v0] = path[k]!;
  const [p1, v1] = path[Math.min(k + 1, path.length - 1)]!;
  const w = p1 > p0 ? smooth((pos - p0) / (p1 - p0)) : 0;
  return FORMANTS[v0].map(([f, b, a], j) => {
    const [f2, b2, a2] = FORMANTS[v1][j]!;
    return [f + (f2 - f) * w, b + (b2 - b) * w, a + (a2 - a) * w];
  });
}

function contour(points: number[], pos: number): number {
  if (points.length === 1) return points[0]!;
  const x = pos * (points.length - 1);
  const k = Math.min(points.length - 2, Math.floor(x));
  const w = smooth(x - k);
  return points[k]! * Math.pow(points[k + 1]! / points[k]!, w);
}

/** Renders syllables into `out` (mono). */
export function speak(out: Float32Array, sylls: Syllable[], sr: number, opts: { pitch: number; seed: number }): Float32Array {
  const rand = prng(opts.seed);
  const fScale = Math.pow(opts.pitch, 0.5) * 1.06;
  for (const s of sylls) {
    const start = Math.round(s.at * sr);
    const n = samples(s.dur, sr);
    const amp = s.amp ?? 1;
    const attack = s.attack ?? 0.015;
    const release = s.release ?? 0.06;
    const breath = s.breath ?? 0.15;
    let phase = rand() * TAU;
    // Breath noise, shaped by the opening vowel's second formant.
    const f2 = vowelAt(s.vowels, 0)[1]![0] * fScale;
    const air = applyBiquad(Float32Array.from({ length: n }, () => rand() * 2 - 1), biquad("bandpass", Math.min(f2, sr / 2.5), 1.2, sr));
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / sr;
      const pos = i / n;
      let f0 = contour(s.f0, pos) * opts.pitch;
      if (s.vibrato) f0 *= 1 + s.vibrato[1] * Math.sin(TAU * s.vibrato[0] * t);
      f0 *= 1 + (rand() - 0.5) * 0.004; // tiny jitter keeps it alive
      phase += (TAU * f0) / sr;
      const formants = vowelAt(s.vowels, pos);
      let v = 0;
      for (let k = 1; k * f0 < Math.min(7000, sr / 2.4); k++) {
        const fk = k * f0;
        let env = 0.02;
        for (const [ff, bw, a] of formants) {
          const d = (fk - ff * fScale) / bw;
          env += a / (1 + d * d);
        }
        v += (env / Math.pow(k, 0.7)) * Math.sin(k * phase);
      }
      const e = smooth(t / attack) * smooth((s.dur - t) / release);
      // "h" onset: a short puff of air, then the voice fades in; afterwards only a trace of air stays in the voice.
      const hLen = 0.012 + 0.035 * breath;
      const onset = smooth(t / hLen);
      const puff = breath * 0.9 * (1 - onset) * smooth(t / 0.004);
      out[start + i]! += amp * e * (0.32 * v * onset + (puff + 0.05 * breath) * air[i]!);
    }
  }
  return out;
}

/** Short filtered noise burst: "t", "ph", lip smack, sniffle (rising = inhale). */
function burst(out: Float32Array, at: number, dur: number, sr: number, seed: number, type: "lowpass" | "highpass" | "bandpass", f: number, amp: number, rising = false) {
  const n = samples(dur, sr);
  const rand = prng(seed);
  const x = applyBiquad(Float32Array.from({ length: n }, () => rand() * 2 - 1), biquad(type, f, 1, sr));
  const start = Math.round(at * sr);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const p = i / n;
    const e = rising ? smooth(p / 0.8) * smooth((1 - p) / 0.15) : Math.exp(-p * 5) * smooth(p / 0.05);
    out[start + i]! += amp * e * x[i]!;
  }
}

/** Sine whistle with a glide and vibrato (the cartoon sleep "pyuu~", sparkles). */
function whistle(out: Float32Array, at: number, dur: number, sr: number, f0: number, f1: number, amp: number, vib = 0) {
  const n = samples(dur, sr);
  const start = Math.round(at * sr);
  let ph = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const p = i / n;
    const f = f0 * Math.pow(f1 / f0, p) * (1 + vib * Math.sin(TAU * 5 * (i / sr)));
    ph += (TAU * f) / sr;
    out[start + i]! += amp * smooth(p / 0.1) * smooth((1 - p) / 0.3) * (Math.sin(ph) + 0.15 * Math.sin(2 * ph));
  }
}

function finish(out: Float32Array): Float32Array {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i]! *= 0.9 / peak;
  return out;
}

type Render = (p: { pitch: number; seed: number }, sr: number) => Float32Array;
const voice = (id: string, label: string, description: string, length: number, render: Render): SynthPreset => ({
  id,
  label,
  description,
  length,
  render: ({ pitch, seed }, sr) => finish(render({ pitch, seed }, sr)),
});
const buf = (seconds: number, sr: number) => new Float32Array(samples(seconds, sr));

export const VOICE_PRESETS: Record<string, SynthPreset> = Object.fromEntries(
  [
    voice("voice-giggle", "Giggle", "Cute 'hehehe~'", 0.55, (p, sr) =>
      speak(buf(0.55, sr), [0, 1, 2, 3].map((k) => ({ at: k * 0.12, dur: 0.1, f0: [700 + 40 * k, 650 + 30 * k], vowels: [[0, "e"], [1, "i"]], breath: 0.5, amp: 1 - 0.06 * k })), sr, p)),
    voice("voice-laugh", "Laugh", "Cute 'ahahaha!'", 0.85, (p, sr) =>
      speak(buf(0.85, sr), [0, 1, 2, 3, 4].map((k) => ({ at: k * 0.14, dur: k === 4 ? 0.22 : 0.12, f0: [780 - 40 * k, (780 - 40 * k) * 0.9], vowels: [[0, "a"]], breath: 0.55, release: k === 4 ? 0.12 : 0.05 })), sr, p)),
    voice("voice-sleep", "Sleepy", "Soft snore in, then a whistled 'pyuu~' out", 1.4, (p, sr) => {
      const out = buf(1.4, sr);
      const n = samples(0.55, sr);
      const rand = prng(p.seed);
      const snore = applyBiquad(Float32Array.from({ length: n }, () => rand() * 2 - 1), biquad("bandpass", 520 * p.pitch, 2.2, sr));
      for (let i = 0; i < n; i++) out[i]! += 0.55 * smooth(i / n / 0.9) * (0.6 + 0.4 * Math.sin((TAU * 32 * i) / sr)) * snore[i]!;
      whistle(out, 0.62, 0.7, sr, 1500 * p.pitch, 720 * p.pitch, 0.32, 0.02);
      return out;
    }),
    voice("voice-party", "Party", "Party horn 'pweee!', a popper and sparkles", 1.25, (p, sr) => {
      const out = buf(1.25, sr);
      speak(out, [{ at: 0, dur: 0.62, f0: [500, 540, 530], vowels: [[0, "i"]], breath: 0.05, attack: 0.02, vibrato: [28, 0.012] }], sr, p);
      for (let i = 0; i < samples(0.62, sr); i++) out[i]! *= 0.75 + 0.25 * Math.sin((TAU * 28 * i) / sr); // reed rattle
      burst(out, 0.66, 0.06, sr, p.seed + 3, "bandpass", 1900, 1.4);
      for (const [k, f] of [[0, 2600], [1, 3150], [2, 3700]] as const) whistle(out, 0.72 + k * 0.1, 0.22, sr, f, f * 1.02, 0.16);
      return out;
    }),
    voice("voice-hmm", "Hmm", "Thinking 'hmm~?' with a rising end", 0.7, (p, sr) =>
      speak(buf(0.7, sr), [{ at: 0, dur: 0.66, f0: [430, 400, 405, 540], vowels: [[0, "m"]], breath: 0.1, attack: 0.05, release: 0.1 }], sr, p)),
    voice("voice-shy", "Shy", "Soft, breathy 'ehehe…'", 0.5, (p, sr) =>
      speak(buf(0.5, sr), [0, 1, 2].map((k) => ({ at: k * 0.15, dur: 0.11, f0: [640 - 20 * k, 600 - 20 * k], vowels: [[0, "e"], [1, "i"]], breath: 0.85, amp: 0.75 - 0.15 * k })), sr, p)),
    voice("voice-nervous", "Nervous", "'Eep!' then a wobbly 'ehh~'", 0.72, (p, sr) =>
      speak(buf(0.72, sr), [
        { at: 0, dur: 0.12, f0: [950, 1050], vowels: [[0, "i"]], attack: 0.005, breath: 0.1 },
        { at: 0.2, dur: 0.48, f0: [660, 560], vowels: [[0, "e"]], vibrato: [9, 0.045], amp: 0.75, breath: 0.3, release: 0.12 },
      ], sr, p)),
    voice("voice-kiss", "Kiss", "'Mwah!' with a lip smack", 0.5, (p, sr) => {
      const out = speak(buf(0.5, sr), [{ at: 0, dur: 0.34, f0: [520, 610, 560], vowels: [[0, "m"], [0.32, "m"], [0.5, "a"], [1, "a"]], breath: 0.05, release: 0.05 }], sr, p);
      burst(out, 0.35, 0.03, sr, p.seed + 1, "bandpass", 1500 * p.pitch, 1.1);
      return out;
    }),
    voice("voice-heh", "Heh", "Confident little 'heh~'", 0.3, (p, sr) =>
      speak(buf(0.3, sr), [{ at: 0, dur: 0.24, f0: [520, 460], vowels: [[0, "e"]], breath: 0.7, release: 0.1 }], sr, p)),
    voice("voice-teehee", "Tee-hee", "Playful 'tee-hee~'", 0.5, (p, sr) => {
      const out = buf(0.5, sr);
      burst(out, 0, 0.012, sr, p.seed, "highpass", 4000, 0.6);
      return speak(out, [
        { at: 0.008, dur: 0.14, f0: [760, 800], vowels: [[0, "i"]], breath: 0.1, attack: 0.008 },
        { at: 0.2, dur: 0.24, f0: [840, 720], vowels: [[0, "i"]], breath: 0.6, release: 0.1 },
      ], sr, p);
    }),
    voice("voice-oh", "Oh!", "Surprised 'oh!'", 0.3, (p, sr) =>
      speak(buf(0.3, sr), [{ at: 0, dur: 0.26, f0: [520, 860, 840], vowels: [[0, "o"], [1, "u"]], attack: 0.008, breath: 0.2, release: 0.08 }], sr, p)),
    voice("voice-hmph", "Hmph!", "Pouty 'hmph!'", 0.32, (p, sr) => {
      const out = speak(buf(0.32, sr), [{ at: 0, dur: 0.16, f0: [470, 400], vowels: [[0, "m"]], attack: 0.01, release: 0.03 }], sr, p);
      burst(out, 0.14, 0.13, sr, p.seed + 2, "lowpass", 1300, 1.3);
      return out;
    }),
    voice("voice-cry", "Cry", "'Waaah~' then two sniffles", 1.3, (p, sr) => {
      const out = speak(buf(1.3, sr), [{ at: 0, dur: 0.78, f0: [700, 730, 640, 560], vowels: [[0, "u"], [0.18, "a"], [1, "a"]], vibrato: [6.5, 0.06], breath: 0.25, release: 0.15 }], sr, p);
      burst(out, 0.88, 0.1, sr, p.seed + 4, "highpass", 1800, 0.9, true);
      burst(out, 1.08, 0.09, sr, p.seed + 5, "highpass", 1900, 0.75, true);
      return out;
    }),
    voice("voice-aww", "Aww", "Lovestruck 'aww~'", 0.65, (p, sr) =>
      speak(buf(0.65, sr), [{ at: 0, dur: 0.62, f0: [620, 700, 600], vowels: [[0, "a"], [0.6, "o"], [1, "u"]], vibrato: [5, 0.025], breath: 0.35, attack: 0.04, release: 0.15 }], sr, p)),
    voice("voice-sad", "Sad", "Small, falling 'ohh…'", 0.85, (p, sr) =>
      speak(buf(0.85, sr), [{ at: 0, dur: 0.8, f0: [520, 470, 400], vowels: [[0, "o"], [1, "u"]], breath: 0.5, amp: 0.7, attack: 0.08, release: 0.2 }], sr, p)),
    voice("voice-yay", "Yay!", "Happy 'yay!'", 0.45, (p, sr) =>
      speak(buf(0.45, sr), [
        { at: 0, dur: 0.14, f0: [620, 700], vowels: [[0, "i"], [1, "a"]], breath: 0.1 },
        { at: 0.17, dur: 0.26, f0: [760, 880, 820], vowels: [[0, "a"], [1, "i"]], release: 0.1 },
      ], sr, p)),
    voice("voice-huh", "Huh?", "Confused 'huh?'", 0.3, (p, sr) =>
      speak(buf(0.3, sr), [{ at: 0, dur: 0.26, f0: [420, 640], vowels: [[0, "e"], [1, "a"]], breath: 0.7, release: 0.08 }], sr, p)),
    voice("voice-eep", "Eep!", "Scared 'eep!' with a tremble", 0.5, (p, sr) =>
      speak(buf(0.5, sr), [
        { at: 0, dur: 0.12, f0: [980, 1100], vowels: [[0, "i"]], attack: 0.004, breath: 0.15 },
        { at: 0.16, dur: 0.3, f0: [900, 820], vowels: [[0, "i"]], vibrato: [11, 0.05], amp: 0.6, breath: 0.4 },
      ], sr, p)),
  ].map((v) => [v.id, v]),
);
