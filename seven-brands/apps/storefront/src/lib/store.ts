import "server-only";
import { createAuth, type Auth } from "@sb/auth";
import { commerceFromEnv, type CommerceConfig } from "@sb/commerce";
import { ensureCustomer, getDb, resolveBrandByHost, type Brand, type Customer } from "@sb/db";
import { createStorageFromEnv, type StorageDriver } from "@sb/storage";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

/**
 * Multi-tenant storefront plumbing. The brand always comes from the request host (brand_domain table),
 * never from a parameter. Unknown hosts get a 404, so the host header can't be used to impersonate a brand.
 */

export interface StoreContext {
  brand: Brand;
  host: string;
  origin: string;
}

function protocolFor(host: string, forwarded: string | null): "http" | "https" {
  if (forwarded === "http" || forwarded === "https") return forwarded;
  const name = host.replace(/:\d+$/, "");
  return name === "localhost" || name.endsWith(".localhost") ? "http" : "https";
}

/** The brand for this request, or null for an unknown host. Cached per request. */
export const getStore = cache(async (): Promise<StoreContext | null> => {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/.test(host)) return null;
  const brand = await resolveBrandByHost(getDb(), host);
  if (!brand) return null;
  return { brand, host, origin: `${protocolFor(host, h.get("x-forwarded-proto"))}://${host}` };
});

export async function requireStore(): Promise<StoreContext> {
  const s = await getStore();
  if (!s) notFound();
  return s;
}

const auths = new Map<string, Auth>();
/** One Better Auth instance per storefront origin (cookies are per host, so sessions never cross brands). */
export function authFor(origin: string): Auth {
  let a = auths.get(origin);
  if (!a) {
    a = createAuth({
      db: getDb(),
      secret: process.env.BETTER_AUTH_SECRET ?? "",
      baseURL: origin,
      allowSignUp: true,
      trustedOrigins: [origin],
      rateLimit: process.env.AUTH_RATE_LIMIT !== "off",
    });
    auths.set(origin, a);
  }
  return a;
}

export interface ShopperContext extends StoreContext {
  user: { id: string; name: string; email: string };
  customer: Customer;
}

/** The signed-in customer of this brand (creating the brand relationship on first visit), or null. */
export const getShopper = cache(async (): Promise<ShopperContext | null> => {
  const store = await getStore();
  if (!store) return null;
  const session = await authFor(store.origin).api.getSession({ headers: await headers() });
  if (!session) return null;
  const customer = await ensureCustomer(getDb(), session.user.id, store.brand.id);
  return { ...store, user: { id: session.user.id, name: session.user.name, email: session.user.email }, customer };
});

export async function requireShopper(next: string): Promise<ShopperContext> {
  const s = await getShopper();
  if (!s) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return s;
}

let commerce: CommerceConfig | undefined;
export function getCommerce(): CommerceConfig {
  commerce ??= commerceFromEnv(process.env);
  return commerce;
}

/** Storage with signed links that point back at this storefront (fs driver) or at the bucket (S3/R2). */
export function storageFor(origin: string): StorageDriver {
  return createStorageFromEnv(process.env, `${origin}/api/storage/download`);
}

/** Only accept same-site relative paths as post-sign-in destinations. */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
