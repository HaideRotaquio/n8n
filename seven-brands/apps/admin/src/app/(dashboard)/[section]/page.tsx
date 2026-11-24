import { EmptyState, PageHeader } from "@sb/ui";
import { notFound } from "next/navigation";
import { plannedSection } from "@/lib/nav";
import { requirePageStaff } from "@/lib/server";

/** Sections scheduled for later phases. They say so plainly instead of showing sample data. */
export default async function PlannedSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = plannedSection(section);
  if (!item) notFound();
  await requirePageStaff(item.permission);
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <EmptyState title={`Not built yet — scheduled for Phase ${item.phase}`}>
        See docs/DEVELOPMENT_ROADMAP.md for what this section will contain.
      </EmptyState>
    </>
  );
}
