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
 * Lemon Squeezy adapter (Merchant of Record).
 *
 * One generic store variant is used for every product; the real price comes from our database via
 * `custom_price` and the product name via `product_options`. Shapes follow the official
 * @lemonsqueezy/lemonsqueezy.js SDK v4 (JSON:API at https://api.lemonsqueezy.com/v1).
 *
 * Webhooks: `X-Signature` = hex HMAC-SHA256 of the raw body with the webhook signing secret.
 * Lemon Squeezy sends no event id, so we derive a stable one from the event name, order id and the
 * refunded amount (for refunds), which is unique per state change and identical on retries.
 */

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  /** The single "Digital asset" variant whose price is overridden per checkout. */
  variantId: string;
  webhookSecret: string;
  /** Lemon Squeezy test mode. Use a test-mode API key and store while not approved for live payments. */
  testMode: boolean;
  /** The store's currency; custom prices are charged in it. */
  currency?: string;
  apiBase?: string;
  fetch?: FetchLike;
}

const OrderAttributes = z.object({
  identifier: z.string().optional(),
  order_number: z.number().optional(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  refunded: z.boolean().optional(),
  refunded_amount: z.number().optional(),
  refunded_at: z.string().nullable().optional(),
  user_email: z.string().nullable().optional(),
  test_mode: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

const Payload = z.object({
  meta: z.object({
    event_name: z.string(),
    test_mode: z.boolean().optional(),
    custom_data: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  data: z.object({ type: z.string(), id: z.union([z.string(), z.number()]).transform(String), attributes: z.record(z.string(), z.unknown()) }),
});

export class LemonSqueezyProvider implements PaymentProvider {
  readonly name = "lemonsqueezy" as const;
  readonly testMode: boolean;
  readonly label: string;
  readonly currencies: readonly string[];
  private readonly base: string;
  private readonly fetch: FetchLike;

  constructor(private readonly cfg: LemonSqueezyConfig) {
    for (const k of ["apiKey", "storeId", "variantId", "webhookSecret"] as const) {
      if (!cfg[k]) throw new Error(`Lemon Squeezy is missing ${k}`);
    }
    if (cfg.webhookSecret.length < 16) throw new Error("Lemon Squeezy webhook secret must be at least 16 characters");
    this.testMode = cfg.testMode;
    this.label = `Lemon Squeezy${cfg.testMode ? " (test mode)" : ""}`;
    this.currencies = [(cfg.currency ?? "USD").toUpperCase()];
    this.base = cfg.apiBase ?? "https://api.lemonsqueezy.com";
    this.fetch = cfg.fetch ?? ((u, i) => fetch(u, i));
  }

  private async api(path: string, init: { method: string; body?: unknown }) {
    const res = await this.fetch(`${this.base}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      const detail = json?.errors?.[0]?.detail ?? json?.message ?? text.slice(0, 200);
      throw new ProviderApiError(`Lemon Squeezy ${init.method} ${path} failed (${res.status}): ${detail}`, res.status);
    }
    return json;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (!this.currencies.includes(req.currency.toUpperCase())) {
      throw new ProviderApiError(`This Lemon Squeezy store charges in ${this.currencies[0]}, not ${req.currency}`, null);
    }
    const json = await this.api("/v1/checkouts", {
      method: "POST",
      body: {
        data: {
          type: "checkouts",
          attributes: {
            custom_price: req.amountCents,
            product_options: {
              name: `${req.productTitle} — ${req.licenseLabel} license`,
              description: `${req.brandName}: ${req.productTitle}. License: ${req.licenseLabel}.`,
              redirect_url: req.successUrl,
              receipt_button_text: "Go to your downloads",
              receipt_link_url: req.successUrl,
            },
            checkout_options: { embed: false, media: false, logo: true },
            checkout_data: { email: req.email, name: req.name, custom: { checkout_id: req.sessionId } },
            expires_at: req.expiresAt.toISOString(),
            test_mode: this.testMode,
          },
          relationships: {
            store: { data: { type: "stores", id: String(this.cfg.storeId) } },
            variant: { data: { type: "variants", id: String(this.cfg.variantId) } },
          },
        },
      },
    });
    const url = json?.data?.attributes?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new ProviderApiError("Lemon Squeezy returned no checkout URL", null);
    return { providerCheckoutId: String(json.data.id), url };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent> {
    const sig = headers.get("x-signature") ?? "";
    if (!sig || !safeEqualHex(hmacSha256Hex(this.cfg.webhookSecret, rawBody), sig)) throw new WebhookSignatureError();
    const parsed = Payload.safeParse(JSON.parse(rawBody));
    if (!parsed.success) throw new Error("Unrecognized Lemon Squeezy webhook payload");
    const { meta, data } = parsed.data;
    const eventType = meta.event_name;

    if (data.type !== "orders" || (eventType !== "order_created" && eventType !== "order_refunded")) {
      return { kind: "ignored", eventId: `${eventType}:${data.type}:${data.id}`, eventType, reason: "Event not used" };
    }
    const a = OrderAttributes.parse(data.attributes);
    if (eventType === "order_created") {
      const eventId = `order_created:${data.id}`;
      if (a.status !== "paid") return { kind: "ignored", eventId, eventType, reason: `Order status is ${a.status}` };
      const checkoutId = meta.custom_data?.checkout_id;
      return {
        kind: "paid",
        eventId,
        eventType,
        providerOrderId: String(data.id),
        checkoutSessionId: typeof checkoutId === "string" ? checkoutId : null,
        currency: a.currency.toUpperCase(),
        subtotalCents: cents(a.subtotal),
        taxCents: cents(a.tax),
        totalCents: cents(a.total),
        feeCents: null, // not exposed on the order object
        email: a.user_email ?? null,
        testMode: a.test_mode,
        paidAt: new Date(a.created_at),
      };
    }
    const refunded = cents(a.refunded_amount ?? 0);
    return {
      kind: "refund",
      eventId: `order_refunded:${data.id}:${refunded}`,
      eventType,
      providerOrderId: String(data.id),
      refundedAt: new Date(a.refunded_at ?? a.updated_at ?? Date.now()),
      mode: "cumulative",
      refundedCents: refunded,
    };
  }

  async refund(req: RefundOrderRequest): Promise<RefundOrderResult> {
    await this.api(`/v1/orders/${encodeURIComponent(req.providerOrderId)}/refund`, {
      method: "POST",
      body: { data: { type: "orders", id: String(req.providerOrderId), attributes: { amount: req.amountCents } } },
    });
    // Confirmed by the `order_refunded` webhook (cumulative amount).
    return { providerRefundId: null, confirmsByWebhook: true };
  }
}
