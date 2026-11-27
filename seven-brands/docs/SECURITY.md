# Security

## Implemented (Phase 1, covered by tests)

| Control | Implementation | Test |
|---|---|---|
| Password storage | Better Auth scrypt hashes; minimum 12 characters | auth.test |
| Sessions | HttpOnly, SameSite=Lax cookies; 7-day expiry, daily refresh; stored server-side | auth.test |
| Brute force | DB-backed rate limit: 5 sign-in attempts / min / IP; 100 req/min default | auth.test |
| No self-registration | `disableSignUp` on the admin; staff created by `create-owner` / provisioning | auth.test |
| RBAC | 7 roles × 27 permissions; brand-scoped grants never leak to other brands or company-wide actions | core.test, auth.test, e2e |
| Brand isolation (API) | Out-of-scope brands return 404, identical to missing | e2e |
| CSRF | SameSite cookies + Origin check on API writes; Next.js server actions verify origin | e2e |
| CORS | No credentialed CORS anywhere. Only cookie-free public data sends `Access-Control-Allow-Origin: *` (icon search/details, license verification). Account data, sessions, downloads, the files API and all admin APIs send no CORS headers, so other sites' scripts can't read them; foreign-origin sign-ins, downloads and admin writes are refused (403) | e2e: store "CORS…", admin cors.spec |
| Input validation | Zod on all writes; strict patch schema rejects unknown fields; font stacks and colors restricted to safe patterns (no CSS injection) | core.test, e2e |
| Audit trail | Every admin write logs actor, IP, user agent, before/after in the same transaction; DB trigger makes the log append-only | db.test |
| Download authorization | fs: HMAC-SHA256 signed, expiring URLs with constant-time verification; S3/R2: presigned URLs; expiry clamped 60–3600 s | storage.test |
| Path traversal | Storage keys validated segment-by-segment; fs driver re-checks the resolved path stays under root | storage.test |
| Headers | `X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions policy, `noindex` on admin | e2e |
| Secrets | Only via environment; `.env` git-ignored; `BETTER_AUTH_SECRET` / signing secret must be ≥ 32 chars or the app refuses to start | auth.test, storage.test |
| Privacy | Better Auth telemetry disabled | config |

## Implemented (Phase 2)

| Control | Implementation | Test |
|---|---|---|
| Untrusted SVG | Parsed, never re-emitted; allowlisted elements/attributes converted to AD; scripts, handlers, foreignObject, external refs, entities → hard reject | svg.test (7 attack cases) |
| Safe rendering | Renderer builds markup only from schema-validated numbers, hex colors and path data; browser player uses createElementNS/setAttribute with fixed names | asset.test, player.test (malicious JSON) |
| Embedded JSON | `<script>` payloads escape `<`, `>`, `&`, U+2028/9 | export.test |
| Asset integrity | Versions immutable (DB trigger) with sha256 checksums | production.test |
| Agent boundaries | Agents return typed data only; worker validates and stores drafts; no DB/secret/payment access; human approval required | agents.test, worker.test, e2e |
| AI spend | Daily/monthly caps checked before each call; every call booked as expense | worker.test |
| Key isolation | Provider reads only `DAOS_ANTHROPIC_*`; never the dev tooling's `ANTHROPIC_BASE_URL` | agents.test |
| Brand isolation | Jobs/exports refuse cross-brand assets; listings scoped | worker.test, e2e |

## Implemented (Phase 3)

| Control | Implementation | Test |
|---|---|---|
| Webhook authenticity | Lemon Squeezy HMAC of the raw body; Paddle HMAC of `ts:body` with a 60 s window and rotation support; constant-time comparison; invalid → 401, nothing stored | commerce.test |
| Idempotency | `webhook_event` unique per (provider, event id); orders unique per (provider, provider order id); refunds unique per (order, provider refund id); replays change nothing | commerce.test, db commerce.test |
| Price integrity | Prices come only from our DB at checkout time (`checkout_session`); the webhook must match provider, currency, test mode and at least the checkout amount, or nothing is granted | db commerce.test, commerce.test |
| Live-payment gate | Live credentials are refused unless `COMMERCE_LIVE_PAYMENTS=enabled`; the test provider is refused when `DEPLOY_ENV=production` and its orders never count as revenue | commerce.test |
| Entitlement checks | Every download re-checks ownership, revocation, product membership and a reviewer-approved deliverable version; customers can't reach other customers' items | db commerce.test, storefront e2e |
| Download abuse | 30/hour and 150/day per customer; every link logged with a salted IP hash; 5-minute signed URLs | db commerce.test |
| Refund approval | Support requests; only `order.refund` (owner) approves; money moves only after approval; full refund revokes license + access; all steps audited | db commerce.test, admin e2e |
| Brand isolation (storefront) | Brand from host only; unknown hosts 404; per-host auth instances and cookies | storefront e2e |
| License verification | Public endpoint returns initials only; 80-bit random codes make guessing impractical | db commerce.test, storefront e2e |
| Privacy | Marketing consent is opt-in with a timestamp; customers download all their data from their account | db commerce.test, storefront e2e |

## Implemented (Phase 4)

| Control | Implementation | Test |
|---|---|---|
| Sound rights | Every stored sound needs a source/license reference (DB check) and the uploader's confirmation, both audited; exports refuse assets whose stored sound is missing | worker.test, admin e2e |
| Upload limits | WAV only (16-bit PCM), ≤ 10 MB, ≤ 10 s, re-encoded by our code before storage (never served as uploaded) | audio.test |
| Free claims | Only published products with an active $0 price; one claim per customer; same license and download checks as purchases | db commerce.test, storefront e2e |
| AI copy | Catalog suggestions never change a product until a person applies them; spend caps apply | worker.test, admin e2e |
| Demo data | `demo:catalog` (auto-approves) refuses to run unless the database name ends in `_dev` or `test`, and when `DEPLOY_ENV=production` | code |
| Secrets in deploy files | `.env.*` git-ignored except the examples; images contain no secrets | config |

## Planned

- **SVG upload UI:** file type sniffing and size limits in front of the importer.
- **Customer account deletion** (right to erasure): needs a decision on keeping order/license records the law requires vs. anonymizing the person; export already exists.
- **Rate limit on the public license-verification endpoint** (not needed for secrecy, but cheap insurance against scraping load).
- **Before launch:** 2FA for staff (Better Auth plugin), Sentry, dependency audit in CI, backup restore drill, CSP header, external review of license terms.

## Known issues

- The n8n fork's old `admin` / `adminpass` credentials were removed from the files but remain in git history. They protected nothing deployed (the Render config was broken), but must never be reused.
- No CSP yet (Next.js inline scripts need a nonce setup); planned before launch.

## Reporting

Report suspected vulnerabilities privately to the owner; do not open public issues.
