import { ROLE_LABELS, ROLE_PERMISSIONS, ROLES } from "@sb/core";
import { getDb, listStaff } from "@sb/db";
import { Badge, Card, PageHeader, Table } from "@sb/ui";
import { requirePageStaff } from "@/lib/server";

export const metadata = { title: "Team & roles" };

export default async function TeamPage() {
  await requirePageStaff("team.read", "global");
  const staff = await listStaff(getDb());
  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Staff accounts are created with the create-owner / provisioning script. Inviting staff from this page arrives with transactional email in Phase 3."
      />
      <Table head={["Name", "Email", "Roles"]}>
        {staff.map((s) => (
          <tr key={s.userId}>
            <td className="px-4 py-2">{s.name}</td>
            <td className="px-4 py-2">{s.email}</td>
            <td className="flex flex-wrap gap-1 px-4 py-2">
              {s.roles.map((r, i) => (
                <Badge key={i} tone={r.brandSlug ? "info" : "neutral"}>
                  {ROLE_LABELS[r.role]}
                  {r.brandSlug ? ` · ${r.brandSlug}` : " · all brands"}
                </Badge>
              ))}
            </td>
          </tr>
        ))}
      </Table>
      <div className="mt-8">
        <Card title="Role reference">
          <dl className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r}>
                <dt className="font-medium">{ROLE_LABELS[r]}</dt>
                <dd className="mt-1 font-mono text-xs text-[var(--color-muted-text)]">{ROLE_PERMISSIONS[r].join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
