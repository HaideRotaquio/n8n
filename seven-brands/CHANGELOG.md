# Changelog

All notable changes to the Seven Brands platform. Dates are UTC.

## [0.5.1] — 2026-11-26 — React Native and Flutter

### Added
- **React Native / Expo player** `daos-icons-react-native` (`packages/react-native`): `DaosIcon` plays the icon's Lottie motion with its pre-mixed sound loop (stereo kept) in sync. Sound modes `press` (default: tap replays with sound), `always` (every loop) and `off`; respects Reduce Motion (still frame, nothing plays until the setting is known) and the phone's silent switch. Typechecked against React Native 0.88, lottie-react-native 7 and expo-audio; 9 tests.
- **Flutter player** `daos_icons` (`packages/flutter/daos_icons`): the same rules with `lottie` and `audioplayers`, `MediaQuery.disableAnimations` support, screen-reader semantics and a swappable sound engine. 9 Flutter tests, including a render of a real exported icon through Flutter's Lottie, plus an example app that compiles and runs the exact widget the CLI generates.
- New source formats `react-native` and `flutter` in the developer API and CLI: Lottie JSON, a WAV of one sound loop (recorded library sounds mixed in) and a typed wrapper component/widget per icon.
- CLI detects React Native/Expo (`src/components/icons`) and Flutter (`lib/icons`) projects, writes audio as binary, fills Flutter asset paths and adds the icons folder to `pubspec.yaml` assets (only when the layout is the usual one; otherwise it says what to add).
- Developers page and `/llms.txt` explain mobile setup.

### Owner to-do before publishing the players
- Check the names `daos-icons-react-native` (npm) and `daos_icons` (pub.dev) are free, then `npm publish` from `packages/react-native` and `flutter pub publish` from `packages/flutter/daos_icons`. iOS and Android builds haven't been run here (no simulators); try one icon in a real app first.

## [0.5.0] — 2026-11-26 — AI agent install

### Added
- **Developer API** on every storefront: public icon search, details and still previews; `POST /api/v1/icons/:slug/files` returns an icon's source (React, Web Component, animated SVG, SVG, Lottie, JSON) for a license code that covers it, with the website's download limits and logging. Codes from another brand, revoked codes and icons outside the purchased product are refused, with buy links.
- **CLI per brand** (`packages/cli`, built to `dist/<brand>/` as the npm packages `moodicons` and `sonicglyphs`): `search`, `add` (detects React/Next vs plain HTML, writes into `src/components/icons` or `icons/`, adds `daos-player.js` once and an `ICON-LICENSES.md` record), `login`/`licenses`/`logout` (codes stored per store, readable only by the user, or `<BRAND>_LICENSE`). Multiple licenses are tried in turn.
- **MCP server** (`npx moodicons mcp`) with `search_icons`, `get_icon`, `add_icon` and `project_info`; writes only inside the project and returns buy links instead of failing silently when a license doesn't cover an icon.
- `/llms.txt` and a **Developers & AI agents** page with Claude Code and generic MCP setup; footer links in both designs.
- `@sb/export/source`: the text-only exporters, importable by web servers without esbuild or native renderers.
- Tests: developer API repository (4), source exporter (2), CLI + MCP with a mock store (8), and storefront E2E for the API and for the built CLI and MCP server against the real store.

### Owner to-do before publishing the CLI
- Check that the npm names `moodicons` and `sonicglyphs` are free (otherwise use a scope such as `@moodicons/cli`), then build with `STORE_URL_MOODICONS=https://… STORE_URL_SONICGLYPHS=https://… pnpm --filter @sb/cli build` and `npm publish` each `dist/<brand>` folder.

## [0.4.8] — 2026-11-25 — Kasanagi crew

### Added
- **Kasanagi: The Seven Paths** chibi crew from the owner's own universe — heroes Awan, Saliha, Dumalag, Bantug, Aria, Landong, Ngil-ad and Karum, and the Obsidian Circle (Ira, Vorak, Zeph, Datus): 12 characters × 8 reactions = 96 icons with sound, QA 100, one pack per character and a crew bundle.
- Canon adapted so nothing follows an existing series (sun emblem, Pulse Arts, Anito Gifts, Diwa, Wind-Step, sampaguita); see `docs/KASANAGI.md`.
- Chibi total: 34 characters in 6 crews, 272 icons.

