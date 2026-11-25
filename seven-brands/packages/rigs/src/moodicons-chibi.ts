import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, heartPath, track } from "./util";

/**
 * Moodicons Chibi Cast: an international cast of ORIGINAL, cool chibi characters — each with a strong look of their own
 * (streetwear, gear, a signature accessory) — and big reactions, including a signature "cool" shades drop.
 * Every character is our own design (names, hair, outfits, colors) and must never be redrawn to resemble a character
 * from an existing anime, game or comic. All share one friendly face shape; they differ by hair, outfit and skin tone,
 * not by exaggerated features, and they are not labelled by nationality.
 * 64×64 grid: big head (r 17), small body, 2 px ink outline — matching the other Moodicons rigs.
 */

export const CHIBI_CHARACTERS = ["kai", "amara", "mateo", "tala", "priya", "lena"] as const;
export type ChibiCharacter = (typeof CHIBI_CHARACTERS)[number];
export const CHIBI_REACTIONS = ["cool", "happy", "laughing", "love", "sad", "angry", "surprised"] as const;
export type ChibiReaction = (typeof CHIBI_REACTIONS)[number];
export const CHIBI_VARIANTS = CHIBI_CHARACTERS.flatMap((c) => CHIBI_REACTIONS.map((r) => `${c}-${r}`));

const SHARED = { ink: "#2B1B12", white: "#FFFFFF", blush: "#FF8FA3", heart: "#E8336D", tear: "#4FC3F7", fire: "#FF5A36" };

