import { LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { getDb, getPublishedProduct } from "@sb/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { designFor } from "@/designs";
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

const FORMATS = "SVG, animated SVG, PNG, GIF, MP4, WebM, Lottie, WAV, React, Web Component";

export default async function ProductPage({ params }: Props) {
  const store = await requireStore();
  const { slug } = await params;
  const detail = await getPublishedProduct(getDb(), store.brand.id, slug);
  if (!detail || detail.assets.length === 0) notFound();
  const shopper = await getShopper();
  const options = detail.prices.map((p) => ({
    licenseType: p.licenseType,
    currency: p.currency,
    label: LICENSE_TYPE_LABELS[p.licenseType as LicenseType] ?? p.licenseType,
    hint: LICENSE_HINT[p.licenseType as LicenseType] ?? "",
    price: p.amountCents === 0 ? "Free" : formatMoney(p.amountCents, p.currency),
    free: p.amountCents === 0,
  }));
  const first = detail.assets[0]!.definition;
  const cues = first.sounds.length;
  const categories = new Map(store.brand.config.catalog.categories.map((c) => [c.slug, c.label]));
  const { Product } = designFor(store.brand);
  const designs = new Set(detail.assets.map((a) => a.asset.name.replace(/\s*\([^)]*\)$/, ""))).size;
  return (
    <Product
      title={detail.product.title}
      description={detail.product.description}
      categoryLabel={first.category ? (categories.get(first.category) ?? first.category) : null}
      assets={detail.assets.map((a) => ({ id: a.asset.id, name: a.asset.name, definition: a.definition }))}
      customizer={store.brand.config.features.customizer}
      facts={[
        { label: "Files", value: designs > 1 ? `${detail.assets.length} icons (${designs} designs)` : `${detail.assets.length} ${detail.assets.length === 1 ? "icon" : "color styles"}` },
        { label: "Loop", value: `${(first.timeline.duration / 1000).toFixed(1)} s` },
        { label: "Sound", value: cues ? `${cues} synced cue${cues === 1 ? "" : "s"}` : "none" },
        { label: "Formats", value: FORMATS },
      ]}
      buy={<BuyForm slug={slug} options={options} signedIn={!!shopper} checkoutAvailable={!!getCommerce().active} />}
    />
  );
}
