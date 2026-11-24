import { listPublishedProducts, getDb } from "@sb/db";
import { EmptyState } from "@sb/ui";
import Link from "next/link";
import { AssetPreview } from "@/components/asset-preview";
import { formatMoney, requireStore } from "@/lib/store";

export default async function CatalogPage() {
  const { brand } = await requireStore();
  const products = await listPublishedProducts(getDb(), brand.id);
  const c = brand.config;
  return (
    <div>
      <section className="mb-10">
        <h1 className="text-3xl font-bold sm:text-4xl">{c.tagline}</h1>
        {c.description && <p className="mt-3 max-w-2xl text-[var(--color-muted-text)]">{c.description}</p>}
      </section>
      {products.length === 0 ? (
        <EmptyState title="The catalog is being prepared">New assets are on their way. Check back soon.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Products">
          {products.map((p) => (
            <li key={p.product.id}>
              <Link href={`/products/${p.product.slug}`} className="group block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[var(--color-accent)]">
                {p.cover && <AssetPreview ad={p.cover} playOn="hover" />}
                <p className="mt-3 font-medium">{p.product.title}</p>
                <p className="text-sm text-[var(--color-muted-text)]">
                  {p.product.kind === "pack" ? `${p.assetCount} assets · ` : ""}
                  {p.minPriceCents !== null && p.currency ? `from ${formatMoney(p.minPriceCents, p.currency)}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
