# AI agent architecture

Status: **implemented (Phase 2)**, tested with recorded fixtures and a local fake of the Anthropic API. **Not yet run against the live API** — that needs `DAOS_ANTHROPIC_API_KEY`.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `DAOS_ANTHROPIC_API_KEY` | Enables the Anthropic provider | unset → AI jobs refused with a clear message |
| `DAOS_ANTHROPIC_MODEL` | Model id | `claude-opus-5-5` |
| `DAOS_ANTHROPIC_BASE_URL` | Override API host | `https://api.anthropic.com` (never read from `ANTHROPIC_BASE_URL`) |
| `DAOS_AI_PROVIDER=fixture` | Labelled demo/test mode with recorded outputs | off |
| `DAOS_AI_DAILY_BUDGET_USD` / `DAOS_AI_MONTHLY_BUDGET_USD` | Spend caps checked before every call | 5 / 50 |

The key goes in the cloud environment's variables (or the host's secret store in production) — never in the repo.

## Agents (workflow steps, not open-ended loops)

| Agent | Output (typed via structured outputs) | Effort |
|---|---|---|
| `creative_director` | Concept: name, slug, category, tags, artwork, animatable parts, motion, sound, label | medium |
| `svg_artist` | Complete SVG; importer validates and can send errors back once | high |
| `animator` | Duration, tracks (with pivots), markers, sound cues, still frame; QA can send errors back once | medium |

Code (`packages/agents/src/pipeline.ts`) orchestrates; models only fill typed slots. Every output is re-validated by the Asset Definition schema and QA.

## Provider layer

`ModelProvider.generate({ agent, system, prompt, schema, effort })` → `{ output, model, usage, costUsd }`.

The Anthropic adapter: Messages API (beta endpoint) with structured JSON output, `fallbacks: "default"` (server-side refusal fallback, beta `server-side-fallback-2026-07-01`), cached system prompt, explicit effort. It checks `stop_reason` before parsing: refusals and auth errors are permanent; rate limits, 5xx and truncated/invalid output are retryable. Cost uses the model that actually served the request.

## Permission boundaries

Agents never touch the database, storage, secrets, payments or customers. The worker records their calls, stores results as **new versions in draft/in_review**, and nothing is published without a human approval (`asset.review`, audited). Fixture-made assets are labelled everywhere and marked "not for sale".

## Next

Eval set per agent before production use; batch API (−50%) for collections; catalog/metadata agent (Phase 3).
