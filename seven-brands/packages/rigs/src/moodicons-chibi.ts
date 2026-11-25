import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, heartPath, track } from "./util";

/**
 * Moodicons Chibi Cast: an international cast of ORIGINAL chibi characters with big reactions.
 * Every character is our own design (names, hair, outfits, colors) and must never be redrawn to resemble a character
 * from an existing anime, game or comic. All share one friendly face shape; they differ by hair, outfit and skin tone,
 * not by exaggerated features, and they are not labelled by nationality.
 * 64×64 grid: big head (r 17), small body, 2 px ink outline — matching the other Moodicons rigs.
 */

export const CHIBI_CHARACTERS = ["kai", "amara", "mateo", "tala", "priya", "lena"] as const;
export type ChibiCharacter = (typeof CHIBI_CHARACTERS)[number];
export const CHIBI_REACTIONS = ["happy", "laughing", "love", "sad", "angry", "surprised"] as const;
export type ChibiReaction = (typeof CHIBI_REACTIONS)[number];
export const CHIBI_VARIANTS = CHIBI_CHARACTERS.flatMap((c) => CHIBI_REACTIONS.map((r) => `${c}-${r}`));

const SHARED = { ink: "#2B1B12", white: "#FFFFFF", blush: "#FF8FA3", heart: "#E8336D", tear: "#4FC3F7", fire: "#FF5A36" };

interface Character {
  name: string;
  role: string;
  tokens: { skin: string; hair: string; outfit: string; accent: string };
  back: Layer[];
  front: Layer[];
  /** Drawn over the eyes (glasses). */
  over?: Layer[];
}

const ink = { token: "ink" } as const;
const fill = (token: string) => ({ token }) as const;
const shape = (id: string, d: string, f: string, extra: Partial<Extract<Layer, { kind: "shape" }>> = {}): Layer => ({
  id,
  kind: "shape",
  shape: { type: "path", d },
  fill: fill(f),
  stroke: ink,
  strokeWidth: 2,
  lineJoin: "round",
  ...extra,
});
const strokeOnly = (id: string, d: string, token: string, width: number): Layer => ({ id, kind: "shape", shape: { type: "path", d }, fill: "none", stroke: fill(token), strokeWidth: width, lineCap: "round", lineJoin: "round" });
const circle = (id: string, cx: number, cy: number, r: number, f: string, outline = false): Layer => ({ id, kind: "shape", shape: { type: "circle", cx, cy, r }, fill: fill(f), ...(outline ? { stroke: ink, strokeWidth: 1.8 } : {}) });

