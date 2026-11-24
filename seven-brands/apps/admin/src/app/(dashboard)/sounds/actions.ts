"use server";

import { prepareStoredSound } from "@sb/audio";
import { AppError, can, canAny, newId } from "@sb/core";
import { createSound, getDb, retireSound, SOUND_SOURCES, type SoundAsset } from "@sb/db";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { getStaff, getStorage, requestAuditContext } from "@/lib/server";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadSoundAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff) return { ok: false, message: "Your session has expired." };
  const brandId = String(form.get("brandId") ?? "") || null;
  // Shared sounds need a global grant; brand sounds need asset.write on that brand.
  if (brandId ? !can(staff.grants, "asset.write", brandId) : !can(staff.grants, "asset.write")) return { ok: false, message: "You can't add sounds here." };
  if (form.get("rights") !== "on") return { ok: false, message: "Confirm that we may use and sell this sound." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a WAV file." };
  if (file.size > MAX_BYTES) return { ok: false, message: "The file is larger than 10 MB." };
  const source = String(form.get("source") ?? "") as SoundAsset["source"];
  if (!(SOUND_SOURCES as readonly string[]).includes(source)) return { ok: false, message: "Choose where the sound comes from." };
  let prepared;
  try {
    prepared = prepareStoredSound(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { ok: false, message: `${(e as Error).message}. Upload a 16-bit PCM WAV of up to 10 seconds.` };
  }
  const id = newId("snd");
  const put = await getStorage().put(`sounds/${id}.wav`, prepared.wav, { contentType: "audio/wav" });
  try {
    await createSound(getDb(), await requestAuditContext(staff.user.id), {
      id,
      brandId,
      name: String(form.get("name") ?? ""),
      source,
      author: String(form.get("author") ?? ""),
      licenseRef: String(form.get("licenseRef") ?? ""),
      licenseNotes: String(form.get("licenseNotes") ?? ""),
      storageKey: put.key,
      bytes: put.bytes,
      sha256: put.sha256,
      durationMs: prepared.durationMs,
      sampleRate: prepared.sampleRate,
      loudnessLufs: prepared.loudnessLufs,
      peakDbfs: prepared.peakDbfs,
    });
  } catch (e) {
    await getStorage().delete(put.key);
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
  revalidatePath("/sounds");
  return { ok: true, message: `Added (${(prepared.durationMs / 1000).toFixed(1)} s, normalized to ${prepared.loudnessLufs?.toFixed(1) ?? "—"} LUFS). Use it from an asset's page.` };
}

export async function retireSoundAction(id: string, _prev: ActionState): Promise<ActionState> {
  const staff = await getStaff();
  if (!staff || !canAny(staff.grants, "asset.write")) return { ok: false, message: "You can't retire sounds." };
  await retireSound(getDb(), await requestAuditContext(staff.user.id), id);
  revalidatePath("/sounds");
  return { ok: true, message: "Retired. Assets already using it keep working." };
}
