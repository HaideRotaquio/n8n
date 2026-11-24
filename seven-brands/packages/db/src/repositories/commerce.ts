import { generateLicenseCode, LICENSE_TERMS_VERSION, newId, NotFoundError, ValidationError } from "@sb/core";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import {
  brand,
  checkoutSession,
  customer,
  download,
  entitlement,
  expense,
  license,
  order,
  orderItem,
  price,
  product,
  productAsset,
  refundRequest,
  user,
  webhookEvent,
  type CheckoutSession,
  type Customer,
  type Entitlement,
  type License,
  type Order,
  type RefundRequest,
  type WebhookEvent,
} from "../schema";
import { recordAudit, type AuditContext } from "./audit";
import type { BrandScope } from "./brands";
import { deliverablePackageFor } from "./catalog";

/**
 * Orders, entitlements, licenses, downloads and refunds.
 *
 * Rules (see docs/SECURITY.md):
 * - Access is granted only by `fulfillPaidOrder`, which is called with a verified provider webhook
 *   and re-checks the amount against our own checkout session.
 * - Webhooks are idempotent: (provider, event id) is unique, and orders are unique per provider order id.
 * - Refunds need an owner's approval before money moves; a full refund revokes licenses and downloads.
 */

export type PaymentProviderName = Order["provider"];
const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Customers ───────────────────────────────────────────────────────────────

/** A user's relationship with one brand, created on first sign-in or purchase. */
export async function ensureCustomer(db: DbOrTx, userId: string, brandId: string): Promise<Customer> {
  await db.insert(customer).values({ id: newId("cus"), userId, brandId }).onConflictDoNothing();
  const [c] = await db.select().from(customer).where(and(eq(customer.userId, userId), eq(customer.brandId, brandId)));
  return c!;
}

