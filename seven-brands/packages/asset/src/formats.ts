/** What each export format can and cannot do. Shown to customers so no format is oversold. */
export type ExportFormat = "svg" | "svg-animated" | "png" | "gif" | "mp4" | "webm" | "wav" | "lottie" | "web-component" | "react" | "json";

export const FORMAT_CAPABILITIES: Record<ExportFormat, { animation: boolean; interactive: boolean; sound: boolean; note: string }> = {
  svg: { animation: false, interactive: false, sound: false, note: "Static vector (reduced-motion frame)" },
  "svg-animated": { animation: true, interactive: false, sound: false, note: "CSS-animated vector; hover-to-play variant included" },
  png: { animation: false, interactive: false, sound: false, note: "Static raster, transparent background" },
  gif: { animation: true, interactive: false, sound: false, note: "Max 256 colors, 1-bit transparency" },
  mp4: { animation: true, interactive: false, sound: true, note: "H.264 + AAC (stereo when the icon pans its sounds), no transparency" },
  webm: { animation: true, interactive: false, sound: true, note: "VP9 with alpha + Opus (stereo when the icon pans its sounds)" },
  lottie: { animation: true, interactive: false, sound: false, note: "Lottie JSON (60 fps, 512 px), checked against lottie-web; no sound or interactions in Lottie" },
  wav: { animation: false, interactive: false, sound: true, note: "Mixed sound track for one loop + cue sheet; stereo when sounds are panned" },
  "web-component": { animation: true, interactive: true, sound: true, note: "<daos-asset> element; sound after user click, panned left/right; scroll=\"scrub\" or \"in-view\" playback" },
  react: { animation: true, interactive: true, sound: true, note: "React wrapper around the Web Component (scroll and scrollLoops props)" },
  json: { animation: true, interactive: true, sound: true, note: "Asset Definition (for developers and apps)" },
};

