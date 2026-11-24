import { newId, ROLES, validateGrant, type Role, type RoleGrant } from "@sb/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import { brand, user, userRole } from "../schema";
import { recordAudit, type AuditContext } from "./audit";

export async function loadGrants(db: DbOrTx, userId: string): Promise<RoleGrant[]> {
  const rows = await db
    .select({ role: userRole.roleId, brandId: userRole.brandId })
    .from(userRole)
    .where(eq(userRole.userId, userId));
  return rows.filter((r): r is RoleGrant => (ROLES as readonly string[]).includes(r.role));
}

export async function grantRole(
  db: Database,
  ctx: AuditContext,
  input: { userId: string; role: Role; brandId: string | null },
): Promise<void> {
  validateGrant({ role: input.role, brandId: input.brandId });
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(userRole)
      .values({
        id: newId("rol"),
        userId: input.userId,
        roleId: input.role,
        brandId: input.brandId,
        grantedBy: ctx.actorUserId,
      })
      .onConflictDoNothing()
      .returning({ id: userRole.id });
    if (inserted.length) {
      await recordAudit(tx, ctx, {
        action: "team.grant",
        entityType: "user",
        entityId: input.userId,
        brandId: input.brandId,
        after: { role: input.role, brandId: input.brandId },
      });
    }
  });
}

export async function revokeRole(
  db: Database,
  ctx: AuditContext,
  input: { userId: string; role: Role; brandId: string | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(userRole)
      .where(
        and(
          eq(userRole.userId, input.userId),
          eq(userRole.roleId, input.role),
          input.brandId === null ? isNull(userRole.brandId) : eq(userRole.brandId, input.brandId),
        ),
      )
      .returning({ id: userRole.id });
    if (deleted.length) {
      await recordAudit(tx, ctx, {
        action: "team.revoke",
        entityType: "user",
        entityId: input.userId,
        brandId: input.brandId,
        before: { role: input.role, brandId: input.brandId },
      });
    }
  });
}

export interface StaffMember {
  userId: string;
  name: string;
  email: string;
  roles: { role: Role; brandSlug: string | null }[];
}

export async function listStaff(db: Database): Promise<StaffMember[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: userRole.roleId,
      brandSlug: brand.slug,
    })
    .from(userRole)
    .innerJoin(user, eq(user.id, userRole.userId))
    .leftJoin(brand, eq(brand.id, userRole.brandId))
    .orderBy(asc(user.email));
  const byUser = new Map<string, StaffMember>();
  for (const r of rows) {
    const m = byUser.get(r.userId) ?? { userId: r.userId, name: r.name, email: r.email, roles: [] };
    m.roles.push({ role: r.role as Role, brandSlug: r.brandSlug });
    byUser.set(r.userId, m);
  }
  return [...byUser.values()];
}
