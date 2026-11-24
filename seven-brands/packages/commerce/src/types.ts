import type { PaymentProviderName } from "@sb/db";

/**
 * Provider-neutral payment interface. Each Merchant-of-Record adapter (Lemon Squeezy, Paddle) and the
 * labelled test provider implement it. Nothing here touches the database: the webhook handler
 * (`handleWebhook`) owns persistence and idempotency.
 */

export interface CheckoutRequest {
  /** Our checkout_session id; sent to the provider as custom data and echoed back in the webhook. */
  sessionId: string;
  brandName: string;
  productTitle: string;
  licenseLabel: string;
  amountCents: number;
  currency: string;
  email: string;
  name?: string;
  /** Where the provider sends the buyer after paying. */
  successUrl: string;
  /** Storefront origin, for providers that open checkout on our own page (Paddle). */
  storefrontOrigin: string;
  expiresAt: Date;
}

export interface CheckoutResult {
  providerCheckoutId: string | null;
  url: string;
}

export interface PaidEvent {
  kind: "paid";
  eventId: string;
  eventType: string;
  providerOrderId: string;
  checkoutSessionId: string | null;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  feeCents: number | null;
  email: string | null;
  testMode: boolean;
  paidAt: Date;
}

export type RefundEvent = {
  kind: "refund";
  eventId: string;
  eventType: string;
  providerOrderId: string;
  refundedAt: Date;
} & ({ mode: "cumulative"; refundedCents: number } | { mode: "increment"; amountCents: number; providerRefundId: string });

export interface IgnoredEvent {
  kind: "ignored";
  eventId: string;
  eventType: string;
  reason: string;
}

export type ProviderEvent = PaidEvent | RefundEvent | IgnoredEvent;

export interface RefundOrderRequest {
  providerOrderId: string;
  amountCents: number;
  totalCents: number;
  reason: string;
}

export interface RefundOrderResult {
  providerRefundId: string | null;
  /** true: the provider confirms by webhook later. false: done now (the caller records it immediately). */
  confirmsByWebhook: boolean;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** Sandbox / test-mode credentials: every order is marked as a test order. */
  readonly testMode: boolean;
  /** Human label shown in the admin, e.g. "Paddle (sandbox)". */
  readonly label: string;
  /** Currencies this provider configuration can charge in. */
  readonly currencies: readonly string[];
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Verifies the signature and normalizes the payload. Throws WebhookSignatureError when invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent>;
  refund(req: RefundOrderRequest): Promise<RefundOrderResult>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class ProviderApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ProviderApiError";
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
