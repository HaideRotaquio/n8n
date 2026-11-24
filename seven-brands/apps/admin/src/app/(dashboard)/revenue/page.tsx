import { commerceFromEnv } from "@sb/commerce";
import { brandsWith, can } from "@sb/core";
import { getDb, listWebhookEvents, revenueSummary } from "@sb/db";
import { Badge, Card, EmptyState, Notice, PageHeader, Stat, Table } from "@sb/ui";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";

export const metadata = { title: "Revenue" };

export default async function RevenuePage() {
  const staff = await requirePageStaff("finance.read");
  const db = getDb();
  const scope = brandsWith(staff.grants, "finance.read");
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since365 = new Date(Date.now() - 365 * 86_400_000);
  const [month, year] = await Promise.all([revenueSummary(db, scope, since30), revenueSummary(db, scope, since365)]);
  const usd = (rows: typeof month) => rows.filter((r) => r.currency === "USD");
  const sum = (rows: typeof month, k: "grossCents" | "taxCents" | "feeCents" | "refundedCents") => usd(rows).reduce((s, r) => s + r[k], 0);
  const net = (rows: typeof month) => sum(rows, "grossCents") - sum(rows, "taxCents") - sum(rows, "feeCents") - sum(rows, "refundedCents");
  const global = can(staff.grants, "infrastructure.read");
  const commerce = global ? commerceFromEnv(process.env) : null;
  const events = global ? await listWebhookEvents(db, { limit: 30 }) : [];
  return (
    <>
      <PageHeader title="Revenue" description="Live orders only (test orders are excluded). Net = gross − tax − provider fees − refunds. The Merchant of Record remits the tax." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Net, last 30 days" value={money(net(month))} />
        <Stat label="Gross, last 30 days" value={money(sum(month, "grossCents"))} />
        <Stat label="Orders, last 30 days" value={usd(month).reduce((s, r) => s + r.orders, 0)} />
        <Stat label="Net, last 12 months" value={money(net(year))} />
      </div>
      <Card title="By brand, last 12 months" className="mb-6">
        {year.length === 0 ? <EmptyState title="No live sales yet">Test-mode orders don&apos;t count here.</EmptyState> : (
          <Table head={["Brand", "Currency", "Orders", "Gross", "Tax", "Fees", "Refunds", "Net"]}>
            {year.map((r) => (
              <tr key={`${r.brandSlug}-${r.currency}`}>
                <td className="px-4 py-2">{r.brandSlug}</td><td className="px-4 py-2">{r.currency}</td><td className="px-4 py-2">{r.orders}</td>
                <td className="px-4 py-2">{money(r.grossCents, r.currency)}</td><td className="px-4 py-2">{money(r.taxCents, r.currency)}</td>
                <td className="px-4 py-2">{money(r.feeCents, r.currency)}</td><td className="px-4 py-2">{money(r.refundedCents, r.currency)}</td>
                <td className="px-4 py-2 font-medium">{money(r.grossCents - r.taxCents - r.feeCents - r.refundedCents, r.currency)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {commerce && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Payment providers">
            <p className="text-sm">Checkout uses: {commerce.active ? <Badge tone={commerce.active.testMode ? "warning" : "success"}>{commerce.active.label}</Badge> : <Badge tone="danger">off</Badge>}</p>
            <p className="mt-2 text-sm">Webhooks accepted from: {Object.values(commerce.providers).map((p) => p!.label).join(", ") || "none"}</p>
            {commerce.problems.length > 0 && <div className="mt-3"><Notice>{commerce.problems.map((p) => <p key={p}>{p}</p>)}</Notice></div>}
          </Card>
          <Card title="Recent webhooks">
            {events.length === 0 ? <p className="text-sm text-[var(--color-muted-text)]">None received yet.</p> : (
              <ul className="divide-y divide-[var(--color-border)] text-xs">
                {events.map((e) => (
                  <li key={e.id} className="py-1.5">
                    <span className="font-mono">{e.receivedAt.toISOString().slice(5, 16).replace("T", " ")}</span> · {e.provider} · {e.eventType} · {e.error ? <span className="text-red-700">{e.outcome}: {e.error}</span> : e.outcome}
                    {e.attempts > 1 && ` · ${e.attempts} deliveries`}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
