import { BEATING_HEART } from "@sb/asset";
import { newId, normalizeLicenseCode, isLicenseCode, generateLicenseCode } from "@sb/core";
import {
  createCheckoutSession,
  createProduct,
  ensureCustomer,
  getBrandBySlug,
  getOrderDetail,
  listOrders,
  listWebhookEvents,
  publishProduct,
  recordExportArtifacts,
  reviewAsset,
  saveAssetDefinition,
  schema,
  seed,
  upsertPrice,
  verifyLicense,
  type DbHandle,
} from "@sb/db";
import { createTestDb } from "@sb/db/testing";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildLicenseText,
  commerceFromEnv,
  handleWebhook,
  hmacSha256Hex,
  LemonSqueezyProvider,
  PaddleProvider,
  personalizePackage,
  TestPaymentProvider,
  WebhookSignatureError,
  type FetchLike,
} from "./index";

const LS_SECRET = "ls_webhook_secret_123456";
const PADDLE_SECRET = "pdl_ntfset_secret_123456";
const TEST_SECRET = "test_secret_1234567890";

function recordingFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fetch, calls };
}

const checkoutReq = (sessionId: string) => ({
  sessionId,
  brandName: "Moodicons",
  productTitle: "Waving hand",
  licenseLabel: "Commercial",
  amountCents: 1900,
  currency: "USD",
  email: "buyer@example.test",
  name: "Ada Lovelace",
  successUrl: "https://moodicons.example/account?purchased=1",
  storefrontOrigin: "https://moodicons.example",
  expiresAt: new Date("2026-12-01T00:00:00Z"),
});

describe("license codes and text", () => {
  it("generates verifiable codes and normalizes typing mistakes", () => {
    const code = generateLicenseCode("moodicons");
    expect(isLicenseCode(code)).toBe(true);
    expect(code.slice(0, 5)).toBe("MOOD-");
    const typed = ` ${code.toLowerCase().replace(/0/g, "o").replace(/1/g, "l")} `;
    expect(normalizeLicenseCode(typed)).toBe(code);
  });

  it("writes the buyer's license into the package", () => {
    const text = buildLicenseText({
      brandName: "Moodicons",
      productTitle: "Waving hand",
      licenseType: "commercial",
      code: "MOOD-AAAA-BBBB-CCCC-DDDD",
      licenseeName: "Ada Lovelace",
      issuedAt: new Date("2026-11-24T00:00:00Z"),
      termsVersion: "2026-11-draft-1",
      verifyUrl: "https://moodicons.example/licenses/verify?code=MOOD-AAAA-BBBB-CCCC-DDDD",
    });
    expect(text).toContain("COMMERCIAL LICENSE");
    expect(text).toContain("Ada Lovelace");
    expect(text).toMatch(/train or fine-tune/);
    const zip = zipSync({ "LICENSE.txt": strToU8("PREVIEW — NOT LICENSED FOR USE"), "README.txt": strToU8("Readme"), "svg/x.svg": strToU8("<svg/>") });
    const out = unzipSync(personalizePackage(zip, text));
    expect(strFromU8(out["LICENSE.txt"]!)).toBe(text);
    expect(strFromU8(out["README.txt"]!)).toContain("MOOD-AAAA-BBBB-CCCC-DDDD");
    expect(strFromU8(out["svg/x.svg"]!)).toBe("<svg/>");
    expect(() => buildLicenseText({ ...({} as any), licenseType: "galactic" })).toThrow(/Unknown license/);
  });
});

