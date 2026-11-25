import type { AssetDefinition } from "@sb/asset";
import { newId } from "@sb/core";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import { asset, assetVersion, download, entitlement, license, product, productAsset } from "../schema";
import { deliverableVersion } from "./catalog";
import { DEFAULT_DOWNLOAD_LIMITS, type DownloadLimits } from "./commerce";

/**
 * Developer API (CLI, MCP server, AI coding agents): search the published catalog, look an icon up, and fetch an
 * icon's source with a license code. Only published products and their deliverable (approved + exported) versions
 * are ever visible; files need a license code whose product contains the icon.
 */

export interface IconProductRef {
  slug: string;
  title: string;
  free: boolean;
}

export interface IconSummary {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  category: string | null;
  hasSound: boolean;
  durationMs: number;
  products: IconProductRef[];
}

interface Row {
  assetId: string;
  slug: string;
  definition: AssetDefinition;
  productSlug: string;
  productTitle: string;
  free: boolean;
}

async function publishedIconRows(db: Database, brandId: string, assetSlug?: string): Promise<Row[]> {
  const conds = [eq(product.brandId, brandId), eq(product.status, "published")];
  if (assetSlug) conds.push(eq(asset.slug, assetSlug));
  const rows = await db
    .select({
      assetId: asset.id,
      slug: asset.slug,
      definition: assetVersion.definition,
      productSlug: product.slug,
      productTitle: product.title,
      free: sql<boolean>`exists (select 1 from price p where p.product_id = ${product.id} and p.active and p.amount_cents = 0)`,
    })
    .from(productAsset)
    .innerJoin(product, eq(product.id, productAsset.productId))
    .innerJoin(asset, and(eq(asset.id, productAsset.assetId), eq(asset.brandId, brandId)))
    .innerJoin(assetVersion, and(eq(assetVersion.assetId, asset.id), sql`${assetVersion.version} = ${deliverableVersion(asset.id)}`))
    .where(and(...conds));
  return rows.map((r) => ({ ...r, definition: r.definition as AssetDefinition }));
}

function summarize(rows: Row[]): IconSummary {
  const ad = rows[0]!.definition;
  const products = new Map<string, IconProductRef>();
  for (const r of rows) products.set(r.productSlug, { slug: r.productSlug, title: r.productTitle, free: r.free });
  return {
    slug: ad.slug,
    name: ad.name,
    description: ad.a11y.label,
    tags: ad.tags,
    category: ad.category ?? null,
    hasSound: ad.sounds.length > 0,
    durationMs: ad.timeline.duration,
    // Smallest purchase first: singles and free packs before big bundles.
    products: [...products.values()].sort((a, b) => Number(b.free) - Number(a.free)),
  };
}

function groupBySlug(rows: Row[]): Map<string, Row[]> {
  const by = new Map<string, Row[]>();
  for (const r of rows) by.set(r.slug, [...(by.get(r.slug) ?? []), r]);
  return by;
}

/** Every word of the query must match the icon's slug, name, tags, category or description; name hits rank first. */
export async function searchPublishedIcons(db: Database, brandId: string, opts: { q?: string; limit?: number } = {}): Promise<IconSummary[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const words = (opts.q ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 8);
  const scored: { s: IconSummary; score: number }[] = [];
  for (const rows of groupBySlug(await publishedIconRows(db, brandId)).values()) {
    const s = summarize(rows);
    const title = `${s.slug} ${s.name}`.toLowerCase();
    const hay = `${title} ${s.tags.join(" ")} ${s.category ?? ""} ${s.description}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    scored.push({ s, score: words.filter((w) => title.includes(w)).length });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.s.slug.localeCompare(b.s.slug))
    .slice(0, limit)
    .map((x) => x.s);
}

export async function getPublishedIcon(db: Database, brandId: string, slug: string): Promise<{ summary: IconSummary; definition: AssetDefinition } | null> {
  const rows = await publishedIconRows(db, brandId, slug);
  if (!rows.length) return null;
  return { summary: summarize(rows), definition: rows[0]!.definition };
}

export type ApiDownloadAuthorization =
  | { ok: true; definition: AssetDefinition; version: number; license: { code: string; licenseType: string; productSlug: string; productTitle: string } }
  | { ok: false; reason: "invalid_license" | "license_revoked" | "not_found" | "not_in_license" | "rate_limited"; message: string; products?: IconProductRef[] };

/**
 * The developer API's only path to icon source: the license must belong to this brand and be active, its product must
 * contain the icon, and the customer must be under the same download limits as the website. Logs a download.
 */
export async function authorizeApiDownload(
  db: Database,
  input: { brandId: string; code: string; assetSlug: string; ipHash?: string | null; userAgent?: string | null; limits?: DownloadLimits; now?: Date },
): Promise<ApiDownloadAuthorization> {
  const limits = input.limits ?? DEFAULT_DOWNLOAD_LIMITS;
  const now = input.now ?? new Date();
  const [row] = await db
    .select({ license, productSlug: product.slug, productTitle: product.title })
    .from(license)
    .innerJoin(product, eq(product.id, license.productId))
    .where(and(eq(license.code, input.code), eq(license.brandId, input.brandId)));
  if (!row) return { ok: false, reason: "invalid_license", message: "This license code isn't valid for this store." };
  const l = row.license;
  const [e] = await db.select().from(entitlement).where(and(eq(entitlement.licenseId, l.id), isNull(entitlement.revokedAt)));
  if (l.revokedAt || !e) return { ok: false, reason: "license_revoked", message: "This license has been revoked (for example after a refund)." };

  const icon = await getPublishedIcon(db, input.brandId, input.assetSlug);
  if (!icon) return { ok: false, reason: "not_found", message: `No published icon called "${input.assetSlug}".` };
  const [pa] = await db
    .select({ assetId: productAsset.assetId, version: sql<number>`${deliverableVersion(productAsset.assetId)}` })
    .from(productAsset)
    .innerJoin(asset, eq(asset.id, productAsset.assetId))
    .where(and(eq(productAsset.productId, l.productId), eq(asset.slug, input.assetSlug), eq(asset.brandId, input.brandId)));
  if (!pa || pa.version == null) {
    return { ok: false, reason: "not_in_license", message: `"${input.assetSlug}" isn't part of ${row.productTitle}. It's available in: ${icon.summary.products.map((p) => p.title).join(", ")}.`, products: icon.summary.products };
  }

  const [counts] = await db
    .select({
      hour: sql<number>`count(*) filter (where ${download.createdAt} >= ${new Date(now.getTime() - 3600_000)})::int`,
      day: sql<number>`count(*)::int`,
    })
    .from(download)
    .where(and(eq(download.customerId, l.customerId), gte(download.createdAt, new Date(now.getTime() - 86_400_000))));
  if (counts!.hour >= limits.perHour || counts!.day >= limits.perDay) {
    return { ok: false, reason: "rate_limited", message: "Download limit reached for this license. Please try again later." };
  }
  await db.insert(download).values({
    id: newId("dl"),
    entitlementId: e.id,
    customerId: l.customerId,
    assetId: pa.assetId,
    assetVersion: pa.version,
    ipHash: input.ipHash ?? null,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
    createdAt: now,
  });
  const [v] = await db.select({ definition: assetVersion.definition }).from(assetVersion).where(and(eq(assetVersion.assetId, pa.assetId), eq(assetVersion.version, pa.version)));
  return {
    ok: true,
    definition: v!.definition as AssetDefinition,
    version: pa.version,
    license: { code: l.code, licenseType: l.licenseType, productSlug: row.productSlug, productTitle: row.productTitle },
  };
}
