import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { finalize, heartPath, SPRING_SNAPPY, SPRING_SOFT, track } from "./util";

/**
 * Moodicons face rig — one parametric character that produces many consistent expressions.
 * Geometry lives on a 64×64 grid with a 2.5 px outline, matching the Moodicons style guide.
 */

export const FACE_EXPRESSIONS = ["happy", "laughing", "love", "sad", "crying", "angry", "surprised", "wink", "sleepy"] as const;
export type FaceExpression = (typeof FACE_EXPRESSIONS)[number];

export const FACE_PALETTES = {
  classic: { face: "#FFC83D", ink: "#2B1B12", blush: "#FF7A9A", accent: "#E8336D", tear: "#4FC3F7", fire: "#FF5A36" },
  pink: { face: "#FFB3C7", ink: "#3A1420", blush: "#FF6F91", accent: "#C81E5B", tear: "#4FC3F7", fire: "#FF5A36" },
  mint: { face: "#8EE3C8", ink: "#123B30", blush: "#FF8FA3", accent: "#E8336D", tear: "#3BA7E6", fire: "#FF5A36" },
  lilac: { face: "#C9B6FF", ink: "#231A3D", blush: "#FF8FB1", accent: "#E8336D", tear: "#4FC3F7", fire: "#FF5A36" },
} as const;
export type FacePalette = keyof typeof FACE_PALETTES;

const LABELS: Record<FaceExpression, { name: string; label: string; category: string; tags: string[] }> = {
  happy: { name: "Happy Face", label: "Smiling face bouncing happily", category: "happiness", tags: ["happy", "smile", "joy"] },
  laughing: { name: "Laughing Face", label: "Face laughing with mouth open", category: "happiness", tags: ["laugh", "lol", "funny"] },
  love: { name: "Heart Eyes", label: "Face with pulsing heart eyes", category: "love", tags: ["love", "crush", "heart"] },
  sad: { name: "Sad Face", label: "Sad face with drooping frown", category: "sadness", tags: ["sad", "down", "unhappy"] },
  crying: { name: "Crying Face", label: "Crying face with falling tear", category: "sadness", tags: ["cry", "tears", "sad"] },
  angry: { name: "Angry Face", label: "Angry face shaking with frown", category: "anger", tags: ["angry", "mad", "furious"] },
  surprised: { name: "Surprised Face", label: "Surprised face popping with open mouth", category: "surprise", tags: ["wow", "shock", "surprise"] },
  wink: { name: "Winking Face", label: "Smiling face winking", category: "reactions", tags: ["wink", "flirt", "playful"] },
  sleepy: { name: "Sleepy Face", label: "Sleepy face swaying with floating Z", category: "everyday", tags: ["sleep", "tired", "zzz"] },
};

const ink = { token: "ink" } as const;
const stroke = (id: string, d: string, width = 3): Layer => ({ id, kind: "shape", shape: { type: "path", d }, fill: "none", stroke: ink, strokeWidth: width, lineCap: "round", lineJoin: "round" });
const dot = (id: string, cx: number, cy: number, rr = 3.5): Layer => ({ id, kind: "shape", shape: { type: "circle", cx, cy, r: rr }, fill: ink });

function eyes(e: FaceExpression): Layer[] {
  switch (e) {
    case "happy":
    case "laughing":
      return [stroke("eye-l", "M17 28 Q21.5 22 26 28"), stroke("eye-r", "M38 28 Q42.5 22 47 28")];
    case "love":
      return [
        { id: "eye-l", kind: "shape", shape: { type: "path", d: heartPath(21.5, 26, 12) }, fill: { token: "accent" }, origin: [21.5, 26] },
        { id: "eye-r", kind: "shape", shape: { type: "path", d: heartPath(42.5, 26, 12) }, fill: { token: "accent" }, origin: [42.5, 26] },
      ];
    case "sad":
    case "crying":
      return [dot("eye-l", 22, 29, 3), dot("eye-r", 42, 29, 3), stroke("brow-l", "M16 22 Q20 19 26 21", 2.5), stroke("brow-r", "M38 21 Q44 19 48 22", 2.5)];
    case "angry":
      return [dot("eye-l", 22, 30, 3), dot("eye-r", 42, 30, 3), stroke("brow-l", "M15 21 L27 26", 3), stroke("brow-r", "M49 21 L37 26", 3)];
    case "surprised":
      return [dot("eye-l", 22, 26, 4.5), dot("eye-r", 42, 26, 4.5)];
    case "wink":
      return [stroke("eye-l", "M17 28 Q21.5 23 26 28"), { ...dot("eye-r", 42, 27, 3.5), origin: [42, 27] }];
    case "sleepy":
      return [stroke("eye-l", "M17 29 Q21.5 32 26 29"), stroke("eye-r", "M38 29 Q42.5 32 47 29")];
  }
}

