import { LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { getDb, getPublishedProduct } from "@sb/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetPreview } from "@/components/asset-preview";
import { formatMoney, getCommerce, getShopper, requireStore } from "@/lib/store";
import { BuyForm } from "./buy-form";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await requireStore();
  const p = await getPublishedProduct(getDb(), store.brand.id, (await params).slug);
  return p ? { title: p.product.title, description: p.product.description.slice(0, 160) } : {};
}

const LICENSE_HINT: Record<LicenseType, string> = {
  personal: "Your own non-commercial projects",
  commercial: "Your business's websites, apps, products and marketing",
  team: "Commercial use by up to 10 people",
  agency: "Work you deliver to clients",
  enterprise: "Unlimited people in one organization",
};

export default async function ProductPage({ params }: Props) {
  const store = await requireStore();
  const { slug } = await params;
  const detail = await getPublishedProduct(getDb(), store.brand.id, slug);
  if (!detail) notFound();
  const shopper = await getShopper();
  const commerce = getCommerce();
  const options = detail.prices
    .filter((p) => p.amountCents > 0)
    .map((p) => ({
      licenseType: p.licenseType,
      currency: p.currency,
      label: LICENSE_TYPE_LABELS[p.licenseType as LicenseType] ?? p.licenseType,
      hint: LICENSE_HINT[p.licenseType as LicenseType] ?? "",
      price: formatMoney(p.amountCents, p.currency),
    }));
  const [first, ...rest] = detail.assets;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        {first && <AssetPreview ad={first.definition} />}
        {rest.length > 0 && (
          <ul className="mt-3 grid grid-cols-4 gap-2" aria-label="Included assets">
            {rest.map((a) => (
              <li key={a.asset.id}>
                <AssetPreview ad={a.definition} playOn="hover" className="p-2" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h1 className="text-3xl font-bold">{detail.product.title}</h1>
        {detail.product.description && <p className="mt-3 whitespace-pre-line text-[var(--color-muted-text)]">{detail.product.description}</p>}
        <p className="mt-3 text-sm text-[var(--color-muted-text)]">
          {detail.assets.length} {detail.assets.length === 1 ? "asset" : "assets"} · SVG, animated SVG, PNG, GIF, MP4, WebM, sound (WAV), React and Web Component
        </p>
        <div className="mt-6">
          {options.length === 0 ? (
            <p>Not available for purchase right now.</p>
          ) : (
            <BuyForm slug={slug} options={options} signedIn={!!shopper} checkoutAvailable={!!commerce.active} />
          )}
        </div>
        <p className="mt-4 text-xs text-[var(--color-muted-text)]">
          Payments are handled by our reseller (Merchant of Record), who also handles sales tax/VAT. Downloads and your license certificate appear in your library right after payment.
        </p>
      </div>
    </div>
  );
}
