import { describe, expect, it } from "vitest";
import { createIconController, type IconState } from "./controller";

function rig(over: Partial<IconState> = {}) {
  const log: string[] = [];
  const s: IconState = { soundMode: "press", muted: false, reducedMotion: false, autoplay: true, hasSound: true, ...over };
  const c = createIconController(() => s, { sound: { replay: () => log.push("sound"), stop: () => log.push("stop") }, motion: { restart: () => log.push("motion") } });
  return { c, s, log };
}

describe("icon controller", () => {
  it("press mode: silent while looping, tap replays motion and sound together", () => {
    const { c, log } = rig();
    c.start();
    c.loop();
    expect(log).toEqual(["motion"]);
    c.press();
    expect(log).toEqual(["motion", "motion", "sound"]);
  });

  it("always mode: sound starts with the animation and restarts on every loop", () => {
    const { c, log } = rig({ soundMode: "always" });
    c.start();
    c.loop();
    c.loop();
    expect(log).toEqual(["motion", "sound", "sound", "sound"]);
  });

  it("muted, off or silent icons never play sound, but a tap still replays the motion", () => {
    for (const over of [{ muted: true }, { soundMode: "off" as const }, { hasSound: false }]) {
      const { c, log } = rig({ soundMode: "always", ...over });
      c.start();
      c.loop();
      c.press();
      expect(log.filter((x) => x === "sound")).toEqual([]);
      expect(log).toContain("motion");
    }
  });

  it("reduced motion keeps the still frame; a tap only gives sound", () => {
    const { c, log } = rig({ soundMode: "always", reducedMotion: true });
    c.start();
    c.loop();
    c.press();
    expect(log).toEqual(["stop", "sound"]);
  });

  it("stops the sound on unmount", () => {
    const { c, log } = rig();
    c.unmount();
    expect(log).toEqual(["stop"]);
  });
});
