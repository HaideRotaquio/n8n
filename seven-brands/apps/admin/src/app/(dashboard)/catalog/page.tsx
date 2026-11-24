import { brandsWith, can } from "@sb/core";
import { getDb, listBrands, listCollections, listProducts } from "@sb/db";
import { Badge, Card, EmptyState, Field, Input, PageHeader, Table } from "@sb/ui";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";
import { collectionStatusAction, createCollectionAction } from "./actions";

export const metadata = { title: "Product catalog" };

const TONE = { draft: "neutral", published: "success", archived: "neutral" } as const;

export default async function CatalogPage() {
  const staff = await requirePageStaff("catalog.read");
  const db = getDb();
  const scope = brandsWith(staff.grants, "catalog.read");
  const [products, collections, brands] = await Promise.all([listProducts(db, scope), listCollections(db, scope), listBrands(db, scope)]);
  const writable = brands.filter((b) => can(staff.grants, "catalog.write", b.id));
  return (
    <>
      <PageHeader
        title="Product catalog"
        description="Products are what customers buy: one asset (single) or several (pack), with a price per license type. Publishing needs reviewer-approved, exported assets."
        actions={writable.length > 0 && <Link href="/catalog/new" className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-text)]">New product</Link>}
      />
      <Card title="Products">
        {products.length === 0 ? (
          <EmptyState title="No products yet">Approve and export some assets, then create a product from them.</EmptyState>
        ) : (
          <Table head={["Product", "Brand", "Kind", "Assets", "From", "Status"]}>
            {products.map((p) => (
              <tr key={p.product.id}>
                <td className="px-4 py-2">
                  <Link href={`/catalog/${p.product.id}`} className="font-medium underline-offset-2 hover:underline">{p.product.title}</Link>
                  <div className="font-mono text-xs text-[var(--color-muted-text)]">{p.product.slug}</div>
                </td>
                <td className="px-4 py-2">{p.brandSlug}</td>
                <td className="px-4 py-2">{p.product.kind}</td>
                <td className="px-4 py-2">{p.assetCount}</td>
                <td className="px-4 py-2">{p.minPriceCents !== null ? money(p.minPriceCents, p.currency ?? "USD") : "—"}</td>
                <td className="px-4 py-2"><Badge tone={TONE[p.product.status]}>{p.product.status}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Collections">
          {collections.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-text)]">No collections yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] text-sm">
              {collections.map(({ collection: c, brandSlug, productCount }) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{c.title}</span> <span className="text-[var(--color-muted-text)]">· {brandSlug} · {productCount} products</span> <Badge tone={TONE[c.status]}>{c.status}</Badge>
                  </span>
                  {can(staff.grants, "asset.publish", c.brandId) && c.status !== "published" && (
                    <ActionForm action={collectionStatusAction.bind(null, c.id, "published")} submit="Publish" variant="secondary" className="flex items-center gap-2" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {writable.length > 0 && (
          <Card title="New collection">
            <ActionForm action={createCollectionAction} submit="Create collection">
              <Field label="Brand" htmlFor="c-brand">
                <select id="c-brand" name="brandId" className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                  {writable.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Title" htmlFor="c-title"><Input id="c-title" name="title" required /></Field>
              <Field label="Slug" htmlFor="c-slug" hint="lowercase-with-hyphens"><Input id="c-slug" name="slug" required pattern="[a-z0-9-]{2,80}" /></Field>
              <fieldset className="space-y-1 text-sm">
                <legend className="mb-1 font-medium">Products</legend>
                {products.filter((p) => writable.some((b) => b.id === p.product.brandId)).map((p) => (
                  <label key={p.product.id} className="flex gap-2"><input type="checkbox" name="productIds" value={p.product.id} /> {p.product.title} <span className="text-[var(--color-muted-text)]">({p.brandSlug})</span></label>
                ))}
              </fieldset>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
