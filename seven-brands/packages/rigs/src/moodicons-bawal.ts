import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, track } from "./util";

/**
 * Moodicons "Bawal" signs: Philippine public-place rules (as known in Davao City) as animated sticker signs.
 * Pictograms only — no words in the artwork, so they read at any size and in any language; the Bisaya/Tagalog
 * names live in the product title and the accessible label. Same 64×64 grid and ink outline as the other rigs.
 * Prohibition signs: red ring + slash that "stamps" in. The designated-area sign is green and has no slash.
 */

export const BAWAL_SIGNS = ["smoking", "littering", "spitting", "urinating", "firecrackers", "smoking-area"] as const;
export type BawalSign = (typeof BAWAL_SIGNS)[number];

export const BAWAL_PALETTES = {
  classic: { sign: "#E5322D", ok: "#1E9E5A", ink: "#2B1B12", paper: "#FFFFFF", face: "#FFC83D", fire: "#FF5A36", filter: "#F2A33A", drop: "#4FC3F7", wall: "#B9A898" },
} as const;
export type BawalPalette = keyof typeof BAWAL_PALETTES;

const ink = { token: "ink" } as const;
const line = (id: string, d: string, width = 2.4, paint: { token: string } = ink): Layer => ({ id, kind: "shape", shape: { type: "path", d }, fill: "none", stroke: paint, strokeWidth: width, lineCap: "round", lineJoin: "round" });

interface SignSpec {
  name: string;
  label: string;
  tags: string[];
  allowed?: boolean;
  pictogram: Layer[];
  duration: number;
  tracks: Track[];
  markers: { id: string; at: number }[];
  sounds: SoundCue[];
  reducedMotionFrame: number;
}

/** Cigarette lying across the sign, with a smoke wisp that rises and fades. */
const cigarette = (): Layer[] => [
  { id: "cig-paper", kind: "shape", shape: { type: "rect", x: 14, y: 35, width: 30, height: 6, rx: 1.5 }, fill: { token: "paper" }, stroke: ink, strokeWidth: 2 },
  { id: "cig-filter", kind: "shape", shape: { type: "rect", x: 14, y: 35, width: 8, height: 6, rx: 1.5 }, fill: { token: "filter" }, stroke: ink, strokeWidth: 2 },
  { id: "cig-tip", kind: "shape", shape: { type: "rect", x: 41, y: 35, width: 4, height: 6, rx: 1 }, fill: { token: "fire" } },
  { id: "smoke", kind: "group", origin: [44, 30], children: [line("smoke-line", "M44 31 Q41 27 44 23 Q47 19 44 15", 2.2)] },
];

const smokeTracks = (d: number): Track[] => [
  track("smoke", "translateY", [[0, 3, "easeOut"], [d * 0.8, -4], [d, -4]]),
  track("smoke", "opacity", [[0, 0, "easeOut"], [d * 0.25, 1], [d * 0.65, 1, "easeIn"], [d * 0.8, 0], [d, 0]]),
];

/** Slash "stamp" at `at` ms plus a small "no!" shake. The slash ends stay under the ring even at peak scale. */
const stamp = (at: number, d: number): Track[] => [
  track("slash", "scale", [[0, 1], [at, 1, "easeOut"], [at + 110, 1.06, "easeInOut"], [at + 260, 1], [d, 1]]),
  track("sign", "rotate", [[0, 0], [at, 0, "easeInOut"], [at + 90, -6, "easeInOut"], [at + 180, 5, "easeInOut"], [at + 270, -2, "easeInOut"], [at + 360, 0], [d, 0]]),
];

