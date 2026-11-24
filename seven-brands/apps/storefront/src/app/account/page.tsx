import { LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { getCheckoutSession, getCustomerLibrary, getDb, listCustomerOrders } from "@sb/db";
import { Badge, Card, EmptyState, Notice } from "@sb/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney, requireShopper } from "@/lib/store";

export const metadata: Metadata = { title: "Your library" };

const ERRORS: Record<string, string> = {
  not_entitled: "You don't have access to that item.",
  not_in_product: "That file isn't part of your purchase.",
  not_ready: "That file is being prepared. Try again in a few minutes.",
  rate_limited: "Download limit reached. Please try again in an hour, or contact support.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ purchased?: string; claimed?: string; error?: string }> }) {
  const shopper = await requireShopper("/account");
  const sp = await searchParams;
  const db = getDb();
  const [library, orders] = await Promise.all([getCustomerLibrary(db, shopper.customer.id), listCustomerOrders(db, shopper.customer.id)]);
  // Look up asset names for download buttons.
  const assetIds = [...new Set(library.flatMap((l) => l.assetIds))];
  const { listAssetNames } = await import("@/lib/assets");
  const names = await listAssetNames(assetIds);

  let purchaseNotice: string | null = null;
  if (sp.purchased) {
    const s = await getCheckoutSession(db, sp.purchased);
    const mine = s && s.customerId === shopper.customer.id;
    purchaseNotice =
      mine && s.status === "completed"
        ? "Thank you! Your purchase is ready below."
        : "Thank you! We're confirming your payment — your purchase appears here within a minute. Refresh to check.";
  }

  if (sp.claimed) purchaseNotice = "It's yours! Your free download and license are below.";
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Your library</h1>
        <p className="text-sm text-[var(--color-muted-text)]">Signed in as {shopper.user.email}</p>
      </div>
      {purchaseNotice && <Notice tone="success">{purchaseNotice}</Notice>}
      {sp.error && ERRORS[sp.error] && <Notice tone="danger">{ERRORS[sp.error]}</Notice>}

      {library.length === 0 ? (
        <EmptyState title="Nothing here yet">
          <Link href="/" className="underline">
            Browse the catalog
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-4" aria-label="Purchases">
          {library.map((item) => (
            <li key={item.entitlement.id}>
              <Card
                title={item.product.title}
                actions={item.license ? <Badge tone="success">{LICENSE_TYPE_LABELS[item.license.licenseType as LicenseType] ?? item.license.licenseType} license</Badge> : <Badge>Granted by staff</Badge>}
              >
                {item.license && (
                  <p className="mb-3 text-sm">
                    License code <code className="font-mono">{item.license.code}</code> ·{" "}
                    <Link href={`/account/licenses/${item.license.id}`} className="underline">
                      View certificate
                    </Link>
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {item.assetIds.map((assetId) => (
                    <li key={assetId}>
                      <form method="post" action="/api/downloads">
                        <input type="hidden" name="entitlementId" value={item.entitlement.id} />
                        <input type="hidden" name="assetId" value={assetId} />
                        <button type="submit" className="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-border)]/40">
                          Download {names.get(assetId) ?? "file"} (ZIP)
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card title="Orders">
        {orders.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-text)]">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {orders.map(({ order, items }) => (
              <li key={order.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {order.paidAt.toISOString().slice(0, 10)} · {items.map((i) => i.titleSnapshot).join(", ")}
                  {order.testMode && " · test"}
                </span>
                <span>
                  {formatMoney(order.totalCents, order.currency)}
                  {order.status !== "paid" && ` · ${order.status.replace("_", " ")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-[var(--color-muted-text)]">
          Receipts and invoices come from our payment reseller by email. For refunds, reply to your receipt.{" "}
          <a href="/account/data" className="underline">
            Download all your data (JSON)
          </a>
        </p>
      </Card>
    </div>
  );
}
