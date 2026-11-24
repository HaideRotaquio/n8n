# API documentation

Base URL: the admin app origin (dev: `http://localhost:3100`). JSON in, JSON out.

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

## Versioning

Breaking changes go to `/api/v2`. The public developer API (AliveUI, Phase 7) will use API keys, not cookies.