interface Character {
  name: string;
  role: string;
  tokens: { skin: string; hair: string; outfit: string; accent: string; gear: string };
  back: Layer[];
  /** Outfit and anything worn around the neck. */
  body: Layer[];
  front: Layer[];
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

/** Shared chibi torso (shoulders at y 45). */
const TORSO = "M19 63 Q19 45 32 45 Q45 45 45 63 Z";
const torso = (token: string): Layer => shape("body", TORSO, token);

const CHARACTERS: Record<ChibiCharacter, Character> = {
  kai: {
    name: "Kai",
    role: "the street skater in a backwards cap",
    tokens: { skin: "#F2C8A0", hair: "#1C2541", outfit: "#2F2F3A", accent: "#C6FF00", gear: "#E53935" },
    back: [
      { id: "tuft-l", kind: "shape", shape: { type: "polygon", points: "15.5 31 9 28 14 25.5 8.5 21 15.5 20" }, fill: fill("hair"), stroke: ink, strokeWidth: 2, lineJoin: "round" },
      { id: "tuft-r", kind: "shape", shape: { type: "polygon", points: "48.5 31 55 28 50 25.5 55.5 21 48.5 20" }, fill: fill("hair"), stroke: ink, strokeWidth: 2, lineJoin: "round" },
    ],
    body: [
      torso("outfit"),
      strokeOnly("hood", "M22 47.5 Q32 53 42 47.5", "accent", 2.2),
      strokeOnly("string-l", "M28.5 51 V57", "white", 1.4),
      strokeOnly("string-r", "M35.5 51 V57", "white", 1.4),
    ],
    front: [
      shape("fringe", "M16 21 L48 21 L46.5 24.5 L42.5 21.5 L39.5 25.5 L35.5 21.5 L32 25.5 L28.5 21.5 L24.5 25.5 L21.5 21.5 L17.5 24.5 Z", "hair"),
      shape("cap", "M14.5 21.5 Q14 6.5 32 6.5 Q50 6.5 49.5 21.5 Z", "gear"),
      shape("brim", "M15.5 15 Q8 14 5.5 18 Q9 20.5 15 20", "gear"),
      strokeOnly("cap-band", "M15 19.5 Q32 16 49 19.5", "accent", 2),
      circle("cap-button", 32, 7.2, 1.6, "accent", true),
    ],
  },
  amara: {
    name: "Amara",
    role: "the DJ with a high puff and headphones",
    tokens: { skin: "#8D5524", hair: "#1F1410", outfit: "#7B2FBE", accent: "#FFB300", gear: "#26C6DA" },
    back: [circle("puff", 32, 10.5, 9.5, "hair", true)],
    body: [
      torso("outfit"),
      strokeOnly("collar", "M23 47 Q32 51.5 41 47", "accent", 2.4),
      strokeOnly("zip", "M32 50 V63", "accent", 1.4),
      strokeOnly("phones-band", "M20.5 49.5 Q32 59 43.5 49.5", "ink", 2.4),
      { id: "cup-l", kind: "shape", shape: { type: "rect", x: 16.5, y: 45.5, width: 6, height: 7.5, rx: 2.5 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.8 },
      { id: "cup-r", kind: "shape", shape: { type: "rect", x: 41.5, y: 45.5, width: 6, height: 7.5, rx: 2.5 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.8 },
    ],
    front: [
      shape("hairline", "M15 25 Q14 11 32 11 Q50 11 49 25 Q44 18 32 18 Q20 18 15 25 Z", "hair"),
      strokeOnly("headwrap", "M18.5 15.5 Q32 9.5 45.5 15.5", "accent", 2.6),
      { id: "hoop-l", kind: "shape", shape: { type: "circle", cx: 15.4, cy: 35, r: 2.2 }, fill: "none", stroke: fill("accent"), strokeWidth: 1.5 },
      { id: "hoop-r", kind: "shape", shape: { type: "circle", cx: 48.6, cy: 35, r: 2.2 }, fill: "none", stroke: fill("accent"), strokeWidth: 1.5 },
    ],
  },
  mateo: {
    name: "Mateo",
    role: "the street footballer with a curly top and sweatband",
    tokens: { skin: "#C68642", hair: "#2B1A10", outfit: "#1565C0", accent: "#FFFFFF", gear: "#FF3D00" },
    back: [],
    body: [torso("outfit"), strokeOnly("stripe-l", "M26.5 50 V63", "accent", 2), strokeOnly("stripe-r", "M37.5 50 V63", "accent", 2), strokeOnly("collar", "M27 46 Q32 49 37 46", "gear", 2)],
    front: [
      { id: "fade-l", kind: "shape", shape: { type: "path", d: "M15.3 28 Q15 19 20 15 L21 24 Z" }, fill: fill("hair"), opacity: 0.45 },
      { id: "fade-r", kind: "shape", shape: { type: "path", d: "M48.7 28 Q49 19 44 15 L43 24 Z" }, fill: fill("hair"), opacity: 0.45 },
      {
        id: "curls",
        kind: "group",
        children: [
          circle("curl-1", 22, 15, 4.8, "hair", true),
          circle("curl-2", 27, 10.5, 5.2, "hair", true),
          circle("curl-3", 32.5, 8.5, 5.4, "hair", true),
          circle("curl-4", 38, 10.5, 5.2, "hair", true),
          circle("curl-5", 42.5, 15, 4.8, "hair", true),
          circle("curl-6", 32, 15, 6.5, "hair"),
        ],
      },
      { id: "sweatband", kind: "shape", shape: { type: "path", d: "M16.6 21 Q32 15.5 47.4 21 L47.9 24.4 Q32 19 16.1 24.4 Z" }, fill: fill("gear"), stroke: ink, strokeWidth: 1.6, lineJoin: "round" },
    ],
  },
  tala: {
    name: "Tala",
    role: "the surfer with an ocean-blue streak and a hibiscus",
    tokens: { skin: "#D8A47F", hair: "#141414", outfit: "#FF7043", accent: "#00BFA5", gear: "#FFFFFF" },
    back: [shape("hair-back", "M11 27 Q10 8 32 8 Q54 8 53 27 Q56 38 52 46 Q55 50 50 53 Q46 50 46 44 L45 32 L19 32 L18 44 Q18 50 14 53 Q9 50 12 46 Q8 38 11 27 Z", "hair")],
    body: [
      torso("outfit"),
      strokeOnly("wave", "M21.5 57 Q24.5 54 27.5 57 T33.5 57 T39.5 57 T45 56.5", "gear", 1.6),
      circle("shell-1", 28.5, 48.6, 1.3, "gear", true),
      circle("shell-2", 32, 50, 1.5, "gear", true),
      circle("shell-3", 35.5, 48.6, 1.3, "gear", true),
    ],
    front: [
      shape("hair-front", "M15 25 Q15 10 32 10 Q49 10 49 25 Q44 15 30 17 Q22 18 15 25 Z", "hair"),
      strokeOnly("streak", "M27 11.5 Q20 14.5 16.8 22", "accent", 2.6),
      {
        id: "hibiscus",
        kind: "group",
        origin: [46.5, 16],
        children: [
          circle("petal-1", 46.5, 12.6, 2.4, "gear", true),
          circle("petal-2", 49.7, 15, 2.4, "gear", true),
          circle("petal-3", 48.5, 18.8, 2.4, "gear", true),
          circle("petal-4", 44.5, 18.8, 2.4, "gear", true),
          circle("petal-5", 43.3, 15, 2.4, "gear", true),
          circle("hibiscus-center", 46.5, 16, 1.6, "outfit"),
        ],
      },
    ],
  },
  priya: {
    name: "Priya",
    role: "the gamer with a neon streak and headset",
    tokens: { skin: "#B5753F", hair: "#1E1410", outfit: "#263238", accent: "#00E5A0", gear: "#FF4FA3" },
    back: [
      shape("hair-back", "M12 27 Q12 7 32 7 Q52 7 52 27 L52 47 Q47 50 45 45 L45 30 L19 30 L19 45 Q17 50 12 47 Z", "hair"),
    ],
    body: [torso("outfit"), strokeOnly("hood", "M22 47.5 Q32 53 42 47.5", "accent", 2), { id: "logo", kind: "shape", shape: { type: "polygon", points: "32 53 35.5 56 32 59 28.5 56" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" }],
    front: [
      shape("hair-front", "M15 24 Q16 10 32 10 Q48 10 49 24 Q44 14 32 15 Q20 14 15 24 Z", "hair"),
      strokeOnly("streak", "M38 11 Q45 13.5 47.5 21", "gear", 2.6),
      strokeOnly("headset-band", "M13.5 25 Q13 5 32 5 Q51 5 50.5 25", "ink", 2.6),
      { id: "cup-l", kind: "shape", shape: { type: "rect", x: 10, y: 22, width: 6.5, height: 10, rx: 3 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.8 },
      { id: "cup-r", kind: "shape", shape: { type: "rect", x: 47.5, y: 22, width: 6.5, height: 10, rx: 3 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.8 },
      strokeOnly("mic", "M13 31 Q14 39.5 22.5 39.5", "ink", 1.6),
      circle("mic-tip", 23, 39.5, 1.6, "gear", true),
    ],
  },
  lena: {
    name: "Lena",
    role: "the inventor with a messy bob and goggles",
    tokens: { skin: "#F1C7A4", hair: "#C8501E", outfit: "#7B5CD6", accent: "#80DEEA", gear: "#FFFFFF" },
    back: [
      shape("hair-back", "M12 30 Q11 8 32 8 Q53 8 52 30 Q52 39 47 39 L47 27 L17 27 L17 39 Q12 39 12 30 Z", "hair"),
      shape("cowlick", "M34 9 Q36 2 41 3 Q37 5 38 9.5", "hair"),
    ],
    body: [torso("gear"), shape("shirt", "M27.5 45.6 L32 54 L36.5 45.6 Q32 44.8 27.5 45.6 Z", "outfit", { strokeWidth: 1.4 }), strokeOnly("lapel-l", "M26 46.5 L30.5 58", "ink", 1.2), strokeOnly("lapel-r", "M38 46.5 L33.5 58", "ink", 1.2), strokeOnly("pen", "M39.5 53 V57.5", "accent", 1.6)],
    front: [
      shape("hair-front", "M15 22 Q15 9 32 9 Q49 9 49 22 L45 18 L40 21.5 L35 17.5 L29 21.5 L23 17.5 L19 21.5 Z", "hair"),
      strokeOnly("goggle-strap", "M15.3 20.5 Q32 14.5 48.7 20.5", "ink", 2.2),
      {
        id: "goggles",
        kind: "group",
        children: [
          { id: "goggle-l", kind: "shape", shape: { type: "circle", cx: 26.5, cy: 17.5, r: 4.3 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.8 },
          { id: "goggle-r", kind: "shape", shape: { type: "circle", cx: 37.5, cy: 17.5, r: 4.3 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.8 },
          circle("goggle-shine-l", 25, 16, 1.1, "white"),
          circle("goggle-shine-r", 36, 16, 1.1, "white"),
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
    case "cool":
      return {
        label: "dropping on sunglasses with a smirk",
        face: [
          eye("eye-l", 26),
          eye("eye-r", 38),
          line("mouth", "M29 36.6 Q32.5 38.4 35.6 35.4"),
          {
            id: "shades",
            kind: "group",
            origin: [32, 29],
            children: [
              { id: "shade-l", kind: "shape", shape: { type: "path", d: "M19.5 26 H30.5 Q30.5 33.5 25 33.5 Q19.5 33.5 19.5 26 Z" }, fill: ink, stroke: ink, strokeWidth: 1.4, lineJoin: "round" },
              { id: "shade-r", kind: "shape", shape: { type: "path", d: "M33.5 26 H44.5 Q44.5 33.5 39 33.5 Q33.5 33.5 33.5 26 Z" }, fill: ink, stroke: ink, strokeWidth: 1.4, lineJoin: "round" },
              line("shade-bar", "M17 26.2 H47", 1.8),
              line("shade-shine-l", "M21.8 28 L24 30.4", 1.2),
              line("shade-shine-r", "M35.8 28 L38 30.4", 1.2),
            ],
          },
          { id: "glint", kind: "shape", shape: { type: "path", d: "M46 23 L47 26 L50 27 L47 28 L46 31 L45 28 L42 27 L45 26 Z" }, fill: fill("white"), stroke: ink, strokeWidth: 0.8, origin: [46, 27] },
        ],
        duration: 1800,
        markers: [{ id: "drop", at: 0 }, { id: "shing", at: 380 }],
        tracks: [
          track("shades", "translateY", [[0, -16, "easeOut"], [320, 1, "easeInOut"], [420, 0], [1500, 0, "easeIn"], [1800, -16]]),
          track("shades", "opacity", [[0, 0, "easeOut"], [120, 1], [1600, 1, "easeIn"], [1800, 0]]),
          track("glint", "opacity", [[0, 0], [380, 0, "easeOut"], [460, 1, "easeIn"], [760, 0], [1800, 0]]),
          track("glint", "scale", [[0, 0.4], [380, 0.4, "easeOut"], [520, 1.2, "easeIn"], [760, 0.4], [1800, 0.4]]),
          track("char", "rotate", [[0, 0], [380, 0, "easeOut"], [520, -3, "easeInOut"], [900, 0], [1800, 0]]),
        ],
        sounds: [
          { id: "drop", sound: "synth:whoosh", marker: "drop", gain: 0.6, params: { pitch: 1.4 } },
          { id: "shing", sound: "synth:chime", marker: "shing", gain: 0.7, params: { pitch: 1.6 }, panFrom: "glint" },
        ],
        reducedMotionFrame: 600,
      };
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

const REACTION_TITLE: Record<ChibiReaction, string> = { cool: "Cool", happy: "Happy", laughing: "Laughing", love: "In Love", sad: "Sad", angry: "Angry", surprised: "Surprised" };

export function buildChibi({ character, reaction: r }: { character: ChibiCharacter; reaction: ChibiReaction }): AssetDefinition {
  const c = CHARACTERS[character];
  const x = reaction(r);
  const head: Layer = { id: "head", kind: "shape", shape: { type: "circle", cx: 32, cy: 27, r: 17 }, fill: fill("skin"), stroke: ink, strokeWidth: 2 };
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug: `chibi-${character}-${r}`,
    name: `${c.name} — ${REACTION_TITLE[r]}`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...SHARED, ...c.tokens },
    layers: [{ id: "char", kind: "group", origin: [32, 62], children: [...c.back, ...c.body, head, ...c.front, ...x.face] }],
    timeline: { duration: x.duration, loop: true, tracks: x.tracks, markers: x.markers },
    sounds: x.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: `${c.name}, ${c.role}, ${x.label}`, reducedMotionFrame: x.reducedMotionFrame },
    tags: ["chibi", "character", "cool", c.name.toLowerCase(), r, "original"],
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
