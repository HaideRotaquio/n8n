/**
 * How 3D pricing gets decided: from what customers download, not from a guess. Faces and chibi characters ship in
 * both flat and clay 3D in every pack; once there's enough data, the 3D share of downloads picks the next step.
 * Thresholds are documented in docs/STYLE_DEMAND.md.
 */

export const STYLE_DEMAND_MIN_DOWNLOADS = 200;
export const STYLE_DEMAND_MIN_CUSTOMERS = 30;

export type StyleVerdict =
  | { kind: "collecting"; message: string }
  | { kind: "premium-3d"; share: number; message: string }
  | { kind: "both"; share: number; message: string }
  | { kind: "flat-first"; share: number; message: string };

export function styleVerdict(flatDownloads: number, threeDDownloads: number, customers: number): StyleVerdict {
  const total = flatDownloads + threeDDownloads;
  if (total < STYLE_DEMAND_MIN_DOWNLOADS || customers < STYLE_DEMAND_MIN_CUSTOMERS) {
    return {
      kind: "collecting",
      message: `Collecting data: ${total} of ${STYLE_DEMAND_MIN_DOWNLOADS} downloads and ${customers} of ${STYLE_DEMAND_MIN_CUSTOMERS} customers needed before deciding.`,
    };
  }
  const share = Math.round((threeDDownloads / total) * 100);
  if (share >= 65) return { kind: "premium-3d", share, message: `3D is ${share}% of downloads: show 3D first and test a premium 3D tier on new packs.` };
  if (share > 35) return { kind: "both", share, message: `3D is ${share}% of downloads: both styles are valued; keep shipping both in every pack.` };
  return { kind: "flat-first", share, message: `3D is ${share}% of downloads: keep 3D as a free bonus and show flat first.` };
}
