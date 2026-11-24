import { brandsWith } from "@sb/core";
import { getDb, listAgentTasks } from "@sb/db";
import { Card, EmptyState, PageHeader, Stat, Table } from "@sb/ui";
import Link from "next/link";
import { aiStatus, requirePageStaff } from "@/lib/server";
import { usd } from "../production/job-status";

export const metadata = { title: "AI agents" };
export const dynamic = "force-dynamic";

const AGENTS = [
  { id: "creative_director", label: "Creative director", does: "Turns a brief into a concrete concept (subject, parts, motion, sound, label)." },
  { id: "svg_artist", label: "SVG artist", does: "Draws the vector artwork; the importer sanitizes it and can send it back for repair." },
  { id: "animator", label: "Animator", does: "Writes keyframe tracks and sound cues; QA can send it back for repair." },
];

export default async function AgentsPage() {
  const staff = await requirePageStaff("production.read");
  const tasks = await listAgentTasks(getDb(), brandsWith(staff.grants, "production.read"), 200);
  const ai = aiStatus();
  const total = tasks.reduce((s, t) => s + Number(t.task.costUsd), 0);
  const failed = tasks.filter((t) => t.task.status === "failed").length;
  return (
    <>
      <PageHeader title="AI agents" description="Agents never write to the database or touch money, customers or secrets: the worker validates their output and records every call." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Provider" value={ai.configured ? "Ready" : "Not set"} hint={ai.configured ? ai.label : ai.reason} />
        <Stat label="Calls (last 200)" value={tasks.length} />
        <Stat label="Failed" value={failed} />
        <Stat label="Cost (shown calls)" value={usd(total)} />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {AGENTS.map((a) => (
          <Card key={a.id} title={a.label}><p className="text-sm text-[var(--color-muted-text)]">{a.does}</p></Card>
        ))}
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="No agent calls yet" />
      ) : (
        <Table head={["Time (UTC)", "Agent", "Brand", "Provider · model", "Status", "Tokens", "Cost", "Job"]}>
          {tasks.map(({ task: t, brandSlug }) => (
            <tr key={t.id}>
              <td className="whitespace-nowrap px-4 py-2 text-xs">{t.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
              <td className="px-4 py-2">{t.agent}</td>
              <td className="px-4 py-2">{brandSlug}</td>
              <td className="px-4 py-2 font-mono text-xs">{t.provider} · {t.model}</td>
              <td className="px-4 py-2">{t.status}</td>
              <td className="px-4 py-2 font-mono text-xs">{t.inputTokens}/{t.outputTokens}</td>
              <td className="px-4 py-2 font-mono text-xs">{usd(t.costUsd)}</td>
              <td className="px-4 py-2"><Link className="font-mono text-xs underline" href={`/production/${t.productionJobId}`}>open</Link></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