function mouth(e: FaceExpression): Layer[] {
  switch (e) {
    case "happy":
    case "love":
    case "wink":
      return [stroke("mouth", "M20 39 Q32 50 44 39")];
    case "laughing":
      return [
        { id: "mouth", kind: "shape", shape: { type: "path", d: "M17 36 Q32 58 47 36 Z" }, fill: ink, stroke: ink, strokeWidth: 2, lineJoin: "round" },
        { id: "tongue", kind: "shape", shape: { type: "path", d: "M25 46.5 Q32 52 39 46.5 Q32 43 25 46.5 Z" }, fill: { token: "accent" } },
      ];
    case "sad":
    case "crying":
      return [stroke("mouth", "M22 47 Q32 39 42 47")];
    case "angry":
      return [stroke("mouth", "M23 46 Q32 41 41 46")];
    case "surprised":
      return [{ id: "mouth", kind: "shape", shape: { type: "ellipse", cx: 32, cy: 44, rx: 5, ry: 6.5 }, fill: ink, origin: [32, 44] }];
    case "sleepy":
      return [{ id: "mouth", kind: "shape", shape: { type: "ellipse", cx: 32, cy: 44, rx: 3, ry: 2.5 }, fill: ink }];
  }
}

function extras(e: FaceExpression): Layer[] {
  const blush: Layer[] = [
    { id: "blush-l", kind: "shape", shape: { type: "ellipse", cx: 15.5, cy: 37, rx: 4.5, ry: 2.6 }, fill: { token: "blush" }, opacity: 0.65 },
    { id: "blush-r", kind: "shape", shape: { type: "ellipse", cx: 48.5, cy: 37, rx: 4.5, ry: 2.6 }, fill: { token: "blush" }, opacity: 0.65 },
  ];
  switch (e) {
    case "happy":
    case "love":
    case "wink":
    case "laughing":
      return blush;
    case "crying":
      return [{ id: "tear", kind: "shape", shape: { type: "path", d: "M44 33 Q40.5 39 44 41.5 Q47.5 39 44 33 Z" }, fill: { token: "tear" } }];
    case "angry":
      return [{ id: "vein", kind: "shape", shape: { type: "path", d: "M47 9 L50 12 M53 9 L50 12 M47 15 L50 12 M53 15 L50 12" }, fill: "none", stroke: { token: "fire" }, strokeWidth: 2.2, lineCap: "round" }];
    case "sleepy":
      return [{ id: "zzz", kind: "shape", shape: { type: "polyline", points: "47 8 54 8 47 15 54 15" }, fill: "none", stroke: ink, strokeWidth: 2.2, lineCap: "round", lineJoin: "round", origin: [50.5, 11.5] }];
    default:
      return [];
  }
}

interface MotionSpec {
  duration: number;
  tracks: Track[];
  sounds: SoundCue[];
  markers: { id: string; at: number }[];
  reducedMotionFrame: number;
}

