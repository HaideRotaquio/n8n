# Development roadmap

Each phase ends with passing tests, updated docs and a report. Calendar estimates assume AI-assisted development with regular owner review; they are estimates, not commitments.

| Phase | Scope | Status |
|---|---|---|
| 0 Discovery | Inspection, architecture, costs, risks, MVP | ✅ 2026-11-24 |
| 1 Foundation | Monorepo, DB, auth/RBAC, brand config, storage, admin shell, API v1, CI, docs | ✅ 2026-11-24 |
| 2 Production engine | Asset Definition schema, SVG engine, motion runtime, audio, sync, viewer, export engine, worker + jobs, agents, expense tracking | ✅ 2026-11-24 (live AI run pending API key) |
| 3 Commerce | Catalog, collections, prices, MoR checkout (test mode), webhooks, entitlements, licenses, downloads, orders, customer accounts | Next |
| 4 Moodicons + SonicGlyphs | Multi-tenant storefront, two distinct designs, content production (~60 + ~40 assets), staging deploy | |
| — Validation gate | Real traffic + live payments **after owner approval**; thresholds below | |
| 5 CineGlyphs + AtmosIcons | WebM-alpha + ambient-loop exports, video-editor packaging | Gated |
| 6 ShopMotion + LearnIcons | Shopify packaging; child-safety and privacy review for LearnIcons | Gated |
| 7 AliveUI | React package, Web Components, docs site, playground, npm distribution | Gated |
| 8 Advanced automation | Batch production, automated QA, publishing workflows, BI reporting, cost optimization | Gated |

## Phase 2 outcome

Delivered as planned, with two changes: the job queue is the `production_job` table (claimed with `FOR UPDATE SKIP LOCKED`, woken by `NOTIFY`) instead of pg-boss — one less dependency, and jobs are visible in the admin; and Lottie export moved to Phase 3. Starter content: 9 Moodicons + 8 SonicGlyphs from rigs (plus palette variants on demand).

## Phase 3 plan (next)

1. Product, collection, price tables; product = approved asset(s) + license tiers; publish action (`asset.publish`).
2. Merchant-of-Record adapter (Lemon Squeezy or Paddle — owner chooses) in **test mode**; signed webhooks + idempotency.
3. Customer accounts (Better Auth sign-up on storefronts), entitlements, licenses (unique codes, verify endpoint), real LICENSE.txt in packages.
4. Download library with signed URLs and abuse limits; order history; refunds require owner approval.
5. Catalog/metadata agent; Lottie export; stored sound library with license records.

## Validation thresholds (initial hypotheses, owner to adjust)

Per launched brand, within 8 weeks: ≥1,000 visitors from target channels · ≥2% free-pack/email conversion · ≥20 paid orders · refund rate <5%. Brand 3 does not start until brands 1–2 meet these or the owner decides otherwise.

## Owner actions outside the code

- Phase 2: Anthropic API key with a monthly spend limit.
- Phase 3: apply to Paddle and/or Lemon Squeezy (needs live site, terms, refund policy); check Philippine payout eligibility.
- Before launch: trademark search for brand names, then domains; lawyer review of license terms and privacy policy.
