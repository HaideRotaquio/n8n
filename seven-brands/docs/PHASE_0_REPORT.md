# SEVEN BRANDS — Phase 0 Discovery & Architecture Report

Status: **Draft for approval** · Date: 2026-11-24 · Scope: Phase 0 (no production code written)

Prices below are list prices as known at the time of writing. **Every price must be re-verified on the vendor's site before anything is purchased.** Nothing has been purchased, provisioned or published.

---

## 1. Repository inspection

### 1.1 What this repository is

| Item | Finding |
|---|---|
| Repo | `haiderotaquio/n8n` — a fork of the n8n workflow-automation platform |
| Upstream version | n8n `1.104.0` (≈ July 2025, ~16 months behind upstream) |
| Owner commits | 2 files only: `render.yaml`, `Dockerfiler` |
| Stack | pnpm + Turborepo monorepo, TypeScript, Vue 3 frontend, TypeORM backend |
| License | **Sustainable Use License** (fair-code, not open source) + Enterprise license for `*.ee.*` files |
| Seven Brands code | None exists yet |

### 1.2 Problems found in the owner's existing deployment files

1. **Broken deploy** — `render.yaml` points to `./Dockerfile`, but the file is named `Dockerfiler`. Render would fail to build.
2. **Committed credentials** — `admin` / `adminpass` are hard-coded in both files and are public in git history. Treat that password as burned.
3. **Obsolete settings** — `N8N_BASIC_AUTH_*` was removed in n8n 1.0 (replaced by built-in user management), so these variables do nothing.
4. **Data loss** — Render's free web service has no persistent disk. n8n's SQLite database, saved workflows, credentials and encryption key would be wiped on every restart or redeploy. The service also sleeps after inactivity, so webhooks and schedules don't fire reliably.
5. **Placeholder URL** — `WEBHOOK_URL=https://n8n-yourname.onrender.com/` is still the template value.

### 1.3 Can we reuse n8n code? — **No (license), but we can use n8n**

- The Sustainable Use License allows use **only for your own internal business purposes** or non-commercial use. Copying n8n source into a commercial storefront or product we sell is outside that grant. `*.ee.*` files need a paid enterprise license.
- Technically it doesn't fit either: n8n's UI is Vue (our target is React) and its domain (workflow nodes) is unrelated.
- **Legitimate use:** run the *official* n8n Docker image (not this fork) as an **internal operations tool** — social posting queues, Slack/email alerts, weekly reports, CRM syncs. That is internal business use and is allowed. It is optional and comes after the MVP.

### 1.4 Development environment (this cloud container)

| Tool | Available |
|---|---|
| Node.js | 22.23.5 |
| pnpm / npm | 10.12.1 / 10.9.9 |
| PostgreSQL client + server | 16.15 |
| Redis | yes |
| Docker | 29.9.3 |
| ffmpeg | 6.1.1 (needed for GIF/MP4 export) |
| Chromium + Playwright | pre-installed (needed for frame rendering and E2E tests) |
| Python | 3.x |
| Resources | 4 vCPU, 15 GB RAM |
| API keys | **None configured** (no Anthropic, payment, storage or DB credentials). The AI factory and checkout can be built and tested with fixtures, but they can't run live until you supply keys. |

### 1.5 Recommendation on where the code lives

The Seven Brands platform should live in a **new, dedicated repository** (e.g. `seven-brands`), not inside this n8n fork, because:

- n8n's root `pnpm-workspace.yaml`, Turborepo pipeline, lint/commit hooks and ~2 GB `node_modules` would bleed into our build.
- The license notice at the root of this repo would create confusion about what is licensed how.
- A clean history makes due diligence, contractor onboarding and any future sale of a brand easier.

I can't create repositories from this session. **Action for you:** create an empty private repo on GitHub (e.g. `haiderotaquio/seven-brands`) and tell me its name; I will attach it and start Phase 1 there. Until then this report lives on branch `ccr-1805ee39-daequu` under `seven-brands/docs/`.

---

## 2. Business viability assessment (honest view)

### 2.1 The market is real but crowded

Animated icons already exist at scale: LottieFiles (very large free library), Lordicon, Icons8 animated icons, Flaticon animated, useAnimations, Rive community files, and many free GitHub icon packs. **Generic animated icons are close to a commodity.** We should not compete on "more icons".

