/**
 * The timing rules shared by the component (and mirrored by the Flutter widget), kept free of React Native so they
 * can be tested on their own. The sound is one pre-mixed loop of the icon's cues, exactly as long as one animation
 * loop, so starting both together keeps every cue on its frame.
 */

/** "press": silent until tapped, then plays once (default — icons that make noise on their own get annoying).
 *  "always": plays with every animation loop. "off": never. */
export type DaosSoundMode = "off" | "press" | "always";

export interface IconState {
  soundMode: DaosSoundMode;
  muted: boolean;
  reducedMotion: boolean;
  autoplay: boolean;
  hasSound: boolean;
}

export interface SoundPort {
  /** From the start of the loop. */
  replay(): void;
  stop(): void;
}

export interface MotionPort {
  /** Animation from its first frame. */
  restart(): void;
}

export interface IconController {
  /** Once the Reduce Motion setting is known (and whenever it or autoplay changes). */
  start(): void;
  /** The animation wrapped around to its first frame. */
  loop(): void;
  /** The user tapped the icon. */
  press(): void;
  unmount(): void;
}

export function createIconController(state: () => IconState, ports: { sound: SoundPort; motion: MotionPort }): IconController {
  const audible = (s: IconState) => s.hasSound && !s.muted && s.soundMode !== "off";
  return {
    start() {
      const s = state();
      if (s.reducedMotion || !s.autoplay) return ports.sound.stop();
      ports.motion.restart();
      if (audible(s) && s.soundMode === "always") ports.sound.replay();
    },
    loop() {
      const s = state();
      if (!s.reducedMotion && audible(s) && s.soundMode === "always") ports.sound.replay();
    },
    press() {
      const s = state();
      // Reduced motion keeps the still frame; the tap still gives its sound as feedback.
      if (!s.reducedMotion) ports.motion.restart();
      if (audible(s)) ports.sound.replay();
    },
    unmount() {
      ports.sound.stop();
    },
  };
}
