import { createHash } from "node:crypto";
import {
  BudgetExceededError,
  budgetFromEnv,
  providerFromEnv,
  runAiProduction,
  runCatalogCopy,
  ProviderError,
  type ProviderStatus,
} from "@sb/agents";
import type { AssetDefinition } from "@sb/asset";
import {
  getAssetDetail,
  getBrandById,
  recordAgentTask,
  recordExportArtifacts,
  saveAssetDefinition,
  sumExpenses,
  type Database,
  type ProductionJob,
  getProductDetail,
  getSounds,
  storedSoundIds,
} from "@sb/db";
import {
  ALL_FORMATS,
  buildPackage,
  exportAnimatedSvg,
  exportGif,
  exportLottie,
  exportMp4,
  exportStaticSvg,
  renderPng,
  type ExportFormat,
} from "@sb/export";
import { loadStoredSound } from "@sb/audio";
import { RIGS } from "@sb/rigs";
import type { StorageDriver } from "@sb/storage";
import { z } from "zod";

/** Errors that should not be retried (bad input, missing config, budget). */
export class PermanentJobError extends Error {
  readonly permanent = true;
}

export interface JobDeps {
  db: Database;
  storage: StorageDriver;
  /** Injected for tests; defaults to the environment. */
  ai?: ProviderStatus;
  budget?: { dailyUsd: number; monthlyUsd: number };
  now?: () => Date;
}

export const RigBrief = z.object({
  rig: z.string(),
  variants: z.array(z.string()).max(50).optional(),
  palettes: z.array(z.string()).max(10).optional(),
});
export const AiBrief = z.object({ prompt: z.string().min(3).max(2000), category: z.string().max(60).optional() });
export const ExportBrief = z.object({
  assetId: z.string(),
  formats: z.array(z.enum(ALL_FORMATS as [ExportFormat, ...ExportFormat[]])).optional(),
});

const systemCtx = (job: ProductionJob) => ({ actorUserId: job.requestedBy, userAgent: `worker:${job.kind}` });

export async function runJob(job: ProductionJob, deps: JobDeps): Promise<unknown> {
  switch (job.kind) {
    case "rig":
      return runRigJob(job, deps);
    case "ai":
      return runAiJob(job, deps);
    case "export":
      return runExportJob(job, deps);
    case "catalog":
      return runCatalogJob(job, deps);
  }
}

async function brandSlugOf(db: Database, brandId: string): Promise<string> {
  const b = await getBrandById(db, brandId);
  if (!b) throw new PermanentJobError("Brand not found");
  return b.slug;
}

async function saveAll(job: ProductionJob, deps: JobDeps, defs: AssetDefinition[]) {
  const created = [];
  let unchanged = 0;
  for (const def of defs) {
    const r = await saveAssetDefinition(deps.db, systemCtx(job), def, { productionJobId: job.id });
    if (r.created) created.push({ assetId: r.asset.id, slug: def.slug, version: r.version.version, qaScore: r.qa.score, qaPassed: r.qa.passed });
    else unchanged++;
  }
  return { created, unchanged };
}

async function runRigJob(job: ProductionJob, deps: JobDeps) {
  const brief = RigBrief.safeParse(job.brief);
  if (!brief.success) throw new PermanentJobError("Invalid rig brief");
  const rig = RIGS[brief.data.rig];
  if (!rig) throw new PermanentJobError(`Unknown rig "${brief.data.rig}"`);
  if (rig.brand !== (await brandSlugOf(deps.db, job.brandId))) throw new PermanentJobError("Rig belongs to a different brand");
  const variants = brief.data.variants?.length ? brief.data.variants : rig.variants;
  const palettes = brief.data.palettes?.length ? brief.data.palettes : [rig.palettes[0]!];
  for (const v of variants) if (!rig.variants.includes(v)) throw new PermanentJobError(`Unknown variant "${v}"`);
  for (const p of palettes) if (!rig.palettes.includes(p)) throw new PermanentJobError(`Unknown palette "${p}"`);
  const defs = variants.flatMap((v) => palettes.map((p) => rig.build(v, p)));
  return { rig: rig.id, costUsd: 0, ...(await saveAll(job, deps, defs)) };
}

/** Throws BudgetExceededError once today's or this month's AI spend reaches the cap. */
function budgetChecker(deps: JobDeps, budget: { dailyUsd: number; monthlyUsd: number }, now: () => Date) {
  return async () => {
    const n = now();
    const day = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const month = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
    const [spentToday, spentMonth] = await Promise.all([sumExpenses(deps.db, { since: day, category: "ai" }), sumExpenses(deps.db, { since: month, category: "ai" })]);
    if (spentToday >= budget.dailyUsd) throw new BudgetExceededError(`Daily AI budget of $${budget.dailyUsd} reached ($${spentToday.toFixed(2)} spent)`);
    if (spentMonth >= budget.monthlyUsd) throw new BudgetExceededError(`Monthly AI budget of $${budget.monthlyUsd} reached ($${spentMonth.toFixed(2)} spent)`);
  };
}

export const CatalogBrief = z.object({ productId: z.string() });

