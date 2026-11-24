import { LICENSE_TYPE_LABELS, type LicenseType } from "@sb/core";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * License certificate text included in every purchased package (LICENSE.txt).
 *
 * DRAFT TERMS — written in plain language for review. They must be reviewed by a lawyer before
 * live sales (see docs/SECURITY.md). The terms version is recorded on every license, so a later
 * revision never silently changes what an earlier buyer agreed to.
 */

interface Grant {
  summary: string;
  allowed: string[];
  seats: string;
}

const GRANTS: Record<LicenseType, Grant> = {
  personal: {
    summary: "Use in your own non-commercial projects.",
    allowed: ["Personal websites, blogs, social posts, school work and hobby projects", "Unlimited non-commercial projects"],
    seats: "1 person",
  },
  commercial: {
    summary: "Use in commercial projects you or your company own.",
    allowed: ["Websites, apps, products, marketing and video for your own business", "Unlimited end users and impressions", "Modifying colors, size and timing"],
    seats: "1 person",
  },
  team: {
    summary: "Commercial use by a team.",
    allowed: ["Everything in Commercial", "Shared use by up to 10 people in one organization"],
    seats: "Up to 10 people in one organization",
  },
  agency: {
    summary: "Commercial use in work you deliver to clients.",
    allowed: ["Everything in Commercial", "Use in projects delivered to any number of clients", "Clients may use the delivered project, but not the asset files on their own"],
    seats: "Up to 10 people in one agency",
  },
  enterprise: {
    summary: "Organization-wide commercial use.",
    allowed: ["Everything in Team", "Unlimited people in one organization and its subsidiaries"],
    seats: "Unlimited within one organization",
  },
};

const NOT_ALLOWED = [
  "Reselling, sharing or redistributing the asset files themselves, alone or in a pack, free or paid",
  "Including the files in templates, themes, icon sets, UI kits or other products where the asset can be extracted and reused",
  "Using the assets as a logo or trademark, or claiming them as your own work",
  "Using the assets to train or fine-tune machine-learning models",
];

export interface LicenseTextInput {
  brandName: string;
  productTitle: string;
  assetName?: string;
  licenseType: string;
  code: string;
  licenseeName: string;
  issuedAt: Date;
  termsVersion: string;
  verifyUrl: string;
}

export function buildLicenseText(i: LicenseTextInput): string {
  const type = i.licenseType as LicenseType;
  const g = GRANTS[type];
  if (!g) throw new Error(`Unknown license type "${i.licenseType}"`);
  const lines = [
    `${i.brandName.toUpperCase()} — ${LICENSE_TYPE_LABELS[type].toUpperCase()} LICENSE`,
    "",
    `License code:   ${i.code}`,
    `Licensee:       ${i.licenseeName}`,
    `Product:        ${i.productTitle}${i.assetName && i.assetName !== i.productTitle ? ` (file: ${i.assetName})` : ""}`,
    `Issued:         ${i.issuedAt.toISOString().slice(0, 10)}`,
    `Terms version:  ${i.termsVersion}`,
    `Verify:         ${i.verifyUrl}`,
    "",
    `${g.summary}`,
    "",
    "You may:",
    ...g.allowed.map((a) => `  - ${a}`),
    `  - Who may use it: ${g.seats}`,
    "",
    "You may not:",
    ...NOT_ALLOWED.map((a) => `  - ${a}`),
    "",
    "The license is perpetual for the files you received and covers future updates to them.",
    "It is non-exclusive and non-transferable. A refunded or charged-back purchase ends the license.",
    "Copyright in the assets remains with the publisher.",
    "",
    "These terms are a draft pending legal review. Questions: reply to your receipt email.",
    "",
  ];
  return lines.join("\n");
}

/**
 * Returns a copy of a stored export package with LICENSE.txt replaced by the buyer's license,
 * so every download carries a real, verifiable certificate instead of the preview notice.
 */
export function personalizePackage(zip: Uint8Array, licenseText: string): Uint8Array {
  const files = unzipSync(zip);
  files["LICENSE.txt"] = strToU8(licenseText);
  const readme = files["README.txt"];
  if (readme) {
    const code = /License code:\s+(\S+)/.exec(licenseText)?.[1] ?? "";
    files["README.txt"] = strToU8(`${strFromU8(readme).trimEnd()}\n\nLicensed copy — license code ${code}. See LICENSE.txt.\n`);
  }
  return zipSync(files, { level: 6 });
}

/** Plain-language license summary for comparison tables (same source as LICENSE.txt). */
export function licenseSummary(type: string): { summary: string; allowed: string[]; seats: string } | null {
  return GRANTS[type as LicenseType] ?? null;
}

export const LICENSE_RESTRICTIONS: readonly string[] = NOT_ALLOWED;
