import { applyProviderRefund, finishWebhookEvent, fulfillPaidOrder, recordWebhookEvent, type Database } from "@sb/db";
import { WebhookSignatureError, type PaymentProvider, type ProviderEvent } from "./types";

export interface WebhookResponse {
  status: number;
  body: { ok: boolean; outcome: string; error?: string };
}

export interface WebhookLogger {
  info(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

const silent: WebhookLogger = { info() {}, error() {} };

/**
 * Handles one webhook delivery end to end:
 * 1. verify the signature (invalid → 401, nothing stored);
 * 2. store the event, unique per (provider, event id) — a repeat of a processed event is acknowledged and skipped;
 * 3. fulfil / refund / ignore;
 * 4. record the outcome. Unexpected errors return 500 so the provider retries; deterministic rejections return 200
 *    (retrying wouldn't help) and stay visible in the admin's webhook log.
 */
export async function handleWebhook(
  db: Database,
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  log: WebhookLogger = silent,
): Promise<WebhookResponse> {
  let event: ProviderEvent;
  try {
    event = await provider.parseWebhook(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      log.error("webhook.bad_signature", { provider: provider.name });
      return { status: 401, body: { ok: false, outcome: "bad_signature" } };
    }
    log.error("webhook.unparseable", { provider: provider.name, error: (err as Error).message });
    return { status: 400, body: { ok: false, outcome: "unparseable", error: (err as Error).message } };
  }

  const { event: stored, duplicate } = await recordWebhookEvent(db, {
    provider: provider.name,
    eventId: event.eventId,
    eventType: event.eventType,
    payload: JSON.parse(rawBody),
  });
  if (duplicate) return { status: 200, body: { ok: true, outcome: "duplicate" } };

  try {
    let outcome: string;
    let error: string | null = null;
    if (event.kind === "paid") {
      if (!event.checkoutSessionId) {
        outcome = "rejected";
        error = "Payment has no checkout_id in its custom data (not created by this store?)";
      } else {
        const r = await fulfillPaidOrder(db, {
          provider: provider.name,
          providerOrderId: event.providerOrderId,
          checkoutSessionId: event.checkoutSessionId,
          currency: event.currency,
          subtotalCents: event.subtotalCents,
          taxCents: event.taxCents,
          totalCents: event.totalCents,
          feeCents: event.feeCents,
          email: event.email,
          testMode: event.testMode,
          paidAt: event.paidAt,
        });
        outcome = r.status;
        if (r.status === "rejected") error = r.reason;
      }
    } else if (event.kind === "refund") {
      const r = await applyProviderRefund(db, {
        provider: provider.name,
        providerOrderId: event.providerOrderId,
        refundedAt: event.refundedAt,
        ...(event.mode === "cumulative" ? { mode: "cumulative" as const, refundedCents: event.refundedCents } : { mode: "increment" as const, amountCents: event.amountCents, providerRefundId: event.providerRefundId }),
      });
      outcome = `refund_${r.status}`;
      if (r.status === "unknown_order") error = `No order ${event.providerOrderId} from ${provider.name}`;
    } else {
      outcome = `ignored: ${event.reason}`;
    }
    // Rejections are recorded with an error but marked processed: retrying the same payload can't succeed.
    await finishWebhookEvent(db, stored.id, { outcome, error });
    log.info("webhook.processed", { provider: provider.name, eventId: event.eventId, outcome });
    return { status: 200, body: { ok: error === null, outcome, ...(error ? { error } : {}) } };
  } catch (err) {
    const message = (err as Error).message;
    await finishWebhookEvent(db, stored.id, { outcome: "error", error: message }).catch(() => {});
    log.error("webhook.failed", { provider: provider.name, eventId: event.eventId, error: message });
    return { status: 500, body: { ok: false, outcome: "error" } };
  }
}
