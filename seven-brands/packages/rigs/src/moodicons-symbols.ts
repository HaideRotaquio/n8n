import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, heartPath, r, track } from "./util";

/**
 * Moodicons reaction-symbol rig: sticker-style symbols (hearts, stars, thumbs up…) in the same
 * 64×64 grid and 2.5 px ink outline as the face rig, so faces and symbols mix in one pack.
 */

export const SYMBOLS = ["heart", "broken-heart", "star", "thumbs-up", "fire", "sparkles", "chat", "sun"] as const;
export type MoodSymbol = (typeof SYMBOLS)[number];

export const SYMBOL_PALETTES = {
  classic: { primary: "#E8336D", secondary: "#FFC83D", ink: "#2B1B12", paper: "#FFFFFF", fire: "#FF5A36" },
  pastel: { primary: "#FF8FB1", secondary: "#FFE08A", ink: "#3A1420", paper: "#FFFFFF", fire: "#FF8A65" },
} as const;
export type SymbolPalette = keyof typeof SYMBOL_PALETTES;

const ink = { token: "ink" } as const;
const outline = { stroke: ink, strokeWidth: 2.5, lineJoin: "round" as const, lineCap: "round" as const };

/** Five-pointed star polygon centred on (cx, cy). */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${r(cx + rad * Math.cos(a))} ${r(cy + rad * Math.sin(a))}`);
  }
  return pts.join(" ");
}

/** Four-pointed sparkle centred on (cx, cy). */
function sparklePath(cx: number, cy: number, s: number): string {
  return `M${cx} ${r(cy - s)} Q${cx} ${cy} ${r(cx + s)} ${cy} Q${cx} ${cy} ${cx} ${r(cy + s)} Q${cx} ${cy} ${r(cx - s)} ${cy} Q${cx} ${cy} ${cx} ${r(cy - s)} Z`;
}

interface SymbolSpec {
  name: string;
  label: string;
  category: string;
  tags: string[];
  layers: Layer[];
  duration: number;
  tracks: Track[];
  markers: { id: string; at: number }[];
  sounds: SoundCue[];
  reducedMotionFrame: number;
}

function spec(sym: MoodSymbol): SymbolSpec {
  switch (sym) {
    case "heart":
      return {
        name: "Pulsing Heart", label: "Red heart pulsing like a heartbeat", category: "love", tags: ["heart", "love", "like"],
        layers: [
          { id: "heart", kind: "group", origin: [32, 33], children: [
            { id: "heart-body", kind: "shape", shape: { type: "path", d: heartPath(32, 33, 50) }, fill: { token: "primary" }, ...outline },
            { id: "heart-shine", kind: "shape", shape: { type: "path", d: "M15 22 Q16 16 22 15" }, fill: "none", stroke: { token: "paper" }, strokeWidth: 3, lineCap: "round", opacity: 0.8 },
          ] },
        ],
        duration: 1000,
        markers: [{ id: "lub", at: 0 }],
        tracks: [track("heart", "scale", [[0, 1, "easeOut"], [120, 1.14, "easeInOut"], [260, 1, "easeOut"], [380, 1.08, "easeInOut"], [560, 1], [1000, 1]])],
        sounds: [{ id: "lub", sound: "synth:heartbeat", marker: "lub", gain: 0.9 }],
        reducedMotionFrame: 120,
      };
    case "broken-heart":
      return {
        name: "Broken Heart", label: "Heart cracking down the middle", category: "sadness", tags: ["heartbreak", "sad", "breakup"],
        layers: [
          { id: "heart", kind: "group", origin: [32, 56], children: [
            { id: "heart-body", kind: "shape", shape: { type: "path", d: heartPath(32, 33, 50) }, fill: { token: "primary" }, ...outline },
            { id: "crack", kind: "shape", shape: { type: "polyline", points: "32 16 27 26 35 33 28 42 32 52" }, fill: "none", ...outline, strokeWidth: 3 },
          ] },
        ],
        duration: 1800,
        markers: [{ id: "crack", at: 300 }],
        tracks: [
          track("crack", "opacity", [[0, 0], [280, 0, "easeOut"], [360, 1], [1500, 1, "easeIn"], [1800, 0]]),
          track("heart", "rotate", [[0, 0], [300, 0, "easeOut"], [380, -6, "easeInOut"], [480, 5, "easeInOut"], [580, -3, "easeInOut"], [700, 0], [1800, 0]]),
        ],
        sounds: [{ id: "crack", sound: "synth:shutter", marker: "crack", gain: 0.6, params: { pitch: 0.7 } }],
        reducedMotionFrame: 800,
      };
    case "star":
      return {
        name: "Twinkling Star", label: "Golden star spinning and twinkling", category: "celebration", tags: ["star", "favorite", "best"],
        layers: [
          { id: "star", kind: "shape", shape: { type: "polygon", points: starPoints(32, 34, 26, 12) }, fill: { token: "secondary" }, ...outline, origin: [32, 34] },
          { id: "glint", kind: "shape", shape: { type: "path", d: sparklePath(52, 12, 5) }, fill: { token: "paper" }, stroke: ink, strokeWidth: 1.8, lineJoin: "round", origin: [52, 12] },
        ],
        duration: 1600,
        markers: [{ id: "twinkle", at: 600 }],
        tracks: [
          track("star", "rotate", [[0, 0, "easeInOut"], [250, -10, "easeInOut"], [550, 8, "easeInOut"], [800, 0], [1600, 0]]),
          track("star", "scale", [[0, 1, "easeOut"], [300, 1.08, "easeIn"], [600, 1], [1600, 1]]),
          track("glint", "scale", [[0, 0], [550, 0, "easeOut"], [750, 1.2, "easeInOut"], [1000, 0], [1600, 0]]),
        ],
        sounds: [{ id: "twinkle", sound: "synth:chime", marker: "twinkle", gain: 0.6, params: { pitch: 1.6 } }],
        reducedMotionFrame: 750,
      };
    case "thumbs-up":
      return {
        name: "Thumbs Up", label: "Thumbs up bouncing with approval", category: "reactions", tags: ["like", "approve", "yes"],
        layers: [
          { id: "hand", kind: "group", origin: [32, 56], children: [
            { id: "cuff", kind: "shape", shape: { type: "rect", x: 8, y: 30, width: 11, height: 25, rx: 3 }, fill: { token: "primary" }, ...outline },
            { id: "fist", kind: "shape", shape: { type: "path", d: "M19 32 H25 L32 17 Q34.5 11 39 13 Q42.5 15 41 23 L39.5 29 H51 Q56.5 30 55.5 35.5 L52.5 50 Q51.5 55 46 55 H19 Z" }, fill: { token: "secondary" }, ...outline },
            { id: "knuckles", kind: "shape", shape: { type: "path", d: "M40 38 H54 M40 45 H53" }, fill: "none", stroke: ink, strokeWidth: 2.2, lineCap: "round" },
          ] },
        ],
        duration: 1200,
        markers: [{ id: "up", at: 250 }],
        tracks: [
          track("hand", "translateY", [[0, 0, "easeOut"], [250, -5, "easeIn"], [450, 0], [1200, 0]]),
          track("hand", "rotate", [[0, 0, "easeOut"], [250, -8, "easeInOut"], [600, 0], [1200, 0]]),
        ],
        sounds: [{ id: "up", sound: "synth:pop", marker: "up", gain: 0.8, params: { pitch: 1.2 } }],
        reducedMotionFrame: 0,
      };
    case "fire":
      return {
        name: "Fire", label: "Flame flickering hot", category: "reactions", tags: ["fire", "hot", "lit"],
        layers: [
          { id: "flame", kind: "group", origin: [32, 58], children: [
            { id: "outer", kind: "shape", shape: { type: "path", d: "M32 58 C18 58 12 48 14 38 C16 29 24 26 24 15 C30 19 33 25 32 32 C36 28 38 22 37 13 C46 21 52 32 50 43 C48.5 53 42 58 32 58 Z" }, fill: { token: "fire" }, ...outline },
            { id: "inner", kind: "shape", shape: { type: "path", d: "M32 55 C26 55 22.5 50 24 44.5 C25.5 39.5 30.5 38.5 31 33 C36 37 41 43 40 48.5 C39 52.5 36 55 32 55 Z" }, fill: { token: "secondary" }, origin: [32, 55] },
          ] },
        ],
        duration: 900,
        markers: [{ id: "flare", at: 0 }],
        tracks: [
          track("flame", "scaleY", [[0, 1, "easeInOut"], [225, 1.06, "easeInOut"], [450, 0.97, "easeInOut"], [675, 1.04, "easeInOut"], [900, 1]]),
          track("flame", "rotate", [[0, 0, "easeInOut"], [300, -2, "easeInOut"], [600, 2, "easeInOut"], [900, 0]]),
          track("inner", "scaleY", [[0, 0.95, "easeInOut"], [300, 1.1, "easeInOut"], [600, 0.9, "easeInOut"], [900, 0.95]]),
        ],
        sounds: [{ id: "flare", sound: "synth:whoosh", marker: "flare", gain: 0.5, params: { pitch: 0.8, decay: 0.8 } }],
        reducedMotionFrame: 225,
      };
    case "sparkles":
      return {
        name: "Sparkles", label: "Three sparkles twinkling in turn", category: "celebration", tags: ["sparkle", "magic", "shine"],
        layers: [
          { id: "big", kind: "shape", shape: { type: "path", d: sparklePath(27, 36, 19) }, fill: { token: "secondary" }, ...outline, origin: [27, 36] },
          { id: "medium", kind: "shape", shape: { type: "path", d: sparklePath(49, 17, 10) }, fill: { token: "primary" }, ...outline, strokeWidth: 2.2, origin: [49, 17] },
          { id: "small", kind: "shape", shape: { type: "path", d: sparklePath(51, 48, 6.5) }, fill: { token: "secondary" }, ...outline, strokeWidth: 2, origin: [51, 48] },
        ],
        duration: 1500,
        markers: [{ id: "a", at: 0 }, { id: "b", at: 500 }],
        tracks: [
          track("big", "scale", [[0, 1, "easeInOut"], [250, 1.12, "easeInOut"], [500, 1], [1500, 1]]),
          track("medium", "scale", [[0, 1], [500, 1, "easeInOut"], [750, 0.6, "easeInOut"], [1000, 1], [1500, 1]]),
          track("small", "scale", [[0, 1], [1000, 1, "easeInOut"], [1250, 0.5, "easeInOut"], [1500, 1]]),
        ],
        sounds: [
          { id: "a", sound: "synth:chime", marker: "a", gain: 0.5, params: { pitch: 1.8 }, panFrom: "big" },
          { id: "b", sound: "synth:chime", marker: "b", gain: 0.35, params: { pitch: 2.2 }, panFrom: "medium" },
        ],
        reducedMotionFrame: 250,
      };
    case "chat":
      return {
        name: "Typing Bubble", label: "Speech bubble with typing dots", category: "everyday", tags: ["chat", "typing", "message"],
        layers: [
          { id: "bubble", kind: "shape", shape: { type: "path", d: "M14 12 H50 Q57 12 57 19 V39 Q57 46 50 46 H28 L17 55 L19 46 H14 Q7 46 7 39 V19 Q7 12 14 12 Z" }, fill: { token: "paper" }, ...outline },
          ...[0, 1, 2].map((i): Layer => ({ id: `dot-${i + 1}`, kind: "shape", shape: { type: "circle", cx: 21 + i * 11, cy: 29, r: 3.6 }, fill: i === 1 ? { token: "primary" } : ink })),
        ],
        duration: 1200,
        markers: [{ id: "tap", at: 0 }],
        tracks: [0, 1, 2].map((i) =>
          track(`dot-${i + 1}`, "translateY", [[0, 0], [i * 150, 0, "easeOut"], [i * 150 + 150, -4, "easeIn"], [i * 150 + 300, 0], [1200, 0]]),
        ),
        sounds: [{ id: "tap", sound: "synth:click", marker: "tap", gain: 0.5, params: { pitch: 1.4 } }],
        reducedMotionFrame: 0,
      };
    case "sun":
      return {
        name: "Sunny Smile", label: "Smiling sun with turning rays", category: "everyday", tags: ["sun", "sunny", "good morning"],
        layers: [
          { id: "rays", kind: "group", origin: [32, 32], children: [0, 1, 2, 3, 4, 5, 6, 7].map((i): Layer => {
            const a = (i * Math.PI) / 4;
            return { id: `ray-${i + 1}`, kind: "shape", shape: { type: "line", x1: r(32 + 21 * Math.cos(a)), y1: r(32 + 21 * Math.sin(a)), x2: r(32 + 29 * Math.cos(a)), y2: r(32 + 29 * Math.sin(a)) }, fill: "none", stroke: { token: "fire" }, strokeWidth: 3.5, lineCap: "round" };
          }) },
          { id: "disc", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 16 }, fill: { token: "secondary" }, ...outline },
          { id: "smile", kind: "shape", shape: { type: "path", d: "M25 30 Q27 27.5 29 30 M35 30 Q37 27.5 39 30 M26 35.5 Q32 41 38 35.5" }, fill: "none", stroke: ink, strokeWidth: 2.2, lineCap: "round" },
        ],
        duration: 4000,
        markers: [{ id: "shine", at: 0 }],
        tracks: [track("rays", "rotate", [[0, 0], [4000, 360]])],
        sounds: [{ id: "shine", sound: "synth:chime", marker: "shine", gain: 0.4, params: { pitch: 1.3, decay: 0.9 } }],
        reducedMotionFrame: 0,
      };
  }
}

export interface SymbolRigParams {
  symbol: MoodSymbol;
  palette?: SymbolPalette;
}

export function buildSymbol({ symbol, palette = "classic" }: SymbolRigParams): AssetDefinition {
  const s = spec(symbol);
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug: palette === "classic" ? `sticker-${symbol}` : `sticker-${symbol}-${palette}`,
    name: palette === "classic" ? s.name : `${s.name} (${palette})`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...SYMBOL_PALETTES[palette] },
    layers: s.layers,
    timeline: { duration: s.duration, loop: true, tracks: s.tracks, markers: s.markers },
    sounds: s.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: s.label, reducedMotionFrame: s.reducedMotionFrame },
    tags: [...s.tags, "sticker", palette],
    category: s.category,
    provenance: { method: "rig", rig: "moodicons-symbols@1" },
  });
}