### 2.2 Where we can actually differentiate

1. **Motion + synchronized sound as one package.** Very few libraries ship icons where the sound is designed with the motion, with timing cues already wired up for web, video and apps. This is SonicGlyphs' and CineGlyphs' core.
2. **No-code customization → multi-format export in one click** (colors, size, speed, sound on/off → SVG, GIF, MP4-with-audio, Lottie, React, Web Component).
3. **Parametric "rigs" instead of one-off drawings.** One Moodicons face rig (eyes, brows, mouth, cheeks, accessories) can produce hundreds of consistent expressions. Consistency is exactly where AI-generated icon packs usually fail, and rigs make production cheap.
4. **Clear, plain-language licensing** — a real pain point on competing marketplaces.
5. **Vertical packaging** — "Shopify checkout animations", "teacher phonics set", "YouTube intro sound-icons" sell to a job to be done rather than as a generic library.

### 2.3 Key business risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Seven brands split focus and marketing budget | Each brand needs its own audience and channel work | Shared platform (cost of brand #3–7 is mostly content and marketing). **Do not open brand 3 until brands 1–2 show paying customers.** |
| Low price points vs. fixed payment fees | A $3 sale with a 5% + $0.50 fee loses ~22% to fees | Minimum single-item price ≈ $5; push bundles, packs and lifetime access |
| AI-generated art is weak on copyright | In the US, purely AI-generated images aren't copyrightable, so competitors may copy | Human art direction and editing on every published asset, a documented authorship trail, and value built on rigs, sound and tooling rather than single files |
| Brand names may already be trademarked | "AliveUI", "Moodicons", etc. may conflict | Trademark and domain search **before** buying domains (Phase 1 checklist item) |
| LearnIcons is child-adjacent | COPPA (US), GDPR-K (EU) and Philippine Data Privacy Act duties | Sell to parents, teachers and schools only; no child accounts; no tracking on child-facing previews |
| Payment availability in the Philippines | **Stripe does not onboard Philippine-registered businesses** (verify current status) | Use a Merchant of Record (see §7) |

### 2.4 Validation before building more

Before Phase 5, each launched brand should hit explicit, measurable thresholds, for example:
- ≥ 1,000 store visitors from the target channel,
- ≥ 2% email/free-pack conversion,
- ≥ 20 paid orders, and
- refund rate < 5%.

Those numbers are initial hypotheses for you to adjust. The point is that "storefront finished" is not "business validated".

---

## 3. Technology stack — evaluation and decisions

| Concern | Recommendation | Why / alternatives considered |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Already in the toolchain here; fast; standard |
| Language | **TypeScript (strict)** end to end | One language for storefronts, API, workers and agents |
| Web framework | **Next.js (App Router) + React** | As briefed; SSR/ISR for product SEO is important for discovery |
| Styling | **Tailwind CSS + CSS variables (design tokens) per brand** | Themes switch by tokens; brand layouts are separate components (see §5) |
| DB | **PostgreSQL** | As briefed |
| ORM | **Drizzle ORM** (recommended) — Prisma acceptable | Drizzle is SQL-transparent, light, runs on edge and serverless runtimes without an engine binary, and makes row-level filters explicit. Prisma has nicer migration UX. Low-risk, reversible choice; I'll use Drizzle unless you prefer Prisma. |
| Background jobs | **pg-boss (Postgres-backed queue)** | No Redis bill; jobs are transactional with the data. Move to a dedicated queue only if volume demands it. |
| Auth | **Better Auth** (open source, self-hosted, in our DB) | No per-user fees (Clerk/Auth0 get expensive at scale); supports email/password, magic link, OAuth, organizations and roles |
| Validation | **Zod** at every boundary (API, agent I/O, asset definitions) | One schema serves as type, runtime validator and LLM structured-output schema |
| Animation runtime | **Our own small spring/keyframe runtime (~3–5 KB)** + Web Animations API; **Motion (motion.dev, MIT)** for storefront UI only | Exported customer assets must be dependency-free and licensable. GSAP is now free but its license has use restrictions; avoid it inside products we resell. |
| Lottie | **lottie-web (MIT)** for preview; our own compiler emits Lottie JSON | Lottie export works only for assets authored in our timeline model (see §4) |
| Audio | **Web Audio API**; offline synthesis for UI and notification sounds; licensed and CC0 libraries; AI SFX generation later | Procedural synthesis is free and 100% owned |
| SVG safety | Parse → **allowlist rebuild** (no `script`, `foreignObject`, `on*` handlers, external `href`, `<style>` with `url()`/`@import`); optimize with **SVGO (MIT)** | We emit SVG from our own model, so it is safe by construction; uploaded SVG is never trusted |
| Rendering exports | **Headless Chromium (Playwright) frame capture + ffmpeg** on a CPU worker | No GPU needed |
| AI provider | Provider-independent `ModelProvider` interface; first adapter: **Anthropic Claude** for SVG/code/metadata | LLMs write clean, editable SVG and code; raster image models give poor vectors |
| Testing | **Vitest** (unit/integration), **Playwright** (E2E + visual snapshots) | Both tools are already in this environment |
| Observability | Sentry free tier + structured logs (pino) | Free to start |

