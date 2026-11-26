import { iconSourceFiles, SOURCE_FORMATS, type SourceFormat } from "@sb/export/source";
import { authorizeApiDownload, getDb } from "@sb/db";
import { apiError, apiStore, bearerLicense, ipHashFor } from "@/lib/dev-api";

export const dynamic = "force-dynamic";

const STATUS = { invalid_license: 401, license_revoked: 403, not_found: 404, not_in_license: 403, rate_limited: 429 } as const;

/**
 * POST /api/v1/icons/:slug/files  { "format": "react" }   Authorization: Bearer MOOD-XXXX-XXXX-XXXX-XXXX
 * Returns the icon's source files for one format, once the license code is checked (same limits and log as downloads).
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const store = await apiStore();
  if (store instanceof Response) return store;
  const { slug } = await params;
  const code = bearerLicense(req);
  if (!code) return apiError(401, "license_required", `Send your license code as "Authorization: Bearer <code>". Buy or claim icons at ${store.origin}.`);
  let body: { format?: string } = {};
  try {
    body = (await req.json()) as { format?: string };
  } catch {
    /* empty body: default format */
  }
  const format = (body.format ?? "react") as SourceFormat;
  if (!SOURCE_FORMATS.includes(format)) return apiError(400, "bad_format", `Format must be one of: ${SOURCE_FORMATS.join(", ")}.`);

  const auth = await authorizeApiDownload(getDb(), { brandId: store.brand.id, code, assetSlug: slug, ipHash: ipHashFor(req), userAgent: req.headers.get("user-agent") });
  if (!auth.ok) {
    const products = auth.products?.map((p) => ({ ...p, url: `${store.origin}/products/${p.slug}` }));
    return apiError(STATUS[auth.reason], auth.reason, auth.message, products ? { products } : {});
  }
  const source = iconSourceFiles(auth.definition, format);
  const licenseNotice = `${auth.definition.name} (${slug}) — ${store.brand.name}, ${auth.license.licenseType} license ${auth.license.code} (${auth.license.productTitle}). Verify: ${store.origin}/licenses/verify?code=${auth.license.code}`;
  return Response.json(
    {
      icon: { slug, name: auth.definition.name, version: auth.version },
      format,
      ...source,
      license: { ...auth.license, notice: licenseNotice, termsUrl: `${store.origin}/help/licenses` },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

