import { NotFoundError, ValidationError } from "@sb/core";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Database, DbOrTx } from "../client";
import { brand, soundAsset, type SoundAsset } from "../schema";
import { recordAudit, type AuditContext } from "./audit";
import type { BrandScope } from "./brands";

export interface NewSound {
  id: string;
  brandId: string | null;
  name: string;
  source: SoundAsset["source"];
  author: string;
  licenseRef: string;
  licenseNotes?: string;
  storageKey: string;
  bytes: number;
  sha256: string;
  durationMs: number;
  sampleRate: number;
  loudnessLufs: number | null;
  peakDbfs: number | null;
}

/** Records a stored sound. The uploader confirms the rights; that confirmation is kept with the sound and audited. */
export async function createSound(db: Database, ctx: AuditContext, input: NewSound): Promise<SoundAsset> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new ValidationError("Name must be 2–80 characters");
  if (input.author.trim().length < 2) throw new ValidationError("Say who made the sound");
  if (input.licenseRef.trim().length < 3) throw new ValidationError("A license or source is required for every sound");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(soundAsset)
      .values({
        ...input,
        name,
        author: input.author.trim(),
        licenseRef: input.licenseRef.trim(),
        licenseNotes: input.licenseNotes?.trim() ?? "",
        loudnessLufs: input.loudnessLufs === null ? null : input.loudnessLufs.toFixed(2),
        peakDbfs: input.peakDbfs === null ? null : input.peakDbfs.toFixed(2),
        rightsConfirmedBy: ctx.actorUserId,
      })
      .returning();
    await recordAudit(tx, ctx, { action: "sound.create", entityType: "sound_asset", entityId: row!.id, brandId: input.brandId, after: { name, source: input.source, author: input.author, licenseRef: input.licenseRef } });
    return row!;
  });
}

/** Sounds usable by the given brands (their own plus shared ones). */
export async function listSounds(db: Database, scope: BrandScope, opts: { includeRetired?: boolean } = {}) {
  const brandCond = scope === "all" ? undefined : scope.length ? or(isNull(soundAsset.brandId), inArray(soundAsset.brandId, scope)) : isNull(soundAsset.brandId);
  return db
    .select({ sound: soundAsset, brandSlug: brand.slug })
    .from(soundAsset)
    .leftJoin(brand, eq(brand.id, soundAsset.brandId))
    .where(and(brandCond, opts.includeRetired ? undefined : isNull(soundAsset.retiredAt)))
    .orderBy(desc(soundAsset.createdAt))
    .limit(500);
}

export async function getSounds(db: DbOrTx, ids: string[]): Promise<SoundAsset[]> {
  if (!ids.length) return [];
  return db.select().from(soundAsset).where(inArray(soundAsset.id, ids));
}

/** Retired sounds stay available to assets that already use them, but can't be added to new ones. */
export async function retireSound(db: Database, ctx: AuditContext, id: string): Promise<SoundAsset> {
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(soundAsset).where(eq(soundAsset.id, id)).for("update");
    if (!s) throw new NotFoundError("Sound not found");
    const [u] = await tx.update(soundAsset).set({ retiredAt: new Date() }).where(eq(soundAsset.id, id)).returning();
    await recordAudit(tx, ctx, { action: "sound.retire", entityType: "sound_asset", entityId: id, brandId: s.brandId });
    return u!;
  });
}

/** Sound ids an asset definition refers to (`snd_…` cues). */
export function storedSoundIds(def: { sounds: { sound: string }[] }): string[] {
  return [...new Set(def.sounds.map((c) => c.sound).filter((s) => s.startsWith("snd_")))];
}

/**
 * Points one sound cue of an asset at a stored sound. Creates a new asset version (so it goes back to review);
 * the sound must be active and either shared or owned by the asset's brand.
 */
export async function assignStoredSound(db: Database, ctx: AuditContext, input: { assetId: string; cueId: string; soundId: string }) {
  const { getAssetDetail, saveAssetDefinition } = await import("./assets");
  const detail = await getAssetDetail(db, input.assetId);
  if (!detail) throw new NotFoundError("Asset not found");
  const [snd] = await getSounds(db, [input.soundId]);
  if (!snd || snd.retiredAt) throw new ValidationError("That sound isn't available");
  if (snd.brandId && snd.brandId !== detail.asset.brandId) throw new ValidationError("That sound belongs to another brand");
  const def = structuredClone(detail.definition);
  const cue = def.sounds.find((c) => c.id === input.cueId);
  if (!cue) throw new ValidationError(`No sound cue "${input.cueId}" in this asset`);
  cue.sound = snd.id as typeof cue.sound;
  delete cue.params;
  return saveAssetDefinition(db, ctx, def);
}
