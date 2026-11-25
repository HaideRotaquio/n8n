import { AssetDefinition, runQa, walkLayers, type Easing, type Layer, type QaResult } from "@sb/asset";
import type { BrandConfig } from "@sb/core";
import { importSvg } from "@sb/svg-engine";
import {
  animatorPrompt,
  CatalogCopySchema,
  catalogWriterPrompt,
  ConceptSchema,
  type CatalogCopy,
  creativeDirectorPrompt,
  MotionPlanSchema,
  svgArtistPrompt,
  SvgDraftSchema,
  type Concept,
  type MotionPlan,
} from "./agents";
import { ProviderError, type GenerateRequest, type GenerateResult, type ModelProvider } from "./providers";

/**
 * AI production pipeline: brief → concept → SVG → import/sanitize → motion plan → Asset Definition → QA.
 * One repair round each for SVG import errors and QA errors. The pipeline never writes to the
 * database; the caller (worker) records each agent call via `onAgentCall` and stores the result.
 */

export interface AiBrief {
  prompt: string;
  category?: string;
}

export interface AgentCallRecord {
  agent: string;
  provider: string;
  model: string;
  status: "succeeded" | "failed";
  input: unknown;
  output?: unknown;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface PipelineDeps {
  provider: ModelProvider;
  /** Called after every model call (success or failure) so costs are always recorded. */
  onAgentCall: (rec: AgentCallRecord) => Promise<void>;
  /** Throws BudgetExceededError when spending another call is not allowed. */
  checkBudget: () => Promise<void>;
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export interface PipelineResult {
  definition: AssetDefinition;
  qa: QaResult;
  concept: Concept;
  importWarnings: string[];
}

async function call<T>(deps: PipelineDeps, req: GenerateRequest<T>): Promise<T> {
  await deps.checkBudget();
  const started = Date.now();
  let res: GenerateResult<T>;
  try {
    res = await deps.provider.generate(req);
  } catch (err) {
    await deps.onAgentCall({
      agent: req.agent,
      provider: deps.provider.name,
      model: "unknown",
      status: "failed",
      input: { prompt: req.prompt.slice(0, 4000) },
      error: (err as Error).message,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - started,
    });
    throw err;
  }
  await deps.onAgentCall({
    agent: req.agent,
    provider: res.provider,
    model: res.model,
    status: "succeeded",
    input: { prompt: req.prompt.slice(0, 4000) },
    output: res.output,
    inputTokens: res.usage.inputTokens + res.usage.cacheReadTokens + res.usage.cacheWriteTokens,
    outputTokens: res.usage.outputTokens,
    costUsd: res.costUsd,
    durationMs: Date.now() - started,
  });
  return res.output;
}

const EASE_MAP: Record<string, Easing> = {
  linear: "linear",
  easeIn: "easeIn",
  easeOut: "easeOut",
  easeInOut: "easeInOut",
  springSoft: { spring: { stiffness: 260, damping: 16, mass: 1 } },
  springSnappy: { spring: { stiffness: 520, damping: 26, mass: 1 } },
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "asset";
const idify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^[^a-z]+/, "").slice(0, 40);

function layerSummary(layers: Layer[]): string {
  return [...walkLayers(layers)].map((l) => `${l.id} (${l.kind === "group" ? `group of ${l.children.length}` : l.shape.type})`).join(", ");
}

/** Applies a motion plan's per-track origins to the layers (first origin wins). */
function applyOrigins(layers: Layer[], plan: MotionPlan): Layer[] {
  const origins = new Map<string, [number, number]>();
  for (const t of plan.tracks) if (t.origin.length === 2 && !origins.has(t.target)) origins.set(t.target, [t.origin[0]!, t.origin[1]!]);
  const walk = (ls: Layer[]): Layer[] =>
    ls.map((l) => {
      const o = origins.get(l.id);
      const next = o && !l.origin ? { ...l, origin: o } : l;
      return next.kind === "group" ? { ...next, children: walk(next.children) } : next;
    });
  return walk(layers);
}

export function assembleDefinition(brandSlug: string, concept: Concept, imported: { viewBox: [number, number, number, number]; layers: Layer[]; tokens: Record<string, string> }, plan: MotionPlan, provenance: "ai-assisted" | "fixture"): unknown {
  const duration = Math.round(Math.min(Math.max(plan.durationMs, 300), 10_000));
  const clampAt = (t: number) => Math.round(Math.min(Math.max(t, 0), duration));
  const markers = plan.markers.map((m) => ({ id: idify(m.id) || "m", at: clampAt(m.at) }));
  return {
    schema: "daos.asset/1",
    brand: brandSlug,
    slug: slugify(concept.slug || concept.name),
    name: concept.name.slice(0, 80),
    viewBox: imported.viewBox,
    tokens: imported.tokens,
    layers: applyOrigins(imported.layers, plan),
    timeline: {
      duration,
      loop: true,
      markers,
      tracks: plan.tracks.map((t) => ({
        target: t.target,
        property: t.property,
        keyframes: [...t.keyframes].sort((a, b) => a.at - b.at).map((k) => ({ at: clampAt(k.at), value: k.value, ease: EASE_MAP[k.ease] ?? "linear" })),
      })),
    },
    sounds: plan.sounds.slice(0, 6).map((s, i) => ({
      id: `cue-${i + 1}`,
      sound: `synth:${s.preset}`,
      marker: idify(s.marker) || markers[0]?.id,
      gain: Math.min(Math.max(s.gain, 0.1), 1),
      params: { pitch: Math.min(Math.max(s.pitch, 0.5), 2) },
      ...(Number.isFinite(s.pan) && Math.abs(s.pan) >= 0.05 ? { pan: Math.round(Math.min(Math.max(s.pan, -1), 1) * 100) / 100 } : {}),
    })),
    interactions: [
      { on: "load", action: "play" },
      { on: "click", action: "restart" },
    ],
    a11y: { label: concept.accessibleLabel.slice(0, 200), reducedMotionFrame: clampAt(plan.stillFrameMs) },
    tags: concept.tags.map((t) => t.toLowerCase().slice(0, 40)).slice(0, 12),
    category: idify(concept.category) || undefined,
    provenance: { method: provenance, notes: `Brief-driven AI production` },
  };
}

export async function runAiProduction(brand: BrandConfig, brief: AiBrief, deps: PipelineDeps): Promise<PipelineResult> {
  const provenance = deps.provider.name === "fixture" ? "fixture" : "ai-assisted";

  const concept = await call(deps, {
    agent: "creative_director",
    system: creativeDirectorPrompt(brand),
    prompt: `Brief: ${brief.prompt}${brief.category ? `\nCategory: ${brief.category}` : ""}`,
    schema: ConceptSchema,
    effort: "medium",
    maxTokens: 8000,
  });

  // Draw, import (sanitize) — one repair round on import errors.
  let svgPrompt = `Concept:\n${JSON.stringify(concept, null, 2)}`;
  let imported = null as null | ReturnType<typeof importSvg>;
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await call(deps, { agent: "svg_artist", system: svgArtistPrompt(brand.slug), prompt: svgPrompt, schema: SvgDraftSchema, effort: "high", maxTokens: 16_000 });
    imported = importSvg(draft.svg);
    if (imported.ok) break;
    svgPrompt += `\n\nYour previous SVG was rejected by the importer:\n${imported.errors.map((e) => `- ${e.message}`).join("\n")}\nFix these problems and return the complete SVG again.`;
  }
  if (!imported?.ok || !imported.viewBox) {
    throw new ProviderError(`SVG rejected after repair: ${imported?.errors.map((e) => e.message).join("; ")}`, false);
  }

  // Animate — one repair round on QA errors.
  const ids = new Set([...walkLayers(imported.layers)].map((l) => l.id));
  let motionPrompt = `Icon: ${concept.name}\nMotion idea: ${concept.motion}\nSound idea: ${concept.sound}\nLayers you may animate: ${layerSummary(imported.layers)}`;
  let definition: AssetDefinition | null = null;
  let qa: QaResult | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const plan = await call(deps, { agent: "animator", system: animatorPrompt(brand), prompt: motionPrompt, schema: MotionPlanSchema, effort: "medium", maxTokens: 8000 });
    plan.tracks = plan.tracks.filter((t) => ids.has(t.target));
    const candidate = assembleDefinition(brand.slug, concept, { viewBox: imported.viewBox, layers: imported.layers, tokens: imported.tokens }, plan, provenance);
    qa = runQa(candidate);
    if (qa.errors.length === 0) {
      definition = AssetDefinition.parse(candidate);
      break;
    }
    motionPrompt += `\n\nQA rejected your motion plan:\n${qa.errors.map((e) => `- ${e.message}`).join("\n")}\nReturn a corrected plan.`;
  }
  if (!definition || !qa) throw new ProviderError(`Motion plan failed QA: ${qa?.errors.map((e) => e.message).join("; ")}`, false);

