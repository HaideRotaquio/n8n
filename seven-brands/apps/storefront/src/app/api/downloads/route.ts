import { createHash } from "node:crypto";
import { buildLicenseText, personalizePackage } from "@sb/commerce";
import { authorizeDownload, getDb, schema } from "@sb/db";
import { eq } from "drizzle-orm";
import { getShopper, storageFor } from "@/lib/store";

export const dynamic = "force-dynamic";

const back = (origin: string, error: string) => Response.redirect(`${origin}/account?error=${error}`, 303);

/**
 * Issues a short-lived download link after checking entitlement, product membership and rate limits.
 * Each license gets its own copy of the package with LICENSE.txt filled in (built once, then reused).
 */
export async function POST(req: Request) {
  const shopper = await getShopper();
  if (!shopper) return new Response("Sign in required", { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && origin !== shopper.origin) return new Response("Cross-site request rejected", { status: 403 });
  const form = await req.formData();
  const entitlementId = String(form.get("entitlementId") ?? "");
  const assetId = String(form.get("assetId") ?? "");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? createHash("sha256").update(`${process.env.STORAGE_SIGNING_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32) : null;
  const db = getDb();
  const auth = await authorizeDownload(db, { customerId: shopper.customer.id, entitlementId, assetId, ipHash, userAgent: req.headers.get("user-agent") });
  if (!auth.ok) return back(shopper.origin, auth.reason);

  const storage = storageFor(shopper.origin);
  let key = auth.storageKey;
  const filename = `${auth.assetSlug}-v${auth.version}.zip`;
  if (auth.license) {
    key = `licenses/${auth.license.id}/${filename}`;
    if (!(await storage.exists(key))) {
      const original = await storage.get(auth.storageKey);
      if (!original) return back(shopper.origin, "not_ready");
      const [p] = await db.select({ title: schema.product.title }).from(schema.product).where(eq(schema.product.id, auth.license.productId));
      const text = buildLicenseText({
        brandName: shopper.brand.name,
        productTitle: p?.title ?? auth.assetName,
        assetName: auth.assetName,
        licenseType: auth.license.licenseType,
        code: auth.license.code,
        licenseeName: auth.license.licenseeName,
        issuedAt: auth.license.issuedAt,
        termsVersion: auth.license.termsVersion,
        verifyUrl: `${shopper.origin}/licenses/verify?code=${auth.license.code}`,
      });
      await storage.put(key, personalizePackage(original, text), { contentType: "application/zip" });
    }
  }
  const url = await storage.createDownloadUrl(key, { expiresInSeconds: 300, filename });
  return Response.redirect(url, 303);
}
