import { brandsWith } from "@sb/core";
import { getDb, listBrands } from "@sb/db";
import { PageHeader, Swatch } from "@sb/ui";
import Link from "next/link";
import { requirePageStaff } from "@/lib/server";
import { StatusBadge } from "./status-badge";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const staff = await requirePageStaff("overview.read");
  const brands = await listBrands(getDb(), brandsWith(staff.grants, "brand.read"));
  return (
    <>
      <PageHeader title="Brands" description="Seven independent brands on one shared platform. Each has its own identity, domains and catalog." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => {
          const t = b.config.theme.tokens;
          return (
            <li key={b.id}>
              <Link
                href={`/brands/${b.slug}`}
                className="block overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] transition hover:shadow-md"
              >
                <div className="p-5" style={{ background: t.background, color: t.text, fontFamily: b.config.theme.fonts.body }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xl font-bold" style={{ fontFamily: b.config.theme.fonts.heading }}>{b.name}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1 text-sm" style={{ color: t.mutedText }}>{b.config.tagline}</p>
                  <span
                    className="mt-4 inline-block px-3 py-1 text-xs font-semibold"
                    style={{ background: t.primary, color: t.primaryText, borderRadius: b.config.theme.radius === "full" ? 9999 : 6 }}
                  >
                    {b.config.layout}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
                  {(["primary", "accent", "surface", "text"] as const).map((k) => (
                    <Swatch key={k} color={t[k]} />
                  ))}
                  <span className="ml-auto text-xs text-[var(--color-muted-text)]">Phase {b.launchPhase}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
