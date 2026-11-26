import type { AssetDefinition } from "@sb/asset";
import { LicenseType, newId, NotFoundError, ValidationError } from "@sb/core";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import {
  asset,
  assetVersion,
  brand,
  collection,
  collectionProduct,
  exportArtifact,
  price,
  product,
  productAsset,
  type Asset,
  type Collection,
  type Price,
  type Product,
} from "../schema";
import { recordAudit, type AuditContext } from "./audit";
import type { BrandScope } from "./brands";

/**
 * Catalog: products (what customers buy), prices (per license type) and collections.
 * Staff functions take an AuditContext and record every change; storefront reads take a brand id
 * resolved from the request host and only ever see published products.
 */

const SLUG = /^[a-z0-9-]{2,80}$/;

/**
 * The version customers see and download: the newest version a reviewer approved that also has an export
 * package. A newer, unreviewed version never reaches buyers until it is approved and exported.
 */
export const deliverableVersion = (assetId: unknown) => sql<number | null>`(
  select max(v.version) from asset_version v
  where v.asset_id = ${assetId}
    and exists (select 1 from quality_review q where q.asset_version_id = v.id and q.kind = 'human' and q.decision = 'approved')
    and exists (select 1 from export_artifact e where e.asset_version_id = v.id and e.format = 'zip'))`;
/** Bundles download icon by icon, so size only limits how much one product page lists. */
const MAX_PACK_ASSETS = 200;

export interface ProductInput {
  brandId: string;
  slug: string;
  title: string;
  description?: string;
  kind: Product["kind"];
  assetIds: string[];
}

function checkProductInput(input: Omit<ProductInput, "brandId">) {
  if (!SLUG.test(input.slug)) throw new ValidationError("Slug must be 2–80 lowercase letters, digits or hyphens");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) throw new ValidationError("Title must be 2–120 characters");
  if ((input.description ?? "").length > 5000) throw new ValidationError("Description must be at most 5,000 characters");
  const ids = [...new Set(input.assetIds)];
  if (input.kind === "single" && ids.length !== 1) throw new ValidationError("A single product contains exactly one asset");
  if (input.kind === "pack" && (ids.length < 2 || ids.length > MAX_PACK_ASSETS)) {
    throw new ValidationError(`A pack contains 2–${MAX_PACK_ASSETS} assets`);
  }
  return { title, ids };
}

async function assertAssetsInBrand(tx: DbOrTx, brandId: string, assetIds: string[]): Promise<Asset[]> {
  const rows = await tx.select().from(asset).where(inArray(asset.id, assetIds));
  if (rows.length !== assetIds.length || rows.some((a) => a.brandId !== brandId)) {
    throw new ValidationError("Every asset must exist and belong to the product's brand");
  }
  if (rows.some((a) => a.status === "archived" || a.status === "rejected")) {
    throw new ValidationError("Archived or rejected assets can't be added to a product");
  }
  return rows;
}

export async function createProduct(db: Database, ctx: AuditContext, input: ProductInput): Promise<Product> {
  const { title, ids } = checkProductInput(input);
  return db.transaction(async (tx) => {
    await assertAssetsInBrand(tx, input.brandId, ids);
    const [dup] = await tx.select({ id: product.id }).from(product).where(and(eq(product.brandId, input.brandId), eq(product.slug, input.slug)));
    if (dup) throw new ValidationError(`A product with slug "${input.slug}" already exists in this brand`);
    const [p] = await tx
      .insert(product)
      .values({
        id: newId("prd"),
        brandId: input.brandId,
        slug: input.slug,
        kind: input.kind,
        title,
        description: input.description?.trim() ?? "",
        createdBy: ctx.actorUserId,
      })
      .returning();
    await tx.insert(productAsset).values(ids.map((assetId, position) => ({ productId: p!.id, assetId, position })));
    await recordAudit(tx, ctx, { action: "product.create", entityType: "product", entityId: p!.id, brandId: input.brandId, after: { slug: p!.slug, kind: p!.kind, assetIds: ids } });
    return p!;
  });
}