---

## 4. The core idea: one canonical Asset Definition

Every product, in every brand, is stored as a single, versioned **Asset Definition (AD)** — a JSON document validated by Zod. Every export format is *compiled* from it. This is what makes "one factory, seven brands" work.

```jsonc
{
  "schema": "daos.asset/1",
  "id": "ast_01J...",                 // ULID
  "brand": "moodicons",
  "name": "Laughing Face",
  "viewBox": [0, 0, 64, 64],
  "rig": { "id": "rig_face_v1", "params": { "eyes": "squint", "mouth": "open-laugh" } },
  "layers": [ { "id": "head", "svg": "<circle .../>", "fill": "token:primary" }, ... ],
  "tokens": { "primary": "#FFC83D", "stroke": "#1F1A17" },   // customer-customizable
  "timeline": {
    "duration": 1200, "loop": true,
    "tracks": [
      { "target": "head", "prop": "rotate", "keyframes": [[0, 0], [300, -6], [600, 6], [900, 0]], "ease": "spring(1, 180, 12)" }
    ]
  },
  "sounds": [ { "id": "snd_giggle_01", "at": 0, "gain": 0.8 } ],
  "interactions": [ { "on": "hover", "play": "timeline" }, { "on": "click", "play": "sound:snd_giggle_01" } ],
  "a11y": { "label": "Laughing face", "reducedMotion": "static-frame:600" },
  "license": { "soundSource": "procedural", "artAuthor": "human-directed" }
}
```

**Compilers (export engine):**

| Target | Visual animation | Interactivity | Sound | How |
|---|---|---|---|---|
| Animated SVG (CSS keyframes) | ✅ | hover only, via CSS | ❌ | springs pre-sampled into keyframes |
| Web Component | ✅ | ✅ | ✅ (user-initiated) | tiny runtime + AD |
| React component | ✅ | ✅ | ✅ | same runtime, React wrapper |
| Lottie JSON | ✅ | via host app | ❌ (companion audio file + cue sheet) | timeline → Lottie layers |
| GIF | ✅ (256 colors, no alpha blending) | ❌ | ❌ | Chromium frames → ffmpeg palette |
| PNG / sprite sheet | static / frames | ❌ | ❌ | Chromium |
| MP4 (H.264 + AAC) | ✅ (no transparency) | ❌ | ✅ baked in | frames + mixed audio → ffmpeg |
| WebM (VP9 + alpha) | ✅ with transparency | ❌ | ✅ | for video editors (CineGlyphs) |
| ZIP package | all of the above + `LICENSE.txt` + `README` + cue sheet | | | |

The product page will show this table per product, so customers are never told a GIF "has sound".

**Universal Viewer** = the Web Component runtime plus a control bar (play/pause, restart, speed, sound toggle, background, color tokens, size, fullscreen). It respects `prefers-reduced-motion` and plays audio only after a user gesture, per autoplay policy.

---

## 5. Seven-brand architecture

### 5.1 One storefront app, seven identities (recommended deviation from the brief)

The brief proposes seven Next.js apps. I recommend **one multi-tenant storefront app** plus **one brand package per brand**:

