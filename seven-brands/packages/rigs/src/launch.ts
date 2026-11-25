import { buildFace, FACE_EXPRESSIONS, FACE_PALETTES, type FacePalette } from "./moodicons-face";
import { BAWAL_SIGNS, buildBawal } from "./moodicons-bawal";
import { buildChibi, CHIBI_CHARACTERS, CHIBI_NAMES, CHIBI_REACTIONS } from "./moodicons-chibi";
import { buildSymbol, SYMBOL_PALETTES, SYMBOLS, type SymbolPalette } from "./moodicons-symbols";
import { buildGlyph, GLYPH_PALETTES, GLYPHS, type GlyphPalette } from "./sonicglyphs";

/**
 * Launch catalog plan: which products to create from rig assets, with suggested prices (USD cents per license).
 * It only proposes drafts — a person still approves assets and publishes products.
 * Prices are starting hypotheses for the validation phase (see docs/COST_MODEL.md), not final.
 */

export interface ProductPlan {
  slug: string;
  title: string;
  description: string;
  kind: "single" | "pack";
  assetSlugs: string[];
  /** license type → price in cents (0 = free download). */
  prices: Record<string, number>;
}

const facePalettes = Object.keys(FACE_PALETTES) as FacePalette[];
const symbolPalettes = Object.keys(SYMBOL_PALETTES) as SymbolPalette[];
const glyphPalettes = Object.keys(GLYPH_PALETTES) as GlyphPalette[];

const MOOD_SINGLE = { personal: 300, commercial: 900, team: 1900, agency: 3900 };
const MOOD_BUNDLE = { personal: 1900, commercial: 4900, team: 9900, agency: 19900 };
const SONIC_SINGLE = { personal: 400, commercial: 1200, team: 2900, agency: 5900, enterprise: 14900 };
const SONIC_BUNDLE = { personal: 2900, commercial: 6900, team: 14900, agency: 29900, enterprise: 59900 };

function moodicons(): ProductPlan[] {
  const faces = FACE_EXPRESSIONS.map((e): ProductPlan => {
    const base = buildFace({ expression: e });
    return {
      slug: base.slug,
      title: base.name,
      description: `${base.a11y.label}. Includes all ${facePalettes.length} color styles (${facePalettes.join(", ")}) with matching sound.`,
      kind: "pack",
      assetSlugs: facePalettes.map((p) => buildFace({ expression: e, palette: p }).slug),
      prices: MOOD_SINGLE,
    };
  });
  const stickers = SYMBOLS.map((s): ProductPlan => {
    const base = buildSymbol({ symbol: s });
    return {
      slug: base.slug,
      title: base.name,
      description: `${base.a11y.label}. Includes ${symbolPalettes.join(" and ")} color styles with matching sound.`,
      kind: "pack",
      assetSlugs: symbolPalettes.map((p) => buildSymbol({ symbol: s, palette: p }).slug),
      prices: MOOD_SINGLE,
    };
  });
  const bawal = BAWAL_SIGNS.map((b): ProductPlan => {
    const ad = buildBawal({ sign: b });
    return { slug: ad.slug, title: ad.name, description: `${ad.a11y.label}. Animated sign with sound; no words in the artwork, so it works in any language.`, kind: "single", assetSlugs: [ad.slug], prices: MOOD_SINGLE };
  });
  const chibiSlugs = (c: (typeof CHIBI_CHARACTERS)[number]) => CHIBI_REACTIONS.map((r) => buildChibi({ character: c, reaction: r }).slug);
  const chibi = CHIBI_CHARACTERS.map((c): ProductPlan => {
    const { name, role } = CHIBI_NAMES[c];
    return {
      slug: `chibi-${c}-pack`,
      title: `Chibi ${name} — Reactions Pack`,
      description: `${name}, ${role}: ${CHIBI_REACTIONS.length} animated reactions (happy, laughing, in love, sad, angry, surprised), each with its own sound. An original Moodicons character.`,
      kind: "pack",
      assetSlugs: chibiSlugs(c),
      prices: { personal: 900, commercial: 2900, team: 5900, agency: 11900 },
    };
  });
  return [
    {
      slug: "chibi-cast-bundle",
      title: "Chibi Cast Bundle",
      description: `The whole original cast: ${CHIBI_CHARACTERS.map((c) => CHIBI_NAMES[c].name).join(", ")} — ${CHIBI_CHARACTERS.length * CHIBI_REACTIONS.length} animated reactions with sound.`,
      kind: "pack",
      assetSlugs: CHIBI_CHARACTERS.flatMap(chibiSlugs),
      prices: MOOD_BUNDLE,
    },
    ...chibi,
    {
      slug: "bawal-signs-davao-pack",
      title: "Bawal Signs — Davao Pack",
      description: `All ${BAWAL_SIGNS.length} animated public-place signs: bawal mag-sigarilyo, maglabay ug basura, magluwa, mangihi, paputok — plus the green Designated Smoking Area sign. For posts, barangay and school announcements, offices and screens.`,
      kind: "pack",
      assetSlugs: BAWAL_SIGNS.map((b) => buildBawal({ sign: b }).slug),
      prices: { personal: 900, commercial: 2900, team: 5900, agency: 11900 },
    },
    ...bawal,
    {
      slug: "free-starter-pack",
      title: "Free Starter Pack",
      description: "Three Moodicons to try in your next post or project: Happy, Heart Eyes and a Pulsing Heart. Free for personal use.",
      kind: "pack",
      assetSlugs: [buildFace({ expression: "happy" }).slug, buildFace({ expression: "love" }).slug, buildSymbol({ symbol: "heart" }).slug],
      prices: { personal: 0 },
    },
    {
      slug: "all-faces-bundle",
      title: "All Faces Bundle",
      description: `Every Moodicons face: ${FACE_EXPRESSIONS.length} expressions in ${facePalettes.length} color styles (${FACE_EXPRESSIONS.length * facePalettes.length} animated icons with sound).`,
      kind: "pack",
      assetSlugs: FACE_EXPRESSIONS.flatMap((e) => facePalettes.map((p) => buildFace({ expression: e, palette: p }).slug)),
      prices: MOOD_BUNDLE,
    },
    {
      slug: "reaction-stickers-pack",
      title: "Reaction Stickers Pack",
      description: `All ${SYMBOLS.length} reaction stickers (hearts, stars, fire, thumbs up and more) in both color styles.`,
      kind: "pack",
      assetSlugs: SYMBOLS.flatMap((s) => symbolPalettes.map((p) => buildSymbol({ symbol: s, palette: p }).slug)),
      prices: { personal: 900, commercial: 2900, team: 5900, agency: 11900 },
    },
    ...faces,
    ...stickers,
  ];
}

