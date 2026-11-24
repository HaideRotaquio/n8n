import { can, type Permission } from "@sb/core";
import { getAssetDetail, getDb } from "@sb/db";
import { FORMAT_CAPABILITIES } from "@sb/asset";
import { Badge, Card, Notice, PageHeader, Table } from "@sb/ui";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { getStorage, requirePageStaff } from "@/lib/server";
import { AssetStatusBadge, ProvenanceBadge } from "../asset-bits";
import { ExportButton, ReviewForm } from "./asset-forms";
import { UniversalViewer } from "./universal-viewer";

const fmtBytes = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requirePageStaff("asset.read");
  const d = await getAssetDetail(getDb(), id);
  if (!d) notFound();
  if (!can(staff.grants, "asset.read", d.asset.brandId)) forbidden();
  const allowed = (p: Permission) => can(staff.grants, p, d.asset.brandId);

  const ad = d.definition;
  const currentReviews = d.reviews.filter((r) => r.assetVersionId === d.current.id);
  const qa = currentReviews.find((r) => r.kind === "automated");
  const checks = (qa?.checks ?? { errors: [], warnings: [] }) as { errors: { message: string }[]; warnings: { message: string }[] };
  const human = currentReviews.filter((r) => r.kind === "human");
  const storage = getStorage();
  const downloads = await Promise.all(
    d.exports.map(async (e) => ({ ...e, url: await storage.createDownloadUrl(e.storageKey, { expiresInSeconds: 300 }) })),
  );
  const canReview = allowed("asset.review") && !["published", "archived"].includes(d.asset.status);

  return (
    <>
      <PageHeader
        title={d.asset.name}
        description={`${d.brand.name} · ${ad.category ?? "uncategorized"} · version ${d.current.version} · ${ad.timeline.duration} ms ${ad.timeline.loop === true ? "loop" : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge provenance={d.current.provenance} />
            <AssetStatusBadge status={d.asset.status} />
          </div>
        }
      />
      {d.current.provenance === "fixture" && (
        <div className="mb-4">
          <Notice>This asset came from recorded fixture outputs used to test the pipeline. It is not AI output and is not for sale.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Preview">
            <UniversalViewer definition={ad} defaultBackground={d.brand.slug === "sonicglyphs" ? "dark" : "cream"} />
          </Card>

          <Card title="Exports" actions={allowed("production.run") ? <ExportButton assetId={d.asset.id} /> : undefined}>
            {downloads.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-text)]">No exports for this version yet.</p>
            ) : (
              <Table head={["Format", "Can do", "Size", ""]}>
                {downloads.map((e) => {
                  const cap = FORMAT_CAPABILITIES[e.format as keyof typeof FORMAT_CAPABILITIES];
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-2 font-mono text-xs">{e.format}</td>
                      <td className="px-4 py-2 text-xs text-[var(--color-muted-text)]">
                        {cap ? `${cap.animation ? "motion" : "still"} · ${cap.interactive ? "interactive" : "not interactive"} · ${cap.sound ? "sound" : "no sound"}` : "all formats + README + license"}
                      </td>
                      <td className="px-4 py-2 text-xs">{fmtBytes(e.bytes)}</td>
                      <td className="px-4 py-2 text-right">
                        <a href={e.url} className="text-sm underline">Download</a>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
            <p className="mt-2 text-xs text-[var(--color-muted-text)]">Download links expire after 5 minutes. Packages are marked “not licensed” until sold (Phase 3).</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Automated QA">
            {qa ? (
              <>
                <p className="text-2xl font-semibold">
                  {qa.score}/100 <Badge tone={qa.passed ? "success" : "danger"}>{qa.passed ? "Passed" : "Failed"}</Badge>
                </p>
                {checks.errors.length + checks.warnings.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-muted-text)]">No issues found.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {checks.errors.map((e, i) => (
                      <li key={`e${i}`} className="text-red-700 dark:text-red-400">Error: {e.message}</li>
                    ))}
                    {checks.warnings.map((w, i) => (
                      <li key={`w${i}`} className="text-amber-700 dark:text-amber-400">Warning: {w.message}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm">No QA record.</p>
            )}
          </Card>

          <Card title="Human review">
            {human.map((r) => (
              <p key={r.id} className="mb-2 text-sm">
                <Badge tone={r.decision === "approved" ? "success" : "danger"}>{r.decision}</Badge> {r.notes}
              </p>
            ))}
            {canReview ? <ReviewForm assetId={d.asset.id} canApprove={!!qa?.passed} /> : <p className="text-sm text-[var(--color-muted-text)]">You can't review this asset.</p>}
          </Card>

          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-[var(--color-muted-text)]">Accessible label</dt><dd>{ad.a11y.label}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Sounds</dt><dd>{ad.sounds.map((s) => s.sound.replace("synth:", "")).join(", ") || "none"}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Tags</dt><dd>{ad.tags.join(", ")}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Checksum</dt><dd className="truncate font-mono text-xs">{d.current.checksum}</dd></div>
              {d.current.productionJobId && (
                <div><dt className="text-[var(--color-muted-text)]">Made by job</dt><dd><Link className="font-mono text-xs underline" href={`/production/${d.current.productionJobId}`}>{d.current.productionJobId}</Link></dd></div>
              )}
              <div>
                <dt className="text-[var(--color-muted-text)]">Versions</dt>
                <dd className="font-mono text-xs">{d.versions.map((v) => `v${v.version} (${v.createdAt.toISOString().slice(0, 10)})`).join(" · ")}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
