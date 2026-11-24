import { can, canAny, ROLE_LABELS } from "@sb/core";
import { Badge } from "@sb/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { CURRENT_PHASE, NAV } from "@/lib/nav";
import { requirePageStaff } from "@/lib/server";
import { SignOutButton } from "./sign-out-button";

/** Every dashboard page depends on the signed-in user. */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const staff = await requirePageStaff("overview.read");
  // Show a section if the user holds its permission globally or on any brand.
  const visible = NAV.filter((n) =>
    n.scope === "global" ? can(staff.grants, n.permission) : canAny(staff.grants, n.permission),
  );
  const roles = [...new Set(staff.grants.map((g) => ROLE_LABELS[g.role]))].join(", ");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-[var(--color-border)] bg-[var(--color-surface)] md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted-text)]">Seven Brands</p>
          <p className="text-lg font-semibold">DAOS Admin</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {visible.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex shrink-0 items-center justify-between gap-2 rounded-[var(--radius)] px-3 py-2 text-sm hover:bg-[var(--color-border)]/50"
            >
              <span>{n.label}</span>
              {n.phase > CURRENT_PHASE && <Badge>P{n.phase}</Badge>}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-[var(--color-border)] px-6 py-3 text-sm">
          <span className="text-[var(--color-muted-text)]">
            {staff.user.email} · {roles}
          </span>
          <SignOutButton />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
