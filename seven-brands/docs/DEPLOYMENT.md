# Deployment

Status: **nothing is deployed.** Provisioning any paid or public service needs owner approval.

## Target (approved D4)

| Piece | Service | Notes |
|---|---|---|
| Admin + storefront | Cloudflare Workers via OpenNext | Node-compatible runtime; verify `pg` over Neon's pooled connection or switch to Neon's serverless driver |
| Database | Neon Postgres (free tier to start) | Pooled `DATABASE_URL`; PITR backups |
| Private files | Cloudflare R2 bucket (private) | `STORAGE_DRIVER=s3`, endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto` |
| Worker | Fly.io machine or small VPS | Node 22 + **ffmpeg**; `pnpm --filter @sb/worker start`; needs the same DB and storage env as the admin plus `DAOS_*` AI variables |

Fallback if Workers compatibility blocks us: Vercel Pro or a single VPS (Docker Compose).

## Environment variables

See `.env.example`. Required in production: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32 chars), `ADMIN_BASE_URL`, `STORAGE_DRIVER=s3` + `S3_*`, `DEPLOY_ENV=production`, and the payment provider settings (`COMMERCE_PROVIDER` + `LEMONSQUEEZY_*` or `PADDLE_*`; see `PAYMENTS_SETUP.md`). Set secrets in the platform's secret store, never in files. Never set `COMMERCE_TEST_SECRET` on a public deployment. `COMMERCE_LIVE_PAYMENTS=enabled` is the owner's switch for real money, after the validation gate.

The storefront is one deployment for every brand: point each brand domain at it and list the domain in the brand's settings (admin → Brands). Webhook URL for the providers: `https://<any brand domain>/api/webhooks/<provider>`.

## Release steps

1. CI green (typecheck, unit/integration, E2E).
2. `pnpm db:migrate` against the target DB (forward-only).
3. `pnpm db:seed` (idempotent; never overwrites admin edits).
4. Deploy app. Check `GET /api/health` → 200 and the admin Infrastructure page.
5. First time only: `pnpm create-owner` with env-provided credentials.

## Local development (with worker)

```bash
./scripts/dev-db.sh                      # local Postgres + databases (or docker compose)
pnpm db:migrate && pnpm db:seed
pnpm --filter @sb/admin dev              # http://localhost:3100
pnpm --filter @sb/worker start           # runs queued jobs (Ctrl+C to stop); add --once to drain and exit
pnpm --filter @sb/storefront dev         # http://moodicons.localhost:3200 (each brand at <slug>.localhost)
```

With `COMMERCE_PROVIDER=test` and a `COMMERCE_TEST_SECRET`, checkout goes to a clearly labelled test page instead of a real provider. Use an absolute `STORAGE_FS_ROOT` so the admin, storefront and worker share files.

## Local development (Docker)

```bash
docker compose -f infrastructure/docker-compose.yml up -d   # Postgres 16 + MinIO (optional)
pnpm db:migrate && pnpm db:seed
pnpm --filter @sb/admin dev
```

## n8n (internal tool, optional — D7)

The repository root still contains n8n deployment files (`Dockerfile`, `render.yaml`). They now use the official image with no hard-coded credentials. Render's free plan has no persistent disk, so n8n data is lost on restart; use a paid instance with a disk, or run n8n on the Phase 2 worker VPS, if you decide to use it. n8n is licensed for internal business use only — never part of the product.