export async function getCustomerForUser(db: Database, userId: string, brandId: string): Promise<Customer | null> {
  const [c] = await db.select().from(customer).where(and(eq(customer.userId, userId), eq(customer.brandId, brandId)));
  return c ?? null;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

/**
 * Records what the customer is about to buy, at today's price, before redirecting to the provider.
 * The provider gets our session id as custom data; the webhook is matched against this row.
 */
export async function createCheckoutSession(
  db: Database,
  input: { brandId: string; customerId: string; productSlug: string; licenseType: string; currency?: string; provider: PaymentProviderName; testMode: boolean; now?: Date },
): Promise<{ session: CheckoutSession; productTitle: string }> {
  const currency = (input.currency ?? "USD").toUpperCase();
  const [row] = await db
    .select({ product, price })
    .from(product)
    .innerJoin(price, eq(price.productId, product.id))
    .where(
      and(
        eq(product.brandId, input.brandId),
        eq(product.slug, input.productSlug),
        eq(product.status, "published"),
        eq(price.licenseType, input.licenseType),
        eq(price.currency, currency),
        eq(price.active, true),
      ),
    );
  if (!row) throw new NotFoundError("This product or license isn't for sale");
  if (row.price.amountCents <= 0) throw new ValidationError("Free products don't go through checkout");
  const [c] = await db.select().from(customer).where(eq(customer.id, input.customerId));
  if (!c || c.brandId !== input.brandId) throw new ValidationError("Customer does not belong to this brand");
  const now = input.now ?? new Date();
  const [s] = await db
    .insert(checkoutSession)
    .values({
      id: newId("chk"),
      brandId: input.brandId,
      customerId: input.customerId,
      productId: row.product.id,
      priceId: row.price.id,
      licenseType: row.price.licenseType,
      currency,
      amountCents: row.price.amountCents,
      provider: input.provider,
      testMode: input.testMode,
      expiresAt: new Date(now.getTime() + CHECKOUT_TTL_MS),
    })
    .returning();
  return { session: s!, productTitle: row.product.title };
}

export async function attachProviderCheckout(db: DbOrTx, sessionId: string, providerCheckoutId: string | null, url: string): Promise<void> {
  await db.update(checkoutSession).set({ providerCheckoutId, url }).where(eq(checkoutSession.id, sessionId));
}

export async function markCheckoutFailed(db: DbOrTx, sessionId: string): Promise<void> {
  await db.update(checkoutSession).set({ status: "failed" }).where(and(eq(checkoutSession.id, sessionId), eq(checkoutSession.status, "open")));
}

export async function getCheckoutSession(db: DbOrTx, sessionId: string): Promise<CheckoutSession | null> {
  const [s] = await db.select().from(checkoutSession).where(eq(checkoutSession.id, sessionId));
  return s ?? null;
}

// ─── Webhook events (idempotency) ────────────────────────────────────────────

/**
 * Stores a verified webhook. Returns `duplicate: true` when this event was already processed successfully,
 * so the caller can acknowledge it without doing anything twice.
 */
export async function recordWebhookEvent(
  db: DbOrTx,
  input: { provider: PaymentProviderName; eventId: string; eventType: string; payload: unknown },
): Promise<{ event: WebhookEvent; duplicate: boolean }> {
  await db
    .insert(webhookEvent)
    .values({ id: newId("whe"), provider: input.provider, eventId: input.eventId.slice(0, 300), eventType: input.eventType.slice(0, 100), payload: input.payload as object })
    .onConflictDoNothing();
  const [e] = await db
    .update(webhookEvent)
    .set({ attempts: sql`${webhookEvent.attempts} + 1` })
    .where(and(eq(webhookEvent.provider, input.provider), eq(webhookEvent.eventId, input.eventId.slice(0, 300))))
    .returning();
  return { event: e!, duplicate: e!.processedAt !== null && e!.error === null };
}

export async function finishWebhookEvent(db: DbOrTx, id: string, result: { outcome: string; error?: string | null }): Promise<void> {
  await db
    .update(webhookEvent)
    .set({ processedAt: new Date(), outcome: result.outcome.slice(0, 200), error: result.error?.slice(0, 2000) ?? null })
    .where(eq(webhookEvent.id, id));
}

export async function listWebhookEvents(db: Database, opts: { limit?: number; failedOnly?: boolean } = {}): Promise<WebhookEvent[]> {
  return db
    .select()
    .from(webhookEvent)
    .where(opts.failedOnly ? sql`${webhookEvent.error} is not null` : undefined)
    .orderBy(desc(webhookEvent.receivedAt))
    .limit(Math.min(opts.limit ?? 100, 500));
}

// ─── Fulfilment ──────────────────────────────────────────────────────────────

/** A completed payment, normalized from any provider. Amounts in the order currency's minor unit. */
export interface PaidOrderInput {
  provider: PaymentProviderName;
  providerOrderId: string;
  checkoutSessionId: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  feeCents?: number | null;
  email?: string | null;
  testMode: boolean;
  paidAt: Date;
}

export type FulfillResult =
  | { status: "fulfilled"; order: Order; license: License; entitlement: Entitlement }
  | { status: "already_fulfilled"; order: Order }
  | { status: "rejected"; reason: string };

/**
 * Turns a verified payment into an order, a license and an entitlement — once.
 * Rejects (without granting anything) when the payment doesn't match the checkout we created:
 * wrong provider, currency, amount or test/live mode.
 */
export async function fulfillPaidOrder(db: Database, input: PaidOrderInput): Promise<FulfillResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(order).where(and(eq(order.provider, input.provider), eq(order.providerOrderId, input.providerOrderId)));
    if (existing) return { status: "already_fulfilled", order: existing };

    const [s] = await tx.select().from(checkoutSession).where(eq(checkoutSession.id, input.checkoutSessionId)).for("update");
    if (!s) return { status: "rejected", reason: `Unknown checkout session ${input.checkoutSessionId}` };
    if (s.provider !== input.provider) return { status: "rejected", reason: `Checkout was created for ${s.provider}, payment came from ${input.provider}` };
    if (s.testMode !== input.testMode) return { status: "rejected", reason: `Test-mode mismatch (checkout ${s.testMode}, payment ${input.testMode})` };
    if (s.currency !== input.currency.toUpperCase()) return { status: "rejected", reason: `Currency mismatch (${s.currency} vs ${input.currency})` };
    if (input.subtotalCents < s.amountCents) {
      return { status: "rejected", reason: `Paid subtotal ${input.subtotalCents} is below the checkout price ${s.amountCents}` };
    }
    if (s.status === "completed") return { status: "rejected", reason: "Checkout session was already used by another order" };

    const [p] = await tx.select().from(product).where(eq(product.id, s.productId));
    const [c] = await tx.select({ customer, userName: user.name, userEmail: user.email }).from(customer).innerJoin(user, eq(user.id, customer.userId)).where(eq(customer.id, s.customerId));
    const [b] = await tx.select().from(brand).where(eq(brand.id, s.brandId));

    const [o] = await tx
      .insert(order)
      .values({
        id: newId("ord"),
        brandId: s.brandId,
        customerId: s.customerId,
        checkoutSessionId: s.id,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        currency: s.currency,
        subtotalCents: input.subtotalCents,
        taxCents: input.taxCents,
        totalCents: input.totalCents,
        feeCents: input.feeCents ?? null,
        email: input.email ?? c!.userEmail,
        testMode: input.testMode,
        paidAt: input.paidAt,
      })
      .returning();
    const [item] = await tx
      .insert(orderItem)
      .values({ id: newId("oi"), orderId: o!.id, productId: s.productId, priceId: s.priceId, licenseType: s.licenseType, titleSnapshot: p!.title, amountCents: s.amountCents, currency: s.currency })
      .returning();
    const [lic] = await tx
      .insert(license)
      .values({
        id: newId("lic"),
        code: generateLicenseCode(b!.slug),
        brandId: s.brandId,
        customerId: s.customerId,
        orderItemId: item!.id,
        productId: s.productId,
        licenseType: s.licenseType,
        termsVersion: LICENSE_TERMS_VERSION,
        licenseeName: c!.userName,
      })
      .returning();
    const [ent] = await tx
      .insert(entitlement)
      .values({ id: newId("ent"), brandId: s.brandId, customerId: s.customerId, productId: s.productId, licenseId: lic!.id, source: "order" })
      .returning();
    await tx.update(checkoutSession).set({ status: "completed" }).where(eq(checkoutSession.id, s.id));
    // Provider fees are a real cost: record them (converted only when the order is in USD; others are noted).
    if (input.feeCents && input.feeCents > 0 && !input.testMode && s.currency === "USD") {
      await tx.insert(expense).values({
        id: newId("exp"),
        brandId: s.brandId,
        category: "payments",
        description: `${input.provider} fee for order ${o!.id}`,
        amountUsd: (input.feeCents / 100).toFixed(6),
        source: `order:${o!.id}`,
        incurredAt: input.paidAt,
      });
    }
    await recordAudit(tx, { actorUserId: null, userAgent: `webhook:${input.provider}` }, {
      action: "order.paid",
      entityType: "order",
      entityId: o!.id,
      brandId: s.brandId,
      after: { providerOrderId: input.providerOrderId, totalCents: input.totalCents, currency: s.currency, licenseId: lic!.id, testMode: input.testMode },
    });
    return { status: "fulfilled", order: o!, license: lic!, entitlement: ent! };
  });
}

