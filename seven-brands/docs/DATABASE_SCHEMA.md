# Database schema

PostgreSQL 16. Source of truth: `packages/db/src/schema.ts`. Migrations: `packages/db/migrations/` (generated with `pnpm db:generate`, applied with `pnpm db:migrate`).

Conventions: text primary keys with type prefixes (`brd_…`, `usr_…`, ULID-based, time-sortable); `created_at`/`updated_at` as `timestamptz`; snake_case columns; brand-scoped tables carry `brand_id` with a leading index.

## Implemented (Phase 1)

| Table | Purpose | Key constraints |
|---|---|---|
| `organization` | Parent company | `slug` unique |
| `brand` | One row per brand; `config` JSONB is a validated `BrandConfig` | `slug` unique + format check; `status` enum; FK organization (restrict) |
| `brand_domain` | Host → brand routing | `hostname` PK (a host can serve only one brand); FK brand (cascade) |
| `user` | Identity (Better Auth) | `email` unique |
| `session` | Sessions (Better Auth) | `token` unique; FK user (cascade) |
| `account` | Credentials / OAuth links; `password` holds a scrypt hash | FK user (cascade) |
| `verification` | Email verification / reset tokens | index on identifier |
| `rate_limit` | Auth rate-limit counters (shared across instances) | `key` unique |
| `role`, `permission`, `role_permission` | RBAC catalog, synced from code on every seed | composite PK |
| `user_role` | Grants: `(user, role, brand or NULL)` | `UNIQUE NULLS NOT DISTINCT (user_id, role_id, brand_id)` |
| `customer` | A user's relationship with one brand (consent, country) | `UNIQUE (user_id, brand_id)`; FK brand **restrict** (a brand with customers can't be deleted) |
| `audit_log` | Administrative actions with before/after JSON, actor, IP, user agent | **append-only trigger** blocks UPDATE/DELETE (except FK nulling when a user/brand is removed) |

## Implemented (Phase 2)

| Table | Purpose | Key constraints |
|---|---|---|
| `asset` | One product design per brand; status draft → in_review → approved/rejected → published/archived | `UNIQUE (brand_id, slug)`; FK brand restrict |
| `asset_version` | Immutable definition snapshots with sha256 checksum and provenance | `UNIQUE (asset_id, version)`; **trigger blocks content updates** |
| `quality_review` | Automated QA results and human decisions | decision ∈ {approved, rejected} |
| `export_artifact` | Stored export files per version and format | `UNIQUE (asset_version_id, format)` |
| `production_job` | Work queue + history (rig / ai / export) with attempts, backoff, cost | index (status, run_after) |
| `agent_task` | Every model call: provider, model, tokens, cost, duration, error | FK job cascade |
| `expense` | AI costs (automatic) and manual costs by brand/category | amount ≥ 0 |

## Planned (Phase 3+)

Designed in `PHASE_0_REPORT.md` §8; added by migration as each phase begins:

- **Assets (later):** `sound_asset` (stored sounds with license records), `publishing_job`.
- **Catalog & commerce (P3):** `collection`, `collection_asset`, `product`, `product_asset`, `price`, `product_file`, `order`, `order_item`, `payment`, `webhook_event` (unique provider event id → idempotency), `subscription`, `entitlement`, `license` (unique code), `download`, `revenue_record`.
- **Analytics (P4):** `analytics_event`, partitioned by month.

## Brand isolation

1. Every brand-scoped query takes an explicit scope (`"all"` or brand id list) derived from the caller's grants.
2. Storefront requests derive the brand from `brand_domain`, never from a parameter.
3. Composite indexes start with `brand_id`.
4. Postgres row-level security can be layered on later as defense in depth; it is not enabled today.

## Operations

- Migrations are forward-only SQL files committed to git. Never edit an applied migration; add a new one.
- `pnpm db:seed` is idempotent and safe on every deploy.
- Backups: Neon point-in-time restore + weekly `pg_dump` to R2 *(set up at deployment, see DEPLOYMENT.md)*.
