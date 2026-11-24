import { can } from "@sb/core";
import { getDb, getJob } from "@sb/db";
import { Card, PageHeader, Table, Notice } from "@sb/ui";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { requirePageStaff } from "@/lib/server";
import { JobStatusBadge, usd } from "../job-status";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requirePageStaff("production.read");
  const j = await getJob(getDb(), id);
  if (!j) notFound();
  if (!can(staff.grants, "production.read", j.job.brandId)) forbidden();
  const { job, tasks } = j;
  const created = ((job.result as { created?: { assetId: string; slug: string; version: number; qaScore: number }[] } | null)?.created ?? []);
  return (
    <>
      <PageHeader title={`Job ${job.id}`} description={`${job.kind} job · attempt ${job.attempts}/${job.maxAttempts} · cost ${usd(job.costUsd)}`} actions={<JobStatusBadge status={job.status} />} />
      {job.error && <div className="mb-4"><Notice tone="danger">{job.error}</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Brief"><pre className="overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(job.brief, null, 2)}</pre></Card>
        <Card title="Created assets">
          {created.length === 0 ? <p className="text-sm text-[var(--color-muted-text)]">None yet.</p> : (
            <ul className="space-y-1 text-sm">
              {created.map((c) => <li key={c.assetId}><Link className="underline" href={`/assets/${c.assetId}`}>{c.slug}</Link> · v{c.version} · QA {c.qaScore}</li>)}
            </ul>
          )}
        </Card>
      </div>
      {tasks.length > 0 && (
        <div className="mt-6">
          <Card title="Agent calls">
            <Table head={["Agent", "Provider · model", "Status", "Tokens in/out", "Cost", "Time"]}>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2">{t.agent}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.provider} · {t.model}</td>
                  <td className="px-4 py-2">{t.status}{t.error ? `: ${t.error}` : ""}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.inputTokens} / {t.outputTokens}</td>
                  <td className="px-4 py-2 font-mono text-xs">{usd(t.costUsd)}</td>
                  <td className="px-4 py-2 text-xs">{(t.durationMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
