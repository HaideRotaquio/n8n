import { isLicenseCode, LICENSE_TYPE_LABELS, normalizeLicenseCode, type LicenseType } from "@sb/core";
import { getDb, verifyLicense } from "@sb/db";
import { Button, Card, Input, Notice } from "@sb/ui";
import type { Metadata } from "next";
import { requireStore } from "@/lib/store";

export const metadata: Metadata = { title: "Verify a license" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireStore();
  const raw = (await searchParams).code ?? "";
  const code = normalizeLicenseCode(raw);
  const result = raw ? (isLicenseCode(code) ? await verifyLicense(getDb(), code) : null) : undefined;
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Verify a license</h1>
      <form className="flex gap-2" method="get">
        <label htmlFor="code" className="sr-only">
          License code
        </label>
        <Input id="code" name="code" defaultValue={raw} placeholder="MOOD-XXXX-XXXX-XXXX-XXXX" required className="font-mono" />
        <Button type="submit">Check</Button>
      </form>
      {result === null && <Notice tone="danger">That doesn&apos;t look like a license code.</Notice>}
      {result && result.status === "not_found" && <Notice tone="danger">No license with this code exists.</Notice>}
      {result && result.status !== "not_found" && (
        <Card title={result.valid ? "Valid license" : "Revoked license"}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-[var(--color-muted-text)]">Code</dt>
            <dd className="font-mono">{code}</dd>
            <dt className="text-[var(--color-muted-text)]">Brand</dt>
            <dd>{result.brand}</dd>
            <dt className="text-[var(--color-muted-text)]">Product</dt>
            <dd>{result.product}</dd>
            <dt className="text-[var(--color-muted-text)]">License</dt>
            <dd>{LICENSE_TYPE_LABELS[result.licenseType as LicenseType] ?? result.licenseType}</dd>
            <dt className="text-[var(--color-muted-text)]">Licensee</dt>
            <dd>{result.licensee}</dd>
            <dt className="text-[var(--color-muted-text)]">Issued</dt>
            <dd>{result.issuedAt?.slice(0, 10)}</dd>
          </dl>
        </Card>
      )}
    </div>
  );
}
