import type { BrandStatus } from "@sb/core";
import { Badge } from "@sb/ui";

const TONE = { planned: "neutral", in_development: "info", beta: "warning", live: "success", paused: "danger" } as const;
const LABEL: Record<BrandStatus, string> = {
  planned: "Planned",
  in_development: "In development",
  beta: "Beta",
  live: "Live",
  paused: "Paused",
};

export function StatusBadge({ status }: { status: BrandStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
export const STATUS_LABEL = LABEL;
