# Testing strategy

| Layer | Tool | Runs against | Where |
|---|---|---|---|
| Unit | Vitest | Pure functions | `packages/core`, `brands` |
| Integration | Vitest | Real PostgreSQL (`daos_test`, schema reset per file) | `packages/db`, `packages/auth` |
| Storage contract | Vitest | Local disk + moto S3 emulator | `packages/storage` |
| Browser component | Vitest + Playwright library | Real Chromium | `packages/player` |
| Media | Vitest + ffprobe | Real ffmpeg/resvg output | `packages/export` |
| Contract | Vitest | Local fake Anthropic API (request shape, parsing, errors) | `packages/agents` |
| Provider contract | Vitest | Recorded request shapes and signed payloads for Lemon Squeezy and Paddle (shapes taken from their official SDKs) through the real webhook handler and Postgres | `packages/commerce` |
| End-to-end | Playwright | Production builds of the admin (+ the real worker) and the storefront (host-routed, `*.localhost`), real Postgres (`daos_e2e_test`), labelled test payment provider | `apps/admin/e2e`, `apps/storefront/e2e` |

Current count (2026-11-24): **268 unit/integration/browser (+3 S3 tests that need the moto emulator) + 23 E2E (18 admin, 5 storefront), all passing.**

Not covered by automated tests: real calls to Lemon Squeezy and Paddle. Their adapters are tested against the request/response shapes of the official SDKs, but no sandbox account exists yet; see `PAYMENTS_SETUP.md` for the manual check once one does.

## Rules

1. **No mocked databases.** DB behavior (constraints, triggers, transactions) is part of what we test.
2. **Test isolation by database name.** `createTestDb()` refuses to reset any database whose URL doesn't contain `test`.
3. **Skipped is reported as skipped.** S3 tests skip only when the emulator isn't available; CI always installs it.
4. **No silent fakes.** The AI fixture provider is explicit (`DAOS_AI_PROVIDER=fixture`) and its assets are labelled “not AI” in the UI.
5. **Security properties get tests:** cross-brand access, CSRF, rate limiting, append-only audit, signed URL tampering, malicious SVG/JSON.
6. **Every bug fix adds a test.** Examples: brand-scoped staff locked out of the dashboard (Phase 1); viewer rendering at native 64 px instead of the chosen size (Phase 2).

## Coverage by blueprint requirement

| Requirement | Status |
|---|---|
| Database operations | ✅ db.test |
| Authentication | ✅ auth.test, e2e |
| Authorization | ✅ core.test, auth.test, e2e |
| Brand separation | ✅ db.test, e2e |
| SVG rendering, animation, audio, export | ✅ asset, audio, svg-engine, player (browser), export (ffprobe), e2e |
| Checkout, downloads, licensing | ✅ commerce.test (signatures, replays, mismatches), db commerce.test, storefront e2e (buy → licensed ZIP → verify), admin e2e (publish, refund approval) |

## Commands

```bash
pnpm test                    # all unit/integration
pnpm e2e                     # build + Playwright (admin, then storefront)
MOTO_SERVER_BIN=$(which moto_server) pnpm test   # include S3 tests locally
```
