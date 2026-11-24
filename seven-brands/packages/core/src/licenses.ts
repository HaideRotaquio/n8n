import type { LicenseType } from "./brand-config";

/**
 * License codes and terms metadata (no I/O). The full license text lives in @sb/commerce.
 * Terms are a DRAFT until reviewed by a lawyer (see docs/SECURITY.md, "Before launch").
 */
export const LICENSE_TERMS_VERSION = "2026-11-draft-1";

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  personal: "Personal",
  commercial: "Commercial",
  team: "Team (up to 10 people)",
  agency: "Agency (client work)",
  enterprise: "Enterprise",
};

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U

/** e.g. `MOOD-7KQ2-9XHD-M4TR-1BZC` — 4-letter brand prefix + 80 random bits. */
export function generateLicenseCode(brandSlug: string): string {
  const prefix = brandSlug.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X");
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % 32]).join("");
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

/** Uppercases, trims and maps look-alike characters (O→0, I/L→1) in the random part, so hand-typed codes still match. */
export function normalizeLicenseCode(input: string): string {
  const parts = input.trim().toUpperCase().replace(/\s+/g, "").split("-");
  return [parts[0] ?? "", ...parts.slice(1).map((p) => p.replace(/O/g, "0").replace(/[IL]/g, "1"))].join("-");
}

export function isLicenseCode(code: string): boolean {
  return /^[A-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/.test(code);
}