  return { definition, qa, concept, importWarnings: imported.warnings.map((w) => w.message) };
}


export interface CatalogFacts {
  kind: "single" | "pack";
  currentTitle: string;
  assets: { name: string; label: string; category: string | null; tags: string[]; durationMs: number; sounds: number }[];
  formats: string;
}

/** One catalog-writer call. The result is only a suggestion: a person applies it in the admin. */
export async function runCatalogCopy(brand: BrandConfig, facts: CatalogFacts, deps: PipelineDeps): Promise<CatalogCopy> {
  const lines = facts.assets.slice(0, 30).map((a) => `- ${a.name}: ${a.label}; category ${a.category ?? "none"}; tags ${a.tags.join(", ")}; ${(a.durationMs / 1000).toFixed(1)} s loop; ${a.sounds} sound cue(s)`);
  const copy = await call(deps, {
    agent: "catalog_writer",
    system: catalogWriterPrompt(brand),
    prompt: `Product type: ${facts.kind} (${facts.assets.length} icons)\nCurrent title: ${facts.currentTitle}\nFormats: ${facts.formats}\nAssets:\n${lines.join("\n")}${facts.assets.length > 30 ? `\n…and ${facts.assets.length - 30} more` : ""}`,
    schema: CatalogCopySchema,
    effort: "low",
    maxTokens: 2000,
  });
  return {
    title: copy.title.trim().slice(0, 120),
    description: copy.description.trim().slice(0, 600),
    tags: [...new Set(copy.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12),
    altText: copy.altText.trim().slice(0, 200),
  };
}
