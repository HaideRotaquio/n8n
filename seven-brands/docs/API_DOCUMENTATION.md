# API documentation

Two apps serve HTTP: the **admin** (dev `http://localhost:3100`, staff only) and the **storefront** (one deployment, brand chosen by host, dev `http://moodicons.localhost:3200`). JSON in, JSON out. Sections below are admin endpoints unless marked *storefront*.

## Authentication

Session cookie (`better-auth.session_token`, HttpOnly, SameSite=Lax) obtained via:

```
POST /api/auth/sign-in/email   {"email": "...", "password": "..."}   → 200 + Set-Cookie
POST /api/auth/sign-out
GET  /api/auth/get-session
```

Sign-in is limited to 5 attempts per minute per IP (429 after that). Public sign-up is disabled on the admin.

State-changing requests must be same-origin: a request carrying an `Origin` header that doesn't match the admin origin gets `403 bad_origin`.

## Errors

```json
{ "error": { "code": "validation_error", "message": "Invalid request", "issues": [ … ] } }
```

| Status | code | Meaning |
|---|---|---|
| 400 | `validation_error` | Body failed schema validation; `issues` lists fields |
| 401 | `unauthorized` | Not signed in (or not staff) |
| 403 | `forbidden` / `bad_origin` | Missing permission / cross-site write |
| 404 | `not_found` | Missing **or outside your brand scope** (same answer for both, so brand existence isn't leaked) |
| 500 | `internal` | Logged server-side; no details returned |

## Endpoints

### `GET /api/health`
Public. `200 {"status":"ok","db":"ok"}` or `503 {"status":"degraded","db":"unreachable"}`. Reveals no configuration.

### `GET /api/v1/brands`
Brands visible to the caller (`brand.read`, global or per brand).
```json
{ "data": [ { "id": "brd_…", "slug": "moodicons", "name": "Moodicons", "status": "in_development", "launchPhase": 4 } ] }
```

### `GET /api/v1/brands/:slug`
Full brand row including `config`.

### `PATCH /api/v1/brands/:slug`
Requires `brand.update` on that brand. Body: any subset of
`name, tagline, description, domains[], audiences[], marketingChannels[], theme.tokens{8 colors}`.
Unknown fields (e.g. `slug`, `layout`) → 400. Domains already used by another brand → 400. Writes an `audit_log` entry in the same transaction.

### `GET /api/storage/download?key&exp&fn&sig`
Only active with the local `fs` storage driver. Serves a file if the HMAC signature is valid and unexpired (60–3600 s). With R2/S3, clients use presigned URLs from the store directly.

## Storefront endpoints (Phase 3)

The brand always comes from the request host (`brand_domain`); unknown hosts get 404. Sessions are per host, so a sign-in at one brand never carries over to another. Customer sign-up is open (`POST /api/auth/sign-up/email`, 12-character minimum, 5 attempts/min).

### `POST /api/webhooks/:provider` (*storefront*)
`:provider` = `lemonsqueezy` | `paddle` (| `test` locally). One endpoint serves every brand: the order's brand comes from our own checkout session, which the provider echoes back as custom data (`checkout_id`).

| Response | When |
|---|---|
| `200 {"ok":true,"outcome":"fulfilled"}` | Paid event matched our checkout: order, license and entitlement created |
| `200 {"ok":true,"outcome":"duplicate"}` | Event already processed (idempotent replay) |
| `200 {"ok":false,"outcome":"rejected","error":…}` | Signature valid but the payment doesn't match our checkout (amount, currency, provider, test mode). Nothing granted; visible in admin → Revenue → Recent webhooks |
| `200 {"ok":true,"outcome":"refund_applied" \| "refund_unchanged"}` | Refund recorded (full refund revokes the license) |
| `401 {"outcome":"bad_signature"}` | Signature or timestamp invalid. Nothing stored |
| `404` | Provider not configured on this server |
| `500` | Unexpected error; the provider retries |

Signatures: Lemon Squeezy `X-Signature` = hex HMAC-SHA256(raw body). Paddle `Paddle-Signature: ts=…;h1=…` = HMAC-SHA256(`ts:raw body`), 60-second tolerance, several `h1` accepted during secret rotation.

### `POST /api/downloads` (*storefront*, signed-in customer)
Form fields `entitlementId`, `assetId`. Checks the entitlement is the caller's and not revoked, the asset belongs to the product, a reviewer-approved exported version exists, and limits (30/hour, 150/day per customer). Responds `303` to a 5-minute signed URL for a ZIP whose `LICENSE.txt` carries the buyer's license; on refusal `303 /account?error=not_entitled|not_in_product|not_ready|rate_limited`. Cross-site `Origin` → 403.

### `GET /api/v1/licenses/verify?code=MOOD-XXXX-XXXX-XXXX-XXXX` (*storefront*, public)
```json
{ "valid": true, "status": "active", "brand": "Moodicons", "product": "Beating Heart", "licenseType": "commercial", "termsVersion": "2026-11-draft-1", "issuedAt": "2026-11-24T…", "licensee": "A. L." }
```
`status` is `active`, `revoked` or `not_found`; malformed codes → `400 {"status":"invalid_format"}`. Look-alike characters (O/0, I/L/1) are normalized. Only the licensee's initials are returned. CORS-open so customers' clients can check a code.

### `GET /account/data` (*storefront*, signed-in customer)
Everything held about the customer for that brand (account, orders, licenses, downloads) as a JSON attachment — the data-access request required by GDPR and the Philippine Data Privacy Act.

### `GET /api/storage/download` (*storefront*)
Same signed-URL route as the admin's, for the `fs` driver.

## Versioning

Breaking changes go to `/api/v2`. The public developer API (AliveUI, Phase 7) will use API keys, not cookies.