function spec(s: BawalSign): SignSpec {
  switch (s) {
    case "smoking":
      return {
        name: "Bawal Mag-sigarilyo",
        label: "No smoking sign: a lit cigarette crossed out",
        tags: ["bawal", "no smoking", "sigarilyo", "davao", "sign"],
        pictogram: cigarette(),
        duration: 2000,
        markers: [{ id: "stamp", at: 900 }],
        tracks: [...smokeTracks(2000), ...stamp(900, 2000)],
        sounds: [{ id: "stamp", sound: "synth:pop", marker: "stamp", gain: 0.8, params: { pitch: 0.7 } }],
        reducedMotionFrame: 600,
      };
    case "littering":
      return {
        name: "Bawal Maglabay ug Basura Bisan Asa",
        label: "No littering sign: trash falling to the ground, crossed out",
        tags: ["bawal", "no littering", "basura", "davao", "sign", "clean"],
        pictogram: [
          line("ground", "M17 46 H47", 2.4),
          { id: "paper-ball", kind: "shape", shape: { type: "polygon", points: "24 20 30 18 33 23 31 29 25 30 21 25" }, fill: { token: "paper" }, stroke: ink, strokeWidth: 2, lineJoin: "round", origin: [27, 24] },
          { id: "can", kind: "shape", shape: { type: "rect", x: 35, y: 22, width: 7, height: 11, rx: 1.5 }, fill: { token: "drop" }, stroke: ink, strokeWidth: 2, origin: [38.5, 27.5] },
        ],
        duration: 1800,
        markers: [{ id: "land", at: 800 }, { id: "stamp", at: 1000 }],
        tracks: [
          track("paper-ball", "translateY", [[0, -6, "easeIn"], [700, 11], [1800, 11]]),
          track("paper-ball", "rotate", [[0, 0, "easeIn"], [700, 90], [1800, 90]]),
          track("paper-ball", "opacity", [[0, 0, "easeOut"], [150, 1], [1500, 1, "easeIn"], [1750, 0], [1800, 0]]),
          track("can", "translateY", [[0, -8], [150, -8, "easeIn"], [800, 9], [1800, 9]]),
          track("can", "rotate", [[0, 0], [150, 0, "easeIn"], [800, -70], [1800, -70]]),
          track("can", "opacity", [[0, 0], [150, 0, "easeOut"], [300, 1], [1500, 1, "easeIn"], [1750, 0], [1800, 0]]),
          ...stamp(1000, 1800),
        ],
        sounds: [
          { id: "land", sound: "synth:click", marker: "land", gain: 0.5, params: { pitch: 0.6 }, panFrom: "can" },
          { id: "stamp", sound: "synth:pop", marker: "stamp", gain: 0.8, params: { pitch: 0.7 } },
        ],
        reducedMotionFrame: 900,
      };
    case "spitting":
      return {
        name: "Bawal Magluwa Bisan Asa",
        label: "No spitting sign: a face spitting, crossed out",
        tags: ["bawal", "no spitting", "luwa", "davao", "sign", "hygiene"],
        pictogram: [
          // Everything sits below the slash (y > x) so the face and the spit stay visible.
          { id: "head", kind: "shape", shape: { type: "circle", cx: 21, cy: 40, r: 8.5 }, fill: { token: "face" }, stroke: ink, strokeWidth: 2.2 },
          { id: "eye", kind: "shape", shape: { type: "circle", cx: 23.5, cy: 37.5, r: 1.4 }, fill: ink },
          { id: "lips", kind: "shape", shape: { type: "ellipse", cx: 28.5, cy: 42.5, rx: 1.8, ry: 1.5 }, fill: ink },
          { id: "spit", kind: "shape", shape: { type: "path", d: "M33 41 Q31 44 33 45.5 Q35 44 33 41 Z" }, fill: { token: "drop" }, stroke: ink, strokeWidth: 1.2 },
        ],
        duration: 1600,
        markers: [{ id: "stamp", at: 800 }],
        tracks: [
          track("spit", "translateX", [[0, 0], [100, 0, "easeOut"], [600, 7], [1600, 7]]),
          track("spit", "translateY", [[0, 0], [100, 0, "easeIn"], [600, 5], [1600, 5]]),
          track("spit", "opacity", [[0, 0], [100, 0, "easeOut"], [180, 1], [500, 1, "easeIn"], [650, 0], [1600, 0]]),
          ...stamp(800, 1600),
        ],
        sounds: [{ id: "stamp", sound: "synth:pop", marker: "stamp", gain: 0.8, params: { pitch: 0.7 } }],
        reducedMotionFrame: 330,
      };
    case "urinating":
      return {
        name: "Bawal Mangihi Bisan Asa",
        label: "No urinating in public sign: a person facing a wall, crossed out",
        tags: ["bawal", "no urinating", "ihi", "davao", "sign", "public"],
        pictogram: [
          { id: "wall", kind: "shape", shape: { type: "rect", x: 41, y: 16, width: 5, height: 32, rx: 1 }, fill: { token: "wall" }, stroke: ink, strokeWidth: 2 },
          { id: "person-head", kind: "shape", shape: { type: "circle", cx: 21, cy: 19, r: 4 }, fill: ink },
          line("person-body", "M21 24 V37 M21 37 L17 47 M21 37 L25 47 M21 27 L27 32", 3),
          // The stream sits below the slash (y > x) so it stays visible.
          ...[0, 1, 2].map((i): Layer => ({ id: `drop-${i + 1}`, kind: "shape", shape: { type: "circle", cx: 28 + i * 2.8, cy: 36 + i * 2, r: 1.3 }, fill: { token: "drop" } })),
        ],
        duration: 1600,
        markers: [{ id: "stamp", at: 800 }],
        tracks: [
          ...[0, 1, 2].map((i) => track(`drop-${i + 1}`, "opacity", [[0, 0], [i * 120, 0, "easeOut"], [i * 120 + 120, 1], [500, 1, "easeIn"], [650, 0], [1600, 0]])),
          ...stamp(800, 1600),
        ],
        sounds: [{ id: "stamp", sound: "synth:pop", marker: "stamp", gain: 0.8, params: { pitch: 0.7 } }],
        reducedMotionFrame: 400,
      };
    case "firecrackers":
      return {
        name: "Bawal ang Paputok",
        label: "No firecrackers sign: a lit firecracker crossed out",
        tags: ["bawal", "no firecrackers", "paputok", "davao", "sign", "new year"],
        pictogram: [
          { id: "cracker", kind: "shape", shape: { type: "rect", x: 23, y: 28, width: 14, height: 18, rx: 2 }, fill: { token: "fire" }, stroke: ink, strokeWidth: 2.2 },
          line("band", "M23 33 H37 M23 41 H37", 1.6),
          line("fuse", "M30 28 Q30 22 35 19.5", 2),
          { id: "spark", kind: "shape", shape: { type: "path", d: "M36 13.5 Q36 19 41.5 19 Q36 19 36 24.5 Q36 19 30.5 19 Q36 19 36 13.5 Z" }, fill: { token: "face" }, stroke: ink, strokeWidth: 1.4, lineJoin: "round", origin: [36, 19] },
        ],
        duration: 1400,
        markers: [{ id: "stamp", at: 700 }],
        tracks: [
          track("spark", "scale", [[0, 0.7, "easeInOut"], [150, 1.2, "easeInOut"], [300, 0.8, "easeInOut"], [450, 1.15, "easeInOut"], [600, 0.7], [1400, 0.7]]),
          track("spark", "rotate", [[0, 0, "easeInOut"], [300, 20, "easeInOut"], [600, 0], [1400, 0]]),
          ...stamp(700, 1400),
        ],
        sounds: [{ id: "stamp", sound: "synth:pop", marker: "stamp", gain: 0.8, params: { pitch: 0.7 } }],
        reducedMotionFrame: 150,
      };
    case "smoking-area":
      return {
        name: "Designated Smoking Area",
        label: "Designated smoking area sign: a cigarette on green with a check mark",
        tags: ["smoking area", "designated", "allowed", "davao", "sign"],
        allowed: true,
        pictogram: [
          ...cigarette(),
          { id: "badge", kind: "group", origin: [47, 47], children: [
            { id: "badge-disc", kind: "shape", shape: { type: "circle", cx: 47, cy: 47, r: 7.5 }, fill: { token: "ok" }, stroke: { token: "paper" }, strokeWidth: 2 },
            line("check", "M43.5 47 L46 49.5 L50.5 44.5", 2.2, { token: "paper" }),
          ] },
        ],
        duration: 2000,
        markers: [{ id: "ok", at: 900 }],
        tracks: [
          ...smokeTracks(2000),
          track("badge", "scale", [[0, 1], [900, 1, "easeOut"], [1010, 1.2, "easeInOut"], [1160, 1], [2000, 1]]),
        ],
        sounds: [{ id: "ok", sound: "synth:chime", marker: "ok", gain: 0.6, params: { pitch: 1.2 } }],
        reducedMotionFrame: 600,
      };
  }
}

