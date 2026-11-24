"use server";

import { commerceFromEnv } from "@sb/commerce";
import { AppError, can } from "@sb/core";
import { applyProviderRefund, decideRefund, getDb, getOrderDetail, markRefundFailed, markRefundSubmitted, requestRefund, schema } from "@sb/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { parseMoney } from "@/lib/money";
import { getStaff, requestAuditContext } from "@/lib/server";

const fail = (message: string): ActionState => ({ ok: false, message });

export async function requestRefundAction(orderId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  const db = getDb();
  const detail = await getOrderDetail(db, orderId);
  if (!staff || !detail || !can(staff.grants, "customer.write", detail.order.brandId)) return fail("You can't request refunds for this brand.");
  const raw = String(form.get("amount") ?? "").trim();
  const amountCents = raw ? parseMoney(raw) : undefined;
  if (amountCents === null) return fail("Enter an amount like 9.99, or leave it empty for a full refund.");
  try {
    await requestRefund(db, await requestAuditContext(staff.user.id), { orderId, amountCents, reason: String(form.get("reason") ?? "") });
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true, message: "Refund requested. An owner must approve it before any money moves." };
}

/**
 * Owner-only (order.refund). Approving asks the provider to refund. Providers confirm by webhook;
 * the test provider confirms at once and is recorded here.
 */
export async function decideRefundAction(refundId: string, approve: boolean, _prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  const db = getDb();
  const [r] = await db.select().from(schema.refundRequest).where(eq(schema.refundRequest.id, refundId));
  if (!staff || !r || !can(staff.grants, "order.refund", r.brandId)) return fail("Only an owner can decide refunds.");
  let decided;
  try {
    decided = await decideRefund(db, await requestAuditContext(staff.user.id), { refundId, approve, note: String(form.get("note") ?? "") || undefined });
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
  revalidatePath(`/orders/${r.orderId}`);
  revalidatePath("/orders");
  if (!approve) return { ok: true, message: "Refund rejected." };

  const o = decided.order;
  const provider = commerceFromEnv(process.env).providers[o.provider];
  if (!provider) {
    await markRefundFailed(db, refundId, `${o.provider} is not configured on this server`);
    return fail(`Approved, but ${o.provider} isn't configured here, so nothing was sent. Refund it in the provider's dashboard; the webhook will record it.`);
  }
  try {
    const res = await provider.refund({ providerOrderId: o.providerOrderId, amountCents: r.amountCents, totalCents: o.totalCents, reason: r.reason });
    if (res.confirmsByWebhook) {
      await markRefundSubmitted(db, refundId, res.providerRefundId);
      return { ok: true, message: `Sent to ${provider.label}. The order updates when they confirm the refund.` };
    }
    await applyProviderRefund(db, { provider: o.provider, providerOrderId: o.providerOrderId, refundedAt: new Date(), mode: "increment", amountCents: r.amountCents, providerRefundId: res.providerRefundId ?? `manual_${refundId}` });
    revalidatePath(`/orders/${r.orderId}`);
    return { ok: true, message: "Refunded." };
  } catch (e) {
    await markRefundFailed(db, refundId, (e as Error).message);
    return fail(`The provider refused the refund: ${(e as Error).message}`);
  }
}
