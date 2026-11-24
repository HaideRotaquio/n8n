# Testing strategy

| Layer | Tool | Runs against | Where |
|---|---|---|---|
| Unit | Vitest | Pure functions | `packages/core`, `brands` |
| Integration | Vitest | Real PostgreSQL (`daos_test`, schema reset per file) | `packages/db`, `packages/auth` |
| Storage contract | Vitest | Local disk + moto S3 emulator | `packages/storage` |
| End-to-end | Playwright | Production build of the admin + real Postgres (`daos_e2e_test`) | `apps/admin/e2e` |

Current count (2026-11-24): **79 unit/integration + 10 E2E, all passing.**

## Rules

1. **No mocked databases.** DB behavior (constraints, triggers, transactions) is part of what we test.
2. **Test isolation by database name.** `createTestDb()` refuses to reset any database whose URL doesn't contain `test`.
3. **Skipped is reported as skipped.** S3 tests skip only when the emulator isn't available; CI always installs it.
4. **Security properties get tests:** cross-brand access, CSRF, rate limiting, append-only audit, signed URL tampering.
5. **Every bug fix adds a test.** (Phase 1 example: brand-scoped staff were locked out of the dashboard; the E2E brand-manager tests now cover it.)

## Coverage by blueprint requirement

| Requirement | Status |
|---|---|
| Database operations | ✅ db.test |
| Authentication | ✅ auth.test, e2e |
| Authorization | ✅ core.test, auth.test, e2e |
| Brand separation | ✅ db.test, e2e |
| SVG rendering, animation, audio, export | Phase 2 (unit + Playwright visual snapshots) |
| Checkout, downloads, licensing | Phase 3 (provider test mode + webhook replay tests) |

## Commands

```bash
pnpm test                    # all unit/integration
pnpm e2e                     # build + Playwright
MOTO_SERVER_BIN=$(which moto_server) pnpm test   # include S3 tests locally
```
