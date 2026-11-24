import { BEATING_HEART } from "@sb/asset";
import { isLicenseCode, newId } from "@sb/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "./client";
import {
  applyProviderRefund,
  archiveProduct,
  authorizeDownload,
  checkPublishable,
  createCheckoutSession,
  createCollection,
  createProduct,
  decideRefund,
  ensureCustomer,
  exportCustomerData,
  fulfillPaidOrder,
  getBrandBySlug,
  getCustomerLibrary,
  getPublishedCollection,
  getPublishedProduct,
  listOrders,
  listPublishedProducts,
  recordExportArtifacts,
  recordWebhookEvent,
  finishWebhookEvent,
  requestRefund,
  revokeLicense,
  reviewAsset,
  saveAssetDefinition,
  setCollectionStatus,
  updateProduct,
  upsertPrice,
  verifyLicense,
} from "./index";
import { auditLog, user } from "./schema";
import { seed } from "./seed";
import { createTestDb } from "./testing";

let h: DbHandle;
const staff = { actorUserId: null };
let moodiconsId: string;
let sonicId: string;

async function makeAsset(slug: string, brandSlug = "moodicons", opts: { approve?: boolean; exportZip?: boolean } = {}) {
  const def = structuredClone(BEATING_HEART) as any;
  def.slug = slug;
  def.name = `Asset ${slug}`;
  def.brand = brandSlug;
  const r = await saveAssetDefinition(h.db, staff, def);
  if (opts.approve !== false) await reviewAsset(h.db, staff, { assetId: r.asset.id, decision: "approved" });
  if (opts.exportZip !== false) {
    await recordExportArtifacts(h.db, r.version.id, [{ format: "zip", storageKey: `brands/${brandSlug}/assets/${r.asset.id}/v${r.version.version}/${slug}.zip`, bytes: 10, sha256: "x" }]);
  }
  return r;
}

async function makeUser(email: string, name = "Ada Lovelace") {
  const id = newId("usr");
  await h.db.insert(user).values({ id, email, name });
  return id;
}

async function publishedSingle(slug: string, amountCents = 900) {
  const a = await makeAsset(`${slug}-asset`);
  const p = await createProduct(h.db, staff, { brandId: moodiconsId, slug, title: `Product ${slug}`, kind: "single", assetIds: [a.asset.id] });
  await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents });
  await upsertPrice(h.db, staff, { productId: p.id, licenseType: "commercial", amountCents: amountCents * 3 });
  const { publishProduct } = await import("./index");
  await publishProduct(h.db, staff, p.id);
  return { product: p, asset: a };
}

async function buy(productSlug: string, email: string, overrides: Partial<Parameters<typeof fulfillPaidOrder>[1]> = {}) {
  const userId = await makeUser(email);
  const c = await ensureCustomer(h.db, userId, moodiconsId);
  const { session } = await createCheckoutSession(h.db, { brandId: moodiconsId, customerId: c.id, productSlug, licenseType: "personal", provider: "test", testMode: true });
  const result = await fulfillPaidOrder(h.db, {
    provider: "test",
    providerOrderId: `t_${session.id}`,
    checkoutSessionId: session.id,
    currency: "USD",
    subtotalCents: session.amountCents,
    taxCents: 0,
    totalCents: session.amountCents,
    testMode: true,
    paidAt: new Date(),
    ...overrides,
  });
  return { customer: c, session, result };
}

beforeAll(async () => {
  h = await createTestDb();
  await seed(h.db);
  moodiconsId = (await getBrandBySlug(h.db, "moodicons"))!.id;
  sonicId = (await getBrandBySlug(h.db, "sonicglyphs"))!.id;
});
afterAll(async () => {
  await h?.close();
});

