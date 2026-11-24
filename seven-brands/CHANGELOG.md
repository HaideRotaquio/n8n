# Changelog

All notable changes to the Seven Brands platform. Dates are UTC.

## [0.3.0] — 2026-11-24 — Phase 3: Commerce

### Added
- DB (migration 0004): product, product_asset, price, collection, collection_product, checkout_session, order, order_item, webhook_event, license, entitlement, download, refund_request.
- Catalog: single and pack products, a price per license type, collections; publishing needs `asset.publish` and reviewer-approved, exported assets. Buyers get each asset's newest approved version; unreviewed versions never reach them.
- `@sb/commerce`: provider-neutral `PaymentProvider` with **Lemon Squeezy** (test mode) and **Paddle Billing** (sandbox) adapters, following their official SDKs' formats; a labelled test provider for development and E2E. Signed webhooks (HMAC, Paddle timestamp window and secret rotation), idempotent processing, and payments checked against our own checkout session (amount, currency, provider, test mode) before anything is granted.
- Licenses: unique verifiable codes (`MOOD-XXXX-…`, 80 random bits), terms version on every license, draft plain-language terms per license type, `LICENSE.txt` with the buyer's name and code in every downloaded ZIP.
- `apps/storefront`: one app for all brands (brand from host, themed from brand config); customer sign-up/sign-in with opt-in marketing consent; product pages with license choice; checkout; library with signed, rate-limited downloads (30/h, 150/day); order history; license certificate page; public license verification page + `GET /api/v1/licenses/verify`; customer data export; webhooks at `/api/webhooks/:provider`; Paddle.js checkout page.
- Admin: Product catalog (create, price, publish, archive, collections), Orders (refund request → owner approval → provider refund), Customers, Licenses (search, revoke), Revenue (net of tax, fees and refunds; live orders only) with provider status and webhook log.
- Safety switches: live credentials refused unless `COMMERCE_LIVE_PAYMENTS=enabled`; test provider refused when `DEPLOY_ENV=production`.
- docs/PAYMENTS_SETUP.md: step-by-step test-mode setup for both providers.
- Tests: 268 unit/integration/browser (+3 S3 tests needing moto) and 23 E2E (18 admin, 5 storefront).

### Changed
- Admin section placeholders now start at Phase 4; `/orders`, `/catalog`, `/customers`, `/licenses`, `/revenue` are real pages.
- `pnpm e2e` builds and tests both apps.
- `.env.example`: `STORAGE_FS_ROOT` must be absolute so the admin, storefront and worker share files.

### Not yet done
- No purchase through a real Lemon Squeezy or Paddle sandbox: the accounts don't exist yet.
- Moved to Phase 4: catalog/metadata agent, Lottie export, stored sound library.
- Customer account deletion (export exists); rate limit on the public license-verification endpoint.
- Live AI production test: still waiting for Anthropic API credits.

## [0.2.0] — 2026-11-24 — Phase 2: Production engine

### Added
- `@sb/asset`: Asset Definition v1 (Zod), motion evaluator (cubic-bezier + analytic springs), frame and CSS-animated SVG rendering, automated QA with scoring, format capability table.
- `@sb/audio`: 10 procedural sound presets (owned, deterministic), BS.1770 loudness, normalization (−16 LUFS, −1 dBFS ceiling), mixer, WAV codec.
- `@sb/svg-engine`: allowlist importer for untrusted SVG; rejects active content.
- `@sb/player`: browser player and `<daos-asset>` Web Component (19 KB); audio scheduled on the Web Audio clock; reduced-motion aware.
- `@sb/export`: SVG (static/animated/hover), PNG, GIF, MP4 (H.264+AAC), WebM (VP9 alpha+Opus), WAV + cue sheet, Web Component, React, JSON, ZIP with README and preview license.
- `@sb/rigs`: Moodicons face rig (9 expressions × 4 palettes), SonicGlyphs line glyphs (8 × 3).
- `@sb/agents`: provider interface, Anthropic adapter (structured outputs, refusal fallback, prompt caching, cost tracking), fixture provider, creative director → SVG artist → animator pipeline with repair rounds.
- `services/worker`: table-backed job queue (rig / ai / export), retries, stale recovery, budget caps.
- DB: asset, asset_version (immutable), quality_review, export_artifact, production_job, agent_task, expense.
- Admin: asset library, Universal Viewer, human review, exports with signed downloads, production factory, job detail, AI agent runs, QA queue, expenses.
- Tests: 243 unit/integration/browser + 15 E2E.

### Changed
- Job queue uses Postgres directly instead of pg-boss (documented in ARCHITECTURE.md).
- `@sb/core` ids use Web Crypto (browser-safe).

### Not yet done
- No live Anthropic call has been made: it needs `DAOS_ANTHROPIC_API_KEY` in the environment.
- Lottie export and stored sounds moved to Phase 3.

## [0.1.0] — 2026-11-24 — Phase 1: Foundation

### Added
- pnpm + Turborepo monorepo under `seven-brands/` (isolated from the n8n fork it lives in).
- `@sb/core`: Zod `BrandConfig` schema, admin-patchable subset, theme → CSS variables, WCAG contrast checks, prefixed ULID ids, RBAC (7 roles, 27 permissions, global and brand-scoped grants).
- `@sb/brands`: identities for all seven brands (palette, fonts, layout family, motion personality, categories, audiences, channels, licenses). All pass WCAG AA text contrast.
- `@sb/db`: PostgreSQL schema (organization, brand, brand_domain, Better Auth tables, rate_limit, role/permission, user_role, customer, audit_log), migrations, idempotent seed, repositories. Audit log is append-only, enforced by a database trigger.
- `@sb/auth`: Better Auth (email + password, scrypt hashing, 7-day sessions, DB-backed rate limiting: 5 sign-ins/min), staff context, permission guards, `create-owner` CLI. Public sign-up disabled for the admin.
- `@sb/storage`: storage interface with local-disk driver (HMAC-signed, expiring download URLs) and S3-compatible driver (presigned URLs) for Cloudflare R2 / S3 / MinIO.
- `@sb/ui`: shared themed React primitives.
- `apps/admin`: login, overview, brand list, brand editor (settings, color tokens, live theme preview, contrast check, status), team & roles, audit log, infrastructure checks, honest placeholders for the 12 sections scheduled for later phases.
- API: `GET /api/health`, `GET /api/v1/brands`, `GET|PATCH /api/v1/brands/:slug`, `/api/auth/*`, `/api/storage/download`.
- Tests: 79 unit/integration tests (real Postgres; S3 driver tested against the moto emulator) and 10 Playwright end-to-end tests.
- CI workflow (`.github/workflows/seven-brands.yml`) limited to changes under `seven-brands/`.
- The 14 required project documents.

### Changed (repository root, n8n deployment files)
- Renamed `Dockerfiler` → `Dockerfile` so `render.yaml` can find it.
- Removed the hard-coded `admin` / `adminpass` credentials and the obsolete `N8N_BASIC_AUTH_*` variables. The old password is still in git history; treat it as public.

### Decisions (approved 2026-11-24)
D1 code in `seven-brands/` on this branch · D2 one multi-tenant storefront app · D3 Drizzle · D4 Cloudflare + Neon + R2 · D5 Merchant of Record, test mode first · D6 no domain purchases yet · D7 n8n internal-only · D8 Anthropic key at Phase 2.

## [0.0.1] — 2026-11-24 — Phase 0: Discovery
- `docs/PHASE_0_REPORT.md`: repository inspection, architecture, cost model, risks, MVP definition.