describe("Lemon Squeezy adapter", () => {
  const make = (fetch?: FetchLike) => new LemonSqueezyProvider({ apiKey: "k", storeId: "11", variantId: "22", webhookSecret: LS_SECRET, testMode: true, fetch });

  it("creates a checkout with our price, product name and session id", async () => {
    const { fetch, calls } = recordingFetch([{ status: 201, body: { data: { id: "chk-uuid", attributes: { url: "https://store.lemonsqueezy.com/checkout/custom/abc" } } } }]);
    const r = await make(fetch).createCheckout(checkoutReq("chk_1"));
    expect(r).toEqual({ providerCheckoutId: "chk-uuid", url: "https://store.lemonsqueezy.com/checkout/custom/abc" });
    const c = calls[0]!;
    expect(c.url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    expect((c.init.headers as Record<string, string>)["Content-Type"]).toBe("application/vnd.api+json");
    expect(c.body.data.attributes).toMatchObject({ custom_price: 1900, test_mode: true, checkout_data: { email: "buyer@example.test", custom: { checkout_id: "chk_1" } } });
    expect(c.body.data.relationships).toEqual({ store: { data: { type: "stores", id: "11" } }, variant: { data: { type: "variants", id: "22" } } });
  });

  it("refuses other currencies and surfaces API errors", async () => {
    await expect(make().createCheckout({ ...checkoutReq("x"), currency: "EUR" })).rejects.toThrow(/charges in USD/);
    const { fetch } = recordingFetch([{ status: 422, body: { errors: [{ detail: "The variant is invalid." }] } }]);
    await expect(make(fetch).createCheckout(checkoutReq("x"))).rejects.toThrow(/422.*variant is invalid/);
  });

  it("verifies signatures and normalizes order events", async () => {
    const p = make();
    const body = JSON.stringify({
      meta: { event_name: "order_created", test_mode: true, custom_data: { checkout_id: "chk_1" } },
      data: { type: "orders", id: "9001", attributes: { status: "paid", currency: "USD", subtotal: 1900, tax: 190, total: 2090, user_email: "b@example.test", test_mode: true, created_at: "2026-11-24T10:00:00Z", refunded_amount: 0 } },
    });
    const h = new Headers({ "x-signature": hmacSha256Hex(LS_SECRET, body) });
    expect(await p.parseWebhook(body, h)).toMatchObject({ kind: "paid", eventId: "order_created:9001", providerOrderId: "9001", checkoutSessionId: "chk_1", subtotalCents: 1900, totalCents: 2090, testMode: true });
    await expect(p.parseWebhook(body, new Headers({ "x-signature": "00" }))).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(p.parseWebhook(body + " ", h)).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});

describe("Paddle adapter", () => {
  const now = 1_790_000_000_000;
  const make = (fetch?: FetchLike) =>
    new PaddleProvider({ apiKey: "pdl_sdbx_k", productId: "pro_1", webhookSecret: PADDLE_SECRET, clientToken: "test_tok", environment: "sandbox", fetch, now: () => now });
  const sign = (body: string, ts = Math.floor(now / 1000)) => new Headers({ "paddle-signature": `ts=${ts};h1=${hmacSha256Hex(PADDLE_SECRET, `${ts}:${body}`)}` });

  it("creates a transaction with a non-catalog price and our checkout page", async () => {
    const { fetch, calls } = recordingFetch([{ body: { data: { id: "txn_1", checkout: { url: "https://moodicons.example/checkout/paddle?_ptxn=txn_1" } } } }]);
    const r = await make(fetch).createCheckout(checkoutReq("chk_2"));
    expect(r.url).toContain("_ptxn=txn_1");
    const c = calls[0]!;
    expect(c.url).toBe("https://sandbox-api.paddle.com/transactions");
    expect((c.init.headers as Record<string, string>).Authorization).toBe("Bearer pdl_sdbx_k");
    expect(c.body.items[0].price).toMatchObject({ product_id: "pro_1", unit_price: { amount: "1900", currency_code: "USD" } });
    expect(c.body.custom_data).toEqual({ checkout_id: "chk_2" });
    expect(c.body.checkout).toEqual({ url: "https://moodicons.example/checkout/paddle" });
  });

  it("checks signature, timestamp tolerance and rotated secrets", async () => {
    const p = make();
    const body = JSON.stringify({ event_id: "evt_1", event_type: "transaction.updated", occurred_at: "2026-11-24T10:00:00Z", data: {} });
    expect((await p.parseWebhook(body, sign(body))).kind).toBe("ignored");
    await expect(p.parseWebhook(body, sign(body, Math.floor(now / 1000) - 3600))).rejects.toThrow(/too old/);
    const ts = Math.floor(now / 1000);
    const rotated = new Headers({ "paddle-signature": `ts=${ts};h1=${"ab".repeat(32)};h1=${hmacSha256Hex(PADDLE_SECRET, `${ts}:${body}`)}` });
    expect((await p.parseWebhook(body, rotated)).kind).toBe("ignored");
    await expect(p.parseWebhook(body, new Headers({ "paddle-signature": "garbage" }))).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("normalizes completed transactions and approved refunds only", async () => {
    const p = make();
    const paid = JSON.stringify({
      event_id: "evt_paid",
      event_type: "transaction.completed",
      occurred_at: "2026-11-24T10:00:00Z",
      data: { id: "txn_1", status: "completed", currency_code: "USD", custom_data: { checkout_id: "chk_2" }, billed_at: "2026-11-24T10:00:00Z", details: { totals: { subtotal: "1900", tax: "0", total: "1900", grand_total: "1900", fee: "145" } } },
    });
    expect(await p.parseWebhook(paid, sign(paid))).toMatchObject({ kind: "paid", providerOrderId: "txn_1", checkoutSessionId: "chk_2", subtotalCents: 1900, feeCents: 145, testMode: true });
    const pending = JSON.stringify({ event_id: "evt_a1", event_type: "adjustment.created", occurred_at: "x", data: { id: "adj_1", action: "refund", status: "pending_approval", transaction_id: "txn_1", totals: { total: "1900" } } });
    expect((await p.parseWebhook(pending, sign(pending))).kind).toBe("ignored");
    const approved = JSON.stringify({ event_id: "evt_a2", event_type: "adjustment.updated", occurred_at: "2026-11-25T10:00:00Z", data: { id: "adj_1", action: "refund", status: "approved", transaction_id: "txn_1", totals: { total: "1900" } } });
    expect(await p.parseWebhook(approved, sign(approved))).toMatchObject({ kind: "refund", mode: "increment", amountCents: 1900, providerRefundId: "adj_1" });
  });

  it("refunds fully, or partially against the transaction's line item", async () => {
    const full = recordingFetch([{ body: { data: { id: "adj_9", status: "pending_approval" } } }]);
    expect(await make(full.fetch).refund({ providerOrderId: "txn_1", amountCents: 1900, totalCents: 1900, reason: "Asked" })).toEqual({ providerRefundId: "adj_9", confirmsByWebhook: true });
    expect(full.calls[0]!.body).toMatchObject({ action: "refund", type: "full", transaction_id: "txn_1" });
    const partial = recordingFetch([{ body: { data: { details: { line_items: [{ id: "txnitm_1" }] } } } }, { body: { data: { id: "adj_10" } } }]);
    await make(partial.fetch).refund({ providerOrderId: "txn_1", amountCents: 500, totalCents: 1900, reason: "Partial" });
    expect(partial.calls[0]!.url).toBe("https://sandbox-api.paddle.com/transactions/txn_1");
    expect(partial.calls[1]!.body.items).toEqual([{ item_id: "txnitm_1", type: "partial", amount: "500" }]);
  });
});

describe("configuration", () => {
  it("loads configured providers and keeps live credentials off until approved", () => {
    const base = { PADDLE_API_KEY: "k", PADDLE_PRODUCT_ID: "pro", PADDLE_WEBHOOK_SECRET: PADDLE_SECRET, PADDLE_CLIENT_TOKEN: "t" };
    let c = commerceFromEnv({ ...base, COMMERCE_PROVIDER: "paddle" });
    expect(c.active?.label).toBe("Paddle (sandbox)");
    c = commerceFromEnv({ ...base, PADDLE_ENVIRONMENT: "production", COMMERCE_PROVIDER: "paddle" });
    expect(c.active).toBeNull();
    expect(c.problems.join(" ")).toMatch(/COMMERCE_LIVE_PAYMENTS/);
    c = commerceFromEnv({ ...base, PADDLE_ENVIRONMENT: "production", COMMERCE_PROVIDER: "paddle", COMMERCE_LIVE_PAYMENTS: "enabled" });
    expect(c.active?.testMode).toBe(false);
    c = commerceFromEnv({ COMMERCE_TEST_SECRET: TEST_SECRET, COMMERCE_PROVIDER: "test", DEPLOY_ENV: "production" });
    expect(c.active).toBeNull();
    expect(commerceFromEnv({}).problems[0]).toMatch(/Checkout is off/);
    expect(commerceFromEnv({ LEMONSQUEEZY_API_KEY: "k", COMMERCE_PROVIDER: "lemonsqueezy" }).problems.join(" ")).toMatch(/missing storeId/);
  });
});

describe("webhook handling (database)", () => {
  let h: DbHandle;
  let brandId: string;
  let customerId: string;

  beforeAll(async () => {
    h = await createTestDb();
    await seed(h.db);
    brandId = (await getBrandBySlug(h.db, "moodicons"))!.id;
    const def = structuredClone(BEATING_HEART) as any;
    def.slug = "wave";
    def.brand = "moodicons";
    const a = await saveAssetDefinition(h.db, { actorUserId: null }, def);
    await reviewAsset(h.db, { actorUserId: null }, { assetId: a.asset.id, decision: "approved" });
    await recordExportArtifacts(h.db, a.version.id, [{ format: "zip", storageKey: "k/wave.zip", bytes: 1, sha256: "x" }]);
    const p = await createProduct(h.db, { actorUserId: null }, { brandId, slug: "wave", title: "Wave", kind: "single", assetIds: [a.asset.id] });
    await upsertPrice(h.db, { actorUserId: null }, { productId: p.id, licenseType: "personal", amountCents: 900 });
    await publishProduct(h.db, { actorUserId: null }, p.id);
    const userId = newId("usr");
    await h.db.insert(schema.user).values({ id: userId, email: "hook@example.test", name: "Hook Buyer" });
    customerId = (await ensureCustomer(h.db, userId, brandId)).id;
  });
  afterAll(async () => {
    await h?.close();
  });

  const session = async (provider: "lemonsqueezy" | "paddle" | "test") =>
    (await createCheckoutSession(h.db, { brandId, customerId, productSlug: "wave", licenseType: "personal", provider, testMode: true })).session;

  it("Lemon Squeezy: fulfils once, then a full refund revokes the license", async () => {
    const ls = new LemonSqueezyProvider({ apiKey: "k", storeId: "1", variantId: "2", webhookSecret: LS_SECRET, testMode: true });
    const s = await session("lemonsqueezy");
    const attrs = { status: "paid", currency: "USD", subtotal: 900, tax: 0, total: 900, test_mode: true, created_at: "2026-11-24T10:00:00Z", refunded_amount: 0 };
    const body = JSON.stringify({ meta: { event_name: "order_created", custom_data: { checkout_id: s.id } }, data: { type: "orders", id: "777", attributes: attrs } });
    const headers = new Headers({ "x-signature": hmacSha256Hex(LS_SECRET, body) });
    expect(await handleWebhook(h.db, ls, body, headers)).toEqual({ status: 200, body: { ok: true, outcome: "fulfilled" } });
    expect((await handleWebhook(h.db, ls, body, headers)).body.outcome).toBe("duplicate");
    expect((await handleWebhook(h.db, ls, body, new Headers({ "x-signature": "bad" }))).status).toBe(401);

    const refund = JSON.stringify({ meta: { event_name: "order_refunded" }, data: { type: "orders", id: "777", attributes: { ...attrs, status: "refunded", refunded: true, refunded_amount: 900, refunded_at: "2026-11-25T10:00:00Z" } } });
    expect((await handleWebhook(h.db, ls, refund, new Headers({ "x-signature": hmacSha256Hex(LS_SECRET, refund) }))).body.outcome).toBe("refund_applied");
    const events = await listWebhookEvents(h.db);
    expect(events.filter((e) => e.provider === "lemonsqueezy").map((e) => e.outcome)).toEqual(["refund_applied", "fulfilled"]);
  });

  it("Paddle: approved refund arrives as an adjustment and is applied once", async () => {
    const pdl = new PaddleProvider({ apiKey: "k", productId: "pro", webhookSecret: PADDLE_SECRET, clientToken: "t", environment: "sandbox" });
    const s = await session("paddle");
    const signed = (obj: unknown) => {
      const body = JSON.stringify(obj);
      const ts = Math.floor(Date.now() / 1000);
      return [body, new Headers({ "paddle-signature": `ts=${ts};h1=${hmacSha256Hex(PADDLE_SECRET, `${ts}:${body}`)}` })] as const;
    };
    const [paid, ph] = signed({ event_id: "evt_p1", event_type: "transaction.completed", occurred_at: "2026-11-24T10:00:00Z", data: { id: "txn_42", status: "completed", currency_code: "USD", custom_data: { checkout_id: s.id }, details: { totals: { subtotal: "900", tax: "0", total: "900", grand_total: "900", fee: "95" } } } });
    expect((await handleWebhook(h.db, pdl, paid, ph)).body.outcome).toBe("fulfilled");
    const adj = { id: "adj_42", action: "refund", status: "approved", transaction_id: "txn_42", totals: { total: "900" } };
    const [r1, rh1] = signed({ event_id: "evt_r1", event_type: "adjustment.updated", occurred_at: "2026-11-25T10:00:00Z", data: adj });
    const [r2, rh2] = signed({ event_id: "evt_r2", event_type: "adjustment.updated", occurred_at: "2026-11-25T10:01:00Z", data: adj });
    expect((await handleWebhook(h.db, pdl, r1, rh1)).body.outcome).toBe("refund_applied");
    expect((await handleWebhook(h.db, pdl, r2, rh2)).body.outcome).toBe("refund_unchanged");
  });

  it("Test provider: rejects a payment that doesn't match our checkout, without granting anything", async () => {
    const t = new TestPaymentProvider(TEST_SECRET);
    const s = await session("test");
    const { body, signature } = t.signedEvent({ type: "paid", id: "tevt_1", orderId: "tord_1", checkoutSessionId: s.id, currency: "USD", amountCents: 1, at: new Date().toISOString() });
    const r = await handleWebhook(h.db, t, body, new Headers({ "x-test-signature": signature }));
    expect(r.body).toMatchObject({ ok: false, outcome: "rejected", error: expect.stringMatching(/below the checkout price/) });
    const ok = t.signedEvent({ type: "paid", id: "tevt_2", orderId: "tord_2", checkoutSessionId: s.id, currency: "USD", amountCents: 900, at: new Date().toISOString() });
    expect((await handleWebhook(h.db, t, ok.body, new Headers({ "x-test-signature": ok.signature }))).body.outcome).toBe("fulfilled");
    const order = (await listOrders(h.db, "all")).find((o) => o.order.providerOrderId === "tord_2")!.order;
    const detail = await getOrderDetail(h.db, order.id);
    expect((await verifyLicense(h.db, detail!.licenses[0]!.code)).valid).toBe(true);
  });
});
