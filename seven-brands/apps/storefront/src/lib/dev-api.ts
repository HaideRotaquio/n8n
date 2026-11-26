import "server-only";
import { createHash } from "node:crypto";
import { isLicenseCode, normalizeLicenseCode } from "@sb/core";
import type { IconSummary } from "@sb/db";
import { getStore, type StoreContext } from "./store";

/** Shared plumbing for the developer API (/api/v1/icons…), used by the CLI, the MCP server and AI coding agents. */

const NO_STORE = { "cache-control": "no-store" };

export const apiError = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error, message, ...extra }, { status, headers: NO_STORE });

/** The brand from the request host; unknown hosts get a JSON 404. */
export async function apiStore(): Promise<StoreContext | Response> {
  const store = await getStore();
  return store ?? apiError(404, "unknown_store", "This address isn't a store.");
}

/** "Authorization: Bearer MOOD-…" → a normalized license code, or null. */
export function bearerLicense(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return null;
  const code = normalizeLicenseCode(m[1]!.trim());
  return isLicenseCode(code) ? code : null;
}

export function ipHashFor(req: Request): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return ip ? createHash("sha256").update(`${process.env.STORAGE_SIGNING_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32) : null;
}

/** Public icon card: adds links a person (or agent) can open. */
export function iconCard(icon: IconSummary, origin: string) {
  return {
    ...icon,
    previewUrl: `${origin}/api/v1/icons/${icon.slug}/preview.svg`,
    products: icon.products.map((p) => ({ ...p, url: `${origin}/products/${p.slug}` })),
  };
}

export const PUBLIC_JSON = { "cache-control": "public, max-age=60", "access-control-allow-origin": "*" };
