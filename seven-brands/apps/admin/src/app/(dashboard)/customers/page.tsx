import { brandsWith } from "@sb/core";
import { getDb, listCustomers } from "@sb/db";
import { Button, Card, EmptyState, Input, PageHeader, Table } from "@sb/ui";
import { money } from "@/lib/money";
import { requirePageStaff } from "@/lib/server";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requirePageStaff("customer.read");
  const q = (await searchParams).q?.trim();
  const rows = await listCustomers(getDb(), brandsWith(staff.grants, "customer.read"), { q });
  return (
    <>
      <PageHeader title="Customers" description="One record per person per brand: a customer of Moodicons is a separate relationship from SonicGlyphs. Customers can download all their data from their account page." />
      <form className="mb-4 flex max-w-md gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="Search by email" aria-label="Search by email" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState title="No customers yet" /> : (
          <Table head={["Email", "Name", "Brand", "Since", "Orders", "Spent (live, net)", "Marketing"]}>
            {rows.map((r) => (
              <tr key={r.customer.id}>
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.brandSlug}</td>
                <td className="px-4 py-2 text-xs">{r.customer.createdAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2">{r.orders}</td>
                <td className="px-4 py-2">{money(r.spentCents)}</td>
                <td className="px-4 py-2">{r.customer.marketingConsent ? "opted in" : "no"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