// ─── Refunds ─────────────────────────────────────────────────────────────────

export type ProviderRefundInput = {
  provider: PaymentProviderName;
  providerOrderId: string;
  refundedAt: Date;
} & (
  /** Lemon Squeezy style: the order's total refunded so far. */
  | { mode: "cumulative"; refundedCents: number }
  /** Paddle style: one refund (adjustment) with its own id; replays of the same id are ignored. */
  | { mode: "increment"; amountCents: number; providerRefundId: string }
);

/**
 * Applies a refund reported by the provider (by webhook, so it may repeat). A full refund revokes the order's
 * licenses and entitlements; a partial refund keeps access. Closes a matching staff request, or records a
 * `completed` refund row when the refund was made in the provider's dashboard.
 */
export async function applyProviderRefund(db: Database, input: ProviderRefundInput): Promise<{ status: "applied" | "unchanged" | "unknown_order"; order?: Order }> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(order).where(and(eq(order.provider, input.provider), eq(order.providerOrderId, input.providerOrderId))).for("update");
    if (!o) return { status: "unknown_order" };
    let newTotal: number;
    let providerRefundId: string;
    if (input.mode === "increment") {
      const [seen] = await tx.select({ id: refundRequest.id }).from(refundRequest).where(and(eq(refundRequest.orderId, o.id), eq(refundRequest.providerRefundId, input.providerRefundId), eq(refundRequest.status, "completed")));
      if (seen) return { status: "unchanged", order: o };
      newTotal = o.refundedCents + Math.max(0, Math.round(input.amountCents));
      providerRefundId = input.providerRefundId;
    } else {
      newTotal = Math.max(o.refundedCents, Math.round(input.refundedCents));
      providerRefundId = `cumulative:${newTotal}`;
    }
    newTotal = Math.min(newTotal, o.totalCents);
    const delta = newTotal - o.refundedCents;
    if (delta <= 0) return { status: "unchanged", order: o };
    const full = newTotal >= o.totalCents;
    const [u] = await tx
      .update(order)
      .set({ refundedCents: newTotal, status: full ? "refunded" : "partially_refunded", refundedAt: input.refundedAt })
      .where(eq(order.id, o.id))
      .returning();
    if (full) {
      const items = await tx.select({ id: orderItem.id }).from(orderItem).where(eq(orderItem.orderId, o.id));
      const lics = await tx.select({ id: license.id }).from(license).where(inArray(license.orderItemId, items.map((i) => i.id)));
      const licIds = lics.map((l) => l.id);
      if (licIds.length) {
        await tx.update(license).set({ revokedAt: input.refundedAt, revokedReason: "refunded" }).where(and(inArray(license.id, licIds), isNull(license.revokedAt)));
        await tx.update(entitlement).set({ revokedAt: input.refundedAt, revokedReason: "refunded" }).where(and(inArray(entitlement.licenseId, licIds), isNull(entitlement.revokedAt)));
      }
    }
    const [pending] = await tx
      .select()
      .from(refundRequest)
      .where(and(eq(refundRequest.orderId, o.id), eq(refundRequest.status, "submitted")))
      .orderBy(desc(refundRequest.createdAt))
      .limit(1);
    if (pending) {
      await tx.update(refundRequest).set({ status: "completed", providerRefundId }).where(eq(refundRequest.id, pending.id));
    } else {
      await tx.insert(refundRequest).values({
        id: newId("ref"),
        orderId: o.id,
        brandId: o.brandId,
        amountCents: delta,
        reason: "Refund made in the payment provider's dashboard",
        status: "completed",
        providerRefundId,
        decidedAt: input.refundedAt,
      });
    }
    await recordAudit(tx, { actorUserId: null, userAgent: `webhook:${input.provider}` }, {
      action: full ? "order.refunded" : "order.partially_refunded",
      entityType: "order",
      entityId: o.id,
      brandId: o.brandId,
      before: { status: o.status, refundedCents: o.refundedCents },
      after: { status: u!.status, refundedCents: newTotal, providerRefundId },
    });
    return { status: "applied", order: u! };
  });
}

