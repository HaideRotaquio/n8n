import { BEATING_HEART } from "@sb/asset";
import { describe, expect, it } from "vitest";
import { iconSourceFiles, SOURCE_FORMATS } from "./source";

describe("iconSourceFiles", () => {
  it("returns text files and a usage snippet for every developer format", () => {
    for (const f of SOURCE_FORMATS) {
      const s = iconSourceFiles(BEATING_HEART, f);
      expect(s.files.length).toBeGreaterThan(0);
      expect(s.files.every((x) => typeof x.content === "string" && x.content.length > 0 && !x.path.includes(".."))).toBe(true);
      expect(s.usage.length).toBeGreaterThan(0);
    }
  });
  it("marks which formats need the player runtime", () => {
    expect(iconSourceFiles(BEATING_HEART, "react").needsPlayer).toBe(true);
    expect(iconSourceFiles(BEATING_HEART, "web-component").needsPlayer).toBe(true);
    expect(iconSourceFiles(BEATING_HEART, "svg").needsPlayer).toBe(false);
    expect(JSON.parse(iconSourceFiles(BEATING_HEART, "lottie").files[0]!.content)).toHaveProperty("layers");
  });
});
