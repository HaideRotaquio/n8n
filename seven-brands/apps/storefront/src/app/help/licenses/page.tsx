import { LICENSE_RESTRICTIONS, licenseSummary } from "@sb/commerce";
import { LICENSE_TERMS_VERSION, LICENSE_TYPE_LABELS } from "@sb/core";
import type { Metadata } from "next";
import { designFor } from "@/designs";
import { requireStore } from "@/lib/store";

export const metadata: Metadata = { title: "Licenses explained" };

export default async function LicensesHelpPage() {
  const { brand } = await requireStore();
  const { Page } = designFor(brand);
  return (
    <Page title="Licenses explained" intro="Plain-language summary of what each license lets you do. The same text is in LICENSE.txt in every download.">
      <ul className="grid gap-4 sm:grid-cols-2">
        {brand.config.licenseTypes.map((t) => {
          const s = licenseSummary(t);
          if (!s) return null;
          return (
            <li key={t} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h2 className="text-lg font-bold">{LICENSE_TYPE_LABELS[t]}</h2>
              <p className="text-sm text-[var(--color-muted-text)]">{s.summary}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {s.allowed.map((a) => <li key={a}>{a}</li>)}
                <li>Who may use it: {s.seats}</li>
              </ul>
            </li>
          );
        })}
      </ul>
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="text-lg font-bold">No license allows</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{LICENSE_RESTRICTIONS.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <p className="text-sm text-[var(--color-muted-text)]">Licenses are perpetual for the files you receive and cover future updates. They are non-exclusive and non-transferable; a refund ends the license. Terms version {LICENSE_TERMS_VERSION} — draft pending legal review.</p>
    </Page>
  );
}
