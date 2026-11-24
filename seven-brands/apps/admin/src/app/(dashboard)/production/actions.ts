"use server";

import { can, NotFoundError } from "@sb/core";
import { cancelJob, enqueueJob, getBrandById, getDb } from "@sb/db";
import { RIGS } from "@sb/rigs";
import { revalidatePath } from "next/cache";
import { aiStatus, getStaff, requestAuditContext } from "@/lib/server";

export interface JobFormState {
  ok: boolean;
  message: string;
  jobId?: string;
}

export async function createJobAction(_prev: JobFormState, form: FormData): Promise<JobFormState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired. Sign in again." };
  const db = getDb();
  const brandId = String(form.get("brandId") ?? "");
  const brand = await getBrandById(db, brandId);
  if (!brand || !can(staff.grants, "production.run", brand.id)) return { ok: false, message: "You can't start jobs for that brand." };
  const kind = form.get("kind");
  const ctx = await requestAuditContext(staff.user.id);

  if (kind === "rig") {
    const rig = RIGS[String(form.get("rig") ?? "")];
    if (!rig || rig.brand !== brand.slug) return { ok: false, message: "Choose a rig that belongs to this brand." };
    const variants = form.getAll("variants").map(String).filter((v) => rig.variants.includes(v));
    const palettes = form.getAll("palettes").map(String).filter((p) => rig.palettes.includes(p));
    if (!variants.length || !palettes.length) return { ok: false, message: "Pick at least one variant and one palette." };
    const job = await enqueueJob(db, ctx, { brandId, kind: "rig", brief: { rig: rig.id, variants, palettes } });
    revalidatePath("/production");
    return { ok: true, message: `Queued ${variants.length * palettes.length} assets from ${rig.label}.`, jobId: job.id };
  }
  if (kind === "ai") {
    const status = aiStatus();
    if (!status.configured) return { ok: false, message: status.reason };
    const prompt = String(form.get("prompt") ?? "").trim();
    if (prompt.length < 3 || prompt.length > 2000) return { ok: false, message: "Describe the asset in 3–2,000 characters." };
    const category = String(form.get("category") ?? "") || undefined;
    const job = await enqueueJob(db, ctx, { brandId, kind: "ai", brief: { prompt, category } });
    revalidatePath("/production");
    return { ok: true, message: `AI job queued (${status.label}).`, jobId: job.id };
  }
  return { ok: false, message: "Unknown job type." };
}

export async function cancelJobAction(jobId: string): Promise<void> {
  const staff = await getStaff();
  if (!staff) return;
  const db = getDb();
  const { getJob } = await import("@sb/db");
  const j = await getJob(db, jobId);
  if (!j || !can(staff.grants, "production.run", j.job.brandId)) throw new NotFoundError();
  await cancelJob(db, await requestAuditContext(staff.user.id), jobId);
  revalidatePath("/production");
}
