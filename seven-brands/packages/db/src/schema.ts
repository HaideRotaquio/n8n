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
export const JOB_KINDS = ["rig", "ai", "export", "catalog"] as const;
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

// ─── Phase 3: catalog & commerce ─────────────────────────────────────────────

export const CATALOG_STATUSES = ["draft", "published", "archived"] as const;
export const catalogStatus = pgEnum("catalog_status", CATALOG_STATUSES);
export const PRODUCT_KINDS = ["single", "pack"] as const;
export const productKind = pgEnum("product_kind", PRODUCT_KINDS);
export const PAYMENT_PROVIDERS = ["lemonsqueezy", "paddle", "test", "free"] as const;
export const paymentProvider = pgEnum("payment_provider", PAYMENT_PROVIDERS);
export const CHECKOUT_STATUSES = ["open", "completed", "expired", "failed"] as const;
export const checkoutStatus = pgEnum("checkout_status", CHECKOUT_STATUSES);
export const ORDER_STATUSES = ["paid", "partially_refunded", "refunded"] as const;
export const orderStatus = pgEnum("order_status", ORDER_STATUSES);
export const REFUND_STATUSES = ["requested", "rejected", "submitted", "completed", "failed"] as const;
export const refundStatus = pgEnum("refund_status", REFUND_STATUSES);

export const collection = pgTable(
  "collection",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: catalogStatus("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [unique("collection_brand_slug_unique").on(t.brandId, t.slug), check("collection_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{2,80}$'`)],
);

export const collectionProduct = pgTable(
  "collection_product",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

/** What customers buy: one asset (single) or several (pack), sold under per-license prices. */
export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    kind: productKind("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: catalogStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("product_brand_slug_unique").on(t.brandId, t.slug),
    index("product_brand_status_idx").on(t.brandId, t.status, t.publishedAt),
    check("product_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{2,80}$'`),
  ],
);

export const productAsset = pgTable(
  "product_asset",
  {
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.assetId] }), index("product_asset_asset_idx").on(t.assetId)],
);

