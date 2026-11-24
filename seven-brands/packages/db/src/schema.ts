import type { BrandConfig } from "@sb/core";
import { BRAND_STATUSES } from "@sb/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Phase 1 schema: organization, brands, identity (Better Auth tables), RBAC,
 * brand-scoped customers and the append-only audit log.
 * Asset, production, catalog and commerce tables arrive in Phases 2–3
 * (see docs/DATABASE_SCHEMA.md).
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const brandStatus = pgEnum("brand_status", BRAND_STATUSES);

// ─── Company & brands ────────────────────────────────────────────────────────

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const brand = pgTable(
  "brand",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    status: brandStatus("status").notNull().default("planned"),
    launchPhase: integer("launch_phase").notNull(),
    config: jsonb("config").$type<BrandConfig>().notNull(),
    ...timestamps,
  },
  (t) => [
    index("brand_org_idx").on(t.organizationId),
    check("brand_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{2,40}$'`),
  ],
);

/** Host → brand routing table. Hostnames are globally unique, so one host can never serve two brands. */
export const brandDomain = pgTable(
  "brand_domain",
  {
    hostname: text("hostname").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("brand_domain_brand_idx").on(t.brandId)],
);

// ─── Identity (Better Auth) ──────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Better Auth rate-limit storage (shared across serverless instances). */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ─── RBAC ────────────────────────────────────────────────────────────────────

export const role = pgTable("role", {
  id: text("id").primaryKey(), // role key, e.g. "brand_manager"
  label: text("label").notNull(),
  globalOnly: boolean("global_only").notNull().default(false),
});

export const permission = pgTable("permission", {
  id: text("id").primaryKey(), // permission key, e.g. "brand.update"
});

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRole = pgTable(
  "user_role",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "restrict" }),
    /** null = role applies to every brand. */
    brandId: text("brand_id").references(() => brand.id, { onDelete: "cascade" }),
    grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("user_role_unique").on(t.userId, t.roleId, t.brandId).nullsNotDistinct(),
    index("user_role_user_idx").on(t.userId),
  ],
);

// ─── Customers (brand-scoped relationship with a user) ──────────────────────

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    country: char("country", { length: 2 }),
    ...timestamps,
  },
  (t) => [
    unique("customer_user_brand_unique").on(t.userId, t.brandId),
    index("customer_brand_idx").on(t.brandId, t.createdAt),
  ],
);

// ─── Audit log (append-only; enforced by a trigger in migration 0001) ───────

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("audit_brand_time_idx").on(t.brandId, t.createdAt),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_time_idx").on(t.createdAt),
  ],
);

export type Brand = typeof brand.$inferSelect;
export type User = typeof user.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Customer = typeof customer.$inferSelect;

// ─── Phase 2: assets & production ────────────────────────────────────────────

export const ASSET_STATUSES = ["draft", "in_review", "approved", "rejected", "published", "archived"] as const;
export const assetStatus = pgEnum("asset_status", ASSET_STATUSES);
export const JOB_KINDS = ["rig", "ai", "export"] as const;
export const jobKind = pgEnum("job_kind", JOB_KINDS);
export const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export const jobStatus = pgEnum("job_status", JOB_STATUSES);
export const reviewKind = pgEnum("review_kind", ["automated", "human"]);
export const EXPENSE_CATEGORIES = ["ai", "infrastructure", "payments", "marketing", "software", "legal", "other"] as const;
export const expenseCategory = pgEnum("expense_category", EXPENSE_CATEGORIES);

export const asset = pgTable(
  "asset",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: assetStatus("status").notNull().default("draft"),
    category: text("category"),
    /** Latest version (denormalized for listing). */
    currentVersion: integer("current_version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [unique("asset_brand_slug_unique").on(t.brandId, t.slug), index("asset_brand_status_idx").on(t.brandId, t.status, t.updatedAt)],
);

/** Immutable snapshots of an asset's definition (enforced by trigger in migration 0003). */
export const assetVersion = pgTable(
  "asset_version",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    checksum: text("checksum").notNull(),
    provenance: text("provenance").notNull(),
    productionJobId: text("production_job_id"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique("asset_version_unique").on(t.assetId, t.version)],
);

export const qualityReview = pgTable(
  "quality_review",
  {
    id: text("id").primaryKey(),
    assetVersionId: text("asset_version_id")
      .notNull()
      .references(() => assetVersion.id, { onDelete: "cascade" }),
    kind: reviewKind("kind").notNull(),
    score: integer("score"),
    passed: boolean("passed"),
    /** Human reviews only. */
    decision: text("decision"),
    checks: jsonb("checks"),
    notes: text("notes"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("quality_review_version_idx").on(t.assetVersionId, t.createdAt), check("decision_values", sql`${t.decision} IS NULL OR ${t.decision} IN ('approved','rejected')`)],
);

export const exportArtifact = pgTable(
  "export_artifact",
  {
    id: text("id").primaryKey(),
    assetVersionId: text("asset_version_id")
      .notNull()
      .references(() => assetVersion.id, { onDelete: "cascade" }),
    format: text("format").notNull(),
    storageKey: text("storage_key").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [unique("export_artifact_unique").on(t.assetVersionId, t.format)],
);

/** Production jobs double as the work queue (claimed with FOR UPDATE SKIP LOCKED). */
export const productionJob = pgTable(
  "production_job",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    kind: jobKind("kind").notNull(),
    status: jobStatus("status").notNull().default("queued"),
    brief: jsonb("brief").notNull(),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("production_job_queue_idx").on(t.status, t.runAfter), index("production_job_brand_idx").on(t.brandId, t.createdAt)],
);

export const agentTask = pgTable(
  "agent_task",
  {
    id: text("id").primaryKey(),
    productionJobId: text("production_job_id")
      .notNull()
      .references(() => productionJob.id, { onDelete: "cascade" }),
    agent: text("agent").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("agent_task_job_idx").on(t.productionJobId), index("agent_task_time_idx").on(t.createdAt)],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
    category: expenseCategory("category").notNull(),
    description: text("description").notNull(),
    amountUsd: numeric("amount_usd", { precision: 12, scale: 6 }).notNull(),
    /** e.g. "agent_task:agt_…" or "manual". */
    source: text("source").notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("expense_time_idx").on(t.incurredAt), index("expense_brand_idx").on(t.brandId, t.incurredAt), check("expense_non_negative", sql`${t.amountUsd} >= 0`)],
);

export type Asset = typeof asset.$inferSelect;
export type AssetVersion = typeof assetVersion.$inferSelect;
export type ProductionJob = typeof productionJob.$inferSelect;
export type AgentTask = typeof agentTask.$inferSelect;
export type Expense = typeof expense.$inferSelect;
