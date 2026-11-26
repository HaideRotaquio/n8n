import { BEATING_HEART, type AssetDefinition } from "@sb/asset";
import { describe, expect, it } from "vitest";
import { iconSourceFiles, SOURCE_FORMATS } from "./source";

const HEART = BEATING_HEART as unknown as AssetDefinition;

describe("iconSourceFiles", () => {
  it("returns text files and a usage snippet for every developer format", () => {
    for (const f of SOURCE_FORMATS) {
      const s = iconSourceFiles(HEART, f);
      expect(s.files.length).toBeGreaterThan(0);
      expect(s.files.every((x) => typeof x.content === "string" && x.content.length > 0 && !x.path.includes(".."))).toBe(true);
      expect(s.usage.length).toBeGreaterThan(0);
    }
  });
  it("marks which formats need the player runtime", () => {
    expect(iconSourceFiles(HEART, "react").needsPlayer).toBe(true);
    expect(iconSourceFiles(HEART, "web-component").needsPlayer).toBe(true);
    expect(iconSourceFiles(HEART, "svg").needsPlayer).toBe(false);
    expect(JSON.parse(iconSourceFiles(HEART, "lottie").files[0]!.content)).toHaveProperty("layers");
  });

  it("native formats ship Lottie, a stereo-or-mono WAV loop and a typed wrapper", () => {
    const rn = iconSourceFiles(HEART, "react-native");
    expect(rn.files.map((f) => f.path)).toEqual(["beating-heart.lottie.json", "beating-heart.wav", "BeatingHeart.tsx"]);
    const wav = Buffer.from(rn.files[1]!.content, "base64");
    expect(rn.files[1]!.encoding).toBe("base64");
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(rn.files[2]!.content).toContain('require("./beating-heart.wav")');
    expect(rn.files[2]!.content).toContain(`durationMs={${HEART.timeline.duration}}`);
    const fl = iconSourceFiles(HEART, "flutter");
    expect(fl.files.map((f) => f.path)).toEqual(["beating-heart.lottie.json", "beating-heart.wav", "beating_heart_icon.dart"]);
    expect(fl.files[2]!.content).toContain("class BeatingHeartIcon extends StatelessWidget");
    expect(fl.files[2]!.content).toContain("'{{ICONS_DIR}}/beating-heart.wav'");
    const silent = { ...HEART, sounds: [] } as AssetDefinition;
    expect(iconSourceFiles(silent, "flutter").files.map((f) => f.path)).toEqual(["beating-heart.lottie.json", "beating_heart_icon.dart"]);
    expect(iconSourceFiles(silent, "flutter").files[1]!.content).toContain("sound: null");
  });
});
