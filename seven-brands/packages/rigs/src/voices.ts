import type { SoundCue } from "@sb/asset";

/**
 * Cute voice sounds per emotion (`synth:voice-*` presets in @sb/audio). Each emotion's main cue is re-voiced in place,
 * so it stays on the frame the motion was designed around; some emotions keep their effect sound too
 * (the heartbeat under "aww", the sparkle after "tee-hee").
 */

export type VoiceRule =
  | { replace: string; with: string; gain?: number; pitch?: number }
  | { add: string; at: string | number; gain?: number; pitch?: number; id: string }
  | { remove: string };

const voiceCue = (id: string, preset: string, marker: string | undefined, at: number | undefined, gain: number, pitch: number, base?: SoundCue): SoundCue => ({
  id,
  sound: `synth:${preset}`,
  ...(marker !== undefined ? { marker } : { at: at ?? 0 }),
  ...(base?.offset !== undefined ? { offset: base.offset } : {}),
  gain,
  ...(base?.pan !== undefined ? { pan: base.pan } : {}),
  ...(base?.panFrom !== undefined ? { panFrom: base.panFrom } : {}),
  ...(pitch !== 1 ? { params: { pitch } } : {}),
});

/** Applies voice rules to an emotion's cues. `voice` is the character's voice pitch (1 = default). */
export function voiced(sounds: SoundCue[], rules: VoiceRule[], voice = 1): SoundCue[] {
  let out = [...sounds];
  for (const rule of rules) {
    const target = "remove" in rule ? rule.remove : "replace" in rule ? rule.replace : null;
    if (target && !out.some((c) => c.id === target)) throw new Error(`Voice rule names cue "${target}", which this emotion doesn't have`);
    if ("remove" in rule) {
      out = out.filter((c) => c.id !== rule.remove);
    } else if ("replace" in rule) {
      const pitch = Math.round((rule.pitch ?? 1) * voice * 100) / 100;
      out = out.map((c) => (c.id === rule.replace ? voiceCue(c.id, rule.with, c.marker, c.at, rule.gain ?? 0.85, pitch, c) : c));
    } else {
      const pitch = Math.round((rule.pitch ?? 1) * voice * 100) / 100;
      if (typeof rule.at === "number") {
        out.push(voiceCue(rule.id, rule.add, undefined, rule.at, rule.gain ?? 0.8, pitch));
        continue;
      }
      const anchor = out.find((c) => c.id === rule.at);
      if (!anchor) throw new Error(`No cue "${rule.at}" to add a voice to`);
      out.push(voiceCue(rule.id, rule.add, anchor.marker, anchor.at, rule.gain ?? 0.8, pitch, anchor));
    }
  }
  return out;
}

/** Moodicons faces: their one cue becomes a voice (heart eyes keep the heartbeat under an "aww~"). */
export const FACE_VOICES: Record<string, VoiceRule[]> = {
  happy: [{ replace: "pop", with: "voice-yay" }],
  laughing: [{ replace: "giggle", with: "voice-laugh" }],
  love: [{ add: "voice-aww", at: "beat", id: "aww" }],
  sad: [{ replace: "sigh", with: "voice-sad" }],
  // The wail starts with the loop (it's longer than the time left after the tear falls); the drip stays on the tear.
  crying: [{ add: "voice-cry", at: 0, id: "wah", gain: 0.85 }],
  angry: [{ replace: "huff", with: "voice-hmph" }],
  surprised: [{ replace: "gasp", with: "voice-oh" }],
  wink: [{ replace: "click", with: "voice-teehee" }],
  sleepy: [{ replace: "snore", with: "voice-sleep" }],
  cool: [{ replace: "nod", with: "voice-heh" }],
  thinking: [{ replace: "idea", with: "voice-hmm" }],
  party: [{ replace: "toot", with: "voice-party" }],
  shy: [{ replace: "blush", with: "voice-shy" }],
  nervous: [{ replace: "gulp", with: "voice-nervous" }],
  kiss: [{ replace: "mwah", with: "voice-kiss" }],
};

/** Chibi reactions. Effects that already read as cute (the jiggle boing, the power-up charge) stay as they are. */
export const CHIBI_VOICES: Record<string, VoiceRule[]> = {
  cool: [{ add: "voice-heh", at: "shing", id: "heh", gain: 0.75 }],
  happy: [{ replace: "land", with: "voice-yay" }],
  laughing: [{ replace: "laugh", with: "voice-laugh" }],
  giggle: [{ replace: "he-1", with: "voice-giggle" }, { remove: "he-2" }, { remove: "he-3" }],
  wink: [{ add: "voice-teehee", at: "ting", id: "teehee" }],
  excited: [{ replace: "yay", with: "voice-yay", pitch: 1.12 }],
  love: [{ add: "voice-aww", at: "beat", id: "aww" }],
  shy: [{ replace: "aww", with: "voice-shy" }],
  sleepy: [{ replace: "breath", with: "voice-sleep" }],
  confused: [{ replace: "huh-1", with: "voice-huh" }, { remove: "huh-2" }],
  sad: [{ replace: "sigh", with: "voice-sad" }],
  scared: [{ replace: "gasp", with: "voice-eep" }],
  angry: [{ add: "voice-hmph", at: "huff", id: "hmph", gain: 0.9 }],
  surprised: [{ replace: "gasp", with: "voice-oh" }],
};

/** Each character's voice: 1 is the default; deeper for the big and the old, higher for the small and bubbly. */
export const CHIBI_VOICE_PITCH: Record<string, number> = {
  kai: 1, amara: 1.06, mateo: 0.96, tala: 1.08, priya: 1.1, lena: 1.12,
  rook: 0.84, isla: 1.02, bo: 0.92, juno: 1.04,
  rina: 1.15, taro: 0.94, noor: 1.06, bram: 0.74,
  lio: 0.98, vera: 1.02, sage: 0.97, brix: 0.76,
  pip: 1.18, mira: 1.2, ezra: 0.88, kofi: 0.82,
  awan: 0.92, saliha: 1.02, dumalag: 0.86, bantug: 1, aria: 1.1, landong: 0.9, ngilad: 0.72, karum: 0.8,
  ira: 0.96, vorak: 0.74, zeph: 0.9, datus: 0.8,
};