/** Title and description can change any time; the asset list only while the product is a draft (buyers keep what they bought). */
export async function updateProduct(
  db: Database,
  ctx: AuditContext,
  productId: string,
  patch: { title?: string; description?: string; assetIds?: string[] },
): Promise<Product> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(product).where(eq(product.id, productId)).for("update");
    if (!cur) throw new NotFoundError("Product not found");
    const curAssets = (await tx.select().from(productAsset).where(eq(productAsset.productId, productId)).orderBy(asc(productAsset.position))).map((r) => r.assetId);
    const next = {
      slug: cur.slug,
      kind: cur.kind,
      title: patch.title ?? cur.title,
      description: patch.description ?? cur.description,
      assetIds: patch.assetIds ?? curAssets,
    };
    const { title, ids } = checkProductInput(next);
    const assetsChanged = patch.assetIds !== undefined && ids.join() !== curAssets.join();
    if (assetsChanged) {
      if (cur.status !== "draft") throw new ValidationError("Assets can only change while the product is a draft");
      await assertAssetsInBrand(tx, cur.brandId, ids);
      await tx.delete(productAsset).where(eq(productAsset.productId, productId));
      await tx.insert(productAsset).values(ids.map((assetId, position) => ({ productId, assetId, position })));
    }
    const [p] = await tx.update(product).set({ title, description: next.description.trim() }).where(eq(product.id, productId)).returning();
    await recordAudit(tx, ctx, {
      action: "product.update",
      entityType: "product",
      entityId: productId,
      brandId: cur.brandId,
      before: { title: cur.title, description: cur.description, assetIds: curAssets },
      after: { title: p!.title, description: p!.description, assetIds: ids },
    });
    return p!;
  });
}

export interface PriceInput {
  productId: string;
  licenseType: string;
  currency?: string;
  amountCents: number;
  active?: boolean;
}

/** Creates or updates the price for (product, license type, currency). License type must be offered by the brand. */
export async function upsertPrice(db: Database, ctx: AuditContext, input: PriceInput): Promise<Price> {
  const lt = LicenseType.safeParse(input.licenseType);
  if (!lt.success) throw new ValidationError(`Unknown license type "${input.licenseType}"`);
  const currency = (input.currency ?? "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError("Currency must be a 3-letter ISO code");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0 || input.amountCents > 10_000_000) {
    throw new ValidationError("Amount must be a whole number of cents between 0 and 10,000,000");
  }
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(product).where(eq(product.id, input.productId));
    if (!p) throw new NotFoundError("Product not found");
    const [b] = await tx.select().from(brand).where(eq(brand.id, p.brandId));
    if (!b!.config.licenseTypes.includes(lt.data)) throw new ValidationError(`${b!.name} does not offer the ${lt.data} license`);
    const [before] = await tx
      .select()
      .from(price)
      .where(and(eq(price.productId, p.id), eq(price.licenseType, lt.data), eq(price.currency, currency)));
    const [row] = await tx
      .insert(price)
      .values({ id: newId("pri"), productId: p.id, licenseType: lt.data, currency, amountCents: input.amountCents, active: input.active ?? true })
      .onConflictDoUpdate({
        target: [price.productId, price.licenseType, price.currency],
        set: { amountCents: input.amountCents, active: input.active ?? true, updatedAt: new Date() },
      })
      .returning();
    await recordAudit(tx, ctx, {
      action: "price.set",
      entityType: "price",
      entityId: row!.id,
      brandId: p.brandId,
      before: before ? { amountCents: before.amountCents, active: before.active } : null,
      after: { productId: p.id, licenseType: lt.data, currency, amountCents: row!.amountCents, active: row!.active },
    });
    return row!;
  });
}

export interface PublishCheck {
  ok: boolean;
  problems: string[];
}

