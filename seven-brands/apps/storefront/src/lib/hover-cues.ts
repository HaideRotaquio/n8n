import { cuePan, cueTime, type AssetDefinition } from "@sb/asset";
import type { HoverCue } from "@/components/sound";

/** The cues that play with the animation (not click-only ones, unless that is all there is), resolved to time and stereo position. */
export function hoverCues(ad: AssetDefinition | null | undefined): HoverCue[] {
  if (!ad) return [];
  const clickOnly = (id: string) => ad.interactions.some((i) => i.action === "playSound" && i.cue === id && i.on !== "load");
  // Like the exports: if every sound is interaction-only, the hover preview plays those.
  const timeline = ad.sounds.filter((c) => !clickOnly(c.id));
  return (timeline.length ? timeline : ad.sounds)
    .map((c) => ({ sound: c.sound, params: c.params, atMs: cueTime(c, ad.timeline), gain: c.gain, pan: cuePan(c, ad) }))
    .filter((c) => c.atMs <= ad.timeline.duration);
}
