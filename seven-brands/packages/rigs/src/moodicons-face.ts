import { clayGradients, specular, sphereLight, type Sphere } from "./soft3d";

const FACE: Sphere = { cx: 32, cy: 32, r: 27 };
import type { AssetDefinition, Layer, SoundCue, Track } from "@sb/asset";
import { FACE_VOICES, voiced } from "./voices";
import { finalize, heartPath, SPRING_SNAPPY, SPRING_SOFT, track } from "./util";

/**
 * Moodicons face rig — one parametric character that produces many consistent expressions.
 * Geometry lives on a 64×64 grid with a 2.5 px outline, matching the Moodicons style guide.
 */

export const FACE_EXPRESSIONS = ["happy", "laughing", "love", "sad", "crying", "angry", "surprised", "wink", "sleepy", "cool", "thinking", "party", "shy", "nervous", "kiss"] as const;
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
  cool: { name: "Cool Face", label: "Smirking face nodding in sunglasses", category: "reactions", tags: ["cool", "sunglasses", "chill"] },
  thinking: { name: "Thinking Face", label: "Face looking up while thought bubbles appear", category: "everyday", tags: ["think", "hmm", "idea"] },
  party: { name: "Party Face", label: "Party face in a hat with falling confetti", category: "celebration", tags: ["party", "birthday", "celebrate"] },
  shy: { name: "Shy Face", label: "Shy face looking down with glowing blush", category: "love", tags: ["shy", "blush", "cute"] },
  nervous: { name: "Nervous Face", label: "Nervous face with darting eyes and a sweat drop", category: "everyday", tags: ["nervous", "awkward", "sweat"] },
  kiss: { name: "Kissing Face", label: "Face blowing a kiss with a floating heart", category: "love", tags: ["kiss", "love", "mwah"] },
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
    case "cool":
      return [
        {
          id: "glasses",
          kind: "group",
          children: [
            { id: "lens", kind: "shape", shape: { type: "path", d: "M13 23 H29 Q29 33 21.5 33 Q13 33 13 23 Z M35 23 H51 Q51 33 43.5 33 Q35 33 35 23 Z" }, fill: ink },
            stroke("bridge", "M29 24.5 H35", 2.5),
            { id: "shine", kind: "shape", shape: { type: "path", d: "M16.5 25.5 L19.5 25.5 M38.5 25.5 L41.5 25.5" }, fill: "none", stroke: { token: "blush" }, strokeWidth: 1.8, lineCap: "round" },
          ],
        },
      ];
    case "thinking":
      return [dot("eye-l", 24, 25, 3), dot("eye-r", 44, 25, 3), stroke("brow-r", "M38 18 Q43 15 48 18", 2.5)];
    case "party":
      return [stroke("eye-l", "M17 29 Q21.5 23 26 29"), stroke("eye-r", "M38 29 Q42.5 23 47 29")];
    case "shy":
      return [stroke("eye-l", "M17 30 Q21.5 33.5 26 30"), stroke("eye-r", "M38 30 Q42.5 33.5 47 30")];
    case "nervous":
      return [dot("eye-l", 22, 28, 3.6), dot("eye-r", 42, 28, 3.6)];
    case "kiss":
      return [stroke("eye-l", "M17 28 Q21.5 22 26 28"), stroke("eye-r", "M38 28 Q42.5 22 47 28")];
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
    case "cool":
      return [stroke("mouth", "M23 43 Q33 47 42 39")];
    case "thinking":
      return [stroke("mouth", "M25 45 L38 42")];
    case "party":
      return [
        { id: "mouth", kind: "shape", shape: { type: "path", d: "M19 37 Q32 55 45 37 Z" }, fill: ink, stroke: ink, strokeWidth: 2, lineJoin: "round" },
        { id: "tongue", kind: "shape", shape: { type: "path", d: "M26 45 Q32 50 38 45 Q32 42 26 45 Z" }, fill: { token: "accent" } },
      ];
    case "shy":
      return [stroke("mouth", "M26 43 Q29 40.5 32 43 Q35 45.5 38 43", 2.5)];
    case "nervous":
      return [stroke("mouth", "M21 44 L25.5 41 L30 44 L34.5 41 L39 44 L43.5 41", 2.5)];
    case "kiss":
      return [stroke("mouth", "M30 38 Q36.5 40.5 31.5 43 Q36.5 45.5 30 48", 2.8)];
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
    case "thinking":
      return [
        { id: "bubble-1", kind: "shape", shape: { type: "circle", cx: 55, cy: 14.5, r: 1.8 }, fill: { token: "accent" } },
        { id: "bubble-2", kind: "shape", shape: { type: "circle", cx: 59, cy: 7.5, r: 2.6 }, fill: { token: "accent" } },
      ];
    case "party":
      return [
        { id: "hat", kind: "shape", shape: { type: "polygon", points: "10.5 19.5 31.5 9.5 14 1" }, fill: { token: "accent" }, stroke: ink, strokeWidth: 2, lineJoin: "round" },
        { id: "confetti-1", kind: "shape", shape: { type: "rect", x: 46, y: 5, width: 3.5, height: 3.5, rx: 0.8 }, fill: { token: "accent" } },
        { id: "confetti-2", kind: "shape", shape: { type: "circle", cx: 56, cy: 9, r: 2 }, fill: { token: "tear" } },
        { id: "confetti-3", kind: "shape", shape: { type: "rect", x: 52, y: 1.5, width: 3, height: 3, rx: 0.8 }, fill: { token: "blush" } },
      ];
    case "shy":
      return [
        { id: "blush-l", kind: "shape", shape: { type: "ellipse", cx: 15.5, cy: 37.5, rx: 5.5, ry: 3.2 }, fill: { token: "blush" }, opacity: 0.8 },
        { id: "blush-r", kind: "shape", shape: { type: "ellipse", cx: 48.5, cy: 37.5, rx: 5.5, ry: 3.2 }, fill: { token: "blush" }, opacity: 0.8 },
      ];
    case "nervous":
      return [{ id: "sweat", kind: "shape", shape: { type: "path", d: "M52 14 Q48.5 20 52 22.5 Q55.5 20 52 14 Z" }, fill: { token: "tear" } }];
    case "kiss":
      return [
        ...blush,
        { id: "kiss-heart", kind: "shape", shape: { type: "path", d: heartPath(50, 34, 10) }, fill: { token: "accent" }, origin: [50, 34] },
      ];
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
    case "cool":
      return {
        duration: 1600,
        markers: [{ id: "nod", at: 300 }],
        tracks: [
          track("face", "rotate", [[0, 0, "easeInOut"], [300, -5, "easeInOut"], [650, 2, "easeInOut"], [900, 0], [1600, 0]]),
          track("glasses", "translateY", [[0, 0, "easeOut"], [300, 2.5, "easeInOut"], [700, 0], [1600, 0]]),
        ],
        sounds: [{ id: "nod", sound: "synth:click", marker: "nod", gain: 0.6, params: { pitch: 0.7 } }],
        reducedMotionFrame: 0,
      };
    case "thinking":
      return {
        duration: 1800,
        markers: [{ id: "idea", at: 300 }],
        tracks: [
          track("bubble-1", "opacity", [[0, 0, "easeOut"], [300, 1], [1300, 1, "easeIn"], [1600, 0], [1800, 0]]),
          track("bubble-2", "opacity", [[0, 0], [500, 0, "easeOut"], [800, 1], [1300, 1, "easeIn"], [1600, 0], [1800, 0]]),
          track("face", "rotate", [[0, 0, "easeInOut"], [900, 3, "easeInOut"], [1800, 0]]),
        ],
        sounds: [{ id: "idea", sound: "synth:pluck", marker: "idea", gain: 0.5, params: { pitch: 1.2, decay: 0.6 }, panFrom: "bubble-1" }],
        reducedMotionFrame: 900,
      };
    case "party":
      return {
        duration: 1400,
        markers: [{ id: "toot", at: 0 }],
        tracks: [
          track("face", "translateY", [[0, 0, "easeOut"], [200, -3, "easeIn"], [400, 0], [600, -2, "easeIn"], [800, 0], [1400, 0]]),
          track("confetti-1", "translateY", [[0, 0, "easeIn"], [1200, 22], [1400, 22]]),
          track("confetti-1", "opacity", [[0, 0, "easeOut"], [150, 1], [900, 1, "easeIn"], [1200, 0], [1400, 0]]),
          track("confetti-2", "translateY", [[0, 0, "easeIn"], [1100, 18], [1400, 18]]),
          track("confetti-2", "opacity", [[0, 0, "easeOut"], [150, 1], [800, 1, "easeIn"], [1100, 0], [1400, 0]]),
          track("confetti-3", "translateY", [[0, 0, "easeIn"], [1300, 26], [1400, 26]]),
          track("confetti-3", "opacity", [[0, 0, "easeOut"], [150, 1], [1000, 1, "easeIn"], [1300, 0], [1400, 0]]),
        ],
        sounds: [{ id: "toot", sound: "synth:chime", marker: "toot", gain: 0.6, params: { pitch: 1.2 } }],
        reducedMotionFrame: 300,
      };
    case "shy":
      return {
        duration: 2000,
        markers: [{ id: "blush", at: 500 }],
        tracks: [
          track("face", "rotate", [[0, 0, "easeInOut"], [700, -6, "easeInOut"], [1400, -6, "easeInOut"], [2000, 0]]),
          track("blush-l", "opacity", [[0, 0.5, "easeInOut"], [700, 0.95, "easeInOut"], [1400, 0.95, "easeInOut"], [2000, 0.5]]),
          track("blush-r", "opacity", [[0, 0.5, "easeInOut"], [700, 0.95, "easeInOut"], [1400, 0.95, "easeInOut"], [2000, 0.5]]),
        ],
        sounds: [{ id: "blush", sound: "synth:chime", marker: "blush", gain: 0.35, params: { pitch: 1.5, decay: 0.7 } }],
        reducedMotionFrame: 700,
      };
    case "nervous":
      return {
        duration: 1600,
        markers: [{ id: "gulp", at: 800 }],
        tracks: [
          track("eye-l", "translateX", [[0, 0, "easeInOut"], [200, -2.5], [500, -2.5, "easeInOut"], [700, 2.5], [1000, 2.5, "easeInOut"], [1200, 0], [1600, 0]]),
          track("eye-r", "translateX", [[0, 0, "easeInOut"], [200, -2.5], [500, -2.5, "easeInOut"], [700, 2.5], [1000, 2.5, "easeInOut"], [1200, 0], [1600, 0]]),
          track("sweat", "translateY", [[0, 0], [300, 0, "easeIn"], [1300, 10], [1600, 10]]),
          track("sweat", "opacity", [[0, 0, "easeOut"], [300, 1], [1100, 1, "easeIn"], [1300, 0], [1600, 0]]),
        ],
        sounds: [{ id: "gulp", sound: "synth:pop", marker: "gulp", gain: 0.45, params: { pitch: 0.8, decay: 0.5 } }],
        reducedMotionFrame: 600,
      };
    case "kiss":
      return {
        duration: 1600,
        markers: [{ id: "mwah", at: 200 }],
        tracks: [
          track("face", "rotate", [[0, 0, "easeOut"], [200, -4, "easeInOut"], [600, 0], [1600, 0]]),
          track("kiss-heart", "translateY", [[0, 0], [200, 0, "easeOut"], [1300, -20], [1600, -20]]),
          track("kiss-heart", "translateX", [[0, 0], [200, 0, "easeOut"], [1300, 4], [1600, 4]]),
          track("kiss-heart", "opacity", [[0, 0], [200, 0, "easeOut"], [400, 1], [1000, 1, "easeIn"], [1300, 0], [1600, 0]]),
        ],
        sounds: [{ id: "mwah", sound: "synth:pop", marker: "mwah", gain: 0.7, params: { pitch: 1.25 }, panFrom: "kiss-heart" }],
        reducedMotionFrame: 500,
      };
  }
}