/** Support (or anyone with `customer.write`) asks for a refund; nothing happens until an owner approves. */
export async function requestRefund(db: Database, ctx: AuditContext, input: { orderId: string; amountCents?: number; reason: string }): Promise<RefundRequest> {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 1000) throw new ValidationError("Give a reason (3–1,000 characters)");
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(order).where(eq(order.id, input.orderId)).for("update");
    if (!o) throw new NotFoundError("Order not found");
    const remaining = o.totalCents - o.refundedCents;
    const amount = input.amountCents ?? remaining;
    if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) throw new ValidationError(`Refund must be between 1 and ${remaining} cents`);
    const [open] = await tx.select({ id: refundRequest.id }).from(refundRequest).where(and(eq(refundRequest.orderId, o.id), inArray(refundRequest.status, ["requested", "submitted"])));
    if (open) throw new ValidationError("This order already has a refund in progress");
    const [r] = await tx
      .insert(refundRequest)
      .values({ id: newId("ref"), orderId: o.id, brandId: o.brandId, amountCents: amount, reason, requestedBy: ctx.actorUserId })
      .returning();
    await recordAudit(tx, ctx, { action: "refund.request", entityType: "refund_request", entityId: r!.id, brandId: o.brandId, after: { orderId: o.id, amountCents: amount, reason } });
    return r!;
  });
}

/**
 * Owner decision. Rejecting closes the request. Approving moves it to `submitted`; the caller then asks the
 * provider to refund and calls `markRefundFailed` if that call fails. The provider's webhook completes it.
 */
export async function decideRefund(
  db: Database,
  ctx: AuditContext,
  input: { refundId: string; approve: boolean; note?: string },
): Promise<{ request: RefundRequest; order: Order }> {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(refundRequest).where(eq(refundRequest.id, input.refundId)).for("update");
    if (!r) throw new NotFoundError("Refund request not found");
    if (r.status !== "requested") throw new ValidationError(`This request is already ${r.status}`);
    const [o] = await tx.select().from(order).where(eq(order.id, r.orderId));
    const [u] = await tx
      .update(refundRequest)
      .set({ status: input.approve ? "submitted" : "rejected", decidedBy: ctx.actorUserId, decidedAt: new Date(), error: input.approve ? null : (input.note?.slice(0, 1000) ?? null) })
      .where(eq(refundRequest.id, r.id))
      .returning();
    await recordAudit(tx, ctx, {
      action: input.approve ? "refund.approve" : "refund.reject",
      entityType: "refund_request",
      entityId: r.id,
      brandId: r.brandId,
      before: { status: r.status },
      after: { status: u!.status, amountCents: r.amountCents, note: input.note ?? null },
    });
    return { request: u!, order: o! };
  });
}

