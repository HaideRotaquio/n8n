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
| Input validation | Zod on all writes; strict patch schema rejects unknown fields; font stacks and colors restricted to safe patterns (no CSS injection) | core.test, e2e |
| Audit trail | Every admin write logs actor, IP, user agent, before/after in the same transaction; DB trigger makes the log append-only | db.test |
| Download authorization | fs: HMAC-SHA256 signed, expiring URLs with constant-time verification; S3/R2: presigned URLs; expiry clamped 60–3600 s | storage.test |
| Path traversal | Storage keys validated segment-by-segment; fs driver re-checks the resolved path stays under root | storage.test |
| Headers | `X-Frame-Options: DENY`, `nosniff`, strict referrer, permissions policy, `noindex` on admin | e2e |
| Secrets | Only via environment; `.env` git-ignored; `BETTER_AUTH_SECRET` / signing secret must be ≥ 32 chars or the app refuses to start | auth.test, storage.test |
| Privacy | Better Auth telemetry disabled | config |

## Planned

- **Phase 2:** SVG allowlist sanitizer (no `script`, `foreignObject`, `on*`, external `href`, CSS `url()`/`@import`); untrusted SVG previewed via `<img>` or sandboxed iframe only; upload type sniffing and size limits; agent permission boundaries (see AI_AGENT_ARCHITECTURE.md).
- **Phase 3:** payment webhook signature verification + idempotency table; entitlement checks before every download URL; license verification endpoint; GDPR / PH Data Privacy Act export and deletion.
- **Before launch:** 2FA for staff (Better Auth plugin), Sentry, dependency audit in CI, backup restore drill, CSP header, external review of license terms.

## Known issues

- The n8n fork's old `admin` / `adminpass` credentials were removed from the files but remain in git history. They protected nothing deployed (the Render config was broken), but must never be reused.
- No CSP yet (Next.js inline scripts need a nonce setup); planned before launch.

## Reporting

Report suspected vulnerabilities privately to the owner; do not open public issues.
