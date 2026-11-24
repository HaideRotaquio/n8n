import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Provider-independent model interface. Agents ask for a typed result; the provider
 * returns it with token usage and the model that actually served the request.
 */

export interface GenerateRequest<T> {
  agent: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

export interface GenerateResult<T> {
  output: T;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  costUsd: number;
}

export interface ModelProvider {
  readonly name: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// ─── Pricing (USD per million tokens; Anthropic list prices, Nov 2026 — verify periodically) ─

export const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function costFor(model: string, u: GenerateResult<unknown>["usage"]): number {
  // Unknown models are priced at the most expensive known rate so budgets stay conservative.
  const p = PRICING[model] ?? { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };
  return (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1_000_000;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /** Defaults to the public API. Deliberately NOT read from ANTHROPIC_BASE_URL (that belongs to the dev tooling). */
  baseURL?: string;
}

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  readonly model: string;

  constructor(opts: AnthropicProviderOptions) {
    if (!opts.apiKey) throw new Error("Anthropic API key is missing");
    this.client = new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL ?? "https://api.anthropic.com", maxRetries: 2 });
    this.model = opts.model ?? "claude-opus-5-5";
  }

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    // Request structured output, but parse it ourselves *after* checking stop_reason, so a refusal
    // or truncation is reported as such rather than as a JSON parse failure.
    const { parse: _sdkParse, ...format } = betaZodOutputFormat(req.schema) as unknown as Record<string, unknown>;
    let res;
    try {
      res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 16_000,
        betas: ["server-side-fallback-2026-07-01"],
        // On a safety decline the API re-runs the request on a suitable fallback model.
        fallbacks: "default",
        // Stable system prompt first so it can be cached across a batch of calls.
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.prompt }],
        output_config: { format: format as never, effort: req.effort ?? "medium" },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
        throw new ProviderError(`Anthropic temporarily unavailable: ${(err as Error).message}`, true);
      }
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new ProviderError("Anthropic rejected the API key (check DAOS_ANTHROPIC_API_KEY)", false);
      }
      if (err instanceof Anthropic.APIError) throw new ProviderError(`Anthropic API error ${err.status}: ${err.message}`, false);
      throw err;
    }
    if (res.stop_reason === "refusal") throw new ProviderError(`Request declined by the model (${res.stop_details?.category ?? "unspecified"})`, false);
    if (res.stop_reason === "max_tokens") throw new ProviderError("Response hit the token limit before finishing", true);
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ProviderError("Model output was not valid JSON", true);
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) throw new ProviderError("Model output did not match the expected schema", true);
    const u = res.usage;
    const usage = {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    };
    return { output: parsed.data, provider: this.name, model: res.model, usage, costUsd: costFor(res.model, usage) };
  }
}

// ─── Fixtures (tests, demos without a key) ───────────────────────────────────

/**
 * Returns pre-recorded outputs. Never used silently: the worker only selects it when
 * DAOS_AI_PROVIDER=fixture, and every asset it produces is marked provenance "fixture".
 */
export class FixtureProvider implements ModelProvider {
  readonly name = "fixture";
  readonly calls: { agent: string; prompt: string }[] = [];
  constructor(private outputs: Record<string, unknown[] | ((prompt: string) => unknown)>) {}

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    this.calls.push({ agent: req.agent, prompt: req.prompt });
    const src = this.outputs[req.agent];
    let raw: unknown;
    if (typeof src === "function") raw = src(req.prompt);
    else if (Array.isArray(src) && src.length) raw = src.length > 1 ? src.shift() : src[0];
    else throw new ProviderError(`No fixture recorded for agent "${req.agent}"`, false);
    const parsed = req.schema.safeParse(raw);
    if (!parsed.success) throw new ProviderError(`Fixture for "${req.agent}" does not match its schema`, false);
    return { output: parsed.data, provider: this.name, model: "fixture", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 };
  }
}