```
apps/storefront        ← one Next.js deployment; middleware maps host → brand
brands/moodicons/      ← theme tokens, fonts, logo, homepage sections, layout, copy, nav, SEO
brands/sonicglyphs/
...
```

- Each brand gets **its own layout, header, homepage composition, typography, color system and copy.** They are not color swaps; they share only primitives (cart, product grid logic, checkout, account).
- **Cost:** one deployment, one build, one set of env vars, instead of seven.
- **Data isolation:** every query is scoped by `brandId` derived from the host, never from user input.
- **Escape hatch:** if a brand later needs its own app (e.g. AliveUI docs site), `apps/aliveui-docs` can be added without touching the others.

Each brand can use its own domain. **For the pre-launch validation period I recommend subdomains or a single domain** to avoid buying 8 domains before demand is proven (your decision; see §10).

### 5.2 Brand configuration model

```ts
BrandConfig {
  slug, name, tagline, domains[], locale defaults, currency,
  theme: { tokens, fonts, radius, motionPersonality },   // e.g. "bouncy" vs "cinematic"
  layout: 'playful-grid' | 'studio-dark' | 'editorial' | 'docs' ...,
  catalog: { categories[], defaultSort, featuredCollections[] },
  pricing: { tiers[], licenseTypesEnabled[] },
  marketing: { analyticsStream, socialLinks, emailListId },
  features: { soundPreview, customizer, developerExports, childSafeMode }
}
```

Stored in the DB (editable by admins) with code-level defaults in `brands/<slug>`.

---

## 6. Monorepo structure (Phase 1 subset in **bold**)

```
seven-brands/
├── apps/
│   ├── **storefront/**          multi-tenant Next.js (all brands)
│   └── **admin/**               DAOS parent dashboard (Next.js)
├── brands/                      **moodicons/**, **sonicglyphs/** … (theme + layout + content)
├── packages/
│   ├── **core/**                domain logic: catalog, orders, licensing, brand scoping
│   ├── **db/**                  Drizzle schema, migrations, seed
│   ├── **auth/**                Better Auth config, RBAC
│   ├── **ui/**                  shared React primitives + token-based theming
│   ├── **storage/**             S3-compatible adapter (R2/S3/MinIO), signed URLs
│   ├── asset-schema/            Asset Definition Zod schema + types          (Phase 2)
│   ├── svg-engine/              parse, sanitize, optimize, validate           (Phase 2)
│   ├── motion-runtime/          spring/keyframe runtime, Web Component        (Phase 2)
│   ├── audio-engine/            Web Audio playback, offline synth, mixing     (Phase 2)
│   ├── export-engine/           compilers listed in §4                        (Phase 2)
│   ├── agents/                  agent definitions, provider adapters          (Phase 2/8)
│   ├── commerce/                MoR adapter, webhooks, entitlements           (Phase 3)
│   └── config/                  tsconfig, eslint, tailwind presets
├── services/
│   └── worker/                  pg-boss consumer: production, export, publishing jobs (Phase 2)
├── infrastructure/              docker-compose (local Postgres + MinIO), deploy configs
├── docs/                        the 14 required documents
└── tests/e2e/
```

No separate `services/api`: storefront and admin call `packages/core` through Next.js route handlers and server actions. A standalone API is extracted only if a public developer API (AliveUI) requires it.

---

## 7. Commerce and payments

### 7.1 Use a Merchant of Record (MoR)

Selling digital goods worldwide makes you liable for VAT/GST/sales tax in dozens of jurisdictions (EU VAT OSS, UK, Australia, US states, etc.). A **Merchant of Record** sells on your behalf, collects and remits these taxes, and handles chargebacks. For a lean company in the Philippines this is the most important payments decision.