describe("catalog", () => {
  it("validates product shape and brand ownership", async () => {
    const a = await makeAsset("cat-a");
    const b = await makeAsset("cat-b");
    await expect(createProduct(h.db, staff, { brandId: moodiconsId, slug: "x", title: "X", kind: "single", assetIds: [a.asset.id] })).rejects.toThrow(/Slug/);
    await expect(createProduct(h.db, staff, { brandId: moodiconsId, slug: "two", title: "Two", kind: "single", assetIds: [a.asset.id, b.asset.id] })).rejects.toThrow(/exactly one/);
    await expect(createProduct(h.db, staff, { brandId: sonicId, slug: "wrong-brand", title: "Wrong", kind: "single", assetIds: [a.asset.id] })).rejects.toThrow(/belong/);
    const pack = await createProduct(h.db, staff, { brandId: moodiconsId, slug: "cat-pack", title: "Pack", kind: "pack", assetIds: [a.asset.id, b.asset.id] });
    expect(pack.status).toBe("draft");
  });

  it("only offers license types the brand sells, and keeps one price per license/currency", async () => {
    const a = await makeAsset("price-a");
    const p = await createProduct(h.db, staff, { brandId: moodiconsId, slug: "price-test", title: "Price test", kind: "single", assetIds: [a.asset.id] });
    await expect(upsertPrice(h.db, staff, { productId: p.id, licenseType: "enterprise", amountCents: 100 })).rejects.toThrow(/does not offer/);
    await expect(upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: 1.5 })).rejects.toThrow(/whole number/);
    const first = await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: 500 });
    const second = await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: 700 });
    expect(second.id).toBe(first.id);
    expect(second.amountCents).toBe(700);
  });

  it("won't publish until assets are approved and exported and a price exists", async () => {
    const a = await makeAsset("pub-a", "moodicons", { approve: false, exportZip: false });
    const p = await createProduct(h.db, staff, { brandId: moodiconsId, slug: "pub-test", title: "Pub test", kind: "single", assetIds: [a.asset.id] });
    let check = await checkPublishable(h.db, p.id);
    expect(check.ok).toBe(false);
    expect(check.problems.join(" ")).toMatch(/price/);
    expect(check.problems.join(" ")).toMatch(/reviewer-approved/);
    await reviewAsset(h.db, staff, { assetId: a.asset.id, decision: "approved" });
    await recordExportArtifacts(h.db, a.version.id, [{ format: "zip", storageKey: "k/pub.zip", bytes: 1, sha256: "x" }]);
    await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: 300 });
    check = await checkPublishable(h.db, p.id);
    expect(check).toEqual({ ok: true, problems: [] });
    const { publishProduct } = await import("./index");
    const pub = await publishProduct(h.db, staff, p.id);
    expect(pub.status).toBe("published");
    await expect(updateProduct(h.db, staff, p.id, { assetIds: [(await makeAsset("pub-b")).asset.id] })).rejects.toThrow(/draft/);
  });

  it("shows buyers the approved version, not a newer unreviewed draft", async () => {
    const { product, asset } = await publishedSingle("versioned");
    const def = structuredClone(BEATING_HEART) as any;
    def.slug = "versioned-asset";
    def.name = "Unreviewed rename";
    def.brand = "moodicons";
    const v2 = await saveAssetDefinition(h.db, staff, def);
    expect(v2.version.version).toBe(2);
    const shown = await getPublishedProduct(h.db, moodiconsId, "versioned");
    expect(shown!.assets[0]!.version).toBe(1);
    expect(shown!.assets[0]!.definition.name).toBe("Asset versioned-asset");
    expect(product.id).toBe(shown!.product.id);
  });

  it("lists only published products per brand and hides archived ones", async () => {
    const { product } = await publishedSingle("listed");
    let list = await listPublishedProducts(h.db, moodiconsId);
    expect(list.map((i) => i.product.slug)).toContain("listed");
    expect(list.find((i) => i.product.slug === "listed")!.cover).not.toBeNull();
    expect(await listPublishedProducts(h.db, sonicId)).toEqual([]);
    await archiveProduct(h.db, staff, product.id);
    list = await listPublishedProducts(h.db, moodiconsId);
    expect(list.map((i) => i.product.slug)).not.toContain("listed");
    expect(await getPublishedProduct(h.db, moodiconsId, "listed")).toBeNull();
  });

  it("collections show only their published products", async () => {
    const { product } = await publishedSingle("in-collection");
    const c = await createCollection(h.db, staff, { brandId: moodiconsId, slug: "favourites", title: "Favourites", productIds: [product.id] });
    expect(await getPublishedCollection(h.db, moodiconsId, "favourites")).toBeNull();
    await setCollectionStatus(h.db, staff, c.id, "published");
    const shown = await getPublishedCollection(h.db, moodiconsId, "favourites");
    expect(shown!.products.map((p) => p.slug)).toEqual(["in-collection"]);
  });
});

