import {
  applyBrandPatch,
  BrandStatus,
  NotFoundError,
  ValidationError,
  type BrandConfigPatch,
} from "@sb/core";
import { asc, eq, inArray } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import { brand, brandDomain, type Brand } from "../schema";
import { recordAudit, type AuditContext } from "./audit";

/** `"all"` or an explicit list of brand ids the caller may see. */
export type BrandScope = "all" | string[];

export async function listBrands(db: Database, scope: BrandScope = "all"): Promise<Brand[]> {
  if (scope !== "all" && scope.length === 0) return [];
  return db.query.brand.findMany({
    where: scope === "all" ? undefined : inArray(brand.id, scope),
    orderBy: [asc(brand.launchPhase), asc(brand.slug)],
  });
}

export async function getBrandBySlug(db: DbOrTx, slug: string): Promise<Brand | undefined> {
  const [row] = await db.select().from(brand).where(eq(brand.slug, slug)).limit(1);
  return row;
}

export async function requireBrandBySlug(db: DbOrTx, slug: string): Promise<Brand> {
  const row = await getBrandBySlug(db, slug);
  if (!row) throw new NotFoundError(`Brand "${slug}" not found`);
  return row;
}

/** Resolves the brand that serves a request host (port and case are ignored). */
export async function resolveBrandByHost(db: Database, host: string): Promise<Brand | undefined> {
  const hostname = host.toLowerCase().replace(/:\d+$/, "");
  const [row] = await db
    .select({ brand })
    .from(brandDomain)
    .innerJoin(brand, eq(brand.id, brandDomain.brandId))
    .where(eq(brandDomain.hostname, hostname))
    .limit(1);
  return row?.brand;
}

/** Replaces a brand's domain rows to match its config. Fails if a host already belongs to another brand. */
export async function syncBrandDomains(db: DbOrTx, brandId: string, domains: readonly string[]): Promise<void> {
  if (domains.length) {
    const taken = await db
      .select()
      .from(brandDomain)
      .where(inArray(brandDomain.hostname, [...domains]));
    const conflict = taken.find((d) => d.brandId !== brandId);
    if (conflict) throw new ValidationError(`Domain ${conflict.hostname} is already used by another brand`);
  }
  await db.delete(brandDomain).where(eq(brandDomain.brandId, brandId));
  if (domains.length) {
    await db.insert(brandDomain).values(domains.map((hostname) => ({ hostname, brandId })));
  }
}

export async function updateBrandConfig(
  db: Database,
  ctx: AuditContext,
  slug: string,
  patch: BrandConfigPatch,
): Promise<Brand> {
  return db.transaction(async (tx) => {
    const current = await requireBrandBySlug(tx, slug);
    let nextConfig;
    try {
      nextConfig = applyBrandPatch(current.config, patch);
    } catch (err) {
      throw new ValidationError("Invalid brand settings", (err as { issues?: unknown[] }).issues ?? []);
    }
    const [updated] = await tx
      .update(brand)
      .set({ config: nextConfig, name: nextConfig.name })
      .where(eq(brand.id, current.id))
      .returning();
    await syncBrandDomains(tx, current.id, nextConfig.domains);
    await recordAudit(tx, ctx, {
      action: "brand.update",
      entityType: "brand",
      entityId: current.id,
      brandId: current.id,
      before: current.config,
      after: nextConfig,
    });
    return updated!;
  });
}

export async function setBrandStatus(
  db: Database,
  ctx: AuditContext,
  slug: string,
  status: BrandStatus,
): Promise<Brand> {
  const parsed = BrandStatus.parse(status);
  return db.transaction(async (tx) => {
    const current = await requireBrandBySlug(tx, slug);
    const [updated] = await tx.update(brand).set({ status: parsed }).where(eq(brand.id, current.id)).returning();
    await recordAudit(tx, ctx, {
      action: "brand.status",
      entityType: "brand",
      entityId: current.id,
      brandId: current.id,
      before: { status: current.status },
      after: { status: parsed },
    });
    return updated!;
  });
}
