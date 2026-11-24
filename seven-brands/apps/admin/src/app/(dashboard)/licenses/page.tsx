import { brandsWith, can, normalizeLicenseCode } from "@sb/core";
import { getDb, listLicenses } from "@sb/db";
import { Badge, Card, EmptyState, Input, PageHeader, Table, Button } from "@sb/ui";
import { ActionForm } from "@/components/action-form";
import { requirePageStaff } from "@/lib/server";
import { revokeLicenseAction } from "./actions";

export const metadata = { title: "Licenses" };

export default async function LicensesPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const staff = await requirePageStaff("license.read");
  const raw = (await searchParams).code?.trim();
  const rows = await listLicenses(getDb(), brandsWith(staff.grants, "license.read"), { code: raw ? normalizeLicenseCode(raw) : undefined });
  return (
    <>
      <PageHeader title="Licenses" description="One license per purchased item. Codes can be checked publicly at /licenses/verify on each storefront (initials only, no contact details)." />
      <form className="mb-4 flex max-w-md gap-2" method="get">
        <Input name="code" defaultValue={raw} placeholder="Find by code" aria-label="License code" className="font-mono" />
        <Button type="submit" variant="secondary">Find</Button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState title={raw ? "No license with that code" : "No licenses issued yet"} /> : (
          <Table head={["Code", "Brand", "Product", "Type", "Customer", "Issued", "Status"]}>
            {rows.map(({ license: l, brandSlug, productTitle, email }) => (
              <tr key={l.id}>
                <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-2">{brandSlug}</td>
                <td className="px-4 py-2">{productTitle}</td>
                <td className="px-4 py-2">{l.licenseType}</td>
                <td className="px-4 py-2">{email}</td>
                <td className="px-4 py-2 text-xs">{l.issuedAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2">
                  {l.revokedAt ? (
                    <Badge tone="danger">revoked ({l.revokedReason})</Badge>
                  ) : can(staff.grants, "license.write", l.brandId) ? (
                    <ActionForm action={revokeLicenseAction.bind(null, l.id)} submit="Revoke" variant="danger" className="flex items-center gap-2" confirm="Revoke this license? The customer loses access to the files.">
                      <Input name="reason" placeholder="Reason" required aria-label="Reason" className="w-32" />
                    </ActionForm>
                  ) : (
                    <Badge tone="success">active</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
