import type { Metadata } from "next";
import { designFor } from "@/designs";
import { requireStore } from "@/lib/store";

export const metadata: Metadata = { title: "Refund policy" };

export default async function RefundsPage() {
  const { brand } = await requireStore();
  const { Page } = designFor(brand);
  return (
    <Page title="Refund policy" intro="Digital files can't be returned, but we want you to be happy with what you bought.">
      <div className="space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p>If a file doesn&apos;t work as described, or you bought the wrong item or license, reply to your receipt email within <strong>14 days</strong> and tell us what happened. We review every request; when we approve it, the refund goes back to your original payment method through our reseller.</p>
        <p>A full refund ends the license: the files leave your library and the license code shows as revoked. If you still need the icon, you can buy the right license afterwards.</p>
        <p>Your legal rights as a consumer in your country are not affected by this policy.</p>
      </div>
      <p className="text-sm text-[var(--color-muted-text)]">Draft policy — will be finalized before live sales.</p>
    </Page>
  );
}
