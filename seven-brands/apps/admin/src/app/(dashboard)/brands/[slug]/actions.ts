"use server";

import { BrandStatus, can, ThemeTokens, ValidationError, type BrandConfigPatch } from "@sb/core";
import { getDb, requireBrandBySlug, setBrandStatus, updateBrandConfig } from "@sb/db";
import { revalidatePath } from "next/cache";
import { getStaff, requestAuditContext } from "@/lib/server";

export interface FormState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function updateBrandAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  const db = getDb();
  const brand = await requireBrandBySlug(db, slug);
  if (!can(staff.grants, "brand.update", brand.id)) return { ok: false, message: "You don't have permission to edit this brand." };

  const tokens = Object.fromEntries(
    Object.keys(ThemeTokens.shape).map((k) => [k, String(form.get(`token_${k}`) ?? "").toUpperCase()]),
  );
  const patch: BrandConfigPatch = {
    name: String(form.get("name") ?? "").trim(),
    tagline: String(form.get("tagline") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    domains: lines(form.get("domains")).map((d) => d.toLowerCase()),
    audiences: lines(form.get("audiences")),
    marketingChannels: lines(form.get("marketingChannels")),
    theme: { tokens: tokens as ThemeTokens },
  };

  try {
    await updateBrandConfig(db, await requestAuditContext(staff.user.id), slug, patch);
  } catch (err) {
    if (err instanceof ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues as { path?: PropertyKey[]; message: string }[]) {
        const key = issue.path?.[0] === "theme" ? `token_${String(issue.path?.[2])}` : String(issue.path?.[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, message: err.issues.length ? "Please fix the highlighted fields." : err.message, fieldErrors };
    }
    throw err;
  }
  revalidatePath("/brands");
  revalidatePath(`/brands/${slug}`);
  return { ok: true, message: "Brand settings saved." };
}

export async function setBrandStatusAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  // Changing a brand's business status (e.g. to "live") is a company-level decision.
  if (!can(staff.grants, "brand.create")) return { ok: false, message: "Only owners and administrators can change brand status." };
  const parsed = BrandStatus.safeParse(form.get("status"));
  if (!parsed.success) return { ok: false, message: "Unknown status." };
  await setBrandStatus(getDb(), await requestAuditContext(staff.user.id), slug, parsed.data);
  revalidatePath("/brands");
  revalidatePath(`/brands/${slug}`);
  return { ok: true, message: "Status updated." };
}
