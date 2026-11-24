import { createHash } from "node:crypto";
import { AssetDefinition, runQa, type QaResult } from "@sb/asset";
import { newId, NotFoundError, ValidationError } from "@sb/core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import { asset, assetVersion, brand, exportArtifact, qualityReview, type Asset, type AssetVersion } from "../schema";
import { recordAudit, type AuditContext } from "./audit";
import type { BrandScope } from "./brands";

/** Deterministic JSON (sorted keys) so identical definitions get identical checksums. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function definitionChecksum(def: unknown): string {
  return createHash("sha256").update(canonicalJson(def)).digest("hex");
}

export interface SaveDefinitionResult {
  asset: Asset;
  version: AssetVersion;
  qa: QaResult;
  /** false when the definition was identical to the current version (no new version created). */
  created: boolean;
}

/**
 * Validates and stores a definition: creates the asset (first time) or a new immutable version,
 * runs automated QA and records it. Assets that pass QA go to `in_review`; failures stay `draft`.
 * Brand is taken from the definition and must exist.
 */
export async function saveAssetDefinition(
  db: Database,
  ctx: AuditContext,
  input: unknown,
  opts: { productionJobId?: string } = {},
): Promise<SaveDefinitionResult> {
  const parsed = AssetDefinition.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid asset definition", parsed.error.issues);
  const def = parsed.data;
  const qa = runQa(def);
  const checksum = definitionChecksum(def);

  return db.transaction(async (tx) => {
    const [b] = await tx.select({ id: brand.id }).from(brand).where(eq(brand.slug, def.brand));
    if (!b) throw new ValidationError(`Unknown brand "${def.brand}"`);
    const [existing] = await tx
      .select()
      .from(asset)
      .where(and(eq(asset.brandId, b.id), eq(asset.slug, def.slug)))
      .for("update");

    let a: Asset | undefined;
    let versionNo = 1;
    if (existing) {
      const [cur] = await tx
        .select()
        .from(assetVersion)
        .where(and(eq(assetVersion.assetId, existing.id), eq(assetVersion.version, existing.currentVersion)));
      if (cur && cur.checksum === checksum) return { asset: existing, version: cur, qa, created: false };
      versionNo = existing.currentVersion + 1;
      [a] = await tx
        .update(asset)
        .set({ currentVersion: versionNo, name: def.name, category: def.category ?? null, status: qa.passed ? "in_review" : "draft" })
        .where(eq(asset.id, existing.id))
        .returning();
    } else {
      [a] = await tx
        .insert(asset)
        .values({
          id: newId("ast"),
          brandId: b.id,
          slug: def.slug,
          name: def.name,
          category: def.category ?? null,
          status: qa.passed ? "in_review" : "draft",
          createdBy: ctx.actorUserId,
        })
        .returning();
    }
    const [v] = await tx
      .insert(assetVersion)
      .values({
        id: newId("av"),
        assetId: a!.id,
        version: versionNo,
        definition: def,
        checksum,
        provenance: def.provenance.method,
        productionJobId: opts.productionJobId ?? null,
        createdBy: ctx.actorUserId,
      })
      .returning();
    await tx.insert(qualityReview).values({
      id: newId("qr"),
      assetVersionId: v!.id,
      kind: "automated",
      score: qa.score,
      passed: qa.passed,
      checks: { errors: qa.errors, warnings: qa.warnings, stats: qa.stats },
    });
    await recordAudit(tx, ctx, {
      action: existing ? "asset.version" : "asset.create",
      entityType: "asset",
      entityId: a!.id,
      brandId: b.id,
      after: { slug: def.slug, version: versionNo, provenance: def.provenance.method, qaScore: qa.score },
    });
    return { asset: a!, version: v!, qa, created: true };
  });
}

export interface AssetListItem {
  asset: Asset;
  brandSlug: string;
  definition: AssetDefinition;
  qaScore: number | null;
  provenance: string;
}