export async function markRefundSubmitted(db: DbOrTx, refundId: string, providerRefundId: string | null): Promise<void> {
  await db.update(refundRequest).set({ providerRefundId }).where(eq(refundRequest.id, refundId));
}

export async function markRefundFailed(db: DbOrTx, refundId: string, error: string): Promise<void> {
  await db.update(refundRequest).set({ status: "failed", error: error.slice(0, 2000) }).where(eq(refundRequest.id, refundId));
}

export async function listRefundRequests(db: Database, scope: BrandScope, filter: { status?: RefundRequest["status"] } = {}) {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(refundRequest.brandId, scope));
  if (filter.status) conds.push(eq(refundRequest.status, filter.status));
  return db
    .select({ request: refundRequest, order, brandSlug: brand.slug })
    .from(refundRequest)
    .innerJoin(order, eq(order.id, refundRequest.orderId))
    .innerJoin(brand, eq(brand.id, refundRequest.brandId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(refundRequest.createdAt))
    .limit(200);
}

// ─── Licenses ────────────────────────────────────────────────────────────────

export async function revokeLicense(db: Database, ctx: AuditContext, input: { licenseId: string; reason: string }): Promise<License> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new ValidationError("Give a reason");
  return db.transaction(async (tx) => {
    const [l] = await tx.select().from(license).where(eq(license.id, input.licenseId)).for("update");
    if (!l) throw new NotFoundError("License not found");
    if (l.revokedAt) throw new ValidationError("License is already revoked");
    const now = new Date();
    const [u] = await tx.update(license).set({ revokedAt: now, revokedReason: reason.slice(0, 500) }).where(eq(license.id, l.id)).returning();
    await tx.update(entitlement).set({ revokedAt: now, revokedReason: reason.slice(0, 500) }).where(and(eq(entitlement.licenseId, l.id), isNull(entitlement.revokedAt)));
    await recordAudit(tx, ctx, { action: "license.revoke", entityType: "license", entityId: l.id, brandId: l.brandId, after: { code: l.code, reason } });
    return u!;
  });
}

