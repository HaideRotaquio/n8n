# Deployment

Status: **nothing is deployed.** Provisioning any paid or public service needs owner approval.

## Target (approved D4)

| Piece | Service | Notes |
|---|---|---|
| Admin + storefront | Cloudflare Workers via OpenNext | Node-compatible runtime; verify `pg` over Neon's pooled connection or switch to Neon's serverless driver |
| Database | Neon Postgres (free tier to start) | Pooled `DATABASE_URL`; PITR backups |
| Private files | Cloudflare R2 bucket (private) | `STORAGE_DRIVER=s3`, endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto` |
| Worker (Phase 2) | Fly.io machine (scale to zero) or small VPS | Chromium + ffmpeg |

Fallback if Workers compatibility blocks us: Vercel Pro or a single VPS (Docker Compose).

## Environment variables

See `.env.example`. Required in production: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32 chars), `ADMIN_BASE_URL`, `STORAGE_DRIVER=s3` + `S3_*`. Set secrets in the platform's secret store, never in files.

## Release steps

1. CI green (typecheck, unit/integration, E2E).
2. `pnpm db:migrate` against the target DB (forward-only).
3. `pnpm db:seed` (idempotent; never overwrites admin edits).
4. Deploy app. Check `GET /api/health` → 200 and the admin Infrastructure page.
5. First time only: `pnpm create-owner` with env-provided credentials.

## Local development

```bash
docker compose -f infrastructure/docker-compose.yml up -d   # Postgres 16 + MinIO (optional)
pnpm db:migrate && pnpm db:seed
pnpm --filter @sb/admin dev
```

## n8n (internal tool, optional — D7)

The repository root still contains n8n deployment files (`Dockerfile`, `render.yaml`). They now use the official image with no hard-coded credentials. Render's free plan has no persistent disk, so n8n data is lost on restart; use a paid instance with a disk, or run n8n on the Phase 2 worker VPS, if you decide to use it. n8n is licensed for internal business use only — never part of the product.
