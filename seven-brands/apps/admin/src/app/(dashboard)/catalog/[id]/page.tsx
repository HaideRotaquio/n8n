import { can, LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { checkPublishable, getDb, getProductDetail, latestCatalogJob } from "@sb/db";
import { Badge, Card, Field, Input, Notice, PageHeader, Table, Textarea } from "@sb/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";
import { AssetStatusBadge, AssetThumb, previewBg } from "../../assets/asset-bits";
import { applyCopyAction, archiveAction, publishAction, setPriceAction, suggestCopyAction, updateProductAction } from "../actions";

export const metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const d = await getProductDetail(db, id);
  if (!d) notFound();
  const staff = await requirePageStaff("catalog.read", d.product.brandId);
  const check = await checkPublishable(db, id);
  const canWrite = can(staff.grants, "catalog.write", d.product.brandId);
  const canPrice = can(staff.grants, "pricing.write", d.product.brandId);
  const canPublish = can(staff.grants, "asset.publish", d.product.brandId);
  const domain = d.brand.config.domains[0];
  const copyJob = canWrite ? await latestCatalogJob(db, id) : null;
  const suggestion = copyJob?.status === "succeeded" ? (copyJob.result as { suggestion?: { title: string; description: string; tags: string[]; altText: string }; provider?: string }) : null;
  return (
    <>
      <PageHeader
        title={d.product.title}
        description={<>{d.brand.name} · {d.product.kind} · <span className="font-mono">{d.product.slug}</span></>}
        actions={<Badge tone={d.product.status === "published" ? "success" : "neutral"}>{d.product.status}</Badge>}
      />
      {d.product.status === "published" && domain && (
        <p className="mb-4 text-sm">On the storefront: <span className="font-mono">{domain}/products/{d.product.slug}</span></p>
      )}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={`Assets (${d.assets.length})`}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {d.assets.map((a) => (
                <li key={a.asset.id} className="text-xs">
                  <Link href={`/assets/${a.asset.id}`}><AssetThumb ad={a.definition} background={previewBg(d.brand.slug)} /></Link>
                  <p className="mt-1 font-medium">{a.asset.name} · v{a.version}</p>
                  <AssetStatusBadge status={a.asset.status} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Prices (USD)">
            {d.prices.length > 0 && (
              <Table head={["License", "Price", "Active"]}>
                {d.prices.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{LICENSE_TYPE_LABELS[p.licenseType as LicenseType] ?? p.licenseType}</td>
                    <td className="px-4 py-2">{money(p.amountCents, p.currency)}</td>
                    <td className="px-4 py-2">{p.active ? "yes" : "no"}</td>
                  </tr>
                ))}
              </Table>
            )}
            {canPrice && (
              <ActionForm action={setPriceAction.bind(null, id)} submit="Save price" className="mt-4 flex flex-wrap items-end gap-3">
                <Field label="License" htmlFor="licenseType">
                  <select id="licenseType" name="licenseType" className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    {d.brand.config.licenseTypes.map((t) => <option key={t} value={t}>{LICENSE_TYPE_LABELS[t]}</option>)}
                  </select>
                </Field>
                <Field label="Amount (USD)" htmlFor="amount"><Input id="amount" name="amount" inputMode="decimal" placeholder="9.00" required className="w-28" /></Field>
                <Field label="Status" htmlFor="active">
                  <select id="active" name="active" className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <option value="on">Active</option>
                    <option value="off">Hidden</option>
                  </select>
                </Field>
              </ActionForm>
            )}
          </Card>
          {canWrite && (
            <Card title="Store copy suggestion" actions={can(staff.grants, "production.run", d.product.brandId) ? <ActionForm action={suggestCopyAction.bind(null, id)} submit="Suggest copy" variant="secondary" /> : undefined}>
              {!copyJob ? (
                <p className="text-sm text-[var(--color-muted-text)]">The catalog writer drafts a title, description, tags and alt text from the assets. Nothing changes until you apply it.</p>
              ) : copyJob.status !== "succeeded" ? (
                <p className="text-sm">Latest request: {copyJob.status}{copyJob.error ? ` — ${copyJob.error}` : ""}</p>
              ) : suggestion?.suggestion ? (
                <div className="space-y-2 text-sm">
                  <p className="text-xs text-[var(--color-muted-text)]">From {suggestion.provider}</p>
                  <p className="font-semibold">{suggestion.suggestion.title}</p>
                  <p>{suggestion.suggestion.description}</p>
                  <p className="text-xs">Tags: {suggestion.suggestion.tags.join(", ")} · Alt text: {suggestion.suggestion.altText}</p>
                  <ActionForm action={applyCopyAction.bind(null, id, copyJob.id)} submit="Apply title and description" />
                </div>
              ) : null}
            </Card>
          )}
          {canWrite && (
            <Card title="Details">
              <ActionForm action={updateProductAction.bind(null, id)} submit="Save">
                <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue={d.product.title} required /></Field>
                <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={d.product.description} rows={4} /></Field>
              </ActionForm>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Publishing">
            {d.product.status === "published" ? (
              <p className="text-sm">Published {d.product.publishedAt?.toISOString().slice(0, 10)}. Buyers get each asset&apos;s newest approved, exported version.</p>
            ) : check.ok ? (
              <Notice tone="success">Ready to publish.</Notice>
            ) : (
              <div className="text-sm">
                <p className="mb-2 font-medium">Before publishing:</p>
                <ul className="list-disc space-y-1 pl-5">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            {canPublish && (
              <div className="mt-4 space-y-3">
                {d.product.status !== "published" && <ActionForm action={publishAction.bind(null, id)} submit="Publish to storefront" />}
                {d.product.status !== "archived" && <ActionForm action={archiveAction.bind(null, id)} submit="Archive (stop selling)" variant="secondary" confirm="Stop selling this product? Existing buyers keep access." />}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
