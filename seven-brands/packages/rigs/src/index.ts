import type { AssetDefinition } from "@sb/asset";
import { buildFace, FACE_EXPRESSIONS, FACE_PALETTES, type FacePalette } from "./moodicons-face";
import { buildChibi, CHIBI_VARIANTS, parseChibiVariant } from "./moodicons-chibi";
import { BAWAL_PALETTES, BAWAL_SIGNS, buildBawal, type BawalPalette } from "./moodicons-bawal";
import { buildSymbol, SYMBOL_PALETTES, SYMBOLS, type SymbolPalette } from "./moodicons-symbols";
import { buildGlyph, GLYPH_PALETTES, GLYPHS, type GlyphPalette } from "./sonicglyphs";

export * from "./moodicons-face";
export * from "./moodicons-symbols";
export * from "./moodicons-bawal";
export * from "./moodicons-chibi";
export * from "./sonicglyphs";
export { heartPath } from "./util";
export * from "./launch";

export interface RigInfo {
  id: string;
  brand: "moodicons" | "sonicglyphs";
  label: string;
  variants: string[];
  palettes: string[];
  build(variant: string, palette?: string): AssetDefinition;
  /** Style previews not yet in the launch catalog (left out of the starter set and launch plan). */
  preview?: boolean;
}

/** Registry used by the production factory ("rig" jobs need no AI and cost nothing). */
export const RIGS: Record<string, RigInfo> = {
  "moodicons-face@1": {
    id: "moodicons-face@1",
    brand: "moodicons",
    label: "Moodicons face",
    variants: [...FACE_EXPRESSIONS],
    palettes: Object.keys(FACE_PALETTES),
    build: (v, p) => buildFace({ expression: v as (typeof FACE_EXPRESSIONS)[number], palette: (p ?? "classic") as FacePalette }),
  },
  "moodicons-symbols@1": {
    id: "moodicons-symbols@1",
    brand: "moodicons",
    label: "Moodicons reaction stickers",
    variants: [...SYMBOLS],
    palettes: Object.keys(SYMBOL_PALETTES),
    build: (v, p) => buildSymbol({ symbol: v as (typeof SYMBOLS)[number], palette: (p ?? "classic") as SymbolPalette }),
  },
  "moodicons-bawal@1": {
    id: "moodicons-bawal@1",
    brand: "moodicons",
    label: "Moodicons Bawal signs (PH public rules)",
    variants: [...BAWAL_SIGNS],
    palettes: Object.keys(BAWAL_PALETTES),
    build: (v, p) => buildBawal({ sign: v as (typeof BAWAL_SIGNS)[number], palette: (p ?? "classic") as BawalPalette }),
  },
  "moodicons-chibi@1": {
    id: "moodicons-chibi@1",
    brand: "moodicons",
    label: "Moodicons Chibi Cast (original characters)",
    variants: [...CHIBI_VARIANTS],
    palettes: ["original"],
    build: (v) => buildChibi(parseChibiVariant(v)),
  },
  "moodicons-face-3d@1": {
    id: "moodicons-face-3d@1",
    brand: "moodicons",
    label: "Moodicons face — soft 3D",
    variants: [...FACE_EXPRESSIONS],
    palettes: Object.keys(FACE_PALETTES),
    build: (v, p) => buildFace({ expression: v as (typeof FACE_EXPRESSIONS)[number], palette: (p ?? "classic") as FacePalette, style: "3d" }),
  },
  "moodicons-chibi-3d@1": {
    id: "moodicons-chibi-3d@1",
    brand: "moodicons",
    label: "Moodicons Chibi Cast — soft 3D",
    variants: [...CHIBI_VARIANTS],
    palettes: ["original"],
    build: (v) => buildChibi({ ...parseChibiVariant(v), style: "3d" }),
  },
  "sonicglyphs-line@1": {
    id: "sonicglyphs-line@1",
    brand: "sonicglyphs",
    label: "SonicGlyphs line glyphs",
    variants: [...GLYPHS],
    palettes: Object.keys(GLYPH_PALETTES),
    build: (v, p) => buildGlyph({ glyph: v as (typeof GLYPHS)[number], palette: (p ?? "studio") as GlyphPalette }),
  },
};

/** The default (first-palette) asset for every variant of every rig: the starter catalog. */
export function starterSet(): AssetDefinition[] {
  return Object.values(RIGS)
    .filter((rig) => !rig.preview)
    .flatMap((rig) => rig.variants.map((v) => rig.build(v)));
}
