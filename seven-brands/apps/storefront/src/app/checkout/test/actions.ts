"use server";

import { handleWebhook, TestPaymentProvider } from "@sb/commerce";
import { getCheckoutSession, getDb, markCheckoutFailed } from "@sb/db";
import { redirect } from "next/navigation";
import { getCommerce, requireShopper } from "@/lib/store";

async function load(form: FormData) {
  const provider = getCommerce().providers.test;
  if (!(provider instanceof TestPaymentProvider)) throw new Error("Test provider is not enabled");
  const id = String(form.get("session") ?? "");
  const shopper = await requireShopper("/account");
  const s = await getCheckoutSession(getDb(), id);
  if (!s || s.customerId !== shopper.customer.id || s.provider !== "test" || s.status !== "open") throw new Error("Checkout not found");
  return { provider, s, shopper };
}

/** Plays the provider: sends a signed "paid" webhook through the same handler real providers use. */
export async function payTestCheckout(form: FormData) {
  const { provider, s, shopper } = await load(form);
  const { body, signature } = provider.signedEvent({
    type: "paid",
    id: `tevt_${s.id}`,
    orderId: `tord_${s.id}`,
    checkoutSessionId: s.id,
    currency: s.currency,
    amountCents: s.amountCents,
    email: shopper.user.email,
    at: new Date().toISOString(),
  });
  const res = await handleWebhook(getDb(), provider, body, new Headers({ "x-test-signature": signature }));
  if (res.status !== 200) throw new Error(`Test webhook failed: ${res.body.outcome}`);
  redirect(`/account?purchased=${s.id}`);
}

export async function cancelTestCheckout(form: FormData) {
  const { s } = await load(form);
  await markCheckoutFailed(getDb(), s.id);
  redirect("/");
}
