/**
 * Resets the E2E database and publishes one real Moodicons product: the Beating Heart asset is approved,
 * exported by the real export job (needs ffmpeg) and priced for two licenses.
 */
import { BEATING_HEART } from "@sb/asset";
import { createProduct, getBrandBySlug, enqueueJob, publishProduct, reviewAsset, saveAssetDefinition, seed, upsertPrice, claimNextJob, completeJob } from "@sb/db";
import { createTestDb } from "@sb/db/testing";
import { createStorageFromEnv } from "@sb/storage";
import { runJob } from "../../../services/worker/src/jobs";

process.env.TEST_DATABASE_URL = process.env.DATABASE_URL ?? "postgres://daos:daos_dev_only@localhost:5432/daos_e2e_test";
const h = await createTestDb();
const ctx = { actorUserId: null, userAgent: "e2e-setup" };
try {
  await seed(h.db);
  const mood = (await getBrandBySlug(h.db, "moodicons"))!;
  const saved = await saveAssetDefinition(h.db, ctx, structuredClone(BEATING_HEART));
  await reviewAsset(h.db, ctx, { assetId: saved.asset.id, decision: "approved" });
  await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "export", brief: { assetId: saved.asset.id, formats: ["svg", "png", "json"] } });
  const job = (await claimNextJob(h.db))!;
  const result = await runJob(job, { db: h.db, storage: createStorageFromEnv(process.env) });
  await completeJob(h.db, job.id, result);
  const product = await createProduct(h.db, ctx, { brandId: mood.id, slug: "beating-heart", title: "Beating Heart", description: "A heart that beats with you.", kind: "single", assetIds: [saved.asset.id] });
  await upsertPrice(h.db, ctx, { productId: product.id, licenseType: "personal", amountCents: 500 });
  await upsertPrice(h.db, ctx, { productId: product.id, licenseType: "commercial", amountCents: 1500 });
  await publishProduct(h.db, ctx, product.id);
  const free = await createProduct(h.db, ctx, { brandId: mood.id, slug: "free-heart", title: "Free Heart", description: "Free sample.", kind: "single", assetIds: [saved.asset.id] });
  await upsertPrice(h.db, ctx, { productId: free.id, licenseType: "personal", amountCents: 0 });
  await publishProduct(h.db, ctx, free.id);
  console.log("E2E storefront data ready.");
} finally {
  await h.close();
}
