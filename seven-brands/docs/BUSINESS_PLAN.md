# Business plan (summary)

Full analysis: `PHASE_0_REPORT.md` §2 and §7. This page is the short, living version.

## Thesis

Animated icons are close to a commodity (LottieFiles, Lordicon, Icons8, Flaticon). We win on what they rarely combine:

1. **Motion and sound designed together**, with timing cues wired up for web, video and apps.
2. **No-code customization → one-click multi-format export** (SVG, GIF, MP4-with-audio, Lottie, React, Web Component).
3. **Parametric rigs** that give consistent, cheap, large collections.
4. **Plain-language licensing.**
5. **Vertical packaging** for a job to be done (e.g. "Shopify checkout animations", "phonics set").

## Structure

One parent company (Seven Brands) owns seven brands. Shared: platform, production factory, payments, accounts, licensing, analytics, finance. Separate per brand: identity, storefront, catalog, pricing, marketing.

## Revenue model

| Offer | Price hypothesis | Notes |
|---|---|---|
| Free starter pack | $0 | Lead magnet; email capture |
| Single asset | ~$5 minimum | Below this, payment fees take >15% |
| Pack / bundle | $9–29 | Primary product |
| Complete collection | $29–49 | |
| Lifetime per brand | $49–99 | |
| Subscription | TBD | Only once release cadence is proven |
| Licenses | Personal · Commercial · Team · Agency · Enterprise | Enterprise by quote |

## Go-to-market order

Moodicons + SonicGlyphs → (validate) → CineGlyphs + AtmosIcons → ShopMotion + LearnIcons → AliveUI. Channels per brand are in `brands/src/index.ts` (`marketingChannels`).

## Unit economics (launch, per order, MoR at 5% + $0.50)

| Order | Fees | Net |
|---|---|---|
| $5 | $0.75 | $4.25 |
| $19 | $1.45 | $17.55 |
| $49 | $2.95 | $46.05 |

Production cost per asset: ≈ $0.05–0.20 AI (≈ $0 for rig-based assets) + human review time. Fixed platform cost at launch ≈ $15–45/month (COST_MODEL.md).

## Top risks

Crowded market · focus split across seven brands · AI-art copyright weakness · trademark conflicts · child-privacy duties (LearnIcons) · payment onboarding from the Philippines. Mitigations: PHASE_0_REPORT.md §2.3.

## Legal/administrative to-dos (owner)

Business registration (BIR/DTI or SEC) · trademark search · Merchant of Record onboarding · lawyer review of license terms, terms of service, privacy policy.
