import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, SPRING_SNAPPY, SPRING_SOFT, track } from "./util";

/**
 * SonicGlyphs line-glyph rig: audio objects drawn as 2.5 px rounded strokes on a 64×64 grid,
 * each with motion and sound designed together (cues sit on the visual impact frames).
 */

export const GLYPHS = ["speaker", "music-note", "headphones", "microphone", "bell", "vinyl", "equalizer", "notification"] as const;
export type Glyph = (typeof GLYPHS)[number];

export const GLYPH_PALETTES = {
  studio: { line: "#7CF0C5", accent: "#8A5CFF", fill: "#161626" },
  sunset: { line: "#FFB86B", accent: "#FF5C8A", fill: "#1E1420" },
  ice: { line: "#9AD8FF", accent: "#6C8CFF", fill: "#101826" },
} as const;
export type GlyphPalette = keyof typeof GLYPH_PALETTES;

const line = { token: "line" } as const;
const accent = { token: "accent" } as const;
const sw = 2.5;
const path = (id: string, d: string, opts: Partial<Extract<Layer, { kind: "shape" }>> = {}): Layer => ({
  id,
  kind: "shape",
  shape: { type: "path", d },
  fill: "none",
  stroke: line,
  strokeWidth: sw,
  lineCap: "round",
  lineJoin: "round",
  ...opts,
});

