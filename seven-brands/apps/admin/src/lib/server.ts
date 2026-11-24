import "server-only";
import { createAuth, getStaffContext, type Auth, type StaffContext } from "@sb/auth";
import { AppError, can, canAny, type Permission } from "@sb/core";
import { getDb } from "@sb/db";
import { createStorageFromEnv, type StorageDriver } from "@sb/storage";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? "http://localhost:3100";

let auth: Auth | undefined;
export function getAuth(): Auth {
  auth ??= createAuth({
    db: getDb(),
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    baseURL: ADMIN_BASE_URL,
    allowSignUp: false,
    trustedOrigins: [ADMIN_BASE_URL],
    rateLimit: process.env.AUTH_RATE_LIMIT !== "off",
  });
  return auth;
}

let storage: StorageDriver | undefined;
export function getStorage(): StorageDriver {
  storage ??= createStorageFromEnv(process.env, `${ADMIN_BASE_URL}/api/storage/download`);
  return storage;
}

export async function getStaff(): Promise<StaffContext | null> {
  // Read request headers first: it marks the route dynamic before any DB access,
  // so builds never try to connect to the database.
  const h = await headers();
  return getStaffContext(getAuth(), getDb(), h);
}

/**
 * For pages: redirects to /login when signed out, renders 403 when the permission is missing.
 * Scope: a brand id, "any" (held on at least one brand — default for brand-aware pages), or "global".
 */
export async function requirePageStaff(
  permission: Permission = "overview.read",
  scope: string | "any" | "global" = "any",
): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  const ok =
    scope === "any"
      ? canAny(staff.grants, permission)
      : can(staff.grants, permission, scope === "global" ? undefined : scope);
  if (!ok) forbidden();
  return staff;
}

export async function requestAuditContext(actorUserId: string) {
  const h = await headers();
  return {
    actorUserId,
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

/** Rejects cross-site state-changing API requests (defense in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(ADMIN_BASE_URL).origin) {
    throw new AppError("Cross-origin request rejected", "bad_origin", 403);
  }
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message } };
    if ("issues" in err) (body.error as Record<string, unknown>).issues = (err as { issues: unknown }).issues;
    return NextResponse.json(body, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid request", issues: err.issues } },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: { code: "internal", message: "Internal error" } }, { status: 500 });
}