| Provider | Model | Approx. fee (verify) | PH payouts | Subscriptions | Notes |
|---|---|---|---|---|---|
| **Paddle** | MoR | 5% + $0.50 | Yes (verify) | ✅ | Mature, strict onboarding (needs a live site and terms) |
| **Lemon Squeezy** | MoR (Stripe-owned) | 5% + $0.50, plus extra % for some international/PayPal payments | Yes (verify) | ✅ | Good for digital downloads and license keys |
| **Polar.sh** | MoR | ~4% + $0.40 | verify | ✅ | Developer-oriented; good fit for AliveUI |
| Gumroad | MoR | 10% + $0.50 | Yes | ✅ | Easiest to start; highest fee |
| PayPal | Processor (not MoR) | ~4.4% + fixed fee, international | Yes | ✅ | You handle tax yourself |
| PayMongo / Xendit | Processor (PH) | ~3.5–4% + fixed fee | Yes | partial | Strong locally; you handle global tax |
| Stripe | Processor | — | **Not available for PH entities** (verify) | — | Only via a foreign entity (e.g. US LLC via Stripe Atlas, ~$500) |

**Recommendation:** build a provider-agnostic `PaymentProvider` interface. Implement **Lemon Squeezy or Paddle** first (test mode only until approved), with webhooks verified by signature, idempotent processing and entitlements granted only by webhook. You choose the provider after checking their current PH onboarding requirements; I can't verify account eligibility for you.

### 7.2 Pricing implications

At 5% + $0.50, a $3 sale nets ≈ $2.35 (−22%), a $9 sale nets ≈ $8.05 (−11%), and a $29 bundle nets ≈ $27.05 (−7%). So:
- Single icons around **$5** minimum, or free (as lead magnets).
- Lead with **packs ($9–29)** and **lifetime per-brand access ($49–99)**.
- An all-brands pass later, once 3+ brands exist.

### 7.3 Licensing (to be reviewed by a lawyer before launch)

| License | Who | Key terms |
|---|---|---|
| Personal | Individuals | Non-commercial use |
| Commercial (Standard) | Freelancers, creators, single business | Use in unlimited end products; no resale or redistribution of the asset as an asset; no use in competing asset libraries |
| Team | Up to N seats | Same as commercial, multiple users |
| Agency / Extended | Agencies | Use in client projects; client may keep it in the delivered product |
| Enterprise | Large orgs | Custom terms, indemnity, invoice billing |

Every download ZIP includes `LICENSE.txt` with the order ID, buyer and license type. Each license is a DB record and can be verified at `/license/verify/:code`.

---

## 8. Database design (conceptual, PostgreSQL)

All IDs are prefixed ULIDs (`ast_…`, `ord_…`). `created_at`/`updated_at` on every table; soft-delete where needed. Brand-scoped tables carry `brand_id` with a composite index `(brand_id, …)`. Postgres Row-Level Security can be enabled later as defense in depth; the application-level scope guard comes first.

**Identity & access**
- `organization` (the parent company; future-proofs for agency/enterprise customers)
- `brand` (slug UNIQUE, config JSONB, status)
- `user` (staff + customers; Better Auth tables: `session`, `account`, `verification`)
- `role`, `permission`, `role_permission`, `user_role(user_id, role_id, brand_id NULL = global)` → per-brand admin roles
- `customer` (user_id, brand_id, marketing consent, country) — UNIQUE(user_id, brand_id): one login, per-brand customer relationship and data separation
- `audit_log` (actor, action, entity, before/after JSONB, ip) — append-only

**Assets & production**
- `asset` (brand_id, slug, status: draft→in_review→approved→published→archived, current_version_id)
- `asset_version` (asset_id, version INT, definition JSONB [the AD], checksum, created_by) — UNIQUE(asset_id, version), immutable
- `asset_variant` (asset_version_id, kind: color/size/sound, params JSONB)
- `sound_asset` (brand_id NULL = shared, source: procedural/library/ai/recorded, license_ref, storage_key, duration_ms, loudness_lufs)
- `asset_sound` (asset_version_id, sound_asset_id, cue_ms)
- `rig` (id, brand_id, definition JSONB, version) — parametric generators
- `export_artifact` (asset_version_id, format, storage_key, bytes, checksum, validation JSONB)
- `production_job` (brand_id, type: single/batch/collection, brief JSONB, status, cost_usd, started/finished)
- `agent_task` (production_job_id, agent, input JSONB, output JSONB, model, tokens_in/out, cost_usd, status, error)
- `quality_review` (asset_version_id, kind: automated/human, score, checks JSONB, reviewer_id, decision)
- `publishing_job` (asset/product ids, target storefront, approved_by, status)