export interface LicenseVerification {
  valid: boolean;
  status: "active" | "revoked" | "not_found";
  brand?: string;
  product?: string;
  licenseType?: string;
  termsVersion?: string;
  issuedAt?: string;
  /** Initials only — the verification endpoint is public. */
  licensee?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .join(" ");

export async function verifyLicense(db: Database, code: string): Promise<LicenseVerification> {
  const [row] = await db
    .select({ license, brandName: brand.name, productTitle: product.title })
    .from(license)
    .innerJoin(brand, eq(brand.id, license.brandId))
    .innerJoin(product, eq(product.id, license.productId))
    .where(eq(license.code, code));
  if (!row) return { valid: false, status: "not_found" };
  const l = row.license;
  return {
    valid: !l.revokedAt,
    status: l.revokedAt ? "revoked" : "active",
    brand: row.brandName,
    product: row.productTitle,
    licenseType: l.licenseType,
    termsVersion: l.termsVersion,
    issuedAt: l.issuedAt.toISOString(),
    licensee: initials(l.licenseeName),
  };
}

// ─── Customer library & downloads ────────────────────────────────────────────

export async function getCustomerLibrary(db: Database, customerId: string) {
  const rows = await db
    .select({ entitlement, product, license })
    .from(entitlement)
    .innerJoin(product, eq(product.id, entitlement.productId))
    .leftJoin(license, eq(license.id, entitlement.licenseId))
    .where(and(eq(entitlement.customerId, customerId), isNull(entitlement.revokedAt)))
    .orderBy(desc(entitlement.createdAt));
  const productIds = [...new Set(rows.map((r) => r.product.id))];
  const assets = productIds.length
    ? await db.select().from(productAsset).where(inArray(productAsset.productId, productIds)).orderBy(productAsset.position)
    : [];
  return rows.map((r) => ({ ...r, assetIds: assets.filter((a) => a.productId === r.product.id).map((a) => a.assetId) }));
}

export async function listCustomerOrders(db: Database, customerId: string) {
  const orders = await db.select().from(order).where(eq(order.customerId, customerId)).orderBy(desc(order.paidAt)).limit(200);
  const items = orders.length ? await db.select().from(orderItem).where(inArray(orderItem.orderId, orders.map((o) => o.id))) : [];
  return orders.map((o) => ({ order: o, items: items.filter((i) => i.orderId === o.id) }));
}

export interface DownloadLimits {
  perHour: number;
  perDay: number;
}
export const DEFAULT_DOWNLOAD_LIMITS: DownloadLimits = { perHour: 30, perDay: 150 };

export type DownloadAuthorization =
  | { ok: true; storageKey: string; version: number; assetSlug: string; assetName: string; license: License | null; downloadId: string }
  | { ok: false; reason: "not_entitled" | "not_in_product" | "not_ready" | "rate_limited"; message: string };

/**
 * The only path to a customer download: checks the entitlement is the customer's and active, the asset is in the
 * product, a deliverable package exists, and the customer is under the rate limits. Logs the download.
 */
export async function authorizeDownload(
  db: Database,
  input: { customerId: string; entitlementId: string; assetId: string; ipHash?: string | null; userAgent?: string | null; limits?: DownloadLimits; now?: Date },
): Promise<DownloadAuthorization> {
  const limits = input.limits ?? DEFAULT_DOWNLOAD_LIMITS;
  const now = input.now ?? new Date();
  const [e] = await db.select().from(entitlement).where(eq(entitlement.id, input.entitlementId));
  if (!e || e.customerId !== input.customerId || e.revokedAt) return { ok: false, reason: "not_entitled", message: "You don't have access to this item." };
  const [pa] = await db.select().from(productAsset).where(and(eq(productAsset.productId, e.productId), eq(productAsset.assetId, input.assetId)));
  if (!pa) return { ok: false, reason: "not_in_product", message: "This file isn't part of your purchase." };
  const pkg = await deliverablePackageFor(db, input.assetId);
  if (!pkg) return { ok: false, reason: "not_ready", message: "This file is being prepared. Try again shortly." };
  const [counts] = await db
    .select({
      hour: sql<number>`count(*) filter (where ${download.createdAt} >= ${new Date(now.getTime() - 3600_000)})::int`,
      day: sql<number>`count(*)::int`,
    })
    .from(download)
    .where(and(eq(download.customerId, input.customerId), gte(download.createdAt, new Date(now.getTime() - 86_400_000))));
  if (counts!.hour >= limits.perHour || counts!.day >= limits.perDay) {
    return { ok: false, reason: "rate_limited", message: "Download limit reached. Please try again later or contact support." };
  }
  const [lic] = e.licenseId ? await db.select().from(license).where(eq(license.id, e.licenseId)) : [];
  const [d] = await db
    .insert(download)
    .values({ id: newId("dl"), entitlementId: e.id, customerId: input.customerId, assetId: input.assetId, assetVersion: pkg.version, ipHash: input.ipHash ?? null, userAgent: input.userAgent?.slice(0, 300) ?? null, createdAt: now })
    .returning();
  return { ok: true, storageKey: pkg.storageKey, version: pkg.version, assetSlug: pkg.asset.slug, assetName: pkg.asset.name, license: lic ?? null, downloadId: d!.id };
}

// ─── Staff views ─────────────────────────────────────────────────────────────

export async function listOrders(db: Database, scope: BrandScope, filter: { brandId?: string; status?: Order["status"]; limit?: number } = {}) {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(order.brandId, scope));
  if (filter.brandId) conds.push(eq(order.brandId, filter.brandId));
  if (filter.status) conds.push(eq(order.status, filter.status));
  return db
    .select({ order, brandSlug: brand.slug, customerEmail: user.email })
    .from(order)
    .innerJoin(brand, eq(brand.id, order.brandId))
    .innerJoin(customer, eq(customer.id, order.customerId))
    .innerJoin(user, eq(user.id, customer.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(order.paidAt))
    .limit(Math.min(filter.limit ?? 200, 500));
}

export async function getOrderDetail(db: Database, orderId: string) {
  const [row] = await db
    .select({ order, brand, customer, userEmail: user.email, userName: user.name })
    .from(order)
    .innerJoin(brand, eq(brand.id, order.brandId))
    .innerJoin(customer, eq(customer.id, order.customerId))
    .innerJoin(user, eq(user.id, customer.userId))
    .where(eq(order.id, orderId));
  if (!row) return null;
  const items = await db.select().from(orderItem).where(eq(orderItem.orderId, orderId));
  const licenses = items.length ? await db.select().from(license).where(inArray(license.orderItemId, items.map((i) => i.id))) : [];
  const refunds = await db.select().from(refundRequest).where(eq(refundRequest.orderId, orderId)).orderBy(desc(refundRequest.createdAt));
  const downloads = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(download)
    .innerJoin(entitlement, eq(entitlement.id, download.entitlementId))
    .where(inArray(entitlement.licenseId, licenses.length ? licenses.map((l) => l.id) : ["-"]));
  return { ...row, items, licenses, refunds, downloadCount: downloads[0]?.n ?? 0 };
}

export async function listCustomers(db: Database, scope: BrandScope, filter: { brandId?: string; q?: string } = {}) {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(customer.brandId, scope));
  if (filter.brandId) conds.push(eq(customer.brandId, filter.brandId));
  if (filter.q) conds.push(sql`${user.email} ilike ${"%" + filter.q.replace(/[%_\\]/g, "\\$&") + "%"}`);
  return db
    .select({
      customer,
      brandSlug: brand.slug,
      email: user.email,
      name: user.name,
      orders: sql<number>`(select count(*)::int from "order" o where o.customer_id = ${customer.id})`,
      spentCents: sql<number>`(select coalesce(sum(o.total_cents - o.refunded_cents), 0)::int from "order" o where o.customer_id = ${customer.id} and not o.test_mode)`,
    })
    .from(customer)
    .innerJoin(brand, eq(brand.id, customer.brandId))
    .innerJoin(user, eq(user.id, customer.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(customer.createdAt))
    .limit(500);
}

export async function listLicenses(db: Database, scope: BrandScope, filter: { brandId?: string; code?: string } = {}) {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(license.brandId, scope));
  if (filter.brandId) conds.push(eq(license.brandId, filter.brandId));
  if (filter.code) conds.push(eq(license.code, filter.code));
  return db
    .select({ license, brandSlug: brand.slug, productTitle: product.title, email: user.email })
    .from(license)
    .innerJoin(brand, eq(brand.id, license.brandId))
    .innerJoin(product, eq(product.id, license.productId))
    .innerJoin(customer, eq(customer.id, license.customerId))
    .innerJoin(user, eq(user.id, customer.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(license.issuedAt))
    .limit(500);
}

/** Revenue from live (non-test, non-free) orders, net of refunds. Other currencies are reported separately. */
export async function revenueSummary(db: Database, scope: BrandScope, since: Date) {
  if (scope !== "all" && scope.length === 0) return [];
  return db
    .select({
      brandSlug: brand.slug,
      currency: order.currency,
      orders: sql<number>`count(*)::int`,
      grossCents: sql<number>`sum(${order.totalCents})::int`,
      taxCents: sql<number>`sum(${order.taxCents})::int`,
      feeCents: sql<number>`coalesce(sum(${order.feeCents}), 0)::int`,
      refundedCents: sql<number>`sum(${order.refundedCents})::int`,
    })
    .from(order)
    .innerJoin(brand, eq(brand.id, order.brandId))
    .where(and(eq(order.testMode, false), sql`${order.provider} <> 'free'`, gte(order.paidAt, since), scope === "all" ? undefined : inArray(order.brandId, scope)))
    .groupBy(brand.slug, order.currency);
}

/** Everything we hold about a customer, for data-access requests (GDPR / PH Data Privacy Act). */
export async function exportCustomerData(db: Database, customerId: string) {
  const [c] = await db.select({ customer, email: user.email, name: user.name, brandName: brand.name }).from(customer).innerJoin(user, eq(user.id, customer.userId)).innerJoin(brand, eq(brand.id, customer.brandId)).where(eq(customer.id, customerId));
  if (!c) return null;
  const orders = await listCustomerOrders(db, customerId);
  const licenses = await db.select().from(license).where(eq(license.customerId, customerId));
  const downloads = await db.select({ assetId: download.assetId, version: download.assetVersion, at: download.createdAt }).from(download).where(eq(download.customerId, customerId));
  return {
    exportedAt: new Date().toISOString(),
    brand: c.brandName,
    account: { name: c.name, email: c.email, marketingConsent: c.customer.marketingConsent, country: c.customer.country, createdAt: c.customer.createdAt },
    orders: orders.map(({ order: o, items }) => ({ id: o.id, paidAt: o.paidAt, status: o.status, currency: o.currency, totalCents: o.totalCents, refundedCents: o.refundedCents, items: items.map((i) => ({ title: i.titleSnapshot, licenseType: i.licenseType, amountCents: i.amountCents })) })),
    licenses: licenses.map((l) => ({ code: l.code, type: l.licenseType, termsVersion: l.termsVersion, issuedAt: l.issuedAt, revokedAt: l.revokedAt })),
    downloads,
  };
}

/** Opt-in only; the timestamp records when consent was given (or null after withdrawal). */
export async function setMarketingConsent(db: DbOrTx, customerId: string, consent: boolean): Promise<void> {
  await db.update(customer).set({ marketingConsent: consent, marketingConsentAt: consent ? new Date() : null }).where(eq(customer.id, customerId));
}

// ─── Free products ───────────────────────────────────────────────────────────

/**
 * Claims a free product (an active $0 price for the license type). Creates a $0 order with provider "free",
 * a license and an entitlement, exactly like a purchase, so the library, certificate and verification work the
 * same. Claiming twice returns the existing entitlement.
 */
export async function claimFreeProduct(
  db: Database,
  input: { brandId: string; customerId: string; productSlug: string; licenseType: string },
): Promise<{ status: "claimed" | "already_owned"; entitlement: Entitlement; license: License | null }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ product, price })
      .from(product)
      .innerJoin(price, eq(price.productId, product.id))
      .where(
        and(
          eq(product.brandId, input.brandId),
          eq(product.slug, input.productSlug),
          eq(product.status, "published"),
          eq(price.licenseType, input.licenseType),
          eq(price.active, true),
          eq(price.amountCents, 0),
        ),
      );
    if (!row) throw new NotFoundError("This product isn't free");
    const [c] = await tx
      .select({ customer, userName: user.name, userEmail: user.email })
      .from(customer)
      .innerJoin(user, eq(user.id, customer.userId))
      .where(eq(customer.id, input.customerId))
      .for("update");
    if (!c || c.customer.brandId !== input.brandId) throw new ValidationError("Customer does not belong to this brand");
    const [owned] = await tx
      .select()
      .from(entitlement)
      .where(and(eq(entitlement.customerId, input.customerId), eq(entitlement.productId, row.product.id), isNull(entitlement.revokedAt)));
    if (owned) {
      const [lic] = owned.licenseId ? await tx.select().from(license).where(eq(license.id, owned.licenseId)) : [];
      return { status: "already_owned", entitlement: owned, license: lic ?? null };
    }
    const [b] = await tx.select().from(brand).where(eq(brand.id, input.brandId));
    const now = new Date();
    const [o] = await tx
      .insert(order)
      .values({
        id: newId("ord"),
        brandId: input.brandId,
        customerId: input.customerId,
        provider: "free",
        providerOrderId: newId("free"),
        currency: row.price.currency,
        subtotalCents: 0,
        totalCents: 0,
        email: c.userEmail,
        testMode: false,
        paidAt: now,
      })
      .returning();
    const [item] = await tx
      .insert(orderItem)
      .values({ id: newId("oi"), orderId: o!.id, productId: row.product.id, priceId: row.price.id, licenseType: row.price.licenseType, titleSnapshot: row.product.title, amountCents: 0, currency: row.price.currency })
      .returning();
    const [lic] = await tx
      .insert(license)
      .values({
        id: newId("lic"),
        code: generateLicenseCode(b!.slug),
        brandId: input.brandId,
        customerId: input.customerId,
        orderItemId: item!.id,
        productId: row.product.id,
        licenseType: row.price.licenseType,
        termsVersion: LICENSE_TERMS_VERSION,
        licenseeName: c.userName,
      })
      .returning();
    const [ent] = await tx
      .insert(entitlement)
      .values({ id: newId("ent"), brandId: input.brandId, customerId: input.customerId, productId: row.product.id, licenseId: lic!.id, source: "free" })
      .returning();
    return { status: "claimed", entitlement: ent!, license: lic! };
  });
}
