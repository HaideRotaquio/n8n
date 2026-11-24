"use server";

import { can, ValidationError } from "@sb/core";
import { enqueueJob, getAssetDetail, getDb, reviewAsset, assignStoredSound } from "@sb/db";
import { AppError } from "@sb/core";
import { revalidatePath } from "next/cache";
import { getStaff, requestAuditContext } from "@/lib/server";

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function reviewAction(assetId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  const db = getDb();
  const detail = await getAssetDetail(db, assetId);
  if (!detail || !can(staff.grants, "asset.review", detail.asset.brandId)) return { ok: false, message: "You can't review this asset." };
  const decision = form.get("decision");
  if (decision !== "approved" && decision !== "rejected") return { ok: false, message: "Choose approve or reject." };
  const notes = String(form.get("notes") ?? "").trim();
  if (decision === "rejected" && notes.length < 3) return { ok: false, message: "Please say why it's rejected, so it can be fixed." };
  try {
    await reviewAsset(db, await requestAuditContext(staff.user.id), { assetId, decision, notes: notes || undefined });
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  revalidatePath("/quality");
  return { ok: true, message: decision === "approved" ? "Approved." : "Rejected." };
}

export async function exportAction(assetId: string, _prev: ActionState): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  const db = getDb();
  const detail = await getAssetDetail(db, assetId);
  if (!detail || !can(staff.grants, "production.run", detail.asset.brandId)) return { ok: false, message: "You can't start production jobs for this brand." };
  const job = await enqueueJob(db, await requestAuditContext(staff.user.id), { brandId: detail.asset.brandId, kind: "export", brief: { assetId } });
  revalidatePath(`/assets/${assetId}`);
  return { ok: true, message: `Export job ${job.id} queued. Files appear here when the worker finishes.` };
}

export async function assignSoundAction(assetId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  const db = getDb();
  const detail = await getAssetDetail(db, assetId);
  if (!detail || !can(staff.grants, "asset.write", detail.asset.brandId)) return { ok: false, message: "You can't edit this asset." };
  try {
    const r = await assignStoredSound(db, await requestAuditContext(staff.user.id), { assetId, cueId: String(form.get("cueId") ?? ""), soundId: String(form.get("soundId") ?? "") });
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: `Saved as version ${r.version.version} (QA ${r.qa.score}/100). It needs review and a new export.` };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}
