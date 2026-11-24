import type { Brand } from "@sb/db";
import { playful } from "./playful";
import { studio } from "./studio";
import type { Design } from "./types";

/**
 * Each brand's layout family picks its own page compositions (not a color swap).
 * Brands without a design yet (launching in later phases) use the playful layout with their own tokens.
 */
const DESIGNS: Partial<Record<Brand["config"]["layout"], Design>> = {
  "playful-grid": playful,
  "studio-dark": studio,
};

export function designFor(brand: Brand): Design {
  return DESIGNS[brand.config.layout] ?? playful;
}

export type { CatalogItem, Design } from "./types";
