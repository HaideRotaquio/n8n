import { isLicenseCode, normalizeLicenseCode } from "@sb/core";
import { getDb, verifyLicense } from "@sb/db";

export const dynamic = "force-dynamic";

/**
 * Public license check: GET /api/v1/licenses/verify?code=MOOD-XXXX-XXXX-XXXX-XXXX
 * Returns status, brand, product, license type and the licensee's initials — never contact details.
 * Codes carry 80 random bits, so guessing valid codes is not practical.
 */
export async function GET(req: Request) {
  const code = normalizeLicenseCode(new URL(req.url).searchParams.get("code") ?? "");
  if (!isLicenseCode(code)) return Response.json({ valid: false, status: "invalid_format" }, { status: 400 });
  const result = await verifyLicense(getDb(), code);
  return Response.json(result, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}
