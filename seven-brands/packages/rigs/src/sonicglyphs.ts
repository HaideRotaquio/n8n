import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, SPRING_SNAPPY, SPRING_SOFT, track } from "./util";

/**
 * SonicGlyphs line-glyph rig: audio objects drawn as 2.5 px rounded strokes on a 64×64 grid,
 * each with motion and sound designed together (cues sit on the visual impact frames).
 */

export const GLYPHS = ["speaker", "music-note", "headphones", "microphone", "bell", "vinyl", "equalizer", "notification", "play", "waveform", "radio", "drum", "cassette", "mute"] as const;
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
    case "play":
      return {
        name: "Play Button", label: "Play button pressed with a ripple", category: "controls", tags: ["play", "start", "media"],
        layers: [
          { id: "ring", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 25 }, fill: "none", stroke: accent, strokeWidth: sw, origin: [32, 32] },
          { id: "button", kind: "group", origin: [32, 32], children: [
            { id: "disc", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 18 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
            { id: "triangle", kind: "shape", shape: { type: "polygon", points: "27 23 42 32 27 41" }, fill: line, stroke: line, strokeWidth: 2, lineJoin: "round" },
          ] },
        ],
        duration: 1400,
        markers: [{ id: "press", at: 150 }],
        tracks: [
          track("button", "scale", [[0, 1, "easeIn"], [150, 0.88, "easeOut"], [400, 1], [1400, 1]]),
          track("ring", "scale", [[0, 0.72], [150, 0.72, "easeOut"], [900, 1.05], [1400, 1.05]]),
          track("ring", "opacity", [[0, 0], [150, 0, "easeOut"], [250, 1], [900, 0, "easeOut"], [1400, 0]]),
        ],
        sounds: [{ id: "press", sound: "synth:click", marker: "press", gain: 0.7 }],
        reducedMotionFrame: 0,
      };
    case "waveform":
      return {
        name: "Live Waveform", label: "Audio waveform rippling", category: "visualizers", tags: ["waveform", "audio", "voice"],
        layers: [0, 1, 2, 3, 4, 5, 6].map((i): Layer => {
          const h = [10, 22, 34, 44, 34, 22, 10][i]!;
          const x = 11 + i * 7;
          return { id: `line-${i + 1}`, kind: "shape", shape: { type: "line", x1: x, y1: 32 - h / 2, x2: x, y2: 32 + h / 2 }, fill: "none", stroke: i === 3 ? accent : line, strokeWidth: 3.5, lineCap: "round", origin: [x, 32] };
        }),
        duration: 1400,
        markers: [{ id: "pulse", at: 0 }],
        tracks: [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = Math.abs(3 - i) * 100;
          return track(`line-${i + 1}`, "scaleY", [[0, 1], [d, 1, "easeOut"], [d + 250, 0.45, "easeInOut"], [d + 500, 1], [1400, 1]]);
        }),
        sounds: [{ id: "pulse", sound: "synth:pluck", marker: "pulse", gain: 0.5, params: { pitch: 0.9, decay: 0.7 } }],
        reducedMotionFrame: 0,
      };
    case "radio":
      return {
        name: "Retro Radio", label: "Retro radio with its tuning dial turning", category: "audio-gear", tags: ["radio", "retro", "broadcast"],
        layers: [
          path("antenna", "M24 20 L44 8"),
          { id: "antenna-tip", kind: "shape", shape: { type: "circle", cx: 44, cy: 8, r: 2.5 }, fill: accent, origin: [44, 8] },
          { id: "body", kind: "shape", shape: { type: "rect", x: 8, y: 20, width: 48, height: 32, rx: 6 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
          path("grille", "M15 30 H33 M15 36 H33 M15 42 H33", { strokeWidth: 2 }),
          { id: "dial", kind: "group", origin: [45, 36], children: [
            { id: "knob", kind: "shape", shape: { type: "circle", cx: 45, cy: 36, r: 6.5 }, fill: "none", stroke: line, strokeWidth: sw },
            path("pointer", "M45 36 L45 31", { stroke: accent }),
          ] },
        ],
        duration: 2400,
        markers: [{ id: "tune", at: 1200 }],
        tracks: [
          track("dial", "rotate", [[0, 0, "easeInOut"], [1200, 120, "easeInOut"], [2400, 0]]),
          track("antenna-tip", "scale", [[0, 1], [1100, 1, "easeOut"], [1250, 1.5, "easeInOut"], [1500, 1], [2400, 1]]),
        ],
        sounds: [{ id: "tune", sound: "synth:notify", marker: "tune", gain: 0.4, params: { pitch: 0.8 } }],
        reducedMotionFrame: 0,
      };
    case "drum":
      return {
        name: "Snare Drum", label: "Drumsticks hitting a snare drum", category: "instruments", tags: ["drum", "beat", "percussion"],
        layers: [
          { id: "shell", kind: "shape", shape: { type: "path", d: "M12 34 V48 Q32 58 52 48 V34" }, fill: { token: "fill" }, stroke: line, strokeWidth: sw, lineJoin: "round" },
          { id: "head", kind: "group", origin: [32, 34], children: [
            { id: "skin", kind: "shape", shape: { type: "ellipse", cx: 32, cy: 34, rx: 20, ry: 7 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
          ] },
          { id: "stick-l", kind: "group", origin: [10, 12], children: [path("stick-l-line", "M10 12 L29 31", { stroke: accent, strokeWidth: 3 })] },
          { id: "stick-r", kind: "group", origin: [54, 12], children: [path("stick-r-line", "M54 12 L36 31", { stroke: accent, strokeWidth: 3 })] },
        ],
        duration: 1000,
        markers: [{ id: "hit-1", at: 200 }, { id: "hit-2", at: 600 }],
        tracks: [
          track("stick-l", "rotate", [[0, -18, "easeIn"], [200, 0, "easeOut"], [400, -18], [1000, -18]]),
          track("stick-r", "rotate", [[0, 18], [400, 18, "easeIn"], [600, 0, "easeOut"], [800, 18], [1000, 18]]),
          track("head", "scaleY", [[0, 1], [200, 0.8, "easeOut"], [320, 1], [600, 0.8, "easeOut"], [720, 1], [1000, 1]]),
        ],
        sounds: [
          { id: "hit-1", sound: "synth:kick", marker: "hit-1", gain: 0.8, params: { pitch: 1.4 } },
          { id: "hit-2", sound: "synth:shutter", marker: "hit-2", gain: 0.6 },
        ],
        reducedMotionFrame: 200,
      };
    case "cassette":
      return {
        name: "Cassette Tape", label: "Cassette tape with spinning reels", category: "audio-gear", tags: ["cassette", "tape", "mixtape"],
        layers: [
          { id: "case", kind: "shape", shape: { type: "rect", x: 6, y: 14, width: 52, height: 36, rx: 5 }, fill: { token: "fill" }, stroke: line, strokeWidth: sw },
          path("window", "M18 24 H46 V36 H18 Z", { strokeWidth: 2 }),
          path("ramp", "M16 50 L20 42 H44 L48 50", { strokeWidth: 2 }),
          ...[24, 40].map((cx, i): Layer => ({
            id: `reel-${i + 1}`, kind: "group", origin: [cx, 30], children: [
              { id: `hub-${i + 1}`, kind: "shape", shape: { type: "circle", cx, cy: 30, r: 4 }, fill: "none", stroke: accent, strokeWidth: 2 },
              path(`teeth-${i + 1}`, `M${cx} 26 V34 M${cx - 4} 30 H${cx + 4}`, { stroke: accent, strokeWidth: 1.6 }),
            ],
          })),
        ],
        duration: 2000,
        markers: [{ id: "roll", at: 0 }],
        tracks: [track("reel-1", "rotate", [[0, 0], [2000, 360]]), track("reel-2", "rotate", [[0, 0], [2000, 360]])],
        sounds: [{ id: "roll", sound: "synth:click", marker: "roll", gain: 0.4, params: { pitch: 0.6 } }],
        reducedMotionFrame: 0,
      };
    case "mute":
      return {
        name: "Mute Toggle", label: "Speaker muted with a blinking cross", category: "controls", tags: ["mute", "silent", "volume off"],
        layers: [
          { id: "body", kind: "group", origin: [20, 32], children: [path("box", "M10 25 H18 L29 16 V48 L18 39 H10 Z", { fill: { token: "fill" } })] },
          { id: "cross", kind: "group", origin: [45, 32], children: [path("x", "M38 25 L52 39 M52 25 L38 39", { stroke: accent, strokeWidth: 3 })] },
        ],
        duration: 1400,
        markers: [{ id: "off", at: 200 }],
        tracks: [
          track("cross", "scale", [[0, 0.6, "easeOut"], [200, 1.15, "easeInOut"], [400, 1], [1400, 0.6]]),
          track("body", "translateX", [[0, 0], [200, 0, "easeOut"], [260, -1.5], [320, 1], [380, 0], [1400, 0]]),
        ],
        sounds: [{ id: "off", sound: "synth:click", marker: "off", gain: 0.6, params: { pitch: 0.5 } }],
        reducedMotionFrame: 400,
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
