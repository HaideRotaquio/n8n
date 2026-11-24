import { describe, expect, it } from "vitest";
import {
  dbfs,
  decodeWav,
  encodeWav,
  integratedLoudness,
  mix,
  normalize,
  parseSynthRef,
  peak,
  PRESET_IDS,
  renderPreset,
} from "./index";

const SR = 48_000;

function sine(freq: number, seconds: number, amp: number) {
  const x = new Float32Array(seconds * SR);
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return x;
}

describe("loudness (BS.1770)", () => {
  it("matches the BS.1770 reference: 0 dBFS 1 kHz sine = -3.01 LUFS", () => {
    // Reference: a 0 dBFS 1 kHz sine reads −3.01 LUFS; scaling by −20 dB gives −23.01.
    expect(integratedLoudness(sine(1000, 3, 1), SR)).toBeCloseTo(-3.01, 1);
    expect(integratedLoudness(sine(1000, 3, 0.1), SR)).toBeCloseTo(-23.01, 1);
  });
  it("silence is -Infinity", () => {
    expect(integratedLoudness(new Float32Array(SR), SR)).toBe(-Infinity);
  });
});

describe("normalize", () => {
  it("hits the loudness target when the peak allows it", () => {
    const x = sine(1000, 2, 0.05);
    const r = normalize(x, SR, -16, -1);
    expect(r.limitedByPeak).toBe(false);
    expect(r.loudness).toBeCloseTo(-16, 1);
  });
  it("never exceeds the peak ceiling", () => {
    const x = renderPreset("click");
    const r = normalize(x, SR, -6, -1);
    expect(dbfs(peak(x))).toBeLessThanOrEqual(-0.99);
    expect(r.limitedByPeak).toBe(true);
  });
});

describe("synth presets", () => {
  it.each(PRESET_IDS)("%s renders audible, finite, bounded audio", (id) => {
    const x = renderPreset(id);
    expect(x.length).toBeGreaterThan(SR * 0.02);
    expect(x.every(Number.isFinite)).toBe(true);
    const p = peak(x);
    expect(p).toBeGreaterThan(0.01);
    expect(p).toBeLessThan(4);
    // starts and ends at silence (no clicks)
    expect(Math.abs(x[0]!)).toBeLessThan(1e-3);
    expect(Math.abs(x.at(-1)!)).toBeLessThan(1e-3);
  });
  it("is deterministic", () => {
    expect(renderPreset("whoosh", { seed: 7 })).toEqual(renderPreset("whoosh", { seed: 7 }));
    expect(renderPreset("whoosh", { seed: 7 })).not.toEqual(renderPreset("whoosh", { seed: 8 }));
  });
  it("pitch param changes the sound and is clamped", () => {
    expect(renderPreset("pop", { pitch: 2 })).not.toEqual(renderPreset("pop"));
    expect(() => renderPreset("pop", { pitch: 1e9 })).not.toThrow();
    expect(() => renderPreset("nope")).toThrow();
  });
  it("parses synth refs", () => {
    expect(parseSynthRef("synth:chime")).toBe("chime");
    expect(parseSynthRef("synth:unknown")).toBeNull();
    expect(parseSynthRef("snd_x")).toBeNull();
  });
});

describe("mix", () => {
  it("places cues at the right sample", () => {
    const click = new Float32Array([1, 1, 1]);
    const out = mix([{ buffer: click, at: 0.5, gain: 0.5 }], 1, 1000);
    expect(out.length).toBe(1000);
    expect(out[500]).toBeCloseTo(0.5);
    expect(out[499]).toBe(0);
  });
  it("cuts sounds that run past the end", () => {
    const out = mix([{ buffer: new Float32Array(500).fill(1), at: 0.9, gain: 1 }], 1, 1000);
    expect(out.length).toBe(1000);
  });
});

describe("wav", () => {
  it("round-trips mono and stereo within 16-bit precision", () => {
    const a = renderPreset("chime");
    const b = renderPreset("pop");
    const stereo = [a.slice(0, 1000), a.slice(1000, 2000)];
    for (const chans of [[b], stereo]) {
      const dec = decodeWav(encodeWav(chans, SR));
      expect(dec.sampleRate).toBe(SR);
      expect(dec.channels.length).toBe(chans.length);
      for (let c = 0; c < chans.length; c++) {
        for (let i = 0; i < chans[c]!.length; i += 97) {
          expect(dec.channels[c]![i]).toBeCloseTo(Math.max(-1, Math.min(1, chans[c]![i]!)), 3);
        }
      }
    }
  });
  it("rejects non-WAV data", () => {
    expect(() => decodeWav(new Uint8Array(100))).toThrow();
  });
});

describe("stored sounds", async () => {
  const { prepareStoredSound, loadStoredSound, encodeWav, integratedLoudness } = await import("./index");
  const tone = (sec: number, sr: number, amp = 0.1) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr));
  it("mixes to mono, resamples to 48 kHz and normalizes to −16 LUFS", () => {
    const l = tone(1, 44_100);
    const p = prepareStoredSound(encodeWav([l, l], 44_100));
    expect(p.sampleRate).toBe(48_000);
    expect(p.durationMs).toBe(1000);
    expect(p.loudnessLufs!).toBeGreaterThan(-16.6);
    expect(p.loudnessLufs!).toBeLessThan(-15.4);
    expect(p.peakDbfs).toBeLessThanOrEqual(-1 + 1e-6);
    const back = loadStoredSound(p.wav);
    expect(back.length).toBe(48_000);
    expect(Math.abs(integratedLoudness(back, 48_000) - p.loudnessLufs!)).toBeLessThan(0.2);
  });
  it("rejects silence, overlong files and non-WAV data", () => {
    expect(() => prepareStoredSound(encodeWav([new Float32Array(48_000)], 48_000))).toThrow(/silent/);
    expect(() => prepareStoredSound(encodeWav([tone(11, 8000)], 8000))).toThrow(/at most 10 seconds/);
    expect(() => prepareStoredSound(new TextEncoder().encode("not a wav file at all, sorry; definitely not RIFF data"))).toThrow(/Not a WAV/);
  });
});
