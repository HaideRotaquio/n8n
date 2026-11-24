import type { Concept, MotionPlan, SvgDraft } from "./agents";

/**
 * Hand-written stand-in outputs for the three agents ("Sparkle Star" for Moodicons).
 * Used by tests and by the explicit fixture mode (DAOS_AI_PROVIDER=fixture) so the whole
 * production flow can be exercised without an API key. Assets made this way are labelled
 * provenance "fixture" everywhere — they are not AI output.
 */

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export const FIXTURE_CONCEPT: Concept = {
  name: "Sparkle Star",
  slug: "sparkle-star",
  category: "celebration",
  tags: ["star", "sparkle", "win", "celebrate", "shine"],
  artwork: "A chubby five-point yellow star with a small smile, centred, with two tiny four-point sparkles top-left and right.",
  animatableParts: ["star", "sparkle-a", "sparkle-b"],
  motion: "Star pops (scale 1 → 1.15 spring) at 0 ms with a small wiggle; sparkles twinkle in turn; loop 1400 ms.",
  sound: "Bright chime exactly when the star pops.",
  accessibleLabel: "Smiling star sparkling",
};

const sparkle = (id: string, cx: number, cy: number, s: number) =>
  `<path id="${id}" d="M${cx} ${cy - s} L${cx + s * 0.3} ${cy - s * 0.3} L${cx + s} ${cy} L${cx + s * 0.3} ${cy + s * 0.3} L${cx} ${cy + s} L${cx - s * 0.3} ${cy + s * 0.3} L${cx - s} ${cy} L${cx - s * 0.3} ${cy - s * 0.3} Z" fill="#E8336D"/>`;

export const FIXTURE_SVG: SvgDraft = {
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g id="star">
    <polygon id="star-body" points="${starPoints(32, 35, 24, 11.5)}" fill="#FFC83D" stroke="#2B1B12" stroke-width="2.5" stroke-linejoin="round"/>
    <circle id="eye-l" cx="27.5" cy="33" r="2.2" fill="#2B1B12"/>
    <circle id="eye-r" cx="36.5" cy="33" r="2.2" fill="#2B1B12"/>
    <path id="smile" d="M28 39 Q32 43 36 39" fill="none" stroke="#2B1B12" stroke-width="2.2" stroke-linecap="round"/>
  </g>
  ${sparkle("sparkle-a", 12, 13, 5)}
  ${sparkle("sparkle-b", 54, 18, 4)}
</svg>`,
  notes: "Star built from a 10-point polygon; sparkles are separate paths so they can twinkle.",
};

export const FIXTURE_PLAN: MotionPlan = {
  durationMs: 1400,
  tracks: [
    { target: "star", property: "scale", origin: [32, 35], keyframes: [{ at: 0, value: 0.9, ease: "easeOut" }, { at: 120, value: 1.15, ease: "springSoft" }, { at: 800, value: 1, ease: "easeInOut" }, { at: 1400, value: 0.9, ease: "linear" }] },
    { target: "star", property: "rotate", origin: [32, 35], keyframes: [{ at: 0, value: 0, ease: "easeInOut" }, { at: 200, value: -8, ease: "easeInOut" }, { at: 400, value: 6, ease: "easeInOut" }, { at: 600, value: 0, ease: "linear" }, { at: 1400, value: 0, ease: "linear" }] },
    { target: "sparkle-a", property: "opacity", origin: [12, 13], keyframes: [{ at: 0, value: 0.2, ease: "easeOut" }, { at: 200, value: 1, ease: "easeIn" }, { at: 700, value: 0.2, ease: "linear" }, { at: 1400, value: 0.2, ease: "linear" }] },
    { target: "sparkle-b", property: "opacity", origin: [54, 18], keyframes: [{ at: 0, value: 0.2, ease: "linear" }, { at: 400, value: 0.2, ease: "easeOut" }, { at: 600, value: 1, ease: "easeIn" }, { at: 1100, value: 0.2, ease: "linear" }, { at: 1400, value: 0.2, ease: "linear" }] },
  ],
  markers: [{ id: "pop", at: 0 }],
  sounds: [{ marker: "pop", preset: "chime", pitch: 1.2, gain: 0.7 }],
  stillFrameMs: 140,
};

export const FIXTURE_OUTPUTS = {
  creative_director: [FIXTURE_CONCEPT],
  svg_artist: [FIXTURE_SVG],
  animator: [FIXTURE_PLAN],
};
