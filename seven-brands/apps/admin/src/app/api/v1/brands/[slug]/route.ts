import { BrandConfigPatch, ForbiddenError, NotFoundError } from "@sb/core";
import { can } from "@sb/core";
import { getBrandBySlug, getDb, updateBrandConfig } from "@sb/db";
import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, getStaff, requestAuditContext } from "@/lib/server";
import { requirePermission } from "@sb/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const staff = requirePermission(await getStaff(), "overview.read", "any");
    const brand = await getBrandBySlug(getDb(), slug);
    // Same 404 for "missing" and "not yours" so brand existence isn't leaked across scopes.
    if (!brand || !can(staff.grants, "brand.read", brand.id)) throw new NotFoundError();
    return NextResponse.json({ data: brand });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { slug } = await params;
    const staff = requirePermission(await getStaff(), "overview.read", "any");
    const db = getDb();
    const brand = await getBrandBySlug(db, slug);
    if (!brand || !can(staff.grants, "brand.read", brand.id)) throw new NotFoundError();
    if (!can(staff.grants, "brand.update", brand.id)) throw new ForbiddenError();
    const patch = BrandConfigPatch.parse(await req.json());
    const updated = await updateBrandConfig(db, await requestAuditContext(staff.user.id), slug, patch);
    return NextResponse.json({ data: updated });
  } catch (err) {
    return apiError(err);
  }
}
