# Cost model

List prices as known on 2026-11-24. **Verify on each vendor's site before purchasing. Nothing has been purchased.**

## Current spend: $0

Development runs locally (Postgres, local storage). No paid service is provisioned.

## Infrastructure (approved option A: Cloudflare + Neon + R2)

| Component | Free tier | Paid trigger / price |
|---|---|---|
| Cloudflare Workers (Next.js via OpenNext) | 100k requests/day, commercial use OK | Workers Paid $5/mo |
| Neon Postgres | 0.5 GB, autosuspend | usage-based, ~$5–19/mo at launch scale |
| Cloudflare R2 | 10 GB, zero egress | $0.015/GB-month |
| Worker for exports (Fly.io or small VPS) | — | ~$3–6/mo |
| Resend (email) | 3,000/mo | $20/mo |
| Sentry | 5k errors/mo | $26/mo |
| GitHub Actions | 2,000 min/mo on private repos | per-minute after |

Vercel Hobby forbids commercial use (Pro $20/user/mo) — not chosen.

## Monthly totals by stage

| Stage | Infra | Notes |
|---|---|---|
| Development | $0 | |
| Private beta | $0–10 | |
| Launch (2 brands, ~10k visits, ~100 orders) | $15–45 | + payment fees |
| Growth (7 brands, ~200k visits) | $80–250 | |

## Variable costs

| Item | Estimate |
|---|---|
| Payment (Merchant of Record) | ~5% + $0.50 per order (Paddle / Lemon Squeezy; verify) |
| AI per finished asset | $0.05–0.20 (LLM-drafted); ≈ $0 for rig-based |
| AI per 100-asset collection | $5–20 |
| Export rendering | CPU only; cents per collection |

AI price inputs (Anthropic list, per million tokens): Claude Opus 5.5 $4 in / $20 out; Claude Sonnet 5.5 $2 / $10; Claude Haiku 5.5 $0.10 / $0.50. Batch API halves these.

## One-time

Domains ~$10–15/yr each (deferred, D6) · trademark searches · legal review of license/terms/privacy (quote needed) · optional Stripe Atlas (~$500) only if a US entity is ever wanted.

## Controls

- Daily/monthly AI caps enforced before every model call (`DAOS_AI_DAILY_BUDGET_USD`, default $5; `DAOS_AI_MONTHLY_BUDGET_USD`, default $50); jobs fail clearly at the cap.
- Provider-side spend limits where offered (Anthropic console, Cloudflare).
- `expense` table + admin Expenses page: AI costs booked automatically per call; owner records other costs.
- Rig-based production costs $0 in AI.
- No permanent GPUs.
