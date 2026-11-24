import { can } from "@sb/core";
import { getDb, listAssets, listBrands } from "@sb/db";
import { Card, EmptyState, Field, Input, PageHeader, Textarea } from "@sb/ui";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requirePageStaff } from "@/lib/server";
import { AssetThumb, previewBg } from "../../assets/asset-bits";
import { createProductAction } from "../actions";

export const metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const staff = await requirePageStaff("catalog.write");
  const db = getDb();
  const brands = (await listBrands(db)).filter((b) => can(staff.grants, "catalog.write", b.id));
  if (brands.length === 0) forbidden();
  const wanted = (await searchParams).brand;
  const brand = brands.find((b) => b.slug === wanted) ?? brands[0]!;
  const assets = (await listAssets(db, [brand.id], { brandId: brand.id })).filter((a) => a.asset.status === "approved" || a.asset.status === "published" || a.asset.status === "in_review");
  return (
    <>
      <PageHeader title="New product" description="Pick one asset for a single product, or several for a pack. Prices and publishing come next." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Brand">
        {brands.map((b) => (
          <Link key={b.id} href={`/catalog/new?brand=${b.slug}`} className={`rounded-[var(--radius)] border px-3 py-1 ${b.id === brand.id ? "border-[var(--color-primary)] font-medium" : "border-[var(--color-border)]"}`}>{b.name}</Link>
        ))}
      </nav>
      <Card title={`${brand.name} product`}>
        {assets.length === 0 ? (
          <EmptyState title="No assets ready">Approve assets in Quality assurance first.</EmptyState>
        ) : (
          <ActionForm action={createProductAction} submit="Create draft product">
            <input type="hidden" name="brandId" value={brand.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" htmlFor="title"><Input id="title" name="title" required maxLength={120} /></Field>
              <Field label="Slug (URL)" htmlFor="slug" hint="lowercase-with-hyphens, e.g. waving-hand"><Input id="slug" name="slug" required pattern="[a-z0-9-]{2,80}" /></Field>
            </div>
            <Field label="Description" htmlFor="description"><Textarea id="description" name="description" rows={3} maxLength={5000} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Assets (only approved, exported assets can be published)</legend>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {assets.map((a) => (
                  <li key={a.asset.id}>
                    <label className="block cursor-pointer rounded-[var(--radius)] border border-[var(--color-border)] p-2 text-xs has-[:checked]:border-[var(--color-accent)]">
                      <AssetThumb ad={a.definition} background={previewBg(a.brandSlug)} />
                      <span className="mt-1 flex items-center gap-1"><input type="checkbox" name="assetIds" value={a.asset.id} /> {a.asset.name}</span>
                      <span className="text-[var(--color-muted-text)]">{a.asset.status.replace("_", " ")}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
