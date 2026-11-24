"use server";

import { AppError, can } from "@sb/core";
import { getDb, revokeLicense, schema } from "@sb/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { getStaff, requestAuditContext } from "@/lib/server";

export async function revokeLicenseAction(licenseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  const db = getDb();
  const [l] = await db.select().from(schema.license).where(eq(schema.license.id, licenseId));
  if (!staff || !l || !can(staff.grants, "license.write", l.brandId)) return { ok: false, message: "You can't revoke licenses for this brand." };
  try {
    await revokeLicense(db, await requestAuditContext(staff.user.id), { licenseId, reason: String(form.get("reason") ?? "") });
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath("/licenses");
  return { ok: true, message: "Revoked. Downloads stop and the verification page shows it as revoked." };
}
