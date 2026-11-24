/**
 * DEVELOPMENT ONLY: fills a local database with the launch catalog so the storefront designs can be seen.
 *   pnpm --filter @sb/worker demo:catalog            # both brands
 *
 * It does what staff do in the admin, as fast as possible: runs the rig jobs, **approves every asset as
 * "demo-script"**, exports packages (SVG/PNG/JSON only, to save time), creates the launch products and publishes them.
 * Because it skips human review, it refuses to run against anything that isn't a dev or test database.
 */
import { applyCatalogPlan, claimNextJob, completeJob, createDb, enqueueJob, getBrandBySlug, listAssets, listProducts, publishProduct, reviewAsset, schema } from "@sb/db";
import { launchCatalog, launchRigJobs, RIGS } from "@sb/rigs";
import { createStorageFromEnv } from "@sb/storage";
import { eq } from "drizzle-orm";
import { runJob } from "../jobs";

const url = process.env.DATABASE_URL ?? "";
const dbName = url.split("/").pop()?.split("?")[0] ?? "";
if (process.env.DEPLOY_ENV === "production" || !/(_dev|test)$/.test(dbName)) {
  console.error(`Refusing to run: demo:catalog only runs against a *_dev or *test database (got "${dbName}").`);
  process.exit(1);
}

const h = createDb(url, { max: 4 });
const storage = createStorageFromEnv(process.env);
const ctx = { actorUserId: null, userAgent: "demo-script" };
const brands = process.argv.slice(2).length ? process.argv.slice(2) : ["moodicons", "sonicglyphs"];

async function drain() {
  for (;;) {
    const job = await h.db.transaction(async () => claimNextJob(h.db));
    if (!job) return;
    try {
      await completeJob(h.db, job.id, await runJob(job, { db: h.db, storage }));
    } catch (e) {
      console.error(`job ${job.id} failed:`, (e as Error).message);
      await h.db.update(schema.productionJob).set({ status: "failed", error: (e as Error).message }).where(eq(schema.productionJob.id, job.id));
    }
  }
}

try {
  for (const slug of brands) {
    const brand = await getBrandBySlug(h.db, slug);
    if (!brand) throw new Error(`Unknown brand ${slug}`);
    for (const j of launchRigJobs(slug)) {
      await enqueueJob(h.db, ctx, { brandId: brand.id, kind: "rig", brief: { rig: j.rig, variants: RIGS[j.rig]!.variants, palettes: j.palettes } });
    }
    await drain();
    const assets = await listAssets(h.db, [brand.id], { brandId: brand.id, limit: 500 });
    for (const a of assets.filter((x) => x.asset.status === "in_review")) await reviewAsset(h.db, ctx, { assetId: a.asset.id, decision: "approved" });
    const { exportArtifact, assetVersion, asset } = schema;
    for (const a of assets) {
      const [has] = await h.db
        .select({ id: exportArtifact.id })
        .from(exportArtifact)
        .innerJoin(assetVersion, eq(assetVersion.id, exportArtifact.assetVersionId))
        .innerJoin(asset, eq(asset.id, assetVersion.assetId))
        .where(eq(asset.id, a.asset.id));
      if (!has) await enqueueJob(h.db, ctx, { brandId: brand.id, kind: "export", brief: { assetId: a.asset.id, formats: ["svg", "svg-animated", "png", "json", "web-component", "react", "wav"] } });
    }
    await drain();
    const plan = await applyCatalogPlan(h.db, ctx, brand.id, launchCatalog(slug));
    for (const p of await listProducts(h.db, [brand.id], { status: "draft" })) await publishProduct(h.db, ctx, p.product.id);
    console.log(`${slug}: ${assets.length} assets, products created ${plan.created.length}, existing ${plan.existing.length}, missing ${plan.missingAssets.length}`);
  }
} finally {
  await h.close();
}
