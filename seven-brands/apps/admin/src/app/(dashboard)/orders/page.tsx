import { brandsWith, can } from "@sb/core";
import { getDb, listOrders, listRefundRequests } from "@sb/db";
import { Badge, Card, EmptyState, PageHeader, Table } from "@sb/ui";
import Link from "next/link";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";

export const metadata = { title: "Orders" };

const TONE = { paid: "success", partially_refunded: "warning", refunded: "danger" } as const;

export default async function OrdersPage() {
  const staff = await requirePageStaff("order.read");
  const db = getDb();
  const scope = brandsWith(staff.grants, "order.read");
  const [orders, pending] = await Promise.all([listOrders(db, scope), listRefundRequests(db, scope, { status: "requested" })]);
  return (
    <>
      <PageHeader title="Orders" description="Orders are created only by verified payment webhooks. Refunds are requested by support and approved by an owner." />
      {pending.length > 0 && (
        <Card title={`Refunds waiting for approval (${pending.length})`} className="mb-6">
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {pending.map(({ request: r, order: o, brandSlug }) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <Link href={`/orders/${o.id}`} className="font-medium underline">{o.id}</Link> · {brandSlug} · {money(r.amountCents, o.currency)} — {r.reason}
                </span>
                {can(staff.grants, "order.refund", r.brandId) ? <Link href={`/orders/${o.id}`} className="underline">Review</Link> : <span className="text-[var(--color-muted-text)]">Owner approval needed</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Recent orders">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" />
        ) : (
          <Table head={["Paid", "Order", "Brand", "Customer", "Total", "Provider", "Status"]}>
            {orders.map(({ order: o, brandSlug, customerEmail }) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs">{o.paidAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2"><Link href={`/orders/${o.id}`} className="font-mono text-xs underline">{o.id}</Link></td>
                <td className="px-4 py-2">{brandSlug}</td>
                <td className="px-4 py-2">{customerEmail}</td>
                <td className="px-4 py-2">{money(o.totalCents, o.currency)}</td>
                <td className="px-4 py-2">{o.provider}{o.testMode && <> <Badge tone="warning">test</Badge></>}</td>
                <td className="px-4 py-2"><Badge tone={TONE[o.status]}>{o.status.replace("_", " ")}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
