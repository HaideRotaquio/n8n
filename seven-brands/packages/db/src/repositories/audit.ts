import { newId } from "@sb/core";
import { and, desc, eq, lt } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import { auditLog } from "../schema";

export interface AuditContext {
  actorUserId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEntryInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  brandId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(db: DbOrTx, ctx: AuditContext, entry: AuditEntryInput): Promise<string> {
  const id = newId("aud");
  await db.insert(auditLog).values({
    id,
    actorUserId: ctx.actorUserId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    brandId: entry.brandId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  return id;
}

export async function listAudit(
  db: Database,
  opts: { limit?: number; brandId?: string; before?: Date } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const filters = [];
  if (opts.brandId) filters.push(eq(auditLog.brandId, opts.brandId));
  if (opts.before) filters.push(lt(auditLog.createdAt, opts.before));
  return db.query.auditLog.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
    limit,
  });
}
