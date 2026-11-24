import { TestPaymentProvider } from "@sb/commerce";
import { getCheckoutSession, getDb } from "@sb/db";
import { Button, Card, Notice } from "@sb/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney, getCommerce, requireShopper } from "@/lib/store";
import { cancelTestCheckout, payTestCheckout } from "./actions";

export const metadata: Metadata = { title: "Test checkout" };

/** Stand-in for a provider's hosted checkout, available only when the test provider is configured. */
export default async function TestCheckoutPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  if (!(getCommerce().providers.test instanceof TestPaymentProvider)) notFound();
  const id = (await searchParams).session ?? "";
  const shopper = await requireShopper(`/checkout/test?session=${encodeURIComponent(id)}`);
  const s = await getCheckoutSession(getDb(), id);
  if (!s || s.customerId !== shopper.customer.id || s.provider !== "test") notFound();
  return (
    <div className="mx-auto max-w-md">
      <Card title="Test checkout">
        <Notice>This page stands in for the payment provider. No card is charged and the order is marked as a test.</Notice>
        <p className="mt-4 text-lg font-semibold">{formatMoney(s.amountCents, s.currency)}</p>
        <p className="text-sm text-[var(--color-muted-text)]">License: {s.licenseType}</p>
        {s.status !== "open" ? (
          <p className="mt-4">This checkout is {s.status}.</p>
        ) : (
          <div className="mt-6 flex gap-2">
            <form action={payTestCheckout}>
              <input type="hidden" name="session" value={s.id} />
              <Button type="submit">Pay {formatMoney(s.amountCents, s.currency)} (test)</Button>
            </form>
            <form action={cancelTestCheckout}>
              <input type="hidden" name="session" value={s.id} />
              <Button type="submit" variant="secondary">
                Cancel
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
