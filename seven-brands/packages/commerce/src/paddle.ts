import { z } from "zod";
import { cents, hmacSha256Hex, safeEqualHex } from "./crypto";
import {
  ProviderApiError,
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutResult,
  type FetchLike,
  type PaymentProvider,
  type ProviderEvent,
  type RefundOrderRequest,
  type RefundOrderResult,
} from "./types";

/**
 * Paddle Billing adapter (Merchant of Record).
 *
 * Checkout: we create a transaction with a non-catalog price (our database is the source of truth for prices)
 * attached to one Paddle product per store, and send the buyer to our own `/checkout/paddle` page, where
 * Paddle.js opens the checkout for `?_ptxn=…`. That page's domain must be approved in Paddle.
 * Shapes follow the official @paddle/paddle-node-sdk v3 (REST at api.paddle.com / sandbox-api.paddle.com).
 *
 * Webhooks: `Paddle-Signature: ts=<unix>;h1=<hex>` where h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`).
 * We reject signatures older than `signatureToleranceSeconds` (replays are also stopped by idempotency).
 * Paid: `transaction.completed`. Refunds: `adjustment.created` / `adjustment.updated` with action "refund"
 * and status "approved" (Paddle reviews refunds first, so most arrive as an update).
 */

export interface PaddleConfig {
  apiKey: string;
  /** Paddle product (pro_…) that every non-catalog price is attached to. */
  productId: string;
  webhookSecret: string;
  /** Client-side token (test_… / live_…) used by Paddle.js on our checkout page. Not a secret. */
  clientToken: string;
  environment: "sandbox" | "production";
  currencies?: string[];
  signatureToleranceSeconds?: number;
  apiBase?: string;
  fetch?: FetchLike;
  now?: () => number;
}

const Totals = z.object({
  subtotal: z.union([z.string(), z.number()]),
  tax: z.union([z.string(), z.number()]),
  total: z.union([z.string(), z.number()]),
  grand_total: z.union([z.string(), z.number()]).optional(),
  fee: z.union([z.string(), z.number()]).nullable().optional(),
});

const Transaction = z.object({
  id: z.string(),
  status: z.string(),
  currency_code: z.string(),
  custom_data: z.record(z.string(), z.unknown()).nullable().optional(),
  details: z.object({ totals: Totals }).passthrough().nullable().optional(),
  billed_at: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  created_at: z.string().optional(),
});