/** Catalog writer: suggests title, description, tags and alt text. Stored as the job result; a person applies it. */
async function runCatalogJob(job: ProductionJob, deps: JobDeps) {
  const brief = CatalogBrief.safeParse(job.brief);
  if (!brief.success) throw new PermanentJobError("Invalid catalog brief");
  const ai = deps.ai ?? providerFromEnv();
  if (!ai.configured) throw new PermanentJobError(ai.reason);
  const detail = await getProductDetail(deps.db, brief.data.productId);
  if (!detail || detail.product.brandId !== job.brandId) throw new PermanentJobError("Product not found for this brand");
  try {
    const suggestion = await runCatalogCopy(
      detail.brand.config,
      {
        kind: detail.product.kind,
        currentTitle: detail.product.title,
        formats: ALL_FORMATS.join(", "),
        assets: detail.assets.map((a) => ({ name: a.asset.name, label: a.definition.a11y.label, category: a.definition.category ?? null, tags: a.definition.tags, durationMs: a.definition.timeline.duration, sounds: a.definition.sounds.length })),
      },
      {
        provider: ai.provider,
        onAgentCall: async (rec) => {
          await recordAgentTask(deps.db, { productionJobId: job.id, brandId: job.brandId, ...rec });
        },
        checkBudget: budgetChecker(deps, deps.budget ?? budgetFromEnv(), deps.now ?? (() => new Date())),
      },
    );
    return { provider: ai.label, productId: detail.product.id, suggestion };
  } catch (err) {
    if (err instanceof BudgetExceededError) throw new PermanentJobError(err.message);
    if (err instanceof ProviderError && !err.retryable) throw new PermanentJobError(err.message);
    throw err;
  }
}

async function runAiJob(job: ProductionJob, deps: JobDeps) {
  const brief = AiBrief.safeParse(job.brief);
  if (!brief.success) throw new PermanentJobError("Invalid AI brief");
  const ai = deps.ai ?? providerFromEnv();
  if (!ai.configured) throw new PermanentJobError(ai.reason);
  const budget = deps.budget ?? budgetFromEnv();
  const now = deps.now ?? (() => new Date());
  const b = await getBrandById(deps.db, job.brandId);
  if (!b) throw new PermanentJobError("Brand not found");

  try {
    const result = await runAiProduction(b.config, brief.data, {
      provider: ai.provider,
      onAgentCall: async (rec) => {
        await recordAgentTask(deps.db, { productionJobId: job.id, brandId: job.brandId, ...rec });
      },
      checkBudget: budgetChecker(deps, budget, now),
    });
    const saved = await saveAll(job, deps, [result.definition]);
    return { provider: ai.label, concept: result.concept.name, importWarnings: result.importWarnings, ...saved };
  } catch (err) {
    if (err instanceof BudgetExceededError) throw new PermanentJobError(err.message);
    if (err instanceof ProviderError && !err.retryable) throw new PermanentJobError(err.message);
    throw err;
  }
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const enc = (s: string) => new TextEncoder().encode(s);

async function runExportJob(job: ProductionJob, deps: JobDeps) {
  const brief = ExportBrief.safeParse(job.brief);
  if (!brief.success) throw new PermanentJobError("Invalid export brief");
  const detail = await getAssetDetail(deps.db, brief.data.assetId);
  if (!detail || detail.asset.brandId !== job.brandId) throw new PermanentJobError("Asset not found for this brand");
  const ad = detail.definition;
  const base = `brands/${detail.brand.slug}/assets/${detail.asset.id}/v${detail.current.version}`;

  // Individual preview/delivery files plus the complete package.
  // Stored sounds: every `snd_…` cue must point at a library sound with a license record.
  const stored: Record<string, Float32Array> = {};
  const ids = storedSoundIds(ad);
  const sounds = await getSounds(deps.db, ids);
  for (const id of ids) {
    const snd = sounds.find((x) => x.id === id);
    if (!snd) throw new PermanentJobError(`Asset uses sound ${id}, which is not in the sound library`);
    const bytes = await deps.storage.get(snd.storageKey);
    if (!bytes) throw new PermanentJobError(`Sound file for ${snd.name} (${id}) is missing from storage`);
    stored[id] = loadStoredSound(bytes);
  }
  // Without a format list, every preview file is produced. With one, only those (the package is always built).
  const want = (f: string) => !brief.data.formats || (brief.data.formats as string[]).includes(f);
  const files: { format: string; name: string; data: Uint8Array; contentType: string }[] = [];
  if (want("svg")) files.push({ format: "svg", name: `${ad.slug}.svg`, data: enc(exportStaticSvg(ad)), contentType: "image/svg+xml" });
  if (want("svg-animated")) files.push({ format: "svg-animated", name: `${ad.slug}-animated.svg`, data: enc(exportAnimatedSvg(ad)), contentType: "image/svg+xml" });
  if (want("png")) files.push({ format: "png", name: `${ad.slug}-512.png`, data: renderPng(ad, ad.a11y.reducedMotionFrame, { size: 512 }), contentType: "image/png" });
  if (want("gif")) files.push({ format: "gif", name: `${ad.slug}.gif`, data: await exportGif(ad), contentType: "image/gif" });
  if (want("lottie")) files.push({ format: "lottie", name: `${ad.slug}.lottie.json`, data: enc(JSON.stringify(exportLottie(ad))), contentType: "application/json" });
  if (want("mp4")) files.push({ format: "mp4", name: `${ad.slug}.mp4`, data: await exportMp4(ad, { size: 512 }, stored), contentType: "video/mp4" });
  const pkg = await buildPackage(ad, { brandName: detail.brand.name, formats: brief.data.formats, stored });
  files.push({ format: "zip", name: `${ad.slug}-v${detail.current.version}.zip`, data: pkg.zip, contentType: "application/zip" });

  const artifacts = [];
  for (const f of files) {
    const key = `${base}/${f.name}`;
    const put = await deps.storage.put(key, f.data, { contentType: f.contentType });
    artifacts.push({ format: f.format, storageKey: key, bytes: put.bytes, sha256: put.sha256 || sha(f.data) });
  }
  await recordExportArtifacts(deps.db, detail.current.id, artifacts);
  return { assetId: detail.asset.id, version: detail.current.version, files: artifacts.map((a) => ({ format: a.format, bytes: a.bytes })), packageFiles: pkg.files.length };
}