export function buildBawal({ sign, palette = "classic" }: { sign: BawalSign; palette?: BawalPalette }): AssetDefinition {
  const s = spec(sign);
  const plate: Layer[] = s.allowed
    ? [{ id: "plate", kind: "shape", shape: { type: "rect", x: 5, y: 5, width: 54, height: 54, rx: 12 }, fill: { token: "paper" }, stroke: { token: "ok" }, strokeWidth: 5 }]
    : [{ id: "disc", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 26 }, fill: { token: "paper" } }];
  const top: Layer[] = s.allowed
    ? [{ id: "outline", kind: "shape", shape: { type: "rect", x: 2.5, y: 2.5, width: 59, height: 59, rx: 14 }, fill: "none", stroke: ink, strokeWidth: 2 }]
    : [
        { id: "slash", kind: "group", origin: [32, 32], children: [line("slash-line", "M16 16 L48 48", 6, { token: "sign" })] },
        { id: "ring", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 26 }, fill: "none", stroke: { token: "sign" }, strokeWidth: 6 },
        { id: "outline", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 29.5 }, fill: "none", stroke: ink, strokeWidth: 2 },
      ];
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug: palette === "classic" ? `bawal-${sign}` : `bawal-${sign}-${palette}`,
    name: s.name,
    viewBox: [0, 0, 64, 64],
    tokens: { ...BAWAL_PALETTES[palette] },
    layers: [{ id: "sign", kind: "group", origin: [32, 32], children: [...plate, ...s.pictogram, ...top] }],
    timeline: { duration: s.duration, loop: true, tracks: s.tracks, markers: s.markers },
    sounds: s.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: s.label, reducedMotionFrame: s.reducedMotionFrame },
    tags: [...s.tags, "philippines", palette],
    category: "bawal",
    provenance: { method: "rig", rig: "moodicons-bawal@1" },
  });
}
