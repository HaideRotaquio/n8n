import { getDb, pingDb } from "@sb/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public liveness/readiness probe. Reveals no configuration details. */
export async function GET() {
  try {
    await pingDb(getDb());
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
