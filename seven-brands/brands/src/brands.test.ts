import { BRAND_SLUGS, BrandConfig, checkThemeAccessibility } from "@sb/core";
import { describe, expect, it } from "vitest";
import { BRAND_DEFINITIONS } from "./index";

describe("brand definitions", () => {
  it("defines all seven brands", () => {
    expect(Object.keys(BRAND_DEFINITIONS).sort()).toEqual([...BRAND_SLUGS].sort());
  });

  it.each(BRAND_SLUGS)("%s has a valid config whose slug matches its key", (slug) => {
    const def = BRAND_DEFINITIONS[slug];
    expect(BrandConfig.parse(def.config).slug).toBe(slug);
  });

  it.each(BRAND_SLUGS)("%s theme meets WCAG AA text contrast", (slug) => {
    expect(checkThemeAccessibility(BRAND_DEFINITIONS[slug].config.theme)).toEqual([]);
  });

  it("brand identities are distinct (palette, layout, primary font)", () => {
    const defs = Object.values(BRAND_DEFINITIONS);
    const primaries = new Set(defs.map((d) => d.config.theme.tokens.primary));
    const layouts = new Set(defs.map((d) => d.config.layout));
    const headings = new Set(defs.map((d) => d.config.theme.fonts.heading));
    expect(primaries.size).toBe(7);
    expect(layouts.size).toBe(7);
    expect(headings.size).toBeGreaterThanOrEqual(6);
  });

  it("domains are unique across brands", () => {
    const all = Object.values(BRAND_DEFINITIONS).flatMap((d) => d.config.domains);
    expect(new Set(all).size).toBe(all.length);
  });

  it("child-safe mode is on only for LearnIcons", () => {
    const childSafe = Object.values(BRAND_DEFINITIONS)
      .filter((d) => d.config.features.childSafeMode)
      .map((d) => d.config.slug);
    expect(childSafe).toEqual(["learnicons"]);
  });

  it("only Moodicons and SonicGlyphs are in development at the start", () => {
    const active = Object.values(BRAND_DEFINITIONS)
      .filter((d) => d.initialStatus !== "planned")
      .map((d) => d.config.slug)
      .sort();
    expect(active).toEqual(["moodicons", "sonicglyphs"]);
  });
});
