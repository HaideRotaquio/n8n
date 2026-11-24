import { DEFAULT_SAMPLE_RATE, fadeEdges, normalize } from "./dsp";
import { decodeWav, encodeWav } from "./wav";

export const MAX_STORED_SOUND_SECONDS = 10;

export interface PreparedSound {
  /** Mono, 48 kHz, normalized. */
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
  loudnessLufs: number | null;
  peakDbfs: number;
  /** 16-bit PCM WAV of `samples`, ready to store. */
  wav: Uint8Array;
}

/** Linear-interpolation resampler (good enough for short UI sounds; band-limited content is preserved by the 48 kHz target). */
function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const out = new Float32Array(Math.max(1, Math.round((x.length * to) / from)));
  const ratio = from / to;
  for (let i = 0; i < out.length; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    const f = p - k;
    out[i] = (x[k] ?? 0) * (1 - f) + (x[Math.min(k + 1, x.length - 1)] ?? 0) * f;
  }
  return out;
}

/**
 * Turns an uploaded 16-bit PCM WAV into a library sound: mono mixdown, 48 kHz, at most 10 s,
 * normalized to −16 LUFS with a −1 dBFS peak ceiling and short fades so it never clicks.
 * Throws a readable error for anything else (wrong format, silence, too long).
 */
export function prepareStoredSound(bytes: Uint8Array): PreparedSound {
  const decoded = decodeWav(bytes);
  const len = decoded.channels[0]?.length ?? 0;
  if (len === 0) throw new Error("The WAV file has no audio");
  if (len / decoded.sampleRate > MAX_STORED_SOUND_SECONDS) throw new Error(`Sounds can be at most ${MAX_STORED_SOUND_SECONDS} seconds long`);
  const mono = new Float32Array(len);
  for (const ch of decoded.channels) for (let i = 0; i < len; i++) mono[i]! += ch[i]! / decoded.channels.length;
  const samples = fadeEdges(resample(mono, decoded.sampleRate, DEFAULT_SAMPLE_RATE), DEFAULT_SAMPLE_RATE, 3);
  if (!samples.some((v) => Math.abs(v) > 1e-4)) throw new Error("The WAV file is silent");
  const n = normalize(samples, DEFAULT_SAMPLE_RATE);
  return {
    samples,
    sampleRate: DEFAULT_SAMPLE_RATE,
    durationMs: Math.round((samples.length / DEFAULT_SAMPLE_RATE) * 1000),
    loudnessLufs: Number.isFinite(n.loudness) ? n.loudness : null,
    peakDbfs: n.peakDbfs,
    wav: encodeWav([samples], DEFAULT_SAMPLE_RATE),
  };
}

/** Decodes a stored (already prepared) sound for mixing. */
export function loadStoredSound(bytes: Uint8Array): Float32Array {
  const d = decodeWav(bytes);
  return d.sampleRate === DEFAULT_SAMPLE_RATE ? d.channels[0]! : resample(d.channels[0]!, d.sampleRate, DEFAULT_SAMPLE_RATE);
}
