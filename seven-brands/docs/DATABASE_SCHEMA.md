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

## Implemented (Phase 3)

| Table | Purpose | Key constraints |
|---|---|---|
| `product` | What customers buy: `single` (1 asset) or `pack` (2–100); `draft → published → archived` | `UNIQUE (brand_id, slug)`; slug format check |
| `product_asset` | Assets in a product, ordered | PK (product, asset); asset FK restrict |
| `price` | One price per (product, license type, currency), in cents; can be hidden | `UNIQUE (product_id, license_type, currency)`; 0–10,000,000 cents |
| `collection`, `collection_product` | Curated product groups per brand | `UNIQUE (brand_id, slug)` |
| `checkout_session` | What a customer is buying, at the DB price, before the provider redirect; matched by the webhook | status open/completed/expired/failed |
| `order` | A paid purchase (created only by a verified webhook); totals, tax, provider fee, refunded amount, test flag | `UNIQUE (provider, provider_order_id)` |
| `order_item` | Product, license and price snapshot | |
| `webhook_event` | Every verified webhook with outcome/error and delivery count | `UNIQUE (provider, event_id)` → idempotency |
| `license` | Certificate: unique code, type, terms version, licensee name, revocation | `code` unique; one per order item |
| `entitlement` | Access to a product's files (from an order or a staff grant); revocable | |
| `download` | Each issued link: asset, version, salted IP hash, user agent (limits + support) | index (customer, time) |
| `refund_request` | Staff request → owner decision → provider confirmation; dashboard refunds recorded as completed rows | `UNIQUE (order_id, provider_refund_id)`; amount > 0 |

Not built from the Phase 0 design: `payment` (one payment per order, so totals live on `order`), `subscription` (no subscriptions sold yet), `revenue_record` (revenue is computed from `order`).

## Implemented (Phase 4)

| Change | Purpose |
|---|---|
| `sound_asset` | Stored sounds (`snd_…`): brand or shared, source (recorded/library/synthesized/ai), author, **license reference (required)**, who confirmed the rights, storage key, duration, loudness, retirement |
| `payment_provider` + `free` | Free products create a $0 order with provider `free`, so licenses and history work like purchases; excluded from revenue |
| `job_kind` + `catalog` | Catalog-writer jobs; the suggestion lives in the job result until a person applies it |

## Planned (Phase 5+)

Designed in `PHASE_0_REPORT.md` §8; added by migration as each phase begins:

- **Assets (later):** `sound_asset` (stored sounds with license records), `publishing_job`.
- **Commerce (later):** `subscription` (if memberships are sold), `revenue_record` (FX-normalized reporting once non-USD sales exist).
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
