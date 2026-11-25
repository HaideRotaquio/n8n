import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, heartPath, track } from "./util";

/**
 * Crews are built on anime GENRES (sky pirates, shinobi), never on specific characters: each one's silhouette, colors and
 * signature item must not match a character from an existing series — see the "never" list above each crew.
 * Moodicons Chibi Cast: an international cast of ORIGINAL, cool chibi characters — each with a strong look of their own
 * (streetwear, gear, a signature accessory) — and big reactions, including a signature "cool" shades drop.
 * Every character is our own design (names, hair, outfits, colors) and must never be redrawn to resemble a character
 * from an existing anime, game or comic. All share one friendly face shape; they differ by hair, outfit and skin tone,
 * not by exaggerated features, and they are not labelled by nationality.
 * 64×64 grid: big head (r 17), small body, 2 px ink outline — matching the other Moodicons rigs.
 */

export const CHIBI_CREWS = ["street", "sky-pirates", "shinobi", "blade-hunters", "guild"] as const;
export type ChibiCrew = (typeof CHIBI_CREWS)[number];
export const CHIBI_CREW_TITLES: Record<ChibiCrew, string> = { street: "Street Crew", "sky-pirates": "Sky Pirates", shinobi: "Shinobi Crew", "blade-hunters": "Blade Hunters", guild: "Adventurers' Guild" };
export const CHIBI_CHARACTERS = ["kai", "amara", "mateo", "tala", "priya", "lena", "rook", "isla", "bo", "juno", "rina", "taro", "noor", "bram", "lio", "vera", "sage", "brix", "pip", "mira", "ezra", "kofi"] as const;
export type ChibiCharacter = (typeof CHIBI_CHARACTERS)[number];
export const CHIBI_REACTIONS = ["cool", "powerup", "happy", "laughing", "love", "sad", "angry", "surprised"] as const;
export type ChibiReaction = (typeof CHIBI_REACTIONS)[number];
export const CHIBI_VARIANTS = CHIBI_CHARACTERS.flatMap((c) => CHIBI_REACTIONS.map((r) => `${c}-${r}`));

const SHARED = { ink: "#2B1B12", white: "#FFFFFF", blush: "#FF8FA3", heart: "#E8336D", tear: "#4FC3F7", fire: "#FF5A36", aura: "#FFC940", auraCore: "#FFF3B0" };