describe("checkout and fulfilment", () => {
  it("prices checkouts from the database and refuses unknown licenses", async () => {
    await publishedSingle("priced", 1200);
    const c = await ensureCustomer(h.db, await makeUser("p@example.test"), moodiconsId);
    const { session } = await createCheckoutSession(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "priced", licenseType: "commercial", provider: "test", testMode: true });
    expect(session.amountCents).toBe(3600);
    await expect(createCheckoutSession(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "priced", licenseType: "agency", provider: "test", testMode: true })).rejects.toThrow(/isn't for sale/);
    await expect(createCheckoutSession(h.db, { brandId: sonicId, customerId: c.id, productSlug: "priced", licenseType: "personal", provider: "test", testMode: true })).rejects.toThrow(/isn't for sale/);
  });

  it("grants exactly one order, license and entitlement per payment, even if the webhook repeats", async () => {
    await publishedSingle("bought");
    const { session, result, customer } = await buy("bought", "buyer@example.test");
    expect(result.status).toBe("fulfilled");
    if (result.status !== "fulfilled") return;
    expect(isLicenseCode(result.license.code)).toBe(true);
    expect(result.license.code.startsWith("MOOD-")).toBe(true);
    const again = await fulfillPaidOrder(h.db, {
      provider: "test",
      providerOrderId: `t_${session.id}`,
      checkoutSessionId: session.id,
      currency: "USD",
      subtotalCents: session.amountCents,
      taxCents: 0,
      totalCents: session.amountCents,
      testMode: true,
      paidAt: new Date(),
    });
    expect(again.status).toBe("already_fulfilled");
    const lib = await getCustomerLibrary(h.db, customer.id);
    expect(lib).toHaveLength(1);
    const audit = await h.db.select().from(auditLog).where(eq(auditLog.action, "order.paid"));
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects payments that don't match the checkout", async () => {
    await publishedSingle("mismatch");
    expect((await buy("mismatch", "low@example.test", { subtotalCents: 1, totalCents: 1 })).result).toMatchObject({ status: "rejected", reason: expect.stringMatching(/below/) });
    expect((await buy("mismatch", "cur@example.test", { currency: "EUR" })).result).toMatchObject({ status: "rejected", reason: expect.stringMatching(/Currency/) });
    expect((await buy("mismatch", "mode@example.test", { testMode: false })).result).toMatchObject({ status: "rejected", reason: expect.stringMatching(/Test-mode/) });
    expect((await buy("mismatch", "prov@example.test", { provider: "paddle" })).result).toMatchObject({ status: "rejected", reason: expect.stringMatching(/created for test/) });
    const orders = await listOrders(h.db, [moodiconsId]);
    expect(orders.filter((o) => o.customerEmail.endsWith("@example.test") && ["low", "cur", "mode", "prov"].some((p) => o.customerEmail.startsWith(p)))).toHaveLength(0);
  });

  it("records webhooks idempotently", async () => {
    const first = await recordWebhookEvent(h.db, { provider: "test", eventId: "evt_1", eventType: "order.paid", payload: { a: 1 } });
    expect(first.duplicate).toBe(false);
    await finishWebhookEvent(h.db, first.event.id, { outcome: "fulfilled" });
    const second = await recordWebhookEvent(h.db, { provider: "test", eventId: "evt_1", eventType: "order.paid", payload: { a: 1 } });
    expect(second.duplicate).toBe(true);
    expect(second.event.attempts).toBe(2);
    // A failed event can be retried.
    const f = await recordWebhookEvent(h.db, { provider: "test", eventId: "evt_2", eventType: "x", payload: {} });
    await finishWebhookEvent(h.db, f.event.id, { outcome: "error", error: "boom" });
    expect((await recordWebhookEvent(h.db, { provider: "test", eventId: "evt_2", eventType: "x", payload: {} })).duplicate).toBe(false);
  });
});

