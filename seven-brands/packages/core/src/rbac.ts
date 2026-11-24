/**
 * Role-based access control for staff of the parent company.
 *
 * Roles are assigned per user either globally (brandId = null) or for one brand.
 * A brand-scoped role only grants its permissions on that brand.
 * Customers have no staff roles; their access is governed by entitlements (Phase 3).
 */

export const PERMISSIONS = [
  "overview.read",
  "brand.read",
  "brand.update",
  "brand.create",
  "asset.read",
  "asset.write",
  "asset.review",
  "asset.publish",
  "production.read",
  "production.run",
  "catalog.read",
  "catalog.write",
  "pricing.write",
  "order.read",
  "order.refund",
  "customer.read",
  "customer.write",
  "license.read",
  "license.write",
  "analytics.read",
  "finance.read",
  "finance.write",
  "infrastructure.read",
  "audit.read",
  "team.read",
  "team.write",
  "settings.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "owner",
  "admin",
  "brand_manager",
  "producer",
  "reviewer",
  "support",
  "analyst",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that only make sense globally (never brand-scoped). */
export const GLOBAL_ONLY_ROLES: readonly Role[] = ["owner", "admin"];

const ALL = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL,
  // Admin: everything except money-moving and team-ownership operations.
  admin: ALL.filter((p) => p !== "order.refund" && p !== "finance.write"),
  brand_manager: [
    "overview.read",
    "brand.read",
    "brand.update",
    "asset.read",
    "asset.write",
    "asset.review",
    "asset.publish",
    "production.read",
    "production.run",
    "catalog.read",
    "catalog.write",
    "pricing.write",
    "order.read",
    "customer.read",
    "license.read",
    "analytics.read",
    "team.read",
  ],
  producer: [
    "overview.read",
    "brand.read",
    "asset.read",
    "asset.write",
    "production.read",
    "production.run",
    "catalog.read",
  ],
  reviewer: ["overview.read", "brand.read", "asset.read", "asset.review", "production.read", "catalog.read"],
  support: [
    "overview.read",
    "brand.read",
    "order.read",
    "customer.read",
    "customer.write",
    "license.read",
    "catalog.read",
  ],
  analyst: ["overview.read", "brand.read", "analytics.read", "finance.read", "order.read", "catalog.read"],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  brand_manager: "Brand manager",
  producer: "Producer",
  reviewer: "Reviewer",
  support: "Support",
  analyst: "Analyst",
};

export interface RoleGrant {
  role: Role;
  /** null = applies to every brand. */
  brandId: string | null;
}

/**
 * Returns true if the grants allow `permission`.
 * - Without `brandId`: only global grants count (company-wide actions).
 * - With `brandId`: global grants and grants for that brand count.
 */
export function can(grants: readonly RoleGrant[], permission: Permission, brandId?: string): boolean {
  return grants.some((g) => {
    if (g.brandId !== null && g.brandId !== brandId) return false;
    return ROLE_PERMISSIONS[g.role]?.includes(permission) ?? false;
  });
}

/** Brand ids on which the grants allow `permission`; "all" if a global grant allows it. */
export function brandsWith(grants: readonly RoleGrant[], permission: Permission): "all" | string[] {
  const ids = new Set<string>();
  for (const g of grants) {
    if (!ROLE_PERMISSIONS[g.role]?.includes(permission)) continue;
    if (g.brandId === null) return "all";
    ids.add(g.brandId);
  }
  return [...ids];
}

/** True if the permission is held globally or on at least one brand (for gating section-level pages). */
export function canAny(grants: readonly RoleGrant[], permission: Permission): boolean {
  const scope = brandsWith(grants, permission);
  return scope === "all" || scope.length > 0;
}

export function isStaff(grants: readonly RoleGrant[]): boolean {
  return grants.length > 0;
}

export function validateGrant(grant: RoleGrant): void {
  if (!ROLES.includes(grant.role)) throw new Error(`Unknown role: ${grant.role}`);
  if (grant.brandId !== null && GLOBAL_ONLY_ROLES.includes(grant.role)) {
    throw new Error(`Role ${grant.role} cannot be scoped to a brand`);
  }
}
