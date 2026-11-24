import { designFor } from "@/designs";
import { catalogItems, sortForShop } from "@/lib/catalog";
import { requireStore } from "@/lib/store";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { brand } = await requireStore();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const all = sortForShop(await catalogItems(brand));
  // Categories that actually have products, in the brand's own order.
  const counts = new Map<string, number>();
  for (const i of all) if (i.category) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const categories = brand.config.catalog.categories.filter((c) => counts.has(c.slug)).map((c) => ({ ...c, count: counts.get(c.slug)! }));
  for (const [slug, count] of counts) if (!categories.some((c) => c.slug === slug)) categories.push({ slug, label: slug.replace(/-/g, " "), count });
  const category = sp.category && counts.has(sp.category) ? sp.category : null;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const items = all.filter((i) => (!category || i.category === category) && words.every((w) => i.searchText.includes(w)));
  const { Home } = designFor(brand);
  return (
    <Home
      tagline={brand.config.tagline}
      description={brand.config.description}
      items={items}
      categories={categories}
      q={q}
      category={category}
      freePack={all.find((i) => i.isFree) ?? null}
      showcase={showcase(all)}
    />
  );
}

/** Six small products for the hero, one per category where possible (no free pack, no bundles). */
function showcase(all: Awaited<ReturnType<typeof catalogItems>>) {
  const singles = all.filter((i) => !i.isFree && i.assetCount <= 4);
  const picked = new Map<string, (typeof singles)[number]>();
  for (const i of singles) if (i.category && !picked.has(i.category)) picked.set(i.category, i);
  const out = [...picked.values()];
  for (const i of singles) if (out.length < 6 && !out.includes(i)) out.push(i);
  return out.slice(0, 6);
}
