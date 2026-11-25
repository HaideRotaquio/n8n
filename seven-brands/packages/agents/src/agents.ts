import type { BrandConfig } from "@sb/core";
import { PRESET_IDS } from "@sb/audio";
import { z } from "zod";

/**
 * Agent definitions: each is a system prompt plus a typed output schema.
 * Schemas use only simple JSON types (strings, numbers, enums, arrays) so they work with
 * structured outputs; everything is re-validated by the Asset Definition schema afterwards.
 */

export const STYLE_GUIDES: Record<string, string> = {
  moodicons: `Moodicons style: friendly, rounded, expressive emoji-like characters on a 64x64 grid.
Bold 2.5px dark outlines (#2B1B12), flat fills, no gradients, generous rounded shapes.
Palette: face/yellow #FFC83D, ink #2B1B12, blush #FF7A9A, accent pink #E8336D, tear blue #4FC3F7.
Keep 2px inside the edges so bounces don't clip.`,
  sonicglyphs: `SonicGlyphs style: crisp line glyphs for audio, shown on a dark (#0B0B14) background, 64x64 grid.
2.5px round-capped strokes in mint #7CF0C5, accents in violet #8A5CFF, optional dark fill #161626 inside closed shapes.
No gradients, no text, no shadows.`,
};

// ─── Creative director ───────────────────────────────────────────────────────

export const ConceptSchema = z.object({
  name: z.string().describe("Product name, 2-4 words, Title Case"),
  slug: z.string().describe("lowercase-with-dashes, unique, max 60 chars"),
  category: z.string().describe("One of the brand's category slugs"),
  tags: z.array(z.string()).describe("4-8 lowercase search tags"),
  artwork: z.string().describe("Precise description of the drawing: parts, shapes, positions on the 64x64 grid"),
  animatableParts: z.array(z.string()).describe("Ids of the parts that should move, lowercase-with-dashes"),
  motion: z.string().describe("What moves, how, timing in ms, loop behavior"),
  sound: z.string().describe("Sound idea and when it plays relative to the motion"),
  accessibleLabel: z.string().describe("Short description for screen readers"),
});
export type Concept = z.infer<typeof ConceptSchema>;

export function creativeDirectorPrompt(brand: BrandConfig): string {
  return `You are the creative director for ${brand.name} (${brand.category}). ${brand.description}
Audiences: ${brand.audiences.join(", ")}.
You turn a short product brief into one concrete, producible concept for an animated icon with sound.
${STYLE_GUIDES[brand.slug] ?? ""}
Rules: one clear subject; motion that loops seamlessly in 0.8-2.4 s; sound that lands on a visual impact moment;
no brand names, logos, real people or copyrighted characters. Category must be one of: ${brand.catalog.categories.map((c) => c.slug).join(", ")}.`;
}

// ─── SVG artist ──────────────────────────────────────────────────────────────

export const SvgDraftSchema = z.object({
  svg: z.string().describe("A complete <svg> document with viewBox=\"0 0 64 64\""),
  notes: z.string().describe("One sentence on construction choices"),
});
export type SvgDraft = z.infer<typeof SvgDraftSchema>;

export function svgArtistPrompt(brandSlug: string): string {
  return `You draw production vector icons as clean SVG code.
${STYLE_GUIDES[brandSlug] ?? ""}
Technical rules (strict — the importer rejects anything else):
- Root <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">.
- Allowed elements only: g, path, circle, ellipse, rect, line, polygon, polyline.
- Allowed attributes: id, fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, fill-rule, opacity, and transform using only translate(), rotate(), uniform scale().
- Colors as #RRGGBB hex only. No gradients, filters, masks, clip-paths, text, images, styles, classes, scripts or links.
- Give every part listed in "animatableParts" its own <g id="…"> (or element id) exactly as named, so it can be animated.
- Use at most 40 elements. Keep artwork within x/y 4..60.`;
}

// ─── Animator ────────────────────────────────────────────────────────────────

export const EASES = ["linear", "easeIn", "easeOut", "easeInOut", "springSoft", "springSnappy"] as const;
export const MotionPlanSchema = z.object({
  durationMs: z.number().describe("Loop length, 800-2400"),
  tracks: z.array(
    z.object({
      target: z.string().describe("Layer id to animate (must exist)"),
      property: z.enum(["translateX", "translateY", "rotate", "scale", "scaleX", "scaleY", "opacity"]),
      origin: z.array(z.number()).describe("Pivot [x, y] in the 64x64 grid, e.g. the base of the object for swings"),
      keyframes: z.array(z.object({ at: z.number(), value: z.number(), ease: z.enum(EASES) })),
    }),
  ),
  markers: z.array(z.object({ id: z.string(), at: z.number() })),
  sounds: z.array(
    z.object({
      marker: z.string().describe("Marker id at which the sound starts"),
      preset: z.enum(PRESET_IDS as [string, ...string[]]),
      pitch: z.number().describe("0.5-2, 1 = natural"),
      gain: z.number().describe("0.3-1"),
      pan: z.number().describe("Stereo position -1 (left) to 1 (right); 0 = centre. Match where the sound happens on screen."),
    }),
  ),
  stillFrameMs: z.number().describe("Most expressive moment, shown when users prefer reduced motion"),
});
export type MotionPlan = z.infer<typeof MotionPlanSchema>;

export function animatorPrompt(brand: BrandConfig): string {
  return `You are a motion designer. You animate an existing vector icon by writing keyframe tracks; you never change the drawing.
Brand motion personality: ${brand.theme.motionPersonality}.
Rules:
- Only animate the layer ids you are given. Rotations/scales pivot around "origin" (choose physically sensible pivots).
- Every track must end at the same value it starts with (seamless loop) unless rotation is a full 360.
- First keyframe at 0 ms, last keyframe exactly at durationMs. Keyframe times ascending.
- Use springSoft/springSnappy only for segments of at least 400 ms (springs need time to settle).
- Opacity stays between 0 and 1. Keep movement inside the 64x64 frame (translate within ±6, scale 0.8-1.3).
- Sounds: available presets ${PRESET_IDS.join(", ")}. Place a marker at each impact moment and start sounds there.`;
}

// ─── Catalog writer ──────────────────────────────────────────────────────────

export const CatalogCopySchema = z.object({
  title: z.string().describe("Product title, 2-6 words, Title Case, no brand name"),
  description: z.string().describe("1-3 plain sentences, at most 400 characters: what it shows, how it moves, where to use it"),
  tags: z.array(z.string()).describe("5-10 lowercase search tags"),
  altText: z.string().describe("One short sentence describing the main icon for screen readers"),
});
export type CatalogCopy = z.infer<typeof CatalogCopySchema>;

export function catalogWriterPrompt(brand: BrandConfig): string {
  return `You write store copy for ${brand.name} (${brand.category}). Tagline: "${brand.tagline}".
Audiences: ${brand.audiences.join(", ")}.
Write a product title, a short description, search tags and alt text from the facts given.
Voice: plain, specific, friendly; no hype words ("ultimate", "stunning", "best"), no exclamation marks, no emoji.
Only claim what the facts say: formats, sound, color styles and motion. Never invent features, numbers or awards.
Never mention AI, prices or other brands.`;
}