/** Everything that must be true before a product can be sold. */
export async function checkPublishable(db: DbOrTx, productId: string): Promise<PublishCheck> {
  const problems: string[] = [];
  const [p] = await db.select().from(product).where(eq(product.id, productId));
  if (!p) return { ok: false, problems: ["Product not found"] };
  const prices = await db.select().from(price).where(and(eq(price.productId, productId), eq(price.active, true)));
  if (prices.length === 0) problems.push("Add at least one active price (0 makes it a free download)");
  const rows = await db
    .select({ asset, deliverable: deliverableVersion(asset.id) })
    .from(productAsset)
    .innerJoin(asset, eq(asset.id, productAsset.assetId))
    .where(eq(productAsset.productId, productId));
  if (rows.length === 0) problems.push("The product has no assets");
  for (const r of rows) {
    if (r.asset.status === "archived" || r.asset.status === "rejected") problems.push(`“${r.asset.name}” is ${r.asset.status}`);
    else if (r.deliverable === null) problems.push(`“${r.asset.name}” needs a reviewer-approved version with an export package`);
  }
  return { ok: problems.length === 0, problems };
}

/** Publishing makes the product buyable and marks its assets published. Requires `asset.publish` (checked by the caller). */
export async function publishProduct(db: Database, ctx: AuditContext, productId: string): Promise<Product> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(product).where(eq(product.id, productId)).for("update");
    if (!cur) throw new NotFoundError("Product not found");
    if (cur.status === "published") return cur;
    const check = await checkPublishable(tx, productId);
    if (!check.ok) throw new ValidationError("This product can't be published yet", check.problems);
    const [p] = await tx
      .update(product)
      .set({ status: "published", publishedAt: new Date(), publishedBy: ctx.actorUserId })
      .where(eq(product.id, productId))
      .returning();
    const assetIds = (await tx.select().from(productAsset).where(eq(productAsset.productId, productId))).map((r) => r.assetId);
    await tx.update(asset).set({ status: "published" }).where(and(inArray(asset.id, assetIds), eq(asset.status, "approved")));
    await recordAudit(tx, ctx, { action: "product.publish", entityType: "product", entityId: productId, brandId: cur.brandId, before: { status: cur.status }, after: { status: "published", assetIds } });
    return p!;
  });
}

/** Stops new sales. Existing buyers keep their downloads and licenses. */
export async function archiveProduct(db: Database, ctx: AuditContext, productId: string): Promise<Product> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(product).where(eq(product.id, productId)).for("update");
    if (!cur) throw new NotFoundError("Product not found");
    const [p] = await tx.update(product).set({ status: "archived" }).where(eq(product.id, productId)).returning();
    await recordAudit(tx, ctx, { action: "product.archive", entityType: "product", entityId: productId, brandId: cur.brandId, before: { status: cur.status }, after: { status: "archived" } });
    return p!;
  });
}

export interface ProductListItem {
  product: Product;
  brandSlug: string;
  assetCount: number;
  minPriceCents: number | null;
  currency: string | null;
}

export async function listProducts(db: Database, scope: BrandScope, filter: { brandId?: string; status?: Product["status"] } = {}): Promise<ProductListItem[]> {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(product.brandId, scope));
  if (filter.brandId) conds.push(eq(product.brandId, filter.brandId));
  if (filter.status) conds.push(eq(product.status, filter.status));
  return db
    .select({
      product,
      brandSlug: brand.slug,
      assetCount: sql<number>`(select count(*)::int from product_asset pa where pa.product_id = ${product.id})`,
      minPriceCents: sql<number | null>`(select min(amount_cents)::int from price p where p.product_id = ${product.id} and p.active)`,
      currency: sql<string | null>`(select min(currency) from price p where p.product_id = ${product.id} and p.active)`,
    })
    .from(product)
    .innerJoin(brand, eq(brand.id, product.brandId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(product.updatedAt))
    .limit(500);
}

export interface ProductAssetView {
  asset: Asset;
  version: number;
  definition: AssetDefinition;
}

export interface ProductDetail {
  product: Product;
  brand: typeof brand.$inferSelect;
  assets: ProductAssetView[];
  prices: Price[];
}

/** Staff view: current (possibly unreviewed) versions. */
export async function getProductDetail(db: DbOrTx, productId: string): Promise<ProductDetail | null> {
  const [p] = await db.select().from(product).where(eq(product.id, productId));
  if (!p) return null;
  return productDetailFor(db, p, "current");
}

