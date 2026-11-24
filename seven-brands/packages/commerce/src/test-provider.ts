import { hmacSha256Hex, safeEqualHex } from "./crypto";
import {
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type ProviderEvent,
  type RefundOrderRequest,
  type RefundOrderResult,
} from "./types";

/**
 * Labelled test provider for local development and end-to-end tests. No money moves.
 * The storefront's `/checkout/test` page plays the provider: it shows "Pay (test)" and posts a webhook signed with
 * the same secret to `/api/webhooks/test`, so fulfilment runs through exactly the same code as real providers.
 * Every order it creates is a test order (excluded from revenue). Never enable it on a public deployment.
 */
export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;
  readonly testMode = true;
  readonly label = "Test provider (no real payments)";
  readonly currencies = ["USD"] as const;

  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) throw new Error("COMMERCE_TEST_SECRET must be at least 16 characters");
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const url = new URL("/checkout/test", req.storefrontOrigin);
    url.searchParams.set("session", req.sessionId);
    return { providerCheckoutId: `test_${req.sessionId}`, url: url.toString() };
  }

  /** Builds the signed webhook body the fake checkout page sends. */
  signedEvent(event: TestWebhookBody): { body: string; signature: string } {
    const body = JSON.stringify(event);
    return { body, signature: hmacSha256Hex(this.secret, body) };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent> {
    const sig = headers.get("x-test-signature") ?? "";
    if (!safeEqualHex(hmacSha256Hex(this.secret, rawBody), sig)) throw new WebhookSignatureError();
    const e = JSON.parse(rawBody) as TestWebhookBody;
    if (e.type === "paid") {
      return {
        kind: "paid",
        eventId: e.id,
        eventType: "test.paid",
        providerOrderId: e.orderId,
        checkoutSessionId: e.checkoutSessionId,
        currency: e.currency,
        subtotalCents: e.amountCents,
        taxCents: 0,
        totalCents: e.amountCents,
        feeCents: 0,
        email: e.email ?? null,
        testMode: true,
        paidAt: new Date(e.at),
      };
    }
    if (e.type === "refund") {
      return { kind: "refund", eventId: e.id, eventType: "test.refund", providerOrderId: e.orderId, refundedAt: new Date(e.at), mode: "increment", amountCents: e.amountCents, providerRefundId: e.id };
    }
    return { kind: "ignored", eventId: (e as { id: string }).id, eventType: "test.unknown", reason: "Unknown test event" };
  }

  /** Test refunds complete at once: the caller records them immediately. */
  async refund(_req: RefundOrderRequest): Promise<RefundOrderResult> {
    return { providerRefundId: `test_ref_${Date.now().toString(36)}`, confirmsByWebhook: false };
  }
}

export type TestWebhookBody =
  | { type: "paid"; id: string; orderId: string; checkoutSessionId: string; currency: string; amountCents: number; email?: string; at: string }
  | { type: "refund"; id: string; orderId: string; amountCents: number; at: string };