const CHARACTERS: Record<ChibiCharacter, Character> = {
  kai: {
    name: "Kai",
    role: "the spiky-haired skateboarder with a star clip",
    tokens: { skin: "#F2C8A0", hair: "#2B3A67", outfit: "#7CB342", accent: "#FFD54A" },
    back: [{ id: "hair-back", kind: "shape", shape: { type: "polygon", points: "13 30 10 15 19 18 21 6 29 12 34 3 39 11 47 6 45 17 54 15 51 30" }, fill: fill("hair"), stroke: ink, strokeWidth: 2, lineJoin: "round" }],
    front: [
      shape("hair-front", "M15 23 Q16 11 32 10 Q48 11 49 23 L44 17 L40 22 L36 15 L32 21 L28 15 L24 22 L20 17 Z", "hair"),
      { id: "star-clip", kind: "shape", shape: { type: "polygon", points: "19 14.6 20.2 17.2 23 17.4 20.8 19.2 21.5 22 19 20.5 16.5 22 17.2 19.2 15 17.4 17.8 17.2" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
    ],
  },
  amara: {
    name: "Amara",
    role: "the artist with beaded braids",
    tokens: { skin: "#8D5524", hair: "#2A1B14", outfit: "#1FA39A", accent: "#F2B33D" },
    back: [strokeOnly("braid-l", "M14 22 Q11 36 13.5 48", "hair", 5), strokeOnly("braid-r", "M50 22 Q53 36 50.5 48", "hair", 5), circle("bead-l", 13.5, 49.5, 2.3, "accent", true), circle("bead-r", 50.5, 49.5, 2.3, "accent", true)],
    front: [shape("hair-front", "M15 25 Q14 8 32 8 Q50 8 49 25 Q44 16 32 16 Q20 16 15 25 Z", "hair")],
  },
  mateo: {
    name: "Mateo",
    role: "the curly-haired footballer",
    tokens: { skin: "#C68642", hair: "#3B2416", outfit: "#2E9E4F", accent: "#FFFFFF" },
    back: [],
    front: [
      {
        id: "curls",
        kind: "group",
        children: [
          circle("curl-1", 17.5, 21, 4.8, "hair", true),
          circle("curl-2", 22.5, 14.5, 5.4, "hair", true),
          circle("curl-3", 29.5, 11, 6, "hair", true),
          circle("curl-4", 36.5, 11, 6, "hair", true),
          circle("curl-5", 42.5, 14.5, 5.4, "hair", true),
          circle("curl-6", 47, 21, 4.8, "hair", true),
        ],
      },
    ],
  },
  tala: {
    name: "Tala",
    role: "the dreamer with a flower in her hair",
    tokens: { skin: "#D8A47F", hair: "#161616", outfit: "#3A6FD8", accent: "#FFE08A" },
    back: [shape("hair-back", "M11 27 Q11 8 32 8 Q53 8 53 27 L54 51 Q49 54 45 50 L45 32 L19 32 L19 50 Q15 54 10 51 Z", "hair")],
    front: [shape("hair-front", "M15 25 Q15 10 32 10 Q49 10 49 25 Q44 15 30 17 Q22 18 15 25 Z", "hair"), circle("flower", 46.5, 17, 2.8, "white", true), circle("flower-center", 46.5, 17, 1.1, "accent")],
  },
  priya: {
    name: "Priya",
    role: "the coder with a long braid",
    tokens: { skin: "#B5753F", hair: "#1E1410", outfit: "#C2185B", accent: "#F2B33D" },
    back: [shape("hair-back", "M13 27 Q13 8 32 8 Q51 8 51 27 Z", "hair"), strokeOnly("braid", "M48 30 Q51 41 48 52", "hair", 5), { id: "braid-tie", kind: "shape", shape: { type: "rect", x: 45.5, y: 50.5, width: 5, height: 2.6, rx: 1 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2 }],
    front: [
      shape("hair-front", "M15 24 Q16 10 32 10 Q48 10 49 24 Q44 14 32 15 Q20 14 15 24 Z", "hair"),
      { id: "earring-l", kind: "shape", shape: { type: "circle", cx: 15.6, cy: 34.5, r: 1.7 }, fill: "none", stroke: fill("accent"), strokeWidth: 1.4 },
      { id: "earring-r", kind: "shape", shape: { type: "circle", cx: 48.4, cy: 34.5, r: 1.7 }, fill: "none", stroke: fill("accent"), strokeWidth: 1.4 },
    ],
  },
  lena: {
    name: "Lena",
    role: "the scientist with a bob and round glasses",
    tokens: { skin: "#F1C7A4", hair: "#E8C468", outfit: "#7B5CD6", accent: "#FFFFFF" },
    back: [shape("hair-back", "M12 30 Q11 8 32 8 Q53 8 52 30 Q52 39 47 39 L47 27 L17 27 L17 39 Q12 39 12 30 Z", "hair")],
    front: [shape("hair-front", "M15 22 Q16 9 32 9 Q48 9 49 22 Z", "hair")],
    over: [
      {
        id: "glasses",
        kind: "group",
        children: [
          { id: "lens-l", kind: "shape", shape: { type: "circle", cx: 26, cy: 29, r: 4.6 }, fill: "none", stroke: ink, strokeWidth: 1.6 },
          { id: "lens-r", kind: "shape", shape: { type: "circle", cx: 38, cy: 29, r: 4.6 }, fill: "none", stroke: ink, strokeWidth: 1.6 },
          { id: "bridge", kind: "shape", shape: { type: "path", d: "M30.6 29 H33.4" }, fill: "none", stroke: ink, strokeWidth: 1.6, lineCap: "round" },
        ],
      },
    ],
  },
};

// ─── Faces ───────────────────────────────────────────────────────────────────

const eye = (id: string, cx: number, big = false): Layer => ({
  id,
  kind: "group",
  origin: [cx, 29],
  children: [
    { id: `${id}-iris`, kind: "shape", shape: { type: "ellipse", cx, cy: 29, rx: big ? 2.9 : 2.4, ry: big ? 3.9 : 3.2 }, fill: ink },
    circle(`${id}-shine`, cx + 0.9, 27.6, big ? 1.1 : 0.9, "white"),
  ],
});
const line = (id: string, d: string, width = 1.8): Layer => ({ id, kind: "shape", shape: { type: "path", d }, fill: "none", stroke: ink, strokeWidth: width, lineCap: "round", lineJoin: "round" });
const blush: Layer[] = [
  { id: "blush-l", kind: "shape", shape: { type: "ellipse", cx: 21.5, cy: 34, rx: 2.6, ry: 1.5 }, fill: fill("blush"), opacity: 0.7 },
  { id: "blush-r", kind: "shape", shape: { type: "ellipse", cx: 42.5, cy: 34, rx: 2.6, ry: 1.5 }, fill: fill("blush"), opacity: 0.7 },
];

interface Reaction {
  label: string;
  face: Layer[];
  duration: number;
  tracks: Track[];
  markers: { id: string; at: number }[];
  sounds: SoundCue[];
  reducedMotionFrame: number;
}

function reaction(r: ChibiReaction): Reaction {
  switch (r) {
    case "happy":
      return {
        label: "smiling and bouncing",
        face: [...blush, eye("eye-l", 26), eye("eye-r", 38), line("mouth", "M29 35.5 Q32 38.5 35 35.5")],
        duration: 1000,
        markers: [{ id: "land", at: 400 }],
        tracks: [track("char", "translateY", [[0, 0, "easeOut"], [200, -3, "easeIn"], [400, 0], [1000, 0]])],
        sounds: [{ id: "land", sound: "synth:pop", marker: "land", gain: 0.8, params: { pitch: 1.2 } }],
        reducedMotionFrame: 0,
      };
    case "laughing":
      return {
        label: "laughing with eyes squeezed shut",
        face: [...blush, line("eye-l", "M23.5 30 Q26 26.5 28.5 30", 2), line("eye-r", "M35.5 30 Q38 26.5 40.5 30", 2), { id: "mouth", kind: "shape", shape: { type: "path", d: "M28.5 34.5 Q32 41.5 35.5 34.5 Z" }, fill: ink, stroke: ink, strokeWidth: 1.4, lineJoin: "round" }],
        duration: 900,
        markers: [{ id: "laugh", at: 0 }],
        tracks: [track("char", "rotate", [[0, 0, "easeInOut"], [150, -6, "easeInOut"], [300, 5, "easeInOut"], [450, -4, "easeInOut"], [600, 3, "easeInOut"], [750, 0], [900, 0]])],
        sounds: [{ id: "laugh", sound: "synth:pluck", marker: "laugh", gain: 0.7, params: { pitch: 1.5, decay: 0.5 } }],
        reducedMotionFrame: 0,
      };
    case "love":
      return {
        label: "with pulsing heart eyes",
        face: [
          ...blush,
          { id: "eye-l", kind: "shape", shape: { type: "path", d: heartPath(26, 29, 7) }, fill: fill("heart"), origin: [26, 29] },
          { id: "eye-r", kind: "shape", shape: { type: "path", d: heartPath(38, 29, 7) }, fill: fill("heart"), origin: [38, 29] },
          line("mouth", "M29 35.5 Q32 38.5 35 35.5"),
        ],
        duration: 1000,
        markers: [{ id: "beat", at: 0 }],
        tracks: [
          track("eye-l", "scale", [[0, 1, "easeOut"], [120, 1.3, "easeInOut"], [400, 1], [1000, 1]]),
          track("eye-r", "scale", [[0, 1, "easeOut"], [120, 1.3, "easeInOut"], [400, 1], [1000, 1]]),
        ],
        sounds: [{ id: "beat", sound: "synth:heartbeat", marker: "beat", gain: 0.9 }],
        reducedMotionFrame: 120,
      };
    case "sad":
      return {
        label: "sad, with a tear rolling down",
        face: [
          eye("eye-l", 26),
          eye("eye-r", 38),
          line("brow-l", "M23 25 Q25.5 23.4 28.5 24.6", 1.6),
          line("brow-r", "M41 25 Q38.5 23.4 35.5 24.6", 1.6),
          line("mouth", "M29 37.5 Q32 35 35 37.5"),
          { id: "tear", kind: "shape", shape: { type: "path", d: "M40.2 32 Q38.6 35 40.2 36.6 Q41.8 35 40.2 32 Z" }, fill: fill("tear") },
        ],
        duration: 2000,
        markers: [{ id: "sigh", at: 0 }],
        tracks: [
          track("char", "translateY", [[0, 0, "easeInOut"], [1000, 1.5, "easeInOut"], [2000, 0]]),
          track("tear", "translateY", [[0, 0], [300, 0, "easeIn"], [1100, 9], [2000, 9]]),
          track("tear", "opacity", [[0, 0, "easeOut"], [300, 1], [1000, 1, "easeIn"], [1100, 0], [2000, 0]]),
        ],
        sounds: [{ id: "sigh", sound: "synth:bell", marker: "sigh", gain: 0.5, params: { pitch: 0.5, decay: 0.8 } }],
        reducedMotionFrame: 600,
      };
    case "angry":
      return {
        label: "angry and shaking",
        face: [
          eye("eye-l", 26),
          eye("eye-r", 38),
          line("brow-l", "M23 24 L28.5 26.2", 2),
          line("brow-r", "M41 24 L35.5 26.2", 2),
          line("mouth", "M29.5 37 Q32 35.4 34.5 37"),
          { id: "vein", kind: "shape", shape: { type: "path", d: "M45 10 L47 12 M49 10 L47 12 M45 14 L47 12 M49 14 L47 12" }, fill: "none", stroke: fill("fire"), strokeWidth: 1.8, lineCap: "round", origin: [47, 12] },
        ],
        duration: 900,
        markers: [{ id: "huff", at: 0 }],
        tracks: [
          track("char", "translateX", [[0, 0], [60, -1.5], [120, 1.5], [180, -1.5], [240, 1.5], [300, -0.8], [360, 0], [900, 0]]),
          track("vein", "scale", [[0, 1, "easeOut"], [120, 1.3, "easeInOut"], [400, 1], [900, 1]]),
        ],
        sounds: [{ id: "huff", sound: "synth:kick", marker: "huff", gain: 0.8, params: { pitch: 1.3 } }],
        reducedMotionFrame: 120,
      };
    case "surprised":
      return {
        label: "surprised, with wide eyes",
        face: [eye("eye-l", 26, true), eye("eye-r", 38, true), { id: "mouth", kind: "shape", shape: { type: "ellipse", cx: 32, cy: 37, rx: 1.8, ry: 2.4 }, fill: ink, origin: [32, 37] }],
        duration: 1200,
        markers: [{ id: "gasp", at: 0 }],
        tracks: [
          track("char", "scale", [[0, 0.94, "easeOut"], [110, 1.06, "easeInOut"], [500, 1], [1200, 0.94]]),
          track("mouth", "scaleY", [[0, 0.6, "easeOut"], [120, 1.15, "easeInOut"], [600, 1], [1200, 0.6]]),
        ],
        sounds: [{ id: "gasp", sound: "synth:pop", marker: "gasp", gain: 0.8, params: { pitch: 1.4 } }],
        reducedMotionFrame: 500,
      };
  }
}

const REACTION_TITLE: Record<ChibiReaction, string> = { happy: "Happy", laughing: "Laughing", love: "In Love", sad: "Sad", angry: "Angry", surprised: "Surprised" };

export function buildChibi({ character, reaction: r }: { character: ChibiCharacter; reaction: ChibiReaction }): AssetDefinition {
  const c = CHARACTERS[character];
  const x = reaction(r);
  const body: Layer[] = [
    { id: "body", kind: "shape", shape: { type: "path", d: "M19 63 Q19 45 32 45 Q45 45 45 63 Z" }, fill: fill("outfit"), stroke: ink, strokeWidth: 2, lineJoin: "round" },
    { id: "collar", kind: "shape", shape: { type: "path", d: "M27.5 46 L32 51 L36.5 46" }, fill: "none", stroke: fill("accent"), strokeWidth: 1.8, lineCap: "round", lineJoin: "round" },
  ];
  const head: Layer = { id: "head", kind: "shape", shape: { type: "circle", cx: 32, cy: 27, r: 17 }, fill: fill("skin"), stroke: ink, strokeWidth: 2 };
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug: `chibi-${character}-${r}`,
    name: `${c.name} — ${REACTION_TITLE[r]}`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...SHARED, ...c.tokens },
    layers: [{ id: "char", kind: "group", origin: [32, 62], children: [...c.back, ...body, head, ...c.front, ...x.face, ...(c.over ?? [])] }],
    timeline: { duration: x.duration, loop: true, tracks: x.tracks, markers: x.markers },
    sounds: x.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: `${c.name}, ${c.role}, ${x.label}`, reducedMotionFrame: x.reducedMotionFrame },
    tags: ["chibi", "character", "cute", c.name.toLowerCase(), r, "original"],
    category: "characters",
    provenance: { method: "rig", rig: "moodicons-chibi@1" },
  });
}

/** Rig variant id "kai-happy" → parts. */
export function parseChibiVariant(v: string): { character: ChibiCharacter; reaction: ChibiReaction } {
  const [character, reaction] = v.split("-") as [ChibiCharacter, ChibiReaction];
  if (!CHIBI_CHARACTERS.includes(character) || !CHIBI_REACTIONS.includes(reaction)) throw new Error(`Unknown chibi variant "${v}"`);
  return { character, reaction };
}

export const CHIBI_NAMES: Record<ChibiCharacter, { name: string; role: string }> = Object.fromEntries(
  CHIBI_CHARACTERS.map((k) => [k, { name: CHARACTERS[k].name, role: CHARACTERS[k].role }]),
) as Record<ChibiCharacter, { name: string; role: string }>;
