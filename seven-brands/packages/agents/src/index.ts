import { AnthropicProvider, FixtureProvider, type ModelProvider } from "./providers";
import { FIXTURE_OUTPUTS } from "./fixtures";

export * from "./providers";
export * from "./agents";
export * from "./pipeline";
export * from "./fixtures";

export type ProviderStatus =
  | { configured: true; provider: ModelProvider; label: string }
  | { configured: false; reason: string };

/**
 * Chooses the model provider from the environment:
 * - DAOS_AI_PROVIDER=fixture → recorded stand-in outputs (explicit opt-in; outputs marked "fixture")
 * - otherwise Anthropic when DAOS_ANTHROPIC_API_KEY is set
 * - otherwise not configured (AI jobs are refused with a clear message).
 */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  if (env.DAOS_AI_PROVIDER === "fixture") {
    return { configured: true, provider: new FixtureProvider(structuredClone(FIXTURE_OUTPUTS)), label: "Fixture outputs (not AI)" };
  }
  if (env.DAOS_ANTHROPIC_API_KEY) {
    const model = env.DAOS_ANTHROPIC_MODEL || "claude-opus-5-5";
    return {
      configured: true,
      provider: new AnthropicProvider({ apiKey: env.DAOS_ANTHROPIC_API_KEY, model, baseURL: env.DAOS_ANTHROPIC_BASE_URL || undefined }),
      label: `Anthropic · ${model}`,
    };
  }
  return { configured: false, reason: "No AI provider configured. Set DAOS_ANTHROPIC_API_KEY (or DAOS_AI_PROVIDER=fixture for a labelled demo)." };
}

/** Daily / monthly AI spend caps in USD (defaults: $5 / day, $50 / month). */
export function budgetFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return { dailyUsd: n(env.DAOS_AI_DAILY_BUDGET_USD, 5), monthlyUsd: n(env.DAOS_AI_MONTHLY_BUDGET_USD, 50) };
}