**Catalog & commerce**
- `collection` (brand_id, slug, title, …), `collection_asset`
- `product` (brand_id, kind: single/pack/collection/lifetime/subscription, slug, status, seo JSONB) — UNIQUE(brand_id, slug)
- `product_asset` (which assets a product grants)
- `price` (product_id, license_type, currency, amount_cents, provider_price_id)
- `product_file` (product_id, export_artifact_id or package storage_key)
- `order` (brand_id, customer_id, provider, provider_order_id UNIQUE, status, totals, tax, currency)
- `order_item` (order_id, product_id, price_id, license_type)
- `payment` (order_id, provider_payment_id, amount, fee, status, raw JSONB)
- `webhook_event` (provider, event_id UNIQUE, payload, processed_at) — idempotency
- `entitlement` (customer_id, product_id, license_id, source order/subscription, valid_until)
- `license` (code UNIQUE, type, customer_id, order_item_id, terms_version, revoked_at)
- `download` (entitlement_id, artifact, ip_hash, user_agent, created_at) — rate-limit and abuse detection
- `subscription` (customer_id, brand_id, provider ids, status, period_end)

**Analytics & finance**
- `analytics_event` (brand_id, session_id, name, props JSONB, utm JSONB, ts) — partitioned by month
- `expense` (brand_id NULL = shared, category: ai/infra/payments/marketing, amount, currency, source)
- `revenue_record` (brand_id, order_id, gross, fees, tax, net, currency, fx_rate, recognized_at)

Full column-level schema goes into `DATABASE_SCHEMA.md` and Drizzle code in Phase 1.

---

## 9. AI Production Factory

### 9.1 Pipeline (state machine, every step persisted as an `agent_task`)

```
brief → [Creative Director] concept + AD skeleton
      → [SVG Production] layers (from rig, or LLM-drafted) → svg-engine validate/sanitize/optimize
      → [Animation] timeline → runtime render check
      → [Sound Design] select/synthesize → loudness normalize (−16 LUFS target)
      → [Sync] cue alignment to timeline events
      → [QA] automated checks (below) → score
      → [Catalog] title, description, tags, alt text (structured output)
      → export-engine builds artifacts → package ZIP
      → HUMAN REVIEW (required) → [Publishing] → storefront
```

### 9.2 Agent design rules

- Each agent is a typed function: `run(input: ZodSchema) → output: ZodSchema`, with no direct DB, storage, payment or secret access. The **orchestrator** (worker) persists results and enforces permissions.
- Agents *propose*; only the orchestrator *writes*, and only into `draft`/`in_review` states. **Publishing, pricing, refunds and license changes always require a human approval** recorded in `audit_log`.
- Every call logs model, tokens and USD cost into `agent_task` → feeds the BI dashboard.
- Deterministic tools are preferred over LLMs wherever possible (rigs, SVGO, synthesizers, validators). LLMs handle creative drafting and copy.
- Collections use the provider's **batch API (50% cheaper)** and prompt caching of the brand style guide.

### 9.3 Automated QA checks

SVG: parses, allowlist-clean, viewBox present, ≤ N paths/bytes, no hidden/empty layers, stroke widths on grid, contrast of tokens. Motion: renders in Chromium without errors, no layout jank, honors reduced motion, loop seam check (first/last frame diff). Audio: peak ≤ −1 dBFS, loudness target, no clipping, duration ≤ animation. Exports: each file opens/decodes, size budgets, Lottie validates in lottie-web. Visual regression: snapshot per version.

### 9.4 Estimated AI cost per asset (Anthropic list prices as of Nov 2026, verify)

| Step | Model | Est. tokens (in/out) | Cost standard | Cost via Batch API |
|---|---|---|---|---|
| Concept + SVG + animation draft | Claude Opus 5.5 ($4/$20 per M) | ~4k cached / ~5k | ≈ $0.10 | ≈ $0.05 |
| Same, cheaper tier | Claude Sonnet 5.5 ($2/$10 per M) | same | ≈ $0.05 | ≈ $0.025 |
| Catalog metadata | Claude Haiku 5.5 ($0.10/$0.50 per M) | ~1k / ~0.5k | < $0.001 | < $0.001 |
| Retries / QA fix loops (×1.5) | | | | |