describe("downloads, licenses and refunds", () => {
  it("authorizes downloads only for the entitled customer and enforces limits", async () => {
    const { asset } = await publishedSingle("dl");
    const { result, customer } = await buy("dl", "dl@example.test");
    if (result.status !== "fulfilled") throw new Error("not fulfilled");
    const ok = await authorizeDownload(h.db, { customerId: customer.id, entitlementId: result.entitlement.id, assetId: asset.asset.id });
    expect(ok).toMatchObject({ ok: true, version: 1, assetSlug: "dl-asset" });
    const other = await ensureCustomer(h.db, await makeUser("other@example.test"), moodiconsId);
    expect(await authorizeDownload(h.db, { customerId: other.id, entitlementId: result.entitlement.id, assetId: asset.asset.id })).toMatchObject({ ok: false, reason: "not_entitled" });
    const stray = await makeAsset("stray");
    expect(await authorizeDownload(h.db, { customerId: customer.id, entitlementId: result.entitlement.id, assetId: stray.asset.id })).toMatchObject({ ok: false, reason: "not_in_product" });
    const limited = await authorizeDownload(h.db, { customerId: customer.id, entitlementId: result.entitlement.id, assetId: asset.asset.id, limits: { perHour: 1, perDay: 10 } });
    expect(limited).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("verifies licenses publicly without exposing personal data", async () => {
    await publishedSingle("verify");
    const { result } = await buy("verify", "v@example.test");
    if (result.status !== "fulfilled") throw new Error("not fulfilled");
    const v = await verifyLicense(h.db, result.license.code);
    expect(v).toMatchObject({ valid: true, status: "active", brand: "Moodicons", licenseType: "personal", licensee: "A. L." });
    expect(JSON.stringify(v)).not.toContain("v@example.test");
    expect(await verifyLicense(h.db, "MOOD-0000-0000-0000-0000")).toEqual({ valid: false, status: "not_found" });
    await revokeLicense(h.db, staff, { licenseId: result.license.id, reason: "Chargeback" });
    expect((await verifyLicense(h.db, result.license.code)).status).toBe("revoked");
  });

  it("refunds need approval; a full refund revokes access, a partial one keeps it", async () => {
    const { asset } = await publishedSingle("refund");
    const { result, customer } = await buy("refund", "r@example.test");
    if (result.status !== "fulfilled") throw new Error("not fulfilled");
    const o = result.order;
    await expect(requestRefund(h.db, staff, { orderId: o.id, amountCents: o.totalCents + 1, reason: "Too much" })).rejects.toThrow(/between/);
    const req = await requestRefund(h.db, staff, { orderId: o.id, reason: "Customer asked" });
    await expect(requestRefund(h.db, staff, { orderId: o.id, reason: "Twice" })).rejects.toThrow(/in progress/);
    const decided = await decideRefund(h.db, staff, { refundId: req.id, approve: true });
    expect(decided.request.status).toBe("submitted");
    await expect(decideRefund(h.db, staff, { refundId: req.id, approve: true })).rejects.toThrow(/already/);

    const partial = await applyProviderRefund(h.db, { provider: "test", providerOrderId: o.providerOrderId, mode: "increment", amountCents: 100, providerRefundId: "rf_1", refundedAt: new Date() });
    expect(partial.order!.status).toBe("partially_refunded");
    expect((await authorizeDownload(h.db, { customerId: customer.id, entitlementId: result.entitlement.id, assetId: asset.asset.id })).ok).toBe(true);

    const full = await applyProviderRefund(h.db, { provider: "test", providerOrderId: o.providerOrderId, mode: "cumulative", refundedCents: o.totalCents, refundedAt: new Date() });
    expect(full.order!.status).toBe("refunded");
    expect((await verifyLicense(h.db, result.license.code)).status).toBe("revoked");
    expect(await authorizeDownload(h.db, { customerId: customer.id, entitlementId: result.entitlement.id, assetId: asset.asset.id })).toMatchObject({ ok: false, reason: "not_entitled" });
    expect(await getCustomerLibrary(h.db, customer.id)).toHaveLength(0);
    // Replaying refund webhooks changes nothing.
    expect((await applyProviderRefund(h.db, { provider: "test", providerOrderId: o.providerOrderId, mode: "cumulative", refundedCents: o.totalCents, refundedAt: new Date() })).status).toBe("unchanged");
    expect((await applyProviderRefund(h.db, { provider: "test", providerOrderId: o.providerOrderId, mode: "increment", amountCents: 100, providerRefundId: "rf_1", refundedAt: new Date() })).status).toBe("unchanged");
    const rows = (await h.db.execute<{ status: string; amount_cents: number }>(sql`select status, amount_cents from refund_request where order_id = ${o.id} order by created_at`)).rows;
    expect(rows.map((r) => r.status)).toEqual(["completed", "completed"]);
    expect(rows[0]!.amount_cents).toBe(o.totalCents); // the approved request
  });

  it("records dashboard refunds once, even when increments repeat", async () => {
    await publishedSingle("dash-refund");
    const { result } = await buy("dash-refund", "dash@example.test");
    if (result.status !== "fulfilled") throw new Error("not fulfilled");
    const o = result.order;
    const ev = { provider: "test" as const, providerOrderId: o.providerOrderId, mode: "increment" as const, amountCents: 200, providerRefundId: "adj_1", refundedAt: new Date() };
    expect((await applyProviderRefund(h.db, ev)).order!.refundedCents).toBe(200);
    expect((await applyProviderRefund(h.db, ev)).status).toBe("unchanged");
    expect((await applyProviderRefund(h.db, { ...ev, providerRefundId: "adj_2" })).order!.refundedCents).toBe(400);
    expect((await applyProviderRefund(h.db, { provider: "paddle", providerOrderId: "txn_unknown", mode: "cumulative", refundedCents: 1, refundedAt: new Date() })).status).toBe("unknown_order");
  });

  it("exports a customer's data", async () => {
    await publishedSingle("gdpr");
    const { customer } = await buy("gdpr", "gdpr@example.test");
    const data = await exportCustomerData(h.db, customer.id);
    expect(data!.account.email).toBe("gdpr@example.test");
    expect(data!.orders).toHaveLength(1);
    expect(data!.licenses).toHaveLength(1);
  });
});

describe("launch tooling and free products", () => {
  it("applies a catalog plan idempotently and reports missing assets", async () => {
    const a = await makeAsset("plan-a");
    const b = await makeAsset("plan-b");
    const { applyCatalogPlan } = await import("./index");
    const plan = [
      { slug: "plan-pack", title: "Plan pack", description: "", kind: "pack" as const, assetSlugs: ["plan-a", "plan-b"], prices: { personal: 500, commercial: 1500 } },
      { slug: "plan-missing", title: "Missing", description: "", kind: "single" as const, assetSlugs: ["nope"], prices: { personal: 100 } },
    ];
    const first = await applyCatalogPlan(h.db, staff, moodiconsId, plan);
    expect(first).toEqual({ created: ["plan-pack"], existing: [], missingAssets: [{ slug: "plan-missing", assets: ["nope"] }] });
    expect((await applyCatalogPlan(h.db, staff, moodiconsId, plan)).existing).toEqual(["plan-pack"]);
    expect([a.asset.id, b.asset.id]).toHaveLength(2);
  });

  it("free products are claimed once, with a license, and never count as revenue", async () => {
    const { claimFreeProduct, revenueSummary } = await import("./index");
    const a = await makeAsset("free-a");
    const p = await createProduct(h.db, staff, { brandId: moodiconsId, slug: "free-pack", title: "Free pack", kind: "single", assetIds: [a.asset.id] });
    await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: 0 });
    await upsertPrice(h.db, staff, { productId: p.id, licenseType: "commercial", amountCents: 900 });
    const { publishProduct } = await import("./index");
    await publishProduct(h.db, staff, p.id);
    const c = await ensureCustomer(h.db, await makeUser("free@example.test"), moodiconsId);
    const claim = await claimFreeProduct(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "free-pack", licenseType: "personal" });
    expect(claim.status).toBe("claimed");
    expect(claim.license!.licenseType).toBe("personal");
    expect((await claimFreeProduct(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "free-pack", licenseType: "personal" })).status).toBe("already_owned");
    await expect(claimFreeProduct(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "free-pack", licenseType: "commercial" })).rejects.toThrow(/isn't free/);
    await expect(createCheckoutSession(h.db, { brandId: moodiconsId, customerId: c.id, productSlug: "free-pack", licenseType: "personal", provider: "test", testMode: true })).rejects.toThrow(/Free/);
    expect((await authorizeDownload(h.db, { customerId: c.id, entitlementId: claim.entitlement.id, assetId: a.asset.id })).ok).toBe(true);
    const rev = await revenueSummary(h.db, "all", new Date(0));
    expect(rev.reduce((n, r) => n + r.orders, 0)).toBe(0);
  });
});
