import { BEATING_HEART } from "@sb/asset";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "./client";
import {
  addExpense,
  assetCountsByStatus,
  canonicalJson,
  claimNextJob,
  completeJob,
  enqueueJob,
  expenseSummary,
  failJob,
  getAssetDetail,
  getBrandBySlug,
  getJob,
  listAssets,
  recordAgentTask,
  recordExportArtifacts,
  reviewAsset,
  saveAssetDefinition,
  sumExpenses,
} from "./index";
import { assetVersion, productionJob } from "./schema";
import { seed } from "./seed";
import { createTestDb } from "./testing";

let h: DbHandle;
const ctx = { actorUserId: null };
const heart = () => structuredClone(BEATING_HEART) as any;

beforeAll(async () => {
  h = await createTestDb();
  await seed(h.db);
});
afterAll(async () => {
  await h?.close();
});

describe("assets", () => {
  it("stores a definition as v1 with automated QA and puts passing assets in review", async () => {
    const r = await saveAssetDefinition(h.db, ctx, heart());
    expect(r.created).toBe(true);
    expect(r.version.version).toBe(1);
    expect(r.qa.passed).toBe(true);
    expect(r.asset.status).toBe("in_review");
    expect(r.version.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is idempotent for identical definitions and versions changed ones", async () => {
    const same = await saveAssetDefinition(h.db, ctx, heart());
    expect(same.created).toBe(false);
    const changed = heart();
    changed.tokens.primary = "#00AA00";
    const v2 = await saveAssetDefinition(h.db, ctx, changed);
    expect(v2.version.version).toBe(2);
    const detail = await getAssetDetail(h.db, v2.asset.id);
    expect(detail!.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(detail!.definition.tokens.primary).toBe("#00AA00");
  });

  it("keys order doesn't change the checksum", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  });

  it("keeps QA failures in draft and refuses to approve them", async () => {
    const bad = heart();
    bad.slug = "broken-heart";
    bad.timeline.tracks.push({ target: "ghost", property: "rotate", keyframes: [{ at: 0, value: 0 }] });
    const r = await saveAssetDefinition(h.db, ctx, bad);
    expect(r.qa.passed).toBe(false);
    expect(r.asset.status).toBe("draft");
    await expect(reviewAsset(h.db, ctx, { assetId: r.asset.id, decision: "approved" })).rejects.toThrow(/failed automated QA/);
    const rejected = await reviewAsset(h.db, ctx, { assetId: r.asset.id, decision: "rejected", notes: "ghost layer" });
    expect(rejected.status).toBe("rejected");
  });

  it("rejects invalid definitions and unknown brands", async () => {
    await expect(saveAssetDefinition(h.db, ctx, { nope: 1 })).rejects.toThrow(/Invalid asset definition/);
  });

  it("approves a passing asset and records a human review", async () => {
    const [item] = await listAssets(h.db, "all", { status: "in_review" });
    const approved = await reviewAsset(h.db, ctx, { assetId: item!.asset.id, decision: "approved", notes: "Looks great" });
    expect(approved.status).toBe("approved");
    const detail = await getAssetDetail(h.db, item!.asset.id);
    expect(detail!.reviews.find((r) => r.kind === "human")?.decision).toBe("approved");
  });

  it("asset versions are immutable at the database level", async () => {
    const msg = await h.db
      .update(assetVersion)
      .set({ definition: { hacked: true } })
      .then(() => "no error", (e: { cause?: { message?: string } }) => e.cause?.message ?? "");
    expect(msg).toMatch(/immutable/);
  });

  it("lists by brand scope and counts by status", async () => {
    const sonic = (await getBrandBySlug(h.db, "sonicglyphs"))!;
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    expect(await listAssets(h.db, [sonic.id])).toEqual([]);
    expect((await listAssets(h.db, [mood.id])).length).toBe(2);
    expect(await assetCountsByStatus(h.db, [mood.id])).toEqual({ approved: 1, rejected: 1 });
  });

  it("records export artifacts (upsert per format)", async () => {
    const [item] = await listAssets(h.db, "all", { status: "approved" });
    const d = (await getAssetDetail(h.db, item!.asset.id))!;
    await recordExportArtifacts(h.db, d.current.id, [{ format: "zip", storageKey: "a/b.zip", bytes: 10, sha256: "x" }]);
    await recordExportArtifacts(h.db, d.current.id, [{ format: "zip", storageKey: "a/c.zip", bytes: 12, sha256: "y" }]);
    const again = (await getAssetDetail(h.db, item!.asset.id))!;
    expect(again.exports).toHaveLength(1);
    expect(again.exports[0]!.storageKey).toBe("a/c.zip");
  });
});

describe("job queue", () => {
  it("claims jobs exactly once, even with concurrent workers", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    for (let i = 0; i < 5; i++) await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "rig", brief: { i } });
    const claimed = await Promise.all(Array.from({ length: 8 }, () => claimNextJob(h.db)));
    const ids = claimed.filter(Boolean).map((j) => j!.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(await claimNextJob(h.db)).toBeNull();
    for (const id of ids) await completeJob(h.db, id, { ok: true });
  });

  it("retries with backoff, then fails", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "export", brief: {}, maxAttempts: 2 });
    const first = (await claimNextJob(h.db, ["export"]))!;
    expect(first.id).toBe(job.id);
    expect(await failJob(h.db, first, "boom")).toBe("retry");
    expect(await claimNextJob(h.db, ["export"])).toBeNull(); // backoff: run_after in the future
    await h.db.update(productionJob).set({ runAfter: sql`now()` }).where(eq(productionJob.id, job.id));
    const second = (await claimNextJob(h.db, ["export"]))!;
    expect(second.attempts).toBe(2);
    expect(await failJob(h.db, second, "boom again")).toBe("failed");
    const final = await getJob(h.db, job.id);
    expect(final!.job.status).toBe("failed");
    expect(final!.job.error).toBe("boom again");
  });

  it("books agent costs on the job and as AI expenses", async () => {
    const mood = (await getBrandBySlug(h.db, "moodicons"))!;
    const job = await enqueueJob(h.db, ctx, { brandId: mood.id, kind: "ai", brief: {} });
    await recordAgentTask(h.db, { productionJobId: job.id, brandId: mood.id, agent: "svg", provider: "anthropic", model: "m", status: "succeeded", inputTokens: 1000, outputTokens: 2000, costUsd: 0.044, durationMs: 1200 });
    await recordAgentTask(h.db, { productionJobId: job.id, brandId: mood.id, agent: "catalog", provider: "fixture", model: "fixture", status: "succeeded", inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 1 });
    const j = await getJob(h.db, job.id);
    expect(Number(j!.job.costUsd)).toBeCloseTo(0.044, 6);
    expect(j!.tasks).toHaveLength(2);
    const since = new Date(Date.now() - 60_000);
    expect(await sumExpenses(h.db, { since, category: "ai" })).toBeCloseTo(0.044, 6);
  });

  it("summarizes manual and AI expenses by month, brand and category", async () => {
    await addExpense(h.db, ctx, { brandId: null, category: "infrastructure", description: "Neon", amountUsd: 5 });
    await expect(addExpense(h.db, ctx, { brandId: null, category: "infrastructure", description: "x", amountUsd: -1 })).rejects.toThrow();
    const rows = await expenseSummary(h.db);
    expect(rows.find((r) => r.category === "infrastructure" && r.brandSlug === null)?.totalUsd).toBe(5);
    expect(rows.find((r) => r.category === "ai" && r.brandSlug === "moodicons")?.totalUsd).toBeCloseTo(0.044, 6);
  });
});
