import { runQa } from "@sb/asset";
import { describe, expect, it } from "vitest";
import { RIGS, starterSet } from "./index";

const all = Object.values(RIGS).flatMap((rig) => rig.variants.flatMap((v) => rig.palettes.map((p) => ({ rig: rig.id, v, p, ad: rig.build(v, p) }))));

describe("rigs", () => {
  it.each(all.map((x) => [`${x.rig} ${x.v} ${x.p}`, x] as const))("%s passes QA with no errors or warnings", (_, x) => {
    const r = runQa(x.ad);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.score).toBe(100);
  });
  it("produces unique slugs and the right brands", () => {
    const slugs = all.map((x) => `${x.ad.brand}/${x.ad.slug}`);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(all.filter((x) => x.rig.startsWith("moodicons")).every((x) => x.ad.brand === "moodicons")).toBe(true);
  });
  it("starter set has 9 Moodicons and 8 SonicGlyphs, each with sound", () => {
    const set = starterSet();
    expect(set.filter((a) => a.brand === "moodicons")).toHaveLength(9);
    expect(set.filter((a) => a.brand === "sonicglyphs")).toHaveLength(8);
    expect(set.every((a) => a.sounds.length > 0 && a.provenance.method === "rig")).toBe(true);
  });
});
