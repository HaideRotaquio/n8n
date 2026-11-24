import { buildLicenseText } from "@sb/commerce";
import { getDb, schema } from "@sb/db";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireShopper } from "@/lib/store";

export const metadata: Metadata = { title: "License certificate" };

export default async function LicenseCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shopper = await requireShopper(`/account/licenses/${id}`);
  const db = getDb();
  const [row] = await db
    .select({ license: schema.license, productTitle: schema.product.title })
    .from(schema.license)
    .innerJoin(schema.product, eq(schema.product.id, schema.license.productId))
    .where(and(eq(schema.license.id, id), eq(schema.license.customerId, shopper.customer.id)));
  if (!row) notFound();
  const l = row.license;
  const text = buildLicenseText({
    brandName: shopper.brand.name,
    productTitle: row.productTitle,
    licenseType: l.licenseType,
    code: l.code,
    licenseeName: l.licenseeName,
    issuedAt: l.issuedAt,
    termsVersion: l.termsVersion,
    verifyUrl: `${shopper.origin}/licenses/verify?code=${l.code}`,
  });
  return (
    <div className="mx-auto max-w-3xl">
      {l.revokedAt && <p className="mb-4 rounded-[var(--radius)] bg-red-100 p-3 text-red-900">This license was revoked on {l.revokedAt.toISOString().slice(0, 10)}.</p>}
      <pre className="whitespace-pre-wrap rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 font-mono text-sm">{text}</pre>
      <p className="mt-3 text-sm text-[var(--color-muted-text)]">The same text is in LICENSE.txt inside every package you download.</p>
    </div>
  );
}