## [0.4.7] — 2026-11-25 — Chibi crews: Blade Hunters and Adventurers' Guild

### Added
- **Blade Hunters** (original night-monster hunters): Lio (rookie with a glowing lantern and leather vest), Vera (swift duelist with a sword over her shoulder and a crescent-moon hairpin), Sage (herbal healer in a leaf headwrap), Brix (armored hunter with a mohawk and steel shoulder plate).
- **Adventurers' Guild:** Pip (trail tracker in a bush hat with binoculars), Mira (beast tamer with a fluffy original companion on her shoulder), Ezra (map strategist with a monocle and bow tie), Kofi (guild examiner in a green peaked cap with a star badge).
- 22 characters across 5 crews × 8 reactions = 176 chibi icons with sound, all QA 100; a pack per character and a bundle per crew.
- "Never" lists for both crews in the rig (no patterned haori, boar masks, symbol earrings, elemental "breathing" themes; no playing cards, fishing rods, yo-yos, skateboards or chains).

## [0.4.6] — 2026-11-25 — Chibi crews: Sky Pirates and Shinobi

### Added
- Two new original crews built on anime genres (not on any existing series' characters), 4 characters each:
  - **Sky Pirates:** Rook (captain, tricorne and long coat), Isla (navigator, leather flight cap and red scarf), Bo (airship mechanic, polka-dot bandana and overalls), Juno (lookout, headscarf, hoop earring, sailor stripes).
  - **Shinobi Crew:** Rina (smoke-bomb trickster in a tied hood), Taro (throwing-star prodigy with a long scarf), Noor (scroll-keeper with a bun and hair sticks), Bram (wandering mentor in a woven travel hat and prayer beads).
- The original six are now the **Street Crew**.
- New anime-style reaction for every character, **Power-Up**: a blazing aura and rising speed lines, with a whoosh and a bass hit.
- 14 characters × 8 reactions = 112 chibi icons, all QA 100.
- Launch plan: a pack per character and one bundle per crew (the 100-icons-per-pack limit rules out an all-crews bundle).
- Each crew has a written "never" list in the rig, naming the signature traits of famous series characters that the designs must avoid.

## [0.4.5] — 2026-11-25 — Chibi Cast (original characters)

### Added
- Moodicons rig `moodicons-chibi@1`: six original, streetwear-styled chibi characters, each with a signature look:
  Kai (street skater, backwards cap and hoodie), Amara (DJ, high puff, bomber and headphones), Mateo (street footballer, curly top, sweatband, striped jersey), Tala (surfer, ocean-blue streak, hibiscus, shell necklace), Priya (gamer, neon streak, headset with mic) and Lena (inventor, messy bob, goggles, lab coat).
- Seven reactions each — a signature "Cool" (sunglasses drop in with a whoosh and a "shing" glint), happy, laughing, in love, sad, angry, surprised: 42 animated icons with synced sound, all QA 100 and exported in every format, Lottie included.
- Characters share one face shape and differ by style, hair and skin tone; they are not labelled by nationality. Design rule in the rig: never redraw one to resemble a character from an existing anime, game or comic.
- Launch plan: a reactions pack per character and a "Chibi Cast Bundle" of all 42.

## [0.4.4] — 2026-11-25 — Scroll-driven playback

### Added
- `<daos-asset scroll="scrub">`: the animation follows the page scroll (forwards and back), with `scroll-loops="N"` to repeat it across the crossing; `scroll="in-view"` plays from the start when half visible and pauses when it leaves. React files get `scroll` and `scrollLoops` props; package READMEs explain both.
- With sound on, scrubbing forward plays each cue as it is passed (fast flings play only the last one; scrolling back is silent). Reduced-motion users keep the still frame.
- Storefronts: a "Scroll to play" strip on both home pages (different icons from the hero) using the same player mode; help FAQ entry.
- Tests: 5 player browser tests (progress math, scrub determinism, reduced motion, in-view, sound on scrub) and a storefront E2E.

## [0.4.3] — 2026-11-25 — Hover to hear

### Added
- Storefront "Sound on/off" switch in the header (both designs), remembered per visitor. Off by default; the click on it unlocks audio as browsers require, and on later visits the first click or key press re-unlocks it.
- With sound on, hovering (or keyboard-focusing) any icon — hero, catalog grid, search results — restarts its animation from the first frame and plays its sounds in sync, including stereo placement. Leaving stops the sound. Cues are pre-resolved on the server, so cards don't ship whole asset definitions.
- Product-page previews start with sound when the site-wide switch is on.
- E2E: silent by default, hover plays after switching on, choice remembered.

## [0.4.2] — 2026-11-25 — Stereo sound placement

### Added
- Sound cues can be placed left/right: a fixed `pan` (−1 left … 1 right) or `panFrom: <layer>` (the sound sits where that layer is on screen when it fires). Equal-power pan law everywhere.
- Player (Web Component, React, storefront and admin previews) pans with the Web Audio stereo panner; WAV, MP4 and WebM exports become 2-channel when an icon pans (verified with ffprobe); unpanned icons stay mono. Loudness normalization measures both channels (BS.1770 multi-channel).
- Panned content: SonicGlyphs drum (left/right sticks), speaker, equalizer, notification badge; Moodicons sparkles, kiss and thinking faces; Bawal littering sign gets a "land" sound where the can falls. The animator agent may set a pan per sound.
- Storefront: SonicGlyphs cue sheet shows each cue's position (C, L40, R75); product facts say "stereo"; FAQ explains it is stereo, not 3D/surround.

## [0.4.1] — 2026-11-25 — Bawal signs (Davao)

### Added
- Moodicons "Bawal" sign rig (`moodicons-bawal@1`): animated public-place signs as known in Davao City — Bawal Mag-sigarilyo, Bawal Maglabay ug Basura Bisan Asa, Bawal Magluwa Bisan Asa, Bawal Mangihi Bisan Asa, Bawal ang Paputok — plus a green Designated Smoking Area sign. Pictograms only (no words in the artwork); Bisaya/Tagalog names in titles, English accessible labels. 100/100 QA, verified in lottie-web.
- Launch plan: "Bawal Signs — Davao Pack" plus a single product per sign; new Moodicons category "Bawal signs (PH)".

### Fixed
- Product previews of packs with different designs now list the icons by name ("6 icons included") instead of calling them color styles; long bundles show the first 16.

## [0.4.0] — 2026-11-24 — Phase 4: Moodicons + SonicGlyphs

### Added
- Storefront designs per layout family: Moodicons **playful-grid** and SonicGlyphs **studio-dark** (different page compositions, navigation, cards and product pages — not a color swap). Search, category filters, live preview with every included color style, color customizer, opt-in sound and a cue sheet (SonicGlyphs), help pages (FAQ, licenses, refunds). Self-hosted OFL fonts (Baloo 2, Nunito, Space Grotesk, Inter).
- Free products: "Get it free" without checkout; a $0 order (`free` provider) with a real license; excluded from revenue.
- Launch content: Moodicons face rig 15 expressions (60 with palettes), new reaction-sticker rig (16), SonicGlyphs 14 glyphs (42). All 100/100 QA.
- Launch catalog plan (singles with all color styles, bundles, one free starter pack per brand) and an admin button that creates it as drafts with starting prices. `pnpm --filter @sb/worker demo:catalog` fills a dev database (refuses anything else).
- Lottie export (`lottie/<slug>.json` in packages and as a separate file), verified against lottie-web for every rig asset.
- Sound library: WAV upload with license record and loudness normalization, sound replacement on assets (new version → review), stored sounds in exports, admin viewer and storefront previews.
- Catalog writer agent (`catalog` jobs): suggestions for title, description, tags and alt text, applied by a person; fixture mode for tests.
- Staging prep: Next.js standalone output, `infrastructure/Dockerfile` (admin, storefront, worker), `docker-compose.staging.yml` with Caddy, `.env.staging.example`, DEPLOYMENT.md → Staging.
- Tests: 378 unit/integration/browser (+3 S3) and 28 E2E (21 admin, 7 storefront).

### Changed
- Export jobs only render the preview formats asked for (the package is always built).
- Admin forms keep what was typed (and chosen files) after a validation error.
- Admin "Store management" and "Analytics" sections moved to Phase 5.

### Not yet done
- Staging deploy (needs owner accounts); Docker images not built here (no Docker daemon).
- Real Lemon Squeezy / Paddle sandbox purchase; live AI run (Anthropic credits).
- Cart, analytics, store management (Phase 5); brand logos.

## [0.3.0] — 2026-11-24 — Phase 3: Commerce

### Added
- DB (migration 0004): product, product_asset, price, collection, collection_product, checkout_session, order, order_item, webhook_event, license, entitlement, download, refund_request.
- Catalog: single and pack products, a price per license type, collections; publishing needs `asset.publish` and reviewer-approved, exported assets. Buyers get each asset's newest approved version; unreviewed versions never reach them.
- `@sb/commerce`: provider-neutral `PaymentProvider` with **Lemon Squeezy** (test mode) and **Paddle Billing** (sandbox) adapters, following their official SDKs' formats; a labelled test provider for development and E2E. Signed webhooks (HMAC, Paddle timestamp window and secret rotation), idempotent processing, and payments checked against our own checkout session (amount, currency, provider, test mode) before anything is granted.
- Licenses: unique verifiable codes (`MOOD-XXXX-…`, 80 random bits), terms version on every license, draft plain-language terms per license type, `LICENSE.txt` with the buyer's name and code in every downloaded ZIP.
- `apps/storefront`: one app for all brands (brand from host, themed from brand config); customer sign-up/sign-in with opt-in marketing consent; product pages with license choice; checkout; library with signed, rate-limited downloads (30/h, 150/day); order history; license certificate page; public license verification page + `GET /api/v1/licenses/verify`; customer data export; webhooks at `/api/webhooks/:provider`; Paddle.js checkout page.
- Admin: Product catalog (create, price, publish, archive, collections), Orders (refund request → owner approval → provider refund), Customers, Licenses (search, revoke), Revenue (net of tax, fees and refunds; live orders only) with provider status and webhook log.
- Safety switches: live credentials refused unless `COMMERCE_LIVE_PAYMENTS=enabled`; test provider refused when `DEPLOY_ENV=production`.
- docs/PAYMENTS_SETUP.md: step-by-step test-mode setup for both providers.
- Tests: 268 unit/integration/browser (+3 S3 tests needing moto) and 23 E2E (18 admin, 5 storefront).

### Changed
- Admin section placeholders now start at Phase 4; `/orders`, `/catalog`, `/customers`, `/licenses`, `/revenue` are real pages.
- `pnpm e2e` builds and tests both apps.
- `.env.example`: `STORAGE_FS_ROOT` must be absolute so the admin, storefront and worker share files.

### Not yet done
- No purchase through a real Lemon Squeezy or Paddle sandbox: the accounts don't exist yet.
- Moved to Phase 4: catalog/metadata agent, Lottie export, stored sound library.
- Customer account deletion (export exists); rate limit on the public license-verification endpoint.
- Live AI production test: still waiting for Anthropic API credits.

## [0.2.0] — 2026-11-24 — Phase 2: Production engine

### Added
- `@sb/asset`: Asset Definition v1 (Zod), motion evaluator (cubic-bezier + analytic springs), frame and CSS-animated SVG rendering, automated QA with scoring, format capability table.
- `@sb/audio`: 10 procedural sound presets (owned, deterministic), BS.1770 loudness, normalization (−16 LUFS, −1 dBFS ceiling), mixer, WAV codec.
- `@sb/svg-engine`: allowlist importer for untrusted SVG; rejects active content.
- `@sb/player`: browser player and `<daos-asset>` Web Component (19 KB); audio scheduled on the Web Audio clock; reduced-motion aware.
- `@sb/export`: SVG (static/animated/hover), PNG, GIF, MP4 (H.264+AAC), WebM (VP9 alpha+Opus), WAV + cue sheet, Web Component, React, JSON, ZIP with README and preview license.
- `@sb/rigs`: Moodicons face rig (9 expressions × 4 palettes), SonicGlyphs line glyphs (8 × 3).
- `@sb/agents`: provider interface, Anthropic adapter (structured outputs, refusal fallback, prompt caching, cost tracking), fixture provider, creative director → SVG artist → animator pipeline with repair rounds.
- `services/worker`: table-backed job queue (rig / ai / export), retries, stale recovery, budget caps.
- DB: asset, asset_version (immutable), quality_review, export_artifact, production_job, agent_task, expense.
- Admin: asset library, Universal Viewer, human review, exports with signed downloads, production factory, job detail, AI agent runs, QA queue, expenses.
- Tests: 243 unit/integration/browser + 15 E2E.

### Changed
- Job queue uses Postgres directly instead of pg-boss (documented in ARCHITECTURE.md).
- `@sb/core` ids use Web Crypto (browser-safe).

### Not yet done
- No live Anthropic call has been made: it needs `DAOS_ANTHROPIC_API_KEY` in the environment.
- Lottie export and stored sounds moved to Phase 3.

## [0.1.0] — 2026-11-24 — Phase 1: Foundation

### Added
- pnpm + Turborepo monorepo under `seven-brands/` (isolated from the n8n fork it lives in).
- `@sb/core`: Zod `BrandConfig` schema, admin-patchable subset, theme → CSS variables, WCAG contrast checks, prefixed ULID ids, RBAC (7 roles, 27 permissions, global and brand-scoped grants).
- `@sb/brands`: identities for all seven brands (palette, fonts, layout family, motion personality, categories, audiences, channels, licenses). All pass WCAG AA text contrast.
- `@sb/db`: PostgreSQL schema (organization, brand, brand_domain, Better Auth tables, rate_limit, role/permission, user_role, customer, audit_log), migrations, idempotent seed, repositories. Audit log is append-only, enforced by a database trigger.
- `@sb/auth`: Better Auth (email + password, scrypt hashing, 7-day sessions, DB-backed rate limiting: 5 sign-ins/min), staff context, permission guards, `create-owner` CLI. Public sign-up disabled for the admin.
- `@sb/storage`: storage interface with local-disk driver (HMAC-signed, expiring download URLs) and S3-compatible driver (presigned URLs) for Cloudflare R2 / S3 / MinIO.
- `@sb/ui`: shared themed React primitives.
- `apps/admin`: login, overview, brand list, brand editor (settings, color tokens, live theme preview, contrast check, status), team & roles, audit log, infrastructure checks, honest placeholders for the 12 sections scheduled for later phases.
- API: `GET /api/health`, `GET /api/v1/brands`, `GET|PATCH /api/v1/brands/:slug`, `/api/auth/*`, `/api/storage/download`.
- Tests: 79 unit/integration tests (real Postgres; S3 driver tested against the moto emulator) and 10 Playwright end-to-end tests.
- CI workflow (`.github/workflows/seven-brands.yml`) limited to changes under `seven-brands/`.
- The 14 required project documents.

### Changed (repository root, n8n deployment files)
- Renamed `Dockerfiler` → `Dockerfile` so `render.yaml` can find it.
- Removed the hard-coded `admin` / `adminpass` credentials and the obsolete `N8N_BASIC_AUTH_*` variables. The old password is still in git history; treat it as public.

### Decisions (approved 2026-11-24)
D1 code in `seven-brands/` on this branch · D2 one multi-tenant storefront app · D3 Drizzle · D4 Cloudflare + Neon + R2 · D5 Merchant of Record, test mode first · D6 no domain purchases yet · D7 n8n internal-only · D8 Anthropic key at Phase 2.

## [0.0.1] — 2026-11-24 — Phase 0: Discovery
- `docs/PHASE_0_REPORT.md`: repository inspection, architecture, cost model, risks, MVP definition.
