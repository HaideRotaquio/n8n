import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FIXTURE_OUTPUTS, FixtureProvider } from "@sb/agents";
import { addExpense, enqueueJob, getAssetDetail, getBrandBySlug, getJob, listAssets, seed, type DbHandle } from "@sb/db";
import { createTestDb } from "@sb/db/testing";
import { createFsDriver, type StorageDriver } from "@sb/storage";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drain, type WorkerLogger } from "./worker";

let h: DbHandle;
let storage: StorageDriver;
let dir: string;
const ctx = { actorUserId: null };
const quiet: WorkerLogger = { info: () => {}, error: () => {} };
const fixtureAi = () => ({ configured: true as const, provider: new FixtureProvider(structuredClone(FIXTURE_OUTPUTS)), label: "Fixture outputs (not AI)" });

beforeAll(async () => {
  h = await createTestDb();
  await seed(h.db);
  dir = await mkdtemp(path.join(tmpdir(), "worker-test-"));
  storage = createFsDriver({ root: dir, downloadBaseUrl: "http://localhost/dl", signingSecret: "worker-test-secret-worker-test-secret-01" });
});
afterAll(async () => {
  await h?.close();
  await rm(dir, { recursive: true, force: true });
});

describe("rig jobs", () => {
  it("builds the Moodicons starter set at no cost; re-running creates nothing new", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "rig", brief: { rig: "moodicons-face@1" } });
    await drain({ db: h.db, storage }, quiet);
    const done = (await getJob(h.db, job.id))!.job;
    expect(done.status).toBe("succeeded");
    expect((done.result as any).created).toHaveLength(15);
    expect((done.result as any).created.every((c: any) => c.qaScore === 100)).toBe(true);
    expect(Number(done.costUsd)).toBe(0);

    const again = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "rig", brief: { rig: "moodicons-face@1" } });
    await drain({ db: h.db, storage }, quiet);
    expect(((await getJob(h.db, again.id))!.job.result as any).unchanged).toBe(15);
  });

  it("refuses a rig from another brand, without retrying", async () => {
    const sonic = (await getBrandBySlug(h.db, "sonicglyphs"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: sonic.id, kind: "rig", brief: { rig: "moodicons-face@1" } });
    await drain({ db: h.db, storage }, quiet);
    const done = (await getJob(h.db, job.id))!.job;
    expect(done.status).toBe("failed");
    expect(done.attempts).toBe(1);
    expect(done.error).toMatch(/different brand/);
  });
});

describe("AI jobs", () => {
  it("fails clearly when no AI provider is configured", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "ai", brief: { prompt: "a star" } });
    await drain({ db: h.db, storage, ai: { configured: false, reason: "No AI provider configured." } }, quiet);
    const done = (await getJob(h.db, job.id))!.job;
    expect(done.status).toBe("failed");
    expect(done.error).toBe("No AI provider configured.");
  });

  it("runs the agent pipeline (fixture provider), records each agent call and stores a fixture-provenance asset", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "ai", brief: { prompt: "a celebratory star" } });
    await drain({ db: h.db, storage, ai: fixtureAi() }, quiet);
    const { job: done, tasks } = (await getJob(h.db, job.id))!;
    expect(done.status).toBe("succeeded");
    expect(tasks.map((t) => t.agent)).toEqual(["creative_director", "svg_artist", "animator"]);
    expect(tasks.every((t) => t.provider === "fixture")).toBe(true);
    const assetId = (done.result as any).created[0].assetId;
    const detail = (await getAssetDetail(h.db, assetId))!;
    expect(detail.current.provenance).toBe("fixture");
    expect(detail.current.productionJobId).toBe(job.id);
    expect(detail.asset.status).toBe("in_review");
  });

  it("stops at the daily AI budget without calling the model", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    await addExpense(h.db, ctx, { brandId: mood.id, category: "ai", description: "earlier usage", amountUsd: 5 });
    const ai = fixtureAi();
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "ai", brief: { prompt: "another star" } });
    await drain({ db: h.db, storage, ai, budget: { dailyUsd: 5, monthlyUsd: 50 } }, quiet);
    const done = (await getJob(h.db, job.id))!.job;
    expect(done.status).toBe("failed");
    expect(done.error).toMatch(/Daily AI budget of \$5 reached/);
    expect((ai.provider as FixtureProvider).calls).toHaveLength(0);
  });
});

describe("export jobs", () => {
  it("renders files and a package into storage and records artifacts", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const [item] = await listAssets(h.db, [mood.id]);
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "export", brief: { assetId: item!.asset.id } });
    await drain({ db: h.db, storage }, quiet);
    const done = (await getJob(h.db, job.id))!.job;
    expect(done.status, done.error ?? "").toBe("succeeded");
    const detail = (await getAssetDetail(h.db, item!.asset.id))!;
    expect(detail.exports.map((e) => e.format).sort()).toEqual(["gif", "lottie", "mp4", "png", "svg", "svg-animated", "zip"]);
    const zipArt = detail.exports.find((e) => e.format === "zip")!;
    const zip = unzipSync((await storage.get(zipArt.storageKey))!);
    expect(Object.keys(zip)).toContain("README.txt");
    expect(strFromU8(zip["LICENSE.txt"]!)).toContain("NOT LICENSED");
    expect(zipArt.storageKey).toMatch(new RegExp(`^brands/moodicons/assets/${item!.asset.id}/v1/`));
  }, 120_000);

  it("won't export another brand's asset", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const sonic = (await getBrandBySlug(h.db, "sonicglyphs"))!;
    const [item] = await listAssets(h.db, [mood.id]);
    const job = await enqueueJob(h.db, ctx, { brandId: sonic.id, kind: "export", brief: { assetId: item!.asset.id } });
    await drain({ db: h.db, storage }, quiet);
    expect((await getJob(h.db, job.id))!.job.error).toMatch(/not found for this brand/);
  });
});
