"use server";

import { LICENSE_TYPE_LABELS, type LicenseType, AppError } from "@sb/core";
import { attachProviderCheckout, claimFreeProduct, createCheckoutSession, getDb, getPublishedProduct, markCheckoutFailed } from "@sb/db";
import { redirect } from "next/navigation";
import { getCommerce, requireShopper } from "@/lib/store";

export interface BuyState {
  error: string | null;
}

/** Prices come from our database at this moment; the provider only ever sees the amount we send. */
export async function startCheckout(_prev: BuyState, form: FormData): Promise<BuyState> {
  const slug = String(form.get("slug") ?? "");
  const shopper = await requireShopper(`/products/${slug}`);
  const [licenseType, currency] = String(form.get("license") ?? "").split(":");
  if (!licenseType || !currency) return { error: "Choose a license." };
  const db = getDb();

  // Free licenses skip checkout entirely.
  const detail = await getPublishedProduct(db, shopper.brand.id, slug);
  const price = detail?.prices.find((p) => p.licenseType === licenseType && p.currency === currency);
  if (price?.amountCents === 0) {
    try {
      await claimFreeProduct(db, { brandId: shopper.brand.id, customerId: shopper.customer.id, productSlug: slug, licenseType });
    } catch (err) {
      if (err instanceof AppError) return { error: err.message };
      throw err;
    }
    redirect("/account?claimed=1");
  }

  const provider = getCommerce().active;
  if (!provider) return { error: "Checkout is not available right now." };
  let url: string;
  let sessionId: string | null = null;
  try {
    const { session, productTitle } = await createCheckoutSession(db, {
      brandId: shopper.brand.id,
      customerId: shopper.customer.id,
      productSlug: slug,
      licenseType,
      currency,
      provider: provider.name,
      testMode: provider.testMode,
    });
    sessionId = session.id;
    const res = await provider.createCheckout({
      sessionId: session.id,
      brandName: shopper.brand.name,
      productTitle,
      licenseLabel: LICENSE_TYPE_LABELS[licenseType as LicenseType] ?? licenseType,
      amountCents: session.amountCents,
      currency: session.currency,
      email: shopper.user.email,
      name: shopper.user.name,
      successUrl: `${shopper.origin}/account?purchased=${session.id}`,
      storefrontOrigin: shopper.origin,
      expiresAt: session.expiresAt,
    });
    await attachProviderCheckout(db, session.id, res.providerCheckoutId, res.url);
    url = res.url;
  } catch (err) {
    if (sessionId) await markCheckoutFailed(db, sessionId);
    if (err instanceof AppError) return { error: err.message };
    console.error("checkout.failed", err);
    return { error: "We couldn't open the checkout. Please try again in a minute." };
  }
  redirect(url);
}
