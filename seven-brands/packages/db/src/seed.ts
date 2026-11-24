import { BRAND_DEFINITIONS } from "@sb/brands";
import { GLOBAL_ONLY_ROLES, newId, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES } from "@sb/core";
import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { brand, organization, permission, role, rolePermission } from "./schema";
import { syncBrandDomains } from "./repositories/brands";

export const PARENT_ORG_SLUG = "seven-brands";

export interface SeedResult {
  organizationId: string;
  brandsCreated: string[];
}

/**
 * Idempotent seed. Safe to run on every deploy:
 * - roles/permissions are synced to the code definitions (code is the source of truth);
 * - brands are created if missing, but existing brand settings edited by admins are never overwritten.
 */
export async function seed(db: Database): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    // Organization
    let [org] = await tx.select().from(organization).where(eq(organization.slug, PARENT_ORG_SLUG));
    if (!org) {
      [org] = await tx
        .insert(organization)
        .values({ id: newId("org"), slug: PARENT_ORG_SLUG, name: "Seven Brands" })
        .returning();
    }

    // Permissions & roles
    await tx
      .insert(permission)
      .values(PERMISSIONS.map((id) => ({ id })))
      .onConflictDoNothing();
    for (const r of ROLES) {
      await tx
        .insert(role)
        .values({ id: r, label: ROLE_LABELS[r], globalOnly: GLOBAL_ONLY_ROLES.includes(r) })
        .onConflictDoUpdate({
          target: role.id,
          set: { label: ROLE_LABELS[r], globalOnly: GLOBAL_ONLY_ROLES.includes(r) },
        });
    }
    await tx.delete(rolePermission);
    await tx
      .insert(rolePermission)
      .values(ROLES.flatMap((r) => ROLE_PERMISSIONS[r].map((p) => ({ roleId: r, permissionId: p }))));
    // Drop permissions no longer defined in code.
    await tx.execute(
      sql`DELETE FROM ${permission} WHERE ${permission.id} NOT IN (${sql.join(
        PERMISSIONS.map((p) => sql`${p}`),
        sql`, `,
      )})`,
    );

    // Brands
    const brandsCreated: string[] = [];
    for (const def of Object.values(BRAND_DEFINITIONS)) {
      const existing = await tx.select({ id: brand.id }).from(brand).where(eq(brand.slug, def.config.slug));
      if (existing.length) continue;
      const id = newId("brd");
      await tx.insert(brand).values({
        id,
        organizationId: org!.id,
        slug: def.config.slug,
        name: def.config.name,
        status: def.initialStatus,
        launchPhase: def.launchPhase,
        config: def.config,
      });
      await syncBrandDomains(tx, id, def.config.domains);
      brandsCreated.push(def.config.slug);
    }

    return { organizationId: org!.id, brandsCreated };
  });
}
