# Changelog

All notable changes to the Seven Brands platform. Dates are UTC.

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
