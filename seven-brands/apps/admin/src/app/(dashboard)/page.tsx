import { BRAND_STATUSES, brandsWith, can } from "@sb/core";
import { getDb, listAudit, listBrands, listStaff } from "@sb/db";
import { Badge, Card, PageHeader, Stat } from "@sb/ui";
import Link from "next/link";
import { requirePageStaff } from "@/lib/server";
import { StatusBadge } from "./brands/status-badge";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const staff = await requirePageStaff("overview.read");
  const db = getDb();
  const brands = await listBrands(db, brandsWith(staff.grants, "brand.read"));
  const counts = Object.fromEntries(BRAND_STATUSES.map((s) => [s, brands.filter((b) => b.status === s).length]));
  const canTeam = can(staff.grants, "team.read");
  const canAudit = can(staff.grants, "audit.read");
  const [staffList, audit] = await Promise.all([
    canTeam ? listStaff(db) : Promise.resolve(null),
    canAudit ? listAudit(db, { limit: 8 }) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Company-wide status. Sales, production and cost figures appear here once those modules are built (Phases 2–3)."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Brands" value={brands.length} hint={`${counts.in_development ?? 0} in development · ${counts.live ?? 0} live`} />
        <Stat label="Planned brands" value={counts.planned ?? 0} />
        {staffList && <Stat label="Staff accounts" value={staffList.length} />}
        <Stat label="Live storefronts" value={counts.live ?? 0} hint="Requires Phase 4" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Brands" actions={<Link href="/brands" className="text-sm underline">Manage</Link>}>
          <ul className="divide-y divide-[var(--color-border)]">
            {brands.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/brands/${b.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                  <span className="h-3 w-3 rounded-full" style={{ background: b.config.theme.tokens.primary }} aria-hidden />
                  {b.name}
                </Link>
                <span className="flex items-center gap-2">
                  <Badge>Phase {b.launchPhase}</Badge>
                  <StatusBadge status={b.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {audit && (
          <Card title="Recent activity" actions={<Link href="/audit" className="text-sm underline">Audit log</Link>}>
            {audit.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-text)]">No administrative actions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 py-2">
                    <span className="font-mono text-xs">{a.action}</span>
                    <time className="text-[var(--color-muted-text)]" dateTime={a.createdAt.toISOString()}>
                      {a.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
