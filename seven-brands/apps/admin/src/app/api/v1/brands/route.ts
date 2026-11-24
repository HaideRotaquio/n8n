import { brandsWith, UnauthorizedError } from "@sb/core";
import { getDb, listBrands } from "@sb/db";
import { NextResponse } from "next/server";
import { apiError, getStaff } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await getStaff();
    if (!staff) throw new UnauthorizedError();
    const brands = await listBrands(getDb(), brandsWith(staff.grants, "brand.read"));
    return NextResponse.json({
      data: brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, status: b.status, launchPhase: b.launchPhase })),
    });
  } catch (err) {
    return apiError(err);
  }
}
