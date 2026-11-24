import type { AssetDefinitionInput } from "./schema";

/** Small hand-written asset used by tests and docs. */
export const BEATING_HEART: AssetDefinitionInput = {
  schema: "daos.asset/1",
  brand: "moodicons",
  slug: "beating-heart",
  name: "Beating Heart",
  viewBox: [0, 0, 64, 64],
  tokens: { primary: "#E8336D", highlight: "#FFFFFF" },
  layers: [
    {
      id: "heart",
      kind: "group",
      origin: [32, 34],
      children: [
        {
          id: "heart-body",
          kind: "shape",
          shape: { type: "path", d: "M32 54 C14 42 6 32 6 21 A12 12 0 0 1 32 15 A12 12 0 0 1 58 21 C58 32 50 42 32 54 Z" },
          fill: { token: "primary" },
        },
        { id: "shine", kind: "shape", shape: { type: "ellipse", cx: 20, cy: 22, rx: 4, ry: 2.5 }, fill: { token: "highlight" }, opacity: 0.6 },
      ],
    },
  ],
  timeline: {
    duration: 1000,
    loop: true,
    markers: [{ id: "beat", at: 0 }],
    tracks: [
      {
        target: "heart",
        property: "scale",
        keyframes: [
          { at: 0, value: 1, ease: "easeOut" },
          { at: 120, value: 1.18, ease: { spring: { stiffness: 300, damping: 18, mass: 1 } } },
          { at: 700, value: 1 },
          { at: 1000, value: 1 },
        ],
      },
    ],
  },
  sounds: [{ id: "thump", sound: "synth:heartbeat", marker: "beat", gain: 0.9 }],
  interactions: [
    { on: "load", action: "play" },
    { on: "click", action: "playSound", cue: "thump" },
  ],
  a11y: { label: "Beating red heart", reducedMotionFrame: 0 },
  tags: ["love", "heart"],
  category: "love",
  provenance: { method: "manual" },
};