**≈ $0.05–0.20 per finished asset** in AI spend; a 100-asset collection ≈ **$5–20**. Rig-based assets (most of Moodicons) cost close to $0 in AI after the rig exists. Human review time is the real cost. Model choice per step will be measured on a quality eval, not assumed.

Sound: procedural/synth and CC0 libraries = $0. AI SFX APIs (e.g. ElevenLabs Sound Effects) are roughly a few cents per clip on paid plans; commercial-use terms must be verified before use. Optional, not in MVP.

---

## 10. Infrastructure options and costs

### Option A — "Free-tier lean" (recommended for MVP)

| Component | Service | Free tier | When it starts costing |
|---|---|---|---|
| Storefront + admin | **Cloudflare Workers** (Next.js via OpenNext) | 100k requests/day, commercial use allowed | Workers Paid $5/mo |
| Database | **Neon Postgres** | 0.5 GB, autosuspend | ~$5–19/mo usage-based |
| Object storage + CDN | **Cloudflare R2** | 10 GB, **zero egress fees** | $0.015/GB-month |
| Export/production worker | **Fly.io** machine (scale to zero) or a small VPS | — | ~$3–6/mo |
| Email (receipts, magic links) | Resend | 3,000/month | $20/mo |
| Errors | Sentry | 5k errors/mo | $26/mo |
| Analytics | Self-built events table + Plausible/Umami later | — | — |

**Note:** Vercel's free (Hobby) plan **prohibits commercial use**; Vercel Pro is $20/user/month. That's why Cloudflare is the default here. Vercel stays a fine alternative if you value its DX.

### Option B — Single VPS

Hetzner/Contabo-class VPS (2–4 vCPU, 4–8 GB) ≈ **€5–10/mo** running Postgres, worker, MinIO, n8n via Docker Compose, with Cloudflare R2 + CDN in front for downloads. Cheapest at moderate scale, but you own backups, patching and uptime.

### Monthly cost estimate

| Stage | Option A | Notes |
|---|---|---|
| Development (now → MVP) | **$0** | Local Docker Postgres + MinIO in this container |
| Private beta | **$0–10** | Free tiers + small worker |
| Launch (2 brands, ~10k visits/mo, ~100 orders) | **$15–45/mo** | + payment fees (~5–8% of revenue, MoR) |
| Growth (7 brands, ~200k visits/mo) | **$80–250/mo** | Paid DB tier, Workers Paid, more R2, Sentry |
| One-time | Domains ≈ $10–15/yr each (8 ≈ $80–120/yr); trademark searches; lawyer review of license terms (budget separately) | |
| AI production | ≈ $5–20 per 100-asset collection | pay-as-you-go, budget caps enforced in code |

No permanent GPU is needed at any stage; exports are CPU work.

**Budget controls:** a per-day/per-month AI spend cap in the worker (jobs pause when reached), provider-side spend limits where supported, and a monthly cost report in the admin dashboard.

---

## 11. Security plan (summary; full detail in SECURITY.md)

- Auth with secure cookies, CSRF protection, rate-limited login, optional 2FA for staff.
- RBAC: `owner`, `admin`, `brand_manager(brand)`, `producer`, `reviewer`, `support`, `analyst`. Every admin action is audited.
- Brand scoping enforced in a single data-access layer, plus tests that try cross-brand reads.
- Private storage bucket. Downloads via **short-lived signed URLs** issued only after an entitlement check. Unpublished assets are never served publicly; previews are separate, watermark-optional, low-res renders.
- SVG allowlist sanitization; uploaded files are type-sniffed and size-limited; previews of untrusted SVG are rendered via `<img>` or a sandboxed iframe, never inline.
- Payment webhooks: signature verification, idempotency table, replay window.
- Secrets only in platform secret stores; nothing in git. The `adminpass` in the n8n fork should be considered compromised.
- Backups: Neon point-in-time restore + weekly logical dump to R2.
- Privacy: minimal PII, consent for marketing, data export/delete endpoints (GDPR / PH Data Privacy Act).

---

