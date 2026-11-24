import { handleWebhook } from "@sb/commerce";
import { getDb, type PaymentProviderName } from "@sb/db";
import { getCommerce } from "@/lib/store";

export const dynamic = "force-dynamic";

const log = {
  info: (msg: string, data?: Record<string, unknown>) => console.log(JSON.stringify({ level: "info", msg, ...data })),
  error: (msg: string, data?: Record<string, unknown>) => console.error(JSON.stringify({ level: "error", msg, ...data })),
};

/**
 * Payment provider webhooks: /api/webhooks/lemonsqueezy, /api/webhooks/paddle (and /api/webhooks/test locally).
 * Brand-independent: the order's brand comes from our checkout session, so one endpoint serves every storefront.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const name = (await params).provider as PaymentProviderName;
  const provider = getCommerce().providers[name];
  if (!provider) return Response.json({ ok: false, outcome: "unknown_provider" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return Response.json({ ok: false, outcome: "too_large" }, { status: 413 });
  const res = await handleWebhook(getDb(), provider, raw, req.headers, log);
  return Response.json(res.body, { status: res.status });
}