interface GlyphSpec {
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

function spec(g: Glyph): GlyphSpec {
  switch (g) {
    case "speaker":
      return {
        name: "Pulsing Speaker", label: "Speaker emitting sound waves", category: "audio-gear", tags: ["speaker", "volume", "sound"],
        layers: [
          { id: "body", kind: "group", origin: [20, 32], children: [path("box", "M10 25 H18 L29 16 V48 L18 39 H10 Z", { fill: { token: "fill" } })] },
          path("wave-1", "M36 25 Q41 32 36 39"),
          path("wave-2", "M42 20 Q50 32 42 44"),
          path("wave-3", "M48 15 Q59 32 48 49", { stroke: accent }),
        ],
        duration: 1200,
        markers: [{ id: "beat", at: 0 }],
        tracks: [
          track("body", "scale", [[0, 1, "easeOut"], [90, 1.1, SPRING_SNAPPY], [500, 1], [1200, 1]]),
          track("wave-1", "opacity", [[0, 0.2], [100, 1, "easeOut"], [600, 0.2], [1200, 0.2]]),
          track("wave-2", "opacity", [[0, 0.2], [200, 1, "easeOut"], [700, 0.2], [1200, 0.2]]),
          track("wave-3", "opacity", [[0, 0.2], [300, 1, "easeOut"], [800, 0.2], [1200, 0.2]]),
        ],
        sounds: [{ id: "kick", sound: "synth:kick", marker: "beat", gain: 0.9 }],
        reducedMotionFrame: 300,
      };
    case "music-note":
      return {
        name: "Dancing Note", label: "Music note bouncing to the beat", category: "notes", tags: ["music", "note", "melody"],
        layers: [
          {
            id: "note", kind: "group", origin: [26, 50],
            children: [
              { id: "head-a", kind: "shape", shape: { type: "ellipse", cx: 21, cy: 46, rx: 6, ry: 4.5 }, fill: line, transform: { rotate: -20 }, origin: [21, 46] },
              { id: "head-b", kind: "shape", shape: { type: "ellipse", cx: 43, cy: 41, rx: 6, ry: 4.5 }, fill: line, transform: { rotate: -20 }, origin: [43, 41] },
              path("stems", "M26 44 V14 L48 9 V39"),
              path("beam", "M26 21 L48 16", { stroke: accent, strokeWidth: 4 }),
            ],
          },
        ],
        duration: 1000,
        markers: [{ id: "down", at: 0 }, { id: "up", at: 500 }],
        tracks: [
          track("note", "translateY", [[0, 0, "easeOut"], [250, -6, "easeIn"], [500, 0, "easeOut"], [750, -3, "easeIn"], [1000, 0]]),
          track("note", "rotate", [[0, 0, "easeInOut"], [250, -8, "easeInOut"], [500, 0, "easeInOut"], [750, 8, "easeInOut"], [1000, 0]]),
        ],
        sounds: [
          { id: "pluck-1", sound: "synth:pluck", marker: "down", gain: 0.7 },
          { id: "pluck-2", sound: "synth:pluck", marker: "up", gain: 0.6, params: { pitch: 1.5 } },
        ],
        reducedMotionFrame: 0,
      };
    case "headphones":
      return {
        name: "Pulsing Headphones", label: "Headphones pulsing with the music", category: "audio-gear", tags: ["headphones", "listen", "music"],
        layers: [
          {
            id: "phones", kind: "group", origin: [32, 36],
            children: [
              path("band", "M12 38 V32 A20 20 0 0 1 52 32 V38"),
              { id: "cup-l", kind: "shape", shape: { type: "rect", x: 8, y: 36, width: 10, height: 16, rx: 4 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
              { id: "cup-r", kind: "shape", shape: { type: "rect", x: 46, y: 36, width: 10, height: 16, rx: 4 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
              path("glow", "M24 46 L28 40 L32 50 L36 42 L40 46", { stroke: accent }),
            ],
          },
        ],
        duration: 800,
        markers: [{ id: "beat", at: 0 }],
        tracks: [track("phones", "scale", [[0, 1, "easeOut"], [80, 1.07, SPRING_SOFT], [600, 1], [800, 1]]), track("glow", "opacity", [[0, 1], [400, 0.3, "easeInOut"], [800, 1]])],
        sounds: [{ id: "kick", sound: "synth:kick", marker: "beat", gain: 0.7, params: { pitch: 1.2 } }],
        reducedMotionFrame: 0,
      };
    case "microphone":
      return {
        name: "Recording Microphone", label: "Microphone with blinking record light", category: "recording", tags: ["mic", "record", "podcast"],
        layers: [
          { id: "capsule", kind: "shape", shape: { type: "rect", x: 24, y: 8, width: 16, height: 28, rx: 8 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
          path("grill", "M24 18 H40 M24 24 H40"),
          path("stand", "M17 30 A15 15 0 0 0 47 30 M32 45 V55 M24 55 H40"),
          { id: "rec", kind: "shape", shape: { type: "circle", cx: 50, cy: 12, r: 4 }, fill: accent, origin: [50, 12] },
        ],
        duration: 1000,
        markers: [{ id: "on", at: 0 }],
        tracks: [track("rec", "opacity", [[0, 1], [450, 1, "easeInOut"], [550, 0.15], [900, 0.15, "easeInOut"], [1000, 1]]), track("rec", "scale", [[0, 0.85, "easeOut"], [120, 1.15, SPRING_SNAPPY], [600, 1], [1000, 0.85]])],
        sounds: [{ id: "click", sound: "synth:click", marker: "on", gain: 0.6, params: { pitch: 0.8 } }],
        reducedMotionFrame: 200,
      };
    case "bell":
    case "notification":
      return {
        name: g === "bell" ? "Ringing Bell" : "Notification Bell",
        label: g === "bell" ? "Bell swinging as it rings" : "Notification bell with badge",
        category: "notifications",
        tags: ["bell", "ring", "alert", ...(g === "notification" ? ["notification", "badge"] : [])],
        layers: [
          {
            id: "bell", kind: "group", origin: [32, 9],
            children: [
              path("dome", "M16 44 V30 A16 16 0 0 1 48 30 V44 L52 48 H12 Z", { fill: { token: "fill" } }),
              path("clapper", "M27 52 A5 5 0 0 0 37 52"),
              path("hook", "M32 9 V14"),
            ],
          },
          ...(g === "notification" ? [{ id: "badge", kind: "shape" as const, shape: { type: "circle" as const, cx: 48, cy: 16, r: 6 }, fill: accent, origin: [48, 16] as [number, number] }] : []),
        ],
        duration: 1400,
        markers: [{ id: "ding", at: 100 }],
        tracks: [
          track("bell", "rotate", [[0, 0, "easeOut"], [100, 14, "easeInOut"], [250, -11, "easeInOut"], [400, 8, "easeInOut"], [550, -5, "easeInOut"], [700, 2, "easeInOut"], [850, 0], [1400, 0]]),
          ...(g === "notification" ? [track("badge", "scale", [[0, 0.6, "easeOut"], [120, 1.25, SPRING_SOFT], [700, 1], [1400, 0.6]])] : []),
        ],
        sounds: [{ id: "ding", sound: g === "bell" ? "synth:bell" : "synth:notify", marker: "ding", gain: 0.8 }],
        reducedMotionFrame: 900,
      };
    case "vinyl":
      return {
        name: "Spinning Vinyl", label: "Vinyl record spinning on a turntable", category: "audio-gear", tags: ["vinyl", "record", "dj"],
        layers: [
          {
            id: "disc", kind: "group", origin: [32, 32],
            children: [
              { id: "record", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 24 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
              path("groove", "M32 14 A18 18 0 0 1 50 32 M32 50 A18 18 0 0 1 14 32", { strokeWidth: 1.5 }),
              { id: "label", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 7 }, fill: accent },
              { id: "spindle", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 1.8 }, fill: line },
            ],
          },
        ],
        duration: 1800,
        markers: [{ id: "turn", at: 0 }],
        tracks: [track("disc", "rotate", [[0, 0], [1800, 360]])],
        sounds: [{ id: "kick", sound: "synth:kick", marker: "turn", gain: 0.6, params: { pitch: 0.9 } }],
        reducedMotionFrame: 0,
      };
    case "equalizer":
      return {
        name: "Equalizer Bars", label: "Equalizer bars moving to the music", category: "visualizers", tags: ["equalizer", "levels", "visualizer"],
        layers: [0, 1, 2, 3, 4].map((i): Layer => ({
          id: `bar-${i + 1}`,
          kind: "shape",
          shape: { type: "rect", x: 9 + i * 10, y: 14, width: 6, height: 40, rx: 3 },
          fill: i % 2 ? accent : line,
          origin: [12 + i * 10, 54],
        })),
        duration: 1200,
        markers: [{ id: "beat", at: 0 }, { id: "off", at: 600 }],
        tracks: [0, 1, 2, 3, 4].map((i) => {
          const a = [0.35, 0.8, 0.55, 1, 0.45][i]!;
          const b = [0.9, 0.4, 1, 0.5, 0.85][i]!;
          return track(`bar-${i + 1}`, "scaleY", [[0, a, "easeInOut"], [300, b, "easeInOut"], [600, (a + b) / 2, "easeInOut"], [900, b * 0.8, "easeInOut"], [1200, a]]);
        }),
        sounds: [
          { id: "kick", sound: "synth:kick", marker: "beat", gain: 0.8 },
          { id: "tick", sound: "synth:click", marker: "off", gain: 0.5 },
        ],
        reducedMotionFrame: 300,
      };
  }
}

export interface GlyphRigParams {
  glyph: Glyph;
  palette?: GlyphPalette;
}

export function buildGlyph({ glyph, palette = "studio" }: GlyphRigParams): AssetDefinition {
  const s = spec(glyph);
  return finalize({
    schema: "daos.asset/1",
    brand: "sonicglyphs",
    slug: palette === "studio" ? glyph : `${glyph}-${palette}`,
    name: palette === "studio" ? s.name : `${s.name} (${palette})`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...GLYPH_PALETTES[palette] },
    layers: s.layers,
    timeline: { duration: s.duration, loop: true, tracks: s.tracks, markers: s.markers },
    sounds: s.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: s.label, reducedMotionFrame: s.reducedMotionFrame },
    tags: [...s.tags, palette],
    category: s.category,
    provenance: { method: "rig", rig: "sonicglyphs-line@1" },
  });
}
