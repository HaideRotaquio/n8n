import { can, LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { getDb, getOrderDetail } from "@sb/db";
import { Badge, Card, Field, Input, PageHeader, Table, Textarea } from "@sb/ui";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";
import { decideRefundAction, requestRefundAction } from "../actions";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const d = await getOrderDetail(db, id);
  if (!d) notFound();
  const staff = await requirePageStaff("order.read", d.order.brandId);
  const o = d.order;
  const open = d.refunds.find((r) => r.status === "requested" || r.status === "submitted");
  const remaining = o.totalCents - o.refundedCents;
  return (
    <>
      <PageHeader title={`Order ${o.id}`} description={<>{d.brand.name} · {d.userName} ({d.userEmail}) · {o.provider} {o.providerOrderId}</>} actions={o.testMode ? <Badge tone="warning">Test order</Badge> : undefined} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items">
            <Table head={["Product", "License", "Price"]}>
              {d.items.map((i) => (
                <tr key={i.id}><td className="px-4 py-2">{i.titleSnapshot}</td><td className="px-4 py-2">{LICENSE_TYPE_LABELS[i.licenseType as LicenseType] ?? i.licenseType}</td><td className="px-4 py-2">{money(i.amountCents, i.currency)}</td></tr>
              ))}
            </Table>
            <dl className="mt-4 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
              <dt className="text-[var(--color-muted-text)]">Subtotal</dt><dd>{money(o.subtotalCents, o.currency)}</dd>
              <dt className="text-[var(--color-muted-text)]">Tax</dt><dd>{money(o.taxCents, o.currency)}</dd>
              <dt className="text-[var(--color-muted-text)]">Total</dt><dd>{money(o.totalCents, o.currency)}</dd>
              <dt className="text-[var(--color-muted-text)]">Provider fee</dt><dd>{o.feeCents === null ? "—" : money(o.feeCents, o.currency)}</dd>
              <dt className="text-[var(--color-muted-text)]">Refunded</dt><dd>{money(o.refundedCents, o.currency)}</dd>
              <dt className="text-[var(--color-muted-text)]">Downloads</dt><dd>{d.downloadCount}</dd>
            </dl>
          </Card>
          <Card title="Licenses">
            <ul className="text-sm">
              {d.licenses.map((l) => (
                <li key={l.id}><span className="font-mono">{l.code}</span> · {l.licenseType} · {l.revokedAt ? <Badge tone="danger">revoked: {l.revokedReason}</Badge> : <Badge tone="success">active</Badge>}</li>
              ))}
            </ul>
          </Card>
          <Card title="Refunds">
            {d.refunds.length === 0 ? <p className="text-sm text-[var(--color-muted-text)]">None.</p> : (
              <Table head={["Requested", "Amount", "Reason", "Status"]}>
                {d.refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-xs">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="px-4 py-2">{money(r.amountCents, o.currency)}</td>
                    <td className="px-4 py-2">{r.reason}{r.error && <div className="text-xs text-red-700">{r.error}</div>}</td>
                    <td className="px-4 py-2"><Badge tone={r.status === "completed" ? "success" : r.status === "failed" || r.status === "rejected" ? "danger" : "warning"}>{r.status}</Badge></td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {open?.status === "requested" && can(staff.grants, "order.refund", o.brandId) && (
            <Card title="Approve refund">
              <p className="mb-3 text-sm">{money(open.amountCents, o.currency)} — {open.reason}</p>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={decideRefundAction.bind(null, open.id, true)} submit="Approve and refund" confirm={`Refund ${money(open.amountCents, o.currency)} to the customer?`} />
                <ActionForm action={decideRefundAction.bind(null, open.id, false)} submit="Reject" variant="secondary">
                  <Field label="Note (optional)" htmlFor="note"><Input id="note" name="note" /></Field>
                </ActionForm>
              </div>
            </Card>
          )}
          {!open && remaining > 0 && can(staff.grants, "customer.write", o.brandId) && (
            <Card title="Request a refund">
              <ActionForm action={requestRefundAction.bind(null, o.id)} submit="Request refund">
                <Field label="Amount (USD)" htmlFor="amount" hint={`Empty = full remaining ${money(remaining, o.currency)}. A full refund revokes the license.`}><Input id="amount" name="amount" inputMode="decimal" /></Field>
                <Field label="Reason" htmlFor="reason"><Textarea id="reason" name="reason" rows={2} required /></Field>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
