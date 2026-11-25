import "server-only";
import type { Brand } from "@sb/db";
import { getDb, listPublishedProducts } from "@sb/db";
import type { CatalogItem } from "@/designs";
import { hoverCues } from "./hover-cues";
import { formatMoney } from "./store";

/** Published products as catalog cards, with the brand's category labels. */
export async function catalogItems(brand: Brand): Promise<CatalogItem[]> {
  const labels = new Map(brand.config.catalog.categories.map((c) => [c.slug, c.label]));
  const rows = await listPublishedProducts(getDb(), brand.id);
  return rows.map((r) => {
    const category = r.cover?.category ?? null;
    const isFree = r.minPriceCents === 0;
    return {
      slug: r.product.slug,
      title: r.product.title,
      kind: r.product.kind,
      assetCount: r.assetCount,
      priceLabel: r.minPriceCents === null || !r.currency ? null : isFree ? "Free" : `from ${formatMoney(r.minPriceCents, r.currency)}`,
      isFree,
      cover: r.cover,
      category,
      categoryLabel: category ? (labels.get(category) ?? category.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())) : null,
      searchText: [...(r.cover?.tags ?? []), r.product.title, r.product.description].join(" ").toLowerCase(),
      cues: hoverCues(r.cover),
    };
  });
}

/** Free packs first, then bundles, then singles (newest first within each). */
export function sortForShop(items: CatalogItem[]): CatalogItem[] {
  const rank = (i: CatalogItem) => (i.isFree ? 0 : i.assetCount > 8 ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b));
}