async function productDetailFor(db: DbOrTx, p: Product, which: "current" | "deliverable"): Promise<ProductDetail> {
  const [b] = await db.select().from(brand).where(eq(brand.id, p.brandId));
  const versionCond = which === "current" ? eq(assetVersion.version, asset.currentVersion) : sql`${assetVersion.version} = ${deliverableVersion(asset.id)}`;
  const rows = await db
    .select({ asset, version: assetVersion.version, definition: assetVersion.definition })
    .from(productAsset)
    .innerJoin(asset, eq(asset.id, productAsset.assetId))
    .innerJoin(assetVersion, and(eq(assetVersion.assetId, asset.id), versionCond))
    .where(eq(productAsset.productId, p.id))
    .orderBy(asc(productAsset.position));
  const prices = await db.select().from(price).where(eq(price.productId, p.id)).orderBy(asc(price.amountCents));
  return { product: p, brand: b!, assets: rows.map((r) => ({ ...r, definition: r.definition as AssetDefinition })), prices };
}

// ─── Storefront reads (brand from host; published only) ─────────────────────

export async function listPublishedProducts(db: Database, brandId: string): Promise<(ProductListItem & { cover: AssetDefinition | null })[]> {
  const items = await listProducts(db, [brandId], { status: "published" });
  const ids = items.map((i) => i.product.id);
  if (!ids.length) return [];
  const covers = await db
    .select({ productId: productAsset.productId, definition: assetVersion.definition })
    .from(productAsset)
    .innerJoin(asset, eq(asset.id, productAsset.assetId))
    .innerJoin(assetVersion, and(eq(assetVersion.assetId, asset.id), sql`${assetVersion.version} = ${deliverableVersion(asset.id)}`))
    .where(and(inArray(productAsset.productId, ids), eq(productAsset.position, 0)));
  const coverBy = new Map(covers.map((c) => [c.productId, c.definition as AssetDefinition]));
  return items
    .sort((a, b) => (b.product.publishedAt?.getTime() ?? 0) - (a.product.publishedAt?.getTime() ?? 0))
    .map((i) => ({ ...i, cover: coverBy.get(i.product.id) ?? null }));
}

export async function getPublishedProduct(db: Database, brandId: string, slug: string): Promise<ProductDetail | null> {
  const [p] = await db.select().from(product).where(and(eq(product.brandId, brandId), eq(product.slug, slug), eq(product.status, "published")));
  if (!p) return null;
  const d = await productDetailFor(db, p, "deliverable");
  return { ...d, prices: d.prices.filter((x) => x.active) };
}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function createCollection(
  db: Database,
  ctx: AuditContext,
  input: { brandId: string; slug: string; title: string; description?: string; productIds: string[] },
): Promise<Collection> {
  if (!SLUG.test(input.slug)) throw new ValidationError("Slug must be 2–80 lowercase letters, digits or hyphens");
  if (input.title.trim().length < 2 || input.title.length > 120) throw new ValidationError("Title must be 2–120 characters");
  return db.transaction(async (tx) => {
    const ids = [...new Set(input.productIds)];
    if (ids.length) {
      const rows = await tx.select().from(product).where(inArray(product.id, ids));
      if (rows.length !== ids.length || rows.some((r) => r.brandId !== input.brandId)) throw new ValidationError("Every product must belong to the collection's brand");
    }
    const [c] = await tx
      .insert(collection)
      .values({ id: newId("col"), brandId: input.brandId, slug: input.slug, title: input.title.trim(), description: input.description?.trim() ?? "" })
      .returning();
    if (ids.length) await tx.insert(collectionProduct).values(ids.map((productId, position) => ({ collectionId: c!.id, productId, position })));
    await recordAudit(tx, ctx, { action: "collection.create", entityType: "collection", entityId: c!.id, brandId: input.brandId, after: { slug: c!.slug, productIds: ids } });
    return c!;
  });
}

export async function setCollectionStatus(db: Database, ctx: AuditContext, collectionId: string, status: Collection["status"]): Promise<Collection> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(collection).where(eq(collection.id, collectionId)).for("update");
    if (!cur) throw new NotFoundError("Collection not found");
    const [c] = await tx.update(collection).set({ status }).where(eq(collection.id, collectionId)).returning();
    await recordAudit(tx, ctx, { action: "collection.status", entityType: "collection", entityId: collectionId, brandId: cur.brandId, before: { status: cur.status }, after: { status } });
    return c!;
  });
}