/** One price per (product, license type, currency). Orders snapshot the amount, so edits never change past orders. */
export const price = pgTable(
  "price",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    licenseType: text("license_type").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    amountCents: integer("amount_cents").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("price_product_license_currency_unique").on(t.productId, t.licenseType, t.currency),
    check("price_amount_range", sql`${t.amountCents} >= 0 AND ${t.amountCents} <= 10000000`),
    check("price_currency_format", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** Created before redirecting to the provider; the webhook finds it via custom data and never trusts client-side prices. */
export const checkoutSession = pgTable(
  "checkout_session",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    priceId: text("price_id")
      .notNull()
      .references(() => price.id, { onDelete: "restrict" }),
    licenseType: text("license_type").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    provider: paymentProvider("provider").notNull(),
    providerCheckoutId: text("provider_checkout_id"),
    url: text("url"),
    status: checkoutStatus("status").notNull().default("open"),
    testMode: boolean("test_mode").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("checkout_customer_idx").on(t.customerId, t.createdAt)],
);

export const order = pgTable(
  "order",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    checkoutSessionId: text("checkout_session_id").references(() => checkoutSession.id, { onDelete: "set null" }),
    provider: paymentProvider("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull(),
    status: orderStatus("status").notNull().default("paid"),
    currency: char("currency", { length: 3 }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    feeCents: integer("fee_cents"),
    refundedCents: integer("refunded_cents").notNull().default(0),
    email: text("email"),
    testMode: boolean("test_mode").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("order_provider_unique").on(t.provider, t.providerOrderId),
    index("order_brand_time_idx").on(t.brandId, t.paidAt),
    index("order_customer_idx").on(t.customerId, t.paidAt),
  ],
);

export const orderItem = pgTable(
  "order_item",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    priceId: text("price_id").references(() => price.id, { onDelete: "set null" }),
    licenseType: text("license_type").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("order_item_order_idx").on(t.orderId)],
);

/** Every received webhook, valid or not. The unique key makes processing idempotent. */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: text("id").primaryKey(),
    provider: paymentProvider("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    outcome: text("outcome"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [unique("webhook_event_unique").on(t.provider, t.eventId), index("webhook_event_time_idx").on(t.receivedAt)],
);

/** A license certificate: what the buyer may do with the product. Codes are unique and verifiable. */
export const license = pgTable(
  "license",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    orderItemId: text("order_item_id")
      .notNull()
      .unique()
      .references(() => orderItem.id, { onDelete: "restrict" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    licenseType: text("license_type").notNull(),
    termsVersion: text("terms_version").notNull(),
    licenseeName: text("licensee_name").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
  },
  (t) => [index("license_customer_idx").on(t.customerId), index("license_brand_idx").on(t.brandId, t.issuedAt)],
);

/** Access to a product's files. Granted only by a verified payment webhook (or an audited staff grant). */
export const entitlement = pgTable(
  "entitlement",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    licenseId: text("license_id").references(() => license.id, { onDelete: "restrict" }),
    /** "order" or "staff_grant". */
    source: text("source").notNull(),
    grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("entitlement_customer_idx").on(t.customerId, t.productId)],
);

/** One row per issued download link (abuse limits and support history). IPs are stored hashed. */
export const download = pgTable(
  "download",
  {
    id: text("id").primaryKey(),
    entitlementId: text("entitlement_id")
      .notNull()
      .references(() => entitlement.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    assetVersion: integer("asset_version").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("download_customer_time_idx").on(t.customerId, t.createdAt)],
);

/**
 * Refunds. Staff-initiated refunds start as `requested` and need an owner's approval before money moves.
 * Refunds made in the provider's dashboard arrive by webhook and are recorded as `completed` rows.
 */
export const refundRequest = pgTable(
  "refund_request",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    providerRefundId: text("provider_refund_id"),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("refund_request_status_idx").on(t.status, t.createdAt),
    index("refund_request_order_idx").on(t.orderId),
    unique("refund_provider_unique").on(t.orderId, t.providerRefundId),
    check("refund_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export type Collection = typeof collection.$inferSelect;
export type Product = typeof product.$inferSelect;
export type Price = typeof price.$inferSelect;
export type CheckoutSession = typeof checkoutSession.$inferSelect;
export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type WebhookEvent = typeof webhookEvent.$inferSelect;
export type License = typeof license.$inferSelect;
export type Entitlement = typeof entitlement.$inferSelect;
export type Download = typeof download.$inferSelect;
export type RefundRequest = typeof refundRequest.$inferSelect;

// ─── Phase 4: stored sounds, catalog jobs ────────────────────────────────────

export const SOUND_SOURCES = ["recorded", "library", "synthesized", "ai"] as const;
export const soundSource = pgEnum("sound_source", SOUND_SOURCES);

/**
 * Stored sounds (`snd_…` in asset definitions). Every sound carries a license record: where it came from,
 * under which terms, and who confirmed we may sell it. Files are normalized to −16 LUFS / −1 dBFS, mono, 48 kHz.
 */
export const soundAsset = pgTable(
  "sound_asset",
  {
    id: text("id").primaryKey(),
    /** null = shared by every brand. */
    brandId: text("brand_id").references(() => brand.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    source: soundSource("source").notNull(),
    author: text("author").notNull(),
    /** License name or URL, e.g. "Own recording", "CC0 1.0 — freesound.org/s/123". */
    licenseRef: text("license_ref").notNull(),
    licenseNotes: text("license_notes").notNull().default(""),
    rightsConfirmedBy: text("rights_confirmed_by").references(() => user.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    bytes: integer("bytes").notNull(),
    sha256: text("sha256").notNull(),
    durationMs: integer("duration_ms").notNull(),
    sampleRate: integer("sample_rate").notNull(),
    loudnessLufs: numeric("loudness_lufs", { precision: 6, scale: 2 }),
    peakDbfs: numeric("peak_dbfs", { precision: 6, scale: 2 }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("sound_asset_brand_idx").on(t.brandId, t.createdAt), check("sound_license_present", sql`length(${t.licenseRef}) >= 3`)],
);
export type SoundAsset = typeof soundAsset.$inferSelect;
