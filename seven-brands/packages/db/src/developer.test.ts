import { BEATING_HEART } from "@sb/asset";
import { newId } from "@sb/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "./client";
import {
  authorizeApiDownload,
  createCheckoutSession,
  createProduct,
  ensureCustomer,
  fulfillPaidOrder,
  getBrandBySlug,
  getPublishedIcon,
  publishProduct,
  recordExportArtifacts,
  reviewAsset,
  revokeLicense,
  saveAssetDefinition,
  searchPublishedIcons,
  upsertPrice,
} from "./index";
import { user } from "./schema";
import { seed } from "./seed";
import { createTestDb } from "./testing";

let h: DbHandle;
const staff = { actorUserId: null };
let moodiconsId: string;
let sonicId: string;

async function makeAsset(slug: string, opts: { name?: string; tags?: string[]; approve?: boolean; brand?: string } = {}) {
  const def = structuredClone(BEATING_HEART) as any;
  def.slug = slug;
  def.name = opts.name ?? `Asset ${slug}`;
  def.brand = opts.brand ?? "moodicons";
  if (opts.tags) def.tags = opts.tags;
  const r = await saveAssetDefinition(h.db, staff, def);
  if (opts.approve !== false) {
    await reviewAsset(h.db, staff, { assetId: r.asset.id, decision: "approved" });
    await recordExportArtifacts(h.db, r.version.id, [{ format: "zip", storageKey: `k/${slug}.zip`, bytes: 10, sha256: "x" }]);
  }
  return r;
}

async function product(slug: string, assetIds: string[], opts: { cents?: number; publish?: boolean; brandId?: string } = {}) {
  const p = await createProduct(h.db, staff, { brandId: opts.brandId ?? moodiconsId, slug, title: `Product ${slug}`, kind: assetIds.length > 1 ? "pack" : "single", assetIds });
  await upsertPrice(h.db, staff, { productId: p.id, licenseType: "personal", amountCents: opts.cents ?? 900 });
  if (opts.publish !== false) await publishProduct(h.db, staff, p.id);
  return p;
}

async function buy(productSlug: string) {
  const userId = newId("usr");
  await h.db.insert(user).values({ id: userId, email: `${userId}@example.com`, name: "Grace Hopper" });
  const c = await ensureCustomer(h.db, userId, moodiconsId);
  const { session } = await createCheckoutSession(h.db, { brandId: moodiconsId, customerId: c.id, productSlug, licenseType: "personal", provider: "test", testMode: true });
  const r = await fulfillPaidOrder(h.db, {
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
  if (r.status !== "fulfilled") throw new Error("not fulfilled");
  return r.license;
}

beforeAll(async () => {
  h = await createTestDb();
  await seed(h.db);
  moodiconsId = (await getBrandBySlug(h.db, "moodicons"))!.id;
  sonicId = (await getBrandBySlug(h.db, "sonicglyphs"))!.id;
  const wave = await makeAsset("dev-wave", { name: "Waving Hand", tags: ["hello", "greeting"] });
  const cat = await makeAsset("dev-cat", { name: "Happy Cat", tags: ["animal", "cute"] });
  const hidden = await makeAsset("dev-hidden", { name: "Waving Draft", tags: ["hello"] });
  await makeAsset("dev-unreviewed", { name: "Waving Unreviewed", approve: false });
  await product("dev-wave-single", [wave.asset.id]);
  await product("dev-pack", [wave.asset.id, cat.asset.id], { cents: 1900 });
  await product("dev-free", [cat.asset.id, wave.asset.id], { cents: 0 });
  await product("dev-draft", [hidden.asset.id], { publish: false });
  const glyph = await makeAsset("dev-glyph", { name: "Waving Glyph", brand: "sonicglyphs" });
  await product("dev-glyph-single", [glyph.asset.id], { brandId: sonicId });
});
afterAll(async () => {
  await h?.close();
});

describe("developer API", () => {
  it("searches only this brand's published, deliverable icons, with every word required", async () => {
    const all = await searchPublishedIcons(h.db, moodiconsId);
    expect(all.map((i) => i.slug).sort()).toEqual(["dev-cat", "dev-wave"]);
    const hello = await searchPublishedIcons(h.db, moodiconsId, { q: "waving hello" });
    expect(hello.map((i) => i.slug)).toEqual(["dev-wave"]);
    expect(hello[0]!.products.map((p) => p.slug)).toContain("dev-pack");
    expect(hello[0]!.products[0]!.free).toBe(true); // free pack listed first
    expect(await searchPublishedIcons(h.db, moodiconsId, { q: "waving glyph" })).toEqual([]);
    expect(await searchPublishedIcons(h.db, moodiconsId, { q: "draft" })).toEqual([]);
  });

  it("looks up one icon, never a draft or another brand's", async () => {
    expect((await getPublishedIcon(h.db, moodiconsId, "dev-cat"))?.definition.slug).toBe("dev-cat");
    expect(await getPublishedIcon(h.db, moodiconsId, "dev-hidden")).toBeNull();
    expect(await getPublishedIcon(h.db, moodiconsId, "dev-glyph")).toBeNull();
  });

  it("hands out source only for icons in the license's product, logs it, and stops after revocation", async () => {
    const lic = await buy("dev-wave-single");
    const ok = await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-wave" });
    expect(ok.ok && ok.definition.slug).toBe("dev-wave");
    const other = await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-cat" });
    expect(other.ok).toBe(false);
    expect(!other.ok && other.reason).toBe("not_in_license");
    expect(!other.ok && other.products?.map((p) => p.slug)).toContain("dev-pack");
    expect(await authorizeApiDownload(h.db, { brandId: sonicId, code: lic.code, assetSlug: "dev-glyph" })).toMatchObject({ ok: false, reason: "invalid_license" });
    expect(await authorizeApiDownload(h.db, { brandId: moodiconsId, code: "MOOD-AAAA-BBBB-CCCC-DDDD", assetSlug: "dev-wave" })).toMatchObject({ ok: false, reason: "invalid_license" });
    expect(await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "nope" })).toMatchObject({ ok: false, reason: "not_found" });
    await revokeLicense(h.db, staff, { licenseId: lic.id, reason: "refund" });
    expect(await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-wave" })).toMatchObject({ ok: false, reason: "license_revoked" });
  });

  it("applies the download limits", async () => {
    const lic = await buy("dev-pack");
    const limits = { perHour: 2, perDay: 10 };
    expect((await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-wave", limits })).ok).toBe(true);
    expect((await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-cat", limits })).ok).toBe(true);
    expect(await authorizeApiDownload(h.db, { brandId: moodiconsId, code: lic.code, assetSlug: "dev-cat", limits })).toMatchObject({ ok: false, reason: "rate_limited" });
  });
});
