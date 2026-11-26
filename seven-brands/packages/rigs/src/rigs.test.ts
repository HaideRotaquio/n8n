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
  it("has launch volume: ~60 Moodicons and ~40 SonicGlyphs across palettes", () => {
    expect(all.filter((x) => x.ad.brand === "moodicons").length).toBeGreaterThanOrEqual(60);
    expect(all.filter((x) => x.ad.brand === "sonicglyphs").length).toBeGreaterThanOrEqual(40);
  });
  it("produces unique slugs and the right brands", () => {
    const slugs = all.map((x) => `${x.ad.brand}/${x.ad.slug}`);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(all.filter((x) => x.rig.startsWith("moodicons")).every((x) => x.ad.brand === "moodicons")).toBe(true);
  });
  it("starter set covers every rig variant once, each with sound", () => {
    const set = starterSet();
    expect(set.filter((a) => a.brand === "moodicons")).toHaveLength(1132); // 15 faces ×2 styles + 8 stickers + 6 Bawal signs + 544 chibi ×2 styles
    expect(set.filter((a) => a.brand === "sonicglyphs")).toHaveLength(14);
    expect(set.every((a) => a.sounds.length > 0 && a.provenance.method === "rig")).toBe(true);
  });
});

describe("launch catalog", async () => {
  const { launchCatalog } = await import("./launch");
  it.each(["moodicons", "sonicglyphs"])("%s plan references only rig assets, valid packs and the brand's licenses", (brand) => {
    const slugs = new Set(all.filter((x) => x.ad.brand === brand && !RIGS[x.rig]!.preview).map((x) => x.ad.slug));
    const plan = launchCatalog(brand);
    expect(new Set(plan.map((p) => p.slug)).size).toBe(plan.length);
    for (const p of plan) {
      expect(p.assetSlugs.every((s) => slugs.has(s))).toBe(true);
      expect(p.assetSlugs.length).toBeGreaterThanOrEqual(p.kind === "pack" ? 2 : 1);
      expect(p.assetSlugs.length).toBeLessThanOrEqual(400);
    }
    expect(plan.filter((p) => Object.values(p.prices).every((c) => c === 0))).toHaveLength(1);
    // Every rig asset is for sale somewhere.
    expect(new Set(plan.flatMap((p) => p.assetSlugs))).toEqual(slugs);
  });
});

describe("voices", async () => {
  const { PRESETS } = await import("@sb/audio");
  const { cueTime } = await import("@sb/asset");
  const { CHIBI_CHARACTERS, CHIBI_VOICE_PITCH } = await import("./index");
  it("every character has a voice pitch", () => {
    expect(CHIBI_CHARACTERS.filter((c) => !(c in CHIBI_VOICE_PITCH))).toEqual([]);
  });
  it("every emotion's voice finishes before its loop restarts", () => {
    const late: string[] = [];
    for (const { ad } of all) {
      for (const c of ad.sounds) {
        const id = c.sound.replace(/^synth:/, "");
        if (!id.startsWith("voice-")) continue;
        const end = cueTime(c, ad.timeline) + PRESETS[id]!.length * 1000;
        if (end > ad.timeline.duration + 1) late.push(`${ad.slug}: ${id} ends at ${Math.round(end)} ms, loop is ${ad.timeline.duration} ms`);
      }
    }
    expect(late).toEqual([]);
  });
  it("faces and characters use voice sounds that exist", () => {
    const missing = all.flatMap(({ ad }) => ad.sounds.map((c) => c.sound.replace(/^synth:/, "")).filter((id) => !(id in PRESETS)));
    expect([...new Set(missing)]).toEqual([]);
  });
});
