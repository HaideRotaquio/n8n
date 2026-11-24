# Development roadmap

Each phase ends with passing tests, updated docs and a report. Calendar estimates assume AI-assisted development with regular owner review; they are estimates, not commitments.

| Phase | Scope | Status |
|---|---|---|
| 0 Discovery | Inspection, architecture, costs, risks, MVP | ✅ 2026-11-24 |
| 1 Foundation | Monorepo, DB, auth/RBAC, brand config, storage, admin shell, API v1, CI, docs | ✅ 2026-11-24 |
| 2 Production engine | Asset Definition schema, SVG engine, motion runtime, audio, sync, viewer, export engine, worker + jobs, agents, expense tracking | ✅ 2026-11-24 (live AI run pending API key) |
| 3 Commerce | Catalog, collections, prices, MoR checkout (test mode), webhooks, entitlements, licenses, downloads, orders, customer accounts | ✅ 2026-11-24 (provider sandbox runs pending accounts) |
| 4 Moodicons + SonicGlyphs | Two distinct storefront designs on the Phase 3 storefront, content production (~60 + ~40 assets), Lottie export, stored sounds, catalog agent, staging deploy | Next |
| — Validation gate | Real traffic + live payments **after owner approval**; thresholds below | |
| 5 CineGlyphs + AtmosIcons | WebM-alpha + ambient-loop exports, video-editor packaging | Gated |
| 6 ShopMotion + LearnIcons | Shopify packaging; child-safety and privacy review for LearnIcons | Gated |
| 7 AliveUI | React package, Web Components, docs site, playground, npm distribution | Gated |
| 8 Advanced automation | Batch production, automated QA, publishing workflows, BI reporting, cost optimization | Gated |

## Phase 2 outcome

Delivered as planned, with two changes: the job queue is the `production_job` table (claimed with `FOR UPDATE SKIP LOCKED`, woken by `NOTIFY`) instead of pg-boss — one less dependency, and jobs are visible in the admin; and Lottie export moved to Phase 3. Starter content: 9 Moodicons + 8 SonicGlyphs from rigs (plus palette variants on demand).

## Phase 3 outcome

Items 1–4 of the plan are done; the owner chose to build **both** Lemon Squeezy and Paddle behind one interface.

1. Products (single or pack), prices per license type, collections; publishing needs reviewer-approved, exported assets and `asset.publish`. Buyers always get each asset's newest approved version.
2. `@sb/commerce`: Lemon Squeezy and Paddle adapters (test mode / sandbox), a labelled test provider for development and E2E, signed + idempotent webhooks. Live credentials are refused until `COMMERCE_LIVE_PAYMENTS=enabled`.
3. `apps/storefront`: one host-routed app for all brands, customer accounts, checkout, licenses with unique codes, public verification, real `LICENSE.txt` in every download.
4. Library with signed, rate-limited downloads; order history; data export; refunds requested by support and approved by an owner.

**Moved to Phase 4** (item 5): catalog/metadata agent (needs the Anthropic credits), Lottie export, stored sound library. **Not done:** a real sandbox purchase — there are no provider accounts yet (see `PAYMENTS_SETUP.md`).

## Validation thresholds (initial hypotheses, owner to adjust)

Per launched brand, within 8 weeks: ≥1,000 visitors from target channels · ≥2% free-pack/email conversion · ≥20 paid orders · refund rate <5%. Brand 3 does not start until brands 1–2 meet these or the owner decides otherwise.

## Owner actions outside the code

- Phase 2: Anthropic API key with a monthly spend limit.
- Phase 3: create **test-mode** accounts at Lemon Squeezy and Paddle (sandbox) and follow `PAYMENTS_SETUP.md`; later apply for live approval (needs a live site, terms, refund policy) and check Philippine payout eligibility.
- Anthropic: add API credits so the pending live AI production test can run.
- Before launch: trademark search for brand names, then domains; lawyer review of license terms and privacy policy.
