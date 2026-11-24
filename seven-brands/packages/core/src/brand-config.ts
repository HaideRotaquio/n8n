import { z } from "zod";

/**
 * BrandConfig is the single source of truth for how a brand looks and behaves.
 * Code-level defaults live in the `@sb/brands` package; admins can override
 * the editable parts, which are stored as JSONB on the `brand` row.
 */

export const BRAND_SLUGS = [
  "moodicons",
  "sonicglyphs",
  "learnicons",
  "shopmotion",
  "cineglyphs",
  "atmosicons",
  "aliveui",
] as const;
export const BrandSlug = z.enum(BRAND_SLUGS);
export type BrandSlug = z.infer<typeof BrandSlug>;

/** Lifecycle of a brand as a business, independent of its catalog. */
export const BRAND_STATUSES = ["planned", "in_development", "beta", "live", "paused"] as const;
export const BrandStatus = z.enum(BRAND_STATUSES);
export type BrandStatus = z.infer<typeof BrandStatus>;

export const LICENSE_TYPES = [
  "personal",
  "commercial",
  "team",
  "agency",
  "enterprise",
] as const;
export const LicenseType = z.enum(LICENSE_TYPES);
export type LicenseType = z.infer<typeof LicenseType>;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB color");
const cssFontStack = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w\s"',-]+$/, "Font stack may only contain names, quotes, commas and spaces");

export const ThemeTokens = z.object({
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  mutedText: hexColor,
  primary: hexColor,
  primaryText: hexColor,
  accent: hexColor,
  border: hexColor,
});
export type ThemeTokens = z.infer<typeof ThemeTokens>;

export const BrandTheme = z.object({
  tokens: ThemeTokens,
  /** Optional dark-mode token overrides. */
  darkTokens: ThemeTokens.partial().optional(),
  fonts: z.object({ heading: cssFontStack, body: cssFontStack }),
  radius: z.enum(["none", "sm", "md", "lg", "full"]),
  /** Drives default easing/springs in previews and UI micro-interactions. */
  motionPersonality: z.enum(["bouncy", "smooth", "cinematic", "calm", "snappy", "precise"]),
});
export type BrandTheme = z.infer<typeof BrandTheme>;

export const STOREFRONT_LAYOUTS = [
  "playful-grid",
  "studio-dark",
  "classroom",
  "merchant",
  "cinema",
  "ambient",
  "docs",
] as const;

const domain = z
  .string()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Expected a lowercase hostname like moodicons.example.com");

export const BrandConfig = z.object({
  slug: BrandSlug,
  name: z.string().min(2).max(60),
  tagline: z.string().min(2).max(140),
  description: z.string().max(1000),
  category: z.string().min(2).max(80),
  domains: z.array(domain).max(10),
  defaultCurrency: z.enum(["USD"]),
  theme: BrandTheme,
  layout: z.enum(STOREFRONT_LAYOUTS),
  catalog: z.object({
    categories: z
      .array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(60) }))
      .max(50),
  }),
  audiences: z.array(z.string().min(2).max(80)).max(20),
  marketingChannels: z.array(z.string().min(2).max(80)).max(20),
  licenseTypes: z.array(LicenseType).min(1),
  features: z.object({
    soundPreview: z.boolean(),
    customizer: z.boolean(),
    developerExports: z.boolean(),
    /** Child-adjacent brand: no tracking on previews, no child accounts. */
    childSafeMode: z.boolean(),
  }),
});
export type BrandConfig = z.infer<typeof BrandConfig>;

/** Fields an admin may change from the dashboard without a code deploy. */
export const BrandConfigPatch = BrandConfig.pick({
  name: true,
  tagline: true,
  description: true,
  domains: true,
  audiences: true,
  marketingChannels: true,
})
  .extend({ theme: BrandTheme.pick({ tokens: true }).optional() })
  .partial()
  .strict();
export type BrandConfigPatch = z.infer<typeof BrandConfigPatch>;

export function applyBrandPatch(config: BrandConfig, patch: BrandConfigPatch): BrandConfig {
  const parsed = BrandConfigPatch.parse(patch);
  const next = {
    ...config,
    ...parsed,
    theme: parsed.theme ? { ...config.theme, tokens: parsed.theme.tokens } : config.theme,
  };
  return BrandConfig.parse(next);
}

/** Converts theme tokens to CSS custom properties, e.g. `--color-primary`. */
export function themeToCssVars(theme: BrandTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.tokens)) {
    vars[`--color-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = v;
  }
  vars["--font-heading"] = theme.fonts.heading;
  vars["--font-body"] = theme.fonts.body;
  const radius = { none: "0", sm: "4px", md: "8px", lg: "16px", full: "9999px" }[theme.radius];
  vars["--radius"] = radius;
  return vars;
}

/** WCAG relative-luminance contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Accessibility checks every brand theme must pass (AA for body text). */
export function checkThemeAccessibility(theme: BrandTheme): string[] {
  const t = theme.tokens;
  const problems: string[] = [];
  const pairs: [string, string, string, number][] = [
    ["text", t.text, t.background, 4.5],
    ["text on surface", t.text, t.surface, 4.5],
    ["mutedText", t.mutedText, t.background, 4.5],
    ["primaryText on primary", t.primaryText, t.primary, 4.5],
  ];
  for (const [label, fg, bg, min] of pairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) problems.push(`${label}: contrast ${ratio.toFixed(2)} < ${min}`);
  }
  return problems;
}