## 12. Technical risk assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | AI-drafted SVG quality inconsistent | High | High | Rigs + style grid + human review gate + QA scoring; LLM edits within constraints instead of free drawing |
| 2 | Lottie compiler complexity | Medium | Medium | Support a defined subset of AD features for Lottie; label unsupported assets honestly |
| 3 | Next.js on Cloudflare compatibility gaps | Medium | Medium | Keep Node-only work (rendering) in the worker; fall back to Vercel Pro or a VPS if blocked |
| 4 | Payment provider onboarding rejection | Medium | High | Provider-agnostic interface; apply to two MoRs in parallel once the site and terms exist |
| 5 | Audio autoplay / iOS quirks | High | Low | User-gesture unlock, clear sound toggle, tested on iOS Safari |
| 6 | Scope creep (seven brands at once) | High | High | The phase gates in §13; brand 3 is blocked until brands 1–2 are validated |
| 7 | License/legal ambiguity | Medium | High | Lawyer review before first live sale; provenance recorded per asset |
| 8 | Single-founder operations load | High | Medium | Automate fulfilment, receipts and support drafts; n8n internally for ops notifications |

---

## 13. MVP definition and roadmap

### MVP = brief §22, scoped as:

- Admin: brands, assets (upload/import AD, versioning, review/approve), products/prices, orders, customers, production job log, cost view.
- Engine: AD schema, SVG sanitizer, motion runtime + Web Component, audio playback + 2 synth presets, sync cues, Universal Viewer, exports = **SVG, Web Component, React, PNG, GIF, MP4, ZIP** (Lottie and WebM-alpha right after MVP).
- Factory: Creative/SVG/Animation/Catalog agents behind the provider interface, run as jobs with cost tracking; human approval gate. (Runs live only once an API key is provided.)
- Storefronts: **Moodicons** and **SonicGlyphs** with distinct identities, search/filter, product pages with live preview + customizer, cart, **test-mode checkout**, account, download library, licenses, help pages.
- Tests: unit (engine, licensing, scoping), integration (DB, webhooks), E2E (browse → buy (test) → download).
- Launch content: ~60 Moodicons (2 rigs) + ~40 SonicGlyphs, plus 1 free starter pack per brand.

### Phases and rough effort (AI-assisted, one human reviewer)

| Phase | Deliverable | Est. calendar time |
|---|---|---|
| 1 Foundation | Monorepo, DB + migrations, auth/RBAC, brand config, storage adapter, admin shell, CI | 1–2 weeks |
| 2 Production engine | AD schema, svg-engine, motion runtime, audio, viewer, export engine, jobs, agents | 3–4 weeks |
| 3 Commerce | Catalog, MoR integration (test mode), webhooks, entitlements, licenses, downloads | 2 weeks |
| 4 Moodicons + SonicGlyphs | Brand designs, content production, E2E, staging deploy | 2–3 weeks |
| — Validation gate | Real traffic, real (live) payments after your approval, metrics review | 4–8 weeks |
| 5–7 | CineGlyphs + AtmosIcons → ShopMotion + LearnIcons → AliveUI | gated on results |

The estimates assume steady sessions and prompt reviews from you. They aren't commitments.

---

## 14. Decisions needed from you

| # | Decision | My recommendation |
|---|---|---|
| D1 | Where does the code live? | **New private repo `seven-brands`** (you create it; I can't). Fallback: a `seven-brands/` folder on this branch. |
| D2 | One multi-tenant storefront app instead of seven apps | **Approve** (same distinct branding, ~1/7 the ops cost) |
| D3 | ORM | Drizzle (Prisma acceptable) |
| D4 | Hosting target | Option A (Cloudflare + Neon + R2), $0 during development |
| D5 | Payment approach | Merchant of Record; you check Paddle and Lemon Squeezy PH eligibility. I build provider-agnostic, test mode first. |
| D6 | Domains during validation | Wait. Use subdomains of one domain or a free `*.workers.dev` staging URL; buy brand domains after trademark checks. |
| D7 | The n8n fork | Keep it only as an optional internal ops tool using the official image. Remove the committed password. Don't build the product on it. |
| D8 | AI provider key | Supply an Anthropic API key (with a spend limit) when we reach Phase 2. Until then agents run against recorded fixtures, **clearly labeled as such**. |

Once you approve (or adjust) D1–D8, I begin Phase 1. Its first output is the repo skeleton, the 14 required documents, the DB schema and migrations, auth, brand config and the admin shell, all with passing tests.