export async function listCollections(db: Database, scope: BrandScope, filter: { brandId?: string; status?: Collection["status"] } = {}) {
  if (scope !== "all" && scope.length === 0) return [];
  const conds = [];
  if (scope !== "all") conds.push(inArray(collection.brandId, scope));
  if (filter.brandId) conds.push(eq(collection.brandId, filter.brandId));
  if (filter.status) conds.push(eq(collection.status, filter.status));
  return db
    .select({
      collection,
      brandSlug: brand.slug,
      productCount: sql<number>`(select count(*)::int from collection_product cp join product p on p.id = cp.product_id where cp.collection_id = ${collection.id} and (${filter.status ?? null}::text is null or p.status = 'published'))`,
    })
    .from(collection)
    .innerJoin(brand, eq(brand.id, collection.brandId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(collection.updatedAt));
}

/** Published products of a published collection, in order. */
export async function getPublishedCollection(db: Database, brandId: string, slug: string) {
  const [c] = await db.select().from(collection).where(and(eq(collection.brandId, brandId), eq(collection.slug, slug), eq(collection.status, "published")));
  if (!c) return null;
  const products = await db
    .select({ product })
    .from(collectionProduct)
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(and(eq(collectionProduct.collectionId, c.id), eq(product.status, "published")))
    .orderBy(asc(collectionProduct.position));
  return { collection: c, products: products.map((p) => p.product) };
}

/** The package buyers download for an asset: its deliverable version's ZIP (see `deliverableVersion`). */
export async function deliverablePackageFor(db: DbOrTx, assetId: string) {
  const [row] = await db
    .select({ asset, version: assetVersion.version, storageKey: exportArtifact.storageKey, sha256: exportArtifact.sha256 })
    .from(asset)
    .innerJoin(assetVersion, and(eq(assetVersion.assetId, asset.id), sql`${assetVersion.version} = ${deliverableVersion(asset.id)}`))
    .innerJoin(exportArtifact, and(eq(exportArtifact.assetVersionId, assetVersion.id), eq(exportArtifact.format, "zip")))
    .where(eq(asset.id, assetId));
  return row ?? null;
}

export interface CatalogPlanItem {
  slug: string;
  title: string;
  description: string;
  kind: Product["kind"];
  assetSlugs: string[];
  prices: Record<string, number>;
}

export interface CatalogPlanResult {
  created: string[];
  existing: string[];
  /** Products not created because some assets don't exist yet (run the rig jobs first). */
  missingAssets: { slug: string; assets: string[] }[];
}

/**
 * Creates draft products (with prices) from a plan. Idempotent: products whose slug exists are left alone.
 * Nothing is published — a person reviews assets and publishes products.
 */
export async function applyCatalogPlan(db: Database, ctx: AuditContext, brandId: string, plan: CatalogPlanItem[]): Promise<CatalogPlanResult> {
  const result: CatalogPlanResult = { created: [], existing: [], missingAssets: [] };
  const assets = await db.select({ id: asset.id, slug: asset.slug, status: asset.status }).from(asset).where(eq(asset.brandId, brandId));
  const bySlug = new Map(assets.filter((a) => a.status !== "archived" && a.status !== "rejected").map((a) => [a.slug, a.id]));
  const existing = new Set((await db.select({ slug: product.slug }).from(product).where(eq(product.brandId, brandId))).map((p) => p.slug));
  for (const item of plan) {
    if (existing.has(item.slug)) {
      result.existing.push(item.slug);
      continue;
    }
    const missing = item.assetSlugs.filter((s) => !bySlug.has(s));
    if (missing.length) {
      result.missingAssets.push({ slug: item.slug, assets: missing });
      continue;
    }
    const p = await createProduct(db, ctx, { brandId, slug: item.slug, title: item.title, description: item.description, kind: item.kind, assetIds: item.assetSlugs.map((s) => bySlug.get(s)!) });
    for (const [licenseType, amountCents] of Object.entries(item.prices)) {
      await upsertPrice(db, ctx, { productId: p.id, licenseType, amountCents });
    }
    result.created.push(item.slug);
  }
  return result;
}