function motion(e: FaceExpression): MotionSpec {
  switch (e) {
    case "happy":
      return {
        duration: 1000,
        markers: [{ id: "land", at: 420 }],
        tracks: [
          track("face", "translateY", [[0, 0, "easeOut"], [240, -3, "easeIn"], [420, 0], [1000, 0]]),
          track("face", "scaleY", [[0, 1], [400, 1, "easeOut"], [470, 0.93, SPRING_SOFT], [1000, 1]]),
        ],
        sounds: [{ id: "pop", sound: "synth:pop", marker: "land", gain: 0.8, params: { pitch: 1.1 } }],
        reducedMotionFrame: 0,
      };
    case "laughing":
      return {
        duration: 900,
        markers: [{ id: "laugh", at: 0 }],
        tracks: [track("face", "rotate", [[0, 0, "easeInOut"], [150, -7, "easeInOut"], [300, 6, "easeInOut"], [450, -5, "easeInOut"], [600, 3, "easeInOut"], [750, 0], [900, 0]]),
          track("face", "translateY", [[0, 0, "easeInOut"], [150, -1.5, "easeInOut"], [300, 0, "easeInOut"], [450, -1.5, "easeInOut"], [600, 0], [900, 0]])],
        sounds: [{ id: "giggle", sound: "synth:pluck", marker: "laugh", gain: 0.7, params: { pitch: 1.5, decay: 0.5 } }],
        reducedMotionFrame: 0,
      };
    case "love":
      return {
        duration: 1000,
        markers: [{ id: "beat", at: 0 }],
        tracks: [
          track("eye-l", "scale", [[0, 1, "easeOut"], [110, 1.28, SPRING_SOFT], [700, 1], [1000, 1]]),
          track("eye-r", "scale", [[0, 1, "easeOut"], [110, 1.28, SPRING_SOFT], [700, 1], [1000, 1]]),
        ],
        sounds: [{ id: "beat", sound: "synth:heartbeat", marker: "beat", gain: 0.9 }],
        reducedMotionFrame: 110,
      };
    case "sad":
      return {
        duration: 2000,
        markers: [{ id: "sigh", at: 0 }],
        tracks: [track("face", "translateY", [[0, 0, "easeInOut"], [1000, 2.5, "easeInOut"], [2000, 0]]), track("face", "rotate", [[0, 0, "easeInOut"], [1000, -3, "easeInOut"], [2000, 0]])],
        sounds: [{ id: "sigh", sound: "synth:bell", marker: "sigh", gain: 0.5, params: { pitch: 0.5, decay: 0.8 } }],
        reducedMotionFrame: 1000,
      };
    case "crying":
      return {
        duration: 1400,
        markers: [{ id: "drop", at: 900 }],
        tracks: [
          track("tear", "translateY", [[0, 0], [200, 0, "easeIn"], [900, 18], [1400, 18]]),
          track("tear", "opacity", [[0, 0, "easeOut"], [200, 1], [800, 1, "easeIn"], [900, 0], [1400, 0]]),
        ],
        sounds: [{ id: "drop", sound: "synth:pop", marker: "drop", gain: 0.5, params: { pitch: 1.6, decay: 0.6 } }],
        reducedMotionFrame: 400,
      };
    case "angry":
      return {
        duration: 900,
        markers: [{ id: "huff", at: 0 }],
        tracks: [
          track("face", "translateX", [[0, 0], [60, -2], [120, 2], [180, -2], [240, 2], [300, -1], [360, 0], [900, 0]]),
          track("vein", "scale", [[0, 1, "easeOut"], [120, 1.3, SPRING_SNAPPY], [500, 1], [900, 1]]),
        ],
        sounds: [{ id: "huff", sound: "synth:kick", marker: "huff", gain: 0.8, params: { pitch: 1.3 } }],
        reducedMotionFrame: 0,
      };
    case "surprised":
      return {
        duration: 1200,
        markers: [{ id: "gasp", at: 0 }],
        tracks: [
          track("face", "scale", [[0, 0.92, "easeOut"], [100, 1.08, SPRING_SOFT], [700, 1], [1200, 0.92]]),
          track("mouth", "scaleY", [[0, 0.6, "easeOut"], [120, 1.15, SPRING_SOFT], [700, 1], [1200, 0.6]]),
        ],
        sounds: [{ id: "gasp", sound: "synth:pop", marker: "gasp", gain: 0.8, params: { pitch: 1.4 } }],
        reducedMotionFrame: 700,
      };
    case "wink":
      return {
        duration: 1600,
        markers: [{ id: "wink", at: 500 }],
        tracks: [track("eye-r", "scaleY", [[0, 1], [440, 1, "easeIn"], [500, 0.1, "easeOut"], [620, 1], [1600, 1]]), track("face", "rotate", [[0, 0, "easeInOut"], [500, -4, "easeInOut"], [900, 0], [1600, 0]])],
        sounds: [{ id: "click", sound: "synth:click", marker: "wink", gain: 0.7 }],
        reducedMotionFrame: 0,
      };
    case "sleepy":
      return {
        duration: 2400,
        markers: [{ id: "snore", at: 0 }],
        tracks: [
          track("face", "rotate", [[0, 0, "easeInOut"], [1200, 4, "easeInOut"], [2400, 0]]),
          track("zzz", "translateY", [[0, 4, "easeOut"], [2000, -6], [2400, 4]]),
          track("zzz", "opacity", [[0, 0, "easeOut"], [500, 1], [1700, 1, "easeIn"], [2000, 0], [2400, 0]]),
        ],
        sounds: [{ id: "snore", sound: "synth:whoosh", marker: "snore", gain: 0.35, params: { pitch: 0.5, decay: 2 } }],
        reducedMotionFrame: 900,
      };
  }
}

export interface FaceRigParams {
  expression: FaceExpression;
  palette?: FacePalette;
}

export function buildFace({ expression, palette = "classic" }: FaceRigParams): AssetDefinition {
  const m = motion(expression);
  const meta = LABELS[expression];
  const faceGroup: Layer = {
    id: "face",
    kind: "group",
    origin: [32, 58],
    children: [
      { id: "head", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 27 }, fill: { token: "face" }, stroke: ink, strokeWidth: 2.5 },
      ...extras(expression).filter((l) => l.id.startsWith("blush")),
      ...eyes(expression),
      ...mouth(expression),
    ],
  };
  const floating = extras(expression).filter((l) => !l.id.startsWith("blush"));
  // Face-level rotations pivot at the chin; scale pivots at the centre.
  if (m.tracks.some((t) => t.target === "face" && (t.property === "scale" || t.property === "scaleY"))) faceGroup.origin = [32, 46];
  const slug = palette === "classic" ? `face-${expression}` : `face-${expression}-${palette}`;
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug,
    name: palette === "classic" ? meta.name : `${meta.name} (${palette})`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...FACE_PALETTES[palette] },
    layers: [faceGroup, ...floating],
    timeline: { duration: m.duration, loop: true, tracks: m.tracks, markers: m.markers },
    sounds: m.sounds,
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: meta.label, reducedMotionFrame: m.reducedMotionFrame },
    tags: [...meta.tags, "face", "emoji", palette],
    category: meta.category,
    provenance: { method: "rig", rig: "moodicons-face@1" },
  });
}
