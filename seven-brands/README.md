# Seven Brands — Digital Asset Operating System (DAOS)

One parent company, seven independent brands of interactive digital assets, one shared platform.

| Brand | Category | Status |
|---|---|---|
| Moodicons | Emotional and expressive animated icons | In development (Phase 4) |
| SonicGlyphs | Audio-reactive animated icons | In development (Phase 4) |
| CineGlyphs | Cinematic icons and audiovisual effects | Planned (Phase 5) |
| AtmosIcons | Environmental and atmospheric assets | Planned (Phase 5) |
| ShopMotion | Interactive ecommerce assets | Planned (Phase 6) |
| LearnIcons | Educational interactive icons | Planned (Phase 6) |
| AliveUI | Interactive UI components | Planned (Phase 7) |

**Current state: Phase 2 (Production engine) complete.** See [CHANGELOG.md](CHANGELOG.md) for what exists and [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) for what comes next. Nothing is deployed or selling yet.

## What's here

```
apps/admin/        DAOS admin (Next.js 16) — brands, asset library + Universal Viewer, production, agents, QA, expenses, team, audit
services/worker/   Background worker: rig, AI and export jobs (needs ffmpeg)
brands/            Code-level identity + config for all seven brands
packages/core/     Domain logic: brand config schema, RBAC, ids, errors (no I/O)
packages/db/       PostgreSQL schema (Drizzle), migrations, seed, repositories
packages/auth/     Better Auth setup, staff context, permission guards, create-owner CLI
packages/storage/  Private file storage: local fs driver + S3/R2 driver, signed download URLs
packages/ui/       Shared React primitives themed by CSS variables
packages/asset/    Asset Definition schema, motion engine, renderer, QA
packages/audio/    Procedural sounds, loudness, mixing, WAV
packages/svg-engine/  Safe importer for untrusted SVG
packages/player/   Browser player + <daos-asset> Web Component
packages/export/   SVG/PNG/GIF/MP4/WebM/WAV/React/Web Component/ZIP exports
packages/rigs/     Parametric generators (Moodicons faces, SonicGlyphs glyphs)
packages/agents/   AI providers (Anthropic, fixtures) and the production pipeline
infrastructure/    docker-compose for local Postgres + MinIO
docs/              Architecture, schema, security, costs, roadmap… (14 documents)
```

## Quick start (local)

Requirements: Node 22+, pnpm 10, ffmpeg, PostgreSQL 16 (`./scripts/dev-db.sh` or `docker compose -f infrastructure/docker-compose.yml up -d`).
AI jobs need `DAOS_ANTHROPIC_API_KEY` (see docs/AI_AGENT_ARCHITECTURE.md); everything else works without it.

```bash
cd seven-brands
pnpm install
cp .env.example .env                 # then fill BETTER_AUTH_SECRET and STORAGE_SIGNING_SECRET:
                                     #   openssl rand -base64 32
pnpm db:migrate && pnpm db:seed      # creates tables and the seven brands
OWNER_EMAIL=you@example.com OWNER_NAME="You" OWNER_PASSWORD='a-long-passphrase' pnpm create-owner
pnpm --filter @sb/admin dev          # http://localhost:3100
pnpm --filter @sb/worker start       # second terminal: runs production jobs (needs ffmpeg)
```

## Tests

```bash
pnpm typecheck
pnpm test        # unit + integration (needs Postgres; DB tests use the `daos_test` database)
pnpm e2e         # builds the admin app and runs Playwright against a fresh `daos_e2e_test` database
```

S3 driver tests run when `MOTO_SERVER_BIN` points at a `moto_server` binary (`pip install "moto[server]"`); otherwise they are skipped and reported as skipped.

## Documentation

[Business plan](docs/BUSINESS_PLAN.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/DEVELOPMENT_ROADMAP.md) · [Database](docs/DATABASE_SCHEMA.md) · [API](docs/API_DOCUMENTATION.md) · [Production pipeline](docs/PRODUCTION_PIPELINE.md) · [AI agents](docs/AI_AGENT_ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Cost model](docs/COST_MODEL.md) · [Brand guidelines](docs/BRAND_GUIDELINES.md) · [Testing](docs/TESTING_STRATEGY.md) · [Phase 0 report](docs/PHASE_0_REPORT.md)
