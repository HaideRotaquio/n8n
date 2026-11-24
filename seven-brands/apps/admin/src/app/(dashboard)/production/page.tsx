import { brandsWith, can } from "@sb/core";
import { getDb, listBrands, listJobs } from "@sb/db";
import { RIGS } from "@sb/rigs";
import { Button, Card, EmptyState, PageHeader, Table } from "@sb/ui";
import Link from "next/link";
import { aiStatus, requirePageStaff } from "@/lib/server";
import { cancelJobAction } from "./actions";
import { JobStatusBadge, usd } from "./job-status";
import { NewJobForm } from "./new-job-form";

export const metadata = { title: "Production factory" };
export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const staff = await requirePageStaff("production.read");
  const db = getDb();
  const [jobs, runnable] = await Promise.all([
    listJobs(db, brandsWith(staff.grants, "production.read")),
    listBrands(db, brandsWith(staff.grants, "production.run")),
  ]);
  const active = runnable.filter((b) => b.status !== "planned" && b.status !== "paused");
  const ai = aiStatus();

  return (
    <>
      <PageHeader
        title="Production factory"
        description="Jobs run in the background worker. Rig jobs are deterministic and free; AI jobs call the model provider, are budget-capped and always need human review."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card title="New job">
          {active.length ? (
            <NewJobForm
              brands={active.map((b) => ({ id: b.id, slug: b.slug, name: b.name, categories: b.config.catalog.categories }))}
              rigs={Object.values(RIGS).map(({ id, brand, label, variants, palettes }) => ({ id, brand, label, variants, palettes }))}
              ai={ai.configured ? { configured: true, label: ai.label } : { configured: false, label: ai.reason }}
            />
          ) : (
            <p className="text-sm text-[var(--color-muted-text)]">You can't start jobs for any active brand.</p>
          )}
        </Card>
        <Card title="Recent jobs">
          {jobs.length === 0 ? (
            <EmptyState title="No jobs yet" />
          ) : (
            <Table head={["Job", "Brand", "Type", "Status", "Cost", "Created (UTC)", ""]}>
              {jobs.map(({ job, brandName }) => (
                <tr key={job.id}>
                  <td className="px-4 py-2"><Link href={`/production/${job.id}`} className="font-mono text-xs underline">{job.id.slice(0, 14)}…</Link></td>
                  <td className="px-4 py-2">{brandName}</td>
                  <td className="px-4 py-2">{job.kind}</td>
                  <td className="px-4 py-2"><JobStatusBadge status={job.status} /></td>
                  <td className="px-4 py-2 font-mono text-xs">{usd(job.costUsd)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs">{job.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                  <td className="px-4 py-2">
                    {job.status === "queued" && can(staff.grants, "production.run", job.brandId) && (
                      <form action={cancelJobAction.bind(null, job.id)}><Button variant="ghost" type="submit">Cancel</Button></form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <p className="mt-2 text-xs text-[var(--color-muted-text)]">Jobs stay queued until a worker is running (<code>pnpm --filter @sb/worker start</code>).</p>
        </Card>
      </div>
    </>
  );
}
