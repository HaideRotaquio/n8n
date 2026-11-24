import { brandsWith, type BrandStatus } from "@sb/core";
import { ASSET_STATUSES, getDb, listAssets, listBrands, type Asset } from "@sb/db";
import { EmptyState, PageHeader } from "@sb/ui";
import Link from "next/link";
import { requirePageStaff } from "@/lib/server";
import { AssetStatusBadge, AssetThumb, previewBg, ProvenanceBadge } from "./asset-bits";

export const metadata = { title: "Asset library" };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ brand?: string; status?: string }> }) {
  const sp = await searchParams;
  const staff = await requirePageStaff("asset.read");
  const db = getDb();
  const scope = brandsWith(staff.grants, "asset.read");
  const brands = (await listBrands(db, scope)).filter((b) => (["in_development", "beta", "live"] as BrandStatus[]).includes(b.status));
  const brand = brands.find((b) => b.slug === sp.brand);
  const status = (ASSET_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as Asset["status"]) : undefined;
  const items = await listAssets(db, scope, { brandId: brand?.id, status });

  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ brand: sp.brand, status: sp.status, ...q }).filter(([, v]) => v) as [string, string][]);
    return `/assets${p.size ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-text)]" : "border-[var(--color-border)] hover:bg-[var(--color-border)]/40"}`;

  return (
    <>
      <PageHeader
        title="Asset library"
        description="Every asset is a versioned definition; all formats are generated from it. Hover a card to play its animation."
        actions={<Link href="/production" className="text-sm underline">New production job</Link>}
      />
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Filter by brand">
        <Link href={link({ brand: undefined })} className={chip(!brand)}>All brands</Link>
        {brands.map((b) => (
          <Link key={b.id} href={link({ brand: b.slug })} className={chip(brand?.id === b.id)}>{b.name}</Link>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter by status">
        <Link href={link({ status: undefined })} className={chip(!status)}>Any status</Link>
        {ASSET_STATUSES.map((s) => (
          <Link key={s} href={link({ status: s })} className={chip(status === s)}>{s.replace("_", " ")}</Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No assets yet">Start a rig or AI production job to create some.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((it) => (
            <li key={it.asset.id}>
              <Link href={`/assets/${it.asset.id}`} className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 hover:shadow-md">
                <AssetThumb ad={it.definition} background={previewBg(it.brandSlug)} />
                <div className="mt-2 px-1">
                  <p className="truncate text-sm font-medium">{it.asset.name}</p>
                  <p className="text-xs text-[var(--color-muted-text)]">{it.brandSlug} · v{it.asset.currentVersion} · QA {it.qaScore ?? "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <AssetStatusBadge status={it.asset.status} />
                    <ProvenanceBadge provenance={it.provenance} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