function sonicglyphs(): ProductPlan[] {
  const singles = GLYPHS.map((g): ProductPlan => {
    const base = buildGlyph({ glyph: g });
    return {
      slug: base.slug,
      title: base.name,
      description: `${base.a11y.label}. Motion and sound designed together; ${glyphPalettes.length} color styles (${glyphPalettes.join(", ")}).`,
      kind: "pack",
      assetSlugs: glyphPalettes.map((p) => buildGlyph({ glyph: g, palette: p }).slug),
      prices: SONIC_SINGLE,
    };
  });
  return [
    {
      slug: "free-starter-pack",
      title: "Free Starter Pack",
      description: "Three SonicGlyphs to hear what synced motion and sound feel like: Play Button, Pulsing Speaker and Equalizer Bars. Free for personal use.",
      kind: "pack",
      assetSlugs: ["play", "speaker", "equalizer"].map((g) => buildGlyph({ glyph: g as (typeof GLYPHS)[number] }).slug),
      prices: { personal: 0 },
    },
    {
      slug: "complete-studio-bundle",
      title: "Complete Studio Bundle",
      description: `All ${GLYPHS.length} SonicGlyphs in ${glyphPalettes.length} color styles (${GLYPHS.length * glyphPalettes.length} icons), each with its own synced sound.`,
      kind: "pack",
      assetSlugs: GLYPHS.flatMap((g) => glyphPalettes.map((p) => buildGlyph({ glyph: g, palette: p }).slug)),
      prices: SONIC_BUNDLE,
    },
    ...singles,
  ];
}

export function launchCatalog(brandSlug: string): ProductPlan[] {
  if (brandSlug === "moodicons") return moodicons();
  if (brandSlug === "sonicglyphs") return sonicglyphs();
  return [];
}

/** Rig jobs (rig id + palettes) needed so every asset in the launch catalog exists. */
export function launchRigJobs(brandSlug: string): { rig: string; palettes: string[] }[] {
  if (brandSlug === "moodicons") return [{ rig: "moodicons-face@1", palettes: facePalettes }, { rig: "moodicons-symbols@1", palettes: symbolPalettes }, { rig: "moodicons-bawal@1", palettes: ["classic"] }, { rig: "moodicons-chibi@1", palettes: ["original"] }];
  if (brandSlug === "sonicglyphs") return [{ rig: "sonicglyphs-line@1", palettes: glyphPalettes }];
  return [];
}
