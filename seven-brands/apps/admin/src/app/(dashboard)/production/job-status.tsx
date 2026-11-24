import { Badge } from "@sb/ui";

const TONE = { queued: "neutral", running: "info", succeeded: "success", failed: "danger", cancelled: "neutral" } as const;
export function JobStatusBadge({ status }: { status: keyof typeof TONE }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
export const usd = (v: string | number) => `$${Number(v).toFixed(Number(v) < 1 ? 4 : 2)}`;
