import type { PaymentProviderName } from "@sb/db";
import { LemonSqueezyProvider } from "./lemonsqueezy";
import { PaddleProvider } from "./paddle";
import { TestPaymentProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

/**
 * Providers are configured from environment variables (see .env.example).
 *
 * - `COMMERCE_PROVIDER` picks the provider new checkouts use: lemonsqueezy | paddle | test.
 * - Every provider with complete settings is also loaded for webhooks, so refunds for older orders
 *   still verify after switching providers.
 * - Live (non-test) credentials are refused unless `COMMERCE_LIVE_PAYMENTS=enabled` — the owner sets this
 *   only after the validation gate is approved.
 */

type Env = Record<string, string | undefined>;

export interface CommerceConfig {
  /** Provider for new checkouts, or null when sales are switched off. */
  active: PaymentProvider | null;
  /** All configured providers, by name (for webhooks and refunds). */
  providers: Partial<Record<PaymentProviderName, PaymentProvider>>;
  /** Why checkout is unavailable / which settings are wrong. */
  problems: string[];
}

const flag = (v: string | undefined, dflt: boolean) => (v === undefined || v === "" ? dflt : /^(1|true|yes|on)$/i.test(v));
const list = (v: string | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

export function commerceFromEnv(env: Env = process.env): CommerceConfig {
  const providers: CommerceConfig["providers"] = {};
  const problems: string[] = [];
  const liveAllowed = env.COMMERCE_LIVE_PAYMENTS === "enabled";
  const isProductionDeploy = env.DEPLOY_ENV === "production";

  const tryLoad = (name: PaymentProviderName, present: boolean, make: () => PaymentProvider) => {
    if (!present) return;
    try {
      const p = make();
      if (!p.testMode && !liveAllowed) {
        problems.push(`${p.label}: live credentials are disabled until COMMERCE_LIVE_PAYMENTS=enabled (owner approval)`);
        return;
      }
      providers[name] = p;
    } catch (err) {
      problems.push(`${name}: ${(err as Error).message}`);
    }
  };

  tryLoad("lemonsqueezy", !!env.LEMONSQUEEZY_API_KEY, () =>
    new LemonSqueezyProvider({
      apiKey: env.LEMONSQUEEZY_API_KEY ?? "",
      storeId: env.LEMONSQUEEZY_STORE_ID ?? "",
      variantId: env.LEMONSQUEEZY_VARIANT_ID ?? "",
      webhookSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "",
      testMode: flag(env.LEMONSQUEEZY_TEST_MODE, true),
      currency: env.LEMONSQUEEZY_CURRENCY,
    }),
  );
  tryLoad("paddle", !!env.PADDLE_API_KEY, () =>
    new PaddleProvider({
      apiKey: env.PADDLE_API_KEY ?? "",
      productId: env.PADDLE_PRODUCT_ID ?? "",
      webhookSecret: env.PADDLE_WEBHOOK_SECRET ?? "",
      clientToken: env.PADDLE_CLIENT_TOKEN ?? "",
      environment: env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox",
      currencies: list(env.PADDLE_CURRENCIES),
    }),
  );
  if (env.COMMERCE_TEST_SECRET) {
    if (isProductionDeploy) problems.push("The test provider is never loaded when DEPLOY_ENV=production");
    else tryLoad("test", true, () => new TestPaymentProvider(env.COMMERCE_TEST_SECRET ?? ""));
  }

  const wanted = env.COMMERCE_PROVIDER as PaymentProviderName | undefined;
  let active: PaymentProvider | null = null;
  if (!wanted) problems.push("Checkout is off: set COMMERCE_PROVIDER to lemonsqueezy, paddle or test");
  else if (!["lemonsqueezy", "paddle", "test"].includes(wanted)) problems.push(`Unknown COMMERCE_PROVIDER "${wanted}"`);
  else if (!providers[wanted]) problems.push(`COMMERCE_PROVIDER is ${wanted}, but it isn't configured (see the settings above)`);
  else active = providers[wanted]!;
  return { active, providers, problems };
}
