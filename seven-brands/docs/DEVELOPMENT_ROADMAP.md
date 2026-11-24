# Development roadmap

Each phase ends with passing tests, updated docs and a report. Calendar estimates assume AI-assisted development with regular owner review; they are estimates, not commitments.

| Phase | Scope | Status |
|---|---|---|
| 0 Discovery | Inspection, architecture, costs, risks, MVP | ✅ 2026-11-24 |
| 1 Foundation | Monorepo, DB, auth/RBAC, brand config, storage, admin shell, API v1, CI, docs | ✅ 2026-11-24 |
| 2 Production engine | Asset Definition schema, SVG engine, motion runtime, audio, sync, viewer, export engine, worker + jobs, agents, expense tracking | Next |
| 3 Commerce | Catalog, collections, prices, MoR checkout (test mode), webhooks, entitlements, licenses, downloads, orders, customer accounts | |
| 4 Moodicons + SonicGlyphs | Multi-tenant storefront, two distinct designs, content production (~60 + ~40 assets), staging deploy | |
| — Validation gate | Real traffic + live payments **after owner approval**; thresholds below | |
| 5 CineGlyphs + AtmosIcons | WebM-alpha + ambient-loop exports, video-editor packaging | Gated |
| 6 ShopMotion + LearnIcons | Shopify packaging; child-safety and privacy review for LearnIcons | Gated |
| 7 AliveUI | React package, Web Components, docs site, playground, npm distribution | Gated |
| 8 Advanced automation | Batch production, automated QA, publishing workflows, BI reporting, cost optimization | Gated |

## Phase 2 plan (next)

1. `asset-schema`: Asset Definition v1 + Zod + JSON Schema export; asset/version/variant/export tables.
2. `svg-engine`: parser, allowlist sanitizer, SVGO pass, validators (viewBox, size, path count, layer ids).
3. `motion-runtime`: keyframes + spring solver (pre-sampling for CSS/Lottie), Web Component `<daos-asset>`, reduced-motion.
4. `audio-engine`: playback with user-gesture unlock, offline synth presets, loudness normalization (−16 LUFS), sync cues.
5. Universal viewer in the admin (play/pause/restart/speed/sound/background/colors/size/fullscreen).
6. `export-engine`: SVG, Web Component, React, PNG, GIF, MP4 (+AAC), ZIP with `LICENSE.txt`; Lottie and WebM immediately after.
7. `services/worker` with pg-boss; production/export jobs; cost tracking in `agent_task` and `expense`.
8. Agents behind a provider interface; first adapter Anthropic. **Requires an API key with a spend limit (D8).** Until then agents run against recorded fixtures, clearly labeled.
9. First two rigs (Moodicons face, SonicGlyphs instrument) as deterministic generators.

## Validation thresholds (initial hypotheses, owner to adjust)

Per launched brand, within 8 weeks: ≥1,000 visitors from target channels · ≥2% free-pack/email conversion · ≥20 paid orders · refund rate <5%. Brand 3 does not start until brands 1–2 meet these or the owner decides otherwise.

## Owner actions outside the code

- Phase 2: Anthropic API key with a monthly spend limit.
- Phase 3: apply to Paddle and/or Lemon Squeezy (needs live site, terms, refund policy); check Philippine payout eligibility.
- Before launch: trademark search for brand names, then domains; lawyer review of license terms and privacy policy.
