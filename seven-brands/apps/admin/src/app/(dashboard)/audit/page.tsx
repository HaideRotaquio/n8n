import { getDb, listAudit, listBrands } from "@sb/db";
import { EmptyState, PageHeader, Table } from "@sb/ui";
import { requirePageStaff } from "@/lib/server";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePageStaff("audit.read", "global");
  const db = getDb();
  const [entries, brands] = await Promise.all([listAudit(db, { limit: 100 }), listBrands(db)]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  return (
    <>
      <PageHeader title="Audit log" description="Append-only. The database rejects edits and deletions of these records. Showing the latest 100." />
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" />
      ) : (
        <Table head={["Time (UTC)", "Action", "Brand", "Entity", "Actor", "IP"]}>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-4 py-2">{e.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
              <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
              <td className="px-4 py-2">{e.brandId ? (brandName.get(e.brandId) ?? e.brandId) : "—"}</td>
              <td className="px-4 py-2 font-mono text-xs">{e.entityType}:{e.entityId ?? "—"}</td>
              <td className="px-4 py-2 font-mono text-xs">{e.actorUserId ?? "system"}</td>
              <td className="px-4 py-2 font-mono text-xs">{e.ipAddress ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
