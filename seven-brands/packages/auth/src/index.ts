import {
  can,
  canAny,
  ForbiddenError,
  newId,
  UnauthorizedError,
  type Permission,
  type Role,
  type RoleGrant,
} from "@sb/core";
import { grantRole, loadGrants, schema, type Database } from "@sb/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const ID_PREFIX_BY_MODEL: Record<string, string> = {
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "ver",
  rateLimit: "rl",
};

export const MIN_PASSWORD_LENGTH = 12;

export interface CreateAuthOptions {
  db: Database;
  /** At least 32 random bytes; never commit it. */
  secret: string;
  baseURL: string;
  /** Staff admin: false. Storefronts (Phase 3+): true. */
  allowSignUp: boolean;
  trustedOrigins?: string[];
  /** Defaults to on. Tests may disable it. */
  rateLimit?: boolean;
}

export function createAuth(opts: CreateAuthOptions) {
  if (!opts.secret || opts.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set and at least 32 characters long");
  }
  return betterAuth({
    secret: opts.secret,
    baseURL: opts.baseURL,
    trustedOrigins: opts.trustedOrigins,
    database: drizzleAdapter(opts.db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !opts.allowSignUp,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 256,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
    rateLimit: {
      enabled: opts.rateLimit ?? true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      database: {
        generateId: ({ model }) => newId(ID_PREFIX_BY_MODEL[model] ?? "gen"),
      },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export interface StaffContext {
  user: { id: string; name: string; email: string };
  grants: RoleGrant[];
}

/** Returns the signed-in staff member, or null when signed out or not staff. */
export async function getStaffContext(auth: Auth, db: Database, headers: Headers): Promise<StaffContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const grants = await loadGrants(db, session.user.id);
  if (grants.length === 0) return null;
  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    grants,
  };
}

/**
 * Throws unless the staff member holds `permission`:
 * - `brandId` given: on that brand (or globally);
 * - `"any"`: globally or on at least one brand (section-level access; data must still be brand-scoped);
 * - omitted: globally (company-wide actions).
 */
export function requirePermission(
  staff: StaffContext | null,
  permission: Permission,
  brandId?: string | "any",
): StaffContext {
  if (!staff) throw new UnauthorizedError();
  const ok = brandId === "any" ? canAny(staff.grants, permission) : can(staff.grants, permission, brandId);
  if (!ok) throw new ForbiddenError();
  return staff;
}

/**
 * Creates a staff account with a password and grants it a role.
 * Uses a sign-up-enabled auth instance internally; staff self-registration stays disabled in the admin app.
 */
export async function createStaffUser(
  db: Database,
  input: {
    email: string;
    name: string;
    password: string;
    role: Role;
    brandId?: string | null;
    secret: string;
    actorUserId?: string | null;
  },
): Promise<{ userId: string }> {
  const provisioning = createAuth({
    db,
    secret: input.secret,
    baseURL: "http://localhost",
    allowSignUp: true,
    rateLimit: false,
  });
  const res = await provisioning.api.signUpEmail({
    body: { email: input.email.toLowerCase(), name: input.name, password: input.password },
  });
  await grantRole(
    db,
    { actorUserId: input.actorUserId ?? null, userAgent: "create-staff-user" },
    { userId: res.user.id, role: input.role, brandId: input.brandId ?? null },
  );
  return { userId: res.user.id };
}
