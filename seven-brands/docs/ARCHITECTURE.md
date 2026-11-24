# Architecture

Status: Phase 1 implemented. Sections marked *(planned)* are designs, not code.

## Principles

1. **One platform, seven identities.** Shared code; brand differences live in configuration and brand-specific presentation components.
2. **Modular monolith first.** Next.js apps call domain packages directly. A background worker is added in Phase 2. More services only when load or isolation demands it.
3. **Every boundary is validated** with Zod: API input, brand config, asset definitions, agent I/O.
4. **Brand scoping in one place.** Repositories take an explicit brand scope; host → brand resolution comes from the `brand_domain` table, never from user input.
5. **Honest software.** Unbuilt features say so. No sample data presented as real.

## Package graph

```
@sb/core  ←  @sb/brands  ←  @sb/db  ←  @sb/auth  ←  apps/admin
   ↑                          ↑                        ↑
   └──────────── @sb/storage, @sb/ui ──────────────────┘
```

- `@sb/core` has no I/O and no dependencies except Zod. Everything else may depend on it.
- `@sb/db` owns all SQL. Apps never write raw queries; they call repositories (`listBrands`, `updateBrandConfig`, `grantRole`…).
- Packages ship TypeScript source (`exports` → `src/index.ts`); Next.js transpiles them (`transpilePackages`), Vitest and tsx run them directly. No build step for libraries.

## Runtime (today)

```
Browser ──HTTPS──▶ apps/admin (Next.js, Node runtime)
                      ├── /api/auth/*        Better Auth (sessions in Postgres, rate limits in Postgres)
                      ├── /api/v1/*          JSON API (session cookie, same-origin writes)
                      ├── server components  read via repositories
                      └── server actions     write via repositories (+ audit log in same transaction)
                                │
                        PostgreSQL 16        Object storage (fs in dev, R2/S3 in prod)
```

## Multi-brand model

- `brand` row = status, launch phase and `config` JSONB (validated `BrandConfig`).
- Code defaults in `brands/src/index.ts`; the seed creates missing brands and **never overwrites** admin edits.
- Admins may change only `BrandConfigPatch` fields (name, tagline, description, domains, audiences, channels, color tokens). Structural fields (slug, layout, fonts, features, licenses) change in code, under review and tests.
- *(Phase 4)* `apps/storefront`: one Next.js deployment. The request host resolves to a brand (`resolveBrandByHost`); the brand's layout family (`playful-grid`, `studio-dark`, …) selects distinct page compositions; theme tokens become CSS variables.

## Access control

- Identity: Better Auth `user`. Staff = users with ≥1 `user_role`. Customers = `customer` rows (one per user per brand).
- Grants are `(role, brandId | null)`. `can(grants, permission, brandId?)` is a pure function in `@sb/core`:
  - no `brandId` → only global grants count (company-wide actions);
  - with `brandId` → global grants plus grants on that brand;
  - `canAny` → section-level gating (data must still be brand-scoped).
- Company-wide pages (team, audit, infrastructure) require global grants.

## Planned components (Phases 2–4)

| Component | Package | Notes |
|---|---|---|
| Asset Definition schema | `packages/asset-schema` | Canonical JSON: layers, tokens, timeline, sounds, interactions, a11y |
| SVG engine | `packages/svg-engine` | parse → allowlist rebuild → SVGO → validate |
| Motion runtime | `packages/motion-runtime` | ~3–5 KB spring/keyframe runtime + Web Component |
| Audio engine | `packages/audio-engine` | Web Audio playback, offline synth, loudness normalization |
| Export engine | `packages/export-engine` | SVG, Web Component, React, PNG, GIF, MP4, WebM, Lottie, ZIP |
| Worker | `services/worker` | pg-boss jobs: production, export, publishing; Chromium + ffmpeg |
| Agents | `packages/agents` | Typed agents behind a provider interface (see AI_AGENT_ARCHITECTURE.md) |
| Commerce | `packages/commerce` | Merchant-of-Record adapter, webhooks, entitlements, licenses |
| Storefront | `apps/storefront` | Multi-tenant, host-routed |

## Key technology decisions

| Decision | Choice | Why |
|---|---|---|
| ORM | Drizzle 0.45 | SQL-transparent, no engine binary, edge-compatible |
| Auth | Better Auth 1.7 | Self-hosted, no per-user fees, Postgres-backed sessions and rate limits |
| Web | Next.js 16 + React 19 + Tailwind 4 | SSR for SEO, server actions, one stack for admin and storefronts |
| Queue *(P2)* | pg-boss | No Redis to pay for or run |
| TypeScript | 5.9 | TS 7 (native) is out, but Next.js tooling still targets the 5.x API |