interface Character {
  name: string;
  crew: ChibiCrew;
  role: string;
  tokens: { skin: string; hair: string; outfit: string; accent: string; gear: string } & Record<string, string>;
  back: Layer[];
  /** Outfit and anything worn around the neck. */
  body: Layer[];
  front: Layer[];
  /** Drawn over the face (monocles, glasses). */
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

/** Shared chibi torso (shoulders at y 45). */
const TORSO = "M19 63 Q19 45 32 45 Q45 45 45 63 Z";
const torso = (token: string): Layer => shape("body", TORSO, token);

const CHARACTERS: Record<ChibiCharacter, Character> = {
  kai: {
    name: "Kai",
    crew: "street",
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
    crew: "street",
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
    crew: "street",
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
    crew: "street",
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
    crew: "street",
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
    crew: "street",
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
  // ─── Sky Pirates ── original crew; never a straw hat, scar under the eye, three swords or a long nose ───
  rook: {
    name: "Rook",
    crew: "sky-pirates",
    role: "the sky-pirate captain in a tricorne and long coat",
    tokens: { skin: "#C9895B", hair: "#EDE6D6", outfit: "#8E1B3A", accent: "#E0B84C", gear: "#1E4D5C" },
    back: [],
    body: [
      torso("outfit"),
      shape("cravat", "M28.5 45.6 L32 51 L35.5 45.6 Q32 44.8 28.5 45.6 Z", "white", { strokeWidth: 1.4 }),
      strokeOnly("lapel-l", "M24.5 47 L29.5 63", "accent", 1.6),
      strokeOnly("lapel-r", "M39.5 47 L34.5 63", "accent", 1.6),
      circle("button-1", 32, 55, 1.3, "accent", true),
      circle("button-2", 32, 60, 1.3, "accent", true),
    ],
    front: [
      shape("sideburn-l", "M15.6 20 Q14.6 27 16.6 31.5 L19.5 22 Z", "hair"),
      shape("sideburn-r", "M48.4 20 Q49.4 27 47.4 31.5 L44.5 22 Z", "hair"),
      shape("feather", "M41 10 Q49 -0.5 59 1.5 Q53 3.5 51 7 Q48 9.5 44 11.5 Z", "white", { strokeWidth: 1.4 }),
      shape("tricorne", "M7 17.5 Q14 22 32 20 Q50 22 57 17.5 Q53 6.5 44.5 9.5 Q38.5 2 32 2.5 Q25.5 2 19.5 9.5 Q11 6.5 7 17.5 Z", "gear"),
      strokeOnly("hat-trim", "M8.5 17 Q15 20.8 32 19 Q49 20.8 55.5 17", "accent", 1.8),
      { id: "hat-badge", kind: "shape", shape: { type: "polygon", points: "32 7.5 33.3 10.7 36.5 12 33.3 13.3 32 16.5 30.7 13.3 27.5 12 30.7 10.7" }, fill: fill("accent"), stroke: ink, strokeWidth: 1, lineJoin: "round" },
    ],
  },
  isla: {
    name: "Isla",
    crew: "sky-pirates",
    role: "the sky navigator in a leather flight cap and red scarf",
    tokens: { skin: "#E0AC80", hair: "#3D2A5C", outfit: "#2C3E73", accent: "#D7263D", gear: "#7A4A2A" },
    back: [shape("scarf-tail", "M40 46 Q50 43 59 48.5 Q56 52 51 51 Q46 50.5 41 51 Z", "accent")],
    body: [
      torso("outfit"),
      strokeOnly("scarf", "M21.5 46.5 Q32 52 42.5 46.5", "accent", 3.6),
      circle("compass", 32, 56.5, 3, "gear", true),
      strokeOnly("compass-needle", "M32 54.6 V58.4", "accent", 1.2),
    ],
    front: [
      shape("fringe", "M19 16.5 Q23 23.5 27.5 17 Q31.5 23.5 36 17 Q40.5 23.5 45 16.5 Z", "hair", { strokeWidth: 1.6 }),
      shape("flight-cap", "M14.5 23 Q14 7.5 32 7.5 Q50 7.5 49.5 23 Q45 16 32 16 Q19 16 14.5 23 Z", "gear"),
      strokeOnly("cap-seam", "M32 8.5 V15.5", "ink", 1.2),
      { id: "flap-l", kind: "shape", shape: { type: "rect", x: 12.6, y: 20, width: 5.4, height: 13, rx: 2.4 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.8 },
      { id: "flap-r", kind: "shape", shape: { type: "rect", x: 46, y: 20, width: 5.4, height: 13, rx: 2.4 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.8 },
    ],
  },
  bo: {
    name: "Bo",
    crew: "sky-pirates",
    role: "the airship mechanic in a polka-dot bandana and overalls",
    tokens: { skin: "#9C6B43", hair: "#4A2C17", outfit: "#F57C00", accent: "#FFD23F", gear: "#E9E2D0" },
    back: [],
    body: [
      torso("gear"),
      shape("bib", "M24.5 51 H39.5 V63 H24.5 Z", "outfit", { strokeWidth: 1.6 }),
      strokeOnly("strap-l", "M25.5 51 L23.5 46.5", "outfit", 2.2),
      strokeOnly("strap-r", "M38.5 51 L40.5 46.5", "outfit", 2.2),
      circle("bolt-l", 26.5, 53, 1.1, "accent", true),
      circle("bolt-r", 37.5, 53, 1.1, "accent", true),
    ],
    front: [
      shape("tuft-l", "M15.3 21.5 Q14.4 27.5 16.2 31 L18.8 22.5 Z", "hair"),
      shape("tuft-r", "M48.7 21.5 Q49.6 27.5 47.8 31 L45.2 22.5 Z", "hair"),
      shape("bandana-knot", "M47 17 L55.5 12.5 L54 18.5 L57 23.5 L48.5 21.5 Z", "accent"),
      shape("bandana", "M14.5 23 Q14 9 32 9 Q50 9 49.5 23 Q40.5 17.5 32 17.5 Q23.5 17.5 14.5 23 Z", "accent"),
      circle("dot-1", 23.5, 15, 1.1, "white"),
      circle("dot-2", 32, 12.5, 1.1, "white"),
      circle("dot-3", 40.5, 15, 1.1, "white"),
      { id: "freckles", kind: "shape", shape: { type: "path", d: "M19.5 31.2 h0.01 M21.4 32.2 h0.01 M23.3 31.2 h0.01 M40.7 31.2 h0.01 M42.6 32.2 h0.01 M44.5 31.2 h0.01" }, fill: "none", stroke: fill("hair"), strokeWidth: 1.2, lineCap: "round", opacity: 0.6 },
    ],
  },
  juno: {
    name: "Juno",
    crew: "sky-pirates",
    role: "the lookout in a headscarf, hoop earring and sailor stripes",
    tokens: { skin: "#6B4226", hair: "#1A1A1A", outfit: "#00897B", accent: "#1A237E", gear: "#FFFFFF", trim: "#E0B84C" },
    back: [shape("scarf-tails", "M15 24 Q6 29 8.5 38.5 Q11 33.5 16.5 30.5 Z", "outfit")],
    body: [torso("gear"), strokeOnly("stripe-1", "M23 50 H41", "accent", 2), strokeOnly("stripe-2", "M21 55 H43", "accent", 2), strokeOnly("stripe-3", "M20 60 H44", "accent", 2)],
    front: [
      circle("curl-l", 15.8, 25, 3.6, "hair", true),
      circle("curl-r", 48.2, 25, 3.6, "hair", true),
      shape("headscarf", "M14.5 22.5 Q14 8 32 8 Q50 8 49.5 22.5 Q41 15.5 32 16 Q23 15.5 14.5 22.5 Z", "outfit"),
      strokeOnly("scarf-edge", "M17 19 Q32 11.5 47 19", "gear", 1.2),
      { id: "hoop", kind: "shape", shape: { type: "circle", cx: 48.4, cy: 36, r: 3 }, fill: "none", stroke: fill("trim"), strokeWidth: 1.6 },
    ],
  },
  // ─── Shinobi crew ── original crew; never whisker marks, orange jumpsuits, metal-plated headbands or face masks ───
  rina: {
    name: "Rina",
    crew: "shinobi",
    role: "the smoke-bomb trickster in a tied hood",
    tokens: { skin: "#F0C9A5", hair: "#5FD3B5", outfit: "#33334D", accent: "#E53950", gear: "#FFB74D" },
    back: [
      shape("hood-tail", "M45 11 Q53.5 4 60 9.5 Q55 11 53.5 15.5 Q50 13.5 47.5 16 Z", "outfit"),
      shape("hood", "M10.5 32 Q9.5 6 32 6 Q54.5 6 53.5 32 Q53.5 42 46 44 L18 44 Q10.5 42 10.5 32 Z", "outfit"),
    ],
    body: [
      torso("outfit"),
      strokeOnly("neck-wrap", "M21.5 46.5 Q32 52 42.5 46.5", "accent", 3.6),
      circle("smoke-bomb", 39.5, 57.5, 3, "ink"),
      strokeOnly("fuse", "M41.5 55.2 Q43 53 44.8 53.4", "gear", 1.4),
    ],
    front: [
      shape("fringe", "M20 17 Q23.5 24.5 27.5 18.5 Q30.5 23.5 34 18 L34 16 L20 16 Z", "hair", { strokeWidth: 1.6 }),
      shape("hood-rim", "M15 24 Q15 9 32 9 Q49 9 49 24 Q44 16.5 32 16.5 Q20 16.5 15 24 Z", "outfit"),
    ],
  },
  taro: {
    name: "Taro",
    crew: "shinobi",
    role: "the throwing-star prodigy with a long mustard scarf",
    tokens: { skin: "#D9A27A", hair: "#2E5E4E", outfit: "#2E3B4E", accent: "#E8A33D", gear: "#E9E2D0" },
    back: [shape("hair-back", "M14 28 Q12 8 32 8 Q52 8 50 28 Z", "hair"), shape("scarf-tail", "M41 46.5 Q52 45 59.5 51.5 Q55.5 55 50.5 53 Q46 51 41 51.5 Z", "accent")],
    body: [
      torso("outfit"),
      strokeOnly("scarf", "M21.5 46.5 Q32 52 42.5 46.5", "accent", 4),
      { id: "emblem", kind: "shape", shape: { type: "polygon", points: "32 52 33.4 55.6 37 57 33.4 58.4 32 62 30.6 58.4 27 57 30.6 55.6" }, fill: fill("gear"), stroke: ink, strokeWidth: 1, lineJoin: "round" },
    ],
    front: [
      shape("hair-front", "M15 25 Q13 9 32 9 Q50 9 49 22 Q46 16.5 40.5 17.5 Q36.5 13.5 30.5 19.5 Q26.5 14.5 22 20.5 Q18.5 18.5 15 25 Z", "hair"),
      { id: "cheek-plaster", kind: "shape", shape: { type: "path", d: "M41.6 37.2 L45.8 35.2 L46.8 37.2 L42.6 39.2 Z" }, fill: fill("gear"), stroke: ink, strokeWidth: 1, lineJoin: "round" },
    ],
  },
  noor: {
    name: "Noor",
    crew: "shinobi",
    role: "the scroll-keeper with a high bun and hair sticks",
    tokens: { skin: "#C48A5C", hair: "#1B1B2F", outfit: "#00695C", accent: "#9C6ADE", gear: "#F3E5C0", wood: "#B5835A" },
    back: [
      shape("scroll", "M40 41 L49.5 37 L56.5 52 L47 56 Z", "gear"),
      strokeOnly("scroll-end", "M48.5 36.2 L50.6 37.8", "wood", 3),
      strokeOnly("stick-1", "M25 1.5 L37 12.5", "wood", 1.8),
      strokeOnly("stick-2", "M39 1.5 L27 12.5", "wood", 1.8),
      circle("bun", 32, 7.5, 6, "hair", true),
    ],
    body: [torso("outfit"), strokeOnly("sash", "M19.6 56 Q32 59 44.4 56", "accent", 3), strokeOnly("collar-l", "M26.5 45.6 L33.5 54", "gear", 1.8), strokeOnly("collar-r", "M37.5 45.6 L32 51.5", "gear", 1.8)],
    front: [
      strokeOnly("lock-l", "M16.5 23 Q15 31.5 17.5 39", "hair", 3),
      strokeOnly("lock-r", "M47.5 23 Q49 31.5 46.5 39", "hair", 3),
      shape("hair-front", "M15 25 Q15 10 32 10 Q49 10 49 25 Q41 16 32 17 Q23 16 15 25 Z", "hair"),
    ],
  },
  bram: {
    name: "Bram",
    crew: "shinobi",
    role: "the wandering mentor in a woven travel hat and prayer beads",
    tokens: { skin: "#E8B98F", hair: "#9E9E9E", outfit: "#283593", accent: "#8D6E63", gear: "#D8B26E" },
    back: [],
    body: [
      torso("outfit"),
      strokeOnly("collar-l", "M26 45.6 L34 56", "white", 2),
      strokeOnly("collar-r", "M38 45.6 L32 53", "white", 2),
      ...[22.5, 26.5, 30.5, 34.5, 38.5, 42].map((x, i) => circle(`bead-${i + 1}`, x, 50.6 - Math.abs(32.2 - x) * 0.25, 1.5, "accent", true)),
    ],
    front: [
      shape("side-hair-l", "M15.4 19 Q14.5 26 16.4 30 L19.2 21 Z", "hair"),
      shape("side-hair-r", "M48.6 19 Q49.5 26 47.6 30 L44.8 21 Z", "hair"),
      shape("travel-hat", "M3.5 18.5 L32 2.5 L60.5 18.5 Q32 23 3.5 18.5 Z", "gear"),
      strokeOnly("weave-1", "M17.5 11 L20 20", "ink", 0.8),
      strokeOnly("weave-2", "M24.5 7 L26 21", "ink", 0.8),
      strokeOnly("weave-3", "M39.5 7 L38 21", "ink", 0.8),
      strokeOnly("weave-4", "M46.5 11 L44 20", "ink", 0.8),
    ],
  },
  // ─── Blade Hunters ── original crew; never checkered/patterned haori, boar masks, symbol earrings, forehead scars,
  //     elemental "breathing" themes (fire, water, thunder…), butterfly ornaments or kanji-marked uniforms ───
  lio: {
    name: "Lio",
    crew: "blade-hunters",
    role: "the rookie night hunter with a glowing lantern",
    tokens: { skin: "#EFC39B", hair: "#C8A26B", outfit: "#6D4C3D", accent: "#FFB300", gear: "#3E4A59" },
    back: [shape("hair-back", "M14 28 Q12 8 32 8 Q52 8 50 28 Z", "hair")],
    body: [
      torso("gear"),
      shape("vest-l", "M19.6 60 Q19.5 46 27 45.6 L29 63 L19.4 63 Z", "outfit", { strokeWidth: 1.8 }),
      shape("vest-r", "M44.4 60 Q44.5 46 37 45.6 L35 63 L44.6 63 Z", "outfit", { strokeWidth: 1.8 }),
      strokeOnly("lantern-strap", "M27 46.5 L36 52", "ink", 1.3),
      { id: "lantern-cap", kind: "shape", shape: { type: "rect", x: 34, y: 50.6, width: 6, height: 2.2, rx: 0.8 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.2 },
      { id: "lantern", kind: "shape", shape: { type: "rect", x: 33.5, y: 52.6, width: 7, height: 8, rx: 2 }, fill: fill("accent"), stroke: ink, strokeWidth: 1.6 },
      strokeOnly("lantern-flame", "M37 55 V58", "white", 1.4),
    ],
    front: [shape("hair-front", "M15 24 Q14 9 32 9 Q50 9 49 24 Q46 17 41 18 Q38 14 33 18.5 Q29 14 25 18.5 Q20 16 15 24 Z", "hair")],
  },
  vera: {
    name: "Vera",
    crew: "blade-hunters",
    role: "the swift duelist with a crescent-moon hairpin",
    tokens: { skin: "#D7A07C", hair: "#B8C7E0", outfit: "#4A2E6B", accent: "#FFD54F", gear: "#8A8F99", trim: "#C9A227" },
    back: [
      strokeOnly("grip-outline", "M18 47 L8.5 35", "ink", 4.8),
      strokeOnly("grip", "M18 47 L8.5 35", "gear", 2.6),
      strokeOnly("crossguard", "M10.2 42.4 L16.4 37.6", "trim", 2.6),
      shape("hair-back", "M13 30 Q11 8 32 8 Q53 8 51 30 L47 30 L47 20 L17 20 L17 36 Q13.5 37 13 30 Z", "hair"),
    ],
    body: [
      torso("outfit"),
      shape("high-collar", "M22 47.5 L23.5 43.5 Q32 46.5 40.5 43.5 L42 47.5 Q32 51 22 47.5 Z", "outfit", { strokeWidth: 1.6 }),
      circle("clasp-1", 32, 53.5, 1.3, "trim", true),
      circle("clasp-2", 32, 58.5, 1.3, "trim", true),
    ],
    front: [
      shape("hair-front", "M15 27 Q13 9 32 9 Q50 9 49 21 Q40 14 30 16.5 Q20 18.5 15 27 Z", "hair"),
      { id: "moon-pin", kind: "shape", shape: { type: "path", d: "M41.5 10 Q51 12.5 44 20 Q46.6 14 41.5 10 Z" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
    ],
  },
  sage: {
    name: "Sage",
    crew: "blade-hunters",
    role: "the calm herbal healer in a leaf headwrap",
    tokens: { skin: "#A86B45", hair: "#3B2A20", outfit: "#EFE6D2", accent: "#4CAF7A", gear: "#8D6E4A" },
    back: [shape("hair-back", "M13 28 Q12 9 32 9 Q52 9 51 28 L50.5 40 Q46.5 42.5 45 38 L45 30 L19 30 L19 38 Q17.5 42.5 13.5 40 Z", "hair")],
    body: [
      torso("outfit"),
      strokeOnly("sash", "M19.6 55.5 Q32 58.5 44.4 55.5", "accent", 3),
      { id: "pouch", kind: "shape", shape: { type: "rect", x: 35.5, y: 56.5, width: 7, height: 6, rx: 1.6 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.4 },
      { id: "pouch-leaf", kind: "shape", shape: { type: "path", d: "M39 57.6 Q41.4 59.4 39 61.4 Q36.6 59.4 39 57.6 Z" }, fill: fill("accent") },
    ],
    front: [
      shape("fringe", "M20 19.5 Q26 23 31 18 L31 16.5 L21 17 Z", "hair", { strokeWidth: 1.6 }),
      shape("headwrap", "M14.5 22 Q14 8 32 8 Q50 8 49.5 22 Q41 16 32 16.5 Q23 16 14.5 22 Z", "accent"),
      { id: "wrap-leaf", kind: "shape", shape: { type: "path", d: "M32 9.6 Q36.2 12.2 32 15.4 Q27.8 12.2 32 9.6 Z" }, fill: fill("white"), stroke: ink, strokeWidth: 1, lineJoin: "round" },
    ],
  },
  brix: {
    name: "Brix",
    crew: "blade-hunters",
    role: "the heavy-armored hunter with a mohawk",
    tokens: { skin: "#7A4B2E", hair: "#1A1A1A", outfit: "#5D4037", accent: "#B0BEC5", gear: "#D84315" },
    back: [],
    body: [
      torso("outfit"),
      strokeOnly("strap", "M27 46.5 L42 62", "gear", 2.6),
      shape("pauldron", "M17 53 Q15.5 44 24.5 44 Q28.5 46 28 51.5 Q22 49.5 17 53 Z", "accent"),
      circle("rivet-1", 21, 48, 0.9, "ink"),
      circle("rivet-2", 25, 47, 0.9, "ink"),
    ],
    front: [
      { id: "fade-l", kind: "shape", shape: { type: "path", d: "M15.3 28 Q15 19 20 14.5 L22 23 Z" }, fill: fill("hair"), opacity: 0.4 },
      { id: "fade-r", kind: "shape", shape: { type: "path", d: "M48.7 28 Q49 19 44 14.5 L42 23 Z" }, fill: fill("hair"), opacity: 0.4 },
      { id: "stubble", kind: "shape", shape: { type: "path", d: "M18.5 33 Q20 44 32 44 Q44 44 45.5 33 Q44 40.5 32 41 Q20 40.5 18.5 33 Z" }, fill: fill("hair"), opacity: 0.35 },
      shape("mohawk", "M27 14.5 Q25.5 4 32 1.5 Q38.5 4 37 14.5 Q32 12 27 14.5 Z", "hair"),
    ],
  },
  // ─── Adventurers' Guild ── original crew; never playing cards, fishing rods, yo-yos, skateboards, chains,
  //     licence cards or a spiky-haired boy in a green jacket ───
  pip: {
    name: "Pip",
    crew: "guild",
    role: "the trail tracker in a bush hat with binoculars",
    tokens: { skin: "#F3CFB3", hair: "#B5452A", outfit: "#3B6E8F", accent: "#D9B26F", gear: "#2B2B2B" },
    back: [],
    body: [
      torso("outfit"),
      strokeOnly("bino-strap", "M22.5 47 Q32 52.5 41.5 47", "ink", 1.3),
      { id: "bino-l", kind: "shape", shape: { type: "rect", x: 25, y: 51, width: 6, height: 7.5, rx: 2 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.4 },
      { id: "bino-r", kind: "shape", shape: { type: "rect", x: 33, y: 51, width: 6, height: 7.5, rx: 2 }, fill: fill("gear"), stroke: ink, strokeWidth: 1.4 },
    ],
    front: [
      shape("tuft-l", "M15.3 20 Q14.4 27.5 16.2 31 L19 21.5 Z", "hair"),
      shape("tuft-r", "M48.7 20 Q49.6 27.5 47.8 31 L45 21.5 Z", "hair"),
      shape("hat-crown", "M19 16 Q19 5 32 5 Q45 5 45 16 Z", "accent"),
      shape("hat-brim", "M8.5 18 Q32 11 55.5 18 Q32 22.5 8.5 18 Z", "accent"),
      strokeOnly("hat-band", "M19.4 13.6 Q32 11 44.6 13.6", "outfit", 2.2),
    ],
  },
  mira: {
    name: "Mira",
    crew: "guild",
    role: "the beast tamer with a fluffy companion on her shoulder",
    tokens: { skin: "#E3B58E", hair: "#6A4C93", outfit: "#E8608C", accent: "#FFFFFF", gear: "#FFCA28" },
    back: [strokeOnly("tail-l", "M15.5 30 Q11 40 14 48.5", "hair", 5.5), strokeOnly("tail-r", "M48.5 30 Q53 40 50 48.5", "hair", 5.5)],
    body: [
      torso("outfit"),
      circle("tie-l", 14.2, 40, 2, "gear", true),
      circle("tie-r", 49.8, 40, 2, "gear", true),
      {
        id: "companion",
        kind: "group",
        children: [
          { id: "pet-ear-l", kind: "shape", shape: { type: "polygon", points: "41.5 41.5 42.5 36.5 45.5 40" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
          { id: "pet-ear-r", kind: "shape", shape: { type: "polygon", points: "48 40 51.5 37 51.8 42" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
          circle("pet-body", 46.5, 45.5, 5.4, "accent", true),
          circle("pet-eye-l", 44.8, 45, 0.8, "ink"),
          circle("pet-eye-r", 48.2, 45, 0.8, "ink"),
          { id: "pet-blush", kind: "shape", shape: { type: "ellipse", cx: 46.5, cy: 47.4, rx: 1.4, ry: 0.7 }, fill: fill("blush") },
        ],
      },
    ],
    front: [shape("hair-front", "M15 25 Q15 9 32 9 Q49 9 49 25 Q45 17 38.5 17 L35.5 21 L32.5 16.8 Q20 16 15 25 Z", "hair")],
  },
  ezra: {
    name: "Ezra",
    crew: "guild",
    role: "the map strategist with a monocle and bow tie",
    tokens: { skin: "#C99A6E", hair: "#2D2420", outfit: "#7A4B2A", accent: "#E0B84C", gear: "#F2EEE6", tie: "#2E7D5B" },
    back: [],
    body: [
      torso("gear"),
      shape("vest-l", "M19.6 60 Q19.5 46 27 45.6 L30 63 L19.4 63 Z", "outfit", { strokeWidth: 1.8 }),
      shape("vest-r", "M44.4 60 Q44.5 46 37 45.6 L34 63 L44.6 63 Z", "outfit", { strokeWidth: 1.8 }),
      { id: "bow-tie", kind: "shape", shape: { type: "path", d: "M28 46.5 L32 48.5 L36 46.5 L36 50.5 L32 48.5 L28 50.5 Z" }, fill: fill("tie"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
    ],
    front: [shape("hair-front", "M15 24 Q14 8 33 8 Q50 9 49 22 Q45 15 36.5 14.5 Q30 17.5 22 16 Q17 18 15 24 Z", "hair")],
    over: [
      { id: "monocle", kind: "shape", shape: { type: "circle", cx: 38, cy: 29, r: 4.8 }, fill: "none", stroke: fill("accent"), strokeWidth: 1.6 },
      strokeOnly("monocle-chain", "M42.6 30.5 Q46.5 37 44.5 43.5", "accent", 1),
    ],
  },
  kofi: {
    name: "Kofi",
    crew: "guild",
    role: "the guild examiner in a green peaked cap with a star badge",
    tokens: { skin: "#5A3522", hair: "#121212", outfit: "#2F5D46", accent: "#E0B84C", gear: "#3E7A5A" },
    back: [],
    body: [
      torso("outfit"),
      strokeOnly("epaulette-l", "M20.5 49.5 L25.5 46.5", "accent", 2.4),
      strokeOnly("epaulette-r", "M43.5 49.5 L38.5 46.5", "accent", 2.4),
      circle("chest-badge", 38.5, 54, 1.8, "accent", true),
    ],
    front: [
      { id: "fade-l", kind: "shape", shape: { type: "path", d: "M15.3 29 Q15 22 17 19 L20 19 L20.5 25 Z" }, fill: fill("hair"), opacity: 0.5 },
      { id: "fade-r", kind: "shape", shape: { type: "path", d: "M48.7 29 Q49 22 47 19 L44 19 L43.5 25 Z" }, fill: fill("hair"), opacity: 0.5 },
      shape("goatee", "M29 40.6 Q32 44.4 35 40.6 Q32 42 29 40.6 Z", "hair", { strokeWidth: 1.2 }),
      shape("cap", "M15.5 19 Q15 6 32 6.5 Q49 6 48.5 19 Z", "gear"),
      shape("visor", "M15 18.5 Q32 15.5 49 18.5 Q46.5 23.5 32 21.5 Q17.5 23.5 15 18.5 Z", "hair"),
      { id: "cap-badge", kind: "shape", shape: { type: "polygon", points: "32 8.6 33.2 11.6 36.4 11.8 33.9 13.8 34.8 16.8 32 15.1 29.2 16.8 30.1 13.8 27.6 11.8 30.8 11.6" }, fill: fill("accent"), stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
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
  /** Drawn behind the whole character (auras). */
  behind?: Layer[];
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
    case "powerup":
      return {
        label: "powering up in a blazing aura",
        behind: [
          {
            id: "aura",
            kind: "group",
            origin: [32, 34],
            children: [
              { id: "aura-outer", kind: "shape", shape: { type: "path", d: "M32 0 Q37 6 42 2.5 Q44 9 50.5 7 Q50 14 57 15 Q52.5 22 58 28.5 Q52 31.5 54.5 39 Q50 44 52 50 L12 50 Q14 44 9.5 39 Q12 31.5 6 28.5 Q11.5 22 7 15 Q14 14 13.5 7 Q20 9 22 2.5 Q27 6 32 0 Z" }, fill: fill("aura"), opacity: 0.75 },
              { id: "aura-inner", kind: "shape", shape: { type: "path", d: "M32 5 Q36 10 40 7.5 Q41.5 13 47 12 Q46.5 18 52 20 Q48.5 26 52.5 31 Q48 35 49.5 42 L14.5 42 Q16 35 11.5 31 Q15.5 26 12 20 Q17.5 18 17 12 Q22.5 13 24 7.5 Q28 10 32 5 Z" }, fill: fill("auraCore"), opacity: 0.9 },
            ],
          },
          {
            id: "speed-lines",
            kind: "group",
            children: [
              { id: "speed-1", kind: "shape", shape: { type: "path", d: "M2 40 L7 37 M1 48 L7 46 M3 56 L8 53 M62 40 L57 37 M63 48 L57 46 M61 56 L56 53" }, fill: "none", stroke: fill("aura"), strokeWidth: 1.8, lineCap: "round" },
            ],
          },
        ],
        face: [
          eye("eye-l", 26),
          eye("eye-r", 38),
          line("brow-l", "M22.8 24.6 L28.6 26.4", 2.2),
          line("brow-r", "M41.2 24.6 L35.4 26.4", 2.2),
          { id: "mouth", kind: "shape", shape: { type: "path", d: "M28.5 35 H35.5 Q35 39 32 39 Q29 39 28.5 35 Z" }, fill: ink, stroke: ink, strokeWidth: 1.2, lineJoin: "round" },
          { id: "teeth", kind: "shape", shape: { type: "path", d: "M29.4 35.4 H34.6 V36.6 H29.4 Z" }, fill: fill("white") },
        ],
        duration: 1400,
        markers: [{ id: "charge", at: 0 }, { id: "burst", at: 220 }],
        tracks: [
          track("aura", "opacity", [[0, 0, "easeOut"], [220, 1], [1100, 1, "easeIn"], [1400, 0]]),
          track("aura", "scale", [[0, 0.8, "easeOut"], [220, 1.06, "easeInOut"], [420, 0.97, "easeInOut"], [620, 1.05, "easeInOut"], [820, 0.97, "easeInOut"], [1020, 1.04, "easeIn"], [1400, 0.8]]),
          track("speed-lines", "opacity", [[0, 0], [180, 0, "easeOut"], [260, 1], [950, 1, "easeIn"], [1150, 0], [1400, 0]]),
          track("speed-lines", "translateY", [[0, 4], [180, 4, "easeOut"], [700, -4], [1150, -8], [1400, 4]]),
          track("char", "translateX", [[0, 0], [220, 0], [270, -0.8], [320, 0.8], [370, -0.8], [420, 0.8], [470, -0.5], [520, 0], [1400, 0]]),
        ],
        sounds: [
          { id: "charge", sound: "synth:whoosh", marker: "charge", gain: 0.6, params: { pitch: 0.6, decay: 1.4 } },
          { id: "burst", sound: "synth:kick", marker: "burst", gain: 0.8, params: { pitch: 0.8 } },
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

const REACTION_TITLE: Record<ChibiReaction, string> = { cool: "Cool", powerup: "Power-Up", happy: "Happy", laughing: "Laughing", love: "In Love", sad: "Sad", angry: "Angry", surprised: "Surprised" };

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
    layers: [{ id: "char", kind: "group", origin: [32, 62], children: [...(x.behind ?? []), ...c.back, ...c.body, head, ...c.front, ...x.face, ...(c.over ?? [])] }],
    timeline: { duration: x.duration, loop: true, tracks: x.tracks, markers: x.markers },
    sounds: x.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: `${c.name}, ${c.role}, ${x.label}`, reducedMotionFrame: x.reducedMotionFrame },
    tags: ["chibi", "character", "anime-style", c.crew, c.name.toLowerCase(), r, "original"],
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

export const CHIBI_NAMES: Record<ChibiCharacter, { name: string; role: string; crew: ChibiCrew }> = Object.fromEntries(
  CHIBI_CHARACTERS.map((k) => [k, { name: CHARACTERS[k].name, role: CHARACTERS[k].role, crew: CHARACTERS[k].crew }]),
) as Record<ChibiCharacter, { name: string; role: string; crew: ChibiCrew }>;

export const chibiCrewMembers = (crew: ChibiCrew): ChibiCharacter[] => CHIBI_CHARACTERS.filter((c) => CHARACTERS[c].crew === crew);