export async function listAssets(
  db: Database,
  scope: BrandScope,
  filter: { brandId?: string; status?: Asset["status"]; limit?: number } = {},
): Promise<AssetListItem[]> {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [eq(assetVersion.version, asset.currentVersion)];
  if (scope !== "all") conds.push(inArray(asset.brandId, scope));
  if (filter.brandId) conds.push(eq(asset.brandId, filter.brandId));
  if (filter.status) conds.push(eq(asset.status, filter.status));
  const rows = await db
    .select({
      asset,
      brandSlug: brand.slug,
      definition: assetVersion.definition,
      provenance: assetVersion.provenance,
      qaScore: sql<number | null>`(select score from quality_review q where q.asset_version_id = ${assetVersion.id} and q.kind = 'automated' order by q.created_at desc limit 1)`,
    })
    .from(asset)
    .innerJoin(assetVersion, eq(assetVersion.assetId, asset.id))
    .innerJoin(brand, eq(brand.id, asset.brandId))
    .where(and(...conds))
    .orderBy(desc(asset.updatedAt))
    .limit(Math.min(filter.limit ?? 200, 500));
  return rows.map((r) => ({ ...r, definition: r.definition as AssetDefinition }));
}

export async function getAssetDetail(db: Database, assetId: string) {
  const a = await db.query.asset.findFirst({ where: eq(asset.id, assetId) });
  if (!a) return null;
  const versions = await db.select().from(assetVersion).where(eq(assetVersion.assetId, a.id)).orderBy(desc(assetVersion.version));
  const current = versions.find((v) => v.version === a.currentVersion)!;
  const reviews = await db
    .select()
    .from(qualityReview)
    .where(inArray(qualityReview.assetVersionId, versions.map((v) => v.id)))
    .orderBy(desc(qualityReview.createdAt));
  const exports = await db.select().from(exportArtifact).where(eq(exportArtifact.assetVersionId, current.id));
  const [b] = await db.select().from(brand).where(eq(brand.id, a.brandId));
  return { asset: a, brand: b!, versions, current, definition: current.definition as AssetDefinition, reviews, exports };
}

/**
 * Human review. Approval requires the current version to have passed automated QA.
 * Approval does not publish: publishing creates a product (Phase 3) and needs `asset.publish`.
 */
export async function reviewAsset(
  db: Database,
  ctx: AuditContext,
  input: { assetId: string; decision: "approved" | "rejected"; notes?: string },
): Promise<Asset> {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(asset).where(eq(asset.id, input.assetId)).for("update");
    if (!a) throw new NotFoundError("Asset not found");
    const [v] = await tx
      .select()
      .from(assetVersion)
      .where(and(eq(assetVersion.assetId, a.id), eq(assetVersion.version, a.currentVersion)));
    const [auto] = await tx
      .select()
      .from(qualityReview)
      .where(and(eq(qualityReview.assetVersionId, v!.id), eq(qualityReview.kind, "automated")))
      .orderBy(desc(qualityReview.createdAt))
      .limit(1);
    if (input.decision === "approved" && !auto?.passed) {
      throw new ValidationError("This version failed automated QA and cannot be approved. Fix it and save a new version.");
    }
    if (a.status === "published" || a.status === "archived") throw new ValidationError(`Asset is ${a.status}; it can't be re-reviewed`);
    await tx.insert(qualityReview).values({
      id: newId("qr"),
      assetVersionId: v!.id,
      kind: "human",
      decision: input.decision,
      notes: input.notes?.slice(0, 2000) ?? null,
      reviewerId: ctx.actorUserId,
    });
    const [updated] = await tx.update(asset).set({ status: input.decision }).where(eq(asset.id, a.id)).returning();
    await recordAudit(tx, ctx, {
      action: `asset.${input.decision === "approved" ? "approve" : "reject"}`,
      entityType: "asset",
      entityId: a.id,
      brandId: a.brandId,
      before: { status: a.status },
      after: { status: input.decision, version: a.currentVersion, notes: input.notes ?? null },
    });
    return updated!;
  });
}

export async function recordExportArtifacts(
  db: DbOrTx,
  assetVersionId: string,
  artifacts: { format: string; storageKey: string; bytes: number; sha256: string }[],
): Promise<void> {
  for (const art of artifacts) {
    await db
      .insert(exportArtifact)
      .values({ id: newId("ex"), assetVersionId, ...art })
      .onConflictDoUpdate({
        target: [exportArtifact.assetVersionId, exportArtifact.format],
        set: { storageKey: art.storageKey, bytes: art.bytes, sha256: art.sha256, createdAt: new Date() },
      });
  }
}

export async function assetCountsByStatus(db: Database, scope: BrandScope): Promise<Record<string, number>> {
  if (scope !== "all" && scope.length === 0) return {};
  const rows = await db
    .select({ status: asset.status, n: sql<number>`count(*)::int` })
    .from(asset)
    .where(scope === "all" ? undefined : inArray(asset.brandId, scope))
    .groupBy(asset.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
