import type { AssetDefinition } from "@sb/asset";
import { buildFace, FACE_EXPRESSIONS, FACE_PALETTES, type FacePalette } from "./moodicons-face";
import { buildSymbol, SYMBOL_PALETTES, SYMBOLS, type SymbolPalette } from "./moodicons-symbols";
import { buildGlyph, GLYPH_PALETTES, GLYPHS, type GlyphPalette } from "./sonicglyphs";

export * from "./moodicons-face";
export * from "./moodicons-symbols";
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
  return Object.values(RIGS).flatMap((rig) => rig.variants.map((v) => rig.build(v)));
}
