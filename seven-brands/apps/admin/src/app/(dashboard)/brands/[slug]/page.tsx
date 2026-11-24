import { BRAND_STATUSES, can, checkThemeAccessibility, themeToCssVars } from "@sb/core";
import { getBrandBySlug, getDb } from "@sb/db";
import { Badge, Card, Notice, PageHeader } from "@sb/ui";
import { forbidden, notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { requirePageStaff } from "@/lib/server";
import { STATUS_LABEL, StatusBadge } from "../status-badge";
import { BrandForm, StatusForm } from "./brand-form";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const staff = await requirePageStaff("overview.read");
  const brand = await getBrandBySlug(getDb(), slug);
  if (!brand) notFound();
  if (!can(staff.grants, "brand.read", brand.id)) forbidden();

  const c = brand.config;
  const a11y = checkThemeAccessibility(c.theme);
  const canEdit = can(staff.grants, "brand.update", brand.id);
  const canStatus = can(staff.grants, "brand.create");

  return (
    <>
      <PageHeader
        title={brand.name}
        description={c.category}
        actions={
          <div className="flex items-center gap-2">
            <Badge>Phase {brand.launchPhase}</Badge>
            <StatusBadge status={brand.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Brand settings">
          {!canEdit && <div className="mb-4"><Notice>You can view this brand but not edit it.</Notice></div>}
          <BrandForm slug={brand.slug} config={c} canEdit={canEdit} />
        </Card>

        <div className="space-y-6">
          <Card title="Theme preview">
            <div
              style={{ ...(themeToCssVars(c.theme) as CSSProperties), background: "var(--color-background)", fontFamily: "var(--font-body)" }}
              className="rounded-[var(--radius)] border border-[var(--color-border)] p-4 text-[var(--color-text)]"
            >
              <p className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{brand.name}</p>
              <p className="text-sm text-[var(--color-muted-text)]">{c.tagline}</p>
              <div className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
                Product card surface
              </div>
              <span className="mt-3 inline-block rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary-text)]">
                Add to cart
              </span>
              <span className="ml-2 inline-block h-3 w-3 rounded-full bg-[var(--color-accent)]" aria-hidden />
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted-text)]">
              Fonts shown only if installed locally; storefronts load them in Phase 4.
            </p>
            <div className="mt-3">
              {a11y.length === 0 ? (
                <Notice tone="success">Text contrast meets WCAG AA.</Notice>
              ) : (
                <Notice tone="danger">
                  Contrast problems: <ul className="list-disc pl-5">{a11y.map((p) => <li key={p}>{p}</li>)}</ul>
                </Notice>
              )}
            </div>
          </Card>

          <Card title="Business status">
            {canStatus ? (
              <StatusForm
                slug={brand.slug}
                status={brand.status}
                statuses={BRAND_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            ) : (
              <p className="text-sm text-[var(--color-muted-text)]">Only owners and administrators can change status.</p>
            )}
          </Card>

          <Card title="Fixed settings">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-[var(--color-muted-text)]">Slug</dt><dd className="font-mono">{c.slug}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Layout</dt><dd>{c.layout}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Motion personality</dt><dd>{c.theme.motionPersonality}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Licenses offered</dt><dd>{c.licenseTypes.join(", ")}</dd></div>
              <div><dt className="text-[var(--color-muted-text)]">Categories</dt><dd>{c.catalog.categories.map((x) => x.label).join(", ")}</dd></div>
              <div>
                <dt className="text-[var(--color-muted-text)]">Features</dt>
                <dd className="flex flex-wrap gap-1 pt-1">
                  {Object.entries(c.features).map(([k, v]) => (
                    <Badge key={k} tone={v ? "success" : "neutral"}>{k}{v ? "" : " off"}</Badge>
                  ))}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-[var(--color-muted-text)]">Changed in code (<code>brands/src/index.ts</code>) so they stay reviewed and tested.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