const Adjustment = z.object({
  id: z.string(),
  action: z.string(),
  status: z.string(),
  transaction_id: z.string(),
  totals: z.object({ total: z.union([z.string(), z.number()]) }).passthrough(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const Envelope = z.object({
  event_id: z.string(),
  event_type: z.string(),
  occurred_at: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export class PaddleProvider implements PaymentProvider {
  readonly name = "paddle" as const;
  readonly testMode: boolean;
  readonly label: string;
  readonly currencies: readonly string[];
  private readonly base: string;
  private readonly fetch: FetchLike;
  private readonly now: () => number;

  constructor(private readonly cfg: PaddleConfig) {
    for (const k of ["apiKey", "productId", "webhookSecret", "clientToken"] as const) {
      if (!cfg[k]) throw new Error(`Paddle is missing ${k}`);
    }
    this.testMode = cfg.environment === "sandbox";
    this.label = `Paddle${this.testMode ? " (sandbox)" : ""}`;
    this.currencies = (cfg.currencies ?? ["USD"]).map((c) => c.toUpperCase());
    this.base = cfg.apiBase ?? (this.testMode ? "https://sandbox-api.paddle.com" : "https://api.paddle.com");
    this.fetch = cfg.fetch ?? ((u, i) => fetch(u, i));
    this.now = cfg.now ?? Date.now;
  }

  get clientToken(): string {
    return this.cfg.clientToken;
  }

  private async api(path: string, init: { method: string; body?: unknown }) {
    const res = await this.fetch(`${this.base}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const detail = json?.error?.detail ?? json?.error?.code ?? text.slice(0, 200);
      throw new ProviderApiError(`Paddle ${init.method} ${path} failed (${res.status}): ${detail}`, res.status);
    }
    return json;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const currency = req.currency.toUpperCase();
    if (!this.currencies.includes(currency)) throw new ProviderApiError(`Paddle is not configured for ${currency}`, null);
    const json = await this.api("/transactions", {
      method: "POST",
      body: {
        items: [
          {
            quantity: 1,
            price: {
              description: `${req.brandName}: ${req.productTitle} (${req.licenseLabel} license)`,
              name: `${req.productTitle} — ${req.licenseLabel} license`,
              unit_price: { amount: String(req.amountCents), currency_code: currency },
              product_id: this.cfg.productId,
              quantity: { minimum: 1, maximum: 1 },
            },
          },
        ],
        currency_code: currency,
        custom_data: { checkout_id: req.sessionId },
        checkout: { url: `${req.storefrontOrigin}/checkout/paddle` },
      },
    });
    const url = json?.data?.checkout?.url;
    if (typeof url !== "string" || !url) throw new ProviderApiError("Paddle returned no checkout URL (check the approved domain / default payment link)", null);
    return { providerCheckoutId: String(json.data.id), url };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent> {
    const header = headers.get("paddle-signature") ?? "";
    let ts = "";
    const h1s: string[] = [];
    for (const part of header.split(";")) {
      const [k, v] = part.split("=");
      if (k === "ts" && v) ts = v;
      if (k === "h1" && v) h1s.push(v); // several h1 values may be present while a secret is rotated
    }
    if (!/^\d+$/.test(ts) || h1s.length === 0) throw new WebhookSignatureError();
    const tolerance = this.cfg.signatureToleranceSeconds ?? 60;
    if (Math.abs(this.now() / 1000 - Number(ts)) > tolerance) throw new WebhookSignatureError("Webhook signature timestamp is too old");
    const expected = hmacSha256Hex(this.cfg.webhookSecret, `${ts}:${rawBody}`);
    if (!h1s.some((h) => safeEqualHex(expected, h))) throw new WebhookSignatureError();

    const env = Envelope.parse(JSON.parse(rawBody));
    const eventType = env.event_type;
    const eventId = env.event_id;

    if (eventType === "transaction.completed") {
      const t = Transaction.parse(env.data);
      const totals = t.details?.totals;
      if (!totals) throw new Error("Paddle transaction has no totals");
      const checkoutId = t.custom_data?.checkout_id;
      return {
        kind: "paid",
        eventId,
        eventType,
        providerOrderId: t.id,
        checkoutSessionId: typeof checkoutId === "string" ? checkoutId : null,
        currency: t.currency_code.toUpperCase(),
        subtotalCents: cents(totals.subtotal),
        taxCents: cents(totals.tax),
        totalCents: cents(totals.grand_total ?? totals.total),
        feeCents: totals.fee == null ? null : cents(totals.fee),
        email: null, // Paddle sends a customer id; the buyer is already known from our checkout session
        testMode: this.testMode,
        paidAt: new Date(t.billed_at ?? t.updated_at ?? env.occurred_at),
      };
    }
    if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
      const a = Adjustment.parse(env.data);
      if (a.action !== "refund") return { kind: "ignored", eventId, eventType, reason: `Adjustment action ${a.action}` };
      if (a.status !== "approved") return { kind: "ignored", eventId, eventType, reason: `Refund is ${a.status}` };
      return {
        kind: "refund",
        eventId,
        eventType,
        providerOrderId: a.transaction_id,
        refundedAt: new Date(a.updated_at ?? a.created_at ?? env.occurred_at),
        mode: "increment",
        amountCents: cents(a.totals.total),
        providerRefundId: a.id,
      };
    }
    return { kind: "ignored", eventId, eventType, reason: "Event not used" };
  }

  async refund(req: RefundOrderRequest): Promise<RefundOrderResult> {
    const txnPath = `/transactions/${encodeURIComponent(req.providerOrderId)}`;
    let body: Record<string, unknown>;
    if (req.amountCents >= req.totalCents) {
      body = { action: "refund", type: "full", transaction_id: req.providerOrderId, reason: req.reason.slice(0, 1000) };
    } else {
      // Partial refunds are per line item; we sell one item per transaction.
      const txn = await this.api(txnPath, { method: "GET" });
      const itemId = txn?.data?.details?.line_items?.[0]?.id;
      if (typeof itemId !== "string") throw new ProviderApiError("Paddle transaction has no line item to refund", null);
      body = {
        action: "refund",
        type: "partial",
        transaction_id: req.providerOrderId,
        reason: req.reason.slice(0, 1000),
        items: [{ item_id: itemId, type: "partial", amount: String(req.amountCents) }],
      };
    }
    const json = await this.api("/adjustments", { method: "POST", body });
    // Paddle reviews refunds; the approved adjustment arrives by webhook.
    return { providerRefundId: typeof json?.data?.id === "string" ? json.data.id : null, confirmsByWebhook: true };
  }
}
