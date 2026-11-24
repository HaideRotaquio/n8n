import { brandsWith } from "@sb/core";
import { getDb, listAssets } from "@sb/db";
import { EmptyState, PageHeader } from "@sb/ui";
import Link from "next/link";
import { requirePageStaff } from "@/lib/server";
import { AssetThumb, previewBg, ProvenanceBadge } from "../assets/asset-bits";

export const metadata = { title: "Quality assurance" };
export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const staff = await requirePageStaff("asset.review");
  const scope = brandsWith(staff.grants, "asset.review");
  const db = getDb();
  const [queue, drafts] = await Promise.all([listAssets(db, scope, { status: "in_review" }), listAssets(db, scope, { status: "draft" })]);
  const grid = (items: typeof queue) => (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <li key={it.asset.id}>
          <Link href={`/assets/${it.asset.id}`} className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 hover:shadow-md">
            <AssetThumb ad={it.definition} background={previewBg(it.brandSlug)} />
            <p className="mt-2 truncate px-1 text-sm font-medium">{it.asset.name}</p>
            <p className="px-1 text-xs text-[var(--color-muted-text)]">{it.brandSlug} · QA {it.qaScore ?? "—"}</p>
            <div className="px-1"><ProvenanceBadge provenance={it.provenance} /></div>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader title="Quality assurance" description="Assets that passed automated QA wait here for a human decision. Nothing is published without one." />
      <h2 className="mb-3 text-lg font-semibold">Waiting for review ({queue.length})</h2>
      {queue.length ? grid(queue) : <EmptyState title="Review queue is empty" />}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Failed automated QA ({drafts.length})</h2>
      {drafts.length ? grid(drafts) : <EmptyState title="No failing drafts" />}
    </>
  );
}
