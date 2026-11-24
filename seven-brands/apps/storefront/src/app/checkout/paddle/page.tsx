import { PaddleProvider } from "@sb/commerce";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCommerce, requireStore } from "@/lib/store";
import { PaddleCheckout } from "./paddle-checkout";

export const metadata: Metadata = { title: "Checkout" };

/**
 * Paddle opens its checkout on our own page: the transaction's checkout URL points here with `?_ptxn=txn_…`,
 * and Paddle.js opens the overlay for it. The client-side token is public by design.
 */
export default async function PaddleCheckoutPage() {
  await requireStore();
  const paddle = getCommerce().providers.paddle;
  if (!(paddle instanceof PaddleProvider)) notFound();
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-xl font-semibold">Opening secure checkout…</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-text)]">Payment is handled by Paddle, our reseller. If nothing opens, disable blockers for this page and reload.</p>
      <PaddleCheckout token={paddle.clientToken} sandbox={paddle.testMode} />
    </div>
  );
}