export interface FaceRigParams {
  expression: FaceExpression;
  palette?: FacePalette;
  style?: "flat" | "3d";
}

export function buildFace({ expression, palette = "classic", style = "flat" }: FaceRigParams): AssetDefinition {
  const m = motion(expression);
  const meta = LABELS[expression];
  const faceGroup: Layer = {
    id: "face",
    kind: "group",
    origin: [32, 58],
    children: [
      { id: "head", kind: "shape", shape: { type: "circle", cx: 32, cy: 32, r: 27 }, fill: { token: "face" }, stroke: ink, strokeWidth: 2.5 },
      ...(style === "3d" ? [sphereLight("head-lit", "head", FACE), specular("spec-head", FACE).layer] : []),
      ...extras(expression).filter((l) => l.id.startsWith("blush") || l.id === "hat"),
      ...eyes(expression),
      ...mouth(expression),
    ],
  };
  const floating = extras(expression).filter((l) => !l.id.startsWith("blush") && l.id !== "hat");
  // Face-level rotations pivot at the chin; scale pivots at the centre.
  if (m.tracks.some((t) => t.target === "face" && (t.property === "scale" || t.property === "scaleY"))) faceGroup.origin = [32, 46];
  const slug = `${palette === "classic" ? `face-${expression}` : `face-${expression}-${palette}`}${style === "3d" ? "-3d" : ""}`;
  return finalize({
    schema: "daos.asset/1",
    brand: "moodicons",
    slug,
    name: `${meta.name}${palette === "classic" ? "" : ` (${palette})`}${style === "3d" ? " (3D)" : ""}`,
    viewBox: [0, 0, 64, 64],
    tokens: { ...FACE_PALETTES[palette] },
    gradients: style === "3d" ? (() => { const { layer: _l, ...spec } = specular("spec-head", FACE); return clayGradients({ head: FACE }, [spec]); })() : [],
    layers: [faceGroup, ...floating],
    timeline: { duration: m.duration, loop: true, tracks: m.tracks, markers: m.markers },
    sounds: voiced(m.sounds, FACE_VOICES[expression] ?? []),
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: meta.label, reducedMotionFrame: m.reducedMotionFrame },
    tags: [...meta.tags, "face", "emoji", ...(style === "3d" ? ["3d"] : []), palette],
    category: meta.category,
    provenance: { method: "rig", rig: style === "3d" ? "moodicons-face-3d@1" : "moodicons-face@1" },
  });
}
